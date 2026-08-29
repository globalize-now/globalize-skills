# Android String Resources — Conversion

Android-specific guidance for the convert phase: **finding hardcoded user-visible text and externalizing it to
`res/values/strings.xml`**. The per-edit authoring rules — positional args, native plurals, escaping,
`<xliff:g>`, what-not-to-wrap — live in the project's generated `.agents/globalize-rules.md` (rendered from
`android-strings.rules.template.md` in setup Step 6, and wired into `CLAUDE.md` and `AGENTS.md` there). This file is the
**mechanics of discovery and wrapping**.

Android is **key-authored, with no macro and no automated extractor**. Unlike Lingui/Paraglide (which extract
or compile from source), here you author the `<string>`/`<plurals>` entry into `strings.xml` by hand and
replace the literal with a resource reference.

---

## The discovery reality (honest assessment)

There is **no single tool** that finds all hardcoded strings in an Android app. Coverage splits by surface:

**Android Lint `HardcodedText` — XML layouts only.** Lint's `HardcodedText` check flags literal text in
`res/layout/**/*.xml` attributes (`android:text`, `android:hint`, `android:contentDescription`, etc.). It does
**NOT** inspect Kotlin/Java/Compose code. Run it via Gradle (needs the Android SDK):

```bash
./gradlew lint            # report includes HardcodedText for layout XML
# results: app/build/reports/lint-results-*.html (and .xml/.sarif)
```

**Kotlin / Java / Compose — grep-and-wrap (no cop).** There is no first-party check that flags literals passed
to `Text(...)`, `setText(...)`, `Toast.makeText(...)`, `Snackbar.make(...)`, builder `setTitle/setMessage`, or
exceptions surfaced to users. Discover them by grepping for string literals in UI code and wrapping manually.

> If the Android SDK / Gradle is unavailable (CI, non-Android agent), `./gradlew lint` cannot run — fall back
> to the grep passes below for **all** surfaces (including layouts) and note that Lint was skipped.

**Workflow: discover, then externalize.** Use Lint (when available) plus the greps below to find candidates,
then externalize each into `strings.xml` and replace with a resource reference. There is no extract/compile
step afterward — the verify phase only validates XML and locale coverage.

---

## Step 1: Discover hardcoded strings

### XML layouts / menus / preferences — Lint `HardcodedText`

```bash
./gradlew lint
```

Open `app/build/reports/lint-results-*.xml` and filter for `HardcodedText`. Each entry points at a
`res/layout|menu|xml/*.xml` attribute with a literal value. If Gradle is unavailable, grep instead:

```bash
# Layout/menu/xml attributes whose value is a literal, not @string/...
grep -rEn 'android:(text|hint|title|contentDescription|label|summary)="[^@]' \
  app/src/main/res/layout app/src/main/res/menu app/src/main/res/xml
```

### Kotlin / Java — grep for UI literals

```bash
# Common UI sinks taking a literal string (review each — not every literal is user-facing)
grep -rEn '\b(setText|setTitle|setMessage|setSummary|makeText|setContentDescription)\s*\(\s*"' \
  app/src/main/java app/src/main/kotlin
```

### Jetpack Compose — grep for literal text

```bash
# Composables that render a literal string argument
grep -rEn '\b(Text|OutlinedButton|Button|TextButton|TopAppBar|Label)\s*\(\s*"' \
  app/src/main/java app/src/main/kotlin
```

Review every hit against the **what-not-to-wrap** list (the generated coding rules) — tags, IDs, log messages,
`tools:` attributes, and test strings are not user-facing.

---

## Step 2: Externalize by location

For every confirmed user-visible literal: add a `<string>`/`<plurals>` entry to `res/values/strings.xml` with a
descriptive `name`, add a `<!-- -->` translator comment above it when the meaning isn't obvious, then replace
the literal with a resource reference.

### XML layouts / menus / preferences

```xml
<!-- before -->
<TextView android:text="No books found." />
<!-- after -->
<TextView android:text="@string/books_empty" />
```

```xml
<!-- res/values/strings.xml -->
<!-- Shown on the books list when the user has no books -->
<string name="books_empty">No books found.</string>
```

Attributes that take a string resource: `android:text`, `android:hint`, `android:contentDescription`,
`android:title`, `android:label`, `android:summary` (preferences), menu `android:title`.

### Kotlin / Java

