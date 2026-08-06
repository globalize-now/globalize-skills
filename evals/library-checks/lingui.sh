#!/bin/bash
set -uo pipefail

# Usage: lingui.sh <project-dir> <fixture-name> [variant]
# Per-library verifier (dispatched by verify-setup.sh) for Lingui setups.
# Runs 3 layers of verification against a project where the globalize-guide skill
# set up Lingui.

WORKDIR="${1:?Usage: lingui.sh <project-dir> <fixture-name> [variant]}"
FIXTURE="${2:?Usage: lingui.sh <project-dir> <fixture-name> [variant]}"
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

# 1.6b Compiled catalogs are gitignored; .po sources are not.
#
# Layer B workdirs are plain `cp -R` copies with no git repo, so drive git through
# a throwaway GIT_DIR that never lands inside the project tree.
if ! command -v git > /dev/null 2>&1; then
  warn "git unavailable — compiled-catalog ignore checks skipped"
elif [ "$PO_COUNT" -eq 0 ]; then
  warn "No .po files — compiled-catalog ignore checks skipped (setup-only scope)"
else
  SCRATCH_GIT="$(mktemp -d)/g"
  GIT_DIR="$SCRATCH_GIT" GIT_WORK_TREE="$PWD" git init -q > /dev/null 2>&1
  # Every call must carry both paths explicitly — exporting GIT_DIR would leak
  # into `npm run build` below.
  gci() { git --git-dir="$SCRATCH_GIT" --work-tree="$PWD" check-ignore -q "$1" > /dev/null 2>&1; }

  # Collect the compiled siblings of every .po catalog (same basename, .ts/.js).
  # This shape covers both layouts: single-catalog `locales/<locale>/messages.po`
  # and per-route `locales/<route>/<locale>.po`.
  COMPILED=()
  while IFS= read -r po; do
    for ext in ts js; do
      cand="${po%.po}.$ext"
      [ -f "$cand" ] && COMPILED+=("$cand")
    done
  done < <(find . -name "*.po" -not -path './node_modules/*')

  # (1) A rule exists at all — the direct regression test for the reported gap.
  if [ -f .gitignore ] && grep -Eq '(locales|paraglide).*\.(ts|js)$' .gitignore; then
    pass "Compiled-catalog rule present in .gitignore"
  else
    fail "No compiled-catalog rule in .gitignore (compiled catalogs would be committed)"
  fi

  if [ ${#COMPILED[@]} -eq 0 ]; then
    warn "No compiled catalogs on disk next to the .po files — ignore/untrack checks skipped"
  else
    # (2) A real compiled artifact is ignored.
    if gci "${COMPILED[0]}"; then
      pass "Compiled catalog is gitignored (${COMPILED[0]})"
    else
      fail "Compiled catalog is NOT gitignored: ${COMPILED[0]}"
    fi

    # (3) Its .po sibling is NOT ignored. This is the critical guard: the compiled
    # file is a sibling of the committed source, so a directory-scoped rule would
    # silently untrack the translation source of truth.
    PO_SIBLING="${COMPILED[0]%.*}.po"
    if gci "$PO_SIBLING"; then
      fail "Over-broad ignore rule — the .po SOURCE is ignored too: $PO_SIBLING"
    else
      pass "PO source is still tracked (not ignored): $PO_SIBLING"
    fi
  fi

  # (4) Build wiring — the ignore is only safe if the build regenerates the catalogs.
  BUILD_SCRIPT=$(jq -r '.scripts.build // empty' package.json 2>/dev/null)
  DEV_SCRIPT=$(jq -r '.scripts.dev // empty' package.json 2>/dev/null)
  case "$BUILD_SCRIPT" in
    *"lingui compile"*) pass "build script runs 'lingui compile'" ;;
    *) fail "build script does not run 'lingui compile' — fresh clones will have no catalogs (build: '$BUILD_SCRIPT')" ;;
  esac
  case "$DEV_SCRIPT" in
    *"lingui compile"*) pass "dev script runs 'lingui compile'" ;;
    *) warn "dev script does not run 'lingui compile' (dev: '$DEV_SCRIPT')" ;;
  esac

  # (5) Fresh-clone simulation — the coupling regression test. Delete only the
  # compiled catalogs (never `git clean -Xdf`, which would take node_modules) and
  # confirm the build regenerates them.
  if [ ${#COMPILED[@]} -gt 0 ]; then
    rm -f "${COMPILED[@]}"
    echo "  Simulating fresh clone (compiled catalogs removed), running npm run build..."
    if npm run build > "$(mktemp)" 2>&1; then
      REGENERATED=0
      for f in "${COMPILED[@]}"; do [ -f "$f" ] && REGENERATED=$((REGENERATED + 1)); done
      if [ "$REGENERATED" -gt 0 ]; then
        pass "Build regenerates compiled catalogs from .po ($REGENERATED/${#COMPILED[@]} restored)"
      else
        fail "Build succeeded but regenerated no compiled catalogs — .po sources are not reaching the app"
      fi
    else
      fail "npm run build failed without pre-existing compiled catalogs (fresh clone would break)"
    fi
  fi
fi

# 1.7 Project builds (branch on exit status — parsing output for "error" both
# missed real failures and false-FAILed on "0 errors" summaries).
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
  ANY_FILES=$(echo "$I18N_FILES" | xargs grep -lF ": any" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$ANY_FILES" -eq 0 ]; then
    pass "No 'any' types in i18n files"
  else
    warn "'any' type found in $ANY_FILES i18n file(s)"
  fi
fi

# 2.4 The shared helper modules are single-sourced.
#
# The shared Lingui setup references own everything under the i18n module directory;
# framework references import from it and never redeclare. These checks are the
# regression test for that — before the split, getDirection was emitted 19 times
# across the reference set, 7 of those copies unexported and therefore unusable.

SRC_ROOTS=$(ls -d app src 2>/dev/null || true)
if [ -n "$SRC_ROOTS" ]; then
  RTL_HITS=$(grep -rl "RTL_LOCALES" $SRC_ROOTS 2>/dev/null || true)
  RTL_COUNT=$(printf '%s' "$RTL_HITS" | grep -c . || true)
  if [ "$RTL_COUNT" -eq 0 ]; then
    warn "No RTL_LOCALES / getDirection found — expected it in the locale module"
  elif [ "$RTL_COUNT" -eq 1 ] && echo "$RTL_HITS" | grep -q "i18n"; then
    pass "getDirection defined once, in the i18n locale module"
    if grep -q "export function getDirection" $RTL_HITS 2>/dev/null; then
      pass "getDirection is exported"
    else
      fail "getDirection is not exported — callers cannot reuse it ($RTL_HITS)"
    fi
  else
    fail "getDirection/RTL_LOCALES defined in $RTL_COUNT places, expected 1 under */i18n/: $(echo "$RTL_HITS" | tr '\n' ' ')"
  fi

  DN_HITS=$(grep -rl "new Intl.DisplayNames" $SRC_ROOTS 2>/dev/null || true)
  DN_COUNT=$(printf '%s' "$DN_HITS" | grep -c . || true)
  if [ "$DN_COUNT" -le 1 ]; then
    pass "Intl.DisplayNames constructed in at most one module ($DN_COUNT)"
  else
    fail "Intl.DisplayNames hand-built in $DN_COUNT files — use localeDisplayName(): $(echo "$DN_HITS" | tr '\n' ' ')"
  fi

  # Locale-prefixed URLs must go through the navigation module, never a template literal.
  INLINE_PREFIX=$(grep -rl '`/\${locale}' $SRC_ROOTS 2>/dev/null | grep -v "i18n" || true)
  if [ -z "$INLINE_PREFIX" ]; then
    pass "No inline \`/\${locale}/…\` path building outside the i18n module"
  else
    warn "Inline locale-prefixed paths outside the i18n module: $(echo "$INLINE_PREFIX" | tr '\n' ' ')"
  fi
fi

# 2.5 No flat/dir collision on the Vite variants. `src/i18n.ts` shadows
# `src/i18n/index.ts` in Vite's and Node's resolution order, so leaving both on
# disk means every import silently keeps resolving to the stale flat module.
if [ -f src/i18n.ts ] || [ -f src/i18n.tsx ]; then
  if [ -d src/i18n ]; then
    fail "Both src/i18n.ts and src/i18n/ exist — the flat file shadows the directory"
  else
    warn "Flat src/i18n.ts present — the current reference emits src/i18n/"
  fi
fi
if [ -f src/localePath.ts ]; then
  fail "src/localePath.ts is superseded by the i18n navigation module"
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

    # RSC boundary. `useParams` from next/navigation is client-only via Next's
    # `react-server` export condition, so a Server Component that imports any
    # module transitively pulling it in fails the build — at import time, not
    # invoke time, under both Turbopack and webpack. The App Router therefore
    # needs the hooks in a separate 'use client' module. Verified against
    # Next 16.2.1: combined module fails both bundlers, split passes.
    NAV_PURE=""
    for c in src/i18n/navigation.ts src/i18n/navigation.js i18n/navigation.ts i18n/navigation.js; do
      [ -f "$c" ] && NAV_PURE="$c" && break
    done
    NAV_HOOKS=""
    for c in src/i18n/navigation.hooks.ts src/i18n/navigation.hooks.js i18n/navigation.hooks.ts i18n/navigation.hooks.js; do
      [ -f "$c" ] && NAV_HOOKS="$c" && break
    done

    if [ -z "$NAV_PURE" ]; then
      # Cookie-only routing emits no navigation module at all — nothing to check.
      :
    elif grep -qE "^import .*from '(next/navigation|next/router)'" "$NAV_PURE"; then
      fail "$NAV_PURE imports a client-only Next hook — a Server Component importing it fails the build; split the hooks into navigation.hooks.ts"
    elif grep -qE "^import \{[^}]*\buse[A-Z][A-Za-z]*[^}]*\} from 'react'" "$NAV_PURE"; then
      fail "$NAV_PURE imports a React hook — keep it pure and move the hooks to navigation.hooks.ts"
    else
      pass "Pure navigation module carries no client-hook import"
      if [ -n "$NAV_HOOKS" ]; then
        if head -3 "$NAV_HOOKS" | grep -q "use client"; then
          pass "navigation.hooks module carries the 'use client' directive"
        else
          fail "$NAV_HOOKS holds the navigation hooks but lacks the 'use client' directive"
        fi
      elif grep -rqE "\buseLocalePath\b" app src 2>/dev/null; then
        fail "useLocalePath is used but no navigation.hooks module exists"
      fi
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

  remix-babel-lingui|remix-swc-lingui|react-router-framework-babel-lingui|react-router-framework-swc-lingui)
    # Both stacks put the i18n runtime under app/i18n/.
    if [ -f app/i18n/locales.ts ] || [ -f app/i18n/locales.js ]; then
      pass "app/i18n/locales.ts (shared locale module) exists"
    else
      fail "app/i18n/locales.ts not found — the shared locale module was not emitted"
    fi
    if [ -f app/i18n/locale.server.ts ]; then
      pass "app/i18n/locale.server.ts (server-only cookie/header helpers) exists"
    else
      fail "app/i18n/locale.server.ts not found"
    fi
    # getDirection must NOT be in the .server module — it is stripped from the
    # client bundle, so a dir-sensitive client component could not import it.
    if grep -q "getDirection" app/i18n/locale.server.ts 2>/dev/null; then
      fail "getDirection is in locale.server.ts — client code cannot import it; move it to locales.ts"
    else
      pass "getDirection is not trapped in the server-only module"
    fi
    if grep -q "@lingui/vite-plugin" vite.config.ts 2>/dev/null; then
      pass "@lingui/vite-plugin in vite.config.ts"
    else
      fail "@lingui/vite-plugin not found in vite.config.ts"
    fi
    if grep -rqE "I18nProvider|LinguiClientProvider" app 2>/dev/null; then
      pass "Lingui provider found in app/"
    else
      fail "Lingui provider not found in app/"
    fi
    ;;

  tanstack-start-babel-lingui|tanstack-start-swc-lingui)
    if [ -f src/i18n/locales.ts ] || [ -f src/i18n/locales.js ]; then
      pass "src/i18n/locales.ts (shared locale module) exists"
    else
      fail "src/i18n/locales.ts not found — the shared locale module was not emitted"
    fi
    if [ -f src/start.ts ]; then
      pass "src/start.ts (global request middleware) exists"
    else
      fail "src/start.ts not found — locale middleware not registered"
    fi
    if grep -q "@lingui/vite-plugin" vite.config.ts 2>/dev/null; then
      pass "@lingui/vite-plugin in vite.config.ts"
    else
      fail "@lingui/vite-plugin not found in vite.config.ts"
    fi
    if grep -rqE "I18nProvider|LinguiClientProvider" src 2>/dev/null; then
      pass "Lingui provider found in src/"
    else
      fail "Lingui provider not found in src/"
    fi
    # The i18n module must not import the route tree — that inverts the dependency.
    if grep -rq "routes/__root" src/i18n 2>/dev/null; then
      fail "src/i18n/ imports the route tree — use useParams({ strict: false }) instead"
    else
      pass "src/i18n/ does not depend on the route tree"
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
