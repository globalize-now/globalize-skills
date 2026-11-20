import { Command } from "commander";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { ApiClient } from "./client.js";
import { register as registerOrgs } from "./commands/orgs.js";
import { register as registerProjects } from "./commands/projects.js";
import { register as registerLanguages } from "./commands/languages.js";
import { register as registerProjectLanguages } from "./commands/project-languages.js";
import { register as registerRepositories } from "./commands/repositories.js";
import { register as registerGlossary } from "./commands/glossary.js";
import { register as registerGlossaries } from "./commands/glossaries.js";
import { register as registerStyleGuides } from "./commands/style-guides.js";
import { register as registerAssets } from "./commands/assets.js";
import { register as registerApiKeys } from "./commands/api-keys.js";
import { register as registerMembers } from "./commands/members.js";
import { register as registerGithub } from "./commands/github.js";
import { register as registerGitlab } from "./commands/gitlab.js";
import { register as registerPatterns } from "./commands/patterns.js";
import { register as registerJobs } from "./commands/jobs.js";
import { register as registerNamespaces } from "./commands/namespaces.js";
import { register as registerTranslationMemory } from "./commands/translation-memory.js";
import { register as registerTranslationMemories } from "./commands/translation-memories.js";
import { register as registerBilling } from "./commands/billing.js";
import { register as registerAuth } from "./commands/auth.js";
import { register as registerWorkflows } from "./commands/workflows.js";

const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../package.json"), "utf-8"));

/** The whole CLI, every group registered with the lazy `getClient`. */
export function createProgram(getClient: () => Promise<ApiClient>): Command {
  const program = new Command();

  program
    .name("globalise-now-cli")
    .description("CLI client for the Globalize translation platform")
    .version(pkg.version)
    .option("--json", "Force JSON output");

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
    {
      name: "glossaries",
      description: "Manage the organisation's glossaries and their entries",
      register: registerGlossaries,
    },
    {
      name: "assets",
      description: "Manage the organisation's style guides and contexts and their texts",
      register: registerAssets,
    },
    {
      name: "glossary",
      description: "(deprecated: use `glossaries`) Project-scoped glossary term pairs",
      register: registerGlossary,
    },
    {
      name: "style-guides",
      description: "(deprecated: use `assets`) Project-scoped translation style guides",
      register: registerStyleGuides,
    },
    { name: "api-keys", description: "Manage API keys", register: registerApiKeys },
    { name: "members", description: "Manage organisation members", register: registerMembers },
    { name: "github", description: "GitHub App installation and repositories", register: registerGithub },
    { name: "gitlab", description: "GitLab connection and repositories", register: registerGitlab },
    { name: "patterns", description: "Manage repository locale path patterns", register: registerPatterns },
    { name: "jobs", description: "Manage translation jobs", register: registerJobs },
    {
      name: "workflows",
      description: "Set up GitHub Workflows, change their languages, and start and follow their runs",
      register: registerWorkflows,
    },
    { name: "namespaces", description: "Manage project namespaces", register: registerNamespaces },
    {
      name: "translation-memories",
      description: "Browse and manage translation memories and their entries",
      register: registerTranslationMemories,
    },
    {
      name: "translation-memory",
      description: "(deprecated) Project-scoped translation memory — use `translation-memories`",
      register: registerTranslationMemory,
    },
    { name: "billing", description: "View billing balance and ledger", register: registerBilling },
  ] as const;

  for (const { name, description, register } of groups) {
    const group = program.command(name).description(description);
    register(group, getClient);
  }

  return program;
}
