# Android String Resources — Setup

Android ships localization built into the platform — there is **nothing to install**. The framework
loads `res/values/strings.xml` (the locale-less default / source) and overlays `res/values-<qualifier>/strings.xml`
per locale at runtime, selecting the right one from the device (or per-app) locale. Code reads strings via
`getString(R.string.key)` / `stringResource(R.string.key)` and plurals via
`getQuantityString` / `pluralStringResource`. This setup phase creates the source catalog, scaffolds the
target-locale resource dirs, optionally wires per-app language selection, and installs the coding rules.

The emitted resource XML is **identical across all Android API levels** — string resources have been stable
since API 1, so there are **no version-gated branches**. The only API-gated features touched here — the `b+`
locale-qualifier directory form (API 24+) and per-app language (API 33+ / AppCompat 1.6) — are **optional
add-ons**, never required.

Follow these steps in order. Each builds on the last.

---

## Out of Scope

This setup phase covers **native Android** apps (Kotlin and/or Java, Views and/or Jetpack Compose) using
**`res/values/strings.xml`** resources. It does **not** cover:

- **React Native, Capacitor, Cordova, Ionic** (and other JS/web wrappers) — these ship a native `android/`
  folder but localize their UI in the JavaScript layer; their `strings.xml` holds only `app_name`. **Routed to
  the JS path / hard-stopped in the orchestrator** (`SKILL.md §1.2`). Run globalize-guide against the web UI.
- **Flutter** — localizes via `.arb` files and `gen_l10n`, not native `strings.xml`. **Hard stop.**
- **Kotlin / Compose Multiplatform** — uses a different resource mechanism (`compose.resources`,
  `commonMain/composeResources/`), not `res/values/strings.xml`. **Not covered in v1** (warned, non-blocking).
- **Model/DB-content translation** — translating per-row database content is an app-data concern, unrelated to
  UI-string resources and to Globalize.now. Not handled here.
- **Converting existing hardcoded strings** — handled by the convert phase (`android-strings.convert.md`).
  This setup phase only scaffolds infrastructure.

---

### Step Risk Classification

| Step | Risk | Notes |
|------|------|-------|
| 1. Detect | Read-only | No changes to the project |
| 2. (No install) | None | String resources are platform-built-in — nothing to add |
| 3. Source catalog `res/values/strings.xml` | Additive | New/edited source file; if one exists, augment, don't clobber |
| 4. Scaffold `res/values-<qualifier>/` | Additive | New per-locale `strings.xml`; does not touch existing locale dirs |
| 5. Locale-selection wiring (optional) | **Modifies existing files** | Per-app language: manifest + `build.gradle` + an Activity/Application call — describe and confirm |
| Format helpers | Additive | Creates `Formatters.kt`; may add `<plurals>`/`<string>` fallback resources to `res/values/strings.xml` — **always runs**, feeds Step 6 |
| 6. Generate + wire coding rules | Additive (+ edits `CLAUDE.md` / `AGENTS.md`) | Writes `.agents/globalize-rules.md` via `setup.add-ons.md` and points `CLAUDE.md` and `AGENTS.md` at it — **always runs**, Phase 3 wraps against it |

**RULE: Steps that modify existing files require you to describe the exact change to the user and get
confirmation before proceeding. Do NOT silently modify existing project files.** _(Modified by the setup mode
chosen below.)_

---

## Setup Mode

After Step 1 (detection) completes without blockers, ask the user:

> **How would you like to proceed with the setup?**
> 1. **Guided** — I'll explain each step before and after, and you'll confirm changes to existing files.
> 2. **Unguided** — I'll run all steps without pausing and show a full summary at the end. Optional steps
>    (per-app language) will be **off by default** — tell me now if you want them on.

### Guided mode rules
- **Before each step**: briefly explain what will happen and why.
- **After each step**: summarize what changed (files created, files modified).
- Consent gates for "Modifies existing file" steps still apply.
- Optional steps still prompt the user.

### Unguided mode rules
- Execute all steps without pausing for per-step explanations or confirmations.
- Consent gates for "Modifies existing file" steps are **suspended**.
- Hard stops (Step 1 incompatibility checks) still halt execution.
- "MUST wait for the user" lines are **overridden** by the unguided-defaults table below when a default exists.
- Per-app language (Step 5) is **off by default** in unguided mode (it changes runtime behavior) — include it
  only if the user asked.
- At the end, produce a `## Setup Complete` summary (what was done / files created / files modified / defaults
  applied / next steps), matching the shape used by the other setup references.

#### Unguided defaults

| Choice | Unguided default | Rationale |
|--------|------------------|-----------|
| **Module / `res/` root** | `app/src/main/res` | The standard single-module app layout |
| **Source locale** | The app's existing default (`res/values/strings.xml`); name it `en` if unset | `values/` (no qualifier) is the source by definition |
| **Target locales** | User-specified if given; otherwise one locale, `es` | One additional locale validates the pipeline |
| **Locale-qualifier form** | Legacy form (`values-es`, `values-pt-rBR`) | Maximum compatibility; the handler also accepts `b+` |
| **Per-app language** | **Off** | Behavior change; opt-in only |

