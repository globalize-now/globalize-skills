#!/bin/bash
set -uo pipefail

# Usage: ./evals/verify-plan-tracking.sh <workdir>
#
# Asserts that a finished globalize-guide run kept its checklist (.globalize/plan.md),
# per skills/globalize-guide/references/orchestrator/checklist.md. Run it after an agent
# has executed the plan; a plan fresh out of Phase 1 is meant to fail.
#
# Checks:
#   1. plan.md exists and holds no skeleton HTML comments.
#   2. At least one box is ticked, and no box is still open, except Phase 4's boxes left
#      "— blocked: no GitHub remote" by the no-remote stop (SKILL.md §4.2).
#   3. Phase 2 was expanded: at least MIN_DETAIL_ITEMS nested detail items.

WORKDIR="${1:?Usage: verify-plan-tracking.sh <workdir>}"
PLAN_MD="$WORKDIR/.globalize/plan.md"

# Every supported stack's setup references ask for more concrete actions than this, so a
# lower count means the worker did not expand its steps.
MIN_DETAIL_ITEMS=5

PASS=0
FAIL=0
pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

report() {
  echo ""
  echo "--- Report ---"
  echo "  Passed: $PASS"
  echo "  Failed: $FAIL"
  [ "$FAIL" -eq 0 ]
  exit $?
}

if [ ! -f "$PLAN_MD" ]; then
  fail "plan.md missing at $PLAN_MD"
  report
fi
pass "plan.md exists"

if grep -qF '<!--' "$PLAN_MD"; then
  fail "plan.md still contains skeleton HTML comments"
else
  pass "plan.md has no skeleton comments"
fi

TICKED=$(grep -cE '^[[:space:]]*- \[x\]' "$PLAN_MD" || true)
if [ "$TICKED" -gt 0 ]; then
  pass "$TICKED boxes ticked"
else
  fail "no box is ticked: the checklist was never updated"
fi

# One open state is a finished run: with no GitHub remote, §4.2 stops and leaves Phase 4's
# open boxes "— blocked: no GitHub remote", so a rerun resumes there once a remote exists.
# Exactly that, in Phase 4 only; any other open box is unfinished work.
# Prints "held<TAB>line" for each such box and "open<TAB>NR:line" for every other open box.
BOXES=$(awk -v blocked=' — blocked: no GitHub remote' '
  /^## / { phase4 = ($0 ~ /^## Phase 4/) }
  /^[[:space:]]*- \[ \]/ {
    held = phase4 && substr($0, length($0) - length(blocked) + 1) == blocked
    print (held ? "held" : "open") "\t" NR ":" $0
  }
' "$PLAN_MD")
OPEN=$(printf '%s\n' "$BOXES" | sed -n 's/^open	//p')
HELD=$(printf '%s\n' "$BOXES" | grep -c '^held	' || true)
if [ -z "$OPEN" ]; then
  pass "no open boxes"
else
  fail "open boxes remain:"
  printf '%s\n' "$OPEN" | sed 's/^/        /'
fi
if [ "$HELD" -gt 0 ]; then
  pass "Phase 4 waits for a GitHub remote ($HELD boxes '— blocked: no GitHub remote'; a rerun resumes there)"
fi

DETAIL=$(awk '/^## Phase 2/{f=1;next} /^## /{f=0} f && /^[[:space:]]+- \[[ x]\]/{n++} END{print n+0}' "$PLAN_MD")
if [ "$DETAIL" -ge "$MIN_DETAIL_ITEMS" ]; then
  pass "Phase 2 expanded into $DETAIL detail items"
else
  fail "Phase 2 has $DETAIL detail items (need at least $MIN_DETAIL_ITEMS): the setup worker did not expand its steps"
fi

report
