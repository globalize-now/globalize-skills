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
| Format helpers | Additive | Creates `app/helpers/format_helper.rb`; adds new catalog keys under `date.*` / `time.*` / `support.array.or.*` to `config/locales/{source_locale}.yml` — **always runs**, feeds Step 7 |
| 7. Generate + wire coding rules | Additive (+ edits `CLAUDE.md` / `AGENTS.md`) | Writes `.agents/globalize-rules.md` via `setup.add-ons.md` and points `CLAUDE.md` and `AGENTS.md` at it — **always runs**, Phase 3 wraps against it |

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

## Format helpers (`generate_format_helpers`)

Action View's number and date/time helpers already read the active locale's catalog — but nothing routes currency correctly by default, and every controller, model, and job that needs to format a value has to remember the right helper and the right options each time. This step creates one small module, `FormatHelper`, that gives every formatting concern a single name. Names are `format_`-prefixed and snake_case: the module is mixed into every view, so a bare `number` or `list` would collide with Action View or a local variable.

**Always runs**, on every project — like Steps 2–6, it does not wait for a `SKILL.md §1.10` selection. Phase 3's wrap subagents route every hardcoded number, currency, date, and list through this module's ten methods.

Create `app/helpers/format_helper.rb`. **If it already exists as project code, do not overwrite it** — add the methods below into it, and skip any method already defined there.

```ruby
# app/helpers/format_helper.rb
module FormatHelper
  # This project's default currency — used ONLY when a caller does not pass
  # one explicitly (see format_money below). Grep for an existing
  # number_to_currency call with an inline unit:, or a hardcoded symbol,
  # before defaulting — a wrong currency that looks deliberate is worse than
  # one that flags itself.
  DEFAULT_CURRENCY = "USD" # adjust to this project's currency

  # A minimal ISO 4217 -> symbol map for currencies passed explicitly (see
  # currency_unit below). Extend as this project needs; an unmapped code
  # falls back to its own ISO code, which is always unambiguous even when
  # it isn't pretty. NOTE: JPY and CNY both conventionally use "¥" — this
  # map cannot disambiguate them. A project that displays both must pass an
  # explicit unit at the call site for at least one of them; do not try to
  # resolve the collision here.
  CURRENCY_SYMBOLS = {
    "USD" => "$", "EUR" => "€", "GBP" => "£", "JPY" => "¥", "CNY" => "¥",
    "INR" => "₹", "BRL" => "R$", "CAD" => "CA$", "AUD" => "A$", "CHF" => "CHF"
  }.freeze

  # ISO 4217 minor-unit exceptions. Rails' own precision: 2 default is right
  # for most currencies; these are the ones where it's wrong — the number of
  # decimal places is a property of the CURRENCY, never of the locale.
  ZERO_DECIMAL_CURRENCIES = %w[JPY KRW VND CLP ISK XAF XOF].freeze
  THREE_DECIMAL_CURRENCIES = %w[KWD BHD OMR TND JOD].freeze

  # THE SEAM. Formatting follows the UI locale today. To give this project a
  # separate regional preference, change this one method.
  def format_locale
    I18n.locale
  end

  # Currency belongs to the DATA, not the reader — see "The currency rule"
  # below. Pass one whenever the amount carries one:
  # format_money(order.total, order.currency). Omitting it formats
  # DEFAULT_CURRENCY, and only then may the active locale's own configured
  # symbol win.
  def format_money(amount, currency = nil)
    return number_to_currency(amount, locale: format_locale) if currency.nil?

    code = currency.to_s.upcase
    unit = currency_unit(currency)
    # A bare ISO code — unmapped, or (like CHF above) explicitly mapped to
    # itself — needs a space before the amount. Rails' own default format,
    # "%u%n", has none: correct for a real symbol ("€1,234.50") but wrong for
    # a bare code jammed against the number ("SEK1,234.50"). Detected by
    # comparing the resolved unit against the code itself, not by which
    # branch produced it, so CHF gets the same treatment as an unmapped code.
    bare_code = (unit == code)
    number_to_currency(
      amount,
      locale: format_locale,
      unit: unit,
      precision: currency_precision(currency),
      format: bare_code ? "%u %n" : "%u%n",
      negative_format: bare_code ? "-%u %n" : "-%u%n"
    )
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

  # I18n.l (== I18n.localize) accepts only Date, DateTime, and Time — see
  # "l() raises on a numeric argument" below. The .to_date / .to_time calls
  # are load-bearing: they are what let this accept the Date/Time/DateTime/
  # parseable-String values callers actually have on hand.
  def format_date(value, preset = :medium)
    I18n.l(value.to_date, format: preset, locale: format_locale)
  end

  def format_time(value)
    I18n.l(value.to_time, format: :time, locale: format_locale)
  end

  def format_date_time(value)
    I18n.l(value.to_time, format: :date_time, locale: format_locale)
  end

  def format_relative_time(value, now = Time.current)
    distance = distance_of_time_in_words(value, now, locale: format_locale)
    # .to_time on both sides — a Date/Time/DateTime mix (e.g. value is a
    # Date, now defaults to Time.current) otherwise risks a comparison
    # ArgumentError, same reasoning as the .to_date/.to_time calls above.
    if value.to_time < now.to_time
      I18n.t("time.ago", distance: distance, locale: format_locale)
    else
      I18n.t("time.from_now", distance: distance, locale: format_locale)
    end
  end

  # :and relies on Rails' own to_sentence i18n lookup (support.array.*,
  # which rails-i18n already ships for every locale it covers) — no custom
  # keys needed. :or has no Rails built-in, so it reads the connectors this
  # project scaffolds under support.array.or.* below.
  def format_list(items, type = :and)
    return items.to_sentence(locale: format_locale) if type == :and

    # default: below matches the graceful English fallback :and already gets
    # for free from to_sentence's own i18n merge (I18n.translate(:'support.array',
    # default: {})) — without it, an untranslated target locale would inject
    # "translation missing: ..." into the middle of a rendered sentence.
    items.to_sentence(
      locale: format_locale,
      two_words_connector: I18n.t("support.array.or.two_words_connector", locale: format_locale, default: " or "),
      last_word_connector: I18n.t("support.array.or.last_word_connector", locale: format_locale, default: ", or ")
    )
  end

  private

  def currency_unit(currency)
    CURRENCY_SYMBOLS.fetch(currency.to_s.upcase, currency.to_s.upcase)
  end

  def currency_precision(currency)
    code = currency.to_s.upcase
    return 0 if ZERO_DECIMAL_CURRENCIES.include?(code)
    return 3 if THREE_DECIMAL_CURRENCIES.include?(code)

    2
  end
end
```

