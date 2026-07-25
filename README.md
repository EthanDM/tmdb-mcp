# tmdb-mcp

Local, read-only TMDB MCP server for discovering movies and TV series from Codex.

## Tools

- `tmdb_search_movies`
- `tmdb_get_movie`
- `tmdb_list_movies`
- `tmdb_trending_movies`
- `tmdb_discover_movies`
- `tmdb_get_related_movies`
- `tmdb_list_movie_genres`
- `tmdb_list_watch_providers`
- `tmdb_search_tv`
- `tmdb_get_tv_series`
- `tmdb_list_tv_series`
- `tmdb_trending_tv`
- `tmdb_discover_tv`
- `tmdb_get_related_tv`
- `tmdb_list_tv_genres`
- `tmdb_list_tv_watch_providers`

The server supports title search, exact movie details, popular/top-rated/current
lists, daily or weekly trends, advanced discovery filters, recommendations,
similar movies, genres, and regional streaming-provider lookup.

TV tools provide the same workflows for series, including airing-today and
on-the-air lists, first-air-date discovery filters, creators, aggregate cast,
episode runtime, season and episode counts, and regional providers.

It does not expose account sessions, favorites, ratings, watchlists, lists, or
any other mutation.

## Requirements

- Node.js 22+
- `pnpm`
- A TMDB API Read Access Token

## Setup

1. Create or sign into your TMDB account.
2. Request API access from the API section of your account settings.
3. Copy `.env.example` to `.env`.
4. Set `TMDB_READ_ACCESS_TOKEN` to the API Read Access Token.
5. Install and build:

```bash
pnpm install
pnpm build
```

Run the stable built server:

```bash
pnpm start
```

Example Codex configuration:

```toml
[mcp_servers.tmdb]
command = "node"
args = ["--env-file=/absolute/path/to/tmdb-mcp/.env", "/absolute/path/to/tmdb-mcp/dist/server.js"]
```

Use `pnpm dev` only while developing the server.

## Tool behavior

- Language defaults to `TMDB_LANGUAGE`, then `en-US`.
- Region defaults to `TMDB_REGION`, then `US`.
- Adult content is excluded by default.
- List responses expose `next_page`; the server never silently crawls pages.
- Rating-sorted discovery defaults to at least 200 votes unless
  `minVoteCount` is explicitly supplied.
- Related-movie lookup defaults to TMDB recommendations. `similar` is the
  narrower genre-and-keyword alternative.
- Watch-provider results are supplied by JustWatch and include the required
  attribution.

## Example discovery call

```json
{
  "genres": [878],
  "releaseDateFrom": "2015-01-01",
  "minRating": 7,
  "minVoteCount": 500,
  "maxRuntime": 150,
  "sortBy": "vote_average.desc",
  "region": "US"
}
```

Use `tmdb_list_movie_genres` and `tmdb_list_watch_providers` to resolve the IDs
accepted by discovery filters.

TV discovery uses the corresponding `tmdb_list_tv_genres` and
`tmdb_list_tv_watch_providers` tools.

## Verification

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm smoke
```

`pnpm smoke` makes live read-only requests and requires a configured token.
