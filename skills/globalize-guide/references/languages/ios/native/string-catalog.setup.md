# Apple String Catalog Setup

Native Apple localization ships fully assembled with the SDK: the `Text` / `String(localized:)` / `LocalizedStringKey` APIs, CLDR plural rules, date/number/currency formatting, and the build-time string extractor are all built into Foundation and SwiftUI. There is **no package to install** — this setup phase only adds an Apple **String Catalog** (`.xcstrings`), enables compiler extraction, registers the project's locales, and (for Swift packages) declares the catalog as a localized resource so Globalize can key off a populated catalog.

The catalog mechanics are identical across SwiftUI, UIKit, and Swift Package (SPM) targets — only the surrounding project configuration differs. Default and only supported format is the modern Apple String Catalog; legacy `.strings`/`.stringsdict` are handled as a one-way convert *input*, not maintained alongside.

Follow these steps in order. Each builds on the last.

---

## Out of Scope

This setup phase covers **native Apple (Swift) projects** localizing with an **Apple String Catalog** (`.xcstrings`) on **iOS** — SwiftUI, UIKit, and Swift Package targets. It does not cover:

- **macOS / watchOS / tvOS / Mac Catalyst project configuration beyond shared catalog mechanics.** The catalog format and the `Localizable.xcstrings` workflow are identical on every Apple platform, so the *catalog* steps transfer; platform-specific project/target/asset configuration (per-platform deployment, watchOS complications, tvOS top-shelf, Catalyst entitlements) is out of scope. Apply the catalog steps; leave platform plumbing to the user.
- **Objective-C-first stacks.** Legacy `NSLocalizedString` is supported only as a convert *input* (Xcode can convert existing `Localizable.strings`/`.stringsdict` to a catalog, including legacy `NSLocalizedString` call sites, via `--legacy-localizable-strings` when invoked through `xcstringstool`). New Objective-C string authoring against catalogs is not a target of this skill. **Detect-and-note**, do not act.
- **Maintaining dual legacy `.strings` / `.stringsdict` authoring.** We convert *to* a String Catalog; we do not keep authoring the legacy plist formats in parallel afterward. The formats may coexist *during* a migration (per *table*), but the end state is catalog-only. Do not scaffold or maintain `.strings`/`.stringsdict` as a target format.
- **Multiple custom string tables beyond noting that `**/*.xcstrings` handles them.** The default table is `Localizable.xcstrings`. Apps may add tables (`InfoPlist.xcstrings`, a custom `Navigation.xcstrings`), each its own catalog. This setup scaffolds the default table; additional tables are connected in Phase 4 with a `**/*.xcstrings` pattern. We do not orchestrate per-table table layout.

---

### Step Risk Classification

| Step | Risk | Notes |
|------|------|-------|
| 1. Detect | Read-only | No changes to the project |
| 2. (No install) | None | Native localization ships with the SDK; nothing to install |
| 3. Create `Localizable.xcstrings` | Additive | New catalog file; does not touch existing catalogs |
| 4. Enable `SWIFT_EMIT_LOC_STRINGS` | **Modifies project config** | Sets a build setting in the `.xcodeproj` — describe the change and get confirmation |
| 5. Register target locales | **Modifies project config** | Adds localizations / known regions to the Xcode project — describe the change and get confirmation |
| 6. SPM: edit `Package.swift` | **Modifies existing file** | Adds `defaultLocalization` + processed-resource declaration — describe the change and get confirmation |
| 7. Optional legacy migration | Additive (per table) | Converts existing `.strings`/`.stringsdict` to a catalog; non-blocking |
| 8. Generate coding rules | Additive (+ optional file edit) | Writes `.claude/globalize-rules.md` — **always runs**, Phase 3 wraps against it; the `@import` line into project `CLAUDE.md` is the opt-in tail |

**RULE: Steps that modify the Xcode project config or existing files require you to describe the exact change to the user and get confirmation before proceeding. Do NOT silently modify project configuration or existing files.** _(This rule is modified by the setup mode chosen below.)_

---

## Setup Mode

