import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../client.js';
import { formatError, formatSuccess } from '../client.js';

export function registerRepositoryTools(server: McpServer, client: ApiClient) {
  server.registerTool('list_repositories', {
    description: 'List repositories connected to a project',
    inputSchema: {},
  }, async () => {
    const { data, error, response } = await client.GET('/api/repositories');
    if (error) return formatError(response.status, error);
    return formatSuccess(data);
  });

  server.registerTool('create_repository', {
    description: 'Connect a git repository to a project for translation file syncing',
    inputSchema: {
      projectId: z.string().uuid().describe('Project UUID'),
      url: z.string().describe('Git repository URL'),
      branch: z.string().describe('Branch to sync'),
      provider: z.string().describe('Git provider (e.g. github)'),
      localePath: z.string().describe('Path pattern for locale files in the repo'),
    },
  }, async ({ projectId, url, branch, provider, localePath }) => {
    const { data, error, response } = await client.POST('/api/repositories', {
      body: { projectId, url, branch, provider, localePath },
    });
    if (error) return formatError(response.status, error);
    return formatSuccess(data);
  });

  server.registerTool('delete_repository', {
    description: 'Disconnect a repository',
    inputSchema: {
      id: z.string().uuid().describe('Repository UUID'),
    },
  }, async ({ id }) => {
    const { data, error, response } = await client.DELETE('/api/repositories/{id}', {
      params: { path: { id } },
    });
    if (error) return formatError(response.status, error);
    return formatSuccess(data ?? { deleted: true });
  });

  server.registerTool('detect_repository', {
    description: 'Re-scan a repository to detect i18n files and structure',
    inputSchema: {
      id: z.string().uuid().describe('Repository UUID'),
    },
  }, async ({ id }) => {
    const { data, error, response } = await client.POST('/api/repositories/{id}/detect', {
      params: { path: { id } },
    });
    if (error) return formatError(response.status, error);
    return formatSuccess(data);
  });
}
