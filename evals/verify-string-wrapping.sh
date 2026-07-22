#!/bin/bash
set -uo pipefail

# Usage: verify-string-wrapping.sh <project-dir> <fixture-name>
# Verifies that the agent wrapped hardcoded UI strings with Lingui macros.
# Only runs when an expectations file exists at evals/expectations/<fixture-name>.json.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKDIR="${1:?Usage: verify-string-wrapping.sh <project-dir> <fixture-name>}"
FIXTURE="${2:?Usage: verify-string-wrapping.sh <project-dir> <fixture-name>}"

EXPECTATIONS="$SCRIPT_DIR/expectations/$FIXTURE.json"

if [ ! -f "$EXPECTATIONS" ]; then
  echo "No expectations file for $FIXTURE — skipping string-wrapping checks"
  exit 0
fi

cd "$WORKDIR"

PASS=0
FAIL=0
WARN=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }
warn() { echo "  WARN: $1"; WARN=$((WARN + 1)); }

echo "--- Check 1: Specific String Wrapping ---"

WRAPPED_COUNT=$(jq '.wrapped_strings | length' "$EXPECTATIONS")

for i in $(seq 0 $((WRAPPED_COUNT - 1))); do
  FILE=$(jq -r ".wrapped_strings[$i].file" "$EXPECTATIONS")
  ORIGINAL=$(jq -r ".wrapped_strings[$i].original" "$EXPECTATIONS")

  if [ ! -f "$FILE" ]; then
    warn "File not found: $FILE (may have been moved)"
    continue
  fi

  # Check if the string appears in the file
  if grep -qF "$ORIGINAL" "$FILE"; then
    # String is present — check if it's inside a Lingui wrapper
    # Look for Trans, t(, msg(, defineMessage on the same line or surrounding context
    CONTEXT=$(grep -nF "$ORIGINAL" "$FILE" | head -5)
    if echo "$CONTEXT" | grep -qE '(<Trans|<Plural|<Select|useLingui|t\(|t`|msg\(|msg`|defineMessage)'; then
      pass "\"$ORIGINAL\" in $FILE is wrapped"
    else
      fail "\"$ORIGINAL\" in $FILE appears bare (no Lingui wrapper)"
    fi
  else
    # String no longer appears — may have been moved to catalog or restructured
    warn "\"$ORIGINAL\" not found in $FILE (may have been restructured)"
  fi
done

echo ""
echo "--- Check 2: Breadth ---"

MIN_FILES=$(jq '.min_files_with_trans' "$EXPECTATIONS")
TRANS_FILES=$(grep -rlE '(Trans|useLingui|t\()' --include='*.ts' --include='*.tsx' src/ 2>/dev/null | wc -l | tr -d ' ')

if [ "$TRANS_FILES" -ge "$MIN_FILES" ]; then
  pass "Files with Lingui usage: $TRANS_FILES (threshold: $MIN_FILES)"
else
  fail "Files with Lingui usage: $TRANS_FILES (threshold: $MIN_FILES)"
fi

echo ""
echo "--- Check 3: Catalog Depth ---"

MIN_MESSAGES=$(jq '.min_extracted_messages' "$EXPECTATIONS")

echo "  Running lingui extract --clean..."
npx lingui extract --clean 2>&1 | tail -3

# Count non-header msgid entries in .po files
MSGID_COUNT=$(find . -name "*.po" -not -path './node_modules/*' -exec grep -c '^msgid ' {} + 2>/dev/null | awk -F: '{sum += $NF} END {print sum+0}')
# Subtract header entries (one msgid "" per .po file)
PO_FILE_COUNT=$(find . -name "*.po" -not -path './node_modules/*' | wc -l | tr -d ' ')
ACTUAL_MESSAGES=$((MSGID_COUNT - PO_FILE_COUNT))

if [ "$ACTUAL_MESSAGES" -ge "$MIN_MESSAGES" ]; then
  pass "Extracted messages: $ACTUAL_MESSAGES (threshold: $MIN_MESSAGES)"
else
  fail "Extracted messages: $ACTUAL_MESSAGES (threshold: $MIN_MESSAGES)"
fi

# ─── Report ───

echo ""
echo "--- String Wrapping Report ---"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "  Warnings: $WARN"

if [ $FAIL -gt 0 ]; then
  exit 1
else
  exit 0
fi
