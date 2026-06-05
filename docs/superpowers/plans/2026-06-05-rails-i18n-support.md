# Rails i18n Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Ruby/Rails language branch to the `i18n-guide` skill that detects a Rails app, sets up built-in `I18n` with locale-rooted YAML, wraps hardcoded strings, and connects `config/locales/{locale}.yml` to Globalize.now as the `yaml-rails` fileFormat.

**Architecture:** Rails is framework + built-in i18n in one, so it collapses to a single framework-rooted node `references/languages/ruby/frameworks/rails/` (4 markdown files), mirroring the Django plan. A `rails-yaml` manifest variant routes to those files; the SKILL.md orchestrator gains an additive `language` (`js-ts` | `ruby`) dimension with Ruby/Rails detection, a name-collision guardrail, and a `gettext_i18n_rails` STOP. The JS path is untouched.

**Tech Stack:** Markdown skill references, `manifest.json` (validated with `jq` — no JSON-schema file exists in-repo), Rails 6.1–8.1 built-in I18n, `rails-i18n` / `i18n-tasks` / `herb` gems (Bundler `~>` pins), Globalize.now `yaml-rails` fileFormat.

**Reference (read before authoring):** spec `docs/superpowers/specs/2026-06-05-rails-i18n-support-design.md`; research `reports/rails-i18n-research-2026-06-04.md`. **Template siblings to copy structure from:** `references/languages/js-ts/libraries/vue-i18n/setup.shared.md` (Out-of-Scope + Step-Risk + Setup-Mode idiom), `references/languages/js-ts/libraries/paraglide/setup.add-ons.md` (add-ons structure), `references/languages/js-ts/libraries/paraglide/code.md` (passive `code.md` idiom), and any existing `*.convert.md`.

**Authoring note:** Each reference-file task names its template sibling and the load-bearing content that MUST appear verbatim. The surrounding prose is authored at execution time by reading the named sibling as the structural template (this repo is subagent-driven and self-contained per skill) — match the sibling's section headings, tone, and guided/unguided idiom. Do **not** invent package/API names; everything technical is pinned in the spec/research.

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `skills/i18n-guide/references/languages/ruby/frameworks/rails/rails.code.md` | PASSIVE coding rules (`@import`-wired) | Create |
| `…/rails/rails.setup.md` | Phase-2 setup (config, scaffold, `with_locale`, `rails-i18n`) | Create |
| `…/rails/rails.convert.md` | Phase-3 string wrapping + extraction/audit | Create |
| `…/rails/setup.add-ons.md` | `@import` wiring, lint, CI, test helper | Create |
| `skills/i18n-guide/manifest.json` | Add `rails-yaml` variant | Modify |
| `skills/i18n-guide/SKILL.md` | `language` dimension, Ruby detection, STOP rules, recommendation, Phase-4 mapping | Modify |
| `skills/globalize-now-cli-setup/SKILL.md` | Recognize `config/locales/{locale}.yml` → `yaml-rails` | Modify |
| `library-checks` tracker (locate in Task 8) | Track `rails-i18n` / `i18n-tasks` / `herb` | Modify |

---

## Task 1: Scaffold Ruby branch + passive `rails.code.md`

**Files:**
- Create: `skills/i18n-guide/references/languages/ruby/frameworks/rails/rails.code.md`

**Template sibling:** `references/languages/js-ts/libraries/paraglide/code.md` (passive-rules tone, descriptive-key + request-scoped-locale sections).

- [ ] **Step 1: Write the validation check (expect fail)**

```bash
cd skills/i18n-guide
F=references/languages/ruby/frameworks/rails/rails.code.md
test -f "$F" \
 && grep -q "I18n.with_locale" "$F" \
 && grep -q "globalize" "$F" \
 && grep -qi "do not concatenate\|%{" "$F" \
 && grep -q "_html" "$F" \
 && grep -qi "rails-i18n" "$F" \
 && echo PASS || echo FAIL
```
Expected now: `FAIL` (file absent).

