import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "@globalize-now/cli-client";
import { getBalance, getLedger } from "@globalize-now/cli-client";
import { formatSuccess, formatError } from "../helpers.js";

export function registerBillingTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "get_balance",
    {
      description: "Get the organisation credit balance",
      inputSchema: {},
    },
    async () => {
      try {
        return formatSuccess(await getBalance(client));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "get_ledger",
    {
      description: "List credit ledger entries",
      inputSchema: {
        type: z
          .enum(["purchase", "grant", "usage", "refund", "adjustment", "subscription_grant", "subscription_expiry"])
          .optional()
          .describe("Filter by entry type"),
        grouped: z.enum(["true", "false"]).optional().describe("Group entries by job"),
        limit: z.number().int().optional().describe("Maximum number of entries to return"),
        cursor: z.string().optional().describe("Pagination cursor"),
      },
    },
    async ({ type, grouped, limit, cursor }) => {
      try {
        return formatSuccess(await getLedger(client, { type, grouped, limit, cursor }));
      } catch (e) {
        return formatError(e);
      }
    },
  );
}
