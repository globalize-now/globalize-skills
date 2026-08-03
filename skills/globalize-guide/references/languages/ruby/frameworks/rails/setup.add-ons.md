# Rails i18n: Coding Rules + Optional Add-Ons

This file is invoked from the Rails setup file (`references/languages/ruby/frameworks/rails/rails.setup.md`) after the core setup has been applied.

It has two parts. **The core step below always runs** — it is not an add-on and is not gated on any selection. The add-ons after it are the ones `SKILL.md §1.10` lets the user multi-select: run only the sub-steps that match the user's selections in `decisions.md` — skip the rest in silence. Every section here is independently re-runnable: if it has already been applied, detect that and skip without prompting.

Apply the same guided / unguided rules used elsewhere in setup:
- **Guided mode**: describe the change before making it and wait for confirmation.
- **Unguided mode**: apply directly; only stop on hard errors.

Rails paths are fixed by the core setup: catalogs live in `config/locales/{locale}.yml`, locale-rooted and nested; the built-in `I18n` API (`t`, `l`, `I18n.with_locale`) is used throughout; `rails-i18n` is installed for non-English plural rules and locale data.

---

## Core step: generate the coding rules (`generate_coding_rules` — always runs)

**This is a core Phase 2 step, not an add-on**, and it is **not** gated on a `SKILL.md §1.10` selection. Phase 3's wrap subagents read `.claude/globalize-rules.md` as their authoring contract — key conventions, plural rules, skip-list, real catalog paths — so conversion cannot start until this step has produced it. The only opt-in part is importing the file from the project's `CLAUDE.md`, which is **Add-on 1** below.

