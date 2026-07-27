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

  logStep("search TV series");
  const tvSearch = await client.searchTv({
    query: process.env.TMDB_SMOKE_TV_QUERY?.trim() || "Severance",
    page: 1,
    includeAdult: false
  });
  const tvSeed = tvSearch.items[0];
  if (!tvSeed) throw new Error("TV search returned no seed series.");

  logStep(`get TV series ${tvSeed.id}`);
  const tvDetails = await client.getTvSeries({ seriesId: tvSeed.id });
  if (tvDetails.id !== tvSeed.id) {
    throw new Error("Exact TV series lookup mismatch.");
  }

  logStep("TV lists, genres, and providers");
  const [popularTv, topRatedTv, trendingTv, tvGenres, tvProviders] =
    await Promise.all([
      client.listTvSeries({ category: "popular", page: 1 }),
      client.listTvSeries({ category: "top_rated", page: 1 }),
      client.trendingTv({ timeWindow: "week" }),
      client.listTvGenres(),
      client.listTvWatchProviders({})
    ]);
  assertNonempty(popularTv.items, "Popular TV");
  assertNonempty(topRatedTv.items, "Top-rated TV");
  assertNonempty(trendingTv.items, "Trending TV");
  assertNonempty(tvGenres.genres, "TV genres");
  assertNonempty(tvProviders.providers, "TV providers");

  logStep("discover and related TV series");
  const [discoveredTv, relatedTv] = await Promise.all([
    client.discoverTv({
      genres: [tvGenres.genres[0]!.id],
      minRating: 7,
      sortBy: "vote_average.desc",
      page: 1
    }),
    client.getRelatedTv({
      seriesId: tvSeed.id,
      kind: "recommendations",
      page: 1
    })
  ]);
  assertNonempty(discoveredTv.items, "Discover TV");
  assertNonempty(relatedTv.items, "Related TV");

  logStep("search people and inspect credits");
  const people = await client.searchPeople({
    query: process.env.TMDB_SMOKE_PERSON_QUERY?.trim() || "Denis Villeneuve",
    page: 1,
    includeAdult: false
  });
  const person = people.items[0];
  if (!person) throw new Error("People search returned no result.");
  const [personDetails, personCredits, directedMovies] = await Promise.all([
    client.getPerson({ personId: person.id }),
    client.getPersonCredits({
      personId: person.id,
      mediaType: "movie",
      creditType: "crew",
      sortBy: "popularity",
      limit: 20
    }),
    client.discoverMovies({
      crewIds: [person.id],
      minVoteCount: 100,
      sortBy: "popularity.desc",
      page: 1
    })
  ]);
  if (personDetails.id !== person.id) {
    throw new Error("Exact person lookup mismatch.");
  }
  assertNonempty(personCredits.items, "Person credits");
  assertNonempty(directedMovies.items, "Person-filtered movie discovery");

  logStep("seasons, episodes, and collections");
  const season = await client.getTvSeason({
    seriesId: tvSeed.id,
    seasonNumber: 1
  });
  const episodeSeed = season.episodes[0];
  if (!episodeSeed) throw new Error("TV season returned no episodes.");
  const episode = await client.getTvEpisode({
    seriesId: tvSeed.id,
    seasonNumber: episodeSeed.season_number,
    episodeNumber: episodeSeed.episode_number
  });
  if (episode.id !== episodeSeed.id) {
    throw new Error("Exact TV episode lookup mismatch.");
  }
  const collection = await client.getCollection({
    collectionId: 2344
  });
  assertNonempty(collection.parts, "Movie collection");

  logStep("keywords, external IDs, and content ratings");
  const keywords = await client.searchKeywords({
    query: "time travel",
    page: 1
  });
  const keyword = keywords.items[0];
  if (!keyword) throw new Error("Keyword search returned no results.");
  const [keywordMovies, keywordTv, externalMatch, movieRatings, tvRatings] =
    await Promise.all([
      client.discoverMovies({ keywordIds: [keyword.id], page: 1 }),
      client.discoverTv({ keywordIds: [keyword.id], page: 1 }),
      client.findByExternalId({
        externalId: details.imdb_id || "tt0133093",
        externalSource: "imdb_id"
      }),
      client.getContentRatings({
        mediaType: "movie",
        id: 603,
        region: "US"
      }),
      client.getContentRatings({
        mediaType: "tv",
        id: 95396,
        region: "US"
      })
    ]);
  assertNonempty(keywordMovies.items, "Keyword movie discovery");
  assertNonempty(keywordTv.items, "Keyword TV discovery");
  assertNonempty(externalMatch.matches, "External ID lookup");
  assertNonempty(movieRatings.regions, "Movie certifications");
  assertNonempty(tvRatings.regions, "TV content ratings");

  logStep("multi-search, collection search, credits, and reviews");
  const [multi, collectionSearch, movieCredits, tvCredits, reviews] =
    await Promise.all([
      client.searchMulti({
        query: "The Matrix",
        page: 1,
        includeAdult: false
      }),
      client.searchCollections({ query: "The Matrix", page: 1 }),
      client.getCredits({
        mediaType: "movie",
        id: 603,
        creditType: "all",
        limit: 50
      }),
      client.getCredits({
        mediaType: "tv",
        id: 95396,
        creditType: "all",
        limit: 50
      }),
      client.getReviews({ mediaType: "movie", id: 603, page: 1 })
    ]);
  assertNonempty(multi.items, "Multi-search");
  assertNonempty(collectionSearch.items, "Collection search");
  assertNonempty(movieCredits.items, "Movie credits");
  assertNonempty(tvCredits.items, "TV credits");
  assertNonempty(reviews.items, "Movie reviews");

  console.log(
    `Smoke passed: movie ${details.title}; TV ${tvDetails.name}; episode ${episode.name}; collection ${collection.name}; person ${personDetails.name}; ${popular.total_results} popular movies; ${popularTv.total_results} popular TV series.`
  );
}

function assertNonempty(values: unknown[], label: string): void {
  if (values.length === 0) throw new Error(`${label} returned no results.`);
}

function logStep(name: string): void {
  console.log(`\n[tmdb-mcp smoke] ${name}`);
}

await main();
