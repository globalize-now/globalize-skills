# iOS String Catalog (`.xcstrings`) support for `i18n-guide` — Design Spec

**Date:** 2026-06-08
**Status:** Approved (design); ready for implementation planning.
**Research basis:** `reports/ios-xcstrings-research-2026-06-07.md` (§§1–6) + empirical Xcode 26.4.1 verification (this session).
**Branch:** `worktree-splendid-noodling-squid` (PR branch: `feat/ios-xcstrings-support`).

---

## Goal

Extend the `i18n-guide` skill to drive the full i18n journey (detect → setup → convert → connect) for **native Apple** projects using **Apple String Catalogs (`.xcstrings`)**, connecting the single multi-locale catalog to Globalize.now as the **`xcstrings`** fileFormat.

This is the first **Swift / native-platform** branch in a skill that today supports JS/TS and (as of #31) Ruby/Rails. It is also the first variant whose **`packages` list is empty** — native localization ships with the SDK, so there is no install step at all.

## Locked decisions (with the user, Globalize owner)

| Decision | Choice |
|---|---|
| **Scope** | **All 4 slices** — detection + schema, references (SwiftUI/UIKit/SPM), manifest + Phase 2/3 conditionals, **and Phase 4** `xcstrings` pattern wiring. |
| **Matcher axis** | **Ride the `language` axis** (`language: "swift"`), mirroring Rails. `platform`/`buildSystem`/`uiFramework` are ordinary structural keys discriminating *among* iOS variants — **not** a second special-cased matcher axis. |
| **Pattern shape** | **Single multi-locale file, no `{locale}` segment** (`Localizable.xcstrings` / `**/*.xcstrings`). Importer reads/writes every locale inside the one file. **Confirmed by the Globalize owner.** |
| **Key style** | **Literal keys (Apple default)** — `Text("Book this room")` → key `"Book this room"`. Idiomatic, matches `xcstringstool` extraction. Document the English-edit-orphans-translations caveat; symbolic keys + `defaultValue` mentioned as an opt-in, not the default. |
| **cli-skills `{locale}` fix** | **In scope.** Relax the "`{locale}` required" pattern-derivation guidance in `globalize-now-cli-setup` / `globalize-now-cli-use` to a no-`{locale}` single-file case for `xcstrings`, so the connect path produces a correct pattern end-to-end. |
| **Verification** | **Empirical** — generate/round-trip real catalogs with `xcstringstool` (Xcode 26.4.1 present). References must degrade gracefully when Xcode is absent (author + static-check; mark build-verify deferred). |

## Key platform/technical facts (empirically verified this session unless noted)

- **`xcstrings` is a valid Globalize `fileFormat`** — present in the canonical `FILE_FORMATS` (`api-client`), accepted by `cli-setup`/`cli-use` pattern commands. The pattern command takes a **free-form `--pattern` string + `fileFormat`**; there is **no CLI-level `{locale}` requirement** (the "(required)" is documentation guidance only).
- **Catalog is a single JSON file holding ALL locales** for a string *table*. Top-level keys: `sourceLanguage`, `strings`, `version` (`"1.0"` for Xcode 15+). Multiple catalogs split *tables* (`Localizable.xcstrings`, `InfoPlist.xcstrings`), never languages. **[verified]**
- **`extractionState` tokens observed:** `extracted_with_value` (emitted by `xcstringstool sync` for a key/value overload). Key-as-source entries carry **no `extractionState` and no `localizations`** — just an optional `comment`. **[verified]**
- **`stringUnit.state` tokens:** `new` (emitted by sync for a fresh extracted entry), `translated`, `needs_review` (both parse + compile cleanly). **[verified]**
- **Plurals are Apple's variation model, NOT ICU.** `localizations.<locale>.variations.plural.<category>.stringUnit` with CLDR categories `zero/one/two/few/many/other` and a C-style count specifier (`%lld`). `xcstringstool compile` emits these to `.stringsdict` (`NSStringPluralRuleType`), confirming the `.stringsdict` model, not ICU MessageFormat. **[verified]**
- **Targets can carry more CLDR categories than the source** — a Russian (`one/few/many/other`) target round-trips cleanly even when English source is `one/other`. **[verified]** (Answers research §6 Q3 at the format level.)
- **Key-as-source is the norm:** when the key *is* the source string, there is no explicit source `value`. **[verified]** (Answers research §6 Q4 at the format level.)
- **No runtime dependency / no install** — localization (incl. CLDR plural rules) is built into Foundation/SwiftUI for SwiftUI, UIKit, and SPM. SPM needs `defaultLocalization:` in `Package.swift` + the catalog as a processed resource (`Bundle.module`). **[Apple]**
- **Extraction is normally build-time** (`SWIFT_EMIT_LOC_STRINGS`), but a **CLI extract+verify path exists**: `xcstringstool extract <sources> --modern-localizable-strings [--legacy-localizable-strings] | xcstringstool sync`. This is *lightweight parsing* (no type checking), so the compiler build remains authoritative — the CLI path is the skill's Xcode-present verification, with build-verify deferred when Xcode is absent. **[verified]**
- **Field serialization:** keys sorted, 2-space indent, `version` last. Author edits should not fight the serializer (canonical ordering is Xcode's, not ours).

## Architecture: where iOS fits

iOS is **platform + built-in i18n in one** (like Rails is framework + built-in i18n). SwiftUI / UIKit / SPM differ only in *setup* details (entry point, `Package.swift`), **not** in catalog mechanics — so they share a single `native` slot and branch *within* the reference files by stack, rather than three parallel trees.

```
skills/i18n-guide/references/languages/ios/
└── native/
    ├── string-catalog.setup.md     # add catalog, SWIFT_EMIT_LOC_STRINGS, register locales, SPM defaultLocalization
    ├── string-catalog.convert.md   # make strings localizable (Text literals, String(localized:), comments); plurals via variations
    └── string-catalog.code.md      # PASSIVE, @import-wired: prefer Text literals/String(localized:), %@/%lld, NO ICU, plural authoring
```

**Reused, unchanged:** SKILL.md's four-phase orchestration, the `.globalize/` workspace + progress polling, subagent dispatch, Phase-4 connection mechanics.

## Components / changes

### 1. Reference files (`references/languages/ios/native/`)

- **`string-catalog.setup.md`** — create `Localizable.xcstrings` (default table); enable **"Use Compiler to Extract Swift Strings"** (`SWIFT_EMIT_LOC_STRINGS`, default-on for new projects); register target locales (Xcode project localizations / `.lproj` / `CFBundleLocalizations`); **SPM:** `defaultLocalization:` + catalog as `.process` resource under `Sources/<Target>/Resources/`, access via `Bundle.module`; optional migration note for legacy `.strings`/`.stringsdict` (**Edit ▸ Convert to String Catalog**). No package install (explicit note).
- **`string-catalog.convert.md`** — make strings localizable: SwiftUI `Text("…")` literals auto-localize; `String` *variables* need `LocalizedStringKey`/`String(localized:)`; `Text(verbatim:)` to opt a literal out; UIKit `String(localized:)` (preferred) or legacy `NSLocalizedString`; add `comment:` for translator context (flows to the catalog `comment`). **Literal-key default** (with the English-edit caveat + symbolic-key opt-in). Interpolation = **C-style specifiers** (`%@`, `%lld`, positional `%1$@`). Plurals authored as catalog `variations.plural.<category>` (CLDR), **never ICU** — show the verified JSON shape. Build (or `xcstringstool extract|sync`) populates the catalog.
- **`string-catalog.code.md`** — PASSIVE rules (`@import`-wired): prefer `Text` literals / `String(localized:)`; add `comment:`; `%@`/`%lld` specifiers, positional for reordering; **NO ICU** — plurals are catalog variations / `.stringsdict`; don't hand-edit Xcode's serialization order; what-NOT-to-wrap (`Text(verbatim:)`, non-UI strings, identifiers/keys).

### 2. `manifest.json`

Add three variants — all `supportLevel: "stable"`, `packages: { runtime: [], dev: [] }` (the no-install departure), references → the three files:

| variant | match |
|---|---|
| `ios-swiftui-string-catalog` | `{ language: "swift", platform: "ios", uiFramework: "swiftui", library: "string-catalog" }` |
| `ios-uikit-string-catalog` | `{ language: "swift", platform: "ios", uiFramework: "uikit", library: "string-catalog" }` |
| `ios-spm-string-catalog` | `{ language: "swift", buildSystem: "spm", library: "string-catalog" }` |

(SPM keys on `buildSystem` rather than `uiFramework`/`platform`, since a package is UI-framework-agnostic. Confirm a clean disjoint match in the hand-trace below; resolve any manifest-schema accommodation for the new match keys in the plan.)

### 3. `SKILL.md` orchestrator (most invasive — additive, mirrors the Rails edit)

- **§1.1 detection schema** — add `language: "swift"` (alongside `js-ts`/`ruby`/`unknown`); new fields `platform` (`ios`/`macos`/…), `buildSystem` (`xcode`/`spm`), `uiFramework` (`swiftui`/`uikit`/`mixed`). `existing.library` += `"string-catalog"`. Add a **Swift/Apple detection-rules table** (apply only when `language === "swift"`):
  - `language`: `*.xcodeproj`/`*.xcworkspace`, `Package.swift`, or `*.swift` present → `swift`.
  - `buildSystem`: `Package.swift` (no `.xcodeproj`) → `spm`; `.xcodeproj`/`.xcworkspace` → `xcode`.
  - `uiFramework`: entry-point heuristic — `import SwiftUI` + `struct …: App` + `@main` → `swiftui`; `UIApplicationDelegate`/`UIResponder` (AppDelegate/SceneDelegate) and/or `.storyboard`/`.xib` → `uikit`; both → `mixed`; SPM library → not meaningful (don't-care).
  - `existing.configured`: a `.xcstrings` present. `existing.catalogsScaffolded`: same. `localeSignals`: `.lproj` dirs + Info.plist `CFBundleLocalizations`/`CFBundleDevelopmentRegion`, existing `.strings`/`.stringsdict`.
- **§1.2 STOP guards** — **flip the two JS-only STOPs from `language !== "ruby"` to `language === "js-ts"`** (scales to N platforms; fixes the false-STOP that Rails patched with an exemption — doing the positive form once means no further edits per future platform). Add Swift STOPs: a Swift project with **no `.xcstrings` and no path to one** (legacy `.strings`-only with an old toolchain → migration note, non-blocking where possible); non-iOS/unsupported Apple target out of v1 scope as needed.
- **§1.3 matcher** — `match.language: "swift"` matches only `detection.language === "swift"`; absent → `"js-ts"`. JS / Ruby / Swift entry sets stay disjoint. (Hand-trace below.)
- **§1.5 recommendation** — `language === "swift"` → **"Apple String Catalog (built-in)"**, above the catch-all; surfaced as a **confirmation** (exactly one variant matches via the entry-point/buildSystem heuristic), not a 3-way prompt.
- **§2.0 install** — **no-op** for Swift/Apple (both package lists empty by design; like `bundler`). Not an error.
- **§2.2 / §3.5 verify** — Apple has no `tsc`/`build`; swap in a **catalog-integrity check**: `xcstringstool extract --modern-localizable-strings [--legacy-localizable-strings]` over candidate sources → `sync` into the catalog → `xcstringstool print`/parse to confirm it is valid and covers used keys. Map into the existing `verificationResult` shape (JS `typecheck`/`build` → `null`). **Graceful degradation:** if Xcode/`xcstringstool` is absent, author + static-JSON-validate the catalog and mark build-verify **deferred** (not failed).
- **§3 convert** — wrap subagents make strings localizable per `string-catalog.convert.md`; no extract/compile codemod step (build-time / `xcstringstool` populates).
- **§4 Phase-4** — Swift arm: `fileFormat: "xcstrings"`, **single-file pattern** (`Localizable.xcstrings`, or `**/*.xcstrings` when multiple tables/dirs), **no `{locale}` segment** — source and output are the same file; source locale = `sourceLanguage` / detected development region.

### 4. `globalize-now-cli-setup` / `globalize-now-cli-use` (the §4 fix)

- Add a **single-file / no-`{locale}` case** to the pattern-derivation guidance for `.xcstrings`: pattern is the catalog path itself (`Localizable.xcstrings` / `**/*.xcstrings`), `fileFormat: xcstrings`, and the "`{locale}` required" rule is **relaxed** for this format. Both skills already list `xcstrings` as a valid format value; this fixes the *pattern shape* so detection/connect produce a correct, locale-segment-free pattern.

### 5. `library-checks` (if present in repo conventions)

- No package pins for Apple (SDK-native). Track the **tooling floor**: Xcode 15+ for catalogs (build-time, no runtime deployment-target floor). Note `xcstringstool` is toolchain-bundled (no install).

## Matcher hand-trace (load-bearing — §1.3)

The matcher special-cases exactly one key: absent `match.language` ⇒ `"js-ts"`. All four detection languages:

1. **`{ language: "swift", buildSystem: "xcode", uiFramework: "swiftui", platform: "ios" }`** — §1.2 flipped guards use `language === "js-ts"`, so the React/Vue/Svelte + custom-pipeline STOPs **don't fire** (`swift !== js-ts`). Reaches §1.3: every JS entry's absent `language` ⇒ `"js-ts"` ≠ `"swift"` → no JS match; `rails-yaml` needs `"ruby"` → no match; `ios-swiftui-string-catalog` matches (`language`/`platform`/`uiFramework`/`library` all equal); `ios-uikit` fails on `uiFramework`; `ios-spm` fails on `buildSystem` (`xcode` ≠ `spm`). **Exactly one variant** → §1.5 confirmation.
2. **`{ language: "swift", buildSystem: "spm", library: "string-catalog" }`** (library package) — JS/Ruby entries don't match; `ios-spm-string-catalog` matches on `language` + `buildSystem`; `ios-swiftui`/`ios-uikit` declare `platform: "ios"`/`uiFramework` which an SPM library detection leaves unset/`mixed` → no match. **Exactly one.** (Confirm in the plan that SPM detection does not also set `platform: "ios"` in a way that double-matches; if it can, make the iOS-app variants also key on `buildSystem: "xcode"` to keep the sets disjoint.)
3. **`{ language: "ruby", framework: "rails", … }`** — unchanged from #31: flipped guards still don't fire (`ruby !== js-ts`), Swift/JS entries fail on `language`, only `rails-yaml` matches.
4. **`{ language: "js-ts", framework: "next", router: "app", … }`** — flipped guards don't fire (`js-ts === js-ts` but react/vue true in real Next, and the guard only *enables* the row when `js-ts` — same behavior as before for genuine JS). Swift/Ruby entries fail on `language`; JS entries match as before. **No regression.**
5. **`{ language: "unknown" }`** — no `match.language` equals `"unknown"`; absent-language JS entries require `"js-ts"`. No variant matches → §1.3 empty-set STOP, as today.

## Verification (empirical path)

1. **Format facts** (done this session): generated real catalogs via `xcstringstool extract|sync` and `compile`; confirmed `version`, `extractionState`/`state` tokens, `variations.plural` → `.stringsdict`/CLDR, key-as-source, no-ICU.
2. **Setup**: SwiftUI fixture (Xcode project) + SPM fixture — confirm catalog creation, `SWIFT_EMIT_LOC_STRINGS`, locale registration, SPM `defaultLocalization` + `Bundle.module`.
3. **Convert**: `Text` literals / `String(localized:)` with `comment:`; a plural authored as `variations.plural`; confirm `xcstringstool extract|sync` populates the catalog and `print`/parse is clean.
4. **Connect (Phase 4)**: round-trip a real `Localizable.xcstrings` (a key-as-source entry, a `%lld` plural, a `comment`) through Globalize with `fileFormat: xcstrings`, single-file pattern (no `{locale}`); confirm locales are read/written in place, plurals survive as variations, comments carry. **Confirm against the live platform.**
5. **Passive rules**: `@import` of `string-catalog.code.md` appended to project CLAUDE.md (idempotent).
6. **Xcode-absent degradation**: confirm the verify arm marks build-verify deferred (not failed) when `xcstringstool` is missing.

## Out of scope (v1)

- **macOS / watchOS / tvOS / Mac Catalyst** beyond what falls out of the shared catalog mechanics (detection may set `platform`, but variants target iOS + SPM in v1).
- **Objective-C-only** projects (legacy `NSLocalizedString` is covered as a convert *input* via `--legacy-localizable-strings`, but Obj-C-first stacks are not a primary target).
- **Multiple custom tables** beyond noting `**/*.xcstrings` handles them; per-table pattern tuning deferred.
- **Device/width variations** (`variations.device.*`) beyond plurals — documented, not automated.
- Legacy `.strings`/`.stringsdict` *authoring* (we convert *to* catalogs; we don't maintain dual formats).

## Backend assumptions (research §6 — fold into the user-review gate, do not block references)

1. **Write-back state** — which `stringUnit.state` the importer sets for fresh target translations (`translated` vs `needs_review`). *Assumption:* `translated`. Confirm in Phase-4 round-trip.
2. **State / extraction round-trip** — whether the importer honors/round-trips `extractionState`, `shouldTranslate`, `stale`. *Assumption:* it preserves unknown fields and never deletes keys (only the compiler/source does). Confirm.
3. **Source-language / key-as-source** — how the importer treats the `sourceLanguage` entry and key-as-source (no explicit `value`). *Assumption (format-verified):* key is the source text; importer uses `sourceLanguage` + key. Confirm at the platform.
4. **CLDR category emission** — whether the importer emits all categories a target language needs (e.g. Russian `few/many`) when source is `one/other`. *Format-verified the catalog can carry them;* confirm the importer *produces* them.

## Open items to resolve during implementation

1. Manifest-schema accommodation for the new match keys (`platform`, `buildSystem`, `uiFramework`) and the all-empty `packages` (Rails added `gems`; iOS adds nothing — confirm schema allows empty).
2. SPM-vs-iOS-app match disjointness (hand-trace item #2) — verify detection can't double-match; if it can, add `buildSystem: "xcode"` to the app variants.
3. Exact `xcstringstool extract` flag behavior across Xcode versions (the floor is Xcode 15; verified on 26.4.1) — pin guidance to `--help` if it diverges.
4. The four backend assumptions above, confirmed against the live platform during Phase-4 verification.
