import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "@globalize-now/cli-client";
import { listProjects, createProject, getProject, deleteProject } from "@globalize-now/cli-client";
import { formatSuccess, formatError } from "../helpers.js";

export function registerProjectTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "list_projects",
    {
      description: "List all translation projects",
      inputSchema: {},
    },
    async () => {
      try {
        return formatSuccess(await listProjects(client));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "create_project",
    {
      description: "Create a new translation project",
      inputSchema: {
        name: z.string().describe("Project name"),
        sourceLanguage: z.string().uuid().describe("Source language UUID"),
        targetLanguages: z.array(z.string().uuid()).describe("Target language UUIDs"),
      },
    },
    async ({ name, sourceLanguage, targetLanguages }) => {
      try {
        return formatSuccess(await createProject(client, name, sourceLanguage, targetLanguages));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "get_project",
    {
      description: "Get project details by ID",
      inputSchema: {
        id: z.string().uuid().describe("Project UUID"),
      },
    },
    async ({ id }) => {
      try {
        return formatSuccess(await getProject(client, id));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "delete_project",
    {
      description: "Delete a project by ID",
      inputSchema: {
        id: z.string().uuid().describe("Project UUID"),
      },
    },
    async ({ id }) => {
      try {
        return formatSuccess(await deleteProject(client, id));
      } catch (e) {
        return formatError(e);
      }
    },
  );
}
