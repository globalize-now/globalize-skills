---
name: rails-code
user_invocable: false
description: >-
  Apply automatically whenever writing or modifying UI code in a Ruby on Rails
  project using the built-in Rails I18n API — new views, controllers, mailers,
  model validations, helpers, or any change that adds or edits user-visible text.
  Not user-invocable. Ensures strings, plurals, interpolation, HTML-safe keys,
  and per-request locale scope are authored correctly as code is written.
template: rails
templateVersion: 2
conditions: [urlLocaleRouting, railsI18nGem, modelContentGems]
values: [catalogPath, sourceLocale, targetLocales, formatModule]
budget: { "default": 210 }
---

# Rails I18n Coding Rules

Apply these rules as you write code. Rails uses **locale-rooted YAML catalogs** and the built-in `I18n` API (the `t` / `l` view helpers, `I18n.t`, `I18n.l`). Every user-visible string must have a catalog entry and be called through `t` before the task is complete. These rules apply identically across Rails 6.1 → 8.1 — there is no version gating on the i18n surface.

**This project:**
- Catalogs: `<<catalogPath>>` — hand-authored YAML; add every new key in the same change that uses it.
- Source locale: `<<sourceLocale>>` — write every source string in it. A Rails locale file's **top-level key is the locale code**, so the source file is rooted under `<<sourceLocale>>:` and every key path in it starts `<<sourceLocale>>.`.
- Target locales: `<<targetLocales>>` — one file each, rooted under their own locale code.

## Per-request locale — always `I18n.with_locale`, never bare assignment

Rails (`I18n.locale`) is **thread-local**. Puma reuses threads across requests, so a bare `I18n.locale =` is never reset and leaks into a later request — an intermittent, load-dependent cross-request bug. `I18n.with_locale` restores the prior value in an `ensure`, so the locale is always reset after the request — even on exceptions. Always use the block form in an `around_action`:

<!-- if: urlLocaleRouting == "prefix" -->
```ruby
# app/controllers/application_controller.rb
around_action :switch_locale

def switch_locale(&action)
  locale = params[:locale] || I18n.default_locale
  I18n.with_locale(locale, &action)
end

before_action { I18n.locale = params[:locale] || I18n.default_locale }   # ❌ Wrong — bare assignment leaks locale across Puma threads
```

This app carries the locale in the URL path (`scope "/:locale"`), so `params[:locale]` holds it, and `ApplicationController#default_url_options` returning `{ locale: I18n.locale }` propagates it into every generated URL — that is a public Rails hook, so keep it **above** the `private` keyword, not beside `switch_locale`. Put new user-facing routes **inside** `scope "/:locale"`; infrastructure routes (`/up`, webhooks, API mounts) stay outside it, or a bare `GET /up` probe 404s.
<!-- else -->
```ruby
# app/controllers/application_controller.rb
around_action :switch_locale

def switch_locale(&action)
  locale = requested_locale || I18n.default_locale
  I18n.with_locale(locale, &action)
end

before_action { I18n.locale = requested_locale }   # ❌ Wrong — bare assignment leaks locale across Puma threads
```

This app has **no locale segment in the URL**, so `params[:locale]` is always `nil` — never read it. Derive `requested_locale` from wherever the app persists the choice (session, cookie, user preference, the `Accept-Language` header) and validate it against `I18n.available_locales` before passing it in.
<!-- /if -->

## Lazy lookup — mirror the template path in the YAML key

In any view or controller action, **prefer the dot-prefixed lazy form** `t('.key')` over the fully-qualified `t('some.long.explicit.path')`. Rails expands the dot prefix to the current template or action's key path automatically.

The YAML **key path must mirror the template or action path** — this is required for lazy lookup to resolve:

| File | Lazy call | YAML path |
|---|---|---|
| `app/views/books/index.html.erb` | `t('.title')` | `<<sourceLocale>>.books.index.title` |
| `app/views/users/show.html.erb` | `t('.greeting')` | `<<sourceLocale>>.users.show.greeting` |
| `app/controllers/sessions_controller.rb` (action `create`) | `t('.success')` | `<<sourceLocale>>.sessions.create.success` |

