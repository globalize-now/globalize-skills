import { Command, Option } from "commander";
import type { ApiClient } from "../client.js";
import { extractError } from "../client.js";
import { output, outputError, type OutputOptions } from "../format.js";
import type { paths } from "../api-types.js";

type ListJobsQuery = NonNullable<paths["/api/jobs"]["get"]["parameters"]["query"]>;
type ListUnitsQuery = paths["/api/jobs/{jobId}/units"]["get"]["parameters"]["query"];
type ListFilesQuery = NonNullable<paths["/api/jobs/{id}/files"]["get"]["parameters"]["query"]>;
type ExportQuery = NonNullable<paths["/api/jobs/{id}/export"]["get"]["parameters"]["query"]>;
type QaDismissBody = paths["/api/jobs/{id}/qa/dismiss"]["post"]["requestBody"]["content"]["application/json"];
type QaUnDismissBody = paths["/api/jobs/{id}/qa/un-dismiss"]["post"]["requestBody"]["content"]["application/json"];

type UnitsFilter = NonNullable<ListUnitsQuery["filter"]>;
type QaDismissReason = NonNullable<QaDismissBody["reason"]>;

const UNITS_FILTERS: readonly UnitsFilter[] = ["new", "all"];
const QA_DISMISS_REASONS: readonly QaDismissReason[] = ["script-density", "intentional", "false-positive", "other"];

type ClientFactory = () => Promise<ApiClient>;