```kotlin
// before
title.text = "Welcome"
toast = Toast.makeText(context, "Saved", Toast.LENGTH_SHORT)
greeting.text = "Hello, " + user.name + "!"      // never concatenate — bakes word order

// after
title.text = getString(R.string.welcome)
toast = Toast.makeText(context, getString(R.string.saved), Toast.LENGTH_SHORT)
greeting.text = getString(R.string.greeting, user.name)   // %1$s in the resource
```

```xml
<string name="welcome">Welcome</string>
<string name="saved">Saved</string>
<string name="greeting">Hello, <xliff:g id="name" example="Ada">%1$s</xliff:g>!</string>
```

`getString` is available on `Context`/`Activity`/`Fragment`; off the main `Context`, use
`context.getString(...)` or `resources.getString(...)`.

### Jetpack Compose

```kotlin
// before
Text("Welcome")
Text("Hello, ${user.name}!")

// after
Text(stringResource(R.string.welcome))
Text(stringResource(R.string.greeting, user.name))
```

`stringResource` / `pluralStringResource` are in `androidx.compose.ui.res`.

### Plurals

```kotlin
// Views/Kotlin
count.text = resources.getQuantityString(R.plurals.inbox_count, n, n)
// Compose
Text(pluralStringResource(R.plurals.inbox_count, n, n))
```

```xml
<plurals name="inbox_count">
    <item quantity="one">%1$d message</item>
    <item quantity="other">%1$d messages</item>
</plurals>
```

> Pass `count` **twice** to `getQuantityString`/`pluralStringResource`: once to select the category, once to
> fill `%1$d`. Never pick between two `getString` calls with an `if (n == 1)` — that breaks languages with more
> than two plural forms.

---

## Step 3: Interpolation, escaping, do-not-translate

Full rules in the generated `.agents/globalize-rules.md` — apply them while wrapping, don't re-derive per
string. Quick reference:

- **Interpolation:** positional `%1$s` (string), `%1$d` (int), `%1$f` (float). Multiple args **must** be
  positional. Fill at the call site (`getString(R.string.x, a, b)` / `stringResource(R.string.x, a, b)`).
- **Do-not-translate runs:** wrap brand names, codes, URLs, and the literal placeholder in
  `<xliff:g id="…" example="…">%1$s</xliff:g>` so the translator leaves them intact (declare
  `xmlns:xliff="urn:oasis:names:tc:xliff:document:1.2"` on `<resources>`).
- **Escaping:** apostrophe → `\'` or wrap value in `"…"`; `\"`; `&amp;`/`&lt;`; escape a leading `@`/`?`. HTML
  via `<![CDATA[…]]>` or the supported inline tags (`<b>`, `<i>`, `<u>`).
