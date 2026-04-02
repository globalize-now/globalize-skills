import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "@globalize-now/cli-client";
import { listOrgs, createOrg, deleteOrg } from "@globalize-now/cli-client";
import { formatSuccess, formatError } from "../helpers.js";

export function registerOrgTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "list_orgs",
    {
      description: "List all organisations the authenticated user belongs to",
      inputSchema: {},
    },
    async () => {
      try {
        return formatSuccess(await listOrgs(client));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "create_org",
    {
      description: "Create a new organisation",
      inputSchema: {
        name: z.string().describe("Organisation name"),
      },
    },
    async ({ name }) => {
      try {
        return formatSuccess(await createOrg(client, name));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "delete_org",
    {
      description: "Delete an organisation by ID",
      inputSchema: {
        orgId: z.string().uuid().describe("Organisation UUID"),
      },
    },
    async ({ orgId }) => {
      try {
        return formatSuccess(await deleteOrg(client, orgId));
      } catch (e) {
        return formatError(e);
      }
    },
  );
}