After Step 1 (detection) completes without blockers, ask the user:

> **How would you like to proceed with the setup?**
> 1. **Guided** — I'll explain each step before and after, and you'll confirm changes to project config and existing files.
> 2. **Unguided** — I'll run all steps without pausing and show a full summary at the end. Optional steps (legacy `.strings`/`.stringsdict` migration) will be included — tell me now if you'd like to skip any.

### Guided mode rules

- **Before each step**: briefly explain what will happen and why.
- **After each step**: summarize what changed (files created, project settings modified, commands run).
- Consent gates for "Modifies project config" / "Modifies existing file" steps still apply — describe the exact change and wait for confirmation.
- Optional steps still prompt the user ("Would you like me to...").

### Unguided mode rules

- Execute all steps without pausing for per-step explanations or confirmations.
- Consent gates for config/file modifications are **suspended** — proceed with the modification without asking.
- Hard stops (incompatibility checks in Step 1) still halt execution — these are never skipped.
- "MUST wait for the user to choose" lines in this file are **overridden** by the unguided-defaults table below when a default is listed.
- Optional steps (legacy migration) are **included by default** unless the user excluded them.
- At the end, produce a summary:

```
## Setup Complete

### What was done
- [x] Step N: {step name} — {one-line description}

### Files created
- path/to/file

### Project config / files modified
- {what changed}

### Defaults applied
- {choice}: {value applied} — {rationale}

### Next steps
- {recommendations}
```

#### Unguided defaults

In unguided mode, apply the defaults below without prompting. Log each default choice in the final summary so the user can revisit any of them:

| Choice | Unguided default | Rationale |
|--------|------------------|-----------|
| **Source language** | Existing Info.plist `CFBundleDevelopmentRegion` / project development region if found; otherwise `en` | The development region is the catalog `sourceLanguage` — match what the app already ships |
| **Target locales** | User-specified if given in the initial prompt; otherwise `es` | One additional locale is enough to validate the pipeline |
| **String table** | `Localizable.xcstrings` | The default table; covers app UI strings |
| **Legacy migration** | Included if `.strings`/`.stringsdict` are present; skipped otherwise | Migrating existing strings into the catalog is the natural starting point |
| **Compiler extraction** | Enabled (`SWIFT_EMIT_LOC_STRINGS = YES`) | Default-on for new projects; keeps the catalog in sync at build time |

---

## Step 1: Detect the Project

Read the project structure to determine the shape. There is no `package.json`/lockfile here — detect against Apple project artifacts.

| Signal | How to detect |
|--------|--------------|
| **Apple project present** | `*.xcodeproj` / `*.xcworkspace` at or near root, or a `Package.swift` |
| **Build system** | `*.xcodeproj`/`*.xcworkspace` → Xcode; `Package.swift` (no `.xcodeproj`) → SPM |
| **UI framework** | The `@main` entry point decides: SwiftUI = `import SwiftUI` + a `struct …: App` with `@main` (this stays SwiftUI even when a `UIApplicationDelegateAdaptor` is also present); UIKit = `@UIApplicationMain`/AppDelegate/SceneDelegate (`import UIKit` + `…: UIResponder, UIApplicationDelegate`) and/or `.storyboard`/`.xib` files with no SwiftUI `App`. This affects only which idioms the convert guidance leads with — catalog mechanics are identical — so genuine ambiguity defaults to SwiftUI rather than a "mixed" classification |
| **Language** | `*.swift` (Swift) vs `*.m`/`*.h` (Objective-C); note Objective-C-first stacks (Out of Scope) |
| **Source language / dev region** | Info.plist `CFBundleDevelopmentRegion`; or the project's development region; fall back to `en` |
| **Available locales** | Info.plist `CFBundleLocalizations`; the Xcode project's known regions / project localizations; and `*.lproj` directory basenames |
| **Existing catalogs** | Glob `**/*.xcstrings` — note the table names (`Localizable`, `InfoPlist`, custom) |
| **Existing legacy strings** | Glob `**/*.strings` and `**/*.stringsdict` — candidates for migration (Step 7) |
| **Compiler extraction** | `SWIFT_EMIT_LOC_STRINGS` in the project/target build settings (the "Use Compiler to Extract Swift Strings" setting) |
| **Xcode toolchain available** | `xcode-select -p` succeeds; `xcrun --find xcstringstool` resolves (needed for build-verify; absent on non-macOS CI) |
| **Git repository** | `git rev-parse --is-inside-work-tree` exits 0 |
| **Current branch** | `git branch --show-current` |

