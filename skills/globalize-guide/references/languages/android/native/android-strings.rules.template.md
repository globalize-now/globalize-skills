---
name: android-strings-code
user_invocable: false
description: >-
  Apply automatically whenever writing or modifying UI code in a native Android
  project (Kotlin/Java, Views/Jetpack Compose) — new screens, layouts, dialogs,
  notifications, menus, or any change that adds or edits user-visible text. Not
  user-invocable. Ensures strings, plurals, interpolation, escaping, and
  do-not-translate runs are authored correctly as code is written.
template: android-strings
templateVersion: 2
conditions: [uiToolkit, localeSwitcher]
values: [resDir, sourceLocale, targetLocales]
budget: { "default": 180 }
---

# Android String-Resource Coding Rules

Apply these rules as you write code. Every user-visible string must have a `strings.xml` entry and be
referenced by `@string/`, `R.string.*`, or `R.plurals.*` before the task is complete — Android localizes
through string resources and the framework accessors, nothing else. These rules are identical across all
Android API levels; there is no version gating on the resource API.

**This project:**
- Source strings: `<<resDir>>/values/strings.xml` — `values/` carries **no locale qualifier**, which is what
  makes it the source. Author every new key there, in `<<sourceLocale>>`; don't hand-fill the overlays.
- Target locales `<<targetLocales>>` live in sibling qualifier **directories** — `<<resDir>>/values-es/…`;
  a region takes a lowercase `r` (`values-pt-rBR`), a script the BCP47 `b+` form (`values-b+zh+Hant`). The
  qualifier is on the directory, not in the filename; `values-pt_BR` (underscore) is invalid, silently ignored.

## Externalize every user-visible string — never inline a literal

Never pass a literal to a UI sink — it must be a `<string>` in `<<resDir>>/values/strings.xml`.

<!-- if: uiToolkit != "views" -->
```kotlin
Text("Save")                                    // Wrong — never translated, slips through silently
Text(stringResource(R.string.action_save))      // Right — stringResource is androidx.compose.ui.res
```
<!-- /if -->
<!-- if: uiToolkit != "compose" -->
```kotlin
button.text = "Save"                            // Wrong — never translated
button.text = getString(R.string.action_save)   // Right — on Context/Activity/Fragment; else context.getString
```
<!-- /if -->
```xml
<string name="action_save">Save</string>
```
<!-- if: uiToolkit != "compose" -->
```xml
<!-- layouts reference @string/ — a literal here fails Lint's HardcodedText -->
<Button android:text="@string/action_save" />
```
<!-- /if -->

## Interpolation — positional `%n$s`, never concatenation

Use **positional** format specifiers and fill them at the call site. Positional (`%1$s`, not `%s`) lets
translators reorder arguments; non-positional with multiple args fails to build. Specifiers: `%1$s` (string),
`%1$d` (int), `%1$f` (float, e.g. `%1$.2f`).

```xml
<string name="greeting">Hello, %1$s! You have %2$d new items.</string>
```

<!-- if: uiToolkit != "compose" -->
- Views/Kotlin — `getString(R.string.greeting, user.name, count)`; args in specifier order.
<!-- /if -->
<!-- if: uiToolkit != "views" -->
- Compose — `stringResource(R.string.greeting, user.name, count)`; args in specifier order.
<!-- /if -->

**Never build sentences by concatenation or Kotlin string templates** — word order differs across languages
and fragments can't be translated. `"Hello, " + user.name + "!"` and `"Hello, ${user.name}!"` are both wrong.

## Mark do-not-translate runs with `<xliff:g>`

Wrap brand names, codes, URLs, and the literal placeholder so translators leave them intact. Declare the
namespace once on `<resources>`.

```xml
<resources xmlns:xliff="urn:oasis:names:tc:xliff:document:1.2">
    <string name="welcome">Welcome to <xliff:g id="app" example="Acme">%1$s</xliff:g></string>
</resources>
```

## Plurals — native `<plurals>` with CLDR `quantity`, selected by count

Android pluralization uses native `<plurals>` with CLDR `quantity` categories (`zero`, `one`, `two`, `few`,
`many`, `other`) — **this is NOT ICU MessageFormat**. Author every category the language needs; **always
include `other`** (the required fallback). The framework selects the form from the count you pass.

```xml
<plurals name="inbox_count">
    <item quantity="one">%1$d message</item>
    <item quantity="other">%1$d messages</item>
</plurals>
```

<!-- if: uiToolkit != "compose" -->
- Views/Kotlin — `resources.getQuantityString(R.plurals.inbox_count, n, n)`
<!-- /if -->
<!-- if: uiToolkit != "views" -->
- Compose — `pluralStringResource(R.plurals.inbox_count, n, n)`
<!-- /if -->

Pass the count **twice**: once selects the category, once fills `%1$d`. Languages such as Russian, Polish,
Arabic, Czech, Ukrainian need additional categories (`few`/`many`/`zero`) — add the `<item>`s in those locales'
files. **Never** pick between strings with `if (n == 1)` — it bakes English grammar into the code and breaks
languages with more than two forms.

