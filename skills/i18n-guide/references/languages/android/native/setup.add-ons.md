# Android i18n: Optional Add-Ons

Invoked from the Android setup file (`references/languages/android/native/android-strings.setup.md`) after core
setup. The orchestrator's `SKILL.md §1.10` lets the user multi-select the add-ons below. Run only the sub-steps
that match the user's selections in `decisions.md` — skip the rest in silence. Each sub-step is independently
re-runnable: if already applied, detect and skip without prompting.

Apply the same guided / unguided rules used elsewhere in setup:
- **Guided mode**: describe the change before making it and wait for confirmation.
- **Unguided mode**: apply directly; only stop on hard errors.

Android paths are fixed by core setup: the source catalog is `app/src/main/res/values/strings.xml`; per-locale
overlays are `app/src/main/res/values-<qualifier>/strings.xml`; code reads via `getString`/`stringResource` and
`getQuantityString`/`pluralStringResource`. Nothing is installed — string resources are platform-built-in.

---

## Add-on 1: Coding rules (`@import`)

The Android i18n coding rules at `references/languages/android/native/android-strings.code.md` cover string
externalization, positional args, native plurals, escaping, `<xliff:g>`, and what not to wrap. They ship as
part of the `i18n-guide` skill and already live at
`.claude/skills/i18n-guide/references/languages/android/native/android-strings.code.md` in the target project.

Claude Code doesn't reliably auto-trigger passive "coding rules" references during routine edits. To make them
always-available, reference the file from the project's root `CLAUDE.md` using Claude Code's `@` import syntax.

Verify `.claude/skills/i18n-guide/references/languages/android/native/android-strings.code.md` exists in the
target project.

- **If it exists**: proceed.
- **If it is missing — guided mode**: tell the user the `i18n-guide` skill is not installed in their project and
  stop this add-on. The fix is to reinstall it
  (`npx skills add globalize-now/globalize-skills --skill i18n-guide -a claude-code`). Don't recreate the file.
- **If it is missing — unguided mode**: do not block. Skip the append and record
  `⚠ Android coding rules not installed — wiring skipped` in the end-of-run summary, with the reinstall command.

Check whether `CLAUDE.md` exists at the project root.

- **If it doesn't exist**, create it:
  ```
  # Project Instructions

  @.claude/skills/i18n-guide/references/languages/android/native/android-strings.code.md
  ```
- **If it exists**, describe the change ("I'll append
  `@.claude/skills/i18n-guide/references/languages/android/native/android-strings.code.md` to your CLAUDE.md so
  the Android i18n coding rules auto-load every session") and wait for confirmation in guided mode before
  appending. Put the line at the end of the file on its own line. Do not remove or reorder existing content.

If the exact `@` line is already present, skip silently — idempotent.

Tell the user: "The first time you start a Claude Code session in this project, you'll see a one-time prompt
asking to approve the `@` import. Approve it — otherwise the rules won't load."

---

## Add-on 2: Per-app language selection

By default the app follows the **device** language. This add-on lets the user pick a language **inside the
app**, persisted across restarts, via AppCompat's per-app locale API (AppCompat ≥ 1.6; backed by the system
`LocaleManager` on API 33+, where the app also appears in Settings → App languages).

1. Ensure `androidx.appcompat:appcompat:1.6.0+` is a dependency. If missing, this is the **one allowed
   install** for the Android path — flag it to the orchestrator as an extra install (`needs_decision`,
   `extra_install`) rather than running it inside the subagent, consistent with the Phase-2 contract.

