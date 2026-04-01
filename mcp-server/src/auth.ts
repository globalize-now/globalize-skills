import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CONFIG_DIR = join(homedir(), '.globalize');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');
const DEFAULT_API_URL = 'https://api.globalize.now';

interface AuthConfig {
  apiKey: string;
  apiUrl: string;
}

async function readConfigFile(): Promise<Partial<AuthConfig>> {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeConfigFile(config: AuthConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

async function promptForApiKey(apiUrl: string): Promise<string> {
  const settingsUrl = 'https://app.globalize.now/settings/api-keys';
  // Log to stderr so it doesn't interfere with stdio MCP transport on stdout
  console.error(`\nNo API key found. Create one at: ${settingsUrl}\n`);
  console.error('Paste your API key below:');

  const chunks: Buffer[] = [];
  process.stdin.resume();
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
    const text = Buffer.concat(chunks).toString().trim();
    if (text.length > 0) {
      process.stdin.pause();
      const apiKey = text;
      await writeConfigFile({ apiKey, apiUrl });
      console.error('API key saved to ~/.globalize/config.json');
      return apiKey;
    }
  }
  throw new Error('No API key provided');
}

export async function resolveAuth(): Promise<AuthConfig> {
  const apiUrl = process.env.GLOBALIZE_API_URL || DEFAULT_API_URL;

  // 1. Environment variable
  if (process.env.GLOBALIZE_API_KEY) {
    return { apiKey: process.env.GLOBALIZE_API_KEY, apiUrl };
  }

  // 2. Config file
  const config = await readConfigFile();
  if (config.apiKey) {
    return { apiKey: config.apiKey, apiUrl: config.apiUrl || apiUrl };
  }

  // 3. Interactive prompt
  const apiKey = await promptForApiKey(apiUrl);
  return { apiKey, apiUrl };
}