**Note:** lazy `t('.key')` only works with the **`t` helper** — in views via `ActionView::Helpers::TranslationHelper`, in controllers via `ActionController::Translation`. It does **not** work with bare `I18n.t('.key')` — bare `I18n.t` is not scope-aware and resolves the key literally.

```yaml
# config/locales/<<sourceLocale>>.yml
<<sourceLocale>>:
  books:
    index:
      title: "Books"
      empty: "No books found."
```

```erb
<%# app/views/books/index.html.erb %>
<h1><%= t('.title') %></h1>
<p><%= t('.empty') %></p>
```

For strings outside a template scope (mailer subjects, flash messages, model validations), use the fully-qualified key form — `t('mailer.welcome.subject')`, `t('users.sessions.created')`, etc. — and nest them under a matching path in the YAML.

## Interpolation — use `%{name}`, never string concatenation

Rails interpolation syntax is `%{variable_name}`. Pass values as keyword arguments to `t`. **Never build sentences by Ruby string concatenation** — concatenation bakes word order into the code, and other languages invert subject/object or put the verb at the end, so concatenated strings cannot be correctly translated.

```ruby
t('welcome.greeting', name: user.name)   # ✅ Correct
"Hello, " + user.name + "!"              # ❌ Wrong — breaks word order and grammar for translators
"Hello, #{user.name}!"                   # ❌ Wrong — interpolated into a Ruby string, not a t() call
```

```yaml
<<sourceLocale>>:
  welcome:
    greeting: "Hello, %{name}!"
```

The YAML string `"Hello, %{name}!"` is the unit the translator sees and reorders freely.

## HTML-safe keys — use `_html` suffix, let Rails escape

For translations that contain markup, name the key ending in `_html` (or exactly `html`). Rails automatically marks the returned string `html_safe` for output.

```yaml
<<sourceLocale>>:
  notice:
    terms_html: "Please read our <a href='/terms'>Terms of Service</a>."
    privacy_html: '<a href="/privacy">Privacy Policy</a>'
```

**YAML quoting:** if the markup uses **double-quoted** attributes (`<a href="/privacy">`), author the value as a **single-quoted** YAML scalar so the inner `"` need no escaping. Single-quoted HTML attributes inside a double-quoted scalar (the `terms_html` line above) also work — pick one convention and stay consistent. The trap to avoid is a double-quoted YAML scalar wrapping double-quoted attributes, which forces escaping every inner `"`.

**Interpolated variables are always HTML-escaped even inside `_html` keys** — this is the mechanism that makes interpolation safe against XSS. You do not need to (and must not) escape values manually, and you must **never** pass a user-supplied value through `raw` or `html_safe`.

```erb
<%= t('notice.terms_html') %>                             <%# ✅ Correct — Rails marks it html_safe %>
<%= t('profile.greeting_html', user_name: user.name) %>   <%# ✅ Correct — user_name is still escaped %>
<%= raw t('notice.terms_html') %>                         <%# ❌ Wrong — bypasses escaping entirely %>
```

## Plurals — CLDR sub-keys selected by `:count`

Rails pluralization uses **CLDR sub-key groups** (`zero`, `one`, `two`, `few`, `many`, `other`) as sibling keys under a shared parent, selected automatically when `:count` is passed to `t`:

```yaml
<<sourceLocale>>:
  inbox:
    one: "one message"
    other: "%{count} messages"
```

```ruby
t('inbox', count: 3)   # ✅ => "3 messages"
t('inbox', count: 1)   # ✅ => "one message"
count == 1 ? t('inbox.one_message') : t('inbox.many_messages')   # ❌ Wrong — a ternary between two messages breaks every language with more than two plural forms
```

Always include `other` — it is the required fallback for every language, and the only category English cardinals use alongside `one`. Other languages need more of the CLDR set: `zero`, `two`, `few`, `many`.

