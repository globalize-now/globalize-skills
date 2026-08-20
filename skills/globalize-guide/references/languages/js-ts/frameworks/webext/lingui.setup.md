# Browser Extension (MV3) + Lingui — Setup (Babel)

> This is one of **two** setup references for this stack — read them in the order `references.setup` lists. `setup.locale-module.md` runs first and owns `src/i18n/locales.ts`. **This file imports that module and never defines it.**
>
> There is no third file. `setup.navigation.md` is deliberately absent from `references.setup` on the browser-extension variants: an extension has no URLs, so nothing in it applies and `src/i18n/navigation.ts` is never created. Its one non-routing export, the language switcher, is owned **here** — see Step 10. `<i18nDir>` is `src/i18n/` and `<componentsDir>` is `src/components/` on this variant, including on WXT projects that keep their UI under `entrypoints/`.

This covers MV3 browser extensions (Chrome, Edge, Firefox) built with Vite and React, using `@vitejs/plugin-react` (the Babel-based plugin, without the `-swc` suffix) for the React transform and `babel-plugin-macros` to expand the Lingui macros. It applies to WXT, CRXJS and plain-Vite extension projects alike; Step 3 branches on `extensionFramework`. **This is the default on WXT**, whose `@wxt-dev/module-react` wraps `@vitejs/plugin-react`.

> **Version gate — `@vitejs/plugin-react` v6+.** `@vitejs/plugin-react@6.0.0` dropped the `babel` option from its public `Options` type; only `include`, `exclude`, `jsxImportSource`, `jsxRuntime` and `reactRefreshHost` remain. The `babel: { plugins: ['macros'] }` form below is **silently ignored** on v6+ — macros never expand, `tsc` errors with TS2353 on the `babel` property, and every `<Trans>` renders its message id at runtime.
>
> **Read the installed `@vitejs/plugin-react` version before applying this file** (`package.json`, then the lockfile). On WXT the peer range of `@wxt-dev/module-react` is `^4 || ^5 || ^6`, so v6 is entirely possible. If the major is 6 or higher, write `status: "needs_decision"` with
>
> ```json
> { "step": "react_plugin_major_gate",
>   "question": "@vitejs/plugin-react@6 removed the `babel` option, so the Babel Lingui macro cannot be wired. Switch this project to @vitejs/plugin-react-swc + @lingui/swc-plugin (the SWC variant), or pin @vitejs/plugin-react to ^5?",
>   "options": ["switch_to_swc_variant", "pin_plugin_react_v5"] }
> ```
>
> and exit. On `switch_to_swc_variant` the orchestrator re-dispatches against `frameworks/webext/swc/lingui.setup.md`. Do not proactively downgrade `@vitejs/plugin-react` yourself. If the project is locked to v4 or v5, this reference applies verbatim.

The architecture in one paragraph. **The PO catalog at `src/locales/{locale}/messages.po` is the single source of truth for every string in the project** — the popup, the options page, the side panel, content scripts, the service worker, *and* the four manifest fields the browser reads before any of your code runs. Lingui serves the UI strings at runtime from compiled catalogs. A small build script mirrors the `manifest.*`-prefixed subset into `public/_locales/<code>/messages.json`, which is the only format the browser and the Chrome Web Store understand. `_locales` is therefore **generated build output on this variant, not a second catalog** — never hand-edit it. This is the same shape Dark Reader and `@wxt-dev/i18n` use (author in a richer format, compile down to native `_locales`), with PO as the source and real CLDR plurals as the payoff.

Follow the steps in order. Each builds on the last.

---

## Out of Scope