### Incompatibility Checks

Before proceeding, check for blockers. **If any check below says STOP, you MUST stop and communicate the issue to the user. Do NOT proceed with subsequent steps.**

| Check | How to detect | Action |
|-------|--------------|--------|
| **Not a native Apple project** | No `*.xcodeproj`/`*.xcworkspace` and no `Package.swift`; no `*.swift`/`*.m`/`*.h` | **STOP.** Tell the user: "No native Apple (Swift) project detected. This setup phase requires an Xcode project or a Swift package. For a cross-platform mobile project (React Native, Flutter, Capacitor), a different globalize-guide variant applies." |
| **Cross-platform wrapper detected** | `package.json` with React Native / Expo / Capacitor, or `pubspec.yaml` (Flutter) at root alongside the iOS dir | **STOP.** Tell the user: "This looks like a {framework} project that embeds an iOS target. Localize at the {framework} layer, not via the native String Catalog — a different globalize-guide variant applies." |
| **Objective-C-first stack** | Only `*.m`/`*.h` sources; no Swift | **Warn (non-blocking).** Tell the user: "This is an Objective-C project. String Catalogs work, but this skill authors Swift. I can still create the catalog and convert existing `.strings`/`.stringsdict` as input; new authoring guidance assumes Swift. Proceeding for catalog + migration only." |
| **Existing catalog already configured** | A populated `Localizable.xcstrings` already present | **Warn (non-blocking).** Tell the user: "A String Catalog already exists at `{path}`. I'll inspect it and skip catalog creation (Step 3), continuing with locale registration and the coding rules." Skip Step 3 but continue. |

### Tooling Floor Warning (non-blocking)

String Catalogs require **Xcode 15** or newer **at build time** (the catalog `version` is `"1.0"` for Xcode 15+). They impose **no minimum deployment target** and **no runtime floor**: at build time a catalog compiles down to legacy `.strings` + `.stringsdict`, which the OS has supported for years. If the project targets very old OS versions, the catalog still works — there is **no deployment-target floor** introduced by adopting it.

If the Xcode toolchain is **not** available (non-macOS agent), warn:

> Xcode is not available on this machine. I can author the catalog and register locales statically, but I cannot build-verify (the compiler extraction and `xcrun xcstringstool` round-trip need Xcode). Run a build on a Mac with Xcode 15+ to populate and verify the catalog.

### Branch Recommendation

If the project is a git repository and the current branch is `main`, `master`, or `develop`, recommend creating a dedicated branch first:

> You're currently on `{branch}`. This setup will modify project configuration. I'd recommend creating a dedicated branch:
> ```
> git checkout -b chore/i18n-setup
> ```
> Want me to create this branch, or continue on `{branch}`?

If the user is already on a feature branch, or the project has no git repository, skip this silently.

If no blockers were found, proceed to the **Setup Mode** prompt before continuing to Step 2.

---

## Step 2: No Install — Localization Ships with the SDK

**There is nothing to install.** This is the key departure from every other globalize-guide variant, which installs an npm/SPM package and wires a compiler plugin. Apple localization is **built into Foundation and SwiftUI**:

- The localization APIs (`Text(...)`, `String(localized:)`, `LocalizedStringKey`, `NSLocalizedString`) are part of the SDK.
- **CLDR plural rules ship with the SDK** — there is no `rails-i18n`/plural-data package to add. The system selects the correct plural category per locale at runtime.
- The string extractor is the Swift compiler itself (Step 4), and `xcstringstool` is bundled in the Xcode toolchain (Step 7 / tooling-floor section).

