import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "@globalize-now/cli-client";
import { listNamespaces, updateNamespace, deleteNamespace } from "@globalize-now/cli-client";
import { formatSuccess, formatError } from "../helpers.js";

export function registerNamespaceTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "list_namespaces",
    {
      description: "List namespaces for a project",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
      },
    },
    async ({ projectId }) => {
      try {
        return formatSuccess(await listNamespaces(client, projectId));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "update_namespace",
    {
      description: "Rename a namespace",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        namespaceId: z.string().uuid().describe("Namespace UUID"),
        name: z.string().describe("New namespace name"),
      },
    },
    async ({ projectId, namespaceId, name }) => {
      try {
        return formatSuccess(await updateNamespace(client, projectId, namespaceId, name));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "delete_namespace",
    {
      description: "Delete a namespace",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        namespaceId: z.string().uuid().describe("Namespace UUID"),
      },
    },
    async ({ projectId, namespaceId }) => {
      try {
        return formatSuccess(await deleteNamespace(client, projectId, namespaceId));
      } catch (e) {
        return formatError(e);
      }
    },
  );
}
