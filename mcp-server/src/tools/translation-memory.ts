import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "@globalize-now/cli-client";
import {
  listTranslationMemory,
  deleteTranslationMemoryEntry,
  countTranslationMemory,
  freshCountTranslationMemory,
} from "@globalize-now/cli-client";
import { formatSuccess, formatError } from "../helpers.js";

export function registerTranslationMemoryTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "list_translation_memory",
    {
      description: "Search translation memory entries for a project",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        q: z.string().optional().describe("Free-text search query"),
        sourceProjectLanguageId: z.string().uuid().optional().describe("Source project language UUID"),
        targetProjectLanguageId: z.string().uuid().optional().describe("Target project language UUID"),
        limit: z.number().int().optional().describe("Maximum number of entries to return"),
        cursor: z.string().optional().describe("Pagination cursor"),
      },
    },
    async ({ projectId, q, sourceProjectLanguageId, targetProjectLanguageId, limit, cursor }) => {
      try {
        return formatSuccess(
          await listTranslationMemory(client, projectId, {
            q,
            sourceProjectLanguageId,
            targetProjectLanguageId,
            limit,
            cursor,
          }),
        );
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "delete_translation_memory_entry",
    {
      description: "Delete a translation memory entry",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        entryId: z.string().uuid().describe("Translation memory entry UUID"),
      },
    },
    async ({ projectId, entryId }) => {
      try {
        return formatSuccess(await deleteTranslationMemoryEntry(client, projectId, entryId));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "count_translation_memory",
    {
      description: "Count translation memory entries (fresh + stale)",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        targetProjectLanguageId: z.string().uuid().optional().describe("Target project language UUID"),
      },
    },
    async ({ projectId, targetProjectLanguageId }) => {
      try {
        return formatSuccess(await countTranslationMemory(client, projectId, { targetProjectLanguageId }));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "fresh_count_translation_memory",
    {
      description: "Count fresh translation memory entries for a target language",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        targetProjectLanguageId: z.string().uuid().describe("Target project language UUID"),
      },
    },
    async ({ projectId, targetProjectLanguageId }) => {
      try {
        return formatSuccess(await freshCountTranslationMemory(client, projectId, { targetProjectLanguageId }));
      } catch (e) {
        return formatError(e);
      }
    },
  );
}
