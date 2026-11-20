import chalk from "chalk";
import { resolveAuth } from "./auth.js";
import { createApiClient, type ApiClient } from "./client.js";
import { createProgram } from "./program.js";

// Lazy client: resolved once on first API call
let cachedClient: ApiClient | undefined;

async function getClient(): Promise<ApiClient> {
  if (cachedClient) return cachedClient;
  try {
    const { apiKey, apiUrl } = await resolveAuth();
    cachedClient = createApiClient(apiKey, apiUrl);
    return cachedClient;
  } catch (e) {
    process.stderr.write(chalk.red((e as Error).message) + "\n");
    process.exit(1);
  }
}

await createProgram(getClient).parseAsync();
