import type { Command } from "commander";
import type { ApiClient } from "../client.js";
import { extractError } from "../client.js";
import { output, outputError, warnDeprecated, type OutputOptions } from "../format.js";
import {
  clearTranslationMemory,
  countTranslationMemoryEntries,
  deleteTranslationMemoryEntryById,
  freshCountTranslationMemoryEntries,
  listTranslationMemoryEntries,
} from "./translation-memories.js";

/**
 * Compatibility layer for the project-scoped translation memory commands.
 *
 * Translation memory is an org-level resource shared by every project attached
 * to it; the project-scoped `/api/projects/{id}/tm/**` routes are deprecated in
 * the API. These wrappers keep the original project-addressed signatures alive
 * but resolve the project to its memory and call the current
 * `/api/translation-memories/**` routes, so nothing here depends on a
 * deprecated endpoint. Callers are told to move via {@link PROJECT_TM_DEPRECATION}.
 *
 * Two behavioural notes for callers still on these entry points:
 * - Project language UUIDs are translated to locales for the new API. An ID the
 *   project doesn't own is an error rather than a silent empty result.
 * - Entries come back in the current shape: `translationMemoryId` replaces
 *   `projectId`, and `sourceLanguage.id` / `targetLanguage.id` are nullable.
 */
export const PROJECT_TM_DEPRECATION =
  "Project-scoped translation memory is deprecated. Translation memory is now an org-level resource shared by " +
  "every attached project — use the `translation-memories` commands addressed by the project's " +
  "`translationMemory.id` (from `projects get`). Entries returned here carry `translationMemoryId`, not `projectId`.";

type ListQuery = {
  q?: string;
  sourceProjectLanguageId?: string;
  targetProjectLanguageId?: string;
  limit?: number;
  cursor?: string;
};
type CountQuery = { targetProjectLanguageId?: string };
type FreshCountQuery = { targetProjectLanguageId: string };

type ClientFactory = () => Promise<ApiClient>;

interface ProjectMemory {
  translationMemoryId: string;
  localeByProjectLanguageId: Map<string, string>;
}

async function resolveProjectMemory(client: ApiClient, projectId: string): Promise<ProjectMemory> {
  const { data, error, response } = await client.GET("/api/projects/{id}", {
    params: { path: { id: projectId } },
  });
  if (error) throw new Error(extractError(response, error));
  const project = data!;

  const localeByProjectLanguageId = new Map<string, string>();
  if (project.sourceLanguage) localeByProjectLanguageId.set(project.sourceLanguage.id, project.sourceLanguage.locale);
  for (const language of project.targetLanguages) localeByProjectLanguageId.set(language.id, language.locale);
  // Archived languages are reported as two parallel arrays rather than objects.
  if (project.archivedTargetLanguageIds.length === project.archivedTargetLocales.length) {
    project.archivedTargetLanguageIds.forEach((id, i) => {
      localeByProjectLanguageId.set(id, project.archivedTargetLocales[i]);
    });
  }

  return { translationMemoryId: project.translationMemory.id, localeByProjectLanguageId };
}

function toLocale(memory: ProjectMemory, projectLanguageId: string, flag: string): string {
  const locale = memory.localeByProjectLanguageId.get(projectLanguageId);
  if (locale === undefined) {
    throw new Error(
      `${flag}: ${projectLanguageId} is not a language of this project. ` +
        "Pass a locale to the `translation-memories` commands instead.",
    );
  }
  return locale;
}

/** @deprecated Use `listTranslationMemoryEntries` with the project's `translationMemory.id`. */
export async function listTranslationMemory(client: ApiClient, projectId: string, query: ListQuery) {
  const memory = await resolveProjectMemory(client, projectId);
  return listTranslationMemoryEntries(client, memory.translationMemoryId, {
    q: query.q,
    sourceLocale:
      query.sourceProjectLanguageId === undefined
        ? undefined
        : toLocale(memory, query.sourceProjectLanguageId, "sourceProjectLanguageId"),
    targetLocale:
      query.targetProjectLanguageId === undefined
        ? undefined
        : toLocale(memory, query.targetProjectLanguageId, "targetProjectLanguageId"),
    limit: query.limit,
    cursor: query.cursor,
  });
}

