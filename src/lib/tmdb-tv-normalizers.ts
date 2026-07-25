import type {
  TvSeriesDetails,
  TvSeriesPage,
  TvSeriesSummary
} from "../types.js";
import {
  normalizeRegionalProviders,
  type TmdbWatchProviderResponse
} from "./tmdb-normalizers.js";

export type TmdbTvResult = {
  id: number;
  name: string;
  original_name: string;
  first_air_date?: string;
  overview?: string;
  genre_ids?: number[];
  origin_country?: string[];
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  poster_path?: string | null;
  backdrop_path?: string | null;
};

export type TmdbTvDetails = TmdbTvResult & {
  tagline?: string;
  status?: string;
  type?: string;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  last_air_date?: string;
  in_production?: boolean;
  genres?: Array<{ id: number; name: string }>;
  created_by?: Array<{ id: number; name: string }>;
  networks?: Array<{
    id: number;
    name: string;
    logo_path?: string | null;
  }>;
  aggregate_credits?: {
    cast?: Array<{
      id: number;
      name: string;
      order?: number;
      roles?: Array<{ character?: string; episode_count?: number }>;
    }>;
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

export type TmdbTvPage = {
  results: TmdbTvResult[];
  page: number;
  total_pages: number;
  total_results: number;
};

/**
 * Maps TMDB's TV-specific naming and air-date fields into a compact result.
 */
export function normalizeTvSeries(
  series: TmdbTvResult,
  imageBaseUrl: string
): TvSeriesSummary {
  const firstAirDate = series.first_air_date || null;

  return {
    id: series.id,
    name: series.name,
    original_name: series.original_name,
    first_air_date: firstAirDate,
    first_air_year: firstAirDate
      ? Number(firstAirDate.slice(0, 4)) || null
      : null,
    overview: series.overview || "",
    genre_ids: series.genre_ids || [],
    origin_countries: series.origin_country || [],
    vote_average: series.vote_average || 0,
    vote_count: series.vote_count || 0,
    popularity: series.popularity || 0,
    poster_url: imageUrl(imageBaseUrl, "w500", series.poster_path),
    backdrop_url: imageUrl(imageBaseUrl, "w780", series.backdrop_path),
    tmdb_url: `https://www.themoviedb.org/tv/${series.id}`
  };
}

/**
 * Preserves TMDB pagination so callers decide when to request more TV results.
 */
export function normalizeTvPage(
  response: TmdbTvPage,
  imageBaseUrl: string
): TvSeriesPage {
  return {
    items: response.results.map((series) =>
      normalizeTvSeries(series, imageBaseUrl)
    ),
    page: response.page,
    total_pages: response.total_pages,
    total_results: response.total_results,
    next_page: response.page < response.total_pages ? response.page + 1 : null
  };
}

/**
 * Enriches a series with creators, top aggregate cast, trailer, and availability.
 */
export function normalizeTvDetails(
  series: TmdbTvDetails,
  providers: TmdbWatchProviderResponse,
  region: string,
  imageBaseUrl: string
): TvSeriesDetails {
  const trailer = selectTrailer(series.videos?.results || []);
  const runtime = (series.episode_run_time || []).find((value) => value > 0);

  return {
    ...normalizeTvSeries(series, imageBaseUrl),
    tagline: series.tagline || null,
    status: series.status || null,
    type: series.type || null,
    episode_runtime_minutes: runtime ?? null,
    seasons_total: series.number_of_seasons || 0,
    episodes_total: series.number_of_episodes || 0,
    last_air_date: series.last_air_date || null,
    in_production: series.in_production || false,
    genres: series.genres || [],
    creators:
      series.created_by?.map((creator) => ({
        id: creator.id,
        name: creator.name
      })) || [],
    networks:
      series.networks?.map((network) => ({
        id: network.id,
        name: network.name,
        logo_url: imageUrl(imageBaseUrl, "w92", network.logo_path)
      })) || [],
    cast:
      series.aggregate_credits?.cast
        ?.slice()
        .sort((left, right) => (left.order ?? 999) - (right.order ?? 999))
        .slice(0, 10)
        .map((person) => ({
          id: person.id,
          name: person.name,
          character: person.roles?.[0]?.character
        })) || [],
    trailer_url: trailer
      ? `https://www.youtube.com/watch?v=${trailer.key}`
      : null,
    watch_providers: normalizeRegionalProviders(providers, region, imageBaseUrl)
  };
}

function selectTrailer(
  videos: Array<{
    key: string;
    site: string;
    type: string;
    official?: boolean;
  }>
) {
  const youtubeTrailers = videos.filter(
    (video) => video.site === "YouTube" && video.type === "Trailer"
  );
  return (
    youtubeTrailers.find((video) => video.official) ||
    youtubeTrailers[0] ||
    null
  );
}

function imageUrl(
  baseUrl: string,
  size: string,
  path: string | null | undefined
): string | null {
  return path ? `${baseUrl}${size}${path}` : null;
}
