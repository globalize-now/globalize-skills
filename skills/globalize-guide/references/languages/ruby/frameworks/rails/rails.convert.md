# Rails i18n Conversion

Rails-specific guidance for the convert phase. Covers Rails 6.1 → 8.1 projects using the built-in `I18n` API with locale-rooted YAML catalogs. The per-edit authoring rules — `%{name}` interpolation, `_html` keys, CLDR plural sub-keys, `with_locale`, what-not-to-wrap — live in the project's generated coding rules (`.agents/globalize-rules.md`, wired into `CLAUDE.md` and `AGENTS.md`). This file is the **mechanics of finding and converting existing hardcoded strings**.

---

## The two-tool reality

No single Rails tool handles the full job. Rails' convert phase needs **two distinct tool families**, and this distinction is load-bearing:

**`i18n-tasks`** (catalog-hygiene tool) — statically analyses existing `t()` call sites for missing keys, unused keys, and non-canonical YAML ordering. Subcommands: `missing`, `unused`, `normalize`, `health`. **`i18n-tasks` does NOT find hardcoded strings.** It only sees keys that are already wrapped with `t()`. Running it before wrapping will tell you nothing about unwrapped text.

**Raw-string discovery** (extraction tools) — these find user-visible text that is not yet wrapped:
- **`erb_lint` `HardCodedString` cop** — the established ERB-specific hardcoded-string finder, with autocorrect that rewrites raw text into `t()` calls. Note: `erb_lint` is effectively archived (last release Jan 2025; Shopify/GitHub are migrating off it), but `HardCodedString` works and remains the primary verifiable ERB discovery tool.
- **`rubocop-i18n`** — RuboCop cops for `.rb` files (controllers, mailers, helpers, models) that flag undecorated string literals. Complements `erb_lint`'s ERB coverage.

**Workflow: discovery first, audit after.** Use `erb_lint` / `rubocop-i18n` to discover and wrap hardcoded strings. Then use `i18n-tasks` to audit the resulting catalog for gaps, unused keys, and normalization.

---

## Step 1: Discover hardcoded strings

### ERB views — `erb_lint` `HardCodedString`

Add `erb_lint` to the development group in `Gemfile`:

```ruby
group :development do
  gem "erb_lint", "~> 0.9", require: false
end
```

Create `.erb_lint.yml` (underscore, not hyphen) at the project root if not present:

```yaml
# .erb_lint.yml
EnableDefaultLinters: false

linters:
  HardCodedString:
    enabled: true
```

`EnableDefaultLinters: false` keeps only `HardCodedString` active; without it, the default linter set also runs. The `linters:` block enables the cop under its exact name.

Scan ERB templates for hardcoded strings:

```bash
bundle exec erblint --lint-all --enable-linters HardCodedString app/views/
```

This runs in scan (report) mode only. Autocorrect for `HardCodedString` requires a custom `corrector:` class (with a `path:`, `name:`, and `i18n_load_path:` config block) that you implement for your project — without one, `--autocorrect` cannot apply fixes. In practice: run the scan to discover hardcoded strings, then wrap them manually using the patterns in Step 2.

### Ruby files — `rubocop-i18n`

Add `rubocop-i18n` to the development group:

```ruby
group :development do
  gem "rubocop-i18n", "~> 3.3", require: false
end
```

Enable the `I18n` cop set in `.rubocop.yml`:

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

> **`require:` vs `plugins:`**: RuboCop ≥1.72 prefers `plugins: [rubocop-i18n]` over `require:`. For broader compatibility across Rails 6.1–8.1 projects (which span a wide RuboCop range), `require:` works everywhere; switch to `plugins:` if you're on a recent RuboCop and see deprecation warnings.

You must disable the GetText cops (`I18n/GetText: Enabled: false`) when enabling `I18n/RailsI18n` — rubocop-i18n requires choosing one style, and leaving GetText enabled causes it to fire spuriously on Rails-style `t()` calls. `EnforcedStyle` is not a valid option for these cops; `Enabled` and `AutoCorrect` are the supported keys.

Run on controllers, mailers, helpers, and model files:

```bash
bundle exec rubocop --only I18n app/controllers/ app/mailers/ app/helpers/ app/models/
```

