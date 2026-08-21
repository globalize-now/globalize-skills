# Android i18n: Coding Rules + Optional Add-Ons

Invoked from the Android setup file (`references/languages/android/native/android-strings.setup.md`) after core
setup.

It has two parts. **The two core steps below always run** — they are not add-ons and are not gated on any selection.
The add-ons after them are the ones `SKILL.md §1.10` lets the user multi-select: run only the sub-steps that match
the user's selections in `decisions.md` — skip the rest in silence. Every section here is independently
re-runnable: if already applied, detect and skip without prompting.

Apply the same guided / unguided rules used elsewhere in setup:
- **Guided mode**: describe the change before making it and wait for confirmation.
- **Unguided mode**: apply directly; only stop on hard errors.

Android paths come from core setup: the source catalog is `<res root>/values/strings.xml` for the module that
applies `com.android.application` (`app/src/main/res` in the standard single-module layout, but read it off
disk — see the core step's step 3); per-locale overlays are `<res root>/values-<qualifier>/strings.xml`; code
reads via `getString`/`stringResource` and `getQuantityString`/`pluralStringResource`. Nothing is installed —
string resources are platform-built-in.

---

## Core step 1: generate the coding rules (`generate_coding_rules` — always runs)

**This is a core Phase 2 step, not an add-on**, and it is **not** gated on a `SKILL.md §1.10` selection.
Phase 3's wrap subagents read `.agents/globalize-rules.md` as their authoring contract — externalization rules,
native plural rules, skip-list, real resource directory — so conversion cannot start until this step has
produced it. Wiring that file into `CLAUDE.md` and `AGENTS.md` is the second core step below, which also always runs.

The Android i18n coding rules are a **generated file**, not a shipped one.
`references/languages/android/native/android-strings.rules.template.md` covers every configuration this variant
supports — string externalization, positional args, `<xliff:g>` do-not-translate runs, native `<plurals>` with
CLDR `quantity`, escaping, translator comments, in-app language switching, and what not to wrap, across Jetpack
Compose and Views/XML. This step renders it down to the one configuration this project actually has (only the
branches that apply, with the project's real resource directory and locales substituted in) and writes the
result to `.agents/globalize-rules.md`.

**Read `references/rules-template-format.md` before rendering.** It is the whole rendering contract — template
anatomy, the conditional grammar, the `<<placeholder>>` form, the step order, the header, the fail-closed rule.
The steps below only add where *this variant's* values come from.

### 1. Locate the template

Read `.globalize/manifest-snapshot.json` → `references.rulesTemplate`.

**If the entry has no `rulesTemplate`**, the installed skill is out of date — the `android-strings` variant
carries one. Do not look for a generic `code.md`; it no longer exists for this variant. Treat this exactly like
the missing-file case below.

Verify the template exists in the target project.

- **If it exists**: proceed.
- **If it is missing — guided mode**: tell the user the `globalize-guide` skill is not installed in their project and
  stop this step. The fix is to reinstall it
  (`npx skills add globalize-now/globalize-skills --skill globalize-guide -a claude-code`). Don't recreate the file.
- **If it is missing — unguided mode**: do not block. Skip this step and record
  `⚠ Android coding rules not generated — template missing` in the end-of-run summary, with the reinstall
  command. Treat it as the fail-closed case in step 6: a core step did not complete, so Phase 3 has no rules
  file.

### 2. Resolve the template's `conditions`

Resolve every key listed in the template frontmatter's `conditions` and write them to
`.globalize/rules-values.json`. Comparison values are string literals, so booleans resolve to `"true"` /
`"false"`.

| Condition | Where to read it |
|---|---|
| `uiToolkit` | `"compose"`, `"views"`, or `"both"`. **Nothing upstream records this** — not `.globalize/detection.json` (its schema has no such field) and not the manifest `match`. Detect it from the build files yourself, across every module that contributes UI, not just `app/`. **Compose signals:** a `androidx.compose.*` dependency in a `build.gradle{,.kts}` (`androidx.compose:compose-bom`, `androidx.compose.ui:ui`, `androidx.compose.material3:material3`), the Compose compiler plugin (`org.jetbrains.kotlin.plugin.compose` / `kotlin("plugin.compose")` on Kotlin 2.0+, or `buildFeatures { compose = true }` with a `composeOptions {}` block before it), a `compose`-named entry in `gradle/libs.versions.toml`; corroborate with `@Composable` in `src/main/`. **Views signals:** any `src/main/res/layout/*.xml`, plus `setContentView(R.layout.…)`, `findViewById`, or `buildFeatures { viewBinding = true }` / `dataBinding = true`. Both sets present (common mid-migration) → `"both"`. |
| `localeSwitcher` | `"true"` when the app has, or is getting, an in-app language picker: `setApplicationLocales(` anywhere in Kotlin/Java source, **or** `android:localeConfig` on `<application>` in `AndroidManifest.xml`, **or** `generateLocaleConfig = true` in an `androidResources {}` block, **or** the user selected **Add-on 2** in `decisions.md` (add-ons can run in either order, so check the selection, not only the disk state). Otherwise `"false"` — the app follows the device language and none of that API is a rule the agent needs. |

**If neither `uiToolkit` signal is present** (no layouts, no Compose dependency — a project that has not written
its UI yet), resolve `"both"`. It is the superset, so nothing that applies is dropped; the only cost is a few
extra lines. In guided mode confirm the choice with the user before rendering; in unguided mode take `"both"`
and note it in the summary. Never guess one toolkit and silently delete the other's rules.

### 3. Eliminate branches, then resolve the surviving `values`

Delete every false branch **and every marker line** (`<!-- if:`, `<!-- else -->`, `<!-- /if -->` all disappear,
kept branch or not). Only then resolve the `values` still referenced in what survived — from the project **on
disk**, what core setup actually created, not from `decisions.md`, which records what was asked for rather than
what landed — appending them to the same `.globalize/rules-values.json`.

| Value | Where to read it |
|---|---|
| `resDir` | The **app module's main resource root**, project-root-relative, no trailing slash — the directory holding `values/strings.xml` for the module that applies `com.android.application`. `app/src/main/res` in the standard layout, but the module can be named anything (`:mobile`, `:androidApp`); read `settings.gradle{,.kts}` and glob `**/src/main/res/values/strings.xml` rather than assuming. Flavor source sets (`src/<flavor>/res`) are overlays on top of `src/main/res` — always use `src/main/res`. If library modules carry their own `res/`, still use the app module's here and surface the others to the user. |
| `sourceLocale` | The BCP47 tag of the language the unqualified `values/strings.xml` is written in. `unqualifiedResLocale` in `res/values/resources.properties` when that file exists (AGP 8.1+ locale-config auto-gen); otherwise the source locale recorded in `.globalize/decisions.md`; otherwise `en`. |
| `targetLocales` | The `values-<qualifier>` directories that exist beside the source catalog, each qualifier normalized to BCP47 and the source locale removed, comma-separated: `values-es`, `values-pt-rBR`, `values-b+zh+Hant` → `es, pt-BR, zh-Hant`. Cross-check against `res/xml/locale_config.xml` (or the generated locale config) and `decisions.md`; the directories on disk win. |
| `formatModule` | Read `.globalize/format-module.json` → `.specifier`, written by the `generate_format_helpers` step in `android-strings.setup.md` (its "Format helpers" section) that runs before this one. It is the fully-qualified class name, e.g. `com.example.myapp.i18n.Formatters`. If the file is absent, `generate_format_helpers` did not complete — this is the fail-closed case in step 6 below, not a value to guess. |

**The order is load-bearing.** A value inside a false branch has no value to resolve, and resolving up front
would demand values that don't exist and trip step 5 on a perfectly healthy project.

### 4. Render

Substitute every surviving `<<name>>` with its resolved value, strip the frontmatter, and **copy everything
retained verbatim** — do not rewrite, summarize, reflow, re-order, or improve the prose. Prepend the two-line
generated header:

```
<!-- globalize-rules v<templateVersion> | template=android-strings | variant=<manifest-snapshot variant> | generated by globalize-guide -->
<!-- Generated file. Re-running globalize-guide overwrites it. Put your own project rules in CLAUDE.md or AGENTS.md. -->
```

Write the result to `.agents/globalize-rules.md`, overwriting any file left by an earlier run.

**`.agents/globalize-rules.md` should be committed.** It is team-shared coding guidance, exactly like
`CLAUDE.md` — every contributor's agent needs it. Do **not** add it to `.gitignore`; it is not a `.globalize/`
progress artifact.
Then confirm the file is actually tracked: run `git check-ignore .agents/globalize-rules.md`. Some repos ignore whole dotfile directories, and a rules file no teammate receives is not doing its job. If it comes back ignored, say so — do not silently succeed.

**Migrate off the old path.** Earlier versions of this skill wrote the rules to `.claude/globalize-rules.md`. **Only after the write above succeeded**, delete that file if it exists *and* its line 1 carries the generated header. A file at that path without the header is not ours — leave it and warn. Never remove the `.claude/` directory itself; it holds settings and installed skills that are not ours. The matching `@.claude/globalize-rules.md` line in `CLAUDE.md` is removed by the wiring step below.

### 5. Self-check the generated file

All four must hold:

- zero occurrences of `<!-- if:`, `<!-- else -->`, `<!-- /if -->`
- zero occurrences of `<<`
- the header is on line 1
- the line count is within the template's `budget` for the resolved conditions

### 6. Fail closed

If **any** surviving condition or value can't be resolved, or the self-check fails: **never write a partial
file.** Delete anything already written to `.agents/globalize-rules.md`, then:

- **Guided mode** — ask the user for the specific value. Every one of these is a one-line answer ("Which module
  holds your `res/` directory?", "Which language is `values/strings.xml` written in?", "Does the app have an
  in-app language picker?"), and getting one beats shipping either wrong rules or none. Resolve, re-render,
  re-check. Only if the user can't answer, or the self-check still fails, stop this step and say which key or
  check failed.
- **Unguided mode** — don't block the run. Skip this step and record
  `⚠ Android coding rules not generated (resDir unresolved) — no rules file installed` in the end-of-run summary.

Either way a **core step did not complete**, so surface it instead of letting the run drift into conversion:
report `generate_coding_rules` as failed, leave it unchecked in `plan.md`, and tell the orchestrator that
Phase 3 has no `.agents/globalize-rules.md` to wrap against. The user then either supplies the missing value
and re-runs this step, or converts knowing the wrap subagents are working without this project's rules.

There is no generic-rules fallback: `android-strings.code.md` was deleted when this variant moved to a
template, so the template is the only source of truth for Android string-resource rules. Installing nothing is
recoverable — re-run this step. Installing rules that name the wrong resource directory is not; the agent
follows them into a bug on every future edit and nothing signals it.

---

## Core step 2: wire the coding rules in (`install_coding_rules` — always runs)

**This is a core Phase 2 step, not an add-on**, and it is **not** gated on a `SKILL.md §1.10` selection. Rules that nothing loads are close to useless, so the wiring is not a decision the user is asked to make up front. It does edit files the user owns, so the usual mode rule applies: **guided mode** describes each change and waits for confirmation, **unguided mode** applies it directly.

If the core step above failed and there is no `.agents/globalize-rules.md` on disk, **skip this step entirely and create neither file** — an import or pointer aimed at a missing file opens every future session with a dangling reference.

Two bridges, because no single mechanism reaches every agent.

### `CLAUDE.md` — Claude Code

Claude Code doesn't reliably auto-trigger passive "coding rules" references during routine edits, but an `@`-imported file loads into every session's context.

- **If it doesn't exist**, create it:
  ```
  # Project Instructions

  @.agents/globalize-rules.md
  ```
- **If it exists**, append `@.agents/globalize-rules.md` at the end of the file on its own line ("I'll append `@.agents/globalize-rules.md` to your CLAUDE.md so the Android i18n coding rules auto-load every session"). Do not remove or reorder existing content.
- **If a stale `@.claude/globalize-rules.md` line is present** — written by an older version of this skill, which put the rules file under `.claude/` — remove it in the same edit. Leaving it behind means every future session opens with a dangling import.

If the exact `@.agents/globalize-rules.md` line is already present, skip silently — this step is idempotent.

Tell the user: "The first time you start a Claude Code session in this project, you'll see a one-time prompt asking to approve the `@` import. Approve it — otherwise the rules won't load."

### `AGENTS.md` — Codex CLI, Cursor, Copilot, Gemini, Aider, Cline

All of these read a repo-root `AGENTS.md`. None of them support an import syntax, so the rules reach them as a pointer they must choose to follow rather than a guaranteed load. That is the honest ceiling here: inlining a second copy of the rules would guarantee loading at the cost of two copies that drift out of sync.

- **If it doesn't exist**, create it with an `# AGENTS.md` heading and the section below — nothing else. Do not author a project brief on the user's behalf.
- **If it exists**, append the section at the end. Do not remove or reorder existing content.

```markdown
## Internationalization

Before adding or editing any user-facing string, read `.agents/globalize-rules.md`
and follow it. It is this project's authoritative i18n authoring contract — which
API to use, how to handle plurals, where catalogs live, and what not to wrap.
```

Idempotent on the literal `.agents/globalize-rules.md` appearing anywhere in `AGENTS.md`: present → skip silently.

Verify: in a fresh session, ask Claude "how should I add a plural string in this project?" — the answer should reference `<plurals>` with CLDR `quantity` items and `getQuantityString`/`pluralStringResource`, not ICU.

---

<!-- Add-on numbering starts at 2 on purpose: what used to be Add-on 1 (importing the coding
     rules) is now the second core step above, and the remaining numbers are left unchanged so
     cross-references elsewhere in this file stay valid. -->

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
