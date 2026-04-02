import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "@globalize-now/cli-client";
import { listLanguages, getLanguage } from "@globalize-now/cli-client";
import { formatSuccess, formatError } from "../helpers.js";

export function registerLanguageTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "list_languages",
    {
      description:
        "Search and list available languages from the global catalog. Use to find language UUIDs for project setup.",
      inputSchema: {},
    },
    async () => {
      try {
        return formatSuccess(await listLanguages(client));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "get_language",
    {
      description: "Get details for a specific language by ID",
      inputSchema: {
        id: z.string().uuid().describe("Language UUID"),
      },
    },
    async ({ id }) => {
      try {
        return formatSuccess(await getLanguage(client, id));
      } catch (e) {
        return formatError(e);
      }
    },
  );
}
