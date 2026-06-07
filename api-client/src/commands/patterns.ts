import { Command, Option } from "commander";
import type { ApiClient } from "../client.js";
import { extractError } from "../client.js";
import { output, outputError, type OutputOptions } from "../format.js";
import { FILE_FORMATS, type FileFormat } from "../file-formats.js";

type ClientFactory = () => Promise<ApiClient>;

export async function listPatterns(client: ApiClient, repositoryId: string) {
  const { data, error, response } = await client.GET("/api/repositories/{id}/patterns", {
    params: { path: { id: repositoryId } },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function createPattern(
  client: ApiClient,
  repositoryId: string,
  pattern: string,
  fileFormat: FileFormat,
  position?: number,
) {
  const { data, error, response } = await client.POST("/api/repositories/{id}/patterns", {
    params: { path: { id: repositoryId } },
    body: { pattern, fileFormat, position },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function updatePattern(
  client: ApiClient,
  repoId: string,
  patternId: string,
  updates: {
    pattern?: string;
    fileFormat?: FileFormat;
  },
) {
  const { data, error, response } = await client.PATCH("/api/repositories/{repoId}/patterns/{patternId}", {
    params: { path: { repoId, patternId } },
    body: updates,
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function deletePattern(client: ApiClient, repoId: string, patternId: string) {
  const { data, error, response } = await client.DELETE("/api/repositories/{repoId}/patterns/{patternId}", {
    params: { path: { repoId, patternId } },
  });
  if (error) throw new Error(extractError(response, error));
  return data ?? { deleted: true };
}

export async function reorderPattern(client: ApiClient, repositoryId: string, patternId: string, position: number) {
  const { data, error, response } = await client.POST("/api/repositories/{id}/patterns/reorder", {
    params: { path: { id: repositoryId } },
    body: { patternId, position },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function bulkCreatePatterns(
  client: ApiClient,
  repositoryId: string,
  patterns: {
    pattern: string;
    fileFormat: FileFormat;
  }[],
) {
  const { data, error, response } = await client.POST("/api/repositories/{id}/patterns/bulk", {
    params: { path: { id: repositoryId } },
    body: { patterns },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export function register(group: Command, getClient: ClientFactory): void {
  group
    .command("list")
    .description("List patterns for a repository")
    .requiredOption("--repository-id <id>", "Repository UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await listPatterns(client, cmdOpts.repositoryId), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("create")
    .description("Create a pattern")
    .requiredOption("--repository-id <id>", "Repository UUID")
    .requiredOption("--pattern <pattern>", "Locale path pattern")
    .addOption(new Option("--file-format <format>", "File format").choices(FILE_FORMATS).makeOptionMandatory())
    .option("--position <n>", "Position", parseInt)
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(
          await createPattern(client, cmdOpts.repositoryId, cmdOpts.pattern, cmdOpts.fileFormat, cmdOpts.position),
          opts,
        );
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("update")
    .description("Update a pattern")
    .requiredOption("--repository-id <id>", "Repository UUID")
    .requiredOption("--pattern-id <id>", "Pattern UUID")
    .option("--pattern <pattern>", "Locale path pattern")
    .addOption(new Option("--file-format <format>", "File format").choices(FILE_FORMATS))
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const updates: Record<string, unknown> = {};
        if (cmdOpts.pattern !== undefined) updates.pattern = cmdOpts.pattern;
        if (cmdOpts.fileFormat !== undefined) updates.fileFormat = cmdOpts.fileFormat;
        output(await updatePattern(client, cmdOpts.repositoryId, cmdOpts.patternId, updates), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("delete")
    .description("Delete a pattern")
    .requiredOption("--repository-id <id>", "Repository UUID")
    .requiredOption("--pattern-id <id>", "Pattern UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await deletePattern(client, cmdOpts.repositoryId, cmdOpts.patternId), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("reorder")
    .description("Reorder a pattern")
    .requiredOption("--repository-id <id>", "Repository UUID")
    .requiredOption("--pattern-id <id>", "Pattern UUID")
    .requiredOption("--position <n>", "New position", parseInt)
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await reorderPattern(client, cmdOpts.repositoryId, cmdOpts.patternId, cmdOpts.position), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("bulk")
    .description("Bulk create patterns (skips existing)")
    .requiredOption("--repository-id <id>", "Repository UUID")
    .requiredOption("--patterns <json>", "Patterns as JSON array of {pattern, fileFormat}")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        let patterns: { pattern: string; fileFormat: FileFormat }[];
        try {
          patterns = JSON.parse(cmdOpts.patterns);
        } catch {
          throw new Error(`Invalid JSON for --patterns: ${cmdOpts.patterns}`);
        }
        output(await bulkCreatePatterns(client, cmdOpts.repositoryId, patterns), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });
}
