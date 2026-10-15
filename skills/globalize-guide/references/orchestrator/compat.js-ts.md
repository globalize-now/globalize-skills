# Compatibility hard-stops — JS / TS

Loaded by SKILL.md §1.2 when `language === "js-ts"` — after the React Native / Flutter signal stops in SKILL.md, which are always checked first. Covers the generic JS rows, browser extensions, Angular, hybrid apps, and Paraglide notes. Apply top-to-bottom; the first STOP ends the run.

When stopping, prefix the message with `Compatibility check — found a blocker:` so the user sees a clear framing rather than an abrupt error.

| Condition | Stop message |
|---|---|
| `language === "js-ts"` AND `framework !== "webext"` AND `react === false` AND `vue === false` AND `svelte === false` AND `angular === false` | "globalize-guide currently supports React-based, Vue-based, Svelte-based, and Angular-based projects only. This project uses {framework}. No supported library available." |
| `framework === "cra"` | "Create React App is no longer supported by this skill. Migrate to Vite or Next.js, then re-run." |
| `existing.library` is one of `react-intl`, `i18next`, `react-i18next`, `next-translate`, `typesafe-i18n`, `i18next-vue`, `@tolgee/vue`, `fluent-vue`, `@jsverse/transloco`, `@ngneat/transloco`, `@ngx-translate/core` | "This project already uses {library}. Migrating between i18n libraries is out of scope for this skill. Either continue with {library} (use its native tooling), or remove it first and re-run." |
| `framework === "next"` AND `router === "pages"` AND user wants Lingui | (Surface only after library choice in 1.5) "Lingui setup does not currently cover the Next.js Pages Router. Use next-intl on Pages Router, or migrate to App Router." |
| `@remix-run/react` in deps with major version `< 2` (i.e. Remix v1) | "Remix v1 is no longer supported by this skill. Upgrade to Remix v2 (`@remix-run/*` ≥ 2) or migrate to React Router v7 framework mode, then re-run." |
| `framework === "remix"` AND (`@remix-run/dev` major.minor `< 2.7` OR `vite` not in devDeps) | "This Remix v2 project uses the classic compiler (pre-Vite). Lingui requires the Vite-based build. Upgrade to `@remix-run/dev` ≥ 2.7 and follow Remix's classic-compiler → Vite migration, then re-run." |
| `framework === "sveltekit"` AND `@sveltejs/kit` major.minor `< 2.3` | "Paraglide's URL-based locale routing relies on SvelteKit's `reroute` hook, added in `@sveltejs/kit` 2.3.0 — your project is on an older version. Upgrade to SvelteKit ≥ 2.3, then re-run. (If you must stay below 2.3, a different, deprecated routing approach is required that this skill does not cover.)" |
| `svelte === true` AND `framework !== "sveltekit"` | "This skill currently supports Svelte only through SvelteKit (the Paraglide setup relies on SvelteKit's hooks and routing). A plain Vite + Svelte SPA is not yet supported. Adopt SvelteKit, or wait for SPA support, then re-run." |
| `language === "js-ts"` AND `framework !== "webext"` AND custom build pipeline (no `vite.config`, `next.config`, `nuxt.config`, `quasar.config`, `angular.json`, or `react-scripts`) | "This project uses an unsupported build pipeline. Lingui requires SWC or Babel; next-intl requires Next.js; vue-i18n requires Vite, Nuxt, or Quasar. Angular requires `angular.json`." |

**Lingui + Vite version gate** (evaluate after §1.5, once Lingui is the chosen library, on every variant whose manifest `packages` include `@lingui/vite-plugin` — the Vite variants, TanStack Start, Remix, React Router framework mode, and the Lingui extension variants). Read the **installed** `vite` version from the lockfile (or `node_modules/vite/package.json`), not the `package.json` range:

| Condition | Action |
|---|---|
| installed `vite` `< 6.3` | **Decision — ask before planning.** "`@lingui/vite-plugin` 6 — the version this setup installs — requires Vite ≥ 6.3 (peer range `^6.3.0 \|\| ^7 \|\| ^8`). This project has Vite {version}. Options: **(1) upgrade Vite to `^6` first** (recommended, and Lingui's own migration advice — I'll check the other Vite plugins' peer ranges with `npm install --dry-run`, bump the ones that need it, and rebuild before touching i18n), or **(2) stop here**." Record `decisions.setup.viteUpgrade = "^6"` or stop. Unguided/headless with no answer → **stop** with this message; never upgrade a build tool silently. |

Never resolve this conflict with `--legacy-peer-deps` or `--force` — that installs a plugin that cannot run on this Vite and moves the failure to build or run time. Never fall back to a Lingui 5 line either: the generated rules and setup references use v6-only config (`macro.jsxPlaceholderAttribute`), and mixing majors (e.g. `@lingui/macro@5` beside `@lingui/core@6`) is exactly the broken state this gate exists to prevent. On the React plugins, Vite 6 needs `@vitejs/plugin-react` ≥ 4.3.4 or `@vitejs/plugin-react-swc` ≥ 3.7.2 — bump within their current major (`'@vitejs/plugin-react@^4'`, `'@vitejs/plugin-react-swc@^3'`) when the installed one is older.

