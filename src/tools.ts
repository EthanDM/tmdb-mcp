import { z } from "zod";

import { formatErrorMessage } from "./errors.js";
import type { TmdbClient } from "./lib/tmdb.js";

const languageSchema = z
  .string()
  .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
  .optional();
const regionSchema = z
  .string()
  .regex(/^[A-Z]{2}$/)
  .optional();
const pageSchema = z.number().int().min(1).max(500).default(1);
const movieIdSchema = z.number().int().positive();

export const searchMoviesSchema = z.object({
  query: z.string().trim().min(1),
  year: z.number().int().min(1870).max(2100).optional(),
  page: pageSchema,
  language: languageSchema,
  region: regionSchema,
  includeAdult: z.boolean().default(false)
});

export const getMovieSchema = z.object({
  movieId: movieIdSchema,
  language: languageSchema,
  region: regionSchema
});

export const listMoviesSchema = z.object({
  category: z.enum(["popular", "top_rated", "now_playing", "upcoming"]),
  page: pageSchema,
  language: languageSchema,
  region: regionSchema
});

export const trendingMoviesSchema = z.object({
  timeWindow: z.enum(["day", "week"]).default("day"),
  language: languageSchema
});

const discoverMoviesFields = {
  genres: z.array(z.number().int().positive()).max(20).optional(),
  genreMode: z.enum(["and", "or"]).default("and"),
  excludeGenres: z.array(z.number().int().positive()).max(20).optional(),
  releaseYear: z.number().int().min(1870).max(2100).optional(),
  releaseDateFrom: z.string().date().optional(),
  releaseDateTo: z.string().date().optional(),
  minRating: z.number().min(0).max(10).optional(),
  minVoteCount: z.number().int().min(0).optional(),
  minRuntime: z.number().int().min(0).max(1000).optional(),
  maxRuntime: z.number().int().min(1).max(1000).optional(),
  originalLanguage: z
    .string()
    .regex(/^[a-z]{2}$/)
    .optional(),
  watchProviderIds: z.array(z.number().int().positive()).max(30).optional(),
  watchMonetizationTypes: z
    .array(z.enum(["flatrate", "free", "ads", "rent", "buy"]))
    .max(5)
    .optional(),
  sortBy: z
    .enum([
      "popularity.desc",
      "vote_average.desc",
      "vote_count.desc",
      "primary_release_date.desc",
      "revenue.desc"
    ])
    .default("popularity.desc"),
  page: pageSchema,
  language: languageSchema,
  region: regionSchema
};

export const discoverMoviesInputSchema = discoverMoviesFields;

export const discoverMoviesSchema = z
  .object(discoverMoviesFields)
  .superRefine((input, context) => {
    if (
      input.releaseDateFrom &&
      input.releaseDateTo &&
      input.releaseDateFrom > input.releaseDateTo
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["releaseDateTo"],
        message: "releaseDateTo must not be earlier than releaseDateFrom."
      });
    }
    if (
      input.minRuntime !== undefined &&
      input.maxRuntime !== undefined &&
      input.minRuntime > input.maxRuntime
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxRuntime"],
        message: "maxRuntime must be greater than or equal to minRuntime."
      });
    }
  });

export const relatedMoviesSchema = z.object({
  movieId: movieIdSchema,
  kind: z.enum(["recommendations", "similar"]).default("recommendations"),
  page: pageSchema,
  language: languageSchema
});

export const listMovieGenresSchema = z.object({
  language: languageSchema
});

export const listWatchProvidersSchema = z.object({
  region: regionSchema,
  language: languageSchema
});

export const searchTvSchema = z.object({
  query: z.string().trim().min(1),
  firstAirYear: z.number().int().min(1000).max(9999).optional(),
  page: pageSchema,
  language: languageSchema,
  includeAdult: z.boolean().default(false)
});

export const getTvSeriesSchema = z.object({
  seriesId: movieIdSchema,
  language: languageSchema,
  region: regionSchema
});

export const listTvSeriesSchema = z.object({
  category: z.enum(["airing_today", "on_the_air", "popular", "top_rated"]),
  page: pageSchema,
  language: languageSchema
});

export const trendingTvSchema = z.object({
  timeWindow: z.enum(["day", "week"]).default("day"),
  language: languageSchema
});

const discoverTvFields = {
  genres: z.array(z.number().int().positive()).max(20).optional(),
  genreMode: z.enum(["and", "or"]).default("and"),
  excludeGenres: z.array(z.number().int().positive()).max(20).optional(),
  firstAirYear: z.number().int().min(1000).max(9999).optional(),
  firstAirDateFrom: z.string().date().optional(),
  firstAirDateTo: z.string().date().optional(),
  minRating: z.number().min(0).max(10).optional(),
  minVoteCount: z.number().int().min(0).optional(),
  minRuntime: z.number().int().min(0).max(1000).optional(),
  maxRuntime: z.number().int().min(1).max(1000).optional(),
  originalLanguage: z
    .string()
    .regex(/^[a-z]{2}$/)
    .optional(),
  watchProviderIds: z.array(z.number().int().positive()).max(30).optional(),
  watchMonetizationTypes: z
    .array(z.enum(["flatrate", "free", "ads", "rent", "buy"]))
    .max(5)
    .optional(),
  sortBy: z
    .enum([
      "popularity.desc",
      "vote_average.desc",
      "vote_count.desc",
      "first_air_date.desc"
    ])
    .default("popularity.desc"),
  page: pageSchema,
  language: languageSchema,
  region: regionSchema
};

