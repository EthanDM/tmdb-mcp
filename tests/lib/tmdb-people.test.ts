import { describe, expect, it, vi } from "vitest";

import type { TmdbConfig } from "../../src/config.js";
import { TmdbClient } from "../../src/lib/tmdb.js";

const config: TmdbConfig = {
  readAccessToken: "read-token",
  language: "en-US",
  region: "US"
};

describe("TmdbClient people", () => {
  it("searches people with known-work context", async () => {
    const fetchMock = createRouterFetchMock({
      "GET /3/configuration": () => configurationResponse(),
      "GET /3/search/person?": (url) => {
        expect(url.searchParams.get("query")).toBe("Denis Villeneuve");
        expect(url.searchParams.get("include_adult")).toBe("false");
        return jsonResponse({
          page: 1,
          total_pages: 1,
          total_results: 1,
          results: [
            {
              id: 137427,
              name: "Denis Villeneuve",
              known_for_department: "Directing",
              popularity: 12,
              profile_path: "/denis.jpg",
              known_for: [
                {
                  media_type: "movie",
                  id: 329865,
                  title: "Arrival",
                  release_date: "2016-11-11"
                }
              ]
            }
          ]
        });
      }
    });
    const client = new TmdbClient(config, fetchMock);

    const result = await client.searchPeople({
      query: "Denis Villeneuve",
      page: 1,
      includeAdult: false
    });

    expect(result.items[0]).toMatchObject({
      id: 137427,
      name: "Denis Villeneuve",
      known_for_department: "Directing",
      known_for: [
        {
          media_type: "movie",
          id: 329865,
          title: "Arrival",
          year: 2016
        }
      ],
      tmdb_url: "https://www.themoviedb.org/person/137427"
    });
  });

  it("normalizes person biography details", async () => {
    const fetchMock = createRouterFetchMock({
      "GET /3/configuration": () => configurationResponse(),
      "GET /3/person/137427?": () =>
        jsonResponse({
          id: 137427,
          name: "Denis Villeneuve",
          also_known_as: ["Дени Вильнёв"],
          biography: "A Canadian filmmaker.",
          birthday: "1967-10-03",
          deathday: null,
          place_of_birth: "Trois-Rivières, Québec, Canada",
          known_for_department: "Directing",
          popularity: 12,
          profile_path: "/denis.jpg",
          imdb_id: "nm0898288"
        })
    });
    const client = new TmdbClient(config, fetchMock);

    const result = await client.getPerson({ personId: 137427 });

    expect(result).toMatchObject({
      name: "Denis Villeneuve",
      birthday: "1967-10-03",
      imdb_id: "nm0898288",
      profile_url: "https://images.example/h632/denis.jpg"
    });
  });

  it("filters, sorts, and caps combined credits", async () => {
    const fetchMock = createRouterFetchMock({
      "GET /3/configuration": () => configurationResponse(),
      "GET /3/person/137427/combined_credits?": () =>
        jsonResponse({
          id: 137427,
          cast: [
            {
              media_type: "movie",
              id: 1,
              title: "Cameo",
              character: "Self",
              release_date: "2020-01-01",
              popularity: 2
            }
          ],
          crew: [
            {
              media_type: "movie",
              id: 329865,
              title: "Arrival",
              job: "Director",
              department: "Directing",
              release_date: "2016-11-11",
              vote_average: 7.6,
              vote_count: 19000,
              popularity: 20,
              poster_path: "/arrival.jpg"
            },
            {
              media_type: "tv",
              id: 2,
              name: "TV Work",
              job: "Director",
              department: "Directing",
              first_air_date: "2014-01-01",
              popularity: 5
            }
          ]
        })
    });
    const client = new TmdbClient(config, fetchMock);

    const result = await client.getPersonCredits({
      personId: 137427,
      mediaType: "combined",
      creditType: "crew",
      sortBy: "popularity",
      limit: 1
    });

    expect(result).toMatchObject({
      person_id: 137427,
      total_matching: 2,
      returned: 1,
      items: [
        {
          media_type: "movie",
          credit_type: "crew",
          title: "Arrival",
          job: "Director"
        }
      ]
    });
  });

  it("uses media-specific credit endpoints when requested", async () => {
    const fetchMock = createRouterFetchMock({
      "GET /3/configuration": () => configurationResponse(),
      "GET /3/person/137427/movie_credits?": () =>
        jsonResponse({
          id: 137427,
          cast: [],
          crew: [
            {
              id: 329865,
              title: "Arrival",
              job: "Director",
              department: "Directing",
              release_date: "2016-11-11"
            }
          ]
        })
    });
    const client = new TmdbClient(config, fetchMock);

    const result = await client.getPersonCredits({
      personId: 137427,
      mediaType: "movie",
      creditType: "crew",
      sortBy: "date",
      limit: 30
    });

    expect(result.items[0]?.media_type).toBe("movie");
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

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
