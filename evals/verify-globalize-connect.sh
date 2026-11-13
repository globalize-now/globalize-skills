#!/bin/bash
set -uo pipefail
shopt -s nullglob   # a skill with no references/ globs to nothing

# Usage: ./evals/verify-globalize-connect.sh
#
# Static check (no model, no network) of the Globalize connect hand-off: the prose
# invariants that make an agent finish setup with a started translation instead of
# stalling. Each check is a tripwire for one behaviour, named in its message.
#
# Checks:
#   1. globalize-guide loads a sibling skill from disk when the Skill tool can't (a skill
#      installed mid-session isn't registered), and never answers a failed load with a
#      reinstall prompt while the SKILL.md is on disk.
#   2. globalize-guide ends on a Workflow and its first translation: Phase 1.5 signs in only
#      with a GitHub or GitLab remote, Phase 4 pushes the setup (or offers `gh repo create`
#      when there is no remote), the plan carries the step, and globalize-now-project-setup
#      lists the Workflow's runs before `workflows runs start --delivery pr`, or offers a pull
#      request into the default branch only after the user confirms. Every `workflows`
#      command the project skill names is one the CLI registers, with flags it defines.
#   3. lovable-i18n's Phase 6 sets up a Workflow and ends by starting its first run as a
#      pull request (`start_workflow_run`, only after `list_workflow_runs` finds none), reports
#      the pull request only once `get_workflow_run` says it was delivered, continues a
#      Project-held repository with `translate_repository`, creates no Project, and its no-MCP
#      fallback opens the Workflow builder or runs `workflows runs start --delivery pr`.
#   4. globalize-now-project-setup never picks up a Project it wasn't pointed at: no "exactly
#      one … reuse it" rule is left, a Project-held repository (REPOSITORY_HELD_BY_PROJECT)
#      routes to references/project-path.md, which translates that Project's repository with
#      flags the CLI has, every preview answer is handled, and with no remote (or another
#      host) it stops naming GitHub, running `gh repo create` only after the user confirms.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

GUIDE="$REPO_ROOT/skills/globalize-guide/SKILL.md"
ORCH="$REPO_ROOT/skills/globalize-guide/references/orchestrator"
PROJECT="$REPO_ROOT/skills/globalize-now-project-setup/SKILL.md"
LOVABLE="$REPO_ROOT/skills/lovable-i18n/SKILL.md"
PROJECT_PATH="$REPO_ROOT/skills/globalize-now-project-setup/references/project-path.md"
CLI_REPOS="$REPO_ROOT/api-client/src/commands/repositories.ts"
CLI_WORKFLOWS="$REPO_ROOT/api-client/src/commands/workflows.ts"

PASS=0
FAIL=0
pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