- **The native variant** (`webext-native-messages`). If the user chose `chrome.i18n` / `_locales` as the authoring format, `webext-native.setup.md` is the right file and this one is not.
- **`@wxt-dev/i18n`.** Its plural scheme is `0`/`1`/`n` only — no `few`/`many` — so Arabic, Russian, Polish, Czech and Croatian degrade. Do not set it up and do not recommend it. It is a tracked follow-up.
- **Manifest V2.** Hard-stopped upstream (`SKILL.md §1.2`). You will only ever see `manifestVersion: 3`.
- **Safari verification.** `safari-web-extension-converter` output has open reports of `browser.i18n.getMessage()` returning empty strings (wxt-dev/wxt#1400). Warn; do not claim it works. The Lingui path uses `browser.i18n` only for `getUILanguage()`, so it is less exposed than the native path — but still unverified.
- **Wrapping existing hardcoded strings** — that is the convert phase (`lingui.convert.md` plus the shared `convert.standard-react.md`). This phase only builds infrastructure.

### Step risk classification

| Step | Risk | Notes |
|---|---|---|
| 1. Locate the pieces | Read-only | No changes to the project |
| 2. Packages | None | The orchestrator already installed them (Phase 2.0) |
| 3. Build-tool integration | **Modifies existing file** | `wxt.config.ts` or `vite.config.ts` — describe and confirm |
| 4. `lingui.config.ts` | Additive | New file; if one exists, reconcile rather than clobber |
| 5. `src/i18n/index.ts` + `src/i18n/browser.ts` | Additive | New modules |
| 6. `src/i18n/manifest-strings.ts` | Additive | New module |
| 7. `scripts/build-locales.mjs` | Additive | New script |
| 8. Manifest wiring | **Modifies existing file** | Adds `default_locale`, rewrites four fields to `__MSG_` — describe and confirm |
| 9. Entrypoint bootstrap | **Modifies existing files** | Every popup/options/sidepanel root, content script and the service worker |
| 10. `src/components/LanguageSwitcher.tsx` | Additive | New component (+ one import where it is mounted) |
| 11. Catalog scripts and `.gitignore` | **Modifies existing files** | Prefixes `dev`/`build`; appends ignore rules |

**RULE: steps that modify existing files require you to describe the exact change and get confirmation before proceeding.** Guided mode explains each step before and after and honours every consent gate; unguided mode applies changes directly, suspends the consent gates, and ends with a `## Setup Complete` summary. Hard stops and `status: "needs_decision"` exits apply in both modes.

**Every step is independently re-runnable.** Before acting, detect the already-applied state — an existing `lingui.config.ts`, a `default_locale` key, an `src/i18n/index.ts`, a `lingui compile` prefix already on the `build` script — and skip that step without prompting.

---

## Step 1: Locate the Extension's Pieces

`.globalize/detection.json` already carries `framework: "webext"`, `extensionFramework`, `manifestVersion: 3`, `compiler: "babel"` and `router: "none"`. This step turns `extensionFramework` into three concrete paths.

| `extensionFramework` | Build config | Manifest source of truth | Public root (copied verbatim to the package root) |
|---|---|---|---|
| `wxt` | `wxt.config.ts` | the `manifest:` key **inside** `wxt.config.ts` — there is no checked-in `manifest.json` | `public/` |
| `crxjs` | `vite.config.ts` | `manifest.json` at the repo root, **or** `manifest.config.ts` when the project uses CRXJS's typed config | `public/` |
| `vite-plain` | `vite.config.ts` | `public/manifest.json`, or `manifest.json` at the repo root | `public/` |

`plasmo`, `webpack` and `none` never reach this file — `compiler` is `null` for them, so they match the native variant only.

Also read:

| Signal | How to detect |
|---|---|
| **Entrypoints** | WXT: `entrypoints/` (`popup/main.tsx`, `options/main.tsx`, `background.ts`, `*.content.ts`). CRXJS / plain Vite: the `manifest.json` keys `action.default_popup`, `options_ui.page`, `side_panel.default_path`, `background.service_worker`, `content_scripts[].js`. |
| **Existing `_locales`** | `ls public/_locales`. A hand-written one means the project was on the native path — see the migration note at the end of Step 7. |
| **`@vitejs/plugin-react` major** | `package.json` `devDependencies`, then the lockfile. **v6+ is a hard gate** — see the version-gate callout at the top of this file. On WXT the plugin arrives as a peer of `@wxt-dev/module-react`, so check the lockfile, not just `devDependencies`. |
| **Path alias** | `tsconfig.json` → `compilerOptions.paths`. WXT generates `@/*` and `~/*` pointing at the source root in `.wxt/tsconfig.json`. Use whatever the project actually declares; fall back to relative specifiers. |
| **`webextension-polyfill`** | In `package.json` deps. **Archived by Mozilla on 2026-07-30.** Never add it. If present, note that the shim in Step 5 supersedes it; removing it is out of scope here. |
| **Git branch** | `git branch --show-current`. On `main` / `master` / `develop`, recommend `git checkout -b chore/i18n-setup` before modifying anything. |

If the project is a Safari target (`safari-web-extension-converter` in scripts, an `*.xcodeproj` beside the extension), warn — non-blocking.

---

## Step 2: Packages

The orchestrator pre-installed the manifest's runtime and dev packages on its main thread (Phase 2.0) before dispatching you. **Treat them as already on disk — do not re-run `npm install` / `pnpm add` / `yarn add` for them.** The set is:

| Package | Type | Purpose |
|---|---|---|
| `@lingui/core@^6` | runtime | The `i18n` singleton, `t`, `msg`, plural resolution |
| `@lingui/react@^6` | runtime | `I18nProvider`, `useLingui`, and the `@lingui/react/macro` entry point |
| `@lingui/cli@^6` | dev | `lingui extract` / `lingui compile` |
| `@lingui/format-po@^6` | dev | PO formatter for `lingui.config.ts`, **and** the PO reader `scripts/build-locales.mjs` uses |
| `@lingui/vite-plugin@^6` | dev | Vite integration — teaches Vite to import a `.po` as a compiled catalog module |
| `babel-plugin-macros@^3` | dev | The Babel macro host that expands `@lingui/core/macro` and `@lingui/react/macro` |

The reasoning behind the pins: Lingui 6 is the current major, paired with React 18/19 and the split `@lingui/core/macro` + `@lingui/react/macro` import paths. Those two entry points are `babel-plugin-macros` macros — `@lingui/react` declares `babel-plugin-macros: 2 || 3` as a peer dependency and its `macro/index.mjs` is a `createMacro(...)` call — so adding `'macros'` to the React plugin's Babel plugin list is all the wiring the transform needs. `@lingui/format-po@^6` supplies the PO formatter: **in Lingui 6 the formatter moved into its own package, so `lingui.config.ts` must import `formatter()` from it; the old `format: 'po'` string was removed and now throws at config load.** `@lingui/cli@^6` produces the `.po` catalogs and compiles them.

`@vitejs/plugin-react` itself is not in the install set — it is already in the project (directly, or as the peer `@wxt-dev/module-react` pulls in). Its major is the gate described at the top of this file.

No `@lingui/detect-locale`. It reads `window.location`, `document.cookie` and `localStorage`, none of which exist in the MV3 service worker, and none of which are where an extension's locale preference belongs. The locale comes from `browser.storage.sync` with `browser.i18n.getUILanguage()` as the first-run default — see Step 5.

> **`pofile` is not required.** An earlier revision of this variant's manifest entry listed `pofile@^1` as a dev dependency for parsing `.po` in `scripts/build-locales.mjs`. It is unnecessary: `@lingui/format-po@^6` exports `formatter()`, and the object it returns has a public `parse(content, ctx)` method that returns Lingui's own catalog shape — including the `#.` extracted comments and the msgstr, with the internal `js-lingui-explicit-id` marker already stripped. Step 7's script uses that. If `pofile` is in `devDependencies` and nothing else imports it, it can be removed.

---

## Step 3: Build-Tool Integration

Two things must end up in the Vite config: `'macros'` in the React plugin's Babel plugin list (so the Lingui macros expand), and `lingui()` as a top-level Vite plugin. Where that config lives depends on `extensionFramework`.

### WXT — `wxt.config.ts`

WXT does not take a `vite.config.ts`; everything lives in `wxt.config.ts`. React comes from `@wxt-dev/module-react`, which registers `@vitejs/plugin-react` for you — so you do **not** add the React plugin to the `vite` key. Instead the module exposes its own config key, `react`, whose `vite` property is passed straight through as the plugin's options. That is where the Babel macro goes. `lingui()` is an ordinary Vite plugin and goes under `vite`.

The whole file:

```ts
// wxt.config.ts
import { defineConfig } from 'wxt'
import { lingui } from '@lingui/vite-plugin'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],

  // Options for @wxt-dev/module-react. `vite` here is the option object handed to
  // @vitejs/plugin-react — this is the only place the Babel macro can be wired on
  // WXT, because the module owns the react() call itself.
  react: {
    vite: {
      babel: {
        plugins: ['macros'],
      },
    },
  },

  manifest: {
    default_locale: 'en',
    name: '__MSG_ext_name__',
    short_name: '__MSG_ext_short_name__',
    description: '__MSG_ext_description__',
    action: {
      default_title: '__MSG_ext_action_title__',
      default_popup: 'popup.html', // NOT localizable — never put __MSG_ here
    },
  },

  vite: () => ({
    plugins: [lingui()],
  }),
})
```

Three details are load-bearing. **`vite` is a function**, not an object — WXT calls it once per build step (background, content scripts, pages) precisely because plugins can carry internal state. **Do not add `react()` to that array**: `@wxt-dev/module-react` already registers it, and a second copy means two Fast Refresh runtimes. WXT merges the module's plugins ahead of the user config's, so `lingui()` still runs after the React transform and sees macro-expanded output. And **the `manifest` key *is* the manifest** on WXT; Step 8 explains the four `__MSG_` fields.

If the project does not use `@wxt-dev/module-react` but calls `@vitejs/plugin-react` itself inside `vite`, drop the `modules` and `react` keys and wire the macro on that call instead, exactly as the CRXJS / plain-Vite form below does.

### CRXJS and plain Vite — `vite.config.ts`

An ordinary Vite config. CRXJS additionally has the `crx({ manifest })` plugin; plain Vite does not, and the two configs are otherwise identical.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'          // CRXJS only
import { lingui } from '@lingui/vite-plugin'
import manifest from './manifest.json' with { type: 'json' }  // CRXJS only

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['macros'],
      },
    }),
    crx({ manifest }),                            // CRXJS only
    lingui(),
  ],
})
```

If the `react()` call already has a `babel.plugins` array, append `'macros'` to it rather than replacing it. Keep the project's existing `crx({ manifest })` call exactly as it is — including a `manifest.config.ts` import if that is what it uses — and keep any other plugins it already has. Only the `react()` options and the added `lingui()` entry change.

> **What `lingui()` actually does here.** It registers `.po` files as importable modules and compiles them on the fly. This reference does *not* rely on that — Step 5 imports the `.ts` output of `lingui compile` so that `tsc` sees the catalogs too, and so that one command produces both the app catalogs and the input `scripts/build-locales.mjs` reads. Keep the plugin registered anyway: it validates `lingui.config.ts` at config-resolve time, and it is the supported escape hatch if you later want `import { messages } from '../locales/en/messages.po'`.

---

## MV3 and CSP Constraints

Read this before Step 5; it is why the runtime module is shaped the way it is.

- **Extension-page CSP is `script-src 'self' 'wasm-unsafe-eval'; object-src 'self';` and cannot be relaxed** — Chrome refuses to install an MV3 extension that tries. No `unsafe-eval`, no remotely hosted code.
- **Lingui is CSP-clean, but only if you ship compiled catalogs.** The historical blocker (js-lingui#27) was `new Function` inside the runtime message compiler; Lingui v4 removed it by deriving plural rules from `Intl.PluralRules`, and `i18n.loadLocaleData()` is gone. `@lingui/core@6` depends only on `@lingui/message-utils` and `@lingui/babel-plugin-lingui-macro` — no `make-plural`. `lingui compile` emits plain modules.
- **Never call `i18n.setMessagesCompiler(compileMessage)`.** That is the dev-mode runtime compiler — exactly the `new Function` path the CSP forbids. It works in a Vite dev server and dies in the packaged extension.
- **No dynamic `import()` in the MV3 service worker** (w3c/webextensions#212, crbug 40760920 — both still open). Popup, options and side panel are ordinary extension pages where it does work, but this reference **standardises on static imports everywhere**: one rule, no per-context exception, no helper that works in the popup and throws in the worker. Bundle size in an extension is a local-disk concern, not a network one.
- **The service worker has no `document`, `window` or `localStorage`.** Use `browser.storage` and `fetch(browser.runtime.getURL(...))`. Step 5 splits the DOM-touching helper out for exactly this reason.
- **`Intl.*` is available in every extension context**, including the service worker, so Lingui's plurals and number/date formatting all work.

---

## Step 4: `lingui.config.ts`

Create it at the repo root. `sourceLocale` and `locales` are imported from the module `setup.locale-module.md` created — one locale list, not two.

```ts
// lingui.config.ts
import { defineConfig } from '@lingui/cli'
import { formatter } from '@lingui/format-po'
import { locales, sourceLocale } from './src/i18n/locales'

