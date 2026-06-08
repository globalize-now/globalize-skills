# iOS String Catalog (`.xcstrings`) Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a native-Apple (Swift) language branch to the `i18n-guide` skill that detects an iOS/SPM project, sets up an Apple String Catalog (`Localizable.xcstrings`), makes strings localizable, and connects the single multi-locale catalog to Globalize.now as the `xcstrings` fileFormat with a **single-file, no-`{locale}` pattern**.

**Architecture:** iOS is platform + built-in i18n in one (like Rails is framework + built-in i18n). SwiftUI / UIKit / SPM differ only in *setup* details, not catalog mechanics, so they share a single `native` slot with **three reference files** (`string-catalog.{setup,convert,code}.md`) that branch *internally* by stack. Three manifest variants (`ios-swiftui-string-catalog`, `ios-uikit-string-catalog`, `ios-spm-string-catalog`) all point at those same three files; they differ only in their `match` predicate and the variant id surfaced as the §1.5 confirmation label. The SKILL.md orchestrator gains an additive `language: "swift"` dimension plus three structural fields (`platform`, `buildSystem`, `uiFramework`), and two existing JS-only STOP guards are flipped from `language !== "ruby"` to `language === "js-ts"` (scales to N platforms; without it a Swift project falsely STOPs). The JS and Ruby paths are untouched. This is the first variant whose `packages` list is **empty** — native localization ships with the SDK, so there is no install step.

**Tech Stack:** Markdown skill references, `manifest.json` (validated with `jq` — no JSON-schema file exists in-repo), Apple String Catalogs (Xcode 15+ tooling floor, no runtime/deployment-target floor), `xcstringstool` (toolchain-bundled, invoked via `xcrun`), Globalize.now `xcstrings` fileFormat.

**Reference (read before authoring):** spec `docs/superpowers/specs/2026-06-08-ios-xcstrings-support-design.md`; research `reports/ios-xcstrings-research-2026-06-07.md`. **Template siblings to copy structure from:** the Rails sibling — `references/languages/ruby/frameworks/rails/rails.setup.md` (Out-of-Scope + Step-Risk + Setup-Mode idiom, built-in-i18n / empty-packages framing), `references/languages/ruby/frameworks/rails/rails.convert.md` (location-aware wrapping + audit idiom), `references/languages/ruby/frameworks/rails/rails.code.md` (passive `code.md` idiom). The Rails plan `docs/superpowers/plans/2026-06-05-rails-i18n-support.md` is the proven plan template this mirrors.

**Authoring note:** Each reference-file task names its template sibling and the load-bearing content that MUST appear verbatim. The surrounding prose is authored at execution time by reading the named sibling as the structural template (this repo is subagent-driven and self-contained per skill) — match the sibling's section headings, tone, and guided/unguided idiom. Do **not** invent package/API names; everything technical is pinned in the spec/research and re-verified empirically in Task 8.

**Decisions locked during planning** (resolved with the advisor + user; surface these in the PR body):