- [ ] **Step 2: Author `rails.code.md`.** Must contain these load-bearing PASSIVE rules:
  - **Per-request locale:** always `I18n.with_locale(locale) { … }` block form in an `around_action`; **never bare `I18n.locale =`** (thread-bleed across pooled Puma threads).
  - **Lazy lookup:** new view/controller strings use `t('.key')`; the YAML key path MUST mirror the template/action path (`app/views/books/index.html.erb` → `en.books.index.key`).
  - **Interpolation:** `t('greeting', name: x)` against `"%{name}"`; **never build sentences by Ruby string concatenation** (breaks word order/grammar for translators).
  - **HTML:** use `html`/`_html` keys for translations containing markup; rely on auto-escaping of interpolated vars; never `raw`/`html_safe` a user value.
  - **Plurals:** CLDR sub-keys (`zero`/`one`/`two`/`few`/`many`/`other`) selected by `:count`; non-English locales need `rails-i18n` (core Rails ships only the English rule).
  - **What NOT to wrap:** model/DB-content gems (`globalize` — *the gem, unrelated to Globalize.now* — `mobility`, `traco`); anything in `db/`; `rails-i18n`-provided framework defaults; non-user-facing config/log/internal strings.

- [ ] **Step 3: Run the validation check**

Run the Step-1 block. Expected: `PASS`.

- [ ] **Step 4: Commit**

```bash
git add skills/i18n-guide/references/languages/ruby/frameworks/rails/rails.code.md
git commit -m "feat(skill): add Rails passive i18n coding rules (rails.code.md)"
```

---

## Task 2: `rails.setup.md` (Phase 2)

**Files:**
- Create: `skills/i18n-guide/references/languages/ruby/frameworks/rails/rails.setup.md`

**Template sibling:** `references/languages/js-ts/libraries/vue-i18n/setup.shared.md` (Out-of-Scope, Step-Risk Classification, Setup-Mode guided/unguided).

- [ ] **Step 1: Validation check (expect fail)**

```bash
cd skills/i18n-guide
F=references/languages/ruby/frameworks/rails/rails.setup.md
test -f "$F" \
 && grep -q "config.i18n.default_locale" "$F" \
 && grep -q "I18n.with_locale" "$F" \
 && grep -q "around_action" "$F" \
 && grep -Eq 'rails-i18n.*~>|gem .rails-i18n' "$F" \
 && grep -qi "no version gating\|version gating\|6.1\|7.2\|8.1" "$F" \
 && echo PASS || echo FAIL
```
Expected: `FAIL`.

- [ ] **Step 2: Author `rails.setup.md`.** Required content:
  - **Out of Scope / hard-stops:** non-Rails Ruby (Sinatra/Hanami/plain `i18n`); `gettext_i18n_rails`/PO projects (v1 = YAML only — STOP/defer); model-content gems are not this phase's job.
  - **Step Risk Classification** table (Detect=read-only; install gem=additive; config edits=modifies-existing-file → consent gate) and the **guided/unguided Setup Mode** block, matching the sibling.
  - **Config** (`config/application.rb` or an initializer): `config.i18n.default_locale`, `config.i18n.available_locales`, `enforce_available_locales`, `config.i18n.fallbacks`. Note `config/locales/*.{rb,yml}` auto-load.
  - **`config/locales/` scaffold** with a populated `en.yml` (Globalize keys off a populated source file).
  - **`ApplicationController`** `around_action :switch_locale` using the **`I18n.with_locale` block form** (show the exact method from the spec). Optional URL-locale: `scope "/:locale"` + `default_url_options { { locale: I18n.locale } }`.
  - **`rails-i18n`** Gemfile add, pinned `gem "rails-i18n", "~> <Rails-major>.<minor>"` (pin tracks the detected Rails major — explain how to derive it from `Gemfile.lock`). `bundle install`.
  - **`raise_on_missing_translations`** enabled in the `test` environment.
  - **Explicit "no version gating" note:** emitted i18n code is identical across Rails 6.1→8.1; default target 8.1; soft EOL warning for ≤7.1; no `USE_L10N`/`ugettext`-style branches (contrast Django).