export default defineConfig({
  sourceLocale,
  locales: [...locales],
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      // `entrypoints` is WXT-only — drop it on CRXJS and plain Vite, where all
      // source lives under `src/`. Keeping a non-existent directory in `include`
      // is harmless but misleading.
      include: ['src', 'entrypoints'],
      exclude: ['**/node_modules/**', '**/.output/**', '**/.wxt/**', '**/dist/**'],
    },
  ],
  format: formatter({ lineNumbers: false }),
  compileNamespace: 'ts',
})
```

Four things matter here:

- **`formatter()` from `@lingui/format-po`, not `format: 'po'`.** The string form was removed in Lingui 6 and throws at config load.
- **`lineNumbers: false`** keeps the `#:` origin comments at file granularity. Extension UI code churns; line numbers turn every unrelated edit into catalog noise and pointless diffs in the translation service.
- **`compileNamespace: 'ts'` is not optional on this variant.** The default is `cjs`, which emits `module.exports` — Step 5's static `import` would not resolve it, and the service worker bundle is ESM. With `'ts'`, `lingui compile` writes `src/locales/<locale>/messages.ts` containing `export const messages`.
- **`locales: [...locales]`** spreads because the shared module declares its array `as const` (readonly); `defineConfig` wants a mutable `string[]`.

If a `lingui.config.*` already exists, reconcile rather than overwrite: keep the project's `catalogs[].path` if it differs, and carry the differing path through Steps 5, 7 and 11 instead of relocating catalogs the project already has.

---

## Step 5: The Runtime Modules

### `src/i18n/browser.ts` — the API shim

```ts
// src/i18n/browser.ts
// Chrome 148 (2026-05-08) shipped the `browser` namespace for all extension APIs.
// This shim keeps older Chrome working, and covers the pre-Chrome-152 bug where
// declaring `devtools_page` disabled the `browser` namespace for the whole extension.
// Never add `webextension-polyfill` — Mozilla archived it on 2026-07-30.
const g = globalThis as unknown as { browser?: any; chrome?: any }

export const browser = g.browser ?? g.chrome
```

Both APIs used below work under the shim: `i18n.getUILanguage()` is synchronous in every engine, and `storage.sync.get()` returns a promise in Chrome MV3 and in Firefox.

### `src/i18n/index.ts` — catalog activation

Every compiled catalog is imported **statically**, by name. Add one import and one map entry per locale in `locales`; there is no dynamic `import()` anywhere in this file, for the reasons in *MV3 and CSP Constraints*.

