import { createInterface } from 'node:readline/promises';
import chalk from 'chalk';
import type { Command } from 'commander';
import { readConfigFile, writeConfigFile, deleteConfigFile } from '../auth.js';
import { output, type OutputOptions } from '../format.js';

const SETTINGS_URL = 'https://app.globalize.now/settings/api-keys';
const DEFAULT_API_URL = 'https://api.globalize.now';

export function register(group: Command) {
  group
    .command('login')
    .description('Authenticate with the Globalize API')
    .action(async () => {
      const apiUrl = process.env.GLOBALIZE_API_URL || DEFAULT_API_URL;

      console.log(`\nCreate or copy an API key from: ${chalk.cyan(SETTINGS_URL)}\n`);

      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        const apiKey = (await rl.question('Paste your API key: ')).trim();
        if (!apiKey) {
          console.error(chalk.red('No API key provided.'));
          process.exitCode = 1;
          return;
        }
        await writeConfigFile({ apiKey, apiUrl });
        console.log(chalk.green('API key saved to ~/.globalize/config.json'));
      } finally {
        rl.close();
      }
    });

  group
    .command('status')
    .description('Show current authentication state')
    .action(async (_cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();

      let source: string;
      let keyPrefix: string;
      let apiUrl: string;

      if (process.env.GLOBALIZE_API_KEY) {
        const key = process.env.GLOBALIZE_API_KEY;
        source = 'GLOBALIZE_API_KEY env var';
        keyPrefix = key.slice(0, 8) + '...';
        apiUrl = process.env.GLOBALIZE_API_URL || DEFAULT_API_URL;
      } else {
        const config = await readConfigFile();
        if (!config.apiKey) {
          console.log(chalk.yellow('Not authenticated. Run `globalise-now-cli auth login` to set up.'));
          return;
        }
        source = '~/.globalize/config.json';
        keyPrefix = config.apiKey.slice(0, 8) + '...';
        apiUrl = config.apiUrl || DEFAULT_API_URL;
      }

      output({ source, key: keyPrefix, api: apiUrl }, opts);
    });

  group
    .command('logout')
    .description('Remove stored credentials')
    .action(async () => {
      await deleteConfigFile();
      console.log(chalk.green('Credentials removed.'));
    });
}
