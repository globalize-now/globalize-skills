import { Option, type Command } from "commander";
import type { ApiClient } from "../client.js";
import { apiError } from "../client.js";
import { output, outputError, type OutputOptions } from "../format.js";
import type { paths } from "../api-types.js";

type ClientFactory = () => Promise<ApiClient>;

export type WorkflowSetupBody =
  paths["/api/workflows/setup/preview"]["post"]["requestBody"]["content"]["application/json"];
export type WorkflowSetupPattern = NonNullable<WorkflowSetupBody["patterns"]>[number];
export type WorkflowImportMode = NonNullable<WorkflowSetupBody["import"]>;
export type StartWorkflowRunBody = NonNullable<
  paths["/api/workflows/{id}/runs"]["post"]["requestBody"]
>["content"]["application/json"];
export type RunDelivery = NonNullable<StartWorkflowRunBody["delivery"]>;
type ListRunsQuery = NonNullable<paths["/api/workflows/{id}/runs"]["get"]["parameters"]["query"]>;
export type WorkflowRun = paths["/api/workflow-runs/{id}"]["get"]["responses"]["200"]["content"]["application/json"];

/**
 * The fields of a Workflow definition this client reads. The API types a
 * definition as an open object; these are the ones its description names.
 */
interface DefinitionFields {
  input?: { type?: string };
  targetLanguages?: Record<string, unknown>;
}

const IMPORT_MODES = ["ignore", "reviewed", "translated"] as const satisfies readonly WorkflowImportMode[];
const RUN_DELIVERIES = ["pr", "push"] as const satisfies readonly RunDelivery[];

// ── Workflow setup ──────────────────────────────────────────────────────────

/** Proposes a Workflow for a GitHub repository. Writes nothing and starts no run. */
export async function previewWorkflowSetup(client: ApiClient, body: WorkflowSetupBody) {
  const { data, error, response } = await client.POST("/api/workflows/setup/preview", { body });
  if (error) throw apiError(response, error);
  return data!;
}

/** Publishes what `previewWorkflowSetup` proposed for the same body, as version 1. Starts no run. */
export async function setUpWorkflow(client: ApiClient, body: WorkflowSetupBody & { previewHash: string }) {
  const { data, error, response } = await client.POST("/api/workflows/setup", { body });
  if (error) throw apiError(response, error);
  return data!;
}

// ── Workflows ───────────────────────────────────────────────────────────────

export async function listWorkflows(client: ApiClient) {
  const { data, error, response } = await client.GET("/api/workflows");
  if (error) throw apiError(response, error);
  return data!;
}

export async function getWorkflow(client: ApiClient, id: string) {
  const { data, error, response } = await client.GET("/api/workflows/{id}", {
    params: { path: { id } },
  });
  if (error) throw apiError(response, error);
  return data!;
}

export async function getWorkflowVersion(client: ApiClient, id: string, number: number) {
  const { data, error, response } = await client.GET("/api/workflows/{id}/versions/{number}", {
    params: { path: { id, number } },
  });
  if (error) throw apiError(response, error);
  return data!;
}

/**
 * Replaces the target languages a Workflow declares, publishing the next
 * version with nothing else changed. The definition is `baseVersion`'s (the
 * current one when absent), and the publish passes that number, so it's
 * refused with 409 `WORKFLOW_BASE_VERSION_STALE` when another version was
 * published since rather than overwriting it. The same languages publish
 * nothing (`published: false`).
 */
export async function setWorkflowLanguages(
  client: ApiClient,
  id: string,
  targetLanguages: string[],
  baseVersion?: number,
) {
  const base =
    baseVersion === undefined
      ? (await getWorkflow(client, id)).currentVersion
      : await getWorkflowVersion(client, id, baseVersion);
  const { targetLanguages: current } = base.definition as DefinitionFields;
  const definition = {
    ...base.definition,
    targetLanguages: { ...current, declared: targetLanguages },
  };
  const { data, error, response } = await client.PUT("/api/workflows/{id}/definition", {
    params: { path: { id }, query: { baseVersion: base.number } },
    body: definition,
  });
  if (error) throw apiError(response, error);
  return data!;
}

// ── Runs ────────────────────────────────────────────────────────────────────

/**
 * Starts a run of the current version by hand, which spends credits. Sends
 * `branch` and `delivery` as given: absent, the API translates the primary
 * branch and delivers as the Output is configured. The `workflows runs start`
 * command defaults a GitHub Workflow's delivery to `pr`.
 */
export async function startWorkflowRun(client: ApiClient, id: string, body: StartWorkflowRunBody = {}) {
  const { data, error, response } = await client.POST("/api/workflows/{id}/runs", {
    params: { path: { id } },
    body,
  });
  if (error) throw apiError(response, error);
  return data!;
}