Review flagged literals. For autocorrect, add `--autocorrect` — but review all changes, as `rubocop-i18n` replaces literals with `I18n.t('...')` (bare `I18n.t`, not the `t` helper). Prefer the `t` helper in views and the `t` controller helper in controllers; update generated calls accordingly.

> **Herb note:** Herb (`@herb-tools/linter`) is an actively-developed HTML+ERB parser and linter and is the intended replacement for `erb_lint`. As of `v0.10.3` (2026-08-01), Herb's rule set covers a11y, ActionView, and ERB formatting — it does **not** yet ship a hardcoded-string/i18n rule. Use `erb_lint`'s `HardCodedString` cop for ERB discovery until a Herb i18n rule lands.

---

## Step 2: Wrap strings by location

### Views — lazy `t('.key')` with mirrored YAML path

For lazy lookup rules, the key-path → YAML-path mirror, and the `t` helper vs `I18n.t` distinction, see the coding rules → "Lazy lookup". One convert-phase note: **partials strip the leading underscore from the YAML key path**:

| Template | Lazy call | YAML key path |
|----------|-----------|---------------|
| `app/views/shared/_nav.html.erb` | `t('.logo_alt')` | `en.shared.nav.logo_alt` |

The `_` prefix is dropped in the resolved path — `_nav.html.erb` maps to `shared.nav`, not `shared._nav`.

### Controller flash messages

Flash messages set in controller actions support lazy `t('.key')` — Rails expands the key against the controller + action path:

```ruby
# app/controllers/sessions_controller.rb (action: create)
def create
  # ...
  redirect_to root_path, notice: t('.success')
  # or on failure:
  redirect_to new_session_path, alert: t('.invalid_credentials')
end
```

```yaml
en:
  sessions:
    create:
      success: "Signed in successfully."
      invalid_credentials: "Email or password is incorrect."
```

For flash messages set outside a named action (e.g. in a helper or service object), use a fully-qualified key: `t('users.sessions.signed_out')`.

### Model validation messages

ActiveRecord validation messages live under a fixed namespace. The full lookup chain, from most-specific to least-specific:

```
activerecord.errors.models.{model}.attributes.{attribute}.{message_key}
activerecord.errors.models.{model}.{message_key}
activerecord.errors.messages.{message_key}
errors.attributes.{attribute}.{message_key}
errors.messages.{message_key}
```

**`rails-i18n` already provides translations for built-in validations** (`blank`, `invalid`, `too_short`, etc.) in ~100 languages. Do **not** extract those into your connected catalog — only app-authored custom validations and overrides belong there.

For a custom validation message, reference the key with `:message` as a symbol:

```ruby
# app/models/user.rb
validates :username, uniqueness: { message: :already_taken }
validates :age, numericality: { greater_than: 0, message: :must_be_positive }
```

```yaml
en:
  activerecord:
    errors:
      models:
        user:
          attributes:
            username:
              already_taken: "is already in use — choose a different username."
            age:
              must_be_positive: "must be greater than zero."
```

For a generic override (all models, all attributes), use `activerecord.errors.messages.{key}`:

```yaml
en:
  activerecord:
    errors:
      messages:
        must_be_positive: "must be greater than zero."
```

Use a symbol key in `validates` — Rails resolves it through the scope chain above. String messages are used as-is and bypass the catalog; avoid them for any user-facing message.

### Mailers

Mailer subject lines and body strings live in the email view (`.html.erb` / `.text.erb`). Wrap body strings in views as normal lazy `t('.key')` calls.

For the subject, use the `default_i18n_subject` helper in the mailer class, which looks up `{mailer_name}.{action_name}.subject`:

```ruby
# app/mailers/user_mailer.rb
class UserMailer < ApplicationMailer
  def welcome_email(user)
    @user = user
    mail(to: @user.email, subject: default_i18n_subject(name: @user.name))
  end

  def password_reset(user)
    @user = user
    mail(to: @user.email, subject: default_i18n_subject)
  end
end
```

```yaml
en:
  user_mailer:
    welcome_email:
      subject: "Welcome to MyApp, %{name}!"
    password_reset:
      subject: "Reset your password"
```

