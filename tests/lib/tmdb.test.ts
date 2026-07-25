import { describe, expect, it, vi } from "vitest";

import type { TmdbConfig } from "../../src/config.js";
import { TmdbClient } from "../../src/lib/tmdb.js";

const config: TmdbConfig = {
  readAccessToken: "read-token",
  language: "en-US",
  region: "US"
};

describe("TmdbClient", () => {
  it("searches movies with authentication and normalized image URLs", async () => {
    const fetchMock = createRouterFetchMock({
      "GET /3/configuration": () => configurationResponse(),
      "GET /3/search/movie?": (url, init) => {
        expect(url.searchParams.get("query")).toBe("The Matrix");
        expect(url.searchParams.get("year")).toBe("1999");
        expect(url.searchParams.get("include_adult")).toBe("false");
        expect(init?.headers).toMatchObject({
          authorization: "Bearer read-token"
        });
        return jsonResponse(moviePage([movieResponse()]));
      }
    });
    const client = new TmdbClient(config, fetchMock);

    const result = await client.searchMovies({
      query: "The Matrix",
      year: 1999,
      page: 1,
      includeAdult: false
    });

    expect(result.items[0]).toMatchObject({
      id: 603,
      title: "The Matrix",
      year: 1999,
      poster_url: "https://images.example/w500/matrix.jpg",
      tmdb_url: "https://www.themoviedb.org/movie/603"
    });
    expect(result.next_page).toBe(2);
  });

  it("maps curated list categories directly to TMDB endpoints", async () => {
    const fetchMock = createRouterFetchMock({
      "GET /3/configuration": () => configurationResponse(),
      "GET /3/movie/top_rated?": (url) => {
        expect(url.searchParams.get("page")).toBe("2");
        expect(url.searchParams.get("region")).toBe("US");
        return jsonResponse(moviePage([]));
      }
    });
    const client = new TmdbClient(config, fetchMock);

    await client.listMovies({ category: "top_rated", page: 2 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("encodes discover filters and protects rating sorts from tiny samples", async () => {
    const fetchMock = createRouterFetchMock({
      "GET /3/configuration": () => configurationResponse(),
      "GET /3/discover/movie?": (url) => {
        expect(url.searchParams.get("with_genres")).toBe("878|12");
        expect(url.searchParams.get("without_genres")).toBe("27");
        expect(url.searchParams.get("vote_average.gte")).toBe("7");
        expect(url.searchParams.get("vote_count.gte")).toBe("200");
        expect(url.searchParams.get("with_watch_providers")).toBe("8|9");
        expect(url.searchParams.get("watch_region")).toBe("US");
        expect(url.searchParams.get("with_cast")).toBe("101,102");
        expect(url.searchParams.get("with_crew")).toBe("137427");
        expect(url.searchParams.get("with_people")).toBe("42");
        return jsonResponse(moviePage([]));
      }
    });
    const client = new TmdbClient(config, fetchMock);

    await client.discoverMovies({
      genres: [878, 12],
      genreMode: "or",
      excludeGenres: [27],
      minRating: 7,
      watchProviderIds: [8, 9],
      castIds: [101, 102],
      crewIds: [137427],
      personIds: [42],
      sortBy: "vote_average.desc",
      page: 1,
      language: "en-US",
      region: "US"
    });
  });

  it("returns enriched details and regional provider attribution", async () => {
    const fetchMock = createRouterFetchMock({
      "GET /3/configuration": () => configurationResponse(),
      "GET /3/movie/603?": (url) => {
        expect(url.searchParams.get("append_to_response")).toBe(
          "credits,videos"
        );
        return jsonResponse({
          ...movieResponse(),
          runtime: 136,
          tagline: "Welcome to the Real World.",
          status: "Released",
          genres: [{ id: 878, name: "Science Fiction" }],
          production_countries: [{ iso_3166_1: "US", name: "United States" }],
          belongs_to_collection: { id: 2344, name: "The Matrix Collection" },
          imdb_id: "tt0133093",
          credits: {
            cast: [{ id: 1, name: "Keanu Reeves", character: "Neo", order: 0 }],
            crew: [{ id: 2, name: "Lana Wachowski", job: "Director" }]
          },
          videos: {
            results: [
              {
                key: "trailer-key",
                site: "YouTube",
                type: "Trailer",
                official: true
              }
            ]
          }
        });
      },
      "GET /3/movie/603/watch/providers": () =>
        jsonResponse({
          results: {
            US: {
              link: "https://www.themoviedb.org/movie/603/watch",
              flatrate: [
                {
                  provider_id: 8,
                  provider_name: "Netflix",
                  logo_path: "/netflix.jpg"
                }
              ]
            }
          }
        })
    });
    const client = new TmdbClient(config, fetchMock);

    const result = await client.getMovie({ movieId: 603 });

    expect(result).toMatchObject({
      runtime_minutes: 136,
      directors: [{ id: 2, name: "Lana Wachowski", job: "Director" }],
      cast: [{ id: 1, name: "Keanu Reeves", character: "Neo" }],
      trailer_url: "https://www.youtube.com/watch?v=trailer-key",
      watch_providers: {
        region: "US",
        attribution: "JustWatch",
        stream: [
          {
            id: 8,
            name: "Netflix",
            logo_url: "https://images.example/w92/netflix.jpg"
          }
        ]
      }
    });
  });

  it("routes recommendation and similar reads independently", async () => {
    const fetchMock = createRouterFetchMock({
      "GET /3/configuration": () => configurationResponse(),
      "GET /3/movie/603/similar?": () => jsonResponse(moviePage([]))
    });
    const client = new TmdbClient(config, fetchMock);

    await client.getRelatedMovies({
      movieId: 603,
      kind: "similar",
      page: 1
    });
  });

  it("retries bounded rate limits and surfaces TMDB API errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status_message: "Slow down" }), {
          status: 429,
          headers: { "retry-after": "0" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status_message: "Invalid API key" }), {
          status: 401,
          headers: { "content-type": "application/json" }
        })
      );
    const client = new TmdbClient(config, fetchMock as typeof fetch);

    await expect(client.listMovieGenres()).rejects.toEqual(
      expect.objectContaining({
        status: 401,
        message: "Invalid API key"
      })
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
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

function movieResponse() {
  return {
    id: 603,
    title: "The Matrix",
    original_title: "The Matrix",
    release_date: "1999-03-30",
    overview: "A hacker discovers the truth.",
    genre_ids: [28, 878],
    vote_average: 8.2,
    vote_count: 26000,
    popularity: 90,
    poster_path: "/matrix.jpg",
    backdrop_path: "/matrix-wide.jpg"
  };
}

function moviePage(results: ReturnType<typeof movieResponse>[]) {
  return {
    results,
    page: 1,
    total_pages: 2,
    total_results: results.length
  };
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
