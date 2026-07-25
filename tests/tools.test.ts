import { describe, expect, it, vi } from "vitest";

import type { TmdbClient } from "../src/lib/tmdb.js";
import {
  createToolHandlers,
  discoverMoviesSchema,
  discoverTvSchema,
  searchMoviesSchema,
  searchTvSchema
} from "../src/tools.js";

describe("tool schemas", () => {
  it("applies safe movie-search defaults", () => {
    expect(searchMoviesSchema.parse({ query: "Alien" })).toMatchObject({
      query: "Alien",
      page: 1,
      includeAdult: false
    });
  });

  it("rejects inverted date and runtime ranges", () => {
    const result = discoverMoviesSchema.safeParse({
      releaseDateFrom: "2025-01-01",
      releaseDateTo: "2024-01-01",
      minRuntime: 180,
      maxRuntime: 90
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual([
        "releaseDateTo",
        "maxRuntime"
      ]);
    }
  });

  it("applies TV search defaults and rejects inverted air-date ranges", () => {
    expect(searchTvSchema.parse({ query: "Severance" })).toMatchObject({
      query: "Severance",
      page: 1,
      includeAdult: false
    });

    const result = discoverTvSchema.safeParse({
      firstAirDateFrom: "2025-01-01",
      firstAirDateTo: "2024-01-01"
    });
    expect(result.success).toBe(false);
  });

  it("returns MCP-compatible errors without invoking the client", async () => {
    const client = {
      searchMovies: vi.fn()
    } as unknown as TmdbClient;
    const handlers = createToolHandlers(client);

    const result = await handlers.searchMovies({ query: "" });

    expect(result.isError).toBe(true);
    expect(client.searchMovies).not.toHaveBeenCalled();
  });

  it("returns structured content for successful reads", async () => {
    const client = {
      listMovieGenres: vi.fn(async () => ({
        genres: [{ id: 878, name: "Science Fiction" }]
      }))
    } as unknown as TmdbClient;
    const handlers = createToolHandlers(client);

    const result = await handlers.listMovieGenres({});

    expect(result.structuredContent).toEqual({
      genres: [{ id: 878, name: "Science Fiction" }]
    });
  });
});
