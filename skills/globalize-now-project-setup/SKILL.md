---
name: globalize-now-project-setup
description: >-
  Set up Globalize translation for a repository: publish a Workflow that translates a
  GitHub repository's catalogs and start its first translation, or continue on the
  Project that already translates it. Use this skill when the user asks to connect their
  repo to Globalize, set up a Globalize Workflow, or wire their translation catalogs to
  the Globalize platform. Assumes the Globalize CLI is already installed and
  authenticated — if not, run globalize-now-account-setup first. For managing existing
  Workflows, glossaries, style guides and team members, use globalize-now-cli-use.
---

# Globalize Project Setup

This skill sets up a Globalize **Workflow** for a GitHub repository: Globalize previews what it finds in the repository (catalog patterns, source and target languages), you confirm, it publishes the Workflow, and — in orchestrated mode — the skill starts the first translation, delivered as a pull request. The Workflow watches the repository's default branch.

Every command is `npx @globalize-now/cli-client <command> --json`. A failed command exits 1 and prints `{"error", "status", "code"?, "details"?}` on stdout; branch on `code`.

Follow these steps in order.

---

## Choose the path

Read the remote first, before any Globalize call: the supplied inputs' `provider` / `owner` / `repo` in orchestrated mode, otherwise `git rev-parse --is-inside-work-tree` and `git remote get-url origin`.

| `origin` | Path |
|---|---|
| `github.com` | **Workflow path**: the auth precheck, then Steps 1–5 below. |
| `gitlab.com` | **Project path**: the auth precheck, then read `references/project-path.md` in full and follow its "gitlab.com" section in place of Steps 2–5. |
| None, or not a git repository | **No-remote stop** (next section). |
| Any other host (Bitbucket, self-hosted GitLab, …) | **Unsupported host stop** (next section). |

Extract `<OWNER>/<REPO>` from HTTPS (`https://github.com/OWNER/REPO.git`) or SSH (`git@github.com:OWNER/REPO.git`). A GitHub repository that a Project already translates is found by Workflow setup's refusal in Step 3, so the Workflow path never lists Projects.

---

## No-remote and unsupported host stops

These run before sign-in: no auth precheck, no Globalize call, and the local i18n setup stays exactly as it is. In orchestrated runs `globalize-guide` owns them (its Phase 4.2) and calls this skill only with a GitHub or GitLab remote.

- **No remote** (no `origin`): "Globalize translates from a GitHub repository, and this project has none. Your local i18n setup is done and kept." Then check `gh auth status`. It succeeds and this is a git repository with at least one commit → offer: "I can create a private GitHub repository **{directory name}** with `gh` and push `{current branch}` to it, then carry on setting up Globalize. Create it? (**yes** / **no**)". Run `gh repo create <name> --private --source=. --remote=origin --push` only once the user confirms, then continue with the auth precheck and the Workflow path. **no**, or no signed-in `gh` → stop with: "Once this project is on GitHub, run this skill again." **Headless**: never offer or run `gh`; stop with the message.
- **Not a git repository**: the same message and stop, without the `gh` offer.
- **Unsupported host** (Bitbucket, self-hosted GitLab, any host other than `github.com` / `gitlab.com`): "Globalize translates from a GitHub repository, and this project's remote is on {host}. Your local i18n setup is done and kept." Stop. No `gh` offer.

---

## Auth precheck

```bash
npx @globalize-now/cli-client auth status --json
```

A valid `source` and `key` → continue. Otherwise **STOP**:

> "You're not signed in to Globalize yet. Run the `globalize-now-account-setup` skill first to install the CLI and authenticate, then re-run this skill."

---

## Supplied inputs (orchestrated mode)

Another skill (e.g. the `globalize-guide` orchestrator) can drive this one with the just-converted catalog's details.

**If `.globalize/globalize-inputs.json` exists in the project root** (or the invoking prompt supplies these values), treat its fields as authoritative: skip Step 1's detection and the Setup Mode prompt, run **unguided**, and go Step 2 → Step 3 → Step 4 → Step 5. Re-detect or re-prompt for nothing the file provides.