So there is **no install step** for any of the three stacks (SwiftUI, UIKit, SPM). No `npm install`, no `swift package add`, no `Podfile` entry, no package pin. Skip straight to creating the catalog.

---

## Step 3: Create the String Catalog

Add the default string table, `Localizable.xcstrings`. Two ways:

**In Xcode (preferred when the user has the IDE open):** **File ▸ New ▸ String Catalog**, name it `Localizable`. Xcode creates `Localizable.xcstrings` and adds it to the target.

**By hand (headless / agent, no Xcode UI):** create a minimal valid catalog. The top-level keys are `sourceLanguage`, `strings`, and `version` (`"1.0"` for Xcode 15+):

```json
{ "sourceLanguage": "en", "strings": {}, "version": "1.0" }
```

Replace `"en"` with the detected source language / development region. Place it where the target expects resources:

- **Xcode app target:** alongside the target's sources (Xcode app folder), added to the target's "Copy Bundle Resources".
- **SPM target:** under `Sources/<Target>/Resources/` (see Step 6).

**One catalog per table, never per language.** A String Catalog is a single multi-locale file: *all* locales for a table live inside the one `.xcstrings`. Multiple catalogs split *tables* (`Localizable.xcstrings`, `InfoPlist.xcstrings`), not languages. Do not create per-locale catalogs.

**Additive step** — existing catalogs are not modified; only the new default-table catalog is created.

---

## Step 4: Enable Build-Time Extraction (`SWIFT_EMIT_LOC_STRINGS`)

**This step modifies the Xcode project's build settings.** In guided mode, describe the exact change and get confirmation.

Enable the build setting **"Use Compiler to Extract Swift Strings"** — the underlying key is:

```
SWIFT_EMIT_LOC_STRINGS = YES
```

This is **default-on for new projects** created in Xcode 15+. With it enabled, the **compiler populates and updates the catalog on each build** — every localizable literal (`Text("…")`, `String(localized: "…")`) is extracted into `Localizable.xcstrings` automatically. There is no separate `genstrings`/extract CLI step.

