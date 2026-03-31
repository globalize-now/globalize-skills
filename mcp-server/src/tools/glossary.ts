import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../client.js';
import { formatError, formatSuccess } from '../client.js';

export function registerGlossaryTools(server: McpServer, client: ApiClient) {
  server.registerTool('list_glossary', {
    description: 'List glossary entries for a project',
    inputSchema: {
      id: z.string().uuid().describe('Project UUID'),
    },
  }, async ({ id }) => {
    const { data, error, response } = await client.GET('/api/projects/{id}/glossary', {
      params: { path: { id } },
    });
    if (error) return formatError(response.status, error);
    return formatSuccess(data);
  });

  server.registerTool('create_glossary_entry', {
    description: 'Add a glossary term pair (source term and target translation)',
    inputSchema: {
      id: z.string().uuid().describe('Project UUID'),
      sourceTerm: z.string().describe('Source language term'),
      targetTerm: z.string().describe('Target language translation'),
      languageId: z.string().uuid().describe('Target language UUID'),
    },
  }, async ({ id, sourceTerm, targetTerm, languageId }) => {
    const { data, error, response } = await client.POST('/api/projects/{id}/glossary', {
      params: { path: { id } },
      body: { sourceTerm, targetTerm, languageId },
    });
    if (error) return formatError(response.status, error);
    return formatSuccess(data);
  });

  server.registerTool('delete_glossary_entry', {
    description: 'Remove a glossary entry',
    inputSchema: {
      id: z.string().uuid().describe('Project UUID'),
      entryId: z.string().uuid().describe('Glossary entry UUID'),
    },
  }, async ({ id, entryId }) => {
    const { data, error, response } = await client.DELETE('/api/projects/{id}/glossary/{entryId}', {
      params: { path: { id, entryId } },
    });
    if (error) return formatError(response.status, error);
    return formatSuccess(data ?? { deleted: true });
  });
}
