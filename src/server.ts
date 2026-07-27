import "dotenv/config";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { getTmdbConfig } from "./config.js";
import { TmdbClient } from "./lib/tmdb.js";
import {
  createToolHandlers,
  discoverMoviesInputSchema,
  discoverTvInputSchema,
  findByExternalIdSchema,
  getCollectionSchema,
  getContentRatingsSchema,
  getMovieSchema,
  getPersonCreditsSchema,
  getPersonSchema,
  getTvSeriesSchema,
  getTvEpisodeSchema,
  getTvSeasonSchema,
  listMovieGenresSchema,
  listMoviesSchema,
  listWatchProvidersSchema,
  listTvGenresSchema,
  listTvSeriesSchema,
  listTvWatchProvidersSchema,
  relatedMoviesSchema,
  relatedTvSchema,
  searchMoviesSchema,
  searchKeywordsSchema,
  searchPeopleSchema,
  searchTvSchema,
  trendingMoviesSchema,
  trendingTvSchema
} from "./tools.js";

/**
 * Local stdio MCP exposing a deliberately read-only TMDB discovery surface.
 */
const server = new McpServer({
  name: "tmdb-mcp",
  version: "0.1.0"
});

const handlers = createToolHandlers(new TmdbClient(getTmdbConfig()));

server.registerTool(
  "tmdb_search_movies",
  {
    title: "Search TMDB Movies",
    description:
      "Searches movies by original, translated, and alternative titles.",
    inputSchema: searchMoviesSchema.shape
  },
  handlers.searchMovies
);

server.registerTool(
  "tmdb_get_movie",
  {
    title: "Get TMDB Movie",
    description:
      "Gets a movie's details, director, top cast, trailer, and regional watch providers.",
    inputSchema: getMovieSchema.shape
  },
  handlers.getMovie
);

server.registerTool(
  "tmdb_list_movies",
  {
    title: "List TMDB Movies",
    description: "Lists popular, top-rated, now-playing, or upcoming movies.",
    inputSchema: listMoviesSchema.shape
  },
  handlers.listMovies
);

server.registerTool(
  "tmdb_trending_movies",
  {
    title: "Get Trending TMDB Movies",
    description: "Lists movies trending over the current day or week.",
    inputSchema: trendingMoviesSchema.shape
  },
  handlers.trendingMovies
);

server.registerTool(
  "tmdb_discover_movies",
  {
    title: "Discover TMDB Movies",
    description:
      "Discovers movies using genre, date, rating, runtime, language, provider, and sort filters.",
    inputSchema: discoverMoviesInputSchema
  },
  handlers.discoverMovies
);

server.registerTool(
  "tmdb_get_related_movies",
  {
    title: "Get Related TMDB Movies",
    description:
      "Gets recommendations by default, or narrower genre-and-keyword similar movies.",
    inputSchema: relatedMoviesSchema.shape
  },
  handlers.getRelatedMovies
);

server.registerTool(
  "tmdb_list_movie_genres",
  {
    title: "List TMDB Movie Genres",
    description: "Lists movie genre names and IDs for discovery filters.",
    inputSchema: listMovieGenresSchema.shape
  },
  handlers.listMovieGenres
);

server.registerTool(
  "tmdb_list_watch_providers",
  {
    title: "List TMDB Movie Watch Providers",
    description:
      "Lists regional movie streaming-provider names and IDs for discovery filters.",
    inputSchema: listWatchProvidersSchema.shape
  },
  handlers.listWatchProviders
);

server.registerTool(
  "tmdb_search_tv",
  {
    title: "Search TMDB TV Series",
    description:
      "Searches TV series by original, translated, and alternative names.",
    inputSchema: searchTvSchema.shape
  },
  handlers.searchTv
);

server.registerTool(
  "tmdb_get_tv_series",
  {
    title: "Get TMDB TV Series",
    description:
      "Gets series details, creators, top cast, trailer, and regional watch providers.",
    inputSchema: getTvSeriesSchema.shape
  },
  handlers.getTvSeries
);

