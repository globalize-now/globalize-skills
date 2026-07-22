#!/bin/bash
set -uo pipefail

# Usage: verify-orchestration.sh <workdir> <fixture>
#
# Verifies Layer A (orchestration) output for positive/collapse fixtures:
#   - Detection layer: detection.json matches expectedDetection spec
#   - Plan layer: plan.md matches expectedPlan spec

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

WORKDIR="${1:?Usage: verify-orchestration.sh <workdir> <fixture>}"
FIXTURE="${2:?Usage: verify-orchestration.sh <workdir> <fixture>}"

MANIFEST="$SCRIPT_DIR/fixtures.json"

PASS=0
FAIL=0
WARN=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }
warn() { echo "  WARN: $1"; WARN=$((WARN + 1)); }

FIXTURE_CONFIG=$(jq -e ".\"$FIXTURE\"" "$MANIFEST" 2>/dev/null) || {
  echo "ERROR: Fixture '$FIXTURE' not found in $MANIFEST"
  exit 1
}

# Resolve expectation file paths (relative to repo root; may be absent)
EXPECTED_DETECTION_REL=$(echo "$FIXTURE_CONFIG" | jq -r '.expectedDetection // empty')
EXPECTED_PLAN_REL=$(echo "$FIXTURE_CONFIG" | jq -r '.expectedPlan // empty')

EXPECTED_DETECTION_FILE=""
EXPECTED_PLAN_FILE=""

if [ -n "$EXPECTED_DETECTION_REL" ]; then
  EXPECTED_DETECTION_FILE="$REPO_ROOT/$EXPECTED_DETECTION_REL"
fi
if [ -n "$EXPECTED_PLAN_REL" ]; then
  EXPECTED_PLAN_FILE="$REPO_ROOT/$EXPECTED_PLAN_REL"
fi

DETECTION_JSON="$WORKDIR/.globalize/detection.json"
PLAN_MD="$WORKDIR/.globalize/plan.md"

# ─── Layer A: Detection ───

echo ""
echo "--- Layer A: Detection ---"

if [ ! -f "$DETECTION_JSON" ]; then
  fail "detection.json missing at $DETECTION_JSON — Phase 1 inspect subagent did not write output"
  # Cannot proceed with detection checks
else
  pass "detection.json exists"

  if [ -z "$EXPECTED_DETECTION_FILE" ]; then
    warn "No expectedDetection path in fixtures.json for '$FIXTURE' — skipping field checks"
  elif [ ! -f "$EXPECTED_DETECTION_FILE" ]; then
    warn "expectedDetection file not yet authored: $EXPECTED_DETECTION_FILE — skipping field checks"
  else
    EXPECTED_MATCH=$(jq -c '.match' "$EXPECTED_DETECTION_FILE")
    IGNORE_LIST=$(jq -c '.ignore // []' "$EXPECTED_DETECTION_FILE")

    # Walk every scalar leaf in the match object, compare against actual detection.json
    while IFS= read -r PATH_JSON; do
      LABEL=$(echo "$PATH_JSON" | jq -r 'join(".")')
      EXPECTED_VAL=$(echo "$EXPECTED_MATCH" | jq -r --argjson p "$PATH_JSON" 'getpath($p)')
      ACTUAL_VAL=$(jq -r --argjson p "$PATH_JSON" 'getpath($p) | if . == null then "<missing>" else tostring end' "$DETECTION_JSON")
      if [ "$EXPECTED_VAL" = "$ACTUAL_VAL" ]; then
        pass "$LABEL = $EXPECTED_VAL"
      else
        fail "$LABEL: expected '$EXPECTED_VAL', got '$ACTUAL_VAL'"
      fi
    done < <(echo "$EXPECTED_MATCH" | jq -c 'paths(type != "object" and type != "array")')

    # softAssert: candidateFilesMinCount (warn, not fail)
    CANDIDATE_MIN=$(jq -r '.softAssert.candidateFilesMinCount // empty' "$EXPECTED_DETECTION_FILE")
    if [ -n "$CANDIDATE_MIN" ]; then
      ACTUAL_COUNT=$(jq '.candidateFiles | length' "$DETECTION_JSON" 2>/dev/null || echo 0)
      if [ "$ACTUAL_COUNT" -ge "$CANDIDATE_MIN" ]; then
        pass "candidateFiles count ($ACTUAL_COUNT) >= $CANDIDATE_MIN"
      else
        warn "candidateFiles count ($ACTUAL_COUNT) below threshold $CANDIDATE_MIN — content-sensitive detection may need tuning"
      fi
    fi

    # softAssert: candidateFilesMustContain (warn, not fail) — each substring must
    # appear in at least one candidateFiles[].path. Guards detection-recall for
    # specific file shapes (e.g. data/content modules) without over-constraining
    # the content-sensitive candidate ranking.
    MUST_CONTAIN=$(jq -r '.softAssert.candidateFilesMustContain // [] | .[]' "$EXPECTED_DETECTION_FILE")
    while IFS= read -r NEEDLE; do
      [ -z "$NEEDLE" ] && continue
      if jq -e --arg n "$NEEDLE" '.candidateFiles // [] | any(.path | contains($n))' "$DETECTION_JSON" >/dev/null 2>&1; then
        pass "candidateFiles contains a path matching '$NEEDLE'"
      else
        warn "candidateFiles has no path matching '$NEEDLE' — detection may miss this file shape"
      fi
    done <<< "$MUST_CONTAIN"
  fi
