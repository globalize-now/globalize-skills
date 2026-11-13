# Project path

Loaded by `globalize-now-project-setup` in two cases, each with its own section:

- **A Project already translates the GitHub repository.** Workflow setup refused it with `REPOSITORY_HELD_BY_PROJECT`. Follow "Continue on the Project that holds the repository".
- **The remote is on `gitlab.com`.** Workflows read GitHub only until GitLab support ships. Follow "gitlab.com".

A Project is used here only when the refusal names it or the user picks it from a list. Every other Project in the organisation, including an empty one an abandoned setup left behind, stays untouched.

Every command below is `npx @globalize-now/cli-client <command>`. A failed command exits 1 and, in JSON mode, prints `{"error", "status", "code"?, "details"?}` on stdout.

---

## Continue on the Project that holds the repository

The refusal's `details` carry `projectId`, `projectName` and `repositoryId` (the Project's repository record, not GitHub's repository id).

Tell the user once, in both modes: "Project **{projectName}** already translates `{owner}/{repo}`, so I'll continue on it. Moving it to a Workflow is optional: an organisation admin does it in the Globalize web app."

### P1. Find the repository

```bash
npx @globalize-now/cli-client repositories list --project-id <PROJECT_ID> --json
```

Use the entry whose `id` is `repositoryId`. Details without a `repositoryId` → the entry whose `gitUrl` names `<OWNER>/<REPO>` (case-insensitive).

The Project's languages and patterns stay as they are. Check `patterns list --repository-id <REPO_ID> --json`: when the supplied or detected catalog pattern is not among them, say so in the summary ("Project {projectName} doesn't watch `{pattern}` — add it in the web app or with `patterns create`") rather than changing the Project.

### P2. First translation (orchestrated mode)

Runs when the supplied inputs carry a `firstTranslationBranch`; otherwise "Next steps" names the command.

```bash
npx @globalize-now/cli-client repositories translate \
  --id <REPO_ID> \
  --branch <FIRST_TRANSLATION_BRANCH> \
  --delivery-mode pr \
  --json
```

`--delivery-mode pr` delivers the translation as a pull request onto that branch. The call returns `{"accepted": true, "branch": "…"}` once queued; report it and move on. An error → report it verbatim as "First translation not started — {error}", with no retry. Credits are checked after the call returns, so a translation refused for credits shows up as a failed job on the dashboard.

Summary lines: "Continued on Project {projectName} (it already translates {owner}/{repo}; migrating to a Workflow is optional, admin-only, in the web app)", then the first translation or why it was skipped.

---

## gitlab.com

A `gitlab.com` repository is set up on a Project until Globalize's Workflows read GitLab. When an organisation can no longer create Projects, `projects create` answers 410: report its message verbatim and stop.

Read `references/local-detection.md` for the languages, pattern and file format, unless the supplied inputs carry them (`sourceLocale`, `targetLocales`, `patterns`).

### G1. Connect GitLab

```bash
npx @globalize-now/cli-client gitlab connections --json
```

Each connection has `id` (UUID), `username`, `gitlabUserId`, `status`, and `createdAt`. A connection whose `username` matches the GitLab project owner (case-insensitive) → its `id` is `<CONNECTION_ID>`.

No matching connection → start the OAuth flow:

```bash
npx @globalize-now/cli-client gitlab install --no-wait --json
```

It returns `{ "installUrl": "...", "nonce": "...", "expiresIn": ... }`. **Browser interaction required** in every mode: present the URL, ask the user to authorize the GitLab OAuth application and confirm. Then:

```bash
npx @globalize-now/cli-client gitlab install-status --nonce <NONCE> --json
```

`{ "status": "completed", "connectionId": "...", "username": "..." }` → `connectionId` is `<CONNECTION_ID>`; `pending` → ask the user to finish; `expired` → start again. Then confirm access:

```bash
npx @globalize-now/cli-client gitlab projects --connection-id <CONNECTION_ID> --json
```

Match `pathWithNamespace` against `<OWNER>/<PROJECT>` and record the numeric `id` as `<GITLAB_PROJECT_ID>`.