export const discoverTvInputSchema = discoverTvFields;

export const discoverTvSchema = z
  .object(discoverTvFields)
  .superRefine((input, context) => {
    if (
      input.firstAirDateFrom &&
      input.firstAirDateTo &&
      input.firstAirDateFrom > input.firstAirDateTo
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["firstAirDateTo"],
        message: "firstAirDateTo must not be earlier than firstAirDateFrom."
      });
    }
    if (
      input.minRuntime !== undefined &&
      input.maxRuntime !== undefined &&
      input.minRuntime > input.maxRuntime
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxRuntime"],
        message: "maxRuntime must be greater than or equal to minRuntime."
      });
    }
  });

export const relatedTvSchema = z.object({
  seriesId: movieIdSchema,
  kind: z.enum(["recommendations", "similar"]).default("recommendations"),
  page: pageSchema,
  language: languageSchema
});

export const listTvGenresSchema = z.object({
  language: languageSchema
});

export const listTvWatchProvidersSchema = z.object({
  region: regionSchema,
  language: languageSchema
});

/**
 * Produces transport-independent handlers so validation and error behavior can
 * be tested without starting an MCP stdio process.
 */
export function createToolHandlers(client: TmdbClient) {
  return {
    searchMovies: (args: unknown) =>
      withParsedArgs(searchMoviesSchema, args, (input) =>
        client.searchMovies(input)
      ),
    getMovie: (args: unknown) =>
      withParsedArgs(getMovieSchema, args, (input) => client.getMovie(input)),
    listMovies: (args: unknown) =>
      withParsedArgs(listMoviesSchema, args, (input) =>
        client.listMovies(input)
      ),
    trendingMovies: (args: unknown) =>
      withParsedArgs(trendingMoviesSchema, args, (input) =>
        client.trendingMovies(input)
      ),
    discoverMovies: (args: unknown) =>
      withParsedArgs(discoverMoviesSchema, args, (input) =>
        client.discoverMovies(input)
      ),
    getRelatedMovies: (args: unknown) =>
      withParsedArgs(relatedMoviesSchema, args, (input) =>
        client.getRelatedMovies(input)
      ),
    listMovieGenres: (args: unknown) =>
      withParsedArgs(listMovieGenresSchema, args, (input) =>
        client.listMovieGenres(input.language)
      ),
    listWatchProviders: (args: unknown) =>
      withParsedArgs(listWatchProvidersSchema, args, (input) =>
        client.listWatchProviders(input)
      ),
    searchTv: (args: unknown) =>
      withParsedArgs(searchTvSchema, args, (input) => client.searchTv(input)),
    getTvSeries: (args: unknown) =>
      withParsedArgs(getTvSeriesSchema, args, (input) =>
        client.getTvSeries(input)
      ),
    listTvSeries: (args: unknown) =>
      withParsedArgs(listTvSeriesSchema, args, (input) =>
        client.listTvSeries(input)
      ),
    trendingTv: (args: unknown) =>
      withParsedArgs(trendingTvSchema, args, (input) =>
        client.trendingTv(input)
      ),
    discoverTv: (args: unknown) =>
      withParsedArgs(discoverTvSchema, args, (input) =>
        client.discoverTv(input)
      ),
    getRelatedTv: (args: unknown) =>
      withParsedArgs(relatedTvSchema, args, (input) =>
        client.getRelatedTv(input)
      ),
    listTvGenres: (args: unknown) =>
      withParsedArgs(listTvGenresSchema, args, (input) =>
        client.listTvGenres(input.language)
      ),
    listTvWatchProviders: (args: unknown) =>
      withParsedArgs(listTvWatchProvidersSchema, args, (input) =>
        client.listTvWatchProviders(input)
      )
  };
}

async function withParsedArgs<TSchema extends z.ZodTypeAny, TResult>(
  schema: TSchema,
  args: unknown,
  handler: (input: z.infer<TSchema>) => Promise<TResult>
): Promise<ToolResponse> {
  try {
    return toolSuccess(await handler(schema.parse(args)));
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text" as const, text: formatErrorMessage(error) }],
      structuredContent: undefined
    };
  }
}

type ToolResponse = {
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
};

function toolSuccess(result: unknown): ToolResponse {
  const response: ToolResponse = {
    isError: false,
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
  };

  if (typeof result === "object" && result !== null && !Array.isArray(result)) {
    response.structuredContent = result as Record<string, unknown>;
  }

  return response;
}
