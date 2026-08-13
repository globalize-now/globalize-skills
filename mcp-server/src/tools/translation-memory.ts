import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "@globalize-now/cli-client";
import {
  PROJECT_TM_DEPRECATION,
  listTranslationMemory,
  deleteTranslationMemoryEntry,
  countTranslationMemory,
  freshCountTranslationMemory,
} from "@globalize-now/cli-client";
import { formatSuccess, formatError } from "../helpers.js";

/**
 * Project-addressed translation memory tools, kept working for callers that
 * still hold a project ID. The cli-client resolves the project to its org-level
 * memory and calls the current `/api/translation-memories/**` routes, so these
 * do not depend on the deprecated project-scoped endpoints. Each result carries
 * the deprecation notice next to the payload, and the tool descriptions name the
 * replacement so an agent picks the right tool in the first place.
 */
function deprecated(replacement: string, result: unknown) {
  return formatSuccess({ deprecation: `${PROJECT_TM_DEPRECATION} Replacement tool: ${replacement}.`, result });
}

export function registerTranslationMemoryTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "list_translation_memory",
    {
      description:
        "DEPRECATED — use list_translation_memory_entries with the project's translationMemory.id (from get_project). Search translation memory entries for a project",
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
        return deprecated(
          "list_translation_memory_entries",
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
      description:
        "DEPRECATED — use delete_translation_memory_entry_by_id with the project's translationMemory.id (from get_project). Delete a translation memory entry",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        entryId: z.string().uuid().describe("Translation memory entry UUID"),
      },
    },
    async ({ projectId, entryId }) => {
      try {
        return deprecated(
          "delete_translation_memory_entry_by_id",
          await deleteTranslationMemoryEntry(client, projectId, entryId),
        );
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "count_translation_memory",
    {
      description:
        "DEPRECATED — use count_translation_memory_entries with the project's translationMemory.id (from get_project). Count translation memory entries (fresh + stale)",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        targetProjectLanguageId: z.string().uuid().optional().describe("Target project language UUID"),
      },
    },
    async ({ projectId, targetProjectLanguageId }) => {
      try {
        return deprecated(
          "count_translation_memory_entries",
          await countTranslationMemory(client, projectId, { targetProjectLanguageId }),
        );
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "fresh_count_translation_memory",
    {
      description:
        "DEPRECATED — use fresh_count_translation_memory_entries with the project's translationMemory.id (from get_project). Count fresh translation memory entries for a target language",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        targetProjectLanguageId: z.string().uuid().describe("Target project language UUID"),
      },
    },
    async ({ projectId, targetProjectLanguageId }) => {
      try {
        return deprecated(
          "fresh_count_translation_memory_entries",
          await freshCountTranslationMemory(client, projectId, { targetProjectLanguageId }),
        );
      } catch (e) {
        return formatError(e);
      }
    },
  );
}