```ts
// src/i18n/index.ts
import { i18n, type Messages } from '@lingui/core'
import { browser } from './browser'
import { getDirection, resolveLocale, sourceLocale, type Locale } from './locales'

// One static import per locale. `lingui compile` writes these files
// (compileNamespace: 'ts'); they are gitignored and regenerated — see Step 11.
import { messages as en } from '../locales/en/messages'
import { messages as fr } from '../locales/fr/messages'
import { messages as ptBR } from '../locales/pt-BR/messages'

// Re-export the locale module so consumers need one import.
export * from './locales'

const catalogs: Record<Locale, Messages> = {
  en,
  fr,
  'pt-BR': ptBR,
}

/** The `browser.storage.sync` key holding the user's chosen locale. */
export const LOCALE_STORAGE_KEY = 'locale'

/**
 * Activate a locale. Synchronous — every catalog is already in the bundle.
 * Safe in every context, including the service worker and content scripts:
 * it touches no DOM.
 */
export function activateLocale(locale: string): Locale {
  const resolved = resolveLocale(locale)
  i18n.loadAndActivate({ locale: resolved, messages: catalogs[resolved] })
  return resolved
}

/**
 * Set `<html lang>` and `<html dir>`. **Extension pages only** — popup, options,
 * side panel, devtools panel. Never call this from a content script: `document`
 * there is the *host page's* document, and relabelling someone else's page
 * (or flipping it to RTL) is a visible bug in their site, not yours.
 */
export function applyDocumentLocale(locale: string): void {
  document.documentElement.lang = locale
  document.documentElement.dir = getDirection(locale)
}

/** The stored choice, falling back to the browser UI language on first run. */
export async function readStoredLocale(): Promise<Locale> {
  try {
    const stored = await browser.storage.sync.get(LOCALE_STORAGE_KEY)
    if (stored?.[LOCALE_STORAGE_KEY]) return resolveLocale(stored[LOCALE_STORAGE_KEY])
  } catch {
    // storage.sync can be unavailable (no profile sync, quota exceeded).
    // Fall through to the browser UI language rather than failing to render.
  }
  // getUILanguage() returns a hyphenated BCP-47 tag ("pt-BR"), which is what
  // resolveLocale expects. Chrome's *directory* spelling is underscored — that
  // conversion belongs in scripts/build-locales.mjs, not here.
  return resolveLocale(browser.i18n.getUILanguage())
}

/** Persist a choice. Every other open extension context reacts via storage.onChanged. */
export async function storeLocale(locale: Locale): Promise<void> {
  await browser.storage.sync.set({ [LOCALE_STORAGE_KEY]: locale })
}

/** Resolve and activate. Await this before the first render in every entrypoint. */
export async function initI18n(): Promise<Locale> {
  return activateLocale(await readStoredLocale())
}

/**
 * Re-activate whenever any context writes a new choice, so an open popup, the
 * options page and every injected content script stay in step. Returns an
 * unsubscribe function.
 */
export function onLocaleChanged(handler?: (locale: Locale) => void): () => void {
  const listener = (
    changes: Record<string, { newValue?: unknown }>,
    area: string,
  ) => {
    if (area !== 'sync' || !changes[LOCALE_STORAGE_KEY]) return
    const next = activateLocale(String(changes[LOCALE_STORAGE_KEY].newValue ?? sourceLocale))
    handler?.(next)
  }
  browser.storage.onChanged.addListener(listener)
  return () => browser.storage.onChanged.removeListener(listener)
}

export { i18n }
```

`I18nProvider` from `@lingui/react` subscribes to the `i18n` singleton, so `activateLocale` alone re-renders every React tree in that context. The optional `handler` exists for the things React does not own — `<html lang>`, `<html dir>`, and any imperative UI a content script injected by hand.

Substitute the project's real locale list everywhere the snippet shows `en` / `fr` / `pt-BR`. A locale whose tag contains a hyphen needs a quoted key in `catalogs` and a valid identifier for the import binding (`pt-BR` → `ptBR`).

---

## Step 6: `src/i18n/manifest-strings.ts`

The extension name, short name, description and toolbar tooltip are read by the browser out of the manifest before any JavaScript runs, so React can never render them. They still belong in the same catalog as everything else — otherwise the store listing drifts out of sync with the UI, and translators get them through a second, worse channel. Declaring them as `msg({ id, message, comment })` descriptors with explicit `manifest.`-prefixed ids gets `lingui extract` to sweep them into `src/locales/{locale}/messages.po` alongside the UI strings; Step 7's script pulls that prefix back out.

```ts
// src/i18n/manifest-strings.ts
import { msg } from '@lingui/core/macro'

/**
 * Copy that the *browser* reads, not React. `lingui extract` picks these up like
 * any other message; `scripts/build-locales.mjs` mirrors every `manifest.*` id
 * into public/_locales/<code>/messages.json, which is what the manifest's
 * __MSG_…__ references and the Chrome Web Store listing resolve against.
 *
 * The object keys are the Chrome message names. Nothing imports this module at
 * runtime — it exists to be extracted.
 */
export const manifestStrings = {
  ext_name: msg({
    id: 'manifest.name',
    message: 'Tab Groups Pro',
    comment:
      'Extension name. Shown in the browser UI and as the Chrome Web Store listing title. Maximum 45 characters.',
  }),
  ext_short_name: msg({
    id: 'manifest.short_name',
    message: 'Tab Groups',
    comment:
      'Short extension name, used where space is tight (the extensions menu). Chrome recommends a maximum of 12 characters.',
  }),
  ext_description: msg({
    id: 'manifest.description',
    message: 'Group, save and restore your tabs in one click.',
    comment:
      'Store listing short description, shown under the extension name in search results. Maximum 132 characters.',
  }),
  ext_action_title: msg({
    id: 'manifest.action_title',
    message: 'Open Tab Groups Pro',
    comment:
      'Tooltip shown when hovering the toolbar icon. Keep it short — it is a tooltip, not a sentence.',
  }),
}
```

Fill `message:` from the project's **current** manifest values, not invented ones — read `wxt.config.ts` / `manifest.json` first and copy what is there. Drop any key the project does not use (`short_name` is optional; an extension with no `action` has no `manifest.action_title`), and do not add ids for other manifest fields — Step 8 explains why only these four are portable.

**The `comment:` on each descriptor is not decoration.** It becomes the PO `#.` extracted comment, which Globalize shows the translator and which Step 7 copies into the `_locales` `description` field. A translator who does not know the 45-character cap will overshoot it, and the Web Store rejects the upload rather than truncating. Keep the limits in the text.