- [ ] **Step 3: Run the validation check.** Expected: `PASS`.

- [ ] **Step 4: Commit**

```bash
git add skills/i18n-guide/references/languages/ruby/frameworks/rails/rails.setup.md
git commit -m "feat(skill): add Rails i18n setup reference (rails.setup.md)"
```

---

## Task 3: `rails.convert.md` (Phase 3)

**Files:**
- Create: `skills/i18n-guide/references/languages/ruby/frameworks/rails/rails.convert.md`

**Template sibling:** an existing `*.convert.md` (e.g. `references/languages/js-ts/frameworks/nuxt/vue-i18n.convert.md`).

- [ ] **Step 1: Validation check (expect fail)**

```bash
cd skills/i18n-guide
F=references/languages/ruby/frameworks/rails/rails.convert.md
test -f "$F" \
 && grep -q "t('\.\|lazy" "$F" \
 && grep -qi "mailer" "$F" \
 && grep -qi "activerecord.errors\|validation" "$F" \
 && grep -qi "i18n-tasks" "$F" \
 && grep -qi "herb\|erb_lint\|rubocop-i18n" "$F" \
 && grep -q "%{" "$F" \
 && echo PASS || echo FAIL
```
Expected: `FAIL`.

- [ ] **Step 2: Author `rails.convert.md`.** Required content:
  - **Discovery (raw-string finding):** `i18n-tasks` does NOT find hardcoded strings — state this explicitly. Use **Herb** (preferred; note erb_lint effectively archived) / `erb_lint` `HardCodedString` cop (ERB) / `rubocop-i18n` (Ruby) to discover untranslated text.
  - **Location-aware wrapping:** views → `t('.key')` with YAML written under the mirrored path; controller **flashes**; **model validation messages** → symbol keys under `activerecord.errors.models.*` / `messages`; **mailers** (subject + body); helpers. Interpolation `%{name}` (never concatenate). `_html` keys for markup. `l()` for dates/numbers/currency.
  - **Audit/normalize:** after wrapping, run `i18n-tasks missing`, `i18n-tasks unused`, `i18n-tasks normalize`; resolve before connecting.
  - **Do-not-touch:** model-content gems' columns/tables; `db/`.
  - **Run steps** (exact commands): the chosen linter invocation, then the `i18n-tasks` commands.

- [ ] **Step 3: Run the validation check.** Expected: `PASS`.

- [ ] **Step 4: Commit**

```bash
git add skills/i18n-guide/references/languages/ruby/frameworks/rails/rails.convert.md
git commit -m "feat(skill): add Rails i18n convert reference (rails.convert.md)"
```

---

## Task 4: `setup.add-ons.md`

**Files:**
- Create: `skills/i18n-guide/references/languages/ruby/frameworks/rails/setup.add-ons.md`

**Template sibling:** `references/languages/js-ts/libraries/paraglide/setup.add-ons.md` (Add-on structure, idempotent `@import`, CI, test helper).

- [ ] **Step 1: Validation check (expect fail)**

```bash
cd skills/i18n-guide
F=references/languages/ruby/frameworks/rails/setup.add-ons.md
IMPORT='@.claude/skills/i18n-guide/references/languages/ruby/frameworks/rails/rails.code.md'
test -f "$F" \
 && grep -qF "$IMPORT" "$F" \
 && grep -qi "i18n-tasks health\|i18n-tasks" "$F" \
 && grep -qi "with_locale" "$F" \
 && echo PASS || echo FAIL
```
Expected: `FAIL`.

