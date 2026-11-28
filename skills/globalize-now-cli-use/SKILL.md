---
name: globalize-now-cli-use
description: >-
  Set up and manage Globalize translation for a repository using the CLI. Use this skill when
  the user asks to set up translations for a GitHub or gitlab.com repository, start or check a translation run,
  manage Workflows or their languages, manage glossaries, style guides or translation memories,
  invite team members, manage API keys, or perform any Globalize platform operation. This skill
  assumes the CLI is already installed and authenticated — run globalize-now-account-setup first if not.
---

# Globalize CLI Usage

This skill guides you through managing translation on the [Globalize](https://globalize.now) platform using the CLI (`globalise-now-cli`). A GitHub or `gitlab.com` repository is translated by a **Workflow**: Step 2 sets one up and starts its first translation.

**Projects are deprecated, and this skill doesn't manage them.** A repository a Project already translates (the older setup) is refused by Workflow setup with `REPOSITORY_HELD_BY_PROJECT`; when that happens, or when the user asks to work on a Project, tell them: "Project **{projectName}** translates this repository, and Projects are deprecated. An organisation admin can move it to a Workflow in the Globalize web app, and it keeps its translations. After that, I can manage it as a Workflow." Then stop that task.

**Always use `--json`** when running commands programmatically. A success prints `{"data": …}` on stdout. A failure exits 1 and prints `{"error": …, "status": …, "code": …, "details": …}` on stdout: branch on `code`, and read `details` for the ids it carries.

All examples use `npx @globalize-now/cli-client`. If the CLI is installed globally, replace with `globalise-now-cli`.

---

## Step 1: Prerequisite Check

Verify authentication is configured:

```bash
npx @globalize-now/cli-client auth status --json
```

If this fails or reports no credentials, run the `globalize-now-account-setup` skill first.

---

## Step 2: Set up a Workflow and start a translation

A Workflow watches a GitHub or `gitlab.com` repository's branches, reads its locale files, and delivers translations as a pull request (a merge request on GitLab). Setup is two calls: `workflows preview-setup` proposes the Workflow and writes nothing; `workflows setup` publishes exactly what the preview proposed. Neither starts a run.

### 2a. Identify the repository

```bash
git remote get-url origin
```

Parse `<OWNER>/<REPO>` from `https://github.com/<OWNER>/<REPO>.git` or `git@github.com:<OWNER>/<REPO>.git`. On gitlab.com it is the project's whole path, nested groups included (`git@gitlab.com:group/subgroup/project.git` → `group/subgroup/project`).

- **github.com** → continue with 2b.
- **gitlab.com** → continue with 2b-GitLab in place of 2b.
- **Any other host (self-hosted GitLab included), or no remote** → stop. Tell the user Workflow setup needs a GitHub or gitlab.com repository, and ask for its `owner/repo`.

Confirm `<OWNER>/<REPO>` with the user before calling Globalize, and wait for the answer.

### 2b. Find the GitHub App installation

```bash
npx @globalize-now/cli-client github installations --json
```

Each installation has `id` (a UUID) and `installationId` (GitHub's **numeric** id, e.g. `122432012`). Find the one whose `accountLogin` matches `<OWNER>` (case-insensitive) and keep its numeric `installationId` as `<INSTALLATION_ID>`: Workflow setup takes the number.

**No match** → install the GitHub App:

```bash
npx @globalize-now/cli-client github install --no-wait --json
```

Show the user the returned `installUrl` and ask them to approve the installation for `<OWNER>` in the browser. Once they confirm, check it with the returned `nonce`:

```bash
npx @globalize-now/cli-client github install-status --nonce <NONCE> --json
```

`status` is `completed`, `pending` (ask the user to finish, then check again) or `expired` (start the install again). After `completed`, run `github installations --json` again for `<INSTALLATION_ID>`.

Then confirm the App can read the repository:

```bash
npx @globalize-now/cli-client github repos --installation-id <INSTALLATION_ID> --json
```

`<OWNER>/<REPO>` must be in the list; otherwise the user grants the installation access to it on GitHub.

### 2b-GitLab. Find the GitLab connection

Globalize reaches a gitlab.com repository through a person's GitLab connection (OAuth). Setup registers a webhook on the repository through it, which takes the **Maintainer** role.

```bash
npx @globalize-now/cli-client gitlab connections list --json
```

Each connection has `id` (a UUID), `username` and `status`. For each `active` one, look the repository up by its last path segment:

```bash
npx @globalize-now/cli-client gitlab repositories list --connection-id <CONNECTION_ID> --search <PROJECT> --json
```

The entry whose `pathWithNamespace` equals `<OWNER>/<REPO>` (case-insensitive) is the repository: keep its numeric `id` as `<GITLAB_PROJECT_ID>` and the connection's `id` as `<CONNECTION_ID>`. Several connections reach it → ask the user which, naming each `username`.

**None reaches it** → connect one:

```bash
npx @globalize-now/cli-client gitlab connections connect --no-wait --json
```

Show the user the returned `installUrl` and ask them to authorize Globalize in the browser, signed in to GitLab as a Maintainer of `<OWNER>/<REPO>`. Once they confirm, check it with the returned `nonce`:

```bash
npx @globalize-now/cli-client gitlab install-status --nonce <NONCE> --json
```

`status` is `completed` (with `connectionId`), `pending` (ask the user to finish, then check again) or `expired` (connect again). After `completed`, look the repository up through `connectionId` as above; still missing → that GitLab account isn't a member of the repository.

In 2c and 2d, pass `--gitlab-connection <CONNECTION_ID> --repository <GITLAB_PROJECT_ID>` in place of `--installation-id <INSTALLATION_ID> --repository <OWNER>/<REPO>`. Everything else is the same.

### 2c. Preview the Workflow

```bash
npx @globalize-now/cli-client workflows preview-setup \
  --installation-id <INSTALLATION_ID> \
  --repository <OWNER>/<REPO> \
  --json
```

Detection reads the repository's default branch on GitHub or GitLab, not the local working copy. Pass overrides only where the user or a `need` asks for one:

| Flag | Value |
|------|-------|
| `--branches` | Watched branches, comma-separated; detection reads the first (default: the default branch) |
| `--source-language` | Source locale, e.g. `en` |
| `--target-languages` | Target locales, comma-separated: `de,fr,pt-BR` |
| `--patterns` | JSON array in place of detection's: `'[{"pattern":"locales/{locale}.json","format":"json-flat","pathLocales":{"pt-BR":"pt_BR"}}]'` |
| `--name` | Workflow name (default: `owner/repo`) |
| `--translation-memory-id` | An existing memory from `translation-memories list` (default: setup creates one) |
| `--import` | `ignore` (default), `reviewed` or `translated`: what the first run does with translations already in the repository |

`pathLocales` maps a language to its spelling in the path, for directories like `_locales/pt_BR/`. Pattern formats: `json-flat`, `json-nested`, `po`, `xliff-1`, `xliff-2`, `yaml-rails`, `arb`, `xcstrings`, `android-strings`, `chrome-messages`, `wxt-i18n`, `html`, `markdown`.

To share an existing translation memory, list the organisation's memories and pass the chosen `id`:

```bash
npx @globalize-now/cli-client translation-memories list --json
```

The preview answers one of three shapes under `data`:

- **`ready: true`** → show the user what it will publish: `definition.input.config` (`branches`, `sourceLanguage`, `patterns`), `definition.targetLanguages.declared`, `excludedGroups` (locale files left out as unlikely), `newTranslationMemory`, `takeovers` (empty Projects whose repository rows it takes over) and `warnings`. Keep `previewHash`. Ask the user to confirm.
- **`ready: false` with `needs`** → each need has a `code`, a `message`, what it `found`, and the `override` to pass: `sourceLanguage` → `--source-language`, `targetLanguages` → `--target-languages`, `patterns` → `--patterns`. Show the user each message and ask for the value; the languages come from the user. Then preview again with the overrides. `no_locale_files` means the branch has no locale files yet: set up i18n first with the `globalize-guide` skill, or pass `--patterns` when the setup sits on a branch that isn't merged yet.
- **`ready: false` with `alreadySetUp`** → the repository already has a Workflow, `alreadySetUp.workflowId`. Skip to 2e with that id.

Refusals (`code` in the failure JSON):

| `code` | Meaning and next step |
|--------|-----------------------|
| `REPOSITORY_HELD_BY_PROJECT` | A Project already translates this repository; `details.projectName` names it. Don't continue on it: tell the user an organisation admin moves it to a Workflow in the web app (top of this skill), then stop. After the move, a preview answers `alreadySetUp`. |
| `NOT_FOUND` (404) | The installation or GitLab connection isn't this organisation's, or it can't see the repository or branch. Recheck 2b. |
| `WORKFLOW_NO_GITLAB_CONNECTION` | The GitLab connection needs authorising again. The user runs `gitlab connections connect` as the same GitLab user (2b-GitLab), then you preview again. |
| `GITLAB_UNREACHABLE` (503) | GitLab could not be asked. Retry once; then report it. |
| `TRANSLATION_MEMORY_NOT_FOUND` | `--translation-memory-id` names no memory of this organisation. Recheck `translation-memories list`. |
| `VALIDATION_ERROR` | A flag value is malformed; `details` say which. |

### 2d. Set up the Workflow

Once the user confirms the ready preview, publish it with **the same flags** plus its hash:

```bash
npx @globalize-now/cli-client workflows setup \
  --installation-id <INSTALLATION_ID> \
  --repository <OWNER>/<REPO> \
  --preview-hash <PREVIEW_HASH> \
  --json
```

`data.id` is `<WORKFLOW_ID>`. `data.createdTranslationMemory` names the memory setup created (null when you passed one), and `data.takeovers` the Project rows it took over.

| `code` | Next step |
|--------|-----------|
| `WORKFLOW_PREVIEW_STALE` | The repository changed since the preview. `details.preview` is a fresh one: show the user what changed, and on confirmation run `workflows setup` again with its `previewHash`. |
| `WORKFLOW_REPOSITORY_CLAIMED` | A Workflow already holds the repository: `details.workflowId`, `details.workflowName`. Continue with that id. |
| `REPOSITORY_HELD_BY_PROJECT` | As in 2c: stop and point the user at the move to a Workflow. |
| `WORKFLOW_DEFINITION_INVALID` with issue `gitlab_hook_registration_failed` | GitLab refused the repository's webhook: the connection's user isn't a Maintainer. Nothing was published. The user gives that account the Maintainer role, or connects a Maintainer's account (2b-GitLab); then preview and set up again. |

### 2e. Start the first translation

A run spends credits: start one when the user agrees to it. First check for a run already started, so a retry never pays twice:

```bash
npx @globalize-now/cli-client workflows runs list --workflow-id <WORKFLOW_ID> --json
```

A run in the list means the first translation has started: report it and follow it in 2f, and start another only when the user asks. With no run, start one:

```bash
npx @globalize-now/cli-client workflows runs start --workflow-id <WORKFLOW_ID> --json
```

A GitHub or GitLab Workflow delivers by pull (merge) request and translates its primary (first watched) branch. `--branch <branch>` picks another watched branch; `workflows runs start --delivery push` commits straight to the branch, only when the user asks for it.

| `code` | Next step |
|--------|-----------|
| `INSUFFICIENT_CREDITS` (402) | The user adds credits on the Globalize dashboard, then you retry. |
| `WORKFLOW_BRANCH_NOT_WATCHED` | `details.branches` lists the watched branches (primary first). Run on one of those. To translate another branch, the user opens a pull request from it: the Workflow translates pull requests too. |
| `WORKFLOW_AWAITING_CONVERSION_MERGE` | A setup pull request is waiting: `details.pullRequest.url`. The user merges it, then you retry. |

### 2f. Follow the run

```bash
npx @globalize-now/cli-client workflows runs get --id <RUN_ID> --json
```

The summary carries `status`, `failure`, per-language progress in `languages[]` (`done`/`total`/`failed`), each Output's `outcome`, and `pullRequestUrl`. `status: "completed"` means translated, not delivered: the run is delivered when an Output's `outcome.status` is `delivered`, and then `pullRequestUrl` is the pull request to review. Poll until then, or until `failure` is set, and give the user the pull request. `--full` prints the whole run.

### 2g. Look up and change a Workflow

```bash
npx @globalize-now/cli-client workflows list --json
npx @globalize-now/cli-client workflows get --id <WORKFLOW_ID> --json
```

`workflows list` includes archived Workflows. `workflows get` returns `currentVersion` with its `number` and `definition`.

**Change the target languages** with the full set the Workflow should declare (it replaces, not adds):

```bash
npx @globalize-now/cli-client workflows languages \
  --id <WORKFLOW_ID> \
  --target-languages de,fr,ja,pt-BR \
  --json
```

This publishes the next version with nothing else changed; the same set publishes nothing (`published: false`). `--base-version <n>` starts from version `n`, and a version published since refuses with `WORKFLOW_BASE_VERSION_STALE` (`details.currentVersion`): read the Workflow again, confirm with the user, retry. `WORKFLOW_DEFINITION_INVALID` lists the problems in `details.issues`.

The CLI changes a Workflow's target languages only; branches, patterns, steps and Outputs are edited in the Globalize web app's Workflow editor.

---

## Step 3: Glossaries

A glossary keeps terms consistent across languages. Glossaries belong to the organisation, and Workflows and Projects use them; the `glossaries` commands take locales (`en`, `pt-BR`) and need no Project.

**Check which glossary a Workflow reads before editing one.** Read it with `workflows get --id <WORKFLOW_ID> --json`. When `currentVersion.definition.assets.source` is `repository` (what Workflow setup publishes) and the definition has no `currentVersion.definition.glossaryId`, a run reads the glossary from the repository's `docs/glossary.tbx` or `docs/glossary.csv` at the triggering commit. A stored glossary is never read then: edit that file, keeping its format, and open a pull request. A `currentVersion.definition.glossaryId` names the stored glossary the run reads, whatever the asset source, and the commands below edit it.

**Find** the glossary. `glossaries list` gives each one's `locales`, `termCount`, `workflowCount` and `attachedProjectCount`; `glossaries get` names the Projects and Workflows using it:

```bash
npx @globalize-now/cli-client glossaries list --json
npx @globalize-now/cli-client glossaries get --id <GLOSSARY_ID> --json
```

**Search** its entries (`--query` matches the preferred term, a forbidden variant or a target term; `--spelling` an exact one). The page is `data.data[]`, with `data.pagination.cursor` for `--cursor`:

```bash
npx @globalize-now/cli-client glossaries entries --id <GLOSSARY_ID> --query "dashboard" --target-locale fr --json
```

**Add** an entry: a preferred term in one source locale, with a target term per locale:

```bash
npx @globalize-now/cli-client glossaries add-term \
  --id <GLOSSARY_ID> \
  --source-term "Dashboard" \
  --source-locale en \
  --target fr="Tableau de bord" \
  --target de="Dashboard" \
  --json
```

`--do-not-translate` (with no `--target`) keeps a term as written in every language: brand names, product names, code identifiers. `--description <text>` gives its meaning, and `--forbid <variant>` (repeat it) a spelling ruled out in source text. A term the glossary already holds in that locale refuses with `GLOSSARY_ENTRY_EXISTS`, and `details.entryId` is the entry to edit; `GLOSSARY_SPELLING_TAKEN` means another entry claims that spelling.

**Edit** or **delete** an entry. `--target <locale>=<term>` sets one target term and leaves the others; `--remove-target <locale>` removes one:

```bash
npx @globalize-now/cli-client glossaries edit-entry --id <GLOSSARY_ID> --entry-id <ENTRY_ID> --target fr="Tableau de bord" --json
npx @globalize-now/cli-client glossaries delete-entry --id <GLOSSARY_ID> --entry-id <ENTRY_ID> --json
```

A change reaches every Project and Workflow using the glossary: name them to the user from `glossaries get`. `glossaries create --name`, `rename` and `delete` manage the glossary itself; `delete` is admin-only and refused while a Project or an active Workflow uses it. There is no bulk import by glossary id.

A glossary with `repositoryManaged` set is synced from a Project's asset repository: writes refuse with `PROJECT_ASSETS_REPOSITORY_MANAGED`, so edit the file on the `branch` of the `gitUrl` it names.

---

## Step 4: Style guides and contexts

A style guide gives translation instructions ("use formal register", "prefer British English spelling"), and a context describes the product. Both are organisation **Assets**, used by Workflows and Projects; the `assets` commands take locales and need no Project.

**Check what a Workflow reads before editing.** With `workflows get --id <WORKFLOW_ID> --json`, when `currentVersion.definition.assets.source` is `repository`, a run reads each language's style guide from the repository's `docs/style-guides/<locale>.md` and the context from `docs/context.md` (a non-blank `definition.context` replaces that file), at the triggering commit. Edit those files and open a pull request; the Workflow's style setup in the web app opens one with drafts for missing files. The Assets in `definition.attachedAssets` (`type`, `id`) are read in addition, and the commands below edit them. The Workflow's own `context` changes only by publishing a version in the web app's Workflow editor.

**Find** the Asset. `scope` is `global` (one text) or `per_locale` (one text per locale); `assets get` adds its `texts` and the Projects and Workflows using it:

```bash
npx @globalize-now/cli-client assets list --type style_guide --json
npx @globalize-now/cli-client assets get --id <ASSET_ID> --json
```

**Write** a text. A `per_locale` Asset takes `--locale`; a `global` one (one text for every language) takes none, and the server refuses the other way round:

```bash
npx @globalize-now/cli-client assets set-text \
  --id <ASSET_ID> \
  --locale fr \
  --text "Use formal register (vous). Keep product names in English." \
  --json
```

`--file <path>` reads the text from a file instead of `--text`. `--invalidate-tm` marks that locale's translation memory entries stale for everything using the style guide, so later runs translate them again (a new text does so anyway): confirm it with the user first.

**Delete** a text:

```bash
npx @globalize-now/cli-client assets delete-text --id <ASSET_ID> --locale fr --json
```

`assets create --name --type style_guide|context --scope global|per_locale` creates an Asset (the scope is fixed); `rename` and `delete` manage it, and `delete` is admin-only and refused while a Project or an active Workflow uses it. An Asset with `repositoryManaged` set refuses writes with `PROJECT_ASSETS_REPOSITORY_MANAGED`: edit the file on the `branch` of the `gitUrl` it names.

---

## Step 5: Organisation and Team Management

These commands are less commonly needed from an agent but are available when requested.

### Organisations

```bash
npx @globalize-now/cli-client orgs list --json
npx @globalize-now/cli-client orgs delete --id <ORG_ID> --json
```

> **Note:** There is no `orgs create` command. Creating an organisation requires an interactive (Clerk) session and is done in the web app — it is not available via API key. The CLI can list and delete orgs, and manage everything inside them.

### Members

```bash
npx @globalize-now/cli-client members list --org-id <ORG_ID> --json
npx @globalize-now/cli-client members invite --org-id <ORG_ID> --email <EMAIL> --json
npx @globalize-now/cli-client members remove --org-id <ORG_ID> --membership-id <ID> --json
```

Members are invited **by email address** (`--email`). Optional `--role` flag on `invite`: `admin` or `member` (default: `member`).

### API Keys

```bash
npx @globalize-now/cli-client api-keys list --org-id <ORG_ID> --json
npx @globalize-now/cli-client api-keys create --org-id <ORG_ID> --name "CI Key" --json
npx @globalize-now/cli-client api-keys revoke --org-id <ORG_ID> --key-id <KEY_ID> --json
```

---

## Command Reference

The CLI's Project-keyed commands (`projects`, `project-languages`, `repositories`, `patterns`, `namespaces`, `glossary`, `style-guides`) are deprecated and left out: use `workflows`, `glossaries` and `assets`.

| Command | Required flags | Optional flags |
|---------|---------------|----------------|
| `auth login` | *(interactive)* | `--no-wait` |
| `auth complete` | `--device-code`, `--code-verifier` | `--interval`, `--expires-in` |
| `auth status` | | |
| `auth logout` | | |
| `orgs list` | | |
| `orgs delete` | `--id` | |
| `workflows preview-setup` | `--installation-id` (numeric) or `--gitlab-connection`, `--repository` | `--branches`, `--patterns` (JSON), `--source-language`, `--target-languages`, `--name`, `--translation-memory-id`, `--import` (`ignore`\|`reviewed`\|`translated`) |
| `workflows setup` | `--installation-id` (numeric) or `--gitlab-connection`, `--repository`, `--preview-hash` | the same as `workflows preview-setup` |
| `workflows list` | | |
| `workflows get` | `--id` | |
| `workflows languages` | `--id`, `--target-languages` | `--base-version` |
| `workflows runs start` | `--workflow-id` | `--branch`, `--delivery` (`pr`\|`push`) |
| `workflows runs list` | `--workflow-id` | `--limit`, `--cursor` |
| `workflows runs get` | `--id` | `--full` |
| `languages list` | | |
| `languages get` | `--id` | |
| `github install` | | `--no-wait` |
| `github install-status` | `--nonce` | |
| `github installations` | | |
| `github repos` | `--installation-id` | |
| `gitlab connections list` | | |
| `gitlab connections connect` | | `--no-wait` |
| `gitlab install-status` | `--nonce` | |
| `gitlab repositories list` | `--connection-id` | `--search` |
| `github branches` | `--installation-id`, `--owner`, `--repo` | |
| `github detect` | `--installation-id`, `--owner`, `--repo` | |
| `glossaries list` | | |
| `glossaries create` | `--name` | |
| `glossaries get` | `--id` | |
| `glossaries rename` | `--id`, `--name` | |
| `glossaries delete` | `--id` | |
| `glossaries entries` | `--id` | `--query`, `--spelling`, `--source-locale`, `--target-locale`, `--limit`, `--cursor` |
| `glossaries add-term` | `--id`, `--source-term`, `--source-locale` | `--target <locale>=<term>` (repeat), `--do-not-translate`, `--description`, `--forbid` (repeat) |
| `glossaries edit-entry` | `--id`, `--entry-id` | `--source-term`, `--target <locale>=<term>` (repeat), `--remove-target` (repeat), `--do-not-translate`\|`--translate`, `--description`\|`--clear-description`, `--forbid` (repeat)\|`--clear-forbidden` |
| `glossaries delete-entry` | `--id`, `--entry-id` | |
| `assets list` | | `--type` (`style_guide`\|`context`) |
| `assets create` | `--name`, `--type` (`style_guide`\|`context`), `--scope` (`global`\|`per_locale`) | |
| `assets get` | `--id` | |
| `assets rename` | `--id`, `--name` | |
| `assets delete` | `--id` | |
| `assets set-text` | `--id`, `--text` or `--file` | `--locale` (per-locale Asset only), `--invalidate-tm` |
| `assets delete-text` | `--id` | `--locale` (per-locale Asset only) |
| `api-keys list` | `--org-id` | |
| `api-keys create` | `--org-id`, `--name` | |
| `api-keys revoke` | `--org-id`, `--key-id` | |
| `members list` | `--org-id` | |
| `members invite` | `--org-id`, `--email` | `--role` |
| `members remove` | `--org-id`, `--membership-id` | |
| `translation-memories list` | | |
| `translation-memories create` | `--name` | |
| `translation-memories get` | `--id` | |
| `translation-memories rename` | `--id`, `--name` | |
| `translation-memories delete` | `--id` | |
| `translation-memories entries` | `--id` | `--query`, `--source-locale`, `--target-locale`, `--limit`, `--cursor` |
| `translation-memories delete-entry` | `--id`, `--entry-id` | |
| `translation-memories clear` | `--id` | `--target-locale` |
| `translation-memories count` | `--id` | `--target-locale` |
| `translation-memories fresh-count` | `--id`, `--target-locale` | |
| `billing balance` | | |
| `billing ledger` | | `--type`, `--grouped`, `--limit`, `--cursor` |

---

## Additional Commands: Translation Memory & Billing

### Translation memory

Translation memory (TM) stores prior translations for reuse. **A memory is an organisation-level resource**: several Workflows and Projects can use the same memory and share its entries. Workflow setup creates one unless `--translation-memory-id` names an existing one. List every memory in the org:

```bash
npx @globalize-now/cli-client translation-memories list --json
npx @globalize-now/cli-client translation-memories get --id <TM_ID> --json   # attached projects + locales
```

Entries are addressed by memory ID and **locale** (`en`, `fr-CA`), not by project language UUID:

```bash
npx @globalize-now/cli-client translation-memories entries --id <TM_ID> --target-locale fr --json
npx @globalize-now/cli-client translation-memories count --id <TM_ID> --json
npx @globalize-now/cli-client translation-memories fresh-count --id <TM_ID> --target-locale fr --json
npx @globalize-now/cli-client translation-memories delete-entry --id <TM_ID> --entry-id <ENTRY_ID> --json
```

Managing the memory itself:

```bash
npx @globalize-now/cli-client translation-memories create --name "Marketing site" --json
npx @globalize-now/cli-client translation-memories rename --id <TM_ID> --name "Marketing" --json
npx @globalize-now/cli-client translation-memories clear --id <TM_ID> --target-locale fr --json   # omit the locale to clear everything
npx @globalize-now/cli-client translation-memories delete --id <TM_ID> --json
```

**Destructive operations hit everything that shares the memory.** `clear`, `delete-entry` and `delete` act on the shared memory, so entries other Workflows and Projects contributed disappear too. Check `attachedProjectCount` (from `translation-memories list`/`get`) and confirm with the user before clearing or deleting. `translation-memories delete` only works on a memory with no attached projects.

### Billing

Read the organisation's credit balance and ledger:

```bash
npx @globalize-now/cli-client billing balance --json
npx @globalize-now/cli-client billing ledger --json
```

`billing balance` resolves the organisation from your API key. Checkout and portal flows are web-only (not available via API key).

---

## Common Gotchas

- **Always use `--json`**: The CLI auto-detects non-TTY and outputs JSON, but always pass `--json` explicitly when running programmatically for reliability. Failures print their JSON on stdout too, with exit code 1.
- **A GitLab `--repository` is the numeric project id** from `gitlab repositories list` (its `pathWithNamespace` works too); `--gitlab-connection` takes the connection's UUID `id`.
- **`--installation-id` is GitHub's numeric id**: `workflows preview-setup`, `workflows setup` and the `github repos/branches/detect` commands take the `installationId` field from `github installations --json` (e.g. `122432012`), not its UUID `id`. Every other id is a UUID from a prior command.
- **Workflows take locale codes**: `--source-language` and `--target-languages` on `workflows` commands are locales (`en`, `pt-BR`). `glossaries`, `assets` and `translation-memories` commands take plain locales too (`--source-locale`, `--target-locale`, `--locale`, `--target <locale>=<term>`).
- **Repository assets are edited in the repository**: a Workflow whose `definition.assets.source` is `repository` reads its glossary, style guides and context from `docs/` files at the triggering commit (Steps 3 and 4), so a stored glossary or Asset it doesn't name or attach changes nothing for it.
- **A completed run is not a delivered run**: check each Output's `outcome.status` for `delivered` before reporting the pull request.
- **Auth in non-interactive contexts**: The CLI does not fall back to interactive login when there's no TTY. Ensure `GLOBALIZE_API_KEY` is set or `~/.globalize/config.json` exists.
