#!/bin/bash
set -euo pipefail

# Usage: ./evals/run-eval-headless.sh <fixture-name>
# Example: ./evals/run-eval-headless.sh vite5-react18-brewline
#
# Headless end-to-end eval: install the skill into a fixture, run one non-interactive agent
# prompt that pre-answers every Phase 1 question, let the agent run Phases 1–3 with no human
# in the loop, then assert the converted project with verify-lingui-conversion.sh.
#
# Unlike Layer B there is no prefill: the agent must read SKILL.md, follow it into
# references/orchestrator/ and the manifest's references, and — on a harness without
# subagents — use the single-agent fallback. That is the path a truncated SKILL.md broke.
#
# The fixture needs `headlessPrompt` and `expectedConversion` in evals/fixtures.json.
#
# Environment:
#   AGENT_CMD     Shell command that runs the agent. The prompt is in $EVAL_PROMPT.
#                 Default: claude -p "$EVAL_PROMPT" --dangerously-skip-permissions
#                 Any CLI agent works, e.g. AGENT_CMD='opencode run "$EVAL_PROMPT"'
#                 (check that agent's own flags for model selection and permissions).
#   SKILL_DIRS    Space-separated skill directories to install into, relative to the
#                 project root. Default: ".claude/skills". Add the directory your agent
#                 reads skills from if it is not Claude Code.
#   KEEP_WORKDIR  1 keeps the temp project for inspection.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FIXTURE="${1:?Usage: run-eval-headless.sh <fixture-name>}"
MANIFEST="$SCRIPT_DIR/fixtures.json"

CONFIG=$(jq -e ".\"$FIXTURE\"" "$MANIFEST" 2>/dev/null) || { echo "ERROR: fixture '$FIXTURE' not in $MANIFEST"; exit 1; }
EVAL_PROMPT=$(echo "$CONFIG" | jq -r '.headlessPrompt // empty')
[ -n "$EVAL_PROMPT" ] || { echo "ERROR: fixture '$FIXTURE' has no headlessPrompt"; exit 1; }
export EVAL_PROMPT

AGENT_CMD="${AGENT_CMD:-claude -p \"\$EVAL_PROMPT\" --dangerously-skip-permissions}"
SKILL_DIRS="${SKILL_DIRS:-.claude/skills}"

WORKDIR=$(mktemp -d)
echo "==> Work directory: $WORKDIR"
cleanup() {
  if [ "${KEEP_WORKDIR:-}" = "1" ]; then echo "==> Keeping work directory: $WORKDIR"; else rm -rf "$WORKDIR"; fi
}
trap cleanup EXIT

"$SCRIPT_DIR/helpers/prepare-workdir.sh" "$FIXTURE" "$WORKDIR"

cd "$WORKDIR"
echo "==> Installing baseline dependencies"
if [ -f package-lock.json ]; then npm ci --no-audit --no-fund > /dev/null; else npm install --no-audit --no-fund > /dev/null; fi

# A git baseline: the skill's gitignore steps expect a repo, and it makes the agent's diff reviewable.
git init -q
git add -A
git -c user.name=eval -c user.email=eval@localhost commit -qm "fixture baseline"

for dir in $SKILL_DIRS; do
  echo "==> Installing skill into $dir/globalize-guide"
  mkdir -p "$dir/globalize-guide"
  cp -R "$REPO_ROOT/skills/globalize-guide/." "$dir/globalize-guide/"
done

echo "==> Running agent: $AGENT_CMD"
bash -c "$AGENT_CMD" > .eval-agent-output.txt 2>&1 || echo "==> Agent exited non-zero (continuing to verification)"
echo "==> Agent transcript: $WORKDIR/.eval-agent-output.txt"

echo ""
echo "============================================"
echo "  VERIFICATION: globalize-guide / $FIXTURE (headless)"
echo "============================================"
"$SCRIPT_DIR/verify-lingui-conversion.sh" "$WORKDIR" "$FIXTURE" "$WORKDIR/.eval-agent-output.txt"
