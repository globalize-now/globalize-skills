import { Command } from "commander";
import chalk from "chalk";
import { resolveAuth } from "./auth.js";
import { createApiClient, type ApiClient } from "./client.js";
import { register as registerOrgs } from "./commands/orgs.js";
import { register as registerProjects } from "./commands/projects.js";
import { register as registerLanguages } from "./commands/languages.js";
import { register as registerProjectLanguages } from "./commands/project-languages.js";
import { register as registerRepositories } from "./commands/repositories.js";
import { register as registerGlossary } from "./commands/glossary.js";
import { register as registerStyleGuides } from "./commands/style-guides.js";
import { register as registerApiKeys } from "./commands/api-keys.js";
import { register as registerMembers } from "./commands/members.js";
import { register as registerAuth } from "./commands/auth.js";

const program = new Command();

program
  .name("globalise-now-cli")
  .description("CLI client for the Globalize translation platform")
  .version("0.1.0")
  .option("--json", "Force JSON output");

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

// Auth commands (no API client needed)
const authGroup = program.command("auth").description("Configure authentication");
registerAuth(authGroup);

// API command groups (lazy auth via getClient)
const groups = [
  { name: "orgs", description: "Manage organisations", register: registerOrgs },
  { name: "projects", description: "Manage translation projects", register: registerProjects },
  { name: "languages", description: "Browse available languages", register: registerLanguages },
  { name: "project-languages", description: "Manage languages within a project", register: registerProjectLanguages },
  { name: "repositories", description: "Connect git repositories", register: registerRepositories },
  { name: "glossary", description: "Manage glossary term pairs", register: registerGlossary },
  { name: "style-guides", description: "Manage translation style guides", register: registerStyleGuides },
  { name: "api-keys", description: "Manage API keys", register: registerApiKeys },
  { name: "members", description: "Manage organisation members", register: registerMembers },
] as const;

for (const { name, description, register } of groups) {
  const group = program.command(name).description(description);
  register(group, getClient);
}

await program.parseAsync();
