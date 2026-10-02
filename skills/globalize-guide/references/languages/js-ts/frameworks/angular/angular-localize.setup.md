# Angular (`@angular/localize`) Setup

Angular's built-in i18n, `@angular/localize`, with **XLIFF 2.0** catalogs and **runtime** translation loading: one `ng build`, one `index.html` at the output root (what a Capacitor `webDir` needs), the language chosen at startup and changed by reload. Templates are marked with `i18n` attributes, TypeScript with `` $localize ``; `ng extract-i18n` writes the source catalog, a small build-time script converts each translated XLIFF file into the JSON `loadTranslations()` takes, and `src/main.ts` loads that JSON before it imports the app.

**Why not `ng build --localize`.** The compile-time model emits `<out>/<locale>/index.html` per locale, each with its own `baseHref`. A Capacitor (or Cordova) app loads exactly one `index.html` from the `webDir` root, and a plain web deployment would need per-locale routing on the server. Runtime loading keeps one build that serves every language.

The same steps cover Ionic Angular (standalone or NgModule), Angular + Capacitor/Cordova, and a plain client-only Angular CLI application. Follow them in order. Each builds on the last.

---

## Out of Scope

- **Server-side rendering (`@angular/ssr`), AnalogJS, non-`application` builders, Angular < 18.** All four are stopped in `SKILL.md §1.2`; Step 1 re-checks them defensively. `loadTranslations()` sets a process-wide global, so it cannot vary per request on a server.
- **Native app name and permission strings.** On Capacitor/Cordova the app name (`app_name`, `CFBundleDisplayName`) and `NS*UsageDescription` prompts live in `android/` and `ios/`. They stay in the source language — this setup localizes the web UI only.
- **Migrating from Transloco or ngx-translate.** Stopped in `SKILL.md §1.2`.
- **In-place language switching.** `$localize` is evaluated once per page load; Angular states it does not provide dynamic language changing without a reload. The language changes by persisting the choice and reloading.
- **ICU in TypeScript.** `$localize` does not support ICU expressions. Plurals and selects live in templates.
- **Converting existing strings.** That is the convert phase (`angular-localize.convert.md`).

---

### Step Risk Classification

| Step | Risk | Notes |
|------|------|-------|
| 1. Detect | Read-only | |
| 2. `ng add @angular/localize` (`ng_add_localize`) | **Modifies existing files** | `package.json`, lockfile, `angular.json` polyfills, `tsconfig*.json` types. Run by the orchestrator on the main thread (`SKILL.md §2.0`); the subagent verifies |
| 3. `angular.json` i18n + extract options (`create_config`) | **Modifies existing file** | |
| 4. Converter script + package scripts (`build_tool_integration`) | Additive + **modifies `package.json`** | |
| 5. `main.ts` boot (`provider_wiring`) | **Modifies existing file** | Rewrites static `./app/` imports to `import()` |
| 6. Locale module + switcher (`language_switcher`) | Additive | Mounting the switcher edits a page — guided asks |
| 7. First extract (`scaffold_catalogs`) | Additive | Writes `src/locale/messages.<source>.xlf` |
| 8. `.gitignore` (`gitignore_artifacts`) | **Modifies existing file** | |
| 9. Extract + compile (`extract_compile`) | Additive | |
| Format helpers (`generate_format_helpers`) | Additive | Creates `src/app/i18n/format.ts` — **always runs**, feeds Step 10 |
| 10. Coding rules (`generate_coding_rules`, `install_coding_rules`) | Additive + edits `CLAUDE.md`/`AGENTS.md` | Writes `.agents/globalize-rules.md` — **always runs**, Phase 3 wraps against it |
| Optional CI | Additive | `SKILL.md §1.10` opt-in |

**RULE: Steps that modify existing files require you to describe the exact change to the user and get confirmation before proceeding. Do NOT silently modify existing files.** _(This rule is modified by the setup mode chosen below.)_

Every step is re-runnable: each one states what an already-applied state looks like, and when it finds that state it skips.

---

## Setup Mode

After Step 1 (detection) completes without blockers, ask the user:

> **How would you like to proceed with the setup?**
> 1. **Guided** — I'll explain each step before and after, and you'll confirm changes to existing files.
> 2. **Unguided** — I'll run all steps without pausing and show a full summary at the end.

### Guided mode rules

- **Before each step**: briefly explain what will happen and why.
- **After each step**: summarize what changed (files created, files modified, commands run).
- Consent gates for "Modifies existing file" steps still apply — describe the exact change and wait for confirmation.
- Optional steps still prompt the user ("Would you like me to...").

### Unguided mode rules

- Execute all steps without pausing for per-step explanations or confirmations.
- Consent gates for file modifications are **suspended** — proceed with the modification without asking.
- Hard stops (incompatibility checks in Step 1) still halt execution — these are never skipped. So does every `needs_decision` this file says applies in **both** modes.
- "MUST wait for the user to choose" lines in this file are **overridden** by the unguided-defaults table below when a default is listed.
- At the end, produce a summary:

```
## Setup Complete

### What was done
- [x] Step N: {step name} — {one-line description}

### Files created
- path/to/file

### Files modified
- {what changed}

### Defaults applied
- {choice}: {value applied} — {rationale}

### Next steps
- {recommendations}
```

#### Unguided defaults

| Choice | Unguided default | Rationale |
|--------|------------------|-----------|
| **Source locale** | `decisions.setup.sourceLocale` → existing `i18n.sourceLocale` in `angular.json` → `en` | Match what the app already declares |
| **Target locales** | From `decisions.md` | Chosen in Phase 1 |
| **Language switcher** | Component created, **not mounted** — listed under Next steps | Placing it in a page is a design decision |
| **Ionic CLI hooks** | Added whenever `ionic.config.json` exists or detection `ionic === true` | `ionic serve` / `ionic build` bypass `npm start` / `npm run build` |
| **Optional CI** | Not added | §1.10 opt-in only |

---

## Step 1: Detect the Project

Read the project. Every check below states its outcome; a STOP halts the setup with the quoted message.

- **Application project.** `decisions.setup.angularProject` set (`SKILL.md §1.7` records it, and §2.0 already ran `ng add` against it) → use it. Otherwise read `angular.json` and list the projects with `"projectType": "application"`. **If there is more than one, write `status: "needs_decision"`** with:

  ```json
  { "step": "angular_project",
    "question": "angular.json has more than one application project. Which one should be localized?",
    "options": ["<project names>"] }
  ```

  This applies in guided and unguided mode alike — there is no safe default, and editing the first project would localize the wrong app. Exactly one → use it. It is called `<project>` below.

  **`<project>` must be the workspace-root application** (`"root": ""`, `"sourceRoot": "src"`). Every path in this file — `src/main.ts`, `src/locale/`, `src/app/i18n/`, `public/` — and Phase 1's candidate-file scan assume it. If the chosen project lives elsewhere (`projects/admin/src`), STOP: "This setup currently localizes the application at the workspace root (`src/`). `{project}` lives in `{sourceRoot}`, which isn't supported yet."