### The currency rule — data wins, never the locale

**An explicitly passed currency always wins.** `format_money(order.total, order.currency)` renders in whatever currency the *order* carries, regardless of which locale the reader is browsing in — a German reader looking at a USD order sees `$1,234.50`, not a relabeled `1.234,50 €`. This is why `format_money`'s second argument defaults to `nil`, not to `DEFAULT_CURRENCY`: `nil` is the only way the method can tell "no currency was passed" apart from "the caller passed the project default explicitly," and only the former is allowed to defer to the locale.

The locale's own configured `number.currency.format.unit` may be used **only** on that no-currency path — a genuinely project-wide amount (a flat fee, a plan price) with no currency of its own, where letting each locale's catalog supply its own familiar symbol for `DEFAULT_CURRENCY` is correct rather than a bug. `number_to_currency(amount, locale: format_locale)` with no `unit:` override already does exactly this — Rails resolves the symbol itself from that locale's `number.currency.format.unit`, falling back to `rails-i18n`'s own default (`"$"`) if the locale doesn't configure one. Nothing extra needs to be written for that branch.

For an explicit currency, `format_money` overrides the *symbol* (`unit:`) via the `CURRENCY_SYMBOLS` map above, and the *decimal precision* (`precision:`) via `ZERO_DECIMAL_CURRENCIES` / `THREE_DECIMAL_CURRENCIES`. Decimal separator and thousands-delimiter placement (`1.234,50` vs `1,234.50`) are left to the active locale's own `number.currency.format.*` — those genuinely are locale conventions. **Precision is not**: the number of minor units is a property of the *currency* under ISO 4217, not of the reader's locale — Rails' `precision: 2` default is right for most currencies, but wrong for JPY/KRW (0 decimals) and KWD/BHD (3), and both are currencies this map already ships. Passing `precision: 2` unconditionally — the locale-only reading this section used to claim — renders `¥1,234.00` for a JPY amount, which is not just cosmetically off; ¥1,234.00 and ¥123,400 are different amounts of money.

