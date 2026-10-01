# Ionic / Angular / Capacitor Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 24th `globalize-guide` variant, `angular-localize` (Angular ± Ionic ± Capacitor on `@angular/localize`, XLIFF 2.0, runtime `loadTranslations()`), and stop hard-stopping Ionic React / Ionic Vue + Capacitor apps that the existing Vite variants already fit.

**Architecture:** Detection gains `framework: "angular"` plus three fields (`angular`, `ionic`, `hybrid`); §1.2 widens the "supported UI frameworks" stop, adds four Angular stops, and narrows the Capacitor/Cordova/Ionic row to `language === "android"`. One self-contained setup reference (iOS-style: it is also the rules-resolution host) writes the angular.json config, an XLIFF → JSON converter script built on Angular's own parser, a `main.ts` boot sequence that loads translations before dynamically importing the app, a locale module, a formatters module with an `fmt` pipe, and renders a new ninth rules template. The Vite Lingui and Vite vue-i18n setup references learn to skip the locale-routing question when `hybrid === "capacitor"`.

**Tech Stack:** Markdown skill references and rules templates; `manifest.json` / `manifest.schema.json` (validated by `evals/verify-manifest.sh`); bash eval verifiers (bash 3.2 compatible — no associative arrays, no `mapfile`); `jq`, `python3`; Angular 18–22 (`@angular/localize`, `@angular/build:application`), Ionic 9, Capacitor 8.

**Spec:** `docs/superpowers/specs/2026-10-01-ionic-angular-capacitor-design.md` — read it before Task 1. Executors read both documents.

**Template siblings to copy structure from:**
- Setup reference: `skills/globalize-guide/references/languages/ios/native/string-catalog.setup.md` (Out of Scope → Step Risk Classification → Setup Mode → numbered steps → "Format helpers (`generate_format_helpers`)" → "Step 8: Generate Coding Rules" with its own resolution tables, render, self-check, fail-closed, `install_coding_rules` → Common Gotchas → Next Steps). It is the sibling whose setup file **is** its own resolution host — that is what this variant needs, because the manifest lists only one setup file.
- Formatters module body: `skills/globalize-guide/references/languages/js-ts/frameworks/webext/webext-native.setup.md` lines 750–992 (memo, `nf`/`df`/`rtf`/`lf`, the ten exports, the TS-`lib` gate, the `DEFAULT_CURRENCY` grep, the `format-module.json` paragraph).
- Convert reference: `skills/globalize-guide/references/languages/js-ts/frameworks/webext/webext-native.convert.md`.
- Rules template: `skills/globalize-guide/references/languages/js-ts/frameworks/webext/webext-native.rules.template.md` (frontmatter shape).

**Path shorthand used below:** `G=skills/globalize-guide`, `JS=skills/globalize-guide/references/languages/js-ts`.

## Global Constraints