- **Defensive §1.2 re-check.** `<project>.architect.build.builder` must be `@angular/build:application` or `@angular-devkit/build-angular:application`; `@angular/ssr` must be absent; no `@analogjs/*` package; `@angular/core` major ≥ 18 (detection `version`). Any failure → STOP with the matching `SKILL.md §1.2` message.

- **Existing compile-time i18n.** If `<project>.i18n.locales` is set, or any build option or configuration under `<project>.architect.build` sets `"localize"` (to `true` or to an array), the project already builds one output per locale. **Do not layer runtime loading on top** — that build writes `www/<locale>/index.html`, which Capacitor cannot load, and the two models fight over the same `$localize` global.
  - **Guided:** write `status: "needs_decision"` with
    ```json
    { "step": "angular_compile_time_i18n",
      "question": "This project already uses build-time localization (ng build --localize), which writes one index.html per locale — Capacitor cannot load that. Switch to runtime loading? This removes the \"localize\" build option; existing translation files are kept and reused.",
      "options": ["switch_to_runtime", "stop"] }
    ```
    On `switch_to_runtime`: remove every `"localize"` build option and the `i18n.locales` map (keep `i18n.sourceLocale`); the target files it pointed at are reused as-is if they sit in `src/locale/` as `messages.<locale>.xlf`, otherwise move them there. On `stop`: stop.
  - **Unguided:** **STOP** — halt the setup with that explanation and do not go on to Step 2; every later step would layer runtime loading on top of the per-locale build. Switching build models needs a human decision.

- **Bootstrap style.** `src/main.ts` calls `bootstrapApplication(` → `standalone`; `bootstrapModule(` → `ngmodule`. Record it — it is the `bootstrap` condition in Step 10 and selects the Step 5 branch. Note whether the project has `src/app/app.config.ts` and which names the original `main.ts` imports from `./app/…`.

- **Ionic.** `@ionic/angular` is in `package.json`. Selects the Ionic switcher (Step 6) and the `ionic` rules condition (Step 10). The Ionic CLI hooks (Step 4) are added when this holds **or** `ionic.config.json` exists. Never key the switcher on any `@ionic/*` package — `@ionic/pwa-elements` ships in plain Capacitor apps, and the Ionic switcher imports `@ionic/angular`. Note the Ionic major: Ionic 9 exports standalone components from `@ionic/angular`; Ionic 8 from `@ionic/angular/standalone`.

- **Capacitor.** `capacitor.config.{ts,json}` exists → read `webDir` and confirm it equals the build output (`<outputPath>/browser` when it is a string — the application builder writes browser files to a `browser/` subfolder unless told otherwise; `outputPath.base` joined with `outputPath.browser` when it is an object, with `browser` defaulting to `browser` when absent — the Ionic starter uses `{ "base": "www", "browser": "" }`). A mismatch is a **warning to surface**, not a fix to make: Capacitor would copy a stale or empty directory.

- **Static-assets dir.** Read `<project>.architect.build.options.assets`:
  - an entry with `"input": "public"` (the Angular 17+ default) → `<assetsDir>` = `public`, `<fetchPrefix>` = `i18n/` — the runtime JSON is written to `public/i18n/` and served at `i18n/<locale>.json`;
  - else an entry for `src/assets` → `<assetsDir>` = `src/assets`, `<fetchPrefix>` = `assets/i18n/` — written to `src/assets/i18n/`, served at `assets/i18n/<locale>.json`;
  - neither → `needs_decision` (`{ "step": "angular_assets_dir", "question": "Where should the runtime translation JSON be served from? angular.json has no public/ or src/assets entry.", "options": ["add_public", "add_src_assets"] }`).

- **Package manager.** From detection — used only to run `ng add` through the right runner.

### Branch Recommendation

If the project is a git repository and the current branch is `main`, `master`, or `develop`, recommend creating a dedicated branch first (`git checkout -b chore/i18n-setup`). Skip silently on a feature branch or outside git.

If no blockers were found, proceed to the **Setup Mode** prompt before continuing to Step 2.

---

## Step 2: Install `@angular/localize` (`ng_add_localize`)

```bash
npx ng add '@angular/localize@^<angular-major>' --skip-confirmation --use-at-runtime --project <project>
```

**Under `globalize-guide` the orchestrator has already run this on the main thread** (`SKILL.md §2.0`), so the install and its lockfile change stay outside the subagent. The subagent does not re-run it: it confirms the edits below and adds whichever are missing. Run the command only when this reference is followed on its own, with no orchestrator.

`<angular-major>` is the major of detection `version` (`22.2` → `^22`); `<project>` is the Step 1 project. With pnpm, Yarn or Bun, run the same command through `pnpm exec`, `yarn` or `bunx`.

- `--use-at-runtime` puts the package in `dependencies` instead of `devDependencies`. Runtime `loadTranslations()` imports it in the browser bundle, so it must be a runtime dependency.
- `ng add` adds `@angular/localize/init` to the build (and test) target's `polyfills` in `angular.json`, `@angular/localize` to `compilerOptions.types` in `tsconfig.app.json` (and `tsconfig.spec.json`), and a `/// <reference types="@angular/localize" />` line at the top of `src/main.ts`. **Confirm the polyfill and the types entry after it runs and add them if missing** — `$localize` is a global declared by those types; without them every component using it fails to typecheck.
- **Already applied:** `@angular/localize` is in `dependencies` at the same major as `@angular/core`, and the polyfill is present → skip.

**Troubleshooting — the computed pin.** This repo pins every install to a fixed SemVer major. This one is computed from the project instead, because `@angular/localize`'s major must equal `@angular/core`'s: Angular's packages are released in lockstep, and `@angular/localize/tools` (used by the Step 4 converter) is not semver-guaranteed across majors. It is still a caret range. If `@angular/localize` already sits in `devDependencies` at the wrong major, `ng add` at the right major replaces it. Keep it on the same major whenever `ng update` moves `@angular/core`.

---

## Step 3: Configure Extraction (`create_config`)

In `angular.json`, on `projects.<project>` (a sibling of `architect`), and on the existing `extract-i18n` target:

```json
"i18n": { "sourceLocale": "<sourceLocale>" },
"architect": {
  "extract-i18n": {
    "builder": "<keep existing>",
    "options": {
      "buildTarget": "<project>:build",
      "format": "xlf2",
      "outputPath": "src/locale",
      "outFile": "messages.<sourceLocale>.xlf"
    }
  }
}
```

Keep the existing `builder` value (`@angular/build:extract-i18n` or `@angular-devkit/build-angular:extract-i18n`); only set `options`. If the project has no `extract-i18n` target, add one with the builder that matches the build target's package (`@angular/build:extract-i18n` next to `@angular/build:application`) — Angular 20+ `ng new` projects have none.