- [ ] **Step 2: Author `setup.add-ons.md`** with four add-ons mirroring the Paraglide sibling:
  - **Add-on 1 — Coding rules (`@import`):** idempotently append the exact line `@.claude/skills/i18n-guide/references/languages/ruby/frameworks/rails/rails.code.md` to the project root `CLAUDE.md` (create if absent); guided/unguided handling; the "approve the `@` import once" note; the "skill not installed → reinstall, don't recreate" fallback.
  - **Add-on 2 — Lint:** Be honest about the landscape — **Herb** (preferred, modern; `HardCodedString`-style i18n rule), `erb_lint` `HardCodedString` (effectively archived), `rubocop-i18n` (Ruby). Pin with Bundler `~>`. Recommend Herb for new setups; detect erb_lint if already present.
  - **Add-on 3 — CI:** a GitHub Actions workflow running `i18n-tasks health` (and `i18n-tasks normalize --pattern-router ... ` check / `i18n-tasks missing` gate) on PRs touching `config/locales/**`. Mirror the sibling's structure; install via Bundler.
  - **Add-on 4 — Test helper:** wrapping examples under `I18n.with_locale(:fr) { … }` for request/system specs; resetting locale between tests; note thread-local pitfalls.

- [ ] **Step 3: Run the validation check.** Expected: `PASS`.

- [ ] **Step 4: Commit**

```bash
git add skills/i18n-guide/references/languages/ruby/frameworks/rails/setup.add-ons.md
git commit -m "feat(skill): add Rails i18n setup add-ons (setup.add-ons.md)"
```

---

## Task 5: `manifest.json` — `rails-yaml` variant

**Files:**
- Modify: `skills/i18n-guide/manifest.json`

**Depends on Tasks 1–4** (referenced paths must exist).

- [ ] **Step 1: Validation check (expect fail)**

```bash
cd skills/i18n-guide
jq -e '.stacks[] | select(.variant=="rails-yaml")' manifest.json >/dev/null 2>&1 && echo PASS || echo FAIL
```
Expected: `FAIL`.

- [ ] **Step 2: Add the variant** to `stacks[]`. **Match the existing entry shape exactly** (verified: entries carry `variant`, `match`, `supportLevel`, `packages` {runtime, dev}, `references`; they do **NOT** carry any `connect`/`fileFormat` key — the Phase-4 fileFormat mapping lives in `SKILL.md` prose and is handled in Task 6, **not here**). `packages` is npm-only, so it stays **empty** for Rails — the `rails-i18n`/`i18n-tasks`/`herb` **gems are installed via Bundler inside `rails.setup.md`/`setup.add-ons.md`**, not by the manifest's npm-install path. Record the gem list as an additive informational `gems` block (no consumer reads it yet; `jq` validity is the only gate since no JSON-schema file exists):

```json
{
  "variant": "rails-yaml",
  "match": { "language": "ruby", "framework": "rails", "library": "rails-i18n" },
  "supportLevel": "stable",
  "packages": { "runtime": [], "dev": [] },
  "gems": {
    "runtime": ["rails-i18n ~> 8.1"],
    "dev": ["i18n-tasks ~> 1.1", "herb ~> 0.10"]
  },
  "references": {
    "setup": ["references/languages/ruby/frameworks/rails/rails.setup.md"],
    "convert": ["references/languages/ruby/frameworks/rails/rails.convert.md"],
    "code": ["references/languages/ruby/frameworks/rails/rails.code.md"]
  }
}
```
Notes: existing `match` predicates have no `language` key — adding one here is additive, and Task 6 makes the 1.4 matcher treat a missing `language` as the JS path (so this entry only matches Ruby detection and the JS entries are unaffected). `rails-i18n`'s pin tracks the detected Rails major; `~> 8.1` is the default-target value, and `rails.setup.md` derives the real pin from `Gemfile.lock`. The `yaml-rails` fileFormat + `config/locales/{locale}.yml` pattern + `en` source are encoded in **SKILL.md Phase 4** (Task 6), consistent with how Lingui/next-intl/Paraglide formats are recorded today.

- [ ] **Step 3: Validate JSON + path resolution**

```bash
cd skills/i18n-guide
jq -e '.stacks[] | select(.variant=="rails-yaml")' manifest.json >/dev/null && echo "variant OK"
# every referenced file must exist:
jq -r '.stacks[] | select(.variant=="rails-yaml") | .references | to_entries[].value[]' manifest.json \
  | while read p; do test -f "$p" && echo "ok  $p" || echo "MISSING $p"; done
```
Expected: `variant OK` and every path `ok` (no `MISSING`).

