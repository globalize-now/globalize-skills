#!/bin/bash
set -uo pipefail

# Usage: ./evals/verify-skill-size.sh
#
# Static check (no model, no network) that every routed skill's SKILL.md stays small
# enough to survive harnesses that truncate the Skill tool's output.
#
# Why: a headless opencode run truncated globalize-guide's 159 KB SKILL.md after ~50 KB.
# The agent never saw Phase 2, manifest.json or a single reference, and improvised the
# Lingui setup from memory. Detail belongs in references/, loaded on demand.
#
# Checks:
#   1. Every skills/*/SKILL.md is at most LIMIT bytes (exemptions listed below, with reasons).
#   2. globalize-guide: the phase map, the reference-loading rules and the single-agent
#      fallback all sit in the first HEAD_LIMIT bytes — the part any truncation keeps.
#   3. globalize-guide: every `references/...` path named in SKILL.md or in
#      references/orchestrator/*.md exists, and every orchestrator file is reachable
#      (named by SKILL.md or by another orchestrator file).

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

LIMIT=40960       # 40 KB
HEAD_LIMIT=5120   # 5 KB

# skill-name → reason. Keep this list short; every entry is a skill a truncating harness can break.
# (A function, not an associative array: macOS ships bash 3.2.)
exempt_reason() {
  case "$1" in
    lovable-i18n) echo "platform-bundled single-file skill: the Lovable agent requires everything in one SKILL.md" ;;
    *) echo "" ;;
  esac
}

PASS=0
FAIL=0
pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }
info() { echo "  INFO: $1"; }

echo "--- 1. SKILL.md size (limit: $LIMIT bytes) ---"
for skill_md in "$REPO_ROOT"/skills/*/SKILL.md; do
  name="$(basename "$(dirname "$skill_md")")"
  size=$(wc -c < "$skill_md" | tr -d ' ')
  reason="$(exempt_reason "$name")"
  if [ -n "$reason" ]; then
    info "$name: $size bytes — exempt ($reason)"
  elif [ "$size" -le "$LIMIT" ]; then
    pass "$name: $size bytes"
  else
    fail "$name: $size bytes > $LIMIT — move detail into $name/references/ and load it on demand"
  fi
done

GUIDE="$REPO_ROOT/skills/globalize-guide"
SKILL="$GUIDE/SKILL.md"

echo ""
echo "--- 2. globalize-guide: essentials in the first $HEAD_LIMIT bytes ---"
HEAD_TEXT="$(head -c "$HEAD_LIMIT" "$SKILL")"
for marker in "### Phase map" "### How to load references" "manifest.json" "### Execution mode" "Single-agent fallback" "Read before you edit"; do
  if printf '%s' "$HEAD_TEXT" | grep -qF -- "$marker"; then
    pass "'$marker' is within the first $HEAD_LIMIT bytes"
  else
    fail "'$marker' is not within the first $HEAD_LIMIT bytes of SKILL.md"
  fi
done

echo ""
echo "--- 3. globalize-guide: reference paths resolve, orchestrator files are reachable ---"
ORCH="$GUIDE/references/orchestrator"
SOURCES=("$SKILL" "$ORCH"/*.md)
MISSING=0
while IFS= read -r ref; do
  if [ ! -f "$GUIDE/$ref" ]; then
    fail "named but missing: $ref"
    MISSING=$((MISSING + 1))
  fi
done < <(grep -ohE 'references/[A-Za-z0-9_./-]+\.md' "${SOURCES[@]}" | sort -u)
[ "$MISSING" -eq 0 ] && pass "every references/… path named by SKILL.md and the orchestrator files exists"

for f in "$ORCH"/*.md; do
  base="$(basename "$f")"
  others=()
  for s in "${SOURCES[@]}"; do [ "$s" != "$f" ] && others+=("$s"); done
  if grep -qF -- "$base" "${others[@]}"; then
    pass "orchestrator/$base is referenced"
  else
    fail "orchestrator/$base is never referenced — nothing will load it"
  fi
done

echo ""
echo "--- Report ---"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
[ "$FAIL" -eq 0 ]
