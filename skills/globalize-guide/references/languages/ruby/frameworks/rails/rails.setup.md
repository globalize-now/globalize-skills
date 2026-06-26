# Rails i18n Setup

Rails ships a full i18n stack out of the box: the `I18n` API, `t`/`l` view helpers, lazy dot-lookup (`t('.key')`), locale-rooted YAML catalogs at `config/locales/`, `%{name}` interpolation, and CLDR plural sub-keys. This setup phase configures that built-in stack — adding `rails-i18n` for non-English plural rules and locale data, wiring a safe per-request locale switcher, and scaffolding the source-locale catalog so Globalize can key off a populated file.

The emitted translation code (`t`, `l`, `with_locale`, locale-rooted YAML, CLDR plural sub-keys) is identical across Rails 6.1 → 8.1 — no version-gated branches are emitted. Default target is Rails 8.1; the skill supports 6.1 through 8.1 at the same code level.

Follow these steps in order. Each builds on the last.

---

## Out of Scope

This setup phase covers **Ruby on Rails** projects using the **built-in `I18n` API with locale-rooted YAML catalogs** (`config/locales/{locale}.yml`). It does not cover:

- **Non-Rails Ruby** (Sinatra, Hanami, plain `i18n` gem, Grape, Padrino) — different boot structure, no `around_action`, no Rails config layer. **Hard stop.** Point the user at the `i18n` gem docs directly.
- **`gettext_i18n_rails` / `fast_gettext` projects** — the catalog format is PO (`.po` files), not YAML. Running this setup phase on a PO-based project would create a conflicting YAML catalog. **Hard stop.** Tell the user: "v1 of the Rails setup phase supports locale-rooted YAML only. `gettext_i18n_rails` is detected — the PO overlay for Rails is deferred to a later release. Use the existing PO skill references if available, or proceed manually."
- **Model/DB-content translation gems** (`globalize` gem, `mobility`, `traco`) — these translate per-row database content (a product's `name`, a post's `body`), not UI strings. They are entirely unrelated to Globalize.now. **Detect-and-warn, never act.** If any of these gems is found in the Gemfile, tell the user they are present and that the setup phase will not touch them or include their content in the connected catalog. Do NOT hard-stop — the project may use both model-content translation and UI-string translation. Proceed after warning.
- **Converting existing hardcoded strings** — handled by the convert phase (`rails.convert.md`). This setup phase only scaffolds infrastructure.
- **ActiveRecord model/attribute translations** via `:scope` (`activerecord.errors.*`, `activerecord.models.*`, `activerecord.attributes.*`) — these are `rails-i18n`-provided defaults; app overrides are a convert-phase concern, not setup.

---

### Step Risk Classification

| Step | Risk | Notes |
|------|------|-------|
| 1. Detect | Read-only | No changes to the project |
| 2. Install `rails-i18n` | Additive | Adds one gem to `Gemfile`; confirm in guided mode; runs `bundle install` |
| 3. Configure `config/application.rb` | **Modifies existing file** | Adds `config.i18n.*` keys — describe change and get confirmation |
| 4. Scaffold `config/locales/` | Additive | New `{locale}.yml` files; does not touch existing locale files |
| 5. `ApplicationController` switcher | **Modifies existing file** | Adds `around_action` + `switch_locale` method; optional URL-locale routing edits `config/routes.rb` |
| 6. Test-env `raise_on_missing_translations` | **Modifies existing file** | Adds one line to `config/environments/test.rb` |
| 7. Enable coding rules | **Modifies existing file** | Appends one `@import` line to project `CLAUDE.md` via `setup.add-ons.md` |

**RULE: Steps that modify existing files require you to describe the exact change to the user and get confirmation before proceeding. Do NOT silently modify existing project files.** _(This rule is modified by the setup mode chosen below.)_

---

## Setup Mode

After Step 1 (detection) completes without blockers, ask the user:

> **How would you like to proceed with the setup?**
> 1. **Guided** — I'll explain each step before and after, and you'll confirm changes to existing files.
> 2. **Unguided** — I'll run all steps without pausing and show a full summary at the end. Optional steps (URL-locale routing) will be included — tell me now if you'd like to skip any.

### Guided mode rules

- **Before each step**: briefly explain what will happen and why.
- **After each step**: summarize what changed (files created, files modified, commands run).
- Consent gates for "Modifies existing file" steps still apply — describe the exact change and wait for confirmation.
- Optional steps still prompt the user ("Would you like me to...").

