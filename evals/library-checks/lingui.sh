#!/bin/bash
set -uo pipefail

# Usage: lingui.sh <project-dir> <fixture-name> [variant]
# Per-library verifier (dispatched by verify-setup.sh) for Lingui setups.
# Runs 3 layers of verification against a project where the i18n-guide skill
# set up Lingui.

WORKDIR="${1:?Usage: verify-lingui-setup.sh <project-dir> <fixture-name> [variant]}"
FIXTURE="${2:?Usage: verify-lingui-setup.sh <project-dir> <fixture-name> [variant]}"
VARIANT="${3:-$FIXTURE}"

cd "$WORKDIR"

PASS=0
FAIL=0
WARN=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }
warn() { echo "  WARN: $1"; WARN=$((WARN + 1)); }

# ─── Layer 1: Functional Correctness ───

echo "--- Layer 1: Functional Correctness ---"

# 1.1 lingui.config.ts exists
if [ -f lingui.config.ts ] || [ -f lingui.config.js ]; then
  pass "Lingui config file exists"
else
  fail "No lingui.config.ts or lingui.config.js found"
fi

# 1.2 Expected locales configured (inline in config OR in an imported locales module)
CONFIG_FILE=""
if [ -f lingui.config.ts ]; then
  CONFIG_FILE="lingui.config.ts"
elif [ -f lingui.config.js ]; then
  CONFIG_FILE="lingui.config.js"
fi

# The skill may define locales in a dedicated module (e.g. app/i18n/locales.ts)
# imported by lingui.config, so search the config plus any locales/i18n module.
LOCALE_SOURCES=()
[ -n "$CONFIG_FILE" ] && LOCALE_SOURCES+=("$CONFIG_FILE")
while IFS= read -r f; do
  LOCALE_SOURCES+=("$f")
done < <(find . -path ./node_modules -prune -o \( -name 'locales.ts' -o -name 'locales.js' -o -name 'i18n.ts' -o -name 'i18n.js' \) -print 2>/dev/null)

