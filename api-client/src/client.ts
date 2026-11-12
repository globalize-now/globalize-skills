import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import createClient, { type Client } from "openapi-fetch";
import type { paths } from "./api-types.js";

export type ApiClient = Client<paths>;

const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../package.json"), "utf-8"));

/**
 * Sent on every request, so the API can tell CLI traffic (and a stale global
 * install) from other callers. The API records it only when it matches
 * `globalize-cli-client/<semver>` exactly.
 */
export const USER_AGENT = `globalize-cli-client/${pkg.version as string}`;

export function createApiClient(apiKey: string, apiUrl: string): ApiClient {
  return createClient<paths>({
    baseUrl: apiUrl,
    headers: { Authorization: `Bearer ${apiKey}`, "User-Agent": USER_AGENT },
  });
}

/** The API's error body: `{ code, message, statusCode, details? }`. */
interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

function isApiErrorBody(error: unknown): error is ApiErrorBody {
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as ApiErrorBody).code === "string" &&
    typeof (error as ApiErrorBody).message === "string"
  );
}

/**
 * 403 codes that mean the caller can't act in this organisation at all. Every
 * other 403 (`FEATURE_REQUIRED`, `WORKFLOW_GATE_ADMIN_REQUIRED`, …) is a refusal
 * an agent can act on, so it keeps its code and message.
 */
const AUTH_FAILURE_CODES = new Set(["UNAUTHORIZED", "FORBIDDEN", "ORG_ACCESS_DENIED"]);

const AUTH_FAILED = "Authentication failed. Check your API key or run `globalise-now-cli auth login`.";

export function extractError(response: Response, error: unknown): string {
  const status = response.status;
  const detail = typeof error === "object" && error !== null ? JSON.stringify(error) : String(error);

  if (status === 401) return AUTH_FAILED;
  if (status === 403) {
    if (!isApiErrorBody(error) || AUTH_FAILURE_CODES.has(error.code)) return AUTH_FAILED;
    const details = error.details === undefined ? "" : ` ${JSON.stringify({ details: error.details })}`;
    return `${error.code}: ${error.message}${details}`;
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

/**
 * A refused request: the message `extractError` gives, plus the status and the
 * API's error body (`code`, `details`) so JSON output can carry them unchanged.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly details: unknown;

  constructor(response: Response, error: unknown) {
    super(extractError(response, error));
    this.name = "ApiError";
    this.status = response.status;
    this.code = isApiErrorBody(error) ? error.code : undefined;
    this.details = isApiErrorBody(error) ? error.details : undefined;
  }
}

export function apiError(response: Response, error: unknown): ApiError {
  return new ApiError(response, error);
}
