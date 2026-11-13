# A repository a Project already translates

For a repository a Project already translates. A Project is the older way Globalize translates a repository; new GitHub repositories get a Workflow (SKILL.md Step 2). This file stays until Projects are removed.

You are here because one of these happened:

- **Workflow setup refused the repository** with `REPOSITORY_HELD_BY_PROJECT`. The refusal's `details` carry `projectId`, `projectName` and `repositoryId`.
- **The user named a Project** ("the Marketing project", a Project id).
- **The remote is on gitlab.com.** Workflow setup reads GitHub only, so a gitlab.com repository stays on a Project. If the API refuses with its own message, report that message verbatim.

Tell the user, once: the Project "<projectName>" keeps translating this repository, and migrating it to a Workflow is optional, done by an organisation admin in the web app.

---

## P1. Continue on the Project

1. **Find the Project.** Use `details.projectId` from the refusal. When the user named the Project, match the name against `projects list --json`.
2. **Find its repository.** `details.repositoryId` is the id the `repositories` commands take (Globalize's, not GitHub's). Without a refusal, list the Project's repositories and match the git URL:

```bash
npx @globalize-now/cli-client repositories list --project-id <PROJECT_ID> --json
```

3. **Translate.** Starting a translation spends credits, so start it when the user asks for one. Pull request delivery is the safe default:

```bash
npx @globalize-now/cli-client repositories translate \
  --id <REPO_ID> \
  --delivery-mode pr \
  --json
```

`--branch <branch>` translates a branch other than the repository's primary one. Follow the job with `jobs list --project-id <PROJECT_ID> --json` and `jobs get --id <JOB_ID> --json` (P7).

Languages, configuration and patterns of this Project are P4–P6. Glossary and style guides are SKILL.md Steps 3 and 4.

---

## P2. Create a Project and connect a repository

For a gitlab.com repository, or when the user asks for a new Project by name. A GitHub repository with no Project gets a Workflow instead (SKILL.md Step 2).

### P2a. Fetch and match available languages

Projects must be created using **language IDs** returned from the languages API. Before creating a project, fetch the catalog and match the user's desired languages against it.

1. **Fetch the language catalog:**

```bash
npx @globalize-now/cli-client languages list --json
```

This returns an array of language objects, each with `id` (UUID), `name`, and `locale` (BCP 47 code).

2. **Match desired languages against the catalog.** Compare the user's source and target locale codes (e.g., `en`, `fr`, `de`, `ja`) against the `locale` field in the returned list. Extract the corresponding `id` for each match.

3. **Report unsupported languages.** If any of the user's desired languages do not appear in the catalog, inform the user which languages are unsupported and cannot be added to the project. Do not silently skip them — the user must acknowledge the gap before proceeding. Only continue with languages that have a matching catalog entry.

### P2b. Create a project

Use the **language IDs** (UUIDs) matched in P2a — not bare locale codes:

```bash
npx @globalize-now/cli-client projects create \
  --name "My App" \
  --source-language <SOURCE_LANGUAGE_ID> \
  --target-languages <TARGET_LANGUAGE_ID_1> <TARGET_LANGUAGE_ID_2> \
  --json
```

`--target-languages` accepts space-separated or comma-separated values.

Parse the returned JSON to extract the **project ID**.

### P2c. Connect the repository

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

## P3. Detect repository configuration

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

## P4. Project configuration

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
  --config '{"qa": {"enabledChecks": ["placeholder", "terminology"]}}' \
  --json
```

You can also update `--name`, `--source-language`, and `--target-languages` in the same call.

### Config sections

| Section | Fields | Description |
|---------|--------|-------------|
| `qa` | `enabledChecks` (`"placeholder"`, `"length"`, `"terminology"`, `"formatting"`), `lengthRatioBounds` (object keyed by locale, each `{min, max}`), `aiReviewScope` (`"enabled"`, `"disabled"`) | Quality assurance checks and thresholds |
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
  --config '{"qa": {"enabledChecks": ["placeholder", "length", "terminology", "formatting"], "aiReviewScope": "enabled"}}' \
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

## P5. Project languages

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

## P6. Patterns

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

Supported file formats: `json-flat`, `json-nested`, `po`, `xliff-1`, `xliff-2`, `yaml-rails`, `arb`, `xcstrings`, `android-strings`, `chrome-messages`, `wxt-i18n`.

**Single-file formats (no `{locale}` segment).** Most formats use one file per locale, so the pattern carries a `{locale}` placeholder (`locales/{locale}/*.json`). The **`xcstrings`** format (Apple String Catalog) is different: a single multi-locale file holds every locale, so the pattern is the catalog path itself with **no `{locale}` segment** — e.g.

```bash
npx @globalize-now/cli-client patterns create \
  --repository-id <REPO_ID> \
  --pattern "Localizable.xcstrings" \
  --file-format xcstrings \
  --json
```

Use `"**/*.xcstrings"` instead when the project has multiple catalog tables/directories.

