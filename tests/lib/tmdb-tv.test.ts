import { describe, expect, it, vi } from "vitest";

import type { TmdbConfig } from "../../src/config.js";
import { TmdbClient } from "../../src/lib/tmdb.js";

const config: TmdbConfig = {
  readAccessToken: "read-token",
  language: "en-US",
  region: "US"
};

describe("TmdbClient TV", () => {
  it("searches and normalizes TV series", async () => {
    const fetchMock = createRouterFetchMock({
      "GET /3/configuration": () => configurationResponse(),
      "GET /3/search/tv?": (url) => {
        expect(url.searchParams.get("query")).toBe("Severance");
        expect(url.searchParams.get("first_air_date_year")).toBe("2022");
        expect(url.searchParams.get("include_adult")).toBe("false");
        return jsonResponse(tvPage([tvResponse()]));
      }
    });
    const client = new TmdbClient(config, fetchMock);

    const result = await client.searchTv({
      query: "Severance",
      firstAirYear: 2022,
      page: 1,
      includeAdult: false
    });

    expect(result.items[0]).toMatchObject({
      id: 95396,
      name: "Severance",
      first_air_year: 2022,
      origin_countries: ["US"],
      tmdb_url: "https://www.themoviedb.org/tv/95396"
    });
  });

  it("returns enriched TV details with aggregate cast and providers", async () => {
    const fetchMock = createRouterFetchMock({
      "GET /3/configuration": () => configurationResponse(),
      "GET /3/tv/95396?": (url) => {
        expect(url.searchParams.get("append_to_response")).toBe(
          "aggregate_credits,videos"
        );
        return jsonResponse({
          ...tvResponse(),
          tagline: "There's more to work than life.",
          status: "Returning Series",
          type: "Scripted",
          episode_run_time: [50],
          number_of_seasons: 2,
          number_of_episodes: 19,
          last_air_date: "2025-03-20",
          in_production: true,
          genres: [{ id: 18, name: "Drama" }],
          created_by: [{ id: 1, name: "Dan Erickson" }],
          networks: [
            {
              id: 2552,
              name: "Apple TV+",
              logo_path: "/apple.jpg"
            }
          ],
          aggregate_credits: {
            cast: [
              {
                id: 2,
                name: "Adam Scott",
                order: 0,
                roles: [{ character: "Mark Scout", episode_count: 19 }]
              }
            ]
          },
          videos: {
            results: [
              {
                key: "severance-trailer",
                site: "YouTube",
                type: "Trailer",
                official: true
              }
            ]
          }
        });
      },
      "GET /3/tv/95396/watch/providers": () =>
        jsonResponse({
          results: {
            US: {
              link: "https://www.themoviedb.org/tv/95396/watch",
              flatrate: [
                {
                  provider_id: 350,
                  provider_name: "Apple TV+",
                  logo_path: "/apple.jpg"
                }
              ]
            }
          }
        })
    });
    const client = new TmdbClient(config, fetchMock);

    const result = await client.getTvSeries({ seriesId: 95396 });

    expect(result).toMatchObject({
      episode_runtime_minutes: 50,
      seasons_total: 2,
      episodes_total: 19,
      creators: [{ id: 1, name: "Dan Erickson" }],
      cast: [{ id: 2, name: "Adam Scott", character: "Mark Scout" }],
      trailer_url: "https://www.youtube.com/watch?v=severance-trailer",
      watch_providers: {
        attribution: "JustWatch",
        stream: [{ id: 350, name: "Apple TV+" }]
      }
    });
  });

  it("encodes TV discovery filters and rating safeguards", async () => {
    const fetchMock = createRouterFetchMock({
      "GET /3/configuration": () => configurationResponse(),
      "GET /3/discover/tv?": (url) => {
        expect(url.searchParams.get("with_genres")).toBe("18|9648");
        expect(url.searchParams.get("first_air_date.gte")).toBe("2020-01-01");
        expect(url.searchParams.get("vote_count.gte")).toBe("200");
        expect(url.searchParams.get("with_watch_providers")).toBe("350");
        expect(url.searchParams.get("watch_region")).toBe("US");
        return jsonResponse(tvPage([]));
      }
    });
    const client = new TmdbClient(config, fetchMock);

    await client.discoverTv({
      genres: [18, 9648],
      genreMode: "or",
      firstAirDateFrom: "2020-01-01",
      watchProviderIds: [350],
      sortBy: "vote_average.desc",
      page: 1
    });
  });

  it("uses TV-specific list, related, genre, and provider endpoints", async () => {
    const fetchMock = createRouterFetchMock({
      "GET /3/configuration": () => configurationResponse(),
      "GET /3/tv/on_the_air?": () => jsonResponse(tvPage([])),
      "GET /3/tv/95396/recommendations?": () => jsonResponse(tvPage([])),
      "GET /3/genre/tv/list?": () =>
        jsonResponse({ genres: [{ id: 18, name: "Drama" }] }),
      "GET /3/watch/providers/tv?": () =>
        jsonResponse({
          results: [
            {
              provider_id: 350,
              provider_name: "Apple TV+",
              logo_path: "/apple.jpg",
              display_priority: 1
            }
          ]
        })
    });
    const client = new TmdbClient(config, fetchMock);

    const [list, related, genres, providers] = await Promise.all([
      client.listTvSeries({ category: "on_the_air", page: 1 }),
      client.getRelatedTv({
        seriesId: 95396,
        kind: "recommendations",
        page: 1
      }),
      client.listTvGenres(),
      client.listTvWatchProviders({})
    ]);

    expect(list.items).toEqual([]);
    expect(related.items).toEqual([]);
    expect(genres.genres[0]?.name).toBe("Drama");
    expect(providers.providers[0]?.name).toBe("Apple TV+");
  });
});

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

function tvResponse() {
  return {
    id: 95396,
    name: "Severance",
    original_name: "Severance",
    first_air_date: "2022-02-17",
    overview: "Employees separate their work and personal memories.",
    genre_ids: [18, 9648],
    origin_country: ["US"],
    vote_average: 8.4,
    vote_count: 8000,
    popularity: 100,
    poster_path: "/severance.jpg",
    backdrop_path: "/severance-wide.jpg"
  };
}

function tvPage(results: ReturnType<typeof tvResponse>[]) {
  return {
    results,
    page: 1,
    total_pages: 1,
    total_results: results.length
  };
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
