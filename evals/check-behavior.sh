#!/bin/bash
set -uo pipefail

# Usage: check-behavior.sh <project-dir> <fixture-name> [variant]
# Analyzes agent behavior by examining its output and file changes.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKDIR="${1:?Usage: check-behavior.sh <project-dir> <fixture-name> [variant]}"
FIXTURE="${2:?Usage: check-behavior.sh <project-dir> <fixture-name> [variant]}"
VARIANT="${3:-$FIXTURE}"

cd "$WORKDIR"

PASS=0
FAIL=0
WARN=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }
warn() { echo "  WARN: $1"; WARN=$((WARN + 1)); }

AGENT_OUTPUT=".eval-agent-output.txt"

if [ ! -f "$AGENT_OUTPUT" ]; then
  echo "ERROR: Agent output not found at $AGENT_OUTPUT"
  exit 1
fi

# Check if expectations file exists (git fixtures with string wrapping)
HAS_EXPECTATIONS=false
if [ -f "$SCRIPT_DIR/expectations/$FIXTURE.json" ]; then
  HAS_EXPECTATIONS=true
fi

# ─── Step Order Analysis ───

echo "--- Step Order ---"

# Check that detection happened (agent should mention detecting the framework)
if grep -q -i "detect\|package\.json\|framework\|vite\|next" "$AGENT_OUTPUT"; then
  pass "Agent performed project detection"
else
  fail "No evidence of project detection in agent output"
fi

# Check that the correct variant was identified
case "$VARIANT" in
  nextjs-app-router)
    if grep -q -i "next\|app.router" "$AGENT_OUTPUT"; then
      pass "Agent identified Next.js App Router"
    else
      fail "Agent did not identify Next.js App Router"
    fi
    ;;
  vite-swc)
    if grep -q -i "swc" "$AGENT_OUTPUT"; then
      pass "Agent identified SWC compiler"
    else
      fail "Agent did not identify SWC compiler"
    fi
    ;;
  vite-babel)
    if grep -q -i "babel" "$AGENT_OUTPUT"; then
      pass "Agent identified Babel compiler"
    else
      fail "Agent did not identify Babel compiler"
    fi
    ;;
esac

# ─── File Change Analysis ───

echo ""
echo "--- File Changes ---"

FILES_BEFORE=".eval-files-before.txt"
FILES_AFTER=".eval-files-after.txt"
BACKUP_DIR=".eval-backup"

if [ -f "$FILES_BEFORE" ] && [ -f "$FILES_AFTER" ]; then
  # New files created by the agent
  NEW_FILES=$(comm -13 "$FILES_BEFORE" "$FILES_AFTER")
  NEW_COUNT=$(echo "$NEW_FILES" | grep -c . || true)

  echo "  New files created: $NEW_COUNT"
  if [ -n "$NEW_FILES" ]; then
    echo "$NEW_FILES" | while read -r f; do echo "    + $f"; done
  fi

  # Modified files (files that existed before and were changed)
  if [ -d "$BACKUP_DIR" ]; then
    MODIFIED_FILES=$(comm -12 "$FILES_BEFORE" "$FILES_AFTER" | while read -r f; do
      if ! diff -q "$BACKUP_DIR/$f" "$f" >/dev/null 2>&1; then
        echo "$f"
      fi
    done)
    MODIFIED_COUNT=$(echo "$MODIFIED_FILES" | grep -c . || true)

    echo "  Modified files: $MODIFIED_COUNT"
    if [ -n "$MODIFIED_FILES" ]; then
      echo "$MODIFIED_FILES" | while read -r f; do echo "    ~ $f"; done
    fi
  fi

  # Check for unexpected file types in new files
  UNEXPECTED=$(echo "$NEW_FILES" | grep -v -E '\.(ts|tsx|js|jsx|json|po|mjs|d\.ts)$' | grep -v -E '(lingui|i18n|locale|messages|middleware)' || true)
  if [ -z "$UNEXPECTED" ]; then
    pass "All new files are i18n-related"
  else
    warn "Unexpected files created:"
    echo "$UNEXPECTED" | while read -r f; do echo "      ? $f"; done
  fi

  # Check that core project files weren't deleted. A file that disappears from
  # one path but reappears under another (same basename) is a MOVE — legitimate
  # during a locale restructure (e.g. app/page.tsx -> app/[locale]/page.tsx) —
  # and is reported as a warning. A basename that vanishes entirely is a real
  # deletion and fails.
  DELETED_FILES=$(comm -23 "$FILES_BEFORE" "$FILES_AFTER")
  if [ -z "$DELETED_FILES" ]; then
    pass "No original files were deleted"
  else
    REAL_DELETIONS=""
    MOVES=""
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      base=$(basename "$f")
      if grep -qF "/$base" "$FILES_AFTER"; then
        MOVES="$MOVES$f"$'\n'
      else
        REAL_DELETIONS="$REAL_DELETIONS$f"$'\n'
      fi
    done <<< "$DELETED_FILES"

    if [ -n "$MOVES" ]; then
      warn "Files moved (same basename present elsewhere — likely locale restructure):"
      echo "$MOVES" | while read -r f; do [ -n "$f" ] && echo "      ~ $f"; done
    fi
    if [ -n "$REAL_DELETIONS" ]; then
      fail "Original files were deleted:"
      echo "$REAL_DELETIONS" | while read -r f; do [ -n "$f" ] && echo "      - $f"; done
    else
      pass "No original files were truly deleted (moves only)"
    fi
  fi
else
  warn "File snapshots not available for diff analysis"
fi

# ─── Agent Output Quality ───

echo ""
echo "--- Output Quality ---"

# Check output length — higher threshold for git fixtures with expectations
OUTPUT_LINES=$(wc -l < "$AGENT_OUTPUT" | tr -d ' ')
if [ "$HAS_EXPECTATIONS" = true ]; then
  CONCISENESS_THRESHOLD=1500
else
  CONCISENESS_THRESHOLD=500
fi

if [ "$OUTPUT_LINES" -lt "$CONCISENESS_THRESHOLD" ]; then
  pass "Agent output is concise ($OUTPUT_LINES lines, threshold: $CONCISENESS_THRESHOLD)"
else
  warn "Agent output is verbose ($OUTPUT_LINES lines, threshold: $CONCISENESS_THRESHOLD)"
fi

# Check for error messages in agent output
ERROR_LINES=$(grep -c -i "error\|failed\|exception" "$AGENT_OUTPUT" || true)
if [ "$ERROR_LINES" -eq 0 ]; then
  pass "No errors in agent output"
else
  warn "Found $ERROR_LINES lines with error/failed/exception in agent output"
fi

# ─── Report ───

echo ""
echo "--- Behavior Report ---"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "  Warnings: $WARN"

if [ $FAIL -gt 0 ]; then
  exit 1
else
  exit 0
fi
