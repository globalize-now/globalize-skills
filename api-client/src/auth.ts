import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CONFIG_DIR = join(homedir(), '.globalize');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');
const DEFAULT_API_URL = 'https://api.globalize.now';

export interface AuthConfig {
  apiKey: string;
  apiUrl: string;
}

export async function readConfigFile(): Promise<Partial<AuthConfig>> {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function writeConfigFile(config: AuthConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export async function deleteConfigFile(): Promise<void> {
  try {
    await unlink(CONFIG_PATH);
  } catch {
    // File doesn't exist, that's fine
  }
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

  throw new Error(
    'No API key found. Run `globalise-now-cli auth login` to authenticate, or set GLOBALIZE_API_KEY.'
  );
}
