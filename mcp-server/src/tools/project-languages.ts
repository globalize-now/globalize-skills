import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../client.js';
import { formatError, formatSuccess } from '../client.js';

export function registerProjectLanguageTools(server: McpServer, client: ApiClient) {
  server.registerTool('list_project_languages', {
    description: 'List languages configured on a project',
    inputSchema: {
      id: z.string().uuid().describe('Project UUID'),
    },
  }, async ({ id }) => {
    const { data, error, response } = await client.GET('/api/projects/{id}/languages', {
      params: { path: { id } },
    });
    if (error) return formatError(response.status, error);
    return formatSuccess(data);
  });

  server.registerTool('add_project_language', {
    description: 'Add a language to a project',
    inputSchema: {
      id: z.string().uuid().describe('Project UUID'),
      languageId: z.string().uuid().describe('Language UUID from the global catalog'),
    },
  }, async ({ id, languageId }) => {
    const { data, error, response } = await client.POST('/api/projects/{id}/languages', {
      params: { path: { id } },
      body: { languageId },
    });
    if (error) return formatError(response.status, error);
    return formatSuccess(data);
  });

  server.registerTool('remove_project_language', {
    description: 'Remove a language from a project',
    inputSchema: {
      id: z.string().uuid().describe('Project UUID'),
      languageId: z.string().uuid().describe('Project language UUID'),
    },
  }, async ({ id, languageId }) => {
    const { data, error, response } = await client.DELETE('/api/projects/{id}/languages/{languageId}', {
      params: { path: { id, languageId } },
    });
    if (error) return formatError(response.status, error);
    return formatSuccess(data ?? { removed: true });
  });
}
