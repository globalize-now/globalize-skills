---
name: globalize-now-cli-use
description: >-
  Set up and manage Globalize translation for a repository using the CLI. Use this skill when
  the user asks to set up translations for a GitHub repository, start or check a translation run,
  manage Workflows or their languages, manage glossaries, style guides or translation memories,
  invite team members, manage API keys, or perform any Globalize platform operation. Also covers
  a repository a Globalize Project already translates. This skill assumes the CLI is already
  installed and authenticated — run globalize-now-account-setup first if not.
---

# Globalize CLI Usage

This skill guides you through managing translation on the [Globalize](https://globalize.now) platform using the CLI (`globalise-now-cli`). A GitHub repository is translated by a **Workflow**: Step 2 sets one up and starts its first translation.

**A repository a Project already translates** (the older setup) follows `references/project-held-repository.md` instead of Step 2. Read it when Workflow setup refuses with `REPOSITORY_HELD_BY_PROJECT`, when the user names a Project, or when the remote is on gitlab.com.

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

A Workflow watches a GitHub repository's branches, reads its locale files, and delivers translations as a pull request. Setup is two calls: `workflows preview-setup` proposes the Workflow and writes nothing; `workflows setup` publishes exactly what the preview proposed. Neither starts a run.

### 2a. Identify the repository

```bash
git remote get-url origin
```

Parse `<OWNER>/<REPO>` from `https://github.com/<OWNER>/<REPO>.git` or `git@github.com:<OWNER>/<REPO>.git`.

- **github.com** → continue.
- **gitlab.com** → read `references/project-held-repository.md` and follow it: Workflow setup reads GitHub only.
- **Any other host, or no remote** → stop. Tell the user Workflow setup needs a GitHub repository, and ask for its `owner/repo`.

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

### 2c. Preview the Workflow

```bash
npx @globalize-now/cli-client workflows preview-setup \
  --installation-id <INSTALLATION_ID> \
  --repository <OWNER>/<REPO> \
  --json
```

Detection reads the repository's default branch on GitHub, not the local working copy. Pass overrides only where the user or a `need` asks for one:

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
| `REPOSITORY_HELD_BY_PROJECT` | A Project already translates this repository. `details` carry `projectId`, `projectName`, `repositoryId`. Read `references/project-held-repository.md` and continue on that Project. |
| `NOT_FOUND` (404) | The installation isn't this organisation's, or the App can't see the repository or branch. Recheck 2b. |
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
| `REPOSITORY_HELD_BY_PROJECT` | As in 2c: read `references/project-held-repository.md`. |

### 2e. Start the first translation

A run spends credits: start one when the user agrees to it. First check for a run already started, so a retry never pays twice:

```bash
npx @globalize-now/cli-client workflows runs list --workflow-id <WORKFLOW_ID> --json
```

A run in the list means the first translation has started: report it and follow it in 2f, and start another only when the user asks. With no run, start one:

```bash
npx @globalize-now/cli-client workflows runs start --workflow-id <WORKFLOW_ID> --json
```

A GitHub Workflow delivers by pull request and translates its primary (first watched) branch. `--branch <branch>` picks another watched branch; `workflows runs start --delivery push` commits straight to the branch, only when the user asks for it.

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

## Step 3: Glossary Management

Glossaries ensure specific terms are translated consistently across languages. The glossary commands act on a **Project** (`--project-id`, from `projects list --json`) and take its **project language UUIDs**, from:

```bash
npx @globalize-now/cli-client project-languages list \
  --project-id <PROJECT_ID> \
  --json
```

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

`--source-language-id` and `--target-language-id` are **project language UUIDs** from `project-languages list`, not global language IDs.

Pass `--do-not-translate` for terms that must stay verbatim in every language (brand names, product names, code identifiers). `--target-term` is still required — use the source spelling.

**Delete** a glossary entry:

```bash
npx @globalize-now/cli-client glossary delete \
  --project-id <PROJECT_ID> \
  --entry-id <ENTRY_ID> \
  --json
```

**Bulk import** a whole glossary in one transaction (max 10 000 entries, each with its own language pair). Existing entries for the same key are updated rather than duplicated:

```bash
npx @globalize-now/cli-client glossary bulk \
  --project-id <PROJECT_ID> \
  --entries '[{"sourceTerm":"Dashboard","targetTerm":"Tableau de bord","sourceProjectLanguageId":"<SRC_PL_ID>","targetProjectLanguageId":"<TGT_PL_ID>"},{"sourceTerm":"Globalize","targetTerm":"Globalize","sourceProjectLanguageId":"<SRC_PL_ID>","targetProjectLanguageId":"<TGT_PL_ID>","doNotTranslate":true}]' \
  --json
```

**Preview** the same import before writing anything — it reports how many entries would be created and how many updated:

```bash
npx @globalize-now/cli-client glossary preview \
  --project-id <PROJECT_ID> \
  --keys '[{"sourceTerm":"Dashboard","sourceProjectLanguageId":"<SRC_PL_ID>","targetProjectLanguageId":"<TGT_PL_ID>"}]' \
  --json
```

---

## Step 4: Style Guide Management

Style guides provide translation instructions per language (e.g., "use formal register", "prefer British English spelling"). Like the glossary, they act on a Project.

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

Project, repository, pattern, job, namespace and GitLab commands are in `references/project-held-repository.md`.

| Command | Required flags | Optional flags |
|---------|---------------|----------------|
| `auth login` | *(interactive)* | `--no-wait` |
| `auth complete` | `--device-code`, `--code-verifier` | `--interval`, `--expires-in` |
| `auth status` | | |
| `auth logout` | | |
| `orgs list` | | |
| `orgs delete` | `--id` | |
| `workflows preview-setup` | `--installation-id` (numeric), `--repository` | `--branches`, `--patterns` (JSON), `--source-language`, `--target-languages`, `--name`, `--translation-memory-id`, `--import` (`ignore`\|`reviewed`\|`translated`) |
| `workflows setup` | `--installation-id` (numeric), `--repository`, `--preview-hash` | the same as `workflows preview-setup` |
| `workflows list` | | |
| `workflows get` | `--id` | |
| `workflows languages` | `--id`, `--target-languages` | `--base-version` |
| `workflows runs start` | `--workflow-id` | `--branch`, `--delivery` (`pr`\|`push`) |
| `workflows runs list` | `--workflow-id` | `--limit`, `--cursor` |
| `workflows runs get` | `--id` | `--full` |
| `projects list` | | |
| `project-languages list` | `--project-id` | |
| `languages list` | | |
| `languages get` | `--id` | |
| `github install` | | `--no-wait` |
| `github install-status` | `--nonce` | |
| `github installations` | | |
| `github repos` | `--installation-id` | |
| `github branches` | `--installation-id`, `--owner`, `--repo` | |
| `github detect` | `--installation-id`, `--owner`, `--repo` | |
| `glossary list` | `--project-id` | |
| `glossary create` | `--project-id`, `--source-term`, `--target-term`, `--source-language-id`, `--target-language-id` | `--do-not-translate` |
| `glossary delete` | `--project-id`, `--entry-id` | |
| `glossary bulk` | `--project-id`, `--entries` (JSON) | |
| `glossary preview` | `--project-id`, `--keys` (JSON) | |
| `style-guides list` | `--project-id` | |
| `style-guides upsert` | `--project-id`, `--language-id`, `--instructions` | |
| `style-guides delete` | `--project-id`, `--language-id` | |
| `style-guides generate` | `--project-id`, `--language-id` | |
| `style-guides apply` | `--project-id`, `--language-id`, `--generation-id`, `--instructions` | `--context`, `--invalidate-tm` |
| `style-guides quota` | `--project-id` | |
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
- **`--installation-id` is GitHub's numeric id**: `workflows preview-setup`, `workflows setup` and the `github repos/branches/detect` commands take the `installationId` field from `github installations --json` (e.g. `122432012`), not its UUID `id`. Every other id is a UUID from a prior command.
- **Workflows take locale codes**: `--source-language` and `--target-languages` on `workflows` commands are locales (`en`, `pt-BR`). Glossary and style guide commands take _project language_ UUIDs from `project-languages list`; `translation-memories` commands take plain locales (`--source-locale`, `--target-locale`).
- **A completed run is not a delivered run**: check each Output's `outcome.status` for `delivered` before reporting the pull request.
- **Auth in non-interactive contexts**: The CLI does not fall back to interactive login when there's no TTY. Ensure `GLOBALIZE_API_KEY` is set or `~/.globalize/config.json` exists.
