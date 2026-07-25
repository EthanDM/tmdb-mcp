import { TmdbMcpError } from "./errors.js";

export const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";

export type TmdbConfig = {
  readAccessToken: string;
  language: string;
  region: string;
};

/**
 * Reads the application-level TMDB settings used by every tool call.
 *
 * Authentication fails at startup so a misconfigured MCP does not appear
 * healthy and then fail only after an agent selects a tool.
 */
export function getTmdbConfig(): TmdbConfig {
  const readAccessToken = process.env.TMDB_READ_ACCESS_TOKEN?.trim();

  if (!readAccessToken) {
    throw new TmdbMcpError(
      "TMDB_READ_ACCESS_TOKEN is required. Copy .env.example to .env and add your TMDB API Read Access Token.",
      "auth_missing_token"
    );
  }

  return {
    readAccessToken,
    language: process.env.TMDB_LANGUAGE?.trim() || "en-US",
    region: process.env.TMDB_REGION?.trim() || "US"
  };
}
