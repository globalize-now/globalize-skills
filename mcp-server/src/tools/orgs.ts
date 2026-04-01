import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../client.js';
import { formatError, formatSuccess } from '../client.js';

export function registerOrgTools(server: McpServer, client: ApiClient) {
  server.registerTool('list_orgs', {
    description: 'List all organisations the authenticated user belongs to',
    inputSchema: {},
  }, async () => {
    const { data, error, response } = await client.GET('/api/orgs');
    if (error) return formatError(response.status, error);
    return formatSuccess(data);
  });

  server.registerTool('create_org', {
    description: 'Create a new organisation',
    inputSchema: {
      name: z.string().describe('Organisation name'),
    },
  }, async ({ name }) => {
    const { data, error, response } = await client.POST('/api/orgs', {
      body: { name },
    });
    if (error) return formatError(response.status, error);
    return formatSuccess(data);
  });

  server.registerTool('delete_org', {
    description: 'Delete an organisation by ID',
    inputSchema: {
      orgId: z.string().uuid().describe('Organisation UUID'),
    },
  }, async ({ orgId }) => {
    const { data, error, response } = await client.DELETE('/api/orgs/{orgId}', {
      params: { path: { orgId } },
    });
    if (error) return formatError(response.status, error);
    return formatSuccess(data ?? { deleted: true });
  });
}