### Unguided mode rules

- Execute all steps without pausing for per-step explanations or confirmations.
- Consent gates for "Modifies existing file" steps are **suspended** — proceed with the modification without asking.
- Hard stops (incompatibility checks in Step 1) still halt execution — these are never skipped.
- "MUST wait for the user to choose" lines in this file are **overridden** by the unguided-defaults table below when a default is listed.
- Optional steps (URL-locale routing) are **included by default** unless the user excluded them.
- At the end, produce a summary:

```
## Setup Complete

### What was done
- [x] Step N: {step name} — {one-line description}

### Files created
- path/to/file

### Files modified
- path/to/file — {what changed}

### Defaults applied
- {choice}: {value applied} — {rationale}

### Next steps
- {recommendations}
```

#### Unguided defaults

In unguided mode, apply the defaults below without prompting. Log each default choice in the final summary so the user can revisit any of them:

| Choice | Unguided default | Rationale |
|--------|------------------|-----------|
| **Source locale** | Existing `config.i18n.default_locale` if found; otherwise `en` | Matches what the app already ships |
| **Target locales** | User-specified if given in the initial prompt; otherwise `es` | One additional locale is enough to validate the pipeline |
| **URL-locale routing** | Included | Surfacing locales in URLs is the Rails Guide's recommended approach for locale persistence |
| **Locale source param** | `params[:locale]` | Standard Rails convention |

---

## Step 1: Detect the Project

Read the project's `Gemfile`, `Gemfile.lock`, `config/application.rb`, `config/environments/`, and `config/locales/` to determine the project shape.

| Signal | How to detect |
|--------|--------------|
| **Rails present** | `rails` gem in `Gemfile` or `Gemfile.lock`; `config/application.rb` exists; `bin/rails` exists |
| **Rails version** | Parse `Gemfile.lock`: find the line `rails (N.M.x)` and extract `N.M`. This is the version used to derive the `rails-i18n` pin |
| **Ruby version** | `.ruby-version` at project root; or `ruby 'N.M.x'` in `Gemfile` |
| **Default locale** | `config.i18n.default_locale` in `config/application.rb` or an initializer; fall back to `:en` |
| **Available locales** | `config.i18n.available_locales` if set; otherwise infer from file basenames in `config/locales/*.yml` |
| **Existing locale files** | Glob `config/locales/**/*.{rb,yml}` — note split layouts (many files, nested dirs); record all locale codes present |
| **`rails-i18n` present** | `rails-i18n` in `Gemfile` or `Gemfile.lock` |
| **Existing switcher** | `around_action.*switch_locale` or `I18n.with_locale` in `app/controllers/application_controller.rb` |
| **`raise_on_missing_translations`** | `config.i18n.raise_on_missing_translations` in `config/environments/test.rb` |
| **Git repository** | `git rev-parse --is-inside-work-tree` exits 0 |
| **Current branch** | `git branch --show-current` |

### Incompatibility Checks

Before proceeding, check for blockers. **If any check below says STOP, you MUST stop and communicate the issue to the user. Do NOT proceed with Step 2 or any subsequent step.**

| Check | How to detect | Action |
|-------|--------------|--------|
| **Not a Rails project** | No `rails` gem in `Gemfile`; no `config/application.rb`; no `bin/rails` | **STOP.** Tell the user: "No Rails project detected. This setup phase requires a Rails application. If this is a non-Rails Ruby project (Sinatra, Hanami, etc.), this setup phase does not apply." |
| **`gettext_i18n_rails` detected** | `gettext_i18n_rails` or `fast_gettext` in `Gemfile` or `Gemfile.lock` | **STOP.** Tell the user: "This project uses `gettext_i18n_rails` (detected in Gemfile). The catalog format is PO, not YAML. The v1 Rails setup phase supports locale-rooted YAML only — the PO/gettext overlay for Rails is deferred to a later release. Proceed manually, or wait for the PO overlay." |
| **Model-content gems** | `globalize` (the gem, not Globalize.now), `mobility`, or `traco` in `Gemfile` or `Gemfile.lock` | **Warn (non-blocking).** Tell the user: "I found `{gem_name}` in your Gemfile. This gem handles DB/model-content translation (per-row data, not UI strings) and is unrelated to Globalize.now. The setup phase will not touch it, and its model-translated content will not be included in the connected catalog. Proceeding with UI-string i18n setup." |
| **Existing `with_locale` switcher** | `I18n.with_locale` already in `ApplicationController` | **Warn (non-blocking).** Tell the user: "An `I18n.with_locale` locale switcher is already present in `ApplicationController`. I'll skip Step 5 to avoid overwriting it — review the existing implementation for correctness." Skip Step 5 but continue. |