- [ ] **Step 4: Commit**

```bash
git add skills/i18n-guide/manifest.json
git commit -m "feat(skill): add rails-yaml manifest variant (yaml-rails fileFormat)"
```

---

## Task 6: `SKILL.md` orchestrator — Ruby detection + dispatch

**Files:**
- Modify: `skills/i18n-guide/SKILL.md` (Phase 1.1 detection schema + rules; 1.2 compatibility STOPs; 1.4 manifest match; 1.5 recommendation; Phase-4 mapping).

**This is the riskiest, most invasive edit — keep additive; the JS path must be unchanged.**

- [ ] **Step 1: Snapshot the JS path is intact (regression guard) + new-token check (expect fail for new tokens)**

```bash
cd skills/i18n-guide
# Existing JS detection markers MUST remain after the edit (record current counts):
grep -c '"framework"' SKILL.md; grep -c 'react-scripts' SKILL.md
# New Ruby tokens not present yet:
grep -qi 'ruby\|rails\|Gemfile\|gettext_i18n_rails\|globalize gem\|yaml-rails' SKILL.md && echo HAS_RUBY || echo NO_RUBY
```
Expected: counts noted; `NO_RUBY`.

- [ ] **Step 2: Edit SKILL.md** — additive Ruby support:
  - **Detection schema:** add a `language` field (`"js-ts" | "ruby" | "unknown"`); for Ruby add `framework: "rails"`, `packageManager: "bundler"`, Rails `version` (from `Gemfile.lock`), and existing-i18n signals.
  - **Detection rules:** Ruby/Rails signals — `Gemfile`/`Gemfile.lock` containing `rails`, `bin/rails`, `config/application.rb`, `config/environments/`, `config/locales/*.yml`, `.ruby-version`. Detect existing i18n: `config.i18n.*`, an `around_action`/`with_locale` switcher, `rails-i18n` present, `config/locales` populated/split.
  - **Name-collision guardrail:** treat `globalize` (the gem), `mobility`, `traco` as **model/DB-content translation — detect-and-warn, never trigger UI logic, never conflate `globalize` with Globalize.now.**
  - **Compatibility STOP/branch:** if `gettext_i18n_rails` present → STOP ("PO/gettext overlay not yet supported in v1; YAML path only"). Soft EOL warning for Rails ≤7.1; **no emission gating** (support to 6.1, default 8.1).
  - **Manifest match (1.4):** make the matcher predicate on `language` — a `match.language` of `"ruby"` requires `detection.language === "ruby"`; entries with **no** `language` key are JS entries and must only match `detection.language === "js-ts"` (treat absent ⇒ js-ts). This keeps `rails-yaml` Ruby-only and the JS entries unaffected.
  - **Recommendation (1.5):** add a row — `framework === "rails"` → **Rails built-in I18n (YAML)**, one-line rationale.
  - **Phase-4 mapping (the fileFormat lives HERE, not in manifest):** in the Phase-4 prose around `SKILL.md:466` — the "the **file format** follows the catalog: … `po` for Lingui, `json-nested` for next-intl, etc." enumeration — add **Rails → `yaml-rails` with catalog path `config/locales/{locale}.yml`, source `en`/detected `default_locale`**. Note hyphenated locale pass-through (no underscore normalization).

- [ ] **Step 3: Validate additive edit (JS intact + Ruby present)**

```bash
cd skills/i18n-guide
grep -q 'react-scripts' SKILL.md && echo "JS path intact" || echo "REGRESSION: JS markers lost"
grep -qi 'rails' SKILL.md && grep -qi 'yaml-rails' SKILL.md && grep -qi 'gettext_i18n_rails' SKILL.md \
  && grep -qi 'mobility\|model.*content\|globalize.*gem' SKILL.md && echo "Ruby support present" || echo "FAIL"
```
Expected: `JS path intact` and `Ruby support present`.

