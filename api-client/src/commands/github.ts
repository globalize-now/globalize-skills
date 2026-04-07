import chalk from "chalk";
import type { Command } from "commander";
import type { ApiClient } from "../client.js";
import { extractError } from "../client.js";
import { openInBrowser } from "../device-auth.js";
import { output, outputError, type OutputOptions } from "../format.js";

type ClientFactory = () => Promise<ApiClient>;

export async function startGithubInstall(client: ApiClient) {
  const { data, error, response } = await client.POST("/api/github/cli-install");
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function pollGithubInstallStatus(client: ApiClient, nonce: string) {
  const { data, error, response } = await client.GET("/api/github/cli-install/status", {
    params: { query: { nonce } },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export function register(group: Command, getClient: ClientFactory): void {
  group
    .command("install")
    .description("Install the GitHub App on a GitHub account or organisation")
    .option("--no-wait", "Return the install URL and nonce immediately without polling for completion")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const result = await startGithubInstall(client);

        if (cmdOpts.wait === false) {
          output(result, opts);
          return;
        }

        console.log(`\nOpening ${chalk.cyan(result.installUrl)} in your browser…`);
        console.log(chalk.dim("If the browser didn't open, visit the URL above manually.\n"));

        openInBrowser(result.installUrl);

        console.log(chalk.dim("Waiting for GitHub App installation to complete…\n"));

        const POLL_INTERVAL = 3000;
        const TIMEOUT = 5 * 60 * 1000;
        const deadline = Date.now() + TIMEOUT;

        for (;;) {
          await sleep(POLL_INTERVAL);

          if (Date.now() > deadline) {
            outputError("Timed out waiting for GitHub App installation.", opts);
            return;
          }

          const status = await pollGithubInstallStatus(client, result.nonce);

          if (status.status === "completed") {
            console.log(chalk.green("GitHub App installed successfully."));
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
    .description("Check the status of a GitHub App installation (single poll)")
    .requiredOption("--nonce <nonce>", "Nonce returned from github install --no-wait")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const status = await pollGithubInstallStatus(client, cmdOpts.nonce);
        output(status, opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("installations")
    .description("List GitHub App installations")
    .action(async (_cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const { data, error, response } = await client.GET("/api/github/installations");
        if (error) throw new Error(extractError(response, error));
        output(data, opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("repos")
    .description("List repositories from a GitHub App installation")
    .requiredOption("--installation-id <id>", "GitHub installation ID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const { data, error, response } = await client.GET("/api/github/installations/{installationId}/repos", {
          params: { path: { installationId: cmdOpts.installationId } },
        });
        if (error) throw new Error(extractError(response, error));
        output(data, opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("branches")
    .description("List branches for a GitHub repository")
    .requiredOption("--installation-id <id>", "GitHub installation ID")
    .requiredOption("--owner <owner>", "Repository owner")
    .requiredOption("--repo <repo>", "Repository name")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const { data, error, response } = await client.GET(
          "/api/github/installations/{installationId}/branches/{owner}/{repo}",
          {
            params: {
              path: {
                installationId: cmdOpts.installationId,
                owner: cmdOpts.owner,
                repo: cmdOpts.repo,
              },
            },
          },
        );
        if (error) throw new Error(extractError(response, error));
        output(data, opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("detect")
    .description("Detect i18n structure in a GitHub repository")
    .requiredOption("--installation-id <id>", "GitHub installation ID")
    .requiredOption("--owner <owner>", "Repository owner")
    .requiredOption("--repo <repo>", "Repository name")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const { data, error, response } = await client.POST(
          "/api/github/installations/{installationId}/repos/{owner}/{repo}/detect",
          {
            params: {
              path: {
                installationId: cmdOpts.installationId,
                owner: cmdOpts.owner,
                repo: cmdOpts.repo,
              },
            },
          },
        );
        if (error) throw new Error(extractError(response, error));
        output(data, opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
