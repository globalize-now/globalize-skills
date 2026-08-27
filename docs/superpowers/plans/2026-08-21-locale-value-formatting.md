# Locale-Aware Value Formatting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every one of `globalize-guide`'s 23 stack variants (plus `lovable-i18n`) a generated formatters module with one uniform ten-function surface, point every rules template at it, and add a detection signal plus a Phase 3 pass that rewrites hardcoded formatting toward it.

**Architecture:** One contract, N idioms. Each library's setup reference gains a core `generate_format_helpers` step that writes a formatters module into the target project and records it in `.globalize/format-module.json`; `generate_coding_rules` reads that file back as the `<<formatModule>>` value. The module delegates to the library's own formatter **only where the library adds request-scoped context** (next-intl's `now`/`timeZone`, vue-i18n's named-format registry) and otherwise uses raw `Intl` behind a locale-keyed memo. Every module routes its locale through one `formatLocale()` function — the seam for a future separate regional preference.

**Tech Stack:** Markdown skill references and rules templates; `manifest.json` (validated with `jq`); bash eval verifiers (`evals/*.sh`, bash 3.2 compatible — no associative arrays); `Intl.NumberFormat` / `DateTimeFormat` / `RelativeTimeFormat` / `ListFormat`; per-stack: Lingui 6, next-intl 4, vue-i18n 9/11, Paraglide 2, `chrome.i18n`, Rails I18n + Action View number helpers, `java.text`/`java.time`/`android.icu`, Foundation `FormatStyle`.

**Spec:** `docs/superpowers/specs/2026-08-21-locale-value-formatting-design.md` — read it before Task 1. Executors read both documents.

**Template siblings to copy structure from:** `references/languages/js-ts/libraries/lingui/setup.locale-module.md` (the shared-module idiom: Ownership table, module inventory, numbered sections, a `## N. Self-check` closing section with grep assertions) and `references/languages/js-ts/frameworks/sveltekit/paraglide.setup.md` §"Locale-aware formatting" (the only existing format module — the closest prior art, including its module-scope-memo-is-SSR-safe rationale).

## Global Constraints

- **No new dependencies.** Every formatter is platform-built-in (`Intl`, Foundation, `java.text`/`android.icu`, Action View). `manifest.json` `packages` arrays are **not** touched, and SKILL.md §2.0 is unchanged. If any task finds itself adding a package, stop — that is a design error, not an implementation detail.
- **Pin any package string a skill emits** to a SemVer-major caret (`pkg@^N`, `pkg@^0.M`), single-quoted in shell snippets (`'pkg@^N'`) so zsh `EXTENDED_GLOB` does not eat the caret. Applies to `npx` invocations too. (Constraint inherited from `CLAUDE.md`; this plan should not trigger it.)
- **Rules-template grammar:** one key, one operator, one double-quoted literal per `<!-- if: -->`; no nesting, no `&&`/`||`/`elif`; `<!-- /if -->` required; markers alone on their own line. Placeholders are `<<name>>`, never `{{ }}`.
- **Rules-template self-containment (hard):** a template body must not contain `.claude/`, a `references/…` path, or the literal `globalize-guide`. `evals/verify-rules-template.sh` fails the build on any of these. `<<formatModule>>` resolves to a path in the *user's* project — never into the skill.
- **Every declared `values:` key must be used in the body, and every used `<<key>>` must be declared.** Both directions are hard failures in the linter. Add `formatModule` to `values:` and use it in the same commit — and when rewriting a section **removes** the last use of an existing key (Task 4 deletes a whole branch, which orphans several), delete that key from `values:` in the same commit or the linter fails.
- **A new condition or value is not usable until its library's resolution table teaches the renderer how to resolve it.** `generate_coding_rules` fails closed on an unresolvable key, so every task that adds `formatModule` (all of Tasks 2–9) must also add a `formatModule` row — *read `.globalize/format-module.json` → `.specifier`* — to that library's "Resolve the template's `conditions`/`values`" table, and every task that adds the `ssr` condition (Tasks 2, 3, 4) must add an `ssr` row modelled on the existing Paraglide one. **That table is frequently in a different file from the one that creates the module**, and the second file is easy to miss:

  | Library | Creates the module | Owns the resolution table |
  |---|---|---|
  | lingui | `lingui/setup.locale-module.md` | **`lingui/setup.add-ons.md`** |
  | next-intl | `next-intl/setup.add-ons.md` | same file |
  | vue-i18n | `vue-i18n/setup.shared.md` | same file |
  | paraglide | `sveltekit/paraglide.setup.md` | **`paraglide/setup.add-ons.md`** |
  | webext-native | `webext/webext-native.setup.md` | **`webext/setup.add-ons.md`** |
  | rails | `rails/rails.setup.md` | **`rails/setup.add-ons.md`** |
  | android | `android/native/android-strings.setup.md` | **`android/native/setup.add-ons.md`** |
  | ios | `ios/native/string-catalog.setup.md` | same file |

  `evals/verify-format-helpers.sh` checks the resolution host directly, so a missed row fails that task's own gate.
