# Ionic / Angular / Capacitor support for `globalize-guide` — Design Spec

Date: 2026-10-01
Status: design approved, not implemented (new variant ships `supportLevel: "experimental"`)

---

## Goal

Make `globalize-guide` handle Angular apps — with or without Ionic, with or without Capacitor — as a
first-class target, and stop blocking Ionic React / Ionic Vue + Capacitor apps that the existing Vite
stacks already fit.

Today both fail:

- **Angular is not supported at all.** §1.2's "React-based, Vue-based, and Svelte-based projects only"
  stop catches every Angular project.
- **Every Capacitor/Ionic project with an `android/` folder is stopped**, regardless of its UI framework.
  The "Capacitor/Cordova/Ionic" row in the Android compatibility block fires on signals independent of
  `language`, and its message ("run globalize-guide against the web UI (the JS path)") points at the path
  the project is already on. An Ionic React + Vite app that would otherwise match `vite-*-lingui` never
  reaches §1.3.

---

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Angular library | **`@angular/localize`** | The only maintained Angular option whose translator comments reach the catalog (§Key facts 1–3). Transloco and ngx-translate have no comment channel at all; Lingui has no Angular integration and would need a custom template extractor, pipe and loader. |
| Catalog format | **XLIFF 2.0** (`fileFormat: xliff-2`) | Carries `<note category="description">`. Angular's `json` extraction format drops descriptions. PO is not offered by `ng extract-i18n` and was a preference, not a requirement. |
| Build model | **One build, runtime `loadTranslations()`** before bootstrap | `ng build --localize` emits `www/<locale>/index.html` with a per-locale `baseHref`; Capacitor needs one `index.html` at the `webDir` root. |
| Language switch | **Persist to `localStorage` + `location.reload()`** | `$localize` is evaluated once; Angular states it "does not provide dynamic language changing without refreshing the browser". Acceptable for mobile apps where switching is rare. |
| ICU | **Templates only** | ICU in `$localize` (TS) was closed as won't-implement (angular/angular #35912, #42238). TS strings with counts are rephrased to avoid count-dependent grammar. |
| Message IDs | **Explicit `@@feature.element.purpose`** | Auto IDs hash the source text; a typo fix in English would orphan every translation. Trade-off accepted: changing source text under a stable ID keeps the old translation live until retranslated. |
| XLIFF → runtime JSON | **Build-time `scripts/xliff-to-json.mjs`** using `Xliff2TranslationParser` / `Xliff1TranslationParser` from `@angular/localize/tools` | `loadTranslations()` takes `{id: TargetMessage}`; nothing in the Angular runtime parses XLIFF. Placeholder mapping (`<ph equiv="INTERPOLATION">` → `{$INTERPOLATION}`, incl. inside ICU) is non-trivial, so Angular's own parser is used rather than a hand-rolled one. Pinned to the project's Angular major; the script fails the build on any parse diagnostic. |
| SSR | **Stop** | `loadTranslations()` mutates a global; it cannot vary per request. |
| Native strings (app name, `NS*UsageDescription`) | **Out of scope** | Web UI only. Setup tells the user these stay in the source language when `android/` or `ios/` exists. |
| Ionic React / Ionic Vue | **Unblock; route to existing Vite stacks** | With `hybrid === "capacitor"` the locale-routing question is skipped — no URL bar, so the locale is a stored preference with device-language default. |
| Angular version floor | **18** (Ionic 9's peer floor) | Only Angular 22 has been exercised (spike). |
| Support level | `experimental` | No live Globalize XLIFF round-trip and no on-device run yet. |

---

## Key facts (verified 2026-10-01)

Versions from the npm registry: `@angular/core` / `@angular/localize` 22.2.1, `@ionic/angular` 9.0.6,
`@capacitor/core` 8.5.2, `@jsverse/transloco` 8.4.0, `@ngx-translate/core` 18.0.0, `@lingui/core` 6.8.0.

1. **Transloco has no translator-comment support.** `transloco-keys-manager` 8.1.1 stores key → value only
   (`keys-builder/add-key.js`). Its "comments" (`<!-- t(key) -->`, `/** t(key) */`) mark dynamic keys for
   extraction. `fileFormat: 'pot'` writes `msgid` = key and `msgstr` = "Missing value for '…'" with no `#.`
   or `#:` lines (`createPot` passes only `{ msgid, msgstr }`). Confirmed by running extraction in a
   spike. ICU via `transloco-messageformat` works in templates and TS, and runtime switching works.
2. **ngx-translate has no comment support.** `@vendure/ngx-translate-extract` 10.2.0 entries carry only
   `{ value, sourceFiles }`; PO loaders for core 18 are unmaintained (2020–2022).
3. **`@angular/localize` emits descriptions** into XLIFF 1.2 (`<note priority="1" from="description">`),
   XLIFF 2.0 (`<note category="description">`) and ARB, but not into `json`.
4. **`@angular/localize/tools` programmatic API is not semver-guaranteed** (its README). This is the risk
   carried by the converter script.
5. **Ionic 9 exports its standalone API from the package root** (`@ionic/angular`). `@ionic/angular/standalone`
   is the Ionic 8 path and does not resolve on 9. `IonicModule` is deprecated.
6. **Ionic React 9 peers on `react-router` / `react-router-dom` `>=6.4.0 <7`.**
7. Ionic's official Angular starter uses `@angular/build:application`, output base `www`.

---

## Spike evidence (throwaway, not kept)

Angular 22.2 + Ionic 9.0.6 + Capacitor 8.5 + `@angular/localize` 22.2.1, one `ng build`, driven in headless
Chrome:

- `ng extract-i18n --format xlf2` wrote a description note for every message: template `i18n`, a TS class
  field `$localize`, and a module-level `$localize` constant.
- Latvian ICU plurals rendered with correct CLDR categories: 1 prece, 2 preces, 10 preču, 11 preču,
  21 prece, 22 preces; `=0` → "Grozs ir tukšs".
- TS `$localize` with a named placeholder translated.
- Switch via `localStorage` + reload → full Latvian UI, persisted across fresh navigation, no console errors.
  (Triggered with `element.click()`, not a real tap.)
- `DecimalPipe` followed `LOCALE_ID`: `1 234 567,891`.
- `cap add android` copied `index.html` to the asset root, with `i18n/lv.json` beside it.

Not exercised: a device/emulator, the Globalize round-trip.

---

## Architecture

### Catalog flow

```
templates/TS ──ng extract-i18n --format xlf2──▶ src/locale/messages.<source>.xlf   (committed)
Globalize ◀──▶ src/locale/messages.{locale}.xlf                        (pattern, xliff-2)
prestart/prebuild: scripts/xliff-to-json.mjs ──▶ public/i18n/<locale>.json      (gitignored)
main.ts: stored → device → source locale
         → fetch JSON → loadTranslations() → registerLocaleData()
         → set <html lang/dir> → dynamic import app → bootstrap
switch:  localStorage.setItem + location.reload()
```

A locale with no target file yet is skipped by the converter; `main.ts` falls back to the source locale
when the fetch fails.

**Load-bearing ordering.** Everything that evaluates `$localize` must be imported *after*
`loadTranslations()`. A module-level `$localize` reached through a static import from `main.ts` stays in
the source language silently. The setup uses dynamic `import()` for the app, and the rules forbid static
imports from `app/` in `main.ts`.

**Locale data.** ICU plural categories in templates come from Angular's locale data, so every configured
locale's `@angular/common/locales/<code>` is registered before bootstrap.

### §1.1 detection changes

- `framework`: `@angular/core` in deps → `angular`, evaluated before the `vite` fallback.
- New fields: `angular: boolean`, `ionic: boolean` (any `@ionic/*`), `hybrid: "capacitor" | "cordova" | null`.
- `candidateFiles` / `formatCandidateFiles`: for `framework === "angular"`, also glob `src/**/*.html`.
- `existing.library`: add `@angular/localize`, `@jsverse/transloco`, `@ngx-translate/core`.
- `existing.configured`: `@angular/localize/init` in polyfills AND `i18n` block in `angular.json`.

### §1.2 compatibility changes

| Condition | Action |
|---|---|
| `language === "js-ts"` AND no React/Vue/Svelte/**Angular** | STOP (existing row, widened) |
| Capacitor/Cordova/Ionic signal | No longer a stop for `js-ts`; the row applies only when `language === "android"` |
| `framework === "angular"` AND `@angular/ssr` in deps | STOP — runtime translation loading is global, cannot vary per request |
| `framework === "angular"` AND `@analogjs/*` in deps | STOP — AnalogJS not supported |
| `framework === "angular"` AND build target builder ≠ `@angular/build:application` / `@angular-devkit/build-angular:application` | STOP — migrate to the application builder |
| `framework === "angular"` AND `@angular/core` major < 18 | STOP — upgrade |
| `existing.library` ∈ {`@jsverse/transloco`, `@ngx-translate/core`} | STOP (joins the no-migration list) |
| `hybrid === "cordova"` | Warn (non-blocking) — the web layer is localized the same way |
| `hybrid !== null` AND `android/` or `ios/` exists | Notice (non-blocking) — app name and permission prompts stay in the source language |

### Manifest entry

```json
{
  "variant": "angular-localize",
  "match": { "framework": "angular", "library": "angular-localize" },
  "supportLevel": "experimental",
  "packages": { "runtime": [], "dev": [] },
  "references": {
    "setup": ["references/languages/js-ts/frameworks/angular/angular-localize.setup.md"],
    "convert": [
      "references/languages/js-ts/frameworks/angular/angular-localize.convert.md",
      "references/languages/js-ts/convert.format-pass.md"
    ],
    "rulesTemplate": ["references/languages/js-ts/libraries/angular-localize/rules.template.md"]
  }
}
```

`@angular/localize` is installed by `ng add '@angular/localize@^<project Angular major>'` inside setup, not
via `packages`, because its major must equal `@angular/core`'s. This is a documented exception to the
pin-to-a-fixed-major convention, stated in the setup reference's troubleshooting prose.

§1.5 recommendation row: `framework === "angular"` → `@angular/localize` (confirmation, single variant).

---

## Setup reference — `angular-localize.setup.md`

1. **Detect** builder, bootstrap style (`bootstrapApplication` vs `bootstrapModule`), existing `i18n` /
   `sourceLocale`, Ionic, Capacitor; apply the §1.2 Angular stops defensively.
2. **Install** via `ng add` (major-matched).
3. **`angular.json`**: `i18n.sourceLocale`; `extract-i18n` options → `format: xlf2`,
   `outputPath: src/locale`, `outFile: messages.<source>.xlf`.
4. **Build pipeline**: write `scripts/xliff-to-json.mjs` (the spike-tested script); package scripts
   `i18n:extract`, `i18n:compile`; `prestart` / `prebuild` run compile; gitignore `public/i18n/*.json`.
5. **`main.ts`**: boot sequence above, standalone and NgModule branches; `LOCALE_ID` provider with the
   resolved locale; `<html lang>` and `dir`.
6. **`src/app/i18n/locale.ts`**: `currentLanguage`, `availableLanguages` (endonyms), `setLanguage(lang)`.
   Optional switcher: `ion-select` when `ionic`, `<select>` otherwise.
7. **`generate_format_helpers`**: `src/app/i18n/format.ts` — the ten functions on `Intl` behind
   `formatLocale()` (returns `$localize.locale`), plus a pure standalone `fmt` pipe in the same file. Full
   seam (all ten through `formatLocale()`). Records `.globalize/format-module.json`.
8. **`generate_coding_rules` + `install_coding_rules`** (core steps).
9. **Optional CI**: `ng extract-i18n` then `git diff --exit-code` on the source XLIFF.

## Convert reference — `angular-localize.convert.md`

- Template text → `i18n="<description>@@<id>"`.
- Static attributes → `i18n-<attr>`: `placeholder`, `title`, `aria-label`, `alt`, and Ionic text props
  (`label`, `text`, `header`, `cancel-text`, `ok-text`, …).
- Bound attributes (`[label]="…"`) → a `$localize` field on the component.
- TS → `` $localize`:<description>@@<id>:text ${expr}:name:` ``, including `AlertController`,
  `ToastController`, `ActionSheetController` options.
- Counts → ICU plural in templates. In TS, rephrase to avoid count-dependent grammar. **Never** pick
  between messages with `Intl.PluralRules` — target languages have categories the source lacks (Latvian
  `zero`).
- `<ion-back-button>` → `i18n-text`, not global `backButtonText` config.
- Values → formatters module via `convert.format-pass.md`.

## Rules template — `libraries/angular-localize/rules.template.md`

- `conditions: [ionic, bootstrap]`; `values: [sourceLocale, targetLocales, catalogPath, formatModule]`.
- Rules: description and explicit ID on every message; no concatenation; no ICU in TS; no static import
  from `app/` in `main.ts`; values through `<<formatModule>>`; run `npm run i18n:extract` after adding
  strings. Self-contained (no `.claude/`, `references/`, or `globalize-guide` in the body).

## Ionic React / Ionic Vue edits

- Vite Lingui setup references (react-babel, react-swc) and the Vite vue-i18n setup reference: when
  `hybrid === "capacitor"`, skip the locale-routing question; locale is a stored preference with
  `navigator.language` default.
- Their convert references: a short Ionic note — React `` label={t`…`} ``, Vue `:label="t('…')"`, and
  strings passed to alert/toast/action-sheet controllers.

---

## Verification

### §3.5 Verify for `angular-localize`

1. `npm run i18n:extract` exits 0 with no duplicate-ID warnings.
2. Every unit in `messages.<source>.xlf` has a description note.
3. `npm run i18n:compile` writes one JSON per existing target file.
4. `ng build` passes.
5. Recall: no bare template text outside `i18n`-marked elements; no string literals passed to Ionic
   overlay controller options without `$localize`.
6. `main.ts` has no static import from `app/`.

Ionic React / Vue: existing checks, plus a Capacitor app has no locale-prefix routes.

### Phase 4

- Pattern `src/locale/messages.{locale}.xlf`, `fileFormat: xliff-2`.
- `globalize-now-project-setup`: detection row for Angular (`@angular/localize` + `angular.json` `i18n`)
  and a pattern/format row for this layout.

### Evals

| Fixture | Category | Asserts |
|---|---|---|
| `ionic-angular-capacitor` | positive (Layer A) | `framework: angular`, `ionic: true`, `hybrid: capacitor`; plan selects `angular-localize`; no Android-signal stop |
| `angular-ssr` | hard-stop | stops on `@angular/ssr` |
| `ionic-react-capacitor` | positive (Layer A) | selects a `vite-*-lingui` variant; plan has no URL-prefix routing |
| `ionic-vue-capacitor` | positive (Layer A) | selects `vite-vue-i18n`; same routing assertion |

- `evals/library-checks/angular-localize.sh` — Verify checks 1–4 (for Layer B later).
- `verify-manifest.sh`, `verify-rules-template.sh` (9 templates), `verify-format-helpers.sh` (Angular
  `format.ts` + `fmt` pipe) pass.
- CLAUDE.md counts updated: 24 variants, 9 templates.

---

## Open risks

1. **Globalize `xliff-2` round-trip untested**: preservation of Angular ICU with `<ph>` inside `<source>`,
   and `<note category="description">` surfaced as the translator comment.
2. **`@angular/localize/tools` API not semver-guaranteed**: mitigated by major-matching and fail-loud parsing.
3. **Device behaviour untested**: `navigator.language` in the Capacitor WebView, relative `fetch` of
   `i18n/<locale>.json` under Capacitor's scheme.
4. **Angular 18–21 untested**: floor set from Ionic 9's peer range.

## Out of scope (v1)

Native app name / permission-string localization; Angular SSR; AnalogJS; non-`application` builders;
Layer B prefill for Angular; on-device runs.
