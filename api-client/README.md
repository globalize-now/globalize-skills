# @globalize-now/cli-client

CLI and TypeScript library for the [Globalize](https://globalize.now) translation platform. Manage translation projects, languages, glossaries, style guides, and more from the command line or programmatically.

## Installation

```bash
npm install @globalize-now/cli-client
```

Or run the CLI directly:

```bash
npx @globalize-now/cli-client
```

## Authentication

The client resolves your API key in this order:

1. **Environment variable** -- set `GLOBALIZE_API_KEY`
2. **Config file** -- reads from `~/.globalize/config.json`

Manage authentication via the CLI:

```bash
globalise-now-cli auth login      # Save your API key
globalise-now-cli auth status     # Check current auth
globalise-now-cli auth logout     # Remove saved credentials
```

## CLI Usage

```bash
globalise-now-cli [command] [subcommand] [options]
```

Global options:

| Flag | Description |
|------|-------------|
| `--json` | Output raw JSON instead of formatted tables |

### Commands

| Group | Commands | Description |
|-------|----------|-------------|
| **orgs** | `list`, `create`, `delete` | Manage organisations |
| **projects** | `list`, `create`, `get`, `delete` | Manage translation projects |
| **languages** | `list`, `get` | Browse the language catalog |
| **project-languages** | `list`, `add`, `remove` | Configure languages on a project |
| **repositories** | `list`, `create`, `delete`, `detect` | Connect and scan git repositories |
| **glossary** | `list`, `create`, `delete` | Manage translation glossaries |
| **style-guides** | `list`, `upsert`, `delete` | Set translation style instructions |
| **api-keys** | `list`, `create`, `revoke` | Manage API keys |
| **members** | `list`, `invite`, `remove` | Manage organisation members |
| **workflows** | `preview-setup`, `setup`, `list`, `get`, `languages` | Set up a GitHub Workflow and change its target languages |
| **workflows runs** | `start`, `list`, `get` | Start a Workflow run and follow it |

### Examples

```bash
# List all projects
globalise-now-cli projects list

# Create a project with English source and French/German targets
globalise-now-cli projects create "My App" en fr,de

# Connect a git repository
globalise-now-cli repositories create <project-id> https://github.com/org/repo github

# Add a glossary entry
globalise-now-cli glossary create <project-id> "Sign up" "S'inscrire" <source-lang-id> <target-lang-id>
```

### Workflows

Setting up a Workflow for a GitHub repository takes two calls. `preview-setup` writes nothing: it detects the repository's locale files and answers one of

- `ready: true` with the definition it would publish, the file groups it left out as unlikely (`excludedGroups`) and a `previewHash`;
- `ready: false` with `needs`, each naming what was found and the option to pass (a language is never guessed);
- `ready: false` with `alreadySetUp`, naming the Workflow that holds the repository.

`setup` takes the same options plus `--preview-hash` and publishes version 1. It is refused with `WORKFLOW_PREVIEW_STALE` when anything changed since the preview, and with `WORKFLOW_REPOSITORY_CLAIMED` when a Workflow already holds the repository, so a retry never creates a second one. Neither call starts a run.

```bash
# Installation id from `github installations`
globalise-now-cli workflows preview-setup --installation-id 12345 --repository acme/web

# Apply what the user asked for: any of --branches, --patterns, --source-language,
# --target-languages, --name, --translation-memory-id, --import ignore|reviewed|translated
globalise-now-cli workflows preview-setup --installation-id 12345 --repository acme/web \
  --source-language en --target-languages fr,de \
  --patterns '[{"pattern":"_locales/{locale}/messages.json","format":"chrome-messages","pathLocales":{"pt-BR":"pt_BR"}}]'

# Publish what the preview proposed: the same options plus its previewHash
globalise-now-cli workflows setup --installation-id 12345 --repository acme/web \
  --source-language en --target-languages fr,de --patterns '[...]' --preview-hash <hash>

# Replace the target languages (refused with WORKFLOW_BASE_VERSION_STALE if another version was published since)
globalise-now-cli workflows languages --id <workflow-id> --target-languages fr,de,ja

# Start a run (spends credits). A GitHub Workflow delivers by pull request unless --delivery push
globalise-now-cli workflows runs start --workflow-id <workflow-id>

# Poll it: status, failure, per-language progress, each Output's outcome and the pull request
globalise-now-cli workflows runs get --id <run-id>
```

A `completed` run has finished translating; it does not mean the translations were delivered. Check each Output's `outcome` (null until it has run, then `delivered`, `failed` or `skipped`). `runs get --full` prints the whole run.

### Errors

A failed command exits 1. In JSON mode (`--json`, or whenever stdout isn't a terminal) it prints `{ "error": "<message>", "status": <http status>, "code": "<API code>", "details": … }`, with `code` and `details` as the API answered them; for example a 409 `REPOSITORY_HELD_BY_PROJECT` names the Project in `details`. A 401 reads "Authentication failed"; a 403 that isn't about authentication (`FEATURE_REQUIRED`, `WORKFLOW_GATE_ADMIN_REQUIRED`, …) keeps its code and message.

Every request sends `User-Agent: globalize-cli-client/<version>`.

## Library Usage

All CLI commands are also available as typed functions:

```typescript
import { createApiClient, listProjects, createProject } from "@globalize-now/cli-client";

const client = createApiClient("glb_your_api_key");

// List projects
const projects = await listProjects(client);

// Create a project
const project = await createProject(client, "My App", "en", ["fr", "de"]);
```

### Exports

**Client & Auth**

- `createApiClient(apiKey, apiUrl?)` -- create a typed API client
- `resolveAuth()` -- resolve API key from env or config file
- `readConfigFile()` / `writeConfigFile(config)` / `deleteConfigFile()` -- manage `~/.globalize/config.json`

**API Functions**

| Module | Functions |
|--------|-----------|
| Organisations | `listOrgs`, `createOrg`, `deleteOrg` |
| Projects | `listProjects`, `createProject`, `getProject`, `deleteProject` |
| Languages | `listLanguages`, `getLanguage` |
| Project Languages | `listProjectLanguages`, `addProjectLanguage`, `removeProjectLanguage` |
| Repositories | `listRepositories`, `createRepository`, `deleteRepository`, `detectRepository` |
| Glossary | `listGlossary`, `createGlossaryEntry`, `deleteGlossaryEntry` |
| Style Guides | `listStyleGuides`, `upsertStyleGuide`, `deleteStyleGuide` |
| API Keys | `listApiKeys`, `createApiKey`, `revokeApiKey` |
| Members | `listMembers`, `inviteMember`, `removeMember` |
| Workflows | `previewWorkflowSetup`, `setUpWorkflow`, `listWorkflows`, `getWorkflow`, `getWorkflowVersion`, `setWorkflowLanguages`, `startWorkflowRun`, `getWorkflowRun`, `listWorkflowRuns`, `summariseWorkflowRun` |

## Development

Requires Node.js >= 18.

```bash
cd api-client
npm install
npm run build    # Generate API types from OpenAPI spec + compile TypeScript
npm run dev      # Watch mode (TypeScript only)
npm test         # Command tests against a mocked API
npm run lint     # ESLint + Prettier + type check
npm run format   # Auto-fix lint and formatting
```

### Environment variables

| Variable | Description |
|----------|-------------|
| `GLOBALIZE_API_KEY` | API key (skips config file lookup) |
| `GLOBALIZE_API_URL` | Override API base URL (default: `https://api.globalize.now`) |