- [ ] **Step 4: Hand-trace check (document in commit body).** Trace a fake `detection.json` `{language:"ruby", framework:"rails", library:"rails-i18n"}` through 1.4 → confirm it selects ONLY `rails-yaml`; trace `{language:"js-ts", framework:"next", …}` → confirm it still selects the Next entries and NOT `rails-yaml`. Confirm a `gettext_i18n_rails`-present project hits the STOP.

- [ ] **Step 5: Commit**

```bash
git add skills/i18n-guide/SKILL.md
git commit -m "feat(skill): wire Rails detection/dispatch into i18n-guide orchestrator"
```

---

## Task 7: `globalize-now-cli-setup` — Rails locale detection

**Files:**
- Modify: `skills/globalize-now-cli-setup/SKILL.md`

- [ ] **Step 1: Validation check (expect fail)**

```bash
grep -qi 'config/locales\|yaml-rails' skills/globalize-now-cli-setup/SKILL.md && echo HAS || echo MISSING
```
Expected: `MISSING`.

- [ ] **Step 2: Edit** the detection step to recognize `config/locales/{locale}.yml` (locale-rooted nested) → `fileFormat: yaml-rails`, source `en`/`default_locale`; pass hyphenated locale codes through (minimal normalization); handle split/nested `config/locales/` layouts.

- [ ] **Step 3: Validation check.** Run Step-1 grep. Expected: `HAS`.

- [ ] **Step 4: Commit**

```bash
git add skills/globalize-now-cli-setup/SKILL.md
git commit -m "feat(skill): detect Rails config/locales as yaml-rails in cli-setup"
```

---

## Task 8: `library-checks` — track Rails gems

**Files:**
- Modify: the library-checks tracker (locate it).

- [ ] **Step 1: Locate the tracker**

```bash
cd /Users/arturs/Projects/globalize/globalization-skills
ls reports/library-check-*.md | tail -3
grep -rl 'library-check\|libraryChecks\|next-intl@\|@lingui/core' .claude 2>/dev/null
grep -rln 'next-intl\|@lingui' --include=*.md --include=*.json --include=*.toml . | grep -iv 'skills/i18n-guide/references' | head
```
Identify whether the tracked-library list lives in a config/doc (scheduled task) or only in the dated `reports/`. If it's only the dated reports, the "tracker" is the scheduled check definition — find it under `.claude/` (scheduled tasks) or the repo automation; add the gems there. If no central list exists, record this in the task note and add the gems to the most recent tracking doc + wherever the daily check reads its list.

