#!/bin/bash
set -euo pipefail

# Usage: ./evals/run-eval-layer-a.sh <fixture-name>
# Example: ./evals/run-eval-layer-a.sh nextjs-app-router-lingui
#
# Layer A harness: runs the i18n-guide skill through Phase 1 only.
# No package installs, no setup execution. Tests:
#   - positive/collapse fixtures: framework detection + plan generation
#   - hard-stop fixtures: compatibility check refusal (no plan written)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

FIXTURE="${1:?Usage: run-eval-layer-a.sh <fixture-name>}"

MANIFEST="$SCRIPT_DIR/fixtures.json"

if [ ! -f "$MANIFEST" ]; then
  echo "ERROR: Fixture manifest not found: $MANIFEST"
  exit 1
fi

# Read fixture config from manifest
FIXTURE_CONFIG=$(jq -e ".\"$FIXTURE\"" "$MANIFEST" 2>/dev/null) || {
  echo "ERROR: Fixture '$FIXTURE' not found in $MANIFEST"
  exit 1
}

CATEGORY=$(echo "$FIXTURE_CONFIG" | jq -r '.category')
LIBRARY=$(echo "$FIXTURE_CONFIG" | jq -r '.library // empty')
VARIANT=$(echo "$FIXTURE_CONFIG" | jq -r '.variant // empty')

echo "==> Fixture: $FIXTURE"
echo "==> Category: $CATEGORY"
echo "==> Library: ${LIBRARY:-<none>}"
echo "==> Variant: ${VARIANT:-<none>}"

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

# 1. Prepare fixture in workdir
echo ""
echo "--- Preparing Fixture ---"
"$SCRIPT_DIR/helpers/prepare-workdir.sh" "$FIXTURE" "$WORKDIR"

# 2. Install i18n-guide skill
echo ""
echo "--- Installing Skill ---"
mkdir -p "$WORKDIR/.claude/skills/i18n-guide"
cp -R "$REPO_ROOT/skills/i18n-guide/." "$WORKDIR/.claude/skills/i18n-guide/"
echo "==> Skill installed: i18n-guide"

# 3. Back up package.json (for hard-stop deps-unchanged check)
mkdir -p "$WORKDIR/.eval-backup"
if [ -f "$WORKDIR/package.json" ]; then
  cp "$WORKDIR/package.json" "$WORKDIR/.eval-backup/package.json"
  echo "==> package.json backed up to .eval-backup/"
else
  echo "==> WARN: package.json not found in fixture; skipping backup"
fi

# 4. Build the Layer-A prompt
echo ""
echo "--- Building Prompt ---"

if [ "$CATEGORY" = "positive" ] || [ "$CATEGORY" = "collapse" ]; then
  PROMPT="Use the i18n-guide skill on this project. Library: ${LIBRARY}. Source locale: en. Target locales: es, fr. Stay on the current branch. Scope: setup only (not convert or globalize-now). Mode: guided. Routing strategy: prefix-based. Optional add-ons: none. Run through Phase 1 fully and stop once .globalize/plan.md is generated. Do not advance to Phase 2 — do not install any packages."
elif [ "$CATEGORY" = "hard-stop" ]; then
  PROMPT="Use the i18n-guide skill to set up internationalization in this project. Run the initial inspection and tell me what you find."
else
  echo "ERROR: Unknown fixture category: $CATEGORY"
  exit 1
fi

echo "==> Prompt built for category: $CATEGORY"

# 5. Run the agent
echo ""
echo "--- Running Agent ---"
echo "==> cd $WORKDIR"
cd "$WORKDIR"

echo "==> Running claude -p ... (output tee'd to .eval-agent-output.txt)"
{ claude -p "$PROMPT" --dangerously-skip-permissions 2>&1 || true; } | tee "$WORKDIR/.eval-agent-output.txt"
echo ""
echo "==> Agent finished. Output saved to .eval-agent-output.txt"

# 6. Dispatch verification
echo ""
echo "--- Dispatching Verification ---"

VERIFY_EXIT=0
if [ "$CATEGORY" = "positive" ] || [ "$CATEGORY" = "collapse" ]; then
  "$SCRIPT_DIR/verify-orchestration.sh" "$WORKDIR" "$FIXTURE" || VERIFY_EXIT=$?
elif [ "$CATEGORY" = "hard-stop" ]; then
  "$SCRIPT_DIR/verify-hard-stop.sh" "$WORKDIR" "$FIXTURE" || VERIFY_EXIT=$?
fi

# 7. Summary
echo ""
echo "============================================"
echo "  SUMMARY: $FIXTURE"
echo "============================================"
if [ $VERIFY_EXIT -eq 0 ]; then
  echo "  RESULT: PASS"
else
  echo "  RESULT: FAIL"
fi
echo "============================================"

exit $VERIFY_EXIT
