import { TMDB_API_BASE_URL, type TmdbConfig } from "../config.js";
import { TmdbApiError } from "../errors.js";

export type FetchLike = typeof fetch;

/**
 * Owns TMDB authentication, timeouts, HTTP errors, and bounded rate-limit retries.
 */
export class TmdbRequestClient {
  constructor(
    private readonly config: TmdbConfig,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly timeoutMs = 15_000
  ) {}

  /**
   * Executes one GET request. This client intentionally exposes no mutation
   * method, making the read-only product boundary structural rather than conventional.
   */
  async get<T>(
    path: string,
    query: URLSearchParams = new URLSearchParams(),
    rateLimitRetriesRemaining = 2
  ): Promise<T> {
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    const response = await this.fetchImpl(
      `${TMDB_API_BASE_URL}${path}${suffix}`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${this.config.readAccessToken}`,
          accept: "application/json"
        },
        signal: AbortSignal.timeout(this.timeoutMs)
      }
    );

    if (response.status === 429 && rateLimitRetriesRemaining > 0) {
      const retryAfterSeconds = Number(
        response.headers.get("retry-after") || "1"
      );
      await delay(retryAfterSeconds * 1000);
      return this.get(path, query, rateLimitRetriesRemaining - 1);
    }

    if (!response.ok) {
      throw new TmdbApiError(
        await readTmdbError(response),
        response.status,
        readRetryAfter(response)
      );
    }

    return (await response.json()) as T;
  }
}

/**
 * TMDB errors normally use `status_message`, but the fallback remains useful
 * for proxies and transient upstream responses that do not return JSON.
 */
async function readTmdbError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { status_message?: string };
    return (
      payload.status_message ||
      `TMDB API request failed with status ${response.status}.`
    );
  } catch {
    return `TMDB API request failed with status ${response.status}.`;
  }
}

function readRetryAfter(response: Response): number | undefined {
  const value = response.headers.get("retry-after");
  return value ? Number(value) : undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
