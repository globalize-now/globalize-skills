import { Option, type Command } from "commander";
import type { ApiClient } from "../client.js";
import { apiError } from "../client.js";
import { output, outputError, type OutputOptions } from "../format.js";
import type { paths } from "../api-types.js";

type EntriesQuery = NonNullable<paths["/api/glossaries/{id}/entries"]["get"]["parameters"]["query"]>;
export type EditGlossaryEntryBody =
  paths["/api/glossaries/{id}/entries/{entryId}"]["patch"]["requestBody"]["content"]["application/json"];
export type AddGlossaryEntryBody =
  paths["/api/glossaries/{id}/entries"]["post"]["requestBody"]["content"]["application/json"];

type ClientFactory = () => Promise<ApiClient>;

export async function listGlossaries(client: ApiClient) {
  const { data, error, response } = await client.GET("/api/glossaries");
  if (error) throw apiError(response, error);
  return data!;
}

export async function createGlossary(client: ApiClient, name: string) {
  const { data, error, response } = await client.POST("/api/glossaries", { body: { name } });
  if (error) throw apiError(response, error);
  return data!;
}

export async function getGlossary(client: ApiClient, id: string) {
  const { data, error, response } = await client.GET("/api/glossaries/{id}", {
    params: { path: { id } },
  });
  if (error) throw apiError(response, error);
  return data!;
}

export async function renameGlossary(client: ApiClient, id: string, name: string) {
  const { data, error, response } = await client.PATCH("/api/glossaries/{id}", {
    params: { path: { id } },
    body: { name },
  });
  if (error) throw apiError(response, error);
  return data!;
}

/** Admin-only, and only for a glossary no Project is attached to and no active Workflow uses. */
export async function deleteGlossary(client: ApiClient, id: string) {
  const { error, response } = await client.DELETE("/api/glossaries/{id}", {
    params: { path: { id } },
  });
  if (error) throw apiError(response, error);
  return { deleted: true };
}

/**
 * One page of entries: each a preferred term in one source locale, with its
 * description, forbidden variants, do-not-translate and target terms.
 */
export async function listGlossaryEntries(client: ApiClient, id: string, query: EntriesQuery = {}) {
  const { data, error, response } = await client.GET("/api/glossaries/{id}/entries", {
    params: { path: { id }, query },
  });
  if (error) throw apiError(response, error);
  return data!;
}

/**
 * Adds one preferred term in one source locale. A term the glossary already
 * holds in that locale is refused with 409 `GLOSSARY_ENTRY_EXISTS` naming the
 * entry to edit instead; a spelling another entry claims, with
 * `GLOSSARY_SPELLING_TAKEN`.
 */
export async function addGlossaryEntry(client: ApiClient, id: string, body: AddGlossaryEntryBody) {
  const { data, error, response } = await client.POST("/api/glossaries/{id}/entries", {
    params: { path: { id } },
    body,
  });
  if (error) throw apiError(response, error);
  return data!;
}

/**
 * Every field optional: rename the preferred term, set or clear (`null`) the
 * description, replace the forbidden variants, toggle do-not-translate (`true`
 * removes every target term), and set or remove (`null`) target terms by
 * locale, leaving the others as they are.
 */
export async function editGlossaryEntry(client: ApiClient, id: string, entryId: string, body: EditGlossaryEntryBody) {
  const { data, error, response } = await client.PATCH("/api/glossaries/{id}/entries/{entryId}", {
    params: { path: { id, entryId } },
    body,
  });
  if (error) throw apiError(response, error);
  return data!;
}

