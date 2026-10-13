# Library check — procedure

We've built skills that implement 3rd-party libraries into codebases (repo: `globalize-now/globalize-skills`). Track updates to those libraries daily and, when something is actionable, ship the fix as a pull request. You are running unattended in a cloud session — decide and act, do not ask.

**Dry run.** If the message that started this run says `DRY RUN`, do sections 0 and 1, then write the report as section 6 describes but push nothing anywhere: no branches, no PRs, no issues, no commit to `library-check-state`. Print the report and list what you would have filed.

## 0. Set up

1. Work from a clone of `main`. If the working directory is not already a checkout of `globalize-now/globalize-skills`, run `git clone https://github.com/globalize-now/globalize-skills ~/globalize-skills && cd ~/globalize-skills`. Then `git fetch origin main && git checkout --detach origin/main`.
2. Check out the state: `git fetch origin library-check-state && git worktree add -B library-check-state .library-check origin/library-check-state`. (`/.library-check/` is gitignored on `main`.) Everything this procedure calls "state" lives in `.library-check/`.
3. If the branch is missing, or `.library-check/` has no dated report and no `.last-versions.json`, stop and report that the state is missing. Do not rebuild a baseline from scratch — that would re-flag months of findings.

## 1. Scan

Read the most recent dated report in `.library-check/` before anything else. It carries the baseline (`.last-versions.json`), the open-items list, the trigger taxonomy (A–G) and the standing order for quiet runs that this task has built up over months. Follow that practice — this file only defines the mechanics. Compare every tracked npm packument and RubyGems entry against the baseline, read diffs rather than release titles, and widen the window if a run was missed (compare the newest report's date with today).

Reaching upstream from this environment:
- npm registry and RubyGems are reachable: `npm view <pkg> versions time --json`, `curl -s https://registry.npmjs.org/<pkg>`, `curl -s https://rubygems.org/api/v1/versions/<gem>.json`.
- Package diffs: `npm diff --diff=<pkg>@<old> --diff=<pkg>@<new>` (published tarballs), or clone the upstream repo (`git clone --filter=blob:none <url>`) and `git log`/`git diff <old-tag>..<new-tag>`. Plain git reads of public GitHub repos work.
- The GitHub REST API and github.com web pages for **upstream** repos return 403 here (this session's GitHub scope is `globalize-skills` only). That is not "nothing changed" — use the git clone instead. WebFetch may reach changelog pages on other hosts.
- Use `curl`/`npm`/`git` for network access; they honour the proxy.

## 2. Write path

- **Branches:** `git push -u origin library-check/<slug>`.
- **PRs and issues:** the GitHub MCP connector (`mcp__github__*`; load with ToolSearch): `create_pull_request`, `issue_write`, `list_pull_requests`, `list_branches`. There is no `gh` CLI.
- If a push or connector write is refused, record the exact error and the call that produced it, and fall back to section 5 for that finding.

## 3. PRs — one per library

For each library whose change is actionable:

1. Branch `library-check/<slug>` — e.g. `library-check/vue-i18n-11.4.9`, `library-check/next-intl-root-params`. One library per branch, never batched. Make it in its own worktree off `origin/main`: `git worktree add ../lc-<slug> -b library-check/<slug> origin/main`.
2. Make the change. Attempt everything, including work that needs judgement — do not downgrade a real change to an issue just because it is more than a version bump. Follow `CLAUDE.md` (notably: pin installs to a major).
3. Run whatever in `evals/` covers the touched skill (the static verifiers at least: `verify-manifest.sh`, `verify-rules-template.sh`, `verify-format-helpers.sh` where relevant) and report the result in the PR body.
4. Push and open the PR (section 2).
5. PR body: what moved upstream (with links to the diff or changelog you actually read), why the skill needs to change, the files touched, and how it was verified. If any part is uncertain, open it as a **draft** and put the open questions under a `## Needs a human` heading. Confident, verified changes go in ready for review.
6. Before creating a branch, check `list_branches` and `list_pull_requests` with `head: "globalize-now:<branch>"`; update an existing branch/PR instead of opening a duplicate. Never push to `main`, never force-push.

Open an **issue** only when there is genuinely nothing to implement — a product decision, an upstream watch item, or a finding with no clear fix. Say in the report why it became an issue rather than a PR.

## 4. Backlog

On every run where the write path works, drain `.library-check/pending-issues/` — oldest first, **at most 5 per run**. Each draft becomes a PR where implementable (re-run `git apply --check` on today's `main` first; respect the overlap/commutation notes in the drafts, e.g. 23 before `31-…post23.patch`, 22 before 32), an issue otherwise. `15-swc-core-abi-drift.md` is withdrawn: do not file it. Draft 26 targets PR #69's branch, not `main`. Record the resulting URL in the matching open item, append a `Filed: <url>` line to the draft, and `git mv` it to `pending-issues/filed/`.

## 5. Fallback (no write path)

Write or refresh the draft under `.library-check/pending-issues/`, and state in the report that the write path was unavailable, quoting the actual error and the check that produced it. Never silently skip a finding.

## 6. Finish

1. Write the report to `.library-check/YYYY-MM-DD.md` (carry the open-items list, taxonomy and standing orders forward, as previous reports did) and re-stamp `.last-versions.json`.
2. Commit in `.library-check/` (`library-check: YYYY-MM-DD report`) and `git push origin library-check-state`. If the push is rejected as non-fast-forward, `git pull --rebase origin library-check-state` and push again. Never force-push. If it still fails, paste the full report into the final summary so nothing is lost.
3. End with a short summary: PRs opened (URL + one-line title, marked draft where draft), issues filed, backlog drained vs remaining, whether the state push succeeded, and anything deferred.
