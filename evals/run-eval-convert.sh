#!/bin/bash
set -euo pipefail

# Usage: ./evals/run-eval-convert.sh <fixture-name>
# Example: ./evals/run-eval-convert.sh vite-swc
#
# Runs lingui-setup + lingui-convert against a fixture project,
# then verifies infrastructure, string wrapping, and translation quality.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

FIXTURE="${1:?Usage: run-eval-convert.sh <fixture-name>}"

SETUP_SKILL_PATH="$REPO_ROOT/skills/lingui/setup"
CONVERT_SKILL_PATH="$REPO_ROOT/skills/lingui/convert"
MANIFEST="$SCRIPT_DIR/fixtures.json"

if [ ! -d "$SETUP_SKILL_PATH" ]; then
  echo "ERROR: lingui/setup skill not found: $SETUP_SKILL_PATH"
  exit 1
fi

if [ ! -d "$CONVERT_SKILL_PATH" ]; then
  echo "ERROR: lingui/convert skill not found: $CONVERT_SKILL_PATH"
  exit 1
fi

if [ ! -f "$MANIFEST" ]; then
  echo "ERROR: Fixture manifest not found: $MANIFEST"
  exit 1
fi

# Read fixture config from manifest
FIXTURE_CONFIG=$(jq -e ".\"$FIXTURE\"" "$MANIFEST" 2>/dev/null) || {
  echo "ERROR: Fixture '$FIXTURE' not found in $MANIFEST"
  exit 1
}

FIXTURE_TYPE=$(echo "$FIXTURE_CONFIG" | jq -r '.type')
VARIANT=$(echo "$FIXTURE_CONFIG" | jq -r '.variant')

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
echo "==> Preparing fixture: $FIXTURE (type: $FIXTURE_TYPE, variant: $VARIANT)"

if [ "$FIXTURE_TYPE" = "local" ]; then
  FIXTURE_PATH="$REPO_ROOT/$(echo "$FIXTURE_CONFIG" | jq -r '.path')"
  if [ ! -d "$FIXTURE_PATH" ]; then
    echo "ERROR: Fixture not found: $FIXTURE_PATH"
    exit 1
  fi
  cp -R "$FIXTURE_PATH/." "$WORKDIR/"
elif [ "$FIXTURE_TYPE" = "git" ]; then
  REPO_URL=$(echo "$FIXTURE_CONFIG" | jq -r '.repo')
  COMMIT=$(echo "$FIXTURE_CONFIG" | jq -r '.commit')
  echo "==> Cloning $REPO_URL at $COMMIT"
  git clone "$REPO_URL" "$WORKDIR" 2>&1 | tail -3
  cd "$WORKDIR"
  git checkout "$COMMIT" 2>&1 | tail -1
else
  echo "ERROR: Unknown fixture type: $FIXTURE_TYPE"
  exit 1
fi

# 2. Install both skills
echo "==> Installing skill: lingui-setup"
mkdir -p "$WORKDIR/.claude/skills/lingui-setup"
cp -R "$SETUP_SKILL_PATH/." "$WORKDIR/.claude/skills/lingui-setup/"

echo "==> Installing skill: lingui-convert"
mkdir -p "$WORKDIR/.claude/skills/lingui-convert"
cp -R "$CONVERT_SKILL_PATH/." "$WORKDIR/.claude/skills/lingui-convert/"

# 3. Install dependencies
echo "==> Installing dependencies..."
cd "$WORKDIR"
npm install --silent 2>&1 | tail -3

# 4. Snapshot file list before agent runs
find . -type f -not -path './node_modules/*' -not -path './.claude/*' -not -path './.git/*' | sort > .eval-files-before.txt

# 5. Pre-agent backup
echo "==> Creating pre-agent backup..."
mkdir -p .eval-backup
rsync -a --exclude='node_modules' --exclude='.claude' --exclude='.git' --exclude='.eval-backup' --exclude='.eval-files-before.txt' . .eval-backup/

# 6. Run the agent with combined setup + convert prompt
echo "==> Running Claude Code agent..."
PROMPT="Set up LinguiJS i18n in this project with English (en) as source locale and Spanish (es) and French (fr) as target locales. Then wrap all user-facing strings with Lingui macros."

AGENT_OUTPUT=$(claude -p "$PROMPT" --dangerously-skip-permissions 2>&1) || true
echo "$AGENT_OUTPUT" > .eval-agent-output.txt
echo "==> Agent output saved to .eval-agent-output.txt"

# 7. Snapshot file list after agent runs
find . -type f -not -path './node_modules/*' -not -path './.claude/*' -not -path './.git/*' | sort > .eval-files-after.txt

# 8. Run infrastructure verification
echo ""
echo "============================================"
echo "  VERIFICATION: lingui/convert / $FIXTURE"
echo "============================================"
echo ""

"$SCRIPT_DIR/verify-lingui-setup.sh" "$WORKDIR" "$FIXTURE" "$VARIANT"
VERIFY_EXIT=$?

# 9. Run string-wrapping verification (if expectations exist)
STRING_EXIT=0
EXPECTATIONS="$SCRIPT_DIR/expectations/$FIXTURE.json"
if [ -f "$EXPECTATIONS" ]; then
  echo ""
  echo "============================================"
  echo "  STRING WRAPPING: lingui/convert / $FIXTURE"
  echo "============================================"
  echo ""

  "$SCRIPT_DIR/verify-string-wrapping.sh" "$WORKDIR" "$FIXTURE"
  STRING_EXIT=$?
fi

# 10. Run translation quality verification
echo ""
echo "============================================"
echo "  TRANSLATE QUALITY: lingui/convert / $FIXTURE"
echo "============================================"
echo ""

"$SCRIPT_DIR/verify-translate.sh" "$WORKDIR" "$FIXTURE"
TRANSLATE_EXIT=$?

# Summary
echo ""
echo "============================================"
echo "  SUMMARY: lingui/convert / $FIXTURE"
echo "============================================"
if [ $VERIFY_EXIT -eq 0 ] && [ $STRING_EXIT -eq 0 ] && [ $TRANSLATE_EXIT -eq 0 ]; then
  echo "  RESULT: PASS"
else
  echo "  RESULT: FAIL"
  [ $VERIFY_EXIT -ne 0 ] && echo "  - Verification checks failed"
  [ $STRING_EXIT -ne 0 ] && echo "  - String wrapping checks failed"
  [ $TRANSLATE_EXIT -ne 0 ] && echo "  - Translation quality checks failed"
fi
echo "============================================"

exit $(( VERIFY_EXIT + STRING_EXIT + TRANSLATE_EXIT ))
