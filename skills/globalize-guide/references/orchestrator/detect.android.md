# Detection rules — native Android

Read by the inspect worker (`inspect.md`) when `language === "android"`. The JS / TS and Ruby tables do not apply.

**Android detection rules** (apply only when `language === "android"`). "Module `res/` root" means the main module's resource dir — default to `app/src/main/res` (note multi-module/flavor layouts: `feature/src/main/res`, `src/<flavor>/res` — surface them in `localeSignals` but target the app module in v1):

| Field | How to detect |
|---|---|
| `framework` | `android` (native Android — Gradle + `AndroidManifest.xml`). |
| `packageManager` | `gradle`. |
| `version` | `null` — Android emits no version-gated i18n code (string resources are stable across all API levels), so no version is captured. |
| `router` | `none` (Android routing is not modeled here). |
| `existing.library` | `android-strings` if `<module>/res/values/strings.xml` exists; else `none`. (String resources are platform-built-in — there is no library to depend on.) |
| `existing.configured` | At least one target resource dir `<module>/res/values-*/strings.xml` exists (a locale overlay is present). |
| `existing.providerWired` | A locale-selection mechanism is wired: `AppCompatDelegate.setApplicationLocales(` in source, OR `android:localeConfig` in `AndroidManifest.xml` with a `res/xml/locales_config.xml`. (Optional — per-app language is an add-on; `false` is normal.) |
| `existing.catalogsScaffolded` | `<module>/res/values/strings.xml` (the source catalog) exists. |
| `existing.stringsWrapped` | Sample up to 50 files across `<module>/res/layout/**/*.xml` and `**/*.{kt,java}`; count files referencing resources (`@string/`, `getString(`, `getText(`, `stringResource(`, `pluralStringResource(`) vs. files with bare user-visible literals: > 80% referencing → "yes", > 20% → "partial", else → "no". |
| `candidateFiles` | Glob `<module>/res/layout/**/*.xml`, `<module>/res/menu/**/*.xml`, `<module>/res/xml/**/*.xml` (grep bare `android:text="literal"`, `android:hint=`, `android:title=`, `android:contentDescription=` with a non-`@string/` value), plus `**/*.{kt,java}` (string literals passed to `setText(`, `Text(`, `Toast`, etc., not already `getString`/`stringResource`). Return files with ≥1 match, sorted by match count desc. |
| `formatCandidateFiles` | Glob `**/*.{kt,java}` (exclude `src/test/`, `src/androidTest/`, and generated `build/` output); grep `SimpleDateFormat(`, `DateTimeFormatter.ofPattern(`, `DecimalFormat(`, `NumberFormat.get`, `String.format("%.`, `DateUtils.getRelativeTimeSpanString(`, `joinToString(`, and a literal currency symbol beside a value. For the currency case match **both** dialects: `"$" +` (Java concatenation) **and** `\$` or `${'$'}` immediately before a Kotlin string-template interpolation — Kotlin escapes a literal `$`, so a `"$" +` grep alone finds zero Kotlin sites, which is most of a modern codebase. Plus glob `<module>/res/**/*.xml` and match a positional `%1$d` / `%1$f` (any `%N$d` / `%N$f`) inside a `<string>` or `<item>` body — those format with the **system** locale and must become `%1$s` fed by a pre-formatted value. **Exclude the generated `Formatters.kt`** (the file `.globalize/format-module.json` → `path` names once it exists; before Phase 2 it does not, so exclude any `Formatters.kt` under an `i18n` package). Return files with ≥1 match, sorted by match count desc. |
| `localeSignals` | Locale codes parsed from `<module>/res/values-*/` dir qualifiers — normalize both legacy (`values-pt-rBR`) and BCP47 (`values-b+sr+Latn`) forms to BCP47; note any non-app-module `res/` dirs; README mentions of language names. |
