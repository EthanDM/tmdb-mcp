import type { TmdbConfig } from "../config.js";
import type {
  ContentRatingsResult,
  DiscoverTvInput,
  DiscoverMoviesInput,
  ExternalIdFindResult,
  Genre,
  KeywordSearchPage,
  MovieCollectionDetails,
  MovieDetails,
  MovieListCategory,
  MoviePage,
  PersonCreditsResult,
  PersonDetails,
  PersonSearchPage,
  ProviderCatalogItem,
  RelatedMovieKind,
  TvListCategory,
  TvEpisodeDetails,
  TvSeasonDetails,
  TvSeriesDetails,
  TvSeriesPage
} from "../types.js";
import {
  normalizePersonCredits,
  normalizePersonDetails,
  normalizePersonSearchPage,
  type TmdbPersonCreditsResponse,
  type TmdbPersonDetails,
  type TmdbPersonSearchPage
} from "./tmdb-people-normalizers.js";
import {
  normalizeTvDetails,
  normalizeTvPage,
  type TmdbTvDetails,
  type TmdbTvPage
} from "./tmdb-tv-normalizers.js";
import {
  normalizeMovieDetails,
  normalizeMoviePage,
  type TmdbMovieDetails,
  type TmdbMoviePage,
  type TmdbProvider,
  type TmdbWatchProviderResponse
} from "./tmdb-normalizers.js";
import {
  normalizeCollection,
  normalizeContentRatings,
  normalizeFindResult,
  normalizeKeywordPage,
  normalizeTvEpisode,
  normalizeTvSeason,
  type TmdbCollection,
  type TmdbFindResponse,
  type TmdbKeywordPage,
  type TmdbSeason
} from "./tmdb-utility-normalizers.js";
import { TmdbRequestClient, type FetchLike } from "./tmdb-request-client.js";

