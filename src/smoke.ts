import "dotenv/config";

import { getTmdbConfig } from "./config.js";
import { TmdbClient } from "./lib/tmdb.js";

/**
 * Exercises every read workflow against TMDB without creating account state.
 */
async function main(): Promise<void> {
  const config = getTmdbConfig();
  const client = new TmdbClient(config);

  logStep("search movies");
  const search = await client.searchMovies({
    query: process.env.TMDB_SMOKE_QUERY?.trim() || "The Matrix",
    page: 1,
    includeAdult: false
  });
  const seed = search.items[0];
  if (!seed) throw new Error("Search returned no seed movie.");

  logStep(`get movie ${seed.id}`);
  const details = await client.getMovie({ movieId: seed.id });
  if (details.id !== seed.id) throw new Error("Exact movie lookup mismatch.");

  logStep("curated lists");
  const [popular, topRated, trending] = await Promise.all([
    client.listMovies({ category: "popular", page: 1 }),
    client.listMovies({ category: "top_rated", page: 1 }),
    client.trendingMovies({ timeWindow: "week" })
  ]);
  assertNonempty(popular.items, "Popular");
  assertNonempty(topRated.items, "Top rated");
  assertNonempty(trending.items, "Trending");

  logStep("genres and providers");
  const [genres, providers] = await Promise.all([
    client.listMovieGenres(),
    client.listWatchProviders({})
  ]);
  assertNonempty(genres.genres, "Genres");
  assertNonempty(providers.providers, "Providers");

  logStep("discover and related");
  const [discovered, related] = await Promise.all([
    client.discoverMovies({
      genres: [genres.genres[0]!.id],
      minRating: 7,
      sortBy: "vote_average.desc",
      page: 1,
      language: config.language,
      region: config.region
    }),
    client.getRelatedMovies({
      movieId: seed.id,
      kind: "recommendations",
      page: 1
    })
  ]);
  assertNonempty(discovered.items, "Discover");
  assertNonempty(related.items, "Related");

  console.log(
    `Smoke passed: ${details.title}; ${popular.total_results} popular; ${related.total_results} recommendations.`
  );
}

function assertNonempty(values: unknown[], label: string): void {
  if (values.length === 0) throw new Error(`${label} returned no results.`);
}

function logStep(name: string): void {
  console.log(`\n[tmdb-mcp smoke] ${name}`);
}

await main();