For mailer body strings in the view:

```erb
<%# app/views/user_mailer/welcome_email.html.erb %>
<h1><%= t('.heading') %></h1>
<p><%= t('.intro', name: @user.name) %></p>
```

```yaml
en:
  user_mailer:
    welcome_email:
      heading: "Welcome aboard!"
      intro: "Hi %{name}, thanks for signing up."
```

### Helpers

Strings returned from helpers need fully-qualified `t()` keys (helpers do not have a template path for lazy lookup unless called from within a view template):

```ruby
# app/helpers/application_helper.rb
def page_title(key)
  t("pages.#{key}.title")
end

def flash_icon(type)
  case type
  when :notice then content_tag(:span, t('ui.flash.notice'))
  when :alert  then content_tag(:span, t('ui.flash.alert'))
  end
end
```

```yaml
en:
  ui:
    flash:
      notice: "Success"
      alert: "Error"
```

---

## Step 3: Interpolation, HTML-safe keys, dates, numbers

All rules for `%{name}` interpolation, `_html` key naming, and localized formatting are in the project's coding rules. Apply them during wrapping — do not re-derive them per string. Quick reference:

- **Interpolation:** `t('key', name: user.name)` against `"Hello, %{name}!"` — never build sentences by Ruby string concatenation or `#{}` interpolation of a raw string.
- **HTML markup:** key ending in `_html` (e.g. `terms_html`) — Rails marks the result `html_safe`; interpolated variables are still HTML-escaped by Rails, so you do not escape them manually. When the value contains **double-quoted** HTML attributes (`href="/privacy"`), author it as a **single-quoted** YAML scalar so the inner `"` need no escaping (see the coding rules → "HTML-safe keys").
- **Dates and times:** `format_date(article.published_at, :short)` from `FormatHelper` — not a bare `l()`. `l()` localizes `Date`, `DateTime`, and `Time` objects only; passing a number to it raises `I18n::ArgumentError`.
- **Numbers and currency:** `format_money(price)`, `format_number(count)`, `format_percent(rate)` from `FormatHelper` — not bare `number_to_currency` / `number_with_delimiter` / `number_with_precision`. The module wraps those Action View helpers (and their `rails-i18n` `number.*` YAML keys) behind one name each, with the project's currency and its ISO 4217 minor-unit handling already resolved. Do **not** pass numeric values to `l()`.

The module name is whatever `.agents/globalize-rules.md` states — `FormatHelper` is the default. See "Convert hand-rolled formatting" below for the full rewrite table.

---

## Convert hand-rolled formatting

Wrapping a string makes it **translatable**; it does not make a number, a price or a date **render
correctly**. `$1,234.50` stays `$1,234.50` for a German reader who expects `1.234,50 $`, however good
the surrounding translation is. This pass routes hand-rolled formatting through `FormatHelper`, the
module Phase 2 created (`generate_format_helpers`) — it already exists, so you are rewriting call
sites, not authoring a module.

Methods are `format_`-prefixed and snake_case because the module is mixed into every view, where a bare
`number` or `list` would collide with Action View or a local. The ten: `format_money`, `format_number`,
`format_percent`, `format_compact`, `format_unit`, `format_date`, `format_time`, `format_date_time`,
`format_relative_time`, `format_list`.

| Found | Replace with |
|---|---|
| `"$#{amount}"`, `"$" + amount.to_s`, `"#{price} USD"` | `format_money(price)` |
| `number_to_currency(price)` with an inline `unit:` / `precision:` at the call site | `format_money(price)` — the module owns the unit and the minor-unit rules |
| `price.round(2)` / `"%.2f" % price` inside an ERB output tag or any user-visible string | `format_money(price)` when it is a price, `format_number(value)` otherwise |
| `value.strftime("%m/%d/%Y")`, `Time.current.strftime(...)` in a view, helper, mailer or serializer that feeds the UI | `format_date(value)` — or `format_date_time` / `format_time` when the pattern carried a time |
| `time_ago_in_words(t)`, a hand-built `"3 days ago"` | `format_relative_time(t)` |
| `(a.to_f / b * 100).round + "%"` | `format_percent(a.to_f / b)` — the helper takes a **ratio**, not an already-multiplied percentage |
| `items.join(", ")` in user-visible copy | `format_list(items)` (`format_list(items, :or)` for a disjunction) |
| `number_with_delimiter` / `number_with_precision` at a call site | `format_number(value)` |
| `"#{n / 1000.0.round(1)}K"` | `format_compact(n)` |

