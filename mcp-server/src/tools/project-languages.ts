import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "@globalize-now/cli-client";
import { listProjectLanguages, addProjectLanguage, removeProjectLanguage } from "@globalize-now/cli-client";
import { formatSuccess, formatError } from "../helpers.js";

export function registerProjectLanguageTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "list_project_languages",
    {
      description: "List languages configured on a project",
      inputSchema: {
        id: z.string().uuid().describe("Project UUID"),
      },
    },
    async ({ id }) => {
      try {
        return formatSuccess(await listProjectLanguages(client, id));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "add_project_language",
    {
      description:
        "Add a language to a project. Provide name (display name), locale (BCP-47 code), and optionally a languageId from the global catalog.",
      inputSchema: {
        id: z.string().uuid().describe("Project UUID"),
        name: z.string().describe('Display name for the language (e.g. "French")'),
        locale: z.string().describe('BCP-47 locale code (e.g. "fr")'),
        languageId: z.string().uuid().optional().describe("Language UUID from the global catalog"),
      },
    },
    async ({ id, name, locale, languageId }) => {
      try {
        return formatSuccess(await addProjectLanguage(client, id, name, locale, languageId));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "remove_project_language",
    {
      description: "Remove a language from a project",
      inputSchema: {
        id: z.string().uuid().describe("Project UUID"),
        languageId: z.string().uuid().describe("Project language UUID"),
      },
    },
    async ({ id, languageId }) => {
      try {
        return formatSuccess(await removeProjectLanguage(client, id, languageId));
      } catch (e) {
        return formatError(e);
      }
    },
  );
}
