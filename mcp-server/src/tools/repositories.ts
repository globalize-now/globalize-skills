import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "@globalize-now/cli-client";
import {
  listRepositories,
  createRepository,
  updateRepository,
  deleteRepository,
  detectRepository,
  listRepositoryBranches,
} from "@globalize-now/cli-client";
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
        patterns: z
          .array(
            z.object({
              pattern: z.string().describe("Locale path pattern (e.g. locales/{locale}/*.json)"),
              fileFormat: z
                .enum(["json-flat", "json-nested", "xliff", "xliff-2", "xliff-1.2", "yaml", "po"])
                .describe("File format"),
            }),
          )
          .optional()
          .describe("Locale path patterns with file formats"),
        githubInstallationId: z.string().uuid().optional().describe("GitHub App installation UUID (from github installations)"),
        gitlabConnectionId: z.string().uuid().optional().describe("GitLab connection UUID (from gitlab connections)"),
        importMode: z.enum(["ignore", "reviewed", "translated"]).optional().describe("How to import existing translations (default: ignore)"),
        importScope: z.enum(["new_keys_only", "all_keys"]).optional().describe("Which keys to import (default: new_keys_only)"),
      },
    },
    async ({ projectId, gitUrl, provider, branches, patterns, githubInstallationId, gitlabConnectionId, importMode, importScope }) => {
      try {
        return formatSuccess(
          await createRepository(client, {
            projectId,
            gitUrl,
            provider,
            branches,
            patterns,
            githubInstallationId,
            gitlabConnectionId,
            importMode,
            importScope,
          }),
        );
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "update_repository",
    {
      description: "Update a connected repository's settings",
      inputSchema: {
        id: z.string().uuid().describe("Repository UUID"),
        gitUrl: z.string().optional().describe("Git repository URL"),
        branches: z.array(z.string()).optional().describe("Branches to track"),
        githubInstallationId: z.string().uuid().optional().describe("GitHub App installation UUID"),
        gitlabConnectionId: z.string().uuid().optional().describe("GitLab connection UUID"),
        provider: z.enum(["github", "gitlab"]).optional().describe("Git provider"),
        importMode: z.enum(["ignore", "reviewed", "translated"]).optional().describe("Import mode"),
        importScope: z.enum(["new_keys_only", "all_keys"]).optional().describe("Import scope"),
        detectedFramework: z.string().nullable().optional().describe("Detected framework"),
      },
    },
    async ({ id, ...updates }) => {
      try {
        return formatSuccess(await updateRepository(client, id, updates));
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

  server.registerTool(
    "list_repository_branches",
    {
      description: "List branches from the connected provider for a repository",
      inputSchema: {
        id: z.string().uuid().describe("Repository UUID"),
      },
    },
    async ({ id }) => {
      try {
        return formatSuccess(await listRepositoryBranches(client, id));
      } catch (e) {
        return formatError(e);
      }
    },
  );
}
