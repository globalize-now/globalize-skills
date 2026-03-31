import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../client.js';
import { formatError, formatSuccess } from '../client.js';

export function registerMemberTools(server: McpServer, client: ApiClient) {
  server.registerTool('list_members', {
    description: 'List members of an organisation',
    inputSchema: {
      orgId: z.string().uuid().describe('Organisation UUID'),
    },
  }, async ({ orgId }) => {
    const { data, error, response } = await client.GET('/api/orgs/{orgId}/members', {
      params: { path: { orgId } },
    });
    if (error) return formatError(response.status, error);
    return formatSuccess(data);
  });

  server.registerTool('invite_member', {
    description: 'Invite a user to an organisation by their user ID',
    inputSchema: {
      orgId: z.string().uuid().describe('Organisation UUID'),
      userId: z.string().describe('Clerk user ID of the person to invite'),
    },
  }, async ({ orgId, userId }) => {
    const { data, error, response } = await client.POST('/api/orgs/{orgId}/members', {
      params: { path: { orgId } },
      body: { userId },
    });
    if (error) return formatError(response.status, error);
    return formatSuccess(data);
  });

  server.registerTool('remove_member', {
    description: 'Remove a member from an organisation',
    inputSchema: {
      orgId: z.string().uuid().describe('Organisation UUID'),
      membershipId: z.string().uuid().describe('Membership UUID'),
    },
  }, async ({ orgId, membershipId }) => {
    const { data, error, response } = await client.DELETE('/api/orgs/{orgId}/members/{membershipId}', {
      params: { path: { orgId, membershipId } },
    });
    if (error) return formatError(response.status, error);
    return formatSuccess(data ?? { removed: true });
  });
}
