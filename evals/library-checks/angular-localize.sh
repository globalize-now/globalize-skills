#!/bin/bash
set -uo pipefail

# Usage: angular-localize.sh <project-dir> <fixture-name> [variant]
# Per-library verifier (dispatched by verify-setup.sh) for @angular/localize setups.
# Runs SKILL.md §3.5's Angular checks: extraction (no duplicate IDs), a description
# on every unit, one runtime JSON per target XLIFF, a passing build, and no static
# ./app/ import in src/main.ts. The format module is checked separately by
# verify-format-helpers.sh --project.

WORKDIR="${1:?Usage: angular-localize.sh <project-dir> <fixture-name> [variant]}"
FIXTURE="${2:?Usage: angular-localize.sh <project-dir> <fixture-name> [variant]}"
cd "$WORKDIR" || exit 2

PASS=0; FAIL=0; WARN=0
pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }
warn() { echo "  WARN: $1"; WARN=$((WARN + 1)); }

echo "--- angular-localize: $FIXTURE ---"

[ -f angular.json ] || { fail "angular.json missing"; echo "  Passed: $PASS  Failed: $FAIL"; exit 1; }

APP=$(jq -r '[.projects | to_entries[] | select(.value.projectType == "application") | .key][0] // empty' angular.json)
SRC=$(jq -r --arg p "$APP" '.projects[$p].i18n.sourceLocale // empty' angular.json)
OUTPATH=$(jq -r --arg p "$APP" '.projects[$p].architect["extract-i18n"].options.outputPath // "src/locale"' angular.json)
OUTFILE=$(jq -r --arg p "$APP" --arg s "$SRC" '.projects[$p].architect["extract-i18n"].options.outFile // ("messages." + $s + ".xlf")' angular.json)
FORMAT=$(jq -r --arg p "$APP" '.projects[$p].architect["extract-i18n"].options.format // empty' angular.json)
CATALOG="$OUTPATH/$OUTFILE"

[ -n "$SRC" ] && pass "i18n.sourceLocale = $SRC" || fail "angular.json has no i18n.sourceLocale for '$APP'"
case "$FORMAT" in xlf2|xliff2) pass "extract-i18n format = $FORMAT" ;; *) fail "extract-i18n format is '$FORMAT', expected xlf2" ;; esac

# 1. Extraction: exit 0, no duplicate-ID warning.
OUT=$(npm run --silent i18n:extract 2>&1); RC=$?
if [ $RC -ne 0 ]; then fail "npm run i18n:extract exited $RC"
elif printf '%s' "$OUT" | grep -qi 'duplicate'; then fail "i18n:extract reported duplicate message IDs"
else pass "i18n:extract clean"; fi

# 2. Every unit in the source XLIFF has a description note.
if [ ! -f "$CATALOG" ]; then
  fail "source catalog missing at $CATALOG"
else
  MISSING=$(python3 - "$CATALOG" <<'PY'
import sys, xml.etree.ElementTree as ET
ns = {"x": "urn:oasis:names:tc:xliff:document:2.0"}
root = ET.parse(sys.argv[1]).getroot()
units = root.findall(".//x:unit", ns)
bad = [u.get("id") for u in units
       if not any((n.get("category") == "description" and (n.text or "").strip())
                  for n in u.findall("x:notes/x:note", ns))]
print(f"{len(units)} {' '.join(bad)}")
PY
)
  TOTAL=${MISSING%% *}; BAD=${MISSING#* }; [ "$BAD" = "$TOTAL" ] && BAD=""
  if [ "$TOTAL" = "0" ]; then warn "source catalog has no units"
  elif [ -z "$BAD" ]; then pass "all $TOTAL units carry a description"
  else fail "units without a description: $BAD"; fi
fi

# 3. Compile writes one JSON per target XLIFF.
OUTDIR=$(grep -oE "const OUT_DIR = '[^']+'" scripts/xliff-to-json.mjs 2>/dev/null | sed -E "s/.*'([^']+)'/\1/")
[ -n "$OUTDIR" ] && pass "converter OUT_DIR = $OUTDIR" || fail "scripts/xliff-to-json.mjs missing or has no OUT_DIR"
if npm run --silent i18n:compile >/dev/null 2>&1; then pass "i18n:compile exited 0"; else fail "i18n:compile failed"; fi
for f in "$OUTPATH"/messages.*.xlf; do
  [ -e "$f" ] || continue
  loc=$(basename "$f" .xlf); loc=${loc#messages.}
  [ "$loc" = "$SRC" ] && continue
  if [ -n "$OUTDIR" ] && jq -e . "$OUTDIR/$loc.json" >/dev/null 2>&1; then pass "$OUTDIR/$loc.json is valid JSON"
  else fail "no valid $OUTDIR/$loc.json for $f"; fi
done

# 4. Build.
if npm run --silent build >/dev/null 2>&1; then pass "npm run build exited 0"; else fail "npm run build failed"; fi

# 6. main.ts: translations loaded, app imported dynamically, never statically.
if grep -nE "^[[:space:]]*import[[:space:]].*['\"]\./app/" src/main.ts >/dev/null 2>&1; then
  fail "src/main.ts statically imports from ./app/ — that code evaluates \$localize before translations load"
else pass "src/main.ts has no static ./app/ import"; fi
grep -q 'loadTranslations(' src/main.ts && pass "src/main.ts calls loadTranslations()" || fail "src/main.ts never calls loadTranslations()"
grep -qE "import\(['\"]\./app/" src/main.ts && pass "src/main.ts imports the app dynamically" || fail "src/main.ts has no dynamic import('./app/…')"

echo ""
echo "--- Verification Report ---"
echo "  Passed:   $PASS"
echo "  Failed:   $FAIL"
echo "  Warnings: $WARN"
[ $FAIL -gt 0 ] && exit 1 || exit 0
