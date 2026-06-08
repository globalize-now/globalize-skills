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
  the JS path / hard-stopped in the orchestrator** (`SKILL.md §1.2`). Run i18n-guide against the web UI.
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
| 6. Enable coding rules | **Modifies existing file** | Appends one `@import` line to project `CLAUDE.md` via `setup.add-ons.md` |

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
| **React Native** | `react-native` in a root `package.json` (with an `android/` folder) | **STOP.** "This is a React Native app. It localizes through JS i18n libraries (i18next/react-intl/Lingui), not native `strings.xml`. Run i18n-guide against the JS code." |
| **Capacitor/Cordova/Ionic** | `@capacitor/core` / `cordova` / `@ionic/*` in a root `package.json` (with an `android/` folder) | **STOP.** "This is a hybrid web app — its UI is localized in the web layer, not native `strings.xml`. Run i18n-guide against the web UI." |
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

Notes (full rules in `android-strings.code.md`):
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

## Step 6: Enable Coding Rules

The Android i18n coding rules at `references/languages/android/native/android-strings.code.md` cover string
externalization, positional args, native plurals, escaping, `<xliff:g>`, and what not to wrap. Follow the
procedure in `references/languages/android/native/setup.add-ons.md` (Add-on 1) to wire the `@import` line into
the target project's `CLAUDE.md`. Apply the same missing-file handling the Rails add-ons reference uses (if the
`code.md` is absent because the skill isn't installed, stop in guided mode / record a skipped-warning in
unguided mode; never recreate the file).

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
  `globalize-now-cli-setup` skill. The format is **`android-strings`**; the source is
  `app/src/main/res/values/strings.xml`, and the handler discovers target locales from the `values-<qualifier>`
  dirs (no `{locale}` filename token).
