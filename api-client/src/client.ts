import createClient, { type Client } from "openapi-fetch";
import type { paths } from "./api-types.js";

export type ApiClient = Client<paths>;

export function createApiClient(apiKey: string, apiUrl: string): ApiClient {
  return createClient<paths>({
    baseUrl: apiUrl,
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

export function extractError(response: Response, error: unknown): string {
  const status = response.status;
  const detail = typeof error === "object" && error !== null ? JSON.stringify(error) : String(error);

  if (status === 401 || status === 403) {
    return "Authentication failed. Check your API key or run `globalise-now-cli auth login`.";
  }
  if (status === 404) {
    return `Not found: ${detail}`;
  }
  if (status === 422) {
    return `Validation error: ${detail}`;
  }
  if (status >= 500) {
    return "Server error. Try again later.";
  }
  return `Error: ${detail}`;
}
