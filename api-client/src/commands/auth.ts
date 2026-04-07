import chalk from "chalk";
import type { Command } from "commander";
import { readConfigFile, writeConfigFile, deleteConfigFile } from "../auth.js";
import { generatePKCE, requestDeviceCode, pollForToken, openInBrowser, DeviceAuthError } from "../device-auth.js";
import { output, type OutputOptions } from "../format.js";

const DEFAULT_API_URL = "https://api.globalize.now";

export function register(group: Command) {
  group
    .command("login")
    .description("Authenticate with the Globalize API")
    .action(async () => {
      const apiUrl = process.env.GLOBALIZE_API_URL || DEFAULT_API_URL;

      const { codeVerifier, codeChallenge } = generatePKCE();

      let device;
      try {
        device = await requestDeviceCode(apiUrl, "cli", codeChallenge);
      } catch (err) {
        console.error(chalk.red(`Failed to start login: ${(err as Error).message}`));
        process.exitCode = 1;
        return;
      }

      console.log(`\nYour code: ${chalk.bold.cyan(device.user_code)}\n`);

      if (process.stdout.isTTY) {
        console.log(`Opening ${chalk.cyan(device.verification_uri_complete)} in your browser…`);
        console.log(chalk.dim("If the browser didn't open, visit the URL above manually.\n"));
        openInBrowser(device.verification_uri_complete);
      } else {
        console.log(`Visit ${device.verification_uri_complete} to authorize.\n`);
      }

      console.log(chalk.dim("Waiting for approval…"));

      try {
        const token = await pollForToken(apiUrl, device.device_code, codeVerifier, device.interval, device.expires_in);
        await writeConfigFile({ apiKey: token.api_key, apiUrl });
        console.log(
          chalk.green(`\nLogged in to ${chalk.bold(token.org.name)}. API key saved to ~/.globalize/config.json`),
        );
      } catch (err) {
        if (err instanceof DeviceAuthError) {
          console.error(chalk.red(`\nLogin failed: ${err.message}`));
        } else {
          console.error(chalk.red(`\nLogin failed: ${(err as Error).message}`));
        }
        process.exitCode = 1;
      }
    });

  group
    .command("status")
    .description("Show current authentication state")
    .action(async (_cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();

      let source: string;
      let keyPrefix: string;
      let apiUrl: string;

      if (process.env.GLOBALIZE_API_KEY) {
        const key = process.env.GLOBALIZE_API_KEY;
        source = "GLOBALIZE_API_KEY env var";
        keyPrefix = key.slice(0, 8) + "...";
        apiUrl = process.env.GLOBALIZE_API_URL || DEFAULT_API_URL;
      } else {
        const config = await readConfigFile();
        if (!config.apiKey) {
          console.log(chalk.yellow("Not authenticated. Run `globalise-now-cli auth login` to set up."));
          return;
        }
        source = "~/.globalize/config.json";
        keyPrefix = config.apiKey.slice(0, 8) + "...";
        apiUrl = config.apiUrl || DEFAULT_API_URL;
      }

      output({ source, key: keyPrefix, api: apiUrl }, opts);
    });

  group
    .command("logout")
    .description("Remove stored credentials")
    .action(async () => {
      await deleteConfigFile();
      console.log(chalk.green("Credentials removed."));
    });
}
