import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "@globalize-now/cli-client";
import {
  listJobs,
  getJob,
  startJob,
  retryJob,
  getJobStats,
  getQaReport,
  dismissQa,
  undismissQa,
  exportJob,
  exportJobManifest,
  listJobUnits,
  getJobUnit,
  listJobFiles,
  redeliverJob,
} from "@globalize-now/cli-client";
import { formatSuccess, formatError } from "../helpers.js";

export function registerJobTools(server: McpServer, client: ApiClient) {
  server.registerTool(
    "list_jobs",
    {
      description: "List jobs, optionally filtered by project or status",
      inputSchema: {
        projectId: z.string().uuid().optional().describe("Filter by project UUID"),
        status: z.string().optional().describe("Filter by job status"),
        limit: z.number().int().optional().describe("Maximum number of results"),
        offset: z.number().int().optional().describe("Result offset"),
      },
    },
    async ({ projectId, status, limit, offset }) => {
      try {
        return formatSuccess(await listJobs(client, { projectId, status, limit, offset }));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "get_job",
    {
      description: "Get a single job",
      inputSchema: {
        id: z.string().uuid().describe("Job UUID"),
      },
    },
    async ({ id }) => {
      try {
        return formatSuccess(await getJob(client, id));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "start_job",
    {
      description: "Start a draft job",
      inputSchema: {
        id: z.string().uuid().describe("Job UUID"),
      },
    },
    async ({ id }) => {
      try {
        return formatSuccess(await startJob(client, id));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "retry_job",
    {
      description: "Retry a failed job",
      inputSchema: {
        id: z.string().uuid().describe("Job UUID"),
      },
    },
    async ({ id }) => {
      try {
        return formatSuccess(await retryJob(client, id));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "get_job_stats",
    {
      description: "Get progress statistics for a job",
      inputSchema: {
        id: z.string().uuid().describe("Job UUID"),
      },
    },
    async ({ id }) => {
      try {
        return formatSuccess(await getJobStats(client, id));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "get_qa_report",
    {
      description: "Get the QA report for a job",
      inputSchema: {
        id: z.string().uuid().describe("Job UUID"),
      },
    },
    async ({ id }) => {
      try {
        return formatSuccess(await getQaReport(client, id));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "dismiss_qa",
    {
      description: "Dismiss a QA finding on a translation unit",
      inputSchema: {
        id: z.string().uuid().describe("Job UUID"),
        unitId: z.string().uuid().describe("Translation unit UUID"),
        checkType: z.string().describe("QA check type"),
        reason: z
          .enum(["script-density", "intentional", "false-positive", "other"])
          .optional()
          .describe("Dismissal reason"),
        note: z.string().optional().describe("Optional dismissal note"),
      },
    },
    async ({ id, unitId, checkType, reason, note }) => {
      try {
        return formatSuccess(await dismissQa(client, id, { unitId, checkType, reason, note }));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "undismiss_qa",
    {
      description: "Un-dismiss a previously dismissed QA finding",
      inputSchema: {
        id: z.string().uuid().describe("Job UUID"),
        unitId: z.string().uuid().describe("Translation unit UUID"),
        checkType: z.string().describe("QA check type"),
      },
    },
    async ({ id, unitId, checkType }) => {
      try {
        return formatSuccess(await undismissQa(client, id, { unitId, checkType }));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "export_job",
    {
      description: "Export translated files for a job",
      inputSchema: {
        id: z.string().uuid().describe("Job UUID"),
        targetLang: z.string().optional().describe("Target language to export"),
        namespace: z.string().optional().describe("Namespace to export"),
        fileId: z.string().optional().describe("Specific file ID to export"),
      },
    },
    async ({ id, targetLang, namespace, fileId }) => {
      try {
        return formatSuccess(await exportJob(client, id, { targetLang, namespace, fileId }));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "export_job_manifest",
    {
      description: "List downloadable export files for a job",
      inputSchema: {
        id: z.string().uuid().describe("Job UUID"),
      },
    },
    async ({ id }) => {
      try {
        return formatSuccess(await exportJobManifest(client, id));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "list_job_units",
    {
      description: "List translation units for a job's target language",
      inputSchema: {
        jobId: z.string().uuid().describe("Job UUID"),
        targetProjectLanguageId: z.string().uuid().describe("Target project language UUID"),
        filter: z.enum(["new", "all"]).optional().describe("Unit filter"),
        search: z.string().optional().describe("Search text"),
        limit: z.number().int().optional().describe("Maximum number of results"),
        cursor: z.string().optional().describe("Pagination cursor"),
      },
    },
    async ({ jobId, targetProjectLanguageId, filter, search, limit, cursor }) => {
      try {
        return formatSuccess(
          await listJobUnits(client, jobId, { targetProjectLanguageId, filter, search, limit, cursor }),
        );
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "get_job_unit",
    {
      description: "Get a single translation unit",
      inputSchema: {
        jobId: z.string().uuid().describe("Job UUID"),
        unitId: z.string().uuid().describe("Translation unit UUID"),
      },
    },
    async ({ jobId, unitId }) => {
      try {
        return formatSuccess(await getJobUnit(client, jobId, unitId));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "list_job_files",
    {
      description: "List files for a job",
      inputSchema: {
        id: z.string().uuid().describe("Job UUID"),
        limit: z.number().int().optional().describe("Maximum number of results"),
        cursor: z.string().optional().describe("Pagination cursor"),
      },
    },
    async ({ id, limit, cursor }) => {
      try {
        return formatSuccess(await listJobFiles(client, id, { limit, cursor }));
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "redeliver_job",
    {
      description: "Re-deliver translations for a job",
      inputSchema: {
        id: z.string().uuid().describe("Job UUID"),
      },
    },
    async ({ id }) => {
      try {
        return formatSuccess(await redeliverJob(client, id));
      } catch (e) {
        return formatError(e);
      }
    },
  );
}
