import "dotenv/config";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { getTmdbConfig } from "./config.js";
import { TmdbClient } from "./lib/tmdb.js";
import {
  createToolHandlers,
  discoverMoviesInputSchema,
  getMovieSchema,
  listMovieGenresSchema,
  listMoviesSchema,
  listWatchProvidersSchema,
  relatedMoviesSchema,
  searchMoviesSchema,
  trendingMoviesSchema
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

await server.connect(new StdioServerTransport());
