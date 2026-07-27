import { describe, expect, it, vi } from "vitest";

import type { TmdbConfig } from "../../src/config.js";
import { TmdbClient } from "../../src/lib/tmdb.js";

const config: TmdbConfig = {
  readAccessToken: "read-token",
  language: "en-US",
  region: "US"
};

describe("TmdbClient catalog workflows", () => {
  it("normalizes mixed and collection searches", async () => {
    const fetchMock = createRouterFetchMock({
      "GET /3/configuration": () => configurationResponse(),
      "GET /3/search/multi?": (url) => {
        expect(url.searchParams.get("query")).toBe("Matrix");
        return jsonResponse(
          page([
            {
              media_type: "movie",
              id: 603,
              title: "The Matrix",
              release_date: "1999-03-30",
              overview: "Reality is not what it seems.",
              popularity: 100,
              poster_path: "/matrix.jpg"
            },
            {
              media_type: "person",
              id: 6384,
              name: "Keanu Reeves",
              known_for_department: "Acting",
              popularity: 50,
              profile_path: "/keanu.jpg"
            }
          ])
        );
      },
      "GET /3/search/collection?": () =>
        jsonResponse(
          page([
            {
              id: 2344,
              name: "The Matrix Collection",
              overview: "The Matrix films.",
              poster_path: "/collection.jpg"
            }
          ])
        )
    });
    const client = new TmdbClient(config, fetchMock);

    const [mixed, collections] = await Promise.all([
      client.searchMulti({ query: "Matrix", page: 1, includeAdult: false }),
      client.searchCollections({ query: "Matrix", page: 1 })
    ]);

    expect(mixed.items).toEqual([
      expect.objectContaining({ media_type: "movie", id: 603 }),
      expect.objectContaining({
        media_type: "person",
        id: 6384,
        known_for_department: "Acting"
      })
    ]);
    expect(collections.items[0]).toMatchObject({
      id: 2344,
      poster_url: "https://images.example/w500/collection.jpg"
    });
  });

  it("uses aggregate TV credits and flattens roles and jobs", async () => {
    const fetchMock = createRouterFetchMock({
      "GET /3/configuration": () => configurationResponse(),
      "GET /3/tv/95396/aggregate_credits?": () =>
        jsonResponse({
          cast: [
            {
              id: 1,
              name: "Adam Scott",
              roles: [{ character: "Mark Scout" }, { character: "Mark S." }],
              total_episode_count: 19,
              profile_path: "/adam.jpg"
            }
          ],
          crew: [
            {
              id: 2,
              name: "Ben Stiller",
              department: "Directing",
              jobs: [{ job: "Director" }],
              total_episode_count: 11
            }
          ]
        })
    });
    const client = new TmdbClient(config, fetchMock);

    const result = await client.getCredits({
      mediaType: "tv",
      id: 95396,
      creditType: "all",
      limit: 50
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        name: "Adam Scott",
        character: "Mark Scout, Mark S.",
        episode_count: 19
      }),
      expect.objectContaining({
        name: "Ben Stiller",
        job: "Director",
        department: "Directing"
      })
    ]);
  });

  it("keeps crew visible when an all-credits result exceeds its limit", async () => {
    const fetchMock = createRouterFetchMock({
      "GET /3/configuration": () => configurationResponse(),
      "GET /3/movie/603/credits?": () =>
        jsonResponse({
          cast: Array.from({ length: 12 }, (_, index) => ({
            id: index + 1,
            name: `Actor ${index + 1}`
          })),
          crew: [
            { id: 101, name: "Director", job: "Director" },
            { id: 102, name: "Writer", job: "Writer" }
          ]
        })
    });
    const client = new TmdbClient(config, fetchMock);

    const result = await client.getCredits({
      mediaType: "movie",
      id: 603,
      creditType: "all",
      limit: 10
    });

    expect(result.items).toHaveLength(10);
    expect(result.items.filter((item) => item.credit_type === "crew")).toEqual([
      expect.objectContaining({ name: "Director" }),
      expect.objectContaining({ name: "Writer" })
    ]);
  });

  it("routes movie and TV episode credits independently", async () => {
    const fetchMock = createRouterFetchMock({
      "GET /3/configuration": () => configurationResponse(),
      "GET /3/movie/603/credits?": () =>
        jsonResponse({ cast: [{ id: 1, name: "Keanu Reeves" }], crew: [] }),
      "GET /3/tv/95396/season/1/episode/1/credits?": () =>
        jsonResponse({ cast: [], crew: [{ id: 2, name: "Ben Stiller" }] })
    });
    const client = new TmdbClient(config, fetchMock);

    await Promise.all([
      client.getCredits({
        mediaType: "movie",
        id: 603,
        creditType: "cast",
        limit: 50
      }),
      client.getCredits({
        mediaType: "tv",
        id: 95396,
        seasonNumber: 1,
        episodeNumber: 1,
        creditType: "crew",
        limit: 50
      })
    ]);
  });

  it("normalizes paginated reviews and external avatars", async () => {
    const fetchMock = createRouterFetchMock({
      "GET /3/configuration": () => configurationResponse(),
      "GET /3/movie/603/reviews?": () =>
        jsonResponse(
          page([
            {
              id: "review-1",
              author: "Neo",
              content: "There is no spoon.",
              created_at: "2020-01-01T00:00:00.000Z",
              url: "https://www.themoviedb.org/review/review-1",
              author_details: {
                rating: 9,
                avatar_path: "/https://secure.gravatar.com/avatar/example"
              }
            }
          ])
        ),
      "GET /3/tv/95396/reviews?": () => jsonResponse(page([]))
    });
    const client = new TmdbClient(config, fetchMock);

    const [movie, tv] = await Promise.all([
      client.getReviews({ mediaType: "movie", id: 603, page: 1 }),
      client.getReviews({ mediaType: "tv", id: 95396, page: 1 })
    ]);

    expect(movie.items[0]).toMatchObject({
      author: "Neo",
      rating: 9,
      avatar_url: "https://secure.gravatar.com/avatar/example"
    });
    expect(tv.items).toEqual([]);
  });
});

function createRouterFetchMock(
  routes: Record<string, (url: URL, init?: RequestInit) => Response>
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

function page(results: Array<Record<string, unknown>>) {
  return {
    page: 1,
    total_pages: 1,
    total_results: results.length,
    results
  };
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