- **Angular version floor: 18** (Ionic 9's peer floor). Only Angular 22 has been exercised.
- **Support level: `experimental`** for `angular-localize`. Say so at the §1.5 confirmation.
- **Catalog format: XLIFF 2.0** — `ng extract-i18n` `format: "xlf2"`, Globalize `fileFormat: xliff-2`, pattern `src/locale/messages.{locale}.xlf`, source file `src/locale/messages.<sourceLocale>.xlf` (committed).
- **Message IDs are explicit `@@feature.element.purpose`; every message carries a description.** No auto IDs.
- **ICU in templates only.** Never in `$localize`. Never choose between messages with `Intl.PluralRules`.
- **Language switch = persist to `localStorage` + `location.reload()`.** No in-place switching.
- **Nothing that evaluates `$localize` may be statically imported by `src/main.ts`.** The app is imported with `import()` after `loadTranslations()`.
- **`@angular/localize` is installed by `ng add` inside the setup subagent, pinned to the project's Angular major:** `npx ng add '@angular/localize@^<major>' --skip-confirmation --use-at-runtime`. The manifest's `packages` arrays stay empty. Single-quote every caret pin in shell snippets.
- **SSR, AnalogJS, non-`application` builders, Angular < 18, Transloco, ngx-translate: STOP.** Cordova: non-blocking warning. Native app name / permission strings: out of scope (notice only).
- **Rules-template grammar:** one key, one operator, one double-quoted literal per `<!-- if: -->`; no nesting, no `&&`/`||`/`elif`; `<!-- /if -->` required; markers alone on their line; placeholders `<<name>>`, never `{{ }}`. Outside a code fence, `{{ identifier }}` fails the linter — keep Angular interpolation examples inside fences.
- **Rules-template self-containment (hard):** the body must not contain `.claude/`, a `references/…` path, or the literal `globalize-guide`.
- **Every declared `values:` key is used and every used `<<key>>` is declared.**
- **Guided/unguided:** every setup step describes the change and waits in guided mode, applies directly in unguided mode, and detects an already-applied state and skips.
- **BCP-47 locale variables are named `locale`, never `lang`** (the HTML `lang` attribute keeps its name).
- **Never add a `Co-Authored-By: Claude` trailer** to commits and never add a "Generated with Claude Code" line to PR bodies (user's global rule; overrides any default).

## Review Focus

The five uncovered conditions most likely to bite a real user, each pinned by a test in the owning task:

1. **Ionic CLI bypasses npm scripts.** `ionic serve` / `ionic build` / `ionic capacitor run` call `ng run app:serve|build` directly, so a compile step wired only into `start`/`build` never runs and the app silently ships in the source language. Expected: Ionic projects also get `ionic:serve:before` and `ionic:build:before` hooks. → Task 3 Step 1 check + Task 11 Step 6.
2. **Partially translated target XLIFF** (a unit with no `<target>` — normal mid-translation). Expected: the converter still writes the JSON, falls back to source text for that unit, reports the count, and exits 0; a genuinely malformed file exits 1. → Task 3 (converter code) + Task 11 Step 4.
3. **Region-tagged locales** — target `pt-BR` (no `@angular/common/locales/pt-BR` file exists; `pt` is Brazilian Portuguese), device language `lv-LV` against configured `lv`, a stale stored locale no longer configured. Expected: locale data maps to the nearest existing file and registers under the app locale; resolution goes exact → language subtag → source. → Task 3 Step 1 check + Task 11 Steps 3 and 5.
4. **Existing compile-time Angular i18n** (`i18n.locales` and/or a `localize` build option). Expected: setup does not layer runtime loading on top (that build emits `www/<locale>/index.html`, which breaks Capacitor); it asks (guided) or stops with an explanation (unguided). → Task 3 Step 1 check.
5. **Multi-project `angular.json`.** Expected: with more than one `projectType: "application"` project, setup asks which one rather than editing the first. → Task 3 Step 1 check.

## Locked decisions made during planning

These refine the spec. Surface them in the PR body.

1. **Converter diagnostics: fail on every diagnostic except `Missing <target> element`.** The spec says "fails the build on any parse diagnostic". Verified in `@angular/localize@22.2.1` (`tools/bundles/chunk-3RM6N5W6.js`, `Xliff2TranslationVisitor.visitSegmentElement`): a unit without `<target>` raises a **warning** and the parser substitutes the `<source>`. Failing on it would break every build while translation is in progress. That one warning is counted and reported; everything else (errors, other warnings, wrong root, `trgLang` mismatch) exits 1.
2. **Compile wiring chains into `start` and `build` instead of `prestart`/`prebuild`.** pnpm (default `enable-pre-post-scripts=false`) and Yarn Berry do not run pre-scripts, so the spec's wiring silently does nothing there. Chaining `node scripts/xliff-to-json.mjs && <existing command>` works under every package manager. Ionic projects additionally get `ionic:serve:before` / `ionic:build:before` (verified in ionic-docs `docs/cli/configuration.mdx`: the Angular web build is `ng run app:build`, and those npm-script hooks exist).
3. **Shared boot constants live in `src/locale-config.ts`** (outside `app/`, no `$localize`). `main.ts` needs the locale list and storage key before the app loads; `src/app/i18n/locale.ts` re-uses them. This keeps "no static import from `app/`" a mechanical grep.
4. **Locale data maps to an existing file.** Verified against the `@angular/common@22.2.1` file list: `pt`, `pt-PT`, `lv`, `zh-Hans`, `zh-Hant`, `es-419`, `sr-Latn` exist; `pt-BR`, `zh-CN`, `zh-TW`, `en-US` do not. Setup imports the exact file when it exists, else the language-subtag file, and calls `registerLocaleData(data, '<app locale>')`.
5. **The routing-strategy question is skipped for every Angular app**, not only Capacitor ones — the one-build / reload model has no URL locale. `decisions.md` records `None — …`.
6. **The JSON output dir follows `angular.json` `assets`:** `public/i18n/` when an asset entry has `input: "public"` (Angular 17+ default), `src/assets/i18n/` when only `src/assets` is configured. Fetch path follows (`i18n/<locale>.json` vs `assets/i18n/<locale>.json`).
7. **§1.2's custom-build-pipeline row gains `angular.json`.** The spec omitted it; without it every Angular project stops there.
8. **Angular's built-in pipes:** new code uses `fmt`. The format pass rewrites only `| date:'<custom pattern>'` and `| currency` with no currency-code argument (it defaults to USD); `| number` / `| percent` / named-format `| date` follow `LOCALE_ID` and are left alone.
9. **Detection reports `router: "angular-router"`** when `@angular/router` is a dependency (informational; nothing keys on it).
10. **`ng add … --use-at-runtime`** (angular.dev "Add the localize package": moves the package to `dependencies`, which runtime `loadTranslations()` needs).
11. **`evals/verify-orchestration.sh` gains a `decisionsSections` expectation.** The spec's "plan has no URL-prefix routing" has no plan step id to anchor on; routing lives in `decisions.md`.
12. **NgModule `LOCALE_ID`** is passed via `bootstrapModule(AppModule, { providers: [...] })` (documented on angular.dev for `TRANSLATIONS`; same options object).

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `G/SKILL.md` | Detection fields/rows, §1.2 stops, §1.3 trace, §1.5 row, §1.7 routing skip, §1.10, Phase 2–4 arms, plan skeleton | Modify |
| `G/manifest.schema.json` | `match.angular` boolean | Modify |
| `G/manifest.json` | `angular-localize` entry; `incompatibleStacks` row widened | Modify |
| `JS/libraries/angular-localize/rules.template.md` | Ninth rules template | Create |
| `JS/frameworks/angular/angular-localize.setup.md` | Phase 2 setup + resolution host + coding-rules render/install | Create |
| `JS/frameworks/angular/angular-localize.convert.md` | Phase 3 wrapping + Angular format-pass additions | Create |
| `JS/convert.recall-self-check.md` | Angular recall-scan bullet | Modify |
| `JS/frameworks/vite/react-swc/lingui.setup.md`, `JS/frameworks/vite/react-babel/lingui.setup.md`, `JS/frameworks/vite/vue/vue-i18n.setup.md` | Capacitor → skip routing question | Modify |
| `JS/libraries/lingui/convert.standard-react.md`, `JS/frameworks/vite/vue/vue-i18n.convert.md` | Ionic component notes | Modify |
| `skills/globalize-now-project-setup/SKILL.md` | Angular detection + `.xlf` pattern/format rows | Modify |
| `evals/verify-format-helpers.sh` | Ninth pair | Modify |
| `evals/verify-orchestration.sh` | `decisionsSections` | Modify |
| `evals/library-checks/angular-localize.sh` | Layer B checker (Verify 1–4, 6) | Create |
| `evals/fixtures.json`, `evals/expectations/**`, `fixtures/ionic-angular-capacitor/`, `fixtures/ionic-react-capacitor/`, `fixtures/ionic-vue-capacitor/`, `fixtures/hard-stop/angular-ssr/` | Layer A fixtures + goldens | Create/Modify |
| `CLAUDE.md`, `G/references/rules-template-format.md`, `evals/README.md` | Counts (24 variants, 9 templates), docs | Modify |

---

## Task 1: Detection + compatibility stops (SKILL.md §1.1/§1.2, schema) + `angular-ssr` hard-stop fixture

**Files:**
- Modify: `G/SKILL.md` (§1.1 schema + JS detection table + user-facing scan message; §1.2)
- Modify: `G/manifest.schema.json` (`$defs.match.properties`)
- Modify: `G/manifest.json` (`incompatibleStacks[2]`)
- Create: `fixtures/hard-stop/angular-ssr/{package.json,package-lock.json,angular.json,tsconfig.json,src/main.ts,src/main.server.ts,src/server.ts,src/app/app.ts}`
- Create: `evals/expectations/detection/angular-ssr.json`, `evals/expectations/hard-stop/angular-ssr.json`
- Modify: `evals/fixtures.json`

**Interfaces:**
- Produces detection fields every later task reads: `framework: "angular"`, `angular: boolean`, `ionic: boolean`, `hybrid: "capacitor" | "cordova" | null`, `router: "angular-router"`, `version` (Angular `major.minor`), `existing.library` values `"@angular/localize" | "@jsverse/transloco" | "@ngx-translate/core"`.
- Produces schema key `match.angular` (boolean).

- [ ] **Step 1: Write the failing check**

```bash
cd skills/globalize-guide
grep -q '"angular": true | false' SKILL.md \
 && grep -q '"hybrid": "capacitor" | "cordova" | null' SKILL.md \
 && grep -q '`@angular/core` in deps → angular' SKILL.md \
 && grep -q '`@angular/ssr`' SKILL.md \
 && grep -q '`@analogjs/' SKILL.md \
 && grep -q '@angular/build:application' SKILL.md \
 && grep -q 'angular.json' SKILL.md \
 && grep -q '`language === "android"` AND (`@capacitor/core`' SKILL.md \
 && jq -e '."$defs".match.properties.angular.type == "boolean"' manifest.schema.json >/dev/null \
 && echo PASS || echo FAIL
```

Expected: `FAIL`.

- [ ] **Step 2: Edit the §1.1 detection schema** (the fenced JSON inside the inspect prompt):
  - `framework` enum: add `"angular"` after `"webext"`.
  - `router` enum: add `"angular-router"`.
  - After the `"svelte": true | false,` line add:
    ```
    >   "angular": true | false,
    >   "ionic": true | false,
    >   "hybrid": "capacitor" | "cordova" | null,
    ```
  - `existing.library` enum: add `"@angular/localize" | "@jsverse/transloco" | "@ngx-translate/core"` before `"none"`.

- [ ] **Step 3: Edit the §1.1 JS detection-rules table.**
  - `framework` row: insert, immediately before "`vite` in devDeps (and none of the above) → vite.": "`@angular/core` in deps → angular (checked after SvelteKit and before the `vite` fallback: AnalogJS carries both `@angular/core` and `vite`, and must reach §1.2's AnalogJS stop instead of a Vite variant)." Extend the parenthetical "Order matters: …" with ", and Angular must be checked before the `vite` fallback for the same reason."
  - `router` row: append "Angular: `@angular/router` in deps → `angular-router` (informational only — no manifest entry keys on it)."
  - `compiler` row: append "Angular → `null` (the Angular compiler is not modeled; the Angular entry does not key on `compiler`)."
  - Add rows after the `svelte` row:
    | Field | How to detect |
    |---|---|
    | `angular` | `@angular/core` in deps or devDeps. |
    | `ionic` | Any `@ionic/*` package in deps or devDeps (`@ionic/angular`, `@ionic/react`, `@ionic/vue`, …). |
    | `hybrid` | `@capacitor/core` in deps → `capacitor` (wins if both are present). Else `cordova` or any `cordova-*` package in deps, or a root `config.xml` with a `<widget>` root → `cordova`. Else `null`. |
  - Add a `version` row for JS: "For `framework === "angular"`: the resolved `@angular/core` version as `major.minor` — read the lockfile first; if there is none, the lowest version the `package.json` range admits. §1.2's Angular floor and the setup's `ng add` pin read it. `null` for every other JS framework."
  - `existing.library` row: append "`@angular/localize`, `@jsverse/transloco` and `@ngx-translate/core` are matched by exact package name."
  - `existing.configured` row: append "; OR (Angular) `@angular/localize/init` is in the application build target's `polyfills` in `angular.json` AND that project has an `i18n` block."
  - `existing.providerWired` row: append "; OR (Angular) `loadTranslations(` appears in `src/main.ts`."
  - `existing.stringsWrapped` row: append "For Angular, glob `src/**/*.{html,ts}` and count files carrying an `i18n` / `i18n-*` attribute or a `$localize` tag."
  - `candidateFiles` row: append "**For `framework === "angular"`, also glob `src/**/*.html`** — component templates carry most of the user-visible text — excluding `src/index.html` (it is outside Angular; the convert reference covers the document title). Count bare text nodes and the attributes above, plus Ionic text props (`label=`, `text=`, `header=`, `message=`, `cancel-text=`, `ok-text=`) with literal values."
  - `formatCandidateFiles` row: append "**For `framework === "angular"`, also glob `src/**/*.html`** and match: a `$` immediately before `{{`; `| currency` with no currency-code argument (it defaults to USD); `| date:'` followed by a custom pattern (one containing `y`, `M` or `d` — not a named format like `'short'` or `'mediumDate'`); and `.toFixed(` inside `{{ }}`. Exclude `src/app/i18n/format.ts`."
  - After the paragraph beginning "Likewise, for a `framework: "webext"` detection" add: "For **every** detection, `angular`, `ionic` and `hybrid` MUST be populated — on non-`js-ts` detections they are `false`, `false`, `null`. The §1.2 hybrid rows and the §1.7 routing skip read them."
- [ ] **Step 4: Edit the user-facing scan message** (after the inspect subagent returns). Add a line:
  > For `framework === "angular"` (`compiler` is not meaningful, so omit it): "Scan done. Detected: **Angular {version}**{ + Ionic when `ionic`}{ + Capacitor/Cordova when `hybrid`} ({packageManager}). Existing i18n: **{existing.library}** ({existing.configured ? 'already configured' : 'not configured yet'}). Found **{candidateFiles.length}** files with hardcoded strings and **{formatCandidateFiles.length}** files formatting values by hand. Next, a few questions to shape the setup plan."

- [ ] **Step 5: Edit §1.2.**
  - Replace the "**Evaluate first (signal stops):**" paragraph with:
    > **Evaluate first (signal stops):** the **React Native** and **Flutter** rows in the "Android compatibility rules" block below are checked **before** the generic rows in the table that follows, so those projects receive their specific, actionable message rather than the generic "supported frameworks" stop. The Capacitor/Cordova/Ionic row is **not** a signal stop any more: it applies only when `language === "android"`. On the JS path a hybrid app is localized in its web layer like any other web app, and the Angular and Vite entries match it.
  - First generic row: condition becomes `` `language === "js-ts"` AND `framework !== "webext"` AND `react === false` AND `vue === false` AND `svelte === false` AND `angular === false` ``; message becomes "globalize-guide currently supports React-based, Vue-based, Svelte-based, and Angular-based projects only. This project uses {framework}. No supported library available."
  - `existing.library` migration row: add `@jsverse/transloco`, `@ngx-translate/core` to the list.
  - Custom-build-pipeline row: add `angular.json` to the parenthesised list, and append "Angular requires `angular.json`." to the message.
  - Insert a new block after the browser-extension block:

    **Angular compatibility rules** (apply only when `framework === "angular"`):

    | Condition | Action |
    |---|---|
    | `@angular/ssr` in deps | **STOP.** "This Angular app uses server-side rendering (`@angular/ssr`). The supported setup loads translations at runtime with `loadTranslations()`, which sets a process-wide global — on a server it cannot differ between two concurrent requests, so one visitor would be served another's language. SSR is not supported yet. Remove `@angular/ssr` for a client-only build, or wait for SSR support, then re-run." |
    | Any `@analogjs/*` package in deps or devDeps | **STOP.** "This is an AnalogJS app. AnalogJS (Vite-based Angular meta-framework) is not supported — the Angular setup targets the Angular CLI application builder." |
    | Any `projectType: "application"` project in `angular.json` whose `architect.build.builder` is neither `@angular/build:application` nor `@angular-devkit/build-angular:application` | **STOP.** "This project builds with `{builder}`. The Angular setup needs the application builder (`@angular/build:application`). Migrate with `ng update @angular/cli --name use-application-builder`, then re-run." |
    | `version` major `< 18` | **STOP.** "This project is on Angular {version}. The Angular setup supports Angular 18 and later (Ionic 9's floor). Upgrade with `ng update`, then re-run." |

  - Android block: change the Capacitor row's condition to `` `language === "android"` AND (`@capacitor/core`, `cordova`, or any `@ionic/*` in `package.json`) AND an `android/` folder present ``, and its intro sentence to say only the React Native and Flutter rows fire on signals independent of `language`.
  - Insert a **Hybrid-app notes** block (non-blocking) after the Android block:

    | Condition | Action |
    |---|---|
    | `hybrid === "cordova"` | **Warn (non-blocking).** "This is a Cordova app. Its web layer is localized exactly like a browser app, so the setup proceeds; Cordova itself is in maintenance mode and only the Capacitor path has been exercised." |
    | `hybrid !== null` AND an `android/` or `ios/` folder exists | **Notice (non-blocking).** "The app name and native permission prompts (`NS*UsageDescription`, Android `app_name`) live in native files and stay in the source language — this setup localizes the web UI only." |

- [ ] **Step 6: Edit `G/manifest.schema.json`** — add to `$defs.match.properties`, after `"svelte"`:

```json
        "angular": {
          "type": "boolean"
        },
```

- [ ] **Step 7: Edit `G/manifest.json` `incompatibleStacks`** — the third entry becomes:

```json
    {
      "match": {
        "language": "js-ts",
        "react": false,
        "vue": false,
        "svelte": false,
        "angular": false
      },
      "reason": "These skills currently target React-based, Vue-based, Svelte-based, and Angular-based projects only."
    }
```

- [ ] **Step 8: Create the `angular-ssr` hard-stop fixture.**

`fixtures/hard-stop/angular-ssr/package.json`:
```json
{
  "name": "news-portal",
  "version": "0.1.0",
  "private": true,
  "scripts": { "ng": "ng", "start": "ng serve", "build": "ng build", "serve:ssr": "node dist/news-portal/server/server.mjs" },
  "dependencies": {
    "@angular/common": "^22.2.0",
    "@angular/compiler": "^22.2.0",
    "@angular/core": "^22.2.0",
    "@angular/platform-browser": "^22.2.0",
    "@angular/platform-server": "^22.2.0",
    "@angular/router": "^22.2.0",
    "@angular/ssr": "^22.2.0",
    "express": "^5.1.0",
    "rxjs": "~7.8.0",
    "tslib": "^2.8.0"
  },
  "devDependencies": {
    "@angular/build": "^22.2.0",
    "@angular/cli": "^22.2.0",
    "@angular/compiler-cli": "^22.2.0",
    "typescript": "~5.9.0"
  }
}
```
(Fixtures are never installed in Layer A; the ranges only have to be plausible.)

`fixtures/hard-stop/angular-ssr/package-lock.json`:
```json
{ "name": "news-portal", "lockfileVersion": 3, "requires": true, "packages": {} }
```

`fixtures/hard-stop/angular-ssr/angular.json`:
```json
{
  "version": 1,
  "projects": {
    "news-portal": {
      "projectType": "application",
      "root": "",
      "sourceRoot": "src",
      "architect": {
        "build": {
          "builder": "@angular/build:application",
          "options": {
            "outputPath": "dist/news-portal",
            "index": "src/index.html",
            "browser": "src/main.ts",
            "server": "src/main.server.ts",
            "ssr": { "entry": "src/server.ts" },
            "outputMode": "server",
            "tsConfig": "tsconfig.json"
          }
        }
      }
    }
  }
}
```

`fixtures/hard-stop/angular-ssr/tsconfig.json`:
```json
{ "compilerOptions": { "strict": true, "target": "ES2022", "module": "preserve", "lib": ["ES2022", "dom"] } }
```

`fixtures/hard-stop/angular-ssr/src/main.ts`:
```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';

bootstrapApplication(App).catch((err) => console.error(err));
```

`fixtures/hard-stop/angular-ssr/src/main.server.ts`:
```ts
import { bootstrapApplication, type BootstrapContext } from '@angular/platform-browser';
import { App } from './app/app';

export default (context: BootstrapContext) => bootstrapApplication(App, {}, context);
```

`fixtures/hard-stop/angular-ssr/src/server.ts`:
```ts
import { AngularNodeAppEngine, createNodeRequestHandler, writeResponseToNodeResponse } from '@angular/ssr/node';
import express from 'express';

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use((req, res, next) => {
  angularApp.handle(req).then((response) => (response ? writeResponseToNodeResponse(response, res) : next())).catch(next);
});

export const reqHandler = createNodeRequestHandler(app);
```

`fixtures/hard-stop/angular-ssr/src/app/app.ts`:
```ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `<h1>Today's headlines</h1><p>Read the stories everyone is talking about.</p>`,
})
export class App {}
```

`evals/expectations/detection/angular-ssr.json`:
```json
{
  "match": {
    "language": "js-ts",
    "framework": "angular",
    "angular": true,
    "react": false, "vue": false, "svelte": false
  },
  "ignore": ["candidateFiles", "formatCandidateFiles", "routeEntries", "git", "localeSignals", "version", "sourceDir", "packageManager", "platform", "buildSystem", "uiFramework", "existing", "compiler", "router", "hybrid", "ionic"]
}
```

`evals/expectations/hard-stop/angular-ssr.json`:
```json
{
  "messageContains": "@angular/ssr",
  "mustNotCreate": [".globalize/plan.md", ".globalize/manifest-snapshot.json"],
  "mustCreate": [".globalize/detection.json"],
  "depsMustBeUnchanged": true
}
```

`evals/fixtures.json` — add:
```json
  "angular-ssr": {
    "category": "hard-stop",
    "type": "local",
    "path": "fixtures/hard-stop/angular-ssr",
    "library": null,
    "variant": null,
    "expectedDetection": "evals/expectations/detection/angular-ssr.json",
    "expectedHardStop": "evals/expectations/hard-stop/angular-ssr.json"
  }
```

- [ ] **Step 9: Run the checks**

```bash
# Step 1 block → PASS
jq -e . evals/fixtures.json >/dev/null && echo "fixtures.json valid"
./evals/verify-manifest.sh   # expect Failed: 0 (Layer 1 skips with a WARN if jsonschema is absent; install it with `pip install jsonschema` and re-run so the schema change is actually validated)
```

- [ ] **Step 10: Commit**

```bash
git add skills/globalize-guide/SKILL.md skills/globalize-guide/manifest.schema.json skills/globalize-guide/manifest.json fixtures/hard-stop/angular-ssr evals/expectations/detection/angular-ssr.json evals/expectations/hard-stop/angular-ssr.json evals/fixtures.json
git commit -m "feat(globalize-guide): detect Angular/Ionic/Capacitor and stop only on unsupported Angular shapes"
```

---

## Task 2: The ninth rules template

**Files:**
- Create: `JS/libraries/angular-localize/rules.template.md`

**Interfaces:**
- Produces: template id `angular-localize`, `templateVersion: 1`, `conditions: [ionic, bootstrap]` (`ionic` ∈ `"true"`/`"false"`, `bootstrap` ∈ `"standalone"`/`"ngmodule"`), `values: [sourceLocale, targetLocales, catalogPath, formatModule]`. Task 3's resolution tables must resolve exactly these.

- [ ] **Step 1: Failing check**

```bash
./evals/verify-rules-template.sh 2>&1 | grep -q 'angular-localize/rules.template.md: self-contained' && echo PASS || echo FAIL
```

Expected: `FAIL`.

- [ ] **Step 2: Create the template** with exactly this content:

````markdown
---
name: angular-localize-code
user_invocable: false
description: >-
  Apply automatically whenever writing or modifying UI code in an Angular app that
  localizes with @angular/localize — component templates, component and service
  TypeScript, Ionic overlay controllers, or any change that adds or edits
  user-visible text. Not user-invocable. Ensures every message carries a
  description and an explicit ID, plurals use template ICU, and values are
  formatted through the project's formatters module.
template: angular-localize
templateVersion: 1
conditions: [ionic, bootstrap]
values: [sourceLocale, targetLocales, catalogPath, formatModule]
budget: { "ionic == \"true\"": 215, "default": 185 }
---

# Angular (`@angular/localize`) Coding Rules

Apply these rules as you write code. Every user-visible string is marked for translation before the task is complete — in templates with an `i18n` attribute, in TypeScript with `$localize`.

**This project:**
- Source catalog: `<<catalogPath>>` (XLIFF 2.0). It is generated — never edit it by hand. Run `npm run i18n:extract` after adding or changing any message and commit the regenerated file.
- Source locale `<<sourceLocale>>`. Target locales `<<targetLocales>>` arrive from the translation platform as sibling `messages.<locale>.xlf` files. Never hand-write a target file.
- Translations load at runtime, before the app boots. The language changes only by reload: call `setLanguage(code)` from `src/app/i18n/locale.ts`. Never try to swap the language in place.

## Every message: description + explicit ID

Format: `description@@feature.element.purpose`.

- The description tells the translator where the text appears and what it does ("Button that adds the product to the cart"). Never put `|` in it — Angular reads the text before `|` as a *meaning*, and that changes the message.
- The ID is lowercase, dot-separated `feature.element.purpose` (`cart.checkout.button`). Never omit it: an automatic ID hashes the source text, so fixing a typo orphans every translation.
- One ID, one text. Reusing an ID for different text is a duplicate-ID error at extraction. The same ID on identical text in two places is fine.
- Editing the source text of an existing ID keeps the old translation live until it is retranslated. When the meaning changes, use a new ID.

## Templates

Text content and static attributes:

```html
<h1 i18n="Cart page title@@cart.header.title">Your cart</h1>
<input placeholder="Search products" i18n-placeholder="Search field placeholder@@search.input.placeholder" />
<img [src]="url" alt="Product photo" i18n-alt="Product image alt text@@product.image.alt" />
<span i18n="Greeting at the top of the account page@@account.header.greeting">Hi {{ name }}</span>
```

- Mark `placeholder`, `title`, `aria-label`, `alt`, and every other attribute a user reads or hears, with `i18n-<attr>` beside it.
- Bound attributes (`[label]="…"`) cannot take `i18n-*`. Put the text in a `$localize` field on the component and bind that.
- Interpolation inside marked text becomes a placeholder translators can move. Never split one sentence across several marked elements — mark the parent; inline elements become placeholders.
- Use `<ng-container i18n="…@@id">` to mark text without adding an element.

## Plurals and selects — templates only

```html
<span i18n="Number of items in the cart badge@@cart.badge.count">{count, plural, =0 {Cart is empty} one {{{count}} item} other {{{count}} items}}</span>
<span i18n="Order status label@@order.status.label">{status, select, shipped {Shipped} pending {Pending} other {Unknown}}</span>
```

- Always include `other`. Write the source language's categories only; translators add the categories their language needs (Latvian adds `zero`, Russian adds `few` and `many`).
- **Never choose between messages with `Intl.PluralRules`, a ternary, or `count === 1`.** Target languages have categories the source lacks, so code-side branching produces grammar no translator can fix.

## TypeScript — `$localize`

```ts
title = $localize`:Title of the order history screen@@orders.page.title:Order history`
added = $localize`:Toast after adding to cart@@cart.toast.added:Added ${productName}:productName: to the cart`
```

- Name every placeholder: `${expr}:name:`. An unnamed one becomes `PH`, `PH_1`, which tells the translator nothing.
- **No ICU in `$localize`** — Angular does not support it. When a TypeScript string depends on a count, rephrase so the count needs no grammar (`Items in cart: ${count}:count:`), or move the text into a template ICU.
- `$localize` runs once, when its code first executes. Module-level constants are fine: translations are loaded before the app is imported.
- **Never add a static import from `app/` to `src/main.ts`.** `main.ts` loads translations and then imports the app with `import()`. A static import evaluates `$localize` before translations exist, and that text stays in `<<sourceLocale>>` with no error.

<!-- if: ionic == "true" -->
## Ionic components

- Static text props get `i18n-<prop>`: `label`, `text`, `header`, `sub-header`, `message`, `placeholder`, `cancel-text`, `ok-text`, `done-text`, `helper-text`, `error-text`.

  ```html
  <ion-input label="Email" i18n-label="Login form email field label@@login.email.label"></ion-input>
  <ion-back-button text="Back" i18n-text="Back navigation button@@nav.back.label"></ion-back-button>
  ```

- Give every `<ion-back-button>` an explicit `text` with `i18n-text`. Never set `backButtonText` in the global Ionic config — it is one untranslated string.
- Overlay controllers (`AlertController`, `ToastController`, `ActionSheetController`, `LoadingController`, `PickerController`): every user-visible option — `header`, `subHeader`, `message`, each button's `text` — is a `$localize` string.

  ```ts
  await this.alertCtrl.create({
    header: $localize`:Title of the remove-item confirmation@@cart.remove.title:Remove item?`,
    buttons: [
      { text: $localize`:Cancel button in a confirmation dialog@@common.dialog.cancel:Cancel`, role: 'cancel' },
      { text: $localize`:Confirms removing the item from the cart@@cart.remove.confirm:Remove`, role: 'destructive' },
    ],
  })
  ```

- `ion-select` `[interfaceOptions]` and `ion-datetime` button labels follow the same rule.
<!-- /if -->

## Values: numbers, prices, dates, lists

Format every user-visible value through `<<formatModule>>`. Never use `toFixed`, `toLocaleString`, `new Intl.*`, or a hardcoded currency symbol in components.

- Templates use the `fmt` pipe:

  ```html
  <p>{{ price | fmt:'money' }} · {{ total | fmt:'money':'EUR' }} · {{ placedAt | fmt:'date' }} · {{ updatedAt | fmt:'relativeTime' }}</p>
  ```

<!-- if: bootstrap == "standalone" -->
- Add `FmtPipe` from `<<formatModule>>` to the component's `imports`.
<!-- /if -->
<!-- if: bootstrap == "ngmodule" -->
- Add `FmtPipe` from `<<formatModule>>` to the `imports` of the NgModule that declares the component (it is a standalone pipe), or to the component's own `imports` if the component is standalone.
<!-- /if -->
- TypeScript imports `money`, `number`, `percent`, `compact`, `unit`, `date`, `time`, `dateTime`, `relativeTime`, `list` from `<<formatModule>>`.
- `percent()` takes a ratio: `percent(0.42)` renders 42 %.
- Format the value, then interpolate: `` $localize`:Order total line@@checkout.total.label:Total: ${money(total)}:total:` ``. Never split a sentence to isolate a number.
- A shape the ten functions lack becomes a new preset inside `<<formatModule>>`, never an inline options object.
- Do not add new uses of Angular's `date`, `currency`, `number` or `percent` pipes. They follow the active locale but take hardcoded patterns, and `currency` defaults to USD. Use `fmt`.

## What not to mark

CSS classes, `routerLink` paths, `id` / `data-*` / test IDs, `console.*` output, analytics event names, enum values compared in code, URLs, icon names (`name="cart-outline"`), storage keys, and anything code parses back. A brand name inside a sentence stays as written; do not mark a lone brand name.

## After editing

Run `npm run i18n:extract`. It must finish with no duplicate-ID warning, and every unit in `<<catalogPath>>` must have a description note. Commit the regenerated catalog with the code.
````

- [ ] **Step 3: Run the linter**

```bash
./evals/verify-rules-template.sh
```

Expected: `Failed: 0`, and the output includes `angular-localize/rules.template.md: self-contained`, `markers balanced (3 if / 0 else / 3 /if)`, and all four values and both conditions declared-and-used. If the `{{` check fires on any line, that line is outside a fence — move it inside.

- [ ] **Step 4: Budget check by hand.** Render the worst case (`ionic == "true"`, `bootstrap == "ngmodule"`): delete the markers and the `standalone` block, count lines of the body plus the 2-line header.

```bash
F=skills/globalize-guide/references/languages/js-ts/libraries/angular-localize/rules.template.md
awk 'BEGIN{fm=0} /^---$/{fm++; next} fm>=2' "$F" \
  | awk '/<!-- if: bootstrap == "standalone" -->/{skip=1} skip && /<!-- \/if -->/{skip=0; next} !skip' \
  | grep -v '^<!-- ' | wc -l
```

Expected: ≤ 213 (215 minus the header). If over, tighten prose — never drop a rule.

- [ ] **Step 5: Commit**

```bash
git add skills/globalize-guide/references/languages/js-ts/libraries/angular-localize/rules.template.md
git commit -m "feat(globalize-guide): angular-localize coding-rules template"
```

---

## Task 3: The setup reference (`angular-localize.setup.md`) + ninth format-helpers pair

**Files:**
- Create: `JS/frameworks/angular/angular-localize.setup.md`
- Modify: `evals/verify-format-helpers.sh` (add pair row; "8" → "9", "eight" → "nine", "five of the eight" → "five of the nine")

**Interfaces:**
- Consumes: Task 2's `conditions`/`values`; Task 1's detection fields.
- Produces, in the target project: `scripts/xliff-to-json.mjs`, `src/locale-config.ts` (`SOURCE_LOCALE`, `LOCALES`, `AppLocale`, `LOCALE_STORAGE_KEY`, `matchLocale(tag)`, `resolveLocale(stored, preferred)`, `isRtl(locale)`), `src/main.ts` boot, `src/app/i18n/locale.ts` (`currentLanguage()`, `availableLanguages`, `setLanguage(code)`), `src/app/i18n/language-switcher.component.ts`, `src/app/i18n/format.ts` (ten functions, `formatLocale()`, `FmtPipe`), `.globalize/format-module.json`, package scripts `i18n:extract` / `i18n:compile`. Plan step ids this file owns: `ng_add_localize`, `create_config`, `build_tool_integration`, `provider_wiring`, `language_switcher`, `scaffold_catalogs`, `gitignore_artifacts`, `extract_compile`, `generate_format_helpers`, `generate_coding_rules`, `install_coding_rules`, `build_verification`.

- [ ] **Step 1: Write the failing checks**

Add the pair row to `evals/verify-format-helpers.sh` `PAIRS` (after `string-catalog`) and update the counts in its comments/usage:

```
angular-localize|languages/js-ts/libraries/angular-localize/rules.template.md|languages/js-ts/frameworks/angular/angular-localize.setup.md|languages/js-ts/frameworks/angular/angular-localize.setup.md
```

Then:

```bash
./evals/verify-format-helpers.sh | tail -4      # expect Failed: 1 (setup reference not found), pairs checked: 9
F=skills/globalize-guide/references/languages/js-ts/frameworks/angular/angular-localize.setup.md
test -f "$F" \
 && grep -q "ng add '@angular/localize@^" "$F" \
 && grep -q -- '--use-at-runtime' "$F" \
 && grep -q '"format": "xlf2"' "$F" \
 && grep -q 'Xliff2TranslationParser' "$F" \
 && grep -q 'Missing <target> element' "$F" \
 && grep -q 'ionic:serve:before' "$F" && grep -q 'ionic:build:before' "$F" \
 && grep -q 'loadTranslations' "$F" \
 && grep -q 'registerLocaleData' "$F" \
 && grep -q 'pt-BR' "$F" \
 && grep -q 'i18n.locales' "$F" && grep -q '"localize"' "$F" \
 && grep -q 'more than one' "$F" \
 && grep -q 'src/locale-config.ts' "$F" \
 && grep -q 'FmtPipe' "$F" \
 && grep -q 'format-module.json' "$F" \
 && grep -q 'install_coding_rules' "$F" \
 && grep -q 'public/i18n' "$F" && grep -q 'src/assets/i18n' "$F" \
 && echo PASS || echo FAIL
```

Expected: `FAIL`.

- [ ] **Step 2: Author `angular-localize.setup.md` — frame sections.** Copy the section skeleton of `string-catalog.setup.md`. Required content per section:

  **Intro** — one paragraph: `@angular/localize` with XLIFF 2.0 catalogs and **runtime** translation loading — one `ng build`, one `index.html` at the output root (what Capacitor's `webDir` needs), the language chosen at startup and changed by reload. Why not `ng build --localize`: it emits `<out>/<locale>/index.html` per locale with its own `baseHref`.

  **Out of Scope** — SSR (`@angular/ssr`), AnalogJS, non-application builders, Angular < 18 (all stopped in `SKILL.md §1.2`; re-check defensively in Step 1); native app name and permission strings (Capacitor/Cordova `android/`, `ios/`); Transloco / ngx-translate migration; in-place language switching; ICU in TypeScript; converting existing strings (that is `angular-localize.convert.md`).

  **Step Risk Classification** table:

  | Step | Risk | Notes |
  |---|---|---|
  | 1. Detect | Read-only | |
  | 2. `ng add @angular/localize` (`ng_add_localize`) | **Modifies existing files** | `package.json`, lockfile, `angular.json` polyfills, `tsconfig*.json` types |
  | 3. `angular.json` i18n + extract options (`create_config`) | **Modifies existing file** | |
  | 4. Converter script + package scripts (`build_tool_integration`) | Additive + **modifies `package.json`** | |
  | 5. `main.ts` boot (`provider_wiring`) | **Modifies existing file** | Rewrites static `./app/` imports to `import()` |
  | 6. Locale module + switcher (`language_switcher`) | Additive | Mounting the switcher edits a page — guided asks |
  | 7. First extract (`scaffold_catalogs`) | Additive | Writes `src/locale/messages.<source>.xlf` |
  | 8. `.gitignore` (`gitignore_artifacts`) | **Modifies existing file** | |
  | 9. Extract + compile (`extract_compile`) | Additive | |
  | Format helpers (`generate_format_helpers`) | Additive | always runs |
  | 10. Coding rules (`generate_coding_rules`, `install_coding_rules`) | Additive + edits `CLAUDE.md`/`AGENTS.md` | always runs |
  | Optional CI | Additive | §1.10 opt-in |

  **Setup Mode** — copy the iOS guided/unguided block. Unguided defaults table: source locale `decisions.setup.sourceLocale` → existing `i18n.sourceLocale` → `en`; target locales from decisions; switcher component created but **not mounted** (reported in the summary); Ionic hooks added whenever `ionic.config.json` exists or `ionic === true`; CI not added.

- [ ] **Step 3: Author Step 1 (Detect).** Must contain, as explicit checks with the stated outcome:
  - Read `angular.json`. List projects with `projectType: "application"`. **If there is more than one, write `status: "needs_decision"`** with `{ "step": "angular_project", "question": "angular.json has more than one application project. Which one should be localized?", "options": [<names>] }` (guided and unguided alike — there is no safe default). Exactly one → use it. Call it `<project>` below.
  - Builder of `<project>.architect.build` ∈ {`@angular/build:application`, `@angular-devkit/build-angular:application`}; `@angular/ssr` absent; no `@analogjs/*`; `@angular/core` major ≥ 18. Any failure → stop with the §1.2 message.
  - **Existing compile-time i18n:** if `<project>.i18n.locales` is set, or any build option/configuration sets `"localize"` (to `true` or an array), the project builds one output per locale. Do not layer runtime loading on top. Guided: `needs_decision` `{ "step": "angular_compile_time_i18n", "question": "This project already uses build-time localization (ng build --localize), which writes one index.html per locale — Capacitor cannot load that. Switch to runtime loading? This removes the \"localize\" build option; existing translation files are kept and reused.", "options": ["switch_to_runtime", "stop"] }`. Unguided: stop the step with that explanation.
  - Bootstrap style: `src/main.ts` calls `bootstrapApplication(` → `standalone`; `bootstrapModule(` → `ngmodule`. Record it — it is the `bootstrap` condition.
  - Ionic: `ionic.config.json` exists or detection `ionic === true`. Capacitor: `capacitor.config.{ts,json}` → read `webDir` and confirm it equals the build output (`outputPath` string, or `outputPath.base` + `outputPath.browser`); a mismatch is a warning to surface, not a fix to make.
  - **Static-assets dir:** an `assets` entry with `"input": "public"` → `<assetsDir>` = `public`, fetch prefix `i18n/`; else an entry for `src/assets` → `<assetsDir>` = `src/assets`, fetch prefix `assets/i18n/`; neither → `needs_decision`.
  - Package manager from detection — used for the `ng add` invocation only.

- [ ] **Step 4: Author Step 2 (`ng_add_localize`).**

  ````markdown
  ```bash
  npx ng add '@angular/localize@^<angular-major>' --skip-confirmation --use-at-runtime
  ```
  ````

  Prose requirements: `<angular-major>` is detection `version`'s major; `--use-at-runtime` moves the package to `dependencies` (runtime `loadTranslations()` needs it at runtime); `ng add` adds `@angular/localize/init` to the build (and test) `polyfills` and `@angular/localize` to `tsconfig.app.json` `types` — confirm both after it runs and add them if missing. Re-runnable: skip when `@angular/localize` is already in `dependencies` at the same major. **Troubleshooting prose (required by `CLAUDE.md` "Pin installs to a major"):** the major is computed from the project rather than fixed in the skill because `@angular/localize`'s major must equal `@angular/core`'s; it is still a caret range. If `@angular/localize` sits in `devDependencies` at the wrong major, `ng add` at the right major replaces it.

- [ ] **Step 5: Author Step 3 (`create_config`)** with this snippet (keep the existing `builder` value; only set `options`):

  ````markdown
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
  ````

  Prose: `i18n` is a property of `projects.<project>`, sibling of `architect`. **Do not add `i18n.locales` and do not set `"localize"`** — either switches the build to one output per locale. Why `xlf2`: it carries `<note category="description">`; Angular's `json` format drops descriptions.

- [ ] **Step 6: Author Step 4 (`build_tool_integration`).** Include the converter verbatim:

  ````markdown
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
  ````

  Then the package scripts. Prose: add `i18n:extract` and `i18n:compile`; **chain the compile into the existing `start` and `build` commands** (do not use `prestart`/`prebuild`: pnpm and Yarn Berry skip pre-scripts); when the project is Ionic, also add the two Ionic CLI hooks, because `ionic serve` / `ionic build` / `ionic capacitor run` run `ng run <project>:serve|build` directly and never call `npm start` / `npm run build`. Re-runnable: skip a script that already contains `xliff-to-json`.

  ````markdown
  ```json
  "scripts": {
    "start": "node scripts/xliff-to-json.mjs && ng serve",
    "build": "node scripts/xliff-to-json.mjs && ng build",
    "i18n:extract": "ng extract-i18n",
    "i18n:compile": "node scripts/xliff-to-json.mjs",
    "ionic:serve:before": "node scripts/xliff-to-json.mjs",
    "ionic:build:before": "node scripts/xliff-to-json.mjs"
  }
  ```
  ````

  State: `ng serve` / `ng build` typed directly skip the compile — use `npm start` / `npm run build`. `@angular/localize/tools` imports `@angular/compiler-cli`, which every Angular CLI project already has as a devDependency.

- [ ] **Step 7: Author Step 5 (`provider_wiring`).** Include `src/locale-config.ts` and both `main.ts` branches verbatim, plus the locale-data mapping rule.

  ````markdown
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
  ````

  Prose for `LOCALES`: written from decisions — source first, then targets, BCP-47 spelling. The file must stay erasable-syntax only (no `enum`, no namespaces) — Task 11 runs it under `node --experimental-strip-types`.

  **Locale data rule (required text):** for each locale in `LOCALES` other than `en`, import `@angular/common/locales/<file>` where `<file>` is the locale itself when that file exists in `node_modules/@angular/common/locales/`, otherwise its language subtag (`pt-BR` → `pt`, which is Brazilian Portuguese; `zh-CN` → `zh-Hans`; `zh-TW` → `zh-Hant`), and register it under the **app** locale: `registerLocaleData(localePt, 'pt-BR')`. Check with `ls node_modules/@angular/common/locales/<file>.js`. `en` needs no import (its data is built in). A locale with no file at all → `needs_decision`.

  Standalone branch (note the inline-providers shape the Ionic starter uses; when the project has `app.config.ts`, spread `appConfig` instead):

  ````markdown
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
  ````

  Required prose around it: (a) `<fetchPrefix>` is `i18n/` or `assets/i18n/` from Step 1; relative, so it resolves under Capacitor's `https://localhost` / `capacitor://localhost` origin and any `<base href>`; (b) convert **every** static `./app/…` import the original `main.ts` had into the destructured `Promise.all([import(…)])`, keeping the original names (`AppComponent` from `app.component` on Ionic/older projects, `App` from `app` on Angular 20+ `ng new`); imports from packages (`@ionic/angular`, `@angular/router`) stay static; (c) when providers were inline in `bootstrapApplication(…, { providers: [...] })`, keep them inline and append the `LOCALE_ID` provider to that array; (d) a failed fetch (target file not translated yet, offline dev server) falls back to the source locale rather than blocking boot.

  NgModule branch — same top half; the bottom becomes:

  ````markdown
  ```ts
  const [{ platformBrowser }, { AppModule }] = await Promise.all([
    import('@angular/platform-browser'),
    import('./app/app.module'),
  ])
  await platformBrowser().bootstrapModule(AppModule, {
    providers: [{ provide: LOCALE_ID, useValue: locale }],
  })
  ```
  ````

  Keep whichever platform function the project already uses (`platformBrowserDynamic` from `@angular/platform-browser-dynamic` on older projects).

- [ ] **Step 8: Author Step 6 (`language_switcher`).** Include verbatim:

  ````markdown
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
    if (code === currentLanguage()) return
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, code)
    } catch {
      return // storage blocked: a reload would come back in the same language
    }
    location.reload()
  }
  ```
  ````

  Ionic switcher (`ionic === true`):

  ````markdown
  ```ts
  // src/app/i18n/language-switcher.component.ts
  import { Component } from '@angular/core'
  import { IonSelect, IonSelectOption } from '@ionic/angular'
  import { availableLanguages, currentLanguage, setLanguage } from './locale'

  @Component({
    selector: 'app-language-switcher',
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
  ````

  Plain Angular switcher: same class, template uses `<label i18n="Label of the language picker@@settings.language.label" for="language">Language</label><select id="language" (change)="change($any($event.target).value)">` with `<option [value]="language.code" [selected]="language.code === current">`. Ionic 9 imports standalone components from `@ionic/angular` (the `@ionic/angular/standalone` path is Ionic 8 and does not resolve on 9); on Ionic 8 use `@ionic/angular/standalone`. For an NgModule app, add the component to the declaring module's `imports`. Mounting it in a page is a guided question; unguided creates it and lists "mount `<app-language-switcher>`" under Next steps.

- [ ] **Step 9: Author Steps 7–9.**
  - Step 7 `scaffold_catalogs`: run `npm run i18n:extract` once to create `src/locale/messages.<sourceLocale>.xlf`; target files are not created here — they arrive from Globalize, and the converter skips a locale with no file.
  - Step 8 `gitignore_artifacts`: append
    ```
    # Runtime translation bundles — regenerated from src/locale/*.xlf by scripts/xliff-to-json.mjs
    <assetsDir>/i18n/*.json
    ```
    Never ignore `src/locale/*.xlf` — those are the catalog sources Globalize reads. Tracked JSON → surface `git rm --cached` with consent.
  - Step 9 `extract_compile`: `npm run i18n:extract` then `npm run i18n:compile`; both exit 0.

- [ ] **Step 10: Author "Format helpers (`generate_format_helpers`)".** Copy the webext module body (`webext-native.setup.md` "The rest of the module", lines 870–940) verbatim **except**: the file is `src/app/i18n/format.ts`; drop the `browser` import; the seam is

  ````markdown
  ```ts
  import { Pipe, type PipeTransform } from '@angular/core'
  import { SOURCE_LOCALE } from '../../locale-config'

  /**
   * THE SEAM. main.ts sets $localize.locale before the app is imported, and the
   * language only changes by reload, so this never goes stale.
   */
  export function formatLocale(): string {
    return $localize.locale ?? SOURCE_LOCALE
  }
  ```
  ````

  and the file ends with the pipe:

  ````markdown
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
  ````

  Required prose: the pipe is pure — correct because the locale only changes by reload; a pure `relativeTime` does not tick ("3 minutes ago" stays until the input changes), say so. This variant routes **all ten** functions through `formatLocale()` (full seam). Copy the webext `DEFAULT_CURRENCY` grep paragraph, the TypeScript `lib` gate (Angular 18+ defaults to `ES2022`, so it normally passes), and the "do not overwrite an existing `format.ts` — add the surface or write `i18n-format.ts`" rule. Then: **write `.globalize/format-module.json`** with `specifier` = the `tsconfig.json` `compilerOptions.paths` alias for `src/app/i18n/format` if one exists, otherwise the literal `src/app/i18n/format` with the note that call sites import it relatively (Angular CLI projects have no alias by default); `path` = `src/app/i18n/format.ts`; `surface` = `["money","number","percent","compact","unit","date","time","dateTime","relativeTime","list"]`; `defaultCurrency`; `currencySource`.

- [ ] **Step 11: Author "Step 10: Generate Coding Rules (`generate_coding_rules` — always runs)".** Copy `string-catalog.setup.md` sub-steps 1–7 (locate template, resolve conditions, eliminate branches then resolve values, render with the two-line header `template=angular-localize`, self-check, fail closed, `install_coding_rules` with both bridges and the `.claude/globalize-rules.md` migration) with these tables:

  | Condition | Where to read it |
  |---|---|
  | `ionic` | `"true"` when `ionic.config.json` exists or any `@ionic/*` package is in `package.json`; else `"false"`. |
  | `bootstrap` | `"standalone"` when `src/main.ts` calls `bootstrapApplication(`; `"ngmodule"` when it calls `bootstrapModule(`. |

  | Value | Where to read it |
  |---|---|
  | `sourceLocale` | `angular.json` → `projects.<project>.i18n.sourceLocale` (on disk, not `decisions.md`). |
  | `targetLocales` | `LOCALES` in `src/locale-config.ts` minus the source, comma-separated. |
  | `catalogPath` | `<outputPath>/<outFile>` from `angular.json` `extract-i18n.options` — normally `src/locale/messages.<sourceLocale>.xlf`. |
  | `formatModule` | `.globalize/format-module.json` → `.specifier`. Absent → fail closed. |

- [ ] **Step 12: Author the closing sections.**
  - **Optional CI** (§1.10): a job running `npm ci`, `npm run i18n:extract`, `git diff --exit-code src/locale/messages.<sourceLocale>.xlf` — fails when someone added strings without re-extracting.
  - **Verification** (what `build_verification` runs): `npm run i18n:extract` (exit 0, no "duplicate" in output), `npm run i18n:compile`, `npm run build`, and `grep -nE "^\s*import\s.*['\"]\./app/" src/main.ts` returns nothing.
  - **Common Gotchas:** static `./app/` import in `main.ts`; `ng serve`/`ng build` typed directly skip the compile; `|` in a description; `pt-BR` has no locale-data file; adding `i18n.locales` or `localize` turns the build per-locale and breaks Capacitor; `navigator.language` in a WebView reports the device language (`lv-LV`) — resolution falls back to the language subtag; `Missing <target> element` lines are untranslated units, not errors; untranslated units log one `console.warn` each at runtime only if the converter did not run.
  - **Next Steps:** convert phase (`angular-localize.convert.md`); mount the switcher; RTL → `css-i18n` skill; connect Globalize with `fileFormat: xliff-2` and pattern `src/locale/messages.{locale}.xlf`; when `android/`/`ios/` exist, native app name and permission strings stay in the source language.

- [ ] **Step 13: Run the checks**

```bash
# Step 1 grep block → PASS
./evals/verify-format-helpers.sh | tail -5     # expect Failed: 0, pairs checked: 9
./evals/verify-rules-template.sh | tail -4     # still Failed: 0
grep -nE '\.claude/|globalize-guide' skills/globalize-guide/references/languages/js-ts/frameworks/angular/angular-localize.setup.md   # allowed: only the `.claude/globalize-rules.md` migration sentence and `generated by globalize-guide` header — same as the iOS sibling
```

- [ ] **Step 14: Commit**

```bash
git add skills/globalize-guide/references/languages/js-ts/frameworks/angular/angular-localize.setup.md evals/verify-format-helpers.sh
git commit -m "feat(globalize-guide): angular-localize setup reference (runtime loadTranslations, XLIFF 2.0 converter, fmt pipe)"
```

---

## Task 4: Convert reference + recall-scan bullet

**Files:**
- Create: `JS/frameworks/angular/angular-localize.convert.md`
- Modify: `JS/convert.recall-self-check.md` (add an Angular bullet under "Recall scan (per library)")

**Interfaces:**
- Consumes: the rules file Task 2 generates (the convert reference defers to `.agents/globalize-rules.md` exactly like `webext-native.convert.md` does).

- [ ] **Step 1: Failing check**

```bash
F=skills/globalize-guide/references/languages/js-ts/frameworks/angular/angular-localize.convert.md
R=skills/globalize-guide/references/languages/js-ts/convert.recall-self-check.md
test -f "$F" \
 && grep -q 'i18n-label' "$F" && grep -q 'i18n-text' "$F" \
 && grep -q 'AlertController' "$F" && grep -q 'ToastController' "$F" && grep -q 'ActionSheetController' "$F" \
 && grep -q 'Intl.PluralRules' "$F" && grep -q 'zero' "$F" \
 && grep -q 'backButtonText' "$F" \
 && grep -q "fmt:'money'" "$F" && grep -q '| currency' "$F" \
 && grep -q 'convert.format-pass.md' "$F" \
 && grep -q 'Angular' "$R" && grep -q '\.html' "$R" \
 && echo PASS || echo FAIL
```

Expected: `FAIL`.

- [ ] **Step 2: Author the convert reference.** Sections (copy the shape of `webext-native.convert.md`):
  1. **Read `.agents/globalize-rules.md` first** — it is authoritative; this file covers *finding and converting existing* strings.
  2. **Choosing IDs and descriptions** — derive `feature` from the route/component folder (`cart/cart.page.html` → `cart.`), `element` from the UI element, `purpose` from what it does; descriptions say where and what (use the app domain from `decisions.md`); never `|`.
  3. **Template text** → `i18n="<description>@@<id>"` on the innermost element that holds the whole sentence; `<ng-container i18n>` when there is no element; interpolations stay inline.
  4. **Static attributes** → `i18n-<attr>`: `placeholder`, `title`, `aria-label`, `alt`, and Ionic text props `label`, `text`, `header`, `sub-header`, `message`, `cancel-text`, `ok-text`, `done-text`, `helper-text`, `error-text`.
  5. **Bound attributes** (`[label]="expr"` where `expr` yields user text) → a `$localize` field on the component, bound in the template. Show a before/after.
  6. **TypeScript** → `` $localize`:<description>@@<id>:text ${expr}:name:` `` — including `AlertController`, `ToastController`, `ActionSheetController`, `LoadingController` option objects (`header`, `subHeader`, `message`, button `text`). Show a before/after of an alert with two buttons.
  7. **Counts** → template ICU plural (`{count, plural, =0 {…} one {…} other {…}}`); in TypeScript rephrase so the count needs no grammar. **Never** choose between messages with `Intl.PluralRules` or `count === 1` — target languages have categories the source lacks (Latvian `zero` covers 0, 10–20, 30, …).
  8. **`<ion-back-button>`** → explicit `text="Back"` + `i18n-text`; remove any global `backButtonText` from `provideIonicAngular({...})` / `IonicModule.forRoot({...})`.
  9. **`src/index.html` `<title>`** — outside Angular; leave it, and if the title matters set it from the root component with `inject(Title).setTitle($localize\`…\`)`.
  10. **Values** → follow `references/languages/js-ts/convert.format-pass.md` for TypeScript, then these template rewrites: `${{ x }}` / `{{ '$' + x }}` / `{{ x.toFixed(2) }}` in user-visible markup → `{{ x | fmt:'money' }}` (or `fmt:'number'`); `| currency` with no currency-code argument → `| fmt:'money'`; `| date:'MM/dd/yyyy'` (any custom pattern) → `| fmt:'date'` (`fmt:'dateTime'` / `fmt:'time'` when the pattern had a time part). Leave `| number`, `| percent`, and named-format `| date:'short'` alone — they follow `LOCALE_ID`. Add `FmtPipe` to the component's (or module's) `imports`.
  11. **What not to mark** — mirror the rules template list.
  12. **Do not run `ng extract-i18n`** during wrapping — the verify worker runs it once.

- [ ] **Step 3: Add the recall bullet** to `convert.recall-self-check.md`, after the vue-i18n bullet:

  ```markdown
  - **Angular (`@angular/localize`) — tuned grep scan.** No maintained lint rule flags
    unmarked Angular template text, so scan `src/**/*.html` (excluding `src/index.html`) for
    text nodes `>[^<{]*[A-Za-z][^<]*<` on lines whose element carries no `i18n` attribute, and
    for `placeholder=|title=|aria-label=|alt=|label=|text=|header=|message=|cancel-text=|ok-text=`
    with a literal value and no matching `i18n-<attr>` on the same element. Scan `src/**/*.ts`
    for string literals passed as `header:`, `subHeader:`, `message:` or `text:` inside an
    `AlertController` / `ToastController` / `ActionSheetController` / `LoadingController`
    `.create({` call without a `$localize` tag. Recall only — an ancestor's `i18n` makes some
    hits false positives; the cleanup subagent supplies precision. The cleanup subagent's
    catalog step is `npm run i18n:extract`.
  ```

- [ ] **Step 4: Run the Step 1 check.** Expected: `PASS`.

- [ ] **Step 5: Commit**

```bash
git add skills/globalize-guide/references/languages/js-ts/frameworks/angular/angular-localize.convert.md skills/globalize-guide/references/languages/js-ts/convert.recall-self-check.md
git commit -m "feat(globalize-guide): angular-localize convert reference and recall scan"
```

---

## Task 5: Manifest entry + Phase 1 orchestration (§1.3, §1.5, §1.7, §1.10)

**Files:**
- Modify: `G/manifest.json`
- Modify: `G/SKILL.md` (§1.3, §1.5, §1.7, §1.10)

**Interfaces:**
- Consumes: Tasks 2–4 file paths (must exist — `verify-manifest.sh` resolves them).
- Produces: variant id `angular-localize`; `decisions.md` `## Routing strategy` body starting with `None` for Angular and Capacitor projects (Task 10's goldens assert it).

- [ ] **Step 1: Failing check**

```bash
cd skills/globalize-guide
jq -e '.stacks[] | select(.variant=="angular-localize")' manifest.json >/dev/null \
 && grep -q '`framework === "angular"` | \*\*@angular/localize\*\*' SKILL.md \
 && grep -q 'hybrid === "capacitor"' SKILL.md \
 && grep -q 'Hand-trace (Angular)' SKILL.md \
 && echo PASS || echo FAIL
```

Expected: `FAIL`.

- [ ] **Step 2: Add the manifest entry** after `quasar-vue-i18n` (keeps framework families together):

```json
    {
      "variant": "angular-localize",
      "match": {
        "framework": "angular",
        "library": "angular-localize"
      },
      "supportLevel": "experimental",
      "appliesAlsoTo": [
        "Ionic Angular (standalone or NgModule)",
        "Angular + Capacitor or Cordova",
        "Plain Angular CLI application (client-only)"
      ],
      "packages": {
        "runtime": [],
        "dev": []
      },
      "references": {
        "setup": [
          "references/languages/js-ts/frameworks/angular/angular-localize.setup.md"
        ],
        "convert": [
          "references/languages/js-ts/frameworks/angular/angular-localize.convert.md",
          "references/languages/js-ts/convert.format-pass.md"
        ],
        "rulesTemplate": [
          "references/languages/js-ts/libraries/angular-localize/rules.template.md"
        ]
      }
    },
```

- [ ] **Step 3: Edit §1.3.** Add after the browser-extension hand-trace:
  > **Hand-trace (Angular).** A `{js-ts, angular}` detection selects **only** `angular-localize`: every other JS entry fails on `framework` (next/vite/… ≠ angular), and `rails-yaml` / `android-strings` / the iOS entries fail on `language`. An Ionic React or Ionic Vue app is **not** Angular — it detects `framework: "vite"` and matches the Vite entries exactly like any other Vite app; `hybrid` and `ionic` never filter the candidate set.

  Append to "Net effect": "A fresh Angular project yields exactly **{angular-localize}** → §1.5 confirms it."

- [ ] **Step 4: Edit §1.5.** Add a row before "anything else":

  `| `framework === "angular"` | **@angular/localize** | Angular's built-in i18n and the only maintained Angular option whose translator descriptions reach the catalog (Transloco and ngx-translate have no comment channel). XLIFF 2.0 catalogs, ICU plurals in templates, translations loaded at runtime so one build serves every language (what Capacitor needs). |`

  Append to the confirmation paragraph: "For `framework === "angular"` exactly one variant matches — confirm it, and say it is **experimental**: 'Setting up @angular/localize with runtime translation loading. Heads up: Angular support is **experimental** — the Globalize XLIFF 2.0 round-trip and an on-device run haven't been verified yet.'"

- [ ] **Step 5: Edit §1.7.** At the start of the "Routing strategy" bullet insert:
  > **Skipped when `framework === "angular"`** (one build, translations loaded at startup, language changed by reload — there is no URL locale to route) **and when `hybrid === "capacitor"`** on any framework (a Capacitor app has no URL bar; the locale is a stored preference defaulting to the device language). Record `decisions.setup.routing = "none"` and write the `decisions.md` section as `None — <Angular runtime loading | Capacitor app>: locale is a stored preference`. If the user pre-answered a routing strategy, record `None` anyway and tell them why in one sentence.

- [ ] **Step 6: Edit §1.10.** Add: "For `framework === "angular"`, offer instead: **CI extraction check** (`npm run i18n:extract` + `git diff --exit-code` on the source XLIFF)."

- [ ] **Step 7: Run checks**

```bash
# Step 1 block → PASS
./evals/verify-manifest.sh | tail -4    # expect "all 24 stack variants are unique", "24/24 stacks declare a rulesTemplate", Failed: 0
```

- [ ] **Step 8: Commit**

```bash
git add skills/globalize-guide/manifest.json skills/globalize-guide/SKILL.md
git commit -m "feat(globalize-guide): angular-localize manifest entry and Phase 1 routing"
```

---

## Task 6: Phases 2–4 orchestration arms (SKILL.md)

**Files:**
- Modify: `G/SKILL.md` (Phase 2 start message, §2.0, §2.2, §2.4, collapse-case, Phase 3 start message, §3.5, §3.5.1, §3.6, §4.1, plan.md skeleton)

**Interfaces:**
- Consumes: step ids from Task 3; verify step ids defined here: `i18n_extract`, `description_check`, `i18n_compile`, `build_check`, `recall_self_check`, `main_ts_import_check`, `format_violations_check`.

- [ ] **Step 1: Failing check**

```bash
cd skills/globalize-guide
grep -q 'ng_add_localize' SKILL.md \
 && grep -q 'description_check' SKILL.md \
 && grep -q 'main_ts_import_check' SKILL.md \
 && grep -q '`xliff-2` at `src/locale/messages.{locale}.xlf`' SKILL.md \
 && grep -q 'For Angular' SKILL.md \
 && echo PASS || echo FAIL
```

Expected: `FAIL`.

- [ ] **Step 2: Phase 2 edits.**
  - Start message: add `for Angular: \`Nothing to install on my main thread — the worker runs \`ng add @angular/localize\` matched to your Angular major, configures extraction, adds the XLIFF → JSON compile step, rewires \`main.ts\` to load translations before the app starts, and verifies with an extract, compile and build.\``.
  - §2.0: append "For `framework === "angular"` both lists are empty by design — `@angular/localize`'s major must equal `@angular/core`'s, so the setup subagent installs it with `ng add` (step `ng_add_localize`); §2.0 is a no-op, not an error."
  - §2.2 "Packages already installed": append "Exception: on Angular, `ng_add_localize` *is* the install and runs in the subagent."
  - §2.2 `gitignore_artifacts`: add Angular to the libraries that emit generated files — "Angular: `<assetsDir>/i18n/*.json` written by `scripts/xliff-to-json.mjs`; the `src/locale/*.xlf` files are sources and are never ignored."
  - §2.2 Verification: add "**Angular:** the typecheck is part of `ng build`; run `npm run build` (it runs the compile first) and record it under `build`; set `typecheck` to `null`."
  - §2.4 succeeded message: `for Angular: \`extraction, compile and build are clean\``.
  - Collapse-case: in the catalog-step sentence add "an **extract-from-source, compile-to-JSON** library (Angular) re-runs `extract_compile` (`npm run i18n:extract` then `npm run i18n:compile`)".

- [ ] **Step 3: plan.md skeleton.** After `- [ ] checkout_branch` add:
  ```
  - [ ] ng_add_localize   <!-- Angular only: `npx ng add '@angular/localize@^<major>' --skip-confirmation --use-at-runtime` inside the subagent; replaces the main-thread install -->
  ```
  Extend the `gitignore_artifacts` and `extract_compile` comments with Angular. Add a verify arm comment:
  ```
  <!-- Angular (@angular/localize) instead:
  - [ ] i18n_extract
  - [ ] description_check
  - [ ] i18n_compile
  - [ ] build_check
  - [ ] recall_self_check
  - [ ] main_ts_import_check
  -->
  ```

- [ ] **Step 4: Phase 3 edits.**
  - Start message: `for Angular: \`runs extraction, checks every message has a description, compiles the runtime JSON, builds, and runs a recall scan over templates and overlay-controller calls\``.
  - §3.5 plan-steps list: add "**Extract-from-source, compile-to-JSON (Angular)**: i18n_extract, description_check, i18n_compile, build_check, recall_self_check, main_ts_import_check."
  - §3.5 add an arm:
    > For Angular:
    > 1. `npm run i18n:extract`. Exit 0 required; any output line containing "duplicate" (case-insensitive) is a failure — two messages share an ID with different text. Atomically update `progress/verify.json`.
    > 2. **Description check** — every `<unit>` in the source XLIFF has a non-empty `<note category="description">`. For each one missing, edit the source (`i18n="…"` / `$localize`) to add a description following the rules file, then re-extract.
    > 3. `npm run i18n:compile` — writes one JSON per existing target file (none yet is normal before Phase 4).
    > 4. `npm run build`.
    > 5. **Recall self-check** — the Angular grep scan in `convert.recall-self-check.md`; non-empty → `needs_cleanup`.
    > 6. **`main.ts` import check** — `grep -nE "^\s*import\s.*['\"]\./app/" src/main.ts` must print nothing; a hit means some text will silently stay in the source language. Fix it by converting the import to `import()` inside `main()`.
    >
    > Authoritative commands: `references/languages/js-ts/frameworks/angular/angular-localize.setup.md` (Verification).
  - §3.5 `result` paragraph: add "For Angular, `extractOk` is step 1, `compileOk` step 3, `buildOk` step 4, `commentsAdded` the descriptions added in step 2; `catalogPath` is the source XLIFF (`src/locale/messages.<sourceLocale>.xlf`) and `totalMessages` its `<unit>` count."
  - §3.5.1 step 3: add "Angular: `npm run i18n:extract` + `npm run i18n:compile`".
  - §3.6: add "the source XLIFF's `<source>` text (Angular)" to the word-count sources.

- [ ] **Step 5: §4.1.** Add a bullet:
  > **Angular** (`detection.framework === "angular"`) → `xliff-2` at `src/locale/messages.{locale}.xlf` (read `extract-i18n.options.outputPath` / `outFile` from `angular.json` if they differ). The source file `messages.<sourceLocale>.xlf` matches the same pattern. No `pathLocales`.

- [ ] **Step 6: Run the Step 1 check.** Expected: `PASS`. Also `grep -c 'Angular' skills/globalize-guide/SKILL.md` should be ≥ 15.

- [ ] **Step 7: Commit**

```bash
git add skills/globalize-guide/SKILL.md
git commit -m "feat(globalize-guide): Angular arms for setup, verify, cost estimate and Globalize connect"
```

---

## Task 7: Layer B checker `evals/library-checks/angular-localize.sh`

**Files:**
- Create: `evals/library-checks/angular-localize.sh` (executable)

**Interfaces:**
- Usage `angular-localize.sh <project-dir> <fixture-name> [variant]`, dispatched by `evals/verify-setup.sh` when a fixture's `library` is `angular-localize`. Exit 0/1.

- [ ] **Step 1: Write the test harness first** (scratch, not committed):

```bash
T=$(mktemp -d)
mkdir -p "$T/src/locale" "$T/scripts"
cat > "$T/package.json" <<'EOF'
{ "name": "t", "scripts": {
  "i18n:extract": "echo extracted",
  "i18n:compile": "mkdir -p public/i18n && echo '{}' > public/i18n/lv.json",
  "build": "true" } }
EOF
cat > "$T/angular.json" <<'EOF'
{ "projects": { "app": { "projectType": "application", "i18n": { "sourceLocale": "en" },
  "architect": { "extract-i18n": { "options": { "format": "xlf2", "outputPath": "src/locale", "outFile": "messages.en.xlf" } } } } } }
EOF
cat > "$T/src/locale/messages.en.xlf" <<'EOF'
<?xml version="1.0" encoding="UTF-8" ?>
<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en">
  <file id="ngi18n" original="ng.template">
    <unit id="cart.header.title"><notes><note category="description">Cart page title</note></notes><segment><source>Your cart</source></segment></unit>
  </file>
</xliff>
EOF
cp "$T/src/locale/messages.en.xlf" "$T/src/locale/messages.lv.xlf"
printf "const OUT_DIR = 'public/i18n'\n" > "$T/scripts/xliff-to-json.mjs"
cat > "$T/src/main.ts" <<'EOF'
import { loadTranslations } from '@angular/localize'
async function main() { loadTranslations({}); const { AppComponent } = await import('./app/app.component') }
EOF
./evals/library-checks/angular-localize.sh "$T" t; echo "exit=$?"
```

Expected now: `No such file` / non-zero.

- [ ] **Step 2: Create the script**

```bash
#!/bin/bash
set -uo pipefail

# Usage: angular-localize.sh <project-dir> <fixture-name> [variant]
# Per-library verifier (dispatched by verify-setup.sh) for @angular/localize setups.
# Runs SKILL.md §3.5's Angular checks: extraction (no duplicate IDs), a description
# on every unit, one runtime JSON per target XLIFF, a passing build, and no static
# ./app/ import in src/main.ts. The format module is checked separately by
# verify-format-helpers.sh --project.

WORKDIR="${1:?Usage: angular-localize.sh <project-dir> <fixture-name> [variant]}"
FIXTURE="${2:?Usage: angular-localize.sh <project-dir> <fixture-name> [variant]}"
cd "$WORKDIR" || exit 2

PASS=0; FAIL=0; WARN=0
pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }
warn() { echo "  WARN: $1"; WARN=$((WARN + 1)); }

echo "--- angular-localize: $FIXTURE ---"

[ -f angular.json ] || { fail "angular.json missing"; echo "  Passed: $PASS  Failed: $FAIL"; exit 1; }

APP=$(jq -r '[.projects | to_entries[] | select(.value.projectType == "application") | .key][0] // empty' angular.json)
SRC=$(jq -r --arg p "$APP" '.projects[$p].i18n.sourceLocale // empty' angular.json)
OUTPATH=$(jq -r --arg p "$APP" '.projects[$p].architect["extract-i18n"].options.outputPath // "src/locale"' angular.json)
OUTFILE=$(jq -r --arg p "$APP" --arg s "$SRC" '.projects[$p].architect["extract-i18n"].options.outFile // ("messages." + $s + ".xlf")' angular.json)
FORMAT=$(jq -r --arg p "$APP" '.projects[$p].architect["extract-i18n"].options.format // empty' angular.json)
CATALOG="$OUTPATH/$OUTFILE"

[ -n "$SRC" ] && pass "i18n.sourceLocale = $SRC" || fail "angular.json has no i18n.sourceLocale for '$APP'"
case "$FORMAT" in xlf2|xliff2) pass "extract-i18n format = $FORMAT" ;; *) fail "extract-i18n format is '$FORMAT', expected xlf2" ;; esac

# 1. Extraction: exit 0, no duplicate-ID warning.
OUT=$(npm run --silent i18n:extract 2>&1); RC=$?
if [ $RC -ne 0 ]; then fail "npm run i18n:extract exited $RC"
elif printf '%s' "$OUT" | grep -qi 'duplicate'; then fail "i18n:extract reported duplicate message IDs"
else pass "i18n:extract clean"; fi

# 2. Every unit in the source XLIFF has a description note.
if [ ! -f "$CATALOG" ]; then
  fail "source catalog missing at $CATALOG"
else
  MISSING=$(python3 - "$CATALOG" <<'PY'
import sys, xml.etree.ElementTree as ET
ns = {"x": "urn:oasis:names:tc:xliff:document:2.0"}
root = ET.parse(sys.argv[1]).getroot()
units = root.findall(".//x:unit", ns)
bad = [u.get("id") for u in units
       if not any((n.get("category") == "description" and (n.text or "").strip())
                  for n in u.findall("x:notes/x:note", ns))]
print(f"{len(units)} {' '.join(bad)}")
PY
)
  TOTAL=${MISSING%% *}; BAD=${MISSING#* }; [ "$BAD" = "$TOTAL" ] && BAD=""
  if [ "$TOTAL" = "0" ]; then warn "source catalog has no units"
  elif [ -z "$BAD" ]; then pass "all $TOTAL units carry a description"
  else fail "units without a description: $BAD"; fi
fi

# 3. Compile writes one JSON per target XLIFF.
OUTDIR=$(grep -oE "const OUT_DIR = '[^']+'" scripts/xliff-to-json.mjs 2>/dev/null | sed -E "s/.*'([^']+)'/\1/")
[ -n "$OUTDIR" ] && pass "converter OUT_DIR = $OUTDIR" || fail "scripts/xliff-to-json.mjs missing or has no OUT_DIR"
if npm run --silent i18n:compile >/dev/null 2>&1; then pass "i18n:compile exited 0"; else fail "i18n:compile failed"; fi
for f in "$OUTPATH"/messages.*.xlf; do
  [ -e "$f" ] || continue
  loc=$(basename "$f" .xlf); loc=${loc#messages.}
  [ "$loc" = "$SRC" ] && continue
  if [ -n "$OUTDIR" ] && jq -e . "$OUTDIR/$loc.json" >/dev/null 2>&1; then pass "$OUTDIR/$loc.json is valid JSON"
  else fail "no valid $OUTDIR/$loc.json for $f"; fi
done

# 4. Build.
if npm run --silent build >/dev/null 2>&1; then pass "npm run build exited 0"; else fail "npm run build failed"; fi

# 6. main.ts: translations loaded, app imported dynamically, never statically.
if grep -nE "^[[:space:]]*import[[:space:]].*['\"]\./app/" src/main.ts >/dev/null 2>&1; then
  fail "src/main.ts statically imports from ./app/ — that code evaluates \$localize before translations load"
else pass "src/main.ts has no static ./app/ import"; fi
grep -q 'loadTranslations(' src/main.ts && pass "src/main.ts calls loadTranslations()" || fail "src/main.ts never calls loadTranslations()"
grep -qE "import\(['\"]\./app/" src/main.ts && pass "src/main.ts imports the app dynamically" || fail "src/main.ts has no dynamic import('./app/…')"

echo ""
echo "--- Verification Report ---"
echo "  Passed:   $PASS"
echo "  Failed:   $FAIL"
echo "  Warnings: $WARN"
[ $FAIL -gt 0 ] && exit 1 || exit 0
```

`chmod +x evals/library-checks/angular-localize.sh`.

- [ ] **Step 3: Run the harness — positive case.** Re-run Step 1's last line. Expected: `Failed: 0`, `exit=0`.

- [ ] **Step 4: Negative cases** (each must flip to `exit=1` with the named FAIL, then restore):

```bash
sed -i.bak 's#<notes><note category="description">Cart page title</note></notes>##' "$T/src/locale/messages.en.xlf"   # → "units without a description: cart.header.title"
mv "$T/src/locale/messages.en.xlf.bak" "$T/src/locale/messages.en.xlf"
printf "import { routes } from './app/app.routes'\n" | cat - "$T/src/main.ts" > "$T/m" && mv "$T/m" "$T/src/main.ts"   # → "statically imports from ./app/"
jq '.scripts["i18n:extract"] = "echo WARNING: Duplicate messages with id cart.header.title"' "$T/package.json" > "$T/p" && mv "$T/p" "$T/package.json"   # → "duplicate message IDs"
```

Run the checker after each edit and confirm the specific FAIL line. Then `rm -rf "$T"`.

- [ ] **Step 5: Commit**

```bash
git add evals/library-checks/angular-localize.sh
git commit -m "test(evals): angular-localize Layer B checker"
```

---

## Task 8: Ionic React / Ionic Vue on the Vite stacks

**Files:**
- Modify: `JS/frameworks/vite/react-swc/lingui.setup.md` and `JS/frameworks/vite/react-babel/lingui.setup.md` ("Locale Routing Strategy")
- Modify: `JS/frameworks/vite/vue/vue-i18n.setup.md` ("Locale Routing Strategy")
- Modify: `JS/libraries/lingui/convert.standard-react.md` (new "Ionic components" section before "Numbers, currencies, and dates")
- Modify: `JS/frameworks/vite/vue/vue-i18n.convert.md` (new "Ionic components" section)

- [ ] **Step 1: Failing check**

```bash
cd skills/globalize-guide/references/languages/js-ts
for f in frameworks/vite/react-swc/lingui.setup.md frameworks/vite/react-babel/lingui.setup.md frameworks/vite/vue/vue-i18n.setup.md; do
  grep -q 'hybrid === "capacitor"' "$f" || echo "MISSING $f"
done
grep -q 'useIonAlert\|useIonToast' libraries/lingui/convert.standard-react.md || echo "MISSING react ionic"
grep -q 'toastController' frameworks/vite/vue/vue-i18n.convert.md || echo "MISSING vue ionic"
```

Expected: five `MISSING` lines.

- [ ] **Step 2: Lingui setups (both files, identical text).** Directly under `### Locale Routing Strategy`, before "Unless the project has no router at all, STOP…", insert:

  > **Capacitor apps skip this question.** When `.globalize/detection.json` has `hybrid === "capacitor"` (or `.globalize/decisions.md` records `Routing strategy: None`), do not present the choice — a Capacitor app runs in a WebView with no URL bar, so a locale in the path is invisible and unshareable. Use **Option 3** (the single-catalog setup in *Single catalog (plain SPA without a router)*): the locale is a stored preference (`localStorage`) defaulting to the device language (`navigator.language`). The route tree — including Ionic's `IonReactRouter` — is left untouched.

- [ ] **Step 3: vue-i18n Vite setup.** Under `### Locale Routing Strategy`, before "**If the project uses `vue-router`, STOP…**", insert the same paragraph with "Use **Strategy 3 / plain SPA: No URL routing**" and "including Ionic's `@ionic/vue-router`".

- [ ] **Step 4: React convert note** (`convert.standard-react.md`, new section):

  ````markdown
  ## Ionic components (Ionic React)

  Ionic text props take plain strings, so use `t` from `useLingui()`, not `<Trans>`:

  ```tsx
  const { t } = useLingui()
  <IonInput label={t`Email`} placeholder={t`you@example.com`} />
  <IonBackButton text={t`Back`} defaultHref="/" />
  ```

  Overlay hooks and controllers take option objects — wrap every user-visible field:

  ```tsx
  const [presentAlert] = useIonAlert()
  const [presentToast] = useIonToast()
  presentAlert({
    header: t`Remove item?`,
    buttons: [{ text: t`Cancel`, role: 'cancel' }, { text: t`Remove`, role: 'destructive' }],
  })
  presentToast({ message: t`Item removed`, duration: 1500 })
  ```

  Never set `backButtonText` in `setupIonicReact({...})` — it is one untranslated string.
  ````

- [ ] **Step 5: Vue convert note** (`vue-i18n.convert.md`, new section):

  ````markdown
  ## Ionic components (Ionic Vue)

  Bind Ionic text props to `t()`:

  ```vue
  <ion-input :label="t('Login.emailLabel')" :placeholder="t('Login.emailPlaceholder')" />
  <ion-back-button :text="t('Common.back')" default-href="/" />
  ```

  Controllers take option objects — wrap every user-visible field (`header`, `subHeader`, `message`, button `text`):

  ```ts
  import { alertController, toastController } from '@ionic/vue'
  const { t } = useI18n()
  const alert = await alertController.create({
    header: t('Cart.removeTitle'),
    buttons: [{ text: t('Common.cancel'), role: 'cancel' }, { text: t('Cart.remove'), role: 'destructive' }],
  })
  const toast = await toastController.create({ message: t('Cart.removed'), duration: 1500 })
  ```

  Never set `backButtonText` in `app.use(IonicVue, {...})` — it is one untranslated string.
  ````

- [ ] **Step 6: Run the Step 1 check.** Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add skills/globalize-guide/references/languages/js-ts/frameworks/vite skills/globalize-guide/references/languages/js-ts/libraries/lingui/convert.standard-react.md
git commit -m "feat(globalize-guide): Ionic React/Vue + Capacitor on the Vite stacks (no URL locale routing)"
```

---

## Task 9: `globalize-now-project-setup` — Angular detection + `.xlf`

**Files:**
- Modify: `skills/globalize-now-project-setup/SKILL.md` (Step 1 detection table, pattern table, file-format table)

- [ ] **Step 1: Failing check**

```bash
F=skills/globalize-now-project-setup/SKILL.md
grep -q '\*\*Angular\*\*' "$F" && grep -q 'messages.{locale}.xlf' "$F" && grep -q '\.xlf' "$F" && echo PASS || echo FAIL
```

Expected: `FAIL`.

- [ ] **Step 2: Edits.**
  - Detection table, before "Locale directories": `| **Angular** (`@angular/localize`) | `angular.json` has `projects.<p>.i18n.sourceLocale` and `@angular/localize` is in `package.json` | `i18n.sourceLocale` → source language; target languages from `src/locale/messages.<code>.xlf` file names (or `extract-i18n.options.outputPath`) minus the source |`.
  - "Locale files" row: `*.po`, `*.pot`, `*.xliff`, `*.xlf`, `*.json`.
  - Pattern table: `| **Angular** | `<outputPath>/messages.{locale}.xlf` from `angular.json` `extract-i18n.options` — default `src/locale/messages.{locale}.xlf`. The source file (`messages.en.xlf`) matches the same pattern. |`.
  - File-format table: `| **Angular** | `xliff-2` when `extract-i18n.options.format` is `xlf2`/`xliff2`; `xliff-1` when it is `xlf`/`xliff`/absent |` and change the `.xliff` row to "`.xliff` / `.xlf` files".

- [ ] **Step 3: Run the Step 1 check.** Expected: `PASS`.

- [ ] **Step 4: Commit**

```bash
git add skills/globalize-now-project-setup/SKILL.md
git commit -m "feat(globalize-now-project-setup): detect Angular XLIFF catalogs"
```

---

## Task 10: Layer A fixtures + goldens + `decisionsSections`

**Files:**
- Modify: `evals/verify-orchestration.sh`
- Create: `fixtures/ionic-angular-capacitor/**`, `fixtures/ionic-react-capacitor/**`, `fixtures/ionic-vue-capacitor/**`
- Create: `evals/expectations/detection/{ionic-angular-capacitor,ionic-react-capacitor,ionic-vue-capacitor}.json`, `evals/expectations/plan/{ionic-angular-capacitor,ionic-react-capacitor,ionic-vue-capacitor}.json`
- Modify: `evals/fixtures.json`

**Interfaces:**
- Produces expectation key `decisionsSections: { "<heading>": "<ERE>" }` — the first non-empty line under `## <heading>` in `.globalize/decisions.md` must match.

- [ ] **Step 1: Register fixtures and goldens first** (so the verifier test below has a fixture name). `evals/fixtures.json` additions:

```json
  "ionic-angular-capacitor": {
    "category": "positive", "type": "local", "path": "fixtures/ionic-angular-capacitor",
    "library": "angular-localize", "variant": "angular-localize",
    "expectedDetection": "evals/expectations/detection/ionic-angular-capacitor.json",
    "expectedPlan": "evals/expectations/plan/ionic-angular-capacitor.json"
  },
  "ionic-react-capacitor": {
    "category": "positive", "type": "local", "path": "fixtures/ionic-react-capacitor",
    "library": "lingui", "variant": "vite-babel-lingui",
    "expectedDetection": "evals/expectations/detection/ionic-react-capacitor.json",
    "expectedPlan": "evals/expectations/plan/ionic-react-capacitor.json"
  },
  "ionic-vue-capacitor": {
    "category": "positive", "type": "local", "path": "fixtures/ionic-vue-capacitor",
    "library": "vue-i18n", "variant": "vite-vue-i18n",
    "expectedDetection": "evals/expectations/detection/ionic-vue-capacitor.json",
    "expectedPlan": "evals/expectations/plan/ionic-vue-capacitor.json"
  }
```

Detection goldens (never put `null` in `match` — the verifier prints `<missing>` for an actual null and `null` for the expected one, so they can never compare equal; list null-valued fields under `ignore`):

`ionic-angular-capacitor.json`:
```json
{
  "match": {
    "language": "js-ts", "framework": "angular", "angular": true, "ionic": true, "hybrid": "capacitor",
    "react": false, "vue": false, "svelte": false, "typescript": true, "packageManager": "npm",
    "existing": { "library": "none", "configured": false, "providerWired": false, "catalogsScaffolded": false, "stringsWrapped": "no" }
  },
  "ignore": ["candidateFiles", "formatCandidateFiles", "routeEntries", "git", "localeSignals", "version", "sourceDir", "compiler", "router", "platform", "buildSystem", "uiFramework", "extensionFramework", "manifestVersion"],
  "softAssert": { "candidateFilesMinCount": 2, "candidateFilesMustContain": ["src/app/cart/cart.page.html", "src/app/cart/cart.page.ts"] }
}
```

`ionic-react-capacitor.json`:
```json
{
  "match": {
    "language": "js-ts", "framework": "vite", "compiler": "babel", "router": "react-router",
    "angular": false, "ionic": true, "hybrid": "capacitor",
    "react": true, "vue": false, "svelte": false, "typescript": true, "packageManager": "npm"
  },
  "ignore": ["candidateFiles", "formatCandidateFiles", "routeEntries", "git", "localeSignals", "version", "sourceDir", "platform", "buildSystem", "uiFramework", "extensionFramework", "manifestVersion", "existing"],
  "softAssert": { "candidateFilesMinCount": 1, "candidateFilesMustContain": ["src/pages/Cart.tsx"] }
}
```

`ionic-vue-capacitor.json`:
```json
{
  "match": {
    "language": "js-ts", "framework": "vite", "router": "vue-router",
    "angular": false, "ionic": true, "hybrid": "capacitor",
    "react": false, "vue": true, "svelte": false, "typescript": true, "packageManager": "npm"
  },
  "ignore": ["candidateFiles", "formatCandidateFiles", "routeEntries", "git", "localeSignals", "version", "sourceDir", "compiler", "platform", "buildSystem", "uiFramework", "extensionFramework", "manifestVersion", "existing"],
  "softAssert": { "candidateFilesMinCount": 1, "candidateFilesMustContain": ["src/views/CartPage.vue"] }
}
```

Plan goldens:

`plan/ionic-angular-capacitor.json`:
```json
{
  "variant": "angular-localize",
  "library": "angular-localize",
  "phasesIncluded": ["setup"],
  "phase2StepsContain": ["ng_add_localize", "create_config", "build_tool_integration", "provider_wiring", "scaffold_catalogs", "gitignore_artifacts", "extract_compile", "generate_format_helpers", "generate_coding_rules", "install_coding_rules"],
  "decisionsSections": { "Routing strategy": "^None" }
}
```

`plan/ionic-react-capacitor.json`:
```json
{
  "variant": "vite-babel-lingui",
  "library": "lingui",
  "phasesIncluded": ["setup"],
  "phase2StepsContain": ["create_config", "build_tool_integration", "provider_wiring", "scaffold_catalogs", "gitignore_artifacts", "extract_compile", "generate_format_helpers", "generate_coding_rules", "install_coding_rules"],
  "decisionsSections": { "Routing strategy": "^None" }
}
```

`plan/ionic-vue-capacitor.json`:
```json
{
  "variant": "vite-vue-i18n",
  "library": "vue-i18n",
  "phasesIncluded": ["setup"],
  "phase2StepsContain": ["generate_format_helpers", "generate_coding_rules", "install_coding_rules"],
  "phase2StepsAbsent": ["extract_compile"],
  "decisionsSections": { "Routing strategy": "^None" }
}
```

- [ ] **Step 2: Write the failing verifier test** (scratch):

```bash
W=$(mktemp -d); mkdir -p "$W/.globalize"
echo '{}' > "$W/.globalize/detection.json"
printf -- '- [ ] generate_format_helpers\n- [ ] generate_coding_rules\n- [ ] install_coding_rules\nvite-vue-i18n vue-i18n setup\n' > "$W/.globalize/plan.md"
printf '# Decisions\n\n## Routing strategy\nPrefix-based\n\n## App domain\nShop\n' > "$W/.globalize/decisions.md"
./evals/verify-orchestration.sh "$W" ionic-vue-capacitor | grep -i 'routing strategy'
```

Expected now: no output (the key is unknown, so nothing checks it).

- [ ] **Step 3: Implement `decisionsSections`** in `verify-orchestration.sh`, inside the plan block, after the `ABSENT_STEPS` loop and before `phasesIncluded`:

```bash
    # decisionsSections: heading -> ERE that the section's first non-empty line
    # must match. Routing has no plan step id, so "no URL-prefix routing" is
    # asserted against decisions.md instead.
    DECISIONS_MD="$WORKDIR/.globalize/decisions.md"
    SECTIONS=$(jq -r '.decisionsSections // {} | to_entries[] | "\(.key)\t\(.value)"' "$EXPECTED_PLAN_FILE")
    while IFS=$'\t' read -r HEADING PATTERN; do
      [ -z "$HEADING" ] && continue
      if [ ! -f "$DECISIONS_MD" ]; then
        fail "decisions.md missing — cannot check section '$HEADING'"
        continue
      fi
      BODY=$(awk -v h="## $HEADING" '$0 == h {f = 1; next} f && /^## / {exit} f && NF {print; exit}' "$DECISIONS_MD")
      if [ -z "$BODY" ]; then
        fail "decisions.md has no '## $HEADING' section (or it is empty)"
      elif printf '%s\n' "$BODY" | grep -qE "$PATTERN"; then
        pass "decisions.md '$HEADING' = '$BODY' matches /$PATTERN/"
      else
        fail "decisions.md '$HEADING' = '$BODY' does not match /$PATTERN/"
      fi
    done <<< "$SECTIONS"
```

- [ ] **Step 4: Run the verifier test.** Re-run Step 2's last line → `FAIL: decisions.md 'Routing strategy' = 'Prefix-based' does not match /^None/`. Then `sed -i.bak 's/^Prefix-based$/None — Capacitor app: locale is a stored preference/' "$W/.globalize/decisions.md"` and re-run → `PASS: … matches /^None/`. Delete the heading line and re-run → `FAIL: decisions.md has no '## Routing strategy' section`. `rm -rf "$W"`.

- [ ] **Step 5: Create `fixtures/ionic-angular-capacitor/`.**

`package.json`:
```json
{
  "name": "shop-ionic",
  "version": "0.1.0",
  "private": true,
  "description": "Mobile storefront: browse products, manage a cart, check out",
  "scripts": { "ng": "ng", "start": "ng serve", "build": "ng build" },
  "dependencies": {
    "@angular/common": "^22.2.0",
    "@angular/compiler": "^22.2.0",
    "@angular/core": "^22.2.0",
    "@angular/forms": "^22.2.0",
    "@angular/platform-browser": "^22.2.0",
    "@angular/router": "^22.2.0",
    "@capacitor/android": "^8.5.0",
    "@capacitor/core": "^8.5.0",
    "@ionic/angular": "^9.0.0",
    "rxjs": "~7.8.0",
    "tslib": "^2.8.0"
  },
  "devDependencies": {
    "@angular/build": "^22.2.0",
    "@angular/cli": "^22.2.0",
    "@angular/compiler-cli": "^22.2.0",
    "@capacitor/cli": "^8.5.0",
    "typescript": "~5.9.0"
  }
}
```

`package-lock.json`: `{ "name": "shop-ionic", "lockfileVersion": 3, "requires": true, "packages": {} }`

`angular.json`:
```json
{
  "version": 1,
  "projects": {
    "app": {
      "projectType": "application",
      "root": "",
      "sourceRoot": "src",
      "prefix": "app",
      "architect": {
        "build": {
          "builder": "@angular/build:application",
          "options": {
            "outputPath": { "base": "www", "browser": "" },
            "index": "src/index.html",
            "browser": "src/main.ts",
            "polyfills": [],
            "tsConfig": "tsconfig.app.json",
            "assets": [{ "glob": "**/*", "input": "public" }]
          }
        },
        "serve": { "builder": "@angular/build:dev-server", "options": { "buildTarget": "app:build" } },
        "extract-i18n": { "builder": "@angular/build:extract-i18n" }
      }
    }
  }
}
```

`tsconfig.json`: `{ "compilerOptions": { "strict": true, "target": "ES2022", "module": "preserve", "moduleResolution": "bundler", "lib": ["ES2022", "dom"] } }`
`tsconfig.app.json`: `{ "extends": "./tsconfig.json", "files": ["src/main.ts"], "include": ["src/**/*.ts"] }`
`capacitor.config.ts`:
```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = { appId: 'com.example.shop', appName: 'Shop', webDir: 'www' };
export default config;
```
`ionic.config.json`: `{ "name": "shop-ionic", "integrations": { "capacitor": {} }, "type": "angular-standalone" }`
`android/app/src/main/AndroidManifest.xml`: `<?xml version="1.0" encoding="utf-8"?><manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:label="@string/app_name" /></manifest>`
`android/settings.gradle`: `include ':app'`
`.gitignore`: `node_modules\nwww\n.angular`
`public/.gitkeep`: empty.
`src/index.html`:
```html
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Shop</title><base href="/" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body><app-root></app-root></body>
</html>
```
`src/main.ts`, `src/app/app.component.ts`, `src/app/app.routes.ts`:
```ts
// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
  ],
});
```
```ts
// src/app/app.component.ts
import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';