- **BCP-47 locale variables are named `locale`, never `lang`.** The HTML `lang` attribute and DOM `.lang` property keep their own names.
- **Guided/unguided:** every setup section describes the change and waits for confirmation in guided mode, applies directly in unguided mode, and is independently re-runnable (detect an already-applied state and skip without prompting).
- **Never add a `Co-Authored-By: Claude` trailer** to commits, and never add a "Generated with Claude Code" line to PR bodies.
- **The ten concepts are uniform; the *signatures* are not, on purpose.** `formatLocale` takes the UI locale where the stack has one to hand (`formatLocale(uiLocale)` on Lingui/next-intl/vue-i18n), takes nothing where the module can read it itself (Paraglide's `getLocale()`, webext's `getUILanguage()`, Rails' `I18n.locale`), and takes a `Context` on Android. `getFormatters` is synchronous everywhere except next-intl, whose server formatter API is async and must be `await`ed. Do not "unify" these — each matches how its environment supplies a locale, and forcing one shape would mean lying about one of them.
- **The ten-function surface is fixed and never pruned.** The ten *concepts* are `money`, `number`, `percent`, `compact`, `unit`, `date`, `time`, `dateTime`, `relativeTime`, `list`, plus the `formatLocale` seam. Each stack emits them under **its own language's naming convention** — `format_money` on Rails, `.money` on Swift — and `format-module.json`'s `surface` array holds the **names as actually emitted**, ten of them, one per concept. `evals/verify-format-helpers.sh --project` greps the module file for every entry in `surface`, so the array and the file cannot drift. A setup step that emits nine leaves the generated rules file documenting a function that does not exist.

## Locked decisions made during planning

These refine the spec. Surface them in the PR body.

1. **Lingui uses raw `Intl` behind a locale-keyed memo, not `i18n.number()`/`i18n.date()`.** The spec's per-environment table says "delegates to `i18n.number()` / `i18n.date()`". Refined: `Intl.RelativeTimeFormat` and `Intl.ListFormat` have no Lingui equivalent, so four of the ten functions would use raw `Intl` regardless. Routing all ten through one memo keyed by locale is simpler than a split cache, and a locale-keyed memo holds no request state — the identical argument `paraglide.setup.md` already makes for its own memo. **The SSR-safety property is preserved by where the locale comes from** (`useLingui()` context, re-rendering on locale change), not by which formatter object does the work. Delegation is kept only where the library adds something raw `Intl` cannot: next-intl (`now`, `timeZone`) and vue-i18n (the named-format registry that makes `$n(x, 'currency')` work in templates).
2. **`locales.ts` gains `DEFAULT_CURRENCY` and `DATE_PRESETS`; the existing `CURRENCY`/`DATE_SHORT`/`DATE_MEDIUM`/`DATE_TIME` exports stay as deprecated aliases.** Same reasoning as the Paraglide aliases in the spec: the module is generated into user repos and a re-run overwrites it.
3. **TypeScript `lib` floor is a real gate.** `Intl.ListFormat` types live in `es2021.intl`; `Intl.RelativeTimeFormat`, `notation: 'compact'` and `style: 'unit'` live in `es2020.intl`. Every JS/TS setup step must check `tsconfig.json` `compilerOptions.lib`/`target` and surface a needs-decision rather than emitting a module that fails `tsc`.
4. **`evals/verify-format-helpers.sh` is red from Task 1 until Task 9.** It globs all eight rules templates, so coverage cannot be silently forgotten. Each task states the exact expected pass/fail counts. `evals/verify-rules-template.sh` stays **green throughout** and is the regression guard.

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `evals/verify-format-helpers.sh` | Static: lint the 8 (rules template, setup reference) pairs for the format contract. Project: lint a rendered `.globalize/format-module.json` + module | Create |
| `skills/globalize-guide/references/rules-template-format.md` | Document `.globalize/format-module.json` and the `formatModule` value in the rendering contract | Modify |
| `…/js-ts/libraries/lingui/setup.locale-module.md` | Own `<i18nDir>/format.ts` (canonical module); `DEFAULT_CURRENCY`/`DATE_PRESETS` in `locales.ts` | Modify |
| `…/js-ts/libraries/lingui/rules.template.md` | Formatting section → `<<formatModule>>`; relative time / lists / units; `ssr` blocks | Modify |
| `…/js-ts/libraries/next-intl/setup.add-ons.md` | New **Core step 0**: `<i18nDir>/format.ts` + named formats + `now`/`timeZone` | Modify |
| `…/js-ts/libraries/next-intl/rules.template.md` | Same rewrite | Modify |
| `…/js-ts/libraries/vue-i18n/setup.shared.md` | `<i18nDir>/format.ts` composable + `numberFormats`/`datetimeFormats` for every locale | Modify |
| `…/js-ts/libraries/vue-i18n/rules.template.md` | Same rewrite | Modify |
| `…/js-ts/frameworks/sveltekit/paraglide.setup.md` | Extend the existing module to the ten-function surface + aliases | Modify |
| `…/js-ts/libraries/paraglide/rules.template.md` | Same rewrite | Modify |
| `…/js-ts/frameworks/webext/webext-native.setup.md` | `src/i18n/format.ts`; `formatLocale()` over `getUILanguage()` / storage | Modify |
| `…/js-ts/frameworks/webext/webext-native.rules.template.md` | Same rewrite | Modify |
| `…/ruby/frameworks/rails/rails.setup.md` | `app/helpers/format_helper.rb` + `number.*` / `date.formats` / `support.array` keys | Modify |
| `…/ruby/frameworks/rails/rails.rules.template.md` | Same rewrite | Modify |
| `…/android/native/android-strings.setup.md` | `Formatters.kt` + Compose `LocalFormatters`, minSdk-branched | Modify |
| `…/android/native/android-strings.rules.template.md` | Same rewrite | Modify |
| `…/ios/native/string-catalog.setup.md` | `Formatters.swift` — `FormatStyle` extensions | Modify |
| `…/ios/native/string-catalog.rules.template.md` | Same rewrite | Modify |
| `…/js-ts/convert.format-pass.md` | Shared Phase 3 pass: find hardcoded formatting, rewrite toward the module | Create |
| `skills/globalize-guide/manifest.json` | Add `convert.format-pass.md` to `references.convert` on 18 JS/TS variants | Modify |
| `skills/globalize-guide/SKILL.md` | `formatCandidateFiles`; `generate_format_helpers` in Phase 2 + collapse-case; §3.2 / §3.5 / §3.5.1 | Modify |
| `skills/lovable-i18n/SKILL.md` | Single-file equivalent: module, AGENTS.md rules section, wrap-phase sweep | Modify |
| `CLAUDE.md` | Delivery-mechanisms section: note the generated format module | Modify |

---

## Task 1: The verifier (`evals/verify-format-helpers.sh`) + the `format-module.json` contract

**Files:**
- Create: `evals/verify-format-helpers.sh`
- Modify: `skills/globalize-guide/references/rules-template-format.md`

**Interfaces:**
- Produces: `evals/verify-format-helpers.sh` with two modes — no args (static, lints the 8 pairs) and `--project <path>`. Exit 0 = all checks passed, 1 = failures, 2 = usage error. Every later task runs it.
- Produces: the `.globalize/format-module.json` schema — `{ specifier, path, surface, defaultCurrency, currencySource }` — which every setup task writes and `generate_coding_rules` reads.

- [ ] **Step 1: Write the failing test**

```bash
test -x evals/verify-format-helpers.sh && echo PASS || echo FAIL
```

Expected now: `FAIL` (file absent).

- [ ] **Step 2: Create `evals/verify-format-helpers.sh`**

Model it on `evals/verify-rules-template.sh` — same `set -uo pipefail`, same `pass`/`fail`/`warn`/`info` counters, same `--- Verification Report ---` footer, same exit codes, **bash 3.2 compatible** (no associative arrays, no `mapfile`).

```bash
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
  for key in specifier path surface defaultCurrency; do
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
```

- [ ] **Step 3: Make it executable and run it — expect a fully red board**

```bash
chmod +x evals/verify-format-helpers.sh
./evals/verify-format-helpers.sh; echo "exit=$?"
```

Expected: `exit=1`, with `INFO: pairs checked: 8` and a non-zero `Failed:` count.

**Do not assert a specific total.** The per-pair failure count is not uniform: the Paraglide template already declares and uses `<<formatModule>>`, and several setup references already contain some of the surface tokens in unrelated prose, so those checks start green. Each later task asserts **zero failures for its own pair**, which is the gate that matters.

Two things must hold in this first run, and both are cheap to check by eye:

- **No pair reports `not found`.** All 16 referenced files exist today. A `not found` means a path in `PAIRS` is wrong — fix it now, before any content task depends on it.
- **Record the per-pair failure counts** into the ledger, so each later task can confirm it moved its own pair to zero rather than trusting a predicted number:

```bash
./evals/verify-format-helpers.sh 2>&1 | awk '/^--- Pair: /{p=$3} /^  FAIL/{c[p]++} END{for (k in c) print k, c[k]}' | sort
```

- [ ] **Step 4: Confirm the existing linter is still green**

```bash
./evals/verify-rules-template.sh >/dev/null; echo "exit=$?"
```

Expected: `exit=0`. This must stay 0 after **every** task in this plan.

- [ ] **Step 5: Document the contract in `rules-template-format.md`**

In the `## Rendering` section, insert a new step between the current steps 1 and 2, and renumber the rest:

> 2. Read `.globalize/format-module.json`, written by the `generate_format_helpers` step that ran immediately before this one. It carries `{ specifier, path, surface, defaultCurrency, currencySource }`. `specifier` is the value of `<<formatModule>>`. If the file is absent, `generate_format_helpers` did not complete — **fail closed** (below) rather than guessing an import path; a rules file that tells the agent to import from a module that does not exist is worse than no rules file.

Then add a subsection after `### Generated-file header`:

> ### `.globalize/format-module.json`
>
> ```json
> { "specifier": "@/i18n/format",
>   "path": "src/i18n/format.ts",
>   "surface": ["money","number","percent","compact","unit","date","time","dateTime","relativeTime","list"],
>   "defaultCurrency": "EUR",
>   "currencySource": "grep:src/checkout/price.ts:12" }
> ```
>
> `specifier` is what an import statement in the target project would name — the project's path alias (`@/`, `~/`) when `tsconfig.json` declares one in `compilerOptions.paths`, otherwise a relative specifier. On stacks with no import statement (Rails helpers, Swift same-module extensions) it is the human-readable location the rules file names instead. `path` is repo-relative and is what `evals/verify-format-helpers.sh --project` resolves.
>
> `surface` always has exactly ten entries, one per concept, **spelled as the module actually spells them** — `["money", …]` in TypeScript and Kotlin, `["format_money", …]` on Rails, the Swift style and function names on Apple targets. The verifier greps the module file for each entry, so the array is a claim the file must back. It is never pruned: a stack that cannot implement a concept emits a loudly-failing stub and still lists it.
>
> `currencySource` records *why* `defaultCurrency` was chosen — a `grep:<file>:<line>` hit, or `default` when nothing was findable and `USD` was assumed.
>
> **Where the format contract is enforced.** All of it lives in `evals/verify-format-helpers.sh`, not split across the two verifiers. `verify-rules-template.sh` keeps its existing job — grammar, self-containment, declared-vs-used in both directions — and the `formatModule` value it now sees is covered for free by its used-⊆-declared and declared-⊆-used checks.

- [ ] **Step 6: Verify the docs change**

```bash
grep -c 'format-module.json' skills/globalize-guide/references/rules-template-format.md
```

Expected: exactly `2` — the new rendering step and the new subsection heading. (`grep -c` counts matching *lines*, not occurrences.) A higher count means prose was padded to satisfy the check; a lower one means a section is missing.

- [ ] **Step 7: Commit**

```bash
git add evals/verify-format-helpers.sh skills/globalize-guide/references/rules-template-format.md
git commit -m "test(evals): add verify-format-helpers.sh and document format-module.json

The verifier is red on all eight pairs by design; Tasks 2-9 turn them green."
```

---

## Task 2: Lingui — the canonical module (11 variants)

**Files:**
- Modify: `skills/globalize-guide/references/languages/js-ts/libraries/lingui/setup.locale-module.md`
- Modify: `skills/globalize-guide/references/languages/js-ts/libraries/lingui/rules.template.md`

**Interfaces:**
- Consumes: the `.globalize/format-module.json` schema from Task 1.
- Produces: the **canonical** `format.ts` — `formatLocale(uiLocale)`, `createFormatters(uiLocale)`, `useFormatters()`, `getFormatters`, `pickRelativeUnit(deltaMs)`, type `Formatters`, type `DateInput`. Tasks 5 and 6 (Paraglide, webext-native) reuse `createFormatters`/`pickRelativeUnit` verbatim and replace only the locale source; they cite this file rather than re-deriving it.
- Produces: `locales.ts` gains `DEFAULT_CURRENCY: string` and `DATE_PRESETS: Record<'short'|'medium'|'long', Intl.DateTimeFormatOptions>` plus `export type DatePreset`.

- [ ] **Step 1: Write the failing test**

```bash
./evals/verify-format-helpers.sh 2>&1 | sed -n '/--- Pair: lingui ---/,/--- Pair: next-intl ---/p' | grep -c '^  FAIL'
```

Expected now: a non-zero count (the exact number varies by pair — see the per-pair baseline the ledger recorded in Task 1). The gate is that it reaches `0` at the end of this task.

- [ ] **Step 2: Extend `locales.ts` in `setup.locale-module.md` §3**

In the fenced `locales.ts` sample, replace the "Shared format presets" block with:

```ts
/** The project's currency. Formatting follows the locale; the currency follows the data. */
export const DEFAULT_CURRENCY = 'USD'   // adjust to this project's currency

export type DatePreset = 'short' | 'medium' | 'long'

/** Date presets, consumed by format.ts. Trim to what this codebase actually formats. */
export const DATE_PRESETS: Record<DatePreset, Intl.DateTimeFormatOptions> = {
  short: { dateStyle: 'short' },
  medium: { dateStyle: 'medium' },
  long: { dateStyle: 'long' },
}

/** @deprecated Kept so an earlier setup's call sites keep compiling. Use format.ts instead. */
export const CURRENCY: Intl.NumberFormatOptions = { style: 'currency', currency: DEFAULT_CURRENCY }
/** @deprecated Use `useFormatters().date(v, 'short')`. */
export const DATE_SHORT: Intl.DateTimeFormatOptions = DATE_PRESETS.short
/** @deprecated Use `useFormatters().date(v)`. */
export const DATE_MEDIUM: Intl.DateTimeFormatOptions = DATE_PRESETS.medium
/** @deprecated Use `useFormatters().dateTime(v)`. */
export const DATE_TIME: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }
```

Keep the existing paragraph about grepping for the project's real currency, retargeted at `DEFAULT_CURRENCY`. Update the **Module inventory** table's `locales.ts` row to list `DEFAULT_CURRENCY`, `DATE_PRESETS`, `DatePreset` alongside the existing exports, and add a new row:

| `<i18nDir>/format.ts` | this file | `formatLocale`, `createFormatters`, `useFormatters`, `getFormatters`, `Formatters`, `DateInput` |

Replace the §"Why these live here rather than at each call site" bullet about format presets with the Locked-decision-1 rationale: the presets are now consumed by `format.ts`; the module-scope memo caches `Intl` instances keyed by locale and holds no request state, so it is safe under SSR — the rule it does not break is "never cache the *locale* at module scope", which would pin one request's locale onto every later one.

- [ ] **Step 3: Add a new section `## 4. Create `<i18nDir>/format.ts` (`generate_format_helpers`)`** and renumber the existing §4 and §5

Author the section with this module verbatim, and state that it is **always** created, on every variant and under every routing strategy — like `locales.ts`, and for the same reason: Phase 3 rewrites hardcoded formatting toward it.

```ts
// <i18nDir>/format.ts
import { useMemo } from 'react'
import { useLingui } from '@lingui/react'
import { DEFAULT_CURRENCY, DATE_PRESETS, type DatePreset } from './locales'

export type DateInput = Date | number | string

export type Formatters = {
  money(amount: number, currency?: string): string
  number(value: number, opts?: Intl.NumberFormatOptions): string
  percent(value: number): string
  compact(value: number): string
  unit(value: number, unit: string): string
  date(value: DateInput, preset?: DatePreset): string
  time(value: DateInput): string
  dateTime(value: DateInput): string
  relativeTime(value: DateInput, now?: DateInput): string
  list(items: string[], type?: 'and' | 'or'): string
}

/**
 * THE SEAM. Formatting follows the UI locale today. To give this project a
 * separate regional preference — an English UI that still renders 1.234,56 € —
 * change this one function. Every formatter reads its locale from here.
 */
export function formatLocale(uiLocale: string): string {
  return uiLocale
}

/** Intl instances keyed by locale + kind. Holds no request state, so it is safe under SSR. */
const memo = new Map<string, unknown>()
function cached<T>(key: string, make: () => T): T {
  let f = memo.get(key) as T | undefined
  if (f === undefined) memo.set(key, (f = make()))
  return f
}

const toDate = (v: DateInput): Date => (v instanceof Date ? v : new Date(v))

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['second', 1000],
  ['minute', 60_000],
  ['hour', 3_600_000],
  ['day', 86_400_000],
  ['week', 604_800_000],
  ['month', 2_629_746_000],
  ['year', 31_556_952_000],
]

/** Largest unit whose magnitude is at least 1; falls back to seconds. */
export function pickRelativeUnit(deltaMs: number): [Intl.RelativeTimeFormatUnit, number] {
  const abs = Math.abs(deltaMs)
  for (let i = UNITS.length - 1; i >= 0; i--) {
    const [unit, ms] = UNITS[i]
    if (abs >= ms || i === 0) return [unit, Math.round(deltaMs / ms)]
  }
  return ['second', 0]
}

export function createFormatters(uiLocale: string): Formatters {
  const locale = formatLocale(uiLocale)
  const nf = (key: string, opts: Intl.NumberFormatOptions) =>
    cached(`n:${locale}:${key}`, () => new Intl.NumberFormat(locale, opts))
  const df = (key: string, opts: Intl.DateTimeFormatOptions) =>
    cached(`d:${locale}:${key}`, () => new Intl.DateTimeFormat(locale, opts))

  return {
    money: (amount, currency = DEFAULT_CURRENCY) =>
      nf(`cur:${currency}`, { style: 'currency', currency }).format(amount),
    number: (value, opts) =>
      opts
        ? new Intl.NumberFormat(locale, opts).format(value)
        : nf('dec', { style: 'decimal' }).format(value),
    percent: (value) => nf('pct', { style: 'percent' }).format(value),
    compact: (value) => nf('cmp', { notation: 'compact' }).format(value),
    unit: (value, unit) => nf(`unit:${unit}`, { style: 'unit', unit }).format(value),
    date: (value, preset = 'medium') =>
      df(`p:${preset}`, DATE_PRESETS[preset]).format(toDate(value)),
    time: (value) => df('t', { timeStyle: 'short' }).format(toDate(value)),
    dateTime: (value) =>
      df('dt', { dateStyle: 'medium', timeStyle: 'short' }).format(toDate(value)),
    relativeTime: (value, now) => {
      const from = now === undefined ? Date.now() : toDate(now).getTime()
      const [unit, amount] = pickRelativeUnit(toDate(value).getTime() - from)
      return cached(`r:${locale}`, () =>
        new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }),
      ).format(amount, unit)
    },
    list: (items, type = 'and') =>
      cached(`l:${locale}:${type}`, () =>
        new Intl.ListFormat(locale, {
          style: 'long',
          type: type === 'or' ? 'disjunction' : 'conjunction',
        }),
      ).format(items),
  }
}

/** In components. Reads the locale from context, so it re-renders on locale change. */
export function useFormatters(): Formatters {
  const { i18n } = useLingui()
  return useMemo(() => createFormatters(i18n.locale), [i18n.locale])
}

/** In loaders, server code, route handlers and tests — anywhere there is no React context. */
export const getFormatters = createFormatters
```

The section must also carry, in prose:

- **Why the locale comes from `useLingui()` and not from the module-scope `i18n` singleton.** Reading the singleton at module scope pins one request's locale onto every later request on every server-rendering variant. `useLingui()` reads it from `<I18nProvider>` context, which is per-render. This is the point of the hook; do not "simplify" it to a module-scope read.
- **Resolve `DEFAULT_CURRENCY` before writing `locales.ts`**, by grepping for an existing `currency:` option, an `Intl.NumberFormat` / `toLocaleString` call, or a hardcoded symbol. Record the hit as `currencySource` (`grep:<file>:<line>`); when nothing is findable leave `'USD'`, keep the `// adjust to this project's currency` comment, and record `currencySource: "default"`.
- **The TypeScript `lib` gate.** `Intl.ListFormat` needs `es2021.intl`; `Intl.RelativeTimeFormat`, `notation: 'compact'` and `style: 'unit'` need `es2020.intl`. Read `tsconfig.json` `compilerOptions.lib` (falling back to what `target` implies). If it resolves below `ES2021`, do **not** silently emit a module that fails `tsc` — write `status: "needs_decision"` with:

  ```json
  { "step": "format_module_ts_lib",
    "question": "format.ts needs Intl.ListFormat/RelativeTimeFormat types, which require tsconfig lib ES2021 or later (this project resolves to <current>). Raise lib to ES2021, or omit list() and relativeTime()?",
    "options": ["raise_lib", "omit_two"] }
  ```

  and stop. On `omit_two` the surface still has ten entries in `format-module.json`; the two omitted ones are emitted as `throw new Error('list() requires tsconfig lib ES2021')` stubs so the contract holds and the failure is loud rather than silent.
- **If `<i18nDir>/format.ts` already exists as project code, do not overwrite it** — add the exports into it, or create `<i18nDir>/i18n-format.ts` instead. Either way record the specifier actually used.
- **Write `.globalize/format-module.json`** with `specifier` (the project's alias when `tsconfig.json` declares one in `compilerOptions.paths`, else a relative specifier — check, do not assume `@/`), `path`, the ten-entry `surface`, `defaultCurrency` and `currencySource`. `generate_coding_rules` reads it back as `<<formatModule>>`.

Extend the file's closing `## Self-check` section with:

```bash
# Exactly one Intl construction site outside the format module.
grep -rn "new Intl\." <source root> | grep -v "/i18n/format" | grep -v "/i18n/locales"   # → no output
# The contract artifact exists and lists ten functions.
jq -e '.surface | length == 10' .globalize/format-module.json
```

- [ ] **Step 4: Rewrite the formatting section of `lingui/rules.template.md`**

Add `formatModule` to the `values:` list and `ssr` to the `conditions:` list in the frontmatter. Replace the whole `## Numbers, currencies, dates` section with a section that:

- Opens imperatively: never hardcode a formatted number, currency symbol or date string; never construct `Intl` at a call site. Import the project's formatters from `<<formatModule>>`.
- Shows the two access forms:

  ```tsx
  import { useFormatters } from '<<formatModule>>'
  const f = useFormatters()
  f.money(amount)            // in components
  ```

  ```ts
  import { getFormatters } from '<<formatModule>>'
  const f = getFormatters(locale)   // loaders, route handlers, server code, tests
  ```
- Lists all ten with a one-line example each: `money`, `number`, `percent`, `compact`, `unit`, `date` (`'short'|'medium'|'long'`), `time`, `dateTime`, `relativeTime`, `list`.
- **Currency comes from the data, not the reader.** `f.money(amount)` uses the project default; when a record carries its own currency, pass it: `f.money(order.total, order.currency)`. Never derive a currency code from the locale — that relabels a dollar price as euros for a German reader.
- **Needs a format the module has no preset for?** Add it to the module. A date style or currency code written out at two call sites will drift.
- Keeps the placeholder-naming interaction, which is unchanged and load-bearing: `f.money(...)` is a function call, so `` t`Total: ${f.money(amount)}` `` extracts as positional `{0}`. Name it — `` t`Total: ${ph({ total: f.money(amount) })}` `` — and cross-reference the existing "Naming placeholders" section.
- **Flag for review:** `toFixed()`, a currency symbol concatenated with a number (`'$' + price`), date format strings like `'MM/DD/YYYY'`, `new Date().toLocaleDateString()` with no explicit locale, and any `new Intl.` outside the format module.
- Adds the two `ssr`-gated blocks (both `<!-- if: ssr == "true" -->` … `<!-- /if -->`, siblings, not nested):

  ```
  <!-- if: ssr == "true" -->
  **Time zone.** `Intl.DateTimeFormat` uses the *runtime's* zone, so the server renders in the
  deploy region's zone and the browser in the reader's — a hydration mismatch that never appears
  in development. Render time-of-day in a client component, or pin an explicit `timeZone` in the
  module's date presets.

  **`relativeTime` needs an explicit `now` under SSR.** Server and client evaluate `Date.now()`
  at different instants and eventually land on different sides of a threshold. Pass a shared
  reference instant — `f.relativeTime(postedAt, pageRenderedAt)` — or render it client-side only.
  <!-- /if -->
  ```
- Bumps `budget:` — measure the rendered worst case (`ssr == "true"`) by hand and set the number to that count plus a small margin.

- [ ] **Step 5: Run the tests**

```bash
./evals/verify-format-helpers.sh 2>&1 | sed -n '/--- Pair: lingui ---/,/--- Pair: next-intl ---/p' | grep -c '^  FAIL'
./evals/verify-rules-template.sh >/dev/null; echo "rules-template exit=$?"
```

Expected: `0` failures for the lingui pair, and `rules-template exit=0`. The overall `verify-format-helpers.sh` exit stays `1` — seven pairs to go.

- [ ] **Step 6: Commit**

```bash
git add skills/globalize-guide/references/languages/js-ts/libraries/lingui/
git commit -m "feat(globalize-guide): generate a formatters module for Lingui stacks

Adds <i18nDir>/format.ts with the ten-function surface behind a formatLocale()
seam, and points the Lingui coding rules at it. Covers all 11 Lingui variants."
```

---

## Task 3: next-intl (3 variants)

**Files:**
- Modify: `skills/globalize-guide/references/languages/js-ts/libraries/next-intl/setup.add-ons.md`
- Modify: `skills/globalize-guide/references/languages/js-ts/libraries/next-intl/rules.template.md`

**Interfaces:**
- Consumes: the `format-module.json` schema (Task 1); the ten-function `Formatters` type and `pickRelativeUnit` from the canonical Lingui module (Task 2) — cite `setup.locale-module.md` §4 as the shape to match, then implement the next-intl delegation below.
- Produces: `<i18nDir>/format.ts` exporting `useFormatters()` and `getFormatters()` (async).

- [ ] **Step 1: Write the failing test**

```bash
./evals/verify-format-helpers.sh 2>&1 | sed -n '/--- Pair: next-intl ---/,/--- Pair: vue-i18n ---/p' | grep -c '^  FAIL'
```

Expected now: a non-zero count (the exact number varies by pair — see the per-pair baseline the ledger recorded in Task 1). The gate is that it reaches `0` at the end of this task.

- [ ] **Step 2: Add `## Core step 0: generate the format helpers (`generate_format_helpers` — always runs)`** at the top of `setup.add-ons.md`, before the existing Core step 1

next-intl is the one stack where delegation is worth it: `useFormatter()` carries the request's `now` and `timeZone`, which raw `Intl` cannot see. The module wraps it rather than replacing it.

```ts
// <i18nDir>/format.ts
import { useFormatter } from 'next-intl'
import { getFormatter } from 'next-intl/server'

export type DateInput = Date | number | string
export const DEFAULT_CURRENCY = 'USD'   // adjust to this project's currency

export type Formatters = {
  money(amount: number, currency?: string): string
  number(value: number, opts?: Intl.NumberFormatOptions): string
  percent(value: number): string
  compact(value: number): string
  unit(value: number, unit: string): string
  date(value: DateInput, preset?: 'short' | 'medium' | 'long'): string
  time(value: DateInput): string
  dateTime(value: DateInput): string
  relativeTime(value: DateInput, now?: DateInput): string
  list(items: string[], type?: 'and' | 'or'): string
}

/**
 * THE SEAM. next-intl resolves the locale for us, so there is nothing to override
 * here today. To give this project a separate regional preference, stop calling
 * next-intl's formatter and build an Intl-based one against a locale chosen here.
 */
export function formatLocale(uiLocale: string): string {
  return uiLocale
}

const toDate = (v: DateInput): Date => (v instanceof Date ? v : new Date(v))

type NextFormatter = ReturnType<typeof useFormatter>

function bind(format: NextFormatter): Formatters {
  return {
    money: (amount, currency = DEFAULT_CURRENCY) =>
      format.number(amount, { style: 'currency', currency }),
    number: (value, opts) => format.number(value, opts),
    percent: (value) => format.number(value, { style: 'percent' }),
    compact: (value) => format.number(value, { notation: 'compact' }),
    unit: (value, unit) => format.number(value, { style: 'unit', unit }),
    date: (value, preset = 'medium') => format.dateTime(toDate(value), preset),
    time: (value) => format.dateTime(toDate(value), 'time'),
    dateTime: (value) => format.dateTime(toDate(value), 'dateTime'),
    // Uses next-intl's request-scoped `now` when the second argument is omitted,
    // which is what keeps server and client on one reference instant.
    relativeTime: (value, now) =>
      format.relativeTime(toDate(value), now === undefined ? undefined : toDate(now)),
    list: (items, type = 'and') => format.list(items, type) as string,
  }
}

/** In components — Client and Server alike. */
export function useFormatters(): Formatters {
  return bind(useFormatter())
}

/** In non-component async code: generateMetadata, route handlers, server actions. */
export async function getFormatters(): Promise<Formatters> {
  return bind(await getFormatter())
}
```

The section must also carry, in prose:

- **Register the named formats the module calls by name.** `date`, `time`, `dateTime` and `list` above pass preset *names*, which only resolve if they are registered. Add to the object `getRequestConfig` returns (App Router) or the `formats` prop of `<NextIntlClientProvider>` in `_app.tsx` (Pages Router):

  ```ts
  formats: {
    dateTime: {
      short: { dateStyle: 'short' },
      medium: { dateStyle: 'medium' },
      long: { dateStyle: 'long' },
      time: { timeStyle: 'short' },
      dateTime: { dateStyle: 'medium', timeStyle: 'short' },
    },
    list: { and: { style: 'long', type: 'conjunction' },
            or:  { style: 'long', type: 'disjunction' } },
  }
  ```

  An unregistered name does not throw — it falls back to defaults, so this is a silent failure. Verify by rendering one of each.
- **Set `timeZone` and `now` in the same config object**, and say why: `timeZone` otherwise "defaults to the server's time zone", and `now: new Date()` gives server and client one shared reference instant for `relativeTime`. Both are the request-scoped context that makes wrapping `useFormatter()` worth more than raw `Intl`.
- The same `DEFAULT_CURRENCY` grep-and-record rule as Task 2, the same "do not overwrite existing project code at that path" rule, and the same `.globalize/format-module.json` write.
- The TypeScript `lib` gate does **not** apply here — every call goes through next-intl's own typed formatter, not through `Intl.ListFormat` directly. State this so a later reader does not add a gate that cannot fire.

- [ ] **Step 3: Rewrite the formatting section of `next-intl/rules.template.md`**

Add `formatModule` to `values:`. The template already declares `router`; add `ssr` to `conditions:`. Replace `## Numbers, currencies, dates` with the same ten-function section as Task 2, retargeted:

- `import { useFormatters } from '<<formatModule>>'` in components; `const f = await getFormatters()` in `generateMetadata`, route handlers and server actions — **`await` it**, matching the existing rule that next-intl's server APIs throw when used unawaited.
- Keep the existing named-formats guidance but reframe it: the presets are registered by setup and consumed by the module; add new ones there, not at a call site.
- Currency-from-data rule, "flag for review" list, and the two `ssr`-gated blocks — with the next-intl-specific fix named in each: use the request config's `timeZone` and `now` rather than a local constant.
- Bump `budget:`.

- [ ] **Step 4: Run the tests**

```bash
./evals/verify-format-helpers.sh 2>&1 | sed -n '/--- Pair: next-intl ---/,/--- Pair: vue-i18n ---/p' | grep -c '^  FAIL'
./evals/verify-rules-template.sh >/dev/null; echo "rules-template exit=$?"
```

Expected: `0` and `rules-template exit=0`.

- [ ] **Step 5: Commit**

```bash
git add skills/globalize-guide/references/languages/js-ts/libraries/next-intl/
git commit -m "feat(globalize-guide): generate a formatters module for next-intl stacks

Wraps useFormatter()/getFormatter() so the request-scoped now and timeZone are
preserved, and registers the named formats the module calls by name."
```

---

## Task 4: vue-i18n (3 variants)

**Files:**
- Modify: `skills/globalize-guide/references/languages/js-ts/libraries/vue-i18n/setup.shared.md`
- Modify: `skills/globalize-guide/references/languages/js-ts/libraries/vue-i18n/rules.template.md`

**Interfaces:**
- Consumes: the `format-module.json` schema (Task 1); the `Formatters` shape from Task 2.
- Produces: `<i18nDir>/format.ts` exporting `useFormatters()` (a composable).

- [ ] **Step 1: Write the failing test**

```bash
./evals/verify-format-helpers.sh 2>&1 | sed -n '/--- Pair: vue-i18n ---/,/--- Pair: paraglide ---/p' | grep -c '^  FAIL'
```

Expected now: a non-zero count (the exact number varies by pair — see the per-pair baseline the ledger recorded in Task 1). The gate is that it reaches `0` at the end of this task.

- [ ] **Step 2: Add a `## Format helpers (`generate_format_helpers`)` section to `setup.shared.md`**

vue-i18n's `n()`/`d()` are worth delegating to because they resolve the named-format registry, which is what makes `$n(x, 'currency')` work in a template. It has **no list and no relative-time API**, so those four come from raw `Intl`.

```ts
// <i18nDir>/format.ts
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export type DateInput = Date | number | string
export const DEFAULT_CURRENCY = 'USD'   // adjust to this project's currency

/** THE SEAM. Change this one function to format against something other than the UI locale. */
export function formatLocale(uiLocale: string): string {
  return uiLocale
}

const memo = new Map<string, unknown>()
function cached<T>(key: string, make: () => T): T {
  let f = memo.get(key) as T | undefined
  if (f === undefined) memo.set(key, (f = make()))
  return f
}

const toDate = (v: DateInput): Date => (v instanceof Date ? v : new Date(v))

// Identical to the unit table in the canonical module — see the Lingui shared
// reference. Kept inline because this file must stand alone in the user's repo.
const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['second', 1000], ['minute', 60_000], ['hour', 3_600_000], ['day', 86_400_000],
  ['week', 604_800_000], ['month', 2_629_746_000], ['year', 31_556_952_000],
]

export function pickRelativeUnit(deltaMs: number): [Intl.RelativeTimeFormatUnit, number] {
  const abs = Math.abs(deltaMs)
  for (let i = UNITS.length - 1; i >= 0; i--) {
    const [unit, ms] = UNITS[i]
    if (abs >= ms || i === 0) return [unit, Math.round(deltaMs / ms)]
  }
  return ['second', 0]
}

export function useFormatters() {
  const { n, d, locale } = useI18n()
  const active = computed(() => formatLocale(locale.value))

  return {
    // Registered named formats — see the numberFormats/datetimeFormats block below.
    money: (amount: number, currency?: string) =>
      currency ? n(amount, { style: 'currency', currency }) : n(amount, 'currency'),
    number: (value: number, opts?: Intl.NumberFormatOptions) =>
      opts ? n(value, opts) : n(value, 'decimal'),
    percent: (value: number) => n(value, 'percent'),
    compact: (value: number) => n(value, 'compact'),
    unit: (value: number, unit: string) => n(value, { style: 'unit', unit }),
    date: (value: DateInput, preset: 'short' | 'medium' | 'long' = 'medium') =>
      d(toDate(value), preset),
    time: (value: DateInput) => d(toDate(value), 'time'),
    dateTime: (value: DateInput) => d(toDate(value), 'dateTime'),
    // vue-i18n has no relative-time API.
    relativeTime: (value: DateInput, now?: DateInput) => {
      const from = now === undefined ? Date.now() : toDate(now).getTime()
      const [unit, amount] = pickRelativeUnit(toDate(value).getTime() - from)
      return cached(`r:${active.value}`, () =>
        new Intl.RelativeTimeFormat(active.value, { numeric: 'auto' }),
      ).format(amount, unit)
    },
    // vue-i18n has no list API.
    list: (items: string[], type: 'and' | 'or' = 'and') =>
      cached(`l:${active.value}:${type}`, () =>
        new Intl.ListFormat(active.value, {
          style: 'long', type: type === 'or' ? 'disjunction' : 'conjunction',
        }),
      ).format(items),
  }
}
```

The section must also carry, in prose:

- **Register the presets for the source locale *and every target locale*.** A name that is not registered for the active locale silently falls back to browser defaults, and a currency call with no registered currency format emits no currency symbol at all. Show the block that goes on the i18n instance, generated for every configured locale:

  ```ts
  const numberFormats = {
    en: {
      currency: { style: 'currency', currency: DEFAULT_CURRENCY },
      decimal: { style: 'decimal' },
      percent: { style: 'percent' },
      compact: { notation: 'compact' },
    },
    // …the identical block for every target locale
  }
  const datetimeFormats = {
    en: {
      short: { dateStyle: 'short' },
      medium: { dateStyle: 'medium' },
      long: { dateStyle: 'long' },
      time: { timeStyle: 'short' },
      dateTime: { dateStyle: 'medium', timeStyle: 'short' },
    },
    // …the identical block for every target locale
  }
  ```
- **Use the same currency code in every locale's entry.** vue-i18n's own documentation registers `USD` under `en-US` and `JPY` under `ja-JP`; copying that pattern *converts* a price rather than formatting it, and a German reader sees a dollar amount relabelled as euros. The locale decides formatting; the data decides the currency. This is the single most important sentence in the section.
- The same `DEFAULT_CURRENCY` grep-and-record rule, the same "do not overwrite project code", the same `.globalize/format-module.json` write, and the same TypeScript `lib` gate as Task 2 (`relativeTime` and `list` use raw `Intl` here, so the gate **does** apply).

- [ ] **Step 3: Rewrite the formatting section of `vue-i18n/rules.template.md`**

Add `formatModule` to `values:` and `ssr` to `conditions:`. The template currently carries two mutually exclusive branches — one for "named formats registered", one for "this project registers no named formats". **Delete the second branch entirely**: setup now always registers them, so the branch describes a state that can no longer exist, and every unreachable branch is context cost forever. Rewrite the surviving section around `<<formatModule>>` with the ten functions, the currency-from-data rule (naming the per-locale-currency trap explicitly), the "flag for review" list extended with `new Intl.NumberFormat(...)` called inside a component, and the two `ssr` blocks. Keep the existing rule about not concatenating locale-formatted substrings into messages. Bump `budget:`.

- [ ] **Step 4: Run the tests**

```bash
./evals/verify-format-helpers.sh 2>&1 | sed -n '/--- Pair: vue-i18n ---/,/--- Pair: paraglide ---/p' | grep -c '^  FAIL'
./evals/verify-rules-template.sh >/dev/null; echo "rules-template exit=$?"
```

Expected: `0` and `rules-template exit=0`.

- [ ] **Step 5: Commit**

```bash
git add skills/globalize-guide/references/languages/js-ts/libraries/vue-i18n/
git commit -m "feat(globalize-guide): generate a formatters module for vue-i18n stacks

Registers numberFormats/datetimeFormats for every locale with one shared currency
code, and adds the list/relativeTime helpers vue-i18n does not provide."
```

---

## Task 5: Paraglide (1 variant)

**Files:**
- Modify: `skills/globalize-guide/references/languages/js-ts/frameworks/sveltekit/paraglide.setup.md`
- Modify: `skills/globalize-guide/references/languages/js-ts/libraries/paraglide/rules.template.md`

**Interfaces:**
- Consumes: the canonical module from Task 2 — `pickRelativeUnit`, `UNITS`, `toDate`, `cached`/`memo` and the `DATE_PRESETS` shape are reused verbatim. `createFormatters`/`useFormatters` are **not** reused: Svelte has no React context, so the locale comes from Paraglide's `getLocale()` at call time and the surface is exported as module-level functions instead of a factory.
- Produces: `src/lib/format.ts` with the ten-function surface as **module-level functions** plus deprecated aliases for the four names the current version ships.

- [ ] **Step 1: Write the failing test**

```bash
./evals/verify-format-helpers.sh 2>&1 | sed -n '/--- Pair: paraglide ---/,/--- Pair: webext-native ---/p' | grep -c '^  FAIL'
```

Expected now: a non-zero count (the exact number varies by pair — see the per-pair baseline the ledger recorded in Task 1). The gate is that it reaches `0` at the end of this task.

- [ ] **Step 2: Replace the existing format-module block in `paraglide.setup.md`**

The file already creates `src/lib/format.ts` with `formatCurrency` / `formatPercent` / `formatNumber` / `formatDateShort` / `formatDate` / `formatDateTime` and a locale-keyed `memo`. Keep the memo and its SSR rationale verbatim — it is the prior art the rest of this feature is built on. Replace the export block with the ten-function surface, reading the locale from Paraglide's runtime:

```ts
import { getLocale } from '$lib/paraglide/runtime'

/** THE SEAM. Change this one function to format against something other than the UI locale. */
export function formatLocale(): string {
  return getLocale()
}

export const money = (amount: number, currency: string = DEFAULT_CURRENCY) =>
  nf(`cur:${currency}`, { style: 'currency', currency }).format(amount)
export const number = (value: number, opts?: Intl.NumberFormatOptions) =>
  opts ? new Intl.NumberFormat(formatLocale(), opts).format(value) : nf('dec', { style: 'decimal' }).format(value)
export const percent = (value: number) => nf('pct', { style: 'percent' }).format(value)
export const compact = (value: number) => nf('cmp', { notation: 'compact' }).format(value)
export const unit = (value: number, u: string) => nf(`unit:${u}`, { style: 'unit', unit: u }).format(value)
export const date = (v: DateInput, preset: DatePreset = 'medium') => df(`p:${preset}`, DATE_PRESETS[preset]).format(toDate(v))
export const time = (v: DateInput) => df('t', { timeStyle: 'short' }).format(toDate(v))
export const dateTime = (v: DateInput) => df('dt', { dateStyle: 'medium', timeStyle: 'short' }).format(toDate(v))
export const relativeTime = (v: DateInput, now?: DateInput) => {
  const from = now === undefined ? Date.now() : toDate(now).getTime()
  const [u, amount] = pickRelativeUnit(toDate(v).getTime() - from)
  return rtf().format(amount, u)
}
export const list = (items: string[], type: 'and' | 'or' = 'and') => lf(type).format(items)

/** @deprecated Use `money`. */   export const formatCurrency = money
/** @deprecated Use `number`. */  export const formatNumber = number
/** @deprecated Use `percent`. */ export const formatPercent = percent
/** @deprecated Use `date(v, 'short')`. */ export const formatDateShort = (v: DateInput) => date(v, 'short')
/** @deprecated Use `date`. */    export const formatDate = date
/** @deprecated Use `dateTime`. */export const formatDateTime = dateTime
```

`nf` / `df` are the existing memoized constructors, retargeted at `formatLocale()`; add `rtf()` and `lf(type)` beside them following the same shape. Carry `type DateInput`, `type DatePreset`, `DATE_PRESETS`, `DEFAULT_CURRENCY`, `toDate`, `UNITS` and `pickRelativeUnit` into the file — it must stand alone in the user's repo, so nothing is imported from another module this skill created.

Prose the section must carry:

- **The aliases exist so a re-run does not break call sites** from an earlier version of this skill. They are deprecated, not supported: a future `templateVersion` bump drops them.
- The same `DEFAULT_CURRENCY` grep-and-record rule (retarget the file's existing `CURRENCY` paragraph), the same "if `src/lib/format.ts` already exists as project code" rule the file already has (extend it to record the specifier into `.globalize/format-module.json` rather than only "record the specifier you used"), and the TypeScript `lib` gate from Task 2.
- Extend the file's `## Verify` list with a step: render `list(['a','b','c'])` and `relativeTime(Date.now() - 86_400_000)` on a page and confirm they read as `a, b, and c` and `yesterday` — not `[object Object]` and not `1 day ago`. `numeric: 'auto'` is what produces `yesterday`; losing it is a silent quality regression.

- [ ] **Step 3: Rewrite the formatting section of `paraglide/rules.template.md`**

The template already declares `formatModule` in `values:` and `ssr` in `conditions:` — confirm both, then replace the existing four-line formatting block with the full ten-function section: plain module imports (`import { money, date, relativeTime } from '<<formatModule>>'`, no hook), the currency-from-data rule, the "flag for review" list (keep the existing `any new Intl. outside <<formatModule>>` line), and the two `ssr` blocks. Bump `budget:`.

- [ ] **Step 4: Run the tests**

```bash
./evals/verify-format-helpers.sh 2>&1 | sed -n '/--- Pair: paraglide ---/,/--- Pair: webext-native ---/p' | grep -c '^  FAIL'
./evals/verify-rules-template.sh >/dev/null; echo "rules-template exit=$?"
```

Expected: `0` and `rules-template exit=0`.

- [ ] **Step 5: Commit**

```bash
git add skills/globalize-guide/references/languages/js-ts/frameworks/sveltekit/paraglide.setup.md skills/globalize-guide/references/languages/js-ts/libraries/paraglide/rules.template.md
git commit -m "feat(globalize-guide): extend the Paraglide format module to the full surface

Adds compact/unit/relativeTime/list and renames to the uniform names, keeping
the previous exports as deprecated aliases so re-runs do not break call sites."
```

---

## Task 6: webext-native (1 variant)

**Files:**
- Modify: `skills/globalize-guide/references/languages/js-ts/frameworks/webext/webext-native.setup.md`
- Modify: `skills/globalize-guide/references/languages/js-ts/frameworks/webext/webext-native.rules.template.md`

**Interfaces:**
- Consumes: the canonical module from Task 2 — `pickRelativeUnit`, `UNITS`, `toDate`, `cached`/`memo`, `DATE_PRESETS`, `DEFAULT_CURRENCY`. `createFormatters`/`useFormatters` are **not** reused: this variant has no React, so the surface is exported as module-level functions reading `formatLocale()` at call time, the same shape as Paraglide in Task 5.
- Produces: `src/i18n/format.ts` with the ten-function surface. This is the one variant where `formatLocale()` is load-bearing on day one: `chrome.i18n` has **no** formatting API and `getMessage()` takes no locale argument, so nothing else in the extension knows the active locale.

- [ ] **Step 1: Write the failing test**

```bash
./evals/verify-format-helpers.sh 2>&1 | sed -n '/--- Pair: webext-native ---/,/--- Pair: rails ---/p' | grep -c '^  FAIL'
```

Expected now: a non-zero count (the exact number varies by pair — see the per-pair baseline the ledger recorded in Task 1). The gate is that it reaches `0` at the end of this task.

- [ ] **Step 2: Add a `## Format helpers (`generate_format_helpers`)` section to `webext-native.setup.md`**

Emit the canonical module from Task 2 with `useFormatters`/`getFormatters` removed (there is no React on this variant) and module-level functions exported instead — the same export shape as Paraglide in Task 5, carrying `pickRelativeUnit`, `UNITS`, `toDate`, `DATE_PRESETS`, `DEFAULT_CURRENCY`, the memo and `cached` inline so the file stands alone.

The locale source is the part that is genuinely different, and it is conditional on the §1.7 locale-source decision:

```ts
/**
 * THE SEAM. An extension has no URL to read a locale from and `chrome.i18n`
 * exposes none, so this is the only place that knows which locale to format in.
 */
export function formatLocale(): string {
  // decisions.setup.localeSwitcher === "native"
  return chrome.i18n.getUILanguage()
}
```

When `decisions.setup.localeSwitcher === "custom-loader"`, emit instead a version backed by the extension's own stored choice, with a synchronous cache primed at startup — every formatter is synchronous and `browser.storage` is not:

```ts
let current = chrome.i18n.getUILanguage()

/** Call once during startup, and again from the storage listener, before rendering. */
export async function primeFormatLocale(): Promise<void> {
  const { locale } = await chrome.storage.sync.get('locale')
  if (typeof locale === 'string' && locale) current = locale
}

export function formatLocale(): string {
  return current
}
```

Prose the section must carry:

- **`getUILanguage()` returns a hyphenated BCP-47 tag (`pt-BR`)** while `_locales` directories are underscored (`pt_BR`). `Intl` wants the hyphenated form, so pass `getUILanguage()` straight through — do **not** reuse whatever normalization the `_locales` loader applies.
- **Chrome's `_locales` table is ~55 entries and unsupported directories are silently ignored**, but `Intl` supports far more locales than that. A locale the extension cannot *translate* into may still format correctly — do not gate formatting on the `_locales` list.
- The same `DEFAULT_CURRENCY` grep-and-record rule, the same "do not overwrite project code", the same `.globalize/format-module.json` write, and the TypeScript `lib` gate from Task 2. Note that MV3's CSP (`script-src 'self' 'wasm-unsafe-eval'`) is irrelevant here — `Intl` is built into the engine.

- [ ] **Step 3: Rewrite the formatting section of `webext-native.rules.template.md`**

Add `formatModule` to `values:`. **Do not add `ssr`** — a browser extension has no server rendering, so both hydration blocks are dead branches; omit them entirely rather than adding a condition that is always false. Replace the formatting guidance with the ten-function section: plain module imports, the currency-from-data rule, and a "flag for review" list. Add one webext-specific rule: `chrome.i18n.getMessage()` returns a plain string with `$1`-style substitutions and **no** number or date formatting — never build a formatted value into a `messages.json` entry; format it in code and pass the result as a placeholder. Bump `budget:`.

- [ ] **Step 4: Run the tests**

```bash
./evals/verify-format-helpers.sh 2>&1 | sed -n '/--- Pair: webext-native ---/,/--- Pair: rails ---/p' | grep -c '^  FAIL'
./evals/verify-rules-template.sh >/dev/null; echo "rules-template exit=$?"
```

Expected: `0` and `rules-template exit=0`.

- [ ] **Step 5: Commit**

```bash
git add skills/globalize-guide/references/languages/js-ts/frameworks/webext/
git commit -m "feat(globalize-guide): generate a formatters module for native webext

chrome.i18n has no formatting API at all, so this module is the only locale-aware
formatting the variant gets; formatLocale() bridges getUILanguage() and the picker."
```

---

## Task 7: Rails (1 variant)

**Files:**
- Modify: `skills/globalize-guide/references/languages/ruby/frameworks/rails/rails.setup.md`
- Modify: `skills/globalize-guide/references/languages/ruby/frameworks/rails/rails.rules.template.md`

**Interfaces:**
- Consumes: the `format-module.json` schema (Task 1).
- Produces: `app/helpers/format_helper.rb` defining `format_money`, `format_number`, `format_percent`, `format_compact`, `format_unit`, `format_date`, `format_time`, `format_date_time`, `format_relative_time`, `format_list`, and `format_locale`.

- [ ] **Step 1: Write the failing test**

```bash
./evals/verify-format-helpers.sh 2>&1 | sed -n '/--- Pair: rails ---/,/--- Pair: android-strings ---/p' | grep -c '^  FAIL'
```

Expected now: a non-zero count (the exact number varies by pair — see the per-pair baseline the ledger recorded in Task 1). The gate is that it reaches `0` at the end of this task.

- [ ] **Step 2: Add a `## Format helpers (`generate_format_helpers`)` section to `rails.setup.md`**

Names are `format_`-prefixed and snake_case: helpers are mixed into every view, so a bare `number` or `list` would collide with Action View and with local variables.

```ruby
# app/helpers/format_helper.rb
module FormatHelper
  DEFAULT_CURRENCY = "USD" # adjust to this project's currency

  # THE SEAM. Formatting follows the UI locale today. To give this project a
  # separate regional preference, change this one method.
  def format_locale
    I18n.locale
  end

  def format_money(amount, currency = DEFAULT_CURRENCY)
    number_to_currency(amount, locale: format_locale, unit: currency_unit(currency))
  end

  def format_number(value)
    number_with_delimiter(value, locale: format_locale)
  end

  def format_percent(value)
    number_to_percentage(value * 100, locale: format_locale, precision: 1)
  end

  def format_compact(value)
    number_to_human(value, locale: format_locale)
  end

  def format_unit(value, unit)
    "#{format_number(value)} #{unit}"
  end

  def format_date(value, preset = :medium)
    l(value.to_date, format: preset, locale: format_locale)
  end

  def format_time(value)
    l(value.to_time, format: :time, locale: format_locale)
  end

  def format_date_time(value)
    l(value.to_time, format: :date_time, locale: format_locale)
  end

  def format_relative_time(value, now = Time.current)
    distance = distance_of_time_in_words(value, now, locale: format_locale)
    value < now ? t("time.ago", distance: distance) : t("time.from_now", distance: distance)
  end

  def format_list(items, type = :and)
    items.to_sentence(locale: format_locale,
                      two_words_connector: t("support.array.#{type}.two_words_connector"),
                      last_word_connector: t("support.array.#{type}.last_word_connector"))
  end

  private

  def currency_unit(currency)
    I18n.t("number.currency.format.unit", locale: format_locale, default: nil) ||
      currency
  end
end
```

Prose the section must carry:

- **The catalog keys these depend on.** Scaffold into `config/locales/{source_locale}.yml`, and note that `rails-i18n` already ships `number.*`, `date.formats`, `time.formats` and `support.array` for every locale it covers — only app-specific overrides belong in the connected catalog (this restates a rule the rules template already has). The keys the helper adds and therefore *must* be authored: `date.formats.medium`, `date.formats.long`, `time.formats.time`, `time.formats.date_time`, `time.ago`, `time.from_now`, and `support.array.or.{two_words_connector,last_word_connector}` (Rails ships only the `and` connectors).
- **`l()` raises on a numeric argument.** `I18n.l` localizes `Date`, `DateTime` and `Time` only; the `.to_date` / `.to_time` coercions above are load-bearing, not decoration.
- **Currency belongs to the data.** `format_money(order.total, order.currency)` when a record carries one. The `currency_unit` fallback exists so a locale that defines its own `number.currency.format.unit` still wins for the default currency — but never let the *locale* pick the currency for a price that carries its own.
- The same `DEFAULT_CURRENCY` grep-and-record rule (grep for `number_to_currency` with an inline `unit:`, or a hardcoded symbol in a view), and the `.globalize/format-module.json` write with `specifier: "FormatHelper"` and `path: "app/helpers/format_helper.rb"`.
- **If `app/helpers/format_helper.rb` already exists**, add the methods into it rather than overwriting, and skip any method already defined.

- [ ] **Step 3: Rewrite the formatting section of `rails.rules.template.md`**

Add `formatModule` to `values:`. **Do not add `ssr`** — Rails renders on the server and ships no hydration, so neither block applies. Replace `## Dates and times use `l()`; numbers use number helpers` with a section that keeps the existing `l()`-raises-on-numerics rule and the rails-i18n-defaults rule, then routes every call through `<<formatModule>>`'s ten methods, adds the currency-from-data rule, and lists for review: `strftime(`, `"$#{`, a bare `number_to_currency` with an inline `unit:`, and `round(2)` in a view. Bump `budget:`.

- [ ] **Step 4: Run the tests**

```bash
./evals/verify-format-helpers.sh 2>&1 | sed -n '/--- Pair: rails ---/,/--- Pair: android-strings ---/p' | grep -c '^  FAIL'
./evals/verify-rules-template.sh >/dev/null; echo "rules-template exit=$?"
```

Expected: `0` and `rules-template exit=0`.

- [ ] **Step 5: Commit**

```bash
git add skills/globalize-guide/references/languages/ruby/frameworks/rails/
git commit -m "feat(globalize-guide): generate a FormatHelper for Rails

Wraps the Action View number helpers and l() behind the uniform surface, and
scaffolds the date.formats / time.* / support.array.or keys they depend on."
```

---

## Task 8: Android (1 variant)

**Files:**
- Modify: `skills/globalize-guide/references/languages/android/native/android-strings.setup.md`
- Modify: `skills/globalize-guide/references/languages/android/native/android-strings.rules.template.md`

**Interfaces:**
- Consumes: the `format-module.json` schema (Task 1).
- Produces: `Formatters.kt` — a `Formatters` class with the ten methods, `Formatters.of(context)` for view code, and a `LocalFormatters` `CompositionLocal` for Compose.

**Open item this task must resolve (spec §Open items 1):** the exact API-level floors for `java.time` (core library desugaring), `android.icu.text.RelativeDateTimeFormatter` and `android.icu.text.ListFormatter`. **Verify them against current Android platform documentation before authoring** — do not carry a number over from memory. Record what you verified, and the source, in the setup reference itself so a later reader can re-check it.

- [ ] **Step 1: Write the failing test**

```bash
./evals/verify-format-helpers.sh 2>&1 | sed -n '/--- Pair: android-strings ---/,/--- Pair: string-catalog ---/p' | grep -c '^  FAIL'
```

Expected now: a non-zero count (the exact number varies by pair — see the per-pair baseline the ledger recorded in Task 1). The gate is that it reaches `0` at the end of this task.

- [ ] **Step 2: Read the project's `minSdk` and resolve the API-level branches**

Read `minSdk` (or `minSdkVersion`) from the module's `build.gradle` / `build.gradle.kts`, and whether `coreLibraryDesugaringEnabled` is set. This value decides which branch the emitted file takes, so resolve it before authoring. If it cannot be read, write `status: "needs_decision"` with `{ "step": "format_module_min_sdk", "question": "Could not read minSdk from build.gradle — which API level does this module target?", "options": ["21", "24", "26", "34"] }` and stop.

- [ ] **Step 3: Add a `## Format helpers (`generate_format_helpers`)` section to `android-strings.setup.md`**

```kotlin
// Formatters.kt
package <applicationId>.i18n

import android.content.Context
import android.icu.text.CompactDecimalFormat
import android.icu.text.ListFormatter
import android.icu.text.RelativeDateTimeFormatter
import android.os.Build
import androidx.compose.runtime.compositionLocalOf
import java.text.NumberFormat
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Currency
import java.util.Locale

class Formatters(private val locale: Locale) {

    companion object {
        const val DEFAULT_CURRENCY = "USD" // adjust to this project's currency

        // Verify each against current Android platform docs before writing this file,
        // and record the source in the setup reference. These are the only unknowns here.
        private const val COMPACT_API = 0   // android.icu.text.CompactDecimalFormat
        private const val RELATIVE_API = 0  // android.icu.text.RelativeDateTimeFormatter
        private const val LIST_API = 0      // android.icu.text.ListFormatter

        /**
         * THE SEAM. Formatting follows the UI locale today. To give this app a
         * separate regional preference, change this one function.
         */
        fun formatLocale(context: Context): Locale =
            context.resources.configuration.locales[0]

        fun of(context: Context): Formatters = Formatters(formatLocale(context))
    }

    fun money(amount: Number, currency: String = DEFAULT_CURRENCY): String =
        NumberFormat.getCurrencyInstance(locale)
            .apply { this.currency = Currency.getInstance(currency) }
            .format(amount)

    fun number(value: Number): String = NumberFormat.getInstance(locale).format(value)

    fun percent(value: Number): String = NumberFormat.getPercentInstance(locale).format(value)

    fun compact(value: Number): String =
        if (Build.VERSION.SDK_INT >= COMPACT_API) {
            CompactDecimalFormat
                .getInstance(locale, CompactDecimalFormat.CompactStyle.SHORT)
                .format(value)
        } else {
            number(value) // no compact notation below COMPACT_API — still locale-correct
        }

    fun unit(value: Number, unit: String): String = "${number(value)} $unit"

    fun date(value: java.time.temporal.TemporalAccessor, preset: FormatStyle = FormatStyle.MEDIUM): String =
        DateTimeFormatter.ofLocalizedDate(preset).withLocale(locale).format(value)

    fun time(value: java.time.temporal.TemporalAccessor): String =
        DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT).withLocale(locale).format(value)

    fun dateTime(value: java.time.temporal.TemporalAccessor): String =
        DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT)
            .withLocale(locale).format(value)

    fun relativeTime(value: Long, now: Long = System.currentTimeMillis()): String =
        if (Build.VERSION.SDK_INT >= RELATIVE_API) {
            val (unit, amount) = pickRelativeUnit(value - now)
            RelativeDateTimeFormatter.getInstance(locale).format(
                amount.toDouble(),
                if (amount < 0) RelativeDateTimeFormatter.Direction.LAST
                else RelativeDateTimeFormatter.Direction.NEXT,
                unit,
            )
        } else {
            // Below RELATIVE_API: same unit selection, rendered through a <plurals>
            // resource so it stays translatable. Never a hardcoded "n days ago".
            val (unit, amount) = pickRelativeUnit(value - now)
            relativeFallback(unit, amount)
        }

    fun list(items: List<String>, type: String = "and"): String =
        if (Build.VERSION.SDK_INT >= LIST_API) {
            ListFormatter.getInstance(locale).format(items)
        } else {
            // Below LIST_API: the locale's own connectors, from string resources.
            joinWithResourceConnectors(items, type)
        }
}

val LocalFormatters = compositionLocalOf<Formatters> {
    error("LocalFormatters not provided — wrap your content in CompositionLocalProvider")
}
```

**Three constants and three helpers to fill in.** `COMPACT_API`, `RELATIVE_API` and `LIST_API` are the only unknowns in the file, and they are exactly the spec's Open item 1. Resolve each from current Android platform documentation, declare them as `private const val` beside `DEFAULT_CURRENCY`, and **record the value and its documentation source in the setup reference's prose** so the next reader re-checks rather than re-derives.

Then author the three supporting members, none of which depend on an API level:

- `pickRelativeUnit(deltaMs: Long): Pair<RelativeDateTimeFormatter.RelativeUnit, Long>` — the same thresholds as the canonical module (second / minute / hour / day / week / month / year), returning the largest unit whose magnitude is at least 1.
- `relativeFallback(unit, amount)` — reads a `<plurals>` resource per unit (`R.plurals.relative_days_ago`, `R.plurals.relative_days_from_now`, …) via `resources.getQuantityString`, so the wording is translatable and pluralizes per CLDR. Scaffold those `<plurals>` entries into `res/values/strings.xml` in the same step. **Never** a hardcoded `"$n days ago"`.
- `joinWithResourceConnectors(items, type)` — joins using `R.string.list_two_words_connector` / `R.string.list_last_word_connector` (and the `or` variants), scaffolded alongside. Never a hardcoded `", "` and `" and "`.

If the project's `minSdk` is at or above all three constants, emit the `if` branches anyway — `Build.VERSION.SDK_INT` checks are free and the file survives a later `minSdk` change — but skip scaffolding the fallback resources, and say in the setup output that they were skipped and why.

`java.time` is used unconditionally by `date`/`time`/`dateTime`. If Step 2 found `minSdk` below the `java.time` floor **and** `coreLibraryDesugaringEnabled` is not set, do not emit the file: write `status: "needs_decision"` with `{ "step": "format_module_desugaring", "question": "date/time formatting uses java.time, which needs core library desugaring at this minSdk. Enable coreLibraryDesugaring, or fall back to java.text.DateFormat?", "options": ["enable_desugaring", "use_dateformat"] }` and stop.

Prose the section must also carry:

- **Provide `LocalFormatters` once at the Compose root**, with the call site shown:
  `CompositionLocalProvider(LocalFormatters provides Formatters.of(LocalContext.current)) { AppContent() }`, and note that reading `LocalConfiguration` is what makes it recompose on a locale change.
- **The currency code is a property of the price, not of the reader** — restating the rule the rules template already carries — with `Currency.getInstance(order.currency)` shown.
- **Format the value first, then pass the formatted string into the resource as `%1$s`** — never `%1$d` / `%1$f`, which format the raw number without going through the locale-aware formatter. This is the single most common Android formatting bug and the rules template already names it; the helper is what makes following it cheap.
- The same `DEFAULT_CURRENCY` grep-and-record rule (grep for `"$" +`, `DecimalFormat(`, an existing `Currency.getInstance(`), and the `.globalize/format-module.json` write with `specifier: "<applicationId>.i18n.Formatters"` and `path` pointing at the real `Formatters.kt` location under the module's source set.
- The verified API-level floors, each with the documentation source, so the next reader can re-check rather than re-derive.

- [ ] **Step 4: Rewrite the formatting section of `android-strings.rules.template.md`**

Add `formatModule` to `values:`. **Do not add `ssr`.** Rewrite `## Numbers, currencies, dates — format, never concatenate` to route through `<<formatModule>>` — `LocalFormatters.current.money(amount)` in Compose, `Formatters.of(context).money(amount)` in views — keeping the existing currency-is-not-the-locale paragraph, the never-hardcode-a-date-pattern paragraph, and the `%1$s`-not-`%1$d` rule verbatim, since all three still apply. Keep the existing "flag for review" line. Bump `budget:`.

- [ ] **Step 5: Run the tests**

```bash
./evals/verify-format-helpers.sh 2>&1 | sed -n '/--- Pair: android-strings ---/,/--- Pair: string-catalog ---/p' | grep -c '^  FAIL'
./evals/verify-rules-template.sh >/dev/null; echo "rules-template exit=$?"
```

Expected: `0` and `rules-template exit=0`.

- [ ] **Step 6: Commit**

```bash
git add skills/globalize-guide/references/languages/android/native/
git commit -m "feat(globalize-guide): generate Formatters.kt for native Android

Adds the uniform surface over NumberFormat/DateTimeFormatter/android.icu with
minSdk-branched fallbacks, plus a LocalFormatters CompositionLocal for Compose."
```

---

## Task 9: iOS (3 variants)

**Files:**
- Modify: `skills/globalize-guide/references/languages/ios/native/string-catalog.setup.md`
- Modify: `skills/globalize-guide/references/languages/ios/native/string-catalog.rules.template.md`

**Interfaces:**
- Consumes: the `format-module.json` schema (Task 1).
- Produces: `Formatters.swift` — `FormatStyle` extensions so `amount.formatted(.money)` and `Text(amount, format: .money)` both work, plus an `enum Formatters` namespace for `relativeTime` and `list`.

**Open item this task must resolve (spec §Open items 2):** whether to emit the cached `NumberFormatter` / `DateFormatter` fallback unconditionally or gate it on the project's deployment target. **Read the deployment target** from the Xcode project (`IPHONEOS_DEPLOYMENT_TARGET`) or `Package.swift` (`platforms:`) and decide from that; record the decision and the value read in the setup reference.

- [ ] **Step 1: Write the failing test**

```bash
./evals/verify-format-helpers.sh 2>&1 | sed -n '/--- Pair: string-catalog ---/,$p' | grep -c '^  FAIL'
```

Expected now: a non-zero count (the exact number varies by pair — see the per-pair baseline the ledger recorded in Task 1). The gate is that it reaches `0` at the end of this task.

- [ ] **Step 2: Add a `## Format helpers (`generate_format_helpers`)` section to `string-catalog.setup.md`**

The Swift shape is deliberately *not* `Formatters.money(x)` for the value styles: SwiftUI's `format:` initializer re-formats automatically when the environment locale changes, which formatting into a `String` does not. Extending `FormatStyle` is what makes `Text(amount, format: .money)` legal.

```swift
// Formatters.swift
import Foundation

public enum Formatters {
    public static let defaultCurrency = "USD" // adjust to this project's currency

    /// THE SEAM. Formatting follows the UI locale today. To give this app a
    /// separate regional preference, change this one property.
    public static var formatLocale: Locale { .autoupdatingCurrent }

    public static func relativeTime(_ value: Date, now: Date = Date()) -> String {
        value.formatted(.relative(presentation: .named))
    }

    public static func list(_ items: [String], type: ListFormatStyle<StringStyle, [String]>.ListType = .and) -> String {
        items.formatted(.list(type: type))
    }
}

public extension FormatStyle where Self == FloatingPointFormatStyle<Double>.Currency {
    /// `Text(amount, format: .money)` — the project's default currency.
    static var money: Self { .currency(code: Formatters.defaultCurrency) }
    /// `Text(amount, format: .money(order.currency))` — when the data carries its own.
    static func money(_ code: String) -> Self { .currency(code: code) }
}

public extension FormatStyle where Self == FloatingPointFormatStyle<Double>.Percent {
    /// `Text(ratio, format: .percentage)` — takes a ratio, not a percentage.
    static var percentage: Self { .percent }
}

public extension FormatStyle where Self == Date.FormatStyle {
    static var shortDate: Self { .dateTime.day().month(.abbreviated).year() }
    static var mediumDate: Self { .dateTime.day().month(.wide).year() }
    static var timeOnly: Self { .dateTime.hour().minute() }
    static var dateAndTime: Self { .dateTime.day().month(.abbreviated).year().hour().minute() }
}
```

**Swift names differ from the concept names, and that is fine** — `surface` records what the file actually spells. Author the remaining entries in the same idiom and record this exact mapping in `format-module.json`:

| Concept | Emitted Swift name | Form |
|---|---|---|
| `money` | `money` | `FormatStyle` static var + `money(_ code:)` overload |
| `number` | `plainNumber` | `FormatStyle` static var — **not** `.number`, which `FloatingPointFormatStyle` already defines |
| `percent` | `percentage` | `FormatStyle` static var — **not** `.percent`, already defined |
| `compact` | `compactNumber` | `FormatStyle` static var, `.notation(.compactName)` |
| `unit` | `measurement(_:)` | static func returning a `Measurement.FormatStyle` |
| `date` | `shortDate` / `mediumDate` | two `Date.FormatStyle` static vars; `mediumDate` is the default |
| `time` | `timeOnly` | `Date.FormatStyle` static var, `.hour().minute()` |
| `dateTime` | `dateAndTime` | `Date.FormatStyle` static var — **not** `.dateTime`, already defined on `Date.FormatStyle` |
| `relativeTime` | `Formatters.relativeTime` | static func (no `FormatStyle` form — the reference instant is an argument) |
| `list` | `Formatters.list` | static func |

Three of these names exist to avoid colliding with members Foundation already declares (`.number`, `.percent`, `.dateTime`); an extension redeclaring them would not compile. Do not "tidy" them back. The rules template names the emitted spellings, since that is what a reader types.

Prose the section must carry:

- **The availability decision from the task header**, stated as a fact about this project: the deployment target that was read, and either "`.formatted()` is available on the whole target range, no fallback emitted" or the cached-formatter fallback with the reason. If a fallback is emitted, it must **cache** the `DateFormatter` / `NumberFormatter` in a `static let` — constructing them per call is a well-known performance trap and the rules template already names it.
- **`Locale.autoupdatingCurrent`, not `Locale.current`**, so the value tracks a locale change at runtime. State why.
- **The currency code is a property of the price, not of the reader** — `Text(order.total, format: .money(order.currency))`. Never derive it from `Locale.current`.
- **Interpolating an already-formatted value into a localized string is correct** — it extracts as `%@`: `String(localized: "Total: \(amount.formatted(.money))")`. This is the bridge between the format module and the String Catalog, and it is the thing a reader is most likely to get wrong.
- The same default-currency grep-and-record rule (grep for `String(format: "%.2f"`, `"$\(`, an existing `.currency(code:`), and the `.globalize/format-module.json` write with `specifier: "Formatters"` (same module, no import needed) and `path` pointing at the real `Formatters.swift` location.

- [ ] **Step 3: Rewrite the formatting section of `string-catalog.rules.template.md`**

Add `formatModule` to `values:`. **Do not add `ssr`.** Rewrite `## Numbers, currencies, dates — format, never interpolate raw` to route through `<<formatModule>>`'s styles, keeping verbatim the four rules that still apply: currency-is-not-the-reader, never-hardcode-a-date-format-string, cache the formatter below the availability floor, and prefer the SwiftUI `format:` initializer over formatting into a `String`. Keep the existing "flag for review" line. Bump `budget:`.

- [ ] **Step 4: Run the tests — the board should now be fully green**

```bash
./evals/verify-format-helpers.sh; echo "format-helpers exit=$?"
./evals/verify-rules-template.sh >/dev/null; echo "rules-template exit=$?"
```

Expected: `format-helpers exit=0` with **Failed: 0** and `INFO: pairs checked: 8`, and `rules-template exit=0`. This is the first moment the whole contract holds; do not proceed until both are 0.

- [ ] **Step 5: Commit**

```bash
git add skills/globalize-guide/references/languages/ios/native/
git commit -m "feat(globalize-guide): generate Formatters.swift for Apple targets

FormatStyle extensions so Text(amount, format: .money) re-formats on a locale
change, plus relativeTime/list helpers. Completes the 8-template contract."
```

---

## Task 10: Detection and the Phase 3 convert pass

**Files:**
- Create: `skills/globalize-guide/references/languages/js-ts/convert.format-pass.md`
- Modify: `skills/globalize-guide/manifest.json`
- Modify: `skills/globalize-guide/SKILL.md`
- Modify: `…/ruby/frameworks/rails/rails.convert.md`, `…/android/native/android-strings.convert.md`, `…/ios/native/string-catalog.convert.md` (a format-pass section each)

**Interfaces:**
- Consumes: `.agents/globalize-rules.md`, which by now carries the real module import path in every stack.
- Produces: `detection.json` gains `formatCandidateFiles: string[]`; `progress/verify.json` `result` gains `formatViolations`.

- [ ] **Step 1: Write the failing test**

```bash
test -f skills/globalize-guide/references/languages/js-ts/convert.format-pass.md && echo PASS || echo FAIL
grep -c 'formatCandidateFiles' skills/globalize-guide/SKILL.md
python3 -c "
import json; m=json.load(open('skills/globalize-guide/manifest.json'))
n=sum(1 for s in m['stacks'] if any('convert.format-pass.md' in p for p in s['references'].get('convert',[])))
print('variants wired:', n)"
```

Expected now: `FAIL`, `0`, `variants wired: 0`.

- [ ] **Step 2: Create `convert.format-pass.md`**

Library-agnostic on purpose — it names no library API, because the real import path and helper names live in `.agents/globalize-rules.md`, which the wrap subagent has already read. Contents:

- **What this pass is for.** Wrapping a string makes it translatable; it does not make a number, price or date render correctly. This pass converts values that are formatted by hand.
- **The rewrite table**, each row `find → replace with`:

  | Found | Replace with |
  |---|---|
  | `'$' + price`, `` `$${price}` ``, `"$" + amount` | `money(price)` |
  | `price.toFixed(2)` in user-visible copy | `money(price)` when it is a price, `number(value, { maximumFractionDigits: 2 })` otherwise |
  | `value.toLocaleString()` / `toLocaleDateString()` / `toLocaleTimeString()` with no explicit locale | the matching helper |
  | `new Intl.NumberFormat(...)` / `new Intl.DateTimeFormat(...)` at a call site | the matching helper |
  | `(a / b * 100).toFixed(0) + '%'` | `percent(a / b)` — note the helper takes a **ratio**, not a percentage |
  | `dayjs(d).format('MM/DD/YYYY')`, `format(d, 'MM/dd/yyyy')`, `d.strftime(...)`, `SimpleDateFormat("…")`, `dateFormat = "…"` | `date(d)` / the stack's date helper |
  | `items.join(', ')` in user-visible copy | `list(items)` |
  | a hand-built `"3 days ago"` | `relativeTime(d)` |

- **What NOT to convert.** Machine-readable output: log lines, IDs, filenames, CSV/JSON payloads, API request bodies, cache keys, sort keys, `data-*` attributes, test fixtures, anything compared against a literal, and any date that goes into an ISO-8601 field. A locale-formatted number in a payload is a bug, not a fix. When in doubt about whether a value is user-visible, leave it and record it.
- **Ordering and interaction with string wrapping.** Convert formatting **after** wrapping the strings in the same file, because a formatted value usually ends up as a placeholder inside a wrapped message, and the placeholder-naming rule in the coding rules applies to it.
- **The dependency the pass does not remove.** Flag `dayjs` / `date-fns` / `moment` call sites and convert the formatting; do not remove the package or rewrite non-formatting uses (parsing, arithmetic, timezone math). Record what was left.
- **Progress reporting**: same atomic-write protocol as the wrap pass; record converted sites under the file's entry.

- [ ] **Step 3: Wire it into the manifest for the 18 JS/TS variants**

Append `"references/languages/js-ts/convert.format-pass.md"` to `references.convert` on every stack whose `match` has no `language` key other than js-ts — i.e. all except `rails-yaml`, `android-strings`, and the three `ios-*` entries.

```bash
python3 - <<'PY'
import json, io
p='skills/globalize-guide/manifest.json'
m=json.load(open(p))
NATIVE={'rails-yaml','android-strings','ios-swiftui-string-catalog','ios-uikit-string-catalog','ios-spm-string-catalog'}
ref='references/languages/js-ts/convert.format-pass.md'
n=0
for s in m['stacks']:
    if s['variant'] in NATIVE: continue
    c=s['references'].setdefault('convert',[])
    if ref not in c:
        c.append(ref); n+=1
json.dump(m, open(p,'w'), indent=2, ensure_ascii=False)
open(p,'a').write('\n')
print('wired', n)
PY
jq -e . skills/globalize-guide/manifest.json > /dev/null && echo "manifest valid JSON"
git diff --stat skills/globalize-guide/manifest.json
```

Expected: `wired 19`, `manifest valid JSON`. **Inspect the diff** — if `json.dump` reformatted lines it should not have, revert and make the 19 edits by hand instead; a whole-file reformat buries the change.

- [ ] **Step 4: Add the native format-pass sections**

Add a `## Convert hand-rolled formatting` section to `rails.convert.md`, `android-strings.convert.md` and `string-catalog.convert.md`. Each carries the same "what this is for" framing and "what NOT to convert" list as Step 2, with a rewrite table in that language: Rails `strftime(` → `format_date`, `"$#{amount}"` → `format_money`, `.round(2)` in a view → `format_number`, `.join(", ")` → `format_list`; Android `SimpleDateFormat("…")` → `date(...)`, `String.format("%.2f", x)` → `number(x)`, `"$" + amount` → `money(amount)`, `%1$d`/`%1$f` in a resource → format first and pass `%1$s`; Swift `String(format: "%.2f", x)` → `x.formatted(.number)`, `"$\(amount)"` → `amount.formatted(.money)`, `dateFormat = "…"` → `.formatted(.mediumDate)`.

- [ ] **Step 4b: Retire superseded formatting guidance from the existing convert references**

Tasks 2, 4 and 5 each found a convert reference still teaching the pre-module formatting API as the *correct* form. None of them fixed it — convert references are this task's to own — and left unfixed they contradict the rules file the wrap subagent reads alongside them. Known sites, each confirmed by the task that found it:

| File | What it still teaches |
|---|---|
| `js-ts/libraries/lingui/convert.standard-react.md` | `i18n.number()` / `i18n.date()` with the `CURRENCY` / `DATE_*` option objects |
| `js-ts/frameworks/nextjs/app-router/lingui.convert.md` | the same |
| `js-ts/libraries/vue-i18n/convert.shared.md` (~line 259) | an inline `n(amount, { currency: 'USD' })`, plus a stale "seeded in setup Step 3" pointer — that block has moved |
| `js-ts/frameworks/sveltekit/paraglide.convert.md` | `formatCurrency` / `formatDate`, now deprecated aliases |

Repoint each at the project's format module. **Do not delete the deprecated aliases** — they exist so a re-run does not break existing call sites; the point is that the convert references must stop teaching them as the form to write. Grep for the old names again after editing and confirm the only surviving mentions are the alias declarations themselves.

- [ ] **Step 5: Add `formatCandidateFiles` to SKILL.md §1.1**

In each language's detection table, add a `formatCandidateFiles` row beneath `candidateFiles`:

- **JS/TS** — glob the same source set as `candidateFiles` **plus** files it deliberately excludes nothing for: grep for `toFixed(`, `toLocaleString(`, `toLocaleDateString(`, `toLocaleTimeString(`, `new Intl.`, `'$' +`, `"$" +`, a `$` immediately preceding a template-literal interpolation, `moment(`, `dayjs(`, and a `format(` imported from `date-fns`. **Exclude** the i18n directory itself and any file named `format.*`. Return files with ≥1 match, sorted by match count desc.
- **Ruby** — glob `app/views/**/*.erb`, `app/helpers/**/*.rb`, `app/models/**/*.rb`; grep `strftime(`, `"$#{`, `number_to_currency(` with an inline `unit:`, `.round(` inside an ERB output tag.
- **Android** — glob `**/*.{kt,java}`; grep `SimpleDateFormat(`, `DecimalFormat(`, `String.format("%.`, `"$" +`; plus `res/**/*.xml` for `%1$d` / `%1$f` in a `<string>` body.
- **Swift** — glob `**/*.swift` excluding tests; grep `String(format: "%.`, `dateFormat =`, `"$\(`, and a `\(` interpolation of a value whose declared type is numeric or `Date` inside a `Text(` or `String(localized:` argument.
- **webext** — the JS/TS row, plus `**/*.html` for a literal currency symbol adjacent to a number.

Then add, immediately after the table: **`formatCandidateFiles` is not a subset of `candidateFiles`.** Hand-rolled formatting lives in price, date and utility modules that contain no user-visible copy at all. Phase 3 partitions the **union** of the two lists, and each wrap subagent is told, per file, whether the file is in scope for `strings`, `formatting`, or `both`.

Update the §1.1 scan-summary user-facing messages to append: "… and **{formatCandidateFiles.length}** files formatting values by hand."

- [ ] **Step 6: Add `generate_format_helpers` to Phase 2 in SKILL.md**

- In §2.2's subagent prompt, extend the reference-files bullet list with: "Format helpers — create the project's formatters module and write `.globalize/format-module.json` (step `generate_format_helpers`, always runs, and it must complete **before** `generate_coding_rules`, which resolves `<<formatModule>>` from that file)."
- In the `plan.md` format section, insert `generate_format_helpers` into the Phase 2 step list immediately before `generate_coding_rules`.
- In §1.10, extend the "**Neither generating the rules file nor wiring it in is optional**" paragraph to a third core step, with its own bullet: `generate_format_helpers` runs as soon as the stack's config is on disk, because both the rules file and the Phase 3 format pass point at what it creates.
- In **Phase 2 collapse-case**, add `generate_format_helpers` to the reduced step list and state that it is not dropped, for the same reason `generate_coding_rules` is not.

- [ ] **Step 7: Add the pass to §3.2 and the check to §3.5 / §3.5.1**

- §3.2 wrap prompt: after the "For each file: identify translatable strings…" paragraph, add a paragraph pointing at `convert.format-pass.md` (or the native convert reference's format-pass section) and stating the per-file concern tag from Step 5. Say explicitly that formatting is converted **after** string wrapping in the same file.
- §3.5 verify prompt: add a language-appropriate `formatViolations` grep — the same patterns as `formatCandidateFiles`, minus the format module itself — and record `result.formatViolations` as `[{file,line,text}]`.
- §3.5's `result` paragraph: add `formatViolations` to the field list, and state that it is populated on **every** language (unlike the four recall fields, which are `null` outside JS/TS).
- §3.5.1: state that `formatViolations` join `recallViolations` in feeding the cleanup loop **where the loop already runs** (JS/TS), and are reported to the user with file+line on Rails/Android/Swift/webext-native, matching how those stacks already sit outside the loop. Never drop them silently.

- [ ] **Step 8: Run the tests**

```bash
test -f skills/globalize-guide/references/languages/js-ts/convert.format-pass.md && echo PASS || echo FAIL
grep -c 'formatCandidateFiles' skills/globalize-guide/SKILL.md
grep -c 'generate_format_helpers' skills/globalize-guide/SKILL.md
grep -c 'formatViolations' skills/globalize-guide/SKILL.md
python3 -c "
import json; m=json.load(open('skills/globalize-guide/manifest.json'))
n=sum(1 for s in m['stacks'] if any('convert.format-pass.md' in p for p in s['references'].get('convert',[])))
print('variants wired:', n)"
./evals/verify-format-helpers.sh >/dev/null; echo "format-helpers exit=$?"
./evals/verify-rules-template.sh >/dev/null; echo "rules-template exit=$?"
```

Expected: `PASS`; `formatCandidateFiles` ≥ 6; `generate_format_helpers` ≥ 4; `formatViolations` ≥ 3; `variants wired: 19`; both verifier exits `0`.

- [ ] **Step 9: Commit**

```bash
git add skills/globalize-guide/SKILL.md skills/globalize-guide/manifest.json skills/globalize-guide/references/
git commit -m "feat(globalize-guide): detect and convert hand-rolled value formatting

Adds formatCandidateFiles to Phase 1, a shared convert.format-pass.md wired into
18 JS/TS variants plus native sections, and formatViolations to the verify gate."
```

---

## Task 11: `lovable-i18n`

**Files:**
- Modify: `skills/lovable-i18n/SKILL.md`

**Interfaces:**
- Consumes: the canonical module from Task 2 (Lingui + React, so `useFormatters()` applies unchanged).
- Produces: nothing other skills read — this skill is self-contained by design.

- [ ] **Step 1: Write the failing test**

```bash
grep -c 'useFormatters' skills/lovable-i18n/SKILL.md
```

Expected now: `0`.

- [ ] **Step 2: Add a format-module phase**

The skill is single-file and its two paths (A and B) share the Lingui setup, so add one section after the locale-module/provider setup that creates `src/i18n/format.ts` with the canonical module from Task 2 verbatim — `formatLocale`, `cached`, `toDate`, `UNITS`, `pickRelativeUnit`, `createFormatters`, `useFormatters`, `getFormatters` — and `DEFAULT_CURRENCY` / `DATE_PRESETS` inline in the same file rather than importing from a locales module, since this skill's layout differs. State the same currency-grep rule and the same TypeScript `lib` note.

- [ ] **Step 3: Extend the AGENTS.md rules the skill writes**

The skill currently emits a rules line reading "Use `i18n.number()` and `i18n.date()` (from `useLingui()`) — never hand-rolled formatting." Replace it with the ten-function section: import `useFormatters` from `@/i18n/format`, the list of ten with one example each, the currency-from-data rule, and the flag-for-review list. Keep the `ph()` placeholder-naming interaction — a formatter call inside a `` t`…` `` template extracts as positional `{0}`.

- [ ] **Step 4: Extend the wrap phase**

The skill's "Hand-rolled formatting" cleanup instruction currently replaces `"$" + price` and `toFixed()` with an inline options object. Repoint it at the module and extend it with the rewrite table from Task 10 Step 2, plus the "what NOT to convert" list. Lovable has no terminal, so no grep command is emitted — the instruction is for the agent reading files directly.

- [ ] **Step 5: Run the tests**

```bash
grep -c 'useFormatters' skills/lovable-i18n/SKILL.md
grep -c 'relativeTime' skills/lovable-i18n/SKILL.md
grep -c 'i18n.number' skills/lovable-i18n/SKILL.md
```

Expected: `useFormatters` ≥ 3; `relativeTime` ≥ 2; `i18n.number` is `0` — every call site now goes through the module.

- [ ] **Step 6: Commit**

```bash
git add skills/lovable-i18n/SKILL.md
git commit -m "feat(lovable-i18n): add the formatters module and formatting rules"
```

---

## Task 12: Verification sweep and documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `skills/globalize-guide/references/*/rules.template.md` (budget corrections only, if any)

- [ ] **Step 1: Run every static verifier**

```bash
./evals/verify-format-helpers.sh; echo "format-helpers exit=$?"
./evals/verify-rules-template.sh; echo "rules-template exit=$?"
jq -e . skills/globalize-guide/manifest.json >/dev/null && echo "manifest valid"
```

Expected: both exits `0`, `manifest valid`. Read the full output rather than only the exit codes — the rules-template linter reports **warnings** (a declared condition the body never branches on) that do not fail the build but do mean a template declares `ssr` and never uses it.

- [ ] **Step 2: Re-measure every budget**

For each of the eight templates, render the worst-case branch combination by hand and count the lines. The `budget:` frontmatter must be ≥ that count.

```bash
for f in $(find skills -name '*rules.template.md' | sort); do
  echo "$(grep -m1 '^budget:' "$f")  <-  $(wc -l < "$f") source lines  $f"
done
```

A source line count above the declared budget is not automatically a failure — conditional branches shrink the render — but a template whose *source* is under budget cannot possibly render over it, so any template whose source exceeds its budget needs the by-hand render. Fix the frontmatter, not the prose.

- [ ] **Step 2b: Make `templateVersion` coherent across all eight templates**

Adding `formatModule` to a template's `values:` IS a rendering-contract change under the rule in `references/rules-template-format.md`, so **every** template gets exactly one bump for this feature. The task-by-task series drifted: next-intl added `formatModule` to `values:` and never bumped (still at 1). Audit all eight, and bump any that added `formatModule` without one:

```bash
grep -rn '^templateVersion:' skills/globalize-guide/references/languages/
grep -rln 'formatModule' skills/globalize-guide/references/languages/ | grep 'rules.template.md'
```

Every file in the second list must have been bumped exactly once relative to its pre-feature value (`git log -p` the frontmatter line if unsure). Do not double-bump one that already moved.

- [ ] **Step 2c: Correct the Paraglide alias-precision claim**

`formatPercent` was `{ style: 'percent', maximumFractionDigits: 1 }`; the canonical `percent` is `{ style: 'percent' }`. `0.4567` renders `45.7%` before and `46%` after, so the deprecation paragraph's claim that the aliases mean "a re-run does not break call sites" is overstated. Add one clause to that paragraph naming the rounding change. Keep the alias and the canonical definition as they are — uniformity across stacks is the deliberate trade; the fix is to stop overclaiming.

- [ ] **Step 2d: Audit the `formatLocale()` seam across all eight stacks**

The seam is the load-bearing half of the spec's formatting-locale decision: formatting follows the UI locale *today*, but every formatter routes through one function so a project can change it in one place later. A seam that is declared but never called is decorative, and worse than none — it advertises a property the module does not have. Task 9 caught exactly that in its own sample.

For each of the eight modules, confirm which of the ten functions actually route their locale through `formatLocale()`, and that the prose tells the truth about it:

- **Fully wired** (expected: Lingui, Paraglide, webext-native, Rails, Android, iOS) — every function goes through the seam. Verify, do not assume.
- **Partially wired by design** (expected: next-intl, vue-i18n) — the library owns locale resolution, so `money`/`number`/`percent`/`date` delegate to `useFormatter()` / `n()`/`d()` and never consult the seam, while raw-`Intl` functions like `list`/`relativeTime` do. This is legitimate, but **each such module must say so explicitly**, naming which functions bypass the seam and what a project must revisit if it ever changes it. vue-i18n already carries a version of this sentence for its `i18n.global` escape hatch; check it covers the in-composable path too.

Any module that neither wires the seam fully nor documents the bypass is a defect. Fix by documenting, not by forcing a uniformity the library will not support.

**One known hole to close, introduced by a controller instruction during Task 9's fix round.** iOS's `plainNumber` / `percentage` / `compactNumber` are `Double`-scoped, and the sanctioned alternative written into the rules for `Int` and `Decimal` values was `value.formatted(.number)` / `.formatted(.percent)`. Those are **Foundation's own members, not the project's**, so they bypass `Formatters.formatLocale` entirely — the rules file now instructs the reader to defeat the seam for every non-`Double` number. Close it by adding `Int` and `Decimal` overloads of `plainNumber` / `percentage` / `compactNumber` that chain `.locale(Formatters.formatLocale)` like the three `money` overloads already do, and repoint the prose at them. Do not leave the Foundation members as the advice.

- [ ] **Step 3: Run a Layer A eval end to end**

```bash
KEEP_WORKDIR=1 ./evals/run-eval-layer-a.sh nextjs-app-router-lingui
```

Confirm `.globalize/plan.md` in the kept workdir lists `generate_format_helpers` **before** `generate_coding_rules` in the Phase 2 steps, and that `detection.json` has a `formatCandidateFiles` array. Layer A stops before Phase 2, so no module is created — this checks the planning half only.

- [ ] **Step 4: Run a Layer B eval and check the generated module**

```bash
KEEP_WORKDIR=1 ./evals/run-eval-layer-b.sh nextjs-app-router-lingui
# then, against the kept workdir:
./evals/verify-format-helpers.sh --project /tmp/tmp.XXXX
./evals/verify-rules-template.sh --project /tmp/tmp.XXXX
```

Expected: both exit `0`. Then typecheck the generated module in place:

```bash
cd /tmp/tmp.XXXX && npx tsc --noEmit
```

Expected: clean. A failure here is most likely the TypeScript `lib` gate (Locked decision 3) not firing — check `tsconfig.json` `compilerOptions.lib` in the fixture.

- [ ] **Step 5: Manually confirm the output is actually correct**

In the kept workdir, render `money(1234.5)`, `list(['a','b','c'])` and `relativeTime(Date.now() - 86_400_000)` under three locales and confirm:

| Locale | `money(1234.5)` | `list` | `relativeTime` |
|---|---|---|---|
| `en-US` | `$1,234.50` | `a, b, and c` | `yesterday` |
| `de-DE` | `1.234,50 $` | `a, b und c` | `gestern` |
| `fr-FR` | `1 234,50 $US` | `a, b et c` | `hier` |

`1 day ago` instead of `yesterday` means `numeric: 'auto'` was dropped. Exact spacing and symbol placement come from CLDR and may shift between Node/ICU versions — check the **shape** (separator characters, symbol position, word not number), not byte equality.

- [ ] **Step 6: Update `CLAUDE.md`**

In the **Delivery Mechanisms** → passive-rule-skills section, after the paragraph describing the generated `.agents/globalize-rules.md`, add: setup also generates a **formatters module** into the target project (`generate_format_helpers`, a core step that runs before `generate_coding_rules`) and records it in `.globalize/format-module.json`; the rules file's `<<formatModule>>` resolves from that file. Note that the module is ordinary project code the user owns — unlike the rules file it is **not** regenerated-and-overwritten guidance, so a re-run adds to it rather than replacing hand edits. Also update the "Eight templates cover the twenty-three variants" sentence to mention that each template now points at a generated module.

- [ ] **Step 7: Final full check and commit**

```bash
./evals/verify-format-helpers.sh >/dev/null; echo "format-helpers exit=$?"
./evals/verify-rules-template.sh >/dev/null; echo "rules-template exit=$?"
git status --short
```

Expected: both `0`, and nothing unstaged that should be committed.

```bash
git add CLAUDE.md skills/
git commit -m "docs: record the generated formatters module in CLAUDE.md

Closes the locale-aware value formatting work: 23 variants plus lovable-i18n."
```

---

## Follow-ups (not in this plan)

- **Extend the §3.5.1 cleanup loop to Rails/Android/Swift/webext-native.** `formatViolations` are reported there but not self-healed, matching the existing recall-loop boundary. Lifting that boundary is its own change.
- **A real separate regional preference.** `formatLocale()` is the seam; wiring a persisted user preference through it (and asking for it at §1.7) was explicitly deferred in the spec.
- **Paraglide alias removal** at the next `templateVersion` bump (spec Open item 3).
- **Re-evaluate `unit()`** (spec Open item 4) once the budgets from Task 12 Step 2 are known.