## Numbers, currencies, dates — format, never concatenate

`"$" + amount` hardcodes both the symbol and its position — many locales put it after the number — and
`String.format("%.2f", amount)` renders `1234.50` with the wrong separators. Format through the framework,
using the locale the resources actually resolved to:

<!-- if: uiToolkit != "compose" -->
- Views/Kotlin — `val locale = resources.configuration.locales[0]`
<!-- /if -->
<!-- if: uiToolkit != "views" -->
- Compose — `val locale = LocalConfiguration.current.locales[0]`
<!-- /if -->

```kotlin
NumberFormat.getCurrencyInstance(locale).apply { currency = Currency.getInstance("USD") }.format(amount)
NumberFormat.getInstance(locale).format(count)
NumberFormat.getPercentInstance(locale).format(ratio)

DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM).withLocale(locale).format(date)
DateUtils.formatDateTime(context, millis, FORMAT_SHOW_DATE or FORMAT_SHOW_TIME)
```

**The currency code is a property of the price, not of the reader.** Set it explicitly from your data
(`Currency.getInstance("USD")`); never leave it defaulting to the device locale's currency, which would
relabel a dollar price as euros for a German user. The locale decides *formatting*, the data decides *which
currency*.

**Never hardcode a date pattern.** `SimpleDateFormat("MM/dd/yyyy")` forces American field order everywhere.
Use `FormatStyle` with `DateTimeFormatter`, or `DateUtils.formatDateTime()` — the latter also honours the
user's 12/24-hour system setting, which a pattern string cannot.

Format the value first, then pass the **formatted string** into the resource as `%1$s` — not `%1$d` / `%1$f`,
which format the raw number without going through the locale-aware formatter.

**Flag for review:** `"$" + amount`, `String.format("%.2f", price)`, `SimpleDateFormat("…")`, and any raw
number or date interpolated into a Kotlin template that reaches the UI.

## Escaping and markup

- **Apostrophe** — `\'` or wrap the whole value in double quotes: `<string name="x">"It's here"</string>`.
- **Quote** — `\"`. **Ampersand / angle bracket** — `&amp;` / `&lt;`.
- **Leading `@` or `?`** — escape (`\@`, `\?`) so it isn't read as a resource/attr reference.
- **HTML/markup** — use `<![CDATA[…]]>` or the supported inline tags (`<b>`, `<i>`, `<u>`); read styled text
  with `getText(R.string.x)` (preserves spans) rather than `getString` (strips them).
- **Whitespace** — collapse by default; wrap in `"…"` to preserve leading/trailing spaces.

## Translator comments

Android XML carries `<!-- -->` comments, and the one directly above a `<string>` / `<plurals>` is the only
context a translator gets. Add one above every non-obvious key — one short sentence, under 80 characters, in
the source language, saying **where it appears and what it refers to** rather than what the word means.

```xml
<!-- Save button in the document editor toolbar -->
<string name="action_save">Save</string>
```

**Must comment:** single words or two-word labels readable more than one way (`Right`, `Track`, `Post`);
action labels with no visible object (`Remove`, `Add`) — say what is acted on; non-obvious placeholders
(`%1$d remaining` — remaining what?); domain terms. **Skip:** full sentences, and a label restating its field.

Android has no `msgctxt`. When the same source text needs **different** translations in different places, give
it two keys (`action_right_direction`, `answer_right_correct`) — never one shared key.
<!-- if: localeSwitcher == "true" -->

## In-app language switching

This project lets the user pick a language in-app. Always go through AppCompat's per-app locale API (AppCompat
≥ 1.6; backed by the system `LocaleManager` on API 33+) — never the deprecated `Configuration` /
`Resources.updateConfiguration` hacks, and never a hand-rolled override. Adding a locale also means declaring
it in the locale config (`generateLocaleConfig = true` on AGP 8.1+, else `res/xml/locale_config.xml`); the
system language picker lists only what is declared.

```kotlin
AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags("es"))  // "" = follow the device
```
<!-- /if -->

## What NOT to wrap

Do not give these a `strings.xml` entry or a resource reference:

- **Non-user-facing strings** — `Log.*` / `println` messages, exception messages that never reach the UI,
  `BuildConfig`/constant values, analytics event names, `SharedPreferences` keys, intent action strings,
  database/column names, URL paths, MIME types, format patterns used internally.
<!-- if: uiToolkit != "compose" -->
- **`tools:` namespace attributes** — `tools:text`, `tools:hint`, sample data — design-time only, stripped
  from the build.
- **IDs / tags** — `android:id` and `android:tag`.
<!-- /if -->
- **Test hooks** — a `contentDescription` or test tag set only so a test can find the node. A real
  accessibility label *is* user-visible — wrap that one.
- **`translatable="false"` keys** — already excluded from translation (often `app_name`, developer-only
  strings, machine patterns).
- **CSS-equivalent styling** — dimension/color/style resource values are not translatable text.
