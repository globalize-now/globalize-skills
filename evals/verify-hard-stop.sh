#!/bin/bash
set -uo pipefail

# Usage: verify-hard-stop.sh <workdir> <fixture>
#
# Verifies Layer A (orchestration) output for hard-stop fixtures:
# Confirms the skill detected an incompatible stack and refused to plan,
# without touching dependencies.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

WORKDIR="${1:?Usage: verify-hard-stop.sh <workdir> <fixture>}"
FIXTURE="${2:?Usage: verify-hard-stop.sh <workdir> <fixture>}"

MANIFEST="$SCRIPT_DIR/fixtures.json"

PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

FIXTURE_CONFIG=$(jq -e ".\"$FIXTURE\"" "$MANIFEST" 2>/dev/null) || {
  echo "ERROR: Fixture '$FIXTURE' not found in $MANIFEST"
  exit 1
}

# Resolve expectedHardStop path (relative to repo root)
EXPECTED_HARD_STOP_REL=$(echo "$FIXTURE_CONFIG" | jq -r '.expectedHardStop // empty')

# ─── Layer A: Hard-Stop ───

echo ""
echo "--- Layer A: Hard-Stop ---"

if [ -z "$EXPECTED_HARD_STOP_REL" ]; then
  echo "  NOTE: No expectedHardStop path in fixtures.json for '$FIXTURE' — cannot run hard-stop checks"
  echo ""
  echo "--- Verification Report ---"
  echo "  Passed:   $PASS"
  echo "  Failed:   $FAIL"
  exit 0
fi

EXPECTED_HARD_STOP_FILE="$REPO_ROOT/$EXPECTED_HARD_STOP_REL"

if [ ! -f "$EXPECTED_HARD_STOP_FILE" ]; then
  echo "  NOTE: expectedHardStop file not yet authored: $EXPECTED_HARD_STOP_FILE — skipping checks"
  echo ""
  echo "--- Verification Report ---"
  echo "  Passed:   $PASS"
  echo "  Failed:   $FAIL"
  exit 0
fi

SPEC=$(cat "$EXPECTED_HARD_STOP_FILE")

# Check mustCreate: these paths must exist under workdir
while IFS= read -r REL_PATH; do
  [ -z "$REL_PATH" ] && continue
  if [ -e "$WORKDIR/$REL_PATH" ]; then
    pass "mustCreate: $REL_PATH exists"
  else
    fail "mustCreate: $REL_PATH does not exist (expected the skill to write it)"
  fi
done < <(echo "$SPEC" | jq -r '.mustCreate // [] | .[]')

# Check mustNotCreate: these paths must NOT exist under workdir
while IFS= read -r REL_PATH; do
  [ -z "$REL_PATH" ] && continue
  if [ ! -e "$WORKDIR/$REL_PATH" ]; then
    pass "mustNotCreate: $REL_PATH correctly absent"
  else
    fail "mustNotCreate: $REL_PATH exists but should not (skill advanced past hard-stop)"
  fi
done < <(echo "$SPEC" | jq -r '.mustNotCreate // [] | .[]')

# Check messageContains: agent output must contain the expected message (case-insensitive)
MESSAGE_CONTAINS=$(echo "$SPEC" | jq -r '.messageContains // empty')
AGENT_OUTPUT="$WORKDIR/.eval-agent-output.txt"

if [ -n "$MESSAGE_CONTAINS" ]; then
  if [ ! -f "$AGENT_OUTPUT" ]; then
    fail "messageContains: agent output file not found at $AGENT_OUTPUT"
  elif grep -qi -F "$MESSAGE_CONTAINS" "$AGENT_OUTPUT"; then
    pass "messageContains: '$MESSAGE_CONTAINS' found in agent output"
  else
    fail "messageContains: '$MESSAGE_CONTAINS' not found in agent output"
  fi
fi

# Check depsMustBeUnchanged: package.json must not have been modified
DEPS_MUST_BE_UNCHANGED=$(echo "$SPEC" | jq -r '.depsMustBeUnchanged // false')
if [ "$DEPS_MUST_BE_UNCHANGED" = "true" ]; then
  BACKUP_PKG="$WORKDIR/.eval-backup/package.json"
  CURRENT_PKG="$WORKDIR/package.json"
  if [ ! -f "$BACKUP_PKG" ]; then
    fail "depsMustBeUnchanged: backup package.json not found at $BACKUP_PKG — was it backed up?"
  elif [ ! -f "$CURRENT_PKG" ]; then
    fail "depsMustBeUnchanged: current package.json not found at $CURRENT_PKG"
  elif diff -q "$CURRENT_PKG" "$BACKUP_PKG" > /dev/null 2>&1; then
    pass "depsMustBeUnchanged: package.json unchanged (no install ran)"
  else
    fail "depsMustBeUnchanged: package.json was modified (diff follows):"
    diff "$BACKUP_PKG" "$CURRENT_PKG" || true
  fi
fi

# ─── Verification Report ───

echo ""
echo "--- Verification Report ---"
echo "  Passed:   $PASS"
echo "  Failed:   $FAIL"

if [ $FAIL -gt 0 ]; then
  exit 1
else
  exit 0
fi