# Text of a markdown section: from the line equal to $2 up to the next heading of the
# same or a higher level. Lines inside ``` fences are never headings (shell comments).
section() {
  awk -v h="$2" '
    /^```/ { fence = !fence }
    !fence && $0 == h { f = 1; match(h, /^#+/); lvl = RLENGTH; print; next }
    f && !fence && /^#+ / { match($0, /^#+/); if (RLENGTH <= lvl) exit }
    f { print }
  ' "$1"
}

has() { printf '%s' "$1" | grep -qF -- "$2"; }

# Line number of the first line of $1 containing $2 (empty when absent).
line_of() { printf '%s\n' "$1" | grep -nF -- "$2" | head -n 1 | cut -d: -f1; }

# shellcheck source=lib/workflows-cli.sh
. "$SCRIPT_DIR/lib/workflows-cli.sh"

# Each `repositories translate` invocation in the files given passes only flags the CLI's
# `repositories translate` command defines, and at least one passes --delivery-mode pr.
check_translate_cli() {
  local translate_cmd where inv flag found=0
  translate_cmd="$(awk '/\.command\("translate"\)/ { f = 1 } f { print } f && /^    }\);/ { exit }' "$CLI_REPOS")"
  if [ -z "$translate_cmd" ]; then
    fail "api-client has no 'repositories translate' command in $CLI_REPOS"
    return
  fi
  while IFS=$'\t' read -r where inv; do
    [ -z "$inv" ] && continue
    has "$inv" '--delivery-mode pr' && found=1
    while IFS= read -r flag; do
      [ "$flag" = "--json" ] && continue   # global output option
      if has "$translate_cmd" "\"$flag " || has "$translate_cmd" "\"$flag <"; then
        pass "CLI 'repositories translate' accepts $flag"
      else
        fail "$where passes $flag to 'repositories translate', which the CLI does not define: $inv"
      fi
    done < <(printf '%s' "$inv" | grep -oE -- '--[a-z][a-z-]+' | sort -u)
  done < <(cli_invocations 'repositories translate' "$@")
  if [ "$found" -eq 1 ]; then
    pass "'repositories translate' runs with --delivery-mode pr"
  else
    fail "no 'repositories translate --delivery-mode pr' invocation"
  fi
}

echo "--- 1. globalize-guide: a sibling skill the Skill tool can't load is read from disk ---"
for path in '.claude/skills/<name>/SKILL.md' '.agents/skills/<name>/SKILL.md'; do
  if grep -qF -- "$path" "$GUIDE"; then
    pass "names the disk fallback $path"
  else
    fail "does not name the disk fallback $path"
  fi
done
if grep -qi 'skill missing' "$GUIDE"; then
  fail "still has a 'Skill missing →' branch — a failed Skill-tool load must read the SKILL.md from disk"
else
  pass "no 'Skill missing →' branch left"
fi
# The only install command allowed is the one for when no SKILL.md exists on disk.
BAD_INSTALL=$(grep -nF 'npx skills add' "$GUIDE" | grep -vF 'none of those files exists' || true)
if [ -z "$BAD_INSTALL" ]; then
  pass "every install prompt is conditioned on the SKILL.md being absent from disk"
else
  fail "install prompt not conditioned on the SKILL.md being absent from disk: $BAD_INSTALL"
fi

echo ""
echo "--- 2. globalize-guide: Phase 4 ends on a Workflow and its first translation ---"
PHASE15="$(section "$GUIDE" '## Phase 1.5 — Globalize account (upfront, interactive)')"
if has "$PHASE15" 'github.com' && has "$PHASE15" 'gitlab.com'; then
  pass "Phase 1.5 is gated on a github.com or gitlab.com remote"
else
  fail "Phase 1.5 is not gated on a github.com or gitlab.com remote (no-remote runs must not sign in)"
fi
PHASE4="$(section "$GUIDE" '## Phase 4 — Globalize Workflow (connect repo, first translation)')"
if [ -z "$PHASE4" ]; then
  fail "SKILL.md has no '## Phase 4 — Globalize Workflow (connect repo, first translation)' section"
else
  for marker in '### 4.2 Push the setup' 'firstTranslationBranch' 'start_first_translation' 'pull request' \
    'gh auth status' 'gh repo create' 'Headless'; do
    if has "$PHASE4" "$marker"; then pass "Phase 4 names '$marker'"; else fail "Phase 4 does not name '$marker'"; fi
  done
  GH_REPO_LINE="$(printf '%s\n' "$PHASE4" | grep -F 'gh repo create' || true)"
  if [ -n "$GH_REPO_LINE" ] && has "$GH_REPO_LINE" 'confirms'; then
    pass "Phase 4 runs 'gh repo create' only once the user confirms"
  else
    fail "Phase 4's 'gh repo create' is not conditioned on the user confirming"
  fi
  # §4.1 builds globalize-inputs.json from Phase 1's git.remote, which is null on a project
  # that had no remote. After `gh repo create`, or on a resume once the user added a remote
  # by hand, §4.2 must refresh it and rebuild the inputs, or Workflow setup gets no repo.
  S42="$(section "$GUIDE" '### 4.2 Push the setup')"
  REFRESH="$(printf '%s\n' "$S42" | grep -F 'git.remote' | grep -F 'globalize-inputs.json' || true)"
  if [ -n "$REFRESH" ] && has "$REFRESH" 'gh repo create' && printf '%s' "$REFRESH" | grep -qi 'resume'; then
    pass "§4.2 refreshes git.remote and rebuilds globalize-inputs.json after 'gh repo create' and on a resume"
  else
    fail "§4.2 has no line refreshing git.remote and rebuilding globalize-inputs.json after 'gh repo create' and on a resume"
  fi
  # Declining the gh offer skips sign-in for good (Phase 1.5), while Phase 4 stays open for a rerun.
  if has "$PHASE4" '[x] delegate_account_setup — skipped'; then
    pass "the no-remote stop marks Phase 1.5 '[x] delegate_account_setup — skipped'"
  else
    fail "the no-remote stop does not mark Phase 1.5 '[x] delegate_account_setup — skipped'"
  fi
fi
if grep -qF '`globalize` CLI' "$GUIDE"; then
  fail "SKILL.md names a '\`globalize\` CLI'; the bin is globalise-now-cli"
else
  pass "SKILL.md names no '\`globalize\` CLI'"
fi
META_DESC="$(sed -nE 's/^[[:space:]]*"description":[[:space:]]*"(.*)",?[[:space:]]*$/\1/p' "$(dirname "$GUIDE")/metadata.json")"
if has "$META_DESC" 'Workflow' && ! has "$META_DESC" 'project + repo'; then
  pass "metadata.json's description ends on a Workflow"
else
  fail "metadata.json's description does not end on a Workflow: $META_DESC"
fi
for step in push_setup start_first_translation; do
  if grep -qE "^- \[ \] ${step}\b" "$ORCH/plan-format.md"; then
    pass "plan-format.md lists Phase 4 step '$step'"
  else
    fail "plan-format.md does not list Phase 4 step '$step'"
  fi
done
if grep -qF '## Phase 4 — Globalize Workflow' "$ORCH/plan-format.md"; then
  pass "plan-format.md's Phase 4 sets up a Workflow"
else
  fail "plan-format.md has no '## Phase 4 — Globalize Workflow' section"
fi
for marker in firstTranslationBranch workflowName pathLocales; do
  if grep -qF "$marker" "$ORCH/globalize-inputs.md"; then
    pass "globalize-inputs.md documents $marker"
  else
    fail "globalize-inputs.md does not document $marker"
  fi
done
if grep -qF 'importScope' "$ORCH/globalize-inputs.md"; then
  fail "globalize-inputs.md still writes importScope, which Workflow setup has no use for"
else
  pass "globalize-inputs.md writes no importScope"
fi

STEP5="$(section "$PROJECT" '## Step 5: Start the first translation (orchestrated mode)')"
if [ -z "$STEP5" ]; then
  fail "globalize-now-project-setup has no '## Step 5: Start the first translation (orchestrated mode)'"
else
  for marker in 'firstTranslationBranch' 'workflows runs list' 'workflows runs start' '--delivery pr' \
    'INSUFFICIENT_CREDITS' 'gh pr create' 'Headless'; do
    if has "$STEP5" "$marker"; then pass "project-setup Step 5 names '$marker'"; else fail "project-setup Step 5 does not name '$marker'"; fi
  done
  LIST_AT="$(line_of "$STEP5" 'cli-client workflows runs list')"
  START_AT="$(line_of "$STEP5" 'cli-client workflows runs start')"
  if [ -n "$LIST_AT" ] && [ -n "$START_AT" ] && [ "$LIST_AT" -lt "$START_AT" ]; then
    pass "Step 5 lists the Workflow's runs before starting one"
  else
    fail "Step 5 does not list the Workflow's runs before 'workflows runs start'"
  fi
  GH_PR_LINE="$(printf '%s\n' "$STEP5" | grep -F 'gh pr create' || true)"
  if [ -n "$GH_PR_LINE" ] && has "$GH_PR_LINE" 'confirms'; then
    pass "Step 5 runs 'gh pr create' only once the user confirms"
  else
    fail "Step 5's 'gh pr create' is not conditioned on the user confirming"
  fi
fi
# Every `workflows` command the project skill names must exist on the CLI, with its flags.
check_workflows_cli "$CLI_WORKFLOWS" "$PROJECT" "$(dirname "$PROJECT")"/references/*.md

echo ""
echo "--- 3. lovable-i18n: Phase 6 sets up a Workflow and starts its first run ---"
PHASE6="$(section "$LOVABLE" '## Phase 6: Connect Globalize.now')"
PRIMARY="$(section "$LOVABLE" '### Primary path — the Globalize MCP connector')"
FALLBACK="$(section "$LOVABLE" '### Fallback path — no MCP (dashboard or local CLI)')"
# True when, in $1 before the first $4, $2 occurs and $3 follows it: the start ($3 … $4)
# is preceded by the runs list ($2).
listed_before_start() {
  local before="${1%%"$4"*}"
  [ "$before" != "$1" ] && has "$before" "$2" && has "${before#*"$2"}" "$3"
}
if [ -z "$PHASE6" ] || [ -z "$PRIMARY" ] || [ -z "$FALLBACK" ]; then
  fail "lovable-i18n Phase 6, its primary path or its fallback path heading is missing"
else
  for marker in 'preview_workflow_setup' 'set_up_workflow' 'list_workflow_runs' 'start_workflow_run' 'delivery: "pr"' 'get_workflow_run' 'delivered' 'REPOSITORY_HELD_BY_PROJECT' 'translate_repository'; do
    if has "$PRIMARY" "$marker"; then pass "MCP path names '$marker'"; else fail "MCP path does not name '$marker'"; fi
  done
  if listed_before_start "$PRIMARY" 'list_workflow_runs' 'start_workflow_run' 'delivery: "pr"'; then
    pass "MCP path lists the Workflow's runs before it starts one"
  else
    fail "MCP path does not call list_workflow_runs before start_workflow_run"
  fi
  # The first run starts without a second question: the Ask phase already told the user that
  # connecting starts it and spends credits.
  BEFORE_START="${PRIMARY%%delivery: \"pr\"*}"
  LISTS="$(printf '%s' "$BEFORE_START" | grep -oF 'list_workflow_runs' | wc -l | tr -d ' ')"
  if [ "$LISTS" = "1" ]; then
    pass "MCP path lists the runs once, then starts one"
  else
    fail "MCP path calls list_workflow_runs $LISTS times before start_workflow_run (a pause to ask, then a re-list)"
  fi
  ASK="$(printf '%s\n' "$PHASE6" | grep -iE 'shall I start|whether to start' || true)"
  if [ -z "$ASK" ]; then
    pass "Phase 6 starts the first translation without asking again"
  else
    fail "Phase 6 asks before starting the first translation: $ASK"
  fi
  ASK_ITEM="$(grep -F '**Connect Globalize.now**' "$LOVABLE" | head -n 1)"
  if has "$ASK_ITEM" 'first translation' && has "$ASK_ITEM" 'credits'; then
    pass "the Ask phase says connecting starts the first translation, which spends credits"
  else
    fail "the Ask phase does not say connecting starts the first translation and spends credits"
  fi
  for gone in 'create_project' 'connect_repository' 'projects create' 'repositories create'; do
    if has "$PHASE6" "$gone"; then fail "Phase 6 still creates a Project ('$gone')"; else pass "Phase 6 does not name '$gone'"; fi
  done
  if has "$FALLBACK" '/workflows/new'; then
    pass "dashboard fallback opens the Workflow builder"
  else
    fail "dashboard fallback does not open the Workflow builder (/workflows/new)"
  fi
  if has "$FALLBACK" 'workflows runs start' && has "$FALLBACK" '--delivery pr'; then
    pass "CLI fallback starts the first run as a pull request"
  else
    fail "CLI fallback does not run 'workflows runs start --delivery pr'"
  fi
  if listed_before_start "$FALLBACK" 'workflows runs list' 'workflows runs start' '--delivery pr'; then
    pass "CLI fallback lists the Workflow's runs before it starts one"
  else
    fail "CLI fallback does not run 'workflows runs list' before 'workflows runs start'"
  fi
fi

echo ""
echo "--- 4. globalize-now-project-setup: a Workflow, or the Project the refusal names ---"
# An Idle Project is never picked up: no rule reuses a Project because it is the only one.
# The scan proves nothing about a file it can't read, so every file it names must exist.
REUSE_FILES=("$PROJECT" "$PROJECT_PATH" "$GUIDE" "$ORCH/plan-format.md" "$(dirname "$PROJECT")"/references/*.md)
REUSE_MISSING=""
for f in "${REUSE_FILES[@]}"; do
  [ -f "$f" ] || REUSE_MISSING="$REUSE_MISSING ${f#"$REPO_ROOT"/}"
done
if [ -n "$REUSE_MISSING" ]; then
  fail "can't scan for a reuse-the-only-Project rule, missing:$REUSE_MISSING"
else
  REUSE="$(grep -niE 'exactly one[^.]*reuse|reuse[^.]*only (one|project)' "${REUSE_FILES[@]}")"
  if [ -z "$REUSE" ]; then
    pass "no rule reuses the organisation's only Project"
  else
    fail "a rule still reuses the organisation's only Project: $REUSE"
  fi
fi

for marker in 'workflows preview-setup' 'workflows setup' '--preview-hash' 'alreadySetUp' '`needs`' \
  'WORKFLOW_PREVIEW_STALE' 'WORKFLOW_REPOSITORY_CLAIMED'; do
  if grep -qF -- "$marker" "$PROJECT"; then pass "Workflow path handles '$marker'"; else fail "Workflow path does not handle '$marker'"; fi
done

HELD="$(grep -F 'REPOSITORY_HELD_BY_PROJECT' "$PROJECT" || true)"
if [ -n "$HELD" ] && has "$HELD" 'references/project-path.md'; then
  pass "a Project-held repository (REPOSITORY_HELD_BY_PROJECT) routes to references/project-path.md"
else
  fail "REPOSITORY_HELD_BY_PROJECT does not route to references/project-path.md"
fi
if [ ! -f "$PROJECT_PATH" ]; then
  fail "globalize-now-project-setup has no references/project-path.md"
else
  for marker in 'projectId' 'repositoryId' 'repositories list --project-id' 'gitlab.com'; do
    if grep -qF -- "$marker" "$PROJECT_PATH"; then pass "project-path.md names '$marker'"; else fail "project-path.md does not name '$marker'"; fi
  done
  check_translate_cli "$PROJECT_PATH"
  # The CLI's `projects create` always prints a Workflow-setup notice, including on this
  # path's intentional gitlab.com Project; the agent must carry on.
  NOTICE="$(grep -F 'projects create' "$PROJECT_PATH" | grep -i 'notice' | grep -i 'expected' || true)"
  if [ -n "$NOTICE" ]; then
    pass "project-path.md says the 'projects create' notice is expected here"
  else
    fail "project-path.md does not say the 'projects create' notice is expected on this path"
  fi
fi

STOPS="$(section "$PROJECT" '## No-remote and unsupported host stops')"
if [ -z "$STOPS" ]; then
  fail "globalize-now-project-setup has no '## No-remote and unsupported host stops'"
else
  for marker in 'GitHub repository' 'gh auth status' 'gh repo create <name> --private --source=. --remote=origin --push' \
    'Headless' 'Bitbucket'; do
    if has "$STOPS" "$marker"; then pass "the stop names '$marker'"; else fail "the stop does not name '$marker'"; fi
  done
  GH_REPO_LINE="$(printf '%s\n' "$STOPS" | grep -F 'gh repo create' || true)"
  if [ -n "$GH_REPO_LINE" ] && has "$GH_REPO_LINE" 'confirms'; then
    pass "the stop runs 'gh repo create' only once the user confirms"
  else
    fail "the stop's 'gh repo create' is not conditioned on the user confirming"
  fi
  STOPS_AT="$(grep -nF '## No-remote and unsupported host stops' "$PROJECT" | head -n 1 | cut -d: -f1)"
  AUTH_AT="$(grep -nF '## Auth precheck' "$PROJECT" | head -n 1 | cut -d: -f1)"
  if [ -n "$AUTH_AT" ] && [ "$STOPS_AT" -lt "$AUTH_AT" ]; then
    pass "the stops come before the auth precheck (no sign-in without a remote)"
  else
    fail "the stops do not come before '## Auth precheck'"
  fi
fi

echo ""
echo "--- Report ---"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
[ "$FAIL" -eq 0 ]
