import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  generatePKCE,
  requestDeviceCode,
  pollForToken,
  openInBrowser,
} from './device-auth.js';

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

async function deviceAuthFlow(apiUrl: string): Promise<string> {
  const { codeVerifier, codeChallenge } = generatePKCE();

  const device = await requestDeviceCode(apiUrl, 'mcp', codeChallenge);

  // Log to stderr so it doesn't interfere with stdio MCP transport on stdout
  console.error();
  console.error(`No API key found. Approve this device to authenticate.`);
  console.error();
  console.error(`Your code: ${device.user_code}`);
  console.error();
  console.error(`If your browser doesn't open, visit:`);
  console.error(device.verification_uri_complete);
  console.error();

  openInBrowser(device.verification_uri_complete);

  console.error('Waiting for approval...');

  const token = await pollForToken(
    apiUrl,
    device.device_code,
    codeVerifier,
    device.interval,
    device.expires_in,
  );

  await writeConfigFile({ apiKey: token.api_key, apiUrl });
  console.error(`Authenticated as org "${token.org.name}". API key saved.`);

  return token.api_key;
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

  // 3. Device auth flow
  const apiKey = await deviceAuthFlow(apiUrl);
  return { apiKey, apiUrl };
}
