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

## Development

Requires Node.js >= 18.

```bash
cd api-client
npm install
npm run build    # Generate API types from OpenAPI spec + compile TypeScript
npm run dev      # Watch mode (TypeScript only)
npm run lint     # ESLint + Prettier + type check
npm run format   # Auto-fix lint and formatting
```

### Environment variables

| Variable | Description |
|----------|-------------|
| `GLOBALIZE_API_KEY` | API key (skips config file lookup) |
| `GLOBALIZE_API_URL` | Override API base URL (default: `https://api.globalize.now`) |
