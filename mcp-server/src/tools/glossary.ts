import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "@globalize-now/cli-client";
import {
  listGlossary,
  createGlossaryEntry,
  deleteGlossaryEntry,
  bulkCreateGlossaryEntries,
  previewGlossaryImport,
} from "@globalize-now/cli-client";
import { formatSuccess, formatError } from "../helpers.js";

export function registerGlossaryTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "list_glossary",
    {
      description: "List glossary entries for a project",
      inputSchema: {
        id: z.string().uuid().describe("Project UUID"),
      },
    },
    async ({ id }) => {
      try {
        return formatSuccess(await listGlossary(client, id));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "create_glossary_entry",
    {
      description: "Add a glossary term pair (source term and target translation)",
      inputSchema: {
        id: z.string().uuid().describe("Project UUID"),
        sourceTerm: z.string().describe("Source language term"),
        targetTerm: z.string().describe("Target language translation"),
        sourceProjectLanguageId: z.string().uuid().describe("Source project language UUID"),
        targetProjectLanguageId: z.string().uuid().describe("Target project language UUID"),
        doNotTranslate: z
          .boolean()
          .optional()
          .describe("Keep the source term verbatim in translations instead of translating it"),
      },
    },
    async ({ id, sourceTerm, targetTerm, sourceProjectLanguageId, targetProjectLanguageId, doNotTranslate }) => {
      try {
        return formatSuccess(
          await createGlossaryEntry(
            client,
            id,
            sourceTerm,
            targetTerm,
            sourceProjectLanguageId,
            targetProjectLanguageId,
            doNotTranslate,
          ),
        );
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "bulk_create_glossary_entries",
    {
      description:
        "Upsert many glossary entries in one transaction, each with its own language pair. Max 10000 entries",
      inputSchema: {
        id: z.string().uuid().describe("Project UUID"),
        entries: z
          .array(
            z.object({
              sourceTerm: z.string().min(1).describe("Source language term"),
              targetTerm: z.string().describe("Target language translation"),
              sourceProjectLanguageId: z.string().uuid().describe("Source project language UUID"),
              targetProjectLanguageId: z.string().uuid().describe("Target project language UUID"),
              doNotTranslate: z.boolean().optional().describe("Keep the source term verbatim"),
            }),
          )
          .min(1)
          .max(10000)
          .describe("Glossary entries to upsert"),
      },
    },
    async ({ id, entries }) => {
      try {
        return formatSuccess(await bulkCreateGlossaryEntries(client, id, entries));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "preview_glossary_import",
    {
      description:
        "Preview a bulk glossary import: how many supplied keys would be created and how many updated. Writes nothing",
      inputSchema: {
        id: z.string().uuid().describe("Project UUID"),
        keys: z
          .array(
            z.object({
              sourceTerm: z.string().min(1).describe("Source language term"),
              sourceProjectLanguageId: z.string().uuid().describe("Source project language UUID"),
              targetProjectLanguageId: z.string().uuid().describe("Target project language UUID"),
            }),
          )
          .min(1)
          .max(10000)
          .describe("Glossary keys to check"),
      },
    },
    async ({ id, keys }) => {
      try {
        return formatSuccess(await previewGlossaryImport(client, id, keys));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "delete_glossary_entry",
    {
      description: "Remove a glossary entry",
      inputSchema: {
        id: z.string().uuid().describe("Project UUID"),
        entryId: z.string().uuid().describe("Glossary entry UUID"),
      },
    },
    async ({ id, entryId }) => {
      try {
        return formatSuccess(await deleteGlossaryEntry(client, id, entryId));
      } catch (e) {
        return formatError(e);
      }
    },
  );
}