fi

# ─── Layer A: Plan ───

echo ""
echo "--- Layer A: Plan ---"

if [ -z "$EXPECTED_PLAN_FILE" ]; then
  echo "  NOTE: No expectedPlan path in fixtures.json for '$FIXTURE' — skipping plan checks"
elif [ ! -f "$EXPECTED_PLAN_FILE" ]; then
  echo "  NOTE: expectedPlan file not yet authored: $EXPECTED_PLAN_FILE — skipping plan checks"
else
  if [ ! -f "$PLAN_MD" ]; then
    fail "plan.md missing at $PLAN_MD — Phase 1 did not produce a plan"
  else
    pass "plan.md exists"

    EXPECTED_VARIANT=$(jq -r '.variant // empty' "$EXPECTED_PLAN_FILE")
    EXPECTED_LIBRARY=$(jq -r '.library // empty' "$EXPECTED_PLAN_FILE")

    # Check variant string appears in plan.md
    if [ -n "$EXPECTED_VARIANT" ]; then
      if grep -qF "$EXPECTED_VARIANT" "$PLAN_MD"; then
        pass "variant '$EXPECTED_VARIANT' found in plan.md"
      else
        fail "variant '$EXPECTED_VARIANT' not found in plan.md"
      fi
    fi

    # Check library string appears in plan.md
    if [ -n "$EXPECTED_LIBRARY" ]; then
      if grep -qi "$EXPECTED_LIBRARY" "$PLAN_MD"; then
        pass "library '$EXPECTED_LIBRARY' found in plan.md"
      else
        fail "library '$EXPECTED_LIBRARY' not found in plan.md"
      fi
    fi

    # Check each expected Phase 2 step appears as a checklist item
    STEPS=$(jq -r '.phase2StepsContain // [] | .[]' "$EXPECTED_PLAN_FILE")
    while IFS= read -r STEP; do
      [ -z "$STEP" ] && continue
      # Accept both unchecked (- [ ]) and checked (- [x]) checklist items
      if grep -qE "^- \[[ x]\] ${STEP}" "$PLAN_MD"; then
        pass "phase2 step '${STEP}' found in plan.md"
      else
        fail "phase2 step '${STEP}' not found in plan.md (expected line: '- [ ] ${STEP}')"
      fi
    done <<< "$STEPS"

    # Check each pattern that must match at least one checklist step (tolerant —
    # for cases where the exact step id varies but the family is what matters,
    # e.g. any "verify_*" step proving a collapsed plan)
    PATTERNS=$(jq -r '.phase2StepsContainPattern // [] | .[]' "$EXPECTED_PLAN_FILE")
    while IFS= read -r PAT; do
      [ -z "$PAT" ] && continue
      if grep -qE "^- \[[ x]\].*${PAT}" "$PLAN_MD"; then
        pass "phase2 step matching /${PAT}/ found in plan.md"
      else
        fail "no phase2 step matching /${PAT}/ found in plan.md"
      fi
    done <<< "$PATTERNS"

    # Check each step that must be ABSENT (proves a collapse/verify-only plan,
    # i.e. the skill did not re-run from-scratch setup steps)
    ABSENT_STEPS=$(jq -r '.phase2StepsAbsent // [] | .[]' "$EXPECTED_PLAN_FILE")
    while IFS= read -r STEP; do
      [ -z "$STEP" ] && continue
      if grep -qE "^- \[[ x]\] ${STEP}" "$PLAN_MD"; then
        fail "phase2 step '${STEP}' present but should be absent (expected a collapsed/verify plan)"
      else
        pass "phase2 step '${STEP}' correctly absent"
      fi
    done <<< "$ABSENT_STEPS"

    # Informational: phasesIncluded — light check that "Phase 2" or "setup" appears
    PHASES=$(jq -r '.phasesIncluded // [] | .[]' "$EXPECTED_PLAN_FILE")
    while IFS= read -r PHASE; do
      [ -z "$PHASE" ] && continue
      if grep -qi "$PHASE" "$PLAN_MD"; then
        pass "phasesIncluded '$PHASE' referenced in plan.md (informational)"
      else
        warn "phasesIncluded '$PHASE' not found in plan.md (informational)"
      fi
    done <<< "$PHASES"
  fi
fi

# ─── Verification Report ───

echo ""
echo "--- Verification Report ---"
echo "  Passed:   $PASS"
echo "  Failed:   $FAIL"
echo "  Warnings: $WARN"

if [ $FAIL -gt 0 ]; then
  exit 1
else
  exit 0
fi
