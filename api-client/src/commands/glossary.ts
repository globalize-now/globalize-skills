import type { Command } from "commander";
import type { ApiClient } from "../client.js";
import { extractError } from "../client.js";
import { output, outputError, type OutputOptions } from "../format.js";
import type { paths } from "../api-types.js";

type BulkEntries =
  paths["/api/projects/{id}/glossary/bulk"]["post"]["requestBody"]["content"]["application/json"]["entries"];
type PreviewKeys =
  paths["/api/projects/{id}/glossary/preview"]["post"]["requestBody"]["content"]["application/json"]["keys"];

type ClientFactory = () => Promise<ApiClient>;

export async function listGlossary(client: ApiClient, projectId: string) {
  const { data, error, response } = await client.GET("/api/projects/{id}/glossary", {
    params: { path: { id: projectId } },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function createGlossaryEntry(
  client: ApiClient,
  projectId: string,
  sourceTerm: string,
  targetTerm: string,
  sourceProjectLanguageId: string,
  targetProjectLanguageId: string,
  doNotTranslate?: boolean,
) {
  const { data, error, response } = await client.POST("/api/projects/{id}/glossary", {
    params: { path: { id: projectId } },
    body: { sourceTerm, targetTerm, sourceProjectLanguageId, targetProjectLanguageId, doNotTranslate },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function bulkCreateGlossaryEntries(client: ApiClient, projectId: string, entries: BulkEntries) {
  const { data, error, response } = await client.POST("/api/projects/{id}/glossary/bulk", {
    params: { path: { id: projectId } },
    body: { entries },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function previewGlossaryImport(client: ApiClient, projectId: string, keys: PreviewKeys) {
  const { data, error, response } = await client.POST("/api/projects/{id}/glossary/preview", {
    params: { path: { id: projectId } },
    body: { keys },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function deleteGlossaryEntry(client: ApiClient, projectId: string, entryId: string) {
  const { data, error, response } = await client.DELETE("/api/projects/{id}/glossary/{entryId}", {
    params: { path: { id: projectId, entryId } },
  });
  if (error) throw new Error(extractError(response, error));
  return data ?? { deleted: true };
}

export function register(group: Command, getClient: ClientFactory): void {
  group
    .command("list")
    .description("List glossary entries")
    .requiredOption("--project-id <id>", "Project UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await listGlossary(client, cmdOpts.projectId), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("create")
    .description("Create a glossary entry")
    .requiredOption("--project-id <id>", "Project UUID")
    .requiredOption("--source-term <term>", "Source term")
    .requiredOption("--target-term <term>", "Target term")
    .requiredOption("--source-language-id <id>", "Source project language UUID")
    .requiredOption("--target-language-id <id>", "Target project language UUID")
    .option("--do-not-translate", "Keep the source term verbatim instead of translating it")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(
          await createGlossaryEntry(
            client,
            cmdOpts.projectId,
            cmdOpts.sourceTerm,
            cmdOpts.targetTerm,
            cmdOpts.sourceLanguageId,
            cmdOpts.targetLanguageId,
            cmdOpts.doNotTranslate,
          ),
          opts,
        );
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("bulk")
    .description("Bulk upsert glossary entries (max 10000, one transaction)")
    .requiredOption("--project-id <id>", "Project UUID")
    .requiredOption(
      "--entries <json>",
      "Entries as JSON array of {sourceTerm, targetTerm, sourceProjectLanguageId, targetProjectLanguageId, doNotTranslate?}",
    )
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        let entries: BulkEntries;
        try {
          entries = JSON.parse(cmdOpts.entries);
        } catch {
          throw new Error(`Invalid JSON for --entries: ${cmdOpts.entries}`);
        }
        output(await bulkCreateGlossaryEntries(client, cmdOpts.projectId, entries), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("preview")
    .description("Preview a bulk import: how many entries would be created vs updated (writes nothing)")
    .requiredOption("--project-id <id>", "Project UUID")
    .requiredOption(
      "--keys <json>",
      "Keys as JSON array of {sourceTerm, sourceProjectLanguageId, targetProjectLanguageId}",
    )
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        let keys: PreviewKeys;
        try {
          keys = JSON.parse(cmdOpts.keys);
        } catch {
          throw new Error(`Invalid JSON for --keys: ${cmdOpts.keys}`);
        }
        output(await previewGlossaryImport(client, cmdOpts.projectId, keys), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("delete")
    .description("Delete a glossary entry")
    .requiredOption("--project-id <id>", "Project UUID")
    .requiredOption("--entry-id <id>", "Glossary entry UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await deleteGlossaryEntry(client, cmdOpts.projectId, cmdOpts.entryId), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });
}