**Source is the source of truth.** When a string is removed from source, the compiler does **not** delete its catalog entry — it marks it **stale**. Stale entries are kept (so existing translations aren't lost mid-edit) but flagged for cleanup. Adding a new literal adds a new entry; renaming the English literal (when it is the key) orphans the old entry as stale and starts the new key untranslated.

If the setting is already `YES` (detected in Step 1), note it and continue.

---

## Step 5: Register Target Locales

**This step modifies the Xcode project's localizations.** In guided mode, describe the exact change and get confirmation.

A catalog can hold any number of locales, but the project must *know* which locales it ships so Xcode (and the build) surface them. Add localizations under **Project ▸ Info ▸ Localizations** (Xcode's "known regions" / project localizations list).

To build the locale list, read these sources (detected in Step 1) and reconcile:

- **`*.lproj` directories** — each existing `xx.lproj` / `xx-YY.lproj` is a registered locale.
- **Info.plist `CFBundleLocalizations`** — the explicit list of locales the bundle declares.
- **Info.plist `CFBundleDevelopmentRegion`** — the **development region = source language**. This is the `sourceLanguage` in the catalog; do not add it as a "translated" target.

For each *target* locale not yet registered, add it to the project localizations. The development region stays the source language and matches the catalog's `sourceLanguage`. Use Apple's locale codes (e.g. `pt-BR`, `zh-Hans`).

---

## Step 6: Swift Package (SPM) — `Package.swift`

**This step applies only to SPM targets and modifies `Package.swift`.** In guided mode, describe the exact change and get confirmation. (Xcode app targets skip this step — go to Step 7.)

A Swift package that ships localized resources needs two things:

1. **`defaultLocalization:`** on the `Package` — the package's source language (matches the catalog's `sourceLanguage`).
2. The catalog declared as a **processed resource** (`.process("Resources")`), with `Localizable.xcstrings` living under `Sources/<Target>/Resources/`.

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MyLibrary",
    defaultLocalization: "en",
    targets: [
        .target(
            name: "MyLibrary",
            resources: [ .process("Resources") ] // Localizable.xcstrings under Sources/MyLibrary/Resources
        ),
    ]
)
```

At runtime, a package resolves its own bundle via **`Bundle.module`**, so localized lookups must be bundle-scoped — a bare `String(localized:)` would look in the main app bundle, not the package's:

```swift
// Resolve against the package's own resource bundle
let title = String(localized: "Book this room", bundle: .module)
```

`Bundle.module` is generated by SwiftPM only when the target declares resources — which the `.process("Resources")` line above provides. SwiftUI `Text(...)` in a package also needs the bundle: `Text("Book this room", bundle: .module)`.

---

## Step 7: Optional — Migrate Legacy `.strings` / `.stringsdict` (non-blocking)

If the project has existing `Localizable.strings` / `Localizable.stringsdict` (detected in Step 1), offer to migrate them into the catalog. In guided mode ask; in unguided mode include by default.

In Xcode: select the legacy `.strings`/`.stringsdict` file and use **Edit ▸ Convert to String Catalog**. This is done **per *table*** — convert `Localizable.strings` into `Localizable.xcstrings`, `InfoPlist.strings` into `InfoPlist.xcstrings`, and so on. Existing translations and `.stringsdict` plural rules carry over into the catalog's `variations.plural`.

The formats **can coexist during migration** (one table converted, another not yet), but once a table is converted, **do not maintain dual formats** — delete the legacy `.strings`/`.stringsdict` for that table and let the catalog be the single source. Authoring against both is the dual-maintenance anti-pattern called out in Out of Scope.

For Objective-C `NSLocalizedString` call sites, the conversion can ingest them as input (via `--legacy-localizable-strings` when driving `xcstringstool` directly); the catalog becomes the authoring surface going forward.

---

## Step 8: Generate Coding Rules (`generate_coding_rules` — always runs)

**This step is not optional and is not gated on a `SKILL.md §1.10` selection.** Phase 3's wrap subagents read `.claude/globalize-rules.md` as their authoring contract — which API localizes, plural authoring, skip-list, the real catalog path — so conversion cannot start until this step has produced it. Only the `CLAUDE.md` import in sub-step 7 is opt-in, because it edits a file the user owns.

The Apple String Catalog coding rules are a **generated file**, not a shipped one. `references/languages/ios/native/string-catalog.rules.template.md` covers every configuration this variant supports — auto-localizing `Text` literals, `String(localized:)`, bundle-scoped lookups in Swift packages, `comment:` translator context, key conventions, C-style format specifiers, catalog plural authoring (no ICU), and what not to wrap. This step renders it down to the one configuration this project actually has (only the branches that apply, with the project's real catalog path and locales substituted in) and writes the result to `.claude/globalize-rules.md`.

**Read `references/rules-template-format.md` before rendering.** It is the whole rendering contract — template anatomy, the conditional grammar, the `<<placeholder>>` form, the step order, the header, the fail-closed rule. The steps below only add where *this variant's* values come from.

### 1. Locate the template

Read `.globalize/manifest-snapshot.json` → `references.rulesTemplate`.

**If the entry has no `rulesTemplate`**, the installed skill is out of date — all three iOS variants carry one. Do not look for a generic `code.md`; it no longer exists for this variant. Treat this exactly like the missing-file case below.

Verify the template exists in the target project.

- **If it exists**: proceed.
- **If it is missing — guided mode**: tell the user the `globalize-guide` skill is not installed in their project and stop this step. The fix is to reinstall it (`npx skills add globalize-now/globalize-skills --skill globalize-guide -a claude-code`). Don't attempt to recreate the file.
- **If it is missing — unguided mode**: do not block. Skip this step and record `⚠ iOS coding rules not generated — template missing` in the end-of-run summary, with the reinstall command shown above. Treat it as the fail-closed case in sub-step 6: a core step did not complete, so Phase 3 has no rules file.

### 2. Resolve the template's `conditions`

Resolve every key listed in the template frontmatter's `conditions` and write them to `.globalize/rules-values.json`. Comparison values are string literals.

| Condition | Where to read it |
|---|---|
| `uiFramework` | `.globalize/manifest-snapshot.json` → `match.uiFramework` **when present**: `"swiftui"` on `ios-swiftui-string-catalog`, `"uikit"` on `ios-uikit-string-catalog`. The key is **absent** on `ios-spm-string-catalog` — a Swift package may ship either — so for that variant detect it from the target's own Swift sources: `"swiftui"` if any source under `Sources/<Target>/` imports `SwiftUI` or declares a `View`; `"uikit"` if they import `UIKit` and no `SwiftUI`. Genuine ambiguity defaults to `"swiftui"`, the same tie-break Step 1 uses. |
| `bundleScope` | Composite of **packaging × UI framework**, resolved here because the grammar has no `&&` (the `paramsShape` worked example in `references/rules-template-format.md` is the same shape). Read packaging from `.globalize/manifest-snapshot.json` → `match.buildSystem`. `"xcode"` → `bundleScope` = `"none"`: an app target resolves against the main bundle and takes no `bundle:` argument. `"spm"` → `"spm-swiftui"` or `"spm-uikit"`, matching the `uiFramework` resolved above. The two SPM values exist only so the rendered `bundle: .module` examples use the API the project actually writes. |

`bundle: .module` is not cosmetic: a Swift-package lookup without it resolves against the main app bundle, the string renders as its raw key, and nothing signals the failure (Step 6). Getting `bundleScope` wrong on an SPM target ships coding rules that produce silently non-localizing code.

### 3. Eliminate branches, then resolve the surviving `values`

Delete every false branch **and every marker line** (`<!-- if:`, `<!-- else -->`, `<!-- /if -->` all disappear, kept branch or not). Only then resolve the `values` still referenced in what survived — from the files **on disk**, what this setup actually wrote, not from `decisions.md`, which records what was asked for rather than what landed — appending them to the same `.globalize/rules-values.json`.

| Value | Where to read it |
|---|---|
| `catalogPath` | Locate the `.xcstrings` file — glob `**/*.xcstrings` and take the default table (`Localizable.xcstrings`), the one created or confirmed in Step 3. On an SPM target that is `Sources/<Target>/Resources/Localizable.xcstrings` (Step 6). Record it **project-root-relative**. A String Catalog is a **single multi-locale file**, so this is the path of the file itself and must contain **no `{locale}` segment**. If several tables exist, name the default one. |
| `sourceLocale` | The `sourceLanguage` field **inside the catalog file** — that is what the build honours. Info.plist `CFBundleDevelopmentRegion` and the project development region are the inputs Step 3 used; the catalog on disk wins if they disagree. |
| `targetLocales` | The project localizations registered in Step 5 minus the catalog's `sourceLanguage`, comma-separated: `de, fr, ja`. Cross-check against the locale keys present in the catalog's `localizations` blocks. |

### 4. Render

Substitute every surviving `<<name>>` with its resolved value, strip the frontmatter, and **copy everything retained verbatim** — do not rewrite, summarize, reflow, re-order, or improve the prose. Prepend the two-line generated header:

```
<!-- globalize-rules v<templateVersion> | template=string-catalog | variant=<manifest-snapshot variant> | generated by globalize-guide -->
<!-- Generated file. Re-running globalize-guide overwrites it. Put your own project rules in CLAUDE.md. -->
```

Write the result to `.claude/globalize-rules.md`, overwriting any file left by an earlier run.

**`.claude/globalize-rules.md` should be committed.** It is team-shared coding guidance, exactly like `CLAUDE.md` — every contributor's agent needs it. Do **not** add it to `.gitignore`; it is not a `.globalize/` progress artifact.

### 5. Self-check the generated file

All four must hold:

- zero occurrences of `<!-- if:`, `<!-- else -->`, `<!-- /if -->`
- zero occurrences of `<<`
- the header is on line 1
- the line count is within the template's `budget` for the resolved conditions

### 6. Fail closed

If **any** surviving condition or value can't be resolved, or the self-check fails: **never write a partial file.** Delete anything already written to `.claude/globalize-rules.md`, then:

- **Guided mode** — ask the user for the specific value. `catalogPath`, `sourceLocale`, and `targetLocales` are all one-line answers ("Which `.xcstrings` file is the app's default table?", "Which locale is the source?"), and getting one beats shipping either wrong rules or none. Resolve, re-render, re-check. Only if the user can't answer, or the self-check still fails, stop this step and say which key or check failed.
- **Unguided mode** — don't block the run. Skip the step and record `⚠ iOS coding rules not generated (catalogPath unresolved) — no rules file installed` in the end-of-run summary.

Either way a **core step did not complete**, so surface it instead of letting the run drift into conversion: report `generate_coding_rules` as failed, leave it unchecked in `plan.md`, and tell the orchestrator that Phase 3 has no `.claude/globalize-rules.md` to wrap against. The user then either supplies the missing value and re-runs this step, or converts knowing the wrap subagents are working without this project's rules.

There is no generic-rules fallback: `string-catalog.code.md` was deleted when this variant moved to a template, so the template is the only source of truth for these rules. Installing nothing is recoverable — re-run this step. Installing rules that name the wrong catalog path, or that omit `bundle: .module` on a Swift package, is not; the agent follows them into a bug on every future edit and nothing signals it.

### 7. Optional — import it from `CLAUDE.md` (`install_coding_rules`)

**Only if the user selected the coding-rules import in `SKILL.md §1.10`** — this edits a file the user owns. Skip in silence otherwise; `.claude/globalize-rules.md` is on disk either way, and the user can add the import later. Skip it too if sub-step 6 fired and no rules file was written: an `@` line pointing at a missing file opens every future session with a dangling import.

The import is what carries the rules past setup: Claude Code doesn't reliably auto-trigger passive "coding rules" references during routine edits, but an `@`-imported file loads into every session's context.

Check whether `CLAUDE.md` exists at the project root.

- **If it doesn't exist**, create it:
  ```
  # Project Instructions

  @.claude/globalize-rules.md
  ```

- **If it exists**, describe the change to the user ("I'll append `@.claude/globalize-rules.md` to your CLAUDE.md so the String Catalog coding rules auto-load every session") and wait for confirmation in guided mode before appending. Put the line at the end of the file on its own line. Do not remove or reorder existing content.

If the exact `@` line is already present, skip silently — this sub-step is idempotent.

Tell the user: "The first time you start a Claude Code session in this project, you'll see a one-time prompt asking to approve the `@` import. Approve it — otherwise the rules won't load."

Verify: in a fresh session, ask Claude "how should I author a plural string in this project?" — the answer should reference catalog `variations.plural` with CLDR categories (not ICU) from the generated file.

---

## Tooling Floor — No Pins, No Install

This variant has **no package pins** and **no install** of any kind — the architectural departure from every other globalize-guide variant.

- **Build-time floor:** String Catalogs require **Xcode 15** or newer to build (the catalog `version` is `"1.0"` for Xcode 15+). This is a *tooling* floor, not a runtime one.
- **No runtime floor / no minimum deployment target:** adopting a catalog adds **no minimum deployment target** and imposes **no deployment-target floor**. At build time the catalog compiles down to legacy `.strings` + `.stringsdict`, which the OS has supported for years, so apps targeting old iOS versions are unaffected.
- **`xcstringstool` is toolchain-bundled:** the catalog CLI (`print`/`compile`/`sync`/`extract`) ships inside the Xcode toolchain. Invoke it via `xcrun xcstringstool` — there is nothing to install. (`xcodebuild -exportLocalizations` / `-importLocalizations` provides the XLIFF round-trip, also toolchain-bundled.)
- **No pins:** because nothing is installed, there are no SemVer pins to maintain for this variant. The `packages` entry in the manifest is empty.

---

## Common Gotchas

- **Catalog stays empty after a build** — `SWIFT_EMIT_LOC_STRINGS` is not `YES` (Step 4), or the localizable strings are not literals. The compiler can only extract a *literal* key; `Text(variable)` / `String(localized: variable)` are skipped silently.
- **A `String` variable in `Text` renders untranslated** — `Text(title)` where `title` is a `String` does not localize. Wrap with `Text(LocalizedStringKey(title))` or resolve via `String(localized:)`. See the generated coding rules (Step 8).
- **SPM strings render as raw keys at runtime** — the lookup is hitting the main app bundle, not the package. Pass `bundle: .module` (Step 6); confirm the target declares `resources:` so `Bundle.module` is generated.
- **Plural shows the wrong form** — plurals are not authored in source as ICU. There is **no ICU MessageFormat** here; author plurals as catalog `variations.plural.<category>` (CLDR `zero`/`one`/`two`/`few`/`many`/`other`). See the generated coding rules (Step 8).
- **Editing English text orphans a translation** — when the literal is the key, changing the English source changes the key; the old entry goes stale and the new key starts untranslated. For churny copy, opt in to a symbolic key with a `defaultValue` (see the generated coding rules, Step 8).
- **Stale entries piling up** — removed source strings are marked stale, not deleted. Clean them in the catalog editor periodically; the compiler will not remove them for you.
- **Multiple tables** — additional tables (`InfoPlist.xcstrings`, custom) are separate catalogs. Connect them in Phase 4 with a `**/*.xcstrings` pattern; do not merge them into `Localizable.xcstrings`.
- **No Xcode on the machine** — catalogs can be authored by hand, but extraction and the `xcrun xcstringstool` round-trip need Xcode 15+. Build-verify on a Mac.

---

## Quick Start: Using the String Catalog

The catalog is now configured. These are the patterns you'll use most — the coding rules enforce them:

**SwiftUI — literals auto-localize:**

```swift
// Extracted into Localizable.xcstrings with key "Book this room"
Text("Book this room")
```

**UIKit / plain Swift — `String(localized:)`:**

```swift
label.text = String(localized: "Book this room",
                    comment: "Button label on the room search results page")