<!-- if: railsI18nGem == "true" -->
**Core Rails ships only the English plural rule** (`one` / `other`). Every non-English locale with different plural categories (Russian, Polish, Arabic, Czech, Japanese, …) needs the **`rails-i18n`** gem, which supplies the CLDR plural-rule lambdas and default locale data for ~100 languages; without it, non-English plurals silently fall back to the wrong form. This project has it — keep it in the `Gemfile` whenever a non-English locale is in use, pinned to the app's Rails major.minor (`gem "rails-i18n", "~> N.M"`, e.g. `"~> 8.1"` on Rails 8.1, because the gem versions in lockstep with Rails).
<!-- else -->
**Core Rails ships only the English plural rule** (`one` / `other`), and this project does **not** have the **`rails-i18n`** gem. Every non-English locale with different plural categories (Russian, Polish, Arabic, Czech, Japanese, …) silently falls back to the wrong plural form until it is installed, and the locale's `activerecord.errors.*`, `date.*`, `number.*` defaults are missing too. Add it before shipping a non-English locale — `gem "rails-i18n", "~> N.M"` in the `Gemfile`, pinned to the app's Rails major.minor (e.g. `"~> 8.1"` on Rails 8.1, because the gem versions in lockstep with Rails).
<!-- /if -->

## Gender / select — map to sibling sub-keys in Ruby (no ICU `select`)

Rails I18n has **no ICU `select` primitive** (unlike next-intl / Lingui / Paraglide). For gender- or category-based message selection, map the selector value to a sibling sub-key and resolve it in Ruby. Always include an `other` (or neutral default) sub-key and fall back to it for unknown or `nil` selector values, as the `:default` below does.

```ruby
# Pick the sub-key from the selector value; fall back to the neutral default
t("profile.show.reply.#{user.gender}", default: t("profile.show.reply.other"))
```

```yaml
<<sourceLocale>>:
  profile:
    show:
      reply:
        female: "She replied to your comment."
        male: "He replied to your comment."
        other: "They replied to your comment."
```

**Never reach for a CLDR plural group** (`one`/`other`) for non-count selection — plural categories are count-driven and will mis-select on a gender/category value. Gender and category selection is a separate concern, handled by explicit sub-keys as above.

## Numbers, currencies, dates and times — route every call through `<<formatModule>>`

Never hardcode a formatted number, a currency symbol, or a date/time format string, and never call `number_to_currency` / `number_with_delimiter` / `number_to_percentage` / `number_to_human` / `distance_of_time_in_words` / `I18n.l` directly at a call site — route through `<<formatModule>>`'s ten methods instead, so currency, precision, and presets stay defined in one place.

```ruby
# In any view or mailer — <<formatModule>> is mixed in automatically:
format_money(amount)

# Everywhere else — models, service objects, jobs, rake tasks, `rails runner` —
# reach the same methods through Rails' own helper proxy:
ActionController::Base.helpers.format_money(order.total, order.currency)
```

All ten:

```ruby
format_money(amount)                              # '$42.50' — see below, currency comes from the data
format_number(1234.5)                             # '1,234.5'
format_percent(0.42)                              # '42.0%' — fixed one-decimal precision
format_compact(12_000)                            # '12 Thousand' — word units, not 'K'/'M' abbreviations
format_unit(5, 'km')                              # '5 km'
format_date(value, :short)                        # 'medium' is the default if omitted — 'Aug 21' (rails-i18n's short has no year)
format_date(value, :long)                         # 'August 21, 2026'
format_time(value)                                # '4:05 PM'
format_date_time(value)                           # 'Aug 21, 2026, 4:05 PM'
format_relative_time(value)                       # '3 days ago'
format_list(['Alice', 'Bob', 'Carol'])            # 'and' is the default — 'Alice, Bob, and Carol'
format_list(['Alice', 'Bob'], :or)                # 'Alice or Bob'
```

**Currency comes from the data, not the reader.** `format_money(order.total, order.currency)` renders whatever currency the *order* carries; `format_money(amount)` with no second argument formats the project default and, only then, may the active locale's own configured symbol win. Never derive a currency code from the locale — that relabels a dollar price as euros for a German reader.