### Version Warning (non-blocking)

If the detected Rails version is 7.1 or earlier:

> This project is on Rails {version}, which reached end-of-life. The setup phase supports Rails 6.1 → 8.1 at the same code level (no version-gated i18n branches), but running EOL Rails in production is not recommended. Consider upgrading to 7.2 or 8.1. Proceeding with setup.

### Branch Recommendation

If the project is a git repository and the current branch is `main`, `master`, or `develop`, recommend creating a dedicated branch first:

> You're currently on `{branch}`. This setup will modify several existing files. I'd recommend creating a dedicated branch:
> ```
> git checkout -b chore/i18n-setup
> ```
> Want me to create this branch, or continue on `{branch}`?

If the user is already on a feature branch, or the project has no git repository, skip this silently.

If no blockers were found, proceed to the **Setup Mode** prompt before continuing to Step 2.

---

## Step 2: Install `rails-i18n`

`rails-i18n` supplies CLDR plural-rule lambdas and default locale data (translated ActiveRecord error messages, date/time/number/currency formats) for ~100 languages. Core Rails ships only the English plural rule — without this gem, any non-English locale pluralizes incorrectly.

**If `rails-i18n` is already in `Gemfile.lock`**: tell the user it's already installed and skip to Step 3.

**Pin strategy:** `rails-i18n` versions track the Rails major.minor release. Derive the pin from `Gemfile.lock`:

1. Find the Rails version: look for the line `rails (N.M.x)` in `Gemfile.lock`; extract `N.M`.
2. Add to `Gemfile`:
   ```ruby
   gem "rails-i18n", "~> N.M"
   ```
   Example for a Rails 8.1 project:
   ```ruby
   gem "rails-i18n", "~> 8.1"
   ```

The `~> N.M` pessimistic constraint allows patch releases (`N.M.0`, `N.M.1`, …) but not the next minor (`N.{M+1}`). This is Bundler's equivalent of npm's `^N.M.0` for a package that versions in lockstep with Rails.

3. Run `bundle install`.

**Modifies `Gemfile` (additive)** — in guided mode, describe the exact line to be added and wait for confirmation.

---

## Step 3: Configure `config/application.rb`

**This step modifies `config/application.rb`** (or an initializer — `config/initializers/locale.rb` is also conventional). Before making changes, describe the exact additions and get confirmation in guided mode.

Add the following inside the `class Application < Rails::Application` block in `config/application.rb`:

```ruby
# config/application.rb
module YourApp
  class Application < Rails::Application
    # i18n configuration
    config.i18n.default_locale = :en          # replace with your source locale
    config.i18n.available_locales = [:en, :es] # replace with your full locale list
    config.i18n.enforce_available_locales = true
    config.i18n.fallbacks = true              # fall back to default_locale when a key is missing
  end
end
```

**Config key notes:**

- `config.i18n.default_locale` — the locale used when no locale is set for a request. Must match your source-locale YAML file basename (e.g. `:en` → `config/locales/en.yml`).
- `config.i18n.available_locales` — whitelists which locales the app accepts. Set `enforce_available_locales = true` (below) to reject unknown locales.
- `config.i18n.enforce_available_locales` — raises `I18n::InvalidLocale` if `I18n.locale=` or `I18n.with_locale` is called with a locale not in `available_locales`. Prevents runaway locale values from reaching user-facing output. (This is why the locale switcher in Step 5 may raise `I18n::InvalidLocale` if `available_locales` is not kept up to date.)
- `config.i18n.fallbacks` — when set to `true`, falls back to `default_locale` for any key missing in the active locale. Prevents key-not-found errors in partially-translated locales. For fine-grained control, pass a hash: `config.i18n.fallbacks = { "es" => "en" }`.
- **`config/locales/*.{rb,yml}` auto-load** — Rails automatically adds all files matching `config/locales/**/*.{rb,yml}` to `I18n.load_path`. No explicit `config.i18n.load_path` addition is needed for files in this directory.

