---
name: globalize-now-project-setup
description: >-
  Create a Globalize translation project, connect a GitHub or GitLab repository, and
  set catalog file patterns. Use this skill when the user asks to create a Globalize
  project, connect their repo to Globalize, or wire their translation catalogs to the
  Globalize platform. Assumes the Globalize CLI is already installed and authenticated —
  if not, run globalize-now-account-setup first. For managing existing projects
  (glossaries, style guides, team members), use globalize-now-cli-use.
---

# Globalize Project Setup

The Globalize CLI (`@globalize-now/cli-client`) lets AI agents manage translation projects, languages, glossaries, style guides, and repository connections on the [Globalize](https://globalize.now) platform.

This skill creates a translation project, connects your git repository, and sets the catalog file patterns. It assumes you are already signed in.

Follow these steps in order.

---

## Auth precheck

Before anything else, confirm the CLI is installed and authenticated:

```bash
npx @globalize-now/cli-client auth status --json
```

If this returns a valid `source` and `key`, continue. If it fails or reports no credentials, **STOP**:

> "You're not signed in to Globalize yet. Run the `globalize-now-account-setup` skill first to install the CLI and authenticate, then re-run this skill."

---

## Supplied inputs (orchestrated mode)

This skill can be driven by another skill (e.g. the `globalize-guide` orchestrator) that has already collected the project details and just-converted catalog paths.

**If `.globalize/globalize-inputs.json` exists in the project root** (or the invoking prompt supplies these values directly), read it and treat its fields as authoritative: skip the **detection** in Step 1 and the **Setup Mode** prompt below, run **unguided**, and proceed straight to Step 2 (provider connection) → Step 3 (create project) → Step 4 (connect repo). Do **not** re-detect or re-prompt for anything the file provides.

Expected shape:

```json
{
  "projectName": "my-app",
  "sourceLocale": "en",
  "targetLocales": ["de", "fr", "es"],
  "provider": "github",
  "owner": "acme",
  "repo": "my-app",
  "gitUrl": "https://github.com/acme/my-app.git",
  "catalogPath": "src/locales/{locale}/messages.po",
  "localePathPattern": "src/locales/{locale}/messages.po",
  "fileFormat": "po",
  "importMode": "ignore",
  "importScope": "new_keys_only",
  "mode": "orchestrated"
}
```

`localePathPattern` + `fileFormat` are the values to pass to `repositories create --patterns` (skip the server-side `github detect` / `gitlab detect` step — patterns are already known). Still run the interactive provider connection in Step 2 (GitHub App install / GitLab OAuth) if no installation/connection exists yet — that browser approval is unavoidable.

**Otherwise** (no inputs file, standalone use), detect and prompt as described below.

---

## Setup Mode

After Step 1 (detection) completes without blockers, ask the user:

> **How would you like to proceed?**
> 1. **Guided** — I'll explain each step before and after.
> 2. **Unguided** — I'll run all steps without pausing and show a full summary at the end.

### Guided mode rules

- **Before each step**: briefly explain what will happen and why.
- **After each step**: summarize what changed (project created, repo connected, patterns set).

### Unguided mode rules

- Execute all steps without pausing for per-step explanations.
- Hard stops (e.g., source language not in the Globalize catalog) still halt execution — these are never skipped.
- At the end, produce a summary:

```
## Project Setup Complete

### What was done
- [x] Step 1: Detect Environment — {detected signals summary}
- [x] Step 2: Connect Git Provider — {GitHub|GitLab} ({owner/repo}) or "skipped — no git remote"
- [x] Step 3: Create Project — "{name}" (source: {source}, targets: {targets}, config: {config summary or "none"})
- [x] Step 4: Connect Repository — {owner/repo} connected, patterns: {count configured or "none"}, import mode: {mode}

### Warnings (if any)
- {e.g., Uncommitted changes detected — i18n detection used remote code only}
- {e.g., Language "xyz" not found in Globalize catalog — skipped}

### Next steps
- {recommendations — e.g. pull translations, manage glossaries via globalize-now-cli-use}
```

#### Required choices in unguided mode

**Auto-detect first, ask only if detection fails.** No choices are collected upfront. The skill detects everything it can from the environment and existing i18n config, and only prompts the user when a value cannot be determined.

- **Project name**: derived from the repo name (parsed from the git remote URL, e.g. `github.com/acme/my-app` → `my-app`) or the current directory name. Never ask.
- **Source language**: detected from existing i18n config (`sourceLocale`, `defaultLocale`, `lng`). If not detected, default to `en`.
- **Target languages**: detected from existing i18n config (remaining locales after excluding source). If not detected, ask the user.
- **Locale path patterns**: detected from i18n config or directory structure. Falls back to server-side detection via `github detect` or `gitlab detect` in Step 4. Never ask the user.
- **Import mode**: `ignore` by default. Never ask.
- **Import scope**: `new_keys_only` by default. Never ask.

If no localization setup is detected at all (non-localized project), ask the user for source and target languages before proceeding to Step 3.

---

## Step 1: Detect the Environment

> In orchestrated mode (a `.globalize/globalize-inputs.json` file is present), skip this detection entirely and use the supplied values.

Check the following before proceeding:

| Signal | How to detect |
|--------|--------------|
| **Package manager** | `package-lock.json` → npm. `yarn.lock` → yarn. `pnpm-lock.yaml` → pnpm. `bun.lock` → bun. |
| **Git repository** | `git rev-parse --is-inside-work-tree` exits 0. |
| **Git remote URL** | `git remote get-url origin` — record the URL. If no remote named `origin`, record as absent. |
| **Git provider** | Parse the remote URL. If it contains `github.com`, record provider as `github` and extract `<OWNER>/<REPO>` from HTTPS (`https://github.com/OWNER/REPO.git`) or SSH (`git@github.com:OWNER/REPO.git`) format. If it contains `gitlab.com`, record provider as `gitlab` and extract `<OWNER>/<PROJECT>` from HTTPS (`https://gitlab.com/OWNER/PROJECT.git`) or SSH (`git@gitlab.com:OWNER/PROJECT.git`) format. **Important:** The CLI only accepts HTTPS URLs for `--git-url`. If the remote is SSH, convert to HTTPS: `https://github.com/<OWNER>/<REPO>.git` or `https://gitlab.com/<OWNER>/<PROJECT>.git`. |
| **Uncommitted changes** | `git status --porcelain` — non-empty output means uncommitted changes exist. |
| **Unpushed commits** | `git log @{u}..HEAD --oneline 2>/dev/null` — non-empty output means unpushed commits. Fails gracefully if no upstream is set. |

### Existing localization setup

Scan for known i18n config files to auto-detect source and target languages. Use the first match found — the project likely has one primary i18n setup.

| Signal | How to detect | What to extract |
|--------|--------------|-----------------|
| **LinguiJS** | `lingui.config.ts` or `lingui.config.js` exists | `sourceLocale` → source language, `locales` array → all languages |
| **next-intl** | `src/i18n/routing.ts` or `i18n/routing.ts` exists | `defaultLocale` → source language, `locales` array → all languages |
| **Paraglide** | `project.inlang/settings.json` exists (and/or `@inlang/paraglide-js` in `package.json` deps) | `baseLocale` → source language, `locales` array → all languages |
| **i18next** | `i18next` in `package.json` deps + config file (`i18n.ts`, `i18n.js`, `i18next.config.*`) | `lng` or `fallbackLng` → source language, `supportedLngs` → all languages |
| **react-intl** | `react-intl` or `@formatjs/intl` in `package.json` deps | Check for `defaultLocale` in config; scan `lang/` or `translations/` directories |
| **Locale directories** | Directories named `locales/`, `messages/`, `translations/`, `lang/` | Subdirectory names or JSON file names (e.g., `en.json`, `fr.json`) indicate available locales |
| **Rails** | `config/locales/` directory exists with locale-named `.yml` files (e.g. `en.yml`, `pt-BR.yml`). Optionally, parse `config/application.rb` for `config.i18n.default_locale`. | `config.i18n.default_locale` (or `en` if absent) → source language; all other locale codes in `config/locales/*.yml` filenames → target languages. Locale codes may be hyphenated (`pt-BR`, `zh-TW`) — pass through verbatim. |
| **Android** | `res/values/strings.xml` exists (the locale-less default, typically under `app/src/main/res`), with per-locale `res/values-<qualifier>/strings.xml` overlays. | `res/values/strings.xml` → source language (the app default; report as `en` unless otherwise known). Each `res/values-<qualifier>/` dir → a target language: parse the qualifier and normalize **both** the legacy form (`values-pt-rBR` → `pt-BR`, `values-es` → `es`) and the BCP47 `b+` form (`values-b+sr+Latn` → `sr-Latn`) to BCP47. |
| **Locale files** | `*.po`, `*.pot`, `*.xliff`, `*.json` files in locale-like paths | File/directory names map to locale codes |

**Detection priority**: Config files (explicit locale lists) take precedence over directory/file scanning (inferred locales).

**Source vs target**: The source language is the `sourceLocale` / `defaultLocale` / `lng` from config. All other locales in the list are target languages. **Always exclude the source locale from the target list.**

If none of the above signals are found, record "no localization setup detected."

### Locale path pattern

During detection, also determine the **locale file path pattern** — a path template showing where locale files live. Supported placeholders and wildcards:

- `{locale}` — locale code. Required for **per-locale file layouts** (one file per language, where the locale appears in the file or directory **name**). **Omitted** for formats where the locale lives outside a filename token: a **single multi-locale file** such as an Apple String Catalog (`xcstrings`) holds every locale, so the pattern is the file path itself with no `{locale}` segment; and **`android-strings`** carries the locale in a resource **directory qualifier** (`res/values-<qualifier>/`), so its pattern points at the source `res/values/strings.xml` and the handler discovers target locales from the `values-*` dirs. Do not synthesize a `{locale}` segment for these formats (see their pattern rows below).
- `{namespace}` — namespace name (optional, for multi-namespace setups)
- `*` and `**` — wildcards for matching multiple files/directories

| Source | How to derive the pattern |
|--------|--------------------------|
| **LinguiJS** (single catalog) | Read `catalogs[0].path` from config. Strip `<rootDir>/` prefix. Append `.po`. Example: `src/locales/{locale}/messages.po` |
| **LinguiJS** (per-page catalogs) | Read `catalogs[0].path`. Replace `{entryDir}`/`{entryName}` with `**/*` wildcards, keep `{locale}`. Example: `src/app/{locale}/**/*.po` |
| **next-intl** | Check `messages/` directory. Flat JSON files per locale → `messages/{locale}.json`. Subdirectories with multiple namespace files → `messages/{locale}/{namespace}.json` |
| **Paraglide** | Flat message catalog per locale. `messages/{locale}.po` for the PO format (the globalize-guide default — a `plugin.globalizeNow.po` key in `project.inlang/settings.json`, or `messages/*.po` files present); `messages/{locale}.json` for the ICU-JSON format (`plugin.inlang.icu-messageformat-1`, or `messages/*.json`) |
| **i18next** | Read `backend.loadPath` from config. Replace `{{lng}}` → `{locale}`, `{{ns}}` → `{namespace}`. Example: `locales/{locale}/{namespace}.json` |
| **react-intl** | No standard config key. Derive from directory scanning below. |
| **Rails** | Pattern is always `config/locales/{locale}.yml`. Note in detection output that Rails projects may also have split files (e.g. `config/locales/devise.en.yml`) or subdirectories — the pattern targets the primary per-locale files. |
| **Apple String Catalog** (`.xcstrings`) | A **single multi-locale file** holds every locale, so there is **no `{locale}` segment**. The pattern is the catalog path itself: `Localizable.xcstrings` (the default table), or `**/*.xcstrings` when there are multiple tables/directories (e.g. `InfoPlist.xcstrings`, a per-storyboard `Main.xcstrings`). `fileFormat: xcstrings`; the source language is the catalog's `sourceLanguage` / Info.plist `CFBundleDevelopmentRegion`. The `{locale}` "required" rule above does not apply to this format. |
| **Android** | **No `{locale}` segment** — the locale lives in the directory qualifier (`res/values-<qualifier>/strings.xml`), so point the pattern at the source file `**/res/values/strings.xml` (or the module-specific `app/src/main/res/values/strings.xml`). The `android-strings` handler discovers the target `res/values-*/strings.xml` overlays and normalizes their qualifiers ⇄ BCP47 on its own. If the active CLI form cannot express a directory-qualifier (no-`{locale}`) source, fall back to Step 4 server-side detection (`github detect` / `gitlab detect`) for the pattern rather than forcing a `{locale}` token. |
| **Locale directories/files** | Examine the discovered files. Replace the locale code segment with `{locale}`. If multiple files per locale follow a namespace pattern (e.g., `locales/en/common.json` + `locales/en/auth.json`), use `{namespace}` for the varying filename: `locales/{locale}/{namespace}.json`. If the structure doesn't suggest named namespaces, use wildcards: `locales/{locale}/*.json`. Single file per locale: `locales/{locale}.json`. |

If no pattern can be determined locally, record as absent — Step 4 will attempt server-side detection.

### File format

When a locale path pattern is determined, also determine the **file format**. The `fileFormat` value must be one of: `json-flat`, `json-nested`, `po`, `xliff-1`, `xliff-2`, `yaml-rails`, `arb`, `xcstrings`, `android-strings`.

| Source | fileFormat value |
|--------|----------------|
| **LinguiJS** | `po` |
| **next-intl** | `json-nested` (next-intl uses nested key structure) |
| **Paraglide** | `po` if `messages/*.po` are present (the globalize-guide default — PO format via `@globalize-now/paraglidejs-po-format`, carries `#.` translator comments). `json-flat` for `messages/*.json` (ICU-JSON; flat key → ICU string, no translator comments) |
| **i18next** | `json-nested` by default. If `keySeparator: false` in config, use `json-flat`. |
| **react-intl** | Inspect file content (see JSON detection below) |
| **`.po` / `.pot` files** | `po` |
| **`.xliff` files** | `xliff-1` — if you can inspect the file, check the `version` attribute: `2.0` → `xliff-2`, `1.x` → `xliff-1` |
| **`.yaml` / `.yml` files** | `yaml-rails` (Rails-style locale-rooted YAML) |
| **`.arb` files** | `arb` (Flutter Application Resource Bundle) |
| **`.xcstrings` files** | `xcstrings` (Apple String Catalog) |
| **`strings.xml` files** | `android-strings` (Android string resources) |
| **`.json` files** | Inspect content: if all top-level values are strings (`{"greeting": "Hello", "bye": "Goodbye"}`), use `json-flat`. If top-level values contain objects (`{"home": {"greeting": "Hello"}}`), use `json-nested`. |

If the file format cannot be determined locally, record as absent — Step 4 server-side detection may provide it.

### Detection outcomes

If no git repo or no git remote is detected, Step 3 (project creation) still runs; Step 2 and Step 4 (provider connection + repo connection) are skipped.

If no blockers were found, proceed to the **Setup Mode** prompt before continuing to Step 2.

---

## Step 2: Connect the Git provider

Establishing the provider connection (GitHub App install / GitLab OAuth) is the one step that may require a browser approval, so do it **before** project creation — that way the single interactive handoff happens up front rather than mid-flow.

### Prerequisites

- If no git repository was detected in Step 1: **SKIP** Steps 2 and 4. The project is still created in Step 3; repo connection can be added later. In guided mode, explain why. In unguided mode, note in summary: "Repo connection skipped — not a git repository."
- If no git remote `origin` was detected: **SKIP** Steps 2 and 4. Note: "Repo connection skipped — no git remote configured."
- If the remote is neither `github.com` nor `gitlab.com`: **SKIP** Steps 2 and 4. Note: "Repo connection skipped — Globalize supports GitHub and GitLab repositories only."

### Confirm repository details

- **Guided**: present the detected git URL, owner, and repo. Ask the user to confirm before proceeding.
- **Unguided / orchestrated**: use the detected (or supplied) values without asking.

### 2a. GitHub App

Check for existing installations:

```bash
npx @globalize-now/cli-client github installations --json
```

Each installation has `id` (a **UUID** — Globalize's internal installation record), `installationId` (the **numeric** GitHub installation ID, e.g. `122432012`), `accountLogin` (the GitHub org or user name), and `accountType`. Match `accountLogin` against `<OWNER>` (case-insensitive). Capture **both** IDs: use the numeric `installationId` as `<GITHUB_INSTALLATION_ID>` (for `github repos/branches/detect --installation-id`) and the UUID `id` as `<INSTALLATION_UUID>` (for `repositories create --github-installation-id`).

If no matching installation, start the install flow:

```bash
npx @globalize-now/cli-client github install --no-wait --json
```

This returns `{ "installUrl": "...", "nonce": "..." }`.

**Browser interaction required.** This pauses in both guided and unguided modes — it is an external authorization step (same pattern as `auth login`), not an explanation or consent gate. Present the URL to the user and ask them to:

1. Open the URL in their browser
2. Select the correct GitHub account/organisation
3. Approve the GitHub App installation
4. Confirm completion

After the user confirms, verify:

```bash
npx @globalize-now/cli-client github install-status --nonce <NONCE> --json
```

This returns `{ "status": "completed", "installationId": "...", "accountLogin": "..." }` when done, `{ "status": "pending" }` if the user hasn't finished yet, or `{ "status": "expired" }` if the nonce expired. Check `status === "completed"`. If not completed, ask the user to try again. Once completed, re-run `github installations --json` to get `<GITHUB_INSTALLATION_ID>` (numeric `installationId`) and `<INSTALLATION_UUID>` (UUID `id`) for the target owner.

Then verify repository access:

```bash
npx @globalize-now/cli-client github repos --installation-id <GITHUB_INSTALLATION_ID> --json
```

Confirm that `<OWNER>/<REPO>` appears in the returned list. If not:
- The GitHub App does not have access to this specific repository.
- Inform the user they need to update the installation's repository access settings on GitHub.
- In unguided mode, note in summary and skip the connection (Step 4).

### 2b. GitLab connection

Check for existing connections:

```bash
npx @globalize-now/cli-client gitlab connections --json
```

Each connection has `id` (UUID), `username`, `gitlabUserId`, `status`, and `createdAt`. If a connection's `username` matches the GitLab project owner (case-insensitive), use its `id` as `<CONNECTION_ID>`.

If no matching connection, start the OAuth flow:

```bash
npx @globalize-now/cli-client gitlab install --no-wait --json
```

This returns `{ "installUrl": "...", "nonce": "...", "expiresIn": ... }`.

**Browser interaction required.** Present the URL to the user and ask them to:

1. Open the URL in their browser
2. Authorize the GitLab OAuth application
3. Confirm completion

After the user confirms, verify:

```bash
npx @globalize-now/cli-client gitlab install-status --nonce <NONCE> --json
```

This returns `{ "status": "completed", "connectionId": "...", "username": "..." }` when done, `{ "status": "pending" }` if not finished, or `{ "status": "expired" }` if the nonce expired. Once completed, use `connectionId` as `<CONNECTION_ID>`.

Then verify project access:

```bash
npx @globalize-now/cli-client gitlab projects --connection-id <CONNECTION_ID> --json
```

Confirm that the target project appears in the list by matching `pathWithNamespace` against `<OWNER>/<PROJECT>`. Record the numeric `id` as `<GITLAB_PROJECT_ID>`.

---

## Step 3: Create Project

### 3a. Check for existing projects

```bash
npx @globalize-now/cli-client projects list --json
```

If projects already exist:
- **Guided**: present the list (names and IDs) and ask if the user wants to reuse an existing project or create a new one. If reusing, record the project ID and skip to Step 4.
- **Unguided**: create a new project. If a project with the same name already exists, note it in the summary but proceed.

### 3b. Determine project name

Use the repo name parsed from the git remote URL (e.g., `github.com/acme/my-app` → `my-app`). If no git remote was detected, use the current directory name. Do not ask the user.

### 3c. Determine languages

Use the locales detected in Step 1:

- **i18n config found** (LinguiJS, next-intl, i18next, react-intl): use the detected source locale and target locales.
  - Guided: confirm the detected languages with the user before proceeding.
  - Unguided: proceed with detected values.
- **Locale directories/files found but no config**: infer locales from directory or file names. Default the source language to `en` if present in the list. Remove the source locale from the target list.
  - Guided: confirm with the user.
  - Unguided: proceed with inferred values.
- **Nothing detected** (non-localized project):
  - Guided: ask the user for source and target languages.
  - Unguided: default source to `en`, ask the user for target languages. This is the one required prompt in unguided mode.

### 3d. Fetch and match languages

```bash
npx @globalize-now/cli-client languages list --json
```

Match the detected or provided locale codes against the `locale` field in the returned list. Extract the UUID `id` for each match.

- **Source locale in target list**: if the source locale appears in the target list, remove it. The source language must never be added as a target language.
- If the **source language** has no match in the catalog: **HARD STOP** in both modes. The project cannot be created without a valid source language.
- If a **target language** has no match: guided mode informs the user and asks how to proceed; unguided mode skips that language and notes it in the summary.

### 3e. Create the project

Build the `--config` flag based on the git provider detected in Step 1:

- **GitHub** (`github.com` remote): `{"github": {"prTranslations": true, "ignoreDraftPrs": true}}`
- **GitLab** (`gitlab.com` remote): `{"gitlab": {"mrTranslations": true, "ignoreDraftMrs": true}}`
- **No git remote / unsupported provider**: omit `--config`

```bash
npx @globalize-now/cli-client projects create \
  --name "<PROJECT_NAME>" \
  --source-language <SOURCE_LANGUAGE_UUID> \
  --target-languages <TARGET_UUID_1> <TARGET_UUID_2> \
  --config '<CONFIG_JSON>' \
  --json
```

Parse the returned JSON to extract the **project ID**.

In guided mode: show the project ID and the applied config, and confirm creation succeeded.

**Note:** Project configuration (QA checks, provider settings, GitHub/GitLab behaviour, notifications) can be customised after creation via `projects update --id <PROJECT_ID> --config '<JSON>'`. See the `globalize-now-cli-use` skill (Step 2.5) for details.

---

## Step 4: Connect Repository

This step wires the git repository (provider connection established in Step 2) to the project created in Step 3. If Step 2 was skipped (no git repo / remote / unsupported provider), **SKIP** this step too.

### 4a. Detect locale path patterns (if not already known)

If Step 1 (or the supplied inputs) already determined a `localePathPattern` + `fileFormat`, skip this sub-step.

Otherwise, detect server-side using the provider connection from Step 2.

**GitHub:**

```bash
npx @globalize-now/cli-client github detect \
  --installation-id <GITHUB_INSTALLATION_ID> \
  --owner <OWNER> \
  --repo <REPO> \
  --json
```

**GitLab:**

```bash
npx @globalize-now/cli-client gitlab detect \
  --connection-id <CONNECTION_ID> \
  --project-id <GITLAB_PROJECT_ID> \
  --json
```

The response includes `scoredPresets` (ranked i18n preset matches with confidence levels), `preset` (best match or null), `sourceLanguage`, `targetLanguages`, `localePathPattern` (string or null), `fileFormat` (string or null), `discoveredFiles` (array of `{path, language}`), `namespaces` (array of `{name, filePattern}`), and `framework` (string or null). Use `localePathPattern` and `fileFormat` if present to construct patterns for the repository create command.

### 4b. Connect the repository

**For GitHub:**

```bash
npx @globalize-now/cli-client repositories create \
  --project-id <PROJECT_ID> \
  --git-url <GIT_URL> \
  --provider github \
  --github-installation-id <INSTALLATION_UUID> \
  --patterns '[{"pattern": "<LOCALE_PATH_PATTERN>", "fileFormat": "<FORMAT>"}]' \
  --json
```

**For GitLab:**

```bash
npx @globalize-now/cli-client repositories create \
  --project-id <PROJECT_ID> \
  --git-url <GIT_URL> \
  --provider gitlab \
  --gitlab-connection-id <CONNECTION_ID> \
  --patterns '[{"pattern": "<LOCALE_PATH_PATTERN>", "fileFormat": "<FORMAT>"}]' \
  --json
```

`<FORMAT>` must be exactly one of: `json-flat`, `json-nested`, `po`, `xliff-1`, `xliff-2`, `yaml-rails`, `arb`, `xcstrings`, `android-strings`. Do not use other values (e.g. `json`, `xliff`, or `yaml` alone are invalid). Refer to the "File format" table in Step 1 for how to determine the correct value.

If no patterns were detected (neither in Step 1/supplied inputs nor in 4a), omit the `--patterns` flag. The `--import-mode` and `--import-scope` flags are optional (default to `ignore` and `new_keys_only`).

In guided mode: if patterns were detected, show them to the user and ask for confirmation before proceeding.

Parse the returned JSON to extract the **repository ID**.

### 4c. Detect i18n configuration

After connecting, run detection to discover i18n patterns in the repository:

```bash
npx @globalize-now/cli-client repositories detect --id <REPO_ID> --json
```

Report findings. In guided mode, explain what was detected. In unguided mode, include in the summary.

If uncommitted or unpushed changes were detected in Step 1, add a note: "i18n detection runs against remote code — uncommitted or unpushed local changes are not reflected in the detection results."

---

## Next step

Project created and repo connected. From here, use the **`globalize-now-cli-use`** skill (or the `globalize` CLI directly) for ongoing translation work — pulling translations, tracking status, managing languages, glossaries, and style guides.
