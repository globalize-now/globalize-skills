#!/bin/bash
set -uo pipefail

# Usage: ./evals/verify-existing-i18n.sh
#
# Static check (no model, no network) of the guard that stops globalize-guide from
# running its from-scratch setup over a project that already has i18n (issue #24: a
# Next.js + next-intl app got a ~200-file diff of moves and deletes). Each check is a
# tripwire for one piece of prose the guard depends on.
#
# Checks:
#   1. SKILL.md runs §1.2b before the library question, loads existing-i18n.md, and
#      states the cross-phase rule.
#   2. existing-i18n.md offers connect / extend / replace, never recommends replace,
#      never lets a headless run pick it, and carries the workers' change contract.
#   3. Detection fills existing.present / signals / catalogs / localeRouting on every
#      language, and doesn't require next-intl's plugin on the Pages Router.
#   4. Setup and wrap workers load the change contract; both Next.js App Router
#      restructures (the [locale] file moves) are gated off on the extend path.
#   5. An unsupported existing library is offered connect before the run stops.
#   6. The eval fixtures for the guard are wired.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
GUIDE="$REPO_ROOT/skills/globalize-guide"
ORCH="$GUIDE/references/orchestrator"
EXISTING="$ORCH/existing-i18n.md"

PASS=0
FAIL=0
pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

# contains <file> <literal> <what>
contains() {
  if [ -f "$1" ] && grep -qF -- "$2" "$1"; then pass "$3"; else fail "$3 (missing in ${1#"$REPO_ROOT"/}: '$2')"; fi
}

echo "--- 1. SKILL.md: §1.2b runs before any library or scope question ---"
contains "$GUIDE/SKILL.md" '### 1.2b Existing i18n — choose the path' "SKILL.md has §1.2b"
contains "$GUIDE/SKILL.md" 'references/orchestrator/existing-i18n.md' "SKILL.md loads existing-i18n.md"
contains "$GUIDE/SKILL.md" '`replace` is never the default' "SKILL.md: replace is never the default"
contains "$GUIDE/SKILL.md" '**A project that already has i18n is never set up from scratch unless the user chose that.**' "SKILL.md states the cross-phase rule"
L12B=$(grep -n '^### 1.2b ' "$GUIDE/SKILL.md" | cut -d: -f1)
L15=$(grep -n '^### 1.5 ' "$GUIDE/SKILL.md" | cut -d: -f1)
if [ -n "$L12B" ] && [ -n "$L15" ] && [ "$L12B" -lt "$L15" ]; then
  pass "§1.2b comes before §1.5 library choice"
else
  fail "§1.2b must come before §1.5 library choice"
fi

echo ""
echo "--- 2. existing-i18n.md: three paths, safe defaults, change contract ---"
for marker in '`connect`' '`extend`' '`replace`' '`replace` is never recommended.' \
              'Never pick `replace` without the user'"'"'s explicit words.' \
              'is **not** a request for the full setup' '## Change contract (workers)' \
              'Never move, rename or delete a file that existed before the run.' \
              'Existing catalogs are append-only.' 'Routing is **not asked**' 'Footprint'; do
  contains "$EXISTING" "$marker" "existing-i18n.md names '$marker'"
done

echo ""
echo "--- 3. Detection: existing-i18n evidence on every language ---"
for field in '"present": true | false' '"signals": [' '"catalogs": {' '"localeRouting":' '"other"'; do
  contains "$ORCH/inspect.md" "$field" "inspect.md schema has $field"
done
for lang in js-ts ruby android swift; do
  contains "$ORCH/detect.$lang.md" '`existing.signals`' "detect.$lang.md defines existing.signals"
  contains "$ORCH/detect.$lang.md" '`existing.catalogs`' "detect.$lang.md defines existing.catalogs"
done
contains "$ORCH/detect.js-ts.md" '`existing.localeRouting`' "detect.js-ts.md defines existing.localeRouting"
contains "$ORCH/detect.js-ts.md" 'a missing plugin there does **not** make the project unconfigured' "next-intl Pages Router isn't marked unconfigured for lacking the plugin"

echo ""
echo "--- 4. Workers follow the change contract; [locale] moves are gated ---"
contains "$ORCH/setup-subagent.md" 'references/orchestrator/existing-i18n.md' "setup worker loads the change contract"
contains "$ORCH/wrap-subagent.md" 'references/orchestrator/existing-i18n.md' "wrap worker loads the change contract"
contains "$ORCH/setup-collapse.md" 'existing-i18n.md' "collapse plan follows the change contract"
for ref in nextjs/app-router/next-intl.setup.md nextjs/app-router/lingui.setup.md; do
  contains "$GUIDE/references/languages/js-ts/frameworks/$ref" 'this restructure **never runs**' "$ref gates the [locale] restructure on extend"
  contains "$GUIDE/references/languages/js-ts/frameworks/$ref" 'Unguided mode does **not** waive this consent' "$ref keeps move consent in unguided mode"
done

echo ""
echo "--- 5. Unsupported existing library: connect offered before stopping ---"
ROW=$(grep -F '`@ngx-translate/core`, `other` |' "$ORCH/compat.js-ts.md" || true)
if [ -n "$ROW" ] && printf '%s' "$ROW" | grep -qF 'Not a stop by itself.'; then
  pass "compat.js-ts.md routes unsupported libraries to §1.2b"
else
  fail "compat.js-ts.md must route unsupported libraries (incl. 'other') to §1.2b, not stop outright"
fi
contains "$REPO_ROOT/skills/globalize-now-project-setup/SKILL.md" '**When `patterns` is absent or empty**' "project setup handles an unresolved pattern in orchestrated mode"

echo ""
echo "--- 6. Eval fixtures ---"
FIXTURES="$SCRIPT_DIR/fixtures.json"
for fx in existing-next-intl-wrapped existing-vite-diy-json nextjs-app-router-next-intl-configured; do
  if ! jq -e --arg f "$fx" '.[$f]' "$FIXTURES" >/dev/null 2>&1; then
    fail "fixture '$fx' missing from fixtures.json"; continue
  fi
  for key in overlay expectedDetection expectedPlan; do
    rel=$(jq -r --arg f "$fx" --arg k "$key" '.[$f][$k] // empty' "$FIXTURES")
    if [ -n "$rel" ] && [ -e "$REPO_ROOT/$rel" ]; then pass "$fx.$key exists"; else fail "$fx.$key missing ($rel)"; fi
  done
done
for fx in existing-next-intl-wrapped existing-vite-diy-json; do
  plan=$(jq -r --arg f "$fx" '.[$f].expectedPlan' "$FIXTURES")
  if jq -e '(.planSectionsAbsent | index("## Phase 2")) and (.decisionsSections["Existing i18n"] | test("Connect"))' "$REPO_ROOT/$plan" >/dev/null 2>&1; then
    pass "$fx expects a connect-only plan with no Phase 2"
  else
    fail "$fx must expect a connect-only plan with no Phase 2"
  fi
done

echo ""
echo "--- Report ---"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
[ "$FAIL" -eq 0 ]
