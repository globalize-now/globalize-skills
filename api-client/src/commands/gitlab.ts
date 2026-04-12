import chalk from "chalk";
import type { Command } from "commander";
import type { ApiClient } from "../client.js";
import { extractError } from "../client.js";
import { openInBrowser } from "../device-auth.js";
import { output, outputError, type OutputOptions } from "../format.js";

type ClientFactory = () => Promise<ApiClient>;

export async function startGitlabInstall(client: ApiClient) {
  const { data, error, response } = await client.POST("/api/gitlab/cli-install");
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function pollGitlabInstallStatus(client: ApiClient, nonce: string) {
  const { data, error, response } = await client.GET("/api/gitlab/cli-install/status", {
    params: { query: { nonce } },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function listGitlabConnections(client: ApiClient) {
  const { data, error, response } = await client.GET("/api/gitlab/connections");
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function deleteGitlabConnection(client: ApiClient, id: string) {
  const { data, error, response } = await client.DELETE("/api/gitlab/connections/{id}", {
    params: { path: { id } },
  });
  if (error) throw new Error(extractError(response, error));
  return data ?? { deleted: true };
}

export async function listGitlabProjects(client: ApiClient, connectionId: string) {
  const { data, error, response } = await client.GET("/api/gitlab/connections/{id}/projects", {
    params: { path: { id: connectionId } },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function listGitlabProjectBranches(client: ApiClient, connectionId: string, projectId: number) {
  const { data, error, response } = await client.GET(
    "/api/gitlab/connections/{id}/projects/{projectId}/branches",
    {
      params: { path: { id: connectionId, projectId } },
    },
  );
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function detectGitlabProject(client: ApiClient, connectionId: string, projectId: number) {
  const { data, error, response } = await client.POST(
    "/api/gitlab/connections/{id}/projects/{projectId}/detect",
    {
      params: { path: { id: connectionId, projectId } },
      body: {},
    },
  );
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export function register(group: Command, getClient: ClientFactory): void {
  group
    .command("install")
    .description("Connect a GitLab account via OAuth")
    .option("--no-wait", "Return the install URL and nonce immediately without polling for completion")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const result = await startGitlabInstall(client);

        if (cmdOpts.wait === false) {
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
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("install-status")
    .description("Check the status of a GitLab OAuth connection (single poll)")
    .requiredOption("--nonce <nonce>", "Nonce returned from gitlab install --no-wait")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const status = await pollGitlabInstallStatus(client, cmdOpts.nonce);
        output(status, opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("connections")
    .description("List GitLab connections")
    .action(async (_cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await listGitlabConnections(client), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("connection-delete")
    .description("Delete a GitLab connection")
    .requiredOption("--id <id>", "Connection ID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await deleteGitlabConnection(client, cmdOpts.id), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("projects")
    .description("List projects for a GitLab connection")
    .requiredOption("--connection-id <id>", "GitLab connection ID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await listGitlabProjects(client, cmdOpts.connectionId), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
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
        output(await listGitlabProjectBranches(client, cmdOpts.connectionId, Number(cmdOpts.projectId)), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
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
        output(await detectGitlabProject(client, cmdOpts.connectionId, Number(cmdOpts.projectId)), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