---

## Step 7: `scripts/build-locales.mjs`

This is the bridge from PO to the native format. It is plain Node ESM — no TypeScript import, so it runs identically under npm, pnpm, yarn and bun with no loader flags.

```js
// scripts/build-locales.mjs
//
// Generates the extension's native `_locales/` tree from the Lingui PO catalogs.
//
// Only ids prefixed `manifest.` are copied. Everything else stays in the PO and is
// served by Lingui at runtime. The output is build output: never hand-edit it, and
// never commit it (see Step 11).
//
// Run: node scripts/build-locales.mjs   (wired into `dev` and `build` in Step 11)

import { formatter } from '@lingui/format-po'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

// ── Configuration ────────────────────────────────────────────────────────────
// SOURCE_LOCALE must match `sourceLocale` in src/i18n/locales.ts. It is the
// locale whose text fills in for anything a target locale has not translated.
const SOURCE_LOCALE = 'en'
const PO_DIR = 'src/locales'
const OUT_DIR = 'public/_locales'
const ID_PREFIX = 'manifest.'

// Chrome's supported-locale table (~55 entries). A `_locales` directory whose name
// is not on this list is silently ignored by the browser, so emitting one would
// produce a file that never loads. Skip and warn instead.
const CHROME_LOCALES = new Set([
  'ar', 'am', 'bg', 'bn', 'ca', 'cs', 'da', 'de', 'el', 'en', 'en_AU', 'en_GB',
  'en_US', 'es', 'es_419', 'et', 'fa', 'fi', 'fil', 'fr', 'gu', 'he', 'hi',
  'hr', 'hu', 'id', 'it', 'ja', 'kn', 'ko', 'lt', 'lv', 'ml', 'mr', 'ms', 'nl',
  'no', 'pl', 'pt_BR', 'pt_PT', 'ro', 'ru', 'sk', 'sl', 'sr', 'sv', 'sw', 'ta',
  'te', 'th', 'tr', 'uk', 'vi', 'zh_CN', 'zh_TW',
])

/** BCP-47 (`pt-BR`) → Chrome's directory spelling (`pt_BR`). */
function toChromeCode(locale) {
  return locale.replace(/-/g, '_')
}

/**
 * `manifest.action_title` → `ext_action_title`.
 * Chrome message names allow only [A-Za-z0-9_@] and are compared
 * case-insensitively, so the dot has to go and near-identical names must not
 * collide. The `ext` prefix keeps generated names distinct from anything
 * hand-written, and matches the object keys in src/i18n/manifest-strings.ts.
 */
function toMessageName(id) {
  const name =
    'ext' +
    id
      .slice(ID_PREFIX.length)
      .split(/[._\-\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')
  if (!/^[A-Za-z0-9_@]+$/.test(name)) {
    throw new Error(`"${id}" maps to "${name}", which is not a legal Chrome message name.`)
  }
  return name
}

/** Parse one PO file into Lingui's catalog shape, keyed by message id. */
async function readCatalog(locale) {
  const file = path.join(PO_DIR, locale, 'messages.po')
  return formatter({}).parse(await readFile(file, 'utf8'), {
    locale,
    sourceLocale: SOURCE_LOCALE,
    filename: file,
  })
}

async function main() {
  // Every directory under src/locales that actually holds a messages.po.
  const locales = []
  for (const entry of await readdir(PO_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    try {
      await readFile(path.join(PO_DIR, entry.name, 'messages.po'))
      locales.push(entry.name)
    } catch {
      /* no catalog in this directory — ignore */
    }
  }
  if (!locales.includes(SOURCE_LOCALE)) {
    throw new Error(`No catalog for the source locale "${SOURCE_LOCALE}" under ${PO_DIR}/.`)
  }

  const source = await readCatalog(SOURCE_LOCALE)
  const manifestIds = Object.keys(source).filter((id) => id.startsWith(ID_PREFIX))
  if (manifestIds.length === 0) {
    console.warn(
      `[build-locales] No "${ID_PREFIX}*" messages in ${PO_DIR}/${SOURCE_LOCALE}/messages.po. ` +
        'Run `lingui extract` after editing src/i18n/manifest-strings.ts.',
    )
  }

  // Regenerate from scratch so a locale dropped from the project does not leave a
  // stale directory behind in the packaged extension.
  await rm(OUT_DIR, { recursive: true, force: true })

  let written = 0
  for (const locale of locales) {
    const code = toChromeCode(locale)
    if (!CHROME_LOCALES.has(code)) {
      console.warn(
        `[build-locales] Skipping "${locale}": "${code}" is not in Chrome's supported-locale ` +
          'table, so the browser would ignore the directory. The locale still ships inside the ' +
          'Lingui catalog and works in the extension UI — only the manifest and store-listing ' +
          'strings fall back to the default locale.',
      )
      continue
    }

    const catalog = locale === SOURCE_LOCALE ? source : await readCatalog(locale)
    const messages = {}
    for (const id of manifestIds) {
      const entry = catalog[id]
      // `translation` is the PO msgstr — the source text in the source-locale
      // catalog, the translation everywhere else. An untranslated target falls
      // back to the source text so every emitted file is complete. Chrome does
      // merge the active locale over default_locale, but shipping a half-written
      // file is a worse default than a duplicated English string.
      const message = (entry?.translation || '').trim() || (source[id]?.translation || '').trim()
      if (!message) continue
      // The PO's `#.` extracted comments are the notes Lingui wrote from each
      // descriptor's `comment:` field. `description` is invisible at runtime but
      // it is what Globalize and store review tooling read.
      const description = (entry?.comments ?? source[id]?.comments ?? []).join(' ')
      messages[toMessageName(id)] = description ? { message, description } : { message }
    }

    const outFile = path.join(OUT_DIR, code, 'messages.json')
    await mkdir(path.dirname(outFile), { recursive: true })
    await writeFile(outFile, JSON.stringify(messages, null, 2) + '\n', 'utf8')
    written++
  }

  console.log(`[build-locales] Wrote ${written} locale file(s) to ${OUT_DIR}/.`)
}

