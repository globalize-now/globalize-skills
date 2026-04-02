import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "@globalize-now/cli-client";
import { listMembers, inviteMember, removeMember } from "@globalize-now/cli-client";
import { formatSuccess, formatError } from "../helpers.js";

export function registerMemberTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "list_members",
    {
      description: "List members of an organisation",
      inputSchema: {
        orgId: z.string().uuid().describe("Organisation UUID"),
      },
    },
    async ({ orgId }) => {
      try {
        return formatSuccess(await listMembers(client, orgId));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "invite_member",
    {
      description: "Invite a user to an organisation by their user ID",
      inputSchema: {
        orgId: z.string().uuid().describe("Organisation UUID"),
        clerkUserId: z.string().describe("Clerk user ID of the person to invite"),
        role: z.enum(["admin", "member"]).optional().describe("Role (defaults to member)"),
      },
    },
    async ({ orgId, clerkUserId, role }) => {
      try {
        return formatSuccess(await inviteMember(client, orgId, clerkUserId, role));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "remove_member",
    {
      description: "Remove a member from an organisation",
      inputSchema: {
        orgId: z.string().uuid().describe("Organisation UUID"),
        membershipId: z.string().uuid().describe("Membership UUID"),
      },
    },
    async ({ orgId, membershipId }) => {
      try {
        return formatSuccess(await removeMember(client, orgId, membershipId));
      } catch (e) {
        return formatError(e);
      }
    },
  );
}