```json
{
  "workflowName": "my-app",
  "sourceLocale": "en",
  "targetLocales": ["de", "fr", "pt-BR"],
  "provider": "github",
  "owner": "acme",
  "repo": "my-app",
  "gitUrl": "https://github.com/acme/my-app.git",
  "catalogPath": "src/locales/{locale}/messages.po",
  "patterns": [{ "pattern": "src/locales/{locale}/messages.po", "format": "po" }],
  "import": "ignore",
  "mode": "orchestrated",
  "firstTranslationBranch": "chore/i18n-setup"
}
```

They map onto Step 3's flags: `patterns` → `--patterns` (verbatim JSON; a pattern may carry `"pathLocales": {"pt-BR": "pt_BR"}` for a layout that spells a locale differently), `sourceLocale` → `--source-language`, `targetLocales` → `--target-languages` (comma-separated), `workflowName` → `--name`, `import` → `--import`. An older inputs file is read the same way: `projectName` for `workflowName`, `importMode` for `import`, and `localePathPattern` + `fileFormat` (+ a `pathLocales` array of `{pattern, locale, pathLocale}`) as the one pattern; `importScope` is ignored.

`firstTranslationBranch` names the branch the caller pushed the setup to; Step 5 translates it. `null` or absent → skip Step 5.

**Otherwise** (no inputs file, standalone use), detect and prompt as below.

---

## Setup Mode

After Step 1 completes without blockers, ask:

> **How would you like to proceed?**
> 1. **Guided** — I'll explain each step before and after.
> 2. **Unguided** — I'll run all steps without pausing and show a full summary at the end.

**Guided**: before each step, explain what will happen and why; after it, say what changed.

**Unguided**: run every step without per-step explanations. Hard stops and the preview's `needs` still halt — a language always comes from the user or the repository, never a guess. At the end, produce:

```
## Globalize Setup Complete

### What was done
- [x] Step 1: Detect Environment — {signals}
- [x] Step 2: Connect GitHub — {owner/repo}, installation {accountLogin}
- [x] Step 3: Preview — {ready | already set up as "{workflowName}" | held by Project "{projectName}", continued there}
- [x] Step 4: Set up the Workflow — "{name}" (source: {source}, targets: {targets}, patterns: {patterns}, import: {mode}) — {workflow page}
- [x] Step 5: First translation — {run #{number} started, pull request delivery | pull request {url} into {default branch} | skipped — {reason}}

### Warnings (if any)
- {e.g. Uncommitted changes — Globalize reads the remote only}

### Next steps
- {e.g. start the first translation: `workflows runs start --workflow-id <id> --delivery pr`; follow it with `workflows runs get --id <runId>`}
```

The Workflow page is `https://app.globalize.now/workflows/<WORKFLOW_ID>` when `auth status` reports `api` as `https://api.globalize.now`; against any other API, give the Workflow's name and id instead.

---

## Step 1: Detect the environment

> Orchestrated mode: skip this step and use the supplied values.

| Signal | How to detect |
|--------|--------------|
| **Uncommitted changes** | `git status --porcelain` is non-empty. |
| **Unpushed commits** | `git log @{u}..HEAD --oneline 2>/dev/null` is non-empty (no upstream counts as unpushed). |

Globalize reads the repository on GitHub, never this working copy: uncommitted or unpushed changes → warn the user, and in the summary, that the preview reflects the remote only.

Globalize detects the catalog patterns and languages itself in Step 3, so standalone mode passes only what that detection leaves open. When the preview answers `needs`, read `references/local-detection.md` for this working copy's languages and patterns to suggest.

---

## Step 2: Connect GitHub

The GitHub App install is the one step that may need a browser approval, so it comes first.

**Guided**: present the detected owner and repository and ask the user to confirm. **Unguided / orchestrated**: use them as detected or supplied.

```bash
npx @globalize-now/cli-client github installations --json
```

Each installation has `id` (Globalize's UUID), `installationId` (GitHub's **numeric** installation ID, e.g. `122432012`), `accountLogin` and `accountType`. Match `accountLogin` against `<OWNER>` (case-insensitive) and record the numeric `installationId` as `<INSTALLATION_ID>` — Workflow setup takes the numeric one.

