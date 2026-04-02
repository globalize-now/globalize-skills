import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '@globalize-now/cli-client';
import { listGlossary, createGlossaryEntry, deleteGlossaryEntry } from '@globalize-now/cli-client';
import { formatSuccess, formatError } from '../helpers.js';

export function registerGlossaryTools(server: McpServer, client: ApiClient) {
  server.registerTool('list_glossary', {
    description: 'List glossary entries for a project',
    inputSchema: {
      id: z.string().uuid().describe('Project UUID'),
    },
  }, async ({ id }) => {
    try {
      return formatSuccess(await listGlossary(client, id));
    } catch (e) {
      return formatError(e);
    }
  });

  server.registerTool('create_glossary_entry', {
    description: 'Add a glossary term pair (source term and target translation)',
    inputSchema: {
      id: z.string().uuid().describe('Project UUID'),
      sourceTerm: z.string().describe('Source language term'),
      targetTerm: z.string().describe('Target language translation'),
      sourceProjectLanguageId: z.string().uuid().describe('Source project language UUID'),
      targetProjectLanguageId: z.string().uuid().describe('Target project language UUID'),
    },
  }, async ({ id, sourceTerm, targetTerm, sourceProjectLanguageId, targetProjectLanguageId }) => {
    try {
      return formatSuccess(await createGlossaryEntry(client, id, sourceTerm, targetTerm, sourceProjectLanguageId, targetProjectLanguageId));
    } catch (e) {
      return formatError(e);
    }
  });

  server.registerTool('delete_glossary_entry', {
    description: 'Remove a glossary entry',
    inputSchema: {
      id: z.string().uuid().describe('Project UUID'),
      entryId: z.string().uuid().describe('Glossary entry UUID'),
    },
  }, async ({ id, entryId }) => {
    try {
      return formatSuccess(await deleteGlossaryEntry(client, id, entryId));
    } catch (e) {
      return formatError(e);
    }
  });
}