The Rails i18n coding rules are a **generated file**, not a shipped one. `references/languages/ruby/frameworks/rails/rails.rules.template.md` covers every configuration the Rails I18n path supports — `I18n.with_locale` and per-request locale scope, lazy dot-lookup, `%{name}` interpolation, `_html` keys, CLDR plural sub-keys, gender via sibling sub-keys, `l()` and the number helpers, and what not to wrap. This step renders it down to the one configuration this project actually has (only the branches that apply, with the project's real locale-file path and locales substituted in) and writes the result to `.claude/globalize-rules.md`.

**Read `references/rules-template-format.md` before rendering.** It is the whole rendering contract — template anatomy, the conditional grammar, the `<<placeholder>>` form, the step order, the header, the fail-closed rule. The steps below only add where *this library's* values come from.

### 1. Locate the template

Read `.globalize/manifest-snapshot.json` → `references.rulesTemplate`.

**If the entry has no `rulesTemplate`**, the installed skill is out of date — the `rails-yaml` variant carries one. Do not look for a generic `code.md`; it no longer exists for this library. Treat this exactly like the missing-file case below.

Verify the template exists in the target project.

- **If it exists**: proceed.
- **If it is missing — guided mode**: tell the user the `globalize-guide` skill is not installed in their project and stop this step. The fix is to reinstall it (`npx skills add globalize-now/globalize-skills --skill globalize-guide -a claude-code`). Don't attempt to recreate the file.
- **If it is missing — unguided mode**: do not block. Skip this step and record `⚠ Rails coding rules not generated — template missing` in the end-of-run summary, with the reinstall command shown above. Treat it as the fail-closed case in step 6: a core step did not complete, so Phase 3 has no rules file.

### 2. Resolve the template's `conditions`

Resolve every key listed in the template frontmatter's `conditions` and write them to `.globalize/rules-values.json`. Comparison values are string literals, so booleans resolve to `"true"` / `"false"`.

| Condition | Where to read it |
|---|---|
| `urlLocaleRouting` | `.globalize/decisions.md` → the routing-strategy answer the orchestrator collects for Rails in `SKILL.md §1.7` ("URL-locale routing (prefix `/:locale`) or none"): `"prefix"` or `"none"`. Confirm on disk — `"prefix"` requires a `scope "/:locale"` (or `scope "(:locale)"`) block in `config/routes.rb`. The file on disk wins if the two disagree: without that scope `params[:locale]` is always `nil`, and rules that tell the agent to read it are rules it will follow into a bug. |
| `railsI18nGem` | `"true"` when `rails-i18n` is in `Gemfile` or `Gemfile.lock` (Step 2 of the setup phase installs it), `"false"` otherwise. Prefer `Gemfile.lock` — it records what is actually resolved. |
| `modelContentGems` | `"true"` when `Gemfile` or `Gemfile.lock` lists `globalize`, `mobility`, or `traco` — the DB/model-content translation gems Step 1 detects and warns about. The `globalize` **gem** is unrelated to the Globalize.now platform; that is precisely why the branch exists. `"false"` when none of the three is present. |

### 3. Eliminate branches, then resolve the surviving `values`

Delete every false branch **and every marker line** (`<!-- if:`, `<!-- else -->`, `<!-- /if -->` all disappear, kept branch or not). Only then resolve the `values` still referenced in what survived — from the files **on disk**, the ones core setup actually wrote, not from `decisions.md`, which records what was asked for rather than what landed — appending them to the same `.globalize/rules-values.json`.

**The order is load-bearing.** Resolving up front would demand values that don't exist and trip step 6 on a perfectly healthy project.

| Value | Where to read it |
|---|---|
| `catalogPath` | The layout actually present under `config/locales/`. `config/locales/{locale}.yml` for the standard one-file-per-locale layout. If the app uses a split layout (`devise.en.yml`, `models.en.yml`, nested directories — all auto-loaded by Rails), write the glob that covers it instead, e.g. `config/locales/**/*.{locale}.yml`. Keep the `{locale}` token exactly as written. |
| `sourceLocale` | `config.i18n.default_locale` in `config/application.rb`, or in `config/initializers/locale.rb` if the app configures i18n there. Drop the leading colon (`:pt-BR` → `pt-BR`). Cross-check that `config/locales/<sourceLocale>.yml` exists in `config/locales/` — **this value becomes the YAML root key and the leading segment of every key path in the generated rules file**, so a wrong answer makes every example in it wrong. |
| `targetLocales` | `config.i18n.available_locales` (same two files) minus `sourceLocale`, comma-separated: `de, fr, ja`. If `available_locales` is unset, use the locale basenames actually present in `config/locales/`, minus `sourceLocale`. |

### 4. Render

Substitute every surviving `<<name>>` with its resolved value, strip the frontmatter, and **copy everything retained verbatim** — do not rewrite, summarize, reflow, re-order, or improve the prose. Prepend the two-line generated header:

```
<!-- globalize-rules v<templateVersion> | template=rails | variant=<manifest-snapshot variant> | generated by globalize-guide -->
<!-- Generated file. Re-running globalize-guide overwrites it. Put your own project rules in CLAUDE.md. -->
```

Write the result to `.claude/globalize-rules.md`, overwriting any file left by an earlier run.

**`.claude/globalize-rules.md` should be committed.** It is team-shared coding guidance, exactly like `CLAUDE.md` — every contributor's agent needs it. Do **not** add it to `.gitignore`; it is not a `.globalize/` progress artifact.

### 5. Self-check the generated file

All four must hold:

- zero occurrences of `<!-- if:`, `<!-- else -->`, `<!-- /if -->`
- zero occurrences of `<<`
- the header is on line 1
- the line count is within the template's `budget` for the resolved conditions

### 6. Fail closed

If **any** surviving condition or value can't be resolved, or the self-check fails: **never write a partial file.** Delete anything already written to `.claude/globalize-rules.md`, then:

- **Guided mode** — ask the user for the specific value. `catalogPath`, `sourceLocale`, and `targetLocales` are all one-line answers ("Which locale is your source?", "Do your translations live in one file per locale under `config/locales/`?"), and getting one beats shipping either wrong rules or none. Resolve, re-render, re-check. Only if the user can't answer, or the self-check still fails, stop this step and say which key or check failed.
- **Unguided mode** — don't block the run. Skip this step and record `⚠ Rails coding rules not generated (sourceLocale unresolved) — no rules file installed` in the end-of-run summary.

Either way a **core step did not complete**, so surface it instead of letting the run drift into conversion: report `generate_coding_rules` as failed, leave it unchecked in `plan.md`, and tell the orchestrator that Phase 3 has no `.claude/globalize-rules.md` to wrap against. The user then either supplies the missing value and re-runs this step, or converts knowing the wrap subagents are working without this project's rules.

There is no generic-rules fallback: `rails.code.md` was deleted when this library moved to a template, so the template is the only source of truth for Rails i18n rules. Installing nothing is recoverable — re-run this step. Installing rules whose YAML examples are rooted under the wrong locale, or that read `params[:locale]` on an app with no locale segment in its URLs, is not; the agent follows them into a bug on every future edit and nothing signals it.

---

## Add-on 1: Import the coding rules from `CLAUDE.md` (`install_coding_rules`)

**Only if the user selected it in `SKILL.md §1.10`** — this edits a file the user owns. Skip in silence otherwise; `.claude/globalize-rules.md` is on disk either way, and the user can add the import later.

The import is what carries the rules past setup: Claude Code doesn't reliably auto-trigger passive "coding rules" references during routine edits, but an `@`-imported file loads into every session's context.

If the core step failed and there is no `.claude/globalize-rules.md` on disk, skip this add-on — an `@` line pointing at a missing file opens every future session with a dangling import.

Check whether `CLAUDE.md` exists at the project root.

- **If it doesn't exist**, create it:
  ```
  # Project Instructions

  @.claude/globalize-rules.md
  ```

- **If it exists**, describe the change to the user ("I'll append `@.claude/globalize-rules.md` to your CLAUDE.md so the Rails i18n coding rules auto-load every session") and wait for confirmation in guided mode before appending. Put the line at the end of the file on its own line. Do not remove or reorder existing content.

If the exact `@` line is already present, skip silently — this add-on is idempotent.

Tell the user: "The first time you start a Claude Code session in this project, you'll see a one-time prompt asking to approve the `@` import. Approve it — otherwise the rules won't load."

Verify: in a fresh session, ask Claude "how should I switch locale per request in this project?" — the answer should reference `around_action` with `I18n.with_locale`, and warn against bare `I18n.locale =` assignment.

---

## Add-on 2: Linting

Rails i18n linting covers two distinct surfaces: **ERB views** and **Ruby files** (controllers, mailers, helpers, models). No single tool covers both. The purpose of this add-on is to catch new hardcoded strings as they are written — a continuous lint guard complementing the one-time discovery pass in the convert phase.

### The actual landscape (honest assessment)

**ERB views — `erb_lint` `HardCodedString` cop:**

`erb_lint`'s `HardCodedString` cop is the established ERB hardcoded-string finder. It has the rule and i18n autocorrect — it is the functional tool for ERB i18n discovery and ongoing guard. Caveat: `erb_lint` is effectively archived (last release January 2025; Shopify and GitHub are migrating off it), but `HardCodedString` works and there is no replacement that offers the same i18n rule today.

Add to the development group in `Gemfile` (if not already present — idempotent, safe if a later phase also adds it):

```ruby
group :development do
  gem "erb_lint", "~> 0.9", require: false
end
```

Create `.erb_lint.yml` at the project root if not present:

```yaml
# .erb_lint.yml
EnableDefaultLinters: false

linters:
  HardCodedString:
    enabled: true
```

`EnableDefaultLinters: false` keeps only `HardCodedString` active. If `.erb_lint.yml` already exists, check that `HardCodedString` is enabled — skip the file creation if so.

**Ruby files — `rubocop-i18n`:**

`rubocop-i18n` flags undecorated string literals in `.rb` files. The `I18n/RailsI18n` cop is the Rails complement; disable `I18n/GetText` to avoid spurious fires on Rails-style `t()` calls.

Add to the development group in `Gemfile` (if not already present):

```ruby
group :development do
  gem "rubocop-i18n", "~> 3.3", require: false
end
```

Add to `.rubocop.yml` (or create it if absent):

```yaml
# .rubocop.yml
# RuboCop ≥1.72: use plugins: instead of require:
require:
  - rubocop-i18n

I18n/RailsI18n:
  Enabled: true

I18n/GetText:
  Enabled: false
```

> **`require:` vs `plugins:`**: RuboCop ≥1.72 prefers `plugins: [rubocop-i18n]` over `require:`. For broader compatibility across Rails 6.1–8.1 projects, `require:` works everywhere; switch to `plugins:` if you see deprecation warnings.

**Herb (`herb-tools`) — the migration target for ERB linting, but NOT for i18n discovery:**

Herb is an actively-developed, modern ERB parser/linter/formatter and is the intended replacement for `erb_lint` for general ERB linting. It has a growing rule set (accessibility, ActionView, ERB formatting). However, **as of June 2026, Herb does not ship a hardcoded-string or i18n rule**. It cannot detect unlocalized user-facing strings. Do not install Herb as a replacement for `erb_lint`'s `HardCodedString` for i18n discovery — there is no equivalent rule.

Herb is a reasonable addition for general ERB linting and formatting (non-i18n rules). If the project wants it for that purpose, it can coexist with `erb_lint` running only `HardCodedString`. When Herb gains an i18n/hardcoded-string rule, it will become the preferred tool for ERB i18n linting — watch for that.

**Recommendation:** install `erb_lint` + `rubocop-i18n` for the i18n lint guard. They cover ERB and Ruby respectively and can run alongside each other in CI. Do not announce Herb as an i18n linter — it is not one yet.

### Running the linters

```bash
# ERB views
bundle exec erblint --lint-all --enable-linters HardCodedString app/views/

# Ruby files
bundle exec rubocop --only I18n app/controllers/ app/mailers/ app/helpers/ app/models/
```

---

## Add-on 3: CI/CD integration

Rails uses **`i18n-tasks`** for catalog hygiene — it audits existing `t()` call sites for missing keys, unused keys, and non-canonical YAML ordering. `i18n-tasks health` is the composite gate: it runs `missing` + `unused` together and exits non-zero if either fails. The CI integration runs this gate on every PR that touches locale files or application code (new `t()` calls with missing YAML keys are exactly what `health` catches in source paths).

> **Ownership note:** when the **convert phase** runs, it already installs `i18n-tasks` and scaffolds `config/i18n-tasks.yml` — it owns the gate's tooling (see `rails.convert.md` Step 4). Add-on 3's primary contribution is the **CI workflow** below. The gem + config install here is kept **idempotent** so a *setup-only + CI* run (convert not in scope) still gets the tooling; when convert already installed it, this step is a silent no-op.

Add `i18n-tasks` to the development/test group in `Gemfile` (if not already present — idempotent, safe if a later phase also adds it):

```ruby
group :development, :test do
  gem "i18n-tasks", "~> 1.0", require: false
end
```

Run `bundle install`.

Create `config/i18n-tasks.yml` at the project root if not present:

```yaml
# config/i18n-tasks.yml
base_locale: en
locales: [en, es]  # replace with your configured locales

search:
  paths:
    - app/

# Suppress "missing" warnings for keys that rails-i18n already provides.
ignore_missing:
  - 'activerecord.errors.messages.*'
  - 'activerecord.errors.models.*'
  - 'number.*'
  - 'date.*'
  - 'datetime.*'
  - 'time.*'
  - 'support.*'
  - 'errors.messages.*'
```

If `config/i18n-tasks.yml` already exists, skip file creation.

### Run the audit locally

`i18n-tasks` commands are run via `bundle exec`:

```bash
bundle exec i18n-tasks health
bundle exec i18n-tasks normalize
```

### Normalize drift check

After `health` passes, use the normalize-then-diff idiom to verify locale files are in canonical order (catches ordering drift introduced by hand-edits or TMS exports):

```bash
bundle exec i18n-tasks normalize && git add --intent-to-add config/locales/ && git diff --exit-code config/locales/
```

This runs `normalize` (which rewrites YAML to canonical key order) and then checks that no diff was produced — if a file was out of order, `normalize` will have changed it and `git diff --exit-code` fails the step.

> **Untracked files:** a plain `git diff --exit-code` sees only **tracked** files. Freshly-scaffolded target stubs (`de.yml`, `fr.yml`, …) are untracked on a first run, so drift in them would slip past unnoticed. The `git add --intent-to-add config/locales/` above registers untracked files so the diff sees them. (On CI after `actions/checkout` the committed locale files are already tracked, so `--intent-to-add` is a harmless no-op there while making local runs sound.)
>
> **Exit code through a pipe:** do not pipe this command into a filter (`… | grep …`) and then read `$?` — the pipe reports the *last* command's exit status, not `i18n-tasks`'. A piped `normalize`/`health` can read as green when it actually failed. Read `${PIPESTATUS[0]}`, or run the command unpiped.

### GitHub Actions workflow

If the project has `.github/workflows/`, scaffold `.github/workflows/i18n.yml`:

```yaml
name: i18n

on:
  pull_request:
    paths:
      - 'config/locales/**'
      - 'app/**'
      - 'config/i18n-tasks.yml'
      - '.github/workflows/i18n.yml'

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ruby/setup-ruby@v1
        with:
          ruby-version: .ruby-version
          bundler-cache: true
      - name: Check catalog health (missing + unused keys)
        run: bundle exec i18n-tasks health
      - name: Check locale files are in canonical order
        run: bundle exec i18n-tasks normalize && git add --intent-to-add config/locales/ && git diff --exit-code config/locales/
```

The `paths` filter on `app/**` ensures that new `t()` call sites with no matching YAML key — which is exactly what `health` catches — also trigger the workflow, not just changes to `config/locales/`. Adjust `ruby-version: .ruby-version` to match the project's Ruby version file (`.ruby-version`, `.tool-versions`, or inline in `Gemfile`).

If the project does not have `.github/workflows/`, skip the workflow scaffold and add the commands to `Rakefile` or the project's existing CI; tell the user how to wire `bundle exec i18n-tasks health` into their CI of choice.

### Why `i18n-tasks health` matters

`i18n-tasks` can only audit keys that are already wrapped with `t()` — it does NOT find raw hardcoded strings (that is the job of `erb_lint`/`rubocop-i18n` in Add-on 2). What it does: after every PR, it ensures that every `t('key')` call in the codebase has a YAML entry in every configured locale, and that no YAML entries are orphaned. This makes missing-translation gaps visible in review rather than silently falling back to a raw key in production.

---

## Add-on 4: Test setup helper

This add-on is **not required** for the initial setup to work. Tests that don't assert on locale-specific output are unaffected. But a test that needs to render a view, call a controller action, or invoke a helper under a specific locale must set the active locale first — otherwise `I18n.locale` resolves under whatever locale the test environment defaults to.

Rails' `I18n.locale` is **thread-local**, and test frameworks run in the same process threads. The safe locale-switching pattern — identical to the one required in production — is the **block form `I18n.with_locale`**, which restores the prior locale in an `ensure` block automatically:

```ruby
I18n.with_locale(:fr) { ... }
```

This is the only safe form in tests: it auto-resets after the block, even on exceptions.

### Detect the test framework

Check whether `spec/` exists and `rspec` or `rspec-rails` is in `Gemfile`. If present, the project uses **RSpec**. Otherwise, it uses **Minitest** (Rails default — tests in `test/`).

### RSpec helper

Add to `spec/rails_helper.rb` (or `spec/spec_helper.rb` if the project does not use `rails_helper`):

```ruby
# spec/rails_helper.rb

# Reset the locale between tests so one example's I18n.with_locale
# does not leak into the next (locale is thread-local in Rails).
RSpec.configure do |config|
  config.before do
    I18n.locale = I18n.default_locale
  end
end
```

Then in individual specs, wrap locale-dependent assertions with `I18n.with_locale`:

```ruby
# spec/requests/home_spec.rb
RSpec.describe "Home page" do
  it "renders the French greeting" do
    I18n.with_locale(:fr) do
      get root_path
      expect(response.body).to include("Bienvenue")
    end
  end

  it "renders the Spanish page title" do
    I18n.with_locale(:es) do
      get root_path
      expect(response.body).to include("Mi aplicación")
    end
  end
end
```

For system specs that go through a real browser driver (Capybara + Selenium/Cuprite), set the locale via the URL param or session rather than `I18n.with_locale` — the browser request goes through the `around_action` switcher in `ApplicationController`, which resolves the locale from `params[:locale]`:

```ruby
# spec/system/locale_spec.rb
RSpec.describe "Locale switching" do
  it "shows the French UI when locale param is fr" do
    visit root_path(locale: :fr)
    expect(page).to have_text("Bienvenue")
  end
end
```

### Minitest helper

Add a `setup` method to `ActiveSupport::TestCase` in `test/test_helper.rb`:

```ruby
# test/test_helper.rb
class ActiveSupport::TestCase
  # Reset locale before each test — thread-local I18n.locale
  # can leak between tests run in the same thread.
  setup do
    I18n.locale = I18n.default_locale
  end
end
```

In individual tests, wrap locale-dependent assertions with `I18n.with_locale`:

```ruby
# test/controllers/home_controller_test.rb
class HomeControllerTest < ActionDispatch::IntegrationTest
  test "renders French greeting" do
    I18n.with_locale(:fr) do
      get root_path
      assert_match "Bienvenue", response.body
    end
  end
end
```

### Thread-local pitfalls

- **`I18n.locale =` without a block does not reset.** In a multi-threaded test run (parallel tests, Puma dev server), a bare `I18n.locale = :fr` in one test leaks into any subsequent request or test running on the same thread. Always use `I18n.with_locale` for test assertions — it restores the prior value in `ensure`.
- **The `before` reset is a backstop, not a substitute.** The `before { I18n.locale = I18n.default_locale }` hook (or Minitest `setup`) resets thread-local state at the start of each example, guarding against any bare assignment that slipped through. It does not replace using `I18n.with_locale` in the test body — both layers together are the safe pattern.
- **Parallel test suites.** Parallel test runners (e.g. the `parallel_tests` gem for RSpec, or `rails parallel:test` / Rails' built-in `rails test` parallelization for Minitest) spin up separate processes rather than threads, so cross-process locale leaks are not a concern. Thread-local leaks are only between tests sharing the same process — the `before` reset plus the `I18n.with_locale` block form cover this case.

---

## End

Record applied add-ons in the end-of-run summary so the user has an audit trail of what was wired up.
