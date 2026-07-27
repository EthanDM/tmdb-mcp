import type {
  ContentRatingsResult,
  ExternalIdFindResult,
  ExternalIdMatch,
  KeywordSearchPage,
  MovieCollectionDetails,
  PersonCredit,
  TvEpisodeDetails,
  TvEpisodeSummary,
  TvSeasonDetails
} from "../types.js";
import { normalizeMovie, type TmdbMovieResult } from "./tmdb-normalizers.js";

type TmdbEpisode = {
  id: number;
  name: string;
  overview?: string;
  air_date?: string;
  season_number: number;
  episode_number: number;
  runtime?: number | null;
  vote_average?: number;
  vote_count?: number;
  still_path?: string | null;
  production_code?: string;
  crew?: Array<{ id: number; name: string; job?: string }>;
  guest_stars?: Array<{ id: number; name: string; character?: string }>;
  credits?: {
    crew?: Array<{ id: number; name: string; job?: string }>;
    guest_stars?: Array<{ id: number; name: string; character?: string }>;
  };
  videos?: {
    results?: Array<{
      key: string;
      site: string;
      type: string;
      official?: boolean;
    }>;
  };
};

export type TmdbSeason = {
  id: number;
  name: string;
  overview?: string;
  air_date?: string;
  season_number: number;
  poster_path?: string | null;
  episodes?: TmdbEpisode[];
};

export type TmdbCollection = {
  id: number;
  name: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  parts?: TmdbMovieResult[];
};

export type TmdbKeywordPage = {
  results: Array<{ id: number; name: string }>;
  page: number;
  total_pages: number;
  total_results: number;
};

export type TmdbFindResponse = {
  movie_results?: Array<Record<string, unknown>>;
  tv_results?: Array<Record<string, unknown>>;
  tv_season_results?: Array<Record<string, unknown>>;
  tv_episode_results?: Array<Record<string, unknown>>;
  person_results?: Array<Record<string, unknown>>;
};

/**
 * Returns a season with every episode in API order and stable episode URLs.
 */
export function normalizeTvSeason(
  seriesId: number,
  season: TmdbSeason,
  imageBaseUrl: string
): TvSeasonDetails {
  return {
    id: season.id,
    series_id: seriesId,
    name: season.name,
    overview: season.overview || "",
    air_date: season.air_date || null,
    season_number: season.season_number,
    poster_url: imageUrl(imageBaseUrl, "w500", season.poster_path),
    episodes: (season.episodes || []).map((episode) =>
      normalizeEpisodeSummary(seriesId, episode, imageBaseUrl)
    ),
    tmdb_url: `https://www.themoviedb.org/tv/${seriesId}/season/${season.season_number}`
  };
}

/**
 * Enriches an episode with directors, guest stars, and an official trailer.
 */
export function normalizeTvEpisode(
  seriesId: number,
  episode: TmdbEpisode,
  imageBaseUrl: string
): TvEpisodeDetails {
  const crew = episode.credits?.crew || episode.crew || [];
  const guests = episode.credits?.guest_stars || episode.guest_stars || [];
  const trailer = selectTrailer(episode.videos?.results || []);

  return {
    ...normalizeEpisodeSummary(seriesId, episode, imageBaseUrl),
    production_code: episode.production_code || null,
    directors: crew
      .filter((person) => person.job === "Director")
      .map(normalizeCrew),
    guest_stars: guests.slice(0, 20).map((person) => ({
      id: person.id,
      name: person.name,
      character: person.character
    })),
    trailer_url: trailer
      ? `https://www.youtube.com/watch?v=${trailer.key}`
      : null
  };
}

/**
 * Sorts collection parts chronologically while retaining undated titles last.
 */
export function normalizeCollection(
  collection: TmdbCollection,
  imageBaseUrl: string
): MovieCollectionDetails {
  const parts = (collection.parts || [])
    .map((movie) => normalizeMovie(movie, imageBaseUrl))
    .sort((left, right) => {
      if (!left.release_date && !right.release_date) return 0;
      if (!left.release_date) return 1;
      if (!right.release_date) return -1;
      return left.release_date.localeCompare(right.release_date);
    });

  return {
    id: collection.id,
    name: collection.name,
    overview: collection.overview || "",
    poster_url: imageUrl(imageBaseUrl, "w500", collection.poster_path),
    backdrop_url: imageUrl(imageBaseUrl, "w780", collection.backdrop_path),
    parts,
    tmdb_url: `https://www.themoviedb.org/collection/${collection.id}`
  };
}

/**
 * Preserves keyword pagination for use in subsequent discovery calls.
 */
export function normalizeKeywordPage(
  response: TmdbKeywordPage
): KeywordSearchPage {
  return {
    items: response.results,
    page: response.page,
    total_pages: response.total_pages,
    total_results: response.total_results,
    next_page: response.page < response.total_pages ? response.page + 1 : null
  };
}

