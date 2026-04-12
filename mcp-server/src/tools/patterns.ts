import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "@globalize-now/cli-client";
import {
  listPatterns,
  createPattern,
  updatePattern,
  deletePattern,
  reorderPattern,
} from "@globalize-now/cli-client";
import { formatSuccess, formatError } from "../helpers.js";

export function registerPatternTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "list_patterns",
    {
      description: "List locale path patterns for a repository",
      inputSchema: {
        repositoryId: z.string().uuid().describe("Repository UUID"),
      },
    },
    async ({ repositoryId }) => {
      try {
        return formatSuccess(await listPatterns(client, repositoryId));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "create_pattern",
    {
      description: "Add a locale path pattern to a repository",
      inputSchema: {
        repositoryId: z.string().uuid().describe("Repository UUID"),
        pattern: z.string().describe("Locale path pattern (e.g. locales/{locale}/*.json)"),
        fileFormat: z
          .enum(["json-flat", "json-nested", "xliff", "xliff-2", "xliff-1.2", "yaml", "po"])
          .describe("File format"),
        position: z.number().int().min(0).optional().describe("Position in the pattern list"),
      },
    },
    async ({ repositoryId, pattern, fileFormat, position }) => {
      try {
        return formatSuccess(await createPattern(client, repositoryId, pattern, fileFormat, position));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "update_pattern",
    {
      description: "Update a locale path pattern",
      inputSchema: {
        repositoryId: z.string().uuid().describe("Repository UUID"),
        patternId: z.string().uuid().describe("Pattern UUID"),
        pattern: z.string().optional().describe("Locale path pattern"),
        fileFormat: z
          .enum(["json-flat", "json-nested", "xliff", "xliff-2", "xliff-1.2", "yaml", "po"])
          .optional()
          .describe("File format"),
      },
    },
    async ({ repositoryId, patternId, pattern, fileFormat }) => {
      try {
        return formatSuccess(await updatePattern(client, repositoryId, patternId, { pattern, fileFormat }));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "delete_pattern",
    {
      description: "Remove a locale path pattern from a repository",
      inputSchema: {
        repositoryId: z.string().uuid().describe("Repository UUID"),
        patternId: z.string().uuid().describe("Pattern UUID"),
      },
    },
    async ({ repositoryId, patternId }) => {
      try {
        return formatSuccess(await deletePattern(client, repositoryId, patternId));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "reorder_pattern",
    {
      description: "Move a pattern to a new position in the list",
      inputSchema: {
        repositoryId: z.string().uuid().describe("Repository UUID"),
        patternId: z.string().uuid().describe("Pattern UUID"),
        position: z.number().int().min(0).describe("New position (0-based)"),
      },
    },
    async ({ repositoryId, patternId, position }) => {
      try {
        return formatSuccess(await reorderPattern(client, repositoryId, patternId, position));
      } catch (e) {
        return formatError(e);
      }
    },
  );
}