- **Do not add `i18n.locales` and do not set `"localize"`** — either one switches the build to one output per locale (Step 1 explains why that breaks Capacitor). Target locales are listed in `src/locale-config.ts` (Step 5), not in `angular.json`.
- **Why `xlf2`:** XLIFF 2.0 carries each message's description as `<note category="description">`, which reaches the translator as the comment. Angular's `json` extraction format drops descriptions.
- **Already applied:** `i18n.sourceLocale` set and `extract-i18n.options.format` is `xlf2` → skip.

---

## Step 4: Converter Script + Package Scripts (`build_tool_integration`)

Nothing in the Angular runtime parses XLIFF — `loadTranslations()` takes `{ id: message }`. Write `scripts/xliff-to-json.mjs`, which converts every translated `src/locale/messages.<locale>.xlf` into `<assetsDir>/i18n/<locale>.json` using Angular's own parser (placeholder mapping, including inside ICU, is non-trivial — do not hand-roll it). Substitute `<sourceLocale>` and `<assetsDir>` from Step 1.

```js
// scripts/xliff-to-json.mjs
// Generated by i18n setup; owned by this project. Converts translated XLIFF files
// into the { id: message } JSON that loadTranslations() takes, using Angular's own
// parser. @angular/localize/tools is not semver-guaranteed — keep @angular/localize
// on the same major as @angular/core.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Xliff1TranslationParser, Xliff2TranslationParser } from '@angular/localize/tools'

const SOURCE_LOCALE = '<sourceLocale>' // = angular.json i18n.sourceLocale
const LOCALE_DIR = 'src/locale'
const OUT_DIR = '<assetsDir>/i18n'
const FILE_RE = /^messages\.(.+)\.xlf$/
// A unit with no <target> is untranslated so far. Angular's parser warns and uses the
// <source> text, which is what the app should show until a translation arrives.
const UNTRANSLATED = 'Missing <target> element'

if (!existsSync(LOCALE_DIR)) {
  console.log(`xliff-to-json: no ${LOCALE_DIR}/ yet — nothing to compile`)
  process.exit(0)
}

mkdirSync(OUT_DIR, { recursive: true })
for (const f of readdirSync(OUT_DIR)) if (f.endsWith('.json')) rmSync(join(OUT_DIR, f))

const parsers = [new Xliff2TranslationParser(), new Xliff1TranslationParser()]
let failed = false

for (const name of readdirSync(LOCALE_DIR).sort()) {
  const m = FILE_RE.exec(name)
  if (!m || m[1] === SOURCE_LOCALE) continue
  const fileLocale = m[1]
  const path = resolve(LOCALE_DIR, name)
  const contents = readFileSync(path, 'utf8')

  let bundle = null
  const rejected = []
  for (const parser of parsers) {
    const analysis = parser.analyze(path, contents)
    if (analysis.canParse) {
      bundle = parser.parse(path, contents, analysis.hint)
      break
    }
    rejected.push(...analysis.diagnostics.messages.map((d) => d.message))
  }
  if (!bundle) {
    console.error(`xliff-to-json: ${name} is not an XLIFF 1.2 or 2.0 file:\n - ${rejected.join('\n - ')}`)
    failed = true
    continue
  }

  const isUntranslated = (d) => d.type === 'warning' && d.message.includes(UNTRANSLATED)
  const untranslated = bundle.diagnostics.messages.filter(isUntranslated).length
  const fatal = bundle.diagnostics.messages.filter((d) => !isUntranslated(d))
  if (fatal.length) {
    console.error(`xliff-to-json: ${name}:\n - ${fatal.map((d) => `${d.type}: ${d.message}`).join('\n - ')}`)
    failed = true
    continue
  }
  if (bundle.locale && bundle.locale.toLowerCase() !== fileLocale.toLowerCase()) {
    console.error(`xliff-to-json: ${name} declares trgLang="${bundle.locale}" but its file name says "${fileLocale}"`)
    failed = true
    continue
  }

  const messages = {}
  for (const [id, translation] of Object.entries(bundle.translations)) messages[id] = translation.text
  writeFileSync(join(OUT_DIR, `${fileLocale}.json`), JSON.stringify(messages) + '\n')
  const note = untranslated ? `, ${untranslated} untranslated (shown in ${SOURCE_LOCALE})` : ''
  console.log(`xliff-to-json: ${name} → ${OUT_DIR}/${fileLocale}.json (${Object.keys(messages).length} messages${note})`)
}

if (failed) process.exit(1)
```

What it does on each input:

- **No `src/locale/` yet** → prints a note, exits 0.
- **A target file with some units untranslated** (no `<target>` — normal while translation is in progress) → Angular's parser emits a `Missing <target> element` warning per unit and substitutes the `<source>` text. The script counts those warnings, writes the JSON anyway, reports `N untranslated (shown in <sourceLocale>)`, and exits 0.
- **Any other diagnostic** — a malformed file, an error, any other warning, a file that is neither XLIFF 1.2 nor 2.0, or a `trgLang` that disagrees with the file name → prints the file and the diagnostics and **exits 1**, failing the build. A wrong translation file never ships silently.
- **A locale with no target file yet** → skipped; `main.ts` falls back to the source locale when the fetch 404s.
- The source file `messages.<sourceLocale>.xlf` is never converted — the source text is compiled into the bundle.

`@angular/localize/tools` imports `@angular/compiler-cli`, which every Angular CLI project already has as a devDependency.

Then the package scripts. Add `i18n:extract` (naming `<project>`, so extraction is unambiguous in a workspace with several projects) and `i18n:compile`, and **chain the compile into the existing `start` and `build` commands** — keep whatever those commands already were and prefix them:

```json
"scripts": {
  "start": "node scripts/xliff-to-json.mjs && ng serve",
  "build": "node scripts/xliff-to-json.mjs && ng build",
  "i18n:extract": "ng extract-i18n <project>",
  "i18n:compile": "node scripts/xliff-to-json.mjs",
  "ionic:serve:before": "node scripts/xliff-to-json.mjs",
  "ionic:build:before": "node scripts/xliff-to-json.mjs"
}
```

- **Do not use `prestart` / `prebuild`.** pnpm (default `enable-pre-post-scripts=false`) and Yarn Berry do not run pre-scripts, so the compile would silently never run there. A `&&` chain works under every package manager.
- **Ionic projects also get `ionic:serve:before` and `ionic:build:before`.** `ionic serve`, `ionic build` and `ionic capacitor run` call `ng run <project>:serve|build` directly and never invoke `npm start` / `npm run build`; the Ionic CLI runs these two npm-script hooks instead. Without them an Ionic build ships in the source language with no error. Add them whenever `ionic.config.json` exists or detection `ionic === true`; omit them otherwise.
- `ng serve` / `ng build` typed directly skip the compile. Use `npm start` / `npm run build` (or the Ionic CLI with the hooks above).
- **Already applied:** a script that already contains `xliff-to-json` is left alone.

