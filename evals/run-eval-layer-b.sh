#!/bin/bash
set -euo pipefail

# Usage: ./evals/run-eval-layer-b.sh <fixture-name>
# Example: ./evals/run-eval-layer-b.sh nextjs-app-router-lingui
#
# Layer B: end-to-end test of the i18n-guide skill.
# Populates a fixture workdir, injects a prefill into .globalize/, and invokes
# the skill with a "resume" prompt so it skips Phase 1 and runs Phase 2 to
# completion. Then verifies the result with three checks: library setup,
# behavior, and (if expectations exist) string wrapping.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

FIXTURE="${1:?Usage: run-eval-layer-b.sh <fixture-name>}"

MANIFEST="$SCRIPT_DIR/fixtures.json"

if [ ! -f "$MANIFEST" ]; then
  echo "ERROR: Fixture manifest not found: $MANIFEST"
  exit 1
fi

FIXTURE_CONFIG=$(jq -e ".\"$FIXTURE\"" "$MANIFEST" 2>/dev/null) || {
  echo "ERROR: Fixture '$FIXTURE' not found in $MANIFEST"
  exit 1
}

LIBRARY=$(echo "$FIXTURE_CONFIG" | jq -r '.library // empty')
VARIANT=$(echo "$FIXTURE_CONFIG" | jq -r '.variant // empty')
PREFILL=$(echo "$FIXTURE_CONFIG" | jq -r '.prefill // empty')

if [ -z "$PREFILL" ]; then
  echo "ERROR: Fixture '$FIXTURE' has no prefill — Layer B (MVP) only supports prefilled fixtures"
  exit 1
fi

# Create temp working directory
WORKDIR=$(mktemp -d)
echo "==> Work directory: $WORKDIR"

cleanup() {
  if [ "${KEEP_WORKDIR:-}" = "1" ]; then
    echo "==> Keeping work directory: $WORKDIR"
  else
    rm -rf "$WORKDIR"
  fi
}
trap cleanup EXIT

# 1. Prepare fixture in temp directory
echo "==> Preparing fixture: $FIXTURE (library: $LIBRARY, variant: $VARIANT)"
"$SCRIPT_DIR/helpers/prepare-workdir.sh" "$FIXTURE" "$WORKDIR"

# 2. Install i18n-guide skill
echo "==> Installing skill: i18n-guide"
mkdir -p "$WORKDIR/.claude/skills/i18n-guide"
cp -R "$REPO_ROOT/skills/i18n-guide/." "$WORKDIR/.claude/skills/i18n-guide/"

# 3. Copy prefill into .globalize/ (so skill resumes at Phase 2)
echo "==> Injecting prefill: $PREFILL"
mkdir -p "$WORKDIR/.globalize"
cp -R "$REPO_ROOT/$PREFILL/." "$WORKDIR/.globalize/"

# 4. Install dependencies
echo "==> Installing dependencies..."
cd "$WORKDIR"
npm install --silent 2>&1 | tail -3 || true

# 5. Snapshot file list before agent runs (for behavior analysis)
find . -type f \
  -not -path './node_modules/*' \
  -not -path './.claude/*' \
  -not -path './.git/*' \
  -not -path './.globalize/*' \
  -not -path './.next/*' \
  | sort > .eval-files-before.txt

# 6. Pre-agent backup (for modified-file detection)
echo "==> Creating pre-agent backup..."
mkdir -p .eval-backup
rsync -a \
  --exclude='node_modules' \
  --exclude='.claude' \
  --exclude='.git' \
  --exclude='.eval-backup' \
  --exclude='.globalize' \
  --exclude='.eval-files-before.txt' \
  . .eval-backup/

# 7. Run the agent
echo "==> Running Claude Code agent (Layer B — Phase 2 resume)..."
PROMPT="Resume the in-progress i18n setup at .globalize/. The plan is approved. Proceed to Phase 2 immediately and run it to completion. Do not ask for confirmation."

claude -p "$PROMPT" --dangerously-skip-permissions > .eval-agent-output.txt 2>&1 || true
echo "==> Agent output saved to .eval-agent-output.txt"

# 8. Snapshot file list after agent runs
find . -type f \
  -not -path './node_modules/*' \
  -not -path './.claude/*' \
  -not -path './.git/*' \
  -not -path './.globalize/*' \
  -not -path './.next/*' \
  | sort > .eval-files-after.txt

# 9. Run verification
echo ""
echo "============================================"
echo "  VERIFICATION: i18n-guide / $FIXTURE"
echo "============================================"
echo ""

VERIFY_EXIT=0
"$SCRIPT_DIR/verify-setup.sh" "$WORKDIR" "$FIXTURE" || VERIFY_EXIT=$?

# 10. Run behavior checks
echo ""
echo "============================================"
echo "  BEHAVIOR: i18n-guide / $FIXTURE"
echo "============================================"
echo ""

BEHAVIOR_EXIT=0
"$SCRIPT_DIR/check-behavior.sh" "$WORKDIR" "$FIXTURE" "$VARIANT" || BEHAVIOR_EXIT=$?

# 11. Run string-wrapping verification (if expectations exist)
STRING_EXIT=0
EXPECTATIONS="$SCRIPT_DIR/expectations/$FIXTURE.json"
if [ -f "$EXPECTATIONS" ]; then
  echo ""
  echo "============================================"
  echo "  STRING WRAPPING: i18n-guide / $FIXTURE"
  echo "============================================"
  echo ""

  "$SCRIPT_DIR/verify-string-wrapping.sh" "$WORKDIR" "$FIXTURE" || STRING_EXIT=$?
fi

# Summary
echo ""
echo "============================================"
echo "  SUMMARY: i18n-guide / $FIXTURE"
echo "============================================"
if [ $VERIFY_EXIT -eq 0 ] && [ $BEHAVIOR_EXIT -eq 0 ] && [ $STRING_EXIT -eq 0 ]; then
  echo "  RESULT: PASS"
else
  echo "  RESULT: FAIL"
  [ $VERIFY_EXIT -ne 0 ]   && echo "  - Verification checks failed"
  [ $BEHAVIOR_EXIT -ne 0 ] && echo "  - Behavior checks failed"
  [ $STRING_EXIT -ne 0 ]   && echo "  - String wrapping checks failed"
fi
echo "============================================"

exit $(( VERIFY_EXIT + BEHAVIOR_EXIT + STRING_EXIT ))