main().catch((error) => {
  console.error('[build-locales]', error)
  process.exit(1)
})
```

Set `SOURCE_LOCALE` to the project's real source locale from `.globalize/decisions.md`. `PO_DIR` and `OUT_DIR` must match Step 4's `catalogs[].path` and Step 1's public root; on WXT, CRXJS and plain Vite the public root is `public/`, which the build copies to the package root verbatim.

**Migrating a project that already has a hand-written `public/_locales/`.** It was on the native path. Before adding the ignore rule in Step 11, carry every existing message across: for each key in `public/_locales/<source>/messages.json`, add a descriptor to `src/i18n/manifest-strings.ts` if it is one of the four manifest fields, or wrap the corresponding UI string with a Lingui macro during the convert phase if it is not. Then `git rm -r --cached public/_locales` with the user's consent. Do not leave a hand-written `_locales` on disk next to a generated one — the script deletes the whole directory on every run, so the hand-written entries would vanish silently on the next build.

---

## Step 8: Manifest Wiring

Two edits, both in the **authored** manifest from Step 1 — never the build output.

**1. `default_locale` is mandatory once `_locales` exists.** An extension with a `_locales` directory and no `default_locale` fails to load outright. Its value is the underscored source locale (`en`, `pt_BR`).

**2. `__MSG_…__` references, in the four portable fields only:** `name`, `short_name`, `description`, `action.default_title`.

Chromium substitutes `__MSG_…__` at extension-load time for a fixed list of manifest keys (`extension_l10n_util.cc`, `LocalizeManifest`) that also includes `omnibox.keyword`, `commands.<name>.description` and the `chrome_settings_overrides.*` subkeys. **Firefox's list is schema-driven and differs**: it localizes `author`, `homepage_url` and `developer.*` as well, but its schemas do *not* mark `omnibox.keyword`, `commands.*.description` or `chrome_settings_overrides.*`. The intersection is those four fields, and this reference uses only the intersection unless the project demonstrably targets exactly one engine.

**Everything else is emitted literally.** A `__MSG_…__` in `action.default_popup`, `icons`, `content_scripts`, `permissions` or `options_ui.page` produces the literal string as a file path and a broken extension. **HTML is never substituted either** — `__MSG_ext_name__` inside `popup.html` renders as that exact text. In this variant that is a non-issue: HTML holds no copy, because React renders every visible string through Lingui.

### WXT — the `manifest:` key in `wxt.config.ts`

Already shown in full in Step 3. The four fields plus `default_locale` go in the `manifest` object; there is no `manifest.json` to edit.

### CRXJS, plain Vite — `manifest.json` or `manifest.config.ts`

```json
{
  "manifest_version": 3,
  "default_locale": "en",
  "name": "__MSG_ext_name__",
  "short_name": "__MSG_ext_short_name__",
  "description": "__MSG_ext_description__",
  "version": "1.0.0",
  "action": {
    "default_title": "__MSG_ext_action_title__",
    "default_popup": "popup.html"
  },
  "options_ui": { "page": "options.html", "open_in_tab": true },
  "background": { "service_worker": "background.js", "type": "module" }
}
```

For CRXJS's typed `manifest.config.ts`, apply the same keys in `defineManifest({...})`. Verify against the built manifest in `dist/` afterwards.

**Why this matters beyond the browser UI.** The `_locales` directories present in the uploaded package determine which locales appear in the Chrome Web Store / Edge Partner Center listing-language dropdown, and the listing's title and short description come from these `__MSG_` references. **Hardcoding `name` and `description` collapses the store listing to a single language** even when the extension itself is fully translated — the single most common failure in this area. The detailed description, screenshots and localized promo video stay dashboard-only, per locale; the Small and Marquee promo tiles are not localizable at all.

---

## Step 9: Entrypoint Bootstrap

The locale lives in `browser.storage.sync`, and reading it is asynchronous. **Every entrypoint must await it before the first render**, or the first frame paints in the wrong language and then flips.

### React roots — popup, options, side panel

```tsx
// entrypoints/popup/main.tsx   (WXT)
// src/popup/main.tsx           (CRXJS, plain Vite)
import React from 'react'
import ReactDOM from 'react-dom/client'
import { I18nProvider } from '@lingui/react'
import { applyDocumentLocale, i18n, initI18n, onLocaleChanged } from '@/src/i18n'
import { Popup } from '@/src/components/Popup'

async function start() {
  const locale = await initI18n()
  applyDocumentLocale(locale)
  // Another context (the options page, a second popup window) may switch locale
  // while this one is open. activateLocale inside the listener re-renders the
  // React tree; the handler only has to fix the document attributes.
  onLocaleChanged(applyDocumentLocale)

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <I18nProvider i18n={i18n}>
        <Popup />
      </I18nProvider>
    </React.StrictMode>,
  )
}

void start()
```

Use the project's own path alias in place of `@/` — check `tsconfig.json` `compilerOptions.paths`, and on WXT `.wxt/tsconfig.json`. Repeat this for every React root the extension has (popup, options, side panel, devtools panel); they are identical apart from the component they render. Do not centralise it into a shared `mount()` helper unless the project already has one — each entrypoint is a separate bundle and a separate JavaScript context.

### Content scripts

A content script runs inside someone else's page. Two rules follow.

```ts
// entrypoints/example.content.ts   (WXT)
// src/content.ts                   (CRXJS, plain Vite)
import { i18n, initI18n, onLocaleChanged } from '@/src/i18n'
import { getDirection } from '@/src/i18n/locales'
import { msg } from '@lingui/core/macro'

export default defineContentScript({
  matches: ['https://*.example.com/*'],
  async main() {
    const locale = await initI18n()

    const root = document.createElement('div')
    root.id = 'my-extension-root'
    // Direction goes on OUR injected root, never on document.documentElement:
    // that element belongs to the host page. This is why applyDocumentLocale()
    // is not exported for use here.
    root.lang = locale
    root.dir = getDirection(locale)
    root.textContent = i18n._(msg`Analysing this page…`)
    document.body.append(root)

    onLocaleChanged((next) => {
      root.lang = next
      root.dir = getDirection(next)
      root.textContent = i18n._(msg`Analysing this page…`)
    })
  },
})
```

On CRXJS or plain Vite there is no `defineContentScript` wrapper — put the same body inside a top-level `async function main() { … } void main()`.

If the content script mounts React (a shadow-root UI, WXT's `createShadowRootUi`), it is the React-root pattern above minus `applyDocumentLocale`: `await initI18n()`, then render inside `<I18nProvider>`, and set `dir` on the shadow host.

### The MV3 service worker

The worker is terminated and restarted at will, so module scope is **not** durable state. Kick the load off at every start and await the resulting promise inside each handler.

```ts
// entrypoints/background.ts   (WXT)
// src/background.ts           (CRXJS, plain Vite)
import { msg } from '@lingui/core/macro'
import { browser } from '@/src/i18n/browser'
import { i18n, initI18n, onLocaleChanged } from '@/src/i18n'