check_locale() {
  local code="$1" label="$2"
  if [ ${#LOCALE_SOURCES[@]} -gt 0 ] && grep -REq "[\"']${code}[\"']" "${LOCALE_SOURCES[@]}" 2>/dev/null; then
    pass "$label locale '$code' configured"
  else
    fail "$label locale '$code' not found in lingui config or locales module"
  fi
}

if [ -n "$CONFIG_FILE" ]; then
  check_locale en "Source"
  check_locale es "Target"
  check_locale fr "Target"
fi

# 1.3 Core lingui packages installed
if [ -d node_modules/@lingui/core ]; then
  pass "@lingui/core installed"
else
  fail "@lingui/core not installed"
fi

if [ -d node_modules/@lingui/react ]; then
  pass "@lingui/react installed"
else
  fail "@lingui/react not installed"
fi

if [ -d node_modules/@lingui/cli ]; then
  pass "@lingui/cli installed"
else
  fail "@lingui/cli not installed"
fi

# 1.4 Extraction works
echo "  Running lingui extract..."
if npx lingui extract --clean 2>&1 | grep -q -i "error"; then
  fail "lingui extract produced errors"
else
  pass "lingui extract succeeded"
fi

# 1.5 Catalog files present, or extractor configured (setup-only scope has no
# wrapped strings yet, so 0 .po files is expected as long as a catalog/extractor
# is configured — populated catalogs are a convert-phase concern).
PO_COUNT=$(find . -name "*.po" -not -path './node_modules/*' | wc -l | tr -d ' ')
if [ "$PO_COUNT" -ge 1 ]; then
  pass "PO catalog files present ($PO_COUNT files)"
elif [ -n "$CONFIG_FILE" ] && grep -Eq "catalogs|experimental|extractor" "$CONFIG_FILE" 2>/dev/null; then
  warn "No .po files yet — expected for setup-only scope before strings are wrapped (catalog/extractor is configured)"
else
  fail "No .po files found and no catalog/extractor configuration in lingui config"
fi

# 1.6 Compilation works
echo "  Running lingui compile..."
if npx lingui compile 2>&1 | grep -q -i "error"; then
  fail "lingui compile produced errors"
else
  pass "lingui compile succeeded"
fi

# 1.7 Project builds
echo "  Running npm run build..."
if npm run build 2>&1 | tail -1 | grep -q -i "error"; then
  fail "npm run build failed"
else
  pass "npm run build succeeded"
fi

# ─── Layer 2: Code Quality ───

echo ""
echo "--- Layer 2: Code Quality ---"

# 2.1 TypeScript passes (for TS projects)
if [ -f tsconfig.json ]; then
  echo "  Running tsc --noEmit..."
  if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
    fail "TypeScript type errors found"
  else
    pass "TypeScript types pass"
  fi
fi

# 2.2 ESLint plugin (OPTIONAL add-on — only present if the user opted in during
# Phase 1.10, so its absence is a warning, not a failure).
ESLINT_CONFIG=$(ls eslint.config.* .eslintrc.* 2>/dev/null | head -1)
if [ -n "$ESLINT_CONFIG" ]; then
  if [ -d node_modules/eslint-plugin-lingui ]; then
    pass "eslint-plugin-lingui installed"
    if grep -q "lingui" "$ESLINT_CONFIG" 2>/dev/null || { grep -q '"lingui"' package.json 2>/dev/null && grep -q '"eslintConfig"' package.json 2>/dev/null; }; then
      pass "Lingui ESLint preset configured"
    else
      warn "eslint-plugin-lingui installed but no Lingui preset wired in $ESLINT_CONFIG"
    fi
  else
    warn "eslint-plugin-lingui not installed (optional ESLint add-on — only present if selected)"
  fi
else
  warn "No ESLint config found — eslint-plugin-lingui check skipped"
fi

# 2.3 No 'any' types in generated i18n files (search the whole source tree —
# the skill may use app/ or src/ depending on framework).
I18N_FILES=$(find . -path ./node_modules -prune -o -path ./.next -prune -o \( -name '*.ts' -o -name '*.tsx' \) -print 2>/dev/null | xargs grep -l -i "i18n\|lingui\|Trans\|useLingui" 2>/dev/null || true)
if [ -n "$I18N_FILES" ]; then
  ANY_COUNT=$(echo "$I18N_FILES" | xargs grep -c ": any" 2>/dev/null | grep -v ":0$" | wc -l | tr -d ' ')
  if [ "$ANY_COUNT" -eq 0 ]; then
    pass "No 'any' types in i18n files"
  else
    warn "'any' type found in $ANY_COUNT i18n file(s)"
  fi
fi

# ─── Variant-specific checks ───

echo ""
echo "--- Variant-Specific Checks: $VARIANT ---"

case "$VARIANT" in
  nextjs-app-router|nextjs-app-router-lingui)
    # Locale router: Next <16 uses middleware.ts; Next 16+ renamed it to proxy.ts
    if [ -f src/middleware.ts ] || [ -f middleware.ts ] || [ -f src/proxy.ts ] || [ -f proxy.ts ]; then
      pass "Locale router (middleware.ts / proxy.ts) exists"
    else
      fail "Locale router not found (expected middleware.ts or proxy.ts)"
    fi

    # Dynamic locale segment: [locale] (current) or [lang] (older reference).
    # Prune node_modules and .next so build artifacts don't produce false matches.
    if find . -path './node_modules/*' -prune -o -path './.next/*' -prune -o \( -path '*/\[locale\]*' -o -path '*/\[lang\]*' \) -print | grep -q .; then
      pass "Dynamic locale route segment ([locale]/[lang]) exists"
    else
      fail "Dynamic locale route segment ([locale] or [lang]) not found"
    fi

    # Lingui referenced in next.config
    NEXT_CONFIG=$(ls next.config.* 2>/dev/null | head -1)
    if [ -n "$NEXT_CONFIG" ] && grep -q "lingui" "$NEXT_CONFIG"; then
      pass "Lingui plugin referenced in Next.js config"
    else
      fail "No lingui plugin reference in Next.js config"
    fi

    # Client provider wired (skill uses LinguiClientProvider; older refs use I18nProvider)
    if grep -rqE "I18nProvider|LinguiClientProvider" app src 2>/dev/null; then
      pass "Lingui client provider found in source"
    else
      fail "Lingui client provider (I18nProvider/LinguiClientProvider) not found"
    fi
    ;;

  vite-swc|vite-swc-lingui)
    if grep -q "@lingui/swc-plugin" vite.config.ts 2>/dev/null; then
      pass "@lingui/swc-plugin in vite.config.ts"
    else
      fail "@lingui/swc-plugin not found in vite.config.ts"
    fi
    if grep -q "@lingui/vite-plugin" vite.config.ts 2>/dev/null; then
      pass "@lingui/vite-plugin in vite.config.ts"
    else
      fail "@lingui/vite-plugin not found in vite.config.ts"
    fi
    if grep -rqE "I18nProvider|LinguiClientProvider" app src 2>/dev/null; then
      pass "Lingui provider found in source"
    else
      fail "Lingui provider not found in source"
    fi
    ;;

  vite-babel|vite-babel-lingui)
    if grep -q "lingui" vite.config.ts 2>/dev/null; then
      pass "Lingui babel plugin in vite.config.ts"
    else
      fail "No lingui reference in vite.config.ts"
    fi
    if grep -q "@lingui/vite-plugin" vite.config.ts 2>/dev/null; then
      pass "@lingui/vite-plugin in vite.config.ts"
    else
      fail "@lingui/vite-plugin not found in vite.config.ts"
    fi
    if grep -rqE "I18nProvider|LinguiClientProvider" app src 2>/dev/null; then
      pass "Lingui provider found in source"
    else
      fail "Lingui provider not found in source"
    fi
    ;;

  *)
    warn "No variant-specific checks for: $VARIANT"
    ;;
esac

# ─── Report ───

echo ""
echo "--- Verification Report ---"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "  Warnings: $WARN"

if [ $FAIL -gt 0 ]; then
  exit 1
else
  exit 0
fi
