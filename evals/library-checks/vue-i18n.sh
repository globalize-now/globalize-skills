#!/bin/bash
set -uo pipefail

# Usage: vue-i18n.sh <project-dir> <fixture-name> [variant]
# Per-library verifier (dispatched by verify-setup.sh) for vue-i18n setups.
# Runs 3 layers of verification against a project where the i18n-guide skill
# set up vue-i18n.
#
# vue-i18n is a RUNTIME library: catalogs are plain JSON loaded at runtime and
# processed by intl-messageformat via a custom messageCompiler. There is NO
# extract step and NO compile step (unlike Lingui). Layer 1 therefore checks
# package install, catalog JSON validity, and a successful build — it never runs
# an extract/compile CLI.

WORKDIR="${1:?Usage: vue-i18n.sh <project-dir> <fixture-name> [variant]}"
FIXTURE="${2:?Usage: vue-i18n.sh <project-dir> <fixture-name> [variant]}"
VARIANT="${3:-$FIXTURE}"

cd "$WORKDIR"

PASS=0
FAIL=0
WARN=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }
warn() { echo "  WARN: $1"; WARN=$((WARN + 1)); }

# Whether this is the Nuxt variant — branches package checks, catalog dir, and
# message-compiler location. Nuxt uses @nuxtjs/i18n (which bundles vue-i18n) and
# an inline messageCompiler in i18n.config.ts rather than the Vite/Quasar
# src/i18n/* module layout.
IS_NUXT=0
case "$VARIANT" in
  nuxt-vue-i18n|nuxt) IS_NUXT=1 ;;
esac

# ─── Layer 1: Functional Correctness ───

echo "--- Layer 1: Functional Correctness ---"

# 1.1 Core i18n module / config exists.
#   Vite / Quasar: src/i18n/index.{ts,js,mts,mjs}
#   Nuxt:          i18n.config.* (Nuxt 3 root) or i18n/i18n.config.* (Nuxt 4)
I18N_MODULE=""
if [ "$IS_NUXT" -eq 1 ]; then
  I18N_MODULE=$(find . \( -path ./node_modules -o -path ./.nuxt -o -path ./.output -o -path ./dist \) -prune -o \
    -name 'i18n.config.*' -print 2>/dev/null | head -1)
  if [ -n "$I18N_MODULE" ]; then
    pass "Nuxt i18n config exists ($I18N_MODULE)"
  else
    fail "No i18n.config.* found (expected at project root or i18n/)"
  fi
else
  I18N_MODULE=$(find . \( -path ./node_modules -o -path ./dist \) -prune -o \
    -path '*/i18n/index.*' -print 2>/dev/null | head -1)
  if [ -n "$I18N_MODULE" ]; then
    pass "i18n instance module exists ($I18N_MODULE)"
  else
    fail "No src/i18n/index.* module found"
  fi
fi

# 1.2 createI18n configured with legacy:false + custom messageCompiler.
# For Vite/Quasar these live in src/i18n/index.* + src/i18n/messageCompiler.*.
# For Nuxt the messageCompiler is inline in i18n.config.* (no separate file).
WIRING_SOURCES=()
[ -n "$I18N_MODULE" ] && WIRING_SOURCES+=("$I18N_MODULE")
while IFS= read -r f; do
  WIRING_SOURCES+=("$f")
done < <(find . \( -path ./node_modules -o -path ./.nuxt -o -path ./.output -o -path ./dist \) -prune -o \
  \( -name 'messageCompiler.*' -o -name 'i18n.config.*' \) -print 2>/dev/null)