---

## Step 1: Detect the Project

Read `AndroidManifest.xml`, the Gradle build files (`build.gradle` / `build.gradle.kts`, `settings.gradle*`),
and the resource tree to determine the project shape.

| Signal | How to detect |
|--------|--------------|
| **Native Android** | `AndroidManifest.xml` present, OR a `build.gradle{,.kts}` applying `com.android.application` / `com.android.library`; `gradlew` / `settings.gradle*` present |
| **Module / `res/` root** | The module applying `com.android.application` — its `src/main/res`. Default `app/src/main/res`. Note multi-module (`feature/src/main/res`) and flavor (`src/<flavor>/res`) layouts |
| **UI toolkit** | `androidx.compose` / `kotlin-compose` plugin or `@Composable` in source → **Compose**; `res/layout/*.xml` + `findViewById`/view binding → **Views**. Both can coexist |
| **Language** | `*.kt` → Kotlin; `*.java` → Java; both can coexist |
| **AppCompat present** | `androidx.appcompat:appcompat` in a `build.gradle` (gates the backported per-app-language API in Step 5) |
| **AGP version** | The `com.android.application` plugin version in `build.gradle`/`libs.versions.toml` (AGP 8.1+ enables `generateLocaleConfig`) |
| **Source catalog** | `<module>/res/values/strings.xml` |
| **Existing locales** | Glob `<module>/res/values-*/strings.xml`; parse the dir qualifier (legacy `values-pt-rBR` or BCP47 `values-b+sr+Latn`) |
| **Existing per-app language** | `android:localeConfig` in manifest + `res/xml/locales_config.xml`, and/or `setApplicationLocales(` in source |
| **Git repository / branch** | `git rev-parse --is-inside-work-tree`; `git branch --show-current` |

### Incompatibility Checks

**If any check below says STOP, you MUST stop and tell the user. Do NOT proceed.**

| Check | How to detect | Action |
|-------|--------------|--------|
| **React Native** | `react-native` in a root `package.json` (with an `android/` folder) | **STOP.** "This is a React Native app. It localizes through JS i18n libraries (i18next/react-intl/Lingui), not native `strings.xml`. Run globalize-guide against the JS code." |
| **Capacitor/Cordova/Ionic** | `@capacitor/core` / `cordova` / `@ionic/*` in a root `package.json` (with an `android/` folder) | **STOP.** "This is a hybrid web app — its UI is localized in the web layer, not native `strings.xml`. Run globalize-guide against the web UI." |
| **Flutter** | `pubspec.yaml` at root | **STOP.** "This is a Flutter app. Flutter localizes via `.arb`/`gen_l10n`, not native Android `strings.xml`. Flutter support isn't available yet." |
| **Not an Android project** | No `AndroidManifest.xml` and no Android Gradle plugin | **STOP.** "No native Android project detected. This setup phase requires an Android app (Gradle + `AndroidManifest.xml`)." |
| **Compose/Kotlin Multiplatform** | Resources under `commonMain/composeResources/`, a `compose.resources` setup, and no `app/src/main/res` | **Warn (non-blocking).** "This looks like a Multiplatform project, which uses `compose.resources` rather than `res/values/strings.xml`. v1 covers standard Android only — I'll target the Android resource dirs I can find; multiplatform resources won't be handled." |

### No Version Warning

Unlike Rails (soft EOL warning) and the JS frameworks (version-gated branches), Android emits **no version
warning** — string resources are identical across all API levels and there is no version-gated emission.

### Branch Recommendation

If the project is a git repo and the current branch is `main`, `master`, or `develop`, recommend a dedicated
branch (`git checkout -b chore/i18n-setup`) before modifying files, as the other setup references do. Skip
silently on a feature branch or no git repo.

If no blockers, proceed to the **Setup Mode** prompt before Step 3.

---

## Step 2: No Install

There is **no package to install**. String-resource localization, CLDR plural selection, and locale resource
resolution are all part of the Android framework. (The optional per-app-language backport in Step 5 uses
`androidx.appcompat:appcompat` ≥ 1.6, which most apps already depend on — add it only if Step 5 is selected and
it is missing.) The orchestrator's Phase 2.0 install step is a no-op for Android.

---

## Step 3: Create / Populate the Source Catalog

The source catalog is the locale-less `<module>/res/values/strings.xml`. Its `name` attributes are the keys;
its element text is the source-language value.

**Additive** — if `res/values/strings.xml` already exists, inspect it and augment; do **not** overwrite real
entries. Globalize keys off a populated source file, so ensure it has real entries before connecting in Phase 4.

```xml
<!-- app/src/main/res/values/strings.xml -->
<resources xmlns:xliff="urn:oasis:names:tc:xliff:document:1.2">
    <string name="app_name">My App</string>
    <string name="greeting">Hello, <xliff:g id="name" example="Ada">%1$s</xliff:g>!</string>
    <string name="action_save">Save</string>

    <plurals name="inbox_count">
        <item quantity="one">%1$d message</item>
        <item quantity="other">%1$d messages</item>
    </plurals>

    <string-array name="weekdays">
        <item>Monday</item>
        <item>Tuesday</item>
    </string-array>
</resources>
```