server.registerTool(
  "tmdb_list_tv_series",
  {
    title: "List TMDB TV Series",
    description:
      "Lists airing-today, on-the-air, popular, or top-rated TV series.",
    inputSchema: listTvSeriesSchema.shape
  },
  handlers.listTvSeries
);

server.registerTool(
  "tmdb_trending_tv",
  {
    title: "Get Trending TMDB TV Series",
    description: "Lists TV series trending over the current day or week.",
    inputSchema: trendingTvSchema.shape
  },
  handlers.trendingTv
);

server.registerTool(
  "tmdb_discover_tv",
  {
    title: "Discover TMDB TV Series",
    description:
      "Discovers TV series using genre, air date, rating, runtime, language, provider, and sort filters.",
    inputSchema: discoverTvInputSchema
  },
  handlers.discoverTv
);

server.registerTool(
  "tmdb_get_related_tv",
  {
    title: "Get Related TMDB TV Series",
    description:
      "Gets TV recommendations by default, or narrower similar-series matches.",
    inputSchema: relatedTvSchema.shape
  },
  handlers.getRelatedTv
);

server.registerTool(
  "tmdb_list_tv_genres",
  {
    title: "List TMDB TV Genres",
    description: "Lists TV genre names and IDs for discovery filters.",
    inputSchema: listTvGenresSchema.shape
  },
  handlers.listTvGenres
);

server.registerTool(
  "tmdb_list_tv_watch_providers",
  {
    title: "List TMDB TV Watch Providers",
    description:
      "Lists regional TV streaming-provider names and IDs for discovery filters.",
    inputSchema: listTvWatchProvidersSchema.shape
  },
  handlers.listTvWatchProviders
);

server.registerTool(
  "tmdb_search_people",
  {
    title: "Search TMDB People",
    description: "Searches actors, directors, writers, and other crew by name.",
    inputSchema: searchPeopleSchema.shape
  },
  handlers.searchPeople
);

server.registerTool(
  "tmdb_get_person",
  {
    title: "Get TMDB Person",
    description:
      "Gets a person's biography, known department, birthplace, profile, and external identity.",
    inputSchema: getPersonSchema.shape
  },
  handlers.getPerson
);

server.registerTool(
  "tmdb_get_person_credits",
  {
    title: "Get TMDB Person Credits",
    description:
      "Gets a bounded movie, TV, or combined filmography filtered by cast or crew roles.",
    inputSchema: getPersonCreditsSchema.shape
  },
  handlers.getPersonCredits
);

server.registerTool(
  "tmdb_get_tv_season",
  {
    title: "Get TMDB TV Season",
    description: "Gets a TV season and its complete episode list.",
    inputSchema: getTvSeasonSchema.shape
  },
  handlers.getTvSeason
);

server.registerTool(
  "tmdb_get_tv_episode",
  {
    title: "Get TMDB TV Episode",
    description:
      "Gets an episode's details, directors, guest stars, and trailer.",
    inputSchema: getTvEpisodeSchema.shape
  },
  handlers.getTvEpisode
);

server.registerTool(
  "tmdb_get_collection",
  {
    title: "Get TMDB Movie Collection",
    description:
      "Gets a movie franchise or collection with its films in release order.",
    inputSchema: getCollectionSchema.shape
  },
  handlers.getCollection
);

server.registerTool(
  "tmdb_search_keywords",
  {
    title: "Search TMDB Keywords",
    description:
      "Searches for keyword IDs that can be used in movie and TV discovery.",
    inputSchema: searchKeywordsSchema.shape
  },
  handlers.searchKeywords
);

server.registerTool(
  "tmdb_find_by_external_id",
  {
    title: "Find TMDB Item by External ID",
    description:
      "Finds movies, TV series, seasons, episodes, or people from an external ID.",
    inputSchema: findByExternalIdSchema.shape
  },
  handlers.findByExternalId
);

server.registerTool(
  "tmdb_get_content_ratings",
  {
    title: "Get TMDB Content Ratings",
    description:
      "Gets regional movie certifications or TV content ratings, optionally for one region.",
    inputSchema: getContentRatingsSchema.shape
  },
  handlers.getContentRatings
);

await server.connect(new StdioServerTransport());