```

**SPM — bundle-scoped:**

```swift
let title = String(localized: "Book this room", bundle: .module)
```

**Interpolation (becomes a C-style specifier on extraction):**

```swift
Text("Hi \(name)")   // extracted as "Hi %@"
```

**Plurals** are authored in the catalog (`variations.plural`), not in source as ICU — write one count-bearing literal and let the catalog hold the forms:

```swift
Text("\(count) rooms")
```

For comprehensive wrapping patterns, comments, positional specifiers, plural authoring, and what not to wrap, see the convert phase (`string-catalog.convert.md`). Ongoing coding rules are generated into `.claude/globalize-rules.md` in Step 8 and loaded automatically via `@import`.

---

## Next Steps

Setup is complete. Here's what typically comes next:

### Wrap existing strings

This setup phase scaffolded the catalog and enabled extraction but did **not** make existing hardcoded strings localizable. Run the convert phase (`string-catalog.convert.md`) — it finds hardcoded UI strings in `.swift` views and controllers, makes them localizable (`Text` literals, `String(localized:)`, `comment:` context), and authors plurals as catalog variations. A build then populates the catalog.

### Connect a translation service

With `Localizable.xcstrings` populated, connect to Globalize using the `globalize-now-project-setup` skill (it points you at `globalize-now-account-setup` first if you're not signed in). The Phase-4 mapping is `fileFormat: xcstrings` with a **single-file pattern** — the catalog is one multi-locale file, so the pattern points at the file itself (`Localizable.xcstrings`, or `**/*.xcstrings` for multiple tables) with **no `{locale}` segment**. The source language is the catalog's `sourceLanguage`.

### Add a non-English locale

When adding a target locale with more than two plural categories (Russian, Polish, Arabic, Czech, Slovak, Ukrainian, …), register it in the project localizations (Step 5) and supply all required CLDR categories (`zero`, `one`, `two`, `few`, `many`, `other` as applicable) in the catalog's `variations.plural` for that locale. The system applies the correct CLDR rule per locale at runtime — no extra package needed.
