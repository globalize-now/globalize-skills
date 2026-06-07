import type { Command } from "commander";
import type { ApiClient } from "../client.js";
import { extractError } from "../client.js";
import { output, outputError, type OutputOptions } from "../format.js";
import type { paths } from "../api-types.js";

type ListQuery = NonNullable<paths["/api/projects/{id}/tm"]["get"]["parameters"]["query"]>;
type CountQuery = NonNullable<paths["/api/projects/{id}/tm/count"]["get"]["parameters"]["query"]>;
type FreshCountQuery = paths["/api/projects/{id}/tm/fresh-count"]["get"]["parameters"]["query"];

type ClientFactory = () => Promise<ApiClient>;

export async function listTranslationMemory(client: ApiClient, projectId: string, query: ListQuery) {
  const { data, error, response } = await client.GET("/api/projects/{id}/tm", {
    params: { path: { id: projectId }, query },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function deleteTranslationMemoryEntry(client: ApiClient, projectId: string, entryId: string) {
  const { data, error, response } = await client.DELETE("/api/projects/{id}/tm/{entryId}", {
    params: { path: { id: projectId, entryId } },
  });
  if (error) throw new Error(extractError(response, error));
  return data ?? { deleted: true };
}

export async function countTranslationMemory(client: ApiClient, projectId: string, query: CountQuery) {
  const { data, error, response } = await client.GET("/api/projects/{id}/tm/count", {
    params: { path: { id: projectId }, query },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function freshCountTranslationMemory(client: ApiClient, projectId: string, query: FreshCountQuery) {
  const { data, error, response } = await client.GET("/api/projects/{id}/tm/fresh-count", {
    params: { path: { id: projectId }, query },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export function register(group: Command, getClient: ClientFactory): void {
  group
    .command("list")
    .description("Search translation memory entries")
    .requiredOption("--project-id <id>", "Project UUID")
    .option("--query <text>", "Free-text search query")
    .option("--source-language-id <id>", "Source project language UUID")
    .option("--target-language-id <id>", "Target project language UUID")
    .option("--limit <n>", "Maximum number of entries to return")
    .option("--cursor <cursor>", "Pagination cursor")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const query: ListQuery = {};
        if (cmdOpts.query !== undefined) query.q = cmdOpts.query;
        if (cmdOpts.sourceLanguageId !== undefined) query.sourceProjectLanguageId = cmdOpts.sourceLanguageId;
        if (cmdOpts.targetLanguageId !== undefined) query.targetProjectLanguageId = cmdOpts.targetLanguageId;
        if (cmdOpts.limit !== undefined) {
          const limit = Number(cmdOpts.limit);
          if (!Number.isFinite(limit)) throw new Error(`Invalid number for --limit: ${cmdOpts.limit}`);
          query.limit = limit;
        }
        if (cmdOpts.cursor !== undefined) query.cursor = cmdOpts.cursor;
        output(await listTranslationMemory(client, cmdOpts.projectId, query), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("delete")
    .description("Delete a translation memory entry")
    .requiredOption("--project-id <id>", "Project UUID")
    .requiredOption("--entry-id <id>", "Translation memory entry UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await deleteTranslationMemoryEntry(client, cmdOpts.projectId, cmdOpts.entryId), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("count")
    .description("Count translation memory entries (fresh + stale)")
    .requiredOption("--project-id <id>", "Project UUID")
    .option("--target-language-id <id>", "Target project language UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const query: CountQuery = {};
        if (cmdOpts.targetLanguageId !== undefined) query.targetProjectLanguageId = cmdOpts.targetLanguageId;
        output(await countTranslationMemory(client, cmdOpts.projectId, query), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("fresh-count")
    .description("Count fresh translation memory entries for a target language")
    .requiredOption("--project-id <id>", "Project UUID")
    .requiredOption("--target-language-id <id>", "Target project language UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const query: FreshCountQuery = { targetProjectLanguageId: cmdOpts.targetLanguageId };
        output(await freshCountTranslationMemory(client, cmdOpts.projectId, query), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });
}
