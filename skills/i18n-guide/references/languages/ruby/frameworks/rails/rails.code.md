---
name: rails-code
user_invocable: false
description: >-
  Apply automatically whenever writing or modifying UI code in a Ruby on Rails
  project using the built-in Rails I18n API — new views, controllers, mailers,
  model validations, helpers, or any change that adds or edits user-visible text.
  Not user-invocable. Ensures strings, plurals, interpolation, HTML-safe keys,
  and per-request locale scope are authored correctly as code is written.
---

# Rails I18n Coding Rules

Apply these rules as you write code. Rails uses **locale-rooted YAML catalogs** and the built-in `I18n` API (the `t` / `l` view helpers, `I18n.t`, `I18n.l`). Every user-visible string must have a catalog entry and be called through `t` before the task is complete. These rules apply identically across Rails 6.1 → 8.1 — there is no version gating on the i18n surface.

---

## Per-request locale — always `I18n.with_locale`, never bare assignment

Rails (`I18n.locale`) is **thread-local**. Puma reuses threads across requests, so a bare `I18n.locale =` is never reset and leaks into a later request — an intermittent, load-dependent cross-request bug.

**Always use the block form in an `around_action`:**

```ruby
# app/controllers/application_controller.rb
around_action :switch_locale

def switch_locale(&action)
  locale = params[:locale] || I18n.default_locale
  I18n.with_locale(locale, &action)
end
```

`I18n.with_locale` restores the prior value in an `ensure`, so the locale is always reset after the request — even on exceptions.

**Never:**

```ruby
# Wrong — bare assignment leaks locale across Puma threads
before_action { I18n.locale = params[:locale] || I18n.default_locale }
```

---

## Lazy lookup — mirror the template path in the YAML key

In any view or controller action, **prefer the dot-prefixed lazy form** `t('.key')` over the fully-qualified `t('some.long.explicit.path')`. Rails expands the dot prefix to the current template or action's key path automatically.

The YAML **key path must mirror the template or action path** — this is required for lazy lookup to resolve:

| File | Lazy call | YAML path |
|---|---|---|
| `app/views/books/index.html.erb` | `t('.title')` | `en.books.index.title` |
| `app/views/users/show.html.erb` | `t('.greeting')` | `en.users.show.greeting` |
| `app/controllers/sessions_controller.rb` (action `create`) | `t('.success')` | `en.sessions.create.success` |

**Note:** lazy `t('.key')` only works with the **`t` helper** — in views via `ActionView::Helpers::TranslationHelper`, in controllers via `ActionController::Translation`. It does **not** work with bare `I18n.t('.key')` — bare `I18n.t` is not scope-aware and resolves the key literally.

```yaml
# config/locales/en.yml
en:
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

---

## Interpolation — use `%{name}`, never string concatenation

Rails interpolation syntax is `%{variable_name}`. Pass values as keyword arguments to `t`:

```ruby
# Correct
t('welcome.greeting', name: user.name)
```

```yaml
en:
  welcome:
    greeting: "Hello, %{name}!"
```

**Never build sentences by Ruby string concatenation.** Concatenation bakes word order into the code — other languages invert subject/object or put verbs at the end, and concatenated strings cannot be correctly translated.

```ruby
# Wrong — breaks word order and grammar for translators
"Hello, " + user.name + "!"
"Hello, #{user.name}!"   # interpolated into a Ruby string, not a t() call
```

The YAML string `"Hello, %{name}!"` is the unit the translator sees and reorders freely.

---

## HTML-safe keys — use `_html` suffix, let Rails escape

For translations that contain markup, name the key ending in `_html` (or exactly `html`). Rails automatically marks the returned string `html_safe` for output.

```yaml
en:
  notice:
    terms_html: "Please read our <a href='/terms'>Terms of Service</a>."
```

```erb
<%= t('notice.terms_html') %>
```

**Interpolated variables are always HTML-escaped even inside `_html` keys** — this is the mechanism that makes interpolation safe against XSS. You do not need to (and must not) escape values manually.

```ruby
# Safe — Rails escapes user_name even inside an _html key
t('profile.greeting_html', user_name: user.name)
```

**Never pass user-supplied values through `raw` or `html_safe`:**

```erb
<%# Wrong — bypasses escaping entirely %>
<%= raw t('notice.terms_html') %>
```

---

## Plurals — CLDR sub-keys selected by `:count`; install `rails-i18n` for non-English locales

Rails pluralization uses **CLDR sub-key groups** (`zero`, `one`, `two`, `few`, `many`, `other`) as sibling keys under a shared parent, selected automatically when `:count` is passed to `t`:

```yaml
en:
  inbox:
    one: "one message"
    other: "%{count} messages"
```

```ruby
t('inbox', count: 3)   # => "3 messages"
t('inbox', count: 1)   # => "one message"
```

**Core Rails ships only the English plural rule** (`one` / `other`). Every non-English locale with different plural categories (Russian, Polish, Arabic, Czech, Japanese, …) requires **`rails-i18n`**, which supplies the CLDR plural-rule lambdas and default locale data for ~100 languages. Without it, non-English plurals silently fall back to the wrong form.

Ensure `rails-i18n` is in the Gemfile whenever a non-English locale is in use. The version pin tracks the app's Rails major (consult `setup.add-ons.md` for the pin form).

CLDR categories that may appear for other languages: `zero`, `one`, `two`, `few`, `many`, `other`. Always include `other` — it is the required fallback for every language and the only category English cardinals use alongside `one`.

**Never** use a Ruby conditional to pick between two translated strings based on count — it bakes English grammar into the code:

```ruby
# Wrong — ternary between two messages breaks languages with more than two plural forms
count == 1 ? t('inbox.one_message') : t('inbox.many_messages')
```

---

## Dates and times use `l()`; numbers use number helpers

**Dates and times** — format through `l` (localize), not hardcoded format strings:

```ruby
l(Time.current, format: :short)
l(Date.today)
```

`I18n.l` / the `l` helper only localizes `Date`, `DateTime`, and `Time` objects. Passing a numeric value raises `I18n::ArgumentError`.

**Numbers and currency** — use Action View number helpers, which are backed by `rails-i18n`'s `number.*` YAML keys:

```ruby
number_to_currency(price)           # backed by number.currency.*
number_with_delimiter(1_234_567)    # backed by number.format.*
# also: number_with_precision, number_to_human
```

`rails-i18n` provides translated date/time format names and number/currency formatting for each locale.

---

## What NOT to wrap

Do not give these a `t()` call or a YAML catalog entry:

- **`globalize` gem, `mobility` gem, `traco` gem** — these are **DB/model-content translation gems** (e.g. translating a product's `name` column per locale via `*_translations` tables or suffixed columns). They are entirely unrelated to Globalize.now and to UI-string translation. Do not wrap their model content with `t()`, do not include their keys in the connected Globalize catalog, and do not conflate these gems with the Globalize.now platform.
- **`db/` directory** — migrations, schema, seeds are not user-facing UI text.
- **`rails-i18n`-provided defaults** — `activerecord.errors.messages.*`, `date.formats`, `number.*`, and similar keys that `rails-i18n` already ships for each locale. Only app-authored overrides of these belong in your connected catalog.
- **Non-user-facing internal strings** — log messages, console output, internal codes, object keys, `data-testid` values, enum/constant names, URL paths, API route strings, `config/` file values, `raise`/`fail` messages that never surface in the UI.
- **CSS class names** — `class="font-bold text-sm"`. When writing CSS, prefer logical properties (`margin-inline-start`, not `margin-left`); see the `css-i18n` skill.