export async function getWorkflowRun(client: ApiClient, runId: string) {
  const { data, error, response } = await client.GET("/api/workflow-runs/{id}", {
    params: { path: { id: runId } },
  });
  if (error) throw apiError(response, error);
  return data!;
}

export async function listWorkflowRuns(client: ApiClient, id: string, query?: ListRunsQuery) {
  const { data, error, response } = await client.GET("/api/workflows/{id}/runs", {
    params: { path: { id }, query },
  });
  if (error) throw apiError(response, error);
  return data!;
}

/**
 * A run as an agent polls it, as the hosted MCP's `get_workflow_run` reports
 * it: status and failure, each language's translate progress, each Output's
 * latest delivery outcome and the pull request a GitHub Output opened.
 *
 * A `completed` run has finished translating; it does not mean the
 * translations were delivered. Check each Output's `outcome` (null until it
 * has run, then delivered, failed or skipped).
 */
export function summariseWorkflowRun(run: WorkflowRun) {
  const { trigger } = run;
  const pullRequestUrl =
    run.outputs.flatMap((o) => {
      const outcome = o.outcome as { status?: string; pullRequest?: { url?: string } } | null;
      return o.type === "github" && outcome?.status === "delivered" && outcome.pullRequest?.url
        ? [outcome.pullRequest.url]
        : [];
    })[0] ?? null;
  return {
    id: run.id,
    workflowId: run.workflowId,
    number: run.number,
    status: run.status,
    versionNumber: run.version.number,
    trigger: {
      kind: trigger.kind,
      ...("branch" in trigger && "commit" in trigger ? { branch: trigger.branch, commit: trigger.commit } : {}),
      ...("delivery" in trigger && trigger.delivery !== undefined ? { delivery: trigger.delivery } : {}),
    },
    failure: run.failure,
    languages: run.lanes.map((lane) => {
      const translate = lane.steps.flatMap((step) => step.actions).filter((action) => action.type === "translate");
      const sum = (key: "done" | "total" | "failed") => translate.reduce((n, action) => n + action.progress[key], 0);
      return {
        locale: lane.locale,
        status: lane.status,
        done: sum("done"),
        total: sum("total"),
        failed: sum("failed"),
      };
    }),
    outputs: run.outputs.map((o) => ({ id: o.id, type: o.type, outcome: o.outcome })),
    pullRequestUrl,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parsePositiveInt(flag: string, value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new Error(`Invalid number for ${flag}: ${value}`);
  return n;
}

function parsePatterns(value: string): WorkflowSetupPattern[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`Invalid JSON for --patterns: ${value}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error('--patterns must be a JSON array of {"pattern", "format", "pathLocales"?} objects');
  }
  return parsed as WorkflowSetupPattern[];
}

interface SetupOptions {
  installationId: string;
  repository: string;
  branches?: string;
  patterns?: string;
  sourceLanguage?: string;
  targetLanguages?: string;
  name?: string;
  translationMemoryId?: string;
  import?: WorkflowImportMode;
}

function setupBodyOf(o: SetupOptions): WorkflowSetupBody {
  const body: WorkflowSetupBody = {
    installationId: parsePositiveInt("--installation-id", o.installationId),
    repository: o.repository,
  };
  if (o.branches !== undefined) body.branches = splitList(o.branches);
  if (o.patterns !== undefined) body.patterns = parsePatterns(o.patterns);
  if (o.sourceLanguage !== undefined) body.sourceLanguage = o.sourceLanguage;
  if (o.targetLanguages !== undefined) body.targetLanguages = splitList(o.targetLanguages);
  if (o.name !== undefined) body.name = o.name;
  if (o.translationMemoryId !== undefined) body.translationMemoryId = o.translationMemoryId;
  if (o.import !== undefined) body.import = o.import;
  return body;
}

function withSetupOptions(cmd: Command): Command {
  return cmd
    .requiredOption("--installation-id <id>", "GitHub App installation id (`github installations`)")
    .requiredOption("--repository <owner/repo>", "The GitHub repository")
    .option(
      "--branches <list>",
      "Watched branches, comma-separated; detection reads the first (default: the default branch)",
    )
    .option(
      "--patterns <json>",
      'Patterns in place of detection\'s, as a JSON array: [{"pattern":"locales/{locale}.json","format":"json-flat","pathLocales":{"pt-BR":"pt_BR"}}]',
    )
    .option("--source-language <locale>", "Source language in place of the detected one")
    .option("--target-languages <list>", "Target languages in place of the detected ones, comma-separated")
    .option("--name <name>", "Workflow name (default: owner/repo)")
    .option("--translation-memory-id <id>", "An existing translation memory (default: create one on setup)")
    .addOption(
      new Option(
        "--import <mode>",
        "What the first run does with existing target translations (default: ignore)",
      ).choices([...IMPORT_MODES]),
    );
}

export function register(group: Command, getClient: ClientFactory): void {
  withSetupOptions(
    group
      .command("preview-setup")
      .description(
        "Preview a Workflow for a GitHub repository: what it detected and would publish, or what it needs. Writes nothing",
      ),
  ).action(async (cmdOpts, cmd) => {
    const opts: OutputOptions = cmd.optsWithGlobals();
    try {
      const body = setupBodyOf(cmdOpts);
      const client = await getClient();
      output(await previewWorkflowSetup(client, body), opts);
    } catch (e) {
      outputError(e, opts);
    }
  });

  withSetupOptions(
    group
      .command("setup")
      .description(
        "Set up the Workflow `preview-setup` proposed: the same options plus its previewHash. Starts no run",
      ),
  )
    .requiredOption("--preview-hash <hash>", "The previewHash `preview-setup` answered")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const body = { ...setupBodyOf(cmdOpts), previewHash: cmdOpts.previewHash as string };
        const client = await getClient();
        output(await setUpWorkflow(client, body), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("list")
    .description("List Workflows, archived ones included")
    .action(async (_cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await listWorkflows(client), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("get")
    .description("Get a Workflow with its current version and definition")
    .requiredOption("--id <id>", "Workflow UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await getWorkflow(client, cmdOpts.id), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("languages")
    .description("Replace a Workflow's target languages, publishing its next version with nothing else changed")
    .requiredOption("--id <id>", "Workflow UUID")
    .requiredOption("--target-languages <list>", "Every target language the Workflow should declare, comma-separated")
    .option(
      "--base-version <n>",
      "The version the change starts from (default: the current one); refused if another was published since",
    )
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const baseVersion =
          cmdOpts.baseVersion === undefined ? undefined : parsePositiveInt("--base-version", cmdOpts.baseVersion);
        const client = await getClient();
        output(await setWorkflowLanguages(client, cmdOpts.id, splitList(cmdOpts.targetLanguages), baseVersion), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  const runs = group.command("runs").description("Start and follow Workflow runs");

  runs
    .command("start")
    .description(
      "Start a run of a Workflow's current version, which spends credits. A GitHub Workflow delivers by pull request unless --delivery push",
    )
    .requiredOption("--workflow-id <id>", "Workflow UUID")
    .option("--branch <branch>", "GitHub only: a watched branch (default: the primary one)")
    .addOption(new Option("--delivery <mode>", "GitHub only: pr (default) or push").choices([...RUN_DELIVERIES]))
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        let delivery = cmdOpts.delivery as RunDelivery | undefined;
        if (delivery === undefined) {
          // A pull request unless told otherwise, as the hosted MCP's
          // start_workflow_run does; a Contentful run takes no delivery.
          const workflow = await getWorkflow(client, cmdOpts.workflowId);
          if ((workflow.currentVersion.definition as DefinitionFields).input?.type === "github") delivery = "pr";
        }
        const body: StartWorkflowRunBody = {};
        if (cmdOpts.branch !== undefined) body.branch = cmdOpts.branch;
        if (delivery !== undefined) body.delivery = delivery;
        const run = await startWorkflowRun(client, cmdOpts.workflowId, body);
        output(summariseWorkflowRun(run), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  runs
    .command("get")
    .description(
      "Get a run: status, failure, per-language progress, each Output's outcome and the pull request. " +
        '"completed" means translated, not delivered: check each Output\'s outcome',
    )
    .requiredOption("--id <id>", "Run UUID")
    .option("--full", "Print the full run instead of the summary")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const run = await getWorkflowRun(client, cmdOpts.id);
        output(cmdOpts.full ? run : summariseWorkflowRun(run), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  runs
    .command("list")
    .description('List a Workflow\'s runs, newest first, summarised as `runs get` does ("completed" is not delivered)')
    .requiredOption("--workflow-id <id>", "Workflow UUID")
    .option("--limit <n>", "Maximum number of results (default 50, max 200)")
    .option("--cursor <cursor>", "The pagination cursor of the previous page")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const query: ListRunsQuery = {};
        if (cmdOpts.limit !== undefined) query.limit = parsePositiveInt("--limit", cmdOpts.limit);
        if (cmdOpts.cursor !== undefined) query.cursor = cmdOpts.cursor;
        const client = await getClient();
        const page = await listWorkflowRuns(client, cmdOpts.workflowId, query);
        output({ data: page.data.map(summariseWorkflowRun), pagination: page.pagination }, opts);
      } catch (e) {
        outputError(e, opts);
      }
    });
}
