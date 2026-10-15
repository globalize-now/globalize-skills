#!/bin/bash
set -uo pipefail

# Usage: verify-lingui-conversion.sh <project-dir> <fixture-name> [agent-transcript]
#
# Asserts a finished Lingui setup + convert run on a Vite + React project (Phases 2 and 3).
# Written as the regression gate for a failed headless run — Vite 5 + React 18, en → lv-LV —
# where the agent never read past the first ~50 KB of SKILL.md and improvised the setup.
# Every check below corresponds to one thing that run got wrong.
#
# Reads evals/expectations/conversion/<fixture>.json. Needs node, npm, jq, python3.
# Optional: Google Chrome / Chromium for the runtime render check (skipped with a WARN if absent).

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKDIR="${1:?Usage: verify-lingui-conversion.sh <project-dir> <fixture-name> [agent-transcript]}"
FIXTURE="${2:?Usage: verify-lingui-conversion.sh <project-dir> <fixture-name> [agent-transcript]}"
TRANSCRIPT="${3:-}"
EXPECT="$SCRIPT_DIR/expectations/conversion/$FIXTURE.json"

[ -f "$EXPECT" ] || { echo "ERROR: no expectations file: $EXPECT"; exit 2; }
cd "$WORKDIR" || exit 2

PASS=0
FAIL=0
WARN=0
pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }
warn() { echo "  WARN: $1"; WARN=$((WARN + 1)); }

# The formatters module constructs Intl on purpose; exclude it from source greps.
FORMAT_MODULE=""
[ -f .globalize/format-module.json ] && FORMAT_MODULE="$(jq -r '.path // empty' .globalize/format-module.json)"
src_grep() { # <grep -E pattern> — matching lines under src/, minus the formatters module and catalogs
  grep -rnE --include='*.ts' --include='*.tsx' "$1" src 2>/dev/null \
    | grep -v '^src/locales/' \
    | { if [ -n "$FORMAT_MODULE" ]; then grep -vF "$FORMAT_MODULE:"; else cat; fi; } || true
}

echo "--- 1. Install: versions, peers, dependency placement ---"

VITE_VERSION="$(node -p "require('./node_modules/vite/package.json').version" 2>/dev/null || echo "")"
MIN_VITE="$(jq -r '.minVite' "$EXPECT")"
if [ -z "$VITE_VERSION" ]; then
  fail "vite is not installed"
elif [ "$(printf '%s\n%s\n' "$MIN_VITE" "$VITE_VERSION" | sort -V | head -1)" = "$MIN_VITE" ]; then
  pass "vite $VITE_VERSION satisfies @lingui/vite-plugin 6's peer floor ($MIN_VITE)"
else
  fail "vite $VITE_VERSION is below $MIN_VITE — @lingui/vite-plugin 6 cannot run on it"
fi

LINGUI_VERSIONS="$(npm ls --all 2>/dev/null | grep -oE '@lingui/[a-z-]+@[0-9][^ ]*' | grep -vE '@lingui/(swc-plugin|native-tools)@' | sed 's/.*@//' | sort -u)"
LINGUI_COUNT="$(printf '%s' "$LINGUI_VERSIONS" | grep -c . || true)"
if [ "$LINGUI_COUNT" -eq 1 ]; then
  pass "every @lingui/* package resolves to one version ($LINGUI_VERSIONS)"
elif [ "$LINGUI_COUNT" -eq 0 ]; then
  fail "no @lingui/* packages installed"
else
  fail "@lingui/* packages on mixed versions: $(echo "$LINGUI_VERSIONS" | tr '\n' ' ')"
fi

if [ -d node_modules/@lingui/macro ] || jq -e '(.dependencies // {}) + (.devDependencies // {}) | has("@lingui/macro")' package.json > /dev/null; then
  fail "deprecated @lingui/macro is installed — macros come from @lingui/core/macro and @lingui/react/macro"
else
  pass "@lingui/macro is not installed"
fi

for pkg in @lingui/core @lingui/react; do
  if jq -e --arg p "$pkg" '(.dependencies // {}) | has($p)' package.json > /dev/null; then
    pass "$pkg is in dependencies"
  else
    fail "$pkg is not in dependencies (runtime package)"
  fi
done

if npm ls --all > /dev/null 2> npm-ls.err; then
  pass "npm ls reports no invalid or missing peers"
