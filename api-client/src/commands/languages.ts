import type { Command } from 'commander';
import type { ApiClient } from '../client.js';
import { extractError } from '../client.js';
import { output, outputError, type OutputOptions } from '../format.js';

type ClientFactory = () => Promise<ApiClient>;

export async function listLanguages(client: ApiClient) {
  const { data, error, response } = await client.GET('/api/languages');
  if (error) throw new Error(extractError(response, error));
  return data;
}

export async function getLanguage(client: ApiClient, id: string) {
  const { data, error, response } = await client.GET('/api/languages/{id}', {
    params: { path: { id } },
  });
  if (error) throw new Error(extractError(response, error));
  return data;
}

export function register(group: Command, getClient: ClientFactory): void {
  group
    .command('list')
    .description('List languages')
    .action(async (_opts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await listLanguages(client), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command('get')
    .description('Get a language')
    .requiredOption('--id <id>', 'Language UUID')
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await getLanguage(client, cmdOpts.id), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });
}
