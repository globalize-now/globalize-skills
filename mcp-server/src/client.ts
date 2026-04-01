import createClient, { type Client, type FetchResponse } from 'openapi-fetch';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { paths } from './api-types.js';

export type ApiClient = Client<paths>;

export function createApiClient(apiKey: string, apiUrl: string): ApiClient {
  return createClient<paths>({
    baseUrl: apiUrl,
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

export function formatError(response: Response, error: unknown): CallToolResult {
  const status = response.status;
  const detail = typeof error === 'object' && error !== null ? JSON.stringify(error) : String(error);

  if (status === 401 || status === 403) {
    return { content: [{ type: 'text', text: 'Authentication failed. Check your API key or run the auth flow again.' }] };
  }
  if (status === 404) {
    return { content: [{ type: 'text', text: `Resource not found: ${detail}` }] };
  }
  if (status === 422) {
    return { content: [{ type: 'text', text: `Validation error: ${detail}` }] };
  }
  if (status >= 500) {
    return { content: [{ type: 'text', text: 'Server error. Try again later.' }] };
  }
  return { content: [{ type: 'text', text: `Error: ${detail}` }] };
}

export function formatSuccess(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}
