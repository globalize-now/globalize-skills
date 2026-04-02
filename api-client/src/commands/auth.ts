import chalk from 'chalk';
import type { Command } from 'commander';
import { readConfigFile, writeConfigFile, deleteConfigFile } from '../auth.js';
import {
  generatePKCE,
  requestDeviceCode,
  pollForToken,
  openInBrowser,
  DeviceAuthError,
} from '../device-auth.js';

const DEFAULT_API_URL = 'https://api.globalize.now';

export function register(group: Command): void {
  group
    .command('login')
    .description('Authenticate with the Globalize API')
    .option('--api-key <key>', 'Provide an API key directly (for CI/scripts)')
    .action(async (opts: { apiKey?: string }) => {
      const apiUrl = process.env.GLOBALIZE_API_URL || DEFAULT_API_URL;

      // Manual API key mode (CI / non-interactive)
      if (opts.apiKey) {
        await writeConfigFile({ apiKey: opts.apiKey, apiUrl });
        console.log(chalk.green('API key saved to ~/.globalize/config.json'));
        return;
      }

      // Device auth flow
      try {
        const { codeVerifier, codeChallenge } = generatePKCE();

        const device = await requestDeviceCode(apiUrl, 'cli', codeChallenge);

        console.log();
        console.log(`Your code: ${chalk.bold.cyan(device.user_code)}`);
        console.log();
        console.log(`Opening browser to approve... If it doesn't open, visit:`);
        console.log(chalk.dim(device.verification_uri_complete));
        console.log();

        openInBrowser(device.verification_uri_complete);

        console.log(chalk.dim('Waiting for approval...'));

        const token = await pollForToken(
          apiUrl,
          device.device_code,
          codeVerifier,
          device.interval,
          device.expires_in,
        );

        await writeConfigFile({ apiKey: token.api_key, apiUrl });

        console.log();
        console.log(chalk.green(`Authenticated as org "${token.org.name}".`));
        console.log(chalk.green('API key saved to ~/.globalize/config.json'));
      } catch (err) {
        if (err instanceof DeviceAuthError) {
          console.error(chalk.red(err.message));
        } else {
          console.error(chalk.red(`Login failed: ${(err as Error).message}`));
        }
        process.exitCode = 1;
      }
    });

  group
    .command('status')
    .description('Show current authentication state')
    .action(async () => {
      if (process.env.GLOBALIZE_API_KEY) {
        const key = process.env.GLOBALIZE_API_KEY;
        console.log(`Source:  ${chalk.cyan('GLOBALIZE_API_KEY env var')}`);
        console.log(`Key:    ${chalk.dim(key.slice(0, 8) + '...')}`);
        console.log(`API:    ${process.env.GLOBALIZE_API_URL || DEFAULT_API_URL}`);
        return;
      }

      const config = await readConfigFile();
      if (config.apiKey) {
        console.log(`Source:  ${chalk.cyan('~/.globalize/config.json')}`);
        console.log(`Key:    ${chalk.dim(config.apiKey.slice(0, 8) + '...')}`);
        console.log(`API:    ${config.apiUrl || DEFAULT_API_URL}`);
      } else {
        console.log(chalk.yellow('Not authenticated. Run `globalise-now-cli auth login` to set up.'));
      }
    });

  group
    .command('logout')
    .description('Remove stored credentials')
    .action(async () => {
      await deleteConfigFile();
      console.log(chalk.green('Credentials removed.'));
    });
}