Replace `:en` / `[:en, :es]` with the source and target locales detected or chosen in Step 1.

---

## Step 4: Scaffold `config/locales/`

Create one YAML file per configured locale. Locale files are locale-rooted: the top-level key is the locale code.

**Additive step** — existing files in `config/locales/` are not modified. Only new locale files are created.

### Source-locale file (`en.yml` or `{default_locale}.yml`)

If a populated source-locale file already exists at `config/locales/en.yml`, inspect its content and skip file creation. Globalize keys off a populated source file — ensure it has at least a few real entries before connecting in Phase 4.

If no source-locale file exists (or it is the Rails default stub with only `en.hello`), create a populated one:

```yaml
# config/locales/en.yml
en:
  site:
    title: "My Application"
    welcome: "Welcome, %{name}!"
  inbox:
    one: "one message"
    other: "%{count} messages"
  errors:
    required: "can't be blank"
    invalid_email: "is not a valid email address"
```

The `inbox` group demonstrates CLDR plural sub-keys (`one`/`other`) — Rails selects the correct form when `:count` is passed to `t`. Include `other` in every plural group; it is the required fallback for all languages.

### Target-locale files

For each target locale, create a stub file. Leave the values empty or copy the source strings as placeholders — they will be filled by Globalize or translators:

```yaml
# config/locales/es.yml
es:
  site:
    title: "Mi aplicación"
    welcome: "Bienvenido, %{name}!"
  inbox:
    one: "un mensaje"
    other: "%{count} mensajes"
  errors:
    required: "no puede estar en blanco"
    invalid_email: "no es una dirección de correo electrónico válida"
```

Use the locale code as the filename: `config/locales/{locale}.yml`. Rails convention uses hyphens for regional codes: `pt-BR.yml`, `zh-TW.yml`.

---

## Step 5: Wire the Per-Request Locale Switcher in `ApplicationController`

**This step modifies `app/controllers/application_controller.rb`.** In guided mode, describe the exact additions and get confirmation before proceeding.

Rails' `I18n.locale` is **thread-local**. Puma and other multi-threaded servers reuse threads across requests, so a bare `I18n.locale = x` is never reset — it leaks into later requests intermittently under concurrent load. The safe pattern is `I18n.with_locale(locale) { ... }`, which restores the prior locale in an `ensure` block even on exceptions.

**Always use `around_action` with the block form:**

```ruby
# app/controllers/application_controller.rb
class ApplicationController < ActionController::Base
  around_action :switch_locale

  private

  def switch_locale(&action)
    locale = params[:locale] || I18n.default_locale
    I18n.with_locale(locale, &action)
  end
end
```

`I18n.with_locale(locale, &action)` yields the controller action inside a locale scope and restores the prior value afterward — the `&action` argument passes the block from `around_action` directly into `with_locale`.

**Never use the bare-assignment form:**

```ruby
# Wrong — leaks locale across Puma threads
before_action { I18n.locale = params[:locale] || I18n.default_locale }
```

### Optional: URL-locale routing

The locale switcher above reads `params[:locale]`, which requires the locale to appear in the request parameters. The idiomatic Rails approach is to embed the locale in the URL path (e.g. `/en/books`, `/es/books`).

**When run via the `globalize-guide` orchestrator, this choice is already collected in Phase 1** (`SKILL.md` §1.7 asks it explicitly for Rails and records it under `decisions.setup`) — read the decision and apply it; do **not** re-ask. When this reference is used standalone — **ask the user (guided mode) / apply by default (unguided mode):**

> **Would you like to add URL-based locale routing?** This embeds the locale code in the URL path — e.g. `/en/books`, `/es/books`. It requires wrapping your routes in a scope and overriding `default_url_options`.

If yes (or unguided default), make these two additions:

**`config/routes.rb`** — wrap existing routes in a locale scope:

```ruby
# config/routes.rb
Rails.application.routes.draw do
  # Infrastructure routes stay OUTSIDE the locale scope — a health probe must
  # hit /up, not /:locale/up. Same for any non-localized mount.
  get "up" => "rails/health#show", as: :rails_health_check

  scope "/:locale" do
    # your existing user-facing routes go here
    root "home#index"
    resources :books
  end
end
```

