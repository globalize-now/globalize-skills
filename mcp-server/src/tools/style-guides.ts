import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "@globalize-now/cli-client";
import {
  listStyleGuides,
  upsertStyleGuide,
  deleteStyleGuide,
  generateStyleGuide,
  applyStyleGuide,
  getStyleGuideQuota,
} from "@globalize-now/cli-client";
import { formatSuccess, formatError } from "../helpers.js";

export function registerStyleGuideTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "list_style_guides",
    {
      description: "List style guides for a project",
      inputSchema: {
        id: z.string().uuid().describe("Project UUID"),
      },
    },
    async ({ id }) => {
      try {
        return formatSuccess(await listStyleGuides(client, id));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "upsert_style_guide",
    {
      description: "Create or update translation style instructions for a specific language in a project",
      inputSchema: {
        id: z.string().uuid().describe("Project UUID"),
        projectLanguageId: z.string().uuid().describe("Project language UUID"),
        instructions: z.string().describe("Style guide instructions text"),
      },
    },
    async ({ id, projectLanguageId, instructions }) => {
      try {
        return formatSuccess(await upsertStyleGuide(client, id, projectLanguageId, instructions));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "delete_style_guide",
    {
      description: "Remove a style guide from a project language",
      inputSchema: {
        id: z.string().uuid().describe("Project UUID"),
        projectLanguageId: z.string().uuid().describe("Project language UUID"),
      },
    },
    async ({ id, projectLanguageId }) => {
      try {
        return formatSuccess(await deleteStyleGuide(client, id, projectLanguageId));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "generate_style_guide",
    {
      description: "Generate a style-guide draft for a target language",
      inputSchema: {
        id: z.string().uuid().describe("Project UUID"),
        projectLanguageId: z.string().uuid().describe("Project language UUID"),
      },
    },
    async ({ id, projectLanguageId }) => {
      try {
        return formatSuccess(await generateStyleGuide(client, id, projectLanguageId));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "apply_style_guide",
    {
      description: "Apply a generated style-guide draft to a project language",
      inputSchema: {
        id: z.string().uuid().describe("Project UUID"),
        projectLanguageId: z.string().uuid().describe("Project language UUID"),
        generationId: z.string().uuid().describe("Generation UUID from a prior generate call"),
        instructions: z.string().describe("Style guide instructions text"),
        context: z.string().optional().describe("Optional additional context"),
        invalidateTm: z.boolean().optional().describe("Invalidate translation memory for this language"),
      },
    },
    async ({ id, projectLanguageId, generationId, instructions, context, invalidateTm }) => {
      try {
        return formatSuccess(
          await applyStyleGuide(client, id, projectLanguageId, { generationId, instructions, context, invalidateTm }),
        );
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "get_style_guide_quota",
    {
      description: "Get per-language style-guide generation quota for a project",
      inputSchema: {
        id: z.string().uuid().describe("Project UUID"),
      },
    },
    async ({ id }) => {
      try {
        return formatSuccess(await getStyleGuideQuota(client, id));
      } catch (e) {
        return formatError(e);
      }
    },
  );
}
