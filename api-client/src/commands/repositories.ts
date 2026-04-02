import { Command, Option } from "commander";
import type { ApiClient } from "../client.js";
import { extractError } from "../client.js";
import { output, outputError, type OutputOptions } from "../format.js";

type ClientFactory = () => Promise<ApiClient>;

export async function listRepositories(client: ApiClient, projectId: string) {
  const { data, error, response } = await client.GET("/api/repositories", {
    params: { query: { projectId } },
  });
  if (error) throw new Error(extractError(response, error));
  return data;
}

export async function createRepository(
  client: ApiClient,
  projectId: string,
  gitUrl: string,
  provider: "github" | "gitlab",
  branches?: string[],
  localePathPattern?: string,
) {
  const { data, error, response } = await client.POST("/api/repositories", {
    body: { projectId, gitUrl, provider, branches, localePathPattern },
  });
  if (error) throw new Error(extractError(response, error));
  return data;
}

export async function deleteRepository(client: ApiClient, id: string) {
  const { data, error, response } = await client.DELETE("/api/repositories/{id}", {
    params: { path: { id } },
  });
  if (error) throw new Error(extractError(response, error));
  return data ?? { deleted: true };
}

export async function detectRepository(client: ApiClient, id: string) {
  const { data, error, response } = await client.POST("/api/repositories/{id}/detect", {
    params: { path: { id } },
  });
  if (error) throw new Error(extractError(response, error));
  return data;
}

export function register(group: Command, getClient: ClientFactory): void {
  group
    .command("list")
    .description("List repositories")
    .requiredOption("--project-id <id>", "Project UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await listRepositories(client, cmdOpts.projectId), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("create")
    .description("Create a repository")
    .requiredOption("--project-id <id>", "Project UUID")
    .requiredOption("--git-url <url>", "Git repository URL")
    .addOption(new Option("--provider <provider>", "Git provider").choices(["github", "gitlab"]).makeOptionMandatory())
    .option("--branches <branches...>", "Branches to track")
    .option("--locale-path-pattern <pattern>", "Locale path pattern")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(
          await createRepository(
            client,
            cmdOpts.projectId,
            cmdOpts.gitUrl,
            cmdOpts.provider,
            cmdOpts.branches,
            cmdOpts.localePathPattern,
          ),
          opts,
        );
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("delete")
    .description("Delete a repository")
    .requiredOption("--id <id>", "Repository UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await deleteRepository(client, cmdOpts.id), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("detect")
    .description("Detect repository configuration")
    .requiredOption("--id <id>", "Repository UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await detectRepository(client, cmdOpts.id), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });
}
