#!/bin/bash
set -uo pipefail

# Usage: next-intl.sh <project-dir> <fixture-name> [variant]
# Per-library verifier (dispatched by verify-setup.sh) for next-intl setups.
# Runs 3 layers of verification against a project where the i18n-guide skill
# set up next-intl.
#
# next-intl is a RUNTIME-catalog library: messages are JSON files consumed
# directly at runtime. There is NO extract and NO compile step (unlike Lingui),
# so Layer 1 verifies the catalogs parse as JSON and the project builds —
# it never runs an extract/compile command.

WORKDIR="${1:?Usage: next-intl.sh <project-dir> <fixture-name> [variant]}"
FIXTURE="${2:?Usage: next-intl.sh <project-dir> <fixture-name> [variant]}"
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

# 1.1 routing.ts exists (defineRouting — single source of truth for locales).
# Lives at i18n/routing.ts or src/i18n/routing.ts. Both variants create it.
ROUTING_FILES=()
while IFS= read -r f; do
  ROUTING_FILES+=("$f")
done < <(find . -path ./node_modules -prune -o -path ./.next -prune -o \( -name 'routing.ts' -o -name 'routing.js' \) -print 2>/dev/null || true)

if [ ${#ROUTING_FILES[@]} -gt 0 ]; then
  pass "next-intl routing config exists (${ROUTING_FILES[0]})"
else
  fail "No next-intl routing.ts found (expected i18n/routing.ts or src/i18n/routing.ts)"
fi

# 1.2 request.ts exists (getRequestConfig). App Router uses it for real;
# Pages Router writes a one-line stub — but both variants must have it because
# next-intl/plugin asserts the module exists at load time.
REQUEST_FILES=()
while IFS= read -r f; do
  REQUEST_FILES+=("$f")
done < <(find . -path ./node_modules -prune -o -path ./.next -prune -o \( -name 'request.ts' -o -name 'request.js' \) -print 2>/dev/null || true)

if [ ${#REQUEST_FILES[@]} -gt 0 ]; then
  pass "next-intl request config exists (${REQUEST_FILES[0]})"
else
  fail "No next-intl request.ts found (expected i18n/request.ts or src/i18n/request.ts)"
fi

# 1.3 Expected locales configured. App Router lists locales in routing.ts;
# Pages Router additionally writes them into the next.config `i18n:` block.
# Search both routing.ts files and next.config.* so either shape passes.
LOCALE_SOURCES=()
if [ ${#ROUTING_FILES[@]} -gt 0 ]; then
  LOCALE_SOURCES+=("${ROUTING_FILES[@]}")
fi
while IFS= read -r f; do
  LOCALE_SOURCES+=("$f")
done < <(ls next.config.* 2>/dev/null || true)

check_locale() {
  local code="$1" label="$2"
  if [ ${#LOCALE_SOURCES[@]} -gt 0 ] && grep -REq "[\"']${code}[\"']" "${LOCALE_SOURCES[@]}" 2>/dev/null; then
    pass "$label locale '$code' configured"
  else
    fail "$label locale '$code' not found in routing.ts or next.config"
  fi
}

check_locale en "Source"
check_locale es "Target"
check_locale fr "Target"

# 1.4 Message catalogs exist and parse as valid JSON. The message-import paths
# in the setup refs hard-code `../../messages/${locale}.json`, so the catalogs
# always live at the project root `messages/` directory (never under src/).
if [ -d messages ]; then
  pass "messages/ catalog directory exists"
else
  fail "messages/ catalog directory not found at project root"
fi

check_catalog() {
  local code="$1" label="$2"
  local file="messages/${code}.json"
  if [ -f "$file" ]; then
    if node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$file" 2>/dev/null; then
      pass "$label catalog messages/${code}.json is valid JSON"
    else
      fail "$label catalog messages/${code}.json is not valid JSON"
    fi
  else
    fail "$label catalog messages/${code}.json not found"
  fi
}

check_catalog en "Source"
check_catalog es "Target"
check_catalog fr "Target"

# 1.5 next-intl package installed (single runtime package — no dev packages,
# no compiler plugin).
if [ -d node_modules/next-intl ]; then
  pass "next-intl installed"
else
  fail "next-intl not installed"
fi

# 1.6 Project builds (next-intl has no extract/compile — the build is the
# functional gate). Mirror lingui.sh's build check.
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

# 2.2 ESLint: next-intl has NO required ESLint plugin (unlike Lingui's optional
# eslint-plugin-lingui). Any ESLint integration is purely optional, so this is
# warn-only — never a failure.
ESLINT_CONFIG=$(ls eslint.config.* .eslintrc.* 2>/dev/null | head -1)
if [ -n "$ESLINT_CONFIG" ]; then
  warn "ESLint config present ($ESLINT_CONFIG) — next-intl has no required ESLint plugin, integration not checked"
else
  warn "No ESLint config found — next-intl has no required ESLint plugin, check skipped"
fi

# 2.3 No 'any' types in generated i18n files (search the whole source tree —
# the skill may use app/ or src/ depending on framework).
I18N_FILES=$(find . -path ./node_modules -prune -o -path ./.next -prune -o \( -name '*.ts' -o -name '*.tsx' \) -print 2>/dev/null | xargs grep -l -E "next-intl|NextIntlClientProvider|useTranslations|getTranslations|getRequestConfig|defineRouting" 2>/dev/null || true)
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
  nextjs-app-router-next-intl)
    # Locale router: Next <16 uses middleware.ts; Next 16+ renamed it to proxy.ts
    if [ -f src/middleware.ts ] || [ -f middleware.ts ] || [ -f src/proxy.ts ] || [ -f proxy.ts ]; then
      pass "Locale router (middleware.ts / proxy.ts) exists"
    else
      fail "Locale router not found (expected middleware.ts or proxy.ts)"
    fi

    # Dynamic locale segment: [locale]. Prune node_modules and .next so build
    # artifacts don't produce false matches.
    if find . -path './node_modules/*' -prune -o -path './.next/*' -prune -o -path '*/\[locale\]*' -print | grep -q .; then
      pass "Dynamic locale route segment ([locale]) exists"
    else
      fail "Dynamic locale route segment ([locale]) not found"
    fi

    # next-intl plugin referenced in next.config (createNextIntlPlugin)
    NEXT_CONFIG=$(ls next.config.* 2>/dev/null | head -1)
    if [ -n "$NEXT_CONFIG" ] && grep -qE "next-intl/plugin|createNextIntlPlugin" "$NEXT_CONFIG" 2>/dev/null; then
      pass "next-intl plugin referenced in Next.js config"
    else
      fail "No next-intl plugin reference in Next.js config"
    fi

    # NextIntlClientProvider wired (root layout and/or [locale] layout)
    if grep -rq "NextIntlClientProvider" app src 2>/dev/null; then
      pass "NextIntlClientProvider found in source"
    else
      fail "NextIntlClientProvider not found in source"
    fi
    ;;

  nextjs-pages-router-next-intl)
    # next-intl plugin referenced in next.config (createNextIntlPlugin)
    NEXT_CONFIG=$(ls next.config.* 2>/dev/null | head -1)
    if [ -n "$NEXT_CONFIG" ] && grep -qE "next-intl/plugin|createNextIntlPlugin" "$NEXT_CONFIG" 2>/dev/null; then
      pass "next-intl plugin referenced in Next.js config"
    else
      fail "No next-intl plugin reference in Next.js config"
    fi

    # Pages Router uses Next's built-in i18n routing in next.config (i18n: {
    # locales, defaultLocale }) — NOT a [locale] dir, NOT middleware.
    if [ -n "$NEXT_CONFIG" ] && grep -q "i18n" "$NEXT_CONFIG" 2>/dev/null && grep -qE "locales|defaultLocale" "$NEXT_CONFIG" 2>/dev/null; then
      pass "Built-in i18n routing config (locales/defaultLocale) in Next.js config"
    else
      fail "No built-in i18n routing config (i18n: { locales, defaultLocale }) in Next.js config"
    fi

    # NextIntlClientProvider wired in pages/_app.tsx (under pages/ or src/pages/)
    APP_FILE=""
    for f in pages/_app.tsx pages/_app.jsx pages/_app.ts pages/_app.js \
             src/pages/_app.tsx src/pages/_app.jsx src/pages/_app.ts src/pages/_app.js; do
      if [ -f "$f" ]; then APP_FILE="$f"; break; fi
    done
    if [ -n "$APP_FILE" ] && grep -q "NextIntlClientProvider" "$APP_FILE" 2>/dev/null; then
      pass "NextIntlClientProvider wired in $APP_FILE"
    else
      fail "NextIntlClientProvider not found in pages/_app.* (or src/pages/_app.*)"
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