const APPENDED_MOVIE_DATA = "credits,videos";
const APPENDED_TV_DATA = "aggregate_credits,videos";

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
    if (input.castIds?.length) {
      query.set("with_cast", input.castIds.join(","));
    }
    if (input.crewIds?.length) {
      query.set("with_crew", input.crewIds.join(","));
    }
    if (input.personIds?.length) {
      query.set("with_people", input.personIds.join(","));
    }
    if (input.keywordIds?.length) {
      query.set(
        "with_keywords",
        input.keywordIds.join(input.keywordMode === "or" ? "|" : ",")
      );
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
    return this.listProviderCatalog("/watch/providers/movie", input);
  }

  /**
   * Searches TV series by original, translated, and alternative names.
   */
  async searchTv(input: {
    query: string;
    firstAirYear?: number;
    page: number;
    language?: string;
    includeAdult: boolean;
  }): Promise<TvSeriesPage> {
    const query = baseQuery(input.page, input.language || this.config.language);
    query.set("query", input.query);
    query.set("include_adult", String(input.includeAdult));
    if (input.firstAirYear) {
      query.set("first_air_date_year", String(input.firstAirYear));
    }

    return this.readTvPage("/search/tv", query);
  }

  /**
   * Returns series details plus creators, aggregate cast, trailer, and providers.
   */
  async getTvSeries(input: {
    seriesId: number;
    language?: string;
    region?: string;
  }): Promise<TvSeriesDetails> {
    const language = input.language || this.config.language;
    const region = input.region || this.config.region;
    const detailsQuery = new URLSearchParams({
      language,
      append_to_response: APPENDED_TV_DATA
    });
    const [series, providers, imageBaseUrl] = await Promise.all([
      this.requests.get<TmdbTvDetails>(
        `/tv/${encodeURIComponent(input.seriesId)}`,
        detailsQuery
      ),
      this.requests.get<TmdbWatchProviderResponse>(
        `/tv/${encodeURIComponent(input.seriesId)}/watch/providers`
      ),
      this.getImageBaseUrl()
    ]);

    return normalizeTvDetails(series, providers, region, imageBaseUrl);
  }

  /**
   * Reads airing-today, on-the-air, popular, or top-rated TV series.
   */
  async listTvSeries(input: {
    category: TvListCategory;
    page: number;
    language?: string;
  }): Promise<TvSeriesPage> {
    return this.readTvPage(
      `/tv/${input.category}`,
      baseQuery(input.page, input.language || this.config.language)
    );
  }

  /**
   * Returns TV series trending over the current day or week.
   */
  async trendingTv(input: {
    timeWindow: "day" | "week";
    language?: string;
  }): Promise<TvSeriesPage> {
    return this.readTvPage(
      `/trending/tv/${input.timeWindow}`,
      new URLSearchParams({
        language: input.language || this.config.language
      })
    );
  }

  /**
   * Applies the supported TV discovery filters without exposing raw query syntax.
   *
   * Rating sorts default to 200 votes so tiny samples do not dominate results.
   */
  async discoverTv(input: DiscoverTvInput): Promise<TvSeriesPage> {
    const language = input.language || this.config.language;
    const region = input.region || this.config.region;
    const query = baseQuery(input.page, language);
    query.set("include_adult", "false");
    query.set("include_null_first_air_dates", "false");
    query.set("sort_by", input.sortBy || "popularity.desc");

    setOptional(query, "first_air_date_year", input.firstAirYear);
    setOptional(query, "first_air_date.gte", input.firstAirDateFrom);
    setOptional(query, "first_air_date.lte", input.firstAirDateTo);
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
    if (input.keywordIds?.length) {
      query.set(
        "with_keywords",
        input.keywordIds.join(input.keywordMode === "or" ? "|" : ",")
      );
    }
    if (input.watchMonetizationTypes?.length) {
      query.set("watch_region", region);
      query.set(
        "with_watch_monetization_types",
        input.watchMonetizationTypes.join("|")
      );
    }

    return this.readTvPage("/discover/tv", query);
  }

  /**
   * Returns TV recommendations or narrower similar-series matches.
   */
  async getRelatedTv(input: {
    seriesId: number;
    kind: RelatedMovieKind;
    page: number;
    language?: string;
  }): Promise<TvSeriesPage> {
    return this.readTvPage(
      `/tv/${encodeURIComponent(input.seriesId)}/${input.kind}`,
      baseQuery(input.page, input.language || this.config.language)
    );
  }

  /**
   * Lists the TV genre IDs accepted by discovery filters.
   */
  async listTvGenres(language?: string): Promise<{ genres: Genre[] }> {
    return this.requests.get<{ genres: Genre[] }>(
      "/genre/tv/list",
      new URLSearchParams({ language: language || this.config.language })
    );
  }

  /**
   * Lists regional TV provider IDs, ordered for the requested market.
   */
  async listTvWatchProviders(input: {
    region?: string;
    language?: string;
  }): Promise<{ region: string; providers: ProviderCatalogItem[] }> {
    return this.listProviderCatalog("/watch/providers/tv", input);
  }

  async getTvSeason(input: {
    seriesId: number;
    seasonNumber: number;
    language?: string;
  }): Promise<TvSeasonDetails> {
    const [season, imageBaseUrl] = await Promise.all([
      this.requests.get<TmdbSeason>(
        `/tv/${encodeURIComponent(input.seriesId)}/season/${encodeURIComponent(input.seasonNumber)}`,
        new URLSearchParams({
          language: input.language || this.config.language
        })
      ),
      this.getImageBaseUrl()
    ]);
    return normalizeTvSeason(input.seriesId, season, imageBaseUrl);
  }

  async getTvEpisode(input: {
    seriesId: number;
    seasonNumber: number;
    episodeNumber: number;
    language?: string;
  }): Promise<TvEpisodeDetails> {
    const [episode, imageBaseUrl] = await Promise.all([
      this.requests.get<Parameters<typeof normalizeTvEpisode>[1]>(
        `/tv/${encodeURIComponent(input.seriesId)}/season/${encodeURIComponent(input.seasonNumber)}/episode/${encodeURIComponent(input.episodeNumber)}`,
        new URLSearchParams({
          language: input.language || this.config.language,
          append_to_response: "credits,videos"
        })
      ),
      this.getImageBaseUrl()
    ]);
    return normalizeTvEpisode(input.seriesId, episode, imageBaseUrl);
  }

  async getCollection(input: {
    collectionId: number;
    language?: string;
  }): Promise<MovieCollectionDetails> {
    const [collection, imageBaseUrl] = await Promise.all([
      this.requests.get<TmdbCollection>(
        `/collection/${encodeURIComponent(input.collectionId)}`,
        new URLSearchParams({
          language: input.language || this.config.language
        })
      ),
      this.getImageBaseUrl()
    ]);
    return normalizeCollection(collection, imageBaseUrl);
  }

  async searchKeywords(input: {
    query: string;
    page: number;
  }): Promise<KeywordSearchPage> {
    const query = new URLSearchParams({
      query: input.query,
      page: String(input.page)
    });
    return normalizeKeywordPage(
      await this.requests.get<TmdbKeywordPage>("/search/keyword", query)
    );
  }

  async findByExternalId(input: {
    externalId: string;
    externalSource:
      | "imdb_id"
      | "facebook_id"
      | "instagram_id"
      | "tvdb_id"
      | "tiktok_id"
      | "twitter_id"
      | "wikidata_id"
      | "youtube_id";
    language?: string;
  }): Promise<ExternalIdFindResult> {
    const response = await this.requests.get<TmdbFindResponse>(
      `/find/${encodeURIComponent(input.externalId)}`,
      new URLSearchParams({
        external_source: input.externalSource,
        language: input.language || this.config.language
      })
    );
    return normalizeFindResult(
      input.externalId,
      input.externalSource,
      response
    );
  }

  async getContentRatings(input: {
    mediaType: "movie" | "tv";
    id: number;
    region?: string;
  }): Promise<ContentRatingsResult> {
    const suffix =
      input.mediaType === "movie" ? "release_dates" : "content_ratings";
    const response = await this.requests.get<unknown>(
      `/${input.mediaType}/${encodeURIComponent(input.id)}/${suffix}`
    );
    return normalizeContentRatings(
      input.mediaType,
      input.id,
      response,
      input.region
    );
  }

  /**
   * Searches people by primary and also-known-as names.
   */
  async searchPeople(input: {
    query: string;
    page: number;
    language?: string;
    includeAdult: boolean;
  }): Promise<PersonSearchPage> {
    const query = baseQuery(input.page, input.language || this.config.language);
    query.set("query", input.query);
    query.set("include_adult", String(input.includeAdult));
    const [response, imageBaseUrl] = await Promise.all([
      this.requests.get<TmdbPersonSearchPage>("/search/person", query),
      this.getImageBaseUrl()
    ]);
    return normalizePersonSearchPage(response, imageBaseUrl);
  }

  /**
   * Returns one person's biography and stable external identity fields.
   */
  async getPerson(input: {
    personId: number;
    language?: string;
  }): Promise<PersonDetails> {
    const [person, imageBaseUrl] = await Promise.all([
      this.requests.get<TmdbPersonDetails>(
        `/person/${encodeURIComponent(input.personId)}`,
        new URLSearchParams({
          language: input.language || this.config.language
        })
      ),
      this.getImageBaseUrl()
    ]);
    return normalizePersonDetails(person, imageBaseUrl);
  }

  /**
   * Returns a bounded, filterable filmography from TMDB's unpaginated credits.
   */
  async getPersonCredits(input: {
    personId: number;
    mediaType: "movie" | "tv" | "combined";
    creditType: "cast" | "crew" | "all";
    sortBy: "date" | "popularity" | "vote_average";
    limit: number;
    language?: string;
  }): Promise<PersonCreditsResult> {
    const endpoint =
      input.mediaType === "combined"
        ? "combined_credits"
        : `${input.mediaType}_credits`;
    const [credits, imageBaseUrl] = await Promise.all([
      this.requests.get<TmdbPersonCreditsResponse>(
        `/person/${encodeURIComponent(input.personId)}/${endpoint}`,
        new URLSearchParams({
          language: input.language || this.config.language
        })
      ),
      this.getImageBaseUrl()
    ]);
    return normalizePersonCredits(credits, input, imageBaseUrl);
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

  private async readTvPage(
    path: string,
    query: URLSearchParams
  ): Promise<TvSeriesPage> {
    const [response, imageBaseUrl] = await Promise.all([
      this.requests.get<TmdbTvPage>(path, query),
      this.getImageBaseUrl()
    ]);
    return normalizeTvPage(response, imageBaseUrl);
  }

  private async listProviderCatalog(
    path: string,
    input: { region?: string; language?: string }
  ): Promise<{ region: string; providers: ProviderCatalogItem[] }> {
    const region = (input.region || this.config.region).toUpperCase();
    const response = await this.requests.get<{ results: TmdbProvider[] }>(
      path,
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
