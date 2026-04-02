import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '@globalize-now/cli-client';
import { listApiKeys, createApiKey, revokeApiKey } from '@globalize-now/cli-client';
import { formatSuccess, formatError } from '../helpers.js';

export function registerApiKeyTools(server: McpServer, client: ApiClient) {
  server.registerTool('list_api_keys', {
    description: 'List API keys for an organisation',
    inputSchema: {
      orgId: z.string().uuid().describe('Organisation UUID'),
    },
  }, async ({ orgId }) => {
    try {
      return formatSuccess(await listApiKeys(client, orgId));
    } catch (e) {
      return formatError(e);
    }
  });

  server.registerTool('create_api_key', {
    description: 'Create a new API key for an organisation',
    inputSchema: {
      orgId: z.string().uuid().describe('Organisation UUID'),
      name: z.string().describe('Key name for identification'),
    },
  }, async ({ orgId, name }) => {
    try {
      return formatSuccess(await createApiKey(client, orgId, name));
    } catch (e) {
      return formatError(e);
    }
  });

  server.registerTool('revoke_api_key', {
    description: 'Revoke an API key',
    inputSchema: {
      orgId: z.string().uuid().describe('Organisation UUID'),
      keyId: z.string().uuid().describe('API key UUID'),
    },
  }, async ({ orgId, keyId }) => {
    try {
      return formatSuccess(await revokeApiKey(client, orgId, keyId));
    } catch (e) {
      return formatError(e);
    }
  });
}
