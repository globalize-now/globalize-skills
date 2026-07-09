import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "@globalize-now/cli-client";
import {
  listProjects,
  createProject,
  updateProject,
  getProject,
  deleteProject,
  getProjectRefs,
  listProjectScorecards,
  getProjectBudget,
  rotateWebhookSecret,
} from "@globalize-now/cli-client";
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
    "update_project",
    {
      description: "Update a project's name, languages, or config",
      inputSchema: {
        id: z.string().uuid().describe("Project UUID"),
        name: z.string().optional().describe("New project name"),
        sourceLanguage: z.string().uuid().optional().describe("New source language UUID"),
        targetLanguages: z.array(z.string().uuid()).optional().describe("New target language UUIDs"),
        config: z
          .object({
            qa: z
              .object({
                enabledChecks: z.array(z.enum(["placeholder", "length", "terminology", "formatting"])).optional(),
                lengthRatioBounds: z.record(z.object({ min: z.number(), max: z.number() })).optional(),
                aiReviewScope: z.enum(["enabled", "disabled"]).optional(),
              })
              .optional(),
            defaultProvider: z.string().optional(),
            providerOverrides: z.record(z.string()).optional(),
            deeplFormality: z.record(z.string()).optional(),
            github: z
              .object({
                prTranslations: z.boolean().optional(),
                ignoreDraftPrs: z.boolean().optional(),
              })
              .optional(),
            gitlab: z
              .object({
                mrTranslations: z.boolean().optional(),
                ignoreDraftMrs: z.boolean().optional(),
              })
              .optional(),
            notifications: z
              .object({
                webhookUrl: z.string().optional(),
                webhookSecret: z.string().optional(),
                emailRecipients: z.array(z.string()).optional(),
                enabledEvents: z.array(z.enum(["job_failed", "qa_issues", "delivery_failed", "job_completed"])).optional(),
              })
              .optional(),
          })
          .optional()
          .describe("Project configuration"),
      },
    },
    async ({ id, ...updates }) => {
      try {
        return formatSuccess(await updateProject(client, id, updates));
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

  server.registerTool(
    "get_project_refs",
    {
      description: "List refs (branches) tracked by a project",
      inputSchema: {
        id: z.string().uuid().describe("Project UUID"),
      },
    },
    async ({ id }) => {
      try {
        return formatSuccess(await getProjectRefs(client, id));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "list_project_scorecards",
    {
      description: "Get project scorecards for the dashboard",
      inputSchema: {
        limit: z.number().int().optional().describe("Maximum number of scorecards"),
      },
    },
    async ({ limit }) => {
      try {
        return formatSuccess(await listProjectScorecards(client, limit));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "get_project_budget",
    {
      description: "Get a project's budget",
      inputSchema: {
        id: z.string().uuid().describe("Project UUID"),
      },
    },
    async ({ id }) => {
      try {
        return formatSuccess(await getProjectBudget(client, id));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "rotate_webhook_secret",
    {
      description: "Rotate a project's webhook signing secret",
      inputSchema: {
        id: z.string().uuid().describe("Project UUID"),
      },
    },
    async ({ id }) => {
      try {
        return formatSuccess(await rotateWebhookSecret(client, id));
      } catch (e) {
        return formatError(e);
      }
    },
  );
}