Notes (full rules land in the project's generated `.agents/globalize-rules.md` — see Step 6):
- **Interpolation is positional** — `%1$s` (string), `%1$d` (int). Always positional so translators can
  reorder. Wrap a do-not-translate run in `<xliff:g>` (requires the `xmlns:xliff` declaration on `<resources>`).
- **Plurals** use native `<plurals>` with CLDR `quantity` categories (`zero/one/two/few/many/other`) — **not
  ICU**. Always include `other` (the required fallback). The framework selects the form from the `:count`
  passed at the call site (`getQuantityString` / `pluralStringResource`).
- **Escaping** — apostrophes must be `\'` (or wrap the whole value in `"…"`); `\"` for quotes; `&amp;`/`&lt;`
  for `&`/`<`; escape a leading `@`/`?`. Mark non-translatable keys `translatable="false"`.

---

## Step 4: Scaffold Target-Locale Resource Dirs

For each target locale, create `<module>/res/values-<qualifier>/strings.xml` mirroring the source keys. **Leave
values empty or copy the source as placeholders** — Globalize or translators fill them.

**Locale-qualifier directory forms** (the `android-strings` Globalize handler ingests both and normalizes ⇄
BCP47, so pick whichever matches the project's existing dirs):
- **Legacy form** — `values-es`, `values-fr`, region with lowercase-`r`: `values-pt-rBR`, `values-zh-rTW`.
- **BCP47 `b+` form** (API 24+) — `values-b+es+419`, `values-b+sr+Latn`, `values-b+zh+Hant+TW`. Required for
  script subtags; not understood by API < 24.

Default to the **legacy form** unless the project already uses `b+` or a target needs a script subtag.

```xml
<!-- app/src/main/res/values-es/strings.xml -->
<resources xmlns:xliff="urn:oasis:names:tc:xliff:document:1.2">
    <string name="app_name">Mi App</string>
    <string name="greeting">Hola, <xliff:g id="name" example="Ada">%1$s</xliff:g>!</string>
    <string name="action_save">Guardar</string>

    <plurals name="inbox_count">
        <item quantity="one">%1$d mensaje</item>
        <item quantity="other">%1$d mensajes</item>
    </plurals>
</resources>
```

> When a target language has more plural categories than English (Russian/Polish/Arabic/Czech/…), include all
> the CLDR `quantity` items that language needs (`zero/one/two/few/many/other` as applicable) — `other` always.
> `app_name` is often `translatable="false"`; do not scaffold it into target locales if so.

---

## Step 5: Locale-Selection Wiring (Optional)

By default Android picks the resource locale from the **device** language. Two ways to let the user pick a
language **inside the app**:

### Option A — Per-app language (recommended; API 33+ with an AppCompat backport)

`AppCompatDelegate.setApplicationLocales` (AppCompat ≥ 1.6) sets a per-app locale that persists across
restarts. On **API 33+** it delegates to the system `LocaleManager` (and surfaces the app in system Settings →
App languages); on older APIs AppCompat stores and applies it itself.

1. Ensure `androidx.appcompat:appcompat:1.6.0+` is a dependency (add it if Step 5 is selected and it is missing
   — this is the one allowed install, flagged to the orchestrator as an extra).
2. Declare the supported locales so the system language picker can list them. **AGP 8.1+ / Android Studio
   Giraffe** can generate the locale config automatically from your `values-*` dirs:

   ```kotlin
   // build.gradle.kts (app module)
   android {
       androidResources {
           generateLocaleConfig = true   // AGP 8.1+
       }
   }
   ```

   The auto-gen path also needs `res/values/resources.properties` declaring the default locale:

   ```properties
   # res/values/resources.properties
   unqualifiedResLocale=en-US
   ```

   **Do not also hand-author a locale-config file when `generateLocaleConfig = true` — the build will fail.**

   For **AGP < 8.1**, author `res/xml/locale_config.xml` by hand and reference it from the manifest (the
   filename is your choice — it's referenced by `@xml/<name>`; `locale_config.xml` matches Android's docs):

   ```xml
   <!-- res/xml/locale_config.xml -->
   <locale-config xmlns:android="http://schemas.android.com/apk/res/android">
       <locale android:name="en"/>
       <locale android:name="es"/>
   </locale-config>
   ```

   ```xml
   <!-- AndroidManifest.xml -->
   <application android:localeConfig="@xml/locale_config" ...>
   ```

3. Set the locale from a language picker:

   ```kotlin
   AppCompatDelegate.setApplicationLocales(
       LocaleListCompat.forLanguageTags("es")  // or "" to follow the system
   )
   ```

### Option B — Device language only (no wiring)

Do nothing in-app — the app follows the device language. This is the zero-config default; document it and skip
Step 5 if the user doesn't want an in-app switcher.

**This step modifies `AndroidManifest.xml`, a `build.gradle`, and a source file.** In guided mode, describe each
change and get confirmation. Off by default in unguided mode.

---

## Format helpers (`generate_format_helpers`)

`java.text.NumberFormat` and `java.time.format.DateTimeFormatter` already read whatever locale you hand them,
but nothing routes currency correctly by default, and every screen that formats a number, a date, or a list has
to remember the right class and the right options each time. This step creates one small class, `Formatters`,
that gives every formatting concern a single method — plus a Compose `CompositionLocal` so components don't have
to thread a `Context` through to reach it.

**Always runs**, on every project — like Steps 2–5, it does not wait for a `SKILL.md §1.10` selection. Phase 3's
wrap subagents route every hardcoded number, currency, date, and list through this class's ten methods.

### Read `minSdk` and resolve the API-level branches

Read `minSdk` (or `minSdkVersion`) from the module's `build.gradle` / `build.gradle.kts` (`defaultConfig { minSdk
= N }`, or a version-catalog alias), and whether core library desugaring is enabled in `compileOptions`
(`isCoreLibraryDesugaringEnabled = true` in the Kotlin DSL, `coreLibraryDesugaringEnabled true` in Groovy). This
value decides which branches `Formatters.kt` takes below — resolve it before writing the file.

If `minSdk` cannot be read, write `status: "needs_decision"` with:

```json
{ "step": "format_module_min_sdk",
  "question": "Could not read minSdk from build.gradle — which API level does this module target?",
  "options": ["21", "24", "26", "34"] }
```

and stop.

`date`/`time`/`dateTime` use `java.time` unconditionally — see "The API-level floors" below for why that's safe
even on a low `minSdk`. If `minSdk` is below the `java.time` floor (API 26) **and** core library desugaring is
**not** enabled, do not emit the file: write `status: "needs_decision"` with:

```json
{ "step": "format_module_desugaring",
  "question": "date/time formatting uses java.time, which needs core library desugaring at this minSdk. Enable coreLibraryDesugaring, or fall back to java.text.DateFormat?",
  "options": ["enable_desugaring", "use_dateformat"] }
```

and stop.

### The API-level floors (verified, not recalled — re-check before reusing years from now)

Four numbers below are load-bearing: get one wrong and the emitted code either wastes a branch that never
protects anything (a floor set too high) or crashes on real devices (a floor set too low). Each was checked
directly against the Android platform reference on **2026-08-22** (each page's own
"Added in API level" annotation, cross-checked against a second independent source since `developer.android.com`
is a JS-rendered SPA that doesn't always yield the annotation to a page fetch):

| Constant | Class / member | API level | Source |
|---|---|---|---|
| `COMPACT_API` | `android.icu.text.CompactDecimalFormat` | **24** | https://developer.android.com/reference/android/icu/text/CompactDecimalFormat |
| `RELATIVE_API` | `android.icu.text.RelativeDateTimeFormatter` | **24** | https://developer.android.com/reference/android/icu/text/RelativeDateTimeFormatter |
| `LIST_API` | `android.icu.text.ListFormatter` | **26** | https://developer.android.com/reference/android/icu/text/ListFormatter |
| `LOCALE_LIST_API` | `android.os.LocaleList` / `Configuration.getLocales()` | **24** | https://developer.android.com/reference/android/os/LocaleList |

`java.time` itself (`LocalDate`, `DateTimeFormatter`, …) is a **platform** package starting at **API 26** —
https://developer.android.com/reference/java/time/LocalDate. Below API 26 it is available only through **core
library desugaring** (Android Gradle Plugin's D8 desugaring, via the `coreLibraryDesugaring` dependency), which
has **no `minSdk` floor of its own** —
https://developer.android.com/studio/write/java8-support: "Android Studio ... includes support for using a
number of Java 8+ APIs without requiring a minimum API level for your app." (MultiDex is required in addition
when `minSdk` ≤ 20, which is unrelated to desugaring itself.) This is why the `date`/`time`/`dateTime` methods
below use `java.time` unconditionally rather than a `Build.VERSION.SDK_INT` branch: on `minSdk` ≥ 26 it's the
platform API, below that the "needs_decision" gate above guarantees desugaring is on before the file is ever
written.

`LOCALE_LIST_API` is not one of the three constants the design named, but it gates the exact same class of bug:
`Configuration.getLocales()` — what `context.resources.configuration.locales[0]` compiles to — does not exist
below API 24; only the deprecated singular `Configuration.locale` field does. Shipping `formatLocale()`
unguarded, as a naive reading of "read the locale off `context.resources.configuration`" suggests, would crash
on every device below API 24. The Kotlin below branches on it exactly like the other three.

### The Kotlin module

Create `Formatters.kt` under this module's source set — `<module>/src/main/java/<packagePath>/i18n/` in the
default Android Studio layout, or `<module>/src/main/kotlin/<packagePath>/i18n/` if this module declares a
Kotlin-only source set (check `build.gradle` for a `sourceSets { main { kotlin.srcDirs ... } }` block, or
whether `src/main/kotlin/` already exists on disk). `<packagePath>` is this module's Kotlin package with dots
replaced by `/` — the `namespace` in `android {}` (AGP 7+) if declared, otherwise `applicationId`; the two are
not always the same once flavors are involved, so check `build.gradle` rather than assuming.

```kotlin
// Formatters.kt
package <applicationId>.i18n

import <applicationId>.R
import android.content.Context
import android.content.res.Configuration
import android.icu.text.CompactDecimalFormat
import android.icu.text.ListFormatter
import android.icu.text.RelativeDateTimeFormatter
import android.os.Build
import androidx.compose.runtime.compositionLocalOf
import java.text.NumberFormat
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.time.temporal.TemporalAccessor
import java.util.Currency
import java.util.Locale
import kotlin.math.abs
import kotlin.math.round

class Formatters(private val locale: Locale, private val context: Context) {

    companion object {
        const val DEFAULT_CURRENCY = "USD" // adjust to this project's currency

        // See "The API-level floors" above for the source and check date on each of these.
        private const val COMPACT_API = 24     // android.icu.text.CompactDecimalFormat
        private const val RELATIVE_API = 24    // android.icu.text.RelativeDateTimeFormatter
        private const val LIST_API = 26        // android.icu.text.ListFormatter
        private const val LOCALE_LIST_API = 24 // android.os.LocaleList / Configuration.getLocales()

        private val RELATIVE_UNITS: List<Pair<RelativeDateTimeFormatter.RelativeUnit, Long>> = listOf(
            RelativeDateTimeFormatter.RelativeUnit.SECONDS to 1_000L,
            RelativeDateTimeFormatter.RelativeUnit.MINUTES to 60_000L,
            RelativeDateTimeFormatter.RelativeUnit.HOURS to 3_600_000L,
            RelativeDateTimeFormatter.RelativeUnit.DAYS to 86_400_000L,
            RelativeDateTimeFormatter.RelativeUnit.WEEKS to 604_800_000L,
            RelativeDateTimeFormatter.RelativeUnit.MONTHS to 2_629_746_000L,
            RelativeDateTimeFormatter.RelativeUnit.YEARS to 31_556_952_000L,
        )

        /**
         * THE SEAM. Formatting follows the UI locale today. To give this app a separate
         * regional preference, change this function — both overloads below route through it.
         */
        fun formatLocale(configuration: Configuration): Locale =
            if (Build.VERSION.SDK_INT >= LOCALE_LIST_API) {
                configuration.locales[0]
            } else {
                @Suppress("DEPRECATION")
                configuration.locale
            }

        fun formatLocale(context: Context): Locale = formatLocale(context.resources.configuration)

        /**
         * Views/Activities/Fragments. Pass an Activity (or a View's) context — never
         * `applicationContext`. See the per-app-language note in this project's generated
         * `.agents/globalize-rules.md` if this project has an in-app language picker: below
         * API 33, `applicationContext` silently returns the system locale, not the user's
         * per-app choice.
         */
        fun of(context: Context): Formatters = Formatters(formatLocale(context), context)
    }

    fun money(amount: Number, currency: String = DEFAULT_CURRENCY): String {
        val isoCurrency = try {
            Currency.getInstance(currency)
        } catch (e: IllegalArgumentException) {
            // Fail loud, not wrong: silently substituting DEFAULT_CURRENCY here would
            // display the wrong amount's currency with no signal anything was off.
            throw IllegalArgumentException(
                "Formatters.money(): '$currency' is not a valid ISO 4217 currency code — " +
                    "validate currency data at its source; do not catch this and substitute a default.",
                e,
            )
        }
        return NumberFormat.getCurrencyInstance(locale).apply { this.currency = isoCurrency }.format(amount)
    }

    fun number(value: Number): String = NumberFormat.getInstance(locale).format(value)

    fun percent(value: Number): String = NumberFormat.getPercentInstance(locale).format(value)

    fun compact(value: Number): String =
        if (Build.VERSION.SDK_INT >= COMPACT_API) {
            CompactDecimalFormat
                .getInstance(locale, CompactDecimalFormat.CompactStyle.SHORT)
                .format(value)
        } else {
            number(value) // no compact notation below COMPACT_API — still locale-correct
        }

    fun unit(value: Number, unit: String): String = "${number(value)} $unit"

    fun date(value: TemporalAccessor, preset: FormatStyle = FormatStyle.MEDIUM): String =
        DateTimeFormatter.ofLocalizedDate(preset).withLocale(locale).format(value)

    fun time(value: TemporalAccessor): String =
        DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT).withLocale(locale).format(value)

    fun dateTime(value: TemporalAccessor): String =
        DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT)
            .withLocale(locale).format(value)

    fun relativeTime(value: Long, now: Long = System.currentTimeMillis()): String {
        val (unit, amount) = pickRelativeUnit(value - now)
        return if (Build.VERSION.SDK_INT >= RELATIVE_API) {
            RelativeDateTimeFormatter.getInstance(locale).format(
                amount.toDouble(),
                if (amount < 0) RelativeDateTimeFormatter.Direction.LAST
                else RelativeDateTimeFormatter.Direction.NEXT,
                unit,
            )
        } else {
            // Below RELATIVE_API: same unit selection, rendered through a <plurals>
            // resource so it stays translatable. Never a hardcoded "n days ago".
            relativeFallback(unit, amount)
        }
    }

    fun list(items: List<String>, type: String = "and"): String =
        if (Build.VERSION.SDK_INT >= LIST_API) {
            ListFormatter.getInstance(locale).format(items)
        } else {
            // Below LIST_API: the locale's own connectors, from string resources.
            joinWithResourceConnectors(items, type)
        }

    /** Largest unit whose magnitude is at least 1; falls back to seconds. */
    private fun pickRelativeUnit(deltaMs: Long): Pair<RelativeDateTimeFormatter.RelativeUnit, Long> {
        val magnitude = abs(deltaMs)
        for (i in RELATIVE_UNITS.indices.reversed()) {
            val (unit, ms) = RELATIVE_UNITS[i]
            if (magnitude >= ms || i == 0) return unit to round(deltaMs.toDouble() / ms).toLong()
        }
        return RelativeDateTimeFormatter.RelativeUnit.SECONDS to 0L
    }

    /**
     * Below RELATIVE_API. Reads one <plurals> per unit+direction from this project's own
     * resources, so the result pluralizes per CLDR and stays translatable — never a
     * hardcoded "$n days ago". Scaffolded into res/values/strings.xml — see below.
     */
    private fun relativeFallback(unit: RelativeDateTimeFormatter.RelativeUnit, amount: Long): String {
        val n = abs(amount).toInt()
        val past = amount < 0
        val res = when (unit) {
            RelativeDateTimeFormatter.RelativeUnit.SECONDS ->
                if (past) R.plurals.relative_seconds_ago else R.plurals.relative_seconds_from_now
            RelativeDateTimeFormatter.RelativeUnit.MINUTES ->
                if (past) R.plurals.relative_minutes_ago else R.plurals.relative_minutes_from_now
            RelativeDateTimeFormatter.RelativeUnit.HOURS ->
                if (past) R.plurals.relative_hours_ago else R.plurals.relative_hours_from_now
            RelativeDateTimeFormatter.RelativeUnit.DAYS ->
                if (past) R.plurals.relative_days_ago else R.plurals.relative_days_from_now
            RelativeDateTimeFormatter.RelativeUnit.WEEKS ->
                if (past) R.plurals.relative_weeks_ago else R.plurals.relative_weeks_from_now
            RelativeDateTimeFormatter.RelativeUnit.MONTHS ->
                if (past) R.plurals.relative_months_ago else R.plurals.relative_months_from_now
            else -> // YEARS
                if (past) R.plurals.relative_years_ago else R.plurals.relative_years_from_now
        }
        return context.resources.getQuantityString(res, n, n)
    }

    /**
     * Below LIST_API. Joins using this project's own connector string resources — never
     * a hardcoded ", " / " and ". Scaffolded into res/values/strings.xml — see below.
     */
    private fun joinWithResourceConnectors(items: List<String>, type: String): String {
        if (items.isEmpty()) return ""
        if (items.size == 1) return items[0]
        val twoWords = context.getString(
            if (type == "or") R.string.list_two_words_connector_or else R.string.list_two_words_connector
        )
        if (items.size == 2) return items[0] + twoWords + items[1]
        val lastWord = context.getString(
            if (type == "or") R.string.list_last_word_connector_or else R.string.list_last_word_connector
        )
        val wordsConnector = context.getString(R.string.list_words_connector)
        return items.dropLast(1).joinToString(wordsConnector) + lastWord + items.last()
    }
}