export default defineBackground(() => {
  // Re-runs on every worker start. No dynamic import() anywhere — the worker
  // cannot do them (w3c/webextensions#212); the catalogs are already bundled.
  const ready = initI18n()
  onLocaleChanged()

  // Listeners MUST be registered synchronously at the top level. Registering one
  // after an `await` means the worker can wake for an event with no listener
  // attached and drop it. Awaiting *inside* the handler is fine.
  browser.runtime.onInstalled.addListener(async () => {
    await ready
    browser.contextMenus.create({
      id: 'save-group',
      title: i18n._(msg`Save this tab group`),
      contexts: ['page'],
    })
  })

  browser.notifications?.onClicked.addListener(async () => {
    await ready
    // i18n is active here — safe to format.
  })
})
```

`onLocaleChanged()` is called with no handler: the worker has no DOM to update, but it must still re-activate so a notification or context-menu title created after the user switched language comes out in the new one. Context menus created in `onInstalled` do **not** re-title themselves — if the extension has menus, rebuild them in the handler (`browser.contextMenus.removeAll()` then re-create).

On CRXJS or plain Vite, drop the `defineBackground(() => { … })` wrapper and put the body at module top level.

---

## Step 10: `src/components/LanguageSwitcher.tsx`

This component is owned by *this* file, not by `setup.navigation.md` — see the note at the top. It writes the choice to `browser.storage.sync`, which is both the persistence mechanism and the broadcast channel: `browser.storage.onChanged` fires in every extension context, so the popup, the options page and every injected content script re-render from the one write.

```tsx
// src/components/LanguageSwitcher.tsx
import { useLingui } from '@lingui/react'
import {
  activateLocale,
  locales,
  localeDisplayName,
  storeLocale,
  type Locale,
} from '../i18n'

