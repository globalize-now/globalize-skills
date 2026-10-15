# Phase 1.1 — Inspect (detection)

Loaded by SKILL.md §1.1. This is the inspect worker's full instruction set — dispatched as a subagent, or followed by the main agent itself in single-agent mode (SKILL.md "Execution mode"). Read-only: it writes `.globalize/detection.json` and nothing else.

After you decide `language` (and, for JS, `framework`), **read the matching detection table before filling any field**: `detect.js-ts.md`, `detect.ruby.md`, `detect.android.md`, or `detect.swift.md` in this directory. Each table applies only to its own language.

You are inspecting a project to gather i18n setup context. Read-only — do not modify any files.

First decide the project **language**, applying these rules **in order, first match wins** (the order is load-bearing — a root `package.json` must beat native signals so hybrid/web wrappers route to JS):
1. A `Gemfile`/`Gemfile.lock` (containing `rails`), `bin/rails`, or `config/application.rb` is present → **ruby** (read `detect.ruby.md` instead of the JS table).
2. A root `package.json` is present → **js-ts** (read `detect.js-ts.md`; this deliberately includes hybrid/web-wrapper apps — **React Native, Capacitor, Cordova, Ionic** — which ship a native `android/` or `ios/` folder but localize in the JS layer, so they belong on the JS path or its §1.2 stop, never a native path).
2b. A `manifest.json` at the repo root, in `src/`, or in `public/` contains a `"manifest_version"` key, and there is **no** root `package.json` → **js-ts** with `framework: "webext"`, `extensionFramework: "none"`, `packageManager: null` — a browser extension with no build step. (A bundled extension already matched rule 2; the framework rules in `detect.js-ts.md` then identify it. Without this rule a build-less extension falls through to `unknown` and gets a stop that tells the user nothing.)
3. Native-Android Gradle signals are present (`AndroidManifest.xml`, OR a `build.gradle`/`build.gradle.kts` applying `com.android.application`/`com.android.library`, plus `gradlew`/`settings.gradle`) **AND** there is no root `package.json` **AND** no `pubspec.yaml` → **android** (read `detect.android.md`). (A `pubspec.yaml` means Flutter — it ships an `android/` Gradle subfolder but localizes via `.arb`, not native `strings.xml`; it is excluded here and stopped in §1.2.)
4. `*.xcodeproj`/`*.xcworkspace`/`Package.swift`/`*.swift` is present (and none of the above matched) → **swift** (read `detect.swift.md`).
5. Otherwise → **unknown**.

For a **js-ts** project, read the project's `package.json`, build config files (`vite.config.*`, `next.config.*`, `.babelrc`), and survey the source tree. Output **only** a single JSON object matching this schema, written to `.globalize/detection.json`:

```json
{
  "language": "js-ts" | "ruby" | "android" | "swift" | "unknown",
  "framework": "next" | "vite" | "tanstack-start" | "remix" | "react-router-framework" | "nuxt" | "quasar" | "sveltekit" | "webext" | "angular" | "cra" | "rails" | "android" | "unknown",
  "router": "app" | "pages" | "tanstack-router" | "tanstack-start" | "react-router" | "vue-router" | "sveltekit" | "angular-router" | "none",
  "compiler": "swc" | "babel" | null,
  "extensionFramework": "wxt" | "crxjs" | "vite-plain" | "plasmo" | "webpack" | "none" | null,
  "manifestVersion": 2 | 3 | null,
  "react": true | false,
  "vue": true | false,
  "svelte": true | false,
  "angular": true | false,
  "ionic": true | false,
  "hybrid": "capacitor" | "cordova" | null,
  "typescript": true | false,
  "packageManager": "npm" | "yarn" | "pnpm" | "bun" | "bundler" | "gradle",
  "platform": "ios" | "macos" | null,
  "buildSystem": "xcode" | "spm" | null,
  "uiFramework": "swiftui" | "uikit" | null,
  "version": string | null,
  "sourceDir": "src" | "app" | string,
  "routeEntries": ["src/app/**/page.tsx", ...] | null,
  "git": { "isRepo": true | false, "branch": string | null, "remote": string | null },
  "existing": {
    "library": "lingui" | "next-intl" | "react-intl" | "i18next" | "react-i18next" | "next-translate" | "typesafe-i18n" | "vue-i18n" | "@nuxtjs/i18n" | "i18next-vue" | "@tolgee/vue" | "fluent-vue" | "paraglide" | "rails-i18n" | "android-strings" | "string-catalog" | "webext-native" | "@angular/localize" | "@jsverse/transloco" | "@ngneat/transloco" | "@ngx-translate/core" | "none",
    "configured": true | false,
    "providerWired": true | false,
    "catalogsScaffolded": true | false,
    "stringsWrapped": "yes" | "partial" | "no"
  },
  "candidateFiles": [
    { "path": "src/components/Navbar.tsx", "matchCount": 8 }
  ],
  "formatCandidateFiles": [
    { "path": "src/lib/pricing.ts", "matchCount": 5 }
  ],
  "localeSignals": {
    "existingLocaleDirs": ["src/locales/en", "src/locales/de"],
    "envHints": ["DEFAULT_LOCALE=en"],
    "readmeHints": ["mentions: English, German, French"]
  }
}
```



