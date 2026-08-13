import type { Command } from "commander";
import type { ApiClient } from "../client.js";
import { extractError } from "../client.js";
import { output, outputError, type OutputOptions } from "../format.js";
import type { paths } from "../api-types.js";

type EntriesQuery = NonNullable<paths["/api/translation-memories/{id}/entries"]["get"]["parameters"]["query"]>;
type ClearQuery = NonNullable<paths["/api/translation-memories/{id}/entries"]["delete"]["parameters"]["query"]>;
type CountQuery = NonNullable<paths["/api/translation-memories/{id}/entries/count"]["get"]["parameters"]["query"]>;
type FreshCountQuery = paths["/api/translation-memories/{id}/entries/fresh-count"]["get"]["parameters"]["query"];

type ClientFactory = () => Promise<ApiClient>;

export async function listTranslationMemories(client: ApiClient) {
  const { data, error, response } = await client.GET("/api/translation-memories");
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function createTranslationMemory(client: ApiClient, name: string) {
  const { data, error, response } = await client.POST("/api/translation-memories", {
    body: { name },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function getTranslationMemory(client: ApiClient, id: string) {
  const { data, error, response } = await client.GET("/api/translation-memories/{id}", {
    params: { path: { id } },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function renameTranslationMemory(client: ApiClient, id: string, name: string) {
  const { data, error, response } = await client.PATCH("/api/translation-memories/{id}", {
    params: { path: { id } },
    body: { name },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function deleteTranslationMemory(client: ApiClient, id: string) {
  const { data, error, response } = await client.DELETE("/api/translation-memories/{id}", {
    params: { path: { id } },
  });
  if (error) throw new Error(extractError(response, error));
  return data ?? { deleted: true };
}

export async function listTranslationMemoryEntries(client: ApiClient, id: string, query: EntriesQuery) {
  const { data, error, response } = await client.GET("/api/translation-memories/{id}/entries", {
    params: { path: { id }, query },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function deleteTranslationMemoryEntryById(client: ApiClient, id: string, entryId: string) {
  const { data, error, response } = await client.DELETE("/api/translation-memories/{id}/entries/{entryId}", {
    params: { path: { id, entryId } },
  });
  if (error) throw new Error(extractError(response, error));
  return data ?? { deleted: true };
}

export async function clearTranslationMemory(client: ApiClient, id: string, query: ClearQuery) {
  const { data, error, response } = await client.DELETE("/api/translation-memories/{id}/entries", {
    params: { path: { id }, query },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function countTranslationMemoryEntries(client: ApiClient, id: string, query: CountQuery) {
  const { data, error, response } = await client.GET("/api/translation-memories/{id}/entries/count", {
    params: { path: { id }, query },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function freshCountTranslationMemoryEntries(client: ApiClient, id: string, query: FreshCountQuery) {
  const { data, error, response } = await client.GET("/api/translation-memories/{id}/entries/fresh-count", {
    params: { path: { id }, query },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export function register(group: Command, getClient: ClientFactory): void {
  group
    .command("list")
    .description("List translation memories in the organisation")
    .action(async (_cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await listTranslationMemories(client), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("create")
    .description("Create a translation memory")
    .requiredOption("--name <name>", "Translation memory name")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await createTranslationMemory(client, cmdOpts.name), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("get")
    .description("Get a translation memory, its attached projects and its locales")
    .requiredOption("--id <id>", "Translation memory UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await getTranslationMemory(client, cmdOpts.id), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("rename")
    .description("Rename a translation memory")
    .requiredOption("--id <id>", "Translation memory UUID")
    .requiredOption("--name <name>", "New name")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await renameTranslationMemory(client, cmdOpts.id, cmdOpts.name), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("delete")
    .description("Delete a translation memory (only one with no attached projects)")
    .requiredOption("--id <id>", "Translation memory UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await deleteTranslationMemory(client, cmdOpts.id), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("entries")
    .description("Search translation memory entries")
    .requiredOption("--id <id>", "Translation memory UUID")
    .option("--query <text>", "Free-text search query")
    .option("--source-locale <locale>", "Source locale (BCP 47)")
    .option("--target-locale <locale>", "Target locale (BCP 47)")
    .option("--limit <n>", "Maximum number of entries to return")
    .option("--cursor <cursor>", "Pagination cursor")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const query: EntriesQuery = {};
        if (cmdOpts.query !== undefined) query.q = cmdOpts.query;
        if (cmdOpts.sourceLocale !== undefined) query.sourceLocale = cmdOpts.sourceLocale;
        if (cmdOpts.targetLocale !== undefined) query.targetLocale = cmdOpts.targetLocale;
        if (cmdOpts.limit !== undefined) {
          const limit = Number(cmdOpts.limit);
          if (!Number.isFinite(limit)) throw new Error(`Invalid number for --limit: ${cmdOpts.limit}`);
          query.limit = limit;
        }
        if (cmdOpts.cursor !== undefined) query.cursor = cmdOpts.cursor;
        output(await listTranslationMemoryEntries(client, cmdOpts.id, query), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("delete-entry")
    .description("Delete a translation memory entry (every attached project stops matching it)")
    .requiredOption("--id <id>", "Translation memory UUID")
    .requiredOption("--entry-id <id>", "Translation memory entry UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await deleteTranslationMemoryEntryById(client, cmdOpts.id, cmdOpts.entryId), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("clear")
    .description("Clear a translation memory, optionally only one target locale")
    .requiredOption("--id <id>", "Translation memory UUID")
    .option("--target-locale <locale>", "Only clear entries for this target locale")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const query: ClearQuery = {};
        if (cmdOpts.targetLocale !== undefined) query.targetLocale = cmdOpts.targetLocale;
        output(await clearTranslationMemory(client, cmdOpts.id, query), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("count")
    .description("Count translation memory entries (fresh + stale)")
    .requiredOption("--id <id>", "Translation memory UUID")
    .option("--target-locale <locale>", "Target locale (BCP 47)")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const query: CountQuery = {};
        if (cmdOpts.targetLocale !== undefined) query.targetLocale = cmdOpts.targetLocale;
        output(await countTranslationMemoryEntries(client, cmdOpts.id, query), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("fresh-count")
    .description("Count fresh translation memory entries for a target locale")
    .requiredOption("--id <id>", "Translation memory UUID")
    .requiredOption("--target-locale <locale>", "Target locale (BCP 47)")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const query: FreshCountQuery = { targetLocale: cmdOpts.targetLocale };
        output(await freshCountTranslationMemoryEntries(client, cmdOpts.id, query), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });
}