export function LanguageSwitcher() {
  const { i18n } = useLingui()

  async function switchLocale(next: string) {
    // Activate locally first so the switcher feels instant rather than waiting on
    // the storage round trip. storage.onChanged fires in this context too, so the
    // second activation is a deliberate, idempotent no-op.
    activateLocale(next)
    await storeLocale(next as Locale)
  }

  return (
    <select
      value={i18n.locale}
      onChange={(event) => void switchLocale(event.target.value)}
      aria-label="Language"
      style={{
        padding: '0.375rem 0.5rem',
        borderRadius: '0.375rem',
        border: '1px solid #d1d5db',
        backgroundColor: 'transparent',
        fontSize: 'inherit',
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
    >
      {locales.map((loc) => (
        // `lang` is the HTML attribute and keeps its own name; the value it
        // carries is a BCP-47 locale. It tells the browser to render each
        // autonym with the right font and hyphenation.
        <option key={loc} value={loc} lang={loc}>
          {localeDisplayName(loc)}
        </option>
      ))}
    </select>
  )
}
```

Three things are deliberate. **`localeDisplayName` comes from `src/i18n/locales.ts`** (via the `export *` in `src/i18n/index.ts`) and is never redefined here — it returns each language's autonym ("Deutsch", not "German"), which is what a picker must show, and caches its `Intl.DisplayNames` instances. **`useLingui()` is the runtime hook from `@lingui/react`**, not the macro; it subscribes the component to locale changes so `value={i18n.locale}` stays correct when another context switches. And there is **no `document.documentElement` write** — that belongs to `applyDocumentLocale`, wired once per page entrypoint in Step 9. A switcher that also wrote it would be a second source of truth, and would be wrong the moment it is reused inside a content script's shadow UI.

**Where to mount it.** The options page is the natural home; the popup too if that is the extension's main surface. Import it into that entrypoint's root component, inside `<I18nProvider>`:

```tsx
import { LanguageSwitcher } from '@/src/components/LanguageSwitcher'

// inside the options page component:
<section>
  <h2><Trans>Language</Trans></h2>
  <LanguageSwitcher />
</section>
```

**Styling**: the inline styles are a baseline. Adapt to the project's CSS approach (Tailwind, CSS Modules) and the surrounding UI. Extension popups are small — a `<select>` is the right control; a row of links is not, because there is nowhere to navigate to.

---

## Step 11: Catalog Scripts and `.gitignore`

### Scripts

Add the extract and compile scripts, and **prepend** `lingui compile && node scripts/build-locales.mjs && ` to `dev`, `build`, and any packaging script — prefix the existing value, never replace it.

WXT:

```json
{
  "scripts": {
    "lingui:extract": "lingui extract --clean",
    "lingui:compile": "lingui compile",
    "dev": "lingui compile && node scripts/build-locales.mjs && wxt",
    "build": "lingui compile && node scripts/build-locales.mjs && wxt build",
    "zip": "lingui compile && node scripts/build-locales.mjs && wxt zip"
  }
}
```

CRXJS and plain Vite:

```json
{
  "scripts": {
    "lingui:extract": "lingui extract --clean",
    "lingui:compile": "lingui compile",
    "dev": "lingui compile && node scripts/build-locales.mjs && vite",
    "build": "lingui compile && node scripts/build-locales.mjs && vite build"
  }
}
```

**Both commands must run before the extension is built, packaged or served.** The compiled catalogs and `public/_locales/` are not in git, so every fresh clone and every CI run starts without them: `lingui compile` produces the modules Step 5 imports, and `build-locales.mjs` produces the directory the manifest's `__MSG_` references resolve against. A build missing the second one either fails to load ("Localization used, but default locale wasn't specified") or ships an extension named `__MSG_ext_name__`.

**Do not use a `prebuild` hook** — pnpm ≥7 disables pre/post scripts by default and Yarn Berry dropped them entirely, so it would silently no-op for half the package managers this skill supports. **`zip` needs the prefix too** on WXT: that is the command that produces the store upload, and it is the one place where a missing `_locales` costs a rejected submission rather than a broken dev build. Call the binaries directly (`lingui compile && …`), not through `npm run`, so the scripts work under npm, pnpm, yarn and bun alike.

Known limitation: in dev, a `.po` edited after startup (a Globalize delivery pulled mid-session) needs a dev-server restart, because the compile ran at startup.

### `.gitignore`

Append to the project's root `.gitignore`, creating it if missing. In guided mode show the diff first. If an equivalent rule is already present, skip — this step is idempotent.

```gitignore
# Lingui compiled catalogs — regenerated by `lingui compile`
src/locales/*/messages.ts
src/locales/*/messages.js
src/locales/*/messages.d.ts

# Native _locales bridge — regenerated by `node scripts/build-locales.mjs`
public/_locales/
```

The two rules are deliberately different shapes:

- **The compiled catalogs get extension-scoped patterns**, because the compiled `messages.ts` is a *sibling* of the committed `messages.po` in the same directory. Never `src/locales/`, never `src/locales/*/messages.*` — either would swallow the `.po`, which is the translation source of truth and the file Globalize imports from the repo in Phase 4. `*.ts` already covers `*.d.ts`; the anchored `messages.ts` form does not, hence the explicit line.
- **`public/_locales/` is a whole-directory rule**, because every byte under it is generated. Nothing else lives there.

Self-check before moving on (all three must hold):

```bash
git check-ignore -v src/locales/en/messages.ts      # prints the matching rule → ignored
git check-ignore    src/locales/en/messages.po      # exits 1, prints nothing → still tracked
git check-ignore -v public/_locales/en/messages.json # prints the matching rule → ignored
```

**Already-tracked artifacts.** `.gitignore` does not untrack files. If `git ls-files` shows compiled catalogs or a `public/_locales/` tree already committed (an existing project, or a re-run), tell the user and, with their consent:

```bash
git rm --cached --quiet -r public/_locales src/locales/*/messages.ts
```

The files stay on disk; git stops tracking them. Ignoring these paths is only safe because both generators run before every build — do not do one without the other.

---

## Verification

Run, in order:

```bash
lingui extract --clean
lingui compile
node scripts/build-locales.mjs
npx tsc --noEmit
npm run build
```

- **`lingui extract --clean`** reads `src/` (and `entrypoints/` on WXT) and writes `src/locales/<locale>/messages.po`. Confirm the source catalog holds the four `manifest.*` ids with their `#.` comments — if not, the macro transform is not running, or `manifest-strings.ts` is outside the config's `include`.
- **`lingui compile`** turns the `.po` files into `src/locales/<locale>/messages.ts`. If it emits `.js` with `module.exports`, `compileNamespace: 'ts'` is missing from `lingui.config.ts`.
- **`node scripts/build-locales.mjs`** writes `public/_locales/<code>/messages.json`. Open the source-locale file and confirm it holds `ext_name`, `ext_short_name`, `ext_description`, `ext_action_title`, each with a `description`.
- **`tsc --noEmit`** catches a locale in `lingui.config.ts` missing from the `Locale` union or from the `catalogs` map in `src/i18n/index.ts`.
- **`npm run build`** is the real extension build. Load the unpacked output (`.output/chrome-mv3` on WXT, `dist/` otherwise) via `chrome://extensions` → *Load unpacked* and confirm the name in the extensions list is the translated one, not `__MSG_ext_name__`.

Before a store upload, `npx 'web-ext@^10' lint --source-dir .output/chrome-mv3` is worth one more run — it catches a `__MSG_` reference with no matching `_locales` key, and an absent `default_locale`, before the Web Store rejects the submission.

If any step fails, capture the error to `result.verificationResult` in your progress file and exit with `status: "failed"` per `SKILL.md §2.2`. Do not advance to Phase 3 with a broken build.

---

## Common Gotchas

- **Underscore vs hyphen.** `_locales/pt-BR/` is silently ignored; the directory must be `pt_BR`. Meanwhile `getUILanguage()` returns `pt-BR`, `Intl.*` requires the hyphenated form, and the PO directory is hyphenated. `toChromeCode()` in `build-locales.mjs` is the only place the conversion happens — do not scatter more.
- **Chrome message names are case-insensitive.** Two keys differing only in case are one key at runtime, and one silently wins. The all-lowercase `ext_` + underscore scheme used here cannot collide that way, and it matches the native variant's catalog so the two paths read identically.
- **A locale outside Chrome's ~55-entry table.** The build script skips it with a warning. The locale still works inside the extension UI — only the manifest and store strings fall back. If the user needs it in the store listing, there is nothing to do about it; it is a browser limitation.
- **Missing `default_locale`.** A `_locales` directory with no `default_locale` in the manifest makes the extension fail to load outright.
- **`__MSG_` in HTML or in a non-listed manifest field.** Never substituted — it renders literally, and in `action.default_popup` it produces a broken path. Only the four portable fields.
- **`i18n.setMessagesCompiler`.** Never ship it. It works in the Vite dev server and dies under the packaged extension's CSP.
- **Dynamic `import()` in the service worker.** Fails at runtime. If a helper reaches for one, it does not belong in code the worker can reach.
- **`document` in a content script.** It is the host page's. Writing `documentElement.lang` / `dir` there is a bug in someone else's site.
- **A listener registered after `await` in the service worker.** The worker can wake for an event with no listener attached and drop it. Register synchronously; await inside.
- **Store listing collapsed to one language.** Caused by hardcoding `name` / `description` in the manifest — see Step 8.
- **`webextension-polyfill`.** Archived 2026-07-30. Never add it; the shim in Step 5 covers everything used here.
- **Macros not expanding.** `<Trans>` rendering its raw message id, or the runtime error *"The macro you imported from `@lingui/react/macro` is being executed outside the context of compilation"*, means `'macros'` never reached Babel. On `@vitejs/plugin-react@6` the `babel` option does not exist and is dropped silently — see the version gate at the top of this file. On WXT, check that the macro sits under the `react: { vite: { babel: … } }` key and not under the top-level `vite`, where `@vitejs/plugin-react`'s options cannot reach it.
- **Safari.** `browser.i18n.getMessage()` has open reports of returning empty strings after `safari-web-extension-converter`. Warn; do not claim it works.

---

## Coding rules + optional add-ons

First apply the **core coding-rules section** of `references/languages/js-ts/frameworks/webext/setup.add-ons.md` (step `generate_coding_rules`) — it always runs, whatever the user selected, because Phase 3 wraps against the file it generates. It renders `references/languages/js-ts/libraries/lingui/rules.template.md` down to this project's one configuration and writes `.agents/globalize-rules.md`. Then apply the **second core section** (step `install_coding_rules`), which points `CLAUDE.md` (`@.agents/globalize-rules.md`) and `AGENTS.md` (a pointer section) at the generated file — it always runs too. Finally, if the user selected any optional add-ons in `SKILL.md §1.10` (ESLint plugin, CI/CD integration, test setup wrapper, `web-ext lint` in CI), apply the matching sub-steps from the same file. Skip add-ons the user did not select.

If any target locale is RTL (`ar`, `he`, `fa`, `ur`), offer the separate **`css-i18n`** skill to convert physical CSS properties to logical ones — extension popups and options pages need it as much as any web page, and this reference does not duplicate its work.
