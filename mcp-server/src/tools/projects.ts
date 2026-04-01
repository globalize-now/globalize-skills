import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../client.js';
import { formatError, formatSuccess } from '../client.js';

export function registerProjectTools(server: McpServer, client: ApiClient) {
  server.registerTool('list_projects', {
    description: 'List all translation projects',
    inputSchema: {},
  }, async () => {
    const { data, error, response } = await client.GET('/api/projects');
    if (error) return formatError(response, error);
    return formatSuccess(data);
  });

  server.registerTool('create_project', {
    description: 'Create a new translation project',
    inputSchema: {
      name: z.string().describe('Project name'),
      sourceLanguage: z.string().uuid().describe('Source language UUID'),
      targetLanguages: z.array(z.string().uuid()).describe('Target language UUIDs'),
    },
  }, async ({ name, sourceLanguage, targetLanguages }) => {
    const { data, error, response } = await client.POST('/api/projects', {
      body: { name, sourceLanguage, targetLanguages },
    });
    if (error) return formatError(response, error);
    return formatSuccess(data);
  });

  server.registerTool('get_project', {
    description: 'Get project details by ID',
    inputSchema: {
      id: z.string().uuid().describe('Project UUID'),
    },
  }, async ({ id }) => {
    const { data, error, response } = await client.GET('/api/projects/{id}', {
      params: { path: { id } },
    });
    if (error) return formatError(response, error);
    return formatSuccess(data);
  });

  server.registerTool('delete_project', {
    description: 'Delete a project by ID',
    inputSchema: {
      id: z.string().uuid().describe('Project UUID'),
    },
  }, async ({ id }) => {
    const { data, error, response } = await client.DELETE('/api/projects/{id}', {
      params: { path: { id } },
    });
    if (error) return formatError(response, error);
    return formatSuccess(data ?? { deleted: true });
  });
}
