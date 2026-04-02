import type { Command } from 'commander';
import type { ApiClient } from '../client.js';
import { extractError } from '../client.js';
import { output, outputError, type OutputOptions } from '../format.js';

type ClientFactory = () => Promise<ApiClient>;

export async function listGlossary(client: ApiClient, projectId: string) {
  const { data, error, response } = await client.GET('/api/projects/{id}/glossary', {
    params: { path: { id: projectId } },
  });
  if (error) throw new Error(extractError(response, error));
  return data;
}

export async function createGlossaryEntry(
  client: ApiClient,
  projectId: string,
  sourceTerm: string,
  targetTerm: string,
  sourceProjectLanguageId: string,
  targetProjectLanguageId: string,
) {
  const { data, error, response } = await client.POST('/api/projects/{id}/glossary', {
    params: { path: { id: projectId } },
    body: { sourceTerm, targetTerm, sourceProjectLanguageId, targetProjectLanguageId },
  });
  if (error) throw new Error(extractError(response, error));
  return data;
}

export async function deleteGlossaryEntry(
  client: ApiClient,
  projectId: string,
  entryId: string,
) {
  const { data, error, response } = await client.DELETE(
    '/api/projects/{id}/glossary/{entryId}',
    {
      params: { path: { id: projectId, entryId } },
    },
  );
  if (error) throw new Error(extractError(response, error));
  return data ?? { deleted: true };
}

export function register(group: Command, getClient: ClientFactory): void {
  group
    .command('list')
    .description('List glossary entries')
    .requiredOption('--project-id <id>', 'Project UUID')
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
    .command('create')
    .description('Create a glossary entry')
    .requiredOption('--project-id <id>', 'Project UUID')
    .requiredOption('--source-term <term>', 'Source term')
    .requiredOption('--target-term <term>', 'Target term')
    .requiredOption('--source-language-id <id>', 'Source project language UUID')
    .requiredOption('--target-language-id <id>', 'Target project language UUID')
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
          ),
          opts,
        );
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command('delete')
    .description('Delete a glossary entry')
    .requiredOption('--project-id <id>', 'Project UUID')
    .requiredOption('--entry-id <id>', 'Glossary entry UUID')
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
