# Project path

Loaded by `globalize-now-project-setup` when a Project already translates the repository (GitHub or `gitlab.com`): Workflow setup refused it with `REPOSITORY_HELD_BY_PROJECT`. This file never creates a Project.

A Project is used here only when the refusal names it. Every other Project in the organisation, including an empty one an abandoned setup left behind, stays untouched.

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

`--delivery-mode pr` delivers the translation as a pull request onto that branch (a merge request on GitLab). The call returns `{"accepted": true, "branch": "…"}` once queued; report it and move on. An error → report it verbatim as "First translation not started — {error}", with no retry. Credits are checked after the call returns, so a translation refused for credits shows up as a failed job on the dashboard.

Summary lines: "Continued on Project {projectName} (it already translates {owner}/{repo}; migrating to a Workflow is optional, admin-only, in the web app)", then the first translation or why it was skipped.