**`formatCandidateFiles` is not a subset of `candidateFiles`** — on any language. Hand-rolled formatting lives in price, date and utility modules that contain no user-visible copy at all, so the string-detection glob never opens them, and a module full of `<Trans>` may format nothing. The two lists overlap; neither contains the other. **Phase 3 partitions the union of the two lists**, and each wrap subagent is told, per file, whether that file is in scope for `strings`, `formatting`, or `both` (see §3.2). Emit both lists in full — never prune one against the other, and never emit `formatCandidateFiles` as a filtered view of `candidateFiles`.

For a `swift` detection, `platform`, `buildSystem`, and `uiFramework` MUST be populated (never left undefined) — the §1.3 matcher checks these structural keys by equality, and an undefined field never matches an iOS variant. For `js-ts`, `ruby`, and `android` detections, all three are `null`.

Likewise, for a `framework: "webext"` detection `extensionFramework`, `manifestVersion`, and `compiler` MUST all be populated — `compiler` explicitly to `null` where no Vite build exists, since that null is the predicate that withholds the Lingui variants. For every non-`webext` detection, `extensionFramework` and `manifestVersion` are `null`.

For **every** detection, `angular`, `ionic` and `hybrid` MUST be populated — on non-`js-ts` detections they are `false`, `false`, `null`. The §1.2 hybrid rows and the §1.7 routing skip read them.

Write the JSON file and exit. Do not engage in conversation.

<!-- SCAN-DONE -->
> **User-facing message** (after the inspect subagent returns and `detection.json` is written):
> For `language === "js-ts"` (JS/TS): "Scan done. Detected: **{framework}** + **{router}** ({compiler} compiler, {packageManager}). Existing i18n: **{existing.library}** ({existing.configured ? 'already configured' : 'not configured yet'}). Found **{candidateFiles.length}** files with hardcoded strings and **{formatCandidateFiles.length}** files formatting values by hand. Next, a few questions to shape the setup plan."
> For `framework === "angular"` (`compiler` is not meaningful, so omit it): "Scan done. Detected: **Angular {version}**{ + Ionic when `ionic`}{ + Capacitor/Cordova when `hybrid`} ({packageManager}). Existing i18n: **{existing.library}** ({existing.configured ? 'already configured' : 'not configured yet'}). Found **{candidateFiles.length}** files with hardcoded strings and **{formatCandidateFiles.length}** files formatting values by hand. Next, a few questions to shape the setup plan."
> For `language === "ruby"` (Rails — `router` is "none" and `compiler` is not meaningful, so omit them): "Scan done. Detected: **rails** (bundler). Existing i18n: **{existing.library}** ({existing.configured ? 'already configured' : 'not configured yet'}). Found **{candidateFiles.length}** files with hardcoded strings and **{formatCandidateFiles.length}** files formatting values by hand. Next, a few questions to shape the setup plan."
> For `language === "android"` (native Android — `router` is "none" and `compiler` is not meaningful, so omit them): "Scan done. Detected: **android** (gradle). Existing i18n: **{existing.library}** ({existing.configured ? 'string resources already present' : 'no string resources yet'}). Found **{candidateFiles.length}** files with hardcoded strings and **{formatCandidateFiles.length}** files formatting values by hand. Next, a few questions to shape the setup plan."
> For `framework === "webext"` (browser extension — `router` is "none", so omit it): "Scan done. Detected: **browser extension** (MV{manifestVersion}, **{extensionFramework}**{, compiler when non-null}{, packageManager when non-null}). Existing i18n: **{existing.library}** ({existing.configured ? 'already configured' : 'not configured yet'}). Found **{candidateFiles.length}** files with hardcoded strings and **{formatCandidateFiles.length}** files formatting values by hand. Next, a few questions to shape the setup plan."
> For `language === "swift"` (iOS — router/compiler are not meaningful, so omit them): "Scan done. Detected: **iOS** (**{uiFramework}**, **{buildSystem}**). Existing i18n: **{existing.library}** ({existing.configured ? 'already configured' : 'not configured yet'}). Found **{candidateFiles.length}** files with hardcoded strings and **{formatCandidateFiles.length}** files formatting values by hand. Next, a few questions to shape the setup plan."
>
> If `existing.library !== "none"`, also surface:
> "Heads up — you already have `{existing.library}` in your dependencies. If it's compatible, we'll continue with it; if not, I'll flag it in the next step."