**Keep non-localized routes outside `scope "/:locale"`:** the Rails health-check route (`/up`, present by default in Rails 7.1+), plus any monitoring, webhook, or API mounts that have no locale dimension, must stay outside the scope — otherwise a bare `GET /up` probe becomes `GET /:locale/up` and 404s. Wrap only the user-facing routes. If the app already defines `/up` (or other infrastructure routes), leave them where they are and wrap only the routes below them.

**`ApplicationController`** — override `default_url_options` to propagate the active locale into all generated URLs automatically. This is a Rails public hook and must be placed **before** the `private` keyword — not inside the private section alongside `switch_locale`:

```ruby
# app/controllers/application_controller.rb
class ApplicationController < ActionController::Base
  around_action :switch_locale

  # Public Rails hook — must stay in the public section (before `private`)
  def default_url_options
    { locale: I18n.locale }
  end

  private

  def switch_locale(&action)
    locale = params[:locale] || I18n.default_locale
    I18n.with_locale(locale, &action)
  end
end
```

With this in place, every call to `books_path`, `root_url`, and `link_to` will automatically include the current locale. Users navigating between pages retain their locale without a separate cookie or session.

If the user declines URL-locale routing, document an alternative (session, cookie, `Accept-Language` header) and leave route changes to them.

---

## Step 6: Enable `raise_on_missing_translations` in the Test Environment

**This step modifies `config/environments/test.rb`.** In guided mode, describe the exact change and get confirmation.

Enabling `raise_on_missing_translations` in the test environment turns missing translation keys into exceptions, catching catalog gaps early — before they silently output a raw key or fall back to a default in production.

```ruby
# config/environments/test.rb
Rails.application.configure do
  # ... existing config ...
  config.i18n.raise_on_missing_translations = true
end
```

**Version scope:** the `raise_on_missing_translations` config key was unified in Rails 7.0 and its scope was broadened in Rails 7.1 (`:strict` mode added; bare `I18n.t` on unknown keys now raises in addition to the `t` view helper). On Rails 6.1, `raise_on_missing_translations = true` raises only from the `t` view helper (not bare `I18n.t`). This is the one config-level nuance across the 6.1→8.1 range — the emitted translation code itself (`t`, `l`, `with_locale`, locale-rooted YAML) is identical across all versions.

This setting is safe to emit unconditionally (no version-gated branches); on Rails 6.1 it simply covers fewer call sites.

---

## Step 7: Enable Coding Rules

The Rails i18n coding rules at `references/languages/ruby/frameworks/rails/rails.code.md` contain the rules for `with_locale`, lazy lookup, `%{name}` interpolation, `_html` keys, CLDR plural sub-keys, and what not to wrap. They ship as part of the `globalize-guide` skill and already live at `.claude/skills/globalize-guide/references/languages/ruby/frameworks/rails/rails.code.md` in the target project.

Follow the procedure in `references/languages/ruby/frameworks/rails/setup.add-ons.md` to wire the `@import` line into the target project's `CLAUDE.md`.

Verify `.claude/skills/globalize-guide/references/languages/ruby/frameworks/rails/rails.code.md` exists in the target project.

- **If it exists**: proceed with the wiring.
- **If it is missing — guided mode**: tell the user the `globalize-guide` skill is not installed in their project and stop this step. The fix is to reinstall it (`npx skills add globalize-now/globalize-skills --skill globalize-guide -a claude-code`). Don't attempt to recreate the file.
- **If it is missing — unguided mode**: skip the CLAUDE.md append and record `⚠ Rails coding rules not installed — wiring skipped` in the end-of-run summary, with the reinstall command shown above.

---

## No Version Gating

The emitted i18n code in this setup phase — `config.i18n.*` keys, `I18n.with_locale` block form, locale-rooted YAML structure, CLDR plural sub-keys, `%{name}` interpolation, `_html` naming — is **identical across Rails 6.1 through 8.1**. Rails did not change its i18n API surface during this period; the 7.2, 8.0, and 8.1 release notes contain no i18n entries.

This is the **clean opposite of Django**, which required `USE_L10N`/`ugettext` version-gated emission rules for Python 2→3 and Django 3→4 transitions. No such branches exist here.

**Default target**: Rails 8.1.
**Supported range**: 6.1 → 8.1 (same emitted code for all).
**Soft EOL warning**: Rails 7.1 reached end-of-life in October 2025; Rails 7.0 and 6.1 are EOL. The skill supports them at the same code level but warns to upgrade.