@Component({
  selector: 'app-root',
  template: '<ion-app><ion-router-outlet></ion-router-outlet></ion-app>',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {}
```
```ts
// src/app/app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'cart', pathMatch: 'full' },
  { path: 'cart', loadComponent: () => import('./cart/cart.page').then((m) => m.CartPage) },
];
```
`src/app/cart/cart.page.ts`:
```ts
import { Component, inject } from '@angular/core';
import {
  AlertController, ToastController, IonBackButton, IonButton, IonButtons, IonContent,
  IonHeader, IonItem, IonLabel, IonList, IonTitle, IonToolbar,
} from '@ionic/angular';

interface CartLine { name: string; price: number; qty: number }

@Component({
  selector: 'app-cart',
  templateUrl: './cart.page.html',
  imports: [IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonTitle, IonToolbar],
})
export class CartPage {
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  lines: CartLine[] = [
    { name: 'Ceramic mug', price: 12.5, qty: 2 },
    { name: 'Linen towel', price: 18, qty: 1 },
  ];

  get total(): number { return this.lines.reduce((sum, l) => sum + l.price * l.qty, 0); }
  get itemCount(): number { return this.lines.reduce((sum, l) => sum + l.qty, 0); }

  formatPrice(value: number): string { return '$' + value.toFixed(2); }

  async remove(line: CartLine) {
    const alert = await this.alertCtrl.create({
      header: 'Remove item?',
      message: `Remove ${line.name} from your cart?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Remove', role: 'destructive', handler: () => this.drop(line) },
      ],
    });
    await alert.present();
  }

  private async drop(line: CartLine) {
    this.lines = this.lines.filter((l) => l !== line);
    const toast = await this.toastCtrl.create({ message: 'Item removed', duration: 1500 });
    await toast.present();
  }
}
```
`src/app/cart/cart.page.html`:
```html
<ion-header>
  <ion-toolbar>
    <ion-buttons slot="start"><ion-back-button defaultHref="/"></ion-back-button></ion-buttons>
    <ion-title>Your cart</ion-title>
  </ion-toolbar>
</ion-header>
<ion-content>
  <p>{{ itemCount }} items</p>
  <ion-list>
    @for (line of lines; track line.name) {
      <ion-item>
        <ion-label>{{ line.name }} — {{ formatPrice(line.price) }}</ion-label>
        <ion-button fill="clear" (click)="remove(line)">Remove</ion-button>
      </ion-item>
    }
  </ion-list>
  <p>Total: {{ formatPrice(total) }}</p>
  <ion-button expand="block">Check out</ion-button>
</ion-content>
```

- [ ] **Step 6: Create `fixtures/ionic-react-capacitor/`.**

`package.json`:
```json
{
  "name": "shop-ionic-react",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Mobile storefront: browse products, manage a cart, check out",
  "scripts": { "dev": "vite", "build": "tsc && vite build" },
  "dependencies": {
    "@capacitor/android": "^8.5.0",
    "@capacitor/core": "^8.5.0",
    "@ionic/react": "^9.0.0",
    "@ionic/react-router": "^9.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^6.30.0",
    "react-router-dom": "^6.30.0"
  },
  "devDependencies": {
    "@capacitor/cli": "^8.5.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "typescript": "~5.9.0",
    "vite": "^7.0.0"
  }
}
```
`package-lock.json` stub (as above, name `shop-ionic-react`). `vite.config.ts`:
```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({ plugins: [react()] });
```
`tsconfig.json`: `{ "compilerOptions": { "strict": true, "target": "ES2022", "module": "ESNext", "moduleResolution": "bundler", "jsx": "react-jsx", "lib": ["ES2022", "DOM"] }, "include": ["src"] }`
`index.html`: `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><title>Shop</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`
`capacitor.config.ts` (webDir `dist`), `ionic.config.json` (`"type": "react-vite"`), `android/settings.gradle`, `android/app/src/main/AndroidManifest.xml` as in Step 5.
`src/main.tsx`:
```tsx
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
```
`src/App.tsx`:
```tsx
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route } from 'react-router-dom';
import Cart from './pages/Cart';

setupIonicReact();

export default function App() {
  return (
    <IonApp>
      <IonReactRouter>
        <IonRouterOutlet>
          <Route exact path="/cart" component={Cart} />
          <Route exact path="/"><Redirect to="/cart" /></Route>
        </IonRouterOutlet>
      </IonReactRouter>
    </IonApp>
  );
}
```
`src/pages/Cart.tsx`:
```tsx
import { IonButton, IonContent, IonHeader, IonItem, IonLabel, IonList, IonPage, IonTitle, IonToolbar, useIonAlert, useIonToast } from '@ionic/react';
import { useState } from 'react';

const initial = [
  { name: 'Ceramic mug', price: 12.5, qty: 2 },
  { name: 'Linen towel', price: 18, qty: 1 },
];

export default function Cart() {
  const [lines, setLines] = useState(initial);
  const [presentAlert] = useIonAlert();
  const [presentToast] = useIonToast();
  const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0);

  const remove = (name: string) =>
    presentAlert({
      header: 'Remove item?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Remove', role: 'destructive', handler: () => { setLines(lines.filter((l) => l.name !== name)); presentToast({ message: 'Item removed', duration: 1500 }); } },
      ],
    });

  return (
    <IonPage>
      <IonHeader><IonToolbar><IonTitle>Your cart</IonTitle></IonToolbar></IonHeader>
      <IonContent>
        <IonList>
          {lines.map((l) => (
            <IonItem key={l.name}>
              <IonLabel>{l.name} — ${l.price.toFixed(2)}</IonLabel>
              <IonButton fill="clear" onClick={() => remove(l.name)}>Remove</IonButton>
            </IonItem>
          ))}
        </IonList>
        <p>Total: ${total.toFixed(2)}</p>
        <IonButton expand="block">Check out</IonButton>
      </IonContent>
    </IonPage>
  );
}
```

- [ ] **Step 7: Create `fixtures/ionic-vue-capacitor/`.**

`package.json`:
```json
{
  "name": "shop-ionic-vue",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Mobile storefront: browse products, manage a cart, check out",
  "scripts": { "dev": "vite", "build": "vue-tsc && vite build" },
  "dependencies": {
    "@capacitor/android": "^8.5.0",
    "@capacitor/core": "^8.5.0",
    "@ionic/vue": "^9.0.0",
    "@ionic/vue-router": "^9.0.0",
    "vue": "^3.5.0",
    "vue-router": "^4.5.0"
  },
  "devDependencies": {
    "@capacitor/cli": "^8.5.0",
    "@vitejs/plugin-vue": "^6.0.0",
    "typescript": "~5.9.0",
    "vite": "^7.0.0",
    "vue-tsc": "^3.0.0"
  }
}
```
`package-lock.json` stub; `vite.config.ts` (`import vue from '@vitejs/plugin-vue'; export default defineConfig({ plugins: [vue()] })`); `tsconfig.json` (as React minus `jsx`, `include: ["src"]`); `index.html` (script `/src/main.ts`, `<div id="app">`); `capacitor.config.ts` (webDir `dist`), `ionic.config.json` (`"type": "vue-vite"`), android stubs.
`src/main.ts`:
```ts
import { IonicVue } from '@ionic/vue';
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

createApp(App).use(IonicVue).use(router).mount('#app');
```
`src/router/index.ts`:
```ts
import { createRouter, createWebHistory } from '@ionic/vue-router';
import CartPage from '../views/CartPage.vue';

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [{ path: '/', redirect: '/cart' }, { path: '/cart', component: CartPage }],
});
```
`src/App.vue`:
```vue
<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue';
</script>

<template>
  <ion-app><ion-router-outlet /></ion-app>
</template>
```
`src/views/CartPage.vue`:
```vue
<script setup lang="ts">
import { IonButton, IonContent, IonHeader, IonItem, IonLabel, IonList, IonPage, IonTitle, IonToolbar, alertController, toastController } from '@ionic/vue';
import { computed, ref } from 'vue';

const lines = ref([
  { name: 'Ceramic mug', price: 12.5, qty: 2 },
  { name: 'Linen towel', price: 18, qty: 1 },
]);
const total = computed(() => lines.value.reduce((sum, l) => sum + l.price * l.qty, 0));

async function remove(name: string) {
  const alert = await alertController.create({
    header: 'Remove item?',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      { text: 'Remove', role: 'destructive', handler: async () => {
        lines.value = lines.value.filter((l) => l.name !== name);
        (await toastController.create({ message: 'Item removed', duration: 1500 })).present();
      } },
    ],
  });
  await alert.present();
}
</script>

<template>
  <ion-page>
    <ion-header><ion-toolbar><ion-title>Your cart</ion-title></ion-toolbar></ion-header>
    <ion-content>
      <ion-list>
        <ion-item v-for="l in lines" :key="l.name">
          <ion-label>{{ l.name }} — ${{ l.price.toFixed(2) }}</ion-label>
          <ion-button fill="clear" @click="remove(l.name)">Remove</ion-button>
        </ion-item>
      </ion-list>
      <p>Total: ${{ total.toFixed(2) }}</p>
      <ion-button expand="block">Check out</ion-button>
    </ion-content>
  </ion-page>
</template>
```

- [ ] **Step 8: Static checks**

```bash
jq -e . evals/fixtures.json >/dev/null && for f in evals/expectations/detection/ionic-*.json evals/expectations/plan/ionic-*.json; do jq -e . "$f" >/dev/null || echo "BAD $f"; done
for fx in ionic-angular-capacitor ionic-react-capacitor ionic-vue-capacitor angular-ssr; do
  W=$(mktemp -d); ./evals/helpers/prepare-workdir.sh "$fx" "$W" && echo "ok $fx"; rm -rf "$W"
done
```

Expected: no `BAD`, four `ok` lines.

- [ ] **Step 9: Live Layer A runs (model calls, ~3 min each — run if the `claude` CLI is available; otherwise record "not run" in the PR).**

```bash
for fx in ionic-angular-capacitor ionic-react-capacitor ionic-vue-capacitor angular-ssr; do ./evals/run-eval-layer-a.sh "$fx"; done
```

Also re-run the regression set the README names for detection-order changes: `vite-swc`, `vite-babel`, `vite-swc-data-module`, `webext-wxt-react-lingui` — none may reclassify. Record PASS/FAIL per fixture for the PR body; on FAIL, re-run with `KEEP_WORKDIR=1`, read `.globalize/detection.json` and `.eval-agent-output.txt`, and fix the SKILL.md prose (not the golden) unless the golden is wrong.

- [ ] **Step 10: Commit**

```bash
git add evals/verify-orchestration.sh evals/fixtures.json evals/expectations fixtures/ionic-angular-capacitor fixtures/ionic-react-capacitor fixtures/ionic-vue-capacitor
git commit -m "test(evals): Ionic Angular/React/Vue + Capacitor Layer A fixtures and decisionsSections"
```

---

## Task 11: Empirical smoke — run the setup reference's code for real

The spike was thrown away; the code blocks in Task 3 are newly written. This task runs them. Needs network and Node ≥ 20.19. Work in the scratchpad, never in the repo. Every discrepancy is fixed **in `angular-localize.setup.md`** (and re-run), not worked around here.

**Files:** none committed except fixes to `JS/frameworks/angular/angular-localize.setup.md` (and Task 7's checker if it is wrong).

- [ ] **Step 1: Scaffold**

```bash
S=<scratchpad>/ng-smoke && mkdir -p "$S" && cd "$S"
npx '@angular/cli@^22' new smoke --ssr=false --skip-git --defaults --style=css
cd smoke && npm i '@ionic/angular@^9'
npx ng add '@angular/localize@^22' --skip-confirmation --use-at-runtime
grep -q '"@angular/localize"' <(jq '.dependencies' package.json) && echo "localize in dependencies"
grep -q '@angular/localize/init' angular.json && echo "polyfill added"
```

Expected: both lines print. If `ng add` placed things differently, update Task 3 Step 4's prose.

- [ ] **Step 2: Apply the setup reference by hand** — exactly as written: `angular.json` (`i18n.sourceLocale: "en"`, extract options), `scripts/xliff-to-json.mjs`, package scripts, `src/locale-config.ts` with `LOCALES = ['en', 'lv', 'pt-BR']`, `src/main.ts` (standalone branch; this scaffold uses `App` from `./app/app` + `appConfig`), `src/app/i18n/locale.ts`, the Ionic switcher, `src/app/i18n/format.ts`. Add to `src/app/app.html`:

```html
<h1 i18n="Smoke page title@@smoke.page.title">Your cart</h1>
<p i18n="Item count in the cart@@smoke.cart.count">{count, plural, =0 {Cart is empty} one {{{count}} item} other {{{count}} items}}</p>
<p>{{ 1234567.891 | fmt:'number' }} · {{ 12.5 | fmt:'money':'EUR' }}</p>
<p>{{ greeting }}</p>
<app-language-switcher />
```

and to `App`: `count = 21; greeting = $localize\`:Greeting with a name@@smoke.greeting:Hello ${'Ada'}:name:\``, plus `imports: [FmtPipe, LanguageSwitcherComponent]`.

- [ ] **Step 3: Resolver unit test** (Review Focus 3):

```bash
cat > resolve-test.mjs <<'EOF'
import { matchLocale, resolveLocale, isRtl } from './src/locale-config.ts'
const eq = (a, b, m) => { if (a !== b) { console.error(`FAIL ${m}: ${a} !== ${b}`); process.exitCode = 1 } else console.log(`ok ${m}`) }
eq(resolveLocale(null, ['lv-LV', 'en']), 'lv', 'device lv-LV → lv')
eq(resolveLocale(null, ['pt-PT']), 'pt-BR', 'pt-PT → pt-BR by language subtag')
eq(resolveLocale('de', ['fr-FR']), 'en', 'stale stored + unsupported device → source')
eq(resolveLocale('PT-br', []), 'pt-BR', 'case-insensitive stored')
eq(matchLocale(''), null, 'empty tag')
eq(isRtl('ar-EG'), true, 'ar-EG is RTL')
EOF
node --experimental-strip-types resolve-test.mjs; rm resolve-test.mjs
```

Expected: six `ok` lines, exit 0.

- [ ] **Step 4: Extract, craft targets, compile** (Review Focus 2):

```bash
npm run i18n:extract && test -f src/locale/messages.en.xlf
grep -c '<note category="description">' src/locale/messages.en.xlf   # = number of units
```

Create `src/locale/messages.lv.xlf` from the source: set `trgLang="lv"` on `<xliff>`, add `<target>` to every unit **except** `smoke.greeting`; give `smoke.cart.count` the target `{VAR_PLURAL, plural, =0 {Grozs ir tukšs} zero {<ph id="0" equiv="INTERPOLATION" disp="{{ count }}"/> preču} one {<ph id="0" equiv="INTERPOLATION" disp="{{ count }}"/> prece} other {<ph id="0" equiv="INTERPOLATION" disp="{{ count }}"/> preces}}` (copy the exact `<ph>` the source unit carries). Create `messages.pt-BR.xlf` similarly with all targets.

```bash
npm run i18n:compile; echo "exit=$?"
jq . public/i18n/lv.json
```

Expected: exit 0; output line for `lv` says `1 untranslated (shown in en)`; `lv.json` maps `smoke.page.title` to the Latvian text, `smoke.greeting` to the source text with `{$name}`, and the plural to an ICU string with `{INTERPOLATION}` inside the cases. Then break `messages.lv.xlf` (delete a closing `</unit>`) → re-run → exit 1 with an error naming the file. Restore. Change `trgLang` to `de` → exit 1 with the mismatch message. Restore.

- [ ] **Step 5: Build and run in a browser** (Review Focus 3, locale data):

```bash
npm run build && ls dist/smoke/browser/i18n/
npx 'http-server@^14' dist/smoke/browser -p 4300 -s &
```

In a browser (Claude in Chrome if available): open `http://localhost:4300`, run `localStorage.setItem('app.locale','lv'); location.reload()` in the console. Expect Latvian title, `21 prece`, `1 234 567,891`, `12,50 €`, `<html lang="lv" dir="ltr">`, no console errors except one warning for the untranslated `smoke.greeting`. Repeat with `pt-BR` (expect Portuguese title and `1.234.567,891`) and with `de` (expect English — stale value ignored). Use the switcher: choosing a language persists and reloads. Stop the server.

- [ ] **Step 6: Ionic hooks present** (Review Focus 1): `jq -r '.scripts["ionic:serve:before"], .scripts["ionic:build:before"]' package.json` → both `node scripts/xliff-to-json.mjs`.

- [ ] **Step 7: Run the repo checkers against the smoke app.**

```bash
<repo>/evals/library-checks/angular-localize.sh "$PWD" smoke     # expect Failed: 0
# write .globalize/format-module.json per Task 3 Step 10, then:
<repo>/evals/verify-format-helpers.sh --project "$PWD"             # expect Failed: 0 except the rules-file WARN
```

- [ ] **Step 8: NgModule branch.**

```bash
cd "$S" && npx '@angular/cli@^22' new smoke-mod --no-standalone --ssr=false --skip-git --defaults --style=css
cd smoke-mod && npx ng add '@angular/localize@^22' --skip-confirmation --use-at-runtime
```

Apply `locale-config.ts`, the NgModule `main.ts`, one `i18n` string and `{{ 1234.5 | number }}` in `app.component.html`; extract, add an `lv` target, compile, build, load with `app.locale=lv`. Expect the Latvian string and `1 234,5` (proves `LOCALE_ID` via `bootstrapModule` options).

- [ ] **Step 9: Commit any reference fixes**

```bash
git add skills/globalize-guide/references/languages/js-ts/frameworks/angular/angular-localize.setup.md evals/library-checks/angular-localize.sh
git commit -m "fix(globalize-guide): angular-localize setup corrections from smoke run"
```

(Skip the commit if nothing changed; record "smoke: no changes needed" for the PR.)

---

## Task 12: Counts, docs, final gates

**Files:**
- Modify: `CLAUDE.md`, `G/references/rules-template-format.md`, `evals/README.md`

- [ ] **Step 1: Failing check**

```bash
grep -q 'All 24 stack variants' CLAUDE.md && grep -q 'Nine templates cover the twenty-four variants' CLAUDE.md \
 && grep -q 'twenty-four-stack' skills/globalize-guide/references/rules-template-format.md \
 && grep -q 'decisionsSections' evals/README.md && grep -q 'angular-localize.sh' evals/README.md \
 && echo PASS || echo FAIL
```

Expected: `FAIL`.

- [ ] **Step 2: Edits.**
  - `CLAUDE.md` line 77: "twenty-three-stack" → "twenty-four-stack". Line 79: "All 23 stack variants" → "All 24 stack variants"; "Eight templates cover the twenty-three variants" → "Nine templates cover the twenty-four variants"; append `, `angular-localize` (Angular ± Ionic ± Capacitor on `@angular/localize`)` to the template list; "Six of the eight" → "Seven of the nine".
  - `rules-template-format.md` line 195: "twenty-three-stack" → "twenty-four-stack".
  - `evals/README.md`: in "Plan expectation" document `decisionsSections` (one bullet + JSON example `"decisionsSections": { "Routing strategy": "^None" }`, and the null-in-`match` caveat); in "Layer B Verification" list `angular-localize.sh`; in "One fixture, two variants" / detection guard add a sentence that `ionic-*-capacitor` fixtures guard the narrowed Capacitor stop and the Angular-before-`vite` ordering.

- [ ] **Step 3: Final gates** — all must pass:

```bash
# Step 1 block → PASS
./evals/verify-manifest.sh          # Failed: 0; 24 variants
./evals/verify-rules-template.sh    # Failed: 0; includes angular-localize
./evals/verify-format-helpers.sh    # Failed: 0; pairs checked: 9
grep -rn -i 'twenty-three\|all 23\|eight templates\|of the eight' CLAUDE.md skills evals --include='*.md' --include='*.sh' | grep -v 'Seven of the eight `@lingui'   # expect no output (the Lingui package sentence is unrelated)
git status --short                  # only intended files
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md skills/globalize-guide/references/rules-template-format.md evals/README.md
git commit -m "docs: 24 variants, 9 rules templates; document decisionsSections and the Angular checker"
```

- [ ] **Step 5: PR body checklist** (no Claude attribution lines): locked decisions 1–12; Layer A results per fixture (or "not run"); smoke results (Task 11 Steps 3–8); open risks carried from the spec (Globalize `xliff-2` round-trip, `@angular/localize/tools` API stability, on-device behaviour, Angular 18–21 untested).
