import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "@globalize-now/cli-client";
import { listRepositories, createRepository, deleteRepository, detectRepository } from "@globalize-now/cli-client";
import { formatSuccess, formatError } from "../helpers.js";

export function registerRepositoryTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "list_repositories",
    {
      description: "List repositories connected to a project",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
      },
    },
    async ({ projectId }) => {
      try {
        return formatSuccess(await listRepositories(client, projectId));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "create_repository",
    {
      description: "Connect a git repository to a project for translation file syncing",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        gitUrl: z.string().describe("Git repository URL"),
        provider: z.enum(["github", "gitlab"]).describe("Git provider"),
        branches: z.array(z.string()).optional().describe('Branches to sync (defaults to ["main"])'),
        localePathPattern: z.string().optional().describe("Path pattern for locale files in the repo"),
      },
    },
    async ({ projectId, gitUrl, provider, branches, localePathPattern }) => {
      try {
        return formatSuccess(await createRepository(client, projectId, gitUrl, provider, branches, localePathPattern));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "delete_repository",
    {
      description: "Disconnect a repository",
      inputSchema: {
        id: z.string().uuid().describe("Repository UUID"),
      },
    },
    async ({ id }) => {
      try {
        return formatSuccess(await deleteRepository(client, id));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "detect_repository",
    {
      description: "Re-scan a repository to detect i18n files and structure",
      inputSchema: {
        id: z.string().uuid().describe("Repository UUID"),
      },
    },
    async ({ id }) => {
      try {
        return formatSuccess(await detectRepository(client, id));
      } catch (e) {
        return formatError(e);
      }
    },
  );
}
