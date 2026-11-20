import type { Command } from "commander";
import type { ApiClient } from "../client.js";
import { apiError } from "../client.js";
import { output, outputError, type OutputOptions } from "../format.js";

type ClientFactory = () => Promise<ApiClient>;

/** @deprecated Use `getAsset` with the project's `styleGuideAsset.id`. */
export async function listStyleGuides(client: ApiClient, projectId: string) {
  const { data, error, response } = await client.GET("/api/projects/{id}/style-guides", {
    params: { path: { id: projectId } },
  });
  if (error) throw apiError(response, error);
  return data!;
}

/** @deprecated Use `putAssetText` with the project's `styleGuideAsset.id` and the language's locale. */
export async function upsertStyleGuide(client: ApiClient, projectId: string, languageId: string, instructions: string) {
  const { data, error, response } = await client.PUT("/api/projects/{id}/style-guides/{projectLanguageId}", {
    params: { path: { id: projectId, projectLanguageId: languageId } },
    body: { instructions },
  });
  if (error) throw apiError(response, error);
  return data!;
}

/** @deprecated Use `deleteAssetText` with the project's `styleGuideAsset.id` and the language's locale. */
export async function deleteStyleGuide(client: ApiClient, projectId: string, languageId: string) {
  const { data, error, response } = await client.DELETE("/api/projects/{id}/style-guides/{projectLanguageId}", {
    params: { path: { id: projectId, projectLanguageId: languageId } },
  });
  if (error) throw apiError(response, error);
  return data ?? { deleted: true };
}

/** @deprecated Project-only drafting; there is no Asset counterpart. */
export async function generateStyleGuide(client: ApiClient, projectId: string, languageId: string) {
  const { data, error, response } = await client.POST("/api/projects/{id}/style-guides/{projectLanguageId}/generate", {
    params: { path: { id: projectId, projectLanguageId: languageId } },
    body: {},
  });
  if (error) throw apiError(response, error);
  return data!;
}

/** @deprecated Project-only drafting; `putAssetText` with the project's `styleGuideAsset.id` writes a text. */
export async function applyStyleGuide(
  client: ApiClient,
  projectId: string,
  languageId: string,
  body: {
    generationId: string;
    instructions: string;
    context?: string | null;
    invalidateTm?: boolean;
  },
) {
  const { data, error, response } = await client.POST("/api/projects/{id}/style-guides/{projectLanguageId}/apply", {
    params: { path: { id: projectId, projectLanguageId: languageId } },
    body,
  });
  if (error) throw apiError(response, error);
  return data!;
}

/** @deprecated Project-only drafting quota; there is no Asset counterpart. */
export async function getStyleGuideQuota(client: ApiClient, projectId: string) {
  const { data, error, response } = await client.GET("/api/projects/{id}/style-guides/quota", {
    params: { path: { id: projectId } },
  });
  if (error) throw apiError(response, error);
  return data!;
}

export function register(group: Command, getClient: ClientFactory): void {
  group
    .command("list")
    .description("(deprecated: use `assets list --type style_guide`) List a Project's style guides")
    .requiredOption("--project-id <id>", "Project UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await listStyleGuides(client, cmdOpts.projectId), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("upsert")
    .description("(deprecated: use `assets set-text`) Create or update a Project style guide")
    .requiredOption("--project-id <id>", "Project UUID")
    .requiredOption("--language-id <id>", "Project language UUID")
    .requiredOption("--instructions <text>", "Style guide instructions")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await upsertStyleGuide(client, cmdOpts.projectId, cmdOpts.languageId, cmdOpts.instructions), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("delete")
    .description("(deprecated: use `assets delete-text`) Delete a Project style guide")
    .requiredOption("--project-id <id>", "Project UUID")
    .requiredOption("--language-id <id>", "Project language UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await deleteStyleGuide(client, cmdOpts.projectId, cmdOpts.languageId), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("generate")
    .description("(deprecated: use `assets`) Generate a Project style guide draft for a target language")
    .requiredOption("--project-id <id>", "Project UUID")
    .requiredOption("--language-id <id>", "Project language UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await generateStyleGuide(client, cmdOpts.projectId, cmdOpts.languageId), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("apply")
    .description("(deprecated: use `assets`) Apply a generated Project style guide draft")
    .requiredOption("--project-id <id>", "Project UUID")
    .requiredOption("--language-id <id>", "Project language UUID")
    .requiredOption("--generation-id <id>", "Generation UUID from a prior generate call")
    .requiredOption("--instructions <text>", "Style guide instructions")
    .option("--context <text>", "Optional context")
    .option("--invalidate-tm", "Invalidate translation memory")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const body: {
          generationId: string;
          instructions: string;
          context?: string | null;
          invalidateTm?: boolean;
        } = {
          generationId: cmdOpts.generationId,
          instructions: cmdOpts.instructions,
        };
        if (cmdOpts.context !== undefined) body.context = cmdOpts.context;
        if (cmdOpts.invalidateTm !== undefined) body.invalidateTm = cmdOpts.invalidateTm;
        output(await applyStyleGuide(client, cmdOpts.projectId, cmdOpts.languageId, body), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });

  group
    .command("quota")
    .description("(deprecated: use `assets`) Get a Project's per-language style-guide generation quota")
    .requiredOption("--project-id <id>", "Project UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await getStyleGuideQuota(client, cmdOpts.projectId), opts);
      } catch (e) {
        outputError(e, opts);
      }
    });
}