else
  fail "npm ls reports problems (a --legacy-peer-deps / --force install leaves invalid peers): $(grep -m3 -E 'invalid|missing|ERR' npm-ls.err | tr '\n' ' ')"
fi
rm -f npm-ls.err
if grep -qsE 'legacy-peer-deps|^force' .npmrc; then
  fail ".npmrc enables legacy-peer-deps / force"
fi
if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ]; then
  # Match install commands, not prose: a transcript also holds every file the agent read, and
  # the skill's own references say "never --legacy-peer-deps". A JSON-event transcript
  # (opencode run --format json) is reduced to the bash commands the agent actually ran.
  if head -c 1 "$TRANSCRIPT" | grep -q '{' && jq -e . "$TRANSCRIPT" > /dev/null 2>&1; then
    jq -r 'select(.type == "tool_use" and .part.tool == "bash") | .part.state.input.command' "$TRANSCRIPT" > .verify-commands.txt 2>/dev/null || true
  else
    cp "$TRANSCRIPT" .verify-commands.txt
  fi
  if grep -qE -- '(npm|pnpm|yarn|bun) (install|i|add|ci)( [^|;&]*)? (--legacy-peer-deps|--force)' .verify-commands.txt; then
    fail "the agent transcript shows an install with --legacy-peer-deps / --force"
  else
    pass "no --legacy-peer-deps / --force in the agent transcript"
  fi
  rm -f .verify-commands.txt
fi

echo ""
echo "--- 2. Build wiring: macro transform, catalog loading, activation ---"

VITE_CONFIG="$(ls vite.config.* 2>/dev/null | head -1)"
if [ -n "$VITE_CONFIG" ] && grep -qE "babel-plugin-lingui-macro|@lingui/swc-plugin|macroTransform:[[:space:]]*(true|\{)" "$VITE_CONFIG"; then
  pass "a Lingui macro transform is wired in $VITE_CONFIG"
else
  fail "no Lingui macro transform in ${VITE_CONFIG:-vite.config.*} — lingui() alone leaves macros uncompiled"
fi

if [ -n "$(src_grep '\brequire\(')" ]; then
  fail "require() in src/ (ESM app): $(src_grep '\brequire\(' | head -3 | tr '\n' ' ')"
else
  pass "no require() in src/"
fi