if [ "$IS_NUXT" -eq 1 ]; then
  # Nuxt: createI18n is owned by the module; we only assert the custom compiler
  # is wired (legacy:false is set inside defineI18nConfig).
  if [ ${#WIRING_SOURCES[@]} -gt 0 ] && grep -REq "legacy:\s*false" "${WIRING_SOURCES[@]}" 2>/dev/null; then
    pass "legacy: false configured in i18n config"
  else
    fail "legacy: false not found in i18n config"
  fi
else
  if [ ${#WIRING_SOURCES[@]} -gt 0 ] && grep -REq "createI18n\(" "${WIRING_SOURCES[@]}" 2>/dev/null; then
    pass "createI18n( call found"
  else
    fail "createI18n( call not found"
  fi
  if [ ${#WIRING_SOURCES[@]} -gt 0 ] && grep -REq "legacy:\s*false" "${WIRING_SOURCES[@]}" 2>/dev/null; then
    pass "legacy: false configured (Composition API)"
  else
    fail "legacy: false not found in createI18n config"
  fi
fi

# Custom ICU messageCompiler wired (all variants).
if [ ${#WIRING_SOURCES[@]} -gt 0 ] && grep -REq "messageCompiler" "${WIRING_SOURCES[@]}" 2>/dev/null; then
  pass "Custom ICU messageCompiler wired"
else
  fail "messageCompiler not referenced in i18n wiring"
fi

# intl-messageformat imported by the compiler (all variants).
if [ ${#WIRING_SOURCES[@]} -gt 0 ] && grep -REq "intl-messageformat" "${WIRING_SOURCES[@]}" 2>/dev/null; then
  pass "intl-messageformat imported by messageCompiler"
else
  fail "intl-messageformat not imported in i18n wiring"
fi

# 1.3 Locale catalogs configured. Source en + targets es/fr.
#   Vite / Quasar: src/i18n/locales/<locale>.json (+ src/i18n/locales.ts module)
#   Nuxt:          i18n/locales/<locale>.json (Nuxt 4) or locales/<locale>.json
#                  (Nuxt 3); locales also declared inline in nuxt.config.*
LOCALES_DIR=""
for d in src/i18n/locales i18n/locales locales; do
  if [ -d "$d" ]; then
    LOCALES_DIR="$d"
    break
  fi
done

if [ -n "$LOCALES_DIR" ]; then
  pass "Locale catalog directory exists ($LOCALES_DIR)"
else
  fail "No locale catalog directory found (src/i18n/locales, i18n/locales, or locales)"
fi

# Sources that prove a locale is configured: locales.ts module, nuxt.config,
# createI18n config, and the catalog file basenames themselves.
LOCALE_SOURCES=()
while IFS= read -r f; do
  LOCALE_SOURCES+=("$f")
done < <(find . \( -path ./node_modules -o -path ./.nuxt -o -path ./.output -o -path ./dist \) -prune -o \
  \( -name 'locales.ts' -o -name 'locales.js' -o -name 'nuxt.config.*' -o -name 'i18n.config.*' \) -print 2>/dev/null)
[ -n "$I18N_MODULE" ] && LOCALE_SOURCES+=("$I18N_MODULE")

check_locale() {
  local code="$1" label="$2"
  # A catalog file named <code>.json or <code>.po is itself proof the locale is
  # configured (the skill emits .po under the PO catalog format — see
  # vue-i18n/setup.shared.md Step 7).
  if [ -n "$LOCALES_DIR" ] && [ -f "$LOCALES_DIR/$code.json" ]; then
    pass "$label locale '$code' has a catalog ($LOCALES_DIR/$code.json)"
    return
  fi
  if [ -n "$LOCALES_DIR" ] && [ -f "$LOCALES_DIR/$code.po" ]; then
    pass "$label locale '$code' has a catalog ($LOCALES_DIR/$code.po)"
    return
  fi
  if [ ${#LOCALE_SOURCES[@]} -gt 0 ] && grep -REq "[\"']${code}[\"']" "${LOCALE_SOURCES[@]}" 2>/dev/null; then
    pass "$label locale '$code' configured"
  else
    fail "$label locale '$code' not found in catalogs, locales module, or i18n config"
  fi
}

check_locale en "Source"
check_locale es "Target"
check_locale fr "Target"

# 1.4 Catalog files present, and the .json ones parse as valid JSON (node is
# available). The skill emits .po under the PO catalog format; .po is compiled
# by the build-time loader, so we require existence but don't JSON-parse it.
if [ -n "$LOCALES_DIR" ]; then
  CATALOG_COUNT=$(find "$LOCALES_DIR" \( -name '*.json' -o -name '*.po' \) 2>/dev/null | wc -l | tr -d ' ')
  JSON_COUNT=$(find "$LOCALES_DIR" -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
  if [ "$CATALOG_COUNT" -ge 1 ]; then
    pass "Catalog files present ($CATALOG_COUNT files)"
    BAD_JSON=0
    while IFS= read -r catalog; do
      [ -z "$catalog" ] && continue
      if ! node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$catalog" >/dev/null 2>&1; then
        fail "Catalog is not valid JSON: $catalog"
        BAD_JSON=$((BAD_JSON + 1))
      fi
    done < <(find "$LOCALES_DIR" -name '*.json' 2>/dev/null)
    if [ "$BAD_JSON" -eq 0 ] && [ "$JSON_COUNT" -ge 1 ]; then
      pass "All JSON catalog files parse as valid JSON"
    fi
  else
    fail "No .json or .po catalog files found in $LOCALES_DIR"
  fi
fi

# 1.5 Core packages installed (branches by variant — Nuxt bundles vue-i18n).
if [ "$IS_NUXT" -eq 1 ]; then
  if [ -d node_modules/@nuxtjs/i18n ]; then
    pass "@nuxtjs/i18n installed"
  else
    fail "@nuxtjs/i18n not installed"
  fi
  # Do NOT require node_modules/vue-i18n on Nuxt — the module bundles it; the
  # skill deliberately does not install raw vue-i18n.
else
  if [ -d node_modules/vue-i18n ]; then
    pass "vue-i18n installed"
  else
    fail "vue-i18n not installed"
  fi
  if [ -d node_modules/@intlify/unplugin-vue-i18n ]; then
    pass "@intlify/unplugin-vue-i18n installed"
  else
    fail "@intlify/unplugin-vue-i18n not installed"
  fi
fi

if [ -d node_modules/intl-messageformat ]; then
  pass "intl-messageformat installed"
else
  fail "intl-messageformat not installed"
fi

# 1.6 Project builds (no extract/compile step — vue-i18n is runtime-only).
echo "  Running npm run build..."
if npm run build > "$(mktemp)" 2>&1; then
  pass "npm run build succeeded"
else
  fail "npm run build failed"
fi

# ─── Layer 2: Code Quality ───

echo ""
echo "--- Layer 2: Code Quality ---"

# 2.1 TypeScript passes (for TS projects)
if [ -f tsconfig.json ]; then
  echo "  Running tsc --noEmit..."
  if npx tsc --noEmit > /dev/null 2>&1; then
    pass "TypeScript types pass"
  else
    fail "TypeScript type errors found"
  fi
fi

# 2.2 ESLint plugin (OPTIONAL add-on — only present if the user opted in, so its
# absence is a warning, not a failure).
ESLINT_CONFIG=$(ls eslint.config.* .eslintrc.* 2>/dev/null | head -1)
if [ -n "$ESLINT_CONFIG" ]; then
  if [ -d node_modules/@intlify/eslint-plugin-vue-i18n ]; then
    pass "@intlify/eslint-plugin-vue-i18n installed"
    if grep -q "vue-i18n" "$ESLINT_CONFIG" 2>/dev/null; then
      pass "vue-i18n ESLint preset configured"
    else
      warn "@intlify/eslint-plugin-vue-i18n installed but no preset wired in $ESLINT_CONFIG"
    fi
  else
    warn "@intlify/eslint-plugin-vue-i18n not installed (optional ESLint add-on — only present if selected)"
  fi
else
  warn "No ESLint config found — @intlify/eslint-plugin-vue-i18n check skipped"
fi

# 2.3 No 'any' types in generated i18n files (search the whole source tree —
# .vue, .ts, .js — pruning build artifacts).
I18N_FILES=$(find . \( -path ./node_modules -o -path ./.nuxt -o -path ./.output -o -path ./dist \) -prune -o \
  \( -name '*.ts' -o -name '*.vue' -o -name '*.js' \) -print 2>/dev/null | \
  xargs grep -l -i "i18n\|useI18n\|messageCompiler\|i18n-t" 2>/dev/null || true)
if [ -n "$I18N_FILES" ]; then
  ANY_FILES=$(echo "$I18N_FILES" | xargs grep -lF ": any" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$ANY_FILES" -eq 0 ]; then
    pass "No 'any' types in i18n files"
  else
    warn "'any' type found in $ANY_FILES i18n file(s)"
  fi
fi

# ─── Variant-specific checks ───

echo ""
echo "--- Variant-Specific Checks: $VARIANT ---"

case "$VARIANT" in
  vite-vue-i18n|vite)
    VITE_CONFIG=$(ls vite.config.* 2>/dev/null | head -1)
    if [ -n "$VITE_CONFIG" ] && grep -q "@intlify/unplugin-vue-i18n" "$VITE_CONFIG" 2>/dev/null; then
      pass "@intlify/unplugin-vue-i18n plugin in $VITE_CONFIG"
    else
      fail "@intlify/unplugin-vue-i18n not found in vite.config.*"
    fi
    # messageCompiler should be a dedicated module for Vite.
    if find . \( -path ./node_modules -o -path ./dist \) -prune -o -name 'messageCompiler.*' -print 2>/dev/null | grep -q .; then
      pass "Dedicated messageCompiler module exists"
    else
      fail "No messageCompiler.* module found"
    fi
    # Provider wired via app.use(i18n) in main.*
    MAIN_FILE=$(find . \( -path ./node_modules -o -path ./dist \) -prune -o -path '*/main.*' -print 2>/dev/null | head -1)
    if [ -n "$MAIN_FILE" ] && grep -q "app.use(i18n)" "$MAIN_FILE" 2>/dev/null; then
      pass "Provider wired (app.use(i18n) in $MAIN_FILE)"
    elif grep -rq "app.use(i18n)" src 2>/dev/null; then
      pass "Provider wired (app.use(i18n) found in src)"
    else
      fail "Provider not wired — app.use(i18n) not found in main.*"
    fi
    ;;

  quasar-vue-i18n|quasar)
    QUASAR_CONFIG=$(ls quasar.config.* 2>/dev/null | head -1)
    if [ -n "$QUASAR_CONFIG" ] && grep -q "@intlify/unplugin-vue-i18n" "$QUASAR_CONFIG" 2>/dev/null; then
      pass "@intlify/unplugin-vue-i18n plugin in $QUASAR_CONFIG"
    else
      fail "@intlify/unplugin-vue-i18n not found in quasar.config.*"
    fi
    # Boot file registered in quasar.config boot: [...] array. Anchor 'i18n' to
    # the boot: line (matches the reference's `boot: ['i18n']` form) — a bare
    # quoted-i18n alternative would match a quoted i18n anywhere in the config
    # and could never fail.
    if [ -n "$QUASAR_CONFIG" ] && grep -Eq "boot:.*['\"]i18n['\"]" "$QUASAR_CONFIG" 2>/dev/null; then
      pass "i18n boot file registered in $QUASAR_CONFIG"
    else
      fail "i18n not registered in quasar.config boot array"
    fi
    # Boot file wires the provider via app.use(i18n).
    BOOT_FILE=$(find . \( -path ./node_modules -o -path ./dist \) -prune -o -path '*/boot/i18n.*' -print 2>/dev/null | head -1)
    if [ -n "$BOOT_FILE" ] && grep -q "app.use(i18n)" "$BOOT_FILE" 2>/dev/null; then
      pass "Provider wired in boot file ($BOOT_FILE)"
    else
      fail "Provider not wired — app.use(i18n) not found in src/boot/i18n.*"
    fi
    # messageCompiler should be a dedicated module for Quasar.
    if find . \( -path ./node_modules -o -path ./dist \) -prune -o -name 'messageCompiler.*' -print 2>/dev/null | grep -q .; then
      pass "Dedicated messageCompiler module exists"
    else
      fail "No messageCompiler.* module found"
    fi
    ;;

  nuxt-vue-i18n|nuxt)
    NUXT_CONFIG=$(ls nuxt.config.* 2>/dev/null | head -1)
    if [ -n "$NUXT_CONFIG" ] && grep -q "@nuxtjs/i18n" "$NUXT_CONFIG" 2>/dev/null; then
      pass "@nuxtjs/i18n listed in $NUXT_CONFIG modules"
    else
      fail "@nuxtjs/i18n not found in nuxt.config.* modules"
    fi
    # ICU messageCompiler wired in i18n.config.* (root for Nuxt 3, i18n/ for Nuxt 4).
    I18N_CONFIG=$(find . \( -path ./node_modules -o -path ./.nuxt -o -path ./.output -o -path ./dist \) -prune -o -name 'i18n.config.*' -print 2>/dev/null | head -1)
    if [ -n "$I18N_CONFIG" ]; then
      pass "i18n.config exists ($I18N_CONFIG)"
      if grep -q "messageCompiler" "$I18N_CONFIG" 2>/dev/null; then
        pass "ICU messageCompiler wired in $I18N_CONFIG"
      else
        fail "messageCompiler not found in $I18N_CONFIG"
      fi
    else
      fail "No i18n.config.* found for Nuxt"
    fi
    # Nuxt must NOT install raw vue-i18n — flag if it leaked into deps.
    if grep -q '"vue-i18n"' package.json 2>/dev/null; then
      warn "raw vue-i18n found in package.json — Nuxt should rely on @nuxtjs/i18n's bundled copy"
    else
      pass "No raw vue-i18n dependency (Nuxt uses @nuxtjs/i18n's bundled copy)"
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