- [ ] **Step 2: Add gems** `rails-i18n` (pin tracks Rails major), `i18n-tasks`, `herb` to the tracked list. Note erb_lint is effectively archived (don't track as primary). Record Bundler `~>` pins, not npm carets.

- [ ] **Step 3: Validate** the gems appear in the tracked list (grep the file you edited).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: track rails-i18n / i18n-tasks / herb in library-checks"
```

---

## Task 9: Verification — live Rails round-trip (thorough path)

**No commit of fixtures** — fixtures are throwaway; this task proves the skill works end-to-end and resolves the open items (the `yaml-rails` format string; `_html` round-trip).

- [ ] **Step 1: Stand up a modern Ruby + Rails toolchain.** Local Ruby is 2.6 (too old; `rails-i18n` needs ≥3.2). Install via rbenv or asdf:

```bash
# rbenv path (adjust if asdf is preferred/installed):
brew install rbenv ruby-build 2>/dev/null; rbenv install -s 3.3.6; rbenv local 3.3.6
ruby -v   # expect 3.3.x
gem install rails -v '~> 8.1'
rails -v  # expect Rails 8.1.x
```
If toolchain install is blocked/derails, STOP and report to the user (they chose the thorough path; surface the blocker rather than silently downgrading to structural-only).

- [ ] **Step 2: Scaffold an 8.1 fixture** in a temp dir and add a model/view/mailer with hardcoded strings:

```bash
cd "$(mktemp -d)"; rails new railsfix --minimal && cd railsfix
bin/rails g scaffold Book title:string >/dev/null
# add a hardcoded flash + a mailer + an _html string + a pluralized count string by hand
```

- [ ] **Step 3: Apply the skill's setup steps by hand** (follow `rails.setup.md`): config.i18n.*, `config/locales/en.yml` populated, `around_action` + `I18n.with_locale` block in `ApplicationController`, `gem "rails-i18n", "~> 8.1"`, `bundle install`, `raise_on_missing_translations` in test. Verify: **no bare `I18n.locale =`**, app boots (`bin/rails runner 'puts I18n.t(:hello, default: "x")'`).

- [ ] **Step 4: Apply convert steps:** wrap the strings per `rails.convert.md` (lazy `t('.key')` with mirrored YAML paths; flash; mailer; model validation; `%{}`; `_html`; a CLDR plural group). Run `i18n-tasks health` and confirm it passes (no missing/unused after wrapping).

- [ ] **Step 5: Inspect the catalog.** `config/locales/en.yml` shows locale-rooted nesting, a CLDR plural group (`one`/`other`), a `%{}` interpolation, and an `_html` key with markup intact.

- [ ] **Step 6: Live `yaml-rails` round-trip through Globalize.now.** Using `globalize-now-cli-setup`/`globalize-now-cli-use`, connect `config/locales/{locale}.yml` as **`yaml-rails`** with `en` source and push/pull a target locale. **Confirm:**
  - the platform **accepts the `yaml-rails` fileFormat string** (this is open item #1 — if the platform names it differently, record the real string and update the spec + manifest + cli-setup);
  - the CLDR plural group round-trips **as a plural** (categories preserved);
  - the `_html` markup survives without escaping/stripping (open item #2);
  - the `%{}` interpolation is preserved.

- [ ] **Step 7: Record results** in `reports/rails-i18n-verification-2026-06-05.md` (what passed, the confirmed `yaml-rails` string, any deviations + follow-up edits made). Commit that report.

```bash
cd /Users/arturs/Projects/globalize/globalization-skills
git add reports/rails-i18n-verification-2026-06-05.md
git commit -m "test: live yaml-rails round-trip verification for Rails i18n"
```

- [ ] **Step 8: Reconcile open items.** If Step 6 revealed the real format string or any encoding nuance, apply the fix across `manifest.json`, `SKILL.md`, `globalize-now-cli-setup`, and the spec, then re-run Task 5/6/7 validation checks. Commit.

---

## Self-review (run before handing off to execution)

- **Spec coverage:** Tasks 1–4 = the four reference files; Task 5 = manifest `rails-yaml`/`yaml-rails`; Task 6 = SKILL.md detection/STOP/recommendation/Phase-4 + name-collision guardrail + `gettext_i18n_rails` STOP + no-gating; Task 7 = cli-setup detection; Task 8 = library-checks; Task 9 = thorough verification incl. the four open items. Every spec section maps to a task.
- **Placeholder scan:** the reference-file *prose* is delegated to execution-time authoring against named template siblings (repo convention) with load-bearing content enumerated verbatim — not a placeholder, but flag if any reviewer wants full drafts inline.
- **Consistency:** the `@import` path, the manifest `references.*` paths, and the Task-1 file path all use `references/languages/ruby/frameworks/rails/rails.code.md` identically; `yaml-rails` + `config/locales/{locale}.yml` + `en` source are identical across Tasks 5/6/7/9.
- **Resolved during planning:** the Phase-4 fileFormat is **SKILL.md prose (line ~466), not manifest** — Task 5 keeps the manifest entry to the verified shape (empty npm `packages`, gems via Bundler in the references, informational `gems` block), and Task 6 places the `yaml-rails` mapping in the Phase-4 enumeration.
- **Known soft spots (resolve during execution):** (a) library-checks tracker location — discovery step in Task 8; (b) the live `yaml-rails` string + `_html` round-trip — confirmed in Task 9, with Step 8 reconciling any deviation back into manifest/SKILL.md/cli-setup/spec.