val LocalFormatters = compositionLocalOf<Formatters> {
    error("LocalFormatters not provided — wrap your content in CompositionLocalProvider")
}
```

**Why the constructor takes a `Context`, not just a `Locale`.** The brief-level sketch of this class carries
only a `Locale`; that is not enough to implement `relativeFallback` / `joinWithResourceConnectors`, both of
which must read this project's own `<plurals>` / `<string>` resources. Reusing the same `Context` that
`formatLocale()` already reads keeps the resources and the locale in agreement by construction — `of(context)`
derives both from the one context it was given, so there is never a mismatch between "which locale `Formatters`
thinks it's in" and "which locale the fallback strings are read from." `Formatters` instances are cheap —
construct one per call site or per composition; do not cache one in a `ViewModel` or a singleton across
configuration changes, which would pin whatever `Context` (and locale) built it past that context's lifetime.

**Only scaffold the fallback resources this project actually needs**, gated on `minSdk` against the constant
that guards each one:

- `minSdk < RELATIVE_API` (24) — scaffold the 14 `<plurals>` below (7 units × ago/from-now).
- `minSdk < LIST_API` (26) — scaffold the 5 connector `<string>`s below.
- **If `minSdk` is at or above the relevant constant, skip that scaffold** — the `Build.VERSION.SDK_INT` branch
  in `Formatters.kt` stays (it's free, and survives a later `minSdk` drop), but the fallback resources would be
  dead code no path ever reaches. Say so plainly in the end-of-run summary: "Skipped relative-time fallback
  plurals — minSdk N ≥ 24 already covers RelativeDateTimeFormatter unconditionally" (and the equivalent for the
  list connectors against 26).

```xml
<!-- res/values/strings.xml — only if minSdk < RELATIVE_API (24) -->
<plurals name="relative_seconds_ago">
    <item quantity="one">%1$d second ago</item>
    <item quantity="other">%1$d seconds ago</item>
