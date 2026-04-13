---
name: globalize-now-cli-use
description: >-
  Manage Globalize translation resources using the CLI. Use this skill when the user asks
  to create a translation project, add or remove languages, connect a GitHub or GitLab repository,
  manage glossaries or style guides, invite team members, manage API keys, or perform any
  Globalize platform operation. Also use when the user mentions managing translations,
  translation workflow, or wants to "set up translations for this repo." This skill assumes
  the CLI is already installed and authenticated — run globalize-now-cli-setup first if not.
---

# Globalize CLI Usage

This skill guides you through managing translation resources on the [Globalize](https://globalize.now) platform using the CLI (`globalise-now-cli`).

**Always use `--json`** when running commands programmatically. Parse JSON output to extract IDs for subsequent commands. Many operations require UUIDs returned from prior steps.

All examples use `npx @globalize-now/cli-client`. If the CLI is installed globally, replace with `globalise-now-cli`.

---

## Step 1: Prerequisite Check

Verify authentication is configured:

```bash
npx @globalize-now/cli-client auth status --json
```

If this fails or reports no credentials, run the `globalize-now-cli-setup` skill first.

---

## Step 2: Common Workflow — Create a Project and Connect a Repository

This is the most common end-to-end workflow. Follow these sub-steps in order:

### 2a. Fetch and match available languages

Projects must be created using **language IDs** returned from the languages API. Before creating a project, fetch the catalog and match the user's desired languages against it.

1. **Fetch the language catalog:**

```bash
npx @globalize-now/cli-client languages list --json
```

This returns an array of language objects, each with `id` (UUID), `name`, and `locale` (BCP 47 code).

2. **Match desired languages against the catalog.** Compare the user's source and target locale codes (e.g., `en`, `fr`, `de`, `ja`) against the `locale` field in the returned list. Extract the corresponding `id` for each match.

3. **Report unsupported languages.** If any of the user's desired languages do not appear in the catalog, inform the user which languages are unsupported and cannot be added to the project. Do not silently skip them — the user must acknowledge the gap before proceeding. Only continue with languages that have a matching catalog entry.

### 2b. Create a project

Use the **language IDs** (UUIDs) matched in step 2a — not bare locale codes:

```bash
npx @globalize-now/cli-client projects create \
  --name "My App" \
  --source-language <SOURCE_LANGUAGE_ID> \
  --target-languages <TARGET_LANGUAGE_ID_1> <TARGET_LANGUAGE_ID_2> \
  --json
```

`--target-languages` accepts space-separated or comma-separated values.

Parse the returned JSON to extract the **project ID**.

### 2c. Connect the repository

Globalize uses a GitHub App or GitLab OAuth connection to access repository contents. Follow these sub-steps in order.

**1. Get the git remote URL:**

```bash
git remote get-url origin
```

If the command fails (no remote named `origin`), **STOP.** Tell the user: "No git remote `origin` found. Please add a remote (`git remote add origin <URL>`) and try again, or provide the git URL manually." If the user provides a URL manually, use that URL and continue.

**2. Parse the URL — extract owner and repo/project:**

- GitHub HTTPS: `https://github.com/<OWNER>/<REPO>.git`
- GitHub SSH: `git@github.com:<OWNER>/<REPO>.git`
- GitLab HTTPS: `https://gitlab.com/<OWNER>/<PROJECT>.git`
- GitLab SSH: `git@gitlab.com:<OWNER>/<PROJECT>.git`

Store the URL as `<GIT_URL>`. **Important:** The CLI only accepts HTTPS URLs for `--git-url`. If the remote is an SSH URL, convert it to HTTPS format.

- If the URL contains `github.com`: proceed with the **GitHub flow** (sub-step 3 onward).
- If the URL contains `gitlab.com`: proceed with the **GitLab flow** (below).
- Otherwise: **STOP.** Tell the user: "Globalize supports GitHub and GitLab repositories. The detected remote URL (`<URL>`) does not appear to be either." Do NOT proceed.

**3. CONSENT GATE — Confirm repository details with the user. You MUST complete this step before proceeding.**

Present the detection result and ask the user to confirm:

> I detected the following repository:
> - **Git URL:** `<GIT_URL>`
> - **Owner:** `<OWNER>`
> - **Repo:** `<REPO>`
>
> I'll connect this repository to your Globalize project using the GitHub App (or GitLab OAuth). This may open a browser window for you to approve the installation. **Is this correct?**

Wait for the user's response before proceeding.

- **User confirms** → continue to sub-step 4 (GitHub) or the GitLab flow.
- **User corrects the URL** → re-parse the corrected URL from sub-step 2.

---

#### GitHub Flow

**4. Set up the GitHub App and connect the repository:**

**4a. Check for existing GitHub App installations:**

```bash
npx @globalize-now/cli-client github installations --json
```

This returns an array of installations. Each has `id` (a **UUID** — Globalize's internal installation record), `installationId` (the **numeric** GitHub installation ID, e.g. `122432012`), `accountLogin` (the GitHub org or user name), and `accountType`.

**4b. Match installation to repo owner:**

Look for an installation whose `accountLogin` matches `<OWNER>` (case-insensitive). Capture **both** IDs: the numeric `installationId` as `<GITHUB_INSTALLATION_ID>` (for `github repos/branches/detect --installation-id`) and the UUID `id` as `<INSTALLATION_UUID>` (for `repositories create --github-installation-id`).

- **Match found** → capture both IDs, skip to sub-step 4d.
- **No match** → proceed to sub-step 4c.

**4c. Install the GitHub App (requires user interaction):**

```bash
npx @globalize-now/cli-client github install --no-wait --json
```

This returns `{ "installUrl": "...", "nonce": "..." }` immediately. Present the `installUrl` to the user and ask them to open it in their browser, select the correct GitHub account/org, and approve the installation.

After the user confirms they have completed the browser flow, check the status:

```bash
npx @globalize-now/cli-client github install-status --nonce <NONCE> --json
```

This returns `{ "status": "completed", "installationId": "...", "accountLogin": "..." }` when done, `{ "status": "pending" }` if the user hasn't finished yet, or `{ "status": "expired" }` if the nonce expired. Check `status === "completed"`. If not completed, ask the user to confirm they finished and retry.

After completion, run `github installations --json` again to find `<GITHUB_INSTALLATION_ID>` (numeric `installationId`) and `<INSTALLATION_UUID>` (UUID `id`) for the target owner.

**4d. Verify repo access:**

```bash
npx @globalize-now/cli-client github repos --installation-id <GITHUB_INSTALLATION_ID> --json
```

Confirm that `<OWNER>/<REPO>` appears in the returned list. If not, the GitHub App may not have access to this specific repository — inform the user they need to adjust the installation's repository access settings on GitHub.

**4e. Connect the repository:**

```bash
npx @globalize-now/cli-client repositories create \
  --project-id <PROJECT_ID> \
  --git-url <GIT_URL> \
  --provider github \
  --github-installation-id <INSTALLATION_UUID> \
  --json
```

Optional flags: `--branches <branches...>`, `--patterns '<JSON array>'`, `--import-mode <ignore|reviewed|translated>`, `--import-scope <new_keys_only|all_keys>`.

Parse the returned JSON to extract the **repository ID**.

---

#### GitLab Flow

**For GitLab repositories:**

**4a. Check for existing GitLab connections:**

```bash
npx @globalize-now/cli-client gitlab connections --json
```

This returns an array of connections. Each has `id` (UUID), `username`, `gitlabUserId`, `status`, and `createdAt`.

**4b. Match connection to repo owner:**

Look for a connection whose `username` matches the GitLab owner (case-insensitive). If found, use its `id` as `<CONNECTION_ID>`.

- **Match found** → use its `id` as `<CONNECTION_ID>`, skip to sub-step 4d.
- **No match** → proceed to sub-step 4c.

**4c. Install the GitLab OAuth connection (requires user interaction):**

```bash
npx @globalize-now/cli-client gitlab install --no-wait --json
```

This returns `{ "installUrl": "...", "nonce": "..." }` immediately. Present the `installUrl` to the user and ask them to open it in their browser and authorize the GitLab connection.

After the user confirms they have completed the browser flow, check the status:

```bash
npx @globalize-now/cli-client gitlab install-status --nonce <NONCE> --json
```

This returns `{ "status": "completed", "connectionId": "...", "username": "..." }` when done, `{ "status": "pending" }` if the user hasn't finished yet, or `{ "status": "expired" }` if the nonce expired. Check `status === "completed"`. If not completed, ask the user to confirm they finished and retry.

Once completed, use `connectionId` as `<CONNECTION_ID>`.

**4d. List GitLab projects and verify access:**

```bash
npx @globalize-now/cli-client gitlab projects --connection-id <CONNECTION_ID> --json
```

Match `pathWithNamespace` against `<OWNER>/<PROJECT>`. If not found, the GitLab connection may not have access to this project — inform the user.

**4e. Connect the repository:**

```bash
npx @globalize-now/cli-client repositories create \
  --project-id <PROJECT_ID> \
  --git-url <GIT_URL> \
  --provider gitlab \
  --gitlab-connection-id <CONNECTION_ID> \
  --json
```

Optional flags: `--branches <branches...>`, `--patterns '<JSON array>'`, `--import-mode <ignore|reviewed|translated>`, `--import-scope <new_keys_only|all_keys>`.

Parse the returned JSON to extract the **repository ID**.

---

### 2d. Detect repository configuration

For **GitHub repos**, you can detect i18n structure via the GitHub App:

```bash
npx @globalize-now/cli-client github detect \
  --installation-id <GITHUB_INSTALLATION_ID> \
  --owner <OWNER> \
  --repo <REPO> \
  --json
```

For **GitLab repos**, you can detect i18n structure via the GitLab connection:

```bash
npx @globalize-now/cli-client gitlab detect \
  --connection-id <CONNECTION_ID> \
  --project-id <GITLAB_PROJECT_ID> \
  --json
```

Alternatively (or additionally), auto-discover from the connected repository:

```bash
npx @globalize-now/cli-client repositories detect \
  --id <REPO_ID> \
  --json
```

**Note:** All detection commands run against remote code, not the local working copy. If the user has uncommitted or unpushed changes that affect locale files, detection will not reflect those changes. Inform the user if this applies.

---

## Step 2.5: Project Configuration

Projects have a typed `config` object for QA, provider, VCS, and notification settings. Use `projects update` with `--config` to set or change configuration.

### Reading current config

```bash
npx @globalize-now/cli-client projects get --id <PROJECT_ID> --json
```

The returned JSON includes a `config` object with the current settings.

### Updating config

Pass a JSON object via `--config`. The object is **merged** — only include the keys you want to change:

```bash
npx @globalize-now/cli-client projects update \
  --id <PROJECT_ID> \
  --config '{"qa": {"enabledChecks": ["placeholder", "terminology"], "qualityThreshold": 80}}' \
  --json
```

You can also update `--name`, `--source-language`, and `--target-languages` in the same call.

### Config sections

| Section | Fields | Description |
|---------|--------|-------------|
| `qa` | `enabledChecks` (`"placeholder"`, `"length"`, `"terminology"`, `"formatting"`), `qualityThreshold` (number), `lengthRatioBounds` (object keyed by locale, each `{min, max}`), `aiReviewScope` (`"passes-only"`, `"all"`, `"none"`) | Quality assurance checks and thresholds |
| `defaultProvider` | string | Default translation provider |
| `providerOverrides` | object keyed by locale → provider string | Per-language provider overrides |
| `deeplFormality` | object keyed by locale → formality string | DeepL formality settings per language |
| `github` | `prTranslations` (boolean), `ignoreDraftPrs` (boolean) | GitHub integration behaviour |
| `gitlab` | `mrTranslations` (boolean), `ignoreDraftMrs` (boolean) | GitLab integration behaviour |
| `notifications` | `webhookUrl` (string), `webhookSecret` (string), `emailRecipients` (string[]), `enabledEvents` (`"job_failed"`, `"qa_issues"`, `"delivery_failed"`, `"job_completed"`) | Webhook and email notification settings |

### Examples

**Enable QA checks:**
```bash
npx @globalize-now/cli-client projects update \
  --id <PROJECT_ID> \
  --config '{"qa": {"enabledChecks": ["placeholder", "length", "terminology", "formatting"], "qualityThreshold": 90, "aiReviewScope": "all"}}' \
  --json
```

**Configure GitHub PR translations:**
```bash
npx @globalize-now/cli-client projects update \
  --id <PROJECT_ID> \
  --config '{"github": {"prTranslations": true, "ignoreDraftPrs": true}}' \
  --json
```

**Set up webhook notifications:**
```bash
npx @globalize-now/cli-client projects update \
  --id <PROJECT_ID> \
  --config '{"notifications": {"webhookUrl": "https://example.com/webhook", "enabledEvents": ["job_failed", "job_completed"]}}' \
  --json
```

---

## Step 3: Managing Project Languages

After project creation, add or remove target languages as needed.

**List** current project languages:

```bash
npx @globalize-now/cli-client project-languages list \
  --project-id <PROJECT_ID> \
  --json
```

This returns an array of project languages, each with its own **project language ID** (different from the global language ID). You'll need these IDs for glossary and style guide operations.

**Add** a language:

```bash
npx @globalize-now/cli-client project-languages add \
  --project-id <PROJECT_ID> \
  --name "Spanish" \
  --locale es \
  --json
```

Required: `--name` and `--locale` (BCP 47 code). Optional: `--language-id` to link to a specific global language.

**Remove** a language:

```bash
npx @globalize-now/cli-client project-languages remove \
  --project-id <PROJECT_ID> \
  --language-id <PROJECT_LANGUAGE_ID> \
  --json
```

---

## Step 3.5: Patterns Management

Locale path patterns define where translation files live in the repository. Each pattern has a path template and a file format. Patterns are managed separately from repository create/update.

**List** patterns:

```bash
npx @globalize-now/cli-client patterns list --repository-id <REPO_ID> --json
```

**Create** a pattern:

```bash
npx @globalize-now/cli-client patterns create \
  --repository-id <REPO_ID> \
  --pattern "locales/{locale}/*.json" \
  --file-format json-nested \
  --json
```

Supported file formats: `json-flat`, `json-nested`, `xliff`, `xliff-2`, `xliff-1.2`, `yaml`, `po`.

**Update** a pattern:

```bash
npx @globalize-now/cli-client patterns update \
  --repository-id <REPO_ID> \
  --pattern-id <PATTERN_ID> \
  --pattern "locales/{locale}/{namespace}.json" \
  --json
```

**Delete** a pattern:

```bash
npx @globalize-now/cli-client patterns delete \
  --repository-id <REPO_ID> \
  --pattern-id <PATTERN_ID> \
  --json
```

**Reorder** a pattern:

```bash
npx @globalize-now/cli-client patterns reorder \
  --repository-id <REPO_ID> \
  --pattern-id <PATTERN_ID> \
  --position 0 \
  --json
```

---

## Step 4: Glossary Management

Glossaries ensure specific terms are translated consistently across languages.

**List** glossary entries:

```bash
npx @globalize-now/cli-client glossary list \
  --project-id <PROJECT_ID> \
  --json
```

**Create** a glossary entry:

```bash
npx @globalize-now/cli-client glossary create \
  --project-id <PROJECT_ID> \
  --source-term "Dashboard" \
  --target-term "Tableau de bord" \
  --source-language-id <SOURCE_PROJECT_LANGUAGE_ID> \
  --target-language-id <TARGET_PROJECT_LANGUAGE_ID> \
  --json
```

`--source-language-id` and `--target-language-id` are **project language UUIDs** from `project-languages list` (Step 3), not global language IDs.

**Delete** a glossary entry:

```bash
npx @globalize-now/cli-client glossary delete \
  --project-id <PROJECT_ID> \
  --entry-id <ENTRY_ID> \
  --json
```

---

## Step 5: Style Guide Management

Style guides provide translation instructions per language (e.g., "use formal register", "prefer British English spelling").

**List** style guides:

```bash
npx @globalize-now/cli-client style-guides list \
  --project-id <PROJECT_ID> \
  --json
```

**Create or update** a style guide:

```bash
npx @globalize-now/cli-client style-guides upsert \
  --project-id <PROJECT_ID> \
  --language-id <PROJECT_LANGUAGE_ID> \
  --instructions "Use formal register. Prefer British English spelling." \
  --json
```

`--language-id` is a **project language UUID** from `project-languages list` (Step 3).

**Delete** a style guide:

```bash
npx @globalize-now/cli-client style-guides delete \
  --project-id <PROJECT_ID> \
  --language-id <PROJECT_LANGUAGE_ID> \
  --json
```

---

## Step 6: Organisation and Team Management

These commands are less commonly needed from an agent but are available when requested.

### Organisations

```bash
npx @globalize-now/cli-client orgs list --json
npx @globalize-now/cli-client orgs create --name "My Org" --json
npx @globalize-now/cli-client orgs delete --id <ORG_ID> --json
```

### Members

```bash
npx @globalize-now/cli-client members list --org-id <ORG_ID> --json
npx @globalize-now/cli-client members invite --org-id <ORG_ID> --clerk-user-id <UID> --json
npx @globalize-now/cli-client members remove --org-id <ORG_ID> --membership-id <ID> --json
```

Optional `--role` flag on `invite`: `admin` or `member` (default: `member`).

### API Keys

```bash
npx @globalize-now/cli-client api-keys list --org-id <ORG_ID> --json
npx @globalize-now/cli-client api-keys create --org-id <ORG_ID> --name "CI Key" --json
npx @globalize-now/cli-client api-keys revoke --org-id <ORG_ID> --key-id <KEY_ID> --json
```

### GitLab

```bash
npx @globalize-now/cli-client gitlab install                    # OAuth flow (opens browser)
npx @globalize-now/cli-client gitlab install --no-wait --json   # Returns URL and nonce
npx @globalize-now/cli-client gitlab install-status --nonce <NONCE> --json
npx @globalize-now/cli-client gitlab connections --json
npx @globalize-now/cli-client gitlab connection-delete --id <ID> --json
npx @globalize-now/cli-client gitlab projects --connection-id <ID> --json
npx @globalize-now/cli-client gitlab branches --connection-id <ID> --project-id <PROJECT_ID> --json
npx @globalize-now/cli-client gitlab detect --connection-id <ID> --project-id <PROJECT_ID> --json
```

---

## Command Reference

| Command | Required flags | Optional flags |
|---------|---------------|----------------|
| `auth login` | *(interactive)* | |
| `auth status` | | |
| `auth logout` | | |
| `orgs list` | | |
| `orgs create` | `--name` | |
| `orgs delete` | `--id` | |
| `projects list` | | |
| `projects create` | `--name`, `--source-language` (ID), `--target-languages` (IDs) | |
| `projects update` | `--id` | `--name`, `--source-language`, `--target-languages`, `--config` (JSON) |
| `projects get` | `--id` | |
| `projects delete` | `--id` | |
| `languages list` | | |
| `languages get` | `--id` | |
| `project-languages list` | `--project-id` | |
| `project-languages add` | `--project-id`, `--name`, `--locale` | `--language-id` |
| `project-languages remove` | `--project-id`, `--language-id` | |
| `repositories list` | `--project-id` | |
| `repositories create` | `--project-id`, `--git-url`, `--provider` | `--branches`, `--github-installation-id`, `--gitlab-connection-id`, `--patterns`, `--import-mode`, `--import-scope` |
| `repositories update` | `--id` | `--git-url`, `--branches`, `--github-installation-id`, `--gitlab-connection-id`, `--provider`, `--detected-framework`, `--import-mode`, `--import-scope` |
| `repositories delete` | `--id` | |
| `repositories detect` | `--id` | |
| `repositories branches` | `--id` | |
| `patterns list` | `--repository-id` | |
| `patterns create` | `--repository-id`, `--pattern`, `--file-format` | `--position` |
| `patterns update` | `--repository-id`, `--pattern-id` | `--pattern`, `--file-format` |
| `patterns delete` | `--repository-id`, `--pattern-id` | |
| `patterns reorder` | `--repository-id`, `--pattern-id`, `--position` | |
| `github install` | | `--no-wait` |
| `github install-status` | `--nonce` | |
| `github installations` | | |
| `github repos` | `--installation-id` | |
| `github branches` | `--installation-id`, `--owner`, `--repo` | |
| `github detect` | `--installation-id`, `--owner`, `--repo` | |
| `gitlab install` | | `--no-wait` |
| `gitlab install-status` | `--nonce` | |
| `gitlab connections` | | |
| `gitlab connection-delete` | `--id` | |
| `gitlab projects` | `--connection-id` | |
| `gitlab branches` | `--connection-id`, `--project-id` | |
| `gitlab detect` | `--connection-id`, `--project-id` | |
| `glossary list` | `--project-id` | |
| `glossary create` | `--project-id`, `--source-term`, `--target-term`, `--source-language-id`, `--target-language-id` | |
| `glossary delete` | `--project-id`, `--entry-id` | |
| `style-guides list` | `--project-id` | |
| `style-guides upsert` | `--project-id`, `--language-id`, `--instructions` | |
| `style-guides delete` | `--project-id`, `--language-id` | |
| `api-keys list` | `--org-id` | |
| `api-keys create` | `--org-id`, `--name` | |
| `api-keys revoke` | `--org-id`, `--key-id` | |
| `members list` | `--org-id` | |
| `members invite` | `--org-id`, `--clerk-user-id` | `--role` |
| `members remove` | `--org-id`, `--membership-id` | |

---

## Common Gotchas

- **Always use `--json`**: The CLI auto-detects non-TTY and outputs JSON, but always pass `--json` explicitly when running programmatically for reliability.
- **IDs are UUIDs (except `--installation-id`)**: All `--id`, `--project-id`, `--org-id`, etc. expect UUID values returned from prior create/list commands. **Two different installation ID flags exist — they take different value types.** `--installation-id` (used by `github repos`, `github branches`, `github detect`) expects the **numeric** GitHub installation ID (the `installationId` field from `github installations --json`, e.g. `122432012`). `--github-installation-id` (used by `repositories create/update`) expects the **UUID** (the `id` field from `github installations --json`). Always capture both IDs from the JSON response.
- **Project language IDs vs global language IDs**: Glossary (`--source-language-id`, `--target-language-id`) and style guide (`--language-id`) commands use _project language_ UUIDs — the ID of a language within a specific project. Get these from `project-languages list`, not `languages list`.
- **GitHub App required for GitHub repos**: When connecting a GitHub repository, use the GitHub App flow (`github installations` / `github install`) to obtain an installation ID and pass it via `--github-installation-id` on `repositories create`. Without this, Globalize cannot access repo contents. Use `github install --no-wait --json` to get the install URL without blocking, present it to the user, then check completion with `github install-status --nonce <NONCE> --json`.
- **Patterns are managed separately**: After creating a repository, manage locale path patterns via `patterns list/create/update/delete/reorder`. The `--patterns` flag on `repositories create` is only for initial setup. Pattern changes after creation require the pattern CRUD commands.
- **GitLab uses connections, not installations**: For GitLab repos, use `gitlab connections` (not `github installations`) and pass `--gitlab-connection-id` (not `--github-installation-id`) on `repositories create`. GitLab project IDs are **numeric** (not UUIDs).
- **Validate languages before project creation**: Always fetch `languages list --json` and match the user's desired locales against the catalog. Use the returned UUIDs for `--source-language` and `--target-languages` — do not pass raw locale codes. Inform the user about any unsupported languages that have no catalog match.
- **Auth in non-interactive contexts**: The CLI does not fall back to interactive login when there's no TTY. Ensure `GLOBALIZE_API_KEY` is set or `~/.globalize/config.json` exists.