- **Not translatable:** `<string name="x" translatable="false">…</string>` keeps a key out of translation
  (Lint `MissingTranslation` then won't demand it in other locales).

---

## Convert hand-rolled formatting

Externalizing a string makes it **translatable**; it does not make a number, a price or a date **render
correctly**. `$1,234.50` stays `$1,234.50` for a German reader who expects `1.234,50 $`, however good the
translation around it is. This pass routes hand-rolled formatting through the `Formatters` object Phase 2
created (`generate_format_helpers`) — it already exists, so you are rewriting call sites, not authoring it.

Its fully-qualified name is whatever `.agents/globalize-rules.md` states (e.g.
`com.example.myapp.i18n.Formatters`); import it and call the members bare. The ten: `money`, `number`,
`percent`, `compact`, `unit`, `date`, `time`, `dateTime`, `relativeTime`, `list`.

| Found | Replace with |
|---|---|
| `SimpleDateFormat("MM/dd/yyyy")`, `DateTimeFormatter.ofPattern("…")` at a call site | `Formatters.date(value)` — or `dateTime` / `time` when the pattern carried a time |
| `String.format("%.2f", x)` in user-visible text | `Formatters.money(x)` when it is a price, `Formatters.number(x)` otherwise |
| `"$" + amount` (Java), `"\$$amount"` / `"${'$'}$amount"` (Kotlin) | `Formatters.money(amount)` |
| `DecimalFormat("#,##0.00").format(x)`, `NumberFormat.getInstance().format(x)` at a call site | `Formatters.number(x)` |
| `"${(a * 100).toInt()}%"` | `Formatters.percent(a)` — the helper takes a **ratio**, not an already-multiplied percentage |
| `DateUtils.getRelativeTimeSpanString(...)`, a hand-built `"3 days ago"` | `Formatters.relativeTime(millis)` |
| `items.joinToString(", ")` in user-visible copy | `Formatters.list(items)` (`list(items, "or")` for a disjunction) |
| `"${n / 1000}K"` | `Formatters.compact(n)` |
| `"$value km"` | `Formatters.unit(value, "km")` |

**The resource-placeholder rule.** A `<string>` body may hold `%1$d` or `%1$f`, which makes Android
format the number with the **system** locale and no project options — losing the currency, the grouping
and the seam. Format the value first and pass the **string**: change the resource to `%1$s` and the call
site to `getString(R.string.total, Formatters.money(cents))`. Compose is the same:
`stringResource(R.string.total, Formatters.money(cents))`.

**Never inline a formatted number into a layout XML attribute.** `android:text` takes a literal or a
`@string/` reference; a formatted value must be set from code (`textView.text = …`) or passed as a
`stringResource` argument in Compose.

**Rewrite the helper, not its call sites.** A project with its own `formatPrice(cents)` used in thirty
places should have *that function* delegate to `Formatters.money` — a thirty-file diff for the same
result is worse.

### What NOT to convert

Locale formatting in machine-readable output is a **bug**, not a fix. Leave alone: `Log.*` and crash
reporting; IDs, filenames, cache keys, SharedPreferences keys, Room column values; JSON/protobuf bodies
and every Retrofit/Moshi/Gson serializer; anything compared against a literal or parsed back; test
fixtures; **any date going into an ISO-8601 field** (`Instant.toString()`, `DateTimeFormatter.ISO_*` —
both must stay); values that round-trip through an input field; and the `Formatters` file itself, which
constructs formatters on purpose. When in doubt whether a value is user-visible, leave it and record it.

### Ordering

Convert formatting **after** externalizing the strings in the same file. A formatted value usually ends
up as a positional argument inside an externalized message, and the placeholder rules above apply to it.
Format the value, then pass the result — and never split a sentence to isolate a number:
`getString(R.string.cart_total, Formatters.money(x))` is one message; `"Total: " + Formatters.money(x)`
is a fragment no translator can reorder.

### What this pass does not remove

Leave date/time libraries (ThreeTenABP, Joda-Time) in place. Convert their **display formatting** only;
leave parsing, arithmetic (`plusDays`), and timezone conversion as written. Do not edit
`build.gradle{,.kts}`. Record what you left, with file and line.

### Progress reporting

Same atomic-write protocol as the wrap pass. Under each file's entry record `formatSitesConverted` (how
many call sites, to which member) and `formatSitesFlagged` (each site left, with a one-line reason). A
file in scope for `formatting` that needed no change still gets a zero-conversion entry.

---

## Step 4: Verify

There is **no extract or compile step**. The verify gate is catalog integrity:

1. **XML validity** — every `res/values/strings.xml` and `res/values-*/strings.xml` is well-formed (no
   unescaped `&`/`'`, no broken tags).
2. **Locale coverage** — each target `res/values-<qualifier>/strings.xml` defines every `name` (and every
   `<plurals>` group) present in the source.
3. **Lint (if the Android SDK is available):**
   ```bash
   ./gradlew lint   # surfaces MissingTranslation, ExtraTranslation, ImpliedQuantity, HardcodedText
   ```
   `MissingTranslation` = a source key absent from a target locale; `ExtraTranslation` = a key in a target that
   isn't in the source. **If Gradle/SDK is absent, skip Lint and rely on steps 1-2** (note it was skipped).

---

## Do-not-touch

Do not externalize or wrap these:

- **Non-user-facing strings** — `Log.*` / `println` messages, exception messages that never reach the UI,
  `BuildConfig`/constant values, analytics event names, `SharedPreferences` keys, intent action strings,
  database/column names, URL paths, MIME types.
- **`tools:` namespace attributes** — `tools:text`, `tools:hint` are design-time placeholders stripped from the
  build; never localized.
- **Test resources** — `androidTest`/`test` source sets, `tools:` sample data, `@string/` already-referenced
  values.
- **IDs and view tags** — `android:id`, `android:tag`, `contentDescription` set purely for test hooks.
- **`translatable="false"` keys** — already marked do-not-translate (often `app_name`, format patterns,
  developer-only strings).

---

## After conversion

With XML valid, every locale covered, and `./gradlew lint` clean (where available):

1. Spot-check that converted screens render correctly in the source locale.
2. If you have instrumentation/Robolectric tests asserting on UI text, run them.
3. Proceed to the connect phase — point Globalize at `app/src/main/res/values/strings.xml` with
   `fileFormat: android-strings`; the handler discovers target locales from the `values-<qualifier>` dirs (no
   `{locale}` filename token).
