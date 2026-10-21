#!/bin/bash
set -uo pipefail

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
#   2. globalize-guide ends by starting the first translation: Phase 4 pushes the setup,
#      the plan carries the step, and globalize-now-project-setup runs
#      `repositories translate --delivery-mode pr` — with flags the CLI really has.
#   3. lovable-i18n's Phase 6 ends by calling the hosted `translate_repository` tool as a
#      pull request, and its no-MCP fallback starts the translation too.
#   4. globalize-now-project-setup reuses the organisation's only project in orchestrated
#      mode, and the repository already connected to it.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

GUIDE="$REPO_ROOT/skills/globalize-guide/SKILL.md"
ORCH="$REPO_ROOT/skills/globalize-guide/references/orchestrator"
PROJECT="$REPO_ROOT/skills/globalize-now-project-setup/SKILL.md"
LOVABLE="$REPO_ROOT/skills/lovable-i18n/SKILL.md"
CLI_REPOS="$REPO_ROOT/api-client/src/commands/repositories.ts"

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
echo "--- 2. globalize-guide: Phase 4 ends by starting the first translation ---"
PHASE4="$(section "$GUIDE" '## Phase 4 — Globalize project (connect repo, first translation)')"
if [ -z "$PHASE4" ]; then
  fail "SKILL.md has no '## Phase 4 — Globalize project (connect repo, first translation)' section"
else
  for marker in '### 4.2 Push the setup' 'firstTranslationBranch' 'start_first_translation' 'pull request'; do
    if has "$PHASE4" "$marker"; then pass "Phase 4 names '$marker'"; else fail "Phase 4 does not name '$marker'"; fi
  done
fi
for step in push_setup start_first_translation; do
  if grep -qE "^- \[ \] ${step}\b" "$ORCH/plan-format.md"; then
    pass "plan-format.md lists Phase 4 step '$step'"
  else
    fail "plan-format.md does not list Phase 4 step '$step'"
  fi
done
if grep -qF 'firstTranslationBranch' "$ORCH/globalize-inputs.md"; then
  pass "globalize-inputs.md documents firstTranslationBranch"
else
  fail "globalize-inputs.md does not document firstTranslationBranch"
fi

STEP5="$(section "$PROJECT" '## Step 5: Start the first translation (orchestrated mode)')"
if [ -z "$STEP5" ]; then
  fail "globalize-now-project-setup has no '## Step 5: Start the first translation (orchestrated mode)'"
else
  for marker in 'firstTranslationBranch' 'repositories translate' '--delivery-mode pr'; do
    if has "$STEP5" "$marker"; then pass "project-setup Step 5 names '$marker'"; else fail "project-setup Step 5 does not name '$marker'"; fi
  done
  # Every flag the step passes must exist on the CLI's `repositories translate` command.
  TRANSLATE_CMD="$(awk '/\.command\("translate"\)/ { f = 1 } f { print } f && /^    }\);/ { exit }' "$CLI_REPOS")"
  if [ -z "$TRANSLATE_CMD" ]; then
    fail "api-client has no 'repositories translate' command in $CLI_REPOS"
  else
    while IFS= read -r flag; do
      [ "$flag" = "--json" ] && continue   # global output option
      if has "$TRANSLATE_CMD" "\"$flag " || has "$TRANSLATE_CMD" "\"$flag <"; then
        pass "CLI 'repositories translate' accepts $flag"
      else
        fail "project-setup Step 5 passes $flag, which the CLI's 'repositories translate' does not define"
      fi
    done < <(printf '%s' "$STEP5" | grep -oE -- '--[a-z][a-z-]+' | sort -u)
  fi
fi

echo ""
echo "--- 3. lovable-i18n: Phase 6 ends by starting the first translation ---"
PHASE6="$(section "$LOVABLE" '## Phase 6: Connect Globalize.now')"
PRIMARY="$(section "$LOVABLE" '### Primary path — the Globalize MCP connector')"
FALLBACK="$(section "$LOVABLE" '### Fallback path — no MCP (dashboard or local CLI)')"
if [ -z "$PHASE6" ] || [ -z "$PRIMARY" ] || [ -z "$FALLBACK" ]; then
  fail "lovable-i18n Phase 6, its primary path or its fallback path heading is missing"
else
  for marker in 'translate_repository' 'deliveryMode: "pr"' 'idempotencyKey'; do
    if has "$PRIMARY" "$marker"; then pass "MCP path names '$marker'"; else fail "MCP path does not name '$marker'"; fi
  done
  if has "$FALLBACK" 'repositories translate' && has "$FALLBACK" '--delivery-mode pr'; then
    pass "CLI fallback starts the first translation as a pull request"
  else
    fail "CLI fallback does not run 'repositories translate --delivery-mode pr'"
  fi
fi

echo ""
echo "--- 4. globalize-now-project-setup: orchestrated mode reuses the only project ---"
STEP3A="$(section "$PROJECT" '### 3a. Check for existing projects')"
ORCH_LINE="$(printf '%s\n' "$STEP3A" | grep -F -- '- **Orchestrated**' || true)"
if [ -n "$ORCH_LINE" ] && has "$ORCH_LINE" 'exactly one' && has "$ORCH_LINE" 'reuse it'; then
  pass "3a: orchestrated mode reuses the project when there is exactly one"
else
  fail "3a: no '- **Orchestrated**' rule that reuses the project when there is exactly one"
fi
STEP4B="$(section "$PROJECT" '### 4b. Connect the repository')"
if has "$STEP4B" 'Reused project' && has "$STEP4B" 'repositories list --project-id'; then
  pass "4b: a reused project's existing repository is reused, not connected twice"
else
  fail "4b: a reused project's existing repository is not looked up before 'repositories create'"
fi

echo ""
echo "--- Report ---"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
[ "$FAIL" -eq 0 ]
