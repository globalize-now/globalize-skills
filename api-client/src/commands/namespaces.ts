import type { Command } from "commander";
import type { ApiClient } from "../client.js";
import { extractError } from "../client.js";
import { output, outputError, type OutputOptions } from "../format.js";
import type { paths } from "../api-types.js";

type NamespaceUpdateBody =
  paths["/api/projects/{id}/namespaces/{namespaceId}"]["patch"]["requestBody"]["content"]["application/json"];

type ClientFactory = () => Promise<ApiClient>;

export async function listNamespaces(client: ApiClient, projectId: string) {
  const { data, error, response } = await client.GET("/api/projects/{id}/namespaces", {
    params: { path: { id: projectId } },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function updateNamespace(client: ApiClient, projectId: string, namespaceId: string, name: string) {
  const updates: NamespaceUpdateBody = { name };
  const { data, error, response } = await client.PATCH("/api/projects/{id}/namespaces/{namespaceId}", {
    params: { path: { id: projectId, namespaceId } },
    body: updates,
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function deleteNamespace(client: ApiClient, projectId: string, namespaceId: string) {
  const { data, error, response } = await client.DELETE("/api/projects/{id}/namespaces/{namespaceId}", {
    params: { path: { id: projectId, namespaceId } },
  });
  if (error) throw new Error(extractError(response, error));
  return data ?? { deleted: true };
}

export function register(group: Command, getClient: ClientFactory): void {
  group
    .command("list")
    .description("List namespaces")
    .requiredOption("--project-id <id>", "Project UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await listNamespaces(client, cmdOpts.projectId), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("update")
    .description("Update a namespace")
    .requiredOption("--project-id <id>", "Project UUID")
    .requiredOption("--namespace-id <id>", "Namespace UUID")
    .requiredOption("--name <name>", "Namespace name")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await updateNamespace(client, cmdOpts.projectId, cmdOpts.namespaceId, cmdOpts.name), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("delete")
    .description("Delete a namespace")
    .requiredOption("--project-id <id>", "Project UUID")
    .requiredOption("--namespace-id <id>", "Namespace UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await deleteNamespace(client, cmdOpts.projectId, cmdOpts.namespaceId), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });
}