An ISO code with no entry in `CURRENCY_SYMBOLS` still renders unambiguously as the bare code — `SEK 1,234.50`, not `SEK1,234.50`. Rails' default `format: "%u%n"` has no space, which is correct for a real symbol (`€1,234.50`) but wrong for a bare code; `format_money` switches to `"%u %n"` whenever the resolved unit equals the currency code itself — which includes `CHF` above, mapped to itself deliberately, not just genuinely unmapped codes.

**`JPY` and `CNY` collide** — both conventionally render `¥`, and a hand-written symbol map keyed only on the ISO code cannot resolve that ambiguity in general (the "right" disambiguating glyph — `CN¥`, `元`, `RMB` — varies by house style, so guessing one into the shared default would just trade a known collision for someone else's wrong assumption). A project that displays both currencies must disambiguate for at least one of them explicitly — either call `number_to_currency(amount, locale: format_locale, unit: 'CN¥')` directly for that one case, bypassing `format_money`, or edit this project's own `CURRENCY_SYMBOLS` entry once the choice is made. Do not leave the collision silent.

### Catalog keys this helper depends on

`rails-i18n` (Step 2) already ships `number.*`, `date.formats.{default,short,long}`, `time.formats.{default,short,long}`, and `support.array.{words_connector,two_words_connector,last_word_connector}` for every locale it covers — confirmed against `rails-i18n`'s own source and Rails' own `en.yml`. Only app-authored *overrides* of those belong in the connected catalog; this restates the existing `rails-i18n`-provided-defaults rule from Step 7's generated rules file.

This helper adds seven keys that **neither Rails core nor `rails-i18n` ships under any locale** — scaffold them into `config/locales/{source_locale}.yml` now, and into every target-locale file when that locale is added:

```yaml
# config/locales/en.yml — replace "en" with this project's real source locale (Step 1)
en:
  date:
    formats:
      medium: "%b %d, %Y"      # new — rails-i18n ships default/short/long, not medium
  time:
    formats:
      time: "%-I:%M %p"                    # new — this preset name, distinct from time.formats.short
      date_time: "%b %d, %Y, %-I:%M %p"    # new — this preset name, distinct from time.formats.long
    ago: "%{distance} ago"     # new — distance_of_time_in_words returns the bare phrase
    from_now: "in %{distance}" # new
  support:
    array:
      or:
        two_words_connector: " or "     # new — rails-i18n only ships the "and" connectors
        last_word_connector: ", or "    # new
```

**`date.formats.long` is already shipped** (`rails-i18n` and Rails' own `en.yml` both provide `default`/`short`/`long`) — do not re-author it; only `medium` is new. Every non-English target locale needs its own translated `medium`/`time`/`date_time`/`ago`/`from_now`/`support.array.or.*` — `rails-i18n` never fills these in, no matter how well it covers that locale otherwise.

### `l()` raises on a numeric argument

`I18n.l` (aliased as `l` in views, controllers, and mailers) localizes `Date`, `DateTime`, and `Time` only — passing a `Float` or `Integer` raises `I18n::ArgumentError`. The `.to_date` / `.to_time` coercions inside `format_date`, `format_time`, and `format_date_time` above are load-bearing, not decoration: they are what let those three methods accept the `Date` / `Time` / `DateTime` / parseable-`String` values a caller actually has, and they still do nothing for a raw Unix timestamp or any other numeric — convert it to a `Time` (`Time.at(timestamp)`) before calling in.

### Helper availability — views and mailers get it for free; everywhere else needs one extra line

Every helper under `app/helpers/` — `FormatHelper` included — is mixed into every view and every mailer template automatically, the same default Rails uses for both. `format_money`, `format_date`, and the rest work with no extra step there.

**Everywhere else — models, service objects, background jobs, rake tasks, `rails runner` — `include FormatHelper` on its own is not enough.** Six of the ten methods depend on Action View and won't raise a helpful error until called from the wrong context: `format_money` (`number_to_currency`), `format_number` (`number_with_delimiter`), `format_percent` (`number_to_percentage`), `format_compact` (`number_to_human`), `format_unit` (calls `format_number` above, so it inherits the same dependency), and `format_relative_time` (`distance_of_time_in_words`). Every one of those parenthesized names comes from `ActionView::Helpers::NumberHelper` / `DateHelper`, not from `FormatHelper` itself, and plain `include FormatHelper` does not pull either module in. Reach them one of two sanctioned ways:

```ruby
# Simplest — Rails' own helper proxy already mixes in every app helper plus
# every Action View helper module. Works in models, jobs, rake tasks, and
# `rails runner` with no include at all:
ActionController::Base.helpers.format_money(order.total, order.currency)

# Or include the two Action View modules this project's methods actually
# need, alongside FormatHelper itself — useful when a class formats often
# enough that the proxy indirection isn't worth it:
class ReceiptBuilder
  include ActionView::Helpers::NumberHelper
  include ActionView::Helpers::DateHelper
  include FormatHelper
end
```

`format_locale`, `format_date`, `format_time`, `format_date_time`, and `format_list` need neither route — they call only `I18n.l` (core `i18n` gem, not Action View) and `Array#to_sentence` (a core `ActiveSupport` extension), both loaded everywhere a Rails app runs. Bare `l()` and `t()`, by contrast, **are** view/controller/mailer-only (`AbstractController::Translation`) — which is exactly why every method above calls `I18n.l` / `I18n.t` explicitly rather than the bare form, so the module behaves identically through either sanctioned route above.

**Write `.globalize/format-module.json`** with `specifier: "FormatHelper"`, `path: "app/helpers/format_helper.rb"`, the ten-entry `surface` (`["format_money","format_number","format_percent","format_compact","format_unit","format_date","format_time","format_date_time","format_relative_time","format_list"]`), `defaultCurrency`, and `currencySource`. `generate_coding_rules` (Step 7) reads `specifier` back as the `formatModule` placeholder.

---

## Step 7: Generate Coding Rules (`generate_coding_rules` — always runs)

The Rails i18n coding rules — `with_locale`, lazy lookup, `%{name}` interpolation, `_html` keys, CLDR plural sub-keys, formatting, and what not to wrap — are a **generated file**, not a shipped one. They are rendered from `references/languages/ruby/frameworks/rails/rails.rules.template.md` down to this project's actual configuration (routing decision, `rails-i18n` presence, real source and target locales, and the `formatModule` specifier the step above wrote) and written to `.agents/globalize-rules.md`.

Follow the **core coding-rules section** in `references/languages/ruby/frameworks/rails/setup.add-ons.md` — it carries the full procedure, including where each condition and value is read from and the fail-closed rule. **Never skip it**: it is not gated on a `SKILL.md §1.10` selection, because Phase 3's wrap subagents read the generated file as their authoring contract.

Then follow the **second core step** in the same file, which points `CLAUDE.md` (`@.agents/globalize-rules.md`) and `AGENTS.md` (a pointer section) at the generated file. It always runs too, and is likewise not a §1.10 selection.

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

For comprehensive wrapping patterns, HTML-safe keys, model validations, mailers, and auditing tools, see the Rails convert phase (`rails.convert.md`). For ongoing coding rules, see the generated `.agents/globalize-rules.md` (wired into `CLAUDE.md` and `AGENTS.md` — see Step 7).

---

## Next Steps

Setup is complete. Here's what typically comes next:

### Wrap existing strings

This setup phase scaffolded the infrastructure but did **not** convert existing hardcoded strings to `t('...')` calls. Run the convert phase (`rails.convert.md`) — it finds hardcoded UI strings across `.erb` views, controllers, mailers, and model validations; wraps them with `t()`/`l()`; and writes matching YAML entries.

### Connect a translation service

With `config/locales/{locale}.yml` populated, connect to Globalize using the `globalize-now-project-setup` skill (sign in first via `globalize-now-account-setup`). The Phase-4 pattern is `config/locales/{locale}.yml` with `fileFormat: yaml-rails` and your `default_locale` as source.

### Add a non-English locale

When adding a target locale that has more than two plural categories (Russian, Polish, Arabic, Czech, Slovak, Ukrainian, …), verify `rails-i18n` is installed (Step 2) and add all required CLDR sub-keys (`zero`, `one`, `two`, `few`, `many`, `other` as applicable) to the target locale's YAML file.