**Rewrite the helper, not its call sites.** A project with its own `formatted_price(amount)` used in
thirty views should have *that method* delegate to `format_money` — a thirty-file diff for the same
result is worse.

**`FormatHelper` is a helper module**, so its methods are available in views without an import. In a
model, job, mailer body, or service object, `include FormatHelper` (or call
`ApplicationController.helpers.format_money(…)`) — the rules file states which form this project uses.

### What NOT to convert

Locale formatting in machine-readable output is a **bug**, not a fix. Leave alone: log lines and
`Rails.logger` output; IDs, slugs, filenames, cache keys, `data-*` attributes; CSV/JSON/XML payloads
and every API serializer (Jbuilder, ActiveModel::Serializers, `to_json`); anything compared against a
literal or parsed back; test fixtures and factories; **any date going into an ISO-8601 field**
(`iso8601`, `to_s(:db)` — both must stay); `<input type="number">` / `type="date"` values and any form
value that round-trips; and `app/helpers/format_helper.rb` itself, which constructs formatters on
purpose. When in doubt whether a value is user-visible, leave it and record it — a flagged
non-conversion costs a review comment, a wrong one costs a production bug.

### Ordering

Convert formatting **after** wrapping the strings in the same file. A formatted value usually ends up
as a `%{…}` placeholder inside a wrapped message, and the placeholder-naming rule in the coding rules
applies to it. Format the value, then interpolate the result — never interpolate a raw number and
expect the YAML to format it. And never split a sentence to isolate a number: `t('cart.total', total:
format_money(x))` is one message; `"Total: " + format_money(x)` is a fragment no translator can
reorder.

### What this pass does not remove

Leave date/time libraries in place. Convert their **display formatting** only; leave parsing,
arithmetic (`+ 1.day`, `beginning_of_month`), and timezone conversion (`in_time_zone`) exactly as
written. Do not edit the `Gemfile`. Record what you left, with file and line.

### Progress reporting

Same atomic-write protocol as the wrap pass. Under each file's entry record `formatSitesConverted`
(how many call sites, to which method) and `formatSitesFlagged` (each site left, with a one-line
reason). A file in scope for `formatting` that needed no change still gets a zero-conversion entry —
"scanned and clean" must not look like "never opened".

---

## Step 4: Audit and normalize with `i18n-tasks`

After wrapping, use `i18n-tasks` to audit the catalog. **This install is owned by the convert phase** — the verify step adds the gem and scaffolds `config/i18n-tasks.yml` if they are not already present, so the audit tooling is guaranteed available when the gate runs. (The CI add-on in `setup.add-ons.md` Add-on 3 reuses the same gem + config idempotently; it does not re-install when convert already did.)

Add to `Gemfile`:

```ruby
group :development, :test do
  gem "i18n-tasks", "~> 1.0", require: false
end
```

Run `bundle install`, then create `config/i18n-tasks.yml` at the project root if not present:

```yaml
# config/i18n-tasks.yml
base_locale: en
locales: [en, es]  # replace with your configured locales

search:
  paths:
    - app/

# Suppress "missing" warnings for keys that rails-i18n already provides.
# search.exclude filters source *code* files, not locale data — it cannot
# suppress gem-provided keys. Use ignore_missing for key-pattern suppression.
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

Run the audit commands. **The base-locale completeness check is the gate; the rest are cleanup or informational:**

```bash
# GATE — keys used in code but missing from the BASE locale (must be empty)
bundle exec i18n-tasks missing -t used

# Informational — keys in the base locale missing from TARGET locales
# (expected: target stubs are filled later by the TMS — never a gate)
bundle exec i18n-tasks missing -t diff

