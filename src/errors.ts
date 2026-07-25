/**
 * Domain error for local validation and configuration failures.
 */
export class TmdbMcpError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "TmdbMcpError";
  }
}

/**
 * Preserves TMDB HTTP status and retry guidance for callers and tests.
 */
export class TmdbApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "TmdbApiError";
  }
}

/**
 * Converts known failures into safe MCP-visible messages without stack traces.
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof TmdbMcpError || error instanceof TmdbApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}
