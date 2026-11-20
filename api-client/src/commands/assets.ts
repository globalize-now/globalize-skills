import { readFileSync } from "node:fs";
import { Option, type Command } from "commander";
import type { ApiClient } from "../client.js";
import { apiError } from "../client.js";
import { output, outputError, type OutputOptions } from "../format.js";
import type { paths } from "../api-types.js";

type ClientFactory = () => Promise<ApiClient>;

export type AssetType = NonNullable<NonNullable<paths["/api/assets"]["get"]["parameters"]["query"]>["type"]>;

export type CreateAssetBody = paths["/api/assets"]["post"]["requestBody"]["content"]["application/json"];
export type AssetScope = CreateAssetBody["scope"];
export type PutAssetTextBody = paths["/api/assets/{id}/texts"]["put"]["requestBody"]["content"]["application/json"];

const ASSET_TYPES = ["style_guide", "context"] as const satisfies readonly AssetType[];
const ASSET_SCOPES = ["global", "per_locale"] as const satisfies readonly AssetScope[];

/** Style guides and contexts; a Check Asset isn't listed. */
export async function listAssets(client: ApiClient, type?: AssetType) {
  const { data, error, response } = await client.GET("/api/assets", {
    params: { query: type === undefined ? {} : { type } },
  });
  if (error) throw apiError(response, error);
  return data!;
}

/** The scope is fixed at creation: a `global` Asset holds one text, a `per_locale` one a text per locale. */
export async function createAsset(client: ApiClient, body: CreateAssetBody) {
  const { data, error, response } = await client.POST("/api/assets", { body });
  if (error) throw apiError(response, error);
  return data!;
}

export async function getAsset(client: ApiClient, id: string) {
  const { data, error, response } = await client.GET("/api/assets/{id}", {
    params: { path: { id } },
  });
  if (error) throw apiError(response, error);
  return data!;
}

export async function renameAsset(client: ApiClient, id: string, name: string) {
  const { data, error, response } = await client.PATCH("/api/assets/{id}", {
    params: { path: { id } },
    body: { name },
  });
  if (error) throw apiError(response, error);
  return data!;
}

/** Admin-only, and only for an Asset no Project attaches and no active Workflow reads. */
export async function deleteAsset(client: ApiClient, id: string) {
  const { error, response } = await client.DELETE("/api/assets/{id}", {
    params: { path: { id } },
  });
  if (error) throw apiError(response, error);
  return { deleted: true };
}

/**
 * Writes a text: a per-locale Asset takes a `locale`, a global one none. A new
 * style guide text, or a changed one with `invalidateTm`, marks the
 * translation memory entries of that locale stale for everything using it.
 */
export async function putAssetText(client: ApiClient, id: string, body: PutAssetTextBody) {
  const { data, error, response } = await client.PUT("/api/assets/{id}/texts", {
    params: { path: { id } },
    body,
  });
  if (error) throw apiError(response, error);
  return data!;
}

/** Deletes a per-locale Asset's text in `locale`, or a global one's text with none. */
export async function deleteAssetText(client: ApiClient, id: string, locale?: string) {
  const { error, response } = await client.DELETE("/api/assets/{id}/texts", {
    params: { path: { id }, query: locale === undefined ? {} : { locale } },
  });
  if (error) throw apiError(response, error);
  return { deleted: true };
}

export function register(group: Command, getClient: ClientFactory): void {
  group
    .command("list")
    .description("List the organisation's style guides and contexts, with their scope, locales and users")
    .addOption(new Option("--type <type>", "Only this type").choices([...ASSET_TYPES]))
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await listAssets(client, cmdOpts.type), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("create")
    .description("Create a style guide or context")
    .requiredOption("--name <name>", "Asset name")
    .addOption(new Option("--type <type>", "What it is").choices([...ASSET_TYPES]).makeOptionMandatory())
    .addOption(
      new Option("--scope <scope>", "One text for every language, or a text per locale (fixed at creation)")
        .choices([...ASSET_SCOPES])
        .makeOptionMandatory(),
    )
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await createAsset(client, { name: cmdOpts.name, type: cmdOpts.type, scope: cmdOpts.scope }), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("get")
    .description("Get a style guide or context with its texts and the Projects and Workflows using it")
    .requiredOption("--id <id>", "Asset UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await getAsset(client, cmdOpts.id), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("rename")
    .description("Rename a style guide or context")
    .requiredOption("--id <id>", "Asset UUID")
    .requiredOption("--name <name>", "New name")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await renameAsset(client, cmdOpts.id, cmdOpts.name), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("delete")
    .description(
      "Delete a style guide or context and its texts (admin only; only one no Project attaches and no active Workflow reads)",
    )
    .requiredOption("--id <id>", "Asset UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await deleteAsset(client, cmdOpts.id), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("set-text")
    .description("Write a text of a style guide or context: per locale with --locale, or a global Asset's one text")
    .requiredOption("--id <id>", "Asset UUID")
    .option("--locale <locale>", "The text's locale (BCP 47); only for a per-locale Asset")
    .option("--text <text>", "The text")
    .option("--file <path>", "Read the text from a file")
    .option("--invalidate-tm", "Style guide: mark that locale's translation memory entries stale for re-translation")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        if ((cmdOpts.text === undefined) === (cmdOpts.file === undefined)) {
          throw new Error("Pass exactly one of --text and --file");
        }
        const body: PutAssetTextBody = {
          text: cmdOpts.text ?? readFileSync(cmdOpts.file as string, "utf-8"),
        };
        if (cmdOpts.locale !== undefined) body.locale = cmdOpts.locale;
        if (cmdOpts.invalidateTm) body.invalidateTm = true;
        const client = await getClient();
        output(await putAssetText(client, cmdOpts.id, body), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("delete-text")
    .description("Delete a text of a style guide or context: per locale with --locale, or a global Asset's one text")
    .requiredOption("--id <id>", "Asset UUID")
    .option("--locale <locale>", "The text's locale (BCP 47); only for a per-locale Asset")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await deleteAssetText(client, cmdOpts.id, cmdOpts.locale), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });
}