2. **Declare supported locales** so the system picker can list them.

   **AGP 8.1+ / Android Studio Giraffe** — auto-generate from your `values-*` dirs:
   ```kotlin
   // build.gradle.kts (app module)
   android {
       androidResources {
           generateLocaleConfig = true
       }
   }
   ```
   (Groovy: `android { androidResources { generateLocaleConfig true } }`.) The auto-gen path also needs
   `res/values/resources.properties` with `unqualifiedResLocale=en-US` (the default locale). **Do not also
   hand-author a locale-config file when this is on — the build fails.**

   **AGP < 8.1** — author `res/xml/locale_config.xml` by hand (the filename is referenced via `@xml/<name>`;
   `locale_config.xml` matches Android's docs) and reference it from the manifest:
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

3. **Set the locale** from a language picker:
   ```kotlin
   AppCompatDelegate.setApplicationLocales(
       LocaleListCompat.forLanguageTags("es")  // "" follows the system
   )
   ```

**Modifies `AndroidManifest.xml`, a `build.gradle`, and a source file.** Describe each change and confirm in
guided mode. Off by default in unguided mode (it changes runtime behavior). If a per-app language setup already
exists (manifest `localeConfig` + `setApplicationLocales`), skip.

---

## Add-on 3: CI / lint integration

Android's coverage gate is **`./gradlew lint`** with the translation checks. `MissingTranslation` (a source key
absent from a target locale) and `ExtraTranslation` (a key in a target that isn't in the source) catch catalog
drift on every PR. `ImpliedQuantity` / `MissingQuantity` catch plural-category gaps. (Lint requires the Android
SDK; on agents without it, fall back to the static XML-validity + locale-coverage checks from the convert
phase.)

**Make missing translations fail the build** (otherwise they are warnings). In the app module:

```kotlin
// build.gradle.kts (app module)
android {
    lint {
        // Treat translation gaps as errors so CI fails on them
        error += listOf("MissingTranslation", "ExtraTranslation")
        // Optional: enforce no hardcoded layout text
        // warning += "HardcodedText"
        checkDependencies = true
    }
}
```
(Groovy: `android { lint { error 'MissingTranslation','ExtraTranslation'; checkDependencies true } }`.)

Run locally:
```bash
./gradlew lint
# report: app/build/reports/lint-results-*.html
```

### GitHub Actions workflow

If the project has `.github/workflows/`, scaffold `.github/workflows/i18n.yml`:

```yaml
name: i18n

on:
  pull_request:
    paths:
      - '**/src/main/res/values*/strings.xml'
      - '**/src/main/res/layout/**'
      - '**/*.kt'
      - '**/*.java'
      - '.github/workflows/i18n.yml'

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'
      - uses: gradle/actions/setup-gradle@v4
      - name: Android Lint (translation + hardcoded-text checks)
        run: ./gradlew lint
      - name: Upload lint report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: lint-results
          path: '**/build/reports/lint-results-*.*'
```

`ubuntu-latest` ships the Android command-line tools / SDK via the Gradle wrapper's auto-provisioning on most
setups; if `sdkmanager`/licenses aren't present, add an `android-actions/setup-android@v3` step. If the project
has no `.github/workflows/`, skip the scaffold and tell the user how to wire `./gradlew lint` into their CI.

### Why this matters

Lint is the only automated coverage gate for Android i18n — there is no `extract`/`compile` step to fail. With
`MissingTranslation` promoted to an error, a new `<string>` added to the source without a matching entry in a
target locale fails review rather than silently falling back to the source string at runtime.

---

## Add-on 4: Hardcoded-text guard

To catch **new** hardcoded layout text as it is written (a continuous guard complementing the one-time convert
pass), promote Lint's `HardcodedText` to an error in the app module's `lint {}` block:

```kotlin
android {
    lint {
        error += "HardcodedText"
    }
}
```

Caveat (state it honestly): `HardcodedText` covers **layout XML only** — it does not flag literals in
Kotlin/Java/Compose. There is no first-party Lint check for hardcoded strings in code. For code coverage, rely
on code review and the convert-phase grep passes; a custom Lint detector or a Detekt rule can be added by the
team if they want automated enforcement, but none ships by default. Do not claim Lint guards code strings — it
does not.

---

## End

Record applied add-ons in the end-of-run summary so the user has an audit trail of what was wired up.
