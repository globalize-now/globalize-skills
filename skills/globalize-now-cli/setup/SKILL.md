---
name: globalize-now-cli-setup
description: >-
  Set up the Globalize CLI, create a translation project, and connect a GitHub repository.
  Use this skill when the user asks to set up Globalize, install the Globalize CLI,
  authenticate with Globalize, or connect their project to the Globalize translation
  platform. Also use when the user mentions @globalize-now/cli-client or globalise-now-cli.
  This skill handles installation, authentication, project creation, and repository
  connection. For managing existing projects (glossaries, style guides, team members),
  use globalize-now-cli-use.
---

# Globalize CLI Setup

The Globalize CLI (`@globalize-now/cli-client`) lets AI agents manage translation projects, languages, glossaries, style guides, and repository connections on the [Globalize](https://globalize.now) platform.

Follow these steps in order.

---

## Setup Mode

After Step 1 (detection) completes without blockers, ask the user:

> **How would you like to proceed with the setup?**
> 1. **Guided** — I'll explain each step before and after.
> 2. **Unguided** — I'll run all steps without pausing and show a full summary at the end.

### Guided mode rules

- **Before each step**: briefly explain what will happen and why.
- **After each step**: summarize what changed (files installed, config created, commands run).

### Unguided mode rules

- Execute all steps without pausing for per-step explanations.
- Hard stops (e.g., Node.js not found) still halt execution — these are never skipped.
- At the end, produce a summary:

```
## Setup Complete

### What was done
- [x] Step 1: Detect Environment — {detected signals summary}
- [x] Step 2: Install CLI — {npx or global}
- [x] Step 3: Authenticate — {auth method}
- [x] Step 4: Verify — {org name}
- [x] Step 5: Create Project — "{name}" (source: {source}, targets: {targets})
- [x] Step 6: Connect Repository — {owner/repo} connected, locale pattern: {pattern or "not detected"}

### Warnings (if any)
- {e.g., Uncommitted changes detected — i18n detection used remote code only}
- {e.g., Language "xyz" not found in Globalize catalog — skipped}

### Next steps
- {recommendations}
```

#### Required choices in unguided mode

**Auto-detect first, ask only if detection fails.** No choices are collected upfront. The skill detects everything it can from the environment and existing i18n config, and only prompts the user when a value cannot be determined.

- **Project name**: derived from the repo name (parsed from the git remote URL, e.g. `github.com/acme/my-app` → `my-app`) or the current directory name. Never ask.
- **Source language**: detected from existing i18n config (`sourceLocale`, `defaultLocale`, `lng`). If not detected, default to `en`.
- **Target languages**: detected from existing i18n config (remaining locales after excluding source). If not detected, ask the user.
- **Locale path pattern**: detected from i18n config or directory structure (e.g., `locales/{locale}/{namespace}.json`). Falls back to server-side detection via `github detect` in Step 6. Never ask the user.

If no localization setup is detected at all (non-localized project), ask the user for source and target languages before proceeding to Step 5.

---

## Step 1: Detect the Environment

Check the following before proceeding:

| Signal | How to detect |
|--------|--------------|
| **Node.js** | `node --version` exits 0 and version >= 18. Required for the CLI. |
| **Existing auth** | `~/.globalize/config.json` exists with an `apiKey` field, or `GLOBALIZE_API_KEY` env var is set. |
| **Package manager** | `package-lock.json` → npm. `yarn.lock` → yarn. `pnpm-lock.yaml` → pnpm. `bun.lock` → bun. |
| **Git repository** | `git rev-parse --is-inside-work-tree` exits 0. |
| **Git remote URL** | `git remote get-url origin` — record the URL. If no remote named `origin`, record as absent. |
| **GitHub repo** | Parse the remote URL for `github.com`. Extract `<OWNER>` and `<REPO>` from HTTPS (`https://github.com/OWNER/REPO.git`) or SSH (`git@github.com:OWNER/REPO.git`) format. |
| **Uncommitted changes** | `git status --porcelain` — non-empty output means uncommitted changes exist. |
| **Unpushed commits** | `git log @{u}..HEAD --oneline 2>/dev/null` — non-empty output means unpushed commits. Fails gracefully if no upstream is set. |

### Existing localization setup

Scan for known i18n config files to auto-detect source and target languages. Use the first match found — the project likely has one primary i18n setup.

| Signal | How to detect | What to extract |
|--------|--------------|-----------------|
| **LinguiJS** | `lingui.config.ts` or `lingui.config.js` exists | `sourceLocale` → source language, `locales` array → all languages |
| **next-intl** | `src/i18n/routing.ts` or `i18n/routing.ts` exists | `defaultLocale` → source language, `locales` array → all languages |
| **i18next** | `i18next` in `package.json` deps + config file (`i18n.ts`, `i18n.js`, `i18next.config.*`) | `lng` or `fallbackLng` → source language, `supportedLngs` → all languages |
| **react-intl** | `react-intl` or `@formatjs/intl` in `package.json` deps | Check for `defaultLocale` in config; scan `lang/` or `translations/` directories |
| **Locale directories** | Directories named `locales/`, `messages/`, `translations/`, `lang/` | Subdirectory names or JSON file names (e.g., `en.json`, `fr.json`) indicate available locales |
| **Locale files** | `*.po`, `*.pot`, `*.xliff`, `*.json` files in locale-like paths | File/directory names map to locale codes |

**Detection priority**: Config files (explicit locale lists) take precedence over directory/file scanning (inferred locales).

**Source vs target**: The source language is the `sourceLocale` / `defaultLocale` / `lng` from config. All other locales in the list are target languages.

If none of the above signals are found, record "no localization setup detected."

### Locale path pattern

During detection, also determine the **locale file path pattern** — a path template showing where locale files live. Supported placeholders and wildcards:

- `{locale}` — locale code (required)
- `{namespace}` — namespace name (optional, for multi-namespace setups)
- `*` and `**` — wildcards for matching multiple files/directories

| Source | How to derive the pattern |
|--------|--------------------------|
| **LinguiJS** (single catalog) | Read `catalogs[0].path` from config. Strip `<rootDir>/` prefix. Append `.po`. Example: `src/locales/{locale}/messages.po` |
| **LinguiJS** (per-page catalogs) | Read `catalogs[0].path`. Replace `{entryDir}`/`{entryName}` with `**/*` wildcards, keep `{locale}`. Example: `src/app/{locale}/**/*.po` |
| **next-intl** | Check `messages/` directory. Flat JSON files per locale → `messages/{locale}.json`. Subdirectories with multiple namespace files → `messages/{locale}/{namespace}.json` |
| **i18next** | Read `backend.loadPath` from config. Replace `{{lng}}` → `{locale}`, `{{ns}}` → `{namespace}`. Example: `locales/{locale}/{namespace}.json` |
| **react-intl** | No standard config key. Derive from directory scanning below. |
| **Locale directories/files** | Examine the discovered files. Replace the locale code segment with `{locale}`. If multiple files per locale follow a namespace pattern (e.g., `locales/en/common.json` + `locales/en/auth.json`), use `{namespace}` for the varying filename: `locales/{locale}/{namespace}.json`. If the structure doesn't suggest named namespaces, use wildcards: `locales/{locale}/*.json`. Single file per locale: `locales/{locale}.json`. |

If no pattern can be determined locally, record as absent — Step 6 will attempt server-side detection.

### Detection outcomes

If authentication is already configured, skip to Step 3 to verify.

If no git repo or no git remote is detected, Step 5 (project creation) still runs; Step 6 (repo connection) will be skipped.

If no blockers were found, proceed to the **Setup Mode** prompt before continuing to Step 2.

---

## Step 2: Install

No global install is needed. Run commands directly with npx:

```bash
npx @globalize-now/cli-client <command>
```

Or install globally if the user prefers:

```bash
npm install -g @globalize-now/cli-client
```

The binary name is `globalise-now-cli`.

---

## Step 3: Authenticate

The CLI resolves credentials in this order:

1. **`GLOBALIZE_API_KEY` environment variable** — best for CI/CD
2. **`~/.globalize/config.json` config file** — best for local development
3. **Interactive login** — browser-based device authorization flow

### If already authenticated

Check with:

```bash
npx @globalize-now/cli-client auth status --json
```

If this returns a valid `source` and `key`, authentication is already configured. Skip to Step 4.

### If not authenticated

Run the login command:

```bash
npx @globalize-now/cli-client auth login
```

This starts a device authorization flow:
1. The CLI prints a **user code** and a **verification URL**
2. In an interactive terminal, it opens the URL in the browser automatically
3. In a non-interactive terminal (e.g. agent), it prints the URL for the user to visit
4. The user approves in the browser, and the CLI automatically saves the API key to `~/.globalize/config.json`

Show the verification URL to the user and ask them to approve in the browser. Once approved, the CLI saves the key automatically.

---

## Step 4: Verify

Run both commands to confirm everything works:

```bash
npx @globalize-now/cli-client auth status --json
```

This should return JSON with `source`, `key` (prefix), and `api` (URL).

Then verify API connectivity:

```bash
npx @globalize-now/cli-client orgs list --json
```

This should return the user's organisations. If it fails with an auth error, revisit Step 3.

---

## Step 5: Create Project

### 5a. Check for existing projects

```bash
npx @globalize-now/cli-client projects list --json
```

If projects already exist:
- **Guided**: present the list (names and IDs) and ask if the user wants to reuse an existing project or create a new one. If reusing, record the project ID and skip to Step 6.
- **Unguided**: create a new project. If a project with the same name already exists, note it in the summary but proceed.

### 5b. Determine project name

Use the repo name parsed from the git remote URL (e.g., `github.com/acme/my-app` → `my-app`). If no git remote was detected, use the current directory name. Do not ask the user.

### 5c. Determine languages

Use the locales detected in Step 1:

- **i18n config found** (LinguiJS, next-intl, i18next, react-intl): use the detected source locale and target locales.
  - Guided: confirm the detected languages with the user before proceeding.
  - Unguided: proceed with detected values.
- **Locale directories/files found but no config**: infer locales from directory or file names. Default the source language to `en` if present in the list.
  - Guided: confirm with the user.
  - Unguided: proceed with inferred values.
- **Nothing detected** (non-localized project):
  - Guided: ask the user for source and target languages.
  - Unguided: default source to `en`, ask the user for target languages. This is the one required prompt in unguided mode.

### 5d. Fetch and match languages

```bash
npx @globalize-now/cli-client languages list --json
```

Match the detected or provided locale codes against the `locale` field in the returned list. Extract the UUID `id` for each match.

- If the **source language** has no match in the catalog: **HARD STOP** in both modes. The project cannot be created without a valid source language.
- If a **target language** has no match: guided mode informs the user and asks how to proceed; unguided mode skips that language and notes it in the summary.

### 5e. Create the project

```bash
npx @globalize-now/cli-client projects create \
  --name "<PROJECT_NAME>" \
  --source-language <SOURCE_LANGUAGE_UUID> \
  --target-languages <TARGET_UUID_1> <TARGET_UUID_2> \
  --json
```

Parse the returned JSON to extract the **project ID**.

In guided mode: show the project ID and confirm creation succeeded.

---

## Step 6: Connect Repository

This step connects the current git repository to the Globalize project created in Step 5.

### Prerequisites

- If no git repository was detected in Step 1: **SKIP** this step. In guided mode, explain why. In unguided mode, note in summary: "Step 6 skipped — not a git repository."
- If no git remote `origin` was detected: **SKIP** this step. In guided mode, suggest adding a remote and trying later. In unguided mode, note in summary: "Step 6 skipped — no git remote configured."

### 6a. Confirm repository details

- **Guided**: present the detected git URL, owner, and repo. Ask the user to confirm before proceeding.
- **Unguided**: use the detected values without asking.

### 6b. Non-GitHub check

If the remote URL does not contain `github.com`: **SKIP** this step. Note: "Step 6 skipped — Globalize currently only supports GitHub repositories."

### 6c. Set up GitHub App

Check for existing installations:

```bash
npx @globalize-now/cli-client github installations --json
```

If an installation's `account.login` matches `<OWNER>` (case-insensitive): use its `id` as `<INSTALLATION_ID>` and skip to 6d.

If no matching installation, start the install flow:

```bash
npx @globalize-now/cli-client github install --no-wait --json
```

This returns `{ "url": "...", "nonce": "..." }`.

**Browser interaction required.** This pauses in both guided and unguided modes — it is an external authorization step (same pattern as `auth login` in Step 3), not an explanation or consent gate. Present the URL to the user and ask them to:

1. Open the URL in their browser
2. Select the correct GitHub account/organisation
3. Approve the GitHub App installation
4. Confirm completion

After the user confirms, verify:

```bash
npx @globalize-now/cli-client github install-status --nonce <NONCE> --json
```

This returns `{ "completed": true, "installationId": "..." }` when done, or `{ "completed": false }` if the user hasn't finished yet. If not completed, ask the user to try again. Once completed, re-run `github installations --json` to get the `<INSTALLATION_ID>` for the target owner.

### 6d. Verify repository access

```bash
npx @globalize-now/cli-client github repos --installation-id <INSTALLATION_ID> --json
```

Confirm that `<OWNER>/<REPO>` appears in the returned list. If not:
- The GitHub App does not have access to this specific repository.
- Inform the user they need to update the installation's repository access settings on GitHub.
- In unguided mode, note in summary and skip the connection step.

### 6e. Detect locale path pattern (if not already known)

If Step 1 did not determine a locale path pattern, use the GitHub App to detect it server-side before connecting:

```bash
npx @globalize-now/cli-client github detect \
  --installation-id <INSTALLATION_ID> \
  --owner <OWNER> \
  --repo <REPO> \
  --json
```

The response includes `localePathPattern` (string or null), `discoveredFiles`, and `framework`. Use `localePathPattern` if present. If not, proceed without it — the flag is optional.

### 6f. Connect the repository

```bash
npx @globalize-now/cli-client repositories create \
  --project-id <PROJECT_ID> \
  --git-url <GIT_URL> \
  --provider github \
  --github-installation-id <INSTALLATION_ID> \
  --locale-path-pattern "<LOCALE_PATH_PATTERN>" \
  --json
```

If no locale path pattern was detected (neither in Step 1 nor in 6e), omit the `--locale-path-pattern` flag.

In guided mode: if a pattern was detected, show it to the user and ask for confirmation before proceeding.

Parse the returned JSON to extract the **repository ID**.

### 6g. Detect i18n configuration

After connecting, run detection to discover i18n patterns in the repository:

```bash
npx @globalize-now/cli-client repositories detect --id <REPO_ID> --json
```

Report findings. In guided mode, explain what was detected. In unguided mode, include in the summary.

If uncommitted or unpushed changes were detected in Step 1, add a note: "i18n detection runs against remote code on GitHub — uncommitted or unpushed local changes are not reflected in the detection results."
