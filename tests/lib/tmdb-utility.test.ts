import { describe, expect, it, vi } from "vitest";

import type { TmdbConfig } from "../../src/config.js";
import { TmdbClient } from "../../src/lib/tmdb.js";

const config: TmdbConfig = {
  readAccessToken: "read-token",
  language: "en-US",
  region: "US"
};

describe("TmdbClient utility discovery", () => {
  it("returns normalized TV seasons and enriched episodes", async () => {
    const fetchMock = createRouterFetchMock({
      "GET /3/configuration": () => configurationResponse(),
      "GET /3/tv/95396/season/1?": () =>
        jsonResponse({
          id: 120036,
          name: "Season 1",
          season_number: 1,
          poster_path: "/season.jpg",
          episodes: [episodeResponse()]
        }),
      "GET /3/tv/95396/season/1/episode/1?": (url) => {
        expect(url.searchParams.get("append_to_response")).toBe(
          "credits,videos"
        );
        return jsonResponse({
          ...episodeResponse(),
          production_code: "S01E01",
          credits: {
            crew: [{ id: 1, name: "Ben Stiller", job: "Director" }],
            guest_stars: [{ id: 2, name: "Guest Actor", character: "Worker" }]
          },
          videos: {
            results: [
              {
                key: "episode-trailer",
                site: "YouTube",
                type: "Trailer",
                official: true
              }
            ]
          }
        });
      }
    });
    const client = new TmdbClient(config, fetchMock);

    const [season, episode] = await Promise.all([
      client.getTvSeason({ seriesId: 95396, seasonNumber: 1 }),
      client.getTvEpisode({
        seriesId: 95396,
        seasonNumber: 1,
        episodeNumber: 1
      })
    ]);

    expect(season).toMatchObject({
      series_id: 95396,
      season_number: 1,
      poster_url: "https://images.example/w500/season.jpg"
    });
    expect(season.episodes[0]?.tmdb_url).toContain(
      "/tv/95396/season/1/episode/1"
    );
    expect(episode).toMatchObject({
      directors: [{ id: 1, name: "Ben Stiller", job: "Director" }],
      guest_stars: [{ id: 2, name: "Guest Actor", character: "Worker" }],
      trailer_url: "https://www.youtube.com/watch?v=episode-trailer"
    });
  });

  it("returns collections in chronological release order", async () => {
    const fetchMock = createRouterFetchMock({
      "GET /3/configuration": () => configurationResponse(),
      "GET /3/collection/2344?": () =>
        jsonResponse({
          id: 2344,
          name: "The Matrix Collection",
          poster_path: "/collection.jpg",
          parts: [
            movieResponse(604, "The Matrix Reloaded", "2003-05-15"),
            movieResponse(603, "The Matrix", "1999-03-30")
          ]
        })
    });
    const client = new TmdbClient(config, fetchMock);

    const result = await client.getCollection({ collectionId: 2344 });

    expect(result.parts.map((movie) => movie.id)).toEqual([603, 604]);
    expect(result.tmdb_url).toBe("https://www.themoviedb.org/collection/2344");
  });

  it("searches keywords and resolves external IDs", async () => {
    const fetchMock = createRouterFetchMock({
      "GET /3/search/keyword?": (url) => {
        expect(url.searchParams.get("query")).toBe("time travel");
        return jsonResponse({
          page: 1,
          total_pages: 1,
          total_results: 1,
          results: [{ id: 4379, name: "time travel" }]
        });
      },
      "GET /3/find/tt0133093?": (url) => {
        expect(url.searchParams.get("external_source")).toBe("imdb_id");
        return jsonResponse({
          movie_results: [
            {
              id: 603,
              title: "The Matrix",
              release_date: "1999-03-30"
            }
          ]
        });
      }
    });
    const client = new TmdbClient(config, fetchMock);

    const [keywords, found] = await Promise.all([
      client.searchKeywords({ query: "time travel", page: 1 }),
      client.findByExternalId({
        externalId: "tt0133093",
        externalSource: "imdb_id"
      })
    ]);

    expect(keywords.items).toEqual([{ id: 4379, name: "time travel" }]);
    expect(found.matches[0]).toMatchObject({
      media_type: "movie",
      id: 603,
      title: "The Matrix",
      tmdb_url: "https://www.themoviedb.org/movie/603"
    });
  });

  it("normalizes regional movie certifications and TV ratings", async () => {
    const fetchMock = createRouterFetchMock({
      "GET /3/movie/603/release_dates": () =>
        jsonResponse({
          results: [
            {
              iso_3166_1: "US",
              release_dates: [
                {
                  certification: "R",
                  release_date: "1999-03-31T00:00:00.000Z",
                  type: 3,
                  note: "Theatrical"
                },
                {
                  certification: "",
                  release_date: "2018-05-22T00:00:00.000Z",
                  type: 5,
                  note: "4K UHD"
                }
              ]
            },
            { iso_3166_1: "GB", release_dates: [] }
          ]
        }),
      "GET /3/tv/95396/content_ratings": () =>
        jsonResponse({
          results: [{ iso_3166_1: "US", rating: "TV-MA" }]
        })
    });
    const client = new TmdbClient(config, fetchMock);

    const [movie, tv] = await Promise.all([
      client.getContentRatings({ mediaType: "movie", id: 603, region: "US" }),
      client.getContentRatings({ mediaType: "tv", id: 95396, region: "US" })
    ]);

    expect(movie.regions).toEqual([
      {
        region: "US",
        ratings: [
          {
            certification: "R",
            release_date: "1999-03-31T00:00:00.000Z",
            release_type: 3,
            note: "Theatrical"
          }
        ]
      }
    ]);
    expect(tv.regions[0]?.ratings[0]?.certification).toBe("TV-MA");
  });
});

function episodeResponse() {
  return {
    id: 1576221,
    name: "Good News About Hell",
    overview: "Mark starts a new job.",
    air_date: "2022-02-17",
    season_number: 1,
    episode_number: 1,
    runtime: 57,
    vote_average: 8.2,
    vote_count: 100,
    still_path: "/episode.jpg"
  };
}

function movieResponse(id: number, title: string, releaseDate: string) {
  return {
    id,
    title,
    original_title: title,
    release_date: releaseDate,
    overview: "",
    genre_ids: [878],
    vote_average: 8,
    vote_count: 1000,
    popularity: 50,
    poster_path: null,
    backdrop_path: null
  };
}

function createRouterFetchMock(
  routes: Record<
    string,
    (url: URL, init?: RequestInit) => Response | Promise<Response>
  >
) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    );
    const key = `${init?.method || "GET"} ${url.pathname}${url.search ? "?" : ""}`;
    const route = routes[key];
    if (!route) throw new Error(`Unexpected request: ${key}`);
    return route(url, init);
  }) as unknown as typeof fetch;
}

function configurationResponse(): Response {
  return jsonResponse({
    images: { secure_base_url: "https://images.example/" }
  });
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