**`I18n.l` raises on a numeric argument.** It localizes `Date`, `DateTime`, and `Time` only — a bare `Float` or `Integer` raises `I18n::ArgumentError`. `<<formatModule>>`'s `format_date` / `format_time` / `format_date_time` already coerce via `.to_date` / `.to_time`, so they accept `Date` / `Time` / `DateTime` / parseable `String` values directly; a raw Unix timestamp still needs `Time.at(...)` first.

**`<<formatModule>>` needs Action View for six of its ten methods** (`format_money`, `format_number`, `format_percent`, `format_compact`, `format_unit`, `format_relative_time`) — a bare `include FormatHelper` on a model, job, or service object is not enough for those six. Use `ActionController::Base.helpers.format_money(...)` (works anywhere with no include), or `include ActionView::Helpers::NumberHelper` / `DateHelper` alongside `FormatHelper` on that class. `format_locale`, `format_date`, `format_time`, `format_date_time`, and `format_list` need neither — they run everywhere already.

<!-- if: railsI18nGem == "true" -->
**`rails-i18n` already ships `number.*`, `date.formats.{default,short,long}`, `time.formats.{default,short,long}`, and `support.array.{words_connector,two_words_connector,last_word_connector}`** for every locale it covers — never re-author those. `<<formatModule>>` adds seven keys neither Rails core nor `rails-i18n` ships under any locale: `date.formats.medium`, `time.formats.{time,date_time}`, `time.{ago,from_now}`, and `support.array.or.{two_words_connector,last_word_connector}`. Every new target locale needs its own translation of these seven — `rails-i18n` never fills them in, no matter how well it covers that locale otherwise.
<!-- else -->
**This project does not have `rails-i18n`.** `<<formatModule>>`'s number and date formatting only reads correctly-localized defaults once it is installed (see the plurals section above) — until then, `number.*` and `date.formats`/`time.formats` fall back to English regardless of the active locale. `<<formatModule>>` also adds seven keys neither Rails core nor `rails-i18n` ships under any locale: `date.formats.medium`, `time.formats.{time,date_time}`, `time.{ago,from_now}`, and `support.array.or.{two_words_connector,last_word_connector}` — author these directly, for every locale, regardless of whether `rails-i18n` is ever added.
<!-- /if -->

**Needs a format `<<formatModule>>` has no preset for?** Add it to the module. A date style or currency code written out at two call sites will drift.

**Flag for review:** `strftime(`, `"$#{`, a bare `number_to_currency` with an inline `unit:`, and `round(2)` in a view.

## What NOT to wrap

Do not give these a `t()` call or a YAML catalog entry:

<!-- if: modelContentGems == "true" -->
- **`globalize` gem, `mobility` gem, `traco` gem** — these are **DB/model-content translation gems** (e.g. translating a product's `name` column per locale via `*_translations` tables or suffixed columns). They are entirely unrelated to Globalize.now and to UI-string translation. Do not wrap their model content with `t()`, do not include their keys in the connected Globalize catalog, and do not conflate these gems with the Globalize.now platform.
<!-- /if -->
- **`db/` directory** — migrations, schema, seeds are not user-facing UI text.
<!-- if: railsI18nGem == "true" -->
- **`rails-i18n`-provided defaults** — `activerecord.errors.messages.*`, `date.formats.{default,short,long}`, `number.*`, and similar keys that `rails-i18n` already ships for each locale. Only app-authored overrides of these belong in your connected catalog. **Exception:** `date.formats.medium` (and the other six keys `<<formatModule>>` adds — see "Numbers, currencies, dates and times" above) is *not* one of `rails-i18n`'s defaults and must be authored for every locale — it only looks like the same bucket.
<!-- /if -->
- **Non-user-facing internal strings** — log messages, console output, internal codes, object keys, `data-testid` values, enum/constant names, URL paths, API route strings, `config/` file values, `raise`/`fail` messages that never surface in the UI.
- **CSS class names** — `class="font-bold text-sm"`. When writing CSS, prefer logical properties (`margin-inline-start`, not `margin-left`); see the `css-i18n` skill.