if [ -n "$(src_grep "^[[:space:]]*['\"]use client['\"]")" ]; then
  fail "'use client' in a Vite SPA: $(src_grep "^[[:space:]]*['\"]use client['\"]" | head -3 | tr '\n' ' ')"
else
  pass "no 'use client' directives"
fi

EFFECT_ACTIVATION=""
while IFS= read -r f; do
  [ -z "$f" ] && continue
  # Code lines only — a comment explaining why not to use an effect must not trip this.
  code="$(grep -vE '^[[:space:]]*(//|/?\*)' "$f")"
  if printf '%s' "$code" | grep -qE 'useEffect\(' && printf '%s' "$code" | grep -qE '\b(activate|loadAndActivate|loadCatalog|dynamicActivate)\('; then
    EFFECT_ACTIVATION="$EFFECT_ACTIVATION $f"
  fi
done < <(grep -rlE --include='*.tsx' --include='*.ts' 'useEffect' src 2>/dev/null)
if [ -n "$EFFECT_ACTIVATION" ]; then
  fail "locale activated inside a useEffect (activate before the first render instead):$EFFECT_ACTIVATION"
else
  pass "no useEffect-based locale activation"
fi

if [ -n "$(src_grep 'fromPath\(|location\.pathname')" ]; then
  fail "URL-path locale detection in an app with no router: $(src_grep 'fromPath\(|location\.pathname' | head -3 | tr '\n' ' ')"
else
  pass "no URL-path locale detection"
fi

echo ""
echo "--- 3. Catalogs ---"

SRC_LOCALE="$(jq -r '.sourceLocale' "$EXPECT")"
SRC_PO="$(find src -path "*/$SRC_LOCALE/*.po" -o -path "*/$SRC_LOCALE.po" 2>/dev/null | grep -v node_modules | head -1)"
if [ -n "$SRC_PO" ]; then
  pass "source catalog: $SRC_PO"
else
  fail "no source-locale .po catalog under src/"
fi
for loc in $(jq -r '.targetLocales[]' "$EXPECT"); do
  if find src -path "*/$loc/*.po" -o -path "*/$loc.po" 2>/dev/null | grep -q .; then
    pass "target catalog for $loc exists"
  else
    fail "no .po catalog for target locale $loc"
  fi
done

OBSOLETE="$(grep -lE '^#~' $(find src -name '*.po' 2>/dev/null) 2>/dev/null || true)"
if [ -n "$OBSOLETE" ]; then
  fail "obsolete #~ entries in a fresh catalog (extract ran without --clean): $(echo "$OBSOLETE" | tr '\n' ' ')"
else
  pass "no #~ obsolete entries"
fi

MSGIDS_FILE="$(mktemp)"
if [ -n "$SRC_PO" ]; then
  # One msgid per line, multi-line msgids joined, header entry dropped.
  python3 -I - "$SRC_PO" > "$MSGIDS_FILE" <<'PY'
import re, sys
text = open(sys.argv[1], encoding='utf-8').read()
for block in re.split(r'\n\s*\n', text):
    m = re.search(r'^msgid ((?:".*"\n?)+)', block, re.M)
    if not m:
        continue
    value = ''.join(re.findall(r'"(.*)"', m.group(1))).replace('\\"', '"')
    if value:
        print(value)
PY
fi

POSITIONAL="$(grep -nE '\{[0-9]+[,}]|<[0-9]+>' "$MSGIDS_FILE" || true)"
if [ -n "$POSITIONAL" ]; then
  fail "positional placeholders in the catalog — name them (local variable, ph(), or _t on tags): $(echo "$POSITIONAL" | head -5 | tr '\n' ' ')"
else
  pass "every placeholder in the catalog is named"
fi

LITERAL_INTERP="$(grep -nF '${' "$MSGIDS_FILE" || true)"
if [ -n "$LITERAL_INTERP" ]; then
  fail "a literal \${…} reached the catalog (interpolation in a plain string): $(echo "$LITERAL_INTERP" | head -3 | tr '\n' ' ')"
else
  pass "no literal \${…} in any msgid"
fi

N_MSGIDS="$(jq '.msgids | length' "$EXPECT")"
for i in $(seq 0 $((N_MSGIDS - 1))); do
  label="$(jq -r ".msgids[$i].label" "$EXPECT")"
  regex="$(jq -r ".msgids[$i].regex" "$EXPECT")"
  if grep -qE -- "$regex" "$MSGIDS_FILE"; then
    pass "$label"
  else
    fail "$label — no msgid matches /$regex/"
  fi
done
rm -f "$MSGIDS_FILE"

echo ""
echo "--- 4. Wrapping: data modules, plurals, attributes, formatting ---"

N_DATA="$(jq '.dataModules | length' "$EXPECT")"
for i in $(seq 0 $((N_DATA - 1))); do
  file="$(jq -r ".dataModules[$i].file" "$EXPECT")"
  export_name="$(jq -r ".dataModules[$i].export" "$EXPECT")"
  if [ ! -f "$file" ]; then
    fail "$file was removed — data-driven copy must stay in its data module"
    continue
  fi
  if grep -qE "export const $export_name\b" "$file" && grep -qE '\bmsg(`|\()' "$file"; then
    pass "$file keeps '$export_name' and holds its copy as msg descriptors"
  else
    fail "$file: expected 'export const $export_name' with msg descriptors"
  fi
  while IFS= read -r copy; do
    hits="$(grep -rlF --include='*.tsx' -e "$copy" src 2>/dev/null | grep -v '^src/locales/' || true)"
    if [ -n "$hits" ]; then
      fail "\"$copy\" from $file was copied into a component (records unrolled): $(echo "$hits" | tr '\n' ' ')"
    fi
  done < <(jq -r ".dataModules[$i].copy[]" "$EXPECT")
done

TERNARY="$(src_grep '===?[[:space:]]*1[[:space:]]*\?')"
if [ -n "$TERNARY" ]; then
  fail "count ternary instead of a plural message: $(echo "$TERNARY" | head -3 | tr '\n' ' ')"
else
  pass "no '=== 1 ?' plural ternaries"
fi

ATTR_LITERAL="$(src_grep '\b(title|aria-label|placeholder|alt)=("[^"]+"|\{`)')"
if [ -n "$ATTR_LITERAL" ]; then
  fail "user-visible attribute with a literal or a template string: $(echo "$ATTR_LITERAL" | head -4 | tr '\n' ' ')"
else
  pass "title / aria-label / placeholder / alt all go through t"
fi

FORMAT_HITS="$(src_grep "['\"]en-US['\"]|toLocale(Date|Time)?String\(\)|toFixed\(|['\"](€|\\$|£)['\"]?[[:space:]]*\+|(€|£)\{")"
if [ -n "$FORMAT_HITS" ]; then
  fail "hand-rolled or locale-less formatting: $(echo "$FORMAT_HITS" | head -4 | tr '\n' ' ')"
else
  pass "no hardcoded en-US, locale-less toLocale*String(), toFixed() or symbol concatenation"
fi

N_LINES="$(jq '.untouchedLines | length' "$EXPECT")"
for i in $(seq 0 $((N_LINES - 1))); do
  file="$(jq -r ".untouchedLines[$i].file" "$EXPECT")"
  line="$(jq -r ".untouchedLines[$i].line" "$EXPECT")"
  if [ -f "$file" ] && grep -qxF -- "$line" "$file"; then
    pass "untouched line preserved verbatim in $file"
  else
    fail "a line with no copy in it was reformatted or removed in $file: '$line'"
  fi
done

echo ""
echo "--- 5. Build output ---"

if npm run build > build.log 2>&1; then
  pass "npm run build succeeded (includes tsc: unused imports fail it under noUnusedLocals)"
else
  fail "npm run build failed: $(grep -m3 -iE 'error' build.log | tr '\n' ' ')"
fi
if [ -d dist ]; then
  if grep -rlq "executed outside the context of compilation" dist; then
    fail "dist contains Lingui's macro runtime stub — macros were not compiled and the app throws on load"
  else
    pass "no uncompiled-macro stub in dist"
  fi
  if grep -rlqE '\brequire\(' dist; then
    fail "dist contains require( — throws 'require is not defined' in the browser"
  else
    pass "no require( in dist"
  fi
else
  fail "no dist/ after the build"
fi

echo ""
echo "--- 6. Runtime render (headless Chrome, optional) ---"

CHROME=""
for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" "$(command -v google-chrome 2>/dev/null)" "$(command -v chromium 2>/dev/null)" "$(command -v chromium-browser 2>/dev/null)"; do
  [ -n "$c" ] && [ -x "$c" ] && CHROME="$c" && break
done
TARGET="$(jq -r '.targetLocales[0]' "$EXPECT")"
if [ -z "$CHROME" ] || [ ! -d dist ]; then
  warn "headless Chrome or dist/ unavailable — runtime render check skipped"
else
  PORT=4399
  npx vite preview --port "$PORT" --strictPort > preview.log 2>&1 &
  PREVIEW_PID=$!
  sleep 3
  DOM="$("$CHROME" --headless=new --disable-gpu --virtual-time-budget=5000 --dump-dom "http://localhost:$PORT/?lang=$TARGET" 2>/dev/null)"
  kill "$PREVIEW_PID" 2>/dev/null; wait "$PREVIEW_PID" 2>/dev/null
  rm -f preview.log
  if printf '%s' "$DOM" | grep -qE '<h1[^>]*>[^<]+</h1>'; then
    pass "the app renders (an <h1> with text is in the DOM)"
  else
    fail "the app rendered nothing — a load-time throw (uncompiled macro, require(), activation never ran)"
  fi
  if printf '%s' "$DOM" | grep -qE ' _t="'; then
    fail "a _t=\"…\" attribute reached the DOM — macro.jsxPlaceholderAttribute is missing from lingui.config"
  fi
  if printf '%s' "$DOM" | grep -qE "<html[^>]*lang=\"$TARGET\""; then
    pass "?lang=$TARGET activates $TARGET before render (<html lang> updated)"
  else
    warn "?lang=$TARGET did not set <html lang=\"$TARGET\"> — the locale may not be applied from the query string"
  fi
fi

echo ""
echo "--- Report ---"
echo "  Passed:   $PASS"
echo "  Failed:   $FAIL"
echo "  Warnings: $WARN"
[ "$FAIL" -eq 0 ]
