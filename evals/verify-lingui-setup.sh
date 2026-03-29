#!/bin/bash
set -uo pipefail

# Usage: verify-lingui-setup.sh <project-dir> <fixture-name>
# Runs 3 layers of verification against a project where lingui-setup was applied.

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

# 1.2 Config contains expected locales
if [ -f lingui.config.ts ]; then
  CONFIG_FILE="lingui.config.ts"
elif [ -f lingui.config.js ]; then
  CONFIG_FILE="lingui.config.js"
else
  CONFIG_FILE=""
fi

if [ -n "$CONFIG_FILE" ]; then
  if grep -q '"en"' "$CONFIG_FILE" || grep -q "'en'" "$CONFIG_FILE"; then
    pass "Source locale 'en' configured"
  else
    fail "Source locale 'en' not found in config"
  fi

  if grep -q '"es"' "$CONFIG_FILE" || grep -q "'es'" "$CONFIG_FILE"; then
    pass "Target locale 'es' configured"
  else
    fail "Target locale 'es' not found in config"
  fi

  if grep -q '"fr"' "$CONFIG_FILE" || grep -q "'fr'" "$CONFIG_FILE"; then
    pass "Target locale 'fr' configured"
  else
    fail "Target locale 'fr' not found in config"
  fi
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

# 1.5 .po files generated
PO_COUNT=$(find . -name "*.po" -not -path './node_modules/*' | wc -l | tr -d ' ')
if [ "$PO_COUNT" -ge 2 ]; then
  pass "PO files generated ($PO_COUNT files)"
else
  fail "Expected at least 2 .po files, found $PO_COUNT"
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

# 2.2 ESLint plugin configured (if ESLint is present)
ESLINT_CONFIG=$(ls eslint.config.* .eslintrc.* 2>/dev/null | head -1)
if [ -n "$ESLINT_CONFIG" ]; then
  if [ -d node_modules/eslint-plugin-lingui ]; then
    pass "eslint-plugin-lingui installed"
  else
    fail "eslint-plugin-lingui not installed (ESLint is configured but plugin is missing)"
  fi

  if grep -q "lingui" "$ESLINT_CONFIG" 2>/dev/null; then
    pass "Lingui ESLint preset configured in $ESLINT_CONFIG"
  else
    # Also check package.json eslintConfig
    if grep -q '"lingui"' package.json 2>/dev/null && grep -q '"eslintConfig"' package.json 2>/dev/null; then
      pass "Lingui ESLint preset configured in package.json"
    else
      fail "Lingui ESLint preset not found in $ESLINT_CONFIG"
    fi
  fi
else
  warn "No ESLint config found — eslint-plugin-lingui check skipped"
fi

# 2.3 No 'any' types in generated i18n files
I18N_FILES=$(find src -name "*.ts" -o -name "*.tsx" | xargs grep -l -i "i18n\|lingui\|Trans\|useLingui" 2>/dev/null || true)
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
  nextjs-app-router)
    # Middleware should exist
    if [ -f src/middleware.ts ] || [ -f middleware.ts ]; then
      pass "Next.js middleware exists"
    else
      fail "Next.js middleware not found (needed for locale routing)"
    fi

    # [lang] dynamic segment
    if find . -path '*/\[lang\]*' -not -path './node_modules/*' | grep -q .; then
      pass "[lang] dynamic route segment exists"
    else
      fail "[lang] dynamic route segment not found"
    fi

    # SWC plugin in next.config
    if [ -f next.config.ts ] || [ -f next.config.js ] || [ -f next.config.mjs ]; then
      NEXT_CONFIG=$(ls next.config.* 2>/dev/null | head -1)
      if grep -q "lingui" "$NEXT_CONFIG"; then
        pass "Lingui plugin referenced in Next.js config"
      else
        fail "No lingui plugin reference in Next.js config"
      fi
    fi
    ;;

  vite-swc)
    # SWC plugin in vite.config
    if grep -q "@lingui/swc-plugin" vite.config.ts 2>/dev/null; then
      pass "@lingui/swc-plugin in vite.config.ts"
    else
      fail "@lingui/swc-plugin not found in vite.config.ts"
    fi

    # Vite plugin
    if grep -q "@lingui/vite-plugin" vite.config.ts 2>/dev/null; then
      pass "@lingui/vite-plugin in vite.config.ts"
    else
      fail "@lingui/vite-plugin not found in vite.config.ts"
    fi

    # I18nProvider wired up
    if grep -rq "I18nProvider" src/ 2>/dev/null; then
      pass "I18nProvider found in source"
    else
      fail "I18nProvider not found in source"
    fi
    ;;

  vite-babel)
    # Babel plugin in vite.config
    if grep -q "lingui" vite.config.ts 2>/dev/null; then
      pass "Lingui babel plugin in vite.config.ts"
    else
      fail "No lingui reference in vite.config.ts"
    fi

    # Vite plugin
    if grep -q "@lingui/vite-plugin" vite.config.ts 2>/dev/null; then
      pass "@lingui/vite-plugin in vite.config.ts"
    else
      fail "@lingui/vite-plugin not found in vite.config.ts"
    fi

    # I18nProvider wired up
    if grep -rq "I18nProvider" src/ 2>/dev/null; then
      pass "I18nProvider found in source"
    else
      fail "I18nProvider not found in source"
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
