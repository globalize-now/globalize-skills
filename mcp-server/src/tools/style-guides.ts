import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '@globalize-now/cli-client';
import { listStyleGuides, upsertStyleGuide, deleteStyleGuide } from '@globalize-now/cli-client';
import { formatSuccess, formatError } from '../helpers.js';

export function registerStyleGuideTools(server: McpServer, client: ApiClient) {
  server.registerTool('list_style_guides', {
    description: 'List style guides for a project',
    inputSchema: {
      id: z.string().uuid().describe('Project UUID'),
    },
  }, async ({ id }) => {
    try {
      return formatSuccess(await listStyleGuides(client, id));
    } catch (e) {
      return formatError(e);
    }
  });

  server.registerTool('upsert_style_guide', {
    description: 'Create or update translation style instructions for a specific language in a project',
    inputSchema: {
      id: z.string().uuid().describe('Project UUID'),
      projectLanguageId: z.string().uuid().describe('Project language UUID'),
      instructions: z.string().describe('Style guide instructions text'),
    },
  }, async ({ id, projectLanguageId, instructions }) => {
    try {
      return formatSuccess(await upsertStyleGuide(client, id, projectLanguageId, instructions));
    } catch (e) {
      return formatError(e);
    }
  });

  server.registerTool('delete_style_guide', {
    description: 'Remove a style guide from a project language',
    inputSchema: {
      id: z.string().uuid().describe('Project UUID'),
      projectLanguageId: z.string().uuid().describe('Project language UUID'),
    },
  }, async ({ id, projectLanguageId }) => {
    try {
      return formatSuccess(await deleteStyleGuide(client, id, projectLanguageId));
    } catch (e) {
      return formatError(e);
    }
  });
}
