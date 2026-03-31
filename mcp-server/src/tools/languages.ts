import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../client.js';
import { formatError, formatSuccess } from '../client.js';

export function registerLanguageTools(server: McpServer, client: ApiClient) {
  server.registerTool('list_languages', {
    description: 'Search and list available languages from the global catalog. Use to find language UUIDs for project setup.',
    inputSchema: {},
  }, async () => {
    const { data, error, response } = await client.GET('/api/languages');
    if (error) return formatError(response.status, error);
    return formatSuccess(data);
  });

  server.registerTool('get_language', {
    description: 'Get details for a specific language by ID',
    inputSchema: {
      id: z.string().uuid().describe('Language UUID'),
    },
  }, async ({ id }) => {
    const { data, error, response } = await client.GET('/api/languages/{id}', {
      params: { path: { id } },
    });
    if (error) return formatError(response.status, error);
    return formatSuccess(data);
  });
}
