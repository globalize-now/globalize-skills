import { Command, Option } from "commander";
import type { ApiClient } from "../client.js";
import { extractError } from "../client.js";
import { output, outputError, type OutputOptions } from "../format.js";

type ClientFactory = () => Promise<ApiClient>;

export async function listRepositories(client: ApiClient, projectId: string) {
  const { data, error, response } = await client.GET("/api/repositories", {
    params: { query: { projectId } },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function createRepository(
  client: ApiClient,
  options: {
    projectId: string;
    gitUrl: string;
    provider: "github" | "gitlab";
    branches?: string[];
    patterns?: { pattern: string; fileFormat: "json-flat" | "json-nested" | "xliff" | "xliff-2" | "xliff-1.2" | "yaml" | "po" }[];
    githubInstallationId?: string;
    gitlabConnectionId?: string;
    importMode?: "ignore" | "reviewed" | "translated";
    importScope?: "new_keys_only" | "all_keys";
    detectedFramework?: string | null;
  },
) {
  const { data, error, response } = await client.POST("/api/repositories", {
    body: {
      projectId: options.projectId,
      gitUrl: options.gitUrl,
      provider: options.provider,
      branches: options.branches,
      patterns: options.patterns,
      githubInstallationId: options.githubInstallationId,
      gitlabConnectionId: options.gitlabConnectionId,
      importMode: options.importMode,
      importScope: options.importScope,
      detectedFramework: options.detectedFramework,
    },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function updateRepository(
  client: ApiClient,
  id: string,
  updates: {
    gitUrl?: string;
    branches?: string[];
    githubInstallationId?: string;
    gitlabConnectionId?: string;
    provider?: "github" | "gitlab";
    importMode?: "ignore" | "reviewed" | "translated";
    importScope?: "new_keys_only" | "all_keys";
    detectedFramework?: string | null;
  },
) {
  const { data, error, response } = await client.PATCH("/api/repositories/{id}", {
    params: { path: { id } },
    body: updates,
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function deleteRepository(client: ApiClient, id: string) {
  const { data, error, response } = await client.DELETE("/api/repositories/{id}", {
    params: { path: { id } },
  });
  if (error) throw new Error(extractError(response, error));
  return data ?? { deleted: true };
}

export async function detectRepository(client: ApiClient, id: string) {
  const { data, error, response } = await client.POST("/api/repositories/{id}/detect", {
    params: { path: { id } },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function listRepositoryBranches(client: ApiClient, id: string) {
  const { data, error, response } = await client.GET("/api/repositories/{id}/branches", {
    params: { path: { id } },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export function register(group: Command, getClient: ClientFactory): void {
  group
    .command("list")
    .description("List repositories")
    .requiredOption("--project-id <id>", "Project UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await listRepositories(client, cmdOpts.projectId), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("create")
    .description("Create a repository")
    .requiredOption("--project-id <id>", "Project UUID")
    .requiredOption("--git-url <url>", "Git repository URL")
    .addOption(new Option("--provider <provider>", "Git provider").choices(["github", "gitlab"]).makeOptionMandatory())
    .option("--branches <branches...>", "Branches to track")
    .option("--patterns <json>", "Patterns as JSON array of {pattern, fileFormat}")
    .option("--github-installation-id <id>", "GitHub App installation ID")
    .option("--gitlab-connection-id <id>", "GitLab connection UUID")
    .addOption(new Option("--import-mode <mode>", "Import mode").choices(["ignore", "reviewed", "translated"]))
    .addOption(new Option("--import-scope <scope>", "Import scope").choices(["new_keys_only", "all_keys"]))
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const patterns = cmdOpts.patterns ? JSON.parse(cmdOpts.patterns) : undefined;
        output(
          await createRepository(client, {
            projectId: cmdOpts.projectId,
            gitUrl: cmdOpts.gitUrl,
            provider: cmdOpts.provider,
            branches: cmdOpts.branches,
            patterns,
            githubInstallationId: cmdOpts.githubInstallationId,
            gitlabConnectionId: cmdOpts.gitlabConnectionId,
            importMode: cmdOpts.importMode,
            importScope: cmdOpts.importScope,
          }),
          opts,
        );
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("update")
    .description("Update a repository")
    .requiredOption("--id <id>", "Repository UUID")
    .option("--git-url <url>", "Git repository URL")
    .option("--branches <branches...>", "Branches to track")
    .option("--github-installation-id <id>", "GitHub App installation ID")
    .option("--gitlab-connection-id <id>", "GitLab connection UUID")
    .addOption(new Option("--provider <provider>", "Git provider").choices(["github", "gitlab"]))
    .option("--detected-framework <framework>", "Detected framework")
    .addOption(new Option("--import-mode <mode>", "Import mode").choices(["ignore", "reviewed", "translated"]))
    .addOption(new Option("--import-scope <scope>", "Import scope").choices(["new_keys_only", "all_keys"]))
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const updates: Record<string, unknown> = {};
        if (cmdOpts.gitUrl !== undefined) updates.gitUrl = cmdOpts.gitUrl;
        if (cmdOpts.branches !== undefined) updates.branches = cmdOpts.branches;
        if (cmdOpts.githubInstallationId !== undefined) updates.githubInstallationId = cmdOpts.githubInstallationId;
        if (cmdOpts.gitlabConnectionId !== undefined) updates.gitlabConnectionId = cmdOpts.gitlabConnectionId;
        if (cmdOpts.provider !== undefined) updates.provider = cmdOpts.provider;
        if (cmdOpts.detectedFramework !== undefined) updates.detectedFramework = cmdOpts.detectedFramework;
        if (cmdOpts.importMode !== undefined) updates.importMode = cmdOpts.importMode;
        if (cmdOpts.importScope !== undefined) updates.importScope = cmdOpts.importScope;
        output(await updateRepository(client, cmdOpts.id, updates), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("delete")
    .description("Delete a repository")
    .requiredOption("--id <id>", "Repository UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await deleteRepository(client, cmdOpts.id), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("detect")
    .description("Detect repository configuration")
    .requiredOption("--id <id>", "Repository UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await detectRepository(client, cmdOpts.id), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("branches")
    .description("List branches from the connected provider")
    .requiredOption("--id <id>", "Repository UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await listRepositoryBranches(client, cmdOpts.id), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });
}
