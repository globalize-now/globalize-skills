import chalk from "chalk";
import type { Command } from "commander";
import type { ApiClient } from "../client.js";
import { apiError } from "../client.js";
import { openInBrowser } from "../device-auth.js";
import { output, outputError, type OutputOptions } from "../format.js";

type ClientFactory = () => Promise<ApiClient>;

export async function startGitlabInstall(client: ApiClient) {
  const { data, error, response } = await client.POST("/api/gitlab/cli-install");
  if (error) throw apiError(response, error);
  return data!;
}

export async function pollGitlabInstallStatus(client: ApiClient, nonce: string) {
  const { data, error, response } = await client.GET("/api/gitlab/cli-install/status", {
    params: { query: { nonce } },
  });
  if (error) throw apiError(response, error);
  return data!;
}

export async function listGitlabConnections(client: ApiClient) {
  const { data, error, response } = await client.GET("/api/gitlab/connections");
  if (error) throw apiError(response, error);
  return data!;
}

export async function deleteGitlabConnection(client: ApiClient, id: string) {
  const { data, error, response } = await client.DELETE("/api/gitlab/connections/{id}", {
    params: { path: { id } },
  });
  if (error) throw apiError(response, error);
  return data ?? { deleted: true };
}

/**
 * The repositories (GitLab projects) a connection's user is a Developer or
 * more of. With `search`, at most the 100 closest matches on name, path or
 * group path.
 */
export async function listGitlabProjects(client: ApiClient, connectionId: string, search?: string) {
  const { data, error, response } = await client.GET("/api/gitlab/connections/{id}/projects", {
    params: { path: { id: connectionId }, query: search === undefined ? {} : { search } },
  });
  if (error) throw apiError(response, error);
  return data!;
}

export async function listGitlabProjectBranches(client: ApiClient, connectionId: string, projectId: number) {
  const { data, error, response } = await client.GET("/api/gitlab/connections/{id}/projects/{projectId}/branches", {
    params: { path: { id: connectionId, projectId } },
  });
  if (error) throw apiError(response, error);
  return data!;
}

export async function detectGitlabProject(client: ApiClient, connectionId: string, projectId: number) {
  const { data, error, response } = await client.POST("/api/gitlab/connections/{id}/projects/{projectId}/detect", {
    params: { path: { id: connectionId, projectId } },
    body: {},
  });
  if (error) throw apiError(response, error);
  return data!;
}

// ── CLI ─────────────────────────────────────────────────────────────────────

/**
 * Starts the GitLab OAuth flow. Without `wait` it prints the URL to authorise
 * and the nonce and returns; otherwise it opens the URL and polls until the
 * connection completes or five minutes pass.
 */
async function connect(getClient: ClientFactory, wait: boolean, opts: OutputOptions): Promise<void> {
  const client = await getClient();
  const result = await startGitlabInstall(client);

  if (!wait) {
    output(result, opts);
    return;
  }

  console.log(`\nOpening ${chalk.cyan(result.installUrl)} in your browser…`);
  console.log(chalk.dim("If the browser didn't open, visit the URL above manually.\n"));

  openInBrowser(result.installUrl);

  console.log(chalk.dim("Waiting for GitLab OAuth connection to complete…\n"));

  const POLL_INTERVAL = 3000;
  const TIMEOUT = 5 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT;

  for (;;) {
    await sleep(POLL_INTERVAL);

    if (Date.now() > deadline) {
      outputError("Timed out waiting for GitLab OAuth connection.", opts);
      return;
    }

    const status = await pollGitlabInstallStatus(client, result.nonce);

    if (status.status === "completed") {
      console.log(chalk.green("GitLab account connected successfully."));
      output(status, opts);
      return;
    }
  }
}

function parseProjectId(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new Error(`Invalid GitLab project id: ${value}`);
  return n;
}

export function register(group: Command, getClient: ClientFactory): void {
  // `gitlab connections` alone lists, as it did before it took subcommands.
  const connections = group
    .command("connections")
    .description("List the organisation's GitLab connections (default), or connect another");

  connections
    .command("list", { isDefault: true })
    .description("List GitLab connections: id, username, gitlabUserId, status")
    .action(async (_cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await listGitlabConnections(client), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  connections
    .command("connect")
    .description(
      "Connect a GitLab account via OAuth. With --no-wait, print the URL for the user to authorise and the nonce `gitlab install-status` polls",
    )
    .option("--no-wait", "Return the authorisation URL and nonce immediately without polling for completion")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        await connect(getClient, cmdOpts.wait !== false, opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("install")
    .description("Connect a GitLab account via OAuth (same as `gitlab connections connect`)")
    .option("--no-wait", "Return the install URL and nonce immediately without polling for completion")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        await connect(getClient, cmdOpts.wait !== false, opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("install-status")
    .description("Check the status of a GitLab OAuth connection (single poll)")
    .requiredOption("--nonce <nonce>", "Nonce returned from `gitlab connections connect --no-wait`")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const status = await pollGitlabInstallStatus(client, cmdOpts.nonce);
        output(status, opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("connection-delete")
    .description("Delete a GitLab connection (refused with GITLAB_CONNECTION_IN_USE while a Workflow names it)")
    .requiredOption("--id <id>", "Connection ID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await deleteGitlabConnection(client, cmdOpts.id), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  const repositories = group.command("repositories").description("The GitLab repositories a connection can reach");

  repositories
    .command("list")
    .description(
      "List the repositories a GitLab connection's user is a Developer or more of: id, name, pathWithNamespace, defaultBranch",
    )
    .requiredOption("--connection-id <id>", "GitLab connection ID (`gitlab connections list`)")
    .option("--search <text>", "At most the 100 closest matches on name, path or group path")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await listGitlabProjects(client, cmdOpts.connectionId, cmdOpts.search), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("projects")
    .description("List projects for a GitLab connection (same as `gitlab repositories list`)")
    .requiredOption("--connection-id <id>", "GitLab connection ID")
    .option("--search <text>", "At most the 100 closest matches on name, path or group path")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await listGitlabProjects(client, cmdOpts.connectionId, cmdOpts.search), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("branches")
    .description("List branches for a GitLab project")
    .requiredOption("--connection-id <id>", "GitLab connection ID")
    .requiredOption("--project-id <id>", "GitLab project ID (numeric)")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await listGitlabProjectBranches(client, cmdOpts.connectionId, parseProjectId(cmdOpts.projectId)), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("detect")
    .description("Detect i18n structure in a GitLab project")
    .requiredOption("--connection-id <id>", "GitLab connection ID")
    .requiredOption("--project-id <id>", "GitLab project ID (numeric)")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await detectGitlabProject(client, cmdOpts.connectionId, parseProjectId(cmdOpts.projectId)), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
