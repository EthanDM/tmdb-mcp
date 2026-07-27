import type {
  CatalogSearchPage,
  CollectionSearchPage,
  CreditsResult,
  ReviewPage
} from "../types.js";

type Page<T> = {
  results: T[];
  page: number;
  total_pages: number;
  total_results: number;
};

export type TmdbMultiPage = Page<Record<string, unknown>>;
export type TmdbCollectionPage = Page<Record<string, unknown>>;
export type TmdbReviewPage = Page<Record<string, unknown>>;
export type TmdbCredits = {
  cast?: Array<Record<string, unknown>>;
  crew?: Array<Record<string, unknown>>;
};

/**
 * Preserves TMDB relevance order while presenting all searchable media through
 * one stable shape.
 */
export function normalizeMultiSearch(
  response: TmdbMultiPage,
  imageBaseUrl: string
): CatalogSearchPage {
  return pageResult(
    response,
    response.results.flatMap((item) => {
      const mediaType = item.media_type;
      if (
        mediaType !== "movie" &&
        mediaType !== "tv" &&
        mediaType !== "person"
      ) {
        return [];
      }
      const imagePath =
        mediaType === "person" ? item.profile_path : item.poster_path;
      return [
        {
          media_type: mediaType,
          id: Number(item.id),
          title: String(item.title || item.name || ""),
          date: stringOrNull(item.release_date || item.first_air_date),
          overview: String(item.overview || ""),
          known_for_department:
            mediaType === "person"
              ? stringOrNull(item.known_for_department)
              : null,
          popularity: numberOrZero(item.popularity),
          image_url: imageUrl(imageBaseUrl, "w500", imagePath),
          tmdb_url: `https://www.themoviedb.org/${mediaType}/${Number(item.id)}`
        }
      ];
    })
  );
}

export function normalizeCollectionSearch(
  response: TmdbCollectionPage,
  imageBaseUrl: string
): CollectionSearchPage {
  return pageResult(
    response,
    response.results.map((item) => ({
      id: Number(item.id),
      name: String(item.name || ""),
      overview: String(item.overview || ""),
      poster_url: imageUrl(imageBaseUrl, "w500", item.poster_path),
      backdrop_url: imageUrl(imageBaseUrl, "w780", item.backdrop_path),
      tmdb_url: `https://www.themoviedb.org/collection/${Number(item.id)}`
    }))
  );
}

/**
 * Aggregate TV credits store roles and jobs as nested arrays; ordinary movie
 * and episode credits use singular fields. This flattens both without losing
 * the distinct roles a person held.
 */
export function normalizeCredits(
  response: TmdbCredits,
  input: {
    mediaType: "movie" | "tv";
    id: number;
    seasonNumber?: number;
    episodeNumber?: number;
    creditType: "cast" | "crew" | "all";
    limit: number;
  },
  imageBaseUrl: string
): CreditsResult {
  const cast =
    input.creditType === "crew"
      ? []
      : (response.cast || []).map((person) =>
          normalizeCredit(person, "cast", imageBaseUrl)
        );
  const crew =
    input.creditType === "cast"
      ? []
      : (response.crew || []).map((person) =>
          normalizeCredit(person, "crew", imageBaseUrl)
        );
  const items = [...cast, ...crew];
  const returnedItems =
    input.creditType === "all"
      ? takeBalancedCredits(cast, crew, input.limit)
      : items.slice(0, input.limit);

  return {
    media_type: input.mediaType,
    id: input.id,
    season_number: input.seasonNumber ?? null,
    episode_number: input.episodeNumber ?? null,
    items: returnedItems,
    total_matching: items.length,
    returned: returnedItems.length
  };
}

export function normalizeReviews(
  mediaType: "movie" | "tv",
  id: number,
  response: TmdbReviewPage,
  imageBaseUrl: string
): ReviewPage {
  return {
    media_type: mediaType,
    id,
    ...pageResult(
      response,
      response.results.map((review) => {
        const details =
          (review.author_details as Record<string, unknown> | undefined) || {};
        const avatarPath = stringOrNull(details.avatar_path);
        const externalAvatar = avatarPath?.replace(/^\/+/, "");
        return {
          id: String(review.id || ""),
          author: String(
            review.author || details.name || details.username || ""
          ),
          rating: typeof details.rating === "number" ? details.rating : null,
          content: String(review.content || ""),
          created_at: stringOrNull(review.created_at),
          updated_at: stringOrNull(review.updated_at),
          url: stringOrNull(review.url),
          avatar_url: externalAvatar?.startsWith("http")
            ? externalAvatar
            : imageUrl(imageBaseUrl, "w185", avatarPath)
        };
      })
    )
  };
}

function normalizeCredit(
  person: Record<string, unknown>,
  creditType: "cast" | "crew",
  imageBaseUrl: string
) {
  const roles = arrayOfRecords(person.roles);
  const jobs = arrayOfRecords(person.jobs);
  return {
    id: Number(person.id),
    name: String(person.name || ""),
    credit_type: creditType,
    character:
      creditType === "cast"
        ? joinedValues(roles, "character") || stringOrNull(person.character)
        : null,
    job:
      creditType === "crew"
        ? joinedValues(jobs, "job") || stringOrNull(person.job)
        : null,
    department:
      creditType === "crew"
        ? stringOrNull(person.department || person.known_for_department)
        : null,
    episode_count:
      numberOrNull(person.total_episode_count) ??
      numberOrNull(person.episode_count),
    profile_url: imageUrl(imageBaseUrl, "w185", person.profile_path)
  };
}

/**
 * Guarantees that an all-credits request represents both categories when both
 * exist, then gives unused quota to whichever category has more results.
 */
function takeBalancedCredits<T>(cast: T[], crew: T[], limit: number): T[] {
  const castQuota = Math.ceil(limit / 2);
  const crewQuota = Math.floor(limit / 2);
  const selectedCast = cast.slice(0, castQuota);
  const selectedCrew = crew.slice(0, crewQuota);
  let remaining = limit - selectedCast.length - selectedCrew.length;

  if (remaining > 0) {
    selectedCast.push(...cast.slice(castQuota, castQuota + remaining));
    remaining = limit - selectedCast.length - selectedCrew.length;
  }
  if (remaining > 0) {
    selectedCrew.push(...crew.slice(crewQuota, crewQuota + remaining));
  }

  return [...selectedCast, ...selectedCrew];
}

function pageResult<T>(response: Page<unknown>, items: T[]) {
  return {
    items,
    page: response.page,
    total_pages: response.total_pages,
    total_results: response.total_results,
    next_page: response.page < response.total_pages ? response.page + 1 : null
  };
}

function joinedValues(items: Array<Record<string, unknown>>, key: string) {
  return [
    ...new Set(items.map((item) => String(item[key] || "")).filter(Boolean))
  ].join(", ");
}

function arrayOfRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function imageUrl(baseUrl: string, size: string, path: unknown): string | null {
  return typeof path === "string" && path ? `${baseUrl}${size}${path}` : null;
}