No matching installation → start the install flow:

```bash
npx @globalize-now/cli-client github install --no-wait --json
```

It returns `{ "installUrl": "...", "nonce": "..." }`. **Browser interaction required** in every mode — an external authorization, like `auth login`. Ask the user to open the URL, select the right GitHub account or organisation, approve the GitHub App, and confirm. Then:

```bash
npx @globalize-now/cli-client github install-status --nonce <NONCE> --json
```

`{ "status": "completed", ... }` → re-run `github installations --json` for `<INSTALLATION_ID>`. `pending` → ask the user to finish. `expired` → start again.

Confirm the App can read the repository:

```bash
npx @globalize-now/cli-client github repos --installation-id <INSTALLATION_ID> --json
```

`<OWNER>/<REPO>` missing from the list → the App has no access to it: ask the user to add it in the installation's repository settings on GitHub, then check again. Unguided runs that can't get access stop here and say why in the summary.

---

## Step 3: Preview the Workflow

```bash
npx @globalize-now/cli-client workflows preview-setup \
  --installation-id <INSTALLATION_ID> \
  --repository <OWNER>/<REPO> \
  --patterns '<PATTERNS_JSON>' \
  --source-language <SOURCE> \
  --target-languages <TARGET_1>,<TARGET_2> \
  --name "<WORKFLOW_NAME>" \
  --import <IMPORT_MODE> \
  --json
```

Orchestrated mode passes every flag the inputs supply. Standalone mode starts with only `--installation-id` and `--repository`, then adds the flags that answer `needs`. Never pass `--branches`: the Workflow watches the repository's default branch. The preview writes nothing and starts nothing. Handle its answer:

- **`alreadySetUp: {workflowId, workflowName}`** — a Workflow already holds this repository (an earlier run, or someone else's setup). Use it: skip Step 4, tell the user "Already set up as **{workflowName}**", and go to Step 5. This is how a rerun resumes.
- **409 `REPOSITORY_HELD_BY_PROJECT`** — a Project already translates this repository; `details` carry its `projectId`, `projectName` and `repositoryId`. Read `references/project-path.md` in full and follow "Continue on the Project that holds the repository" in place of Steps 4–5. Tell the user migrating it to a Workflow is optional, done by an organisation admin in the web app.
- **`ready: false` with `needs`** — each need has a `code`, the `override` that answers it, what it `found`, and a `message`. Answer every need, then preview again with the answers added:
  - `no_source_language`, `unsupported_source_language` → ask the user for the source language (`--source-language`).
  - `no_target_languages` → ask the user for the target languages (`--target-languages`); `found` lists codes the catalog doesn't know.
  - `no_confident_group` → `found` lists the groups detection rated unlikely: offer each with its `presetName`, `evidence` and `patterns`, and pass the one the user picks as `--patterns`.
  - `no_locale_patterns` → `found` lists the catalog files no pattern covers: propose patterns for them (`references/local-detection.md`), confirm with the user, pass `--patterns`.
  - `no_locale_files` → the repository has no catalogs yet. **Stop**: "Set up i18n first with the `globalize-guide` skill, push it, then run this skill again."

  Ask in every mode, unguided included: each language comes from the user or a repository value the user confirmed. **Headless**: stop and report each need's `message` verbatim.
- **`ready: true`** — the proposal: `name`, `definition` (its `input.config` holds `sourceLanguage`, `patterns` and the watched `branches`; `targetLanguages.declared` the targets), `excludedGroups`, `takeovers` (empty Projects whose rows the Workflow takes over), `warnings`, `newTranslationMemory`, and `previewHash`. **Guided**: show the proposal, each excluded group with its evidence, and ask to confirm or change it. **Unguided / orchestrated**: go on.

Any other error (404 for an installation or repository Globalize can't see, 400 `VALIDATION_ERROR`) → report it verbatim and stop.

---

## Step 4: Set up the Workflow

Confirm with exactly the flags of the preview that answered `ready: true`, plus its hash:

```bash
npx @globalize-now/cli-client workflows setup \
  --installation-id <INSTALLATION_ID> \
  --repository <OWNER>/<REPO> \
  --patterns '<PATTERNS_JSON>' \
  --source-language <SOURCE> \
  --target-languages <TARGET_1>,<TARGET_2> \
  --name "<WORKFLOW_NAME>" \
  --import <IMPORT_MODE> \
  --preview-hash <PREVIEW_HASH> \
  --json
```

It publishes the Workflow's first version, creates a translation memory unless one was named, and starts no run. Record its `id` as `<WORKFLOW_ID>` and its `name`.

- **409 `WORKFLOW_PREVIEW_STALE`** — the repository changed since the preview. Preview once more (Step 3), then confirm with the new `previewHash`. Stale a second time → report it and stop.
- **409 `WORKFLOW_REPOSITORY_CLAIMED`** — another setup claimed the repository first. Preview again: it answers `alreadySetUp`, and that Workflow is the one to use.
- **409 `REPOSITORY_HELD_BY_PROJECT`** → as in Step 3.

---

## Step 5: Start the first translation (orchestrated mode)

Runs when the supplied inputs carry a `firstTranslationBranch` and Step 3 or 4 gave a Workflow. Otherwise skip it and give the reason in the summary ("setup not pushed"). Standalone runs skip it too — "Next steps" names `workflows runs start --workflow-id <WORKFLOW_ID> --delivery pr`.

1. **Look for a run first**, so a rerun spends no credits twice:

   ```bash
   npx @globalize-now/cli-client workflows runs list --workflow-id <WORKFLOW_ID> --limit 1 --json
   ```

   A run exists → report it (`number`, `status`, and `pullRequestUrl` once delivered) and start nothing.

2. **Find the primary watched branch**: `branches[0]` of the Workflow definition's `input.config` — the ready preview's `definition`, or after `alreadySetUp`, `currentVersion.definition` from `workflows get --id <WORKFLOW_ID> --json`. It is the repository's default branch.

3. **`firstTranslationBranch` is the primary branch** → start a manual run, delivered as a pull request:

   ```bash
   npx @globalize-now/cli-client workflows runs start --workflow-id <WORKFLOW_ID> --delivery pr --json
   ```

   It returns the run at once: report its `number` and `status` and move on. `status: "completed"` means translated, not delivered — the pull request is the `pullRequestUrl` that `workflows runs get --id <RUN_ID>` reports once delivered. **402 `INSUFFICIENT_CREDITS`** → report "Out of credits — add credits in Globalize, then run `workflows runs start --workflow-id <WORKFLOW_ID> --delivery pr`"; never retry. Any other refusal (409 `WORKFLOW_AWAITING_CONVERSION_MERGE` names a pull request to merge first) → report it verbatim as "First translation not started — {error}".

4. **`firstTranslationBranch` is another branch** → the setup reaches the Workflow as a pull request into the primary branch: Globalize translates that pull request and delivers the translations onto it, so the user reviews the setup and its translations together.
   - When `gh auth status` succeeds, check for an open pull request from that branch first (`gh pr view <BRANCH> --json url,state,baseRefName,isDraft`). One exists → report it, and say Globalize translates it on its next push, since it was opened before the Workflow existed (a draft once it is marked ready for review).
   - No pull request yet and `gh` signed in → ask: "Open a pull request from `{branch}` into `{primary}`? Globalize translates it and adds the translations to it. (**yes** / **no**)". Run `gh pr create --base <PRIMARY> --head <BRANCH> --title "Set up i18n" --body "Sets up i18n. Globalize adds the translations to this pull request."` only once the user confirms — as a ready pull request, since Globalize skips drafts. Report its URL.
   - No signed-in `gh`, or the user says no → tell the user to open a pull request from `{branch}` into `{primary}`, and that Globalize translates it once opened.
   - **Headless**: never open one. Report "First translation skipped — open a pull request from `{branch}` into `{primary}` and Globalize translates it."

---

## Next step

The Workflow is published (and, in orchestrated mode, its first translation started or its pull request opened). From here, use the **`globalize-now-cli-use`** skill (or the CLI directly) for ongoing work: following runs, changing languages, glossaries and style guides.
