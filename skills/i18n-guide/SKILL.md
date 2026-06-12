---
name: i18n-guide
description: >-
  Drive the full internationalization journey for a project — detect the stack,
  recommend a library, set up the chosen library, wrap existing strings, and
  optionally connect a translation platform. Use when the user asks to add or
  configure i18n, internationalization, localization, multi-language support,
  or translations — including when they explicitly mention LinguiJS, Lingui,
  next-intl, "wrap strings", "find hardcoded text", "make my app translatable",
  or "set up translations". Triggers on generic phrasings like "add i18n",
  "internationalize my app", "add translations", "multi-language support",
  "localize my app", and on library-specific phrasings like "set up Lingui",
  "set up next-intl", "use Lingui in this project". Does not trigger for
  unrelated CSS-only RTL questions (those use css-i18n) or for managing an
  already-set-up Globalize.now project (those use globalize-now-cli-use).
---

# i18n Orchestrator

This skill drives the full i18n journey through four phases:

| Phase | Goal |
|---|---|
| 1 — Inspect and decide | Detect stack, ask all user questions, generate an executable plan |
| 2 — Setup | Install + configure the chosen library |
| 3 — Convert | Wrap hardcoded strings, extract + compile catalogs |
| 4 — Globalize-now (optional) | Connect a translation platform |

The orchestrator (this SKILL.md) is library-agnostic. Library- and stack-specific guidance lives in `references/` and is loaded by subagents at dispatch time, driven by `manifest.json`.

**Architectural rule:** the orchestrator never executes work directly. It asks Phase 1 questions, generates the plan, dispatches subagents in the background, polls a shared progress workspace at `.globalize/`, and surfaces results. All file modifications, all bash commands, and all reference reading happen inside subagents.

---

## Workspace: `.globalize/`

Created in the **target project root** (the project being internationalized). Every artifact the orchestrator and subagents share lives here.

```
.globalize/
  detection.json              # output of inspect subagent (Phase 1.1)
  decisions.md                # frozen user choices from Phase 1
  plan.md                     # executable plan for phases 2/3/4
  manifest-snapshot.json      # frozen copy of the chosen manifest entry
  progress/
    setup.json                # Phase 2 setup subagent
    wrap-1.json…wrap-N.json   # Phase 3 wrap subagents (one per partition)
    verify.json               # Phase 3 verify subagent
    globalize.json            # Phase 4 project subagent
    archive/<ISO-timestamp>/  # archived after each phase completes
```

### First-run setup

If `.globalize/` does not exist in the target project, create it and append `/.globalize/` to the project's `.gitignore` (create the file if missing). Confirm with the user only if `.gitignore` exists and already has rules — show the diff before appending.

> **User-facing message** (when actually creating the folder):
> "Created `.globalize/` in your project root and added it to `.gitignore`. This folder holds local progress files, decisions, and plans so we can resume mid-run and so you can audit what was decided. It stays out of git."

### Resumability

If `.globalize/` exists when the orchestrator starts, read `plan.md` and `progress/*.json` to determine state. If a plan is already in flight (some phases incomplete), tell the user:

> "Found an in-progress i18n setup at `.globalize/`. Last completed step: `<step>`. Want me to resume from there, or start over with a fresh plan?"

Proceed accordingly.

---

## Phase 1 — Inspect and Decide

Phase 1 ends with a fully populated `.globalize/` (detection, decisions, plan, manifest snapshot) and the user's "go" before any work happens. Every user prompt this skill ever asks lives in Phase 1 — Phases 2/3/4 are pure execution.

> **User-facing message** (orchestrator kickoff, before 1.1):
> "Hey — I'll walk you through internationalizing this project in four phases: inspect, set up the library, wrap your hardcoded strings, and (optionally) connect a translation platform. First I'll do a read-only scan of your project — framework, router, existing i18n setup, files with translatable text. No changes yet. After that I'll ask a small set of questions to shape the plan."

### 1.1 Inspect subagent

Dispatch a subagent (foreground, blocking — small output, no progress polling needed) with this prompt:

> You are inspecting a project to gather i18n setup context. Read-only — do not modify any files.
>
> First decide the project **language**, applying these rules **in order, first match wins** (the order is load-bearing — a root `package.json` must beat native signals so hybrid/web wrappers route to JS):
> 1. A `Gemfile`/`Gemfile.lock` (containing `rails`), `bin/rails`, or `config/application.rb` is present → **ruby** (read the Ruby signals below instead of the JS ones).
> 2. A root `package.json` is present → **js-ts** (read the JS signals; this deliberately includes hybrid/web-wrapper apps — **React Native, Capacitor, Cordova, Ionic** — which ship a native `android/` or `ios/` folder but localize in the JS layer, so they belong on the JS path or its §1.2 stop, never a native path).
> 3. Native-Android Gradle signals are present (`AndroidManifest.xml`, OR a `build.gradle`/`build.gradle.kts` applying `com.android.application`/`com.android.library`, plus `gradlew`/`settings.gradle`) **AND** there is no root `package.json` **AND** no `pubspec.yaml` → **android** (read the Android signals below). (A `pubspec.yaml` means Flutter — it ships an `android/` Gradle subfolder but localizes via `.arb`, not native `strings.xml`; it is excluded here and stopped in §1.2.)
> 4. `*.xcodeproj`/`*.xcworkspace`/`Package.swift`/`*.swift` is present (and none of the above matched) → **swift** (read the Swift/Apple signals table below).
> 5. Otherwise → **unknown**.
>
> For a **js-ts** project, read the project's `package.json`, build config files (`vite.config.*`, `next.config.*`, `.babelrc`), and survey the source tree. Output **only** a single JSON object matching this schema, written to `.globalize/detection.json`:
>
> ```json
> {
>   "language": "js-ts" | "ruby" | "android" | "swift" | "unknown",
>   "framework": "next" | "vite" | "tanstack-start" | "remix" | "react-router-framework" | "nuxt" | "quasar" | "sveltekit" | "cra" | "rails" | "android" | "unknown",
>   "router": "app" | "pages" | "tanstack-router" | "tanstack-start" | "react-router" | "vue-router" | "sveltekit" | "none",
>   "compiler": "swc" | "babel",
>   "react": true | false,
>   "vue": true | false,
>   "svelte": true | false,
>   "typescript": true | false,
>   "packageManager": "npm" | "yarn" | "pnpm" | "bun" | "bundler" | "gradle",
>   "platform": "ios" | "macos" | null,
>   "buildSystem": "xcode" | "spm" | null,
>   "uiFramework": "swiftui" | "uikit" | null,
>   "version": string | null,
>   "sourceDir": "src" | "app" | string,
>   "routeEntries": ["src/app/**/page.tsx", ...] | null,
>   "git": { "isRepo": true | false, "branch": string | null, "remote": string | null },
>   "existing": {
>     "library": "lingui" | "next-intl" | "react-intl" | "i18next" | "react-i18next" | "next-translate" | "typesafe-i18n" | "vue-i18n" | "@nuxtjs/i18n" | "i18next-vue" | "@tolgee/vue" | "fluent-vue" | "paraglide" | "rails-i18n" | "android-strings" | "string-catalog" | "none",
>     "configured": true | false,
>     "providerWired": true | false,
>     "catalogsScaffolded": true | false,
>     "stringsWrapped": "yes" | "partial" | "no"
>   },
>   "candidateFiles": [
>     { "path": "src/components/Navbar.tsx", "matchCount": 8 }
>   ],
>   "localeSignals": {
>     "existingLocaleDirs": ["src/locales/en", "src/locales/de"],
>     "envHints": ["DEFAULT_LOCALE=en"],
>     "readmeHints": ["mentions: English, German, French"]
>   }
> }
> ```
>
> **Detection rules:**
>
> | Field | How to detect |
> |---|---|
> | `language` | Apply in order (first match wins): (1) `Gemfile`/`Gemfile.lock` (containing `rails`), `bin/rails`, or `config/application.rb` → `ruby`. (2) root `package.json` present → `js-ts` (this beats native signals on purpose, so RN/Capacitor/Cordova/Ionic hybrids route to JS). (3) native-Android Gradle signals (`AndroidManifest.xml`, or `build.gradle{,.kts}` applying `com.android.application`/`com.android.library`, plus `gradlew`/`settings.gradle`) AND no root `package.json` AND no `pubspec.yaml` → `android`. (4) `*.xcodeproj`/`*.xcworkspace`/`Package.swift`/`*.swift` present (none of the above) → `swift` (read the Swift/Apple detection rules below, not these). (5) none → `unknown`. (The JS-path rules below apply only when `language === "js-ts"`; the Ruby table only when `language === "ruby"`; the Android table only when `language === "android"`; the Swift/Apple table only when `language === "swift"`.) |
> | `framework` | Evaluate in this order, first match wins: `next` in deps → next. `nuxt` in deps → nuxt. `quasar` in deps → quasar. `@tanstack/react-start` in deps → tanstack-start. Any `@remix-run/*` runtime package in deps → remix. `react-router` in deps AND `@react-router/dev` in devDeps AND a `react-router.config.{ts,js}` file at the repo root → react-router-framework. `@sveltejs/kit` in deps or devDeps → sveltekit. `vite` in devDeps (and none of the above) → vite. `react-scripts` in deps → cra. (Order matters: Remix v2, React Router v7 framework mode, and SvelteKit all ship `vite` in devDeps, so they must be checked before the `vite` fallback. React Router v7 SPA mode — `react-router` without `@react-router/dev` — correctly falls through to `vite` with `router: "react-router"`.) |
> | `router` | App Router: `app/` or `src/app/` with `layout.tsx`/`layout.js`. Pages Router: `pages/` with `_app.tsx`/`_app.jsx`. TanStack Start: deps include `@tanstack/react-start`. TanStack Router (client): `@tanstack/react-router` without `react-start`. React Router: `react-router` in deps (also the value reported for `framework: "remix"` and `framework: "react-router-framework"`, since both use react-router internally; this is informational only, no matcher predicates on it for those frameworks). Vue Router: `vue-router` in deps (Vite SPA / Quasar). SvelteKit: `framework === "sveltekit"` — file-based routing under `src/routes/`. |
> | `compiler` | `@vitejs/plugin-react-swc` → swc. `@vitejs/plugin-react` (no `-swc`) → babel. Next.js → swc unless `.babelrc` exists. TanStack Start → swc if `@vitejs/plugin-react-swc` (or `@vitejs/plugin-react@6+`) is in devDeps; babel otherwise. Remix v2 and React Router v7 framework mode → swc if `@vitejs/plugin-react-swc` is in devDeps; babel otherwise (both default to Babel via `@vitejs/plugin-react`). SvelteKit uses neither — the Svelte compiler runs through Vite (esbuild), and none of the rules above match — so the field is a don't-care for SvelteKit; report whatever the heuristic yields (it will not match any rule) and treat the value as not meaningful: the SvelteKit manifest entry does not key on `compiler`. |
> | `react` | `react` in deps or devDeps. |
> | `vue` | `vue` in deps or devDeps. |
> | `svelte` | `svelte` in deps or devDeps. |
> | `packageManager` | `package-lock.json` → npm. `yarn.lock` → yarn. `pnpm-lock.yaml` → pnpm. `bun.lock` → bun. |
> | `routeEntries` | App Router: `<root>/src/app/**/page.tsx`. TanStack file-based: `<root>/src/routes/**/*.tsx`. Remix v2 or React Router v7 framework mode: `<root>/app/routes/**/*.{tsx,jsx,ts,js}`. SvelteKit: `<root>/src/routes/**/*.svelte`. None if no file-based routing detected. |
> | `existing.library` | First match in deps/devDeps from the union of i18n libraries listed above. |
> | `existing.configured` | `lingui.config.*` present AND macro plugin wired in build config; OR `next-intl` config present AND plugin wired; OR (Vue) `createI18n(` present in `src/i18n/index.*` (Vite/Quasar) or `defineI18nConfig(` in `i18n.config.*` (Nuxt) AND `messageCompiler` wired; OR (Paraglide) `project.inlang/settings.json` present AND `paraglideVitePlugin` in `vite.config.*`. |
> | `existing.providerWired` | Layout/main file imports and renders `I18nProvider` (Lingui) or `NextIntlClientProvider` (next-intl); OR (Vue) `app.use(i18n)` in `main.*` (Vite) / boot file registered (Quasar) / `@nuxtjs/i18n` listed in `modules` (Nuxt); OR (Paraglide) `paraglideMiddleware` in `src/hooks.server.ts`. |
> | `existing.catalogsScaffolded` | Locale directories with at least one message file exist. |
> | `existing.stringsWrapped` | Glob source tree (`.{tsx,jsx,js,svelte}`), sample up to 50 files, count files with bare markup text vs. files importing macros/message functions (for Paraglide, `import { m } from '$lib/paraglide/messages.js'`): > 80% imported → "yes", > 20% → "partial", else → "no". |
> | `candidateFiles` | Glob `src/**/*.{tsx,ts,jsx,js,svelte}`, exclude tests/configs/`.d.ts`, grep each for: bare markup text (`>Word<`, including Svelte template text), user-visible attrs (`placeholder=`, `aria-label=`, `title=`, `alt=`), exported user-facing string literals. Return files with ≥1 match, sorted by match count desc. |
> | `localeSignals` | List existing locale dirs (e.g., `src/locales/`), env vars matching `*LOCALE*`, README mentions of language names. |
>
> **Ruby / Rails detection rules** (apply only when `language === "ruby"`; the JS rules above do not apply):
>
> | Field | How to detect |
> |---|---|
> | `framework` | `rails` gem in `Gemfile`/`Gemfile.lock`, OR `bin/rails`, OR `config/application.rb` → `rails`. Otherwise `unknown` (non-Rails Ruby — Sinatra, Hanami, plain `i18n` gem — is not supported; see 1.2). |
> | `packageManager` | `bundler` (Rails projects use Bundler + `Gemfile`). |
> | `version` | Parse `Gemfile.lock`: the line `rails (N.M.x)` → extract `N.M` (e.g. `"8.1"`). Used for the soft EOL warning in 1.2 and the `rails-i18n` pin. `null` if not resolvable. |
> | `router` | `none` (Rails routing is not modeled here; the `version` field is what the Rails path keys on). |
> | `existing.library` | `rails-i18n` in `Gemfile`/`Gemfile.lock` → `rails-i18n`; else `none`. (Rails' built-in `I18n` API is always present; `rails-i18n` adds CLDR plural data.) |
> | `existing.configured` | `config.i18n.*` keys (e.g. `default_locale`, `available_locales`) set in `config/application.rb` or a `config/initializers/*.rb`. |
> | `existing.providerWired` | An `around_action`/`switch_locale` or `I18n.with_locale` locale switcher present in `app/controllers/application_controller.rb`. |
> | `existing.catalogsScaffolded` | `config/locales/*.{yml,rb}` present with at least one populated, non-stub locale file (note split layouts — `devise.en.yml`, nested dirs — all auto-loaded by Rails). |
> | `existing.stringsWrapped` | Glob `app/views/**/*.erb`, `app/controllers/**/*.rb`, sample up to 50 files, count files using `t(`/`l(` helpers vs. files with bare user-visible text: > 80% using helpers → "yes", > 20% → "partial", else → "no". |
> | `candidateFiles` | Glob `app/views/**/*.erb`, `app/controllers/**/*.rb`, `app/mailers/**/*.rb`, `app/models/**/*.rb`; grep for bare user-visible text and string literals not already wrapped in `t(`/`l(`. Return files with ≥1 match, sorted by match count desc. |
> | `localeSignals` | List `config/locales/` files and the locale codes present; `config.i18n.default_locale`/`available_locales` values; README mentions of language names. |
>
> **Name-collision guardrail (Ruby):** the gems `globalize`, `mobility`, and `traco` translate **DB/model content** (per-row data like a product's `name`), NOT UI strings, and are entirely **unrelated to Globalize.now**. Do **not** treat `globalize` (the gem) as the Globalize.now platform. If any is present in `Gemfile`/`Gemfile.lock`, record it in `localeSignals.readmeHints` (or a free-form note) as a detect-and-warn signal — it must never trigger UI-string i18n logic and is surfaced to the user in 1.2 but is non-blocking.
>
> **Android detection rules** (apply only when `language === "android"`; the JS and Ruby rules above do not apply). "Module `res/` root" means the main module's resource dir — default to `app/src/main/res` (note multi-module/flavor layouts: `feature/src/main/res`, `src/<flavor>/res` — surface them in `localeSignals` but target the app module in v1):
>
> | Field | How to detect |
> |---|---|
> | `framework` | `android` (native Android — Gradle + `AndroidManifest.xml`). |
> | `packageManager` | `gradle`. |
> | `version` | `null` — Android emits no version-gated i18n code (string resources are stable across all API levels), so no version is captured. |
> | `router` | `none` (Android routing is not modeled here). |
> | `existing.library` | `android-strings` if `<module>/res/values/strings.xml` exists; else `none`. (String resources are platform-built-in — there is no library to depend on.) |
> | `existing.configured` | At least one target resource dir `<module>/res/values-*/strings.xml` exists (a locale overlay is present). |
> | `existing.providerWired` | A locale-selection mechanism is wired: `AppCompatDelegate.setApplicationLocales(` in source, OR `android:localeConfig` in `AndroidManifest.xml` with a `res/xml/locales_config.xml`. (Optional — per-app language is an add-on; `false` is normal.) |
> | `existing.catalogsScaffolded` | `<module>/res/values/strings.xml` (the source catalog) exists. |
> | `existing.stringsWrapped` | Sample up to 50 files across `<module>/res/layout/**/*.xml` and `**/*.{kt,java}`; count files referencing resources (`@string/`, `getString(`, `getText(`, `stringResource(`, `pluralStringResource(`) vs. files with bare user-visible literals: > 80% referencing → "yes", > 20% → "partial", else → "no". |
> | `candidateFiles` | Glob `<module>/res/layout/**/*.xml`, `<module>/res/menu/**/*.xml`, `<module>/res/xml/**/*.xml` (grep bare `android:text="literal"`, `android:hint=`, `android:title=`, `android:contentDescription=` with a non-`@string/` value), plus `**/*.{kt,java}` (string literals passed to `setText(`, `Text(`, `Toast`, etc., not already `getString`/`stringResource`). Return files with ≥1 match, sorted by match count desc. |
> | `localeSignals` | Locale codes parsed from `<module>/res/values-*/` dir qualifiers — normalize both legacy (`values-pt-rBR`) and BCP47 (`values-b+sr+Latn`) forms to BCP47; note any non-app-module `res/` dirs; README mentions of language names. |
>
> **Swift / Apple (iOS) detection rules** (apply only when `language === "swift"`; the JS, Ruby, and Android rules above do not apply):
>
> | Field | How to detect |
> |---|---|
> | `language` | `*.xcodeproj`/`*.xcworkspace`, `Package.swift`, or `*.swift` present → `swift`. (Only reached when there is no Gemfile-rails, no root `package.json`, and no native-Android Gradle signals — a root `package.json` routes React Native / Capacitor / Flutter to `js-ts` first.) |
> | `framework` / `router` / `compiler` / `react` / `vue` / `svelte` / `typescript` | Not meaningful for native Apple — set `framework: "unknown"`, `router: "none"`, and leave `compiler`/`react`/`vue`/`svelte` as `null`/`false`. No iOS manifest variant keys on any of them (iOS variants key on `language`/`buildSystem`/`platform`/`uiFramework`). |
> | `buildSystem` | `Package.swift` present and NO `.xcodeproj`/`.xcworkspace` → `spm`. `.xcodeproj`/`.xcworkspace` present → `xcode`. |
> | `uiFramework` | The `@main` entry point decides: a file with `import SwiftUI` + a `struct …: App` + `@main` → `swiftui` (even if it also uses a `UIApplicationDelegateAdaptor`). `@UIApplicationMain`/AppDelegate/SceneDelegate (a type conforming to `UIApplicationDelegate`/`UIResponder`) and/or `.storyboard`/`.xib` files with no SwiftUI `App` → `uikit`. Genuine ambiguity → default `swiftui`. An SPM library with no app entry point → `null`. NEVER emit `"mixed"` (it is unroutable). |
> | `platform` | iOS deployment target / `IPHONEOS_DEPLOYMENT_TARGET` / iOS SDK → `ios` (the default for an app target). SPM library → `null`. |
> | `packageManager` | `null` (Swift has no npm-style package manager; SPM is the build system and is recorded under `buildSystem`). |
> | `existing.library` | A `.xcstrings` present anywhere → `string-catalog`; else `none`. |
> | `existing.configured` | A `.xcstrings` present. |
> | `existing.catalogsScaffolded` | A `.xcstrings` present (same signal). |
> | `existing.stringsWrapped` | Sample `*.swift` files: > 80% of user-visible literals using `String(localized:` / `Text("…")` literals vs. bare user-visible `String` literals → "yes", > 20% → "partial", else → "no". |
> | `candidateFiles` | Glob `**/*.swift` (exclude tests and `Package.swift`), grep each for user-visible string literals not already in `String(localized:` / `Text(` / `NSLocalizedString(`. Return files with ≥1 match, sorted by match count desc. |
> | `localeSignals` | `.lproj` dirs; Info.plist `CFBundleLocalizations` / `CFBundleDevelopmentRegion`; existing `.strings`/`.stringsdict`/`.xcstrings` files; README language mentions. |
>
> For a `swift` detection, `platform`, `buildSystem`, and `uiFramework` MUST be populated (never left undefined) — the §1.3 matcher checks these structural keys by equality, and an undefined field never matches an iOS variant. For `js-ts`, `ruby`, and `android` detections, all three are `null`.
>
> Write the JSON file and exit. Do not engage in conversation.

> **User-facing message** (after the inspect subagent returns and `detection.json` is written):
> For `language === "js-ts"` (JS/TS): "Scan done. Detected: **{framework}** + **{router}** ({compiler} compiler, {packageManager}). Existing i18n: **{existing.library}** ({existing.configured ? 'already configured' : 'not configured yet'}). Found **{candidateFiles.length}** files with hardcoded strings. Next, a few questions to shape the setup plan."
> For `language === "ruby"` (Rails — `router` is "none" and `compiler` is not meaningful, so omit them): "Scan done. Detected: **rails** (bundler). Existing i18n: **{existing.library}** ({existing.configured ? 'already configured' : 'not configured yet'}). Found **{candidateFiles.length}** files with hardcoded strings. Next, a few questions to shape the setup plan."
> For `language === "android"` (native Android — `router` is "none" and `compiler` is not meaningful, so omit them): "Scan done. Detected: **android** (gradle). Existing i18n: **{existing.library}** ({existing.configured ? 'string resources already present' : 'no string resources yet'}). Found **{candidateFiles.length}** files with hardcoded strings. Next, a few questions to shape the setup plan."
> For `language === "swift"` (iOS — router/compiler are not meaningful, so omit them): "Scan done. Detected: **iOS** (**{uiFramework}**, **{buildSystem}**). Existing i18n: **{existing.library}** ({existing.configured ? 'already configured' : 'not configured yet'}). Found **{candidateFiles.length}** files with hardcoded strings. Next, a few questions to shape the setup plan."
>
> If `existing.library !== "none"`, also surface:
> "Heads up — you already have `{existing.library}` in your dependencies. If it's compatible, we'll continue with it; if not, I'll flag it in the next step."

### 1.2 Apply compatibility hard-stops

Read `detection.json`. Apply these rules top-to-bottom. If any matches, **STOP** the orchestrator with the corresponding message — do not proceed to 1.3.

**Evaluate first (signal stops):** the three Android signal-stops in the "Android compatibility rules" block below — **React Native**, **Capacitor/Cordova/Ionic**, and **Flutter** — are checked **before** the generic rows in the table that follows, so a hybrid or Flutter project receives its specific, actionable message rather than the generic "React/Vue/Svelte only" stop (which would otherwise pre-empt it for a hybrid app that has no React/Vue/Svelte dependency).

When stopping, prefix the message with `Compatibility check — found a blocker:` so the user sees a clear framing rather than an abrupt error.

| Condition | Stop message |
|---|---|
| `language === "js-ts"` AND `react === false` AND `vue === false` AND `svelte === false` | "i18n-guide currently supports React-based, Vue-based, and Svelte-based projects only. This project uses {framework}. No supported library available." |
| `framework === "cra"` | "Create React App is no longer supported by this skill. Migrate to Vite or Next.js, then re-run." |
| `existing.library` is one of `react-intl`, `i18next`, `react-i18next`, `next-translate`, `typesafe-i18n`, `i18next-vue`, `@tolgee/vue`, `fluent-vue` | "This project already uses {library}. Migrating between i18n libraries is out of scope for this skill. Either continue with {library} (use its native tooling), or remove it first and re-run." |
| `framework === "next"` AND `router === "pages"` AND user wants Lingui | (Surface only after library choice in 1.5) "Lingui setup does not currently cover the Next.js Pages Router. Use next-intl on Pages Router, or migrate to App Router." |
| `@remix-run/react` in deps with major version `< 2` (i.e. Remix v1) | "Remix v1 is no longer supported by this skill. Upgrade to Remix v2 (`@remix-run/*` ≥ 2) or migrate to React Router v7 framework mode, then re-run." |
| `framework === "remix"` AND (`@remix-run/dev` major.minor `< 2.7` OR `vite` not in devDeps) | "This Remix v2 project uses the classic compiler (pre-Vite). Lingui requires the Vite-based build. Upgrade to `@remix-run/dev` ≥ 2.7 and follow Remix's classic-compiler → Vite migration, then re-run." |
| `framework === "sveltekit"` AND `@sveltejs/kit` major.minor `< 2.3` | "Paraglide's URL-based locale routing relies on SvelteKit's `reroute` hook, added in `@sveltejs/kit` 2.3.0 — your project is on an older version. Upgrade to SvelteKit ≥ 2.3, then re-run. (If you must stay below 2.3, a different, deprecated routing approach is required that this skill does not cover.)" |
| `svelte === true` AND `framework !== "sveltekit"` | "This skill currently supports Svelte only through SvelteKit (the Paraglide setup relies on SvelteKit's hooks and routing). A plain Vite + Svelte SPA is not yet supported. Adopt SvelteKit, or wait for SPA support, then re-run." |
| `language === "js-ts"` AND custom build pipeline (no `vite.config`, `next.config`, `nuxt.config`, `quasar.config`, or `react-scripts`) | "This project uses an unsupported build pipeline. Lingui requires SWC or Babel; next-intl requires Next.js; vue-i18n requires Vite, Nuxt, or Quasar." |

**Ruby / Rails compatibility rules** (apply only when `language === "ruby"`; the two JS rows above — React/Vue/Svelte and custom-build-pipeline — are guarded by `language === "js-ts"`, so they apply only to JS projects and a Rails, Android, or Swift/iOS project does not falsely STOP there):

| Condition | Action |
|---|---|
| `language === "ruby"` AND `framework !== "rails"` | **STOP.** "i18n-guide currently supports Ruby only through Rails (built-in `I18n` API + locale-rooted YAML). Non-Rails Ruby (Sinatra, Hanami, plain `i18n` gem) is not supported. Point me at a Rails app, or use the `i18n` gem docs directly." |
| `gettext_i18n_rails` OR `fast_gettext` in `Gemfile`/`Gemfile.lock` | **STOP.** "This project uses `gettext_i18n_rails` — the catalog format is PO, not YAML. The v1 Rails path supports locale-rooted YAML only; the PO/gettext overlay for Rails is not yet supported. Proceed manually, or wait for the PO overlay." |

**Name-collision warning (Ruby, non-blocking):** if `globalize`, `mobility`, or `traco` was detected (the model/DB-content translation gems — unrelated to Globalize.now), surface but do **not** stop: "I found `{gem}` in your Gemfile. It translates DB/model content (per-row data), not UI strings, and is unrelated to Globalize.now. The i18n setup won't touch it, and its content won't be in the connected catalog. Proceeding with UI-string i18n." Never conflate the `globalize` gem with the Globalize.now platform.

**Soft EOL warning (Ruby, non-blocking — NO emission gating):** if `language === "ruby"` AND the detected Rails `version` is `7.1` or earlier: "This project is on Rails {version}, which reached end-of-life. The Rails path supports 6.1 → 8.1 at the same code level (no version-gated i18n branches) — the emitted code is identical — but running EOL Rails in production isn't recommended. Consider upgrading. Proceeding." The default target is Rails 8.1; support runs down to 6.1. There is **no** version-gated emission for Rails (clean contrast with the JS framework version branches above).

**Android compatibility rules.** The first three rows fire on **signals** (deps / files), independent of the detected `language` — the §1.1 rule already routes hybrid and Flutter projects away from `language: "android"`, so these stops exist to give the user a clear, specific reason rather than a generic "no manifest entry matches":

| Condition | Action |
|---|---|
| `react-native` in `package.json` AND an `android/` folder present | **STOP.** "This is a React Native app. React Native localizes through JS i18n libraries (i18next, react-intl, Lingui), not native Android string resources. Native `android-strings` support targets native Kotlin/Java apps. Use the JS path, or wait for RN support." |
| `@capacitor/core`, `cordova`, or any `@ionic/*` in `package.json` AND an `android/` folder present | **STOP.** "This looks like a Capacitor/Cordova/Ionic hybrid app — its UI is localized in the web layer, not in native `strings.xml`. Run i18n-guide against the web UI (the JS path)." |
| `pubspec.yaml` present (Flutter) | **STOP.** "This is a Flutter app. Flutter localizes via `.arb` files and `gen_l10n`, not native Android `strings.xml`. Flutter support isn't available yet." |
| `language === "android"` AND a Kotlin/Compose **Multiplatform** layout (resources under `commonMain` / a `compose.resources` setup, no `app/src/main/res`) | **Warn (non-blocking).** "This looks like a Kotlin/Compose Multiplatform project, which uses a different resource mechanism (`compose.resources`) than standard Android `res/values/strings.xml`. v1 covers standard Android only — I'll proceed against the Android resource dirs I can find, but multiplatform resources won't be handled." |

**No EOL / version warning for Android** (clean contrast with the JS framework version branches and the Rails soft-EOL note): string resources are stable across all API levels, so there is no version to warn about and no version-gated emission. The only API-gated features — the `b+` qualifier dir form (API 24+) and per-app language (API 33+) — are optional add-ons, never required.

These are not hard-stops, but note for the Paraglide path:

- If `existing.library === "paraglide"` AND `existing.configured === true`, do **not** run a from-scratch setup — route Phase 2 to the collapse / already-configured case (see "Phase 2 collapse-case").
- If `@inlang/paraglide-sveltekit` (the Paraglide 1.x SvelteKit adapter) is in deps, this is a **migration**, not a fresh setup: Paraglide 2.x replaced the dedicated adapter with the framework-agnostic `reroute` + `handle` model. Flag it to the user before proceeding; the setup reference covers the migration steps.

**Swift / Apple (iOS) compatibility rules** (apply only when `language === "swift"`; the two flipped JS rows above are exempted for Swift via their `language === "js-ts"` guard):

| Condition | Action |
|---|---|
| `language === "swift"` AND a `.xcstrings` cannot be created and none exists (legacy `.strings`-only on a pre-Xcode-15 toolchain with no migration path) | **Note (non-blocking where possible).** Offer the **Edit ▸ Convert to String Catalog** migration; only STOP if there is genuinely no path to a catalog. |
| `language === "swift"` AND a non-iOS Apple target out of v1 scope (macOS/watchOS/tvOS) with no iOS app and no Swift package | **STOP (scope).** "v1 of the iOS String Catalog path targets iOS apps and Swift packages. {platform} is out of scope — the shared catalog mechanics may still apply manually." |

### 1.3 Resolve supported stacks from manifest

Read `manifest.json`. Filter `stacks[]` entries whose `match` predicate is satisfied by `detection`. The result is the set of `(library, variant)` options the user can choose from in 1.5.

**Matcher predicate (load-bearing).** A `match` object mixes two kinds of keys, handled differently — every `match` key names a same-named `detection` field **except `library`**, which has no detection counterpart:

- **Structural keys** — `framework`, `router`, `compiler`, and any other detection-state key an entry declares — must each equal the same-named field in `detection`. (Example: `nextjs-app-router-*` entries declare `framework: "next"`, `router: "app"`.)
- **`language`** is structural but special-cased:
  - If `match.language` is **present**, it must equal `detection.language` (so `rails-yaml`, which declares `match.language: "ruby"`, matches **only** when `detection.language === "ruby"`).
  - If `match.language` is **absent**, treat it as `"js-ts"` — i.e. the entry matches only when `detection.language === "js-ts"`. All existing JS entries omit `language`, so they keep matching exactly as before and are inert for Ruby projects.
- **`library`** is **not** a structural predicate. It is the **identifier of the variant/option** the entry offers — surfaced as a choice in §1.5. It is **never** matched against `detection.existing.library` (there is no top-level `detection.library`). `detection.existing.library` describes prior setup state and is used only by the §1.2 stops and the §1.6 / Phase 2 already-configured handling — it never filters the candidate set. This is why two entries can share identical structural keys and differ only in `library` (e.g. `nextjs-app-router-lingui` and `nextjs-app-router-next-intl`, both `framework: "next", router: "app"`): a fresh Next app-router project (`existing.library: "none"`) matches **both**, and the {lingui, next-intl} pair is surfaced as the §1.5 choice.
- **`platform`, `buildSystem`, `uiFramework`** are ordinary **structural keys** (each must equal the same-named `detection` field) that discriminate *among* the iOS variants — NOT a new special-cased matcher axis (only `language`'s absent⇒`js-ts` default is special). A `match.language: "swift"` matches only `detection.language === "swift"`, keeping the Swift, JS, and Ruby entry sets disjoint. No matcher-logic change beyond treating these three as plain structural keys.

This keeps the Ruby and JS entry sets disjoint by `language`: a Ruby detection can match only `rails-yaml`; a `js-ts` detection can match only the JS entries (never `rails-yaml`); a `swift` detection can match only the iOS variants.

**Hand-trace (iOS).** A `{swift, xcode, ios, swiftui}` detection selects **only** `ios-swiftui-string-catalog`: `ios-uikit-string-catalog` fails on `uiFramework` (uikit≠swiftui), `ios-spm-string-catalog` fails on `buildSystem` (spm≠xcode), every JS entry fails on absent⇒`js-ts` (≠swift), `rails-yaml` fails on `language` (ruby≠swift), and `android-strings` fails on `language` (android≠swift). A `{swift, spm}` detection (buildSystem `spm`, no app entry point) selects **only** `ios-spm-string-catalog`: the two app variants fail on `buildSystem` (xcode≠spm).

**Net effect.** A fresh Next app-router project yields **{lingui, next-intl}** candidates → §1.5 offers the choice. A fresh Rails project (`existing.library: "none"`) yields exactly **{rails-yaml}** → §1.5 confirms "Rails built-in I18n (YAML)". A fresh native-Android project yields exactly **{android-strings}** (its `match.language: "android"` requires `detection.language === "android"`) → §1.5 confirms "Android string resources (XML)". A fresh iOS project yields exactly **one** iOS variant → §1.5 confirms it (no multi-option prompt). A fresh `js-ts` detection never yields `rails-yaml`, `android-strings`, or an iOS variant (their `match.language` is `ruby`/`android`/`swift`, which fail).

If the filtered list is empty, surface a STOP with: "Your stack is supported in principle but no manifest entry currently matches. Detected: {summary}. File an issue or pick a different setup."

### 1.4 Branch recommendation

If `git.isRepo === true` AND `git.branch` is one of `main`, `master`, `develop`:

> You're on `{branch}`. Setup will modify several files, so I'd recommend a dedicated branch — easier to review or revert later:
> ```
> git checkout -b chore/i18n-setup
> ```
> Want me to create this branch when Phase 2 starts, stay on `{branch}`, or use a different name? (No git commands run yet — just answering the question.)

Record the answer in `decisions`.

### 1.5 Library choice

> **User-facing message** (before showing options):
> "Picking the i18n library. Based on **{framework}** + **{router}**, my recommendation is **{recommended-library}** — {one-line rationale from the table below}. You can override if you have a strong preference."

Show the user the list of supported variants from 1.3, with the recommendation marked. Recommendation rules (apply first match):

| Detection | Recommendation | Rationale |
|---|---|---|
| `framework === "next"` | **next-intl** | Purpose-built for Next.js; first-class App Router (RSC + middleware) and Pages Router support. Uses ICU MessageFormat. No compile step. |
| `framework === "next"` AND user wants compile-time extraction | **Lingui** (alternative) | Compile-time macros, zero-runtime-overhead translations. |
| `framework === "nuxt"` | **vue-i18n via @nuxtjs/i18n** | The Nuxt module wraps vue-i18n with SSR-aware routing, lazy-loaded locale catalogs, and locale meta via `useLocaleHead`. The canonical Nuxt choice. |
| `framework === "quasar"` OR (`vue === true` AND `framework === "vite"`) | **vue-i18n** | The official Intlify library and de-facto standard across Vue 3 projects. Composition API + ICU via custom `messageCompiler`. |
| `framework === "remix"` | **Lingui** | Remix v2 (≥ 2.7, Vite-based) ships with no first-party i18n primitive. Lingui plugs in via `@lingui/vite-plugin`, gives compile-time extraction, and aligns with Remix's per-route `loader` pattern (dynamic catalog import per route). |
| `framework === "react-router-framework"` | **Lingui** | React Router v7 framework mode is the same shape: Vite + `loader` + root `<html>` rendering. Lingui's per-route catalogs map cleanly onto the routes config. |
| `framework === "sveltekit"` | **Paraglide JS** | First-party Svelte CLI add-on (`sv add paraglide`); compiler-based with tree-shaken messages; SSR-correct via AsyncLocalStorage; integrates through `reroute` + `handle` hooks. |
| `framework === "rails"` | **Rails built-in I18n (YAML)** | Rails ships a full `I18n` stack (`t`/`l` helpers, locale-rooted YAML at `config/locales/`, `%{name}` interpolation, CLDR plurals via `rails-i18n`); no third-party UI-string library needed. |
| `framework === "android"` | **Android string resources (XML)** | Android ships localization built in — `res/values/strings.xml` + `values-<qualifier>` overlays, `getString`/`stringResource` accessors, positional `%1$s` args, native `<plurals>` (CLDR categories). No third-party library to install. |
| `language === "swift"` | **Apple String Catalog (built-in)** | Apple ships a full localization stack (String Catalogs, `String(localized:)`/`Text` literals, `.stringsdict`/`variations` plurals via CLDR) built into the SDK — no third-party library or install needed. |
| anything else (vite + react, tanstack-start, etc.) | **Lingui** | The only library with reference support for non-Next.js React stacks today. |

Use AskUserQuestion if multiple variants apply. If only one variant matches, surface the choice as confirmation rather than a multi-option prompt. For `language === "swift"` exactly one iOS variant matches (see §1.3 hand-trace), so the choice is surfaced as a **confirmation** of the Apple String Catalog, not a multi-option prompt. The iOS variants are `supportLevel: "experimental"` — when confirming, tell the user so: e.g. "Setting up the Apple String Catalog path (built into the SDK — no install). Heads up: iOS/`.xcstrings` support is **experimental** — the live Globalize.now round-trip for this format hasn't been verified end-to-end yet, so double-check the Phase-4 connection."

### 1.6 Journey scope

> **User-facing message** (before asking):
> "Which phases do you want to run? I've pre-checked the ones that make sense given what's already in the project."

Ask which phases to run. Defaults derived from `existing`:

- If `existing.configured === false` → setup is suggested
- If `existing.stringsWrapped !== "yes"` AND `candidateFiles.length > 0` → convert is suggested
- Globalize-now is opt-in only; default unchecked

Use AskUserQuestion with three multi-select options (setup / convert / connect translation platform) and the inferred defaults pre-checked.

### 1.7 Setup choices

> **User-facing message** (before asking):
> "A few setup details. Locales drive which catalog folders we scaffold and which CLI flags we pass; the routing strategy determines how locale shows up in URLs; setup mode is just how chatty I should be while running Phase 2."

If `setup` is in scope, collect:

- **Setup mode** — guided (per-step explanations, consent gates on file modifications) vs. unguided (run end-to-end, summarize at end)
- **Source locale** — default to `localeSignals` first existing or `en`
- **Target locales** — multi-input. Suggest from `localeSignals.existingLocaleDirs` and README hints
- **Routing strategy** — for JS/TS stacks, only if file-based routing is detected; ask: prefix-based (`/en/...`) or domain-based or none. **For Rails** (`language === "ruby"`): Rails detection sets `router: "none"`, so the file-based gate would skip this question — ask it explicitly here instead. URL-locale routing embeds the locale in the path (`scope "/:locale"`, e.g. `/en/books`) and edits `config/routes.rb` + adds `ApplicationController#default_url_options`. Ask: URL-locale routing (prefix `/:locale`) or none. Unguided default = **included** (the Rails Guide's recommended locale-persistence approach). Record under `decisions.setup` so `rails.setup.md` Step 5 reads the decision instead of silently applying its own default.
- **Catalog format** *(Paraglide only)* — defaults to **PO (gettext)** and **do not ask** for a fresh setup. PO is the default because a `.po` catalog carries `#.` translator comments that flow to the Globalize platform (the single biggest quality lever for AI translation), which the ICU-JSON model cannot. Set `decisions.setup.catalogFormat = "po"` silently. The **only** time to surface a choice is an **already-configured** Paraglide project on ICU-JSON (existing `messages/*.json` + `@inlang/plugin-icu1`): ask whether to **convert to PO** (recommended — a lossless migration, since both formats use ICU bodies; see "Phase 2 collapse-case" → migration) or **keep ICU-JSON** (`catalogFormat = "json"`). Omit entirely for non-Paraglide libraries.

Record under `decisions.setup`.

### 1.8 Convert choices

> **User-facing message** (before asking):
> "What's this app about? One-sentence answer is fine. I'll pass it to the wrapping workers in Phase 3 so the translator comments they add have the right context (e.g., '[Cart]', '[Onboarding tooltip]')."

If `convert` is in scope, ask the user to confirm the **app domain**. Infer from `package.json` description, README, route names, or component names. Default suggestion + freeform override.

The domain string flows into wrap-subagent prompts so they write better translator comments. For Paraglide on the default **PO** catalog format, `.po` entries carry `#.` translator comments, so the domain informs comments **and** key naming, exactly as for Lingui/next-intl. For Paraglide on the **ICU-JSON** catalog format (`decisions.setup.catalogFormat === "json"`, which has no translator-comment field), the app domain instead informs *key naming* only — it helps the wrap subagent choose descriptive, context-encoding keys (e.g. `cart_remove_button`), the only disambiguation lever available there.

### 1.9 Globalize-now choices

> **User-facing message** (before asking):
> "Translation-platform setup uses Globalize.now. I just need a project name and which git provider hosts your repo — both have sensible defaults from your `package.json` and git remote."

If `connect translation platform` is in scope, collect:

- **Project name** — default = repo name (from `package.json`).
- **Repo provider** — auto-detect from `git.remote` (github.com → GitHub, gitlab.com → GitLab); confirm.

### 1.10 Optional steps

> **User-facing message** (before asking):
> "Optional add-ons. None of these are required, but the passive coding rules (an `@import` line in your `CLAUDE.md`) are recommended — they keep me from re-introducing hardcoded strings on future edits."

Multi-select for setup-time optionals: ESLint plugin, CI/CD integration (extract+compile in build), test setup wrapper, install passive coding rules (`@import` line in target `CLAUDE.md`).

### 1.11 Generate `plan.md` + `manifest-snapshot.json` + `decisions.md`

> **User-facing message** (before writing):
> "Got everything I need. Writing your plan to `.globalize/plan.md` and your choices to `.globalize/decisions.md` so this run is auditable and resumable."

Write the three artifacts to `.globalize/`. See "Plan and decisions formats" below for shape.

Copy the chosen manifest entry verbatim to `.globalize/manifest-snapshot.json` so subsequent runs and subagents read a stable snapshot, not the live manifest.

### 1.12 Render plan + final go

Show `plan.md` to the user as a checklist. Ask:

> "Here's the plan. Ready to execute? (**yes** / **cancel** / **edit**)
> Once you say yes, I won't pause for more questions unless a subagent gets stuck or finishes a phase."

Cancel writes nothing further. Edit re-enters the relevant 1.x step. Yes proceeds to Phase 2.

---

## Phase 2 — Setup

Single setup subagent. Orchestrator installs packages on the main thread first, then pre-creates the progress file and dispatches the subagent in the background.

> **User-facing message** (at Phase 2 start):
> "Starting Phase 2 — setup. {for JS/TS: `First I'll install the i18n packages on my main thread so your lockfile stays in sync, then I'll dispatch one background worker that wires your build config, sets up the provider, scaffolds catalog folders for your locales, and verifies with a typecheck and build.`; for Rails: `I'll dispatch one background worker that installs the i18n gems with Bundler, wires `config/application.rb`, scaffolds `config/locales/` for your locales, sets up the locale switcher in `ApplicationController`, and verifies by booting the app and parsing the source catalog.`; for Android: `Nothing to install — string resources are built into the platform. I'll dispatch one background worker that creates `res/values/strings.xml` as your source catalog, scaffolds `res/values-<qualifier>/strings.xml` for your target locales, optionally wires per-app language selection, and verifies by parsing the catalogs (and running Lint if the Android SDK is available).`; for Swift: `No packages to install — Apple's localization stack ships with the SDK. I'll dispatch one background worker that creates the String Catalog (`Localizable.xcstrings`), enables build-time string extraction (`SWIFT_EMIT_LOC_STRINGS`), registers your locales, and verifies the catalog is valid.`} I'll show progress as a checklist that updates every ~30 seconds. If the worker hits something it can't decide on its own, it'll pause and ask."

### 2.0 Install packages (main thread)

Read `manifest-snapshot.json`'s `packages.runtime` and `packages.dev`. Run the install commands in the foreground using the package manager from `detection.json`. Stream output to the user.

> **Lingui (v6+) requires Node ≥ 22.19 or ≥ 24** — it ships ESM-only and fails to load on older Node. If the resolved stack installs `@lingui/*`, check the project's Node version (`node -v`, plus any `.nvmrc` / `engines` field) before installing. If it's older, tell the user and pause rather than installing a runtime they can't run.

| Package manager | Runtime command | Dev command |
|---|---|---|
| `npm` | `npm install <pkgs>` | `npm install -D <pkgs>` |
| `yarn` | `yarn add <pkgs>` | `yarn add -D <pkgs>` |
| `pnpm` | `pnpm add <pkgs>` | `pnpm add -D <pkgs>` |
| `bun` | `bun add <pkgs>` | `bun add -D <pkgs>` |

**Wrap each `<pkgs>` entry in single quotes** when constructing the shell command — the manifest pins use `^` (e.g. `next-intl@^4`), and zsh interprets unquoted `^` as a glob negation operator under `EXTENDED_GLOB` (common on macOS via oh-my-zsh). Emit `npm install 'next-intl@^4'` rather than `npm install next-intl@^4`. The single quotes are inert under bash/dash and prevent zsh expansion.

Skip the runtime or dev command if its package list is empty. For `packageManager === "bundler"` (Rails), both package lists are empty by design — gem installation is delegated to the setup subagent via `rails.setup.md` Step 2 (`bundle install`); the §2.0 install step is intentionally a no-op for Rails, not an error. For `packageManager === "gradle"` (Android), both lists are also empty by design — string resources are platform-built-in, so there is **nothing to install**; the §2.0 step is a no-op for Android too. For `language === "swift"` both package lists are likewise empty by design (native localization ships with the SDK — there is no third-party package to install), so §2.0 is a no-op for Swift too, not an error. If the install command fails (network error, registry rejection, lockfile conflict), stop the run with the error — do not advance to 2.1.

Running on the main thread keeps the install outside the subagent sandbox, so the user's lockfile stays in sync. The setup subagent in 2.2 will not re-install these packages.

> **User-facing message** (before running):
> "Installing the i18n packages on my main thread first so your lockfile stays in sync — I'll run `{install command}` and stream the output."

### 2.1 Pre-create progress file

```json
{
  "subagentId": "setup", "phase": 2, "status": "pending",
  "plan": [...steps from plan.md...],
  "completed": [], "current": null,
  "startedAt": null, "updatedAt": "<now>"
}
```

### 2.2 Dispatch setup subagent (background)

Subagent prompt skeleton:

> You are executing Phase 2 (Setup) of an i18n journey. Read `.globalize/decisions.md`, `.globalize/detection.json`, `.globalize/plan.md`, and `.globalize/manifest-snapshot.json` for full context.
>
> Your plan steps are listed in `.globalize/progress/setup.json` under `plan`. Execute them in order.
>
> Read these reference files for variant-specific instructions:
> - {paths from manifest-snapshot.references.setup, joined}
> - Coding rules to install (if applicable): {manifest-snapshot.references.code joined}
>
> **Packages already installed.** The orchestrator ran the package install on the main thread (Phase 2.0) for the manifest's `packages.runtime` and `packages.dev` before dispatching you. Do **not** run `npm install` / `yarn add` / `pnpm add` / `bun add` for those packages. If a reference's setup instructions list an install command for them, treat it as already done and move on. Only flag an extra install if the reference explicitly calls for a package that is **not** in the manifest's `packages` (e.g., a pinned remediation version after a build failure or an opt-in extra) — in that case, write `status: "needs_decision"` with a `needsDecision: { step: "extra_install", question: "An extra package install is needed: <command>. Run it on the main thread?", options: ["yes", "skip"] }` and exit so the orchestrator runs it on the main thread.
>
> **Progress reporting:** After each step transition, atomically update `.globalize/progress/setup.json` (write `<file>.tmp` then `mv`). Set `status: "running"` on first update; populate `completed`, `current`, `currentDetail`, `filesCreated`, `filesModified`, `updatedAt`.
>
> **Ambiguity protocol:** If you hit a case the references don't cover (e.g., two layout files, custom config shape), do NOT improvise. Write `status: "needs_decision"` with a `needsDecision: { step, question, options }` object and exit. The orchestrator will ask the user and re-dispatch you.
>
> **Verification:** After all steps, run the project's typecheck (`tsc --noEmit` if TypeScript) and build command. Capture pass/fail in `result.verificationResult`. Set `status: "succeeded"` or `"failed"` accordingly.
>
> **Rails (`language === "ruby"` / `framework === "rails"`):** Rails has no typecheck and no build step, so instead run a **boot/smoke** check that proves the app boots and the i18n stack loads. Run `bin/rails runner 'I18n.t("site.title", default: "ok"); puts "i18n ok"'` (or `bin/rails about` as a lighter boot probe) and confirm it exits 0 and prints `i18n ok`. Then confirm the source-locale catalog parses: load `config/locales/{default_locale}.yml` and verify it is valid YAML (a malformed catalog is a setup failure). Map the result into the existing `verificationResult` shape: set the JS-only `typecheck` and `build` fields to `null` (not applicable to Rails), and record the boot/smoke pass/fail and YAML-parse pass/fail. Set `status: "succeeded"` only if both the boot/smoke and the catalog parse pass; otherwise `"failed"`.
>
> **Android (`language === "android"` / `framework === "android"`):** Android has no typecheck and the full Gradle build needs the Android SDK, so verification has two tiers and **degrades gracefully**: (1) **Always** parse every `res/values/strings.xml` and `res/values-*/strings.xml` for XML well-formedness (a malformed resource file is a setup failure) and confirm a target dir exists for each configured locale. (2) **If the Android SDK + Gradle are available** (`./gradlew` present and `ANDROID_HOME`/`ANDROID_SDK_ROOT` set, or `local.properties` has `sdk.dir`), run `./gradlew lint` and capture the `MissingTranslation` / `ExtraTranslation` results; if the SDK is absent, **skip the Gradle step, do not fail**, and record that lint was skipped for lack of a toolchain. Map into `verificationResult`: set the JS-only `typecheck` and `build` fields to `null`; record the XML-parse pass/fail and the lint result (or `"skipped: no Android SDK"`). Set `status: "succeeded"` if the XML parses and covers every locale (and lint is clean when it ran); otherwise `"failed"`.
>
> **Swift / Apple (`language === "swift"`):** Swift/Apple has no `tsc` and no JS build step, so instead run a **catalog-integrity check** using the headless `xcstringstool` three-step form (NOT a pipe):
> ```
> DIR=$(mktemp -d)
> xcrun xcstringstool extract <sources> --SwiftUI --modern-localizable-strings [--legacy-localizable-strings] --output-directory "$DIR"
> xcrun xcstringstool sync <catalog> --stringsdata "$DIR"/*.stringsdata
> xcrun xcstringstool print <catalog>
> ```
> This confirms the catalog is valid JSON and covers the used keys. Map into the existing `verificationResult` shape: set the JS-only `typecheck` and `build` fields to `null` (not applicable to Swift), and record the catalog-integrity pass/fail. **Graceful degradation:** if `xcrun xcstringstool` is absent (no Xcode toolchain — e.g. a non-Apple CI machine), author + static-JSON-validate the catalog instead (parse the `.xcstrings` as JSON; check it has `sourceLanguage`, `strings`, and `version`) and mark build-verify **deferred** (NOT failed) — the build-time `SWIFT_EMIT_LOC_STRINGS = YES` extraction (or a later `xcstringstool` run on macOS) will populate it. Set `status: "succeeded"` if the catalog-integrity check passes (or static-JSON-validate passes with build-verify deferred); `"failed"` only on a genuine integrity failure.

### 2.3 Poll progress

While `progress/setup.json` is in `running` state, wake every 30–60 seconds, read the file, update the user-visible todo list (one todo per `plan` step), and surface `currentDetail` as a transient status hint.

### 2.4 On completion

- `succeeded` → archive `progress/setup.json` to `progress/archive/<timestamp>/setup.json`, render summary (files created, files modified, verification result), advance to Phase 3. User-facing wrap-up:
  > "Setup verified — {for JS/TS: `typecheck and build are clean`; for Rails: `the app boots and the i18n config loads`; for Android: `the string resources parse and cover every locale (Lint clean)` or, when the SDK was absent, `the string resources parse and cover every locale (Lint skipped — no Android SDK)`; for Swift: `the String Catalog is valid and registered`}. Files created: {N}, files modified: {M}. Moving on to Phase 3 — wrapping your hardcoded strings."
- `failed` → archive, render error, ask user how to proceed (retry, edit plan, abort). User-facing wrap-up:
  > "Setup hit an error during `{step}`: {one-line error summary}. Want me to retry, edit the plan, or stop here?"
- `needs_decision` → surface the question to the user, capture answer, append to `decisions.md`, re-dispatch the same subagent (it reads existing `progress/setup.json` and resumes from `completed`). User-facing framing:
  > "The setup worker paused — it needs you to decide on `{question}`. Once you answer I'll send it back to finish from where it left off."

### Phase 2 collapse-case

If `existing.configured === true`, `plan.md` reduces Phase 2 to a verify-and-complete plan (verify what exists, add only what's missing — no from-scratch `create_config`): `verify_config`, `verify_provider`, `add_missing_locale_dirs`, a library-appropriate catalog step, and `build_verification`. The catalog step follows the variant's catalog workflow (see its `references.setup`): a **compile-time** library (Lingui) re-runs `extract_compile` to regenerate runtime catalogs from source; a **runtime-catalog** library (next-intl, vue-i18n; **Rails** — loads `config/locales/*.yml` directly at runtime; and **Android** — the platform loads `res/values*/strings.xml` at runtime) loads message files directly with no compile step, so the step is `verify_catalogs` — confirm the existing catalog files parse and cover every locale (for Rails, also run `bundle exec i18n-tasks missing -t used` to confirm every used key has a source-locale entry — not `health`, which false-fails on incomplete target stubs; for Android, confirm every `res/values-*/strings.xml` is well-formed XML and covers the source keys, running `./gradlew lint` for `MissingTranslation` when the SDK is available); a **compile-from-catalog** library (Paraglide) re-runs `paraglide_compile` (`npx '@inlang/paraglide-js@^2' compile --project ./project.inlang --outdir ./src/lib/paraglide`) to regenerate `src/lib/paraglide/` from the hand-authored `messages/{locale}.{json,po}` catalogs. Same dispatch pattern.

**Paraglide ICU-JSON → PO migration collapse-case.** If `existing.library === "paraglide"`, `existing.configured === true`, the project currently has `messages/*.json` (ICU-JSON / `@inlang/plugin-icu1`), and the user chose `decisions.setup.catalogFormat === "po"`, Phase 2 is a **format migration**, not a from-scratch setup. The plan steps are: `migrate_settings` (swap the icu1 module + key for the PO module + `plugin.globalizeNow.po` with `"messageFormat": "icu"`), `migrate_catalogs` (rewrite each `messages/{locale}.json` → `messages/{locale}.po` — lossless: `"key": "ICU body"` → `msgid "key"` / `msgstr "ICU body"`, carrying interpolation/plural/select verbatim; add the `msgid ""` header block; delete the old `.json`), `paraglide_compile`, and `build_verification`. The migration is driven by the **Migration: existing ICU-JSON → PO** section of `references/languages/js-ts/frameworks/sveltekit/paraglide.setup.md` (the default PO setup file). The per-file `migrate_catalogs` rewrite is independent across locales, so dispatch it as parallel background subagents (one per `messages/{locale}.json`). After migrating, run the plural-render check from that file's **Verify** step — a missing `"messageFormat": "icu"` or a botched ICU escape fails **silently** (renders raw ICU), so the build passing is not sufficient.

---

## Phase 3 — Convert

Multiple wrap subagents in parallel, then one verify subagent.

> **User-facing message** (at Phase 3 start):
> "Starting Phase 3 — converting hardcoded strings. I'm splitting **{file count}** files across **{N}** workers that run in parallel — each one walks its assigned files, wraps user-visible strings with the right macro, and adds short translator comments where context isn't obvious. After they all finish, a final verify worker {for JS/TS: `runs extract + compile + build to make sure everything still type-checks and the catalog is clean`; for Rails: `checks that every wrapped key has a matching source-locale entry, tidies any leftover scaffold keys, and runs your test suite if you have one`; for Android: `checks every `strings.xml` is well-formed and that target locales cover the source keys (running Lint for `MissingTranslation` if the Android SDK is available)`; for Swift: `runs a catalog-integrity check — confirming the String Catalog is valid JSON and covers the keys your code uses (no extract/compile step; the build populates the catalog)`}."

### 3.1 Pre-create progress files

For each `wrap-N` subagent declared in `plan.md`, write `progress/wrap-N.json` with `status: "pending"` and the planned per-file step list. Write `progress/verify.json` with `status: "pending"` and verify plan.

### 3.2 Dispatch wrap subagents in parallel

Send all wrap subagents in **a single Agent tool message** so they launch in parallel. Each wrap subagent prompt includes:

> You are wrapping hardcoded UI strings with the project's i18n macros. Read `.globalize/decisions.md` and `.globalize/detection.json` for context. App domain: {decisions.appDomain}.
>
> Your assigned files (process in order; layout/shell first, then shared, then pages, then utilities):
> {numbered list from plan.md for this partition}
>
> Read these reference files for macro guidance: {paths from manifest-snapshot.references.convert}.
>
> For each file: identify translatable strings, wrap with the correct macro, add translator comments inline per the rules in the reference. (Paraglide is key-authored with no macro — instead of wrapping, author a descriptive, context-encoding key plus its catalog entry and replace the string with the `m.key()` call. **On the default PO catalog format**, author the entry into `messages/{baseLocale}.po` as `#.` comment + `msgid "key"` + `msgstr "ICU body"` — `.po` carries `#.` comments, so DO add them, following `references/languages/js-ts/frameworks/sveltekit/paraglide.convert.md`. **On the ICU-JSON catalog format** (`decisions.setup.catalogFormat === "json"`), the inlang/ICU JSON model has no translator-comment field, so do NOT add comments — descriptive key naming is the only disambiguation lever; follow `references/languages/js-ts/libraries/paraglide/json-format.convert.md` instead. **Android is also key-authored, with no macro and no automated extractor** — author a `<string name="key">value</string>` (or `<plurals>`) entry into `res/values/strings.xml`, then replace the literal with `getString(R.string.key)` / `resources.getQuantityString(R.plurals.key, count, count)` in Kotlin/Java, `stringResource(R.string.key)` / `pluralStringResource(...)` in Compose, or `@string/key` in XML layouts. Android XML **supports `<!-- -->` comments**, so DO add a short translator comment above non-obvious keys, plus `<xliff:g>` for do-not-translate runs; follow `references/languages/android/native/android-strings.convert.md`.) Update `.globalize/progress/wrap-N.json` after each file (atomic write). Do NOT run `extract` or `compile` — that runs once after all wrap subagents complete (Android has no extract/compile — the verify worker only validates).
>
> Ambiguity protocol and progress schema as in Phase 2.

### 3.3 Poll all wrap subagents

Wake every 30–60s, read all `wrap-N.json` files, update the user-visible todo list (per-file todos under each subagent group). Surface aggregated progress: "wrap-1: 3/8 files, wrap-2: 2/5 files, wrap-3: 4/4 ✓".

### 3.4 Wait for all wrap subagents to terminate

If any returns `needs_decision`, pause polling, surface to user, re-dispatch as in Phase 2.

If any returns `failed`, surface error. The verify subagent should still run on whatever files were successfully wrapped — don't block extraction on a single partition failure unless catastrophic.

### 3.5 Dispatch verify subagent (background)

> You are verifying the convert phase. Read `.globalize/decisions.md` for catalog format and locales. Read manifest snapshot for library.
>
> Plan steps depend on the library's catalog model:
> - **Compile-time extraction (Lingui)** and **runtime-catalog (next-intl/vue-i18n)**: extract_clean, compile, build_check, comment_review_pass.
> - **Compile-from-catalog (Paraglide)**: paraglide_compile, build_check. There is **no extract step** (keys are authored by hand, not extracted). On the **default PO** format `.po` carries `#.` comments, so a comment_review_pass over the base `.po` **does** apply, plus an ICU plural-render sanity check (see below). On the **ICU-JSON** format (`catalogFormat === "json"`) there is **no comment_review_pass** (the inlang/ICU JSON model has no translator-comment field).
> - **Runtime-catalog, no compile (Rails)**: ensure_i18n_tasks, source_completeness_check, unused_cleanup, optional test_suite. There is **no extract step** and **no compile step** (Rails loads `config/locales/*.yml` directly at runtime). The verify gate is **base-locale completeness**: confirm the source-locale YAML parses and that every key used in code has a base-locale entry (`i18n-tasks missing -t used` is empty). Target-locale gaps are expected (stubs deferred to the connect phase) and never fail the gate; orphaned keys are cleaned, not gated. There is **no normalize-drift gate** — the catalog is left in its authored reading order (canonical ordering is a CI / connect-time concern, see `setup.add-ons.md` Add-on 3).
> - **Runtime-catalog, no compile (Android)**: xml_validity_check, locale_coverage_check, optional lint_check. There is **no extract step** and **no compile step** (the platform loads `res/values*/strings.xml` at runtime). The verify gate is catalog integrity: confirm every `strings.xml` is well-formed XML and that each target `res/values-*/strings.xml` covers the source keys; **if the Android SDK is available**, run `./gradlew lint` and surface `MissingTranslation`/`ExtraTranslation`, otherwise skip lint without failing.
> - **Single multi-locale catalog, build-time populated (Swift / Apple)**: catalog_integrity_check (no extract/compile codemod step). The wrap subagents make strings localizable per `string-catalog.convert.md`; there is **no extract or compile codemod** — a normal Xcode build with `SWIFT_EMIT_LOC_STRINGS = YES` emits `.stringsdata` that populates `Localizable.xcstrings` (or, headless, `xcrun xcstringstool extract → sync` does the same). The verify gate is **catalog integrity**: the `.xcstrings` is valid JSON and covers the used keys (see the Swift arm below).
>
> For Lingui / next-intl / vue-i18n:
> 1. Run `npx lingui extract --clean` (Lingui) or `npx next-intl extract` if applicable. Capture errors. Atomically update `progress/verify.json` after this step.
> 2. Run `npx lingui compile` (with `--typescript` if TS). Capture errors.
> 3. Run the project's typecheck and build command. Capture pass/fail.
> 4. Read the extracted catalog. For entries lacking translator comments where the heuristic in the reference says one should exist (single-/two-word phrases, action labels without object, domain-sensitive terms), edit the source file to add the missing comment.
>
> For Paraglide:
> 1. Run `npx '@inlang/paraglide-js@^2' compile --project ./project.inlang --outdir ./src/lib/paraglide` (both flags; single-quoted pin so zsh's `EXTENDED_GLOB` does not eat the caret). Capture errors. Atomically update `progress/verify.json` after this step.
> 2. Run the project's typecheck and build command. Capture pass/fail. (No extract step.) **Default PO format:** (a) inspect a compiled plural message (`src/lib/paraglide/messages/<key>.js`) to confirm it emits CLDR `registry.plural(...)` branches and **not** the raw `{count, plural, …}` source as a literal — raw source means `"messageFormat": "icu"` is missing or an `msgstr` is malformed (both fail silently); (b) run a comment-review pass over the base `messages/{baseLocale}.po`, adding `#.` comments where the reference's heuristic says one should exist. **ICU-JSON format (`catalogFormat === "json"`):** skip both — there is no comment field, and the ICU1 plugin already fails the build on malformed ICU.
>
> For Rails:
> 0. **Ensure `i18n-tasks` is installed (this phase owns the install).** If `i18n-tasks` is not in `Gemfile.lock`, add `gem "i18n-tasks", "~> 1.0"` to the `:development, :test` group, run `bundle install`, and scaffold `config/i18n-tasks.yml` if absent (per `rails.convert.md` Step 4). If `bundle install` fails, record the error, mark the gate **skipped** (not failed), and continue — do not block the run on missing audit tooling. (Rails installs gems inside subagents; Phase 2.0 is a no-op for bundler.)
> 1. **Base-locale completeness gate:** run `bundle exec i18n-tasks missing -t used` — the keys used in code that have no entry in the base locale. The gate **passes** when this reports **no keys** (every wrapped key has a source entry). **Judge by the reported keys, not the process exit code:** `i18n-tasks missing` is a report command and may exit `0` even with findings (only `i18n-tasks health` is contracted to exit non-zero for CI). Inspect the output — any base-locale key listed under `-t used` is a gate failure; for a machine-checkable form, `bundle exec i18n-tasks missing -t used -f keys` prints one key per line and an empty result means pass. Capture pass/fail. Atomically update `progress/verify.json` after this step. Do **not** run `i18n-tasks health` — its all-locale `missing` + `unused` would false-fail on the empty target stubs and on setup seed keys (both by design). Target-locale gaps (`bundle exec i18n-tasks missing -t diff`) are expected — report them as informational, never as a failure. (Confirm the exact `-t used` flag with `bundle exec i18n-tasks missing --help` if the gem version differs.) There is **no extract step** and **no compile step** — Rails loads `config/locales/*.yml` directly at runtime.
> 2. **Unused cleanup (not a gate):** run `bundle exec i18n-tasks unused` and delete genuinely-orphaned scaffold seed keys (e.g. the `site.title` seed the setup phase added that the app never references) from the source catalog, so the shipped catalog — and the later CI `i18n-tasks health` gate — stays clean. This is a cleanup action, not a pass/fail gate. Do **not** run `i18n-tasks normalize` here: leave the catalog in its authored reading order (canonical ordering is handled by CI Add-on 3). Confirm the catalogs parse and cover every configured locale.
> 3. **If a test suite is present** (`spec/` with RSpec, or `test/` for Minitest): run it. With `config.i18n.raise_on_missing_translations = true` set in `config/environments/test.rb` (configured by the setup phase), any missing key raises immediately, so a green suite confirms catalog coverage. Capture pass/fail. If no suite is present, skip this step.
>
> For Swift / Apple:
> 1. **Catalog-integrity gate (no extract/compile codemod step).** The wrap subagents already made strings localizable per `string-catalog.convert.md`; there is no separate extract or compile codemod (build-time `SWIFT_EMIT_LOC_STRINGS = YES` / `xcstringstool` populates the catalog). Run the headless three-step form (NOT a pipe) to confirm the catalog is valid and covers the used keys:
>    ```
>    DIR=$(mktemp -d)
>    xcrun xcstringstool extract <sources> --SwiftUI --modern-localizable-strings [--legacy-localizable-strings] --output-directory "$DIR"
>    xcrun xcstringstool sync <catalog> --stringsdata "$DIR"/*.stringsdata
>    xcrun xcstringstool print <catalog>
>    ```
>    Capture pass/fail. Atomically update `progress/verify.json` after this step. **Graceful degradation:** if `xcrun xcstringstool` is absent (no Xcode toolchain), author + static-JSON-validate the catalog instead (parse the `.xcstrings` as JSON; check `sourceLanguage`, `strings`, `version`) and mark build-verify **deferred** (NOT failed) — a later macOS build / `xcstringstool` run populates it. Authoritative commands: `references/languages/ios/native/string-catalog.convert.md`.
>
> Authoritative commands: `references/languages/ruby/frameworks/rails/rails.convert.md` Steps 4-5 and `references/languages/ruby/frameworks/rails/setup.add-ons.md` Add-on 3.
>
> For Android:
> 1. **XML validity** — parse every `res/values/strings.xml` and `res/values-*/strings.xml`; any malformed file (unescaped `&`/`'`, broken tag) is a failure. Capture pass/fail. Atomically update `progress/verify.json` after this step. (There is **no extract step** and **no compile step** — the platform loads resources at runtime.)
> 2. **Locale coverage** — for each configured target locale, confirm `res/values-<qualifier>/strings.xml` exists and defines every `name` present in the source `res/values/strings.xml` (including each `<plurals>` group). Report any missing keys. Also confirm a `comment_review_pass` over the source `strings.xml`, adding `<!-- -->` translator comments and `<xliff:g>` annotations where the reference's heuristic says one should exist (Android XML carries comments — they DO apply, unlike Paraglide ICU-JSON).
> 3. **Lint (if the Android SDK is available)** — run `./gradlew lint` and capture `MissingTranslation` / `ExtraTranslation`; this is the authoritative coverage gate when the toolchain is present. **If the SDK/Gradle is absent, skip this step and do not fail** — record `lint: "skipped: no Android SDK"` and rely on steps 1-2.
>
> Authoritative commands: `references/languages/android/native/android-strings.convert.md` (verify section) and `references/languages/android/native/setup.add-ons.md` (CI/lint add-on).
>
> Write `result` with `{ catalogPath, totalMessages, extractOk, compileOk, buildOk, commentsAdded }`. For Paraglide, set `extractOk` to `null`; set `commentsAdded` to the count added on the default PO format and to `null` on ICU-JSON; report compile success under `compileOk`. For Rails, set `extractOk` to `null` (no extraction — keys are hand-authored in YAML); report the base-locale completeness result (`i18n-tasks missing -t used` empty) under `compileOk` (Rails' catalog-integrity gate stands in for compile; a gate skipped because `bundle install` failed reports as `null` with the error noted in `errors`); set `buildOk` to the test-suite result when a suite ran, else `null` (Rails has no build step); set `commentsAdded` to `null`. For Rails, `catalogPath` is `config/locales/{default_locale}.yml` and `totalMessages` is the key count in that file (Rails has no extraction step to count from). For Android, set `extractOk` to `null` (no extraction — keys are hand-authored in XML); report the combined XML-validity + locale-coverage result under `compileOk` (Android's catalog-integrity gate stands in for compile); set `buildOk` to the `./gradlew lint` result when it ran, else `null` (lint skipped / no SDK); set `commentsAdded` to the count of `<!-- -->` comments added (Android XML carries comments). For Android, `catalogPath` is `app/src/main/res/values/strings.xml` and `totalMessages` is the `<string>` + `<plurals>` count in that file. For Swift, set `extractOk` to `null` (no extraction codemod — keys land via build-time `SWIFT_EMIT_LOC_STRINGS`/`xcstringstool`); report the catalog-integrity result under `compileOk` (and `null` with build-verify-deferred noted in `errors` when `xcstringstool` is absent and only static-JSON-validate ran); set `buildOk` to `null` (no JS build step); set `commentsAdded` to `null`. For Swift, `catalogPath` is the `.xcstrings` (e.g. `Localizable.xcstrings`) and `totalMessages` is the key count in `strings`.

### 3.6 Cost estimate (Phase 3 → 4 bridge)

After verify succeeds, parse the extracted catalog (JS) / the source-locale YAML (Rails) / the source `res/values/strings.xml` (Android) to compute word count. Show the user:

> "Phase 3 complete. Catalog: **{totalMessages}** messages, ~**{wordCount}** words. Translating into **{N}** target locales (`{targets}`) would cost roughly **~${estimate}** on Globalize.now."

If `decisions.scope.globalize === true`, advance to Phase 4 with:

> "Moving on to Phase 4 — connecting Globalize.now."

Otherwise, end with:

> "Skipping the translation-platform step for now. Re-run `i18n-guide` with `connect translation platform` checked when you're ready to wire it up."

### Phase 3 collapse-cases

- `existing.stringsWrapped === "yes"` → skip wrap subagents; run only verify.
- `existing.stringsWrapped === "partial"` → Phase 1 candidate list already excluded already-wrapped files.

---

## Phase 4 — Globalize-now (optional)

Auth must stay on the main thread (interactive). Project + repo creation runs in a subagent.

> **User-facing message** (at Phase 4 start):
> "Phase 4 — connecting Globalize.now. The first three steps run here in the foreground because they need you: installing the CLI, signing in (a browser window will open for device-flow auth), and confirming your org. After that, a background worker creates the project, configures languages, connects your repo, and sets the catalog file patterns."

### 4.1 Install CLI (main thread)

If `@globalize-now/cli-client` not installed, run `npm install -g @globalize-now/cli-client` (or `npx` form, depending on user preference). Show output.

### 4.2 Authenticate (main thread)

Run `globalize login`. This is interactive — opens browser device flow. Wait for completion.

### 4.3 Verify org (main thread)

Run `globalize org current` (or equivalent). Show org name. Confirm with user.

### 4.4 Pre-create `progress/globalize.json`

Plan: `create_project`, `configure_languages`, `connect_repo`, `configure_patterns`. (Glossaries and styleguide skipped in v1.)

### 4.5 Dispatch project subagent (background)

> You are creating a Globalize.now project and connecting the repository. CLI is installed and authenticated. Read `.globalize/decisions.md` for project name + locales. Read `.globalize/detection.json` for repo identifier (`git.remote` parsed).
>
> Run, in order:
> 1. `globalize project create --name "{name}" --source {sourceLocale} --targets {targetLocales}` — capture project ID and URL.
> 2. `globalize project languages list` — verify all targets accepted.
> 3. `globalize repo connect --provider {gh|gl} --repo {owner/repo}` — wire repo.
> 4. `globalize repo patterns set --source {catalogPath} --output {targetCatalogPattern}` — configure paths from Phase 3 verify result. The **file format** follows the catalog: for Paraglide it is `po` with catalog path `messages/{locale}.po` by default; if `decisions.setup.catalogFormat === "json"` it is `json-flat` at `messages/{locale}.json`. (Other libraries: `po` for Lingui, `json-nested` for next-intl, etc.) For **Rails** (`detection.language === "ruby"`, `framework === "rails"`) the format is **`yaml-rails`** with catalog path `config/locales/{locale}.yml`, source locale `en` or the detected `default_locale` (`config.i18n.default_locale`). Rails locale codes are already hyphenated (`pt-BR.yml`, `zh-TW.yml`) — pass them through verbatim with **no** underscore normalization. For **Android** (`detection.language === "android"`, `framework === "android"`) the format is **`android-strings`** with the **source** catalog at `app/src/main/res/values/strings.xml` (the locale-less default), source locale = the app's default. **Unlike most formats, the locale lives in the directory qualifier (`res/values-<qualifier>/strings.xml`), not in a `{locale}` filename token** — the `android-strings` handler knows this convention intrinsically: it discovers the target locales from the `values-*` qualifier dirs and normalizes both legacy (`values-pt-rBR`) and BCP47 (`values-b+sr+Latn`) forms ⇄ BCP47. So **do not synthesize a `{locale}` segment** for Android. Point `--source` at the `values/strings.xml` file and let the handler resolve targets; confirm the exact `globalize repo patterns set` invocation for a directory-qualifier format against `globalize-now-cli-use` (if the CLI form genuinely cannot express "source file + handler-discovered targets", surface it as a `needs_decision` rather than inventing a `{locale}` token). For **Swift / Apple** (`detection.language === "swift"`) the format is **`xcstrings`** with a **single-file pattern and NO `{locale}` segment** — source and output are the **same file**: `Localizable.xcstrings` (or `**/*.xcstrings` when there are multiple catalog tables/dirs). The source locale is the catalog's `sourceLanguage` / the detected development region (`CFBundleDevelopmentRegion`). The importer reads and writes every locale **inside the one file**; like Android's directory-qualifier convention, this format has **no per-locale `{locale}` pattern** — do not synthesize one. Pass the format with the pattern if the CLI form in use takes an explicit `fileFormat` (see `globalize-now-cli-use`).
>
> Update `progress/globalize.json` after each step. Final `result` includes `{ projectId, projectUrl, repoConnected, patternsConfigured }`.

### 4.6 Poll, surface, finish

Standard polling. On completion, show project URL and a one-line summary:

> "All set. Project created: **{projectUrl}**. Repo connected, catalog patterns wired. From here on, use the `globalize-now-cli-use` skill (or the `globalize` CLI directly) for ongoing translation work — pulling translations, tracking status, requesting new languages."

---

## Plan and decisions formats

### `plan.md`

Markdown with YAML frontmatter for metadata. Body uses strict checklist syntax (`- [ ] step_id`) so the orchestrator can parse it.

Skeleton:
```markdown
---
version: 1
createdAt: <ISO timestamp>
manifestSnapshot: .globalize/manifest-snapshot.json
detection: .globalize/detection.json
decisions: .globalize/decisions.md
---

# i18n Setup Plan

Stack: **{framework + router}** + **{library}** (variant: `{variant-id}`)
Branch: {decision summary}

## Phase 2 — Setup
Subagent: `setup`
Progress: `.globalize/progress/setup.json`
References:
- {paths joined from manifest.references.setup}
- {paths joined from manifest.references.code}

Orchestrator-owned steps (main thread, before subagent dispatch):
- [ ] install_packages_main_thread

Subagent steps:
- [ ] checkout_branch
- [ ] create_config
- [ ] build_tool_integration
- [ ] provider_wiring
- [ ] language_switcher
- [ ] scaffold_catalogs
- [ ] extract_compile   <!-- compile-time libraries only (Lingui); runtime-catalog libraries (next-intl, vue-i18n) consume the scaffolded catalogs directly — omit this step. Compile-from-catalog libraries (Paraglide) use `paraglide_compile` instead — see below. -->
- [ ] paraglide_compile   <!-- compile-from-catalog libraries only (Paraglide): `npx '@inlang/paraglide-js@^2' compile --project ./project.inlang --outdir ./src/lib/paraglide`; replaces extract_compile, omit for all other libraries -->
- [ ] install_coding_rules
- [ ] {optional steps if opted in}
- [ ] build_verification

## Phase 3 — Convert
Partitions: {N} wrap subagents covering {file count} files

### wrap-1 ({subtree summary})
- [ ] {file path}
- [ ] {file path}
…

### verify
<!-- compile-time extraction (Lingui) and runtime-catalog (next-intl, vue-i18n): -->
- [ ] extract_clean
- [ ] compile
- [ ] build_check
- [ ] comment_review_pass
<!-- compile-from-catalog (Paraglide) instead: no extract step, no comment_review_pass (inlang/ICU has no comment field):
- [ ] paraglide_compile
- [ ] build_check
-->
<!-- runtime-catalog, no compile (Rails) instead: no extract step, no compile step, no build step (Rails loads config/locales/*.yml directly at runtime). The gate is base-locale completeness (i18n-tasks missing -t used); there is no normalize-drift gate. test_suite is optional — include only if a spec/ or test/ dir exists (run with raise_on_missing_translations):
- [ ] ensure_i18n_tasks
- [ ] source_completeness_check
- [ ] unused_cleanup
- [ ] test_suite
-->
<!-- runtime-catalog, no compile (Android) instead: no extract step, no compile step (the platform loads res/values*/strings.xml at runtime). lint_check is optional — include only when the Android SDK/Gradle is available:
- [ ] xml_validity_check
- [ ] locale_coverage_check
- [ ] lint_check
-->

## Phase 4 — Globalize-now
Steps:
- [ ] create_project
- [ ] configure_languages
- [ ] connect_repo
- [ ] configure_patterns
```

### `decisions.md`

Markdown with YAML frontmatter, sections per category. Doubles as a project record if committed (note: `.globalize/` is gitignored by default — see Workspace section).

```markdown
---
createdAt: <ISO>
---

# i18n Setup Decisions

## Library
**{library}** (recommended; user accepted | user override)

## Scope
- [x] Setup
- [x] Convert existing strings
- [x] Connect Globalize.now

## Branch
Create new branch: `chore/i18n-setup`

## Setup mode
**Unguided**

## Locales
- Source: `en`
- Targets: `de`, `fr`, `es`

## Routing strategy
Prefix-based

## App domain
{user-confirmed domain}

## Optional setup steps
- [x] ESLint plugin
- [ ] CI/CD integration
- [ ] Test setup wrapper
- [x] Install passive coding rules (@import)

## Globalize-now
- Project name: `{name}`
- Repo provider: GitHub
```

### Progress file schema (per subagent)

```json
{
  "subagentId": "setup",
  "phase": 2,
  "status": "pending|running|succeeded|failed|needs_decision",
  "startedAt": "<ISO>", "updatedAt": "<ISO>",
  "plan": ["step_id_1", "step_id_2"],
  "completed": ["step_id_1"],
  "current": "step_id_2",
  "currentDetail": "modifying vite.config.ts",
  "skipped": [],
  "filesCreated": [],
  "filesModified": [{ "path": "...", "summary": "..." }],
  "errors": [],
  "needsDecision": null,
  "result": null
}
```

---

## Reading the reference files (subagents)

Reference files under `references/languages/.../*.md` walk through their variant's setup or convert work linearly via section headings (e.g., "Packages", "Build Tool Integration", "Provider Setup", "Language Switcher"). Follow them in document order — section headings are the authoritative ordering, not the orchestrator's plan step IDs (those are higher-level phase markers used by the polling loop).

Some references include catalog-format sub-references for an **alternate** format (e.g., `references/languages/js-ts/libraries/next-intl/po-format.setup.md`, and for Paraglide `references/languages/js-ts/libraries/paraglide/json-format.{setup,convert,code}.md`). When the user is on the alternate format, substitute that reference's snippets in place of the default examples — the variant reference itself flags the substitution points. For Paraglide specifically: the **default is PO**, so the base files (`frameworks/sveltekit/paraglide.{setup,convert}.md` and `libraries/paraglide/code.md`) are the PO path and apply as-is. Only when `decisions.setup.catalogFormat === "json"` does the setup subagent apply `json-format.setup.md` over `paraglide.setup.md`, the wrap subagents apply `json-format.convert.md` over `paraglide.convert.md`, and the coding-rules add-on install `json-format.code.md` instead of `code.md` (see the add-ons reference).

If a reference's instructions appear to require user input that wasn't collected in Phase 1, do not improvise: write `status: "needs_decision"` to your progress file and exit so the orchestrator can ask.

## Subagent dispatch mechanics

- Use the Agent tool with `run_in_background: true` for all phase subagents (Phase 2 setup, Phase 3 wrap and verify, Phase 4 project). The orchestrator polls progress files instead of waiting on the subagent's terminal output.
- For Phase 1.1 (inspect), foreground (blocking) is fine — the subagent only writes one JSON file and returns.
- All wrap subagents in Phase 3 must be dispatched **in a single tool-use message** to launch in parallel.
- Subagents must use atomic file writes (write `<file>.tmp`, then `mv`) when updating progress files.
- Each subagent reads the same set of inputs from `.globalize/`: it does not need orchestrator-side state passed via prompt beyond pointers to those files.

---

## Edge cases

- **Multiple frameworks detected** (e.g., both `next` and `vite` in deps): Next.js takes precedence — use Rule 1 in 1.5.
- **Monorepo**: Detect from the closest `package.json` to the working directory. Do not aggregate deps across workspace packages.
- **User overrides recommendation** with a library that doesn't match a manifest entry: surface the supported list and ask them to pick one of those.
- **`.globalize/` already exists from a prior run**: see Resumability section above.
- **No `git` repo**: skip 1.4 (branch recommendation) silently.
- **`decisions.md` is hand-edited between runs**: re-validate against `manifest-snapshot.json` before re-dispatching subagents — fail loudly if invalid.
