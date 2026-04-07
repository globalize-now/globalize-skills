---
name: globalize-now-cli-use
description: >-
  Manage Globalize translation resources using the CLI. Use this skill when the user asks
  to create a translation project, add or remove languages, connect a git repository,
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

First, get the git remote URL and determine the provider:

```bash
git remote get-url origin
```

**Parse the URL** to determine the provider:
- If the URL contains `github.com` (HTTPS or SSH), this is a **GitHub** repo. Extract `<OWNER>` and `<REPO>` from the URL:
  - HTTPS: `https://github.com/<OWNER>/<REPO>.git`
  - SSH: `git@github.com:<OWNER>/<REPO>.git`
- Otherwise (e.g., `gitlab.com`), use the **non-GitHub flow** below.

#### GitHub repos — GitHub App flow

For GitHub repos, Globalize uses a GitHub App to access repository contents. Follow these sub-steps:

**1. Check for existing GitHub App installations:**

```bash
npx @globalize-now/cli-client github installations --json
```

This returns an array of installations. Each has an `id` and an `account` with `login` (the GitHub org or user name).

**2. Match installation to repo owner:**

Look for an installation whose `account.login` matches `<OWNER>` (case-insensitive).

- **Match found** → use its `id` as `<INSTALLATION_ID>`, skip to sub-step 4.
- **No match** → proceed to sub-step 3.

**3. Install the GitHub App (interactive):**

```bash
npx @globalize-now/cli-client github install --json
```

This opens the user's browser to install the Globalize GitHub App. The command polls for completion (up to 5 minutes) and returns the `installationId` when done.

> **Note:** This step requires user interaction in the browser. Tell the user the browser will open and they need to select the correct GitHub account/org and approve the installation.

After completion, run `github installations --json` again to find the `<INSTALLATION_ID>` for the target owner.

**4. Verify repo access:**

```bash
npx @globalize-now/cli-client github repos --installation-id <INSTALLATION_ID> --json
```

Confirm that `<OWNER>/<REPO>` appears in the returned list. If not, the GitHub App may not have access to this specific repository — inform the user they need to adjust the installation's repository access settings on GitHub.

**5. Connect the repository:**

```bash
npx @globalize-now/cli-client repositories create \
  --project-id <PROJECT_ID> \
  --git-url <GIT_URL> \
  --provider github \
  --github-installation-id <INSTALLATION_ID> \
  --json
```

Parse the returned JSON to extract the **repository ID**.

#### Non-GitHub repos (GitLab, etc.)

```bash
npx @globalize-now/cli-client repositories create \
  --project-id <PROJECT_ID> \
  --git-url <GIT_URL> \
  --provider gitlab \
  --json
```

Parse the returned JSON to extract the **repository ID**.

#### Common options for both flows

`--branches <branches...>` to track specific branches, `--locale-path-pattern <pattern>` to specify where locale files live.

### 2d. Detect repository configuration

For **GitHub repos**, you can detect i18n structure via the GitHub App (useful for pre-populating `--locale-path-pattern` on the `repositories create` call):

```bash
npx @globalize-now/cli-client github detect \
  --installation-id <INSTALLATION_ID> \
  --owner <OWNER> \
  --repo <REPO> \
  --json
```

Alternatively (or additionally), auto-discover from the connected repository:

```bash
npx @globalize-now/cli-client repositories detect \
  --id <REPO_ID> \
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
| `projects get` | `--id` | |
| `projects delete` | `--id` | |
| `languages list` | | |
| `languages get` | `--id` | |
| `project-languages list` | `--project-id` | |
| `project-languages add` | `--project-id`, `--name`, `--locale` | `--language-id` |
| `project-languages remove` | `--project-id`, `--language-id` | |
| `repositories list` | `--project-id` | |
| `repositories create` | `--project-id`, `--git-url`, `--provider` | `--branches`, `--locale-path-pattern`, `--github-installation-id` |
| `repositories delete` | `--id` | |
| `repositories detect` | `--id` | |
| `github install` | *(interactive)* | |
| `github installations` | | |
| `github repos` | `--installation-id` | |
| `github branches` | `--installation-id`, `--owner`, `--repo` | |
| `github detect` | `--installation-id`, `--owner`, `--repo` | |
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
- **IDs are UUIDs**: All `--id`, `--project-id`, `--org-id`, etc. expect UUID values returned from prior create/list commands. Always capture these from JSON responses.
- **Project language IDs vs global language IDs**: Glossary (`--source-language-id`, `--target-language-id`) and style guide (`--language-id`) commands use _project language_ UUIDs — the ID of a language within a specific project. Get these from `project-languages list`, not `languages list`.
- **GitHub App required for GitHub repos**: When connecting a GitHub repository, use the GitHub App flow (`github installations` / `github install`) to obtain an `installationId` and pass it via `--github-installation-id` on `repositories create`. Without this, Globalize cannot access repo contents. The `github install` command opens a browser — the user must complete the approval interactively.
- **Repository providers**: `--provider` only accepts `github` or `gitlab`.
- **Validate languages before project creation**: Always fetch `languages list --json` and match the user's desired locales against the catalog. Use the returned UUIDs for `--source-language` and `--target-languages` — do not pass raw locale codes. Inform the user about any unsupported languages that have no catalog match.
- **Auth in non-interactive contexts**: The CLI does not fall back to interactive login when there's no TTY. Ensure `GLOBALIZE_API_KEY` is set or `~/.globalize/config.json` exists.
