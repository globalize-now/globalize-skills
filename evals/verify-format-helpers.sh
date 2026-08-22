#!/bin/bash
set -uo pipefail

# Usage: verify-format-helpers.sh                    # static mode (default)
#        verify-format-helpers.sh --project <path>   # post-render mode
#
# Static mode asserts the format-helper contract across all eight
# (rules template, setup reference) pairs: the template declares and uses
# <<formatModule>>, and the setup reference owns a generate_format_helpers
# step that writes .globalize/format-module.json and names the full surface.
#
# Post-render mode asserts a target project after setup ran:
# .globalize/format-module.json is valid, its `path` resolves, the module
# exports the whole surface, and .agents/globalize-rules.md names the specifier.
#
# Exit codes: 0 = all checks passed, 1 = failures found, 2 = usage error.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REFS="$REPO_ROOT/skills/globalize-guide/references"

PASS=0; FAIL=0; WARN=0
pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }
warn() { echo "  WARN: $1"; WARN=$((WARN + 1)); }
info() { echo "  INFO: $1"; }

usage() {
  echo "Usage: verify-format-helpers.sh [--project <path>]"
  echo "  (no args)          lint the 8 (rules template, setup reference) pairs"
  echo "  --project <path>   lint a generated format module in <path>"
}

MODE="static"; PROJECT_DIR=""
while [ $# -gt 0 ]; do
  case "$1" in
    --project) MODE="project"; PROJECT_DIR="${2:-}"
      [ -z "$PROJECT_DIR" ] && { echo "ERROR: --project requires a path"; usage; exit 2; }
      shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERROR: unknown argument '$1'"; usage; exit 2 ;;
  esac
done

# Surface smoke test. Grepped case-insensitively as plain substrings, so a
# stack's own naming convention (format_money, .money) still satisfies them.
# Deliberately excludes `number`, `date`, `time` and `list` — those words
# appear in any i18n prose and would pass vacuously. Project mode checks the
# real export list instead.
SURFACE_TOKENS="money percent compact relative"

# The seam is checked separately: `format_locale` (Rails) does not contain the
# substring "formatLocale", so a plain substring grep would fail it forever.
SEAM_RE='formatLocale|format_locale|formatlocale'

# tag|rules template|setup reference (creates the module)|resolution host
# (owns the "Resolve the template's conditions/values" table). All paths are
# relative to REFS. The third and fourth columns differ on five of the eight
# libraries — the file that writes the module is often not the file that
# teaches the renderer how to resolve <<formatModule>>.
PAIRS=$(cat <<'ROWS'
lingui|languages/js-ts/libraries/lingui/rules.template.md|languages/js-ts/libraries/lingui/setup.locale-module.md|languages/js-ts/libraries/lingui/setup.add-ons.md
next-intl|languages/js-ts/libraries/next-intl/rules.template.md|languages/js-ts/libraries/next-intl/setup.add-ons.md|languages/js-ts/libraries/next-intl/setup.add-ons.md
vue-i18n|languages/js-ts/libraries/vue-i18n/rules.template.md|languages/js-ts/libraries/vue-i18n/setup.shared.md|languages/js-ts/libraries/vue-i18n/setup.shared.md
paraglide|languages/js-ts/libraries/paraglide/rules.template.md|languages/js-ts/frameworks/sveltekit/paraglide.setup.md|languages/js-ts/libraries/paraglide/setup.add-ons.md
webext-native|languages/js-ts/frameworks/webext/webext-native.rules.template.md|languages/js-ts/frameworks/webext/webext-native.setup.md|languages/js-ts/frameworks/webext/setup.add-ons.md
rails|languages/ruby/frameworks/rails/rails.rules.template.md|languages/ruby/frameworks/rails/rails.setup.md|languages/ruby/frameworks/rails/setup.add-ons.md
android-strings|languages/android/native/android-strings.rules.template.md|languages/android/native/android-strings.setup.md|languages/android/native/setup.add-ons.md
string-catalog|languages/ios/native/string-catalog.rules.template.md|languages/ios/native/string-catalog.setup.md|languages/ios/native/string-catalog.setup.md
ROWS
)

lint_pair() {
  local tag="$1" tpl="$REFS/$2" setup="$REFS/$3" tok

  echo ""
  echo "--- Pair: $tag ---"

  if [ ! -f "$tpl" ]; then fail "$tag: rules template not found at $2"; return; fi
  if [ ! -f "$setup" ]; then fail "$tag: setup reference not found at $3"; return; fi

  # 1. The template declares formatModule and uses it.
  if grep -qE '^values:.*\bformatModule\b' "$tpl"; then
    pass "$tag: template declares formatModule in values:"
  else
    fail "$tag: template does not declare formatModule in its values: frontmatter"
  fi
  if grep -qF '<<formatModule>>' "$tpl"; then
    pass "$tag: template body uses <<formatModule>>"
  else
    fail "$tag: template body never uses <<formatModule>>"
  fi

  # 2. The setup reference owns the step and records the artifact.
  if grep -qF 'generate_format_helpers' "$setup"; then
    pass "$tag: setup reference owns the generate_format_helpers step"
  else
    fail "$tag: setup reference has no generate_format_helpers step"
  fi
  if grep -qF 'format-module.json' "$setup"; then
    pass "$tag: setup reference writes .globalize/format-module.json"
  else
    fail "$tag: setup reference never writes .globalize/format-module.json"
  fi

  # 3. The setup reference names the surface and the currency constant.
  for tok in $SURFACE_TOKENS; do
    if grep -qiF "$tok" "$setup"; then
      pass "$tag: setup reference names '$tok'"
    else
      fail "$tag: setup reference never names '$tok' — the surface is incomplete"
    fi
  done
  if grep -qiE "$SEAM_RE" "$setup"; then
    pass "$tag: setup reference names the formatLocale seam"
  else
    fail "$tag: setup reference never names the formatLocale seam"
  fi
  if grep -qiE 'DEFAULT_CURRENCY|defaultCurrency|default_currency' "$setup"; then
    pass "$tag: setup reference resolves a default currency"
  else
    fail "$tag: setup reference never resolves a default currency"
  fi

  # 4. The library's condition/value resolution table must teach the renderer
  # how to resolve formatModule, or generate_coding_rules fails closed on it.
  # It is often a different file from the one that creates the module.
  local host="$REFS/$4"
  if [ ! -f "$host" ]; then
    fail "$tag: resolution host not found at $4"
  elif grep -qF 'formatModule' "$host"; then
    pass "$tag: resolution table teaches formatModule ($(basename "$host"))"
  else
    fail "$tag: no formatModule row in the condition/value resolution table ($(basename "$host")) — the renderer cannot resolve <<formatModule>>"
  fi
}