**Path-locale overrides (when the directory spelling differs from the language code).** `{locale}` is a literal token substitution — there is no transform. A **browser extension** keeps its catalogs at `_locales/pt_BR/messages.json` (underscore) while the platform language is `pt-BR`, so the difference has to be recorded per language:

```bash
npx @globalize-now/cli-client patterns path-locale \
  --repository-id <REPO_ID> \
  --pattern-id <PATTERN_ID> \
  --language-id <PROJECT_LANGUAGE_ID> \
  --path-locale pt_BR \
  --json
```

`--language-id` is the **project language** UUID from `project-languages list`, not the global language id. Pass `--clear` instead of `--path-locale` to remove an override and fall back to the language's own code. Languages whose spelling already matches (`de`, `fr`, `ja`) need no entry. At repository-create time the same information goes in one shot via `repositories create --path-locales '[{"pattern": …, "locale": "pt-BR", "pathLocale": "pt_BR"}]'`.

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

## P7. Jobs and namespaces

Translation jobs run a project's pipeline. Inspect, start, retry, and export them:

```bash
npx @globalize-now/cli-client jobs list --project-id <PROJECT_ID> --json
npx @globalize-now/cli-client jobs get --id <JOB_ID> --json
npx @globalize-now/cli-client jobs start --id <JOB_ID> --json
npx @globalize-now/cli-client jobs stats --id <JOB_ID> --json
npx @globalize-now/cli-client jobs qa-report --id <JOB_ID> --json
```

QA findings on a job can be dismissed and restored. `--check-type` identifies the QA check (e.g. `placeholder`, `length`, `terminology`, `formatting`), and `--unit-id` the affected translation unit:

```bash
npx @globalize-now/cli-client jobs qa-dismiss --id <JOB_ID> --unit-id <UNIT_ID> --check-type <CHECK> --json
npx @globalize-now/cli-client jobs qa-undismiss --id <JOB_ID> --unit-id <UNIT_ID> --check-type <CHECK> --json
```

### Namespaces

Namespaces group keys within a project (e.g. per feature or page):

```bash
npx @globalize-now/cli-client namespaces list --project-id <PROJECT_ID> --json
npx @globalize-now/cli-client namespaces update --project-id <PROJECT_ID> --namespace-id <NS_ID> --name "common" --json
npx @globalize-now/cli-client namespaces delete --project-id <PROJECT_ID> --namespace-id <NS_ID> --json
```

There is no `namespaces create` command — namespaces are created automatically as keys are imported.

### GitLab commands

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

### Project-scoped translation memory commands (deprecated)

The older project-scoped commands (`translation-memory list|count|fresh-count|delete --project-id`) still work — they resolve the project's memory for you — but they are deprecated, print a warning, and return entries carrying `translationMemoryId` instead of `projectId`. Prefer the `translation-memories` commands in SKILL.md.

---

## Project command reference