# Cleanup — keys in YAML never referenced by a t() call
bundle exec i18n-tasks unused
```

- **`missing -t used` (the gate)** — a `t('some.key')` call exists in code but no entry exists in the base locale. This must report no keys before connecting: add the entry to the source-locale file. This is the only catalog check that should *fail* the convert phase. **Judge by the reported keys, not the exit code** — `i18n-tasks missing` is a report command that may exit `0` even with findings (only `i18n-tasks health` is contracted to exit non-zero). For a scriptable check, `bundle exec i18n-tasks missing -t used -f keys` prints one key per line; empty output = pass.
- **`missing -t diff` (informational)** — a key exists in the base locale but not in a target (`es.yml`, …). Expected for keys not yet translated; the connect phase / TMS fills these. Never fail the convert phase on it.
- **`unused` (cleanup)** — a YAML entry exists but no `t()` call references it. Delete genuinely-orphaned keys (including any scaffold seed keys the setup phase added that the app never wired up, e.g. `site.title`), or fix a wrong key path (check lazy-lookup path mirroring). Cleaning these keeps the later CI `i18n-tasks health` gate clean.

> **Do not run `i18n-tasks normalize` during convert.** It rewrites the catalog to alphabetical key order, destroying the human-readable reading order in which strings were just authored — and a freshly-authored catalog is never alphabetical, so a `normalize && git diff` check would false-fail on correct first-convert output. Leave the catalog in authored order. Canonical ordering is a CI / connect-time concern, applied by the CI integration (`setup.add-ons.md` Add-on 3), not by convert.
>
> **Do not gate on `i18n-tasks health` here.** `health` runs all-locale `missing` + `unused` together; on a freshly-converted project it red-flags the (by-design) empty target stubs and any not-yet-cleaned seed key. Use the scoped `missing -t used` gate above instead. `health` is the right gate for ongoing CI (Add-on 3), once targets are populated.

---

## Step 5: Run steps — exact commands

In sequence after completing Steps 1–4:

```bash
# 1. Discover hardcoded strings in ERB views
bundle exec erblint --lint-all --enable-linters HardCodedString app/views/

# 2. Discover hardcoded strings in Ruby files
bundle exec rubocop --only I18n app/controllers/ app/mailers/ app/helpers/ app/models/

# 3. After wrapping — GATE: every used key must exist in the base locale (must be empty)
bundle exec i18n-tasks missing -t used

# 4. Informational — target-locale gaps (expected; filled by the TMS, not a gate)
bundle exec i18n-tasks missing -t diff

# 5. Cleanup — delete orphaned/unused keys (incl. leftover scaffold seeds)
bundle exec i18n-tasks unused
```

Do **not** run `i18n-tasks normalize` as part of convert (it destroys authored reading order and would false-fail a drift check on correct first-convert output). Canonical ordering is applied later by the CI integration — see `setup.add-ons.md` Add-on 3.

---

## Do-not-touch

- **`globalize` gem, `mobility` gem, `traco` gem** — these translate per-row database content (`*_translations` tables, suffixed columns). They are DB-content translation gems, unrelated to Globalize.now and to UI-string translation. Do **not** wrap model content managed by these gems with `t()`, and do not include their keys in the connected catalog. See the coding rules for the full skip-list.
- **`db/` directory** — migrations, schema, and seeds are not user-facing UI text.
- **`rails-i18n`-provided default keys** — `activerecord.errors.messages.*`, `date.formats.*`, `number.*`, and similar defaults are already translated by `rails-i18n` for each locale. Only app-authored overrides of these belong in your connected catalog. Extracting built-in defaults would duplicate keys that `rails-i18n` already manages.
- **Non-user-facing strings** — log messages, `Rails.logger` calls, exception messages, internal codes, `data-testid` values, URL paths, config file values. See the full skip-list in the project's coding rules.

---

## After conversion

With the base-locale completeness gate clean (`i18n-tasks missing -t used` empty) and orphaned keys cleaned up (`unused`):

1. Verify the application renders correctly in the source locale — spot-check converted pages.
2. If `raise_on_missing_translations = true` is set in `config/environments/test.rb` (configured by the setup phase), run the test suite: any missing key raises immediately.
3. Proceed to the connect phase — point Globalize at `config/locales/{locale}.yml`, `fileFormat: yaml-rails`, with the source locale as `en` (or your `default_locale`).