**Browser-extension compatibility rules** (apply only when `framework === "webext"`; the two generic JS rows above are guarded by `framework !== "webext"`, so a build-less or vanilla-JS extension does not falsely STOP there):

| Condition | Action |
|---|---|
| `framework === "webext"` AND `manifestVersion === 2` | **STOP.** "This extension is on Manifest V2. Chrome disabled MV2 for every user in Chrome 138 (July 2025) and removed the last MV2 listings from the Web Store in August 2026 — it will not load. Migrate to MV3, then re-run. (Firefox still runs MV2, but this skill targets MV3 only, and the two share the same `_locales` mechanism, so the i18n work carries over unchanged after you migrate.)" |
| `framework === "webext"` AND `extensionFramework === "plasmo"` | **Warn (non-blocking).** "Plasmo's last release and last commit on `main` are both 2025-05-17, with several hundred issues open — treat it as unmaintained. The native `chrome.i18n` path works fine on it (Plasmo reads `assets/_locales/`), so that's what I'll set up; the Lingui path isn't covered for Plasmo's Parcel build. Consider `npx wxt@latest init` for new work." |
| `framework === "webext"` AND `extensionFramework === "webpack"` | **Warn (non-blocking).** "This extension builds with webpack. The native `chrome.i18n` path works there without any build integration, so that's what I'll set up; the Lingui path is only covered for Vite-based builds (WXT, CRXJS, plain Vite)." |
| `framework === "webext"` AND `extensionFramework === "none"` | **Warn (non-blocking).** "This extension has no build step, so the native `chrome.i18n` path is the only option — which is fine: it needs no bundler, no dependencies, and no compile step. If you later want ICU plurals or an in-extension language picker, adopt a Vite-based build and re-run." |
| Safari packaging present (an `.xcodeproj` produced by `safari-web-extension-converter`, or a `Safari*Extension` target beside the web sources) | **Warn (non-blocking).** "There are open, unresolved reports of `browser.i18n.getMessage()` returning empty strings in Safari after conversion. Verify i18n explicitly on Safari once set up — don't assume parity with Chrome." |

**No MV3-era version warning otherwise.** Unlike the JS framework version branches, `_locales` and `chrome.i18n` have been stable since the API shipped, so there is no version-gated emission and nothing else to warn about.

**Angular compatibility rules** (apply only when `framework === "angular"`):

| Condition | Action |
|---|---|
| `@angular/ssr` in deps | **STOP.** "This Angular app uses server-side rendering (`@angular/ssr`). The supported setup loads translations at runtime with `loadTranslations()`, which sets a process-wide global — on a server it cannot differ between two concurrent requests, so one visitor would be served another's language. SSR is not supported yet. Remove `@angular/ssr` for a client-only build, or wait for SSR support, then re-run." |
| Any `@analogjs/*` package in deps or devDeps | **STOP.** "This is an AnalogJS app. AnalogJS (Vite-based Angular meta-framework) is not supported — the Angular setup targets the Angular CLI application builder." |
| Any `projectType: "application"` project in `angular.json` whose `architect.build.builder` is neither `@angular/build:application` nor `@angular-devkit/build-angular:application` | **STOP.** "This project builds with `{builder}`. The Angular setup needs the application builder (`@angular/build:application`). Migrate with `ng update @angular/cli --name use-application-builder`, then re-run." |
| `version` major `< 18` | **STOP.** "This project is on Angular {version}. The Angular setup supports Angular 18 and later (Ionic 9's floor). Upgrade with `ng update`, then re-run." |

**Hybrid-app notes** (non-blocking; apply on any framework):

| Condition | Action |
|---|---|
| `hybrid === "cordova"` | **Warn (non-blocking).** "This is a Cordova app. Its web layer is localized exactly like a browser app, so the setup proceeds; Cordova itself is in maintenance mode and only the Capacitor path has been exercised." |
| `hybrid !== null` AND an `android/` or `ios/` folder exists | **Notice (non-blocking).** "The app name and native permission prompts (`NS*UsageDescription`, Android `app_name`) live in native files and stay in the source language — this setup localizes the web UI only." |

These are not hard-stops, but note for the Paraglide path:

- If `existing.library === "paraglide"` AND `existing.configured === true`, do **not** run a from-scratch setup — route Phase 2 to the collapse / already-configured case (see "Phase 2 collapse-case").
- If `@inlang/paraglide-sveltekit` (the Paraglide 1.x SvelteKit adapter) is in deps, this is a **migration**, not a fresh setup: Paraglide 2.x replaced the dedicated adapter with the framework-agnostic `reroute` + `handle` model. Flag it to the user before proceeding; the setup reference covers the migration steps.