/** @deprecated Use `deleteTranslationMemoryEntryById` with the project's `translationMemory.id`. */
export async function deleteTranslationMemoryEntry(client: ApiClient, projectId: string, entryId: string) {
  const memory = await resolveProjectMemory(client, projectId);
  return deleteTranslationMemoryEntryById(client, memory.translationMemoryId, entryId);
}

/** @deprecated Use `countTranslationMemoryEntries` with the project's `translationMemory.id`. */
export async function countTranslationMemory(client: ApiClient, projectId: string, query: CountQuery) {
  const memory = await resolveProjectMemory(client, projectId);
  return countTranslationMemoryEntries(client, memory.translationMemoryId, {
    targetLocale:
      query.targetProjectLanguageId === undefined
        ? undefined
        : toLocale(memory, query.targetProjectLanguageId, "targetProjectLanguageId"),
  });
}

/** @deprecated Use `freshCountTranslationMemoryEntries` with the project's `translationMemory.id`. */
export async function freshCountTranslationMemory(client: ApiClient, projectId: string, query: FreshCountQuery) {
  const memory = await resolveProjectMemory(client, projectId);
  return freshCountTranslationMemoryEntries(client, memory.translationMemoryId, {
    targetLocale: toLocale(memory, query.targetProjectLanguageId, "targetProjectLanguageId"),
  });
}

/** @deprecated Use `clearTranslationMemory` with the project's `translationMemory.id`. */
export async function clearProjectTranslationMemory(client: ApiClient, projectId: string, query: CountQuery) {
  const memory = await resolveProjectMemory(client, projectId);
  return clearTranslationMemory(client, memory.translationMemoryId, {
    targetLocale:
      query.targetProjectLanguageId === undefined
        ? undefined
        : toLocale(memory, query.targetProjectLanguageId, "targetProjectLanguageId"),
  });
}

export function register(group: Command, getClient: ClientFactory): void {
  group
    .command("list")
    .description("(deprecated) Search translation memory entries — use `translation-memories entries`")
    .requiredOption("--project-id <id>", "Project UUID")
    .option("--query <text>", "Free-text search query")
    .option("--source-language-id <id>", "Source project language UUID")
    .option("--target-language-id <id>", "Target project language UUID")
    .option("--limit <n>", "Maximum number of entries to return")
    .option("--cursor <cursor>", "Pagination cursor")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        warnDeprecated(PROJECT_TM_DEPRECATION);
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
    .description("(deprecated) Delete a translation memory entry — use `translation-memories delete-entry`")
    .requiredOption("--project-id <id>", "Project UUID")
    .requiredOption("--entry-id <id>", "Translation memory entry UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        warnDeprecated(PROJECT_TM_DEPRECATION);
        const client = await getClient();
        output(await deleteTranslationMemoryEntry(client, cmdOpts.projectId, cmdOpts.entryId), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("count")
    .description("(deprecated) Count translation memory entries — use `translation-memories count`")
    .requiredOption("--project-id <id>", "Project UUID")
    .option("--target-language-id <id>", "Target project language UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        warnDeprecated(PROJECT_TM_DEPRECATION);
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
    .description("(deprecated) Count fresh translation memory entries — use `translation-memories fresh-count`")
    .requiredOption("--project-id <id>", "Project UUID")
    .requiredOption("--target-language-id <id>", "Target project language UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        warnDeprecated(PROJECT_TM_DEPRECATION);
        const client = await getClient();
        const query: FreshCountQuery = { targetProjectLanguageId: cmdOpts.targetLanguageId };
        output(await freshCountTranslationMemory(client, cmdOpts.projectId, query), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });
}
