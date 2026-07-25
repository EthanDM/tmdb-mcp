import type {
  PersonCreditResult,
  PersonCreditsResult,
  PersonDetails,
  PersonSearchPage,
  PersonSearchResult
} from "../types.js";

type KnownForItem = {
  media_type: "movie" | "tv";
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
};

export type TmdbPersonSearchResult = {
  id: number;
  name: string;
  known_for_department?: string;
  popularity?: number;
  profile_path?: string | null;
  known_for?: KnownForItem[];
};

export type TmdbPersonSearchPage = {
  results: TmdbPersonSearchResult[];
  page: number;
  total_pages: number;
  total_results: number;
};

export type TmdbPersonDetails = TmdbPersonSearchResult & {
  also_known_as?: string[];
  biography?: string;
  birthday?: string | null;
  deathday?: string | null;
  place_of_birth?: string | null;
  imdb_id?: string | null;
};

export type TmdbPersonCredit = {
  media_type?: "movie" | "tv";
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  character?: string;
  job?: string;
  department?: string;
  episode_count?: number;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  poster_path?: string | null;
};

export type TmdbPersonCreditsResponse = {
  id: number;
  cast?: TmdbPersonCredit[];
  crew?: TmdbPersonCredit[];
};

/**
 * Keeps search results lightweight while preserving enough known-work context
 * to disambiguate people with the same or similar names.
 */
export function normalizePersonSearchPage(
  response: TmdbPersonSearchPage,
  imageBaseUrl: string
): PersonSearchPage {
  return {
    items: response.results.map((person) =>
      normalizePersonSearchResult(person, imageBaseUrl)
    ),
    page: response.page,
    total_pages: response.total_pages,
    total_results: response.total_results,
    next_page: response.page < response.total_pages ? response.page + 1 : null
  };
}

/**
 * Normalizes biography and identity fields without pulling a potentially huge
 * filmography into the same response.
 */
export function normalizePersonDetails(
  person: TmdbPersonDetails,
  imageBaseUrl: string
): PersonDetails {
  return {
    id: person.id,
    name: person.name,
    also_known_as: person.also_known_as || [],
    biography: person.biography || "",
    birthday: person.birthday || null,
    deathday: person.deathday || null,
    place_of_birth: person.place_of_birth || null,
    known_for_department: person.known_for_department || null,
    popularity: person.popularity || 0,
    profile_url: imageUrl(imageBaseUrl, "h632", person.profile_path),
    imdb_id: person.imdb_id || null,
    tmdb_url: `https://www.themoviedb.org/person/${person.id}`
  };
}

/**
 * Filters, sorts, and caps unpaginated TMDB credit arrays before returning them
 * through MCP so prolific careers cannot produce unbounded tool responses.
 */
export function normalizePersonCredits(
  response: TmdbPersonCreditsResponse,
  options: {
    mediaType: "movie" | "tv" | "combined";
    creditType: "cast" | "crew" | "all";
    sortBy: "date" | "popularity" | "vote_average";
    limit: number;
  },
  imageBaseUrl: string
): PersonCreditsResult {
  const candidates: Array<PersonCreditResult | null> = [];

  if (options.creditType !== "crew") {
    candidates.push(
      ...(response.cast || []).map((credit) =>
        normalizeCredit(credit, "cast", options.mediaType, imageBaseUrl)
      )
    );
  }
  if (options.creditType !== "cast") {
    candidates.push(
      ...(response.crew || []).map((credit) =>
        normalizeCredit(credit, "crew", options.mediaType, imageBaseUrl)
      )
    );
  }

  const filtered = candidates
    .filter((credit): credit is PersonCreditResult => credit !== null)
    .sort(creditComparator(options.sortBy));

  return {
    person_id: response.id,
    items: filtered.slice(0, options.limit),
    total_matching: filtered.length,
    returned: Math.min(filtered.length, options.limit)
  };
}

function normalizePersonSearchResult(
  person: TmdbPersonSearchResult,
  imageBaseUrl: string
): PersonSearchResult {
  return {
    id: person.id,
    name: person.name,
    known_for_department: person.known_for_department || null,
    popularity: person.popularity || 0,
    profile_url: imageUrl(imageBaseUrl, "h632", person.profile_path),
    known_for: (person.known_for || []).map((item) => {
      const date = item.release_date || item.first_air_date || null;
      return {
        media_type: item.media_type,
        id: item.id,
        title: item.title || item.name || "",
        year: date ? Number(date.slice(0, 4)) || null : null
      };
    }),
    tmdb_url: `https://www.themoviedb.org/person/${person.id}`
  };
}

function normalizeCredit(
  credit: TmdbPersonCredit,
  creditType: "cast" | "crew",
  requestedMediaType: "movie" | "tv" | "combined",
  imageBaseUrl: string
): PersonCreditResult | null {
  const mediaType =
    credit.media_type ||
    (requestedMediaType === "combined" ? null : requestedMediaType);
  if (
    !mediaType ||
    (requestedMediaType !== "combined" && mediaType !== requestedMediaType)
  ) {
    return null;
  }

  const date = credit.release_date || credit.first_air_date || null;
  return {
    media_type: mediaType,
    credit_type: creditType,
    id: credit.id,
    title: credit.title || credit.name || "",
    date,
    year: date ? Number(date.slice(0, 4)) || null : null,
    character: credit.character || null,
    job: credit.job || null,
    department: credit.department || null,
    episode_count: credit.episode_count ?? null,
    vote_average: credit.vote_average || 0,
    vote_count: credit.vote_count || 0,
    popularity: credit.popularity || 0,
    poster_url: imageUrl(imageBaseUrl, "w342", credit.poster_path),
    tmdb_url: `https://www.themoviedb.org/${mediaType}/${credit.id}`
  };
}

function creditComparator(
  sortBy: "date" | "popularity" | "vote_average"
): (left: PersonCreditResult, right: PersonCreditResult) => number {
  if (sortBy === "popularity") {
    return (left, right) => right.popularity - left.popularity;
  }
  if (sortBy === "vote_average") {
    return (left, right) =>
      right.vote_average - left.vote_average ||
      right.vote_count - left.vote_count;
  }
  return (left, right) => (right.date || "").localeCompare(left.date || "");
}

function imageUrl(
  baseUrl: string,
  size: string,
  path: string | null | undefined
): string | null {
  return path ? `${baseUrl}${size}${path}` : null;
}