/** Deletes the entry with all of its target terms. */
export async function deleteGlossaryEntryById(client: ApiClient, id: string, entryId: string) {
  const { error, response } = await client.DELETE("/api/glossaries/{id}/entries/{entryId}", {
    params: { path: { id, entryId } },
  });
  if (error) throw apiError(response, error);
  return { deleted: true };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function collect(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

/** `--target <locale>=<term>`, split at the first `=`, so a term may hold one. */
function targetsOf(values: string[]): Record<string, string> {
  const targets: Record<string, string> = {};
  for (const value of values) {
    const at = value.indexOf("=");
    const locale = value.slice(0, at).trim();
    const term = value.slice(at + 1);
    if (at < 0 || locale === "" || term.trim() === "") {
      throw new Error(`--target takes <locale>=<term>, got: ${value}`);
    }
    targets[locale] = term;
  }
  return targets;
}

export function register(group: Command, getClient: ClientFactory): void {
  group
    .command("list")
    .description("List the organisation's glossaries, with their locales, entry counts and users")
    .action(async (_cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await listGlossaries(client), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("create")
    .description("Create a glossary")
    .requiredOption("--name <name>", "Glossary name")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await createGlossary(client, cmdOpts.name), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("get")
    .description("Get a glossary, its source and target locales, and the Projects and Workflows using it")
    .requiredOption("--id <id>", "Glossary UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await getGlossary(client, cmdOpts.id), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("rename")
    .description("Rename a glossary")
    .requiredOption("--id <id>", "Glossary UUID")
    .requiredOption("--name <name>", "New name")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await renameGlossary(client, cmdOpts.id, cmdOpts.name), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("delete")
    .description(
      "Delete a glossary and every entry in it (admin only; only one no Project is attached to and no active Workflow uses)",
    )
    .requiredOption("--id <id>", "Glossary UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await deleteGlossary(client, cmdOpts.id), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("entries")
    .description(
      "Search a glossary's entries: preferred term, description, forbidden variants, do-not-translate and target terms",
    )
    .requiredOption("--id <id>", "Glossary UUID")
    .option("--query <text>", "Case-insensitive substring of the preferred term, a forbidden variant or a target term")
    .option("--spelling <term>", "Entries whose preferred term or a forbidden variant is exactly this")
    .option("--source-locale <locale>", "Source locale (BCP 47)")
    .option("--target-locale <locale>", "Entries with a target term in this locale, and do-not-translate entries")
    .option("--limit <n>", "Maximum number of entries to return")
    .option("--cursor <cursor>", "Pagination cursor")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const query: EntriesQuery = {};
        if (cmdOpts.query !== undefined) query.q = cmdOpts.query;
        if (cmdOpts.spelling !== undefined) query.spelling = cmdOpts.spelling;
        if (cmdOpts.sourceLocale !== undefined) query.sourceLocale = cmdOpts.sourceLocale;
        if (cmdOpts.targetLocale !== undefined) query.targetLocale = cmdOpts.targetLocale;
        if (cmdOpts.limit !== undefined) {
          const limit = Number(cmdOpts.limit);
          if (!Number.isFinite(limit)) throw new Error(`Invalid number for --limit: ${cmdOpts.limit}`);
          query.limit = limit;
        }
        if (cmdOpts.cursor !== undefined) query.cursor = cmdOpts.cursor;
        const client = await getClient();
        output(await listGlossaryEntries(client, cmdOpts.id, query), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("add-term")
    .description(
      "Add an entry: a preferred term in one source locale, with its description, forbidden variants and target terms",
    )
    .requiredOption("--id <id>", "Glossary UUID")
    .requiredOption("--source-term <term>", "The preferred term")
    .requiredOption("--source-locale <locale>", "Its locale (BCP 47)")
    .option("--description <text>", "What the term means, its sense if a homonym, any synonym allowed (max 1000)")
    .option("--forbid <variant>", "A spelling ruled out in source text; repeat for each (max 20)", collect)
    .option("--target <locale>=<term>", "A target term; repeat for each target locale", collect)
    .option("--do-not-translate", "Keep the term as written in every language (no --target)")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const body: AddGlossaryEntryBody = { sourceTerm: cmdOpts.sourceTerm, sourceLocale: cmdOpts.sourceLocale };
        if (cmdOpts.description !== undefined) body.description = cmdOpts.description;
        if (cmdOpts.forbid !== undefined) body.forbiddenVariants = cmdOpts.forbid;
        if (cmdOpts.doNotTranslate) body.doNotTranslate = true;
        if (cmdOpts.target !== undefined) body.targets = targetsOf(cmdOpts.target);
        const client = await getClient();
        output(await addGlossaryEntry(client, cmdOpts.id, body), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("edit-entry")
    .description(
      "Edit an entry: rename it, set or clear its description, replace its forbidden variants, toggle do-not-translate, set or remove target terms",
    )
    .requiredOption("--id <id>", "Glossary UUID")
    .requiredOption("--entry-id <id>", "Glossary entry UUID")
    .option("--source-term <term>", "Rename the preferred term")
    .addOption(new Option("--description <text>", "Set the description (max 1000)").conflicts("clearDescription"))
    .option("--clear-description", "Remove the description")
    .addOption(
      new Option("--forbid <variant>", "Replace the forbidden variants; repeat for each (max 20)")
        .argParser(collect)
        .conflicts("clearForbidden"),
    )
    .option("--clear-forbidden", "Remove every forbidden variant")
    .addOption(
      new Option(
        "--do-not-translate",
        "Keep the term as written in every language; removes its target terms",
      ).conflicts("translate"),
    )
    .option("--translate", "Turn do-not-translate off")
    .option("--target <locale>=<term>", "Set a target term; repeat for each locale (others stay)", collect)
    .option("--remove-target <locale>", "Remove the target term in a locale; repeat for each", collect)
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const body: EditGlossaryEntryBody = {};
        if (cmdOpts.sourceTerm !== undefined) body.sourceTerm = cmdOpts.sourceTerm;
        if (cmdOpts.description !== undefined) body.description = cmdOpts.description;
        if (cmdOpts.clearDescription) body.description = null;
        if (cmdOpts.forbid !== undefined) body.forbiddenVariants = cmdOpts.forbid;
        if (cmdOpts.clearForbidden) body.forbiddenVariants = [];
        if (cmdOpts.doNotTranslate) body.doNotTranslate = true;
        if (cmdOpts.translate) body.doNotTranslate = false;
        if (cmdOpts.target !== undefined || cmdOpts.removeTarget !== undefined) {
          const targets: Record<string, string | null> = targetsOf(cmdOpts.target ?? []);
          for (const locale of (cmdOpts.removeTarget ?? []) as string[]) {
            if (locale in targets) throw new Error(`--target and --remove-target both name ${locale}`);
            targets[locale] = null;
          }
          body.targets = targets;
        }
        const client = await getClient();
        output(await editGlossaryEntry(client, cmdOpts.id, cmdOpts.entryId, body), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("delete-entry")
    .description("Delete an entry with all of its target terms")
    .requiredOption("--id <id>", "Glossary UUID")
    .requiredOption("--entry-id <id>", "Glossary entry UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await deleteGlossaryEntryById(client, cmdOpts.id, cmdOpts.entryId), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });
}
