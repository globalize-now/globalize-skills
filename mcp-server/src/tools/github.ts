import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "@globalize-now/cli-client";
import {
  startGithubInstall,
  pollGithubInstallStatus,
  listGithubInstallations,
  listGithubRepos,
  listGithubBranches,
  detectGithubRepo,
} from "@globalize-now/cli-client";
import { formatSuccess, formatError } from "../helpers.js";

export function registerGithubTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "github_install",
    {
      description:
        "Initiate GitHub App installation. Returns an installUrl to open in the browser and a nonce to poll for completion.",
      inputSchema: {},
    },
    async () => {
      try {
        return formatSuccess(await startGithubInstall(client));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "github_install_status",
    {
      description:
        "Poll the status of a GitHub App installation. Returns status: pending, completed, or expired.",
      inputSchema: {
        nonce: z.string().describe("Nonce from github_install"),
      },
    },
    async ({ nonce }) => {
      try {
        return formatSuccess(await pollGithubInstallStatus(client, nonce));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "list_github_installations",
    {
      description: "List GitHub App installations",
      inputSchema: {},
    },
    async () => {
      try {
        return formatSuccess(await listGithubInstallations(client));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "list_github_repos",
    {
      description: "List repositories accessible through a GitHub App installation",
      inputSchema: {
        installationId: z.string().describe("GitHub installation ID"),
      },
    },
    async ({ installationId }) => {
      try {
        return formatSuccess(await listGithubRepos(client, installationId));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "list_github_branches",
    {
      description: "List branches for a GitHub repository",
      inputSchema: {
        installationId: z.string().describe("GitHub installation ID"),
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
      },
    },
    async ({ installationId, owner, repo }) => {
      try {
        return formatSuccess(await listGithubBranches(client, installationId, owner, repo));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "detect_github_repo",
    {
      description: "Detect i18n structure in a GitHub repository",
      inputSchema: {
        installationId: z.string().describe("GitHub installation ID"),
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
      },
    },
    async ({ installationId, owner, repo }) => {
      try {
        return formatSuccess(await detectGithubRepo(client, installationId, owner, repo));
      } catch (e) {
        return formatError(e);
      }
    },
  );
}
