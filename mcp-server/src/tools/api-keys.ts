import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../client.js';
import { formatError, formatSuccess } from '../client.js';

export function registerApiKeyTools(server: McpServer, client: ApiClient) {
  server.registerTool('list_api_keys', {
    description: 'List API keys for an organisation',
    inputSchema: {
      orgId: z.string().uuid().describe('Organisation UUID'),
    },
  }, async ({ orgId }) => {
    const { data, error, response } = await client.GET('/api/orgs/{orgId}/api-keys', {
      params: { path: { orgId } },
    });
    if (error) return formatError(response, error);
    return formatSuccess(data);
  });

  server.registerTool('create_api_key', {
    description: 'Create a new API key for an organisation',
    inputSchema: {
      orgId: z.string().uuid().describe('Organisation UUID'),
      name: z.string().describe('Key name for identification'),
    },
  }, async ({ orgId, name }) => {
    const { data, error, response } = await client.POST('/api/orgs/{orgId}/api-keys', {
      params: { path: { orgId } },
      body: { name },
    });
    if (error) return formatError(response, error);
    return formatSuccess(data);
  });

  server.registerTool('revoke_api_key', {
    description: 'Revoke an API key',
    inputSchema: {
      orgId: z.string().uuid().describe('Organisation UUID'),
      keyId: z.string().uuid().describe('API key UUID'),
    },
  }, async ({ orgId, keyId }) => {
    const { data, error, response } = await client.DELETE('/api/orgs/{orgId}/api-keys/{keyId}', {
      params: { path: { orgId, keyId } },
    });
    if (error) return formatError(response, error);
    return formatSuccess(data ?? { revoked: true });
  });
}