/**
 * Flattens TMDB's category-specific external-ID response into one match list.
 */
export function normalizeFindResult(
  externalId: string,
  externalSource: string,
  response: TmdbFindResponse
): ExternalIdFindResult {
  const matches: ExternalIdMatch[] = [];
  appendFindMatches(matches, "movie", response.movie_results || []);
  appendFindMatches(matches, "tv", response.tv_results || []);
  appendFindMatches(matches, "tv_season", response.tv_season_results || []);
  appendFindMatches(matches, "tv_episode", response.tv_episode_results || []);
  appendFindMatches(matches, "person", response.person_results || []);
  return {
    external_id: externalId,
    external_source: externalSource,
    matches
  };
}

/**
 * Unifies movie release certifications and TV content ratings by region.
 */
export function normalizeContentRatings(
  mediaType: "movie" | "tv",
  id: number,
  response: unknown,
  region?: string
): ContentRatingsResult {
  const requestedRegion = region?.toUpperCase();
  const results =
    (response as { results?: Array<Record<string, unknown>> }).results || [];
  const regions = results.flatMap((entry) => {
    const code = String(entry.iso_3166_1 || "");
    if (requestedRegion && code !== requestedRegion) return [];

    if (mediaType === "tv") {
      return [
        {
          region: code,
          ratings: [
            {
              certification: String(entry.rating || ""),
              release_date: null,
              release_type: null,
              note: null
            }
          ]
        }
      ];
    }

    const releases =
      (entry.release_dates as Array<Record<string, unknown>> | undefined) || [];
    const ratings = releases
      .filter(
        (release) =>
          typeof release.certification === "string" &&
          release.certification.length > 0
      )
      .map((release) => ({
        certification: String(release.certification),
        release_date: stringOrNull(release.release_date),
        release_type: typeof release.type === "number" ? release.type : null,
        note: stringOrNull(release.note)
      }));
    if (ratings.length === 0) return [];

    return [
      {
        region: code,
        ratings
      }
    ];
  });

  return { media_type: mediaType, id, regions };
}

function normalizeEpisodeSummary(
  seriesId: number,
  episode: TmdbEpisode,
  imageBaseUrl: string
): TvEpisodeSummary {
  return {
    id: episode.id,
    name: episode.name,
    overview: episode.overview || "",
    air_date: episode.air_date || null,
    season_number: episode.season_number,
    episode_number: episode.episode_number,
    runtime_minutes: episode.runtime ?? null,
    vote_average: episode.vote_average || 0,
    vote_count: episode.vote_count || 0,
    still_url: imageUrl(imageBaseUrl, "w780", episode.still_path),
    tmdb_url: `https://www.themoviedb.org/tv/${seriesId}/season/${episode.season_number}/episode/${episode.episode_number}`
  };
}

function normalizeCrew(person: {
  id: number;
  name: string;
  job?: string;
}): PersonCredit {
  return { id: person.id, name: person.name, job: person.job };
}

function appendFindMatches(
  output: ExternalIdMatch[],
  mediaType: ExternalIdMatch["media_type"],
  entries: Array<Record<string, unknown>>
): void {
  for (const entry of entries) {
    const id = Number(entry.id);
    const seasonNumber = numberOrUndefined(entry.season_number);
    const episodeNumber = numberOrUndefined(entry.episode_number);
    const seriesId = numberOrUndefined(entry.show_id);
    output.push({
      media_type: mediaType,
      id,
      title: String(entry.title || entry.name || ""),
      date: stringOrNull(
        entry.release_date || entry.first_air_date || entry.air_date
      ),
      tmdb_url: findUrl(mediaType, id, seriesId, seasonNumber, episodeNumber),
      ...(seriesId !== undefined ? { series_id: seriesId } : {}),
      ...(seasonNumber !== undefined ? { season_number: seasonNumber } : {}),
      ...(episodeNumber !== undefined ? { episode_number: episodeNumber } : {})
    });
  }
}

function findUrl(
  mediaType: ExternalIdMatch["media_type"],
  id: number,
  seriesId?: number,
  seasonNumber?: number,
  episodeNumber?: number
): string {
  if (mediaType === "tv_season" && seriesId !== undefined) {
    return `https://www.themoviedb.org/tv/${seriesId}/season/${seasonNumber}`;
  }
  if (mediaType === "tv_episode" && seriesId !== undefined) {
    return `https://www.themoviedb.org/tv/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}`;
  }
  return `https://www.themoviedb.org/${mediaType}/${id}`;
}

function selectTrailer(
  videos: Array<{
    key: string;
    site: string;
    type: string;
    official?: boolean;
  }>
) {
  const trailers = videos.filter(
    (video) => video.site === "YouTube" && video.type === "Trailer"
  );
  return trailers.find((video) => video.official) || trailers[0] || null;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function imageUrl(
  baseUrl: string,
  size: string,
  path: string | null | undefined
): string | null {
  return path ? `${baseUrl}${size}${path}` : null;
}