export async function listJobs(client: ApiClient, query: ListJobsQuery) {
  const { data, error, response } = await client.GET("/api/jobs", {
    params: { query },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function getJob(client: ApiClient, id: string) {
  const { data, error, response } = await client.GET("/api/jobs/{id}", {
    params: { path: { id } },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function startJob(client: ApiClient, id: string) {
  const { data, error, response } = await client.POST("/api/jobs/{id}/start", {
    params: { path: { id } },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function retryJob(client: ApiClient, id: string) {
  const { data, error, response } = await client.POST("/api/jobs/{id}/retry", {
    params: { path: { id } },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function getJobStats(client: ApiClient, id: string) {
  const { data, error, response } = await client.GET("/api/jobs/{id}/stats", {
    params: { path: { id } },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function getQaReport(client: ApiClient, id: string) {
  const { data, error, response } = await client.GET("/api/jobs/{id}/qa-report", {
    params: { path: { id } },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function dismissQa(client: ApiClient, id: string, body: QaDismissBody) {
  const { data, error, response } = await client.POST("/api/jobs/{id}/qa/dismiss", {
    params: { path: { id } },
    body,
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function undismissQa(client: ApiClient, id: string, body: QaUnDismissBody) {
  const { data, error, response } = await client.POST("/api/jobs/{id}/qa/un-dismiss", {
    params: { path: { id } },
    body,
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function exportJob(client: ApiClient, id: string, query: ExportQuery) {
  const { data, error, response } = await client.GET("/api/jobs/{id}/export", {
    params: { path: { id }, query },
  });
  if (error) throw new Error(extractError(response, error));
  return data ?? { exported: true };
}

export async function listJobUnits(client: ApiClient, jobId: string, query: ListUnitsQuery) {
  const { data, error, response } = await client.GET("/api/jobs/{jobId}/units", {
    params: { path: { jobId }, query },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function getJobUnit(client: ApiClient, jobId: string, unitId: string) {
  const { data, error, response } = await client.GET("/api/jobs/{jobId}/units/{unitId}", {
    params: { path: { jobId, unitId } },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function listJobFiles(client: ApiClient, id: string, query: ListFilesQuery) {
  const { data, error, response } = await client.GET("/api/jobs/{id}/files", {
    params: { path: { id }, query },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function redeliverJob(client: ApiClient, id: string) {
  const { data, error, response } = await client.POST("/api/jobs/{id}/redeliver", {
    params: { path: { id } },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export function register(group: Command, getClient: ClientFactory): void {
  group
    .command("list")
    .description("List jobs")
    .option("--project-id <id>", "Filter by project UUID")
    .option("--status <status>", "Filter by job status")
    .option("--limit <n>", "Maximum number of results", parseInt)
    .option("--offset <n>", "Result offset", parseInt)
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const query: ListJobsQuery = {};
        if (cmdOpts.projectId !== undefined) query.projectId = cmdOpts.projectId;
        if (cmdOpts.status !== undefined) query.status = cmdOpts.status;
        if (cmdOpts.limit !== undefined) query.limit = cmdOpts.limit;
        if (cmdOpts.offset !== undefined) query.offset = cmdOpts.offset;
        output(await listJobs(client, query), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("get")
    .description("Get a job")
    .requiredOption("--id <id>", "Job UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await getJob(client, cmdOpts.id), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("start")
    .description("Start a draft job")
    .requiredOption("--id <id>", "Job UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await startJob(client, cmdOpts.id), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("retry")
    .description("Retry a failed job")
    .requiredOption("--id <id>", "Job UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await retryJob(client, cmdOpts.id), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("stats")
    .description("Get job stats")
    .requiredOption("--id <id>", "Job UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await getJobStats(client, cmdOpts.id), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("qa-report")
    .description("Get the QA report for a job")
    .requiredOption("--id <id>", "Job UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await getQaReport(client, cmdOpts.id), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("qa-dismiss")
    .description("Dismiss a QA finding")
    .requiredOption("--id <id>", "Job UUID")
    .requiredOption("--unit-id <id>", "Translation unit UUID")
    .requiredOption("--check-type <type>", "QA check type")
    .addOption(new Option("--reason <reason>", "Dismissal reason").choices([...QA_DISMISS_REASONS]))
    .option("--note <note>", "Optional dismissal note")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const body: QaDismissBody = {
          unitId: cmdOpts.unitId,
          checkType: cmdOpts.checkType,
        };
        if (cmdOpts.reason !== undefined) body.reason = cmdOpts.reason as QaDismissReason;
        if (cmdOpts.note !== undefined) body.note = cmdOpts.note;
        output(await dismissQa(client, cmdOpts.id, body), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("qa-undismiss")
    .description("Un-dismiss a QA finding")
    .requiredOption("--id <id>", "Job UUID")
    .requiredOption("--unit-id <id>", "Translation unit UUID")
    .requiredOption("--check-type <type>", "QA check type")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const body: QaUnDismissBody = {
          unitId: cmdOpts.unitId,
          checkType: cmdOpts.checkType,
        };
        output(await undismissQa(client, cmdOpts.id, body), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("export")
    .description("Export translations for a job")
    .requiredOption("--id <id>", "Job UUID")
    .option("--target-lang <lang>", "Target language to export")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const query: ExportQuery = {};
        if (cmdOpts.targetLang !== undefined) query.targetLang = cmdOpts.targetLang;
        output(await exportJob(client, cmdOpts.id, query), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("units")
    .description("List translation units for a job and target language")
    .requiredOption("--job-id <id>", "Job UUID")
    .requiredOption("--target-project-language-id <id>", "Target project language UUID")
    .addOption(new Option("--filter <filter>", "Unit filter").choices([...UNITS_FILTERS]))
    .option("--search <text>", "Search text")
    .option("--limit <n>", "Maximum number of results", parseInt)
    .option("--cursor <cursor>", "Pagination cursor")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const query: ListUnitsQuery = {
          targetProjectLanguageId: cmdOpts.targetProjectLanguageId,
        };
        if (cmdOpts.filter !== undefined) query.filter = cmdOpts.filter as UnitsFilter;
        if (cmdOpts.search !== undefined) query.search = cmdOpts.search;
        if (cmdOpts.limit !== undefined) query.limit = cmdOpts.limit;
        if (cmdOpts.cursor !== undefined) query.cursor = cmdOpts.cursor;
        output(await listJobUnits(client, cmdOpts.jobId, query), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("unit-get")
    .description("Get a single translation unit")
    .requiredOption("--job-id <id>", "Job UUID")
    .requiredOption("--unit-id <id>", "Translation unit UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await getJobUnit(client, cmdOpts.jobId, cmdOpts.unitId), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("files")
    .description("List files for a job")
    .requiredOption("--id <id>", "Job UUID")
    .option("--limit <n>", "Maximum number of results", parseInt)
    .option("--cursor <cursor>", "Pagination cursor")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const query: ListFilesQuery = {};
        if (cmdOpts.limit !== undefined) query.limit = cmdOpts.limit;
        if (cmdOpts.cursor !== undefined) query.cursor = cmdOpts.cursor;
        output(await listJobFiles(client, cmdOpts.id, query), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("redeliver")
    .description("Re-deliver translations for a job")
    .requiredOption("--id <id>", "Job UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await redeliverJob(client, cmdOpts.id), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });
}
