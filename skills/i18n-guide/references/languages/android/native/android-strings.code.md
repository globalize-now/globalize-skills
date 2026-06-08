---
name: android-strings-code
user_invocable: false
description: >-
  Apply automatically whenever writing or modifying UI code in a native Android
  project (Kotlin/Java, Views/Jetpack Compose) — new screens, layouts, dialogs,
  notifications, menus, or any change that adds or edits user-visible text. Not
  user-invocable. Ensures strings, plurals, interpolation, escaping, and
  do-not-translate runs are authored correctly as code is written.
---

# Android String-Resource Coding Rules

Apply these rules as you write code. Android localizes through **`res/values/strings.xml`** resources and the
framework accessors (`getString` / `stringResource`, `getQuantityString` / `pluralStringResource`). Every
user-visible string must have a `strings.xml` entry and be referenced by `@string/`, `R.string.*`, or
`R.plurals.*` before the task is complete. These rules are identical across all Android API levels — there is
no version gating on the resource API.

---

## Externalize every user-visible string — never inline a literal

Any text a user can read must live in `res/values/strings.xml`, referenced from code/markup. Never pass a
literal to a UI sink.

```kotlin
// Wrong — never translated, fails Lint (layouts) or slips through silently (code)
Text("Save")
button.text = "Save"
```
```kotlin
// Right
Text(stringResource(R.string.action_save))
button.text = getString(R.string.action_save)
```
```xml
<!-- res/values/strings.xml -->
<string name="action_save">Save</string>
```
```xml
<!-- layouts reference @string/ -->
<Button android:text="@string/action_save" />
```

`getString` is on `Context`/`Activity`/`Fragment`; elsewhere use `context.getString(...)` /
`resources.getString(...)`. In Compose use `stringResource(...)` (from `androidx.compose.ui.res`).

---

## Interpolation — positional `%n$s`, never concatenation

Use **positional** format specifiers and fill them at the call site. Positional (`%1$s`, not `%s`) lets
translators reorder arguments; non-positional with multiple args fails to build.

```xml
<string name="greeting">Hello, %1$s! You have %2$d new items.</string>
```
```kotlin
getString(R.string.greeting, user.name, count)          // Views/Kotlin
stringResource(R.string.greeting, user.name, count)     // Compose
```

Specifiers: `%1$s` (string/`%@`-equivalent), `%1$d` (int), `%1$f` (float, e.g. `%1$.2f`).

**Never build sentences by concatenation or Kotlin string templates** — word order differs across languages
and concatenated fragments can't be translated:

```kotlin
// Wrong
"Hello, " + user.name + "!"
"Hello, ${user.name}!"
```

---

## Mark do-not-translate runs with `<xliff:g>`

Wrap brand names, codes, URLs, and the literal placeholder so translators leave them intact. Declare the
namespace once on `<resources>`.

```xml
<resources xmlns:xliff="urn:oasis:names:tc:xliff:document:1.2">
    <string name="welcome">Welcome to <xliff:g id="app" example="Acme">%1$s</xliff:g></string>
</resources>
```

---

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
```kotlin
resources.getQuantityString(R.plurals.inbox_count, n, n)   // Views/Kotlin
pluralStringResource(R.plurals.inbox_count, n, n)          // Compose
```

Pass the count **twice**: once selects the category, once fills `%1$d`. Languages such as Russian, Polish,
Arabic, Czech, Ukrainian need additional categories (`few`/`many`/`zero`) — add the `<item>`s in those locales'
files. **Never** pick between strings with `if (n == 1)` — it bakes English grammar into the code and breaks
languages with more than two forms.

---

## Escaping and markup

- **Apostrophe** — `\'` or wrap the whole value in double quotes: `<string name="x">"It's here"</string>`.
- **Quote** — `\"`. **Ampersand / angle bracket** — `&amp;` / `&lt;`.
- **Leading `@` or `?`** — escape (`\@`, `\?`) so it isn't read as a resource/attr reference.
- **HTML/markup** — use `<![CDATA[…]]>` or the supported inline tags (`<b>`, `<i>`, `<u>`); read styled text
  with `getText(R.string.x)` (preserves spans) rather than `getString` (strips them).
- **Whitespace** — collapse by default; wrap in `"…"` to preserve leading/trailing spaces.

---

## Locale codes and resource dirs

- Source (default) strings live in `res/values/strings.xml` — **no qualifier**.
- Per-locale overlays live in `res/values-<qualifier>/strings.xml`. Region uses lowercase-`r`:
  `values-pt-rBR`, `values-zh-rTW`. Script subtags need the BCP47 `b+` form (API 24+): `values-b+zh+Hant`.
- **Never** use `values-pt_BR` (underscore) — invalid qualifier.

---

## Per-request / per-app locale

Don't set locale via deprecated `Configuration`/`Resources.updateConfiguration` hacks. To switch language
in-app, use AppCompat's per-app locale (AppCompat ≥ 1.6; backed by the system `LocaleManager` on API 33+):

```kotlin
AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags("es"))  // "" = follow system
```

Otherwise the app follows the device language automatically — no code needed.

---

## What NOT to wrap

Do not give these a `strings.xml` entry or a resource reference:

- **Non-user-facing strings** — `Log.*` / `println` messages, exception messages that never reach the UI,
  `BuildConfig`/constant values, analytics event names, `SharedPreferences` keys, intent action strings,
  database/column names, URL paths, MIME types, format patterns used internally.
- **`tools:` namespace attributes** — `tools:text`, `tools:hint`, sample data — design-time only, stripped
  from the build.
- **IDs / tags** — `android:id`, `android:tag`, and `contentDescription` set purely as a test hook.
- **`translatable="false"` keys** — already excluded from translation (often `app_name`, developer-only
  strings, machine patterns).
- **CSS-equivalent styling** — dimension/color/style resource values are not translatable text.