1. **`supportLevel: "experimental"`** for all three iOS variants (user choice), not the spec's `"stable"`. The live `fileFormat: xcstrings` round-trip and the four backend assumptions can't be confirmed without platform auth (deferred to Task 8's non-blocking arm); experimental matches the Android sibling precedent. Bump to stable once the live round-trip is confirmed.
2. **Mixed-uiFramework routing — the `@main` entry point decides.** `import SwiftUI` + `struct …: App` + `@main` → `swiftui` (even with a `UIApplicationDelegateAdaptor`, which the research flags as common); `@UIApplicationMain`/AppDelegate-or-storyboard entry with no SwiftUI `App` → `uikit`; genuine ambiguity → **default `swiftui`**. Detection therefore never emits `"mixed"` as an unroutable value — it resolves to exactly one of swiftui/uikit. This keeps "exactly one variant matches → §1.5 confirmation, not a 3-way prompt." Rationale: all three variants reference the *same three files*, so the swiftui-vs-uikit distinction is **purely cosmetic** (it changes the confirmation label and which convert section leads, nothing about what work is done) — so a default is safe.
3. **`buildSystem: "xcode"` added to the two app variants' match** (spec open item #2). Keeps the app variants disjoint from the SPM variant regardless of how `platform`/`uiFramework` resolve for an SPM package.
4. **Language-decision precedence: Gemfile(rails) → ruby; else root `package.json` → js-ts; else Swift signals → swift; else unknown.** A root `package.json` beats native-Apple signals, so React Native / Capacitor / Flutter projects route to the js-ts path (and its existing handling), not the native iOS path. Consistent with the Android sibling decision. The spec §1.1 lists Swift detection without this precedence caveat — this is a deliberate refinement.
5. **Detection MUST always populate `platform`, `buildSystem`, `uiFramework`** for a Swift detection (matcher correctness: a `match` structural key is checked by *equality* against the same-named detection field, so an undefined field fails the match and the app variants would never match).

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `skills/i18n-guide/references/languages/ios/native/string-catalog.code.md` | PASSIVE coding rules (`@import`-wired): Text literals / `String(localized:)`, `%@`/`%lld`, NO ICU, plural authoring | Create |
| `…/ios/native/string-catalog.setup.md` | Phase-2 setup (create catalog, `SWIFT_EMIT_LOC_STRINGS`, register locales, SPM `defaultLocalization`/`Bundle.module`; no install) | Create |
| `…/ios/native/string-catalog.convert.md` | Phase-3 make-strings-localizable + plurals via `variations`; build/`xcstringstool` populates | Create |
| `skills/i18n-guide/manifest.json` | Add 3 iOS variants (empty `packages`, `experimental`) | Modify |
| `skills/i18n-guide/SKILL.md` | `swift` language + `platform`/`buildSystem`/`uiFramework` fields, Swift detection, STOP-guard flip, Swift STOPs, matcher prose, recommendation, install no-op, catalog-integrity verify, Phase-4 single-file mapping | Modify |
| `skills/globalize-now-cli-setup/SKILL.md` | Relax "`{locale}` required"; add `xcstrings` single-file derivation row | Modify |
| `skills/globalize-now-cli-use/SKILL.md` | Note `xcstrings` single-file / no-`{locale}` pattern in Patterns Management | Modify |
| `…/ios/native/string-catalog.setup.md` (tooling floor) + verification report | Document Xcode 15+ tooling floor, no pins; no central pin-tracker exists | Modify/Create |

---

## Task 1: Scaffold iOS branch + passive `string-catalog.code.md`

**Files:**
- Create: `skills/i18n-guide/references/languages/ios/native/string-catalog.code.md`

**Template sibling:** `references/languages/ruby/frameworks/rails/rails.code.md` (passive-rules frontmatter `user_invocable: false`, per-section "always / never" idiom, "What NOT to wrap" section).

- [ ] **Step 1: Write the validation check (expect fail)**

```bash
cd skills/i18n-guide
F=references/languages/ios/native/string-catalog.code.md
test -f "$F" \
 && grep -q "String(localized:" "$F" \
 && grep -q "Text(" "$F" \
 && grep -qi "verbatim" "$F" \
 && grep -q "%lld" "$F" && grep -q "%@" "$F" \
 && grep -qi "NOT ICU\|no ICU\|not ICU MessageFormat\|variations" "$F" \
 && grep -qi "comment:" "$F" \
 && echo PASS || echo FAIL
```
Expected now: `FAIL` (file absent).

- [ ] **Step 2: Author `string-catalog.code.md`.** Frontmatter mirrors `rails.code.md` (`name: ios-string-catalog-code`, `user_invocable: false`, a `description` that triggers on Swift/SwiftUI/UIKit UI edits). Must contain these load-bearing PASSIVE rules:
  - **Prefer auto-localizing literals.** SwiftUI `Text("Book this room")` auto-localizes the literal. A `String` *variable* (`Text(title)`) does **not** localize — wrap with `Text(LocalizedStringKey(title))` or use `String(localized:)`. Opt a literal out with **`Text(verbatim:)`**.
  - **UIKit / non-View code:** use `String(localized:)` (preferred, modern Foundation) over legacy `NSLocalizedString`. Xcode cannot extract `NSLocalizedString` when the key is a variable/`nil`/empty.
  - **Add `comment:`** for translator context — it flows into the catalog `comment` field. Show `String(localized: "Book this room", comment: "Button label on the room search results page")`.
  - **Literal-key default** (Apple default): `Text("Book this room")` → key `"Book this room"`. Document the caveat: editing the English source string orphans existing translations (the key changes). Mention symbolic keys + `defaultValue` (the `String(localized:"room.book.button", defaultValue:"Book this room")` overload) as an **opt-in**, not the default.
  - **Interpolation = C-style format specifiers**: `%@` (object/string), `%lld` (Int64), positional `%1$@` / `%2$lld` for reordering. Swift interpolation (`"Hi \(name)"`) is converted to a specifier during extraction. Use positional specifiers when word order may differ across languages.
  - **Plurals — NOT ICU.** There is no ICU MessageFormat (`{count, plural, …}`) in this format. Plurals are authored as catalog **`variations.plural.<category>`** (CLDR `zero/one/two/few/many/other`) with a `%lld` count specifier — compiled to `.stringsdict`. Show the verified JSON shape (from Task 8 / spec). Never hand-write an ICU body in Swift.
  - **Don't fight the serializer.** Xcode owns the `.xcstrings` serialization (keys sorted, 2-space indent, `version` last) — don't hand-reorder it.
  - **What NOT to wrap:** `Text(verbatim:)` content, non-UI strings (log messages, identifiers, keys, `UserDefaults` keys, notification names, URL/API strings, enum raw values, accessibility identifiers used for testing), CSS-like constants. (Mirror the Rails "What NOT to wrap" section, adapted to Swift.)

- [ ] **Step 3: Run the validation check.** Run the Step-1 block. Expected: `PASS`.

- [ ] **Step 4: Commit**

```bash
git add skills/i18n-guide/references/languages/ios/native/string-catalog.code.md
git commit -m "feat(skill): add iOS String Catalog passive coding rules (string-catalog.code.md)"
```

---

## Task 2: `string-catalog.setup.md` (Phase 2)

**Files:**
- Create: `skills/i18n-guide/references/languages/ios/native/string-catalog.setup.md`

**Template sibling:** `references/languages/ruby/frameworks/rails/rails.setup.md` (Out-of-Scope, Step Risk Classification, Setup Mode guided/unguided, built-in-i18n / empty-packages framing, "No version gating"-style section).

- [ ] **Step 1: Validation check (expect fail)**

```bash
cd skills/i18n-guide
F=references/languages/ios/native/string-catalog.setup.md
test -f "$F" \
 && grep -q "Localizable.xcstrings" "$F" \
 && grep -q "SWIFT_EMIT_LOC_STRINGS" "$F" \
 && grep -q "defaultLocalization" "$F" \
 && grep -q "Bundle.module" "$F" \
 && grep -qi "CFBundleLocalizations\|\.lproj\|known regions\|project localizations" "$F" \
 && grep -qi "no install\|no package\|ships with the SDK\|built into" "$F" \
 && grep -qi "Convert to String Catalog" "$F" \
 && echo PASS || echo FAIL
```
Expected: `FAIL`.

- [ ] **Step 2: Author `string-catalog.setup.md`.** Required content:
  - **Out of Scope:** macOS/watchOS/tvOS/Mac-Catalyst beyond shared catalog mechanics; Objective-C-first stacks (legacy `NSLocalizedString` covered only as a convert *input* via `--legacy-localizable-strings`); maintaining dual legacy `.strings`/`.stringsdict` authoring (we convert *to* catalogs); multiple custom tables beyond noting `**/*.xcstrings` handles them.
  - **Step Risk Classification** table (Detect=read-only; create catalog=additive; enable build setting / register locales=modifies-project-config → consent gate in guided mode) and the **guided/unguided Setup Mode** block, matching the sibling.
  - **No install step (explicit).** Native localization — including CLDR plural rules — is built into Foundation/SwiftUI for SwiftUI, UIKit, and SPM. There is no npm/SPM-package equivalent to install. State this explicitly (this is the empty-`packages` departure).
  - **Create the catalog:** add `Localizable.xcstrings` (the default string table) — via **File ▸ New ▸ String Catalog** in Xcode, or author a minimal valid file by hand (`{ "sourceLanguage": "<src>", "strings": {}, "version": "1.0" }`). Note multiple catalogs split *tables* (`Localizable.xcstrings`, `InfoPlist.xcstrings`), never languages.
  - **Enable build-time extraction:** the build setting **"Use Compiler to Extract Swift Strings"** = `SWIFT_EMIT_LOC_STRINGS = YES` (default-on for new projects). The compiler populates/updates the catalog on each build; removed strings are marked **stale**, not deleted (source is the source of truth).
  - **Register target locales:** add localizations to the Xcode project (Project ▸ Info ▸ Localizations / "known regions"); for the locale list also note `.lproj` dirs and Info.plist `CFBundleLocalizations` / `CFBundleDevelopmentRegion`. The development region is the source language (`sourceLanguage` in the catalog).
  - **SPM stack:** `Package.swift` needs `defaultLocalization: "<src>"` and the catalog declared as a **processed resource** (`.process("Resources")`) under `Sources/<Target>/Resources/`; access at runtime via **`Bundle.module`** / `String(localized:bundle: .module)`. Show the verified `Package.swift` snippet from the research report (§3, swift-tools-version 5.9 example).
  - **Optional legacy migration (non-blocking):** existing `.strings`/`.stringsdict` → **Edit ▸ Convert to String Catalog** (per *table*; formats can coexist during migration). Do not maintain dual formats afterward.
  - **Tooling floor section** (covers Task 7): catalogs require **Xcode 15+** at build time but impose **no minimum deployment target** (a catalog compiles down to legacy `.strings` + `.stringsdict`). `xcstringstool` is toolchain-bundled (invoke via `xcrun xcstringstool`) — no install. There are **no package pins** for this variant.
  - **Quick Start** + **Next Steps** sections mirroring the sibling (point at `string-catalog.convert.md` for wrapping and `globalize-now-cli-setup` for Phase 4 with `fileFormat: xcstrings`, single-file pattern).

- [ ] **Step 3: Run the validation check.** Expected: `PASS`.

- [ ] **Step 4: Commit**

```bash
git add skills/i18n-guide/references/languages/ios/native/string-catalog.setup.md
git commit -m "feat(skill): add iOS String Catalog setup reference (string-catalog.setup.md)"
```

---

## Task 3: `string-catalog.convert.md` (Phase 3)

**Files:**
- Create: `skills/i18n-guide/references/languages/ios/native/string-catalog.convert.md`

**Template sibling:** `references/languages/ruby/frameworks/rails/rails.convert.md` (location-aware wrapping, "do-not-touch", run-steps with exact commands, audit idiom).

- [ ] **Step 1: Validation check (expect fail)**

```bash
cd skills/i18n-guide
F=references/languages/ios/native/string-catalog.convert.md
test -f "$F" \
 && grep -q "String(localized:" "$F" \
 && grep -q "LocalizedStringKey" "$F" \
 && grep -q "verbatim" "$F" \
 && grep -q "variations" "$F" && grep -q '"plural"' "$F" \
 && grep -q "xcstringstool" "$F" \
 && grep -q "modern-localizable-strings" "$F" \
 && grep -qi "NOT ICU\|no ICU\|not ICU MessageFormat" "$F" \
 && echo PASS || echo FAIL
```
Expected: `FAIL`.

- [ ] **Step 2: Author `string-catalog.convert.md`.** Required content:
  - **What "convert" means here:** make strings *localizable in source*, then a build (or `xcstringstool`) populates the catalog. There is **no codemod-then-extract CLI step** like `lingui extract` — extraction is build-time (`SWIFT_EMIT_LOC_STRINGS`).
  - **Location-aware wrapping:**
    - SwiftUI: `Text("…")` literals auto-localize (often nothing to change); `String` *variables* need `Text(LocalizedStringKey(…))` or `String(localized:)`; opt out with `Text(verbatim:)`.
    - UIKit / Foundation: `String(localized: "…", comment: "…")` (preferred) or legacy `NSLocalizedString(_:comment:)`. Interface Builder strings localize through the same catalog.
    - Add `comment:` arguments for translator context (flows to the catalog `comment`).
  - **Literal-key default** (with the English-edit-orphans-translations caveat) + symbolic-key + `defaultValue` opt-in.
  - **Interpolation = C-style specifiers** (`%@`, `%lld`, positional `%1$@`); Swift interpolation is converted on extraction.
  - **Plurals authored as catalog `variations.plural.<category>`** (CLDR) — **never ICU.** Show the verified JSON shape (a `%lld rooms` entry with `one`/`other` under `localizations.<src>.variations.plural`, from Task 8 / spec §"Key platform facts"). Note targets can carry **more** CLDR categories than the source (e.g. Russian `one/few/many/other` from English `one/other`).
  - **Populate + verify the catalog:** a normal Xcode build with `SWIFT_EMIT_LOC_STRINGS = YES` populates it. The Xcode-absent / CLI path: `xcrun xcstringstool extract <sources> --modern-localizable-strings [--legacy-localizable-strings] | xcrun xcstringstool sync <catalog>` (lightweight parsing — no type checking, so the compiler build remains authoritative), then `xcrun xcstringstool print <catalog>` / JSON-parse to confirm validity and key coverage. Confirm exact flags with `xcrun xcstringstool extract --help` if the Xcode version differs (floor: Xcode 15; verified on 26.4.1).
  - **Key-as-source norm:** when the key *is* the source string, there is no explicit source `value`; the entry carries no `extractionState`/`localizations`, just an optional `comment`.
  - **Do-not-touch:** `Text(verbatim:)`, non-UI strings/identifiers, `Package.swift`/`Info.plist` keys themselves (Info.plist *values* localize via `InfoPlist.xcstrings`, out of v1 default scope).
  - **Run steps** (exact `xcrun xcstringstool …` commands as above).

- [ ] **Step 3: Run the validation check.** Expected: `PASS`.

- [ ] **Step 4: Commit**

```bash
git add skills/i18n-guide/references/languages/ios/native/string-catalog.convert.md
git commit -m "feat(skill): add iOS String Catalog convert reference (string-catalog.convert.md)"
```

---

## Task 4: `manifest.json` — three iOS variants

**Files:**
- Modify: `skills/i18n-guide/manifest.json`

**Depends on Tasks 1–3** (referenced paths must exist).

- [ ] **Step 1: Validation check (expect fail)**

```bash
cd skills/i18n-guide
jq -e '.stacks[] | select(.variant=="ios-swiftui-string-catalog")' manifest.json >/dev/null 2>&1 && echo PASS || echo FAIL
```
Expected: `FAIL`.

- [ ] **Step 2: Add the three variants** to `stacks[]`. **Match the existing entry shape exactly** (entries carry `variant`, `match`, `supportLevel`, `packages` {runtime, dev}, `references`; they do **NOT** carry any `connect`/`fileFormat` key — the Phase-4 `xcstrings` mapping lives in `SKILL.md` prose, handled in Task 5, **not here**). `packages` is **empty** by design (native, no install). `supportLevel` is **`experimental`** (locked decision #1). All three reference the **same three files**. App variants key on `buildSystem: "xcode"` (locked decision #3) for SPM-disjointness:

```json
{
  "variant": "ios-swiftui-string-catalog",
  "match": { "language": "swift", "buildSystem": "xcode", "platform": "ios", "uiFramework": "swiftui", "library": "string-catalog" },
  "supportLevel": "experimental",
  "packages": { "runtime": [], "dev": [] },
  "references": {
    "setup": ["references/languages/ios/native/string-catalog.setup.md"],
    "convert": ["references/languages/ios/native/string-catalog.convert.md"],
    "code": ["references/languages/ios/native/string-catalog.code.md"]
  }
},
{
  "variant": "ios-uikit-string-catalog",
  "match": { "language": "swift", "buildSystem": "xcode", "platform": "ios", "uiFramework": "uikit", "library": "string-catalog" },
  "supportLevel": "experimental",
  "packages": { "runtime": [], "dev": [] },
  "references": {
    "setup": ["references/languages/ios/native/string-catalog.setup.md"],
    "convert": ["references/languages/ios/native/string-catalog.convert.md"],
    "code": ["references/languages/ios/native/string-catalog.code.md"]
  }
},
{
  "variant": "ios-spm-string-catalog",
  "match": { "language": "swift", "buildSystem": "spm", "library": "string-catalog" },
  "supportLevel": "experimental",
  "packages": { "runtime": [], "dev": [] },
  "references": {
    "setup": ["references/languages/ios/native/string-catalog.setup.md"],
    "convert": ["references/languages/ios/native/string-catalog.convert.md"],
    "code": ["references/languages/ios/native/string-catalog.code.md"]
  }
}
```
Notes: the SPM variant intentionally omits `platform`/`uiFramework` (a package is UI-framework-agnostic and need not be iOS). Because every `match` structural key is checked by equality against detection, the app variants' `platform: "ios"` + `uiFramework` + `buildSystem: "xcode"` cannot match an SPM detection (`buildSystem: "spm"`), and the SPM variant's `buildSystem: "spm"` cannot match an Xcode-app detection — disjoint. No `gems`/`packages` content beyond the empty arrays (unlike Rails, which carried an informational `gems` block; iOS has nothing to install).

- [ ] **Step 3: Validate JSON + path resolution**

```bash
cd skills/i18n-guide
jq -e '.stacks[] | select(.variant|startswith("ios-"))' manifest.json >/dev/null && echo "variants OK"
# count: expect 3 ios- variants
jq '[.stacks[] | select(.variant|startswith("ios-"))] | length' manifest.json
# every referenced file must exist:
jq -r '.stacks[] | select(.variant|startswith("ios-")) | .references | to_entries[].value[]' manifest.json \
  | sort -u | while read p; do test -f "$p" && echo "ok  $p" || echo "MISSING $p"; done
# confirm experimental + empty packages:
jq -r '.stacks[] | select(.variant|startswith("ios-")) | "\(.variant) \(.supportLevel) rt=\(.packages.runtime|length) dev=\(.packages.dev|length)"' manifest.json
```
Expected: `variants OK`; count `3`; every path `ok` (no `MISSING`); each line shows `experimental rt=0 dev=0`.

- [ ] **Step 4: Commit**

```bash
git add skills/i18n-guide/manifest.json
git commit -m "feat(skill): add three iOS String Catalog manifest variants (xcstrings, experimental)"
```

---

## Task 5: `SKILL.md` orchestrator — Swift detection + dispatch (most invasive)

**Files:**
- Modify: `skills/i18n-guide/SKILL.md` (§1.1 detection schema + rules + inspect-subagent first-decision + user-facing messages; §1.2 STOP-guard flip + Swift STOPs; §1.3 matcher prose; §1.5 recommendation; §2.0 install no-op; §2.2/§3.5 catalog-integrity verify; §4.5 Phase-4 single-file mapping).

**This is the riskiest, most invasive edit — keep additive; the JS and Ruby paths must be unchanged except the two STOP-guard flips (which are no-ops for both JS and Ruby).**

- [ ] **Step 1: Snapshot existing paths are intact (regression guard) + new-token check (expect fail for new tokens)**

```bash
cd skills/i18n-guide
# Existing markers MUST remain after the edit (record current counts):
grep -c 'react-scripts' SKILL.md; grep -c 'language !== "ruby"' SKILL.md; grep -c 'rails-yaml\|yaml-rails' SKILL.md
# New Swift tokens not present yet:
grep -qi 'swift\|xcstrings\|SWIFT_EMIT_LOC_STRINGS\|uiFramework\|buildSystem\|\.xcodeproj' SKILL.md && echo HAS_SWIFT || echo NO_SWIFT
```
Expected: `react-scripts` count noted; **`language !== "ruby"` count = 2** (the two rows we will flip); Rails markers present; `NO_SWIFT`.

- [ ] **Step 2: Edit SKILL.md** — additive Swift support + the two STOP-guard flips. Apply each sub-edit:

  **(a) §1.1 inspect-subagent first-decision (prose at ~line 83).** Extend the language-decision order to: `Gemfile`/`Gemfile.lock` (containing `rails`)/`bin/rails`/`config/application.rb` → **Ruby**; **else** a `package.json` present → **js-ts** (a root `package.json` beats native-Apple signals, so React Native / Capacitor / Flutter route here — locked decision #4); **else** `*.xcodeproj`/`*.xcworkspace`/`Package.swift`/`*.swift` present → **swift**; else `unknown`. Tell the subagent to read the Swift signals table (below) instead of the JS/Ruby ones when language is swift.

  **(b) §1.1 detection JSON schema.** Add `"swift"` to the `language` enum (`"js-ts" | "ruby" | "swift" | "unknown"`). Add three new fields (after `packageManager`):
  - `"platform": "ios" | "macos" | "web" | null`
  - `"buildSystem": "xcode" | "spm" | null`
  - `"uiFramework": "swiftui" | "uikit" | null`

  Add `"string-catalog"` to the `existing.library` enum. Document that for a Swift detection these three fields **must always be populated** (matcher correctness, locked decision #5); for js-ts/ruby detections they are `null` (and no JS/Ruby manifest entry declares them, so they never affect matching). Add `"swift"` handling for `packageManager` (set to `null`/`"spm"` as appropriate — Swift has no npm-style package manager; SPM is the build system, recorded under `buildSystem`).

  **(c) §1.1 Swift/Apple detection-rules table** (new, applied only when `language === "swift"`), mirroring the Ruby table:
  | Field | How to detect |
  |---|---|
  | `language` | `*.xcodeproj`/`*.xcworkspace`, `Package.swift`, or `*.swift` present → `swift` (only reached when no `Gemfile`-rails and no root `package.json`). |
  | `buildSystem` | `Package.swift` present and **no** `.xcodeproj`/`.xcworkspace` → `spm`; `.xcodeproj`/`.xcworkspace` present → `xcode`. |
  | `uiFramework` | **Entry-point heuristic (the `@main` decides — locked decision #2):** `import SwiftUI` + `struct …: App` + `@main` → `swiftui` (even with a `UIApplicationDelegateAdaptor`); `@UIApplicationMain`/AppDelegate or SceneDelegate (`UIApplicationDelegate`/`UIResponder`) and/or `.storyboard`/`.xib` with no SwiftUI `App` → `uikit`; genuine ambiguity → **default `swiftui`**. For an SPM library where no app entry point exists, this is a don't-care — set `null` (the SPM variant does not key on it). Never emit an unroutable `"mixed"`. |
  | `platform` | iOS deployment target / `IPHONEOS_DEPLOYMENT_TARGET` / iOS SDK in project; default `ios` for an app target. SPM library → `null` (the SPM variant does not key on it). |
  | `existing.library` | `.xcstrings` present anywhere → `string-catalog`; else `none`. |
  | `existing.configured` | a `.xcstrings` file present. |
  | `existing.catalogsScaffolded` | same (a `.xcstrings` present). |
  | `existing.stringsWrapped` | sample `*.swift`; count files using `String(localized:`/`Text("…")` literals vs files with bare user-visible `String` literals: >80% → "yes", >20% → "partial", else "no". |
  | `candidateFiles` | glob `**/*.swift` (exclude tests/`Package.swift`), grep for user-visible string literals not already in `String(localized:`/`Text(`/`NSLocalizedString(`. Sorted by match count desc. |
  | `localeSignals` | `.lproj` dirs; Info.plist `CFBundleLocalizations`/`CFBundleDevelopmentRegion`; existing `.strings`/`.stringsdict`/`.xcstrings`; README language mentions. |

  **(d) §1.1 user-facing messages (after inspect returns, ~line 160).** Add a Swift branch (omit `router`/`compiler`, which are not meaningful): "Scan done. Detected: **iOS** (**{uiFramework}**, **{buildSystem}**). Existing i18n: **{existing.library}** ({configured?}). Found **{candidateFiles.length}** files with hardcoded strings. Next, a few questions to shape the setup plan."

  **(e) §1.2 — FLIP the two JS-only STOP guards.** Change the two rows currently guarded by `language !== "ruby"` to `language === "js-ts"`:
  - Row: `language !== "ruby" AND react === false AND vue === false AND svelte === false` → **`language === "js-ts"` AND react === false AND vue === false AND svelte === false**.
  - Row: `language !== "ruby" AND custom build pipeline (no vite.config/next.config/…)` → **`language === "js-ts"` AND custom build pipeline …**.

  This is a no-op for JS (`!== "ruby"` and `=== "js-ts"` agree for genuine JS) and for Ruby (both false), but it stops a Swift project from falsely STOPping (under the old form, `swift !== "ruby"` is true and both guards would fire because react/vue/svelte are all false and there's no vite/next config). Then update the **Ruby compatibility prose** (~line 184) that currently reads "the two guarded JS rows above … are exempted for Ruby via their `language !== "ruby"` guard" → reword to "…exempted for non-JS languages (Ruby and Swift) via their `language === "js-ts"` guard."

  **(f) §1.2 Swift compatibility rules** (new block, applied only when `language === "swift"`), mirroring the Ruby block:
  | Condition | Action |
  |---|---|
  | `language === "swift"` AND a `.xcstrings` cannot be created and none exists (e.g. legacy `.strings`-only on a pre-Xcode-15 toolchain with no migration path) | **Note (non-blocking where possible).** Offer the **Edit ▸ Convert to String Catalog** migration; only STOP if there is genuinely no path to a catalog. |
  | `language === "swift"` AND `platform` is a non-iOS Apple target out of v1 scope (macOS/watchOS/tvOS) with no iOS/SPM target | **STOP (scope).** "v1 of the iOS String Catalog path targets iOS apps and Swift packages. {platform} is out of scope — the shared catalog mechanics may still apply manually." |

  No new name-collision guardrail is needed for Swift.

  **(g) §1.3 matcher prose.** Add a sentence noting `platform`/`buildSystem`/`uiFramework` are ordinary **structural keys** (each must equal the same-named detection field), discriminating *among* iOS variants — **not** a new special-cased matcher axis (only `language`'s absent⇒`js-ts` default remains special). State that a `match.language: "swift"` matches only `detection.language === "swift"`, keeping the Swift / JS / Ruby entry sets disjoint. **No matcher-logic change is needed** beyond this prose — the existing generic structural-key equality already handles the new keys. Add the hand-trace from the spec (§"Matcher hand-trace") as the load-bearing justification.

  **(h) §1.5 recommendation table.** Add a row above the catch-all: `language === "swift"` → **"Apple String Catalog (built-in)"**, rationale "Apple ships a full localization stack (String Catalogs, `String(localized:)`/`Text` literals, `.stringsdict`/`variations` plurals via CLDR) built into the SDK — no third-party library or install needed." Note it is surfaced as a **confirmation** (exactly one variant matches via the entry-point/buildSystem heuristic), not a 3-way prompt.

  **(i) §2.0 install — no-op for Swift.** Extend the existing bundler no-op note: for `language === "swift"` both package lists are empty by design (native localization ships with the SDK), so §2.0 is a no-op for Swift too — not an error.

  **(j) §2.2 + §3.5 verify — catalog-integrity check.** Apple has no `tsc`/`build`. Add a Swift arm that swaps in a catalog-integrity check: `xcrun xcstringstool extract <sources> --modern-localizable-strings [--legacy-localizable-strings]` over candidate sources → `xcrun xcstringstool sync <catalog>` → `xcrun xcstringstool print`/JSON-parse to confirm the catalog is valid and covers used keys. Map into the existing `verificationResult` shape: set JS-only `typecheck`/`build` to `null`; record the catalog-integrity pass/fail. **Graceful degradation:** if `xcrun xcstringstool` is absent (no Xcode), author + static-JSON-validate the catalog (parse it as JSON, check `sourceLanguage`/`strings`/`version`) and mark build-verify **deferred** (not failed). §3 convert: wrap subagents make strings localizable per `string-catalog.convert.md`; **no extract/compile codemod step** (build-time / `xcstringstool` populates).

  **(k) §4.5 Phase-4 mapping (the fileFormat lives HERE).** In the Phase-4 prose around `SKILL.md:525` (the "the **file format** follows the catalog: … `po` for Lingui, `json-nested` for next-intl … `yaml-rails` for Rails" enumeration), add the **Swift arm**: `detection.language === "swift"` → **`fileFormat: "xcstrings"`** with a **single-file pattern and NO `{locale}` segment** — the source and output are the *same file*: `Localizable.xcstrings` (or `**/*.xcstrings` when multiple tables/dirs). Source locale = the catalog `sourceLanguage` / detected development region (`CFBundleDevelopmentRegion`). The importer reads/writes every locale inside the one file. Note this is the first format with no per-locale `{locale}` pattern.

- [ ] **Step 3: Validate additive edit (existing paths intact + Swift present + flip applied)**

```bash
cd skills/i18n-guide
grep -q 'react-scripts' SKILL.md && echo "JS path intact" || echo "REGRESSION: JS markers lost"
grep -q 'rails-yaml\|yaml-rails' SKILL.md && echo "Rails path intact" || echo "REGRESSION: Rails markers lost"
# the flip: no 'language !== "ruby"' should remain; the positive form should appear at least twice
test "$(grep -c 'language !== "ruby"' SKILL.md)" = "0" && echo "STOP flip applied (no !== ruby)" || echo "FAIL: !== ruby still present"
test "$(grep -c 'language === "js-ts"' SKILL.md)" -ge "2" && echo "positive js-ts guard present" || echo "FAIL: js-ts guard missing"
# Swift support present:
grep -qi 'swift' SKILL.md && grep -q 'xcstrings' SKILL.md && grep -q 'SWIFT_EMIT_LOC_STRINGS' SKILL.md \
 && grep -q 'uiFramework' SKILL.md && grep -q 'buildSystem' SKILL.md \
 && grep -q 'Apple String Catalog' SKILL.md && echo "Swift support present" || echo "FAIL"
```
Expected: `JS path intact`; `Rails path intact`; `STOP flip applied (no !== ruby)`; `positive js-ts guard present`; `Swift support present`.

- [ ] **Step 4: Hand-trace check (document in commit body).** Trace four fake `detection.json` objects through §1.2 → §1.3 → §1.5 and confirm:
  - `{language:"swift", buildSystem:"xcode", platform:"ios", uiFramework:"swiftui", existing.library:"none"}` → does **not** STOP (flipped guards require `js-ts`); §1.3 selects **only** `ios-swiftui-string-catalog` (uikit fails on `uiFramework`; spm fails on `buildSystem`; JS entries fail on absent⇒`js-ts`; `rails-yaml` fails on `language`) → §1.5 confirmation.
  - `{language:"swift", buildSystem:"spm", uiFramework:null, platform:null}` → selects **only** `ios-spm-string-catalog` (app variants fail on `buildSystem: "xcode"` ≠ `spm`).
  - `{language:"js-ts", framework:"next", router:"app", react:true}` → flipped guard is a no-op (react true), Next entries still match, iOS/Rails entries fail on `language` → **no regression**.
  - `{language:"ruby", framework:"rails"}` → flipped guards don't fire (`ruby !== js-ts`), only `rails-yaml` matches → **no regression**.

- [ ] **Step 5: Commit**

```bash
git add skills/i18n-guide/SKILL.md
git commit -m "feat(skill): wire Swift/iOS String Catalog detection + dispatch into orchestrator"
```

---

## Task 6: `globalize-now-cli-setup` + `globalize-now-cli-use` — single-file `xcstrings` pattern

**Files:**
- Modify: `skills/globalize-now-cli-setup/SKILL.md`
- Modify: `skills/globalize-now-cli-use/SKILL.md`

Both skills already list `xcstrings` as a valid `fileFormat` value — this task fixes the **pattern shape** (relaxes the "`{locale}` required" rule so the connect path produces a correct, locale-segment-free pattern for a single multi-locale file).

- [ ] **Step 1: Validation check (expect fail)**

```bash
cd /Users/arturs/Projects/globalize/globalization-skills
grep -qi 'single.file\|no .locale.\|single multi-locale' skills/globalize-now-cli-setup/SKILL.md && echo SETUP_HAS || echo SETUP_MISSING
grep -qi 'xcstrings.*single\|single.file\|no .locale.\|Localizable.xcstrings' skills/globalize-now-cli-use/SKILL.md && echo USE_HAS || echo USE_MISSING
```
Expected: `SETUP_MISSING` and `USE_MISSING`.

- [ ] **Step 2a: Edit `globalize-now-cli-setup/SKILL.md`.**
  - **Relax the "required" line** (currently `skills/globalize-now-cli-setup/SKILL.md:114`): change
    `- \`{locale}\` — locale code (required)`
    to note it is required **except** for single multi-locale file formats: e.g. `- \`{locale}\` — locale code (required for per-locale file layouts; **omitted** for single multi-locale files such as \`xcstrings\`, where one file holds every locale)`.
  - **Add an `xcstrings` row** to the "How to derive the pattern" table (currently lines 118–127), e.g.:
    | **Apple String Catalog** (`.xcstrings`) | A single multi-locale file holds every locale — there is **no `{locale}` segment**. Pattern is the catalog path itself: `Localizable.xcstrings` (default table), or `**/*.xcstrings` when there are multiple tables/dirs. `fileFormat: xcstrings`, source = the catalog `sourceLanguage` / Info.plist `CFBundleDevelopmentRegion`. |
  - The file-format table (line 146) already maps `.xcstrings → xcstrings`; leave it, and ensure the new derivation row is consistent with it.

- [ ] **Step 2b: Edit `globalize-now-cli-use/SKILL.md`.** In **Step 3.5: Patterns Management** (around lines 372–392, after the "Supported file formats:" line), add a short note: for the **`xcstrings`** format (Apple String Catalog) the pattern is a **single multi-locale file with no `{locale}` segment** — `--pattern "Localizable.xcstrings"` (or `"**/*.xcstrings"`) with `--file-format xcstrings`. Show one example `patterns create` invocation using the catalog path and no `{locale}`.

- [ ] **Step 3: Validation check.** Run the Step-1 greps. Expected: `SETUP_HAS` and `USE_HAS`.

- [ ] **Step 4: Commit**

```bash
git add skills/globalize-now-cli-setup/SKILL.md skills/globalize-now-cli-use/SKILL.md
git commit -m "feat(skill): support single-file no-{locale} xcstrings pattern in cli-setup/cli-use"
```

---

## Task 7: Tooling-floor documentation (the "library-checks" component)

**Files:**
- (Covered in Task 2's `string-catalog.setup.md` "Tooling floor section"; this task is the explicit confirmation + the no-pin note.)

Unlike every other variant, iOS has **no package to pin** — localization ships with the SDK. The repo's `evals/library-checks/*.sh` are per-library **Layer-B eval verifiers** (e.g. `lingui.sh`, `next-intl.sh`, `vue-i18n.sh`), not a pin tracker; there is **no central pin-tracking doc**. So this component reduces to: document the **tooling floor** and confirm there are no pins.

- [ ] **Step 1: Confirm there is nothing to pin and no central tracker**

```bash
cd /Users/arturs/Projects/globalize/globalization-skills
ls evals/library-checks/    # confirm these are *.sh eval verifiers, not a pin list
# iOS manifest packages are empty (from Task 4):
jq -r '.stacks[] | select(.variant|startswith("ios-")) | "\(.variant) rt=\(.packages.runtime|length) dev=\(.packages.dev|length)"' skills/i18n-guide/manifest.json
```
Expected: only `.sh` files; each iOS variant `rt=0 dev=0`.

- [ ] **Step 2: Confirm the tooling-floor section landed in `string-catalog.setup.md`** (authored in Task 2):

```bash
cd skills/i18n-guide
F=references/languages/ios/native/string-catalog.setup.md
grep -qi 'Xcode 15' "$F" \
 && grep -qi 'no minimum deployment target\|no runtime\|no deployment-target floor' "$F" \
 && grep -qi 'xcstringstool.*toolchain\|toolchain-bundled\|xcrun' "$F" \
 && grep -qi 'no package pin\|no pins\|no install' "$F" \
 && echo PASS || echo "FAIL — add the tooling-floor note to string-catalog.setup.md"
```
Expected: `PASS`. If `FAIL`, add the note to `string-catalog.setup.md` (no separate file) and re-run.

- [ ] **Step 3: (No separate commit if Task 2 already covered it.)** If Step 2 required an edit:

```bash
git add skills/i18n-guide/references/languages/ios/native/string-catalog.setup.md
git commit -m "docs(skill): document iOS catalog tooling floor (Xcode 15+, no pins)"
```

---

## Task 8: Verification — empirical `xcstringstool` (now) + live Globalize round-trip (deferred)

**No commit of fixtures** — fixtures are throwaway. This task splits cleanly into a **doable-now** arm (Xcode 26.4.1 + `xcstringstool` are present in this environment) and a **deferred / needs-user** arm (the live `fileFormat: xcstrings` round-trip + the four backend assumptions, which need platform auth). The deferred arm is **non-blocking** for the PR — the spec says backend assumptions "do not block references."

### Arm A — Empirical format + reference verification (doable now)

- [ ] **Step 1: Confirm the toolchain**

```bash
xcrun xcstringstool --help >/dev/null 2>&1 && echo "xcstringstool OK ($(xcodebuild -version | head -1))" || echo "NO XCODE — skip Arm A, mark build-verify deferred"
```
Expected: `xcstringstool OK (Xcode 26.x)`. If absent, skip Arm A and record build-verify as **deferred** (this also exercises the graceful-degradation path the references promise).

- [ ] **Step 2: Generate a real catalog and confirm the format facts the references assert.** In a temp dir, write a tiny Swift source with a `Text("…")` literal, a `String(localized:comment:)`, a `%lld`-count plural string, then:

```bash
cd "$(mktemp -d)"
# minimal source + empty catalog, then extract|sync, then print
xcrun xcstringstool extract Sample.swift --modern-localizable-strings | xcrun xcstringstool sync Localizable.xcstrings
xcrun xcstringstool print Localizable.xcstrings
python3 -m json.tool Localizable.xcstrings >/dev/null && echo "valid JSON"
```
Confirm against the references (Tasks 1–3) and reconcile any divergence: top-level `sourceLanguage`/`strings`/`version` (`"1.0"`); key-as-source entries carry **no** `extractionState`/`localizations` (just optional `comment`); `extractionState: extracted_with_value` and `stringUnit.state: new` tokens; **plurals** live under `localizations.<locale>.variations.plural.<category>.stringUnit` (CLDR, `%lld`), **not** ICU. Author a Russian target by hand (`one/few/many/other`) over an English `one/other` source and confirm it parses. Run `xcrun xcstringstool compile Localizable.xcstrings` and confirm it emits `.stringsdict` (`NSStringPluralRuleType`) — proving the `.stringsdict`/CLDR model, not ICU.

- [ ] **Step 3: Static-validate the three reference files end-to-end.** Re-run the Task 1/2/3 grep checks (all `PASS`), and confirm the JSON shapes shown *in* the references parse as valid JSON:

```bash
cd /Users/arturs/Projects/globalize/globalization-skills
# extract each fenced ```json block from the references and json.tool it (manual or scripted)
for F in skills/i18n-guide/references/languages/ios/native/string-catalog.*.md; do
  echo "== $F =="; grep -c '```json' "$F"
done
```
Manually validate each embedded JSON catalog snippet against the Step-2 generated catalog. Fix any reference snippet that diverges from the real `xcstringstool` output, then re-commit the affected reference.

### Arm B — Live Globalize.now round-trip (deferred, needs-user, non-blocking)

- [ ] **Step 4 (deferred): Live `xcstrings` round-trip.** Requires platform auth (`globalize login`). Using `globalize-now-cli-setup`/`globalize-now-cli-use`, connect the real `Localizable.xcstrings` (a key-as-source entry, a `%lld` plural, a `comment`) as **`fileFormat: xcstrings`** with the **single-file pattern** (`Localizable.xcstrings`, no `{locale}`) and source = `sourceLanguage`. Push/pull a target locale and confirm the four backend assumptions (spec §"Backend assumptions"):
  1. write-back `stringUnit.state` for fresh target translations (assumed `translated`);
  2. importer preserves unknown fields / never deletes keys (only the compiler/source does);
  3. key-as-source handled via `sourceLanguage` + key (no explicit source `value`);
  4. importer emits the CLDR categories a target language needs (e.g. Russian `few/many`) when source is `one/other`.
  Also confirm locales are read/written **in place** in the one file, plurals survive as `variations`, and comments carry.

- [ ] **Step 5 (deferred): Reconcile + bump to stable.** If Step 4 reveals a different format string or any encoding nuance, apply the fix across `manifest.json`, `SKILL.md`, `globalize-now-cli-setup`/`cli-use`, and the spec, then re-run the Task 4/5/6 validation checks. On a clean round-trip, **bump the three variants' `supportLevel` from `experimental` to `stable`** (locked decision #1).

- [ ] **Step 6: Write the verification report.** Record results (Arm A passed facts; the confirmed `xcstrings` format string and pattern shape; Arm B status — done or deferred-with-reason; any divergences + follow-up edits) in `reports/ios-xcstrings-verification-2026-06-08.md`. Commit it.

```bash
cd /Users/arturs/Projects/globalize/globalization-skills
git add reports/ios-xcstrings-verification-2026-06-08.md
git commit -m "test: iOS xcstrings empirical verification (Arm A) + deferred live round-trip notes"
```

---

## Self-review (run before handing off to execution)

- **Spec coverage:** Tasks 1–3 = the three reference files (`code`/`setup`/`convert`); Task 4 = the three manifest variants (empty packages, `experimental`, `buildSystem:xcode` disjointness); Task 5 = SKILL.md §1.1 schema+rules+first-decision+messages, §1.2 STOP-flip + Swift STOPs, §1.3 matcher prose + hand-trace, §1.5 recommendation, §2.0 install no-op, §2.2/§3.5 catalog-integrity verify + graceful degradation, §3 convert, §4.5 Phase-4 single-file `xcstrings` mapping; Task 6 = cli-setup + cli-use `{locale}` relaxation; Task 7 = tooling-floor (the "library-checks" component, no pins); Task 8 = empirical verification (Arm A now) + deferred live round-trip + the four backend assumptions (Arm B). Every spec "Components / changes" item and "Open items to resolve" maps to a task (open item #1 manifest-schema: **moot — no JSON-schema file exists**; #2 SPM disjointness: resolved by `buildSystem:xcode` in Task 4; #3 `xcstringstool` flag drift: Task 8 confirms with `--help`; #4 backend assumptions: Task 8 Arm B).
- **Placeholder scan:** reference-file *prose* is delegated to execution-time authoring against named template siblings (repo convention) with load-bearing content enumerated verbatim — not a placeholder. The two cli-skill edits and every SKILL.md sub-edit show the exact before/after text or the exact content to add.
- **Consistency:** the three reference paths (`references/languages/ios/native/string-catalog.{code,setup,convert}.md`) are identical across Task 1–4, Task 5 (manifest snapshot reads them), and Task 7. `fileFormat: "xcstrings"` + single-file pattern (`Localizable.xcstrings`, no `{locale}`) + source=`sourceLanguage` are identical across Tasks 4/5/6/8. `supportLevel: experimental` is consistent across Task 4 and the bump-condition in Task 8. The STOP-guard flip (`language !== "ruby"` → `language === "js-ts"`) is applied once to both rows and validated in Task 5 Step 3.
- **Known soft spots (resolve during execution):** (a) embedded JSON catalog snippets in the references must match real `xcstringstool` output — Task 8 Arm A Step 3 validates and reconciles; (b) the live `xcstrings` format string + the four backend assumptions — deferred to Task 8 Arm B (non-blocking), with Step 5 reconciling any deviation back into manifest/SKILL.md/cli-skills/spec and bumping to stable.
