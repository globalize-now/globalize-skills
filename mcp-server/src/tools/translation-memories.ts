import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "@globalize-now/cli-client";
import {
  listTranslationMemories,
  createTranslationMemory,
  getTranslationMemory,
  renameTranslationMemory,
  deleteTranslationMemory,
  listTranslationMemoryEntries,
  deleteTranslationMemoryEntryById,
  clearTranslationMemory,
  countTranslationMemoryEntries,
  freshCountTranslationMemoryEntries,
} from "@globalize-now/cli-client";
import { formatSuccess, formatError } from "../helpers.js";

export function registerTranslationMemoriesTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "list_translation_memories",
    {
      description: "List the organisation's translation memories with entry and attached-project counts",
      inputSchema: {},
    },
    async () => {
      try {
        return formatSuccess(await listTranslationMemories(client));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "create_translation_memory",
    {
      description: "Create a translation memory that projects can be attached to",
      inputSchema: {
        name: z.string().describe("Translation memory name"),
      },
    },
    async ({ name }) => {
      try {
        return formatSuccess(await createTranslationMemory(client, name));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "get_translation_memory",
    {
      description: "Get a translation memory with its attached projects and its source and target locales",
      inputSchema: {
        id: z.string().uuid().describe("Translation memory UUID"),
      },
    },
    async ({ id }) => {
      try {
        return formatSuccess(await getTranslationMemory(client, id));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "rename_translation_memory",
    {
      description: "Rename a translation memory. Every attached project sees the new name",
      inputSchema: {
        id: z.string().uuid().describe("Translation memory UUID"),
        name: z.string().describe("New name"),
      },
    },
    async ({ id, name }) => {
      try {
        return formatSuccess(await renameTranslationMemory(client, id, name));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "delete_translation_memory",
    {
      description:
        "Delete a translation memory and every entry it holds. Only a memory with no attached projects can be deleted",
      inputSchema: {
        id: z.string().uuid().describe("Translation memory UUID"),
      },
    },
    async ({ id }) => {
      try {
        return formatSuccess(await deleteTranslationMemory(client, id));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "list_translation_memory_entries",
    {
      description: "Search the entries of a translation memory",
      inputSchema: {
        id: z.string().uuid().describe("Translation memory UUID"),
        q: z.string().optional().describe("Free-text search query"),
        sourceLocale: z.string().optional().describe("Source locale (BCP 47)"),
        targetLocale: z.string().optional().describe("Target locale (BCP 47)"),
        limit: z.number().int().optional().describe("Maximum number of entries to return"),
        cursor: z.string().optional().describe("Pagination cursor"),
      },
    },
    async ({ id, q, sourceLocale, targetLocale, limit, cursor }) => {
      try {
        return formatSuccess(
          await listTranslationMemoryEntries(client, id, { q, sourceLocale, targetLocale, limit, cursor }),
        );
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "delete_translation_memory_entry_by_id",
    {
      description: "Delete one entry from a translation memory. Every project attached to the memory stops matching it",
      inputSchema: {
        id: z.string().uuid().describe("Translation memory UUID"),
        entryId: z.string().uuid().describe("Translation memory entry UUID"),
      },
    },
    async ({ id, entryId }) => {
      try {
        return formatSuccess(await deleteTranslationMemoryEntryById(client, id, entryId));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "clear_translation_memory",
    {
      description:
        "Clear a translation memory, optionally only one target locale. Clears the shared memory, including entries other attached projects contributed",
      inputSchema: {
        id: z.string().uuid().describe("Translation memory UUID"),
        targetLocale: z.string().optional().describe("Only clear entries for this target locale (BCP 47)"),
      },
    },
    async ({ id, targetLocale }) => {
      try {
        return formatSuccess(await clearTranslationMemory(client, id, { targetLocale }));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "count_translation_memory_entries",
    {
      description: "Count the entries of a translation memory (fresh + stale)",
      inputSchema: {
        id: z.string().uuid().describe("Translation memory UUID"),
        targetLocale: z.string().optional().describe("Target locale (BCP 47)"),
      },
    },
    async ({ id, targetLocale }) => {
      try {
        return formatSuccess(await countTranslationMemoryEntries(client, id, { targetLocale }));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "fresh_count_translation_memory_entries",
    {
      description: "Count the fresh entries of a translation memory for a target locale",
      inputSchema: {
        id: z.string().uuid().describe("Translation memory UUID"),
        targetLocale: z.string().describe("Target locale (BCP 47)"),
      },
    },
    async ({ id, targetLocale }) => {
      try {
        return formatSuccess(await freshCountTranslationMemoryEntries(client, id, { targetLocale }));
      } catch (e) {
        return formatError(e);
      }
    },
  );
}
