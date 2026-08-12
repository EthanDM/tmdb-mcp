# Contributing

## Scope

This project is a local, read-only TMDB MCP server for movie, TV, and people
discovery. Keep the tool surface small, workflow-oriented, and easy to
maintain.

## Prerequisites

- Node.js 22+
- `pnpm`
- A TMDB API Read Access Token for smoke testing

## Setup

1. Copy `.env.example` to `.env`.
2. Set `TMDB_READ_ACCESS_TOKEN`.
3. Install dependencies:

```bash
pnpm install
```

## Running

Use the built server path for normal usage:

```bash
pnpm build
pnpm start
```

Use contributor mode only while editing the repository:

```bash
pnpm dev
```

## Verification

Run this before opening or updating a pull request:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If request behavior changes, also run:

```bash
pnpm smoke
```

The smoke test makes real read-only TMDB requests and requires a configured
token.

## Change guidelines

- Do not add POST, PUT, PATCH, or DELETE requests.
- Prefer small, direct changes over new abstraction layers.
- Keep pagination explicit; do not crawl all pages implicitly.
- Normalize TMDB responses centrally rather than exposing raw payloads.
- Use configuration data for image URLs instead of hardcoded CDN roots.
- Preserve JustWatch attribution whenever watch-provider data is returned.
- Update tests and user-facing documentation alongside behavior changes.

## Documentation

Keep these files in sync with behavior changes:

- `README.md` for setup and tool behavior
- `CONTRIBUTING.md` for the contributor workflow
- `AGENTS.md` for repository-specific development guidance

## Commits

Use conventional commits where practical:

- `feat(catalog): ...`
- `fix(tmdb): ...`
- `chore(tooling): ...`
- `chore(readme): ...`
