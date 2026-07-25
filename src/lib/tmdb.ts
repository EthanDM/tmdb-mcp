import type { TmdbConfig } from "../config.js";
import type {
  DiscoverMoviesInput,
  Genre,
  MovieDetails,
  MovieListCategory,
  MoviePage,
  ProviderCatalogItem,
  RelatedMovieKind
} from "../types.js";
import {
  normalizeMovieDetails,
  normalizeMoviePage,
  type TmdbMovieDetails,
  type TmdbMoviePage,
  type TmdbProvider,
  type TmdbWatchProviderResponse
} from "./tmdb-normalizers.js";
import { TmdbRequestClient, type FetchLike } from "./tmdb-request-client.js";

const APPENDED_MOVIE_DATA = "credits,videos";

/**
 * Thin read-only TMDB client that returns normalized discovery-oriented results.
 */
export class TmdbClient {
  private readonly requests: TmdbRequestClient;
  /**
   * TMDB image configuration changes rarely, so one process-level read is
   * sufficient while still avoiding hardcoded CDN assumptions.
   */
  private imageBaseUrl: string | null = null;

  constructor(
    private readonly config: TmdbConfig,
    fetchImpl: FetchLike = fetch
  ) {
    this.requests = new TmdbRequestClient(config, fetchImpl);
  }

  /**
   * Searches original, translated, and alternative movie titles.
   */
  async searchMovies(input: {
    query: string;
    year?: number;
    page: number;
    language?: string;
    region?: string;
    includeAdult: boolean;
  }): Promise<MoviePage> {
    const query = baseQuery(
      input.page,
      input.language || this.config.language,
      input.region || this.config.region
    );
    query.set("query", input.query);
    query.set("include_adult", String(input.includeAdult));
    if (input.year) query.set("year", String(input.year));

    return this.readMoviePage("/search/movie", query);
  }

  /**
   * Returns details plus cast, director, trailer, and regional availability.
   */
  async getMovie(input: {
    movieId: number;
    language?: string;
    region?: string;
  }): Promise<MovieDetails> {
    const language = input.language || this.config.language;
    const region = input.region || this.config.region;
    const detailsQuery = new URLSearchParams({
      language,
      append_to_response: APPENDED_MOVIE_DATA
    });
    const [movie, providers, imageBaseUrl] = await Promise.all([
      this.requests.get<TmdbMovieDetails>(
        `/movie/${encodeURIComponent(input.movieId)}`,
        detailsQuery
      ),
      this.requests.get<TmdbWatchProviderResponse>(
        `/movie/${encodeURIComponent(input.movieId)}/watch/providers`
      ),
      this.getImageBaseUrl()
    ]);

    return normalizeMovieDetails(movie, providers, region, imageBaseUrl);
  }

  /**
   * Reads one of TMDB's curated movie lists.
   */
  async listMovies(input: {
    category: MovieListCategory;
    page: number;
    language?: string;
    region?: string;
  }): Promise<MoviePage> {
    return this.readMoviePage(
      `/movie/${input.category}`,
      baseQuery(
        input.page,
        input.language || this.config.language,
        input.region || this.config.region
      )
    );
  }

  /**
   * Returns the movies currently trending over a day or week.
   */
  async trendingMovies(input: {
    timeWindow: "day" | "week";
    language?: string;
  }): Promise<MoviePage> {
    const query = new URLSearchParams({
      language: input.language || this.config.language
    });
    return this.readMoviePage(`/trending/movie/${input.timeWindow}`, query);
  }

