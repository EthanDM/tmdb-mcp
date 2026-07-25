export type MovieSummary = {
  id: number;
  title: string;
  original_title: string;
  release_date: string | null;
  year: number | null;
  overview: string;
  genre_ids: number[];
  vote_average: number;
  vote_count: number;
  popularity: number;
  poster_url: string | null;
  backdrop_url: string | null;
  tmdb_url: string;
};

export type PersonCredit = {
  id: number;
  name: string;
  character?: string;
  job?: string;
};

export type WatchProvider = {
  id: number;
  name: string;
  logo_url: string | null;
};

export type RegionalWatchProviders = {
  region: string;
  tmdb_watch_url: string | null;
  stream: WatchProvider[];
  free: WatchProvider[];
  ads: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
  attribution: "JustWatch";
};

export type MovieDetails = MovieSummary & {
  tagline: string | null;
  runtime_minutes: number | null;
  status: string | null;
  genres: Array<{ id: number; name: string }>;
  production_countries: string[];
  collection: { id: number; name: string } | null;
  directors: PersonCredit[];
  cast: PersonCredit[];
  trailer_url: string | null;
  imdb_id: string | null;
  watch_providers: RegionalWatchProviders;
};

export type MoviePage = {
  items: MovieSummary[];
  page: number;
  total_pages: number;
  total_results: number;
  next_page: number | null;
};

export type Genre = {
  id: number;
  name: string;
};

export type ProviderCatalogItem = WatchProvider & {
  display_priority: number;
};

export type MovieListCategory =
  "popular" | "top_rated" | "now_playing" | "upcoming";

export type RelatedMovieKind = "recommendations" | "similar";

export type DiscoverMoviesInput = {
  genres?: number[];
  genreMode?: "and" | "or";
  excludeGenres?: number[];
  releaseYear?: number;
  releaseDateFrom?: string;
  releaseDateTo?: string;
  minRating?: number;
  minVoteCount?: number;
  minRuntime?: number;
  maxRuntime?: number;
  originalLanguage?: string;
  watchProviderIds?: number[];
  watchMonetizationTypes?: Array<"flatrate" | "free" | "ads" | "rent" | "buy">;
  sortBy?:
    | "popularity.desc"
    | "vote_average.desc"
    | "vote_count.desc"
    | "primary_release_date.desc"
    | "revenue.desc";
  page: number;
  language?: string;
  region?: string;
};

export type TvSeriesSummary = {
  id: number;
  name: string;
  original_name: string;
  first_air_date: string | null;
  first_air_year: number | null;
  overview: string;
  genre_ids: number[];
  origin_countries: string[];
  vote_average: number;
  vote_count: number;
  popularity: number;
  poster_url: string | null;
  backdrop_url: string | null;
  tmdb_url: string;
};

export type TvSeriesDetails = TvSeriesSummary & {
  tagline: string | null;
  status: string | null;
  type: string | null;
  episode_runtime_minutes: number | null;
  seasons_total: number;
  episodes_total: number;
  last_air_date: string | null;
  in_production: boolean;
  genres: Genre[];
  creators: Array<{ id: number; name: string }>;
  networks: Array<{ id: number; name: string; logo_url: string | null }>;
  cast: PersonCredit[];
  trailer_url: string | null;
  watch_providers: RegionalWatchProviders;
};

export type TvSeriesPage = {
  items: TvSeriesSummary[];
  page: number;
  total_pages: number;
  total_results: number;
  next_page: number | null;
};

export type TvListCategory =
  "airing_today" | "on_the_air" | "popular" | "top_rated";

export type DiscoverTvInput = {
  genres?: number[];
  genreMode?: "and" | "or";
  excludeGenres?: number[];
  firstAirYear?: number;
  firstAirDateFrom?: string;
  firstAirDateTo?: string;
  minRating?: number;
  minVoteCount?: number;
  minRuntime?: number;
  maxRuntime?: number;
  originalLanguage?: string;
  watchProviderIds?: number[];
  watchMonetizationTypes?: Array<"flatrate" | "free" | "ads" | "rent" | "buy">;
  sortBy?:
    | "popularity.desc"
    | "vote_average.desc"
    | "vote_count.desc"
    | "first_air_date.desc";
  page: number;
  language?: string;
  region?: string;
};
