# Browser-extension support for `globalize-guide` — Design Spec

Date: 2026-08-18
Status: implemented (all three variants `supportLevel: "experimental"` pending a live round-trip)
Branch: `feat/browser-extension-support`

---

## Goal

Make `globalize-guide` handle browser extensions (Chrome / Edge / Firefox, Manifest V3) as a
first-class target: detect them, offer a real choice of catalog strategy, set up and convert
them, and connect them to Globalize with a working file pattern.

Before this change extensions failed in two distinct ways, neither of them graceful. A WXT or
CRXJS extension has a root `package.json` and `vite` in devDependencies, so §1.1 detected
`framework: "vite"` and §1.3 handed it `vite-swc-lingui` — a setup reference that wires URL
locale prefixes into a project that has no URLs. A build-less extension has no `package.json`
at all, fell through to `language: "unknown"`, and stopped with a message that told the user
nothing.

---

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Catalog strategies | **Both** native `chrome-messages` and Lingui + PO, offered at §1.5 | They are different products, not two spellings of one. Native is zero-dependency and works everywhere including build-less extensions; Lingui is the only path with real plurals, ICU and a user-selectable language. |
| Build tooling | WXT + CRXJS + plain Vite for the Lingui path; the native path additionally covers Plasmo, webpack and no build step | The Lingui macros need a Vite build. The native path needs nothing, so there is no reason to withhold it. |
| `wxt-i18n` fileFormat | **Deferred** | The platform supports it, but `@wxt-dev/i18n@0.2.7`'s plural scheme is `0`/`1`/`n` only — no `few`/`many`, so Arabic, Russian, Polish, Czech and Croatian degrade. Shipping that into a translation product would be a quiet quality regression. |
| §1.5 recommendation | Conditional on the project | `compiler === null` or `react === false` → native is the only option; a React + Vite extension → Lingui recommended, native offered. |
| Matcher axis | A new `framework` enum value, `"webext"` | Every existing JS entry declares a `framework` that is not `webext`, so the entry sets are disjoint with **no matcher-logic change at all**. Contrast iOS, which needed the `language` axis. |
| Withholding Lingui | `compiler: null` | A build-less, Plasmo or webpack extension detects `compiler: null`, so both Lingui entries fail on ordinary structural equality and only the native entry survives. No hard-stop, no special case — and the user still gets a working result. |
| Non-React extensions | Native path only in v1 | The Lingui entries declare `react: true`, so a Vue or vanilla extension reaches the native entry alone. |
| Support level | `experimental` on all three | No live Globalize round-trip yet, matching how Android and iOS shipped. |

---

## Key platform facts (verified from primary sources, August 2026)

1. **`_locales/<code>/messages.json` is mandatory and cannot be opted out of.** It is the only
   way to localize `manifest.json`, and shipping a locale directory is what makes that language
   appear in the Chrome Web Store / Edge Partner Center listing dropdown.
2. **`__MSG_key__` is substituted in exactly two places**: `manifest.json`, for a fixed key list
   (Chromium `extension_l10n_util.cc`), and `text/css` responses (`extension_localization_throttle.cc`).
   **HTML is never substituted**, contrary to several stale Chromium design docs. The portable
   manifest fields across Chromium and Firefox are `name`, `short_name`, `description` and
   `action.default_title`; the two engines' fuller lists diverge in both directions.
3. **The native format has no plurals, no ICU**, caps substitutions at 9, uses underscored
   locale directories (`pt_BR`) while `getUILanguage()` returns hyphenated codes, and
   `getMessage()` takes no locale argument — the UI language follows the browser.
   w3c/webextensions#258 would change that and has been open since 2022.
4. **The Globalize platform already ships both formats.** `chrome-messages` and `wxt-i18n` are
   in the live `fileFormat` enum on all four pattern-write endpoints, and
   `PUT /api/repositories/{repoId}/patterns/{patternId}/path-locale` exists to record a
   per-language on-disk spelling. The checked-in `api-client/src/api-types.ts` was behind by
   exactly those two enum values and that one endpoint.
5. **MV3 constraints**: extension-page CSP is `script-src 'self' 'wasm-unsafe-eval'` and cannot
   be relaxed; there is no dynamic `import()` in the service worker; no remotely-hosted code.
   Lingui is CSP-clean since v4 (plural rules come from `Intl.PluralRules`; `lingui compile`
   emits plain modules), provided `setMessagesCompiler` is never shipped.
6. **`webextension-polyfill` was archived 2026-07-30** after Chrome 148 shipped the `browser`
   namespace. New code uses `globalThis.browser ?? globalThis.chrome`.

---

## Architecture

### Native path — `webext-native-messages`

`_locales/<code>/messages.json` is both the authoring format and the runtime catalog;
`fileFormat: chrome-messages` connects it directly. Two sub-modes, chosen at §1.7 and recorded
as `decisions.setup.localeSwitcher`:

- `"native"` — `browser.i18n.getMessage()`. Zero extra code; the browser does the fallback.
- `"custom-loader"` — the Bitwarden pattern: read `_locales` over
  `fetch(browser.runtime.getURL(...))`, persist the choice in `browser.storage.sync`, and
  reimplement the fallback chain. This is the only way to give the user a language picker.

### Lingui path — `webext-babel-lingui` / `webext-swc-lingui`

`src/locales/{locale}/messages.po` is the single source of truth for **everything**, including
manifest and store copy. `_locales/` becomes generated build output rather than a second
catalog — the same architecture Dark Reader and `@wxt-dev/i18n` use (author in a richer format,
compile down to native), with PO as the source. Three pieces:

1. `src/i18n/manifest-strings.ts` — manifest and store copy as `msg({ id: 'manifest.…' })`
   descriptors, so `lingui extract` sweeps them into the same catalog as the UI.
2. `scripts/build-locales.mjs` — reads the PO catalogs, keeps `manifest.`-prefixed ids, maps
   each to a Chrome-legal message name and each locale to Chrome's underscored spelling, warns
   on locales outside Chrome's ~55-entry table, and writes `public/_locales/<code>/messages.json`.
3. `lingui compile && node scripts/build-locales.mjs` prepended to `build` and `dev` (not
   `prebuild` — pnpm and Yarn Berry skip it), with `public/_locales/` gitignored.

This resolves every constraint at once: real ICU plurals and `#.` translator comments in the
catalog, a `browser.storage`-backed picker, store-listing localization intact, and a
`fileFormat` (`po`) the platform has supported since day one.

---

## Components changed

### 1. `api-client` / `mcp-server` (hard prerequisite)

`FILE_FORMATS` is enforced client-side via Commander `.choices()` and `z.enum()`, so
`chrome-messages` was rejected before it could reach the API. Regenerated `api-types.ts`,
extended `FILE_FORMATS`, added `setPatternPathLocale` plus a `patterns path-locale` command and
MCP tool, and added `pathLocales` to `repositories create`. Both packages version-bumped.

### 2. `SKILL.md`

- §1.1: `framework: "webext"` checked **first** in the framework order; new `extensionFramework`
  and `manifestVersion` fields; `compiler` becomes nullable and is the predicate that withholds
  the Lingui variants; language-routing rule 2b for build-less extensions; `**/*.html` added to
  `candidateFiles`; `_locales` dirs normalized into `localeSignals`.
- §1.2: the two generic JS rows guarded with `framework !== "webext"`; an MV2 hard-stop; four
  non-blocking notes (Plasmo, webpack, no-build, Safari).
- §1.3: a hand-trace proving disjointness.
- §1.5: three recommendation rows and the trade-off wording.
- §1.7: the routing-strategy question skipped, replaced by a locale-source question; the
  Chrome-supported-locale warning.
- §3.5: a five-step verify block; result-field rules; §3.5.1 applies to the Lingui variant only.
- §4.1: both fileFormat mappings and the `pathLocales` derivation.

### 3. `manifest.json`

Three entries, 20 → 23 variants. The Lingui entries omit `setup.navigation.md` (URL-routing
only) and carry a two-file `references.convert`, which is a first — `SKILL.md` now states that
`convert` arrays are overlays where the framework file wins, the inverse of the `setup`
ownership rule.

### 4. References — `references/languages/js-ts/frameworks/webext/`

`webext-native.setup.md`, `webext-native.convert.md`, `webext-native.rules.template.md`,
`lingui.setup.md`, `swc/lingui.setup.md`, `lingui.convert.md`, `setup.add-ons.md`.
`libraries/lingui/setup.locale-module.md` gained two variant rows and the `LanguageSwitcher.tsx`
ownership carve-out.

### 5. Rules templates

An 8th template (`webext-native`, conditions `[localeSwitcher]`, renders 172/190 lines against a
180/205 budget), and the `lingui` template extended to v4 with an `appTarget` condition. The
extension branch costs web projects nothing — branches are eliminated at render, and the
reachable extension render is 229 lines against the 260 budget.

### 6. Evals

`fixtures/webext-wxt-react` (registered twice, once per §1.5 library choice) and
`fixtures/hard-stop/webext-mv2`, with detection, plan and hard-stop goldens.

---

## Verification

1. `cd api-client && npm run lint` — the `_allFormatsListed` guard proves `FILE_FORMATS` matches
   the regenerated schema.
2. `evals/verify-rules-template.sh` — 8 templates, zero failures.
3. Layer A over `webext-wxt-react-lingui`, `webext-wxt-react-native`, `webext-mv2`.
4. **Regression guard**: Layer A over `vite-swc`, `vite-babel`, `vite-swc-data-module`,
   `shadcn-admin`, `nextjs-app-router` — none may reclassify to `webext`. This is the highest-risk
   change in the set.
5. Manual end-to-end on a real extension, both paths: `npx 'wxt@^0.21' init`, run the guide,
   `npx 'web-ext@^8' lint`, then load the unpacked build with the browser UI language switched.
6. Live Globalize round-trip with the `chrome-messages` pattern. Until this passes, all three
   variants stay `experimental`.

---

## Out of scope (v1)

- `wxt-i18n` as a fourth variant — deferred over the plural gap; the platform format already exists.
- Vue and Svelte extensions on a JS-library path.
- Lingui on Plasmo (Parcel) or webpack extension builds.
- Firefox's larger localizable-manifest set (`author`, `homepage_url`, `default_popup`).
- Safari verification beyond the non-blocking warning — `browser.i18n.getMessage()` has open,
  unresolved empty-string reports after `safari-web-extension-converter`.
- Extending the §3.5.1 recall cleanup loop to the native variant (it needs `.html`-aware grep
  patterns).

## Open items

- Whether the `chrome-messages` handler normalizes `pt-BR` → `pt_BR` server-side. The skill emits
  explicit `pathLocales` either way, which is consistent under both answers, but the prose in
  `globalize-now-project-setup` could be simplified if normalization is automatic.
- `mcp-server`'s typecheck cannot run against the new `setPatternPathLocale` export until
  `@globalize-now/cli-client@0.1.17` is published — the repo has no workspace linking.
