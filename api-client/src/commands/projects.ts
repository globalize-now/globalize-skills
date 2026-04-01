import type { Command } from 'commander';
import type { ApiClient } from '../client.js';
import { extractError } from '../client.js';
import { output, outputError, type OutputOptions } from '../format.js';

type ClientFactory = () => Promise<ApiClient>;

export async function listProjects(client: ApiClient) {
  const { data, error, response } = await client.GET('/api/projects');
  if (error) throw new Error(extractError(response, error));
  return data;
}

export async function createProject(
  client: ApiClient,
  name: string,
  sourceLanguage: string,
  targetLanguages: string[],
) {
  const { data, error, response } = await client.POST('/api/projects', {
    body: { name, sourceLanguage, targetLanguages },
  });
  if (error) throw new Error(extractError(response, error));
  return data;
}

export async function getProject(client: ApiClient, id: string) {
  const { data, error, response } = await client.GET('/api/projects/{id}', {
    params: { path: { id } },
  });
  if (error) throw new Error(extractError(response, error));
  return data;
}

export async function deleteProject(client: ApiClient, id: string) {
  const { data, error, response } = await client.DELETE('/api/projects/{id}', {
    params: { path: { id } },
  });
  if (error) throw new Error(extractError(response, error));
  return data ?? { deleted: true };
}

export function register(group: Command, getClient: ClientFactory): void {
  group
    .command('list')
    .description('List projects')
    .action(async (_opts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await listProjects(client), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command('create')
    .description('Create a project')
    .requiredOption('--name <name>', 'Project name')
    .requiredOption('--source-language <id>', 'Source language ID')
    .requiredOption('--target-languages <ids...>', 'Target language IDs (variadic or comma-separated)')
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const targetLanguages: string[] = Array.isArray(cmdOpts.targetLanguages)
          ? cmdOpts.targetLanguages.flatMap((s: string) => s.split(',').map((x: string) => x.trim()).filter(Boolean))
          : String(cmdOpts.targetLanguages).split(',').map((x: string) => x.trim()).filter(Boolean);
        output(await createProject(client, cmdOpts.name, cmdOpts.sourceLanguage, targetLanguages), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command('get')
    .description('Get a project')
    .requiredOption('--id <id>', 'Project UUID')
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await getProject(client, cmdOpts.id), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command('delete')
    .description('Delete a project')
    .requiredOption('--id <id>', 'Project UUID')
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await deleteProject(client, cmdOpts.id), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });
}
