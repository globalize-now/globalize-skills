import type { Command } from "commander";
import type { ApiClient } from "../client.js";
import { extractError } from "../client.js";
import { output, outputError, type OutputOptions } from "../format.js";

type ClientFactory = () => Promise<ApiClient>;

export async function listStyleGuides(client: ApiClient, projectId: string) {
  const { data, error, response } = await client.GET("/api/projects/{id}/style-guides", {
    params: { path: { id: projectId } },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function upsertStyleGuide(client: ApiClient, projectId: string, languageId: string, instructions: string) {
  const { data, error, response } = await client.PUT("/api/projects/{id}/style-guides/{projectLanguageId}", {
    params: { path: { id: projectId, projectLanguageId: languageId } },
    body: { instructions },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function deleteStyleGuide(client: ApiClient, projectId: string, languageId: string) {
  const { data, error, response } = await client.DELETE("/api/projects/{id}/style-guides/{projectLanguageId}", {
    params: { path: { id: projectId, projectLanguageId: languageId } },
  });
  if (error) throw new Error(extractError(response, error));
  return data ?? { deleted: true };
}

export async function generateStyleGuide(client: ApiClient, projectId: string, languageId: string) {
  const { data, error, response } = await client.POST("/api/projects/{id}/style-guides/{projectLanguageId}/generate", {
    params: { path: { id: projectId, projectLanguageId: languageId } },
    body: {},
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

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
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function getStyleGuideQuota(client: ApiClient, projectId: string) {
  const { data, error, response } = await client.GET("/api/projects/{id}/style-guides/quota", {
    params: { path: { id: projectId } },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export function register(group: Command, getClient: ClientFactory): void {
  group
    .command("list")
    .description("List style guides")
    .requiredOption("--project-id <id>", "Project UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await listStyleGuides(client, cmdOpts.projectId), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("upsert")
    .description("Create or update a style guide")
    .requiredOption("--project-id <id>", "Project UUID")
    .requiredOption("--language-id <id>", "Project language UUID")
    .requiredOption("--instructions <text>", "Style guide instructions")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await upsertStyleGuide(client, cmdOpts.projectId, cmdOpts.languageId, cmdOpts.instructions), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("delete")
    .description("Delete a style guide")
    .requiredOption("--project-id <id>", "Project UUID")
    .requiredOption("--language-id <id>", "Project language UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await deleteStyleGuide(client, cmdOpts.projectId, cmdOpts.languageId), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("generate")
    .description("Generate a style guide draft for a target language")
    .requiredOption("--project-id <id>", "Project UUID")
    .requiredOption("--language-id <id>", "Project language UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await generateStyleGuide(client, cmdOpts.projectId, cmdOpts.languageId), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("apply")
    .description("Apply a generated style guide draft")
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
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("quota")
    .description("Get per-language style-guide generation quota")
    .requiredOption("--project-id <id>", "Project UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await getStyleGuideQuota(client, cmdOpts.projectId), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });
}
