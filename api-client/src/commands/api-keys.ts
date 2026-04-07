import type { Command } from "commander";
import type { ApiClient } from "../client.js";
import { extractError } from "../client.js";
import { output, outputError, type OutputOptions } from "../format.js";

type ClientFactory = () => Promise<ApiClient>;

export async function listApiKeys(client: ApiClient, orgId: string) {
  const { data, error, response } = await client.GET("/api/orgs/{orgId}/api-keys", {
    params: { path: { orgId } },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function createApiKey(client: ApiClient, orgId: string, name: string) {
  const { data, error, response } = await client.POST("/api/orgs/{orgId}/api-keys", {
    params: { path: { orgId } },
    body: { name },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function revokeApiKey(client: ApiClient, orgId: string, keyId: string) {
  const { data, error, response } = await client.DELETE("/api/orgs/{orgId}/api-keys/{keyId}", {
    params: { path: { orgId, keyId } },
  });
  if (error) throw new Error(extractError(response, error));
  return data ?? { revoked: true };
}

export function register(group: Command, getClient: ClientFactory): void {
  group
    .command("list")
    .description("List API keys")
    .requiredOption("--org-id <id>", "Organisation UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await listApiKeys(client, cmdOpts.orgId), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("create")
    .description("Create an API key")
    .requiredOption("--org-id <id>", "Organisation UUID")
    .requiredOption("--name <name>", "API key name")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await createApiKey(client, cmdOpts.orgId, cmdOpts.name), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("revoke")
    .description("Revoke an API key")
    .requiredOption("--org-id <id>", "Organisation UUID")
    .requiredOption("--key-id <id>", "API key UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await revokeApiKey(client, cmdOpts.orgId, cmdOpts.keyId), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });
}
