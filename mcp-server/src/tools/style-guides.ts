import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../client.js';
import { formatError, formatSuccess } from '../client.js';

export function registerStyleGuideTools(server: McpServer, client: ApiClient) {
  server.registerTool('list_style_guides', {
    description: 'List style guides for a project',
    inputSchema: {
      id: z.string().uuid().describe('Project UUID'),
    },
  }, async ({ id }) => {
    const { data, error, response } = await client.GET('/api/projects/{id}/style-guides', {
      params: { path: { id } },
    });
    if (error) return formatError(response, error);
    return formatSuccess(data);
  });

  server.registerTool('upsert_style_guide', {
    description: 'Create or update translation style instructions for a specific language in a project',
    inputSchema: {
      id: z.string().uuid().describe('Project UUID'),
      projectLanguageId: z.string().uuid().describe('Project language UUID'),
      instructions: z.string().describe('Style guide instructions text'),
    },
  }, async ({ id, projectLanguageId, instructions }) => {
    const { data, error, response } = await client.PUT('/api/projects/{id}/style-guides/{projectLanguageId}', {
      params: { path: { id, projectLanguageId } },
      body: { instructions },
    });
    if (error) return formatError(response, error);
    return formatSuccess(data);
  });

  server.registerTool('delete_style_guide', {
    description: 'Remove a style guide from a project language',
    inputSchema: {
      id: z.string().uuid().describe('Project UUID'),
      projectLanguageId: z.string().uuid().describe('Project language UUID'),
    },
  }, async ({ id, projectLanguageId }) => {
    const { data, error, response } = await client.DELETE('/api/projects/{id}/style-guides/{projectLanguageId}', {
      params: { path: { id, projectLanguageId } },
    });
    if (error) return formatError(response, error);
    return formatSuccess(data ?? { deleted: true });
  });
}