| Command | Required flags | Optional flags |
|---------|---------------|----------------|
| `projects list` | | |
| `projects create` | `--name`, `--source-language` (ID), `--target-languages` (IDs) | `--config` (JSON), `--translation-memory-id` |
| `projects update` | `--id` | `--name`, `--source-language`, `--target-languages`, `--config` (JSON), `--cdn-public` (`true`/`false`), `--auto-discover-locales` (`true`/`false`), `--context` |
| `projects get` | `--id` | |
| `projects delete` | `--id` | |
| `projects refs` | `--id` | |
| `projects scorecards` | | `--limit` |
| `projects budget` | `--id` | |
| `projects rotate-webhook-secret` | `--id` | |
| `project-languages list` | `--project-id` | |
| `project-languages add` | `--project-id`, `--name`, `--locale` | `--language-id` |
| `project-languages remove` | `--project-id`, `--language-id` | |
| `repositories list` | `--project-id` | |
| `repositories create` | `--project-id`, `--git-url`, `--provider` | `--branches`, `--github-installation-id`, `--gitlab-connection-id`, `--patterns`, `--import-mode`, `--import-scope` |
| `repositories update` | `--id` | `--git-url`, `--branches`, `--github-installation-id`, `--gitlab-connection-id`, `--provider`, `--detected-framework`, `--import-mode`, `--import-scope` |
| `repositories delete` | `--id` | |
| `repositories detect` | `--id` | |
| `repositories branches` | `--id` | |
| `repositories discover` | `--id` | |
| `repositories translate` | `--id` | `--branch`, `--delivery-mode` (`push`\|`pr`) |
| `patterns list` | `--repository-id` | |
| `patterns create` | `--repository-id`, `--pattern`, `--file-format` | `--position` |
| `patterns update` | `--repository-id`, `--pattern-id` | `--pattern`, `--file-format` |
| `patterns delete` | `--repository-id`, `--pattern-id` | |
| `patterns reorder` | `--repository-id`, `--pattern-id`, `--position` | |
| `patterns bulk` | `--repository-id`, `--patterns` (JSON) | |
| `patterns path-locale` | `--repository-id`, `--pattern-id`, `--language-id` | `--path-locale`, `--clear` |
| `gitlab install` | | `--no-wait` |
| `gitlab install-status` | `--nonce` | |
| `gitlab connections` | | |
| `gitlab connection-delete` | `--id` | |
| `gitlab projects` | `--connection-id` | |
| `gitlab branches` | `--connection-id`, `--project-id` | |
| `gitlab detect` | `--connection-id`, `--project-id` | |
| `namespaces list` | `--project-id` | |
| `namespaces update` | `--project-id`, `--namespace-id`, `--name` | |
| `namespaces delete` | `--project-id`, `--namespace-id` | |
| `translation-memory list` _(deprecated)_ | `--project-id` | `--query`, `--source-language-id`, `--target-language-id`, `--limit`, `--cursor` |
| `translation-memory delete` _(deprecated)_ | `--project-id`, `--entry-id` | |
| `translation-memory count` _(deprecated)_ | `--project-id` | `--target-language-id` |
| `translation-memory fresh-count` _(deprecated)_ | `--project-id`, `--target-language-id` | |
| `jobs list` | | `--project-id`, `--status`, `--limit`, `--offset` |
| `jobs get` | `--id` | |
| `jobs start` | `--id` | |
| `jobs retry` | `--id` | |
| `jobs stats` | `--id` | |
| `jobs qa-report` | `--id` | |
| `jobs qa-dismiss` | `--id`, `--unit-id`, `--check-type` | `--reason`, `--note` |
| `jobs qa-undismiss` | `--id`, `--unit-id`, `--check-type` | |
| `jobs export` | `--id` | `--target-lang` |
| `jobs export-manifest` | `--id` | |
| `jobs units` | `--job-id`, `--target-project-language-id` | `--filter`, `--search`, `--limit`, `--cursor` |
| `jobs unit-get` | `--job-id`, `--unit-id` | |
| `jobs files` | `--id` | `--limit`, `--cursor` |
| `jobs redeliver` | `--id` | |

---

## Project gotchas

- **IDs are UUIDs (except `--installation-id`)**: All `--id`, `--project-id`, `--org-id`, etc. expect UUID values returned from prior create/list commands. **Two different installation ID flags exist — they take different value types.** `--installation-id` (used by `github repos`, `github branches`, `github detect`) expects the **numeric** GitHub installation ID (the `installationId` field from `github installations --json`, e.g. `122432012`). `--github-installation-id` (used by `repositories create/update`) expects the **UUID** (the `id` field from `github installations --json`). Always capture both IDs from the JSON response.
- **GitHub App required for GitHub repos**: When connecting a GitHub repository, use the GitHub App flow (`github installations` / `github install`) to obtain an installation ID and pass it via `--github-installation-id` on `repositories create`. Without this, Globalize cannot access repo contents. Use `github install --no-wait --json` to get the install URL without blocking, present it to the user, then check completion with `github install-status --nonce <NONCE> --json`.
- **Patterns are managed separately**: After creating a repository, manage locale path patterns via `patterns list/create/update/delete/reorder`. The `--patterns` flag on `repositories create` is only for initial setup. Pattern changes after creation require the pattern CRUD commands.
- **GitLab uses connections, not installations**: For GitLab repos, use `gitlab connections` (not `github installations`) and pass `--gitlab-connection-id` (not `--github-installation-id`) on `repositories create`. GitLab project IDs are **numeric** (not UUIDs).
- **Validate languages before project creation**: Always fetch `languages list --json` and match the user's desired locales against the catalog. Use the returned UUIDs for `--source-language` and `--target-languages` — do not pass raw locale codes. Inform the user about any unsupported languages that have no catalog match.