---

## Step 5: Load Translations Before the App (`provider_wiring`)

Two files: `src/locale-config.ts` (shared constants, imported by `main.ts` before translations exist) and the rewritten `src/main.ts`.

```ts
// src/locale-config.ts
// Generated by i18n setup; owned by this project. main.ts imports this BEFORE
// translations load, so it must never import from app/ or use $localize.
export const LOCALES = ['en', 'lv', 'pt-BR'] as const // source locale first
export type AppLocale = (typeof LOCALES)[number]
export const SOURCE_LOCALE: AppLocale = 'en'
export const LOCALE_STORAGE_KEY = 'app.locale'
const RTL_LANGUAGES = ['ar', 'fa', 'he', 'ur']

/** Exact match, then language-subtag match, case-insensitive; null when nothing fits. */
export function matchLocale(tag: string | null | undefined): AppLocale | null {
  if (!tag) return null
  const wanted = tag.toLowerCase()
  const exact = LOCALES.find((l) => l.toLowerCase() === wanted)
  if (exact) return exact
  const language = wanted.split('-')[0]
  return LOCALES.find((l) => l.toLowerCase().split('-')[0] === language) ?? null
}

/** Stored choice → device languages in order → source locale. */
export function resolveLocale(stored: string | null, preferred: readonly string[]): AppLocale {
  if (matchLocale(stored)) return matchLocale(stored) as AppLocale
  for (const tag of preferred) {
    const match = matchLocale(tag)
    if (match) return match
  }
  return SOURCE_LOCALE
}

export const isRtl = (locale: string): boolean => RTL_LANGUAGES.includes(locale.split('-')[0].toLowerCase())
```

`LOCALES` is written from `decisions.md`: the source locale first, then the targets, in BCP-47 spelling (`pt-BR`, not `pt_BR`). The example values above are illustrative — never ship them unchanged. `SOURCE_LOCALE` equals `angular.json` `i18n.sourceLocale`. Keep the file erasable-syntax only (no `enum`, no namespaces, no parameter properties) so it also runs under `node --experimental-strip-types`.

Resolution is exact → language subtag → source: a device reporting `lv-LV` gets `lv`; `pt-PT` gets `pt-BR` when that is the only Portuguese; a stored value no longer in `LOCALES` (a removed locale) is ignored and resolution continues with the device languages.

**Locale data.** ICU plural categories in templates and Angular's own pipes come from Angular's locale data, so every locale in `LOCALES` other than `en` (built in) registers its data before bootstrap. For each, import `@angular/common/locales/<file>` where `<file>` is the locale itself when that file exists in `node_modules/@angular/common/locales/`, otherwise its language subtag — `pt-BR` → `pt` (which *is* Brazilian Portuguese; `pt-PT` is the European one), `zh-CN` → `zh-Hans`, `zh-TW` → `zh-Hant`, `en-US` → nothing (built in). Check with `ls node_modules/@angular/common/locales/<file>.js`. Register it under the **app** locale, not the file name: `registerLocaleData(localePt, 'pt-BR')` — `LOCALE_ID` is the app locale, and Angular looks the data up by that ID. A locale with no file at all → `needs_decision`.

### Standalone branch (`bootstrapApplication`)

```ts
// src/main.ts — standalone
import { registerLocaleData } from '@angular/common'
import localeLv from '@angular/common/locales/lv'
import localePt from '@angular/common/locales/pt'
import { LOCALE_ID } from '@angular/core'
import { loadTranslations } from '@angular/localize'
import { bootstrapApplication } from '@angular/platform-browser'
import { LOCALE_STORAGE_KEY, SOURCE_LOCALE, isRtl, resolveLocale, type AppLocale } from './locale-config'

const LOCALE_DATA: Partial<Record<AppLocale, unknown[]>> = { lv: localeLv, 'pt-BR': localePt }

function storedLocale(): string | null {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY)
  } catch {
    return null // storage blocked: fall through to the device language
  }
}

async function loadLocale(locale: AppLocale): Promise<AppLocale> {
  if (locale === SOURCE_LOCALE) return locale
  try {
    const res = await fetch(`<fetchPrefix>${locale}.json`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    loadTranslations(await res.json())
    return locale
  } catch (err) {
    console.warn(`[i18n] no translations for "${locale}" yet; showing ${SOURCE_LOCALE}`, err)
    return SOURCE_LOCALE
  }
}

async function main(): Promise<void> {
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language]
  const locale = await loadLocale(resolveLocale(storedLocale(), preferred))
  $localize.locale = locale
  for (const [id, data] of Object.entries(LOCALE_DATA)) registerLocaleData(data, id)
  document.documentElement.lang = locale
  document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr'

  // Everything that evaluates $localize is imported only now, after loadTranslations().
  // Never turn these back into static imports.
  const [{ AppComponent }, { appConfig }] = await Promise.all([
    import('./app/app.component'),
    import('./app/app.config'),
  ])
  await bootstrapApplication(AppComponent, {
    ...appConfig,
    providers: [...appConfig.providers, { provide: LOCALE_ID, useValue: locale }],
  })
}

main().catch((err) => console.error(err))
```

How to apply it to the project's own `main.ts`:

- **Keep the `/// <reference types="@angular/localize" />` line** that `ng add` put at the top of the file (Step 2); it stays line 1, above the imports.
- **`<fetchPrefix>`** is `i18n/` or `assets/i18n/` from Step 1. It is relative on purpose, so it resolves under Capacitor's `https://localhost` / `capacitor://localhost` origin and under any `<base href>`.
- **Convert every static `./app/…` import** the original `main.ts` had into the destructured `Promise.all([import(…)])`, keeping the original names — `AppComponent` from `./app/app.component` on Ionic and older projects, `App` from `./app/app` on Angular 20+ `ng new`; `routes` from `./app/app.routes` when the providers are inline. A static import evaluates every module-level `$localize` in that module graph **before** `loadTranslations()` runs, and that text stays in the source language with no error. Imports from packages (`@ionic/angular`, `@angular/router`, `@angular/common/http`) stay static.
- **Inline providers** (the Ionic starter's shape — `bootstrapApplication(AppComponent, { providers: [...] })` with no `app.config.ts`): keep them inline and append `{ provide: LOCALE_ID, useValue: locale }` to that array. Only when the project has `app.config.ts` spread `appConfig` as shown.
- **A failed fetch** (target file not translated yet, offline dev server) falls back to the source locale rather than blocking boot. `$localize.locale` is set to the locale actually loaded, which is what `currentLanguage()` and `formatLocale()` read.
- **Already applied:** `loadTranslations(` is present in `src/main.ts` and it has no static `./app/` import → skip the rewrite, but **reconcile the locale list**: add every locale in `decisions.md` that is missing from `LOCALES` in `src/locale-config.ts`, and give each new non-`en` locale its `@angular/common/locales/…` import and `LOCALE_DATA` entry in `main.ts`. A re-run that adds a target locale otherwise never makes it selectable.

### NgModule branch (`bootstrapModule`)

Same top half (imports, `LOCALE_DATA`, `storedLocale`, `loadLocale`, and the first six lines of `main()`); drop the static `bootstrapApplication` import, and the bottom of `main()` becomes:

```ts
  const [{ platformBrowser }, { AppModule }] = await Promise.all([
    import('@angular/platform-browser'),
    import('./app/app.module'),
  ])
  await platformBrowser([{ provide: LOCALE_ID, useValue: locale }]).bootstrapModule(AppModule)
```

Keep the module path and the platform function the project already uses: Angular 20+ `ng new --no-standalone` names the file `app-module.ts`, so the import is `import('./app/app-module')`; older projects use `./app/app.module` and `platformBrowserDynamic` from `@angular/platform-browser-dynamic` (it takes the same providers array).

**`LOCALE_ID` goes to the platform, not to `bootstrapModule`.** `bootstrapModule`'s second argument is compiler options, and its `providers` are compiler providers: an AOT build skips that compile step, so a `LOCALE_ID` passed there never reaches the app. Root `LOCALE_ID` resolves from the parent (platform) injector first, then falls back to `$localize.locale` — so the platform provider and the `$localize.locale` line above set the same value. **A module that provides `LOCALE_ID` itself overrides both:** grep `src/app/` for `provide: LOCALE_ID`. A hardcoded one whose value is the source locale is removed (guided mode confirms the edit first). Any other value → write `status: "needs_decision"` — `{ "step": "angular_hardcoded_locale_id", "question": "<file> hardcodes LOCALE_ID to '<value>'. Remove it so the locale follows the loaded language?", "options": ["remove", "stop"] }` — in both modes, because the app may rely on that locale for formatting today.

---

## Step 6: Locale Module + Language Switcher (`language_switcher`)

```ts
// src/app/i18n/locale.ts
import { LOCALES, LOCALE_STORAGE_KEY, SOURCE_LOCALE, type AppLocale } from '../../locale-config'

export const currentLanguage = (): AppLocale => ($localize.locale ?? SOURCE_LOCALE) as AppLocale

function endonym(code: string): string {
  const name = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code
  return name.charAt(0).toLocaleUpperCase(code) + name.slice(1)
}

/** Each language named in itself, so a user stuck in the wrong language can find theirs. */
export const availableLanguages: ReadonlyArray<{ code: AppLocale; name: string }> = LOCALES.map((code) => ({
  code,
  name: endonym(code),
}))

/** $localize is evaluated once per page load, so a language change is a reload. */
export function setLanguage(code: AppLocale): void {
  // Store even when the page already shows `code`: after a failed load the page shows the source
  // locale while storage still holds the failed one, and choosing the source must replace it.
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, code)
  } catch {
    return // storage blocked: a reload would come back in the same language
  }
  if (code !== currentLanguage()) location.reload()
}
```

**Ionic switcher** (`ionic === true`):

```ts
// src/app/i18n/language-switcher.component.ts
import { Component } from '@angular/core'
import { IonSelect, IonSelectOption } from '@ionic/angular'
import { availableLanguages, currentLanguage, setLanguage } from './locale'

@Component({
  selector: 'app-language-switcher',
  standalone: true, // the default only from Angular 19; required on 18
  imports: [IonSelect, IonSelectOption],
  template: `
    <ion-select
      label="Language"
      i18n-label="Label of the language picker@@settings.language.label"
      interface="popover"
      [value]="current"
      (ionChange)="change($event.detail.value)">
      @for (language of languages; track language.code) {
        <ion-select-option [value]="language.code">{{ language.name }}</ion-select-option>
      }
    </ion-select>`,
})
export class LanguageSwitcherComponent {
  readonly languages = availableLanguages
  readonly current = currentLanguage()
  readonly change = setLanguage
}
```

Ionic 9 exports standalone components from `@ionic/angular`; the `@ionic/angular/standalone` path is Ionic 8's and does not resolve on 9. On Ionic 8, import `IonSelect` / `IonSelectOption` from `@ionic/angular/standalone` — **unless the app is NgModule-based on `IonicModule.forRoot()`**: Ionic does not support mixing the module and standalone builds, so there set `imports: [IonicModule]` (from `@ionic/angular`) instead.

**Plain Angular switcher** (no Ionic): the same class and `standalone: true`, with this template and `imports: []`:

```html
<label i18n="Label of the language picker@@settings.language.label" for="language">Language</label>
<select id="language" (change)="change($any($event.target).value)">
  @for (language of languages; track language.code) {
    <option [value]="language.code" [selected]="language.code === current">{{ language.name }}</option>
  }
</select>
```

The language names are endonyms and deliberately not marked for translation — "Latviešu" must read "Latviešu" to a Latvian speaker stuck in English. For an NgModule app, add the (standalone) component to the declaring module's `imports`. **Mounting** `<app-language-switcher />` in a page (a settings page, a menu, the toolbar) is a guided question; unguided creates the component and lists "mount `<app-language-switcher>`" under Next steps. **Already applied:** `src/app/i18n/locale.ts` exists with `setLanguage` → skip.

---

## Step 7: First Extraction (`scaffold_catalogs`)

```bash
npm run i18n:extract
```

Creates `src/locale/messages.<sourceLocale>.xlf`. It may contain only the switcher's label at this point — Phase 3 marks the rest. Target files are **not** created here: they arrive from Globalize as `src/locale/messages.<locale>.xlf`, and the converter skips a locale with no file. Never hand-write a target file. **Already applied:** the source file exists → re-running is harmless (extraction is deterministic).

---

## Step 8: Ignore Generated Files (`gitignore_artifacts`)

Append to `.gitignore`:

```
# Runtime translation bundles — regenerated from src/locale/*.xlf by scripts/xliff-to-json.mjs
<assetsDir>/i18n/*.json
```

Never ignore `src/locale/*.xlf` — those are the catalog sources Globalize reads and writes. If the JSON is already tracked (`git ls-files '<assetsDir>/i18n/*.json'` prints anything), surface `git rm --cached <files>` and run it only with consent. **Already applied:** the line is present → skip.

---

## Step 9: Extract + Compile (`extract_compile`)

```bash
npm run i18n:extract
npm run i18n:compile
```

Both must exit 0. Before any target file exists, the compile prints nothing per locale and writes no JSON — that is expected.

---

## Format helpers (`generate_format_helpers`)

Always runs, on every Angular project, like Steps 2–9 — it does not wait for a `SKILL.md §1.10` selection. `generate_coding_rules` (Step 10) runs immediately after it and fails closed if `.globalize/format-module.json` is absent.

Create `src/app/i18n/format.ts`, a sibling of `locale.ts`. **If it already exists as project code, do not overwrite it** — add the ten-function surface and the pipe into it, or create `src/app/i18n/i18n-format.ts` instead; either way record the specifier actually used in `.globalize/format-module.json` below.

```ts
// src/app/i18n/format.ts
import { Pipe, type PipeTransform } from '@angular/core'
import { SOURCE_LOCALE } from '../../locale-config'

export type DateInput = Date | number | string
export type DatePreset = 'short' | 'medium' | 'long'

/**
 * THE SEAM. main.ts sets $localize.locale before the app is imported, and the
 * language only changes by reload, so this never goes stale.
 */
export function formatLocale(): string {
  return $localize.locale ?? SOURCE_LOCALE
}
```

All ten functions go through `formatLocale()` — this variant has the **full seam**. To format in a different locale source later (a user profile, a tenant setting), change `formatLocale()` and nothing else.

The rest of the module carries `pickRelativeUnit`, `UNITS`, `toDate`, `DATE_PRESETS`, `DEFAULT_CURRENCY`, the memo and `cached` inline, so the file stands alone:

```ts
/** This project's currency. Change it here, never at a call site. */
const DEFAULT_CURRENCY = 'USD'   // adjust to this project's currency

const DATE_PRESETS: Record<DatePreset, Intl.DateTimeFormatOptions> = {
  short: { dateStyle: 'short' },
  medium: { dateStyle: 'medium' },
  long: { dateStyle: 'long' },
}

// Keyed by locale + kind. The locale only changes by reload, which clears this too.
const memo = new Map<string, unknown>()
function cached<T>(key: string, make: () => T): T {
  let f = memo.get(key) as T | undefined
  if (f === undefined) memo.set(key, (f = make()))
  return f
}

const toDate = (v: DateInput): Date => (v instanceof Date ? v : new Date(v))

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['second', 1000],
  ['minute', 60_000],
  ['hour', 3_600_000],
  ['day', 86_400_000],
  ['week', 604_800_000],
  ['month', 2_629_746_000],
  ['year', 31_556_952_000],
]

/** Largest unit whose magnitude is at least 1; falls back to seconds. */
function pickRelativeUnit(deltaMs: number): [Intl.RelativeTimeFormatUnit, number] {
  const abs = Math.abs(deltaMs)
  for (let i = UNITS.length - 1; i >= 0; i--) {
    const [unit, ms] = UNITS[i]
    if (abs >= ms || i === 0) return [unit, Math.round(deltaMs / ms)]
  }
  return ['second', 0]
}

function nf(key: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const locale = formatLocale()
  return cached(`n:${locale}:${key}`, () => new Intl.NumberFormat(locale, opts))
}
function df(key: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const locale = formatLocale()
  return cached(`d:${locale}:${key}`, () => new Intl.DateTimeFormat(locale, opts))
}
function rtf(): Intl.RelativeTimeFormat {
  const locale = formatLocale()
  return cached(`r:${locale}`, () => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }))
}
function lf(type: 'and' | 'or'): Intl.ListFormat {
  const locale = formatLocale()
  return cached(`l:${locale}:${type}`, () =>
    new Intl.ListFormat(locale, { style: 'long', type: type === 'or' ? 'disjunction' : 'conjunction' }),
  )
}

export const money = (amount: number, currency: string = DEFAULT_CURRENCY) =>
  nf(`cur:${currency}`, { style: 'currency', currency }).format(amount)
export const number = (value: number, opts?: Intl.NumberFormatOptions) =>
  opts ? new Intl.NumberFormat(formatLocale(), opts).format(value) : nf('dec', { style: 'decimal' }).format(value)
export const percent = (value: number) => nf('pct', { style: 'percent' }).format(value)
export const compact = (value: number) => nf('cmp', { notation: 'compact' }).format(value)
export const unit = (value: number, u: string) => nf(`unit:${u}`, { style: 'unit', unit: u }).format(value)
export const date = (v: DateInput, preset: DatePreset = 'medium') =>
  df(`p:${preset}`, DATE_PRESETS[preset]).format(toDate(v))
export const time = (v: DateInput) => df('t', { timeStyle: 'short' }).format(toDate(v))
export const dateTime = (v: DateInput) =>
  df('dt', { dateStyle: 'medium', timeStyle: 'short' }).format(toDate(v))
export const relativeTime = (v: DateInput, now?: DateInput) => {
  const from = now === undefined ? Date.now() : toDate(now).getTime()
  const [u, amount] = pickRelativeUnit(toDate(v).getTime() - from)
  return rtf().format(amount, u)
}
export const list = (items: string[], type: 'and' | 'or' = 'and') => lf(type).format(items)
```

The file ends with the template pipe:

```ts
export type FmtKind = 'money' | 'number' | 'percent' | 'compact' | 'unit' | 'date' | 'time' | 'dateTime' | 'relativeTime' | 'list'

/** {{ price | fmt:'money' }}, {{ total | fmt:'money':'EUR' }}, {{ km | fmt:'unit':'kilometer' }}, {{ d | fmt:'date':'long' }}, {{ names | fmt:'list':'or' }} */
@Pipe({ name: 'fmt', standalone: true })
export class FmtPipe implements PipeTransform {
  transform(value: number | DateInput | string[] | null | undefined, kind: FmtKind, arg?: string): string {
    if (value === null || value === undefined) return ''
    switch (kind) {
      case 'money': return money(value as number, arg)
      case 'number': return number(value as number)
      case 'percent': return percent(value as number)
      case 'compact': return compact(value as number)
      case 'unit':
        if (!arg) throw new Error("fmt:'unit' needs a unit, e.g. fmt:'unit':'kilometer'")
        return unit(value as number, arg)
      case 'date': return date(value as DateInput, (arg as DatePreset | undefined) ?? 'medium')
      case 'time': return time(value as DateInput)
      case 'dateTime': return dateTime(value as DateInput)
      case 'relativeTime': return relativeTime(value as DateInput)
      case 'list': return list(value as string[], arg === 'or' ? 'or' : 'and')
    }
  }
}
```

**`FmtPipe` is pure**, which is correct here: the locale only changes by reload, so a pure pipe never shows a stale locale. One consequence to state to the user: `{{ updatedAt | fmt:'relativeTime' }}` does **not** tick — "3 minutes ago" stays until the input value changes. A live-updating relative time needs a component that re-renders on a timer and calls `relativeTime()`.

Angular's own `date`, `currency`, `number` and `percent` pipes also follow `LOCALE_ID`, but take hardcoded patterns, and `currency` defaults to USD; new code uses `fmt`. The convert phase decides which existing pipe uses to rewrite.

**Set `DEFAULT_CURRENCY` to the project's real currency** before writing the file. Grep for an existing `currency:` option, an `Intl.NumberFormat` / `toLocaleString` call, a `| currency:'EUR'` argument, or a hardcoded symbol. If nothing is findable, leave `'USD'` and keep the `// adjust to this project's currency` comment — a wrong currency that looks deliberate is worse than one that flags itself. Record the hit as `currencySource` (`grep:<file>:<line>`, or `default` when nothing was findable).

**The TypeScript `lib` gate.** `Intl.ListFormat` needs `es2021.intl`; `Intl.RelativeTimeFormat`, `notation: 'compact'` and `style: 'unit'` need `es2020.intl`. Read `tsconfig.json` `compilerOptions.lib` (falling back to what `target` implies). Angular 18+ projects default to `ES2022`, so this normally passes. If it resolves below `ES2021`, do **not** silently emit a module that fails `ng build` — write `status: "needs_decision"` with:

```json
{ "step": "format_module_ts_lib",
  "question": "format.ts needs Intl.ListFormat/RelativeTimeFormat types, which require tsconfig lib ES2021 or later (this project resolves to <current>). Raise lib to ES2021, or omit list() and relativeTime()?",
  "options": ["raise_lib", "omit_two"] }
```

and stop. On `omit_two` the surface still has ten entries in `format-module.json`; the two omitted ones are emitted as `throw new Error('list() requires tsconfig lib ES2021')` stubs so the contract holds and the failure is loud rather than silent.

**Write `.globalize/format-module.json`** with:

- `specifier` — the `tsconfig.json` `compilerOptions.paths` alias for `src/app/i18n/format` if one exists (check; do not assume `@/`); otherwise the literal `src/app/i18n/format`. Angular CLI projects have no alias by default, so call sites import it **relatively** (`../i18n/format`, `../../i18n/format`) — the rules file says so.
- `path` — `src/app/i18n/format.ts` (or `src/app/i18n/i18n-format.ts` if the fallback name was used).
- `surface` — `["money","number","percent","compact","unit","date","time","dateTime","relativeTime","list"]`.
- `defaultCurrency` and `currencySource`.

`generate_coding_rules` (Step 10) reads `specifier` back as the `formatModule` placeholder.

---

## Step 10: Generate Coding Rules (`generate_coding_rules` — always runs)

**This step is not optional and is not gated on a `SKILL.md §1.10` selection.** Phase 3's wrap subagents read `.agents/globalize-rules.md` as their authoring contract — description + explicit ID on every message, template ICU, `$localize` in TypeScript, the `main.ts` import rule, the formatters module — so conversion cannot start until this step has produced it. Sub-step 7, which points `CLAUDE.md` and `AGENTS.md` at the generated file, always runs too — it edits files the user owns, so guided mode confirms each edit, but it is not a §1.10 selection.

The Angular coding rules are a **generated file**, not a shipped one. `references/languages/js-ts/libraries/angular-localize/rules.template.md` covers every configuration this variant supports — Ionic or not, standalone or NgModule bootstrap. This step renders it down to the one configuration this project actually has and writes the result to `.agents/globalize-rules.md`.

**Read `references/rules-template-format.md` before rendering.** It is the whole rendering contract — template anatomy, the conditional grammar, the `<<placeholder>>` form, the step order, the header, the fail-closed rule. The steps below only add where *this variant's* values come from.

### 1. Locate the template

Read `.globalize/manifest-snapshot.json` → `references.rulesTemplate`.

**If the entry has no `rulesTemplate`**, the installed skill is out of date. Treat this exactly like the missing-file case below.

Verify the template exists in the target project.

- **If it exists**: proceed.
- **If it is missing — guided mode**: tell the user the `globalize-guide` skill is not installed in their project and stop this step. The fix is to reinstall it (`npx skills add globalize-now/globalize-skills --skill globalize-guide -a claude-code`). Don't attempt to recreate the file.
- **If it is missing — unguided mode**: do not block. Skip this step and record `⚠ Angular coding rules not generated — template missing` in the end-of-run summary, with the reinstall command shown above. Treat it as the fail-closed case in sub-step 6.

### 2. Resolve the template's `conditions`

Resolve every key listed in the template frontmatter's `conditions` and write them to `.globalize/rules-values.json`. Comparison values are string literals.

| Condition | Where to read it |
|---|---|
| `ionic` | `"true"` when `@ionic/angular` is in `package.json`; else `"false"` (the same predicate as Step 1 — not any `@ionic/*` package). |
| `bootstrap` | `"standalone"` when `src/main.ts` calls `bootstrapApplication(`; `"ngmodule"` when it calls `bootstrapModule(`. Read the file Step 5 wrote. |

### 3. Eliminate branches, then resolve the surviving `values`

Delete every false branch **and every marker line** (`<!-- if:`, `<!-- else -->`, `<!-- /if -->` all disappear, kept branch or not). Only then resolve the `values` still referenced in what survived — from the files **on disk**, what this setup actually wrote, not from `decisions.md` — appending them to the same `.globalize/rules-values.json`.

| Value | Where to read it |
|---|---|
| `sourceLocale` | `angular.json` → `projects.<project>.i18n.sourceLocale` (on disk, not `decisions.md`). |
| `targetLocales` | `LOCALES` in `src/locale-config.ts` minus the source, comma-separated: `lv, pt-BR`. |
| `catalogPath` | `<outputPath>/<outFile>` from `angular.json` `extract-i18n.options` — normally `src/locale/messages.<sourceLocale>.xlf`. Project-root-relative. |
| `formatModule` | `.globalize/format-module.json` → `.specifier`, written by `generate_format_helpers` immediately before this step. Absent → `generate_format_helpers` did not complete — this is the fail-closed case in sub-step 6, not a value to guess. |

### 4. Render

Substitute every surviving `<<name>>` with its resolved value, strip the frontmatter, and **copy everything retained verbatim** — do not rewrite, summarize, reflow, re-order, or improve the prose. Prepend the two-line generated header:

```
<!-- globalize-rules v<templateVersion> | template=angular-localize | variant=<manifest-snapshot variant> | generated by globalize-guide -->
<!-- Generated file. Re-running globalize-guide overwrites it. Put your own project rules in CLAUDE.md or AGENTS.md. -->
```

Write the result to `.agents/globalize-rules.md`, overwriting any file left by an earlier run.

**`.agents/globalize-rules.md` should be committed.** It is team-shared coding guidance, exactly like `CLAUDE.md`. Do **not** add it to `.gitignore`. Then confirm the file is actually tracked: run `git check-ignore .agents/globalize-rules.md`. If it comes back ignored, say so — do not silently succeed.

**Migrate off the old path.** Earlier versions of this skill wrote the rules to `.claude/globalize-rules.md`. **Only after the write above succeeded**, delete that file if it exists *and* its line 1 carries the generated header. A file at that path without the header is not ours — leave it and warn. Never remove the `.claude/` directory itself. The matching `@.claude/globalize-rules.md` line in `CLAUDE.md` is removed by the wiring step below.

### 5. Self-check the generated file

All four must hold:

- zero occurrences of `<!-- if:`, `<!-- else -->`, `<!-- /if -->`
- zero occurrences of `<<`
- the header is on line 1
- the line count is within the template's `budget` for the resolved conditions

### 6. Fail closed

If **any** surviving condition or value can't be resolved, or the self-check fails: **never write a partial file.** Delete anything already written to `.agents/globalize-rules.md`, then:

- **Guided mode** — ask the user for the specific value ("Which locale is the source?", "Where is the source XLIFF?"). Resolve, re-render, re-check. Only if the user can't answer, or the self-check still fails, stop this step and say which key or check failed.
- **Unguided mode** — don't block the run. Skip the step and record `⚠ Angular coding rules not generated (<key> unresolved) — no rules file installed` in the end-of-run summary.

Either way a **core step did not complete**: report `generate_coding_rules` as failed, leave it unchecked in `plan.md`, and tell the orchestrator that Phase 3 has no `.agents/globalize-rules.md` to wrap against. There is no generic-rules fallback. Installing nothing is recoverable — re-run this step. Installing rules that name the wrong catalog or the wrong formatters import is not; the agent follows them into a bug on every future edit.

### 7. Wire the coding rules in (`install_coding_rules` — always runs)

**This is a core sub-step, not an option**, and it is **not** gated on a `SKILL.md §1.10` selection. It edits files the user owns, so **guided mode** describes each change and waits for confirmation, **unguided mode** applies it directly.

If sub-step 6 fired and no `.agents/globalize-rules.md` was written, **skip this sub-step entirely and create neither file** — an import or pointer aimed at a missing file opens every future session with a dangling reference.

Two bridges, because no single mechanism reaches every agent.

#### `CLAUDE.md` — Claude Code

- **If it doesn't exist**, create it:
  ```
  # Project Instructions

  @.agents/globalize-rules.md
  ```
- **If it exists**, append `@.agents/globalize-rules.md` at the end of the file on its own line. Do not remove or reorder existing content.
- **If a stale `@.claude/globalize-rules.md` line is present** — written by an older version of this skill — remove it in the same edit.

If the exact `@.agents/globalize-rules.md` line is already present, skip silently — this sub-step is idempotent.

Tell the user: "The first time you start a Claude Code session in this project, you'll see a one-time prompt asking to approve the `@` import. Approve it — otherwise the rules won't load."

#### `AGENTS.md` — Codex CLI, Cursor, Copilot, Gemini, Aider, Cline

None of these support an import syntax, so the rules reach them as a pointer they must choose to follow.

- **If it doesn't exist**, create it with an `# AGENTS.md` heading and the section below — nothing else.
- **If it exists**, append the section at the end. Do not remove or reorder existing content.

```markdown
## Internationalization

Before adding or editing any user-facing string, read `.agents/globalize-rules.md`
and follow it. It is this project's authoritative i18n authoring contract — which
API to use, how to handle plurals, where catalogs live, and what not to wrap.
```

Idempotent on the literal `.agents/globalize-rules.md` appearing anywhere in `AGENTS.md`: present → skip silently.

Verify: in a fresh session, ask "how should I show an item count in this project?" — the answer should be a template ICU plural with a description and an `@@` ID, from the generated file.

---

## Optional: CI Extraction Check (`SKILL.md §1.10`)

Fails a pull request that adds or changes strings without re-extracting. Add to the project's CI (GitHub Actions shown):

```yaml
name: i18n
on: [pull_request]
jobs:
  extract:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run i18n:extract
      - run: git diff --exit-code src/locale/messages.<sourceLocale>.xlf
```

The snippet is for npm. On pnpm, Yarn or Bun, swap the cache key and the install line for that manager (`pnpm/action-setup` + `pnpm install --frozen-lockfile`, `yarn install --immutable`, `oven-sh/setup-bun` + `bun install --frozen-lockfile`) and run the script through it — `npm ci` fails outright without a `package-lock.json`.

---

## Verification

What `build_verification` (Phase 2) runs, and what the Phase 3 verify worker re-runs:

```bash
npm run i18n:extract     # exit 0; no line containing "duplicate" (case-insensitive)
npm run i18n:compile     # exit 0
npm run build            # exit 0 — runs the compile first, then ng build (typecheck included)
grep -nE "from[[:space:]]*['\"]\./app/|^[[:space:]]*import[[:space:]]*['\"]\./app/" src/main.ts   # must print nothing
```

The pattern keys on `from './app/…'` rather than on the `import` keyword, so a static import Prettier wrapped over several lines (`} from './app/app.component'` on the last line) is still caught; `import('./app/…')` never uses `from`, so the dynamic imports pass. A hit means some module that evaluates `$localize` loads before `loadTranslations()`; its text silently stays in the source language. Fix it by moving that import into the `Promise.all([import(…)])` inside `main()`.

---

## Common Gotchas

- **Text stays in the source language with no error** — a static `./app/…` import in `src/main.ts` (or a static import chain from it into code that uses `$localize`). Only `./locale-config` and packages may be imported statically.
- **`ng serve` / `ng build` typed directly** skip the compile; the app shows the source language (or stale JSON). Use `npm start` / `npm run build`, or the Ionic CLI with the `ionic:*:before` hooks.
- **`|` in a description** — Angular reads the text before `|` as a *meaning*, which changes the message identity. Never use `|` in a description.
- **`pt-BR` has no locale-data file** — `@angular/common/locales/pt` is Brazilian Portuguese; register it under `'pt-BR'`. Same pattern for `zh-CN` → `zh-Hans`, `zh-TW` → `zh-Hant`.
- **Adding `i18n.locales` or `"localize"`** to `angular.json` turns the build into one output per locale and breaks Capacitor. Target locales live in `src/locale-config.ts`.
- **`navigator.language` in a WebView reports the device language** with a region (`lv-LV`). Resolution falls back to the language subtag, so `lv` still matches.
- **`Missing <target> element` lines** from the compile are untranslated units, not errors — the app shows the source text for them until the translation arrives.
- **Translations missing at runtime even though the target XLIFF has them** — the converter did not run before the build (see the second bullet), or the target file name and its `trgLang` disagree (the converter exits 1 and names the file).

---

## Next Steps

- **Wrap existing strings** — run the convert phase (`angular-localize.convert.md`). It marks templates with `i18n` / `i18n-*`, TypeScript with `$localize` (including Ionic overlay controllers), turns counts into template ICU plurals, and routes values through the formatters module.
- **Mount the switcher** — place `<app-language-switcher />` in a settings page or menu.
- **RTL** — if a target locale is right-to-left, `main.ts` already sets `<html dir>`; convert the CSS to logical properties with the `css-i18n` skill.
- **Connect Globalize** — `fileFormat: xliff-2`, pattern `src/locale/messages.{locale}.xlf` (the source `messages.<sourceLocale>.xlf` matches the same pattern).
- **Native strings** — when `android/` or `ios/` exists, the app name and permission prompts stay in the source language; this setup localizes the web UI only.
