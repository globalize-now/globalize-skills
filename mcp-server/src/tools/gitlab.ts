import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "@globalize-now/cli-client";
import {
  startGitlabInstall,
  pollGitlabInstallStatus,
  listGitlabConnections,
  deleteGitlabConnection,
  listGitlabProjects,
  listGitlabProjectBranches,
  detectGitlabProject,
} from "@globalize-now/cli-client";
import { formatSuccess, formatError } from "../helpers.js";

export function registerGitlabTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "gitlab_install",
    {
      description: "Initiate GitLab OAuth connection. Returns an installUrl to open in the browser and a nonce to poll for completion.",
      inputSchema: {},
    },
    async () => {
      try {
        return formatSuccess(await startGitlabInstall(client));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "gitlab_install_status",
    {
      description: "Poll the status of a GitLab OAuth connection. Returns status: pending, completed (with connectionId), or expired.",
      inputSchema: {
        nonce: z.string().describe("Nonce from gitlab_install"),
      },
    },
    async ({ nonce }) => {
      try {
        return formatSuccess(await pollGitlabInstallStatus(client, nonce));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "list_gitlab_connections",
    {
      description: "List GitLab connections for the current organisation",
      inputSchema: {},
    },
    async () => {
      try {
        return formatSuccess(await listGitlabConnections(client));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "delete_gitlab_connection",
    {
      description: "Delete a GitLab connection",
      inputSchema: {
        id: z.string().uuid().describe("GitLab connection UUID"),
      },
    },
    async ({ id }) => {
      try {
        return formatSuccess(await deleteGitlabConnection(client, id));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "list_gitlab_projects",
    {
      description: "List GitLab projects accessible through a connection",
      inputSchema: {
        connectionId: z.string().uuid().describe("GitLab connection UUID"),
      },
    },
    async ({ connectionId }) => {
      try {
        return formatSuccess(await listGitlabProjects(client, connectionId));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "list_gitlab_project_branches",
    {
      description: "List branches for a GitLab project",
      inputSchema: {
        connectionId: z.string().uuid().describe("GitLab connection UUID"),
        projectId: z.number().int().describe("GitLab project ID (numeric)"),
      },
    },
    async ({ connectionId, projectId }) => {
      try {
        return formatSuccess(await listGitlabProjectBranches(client, connectionId, projectId));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "detect_gitlab_project",
    {
      description: "Detect i18n structure in a GitLab project",
      inputSchema: {
        connectionId: z.string().uuid().describe("GitLab connection UUID"),
        projectId: z.number().int().describe("GitLab project ID (numeric)"),
      },
    },
    async ({ connectionId, projectId }) => {
      try {
        return formatSuccess(await detectGitlabProject(client, connectionId, projectId));
      } catch (e) {
        return formatError(e);
      }
    },
  );
}