The one config-level nuance — `raise_on_missing_translations` scope change in 7.0/7.1 — is noted in Step 6 and does not require branched emission.

---

## Common Gotchas

- **`I18n::InvalidLocale` on a valid locale** — `enforce_available_locales = true` requires that the locale be listed in `available_locales`. Add missing locales to the array in `config/application.rb`.
- **Locale param not reaching the switcher** — if the locale is in the URL path (via `scope "/:locale"`), ensure the scope is wrapping the routes that need locale-switching; otherwise `params[:locale]` is `nil` and `I18n.default_locale` is used every request.
- **`t('.key')` returns the raw key in a controller action** — lazy dot-lookup (`t('.key')`) only works in views (via `ActionView::Helpers::TranslationHelper`) and in controller actions (via `ActionController::Translation`). It does NOT work with bare `I18n.t('.key')` — bare `I18n.t` is not scope-aware and resolves the key literally, which will fail. Use the `t` helper, not `I18n.t`, for lazy lookup.
- **Non-English plurals silently using wrong form** — `rails-i18n` is not installed. Without it, Rails applies only the English rule (`one`/`other`) to all languages. Run Step 2 to add it.
- **CLDR plural keys missing** — a locale's YAML file has only `one` but the language needs `few`/`many` (e.g. Russian, Polish). Check the `rails-i18n` source for the CLDR categories required by that locale: `rails-i18n/rails/locale/{locale}.yml`.
- **`globalize` gem confusion** — the Ruby gem named `globalize` is a DB/model-content translation gem (ActiveRecord `*_translations` tables), entirely unrelated to Globalize.now. Its presence is detected and warned in Step 1; it is never acted on by this setup phase.
- **`config/locales/` split layout** — many Rails apps spread translations across multiple files (`en.yml`, `devise.en.yml`, `models.en.yml`, nested dirs). All are auto-loaded by Rails. When connecting Phase 4, point Globalize at the layout that matches your app's structure (single file or glob pattern).

---

## Quick Start: Using Rails i18n

Rails i18n is now configured. These are the patterns you'll use most — the coding rules enforce them:

**View strings — lazy dot-lookup:**

```erb
<%# app/views/books/index.html.erb %>
<h1><%= t('.title') %></h1>
<p><%= t('.empty') %></p>
```

```yaml
# config/locales/en.yml
en:
  books:
    index:
      title: "Books"
      empty: "No books found."
```

**Interpolation:**

```erb
<p><%= t('site.welcome', name: current_user.name) %></p>
```

```yaml
en:
  site:
    welcome: "Welcome, %{name}!"
```

**Plurals:**

```erb
<p><%= t('inbox', count: @messages.count) %></p>
```

```yaml
en:
  inbox:
    one: "one message"
    other: "%{count} messages"
```

**Dates and times:**

```erb
<span><%= l(article.published_at, format: :short) %></span>
```

**Flash messages in controllers:**

```ruby
redirect_to root_path, notice: t('users.sessions.created')
```

For comprehensive wrapping patterns, HTML-safe keys, model validations, mailers, and auditing tools, see the Rails convert phase (`rails.convert.md`). For ongoing coding rules (loaded automatically via `@import`), see `rails.code.md`.

---

## Next Steps

Setup is complete. Here's what typically comes next:

### Wrap existing strings

This setup phase scaffolded the infrastructure but did **not** convert existing hardcoded strings to `t('...')` calls. Run the convert phase (`rails.convert.md`) — it finds hardcoded UI strings across `.erb` views, controllers, mailers, and model validations; wraps them with `t()`/`l()`; and writes matching YAML entries.

### Connect a translation service

With `config/locales/{locale}.yml` populated, connect to Globalize using the `globalize-now-project-setup` skill (sign in first via `globalize-now-account-setup`). The Phase-4 pattern is `config/locales/{locale}.yml` with `fileFormat: yaml-rails` and your `default_locale` as source.

### Add a non-English locale

When adding a target locale that has more than two plural categories (Russian, Polish, Arabic, Czech, Slovak, Ukrainian, …), verify `rails-i18n` is installed (Step 2) and add all required CLDR sub-keys (`zero`, `one`, `two`, `few`, `many`, `other` as applicable) to the target locale's YAML file.