  /**
   * Applies the supported subset of TMDB's advanced movie discovery filters.
   *
   * Rating sorts default to 200 votes so tiny vote samples do not dominate.
   */
  async discoverMovies(input: DiscoverMoviesInput): Promise<MoviePage> {
    const language = input.language || this.config.language;
    const region = input.region || this.config.region;
    const query = baseQuery(input.page, language, region);
    query.set("include_adult", "false");
    query.set("include_video", "false");
    query.set("sort_by", input.sortBy || "popularity.desc");

    setOptional(query, "primary_release_year", input.releaseYear);
    setOptional(query, "primary_release_date.gte", input.releaseDateFrom);
    setOptional(query, "primary_release_date.lte", input.releaseDateTo);
    setOptional(query, "vote_average.gte", input.minRating);
    setOptional(
      query,
      "vote_count.gte",
      input.minVoteCount ??
        (input.sortBy === "vote_average.desc" ? 200 : undefined)
    );
    setOptional(query, "with_runtime.gte", input.minRuntime);
    setOptional(query, "with_runtime.lte", input.maxRuntime);
    setOptional(query, "with_original_language", input.originalLanguage);

    if (input.genres?.length) {
      query.set(
        "with_genres",
        input.genres.join(input.genreMode === "or" ? "|" : ",")
      );
    }
    if (input.excludeGenres?.length) {
      query.set("without_genres", input.excludeGenres.join(","));
    }
    if (input.watchProviderIds?.length) {
      query.set("watch_region", region);
      query.set("with_watch_providers", input.watchProviderIds.join("|"));
    }
    if (input.watchMonetizationTypes?.length) {
      query.set("watch_region", region);
      query.set(
        "with_watch_monetization_types",
        input.watchMonetizationTypes.join("|")
      );
    }

    return this.readMoviePage("/discover/movie", query);
  }

  /**
   * Returns either TMDB recommendations or its narrower genre-and-keyword matches.
   */
  async getRelatedMovies(input: {
    movieId: number;
    kind: RelatedMovieKind;
    page: number;
    language?: string;
  }): Promise<MoviePage> {
    return this.readMoviePage(
      `/movie/${encodeURIComponent(input.movieId)}/${input.kind}`,
      baseQuery(input.page, input.language || this.config.language)
    );
  }

  /**
   * Lists the stable IDs needed by genre-based discovery filters.
   */
  async listMovieGenres(language?: string): Promise<{ genres: Genre[] }> {
    return this.requests.get<{ genres: Genre[] }>(
      "/genre/movie/list",
      new URLSearchParams({ language: language || this.config.language })
    );
  }

  /**
   * Lists streaming-provider IDs for a region, ordered for that market.
   */
  async listWatchProviders(input: {
    region?: string;
    language?: string;
  }): Promise<{ region: string; providers: ProviderCatalogItem[] }> {
    const region = (input.region || this.config.region).toUpperCase();
    const response = await this.requests.get<{ results: TmdbProvider[] }>(
      "/watch/providers/movie",
      new URLSearchParams({
        watch_region: region,
        language: input.language || this.config.language
      })
    );
    const imageBaseUrl = await this.getImageBaseUrl();

    return {
      region,
      providers: response.results
        .map((provider) => ({
          id: provider.provider_id,
          name: provider.provider_name,
          logo_url: provider.logo_path
            ? `${imageBaseUrl}w92${provider.logo_path}`
            : null,
          display_priority: provider.display_priority ?? 999
        }))
        .sort((left, right) => left.display_priority - right.display_priority)
    };
  }

  private async readMoviePage(
    path: string,
    query: URLSearchParams
  ): Promise<MoviePage> {
    const [response, imageBaseUrl] = await Promise.all([
      this.requests.get<TmdbMoviePage>(path, query),
      this.getImageBaseUrl()
    ]);
    return normalizeMoviePage(response, imageBaseUrl);
  }

  private async getImageBaseUrl(): Promise<string> {
    if (this.imageBaseUrl) return this.imageBaseUrl;

    const configuration = await this.requests.get<{
      images: { secure_base_url: string };
    }>("/configuration");
    this.imageBaseUrl = configuration.images.secure_base_url;
    return this.imageBaseUrl;
  }
}

function baseQuery(
  page: number,
  language: string,
  region?: string
): URLSearchParams {
  const query = new URLSearchParams({
    page: String(page),
    language
  });
  if (region) query.set("region", region);
  return query;
}

function setOptional(
  query: URLSearchParams,
  name: string,
  value: string | number | undefined
): void {
  if (value !== undefined) query.set(name, String(value));
}
