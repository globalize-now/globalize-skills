import type { Command } from "commander";
import type { ApiClient } from "../client.js";
import { extractError } from "../client.js";
import { output, outputError, type OutputOptions } from "../format.js";

type ClientFactory = () => Promise<ApiClient>;

export async function listOrgs(client: ApiClient) {
  const { data, error, response } = await client.GET("/api/orgs");
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function createOrg(client: ApiClient, name: string) {
  const { data, error, response } = await client.POST("/api/orgs", {
    body: { name },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function deleteOrg(client: ApiClient, orgId: string) {
  const { data, error, response } = await client.DELETE("/api/orgs/{orgId}", {
    params: { path: { orgId } },
  });
  if (error) throw new Error(extractError(response, error));
  return data ?? { deleted: true };
}

export function register(group: Command, getClient: ClientFactory): void {
  group
    .command("list")
    .description("List organisations")
    .action(async (_opts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await listOrgs(client), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("create")
    .description("Create an organisation")
    .requiredOption("--name <name>", "Organisation name")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await createOrg(client, cmdOpts.name), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("delete")
    .description("Delete an organisation")
    .requiredOption("--id <orgId>", "Organisation UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await deleteOrg(client, cmdOpts.id), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });
}
