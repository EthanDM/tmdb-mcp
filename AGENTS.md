# AGENTS.md

## Purpose

This repository is a local, read-only TMDB MCP server for movie and TV discovery.

## Working Rules

- Keep the MCP surface small and workflow-oriented.
- Do not add POST, PUT, PATCH, or DELETE request methods.
- Normalize TMDB responses centrally instead of exposing raw payloads.
- Keep pagination explicit; never crawl all pages implicitly.
- Use configuration data for image URLs rather than hardcoded CDN roots.
- Preserve JustWatch attribution anywhere watch-provider data is surfaced.
- Prefer the built server for normal use. Rebuild after source changes.

## Verification

After meaningful changes, run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run `pnpm smoke` when endpoint behavior or request shapes change and a TMDB
token is available.