</plurals>
<plurals name="relative_seconds_from_now">
    <item quantity="one">in %1$d second</item>
    <item quantity="other">in %1$d seconds</item>
</plurals>
<plurals name="relative_minutes_ago">
    <item quantity="one">%1$d minute ago</item>
    <item quantity="other">%1$d minutes ago</item>
</plurals>
<plurals name="relative_minutes_from_now">
    <item quantity="one">in %1$d minute</item>
    <item quantity="other">in %1$d minutes</item>
</plurals>
<plurals name="relative_hours_ago">
    <item quantity="one">%1$d hour ago</item>
    <item quantity="other">%1$d hours ago</item>
</plurals>
<plurals name="relative_hours_from_now">
    <item quantity="one">in %1$d hour</item>
    <item quantity="other">in %1$d hours</item>
</plurals>
<plurals name="relative_days_ago">
    <item quantity="one">%1$d day ago</item>
    <item quantity="other">%1$d days ago</item>
</plurals>
<plurals name="relative_days_from_now">
    <item quantity="one">in %1$d day</item>
    <item quantity="other">in %1$d days</item>
</plurals>
<plurals name="relative_weeks_ago">
    <item quantity="one">%1$d week ago</item>
    <item quantity="other">%1$d weeks ago</item>
</plurals>
<plurals name="relative_weeks_from_now">
    <item quantity="one">in %1$d week</item>
    <item quantity="other">in %1$d weeks</item>
