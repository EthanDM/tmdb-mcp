import type {
  MovieDetails,
  MoviePage,
  MovieSummary,
  RegionalWatchProviders,
  WatchProvider
} from "../types.js";

export type TmdbMovieResult = {
  id: number;
  title: string;
  original_title: string;
  release_date?: string;
  overview?: string;
  genre_ids?: number[];
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  poster_path?: string | null;
  backdrop_path?: string | null;
};

export type TmdbMovieDetails = TmdbMovieResult & {
  tagline?: string;
  runtime?: number | null;
  status?: string;
  genres?: Array<{ id: number; name: string }>;
  production_countries?: Array<{ iso_3166_1: string; name: string }>;
  belongs_to_collection?: { id: number; name: string } | null;
  imdb_id?: string | null;
  credits?: {
    cast?: Array<{
      id: number;
      name: string;
      character?: string;
      order?: number;
    }>;
    crew?: Array<{ id: number; name: string; job?: string }>;
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

export type TmdbMoviePage = {
  results: TmdbMovieResult[];
  page: number;
  total_pages: number;
  total_results: number;
};

export type TmdbProvider = {
  provider_id: number;
  provider_name: string;
  logo_path?: string | null;
  display_priority?: number;
};

export type TmdbWatchProviderResponse = {
  results?: Record<
    string,
    {
      link?: string;
      flatrate?: TmdbProvider[];
      free?: TmdbProvider[];
      ads?: TmdbProvider[];
      rent?: TmdbProvider[];
      buy?: TmdbProvider[];
    }
  >;
};

/**
 * Converts TMDB's path-based image representation into stable, compact movie data.
 */
export function normalizeMovie(
  movie: TmdbMovieResult,
  imageBaseUrl: string
): MovieSummary {
  const releaseDate = movie.release_date || null;

  return {
    id: movie.id,
    title: movie.title,
    original_title: movie.original_title,
    release_date: releaseDate,
    year: releaseDate ? Number(releaseDate.slice(0, 4)) || null : null,
    overview: movie.overview || "",
    genre_ids: movie.genre_ids || [],
    vote_average: movie.vote_average || 0,
    vote_count: movie.vote_count || 0,
    popularity: movie.popularity || 0,
    poster_url: imageUrl(imageBaseUrl, "w500", movie.poster_path),
    backdrop_url: imageUrl(imageBaseUrl, "w780", movie.backdrop_path),
    tmdb_url: `https://www.themoviedb.org/movie/${movie.id}`
  };
}

/**
 * Normalizes a paginated TMDB response without silently traversing later pages.
 */
export function normalizeMoviePage(
  response: TmdbMoviePage,
  imageBaseUrl: string
): MoviePage {
  return {
    items: response.results.map((movie) => normalizeMovie(movie, imageBaseUrl)),
    page: response.page,
    total_pages: response.total_pages,
    total_results: response.total_results,
    next_page: response.page < response.total_pages ? response.page + 1 : null
  };
}

/**
 * Enriches a movie with the discovery context agents commonly need in one read.
 */
export function normalizeMovieDetails(
  movie: TmdbMovieDetails,
  providers: TmdbWatchProviderResponse,
  region: string,
  imageBaseUrl: string
): MovieDetails {
  const directors =
    movie.credits?.crew
      ?.filter((person) => person.job === "Director")
      .map((person) => ({
        id: person.id,
        name: person.name,
        job: person.job
      })) || [];
  const cast =
    movie.credits?.cast
      ?.slice()
      .sort((left, right) => (left.order ?? 999) - (right.order ?? 999))
      .slice(0, 10)
      .map((person) => ({
        id: person.id,
        name: person.name,
        character: person.character
      })) || [];
  const trailer = selectTrailer(movie.videos?.results || []);

  return {
    ...normalizeMovie(movie, imageBaseUrl),
    tagline: movie.tagline || null,
    runtime_minutes: movie.runtime ?? null,
    status: movie.status || null,
    genres: movie.genres || [],
    production_countries:
      movie.production_countries?.map((country) => country.name) || [],
    collection: movie.belongs_to_collection
      ? {
          id: movie.belongs_to_collection.id,
          name: movie.belongs_to_collection.name
        }
      : null,
    directors,
    cast,
    trailer_url: trailer
      ? `https://www.youtube.com/watch?v=${trailer.key}`
      : null,
    imdb_id: movie.imdb_id || null,
    watch_providers: normalizeRegionalProviders(providers, region, imageBaseUrl)
  };
}

/**
 * Provider data is region-specific and legally requires JustWatch attribution.
 */
export function normalizeRegionalProviders(
  response: TmdbWatchProviderResponse,
  region: string,
  imageBaseUrl: string
): RegionalWatchProviders {
  const regionKey = region.toUpperCase();
  const result = response.results?.[regionKey];

  return {
    region: regionKey,
    tmdb_watch_url: result?.link || null,
    stream: normalizeProviders(result?.flatrate, imageBaseUrl),
    free: normalizeProviders(result?.free, imageBaseUrl),
    ads: normalizeProviders(result?.ads, imageBaseUrl),
    rent: normalizeProviders(result?.rent, imageBaseUrl),
    buy: normalizeProviders(result?.buy, imageBaseUrl),
    attribution: "JustWatch"
  };
}

function normalizeProviders(
  providers: TmdbProvider[] | undefined,
  imageBaseUrl: string
): WatchProvider[] {
  return (providers || []).map((provider) => ({
    id: provider.provider_id,
    name: provider.provider_name,
    logo_url: imageUrl(imageBaseUrl, "w92", provider.logo_path)
  }));
}

function selectTrailer(
  videos: NonNullable<TmdbMovieDetails["videos"]>["results"] extends
    infer T | undefined
    ? T extends Array<infer V>
      ? V[]
      : never
    : never
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