### G2. Choose or create the Project

- **Guided**: run `projects list --json`, present the names and IDs, and ask whether to use one of them or create a new one. The user picks one → record its ID and go to G3, looking up its repositories first.
- **Unguided and orchestrated**: create a new Project.

**Name**: the supplied `workflowName` (an older inputs file's `projectName`), else the repository name from the remote URL, else the directory name.

**Languages**: the supplied or detected source and targets. Guided confirms them. Nothing detected → guided asks for both; unguided defaults the source to `en` and asks for the targets (its one required prompt).

```bash
npx @globalize-now/cli-client languages list --json
```

Match each locale against `locale` and take its UUID `id`. Remove the source from the targets. Source not in the catalog → **HARD STOP** in every mode. A target not in the catalog → guided asks how to proceed; unguided skips it and notes it in the summary.

```bash
npx @globalize-now/cli-client projects create \
  --name "<PROJECT_NAME>" \
  --source-language <SOURCE_LANGUAGE_UUID> \
  --target-languages <TARGET_UUID_1> <TARGET_UUID_2> \
  --config '{"gitlab": {"mrTranslations": true, "ignoreDraftMrs": true}}' \
  --json
```

Take the **project ID** from the result. `projects create` always prints a notice on stderr steering a GitHub repository to Workflow setup; on this gitlab.com path that notice is expected, so carry on with the Project and leave the skills as they are.

### G3. Connect the repository

A Project the user picked in G2: run `repositories list --project-id <PROJECT_ID> --json` first. An entry whose `gitUrl` names the same `<OWNER>/<PROJECT>` (case-insensitive) is the repository: check `patterns list --repository-id <REPO_ID> --json`, add a missing pattern with `patterns create --repository-id <REPO_ID> --pattern <PATTERN> --file-format <FORMAT> --json`, and go to G4.

No pattern known yet → detect it on GitLab:

```bash
npx @globalize-now/cli-client gitlab detect \
  --connection-id <CONNECTION_ID> \
  --project-id <GITLAB_PROJECT_ID> \
  --json
```

Use its `localePathPattern` and `fileFormat` when present. Then connect (`--git-url` takes HTTPS only: `git@gitlab.com:OWNER/PROJECT.git` → `https://gitlab.com/OWNER/PROJECT.git`):

```bash
npx @globalize-now/cli-client repositories create \
  --project-id <PROJECT_ID> \
  --git-url <GIT_URL> \
  --provider gitlab \
  --gitlab-connection-id <CONNECTION_ID> \
  --patterns '[{"pattern": "<LOCALE_PATH_PATTERN>", "fileFormat": "<FORMAT>"}]' \
  --json
```

`<FORMAT>` is exactly one of `json-flat`, `json-nested`, `po`, `xliff-1`, `xliff-2`, `yaml-rails`, `arb`, `xcstrings`, `android-strings`, `chrome-messages`, `wxt-i18n`. No pattern known at all → omit `--patterns`. `--import-mode` defaults to `ignore`; pass the supplied `import` when it differs.

A pattern whose files spell a locale differently (`_locales/pt_BR/messages.json` for `pt-BR`) adds one `--path-locales` entry per such language, converted from the pattern's `pathLocales` map:

```bash
  --path-locales '[{"pattern": "_locales/{locale}/messages.json", "locale": "pt-BR", "pathLocale": "pt_BR"}]'
```

Guided mode shows the patterns and asks before connecting. Take the **repository ID** from the result, then:

```bash
npx @globalize-now/cli-client repositories detect --id <REPO_ID> --json
```

Report what it found. Uncommitted or unpushed changes (Step 1) → add: "Detection reads the remote, so local changes that aren't pushed aren't reflected."

### G4. First translation (orchestrated mode)

As P2, with this repository's ID and `firstTranslationBranch`. GitLab delivers it as a merge request onto that branch.

Summary lines: "GitLab — Project {name} (source, targets), repository {owner/project} connected, patterns: {count}", then the first translation or why it was skipped.
