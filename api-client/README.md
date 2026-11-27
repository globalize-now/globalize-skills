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
| **glossaries** | `list`, `create`, `get`, `rename`, `delete`, `entries`, `add-term`, `edit-entry`, `delete-entry` | Manage the organisation's glossaries and their entries |
| **assets** | `list`, `create`, `get`, `rename`, `delete`, `set-text`, `delete-text` | Manage the organisation's style guides and contexts |
| **glossary** | `list`, `create`, `bulk`, `preview`, `delete` | (deprecated: use `glossaries`) Project-scoped glossary |
| **style-guides** | `list`, `upsert`, `delete`, `generate`, `apply`, `quota` | (deprecated: use `assets`) Project-scoped style guides |
| **api-keys** | `list`, `create`, `revoke` | Manage API keys |
| **members** | `list`, `invite`, `remove` | Manage organisation members |
| **gitlab connections** | `list` (default), `connect` | List the organisation's GitLab connections, or connect another via OAuth |
| **gitlab repositories** | `list` | The GitLab repositories a connection can reach, with `--search` |
| **workflows** | `preview-setup`, `setup`, `list`, `get`, `languages` | Set up a GitHub or GitLab Workflow and change its target languages |
| **workflows runs** | `start`, `list`, `get` | Start a Workflow run and follow it |

### Examples

```bash
# List all projects
globalise-now-cli projects list

# Create a project with English source and French/German targets
globalise-now-cli projects create "My App" en fr,de

# Connect a git repository
globalise-now-cli repositories create <project-id> https://github.com/org/repo github

# Add a glossary entry: the preferred term, a spelling to avoid, and its translations
globalise-now-cli glossaries add-term --id <glossary-id> --source-term "Sign up" --source-locale en \
  --forbid "Signup" --target "fr=S'inscrire" --target "de=Registrieren"
```

### Glossaries and assets

Glossaries, style guides and contexts belong to the organisation; a Project or a Workflow uses them. Find one with `glossaries list` or `assets list --type style_guide|context`, then write by locale.

- A glossary entry is one preferred term in one source locale, with an optional `--description`, up to 20 forbidden variants (`--forbid`, repeated) and a target term per locale (`--target <locale>=<term>`, repeated), or `--do-not-translate`. `add-term` refuses a term the glossary already holds with `GLOSSARY_ENTRY_EXISTS`, naming the entry in `details`; edit that one with `edit-entry`. A spelling another entry claims is refused with `GLOSSARY_SPELLING_TAKEN`.
- `edit-entry` changes only what you pass: `--forbid` replaces the variant set (`--clear-forbidden` empties it), `--clear-description`, `--do-not-translate` / `--translate`, `--target` sets a locale's term and `--remove-target <locale>` removes it.
- `assets set-text` takes `--text` or `--file`. A per-locale Asset needs `--locale`; a global one takes none. `--invalidate-tm` marks a changed style guide's translation memory entries of that locale stale.
- `glossaries delete` and `assets delete` are admin-only.
- There is no bulk import for an organisation's glossary; `glossary bulk` and `glossary preview` stay Project-only.

### Workflows

Setting up a Workflow for a GitHub or GitLab repository takes two calls. `preview-setup` writes nothing: it detects the repository's locale files and answers one of

- `ready: true` with the definition it would publish, the file groups it left out as unlikely (`excludedGroups`) and a `previewHash`;
- `ready: false` with `needs`, each naming what was found and the option to pass (a language is never guessed);
- `ready: false` with `alreadySetUp`, naming the Workflow that holds the repository.

`setup` takes the same options plus `--preview-hash` and publishes version 1. It is refused with `WORKFLOW_PREVIEW_STALE` when anything changed since the preview, and with `WORKFLOW_REPOSITORY_CLAIMED` when a Workflow already holds the repository, so a retry never creates a second one. Neither call starts a run. A GitLab `setup` also registers the repository's webhook through the connection, which takes a Maintainer: GitLab refusing it answers `WORKFLOW_DEFINITION_INVALID` with the issue `gitlab_hook_registration_failed`.

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

# GitLab (gitlab.com): a connection in place of the installation, and the project's
# numeric id or its path (nested groups allowed) as --repository
globalise-now-cli gitlab connections list
globalise-now-cli gitlab connections connect --no-wait     # URL for the user to authorise, and a nonce
globalise-now-cli gitlab install-status --nonce <nonce>    # poll until "completed"
globalise-now-cli gitlab repositories list --connection-id <connection-id> --search web
globalise-now-cli workflows preview-setup --gitlab-connection <connection-id> --repository acme/platform/web
globalise-now-cli workflows setup --gitlab-connection <connection-id> --repository acme/platform/web --preview-hash <hash>

# Replace the target languages (refused with WORKFLOW_BASE_VERSION_STALE if another version was published since)
globalise-now-cli workflows languages --id <workflow-id> --target-languages fr,de,ja

# Start a run (spends credits). A GitHub or GitLab Workflow delivers by pull (merge) request unless --delivery push
globalise-now-cli workflows runs start --workflow-id <workflow-id>

# Poll it: status, failure, per-language progress, each Output's outcome and the pull request
globalise-now-cli workflows runs get --id <run-id>
```

A `completed` run has finished translating; it does not mean the translations were delivered. Check each Output's `outcome` (null until it has run, then `delivered`, `failed` or `skipped`). `runs get --full` prints the whole run.

`projects create` prints a notice on stderr: a GitHub repository with no Project is set up with `workflows preview-setup` and `workflows setup`, and installed Globalize skills are updated with `npx skills update`. It still creates the Project, and stdout is unchanged, so `--json` output parses as before. Other `projects` commands print no notice.

### Errors

A failed command exits 1. In JSON mode (`--json`, or whenever stdout isn't a terminal) it prints `{ "error": "<message>", "status": <http status>, "code": "<API code>", "details": … }`, with `code` and `details` as the API answered them; for example a 409 `REPOSITORY_HELD_BY_PROJECT` names the Project in `details`. A 401, or a 403 `ORG_ACCESS_DENIED`, reads "Authentication failed"; any other 403 keeps its code and message, for example `FEATURE_REQUIRED`, `WORKFLOW_GATE_ADMIN_REQUIRED`, or `FORBIDDEN`, which to an API key is a role refusal such as `FORBIDDEN: Admin access required` when a member's key deletes a glossary or an Asset (the API's non-membership `FORBIDDEN` answers session and OAuth callers only: a key is bound to its organisation).

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
| Glossaries | `listGlossaries`, `createGlossary`, `getGlossary`, `renameGlossary`, `deleteGlossary`, `listGlossaryEntries`, `addGlossaryEntry`, `editGlossaryEntry`, `deleteGlossaryEntryById` |
| Assets | `listAssets`, `createAsset`, `getAsset`, `renameAsset`, `deleteAsset`, `putAssetText`, `deleteAssetText` |
| Glossary (deprecated) | `listGlossary`, `createGlossaryEntry`, `deleteGlossaryEntry` |
| Style Guides (deprecated) | `listStyleGuides`, `upsertStyleGuide`, `deleteStyleGuide` |
| API Keys | `listApiKeys`, `createApiKey`, `revokeApiKey` |
| Members | `listMembers`, `inviteMember`, `removeMember` |
| GitLab | `startGitlabInstall`, `pollGitlabInstallStatus`, `listGitlabConnections`, `deleteGitlabConnection`, `listGitlabProjects`, `listGitlabProjectBranches`, `detectGitlabProject` |
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