run_static_mode() {
  echo "--- Static: format-helper contract ---"
  echo "  References root: $REFS"
  if [ ! -d "$REFS" ]; then
    fail "references/ not found at $REFS — wrong repo root?"
    return
  fi
  local count=0 tag tpl setup host
  while IFS='|' read -r tag tpl setup host; do
    [ -z "$tag" ] && continue
    count=$((count + 1))
    lint_pair "$tag" "$tpl" "$setup" "$host"
  done <<EOF
$PAIRS
EOF
  if [ "$count" -eq 0 ]; then
    fail "no pairs configured — a linter that passes on zero inputs guards nothing"
  else
    echo ""
    info "pairs checked: $count"
  fi
}

run_project_mode() {
  local proj="$1"
  echo "--- Post-render: $proj ---"
  [ -d "$proj" ] || { echo "ERROR: project directory not found: $proj"; exit 2; }

  local fm="$proj/.globalize/format-module.json"
  if [ ! -f "$fm" ]; then
    fail ".globalize/format-module.json missing — generate_format_helpers did not run, so generate_coding_rules has no formatModule to resolve"
    return
  fi
  pass ".globalize/format-module.json exists"

  if ! command -v jq >/dev/null 2>&1; then
    warn "jq not installed — skipping the JSON checks"
    return
  fi
  if ! jq -e . "$fm" >/dev/null 2>&1; then
    fail ".globalize/format-module.json is not valid JSON"
    return
  fi
  pass ".globalize/format-module.json is valid JSON"

  local key
  for key in specifier path surface defaultCurrency currencySource; do
    if jq -e --arg k "$key" 'has($k)' "$fm" >/dev/null 2>&1; then
      pass "format-module.json has '$key'"
    else
      fail "format-module.json is missing '$key'"
    fi
  done

  local cur
  cur=$(jq -r '.defaultCurrency // ""' "$fm")
  if [[ "$cur" =~ ^[A-Z]{3}$ ]]; then
    pass "defaultCurrency '$cur' is a 3-letter ISO 4217 code"
  else
    fail "defaultCurrency '$cur' is not a 3-letter ISO 4217 code"
  fi

  local src
  src=$(jq -r '.currencySource // ""' "$fm")
  if [[ "$src" == "default" ]] || [[ "$src" =~ ^grep:.+:[0-9]+$ ]]; then
    pass "currencySource '$src' is 'default' or a 'grep:<file>:<line>' hit"
  else
    fail "currencySource '$src' is neither 'default' nor a 'grep:<file>:<line>' hit"
  fi

  local n
  n=$(jq -r '.surface | length' "$fm" 2>/dev/null || echo 0)
  if [ "$n" -eq 10 ]; then
    pass "surface lists all 10 functions"
  else
    fail "surface lists $n function(s), expected 10 — the surface is fixed and never pruned"
  fi

  local modpath
  modpath=$(jq -r '.path // ""' "$fm")
  if [ -n "$modpath" ] && [ -f "$proj/$modpath" ]; then
    pass "module file exists at $modpath"
    local missing=0 fn
    while IFS= read -r fn; do
      [ -z "$fn" ] && continue
      grep -qF "$fn" "$proj/$modpath" || { fail "module does not define '$fn'"; missing=1; }
    done < <(jq -r '.surface[]?' "$fm")
    [ $missing -eq 0 ] && pass "module defines every name in surface"
  else
    fail "module file not found at '$modpath'"
  fi

  local spec rules="$proj/.agents/globalize-rules.md"
  spec=$(jq -r '.specifier // ""' "$fm")
  if [ ! -f "$rules" ]; then
    warn ".agents/globalize-rules.md not present — run verify-rules-template.sh --project first"
  elif [ -n "$spec" ] && grep -qF "$spec" "$rules"; then
    pass "generated rules file names the module specifier '$spec'"
  else
    fail "generated rules file does not name the module specifier '$spec' — <<formatModule>> resolved to something else"
  fi
}

if [ "$MODE" = "project" ]; then run_project_mode "$PROJECT_DIR"; else run_static_mode; fi

echo ""
echo "--- Verification Report ---"
echo "  Passed:   $PASS"
echo "  Failed:   $FAIL"
echo "  Warnings: $WARN"
[ $FAIL -gt 0 ] && exit 1 || exit 0
