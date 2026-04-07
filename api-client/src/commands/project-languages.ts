import type { Command } from "commander";
import type { ApiClient } from "../client.js";
import { extractError } from "../client.js";
import { output, outputError, type OutputOptions } from "../format.js";

type ClientFactory = () => Promise<ApiClient>;

export async function listProjectLanguages(client: ApiClient, projectId: string) {
  const { data, error, response } = await client.GET("/api/projects/{id}/languages", {
    params: { path: { id: projectId } },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function addProjectLanguage(
  client: ApiClient,
  projectId: string,
  name: string,
  locale: string,
  languageId?: string,
) {
  const { data, error, response } = await client.POST("/api/projects/{id}/languages", {
    params: { path: { id: projectId } },
    body: { name, locale, languageId },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function removeProjectLanguage(client: ApiClient, projectId: string, languageId: string) {
  const { data, error, response } = await client.DELETE("/api/projects/{id}/languages/{languageId}", {
    params: { path: { id: projectId, languageId } },
  });
  if (error) throw new Error(extractError(response, error));
  return data ?? { removed: true };
}

export function register(group: Command, getClient: ClientFactory): void {
  group
    .command("list")
    .description("List project languages")
    .requiredOption("--project-id <id>", "Project UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await listProjectLanguages(client, cmdOpts.projectId), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("add")
    .description("Add a language to a project")
    .requiredOption("--project-id <id>", "Project UUID")
    .requiredOption("--name <name>", "Language name")
    .requiredOption("--locale <bcp47>", "BCP 47 locale code")
    .option("--language-id <id>", "Language UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(
          await addProjectLanguage(client, cmdOpts.projectId, cmdOpts.name, cmdOpts.locale, cmdOpts.languageId),
          opts,
        );
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("remove")
    .description("Remove a language from a project")
    .requiredOption("--project-id <id>", "Project UUID")
    .requiredOption("--language-id <id>", "Language UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await removeProjectLanguage(client, cmdOpts.projectId, cmdOpts.languageId), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });
}