</plurals>
<plurals name="relative_months_ago">
    <item quantity="one">%1$d month ago</item>
    <item quantity="other">%1$d months ago</item>
</plurals>
<plurals name="relative_months_from_now">
    <item quantity="one">in %1$d month</item>
    <item quantity="other">in %1$d months</item>
</plurals>
<plurals name="relative_years_ago">
    <item quantity="one">%1$d year ago</item>
    <item quantity="other">%1$d years ago</item>
</plurals>
<plurals name="relative_years_from_now">
    <item quantity="one">in %1$d year</item>
    <item quantity="other">in %1$d years</item>
</plurals>

<!-- res/values/strings.xml — only if minSdk < LIST_API (26) -->
<!-- Whitespace-preserving quotes are load-bearing here — see "Escaping and markup"
     in the coding rules: an unquoted leading/trailing space collapses away. -->
<string name="list_words_connector">", "</string>
<string name="list_two_words_connector">" and "</string>
<string name="list_last_word_connector">", and "</string>
<string name="list_two_words_connector_or">" or "</string>
<string name="list_last_word_connector_or">", or "</string>
```

As with every non-English target locale in Step 4, add a translated `<plurals>`/`<string>` set (with whatever
extra CLDR quantity categories that language needs) to each `values-<qualifier>/strings.xml` you scaffold.

### Provide `LocalFormatters` once, at the Compose root

```kotlin
CompositionLocalProvider(
    LocalFormatters provides Formatters(
        Formatters.formatLocale(LocalConfiguration.current),
        LocalContext.current,
    )
) {
    AppContent()
}
```

Reading `LocalConfiguration.current` — not just `LocalContext.current` — is what makes this recompose on a
locale change even when the Activity is **not** recreated (`android:configChanges` includes `locale`); when it
*is* recreated (the default), the whole Compose tree is torn down and rebuilt anyway, so this is cheap insurance
either way. `LocalFormatters` itself is `compositionLocalOf { error(...) }`: a composable that reads
`LocalFormatters.current` **above** this provider — or before it runs at all — throws immediately with that
message. That is deliberate: a loud, first-frame crash during development is a better outcome than every
formatted value in the subtree silently going unformatted or falling back to a wrong default.

<!-- if: localeSwitcher == "true" -->
**This project has an in-app language picker. Below API 33, never build a `Formatters` from
`applicationContext`.** `AppCompatDelegate.setApplicationLocales` patches only `Activity` contexts below API 33
— `applicationContext.resources.configuration` keeps returning the *system* locale there, silently, with no
error (confirmed against
[developer.android.com/guide/topics/resources/app-languages](https://developer.android.com/guide/topics/resources/app-languages),
checked 2026-08-22: "the backward compatible APIs work with the AppCompatActivity context, not the application
context, for Android 12 (API level 32) and earlier"). Always pass an Activity or Compose (`LocalContext.current`)
context into `Formatters.of()` / the provider above. A `Service`, a `WorkManager` `Worker`, or anything else with
no Activity context must read `AppCompatDelegate.getApplicationLocales()` (backed by AppCompat's own store, kept
in sync everywhere, not by `Configuration`) and build `Formatters` from that instead of a `Context`. On API 33+
the system `LocaleManager` applies the per-app locale at the process level, so `applicationContext` is safe there
too — the workaround above is only needed to also cover API 21–32.
<!-- /if -->

### The currency rule and the `%1$s` rule survive unchanged

`Formatters.money()` still requires a valid ISO 4217 code — `Currency.getInstance(currency)` throws
`IllegalArgumentException` on anything else, and `money()` lets that exception propagate (wrapped with a
clearer message) rather than silently catching it and substituting `DEFAULT_CURRENCY`. A wrong currency that
renders without complaint is a worse bug than a crash a developer notices in QA; validate currency codes where
they enter this project's data, not inside the formatter.

The **generated rules file** (Step 6) restates the "currency is a property of the price, not the reader" rule
and the "format the value first, then interpolate as `%1$s`, never `%1$d`/`%1$f`" rule, retargeted at this
module — see `android-strings.rules.template.md`.

### Resolve `DEFAULT_CURRENCY`

Grep the codebase for an existing hardcoded currency symbol (`"$" +`, `"€" +`), a raw `DecimalFormat(` currency
pattern, or an existing `Currency.getInstance(` call before defaulting. If nothing is findable, leave `"USD"`
and keep the `// adjust to this project's currency` comment — a wrong currency that looks deliberate is worse
than one that flags itself. Record the hit as `currencySource` (`grep:<file>:<line>`); when nothing is
findable, record `currencySource: "default"`.

**If `Formatters.kt` already exists as project code, do not overwrite it** — add the methods above into it, or
create `I18nFormatters.kt` instead. Either way record the specifier actually used.

**Write `.globalize/format-module.json`** with `specifier: "<applicationId>.i18n.Formatters"` (adjusted to
whatever specifier was actually used above), `path` pointing at the real `Formatters.kt` location under this
module's source set (e.g. `app/src/main/java/com/example/myapp/i18n/Formatters.kt`), the ten-entry `surface`
(`["money","number","percent","compact","unit","date","time","dateTime","relativeTime","list"]`),
`defaultCurrency`, and `currencySource`. `generate_coding_rules` (Step 6) reads `specifier` back as the
`formatModule` placeholder.

---

## Step 6: Generate Coding Rules (`generate_coding_rules` — always runs)

The Android i18n coding rules are a **generated file**, not a shipped one:
`references/languages/android/native/android-strings.rules.template.md` covers string externalization,
positional args, native plurals, escaping, `<xliff:g>`, translator comments, in-app language switching, and
what not to wrap — across both Compose and Views/XML. Follow the **core coding-rules section** in
`references/languages/android/native/setup.add-ons.md`: it renders the template down to this project's one
configuration (real resource dir and locales substituted in) and writes `.agents/globalize-rules.md`. That
section carries the missing-template handling (stop in guided mode / record a skipped-warning in unguided
mode; never recreate the file) and the fail-closed rule — there is no generic `code.md` to fall back to.

**Never skip this step**: it is not gated on a `SKILL.md §1.10` selection, because Phase 3's wrap subagents
read the generated file as their authoring contract. Then follow the **second core step** in the same file,
which points `CLAUDE.md` (`@.agents/globalize-rules.md`) and `AGENTS.md` (a pointer section) at the generated
file. It always runs too, and is likewise not a §1.10 selection.

---

## No Version Gating

The emitted resource code — `<string>` / `<plurals>` / `<string-array>` XML, positional `%n$s` args, CLDR
`quantity` categories, `getString` / `stringResource` accessors — is **identical across all Android API
levels**. There is no version-gated emission. The only API-gated features are optional add-ons: the `b+`
qualifier dir form (API 24+) and per-app language (API 33+ / AppCompat 1.6).

---

## Common Gotchas

- **Non-positional `%s` with multiple args** — `"%s of %s"` fails to build ("Multiple substitutions in a
  non-positional format"). Use positional `%1$s of %2$s`.
- **Unescaped apostrophe** — `<string name="x">It's</string>` truncates or errors. Use `It\'s` or `"It's"`.
- **Plural `quantity` mismatch** — a target language missing a required category (e.g. Russian `few`/`many`)
  falls back silently to `other`. Lint's `MissingQuantity`/`ImpliedQuantity` flags it.
- **Wrong locale dir form** — `values-pt_BR` (underscore) is invalid; the region form is `values-pt-rBR`
  (lowercase `r`). For scripts use `values-b+zh+Hant`.
- **String in code instead of resource** — `Text("Save")` / `setText("Save")` won't be translated. See the
  convert phase; Lint's `HardcodedText` catches the **layout-XML** cases but not Kotlin/Java/Compose.
- **Multi-module / flavors** — `res/` can live in several modules and flavor source sets. v1 targets the app
  module's `src/main/res`; surface other resource dirs to the user.

---

## Next Steps

- **Wrap existing strings** — run the convert phase (`android-strings.convert.md`): it finds hardcoded text in
  layouts (via Lint `HardcodedText`) and in Kotlin/Java/Compose (grep-and-wrap), externalizes it to
  `strings.xml`, and replaces it with `getString`/`stringResource`.
- **Connect a translation service** — with `res/values/strings.xml` populated, connect via the
  `globalize-now-project-setup` skill (sign in first via `globalize-now-account-setup`). The format is **`android-strings`**; the source is
  `app/src/main/res/values/strings.xml`, and the handler discovers target locales from the `values-<qualifier>`
  dirs (no `{locale}` filename token).
