# Browser Extension Native Messages (`chrome.i18n`) — Setup

Browser extensions ship localization built into the platform — there is **nothing to install**. Every MV3
engine (Chrome, Edge, Firefox) reads `_locales/<code>/messages.json` from the packaged extension, picks a
catalog from the browser UI language, and exposes it through `browser.i18n.getMessage('key')`. The same
mechanism substitutes `__MSG_key__` in a fixed list of `manifest.json` fields at load time, which is what
localizes the Chrome Web Store / Edge Partner Center listing. It works identically in the popup, the options
page, the side panel, content scripts and the MV3 service worker — no bundler integration, no compile step,
no dependency.

What it deliberately **cannot** do, and you must design around:

- **No plurals, no select, no ICU, no number/date formatting.** There is no `{count, plural, …}`. Step 7 gives
  the hand-rolled `key_one` / `key_other` + `Intl.PluralRules` workaround, honestly labelled as a workaround.
- **At most 9 substitutions per message.** Chrome returns `undefined` past the ninth.
- **HTML is never substituted.** `__MSG_key__` inside a `.html` file renders literally. The universal
  workaround is a `data-i18n` DOM pass (Step 6).
- **The UI language follows the browser.** `getMessage()` takes no locale argument and there is no
  `setLocale`. An in-extension language picker requires the custom-loader mode in Step 6, which loads the
  catalogs itself and re-implements the fallback chain.

This setup phase locates the extension's pieces, creates the source catalog, scaffolds the target locales,
wires the manifest, installs the runtime accessor, adds the plural helper, and installs the coding rules.

Follow these steps in order. Each builds on the last.

---

## Out of Scope

This setup phase covers the **native `chrome.i18n` / `_locales` mechanism** on **MV3** extensions. It does
**not** cover:

- **The Lingui extension variants** (`webext-babel-lingui`, `webext-swc-lingui`). Those author in PO, get real
  CLDR plurals and ICU, and *generate* `_locales` as build output. They are selected at `SKILL.md §1.5` and
  have their own setup references. If the user picked Lingui, you are reading the wrong file.
- **`@wxt-dev/i18n`.** Its plural scheme is `0`/`1`/`n` only — no `few`/`many` — so Arabic, Russian, Polish,
  Czech and Croatian degrade. Do not set it up and do not recommend it. It is a tracked follow-up.
- **Manifest V2.** MV2 is hard-stopped upstream (`SKILL.md §1.2`): Chrome disabled it for all users in Chrome
  138 and removed the last Web Store listings in August 2026. You will only ever see `manifestVersion: 3`.
- **Safari verification.** `safari-web-extension-converter` output has open, unresolved reports of
  `browser.i18n.getMessage()` returning empty strings (wxt-dev/wxt#1400). **Warn the user; do not claim it
  works.** Everything here is verified on Chrome/Edge/Firefox MV3 only.
- **Converting existing hardcoded strings** — that is the convert phase (`webext-native.convert.md`). This
  phase only scaffolds infrastructure.

---

### Step Risk Classification

| Step | Risk | Notes |
|------|------|-------|
| 1. Locate the pieces | Read-only | No changes to the project |
| 2. (No install) | None | `chrome.i18n` is platform-built-in — nothing to add |
| 3. Source catalog `_locales/<sourceLocale>/messages.json` | Additive | New/edited source file; if one exists, augment, don't clobber |
| 4. Scaffold target-locale catalogs | Additive | New per-locale `messages.json`; does not touch existing locale dirs |
| 5. Wire the manifest | **Modifies existing file** | Adds `default_locale` and rewrites `name`/`description`/… to `__MSG_` — describe and confirm |
| 6. Runtime accessor | Additive (+ edits entrypoints) | New `src/i18n/*` modules; the entrypoint wiring edits existing files |
| 7. Plural helper | Additive | New module; inert until a plural key exists |
| 8. Generate + wire coding rules | Additive (+ edits `CLAUDE.md` / `AGENTS.md`) | Writes `.agents/globalize-rules.md` via `setup.add-ons.md` and points `CLAUDE.md` and `AGENTS.md` at it — **always runs**, Phase 3 wraps against it |

**RULE: Steps that modify existing files require you to describe the exact change to the user and get
confirmation before proceeding. Do NOT silently modify existing project files.** _(Modified by the setup mode
chosen below.)_

**Every step is independently re-runnable.** Before acting, detect the already-applied state (a `_locales`
dir, a `default_locale` key, an existing `src/i18n/`) and skip that step without prompting.

---

## Setup Mode

After Step 1 (detection) completes without blockers, ask the user — unless `.globalize/decisions.md` already
records a setup mode, in which case use it and do not re-ask:

> **How would you like to proceed with the setup?**
> 1. **Guided** — I'll explain each step before and after, and you'll confirm changes to existing files.
> 2. **Unguided** — I'll run all steps without pausing and show a full summary at the end.

### Guided mode rules
- **Before each step**: briefly explain what will happen and why.
- **After each step**: summarize what changed (files created, files modified).
- Consent gates for "Modifies existing file" steps still apply.
- Optional choices still prompt the user.

### Unguided mode rules
- Execute all steps without pausing for per-step explanations or confirmations.
- Consent gates for "Modifies existing file" steps are **suspended**.
- Hard stops (Step 1 checks) still halt execution.
- "MUST wait for the user" lines are **overridden** by the unguided-defaults table below when a default exists.
- At the end, produce a `## Setup Complete` summary (what was done / files created / files modified / defaults
  applied / next steps), matching the shape used by the other setup references.

#### Unguided defaults

| Choice | Unguided default | Rationale |
|--------|------------------|-----------|
| **`_locales` root** | Derived from `extensionFramework` (Step 1 table) | Each build tool has exactly one directory that ends up at the package root |
| **Source locale** | `decisions.setup.sourceLocale`; else the manifest's existing `default_locale`; else `en` | `default_locale` *is* the source by definition once one exists |
| **Target locales** | `decisions.setup.targetLocales`; otherwise one locale, `es` | One additional locale validates the pipeline |
| **Locale switching** | `decisions.setup.localeSwitcher`; absent → `"native"` | Zero extra code, and the browser does the fallback for you |
| **Manifest `__MSG_` fields** | The four **portable** fields only (`name`, `short_name`, `description`, `action.default_title`) | The other Chromium-localizable fields are not localized by Firefox |
| **`data-i18n` DOM pass** | Installed when the extension has any `.html` entrypoint | HTML is never substituted; without the pass, popup/options text stays in the source language |
| **Plural helper** | Installed | ~20 lines, inert until a `_one`/`_other` key pair exists |

---

## Step 1: Locate the Extension's Pieces

`.globalize/detection.json` already carries `framework: "webext"`, `extensionFramework`, `manifestVersion: 3`
and `compiler`. This step turns `extensionFramework` into two concrete paths: **where the manifest is
authored** and **where `_locales` must go so it lands at the package root**.

The browser requires `_locales/` at the **root of the packaged extension**, beside the final `manifest.json`,
so author it where the build tool copies it verbatim. Record the resolved path; every later step calls it
`<localesRoot>`, and always edit the **authored** manifest, never the build output.

| `extensionFramework` | Manifest source of truth | Author `_locales` at |
|---|---|---|
| `wxt` | **Generated** — the `manifest:` key inside `wxt.config.ts` (`.js`/`.mjs`). There is no checked-in `manifest.json`; editing one would be a no-op. | `public/_locales/` (WXT copies `public/` to the output root verbatim) |
| `crxjs` | `manifest.json` at the repo root, **or** `manifest.config.ts` when the project uses CRXJS's typed config (imported by `vite.config.ts`) | `public/_locales/` |
| `vite-plain` | `public/manifest.json`, or `manifest.json` at the repo root | `public/_locales/` |
| `plasmo` | **Generated** from `package.json` (`displayName`, `description`, `version`) plus the `manifest` override key there. Verify against the emitted `build/chrome-mv3-dev/manifest.json` after a build. | `assets/_locales/` (Plasmo also accepts a top-level `locales/`) |
| `webpack` | Wherever `CopyWebpackPlugin` copies it *from* — commonly `src/manifest.json` or `public/manifest.json`. Read `webpack.config.*` for the source path. | Wherever `CopyWebpackPlugin` targets the output root — default `public/_locales/` |
| `none` | `manifest.json` at the repo root. It *is* the shipped file. | `./_locales/` beside `manifest.json` |

### Other signals to read

| Signal | How to detect |
|--------|--------------|
| **Existing `_locales`** | `ls <localesRoot>` and glob `**/_locales/*/messages.json`. Any hit → this is a **re-run**: augment, never clobber. Existing dir names are underscored Chrome codes; normalize to BCP-47 to compare with `decisions.setup.targetLocales`. |
| **Existing `default_locale`** | The `default_locale` key in the authored manifest. If present it is the source locale — do not silently change it. |
| **HTML entrypoints** | Glob `**/*.html` outside `node_modules`/`dist`/`.output`. WXT keeps them under `entrypoints/`; CRXJS/Vite at the root or under `src/`. These need the `data-i18n` pass. |
| **Service worker** | `background.service_worker` in the manifest, or `entrypoints/background.ts` (WXT), `src/background.ts` |
| **Content scripts** | `content_scripts[].js` in the manifest, or `entrypoints/*.content.ts` (WXT) |
| **Existing `browser`/`chrome` usage** | `grep -rn 'chrome\.\|browser\.' src entrypoints` — tells you whether the project already has a shim |
| **`webextension-polyfill`** | In `package.json` deps. **Archived by Mozilla 2026-07-30.** Do not add it; if present, note that the three-line shim in Step 6 supersedes it (removing it is out of scope for this phase). |
| **Git repository / branch** | `git rev-parse --is-inside-work-tree`; `git branch --show-current` |

### Checks

| Check | Action |
|-------|--------|
| **`manifestVersion === 2`** | Already hard-stopped by the orchestrator (`SKILL.md §1.2`). If you somehow see it here, **STOP**. |
| **`extensionFramework === "plasmo"`** | **Warn (non-blocking).** Plasmo's last release and last `main` commit are both 2025-05-17 with several hundred issues open — treat it as unmaintained. The native path works on it. |
| **Source locale not in Chrome's supported table (Step 4)** | Return `status: "needs_decision"` with a `needsDecision` describing the problem: the browser silently ignores an unsupported `_locales` dir, and an unsupported `default_locale` makes the extension fail to load. Let the orchestrator pick a supported source locale. |
| **Safari target** (`safari-web-extension-converter` in scripts, an `*.xcodeproj` beside the extension) | **Warn (non-blocking).** `browser.i18n.getMessage()` has open reports of returning empty strings after conversion. |

### Branch Recommendation

If the project is a git repo and the current branch is `main`, `master`, or `develop`, recommend a dedicated
branch (`git checkout -b chore/i18n-setup`) before modifying files, as the other setup references do. Skip
silently on a feature branch or no git repo.

If no blockers, proceed to the **Setup Mode** prompt before Step 3.

---

## Step 2: No Install

There is **no package to install**. `_locales` loading, `__MSG_` manifest substitution, locale fallback and
`browser.i18n.getMessage()` are all part of the extension platform. The variant's manifest entry declares
`"runtime": []` and `"dev": []`, so the orchestrator's Phase 2.0 install step is a **no-op** here — do not run
an installer.

Two packages you might be tempted by, and must not add:

- **`webextension-polyfill`** — archived by Mozilla on 2026-07-30 ("this polyfill has served its purpose")
  after Chrome 148 shipped the `browser` namespace for all extension APIs. Use the three-line shim in Step 6.
- **`@wxt-dev/i18n`** — see *Out of Scope*.

The only package this skill ever runs for an extension is `npx 'web-ext@^10' lint` in the verify step, which is
a one-off `npx` invocation, not a dependency.

This also sidesteps MV3's CSP entirely. Extension pages are locked to
`script-src 'self' 'wasm-unsafe-eval'; object-src 'self';` and Chrome refuses to install an extension that
relaxes it — no `unsafe-eval`, no remotely-hosted code. Nothing in this path evaluates a string or fetches
code, so there is nothing to configure.

---

## Step 3: Create the Source Catalog

The source catalog is `<localesRoot>/<sourceLocale>/messages.json`, where `<sourceLocale>` is the **underscored
Chrome spelling** (Step 4). It is a flat JSON object — **no namespaces, no nesting**. Each entry is
`{"message": …, "description": …, "placeholders": {…}}`; only `message` is required.

**Additive** — if the file already exists, inspect it and augment; do **not** overwrite real entries. Globalize
keys off a populated source file, so ensure it has real entries before connecting in Phase 4.

```json
// public/_locales/en/messages.json
{
  "ext_name": {
    "message": "Tab Tidy",
    "description": "Extension name. Shown in the browser's extension list and as the Chrome Web Store listing title. Hard limit: 45 characters. Keep the product name untranslated unless the team has an approved localized brand."
  },
  "ext_short_name": {
    "message": "Tab Tidy",
    "description": "Short name, used where space is tight (the browser menu). Hard limit: 12 characters."
  },
  "ext_description": {
    "message": "Group, mute and close tabs in one click.",
    "description": "Store-listing short description, shown under the name in store search results. Hard limit: 132 characters."
  },
  "ext_action_title": {
    "message": "Open Tab Tidy",
    "description": "Tooltip on the toolbar icon."
  },
  "popup_heading": {
    "message": "Quick actions",
    "description": "Heading at the top of the popup (popup.html), directly above the action buttons."
  },
  "options_synced_from": {
    "message": "Settings synced from $device$ at $time$.",
    "description": "Status line on the options page. $device$ is a user-chosen device name (do not translate it). $time$ is an already-formatted local time string.",
    "placeholders": {
      "device": { "content": "$1", "example": "Ada's laptop" },
      "time":   { "content": "$2", "example": "14:05" }
    }
  }
}
```

Rules that bite (full authoring rules land in the project's generated `.agents/globalize-rules.md` — Step 8):

- **Key charset is `A-Z a-z 0-9 _ @` only.** No dots, no dashes, no spaces. `popup.heading` is illegal.
- **Keys are case-insensitive.** `popupHeading` and `popupheading` are the *same* key — the second silently
  wins. Pick one casing convention and hold it; this file uses `surface_element_purpose` snake_case.
- **`@@` is reserved.** Keys beginning `@@` belong to the browser's predefined messages (`@@extension_id`,
  `@@ui_locale`, `@@bidi_dir`, `@@bidi_reversed_dir`, `@@bidi_start_edge`, `@@bidi_end_edge`). Never author one.
- **`description` is the only translator-comment channel the format has**, and Globalize surfaces it to
  translators. Write one for every entry. See `webext-native.convert.md` for the heuristic.
- **Placeholders** are referenced as `$name$` in the body (matching is case-insensitive) and declared under
  `placeholders` with `content` of `$1`–`$9` and an `example`. `$$` escapes a literal `$`.
- **Maximum 9 substitutions.** A tenth makes `getMessage()` return `undefined`.

---

## Step 4: Scaffold Target-Locale Catalogs

### BCP-47 → Chrome directory spelling

Chrome spells locale directories with an **underscore**, while every BCP-47 code in `.globalize/decisions.md`
uses a hyphen. `browser.i18n.getUILanguage()` returns the **hyphenated** form. This asymmetry is the single
most common bug in extension i18n.

```
pt-BR → pt_BR        zh-CN → zh_CN        en-GB → en_GB        es-419 → es_419
de    → de           fr    → fr           ja    → ja
```

Rule: `locale.replace(/-/g, '_')` going to disk, `code.replace(/_/g, '-')` coming back for `Intl.*`.

### Chrome's supported-locale table (~55 entries)

A `_locales` directory whose name is not in this list is **silently ignored** — no error, no warning, the
strings simply never appear:

```
ar  am  bg  bn  ca  cs  da  de  el  en  en_AU  en_GB  en_US  es  es_419
et  fa  fi  fil fr  gu  he  hi  hr  hu  id  it  ja  kn  ko
lt  lv  ml  mr  ms  nl  no  pl  pt_BR  pt_PT  ro  ru  sk  sl  sr
sv  sw  ta  te  th  tr  uk  vi  zh_CN  zh_TW
```

If a configured target locale is **not** in the table (e.g. `nb`, `is`, `zh-Hant-HK`), do **not** create the
directory. Tell the user plainly which locales were skipped and why, and offer the nearest supported code
(`nb` → `no`, `zh-Hant-HK` → `zh_TW`). In guided mode ask; in unguided mode skip the locale and list it in the
`## Setup Complete` summary. Never create a directory the browser will ignore — it looks like it works.

### The fallback chain

**Chrome / Edge — three steps.** Exact match → language with the region stripped → `default_locale`:

```
browser UI = en_GB   → _locales/en_GB  → _locales/en  → _locales/<default_locale>
browser UI = es_419  → _locales/es_419 → _locales/es  → _locales/<default_locale>
```

**Firefox — four steps.** Same, plus script subtags: `zh-Hans-CN` → `zh-Hans` → `zh` → `default_locale`.

`getMessage()` returns an **empty string** for a key it cannot find anywhere, so a gap surfaces as blank UI,
not as an error. Keep every target catalog complete — the verify step in `webext-native.convert.md` requires
full key coverage.

### Scaffold

For each supported target locale, create `<localesRoot>/<chrome_code>/messages.json` mirroring the source
keys. Copy the source `message` values as placeholders (never leave `message` absent — the entry would be
malformed) and **carry the `description` and `placeholders` blocks across verbatim** so translators see the
same context in every file.

```json
// public/_locales/es/messages.json
{
  "ext_name":        { "message": "Tab Tidy", "description": "Extension name. Hard limit: 45 characters." },
  "ext_description": { "message": "Agrupa, silencia y cierra pestañas con un clic.", "description": "Store-listing short description. Hard limit: 132 characters." },
  "popup_heading":   { "message": "Acciones rápidas", "description": "Heading at the top of the popup (popup.html)." },
  "options_synced_from": {
    "message": "Ajustes sincronizados desde $device$ a las $time$.",
    "description": "Status line on the options page. $device$ is a device name (do not translate). $time$ is preformatted.",
    "placeholders": { "device": { "content": "$1", "example": "Ada's laptop" }, "time": { "content": "$2", "example": "14:05" } }
  }
}
```

> The `placeholders` block must be repeated in **every** locale file — it is per-entry, not inherited from the
> default locale. A target entry that uses `$device$` without declaring it renders the literal text `$device$`.

---

## Step 5: Wire the Manifest

Two edits, both in the **authored** manifest from Step 1 (never the build output).

**1. `default_locale` is mandatory once `_locales` exists.** An extension with a `_locales` directory and no
`default_locale` fails to load. Its value is the underscored source locale.

**2. `__MSG_key__` references, in the portable fields only.**

### The exact Chromium-localizable field list

Chromium substitutes `__MSG_…__` at extension-load time for a **fixed** list of manifest keys
(`extension_l10n_util.cc`, `LocalizeManifest`):

`name`, `short_name`, `description`, `browser_action.default_title` (MV2), `page_action.default_title` (MV2),
`action.default_title` (MV3), `omnibox.keyword`, `file_browser_handlers[].default_title`,
`input_components[].name`, `input_components[].description`, `app.launch.local_path`, `app.launch.web_url`,
`commands.<name>.description`, every `chrome_settings_overrides.search_provider.*` subkey,
`chrome_settings_overrides.homepage`, `chrome_settings_overrides.startup_pages[]`.

**Firefox's list differs** — it is schema-driven, not a C++ list. Firefox additionally localizes `author`,
`homepage_url`, `developer.*` and `browser_action.default_popup` / `page_action.default_popup`, but its schemas
do **not** mark `omnibox.keyword`, `commands.*.description` or `chrome_settings_overrides.*`.

> **Portable across both engines: `name`, `short_name`, `description`, `action.default_title`. Use only those
> four unless the project targets exactly one engine.** This is the unguided default.

**Everything else is never substituted.** `action.default_popup`, `icons`, `content_scripts`, `permissions`,
`options_ui.page`, `host_permissions` — a `__MSG_…__` there is emitted **literally**, producing a popup path of
`__MSG_popup_file__` and a broken extension. **And HTML is never substituted at all**: `__MSG_key__` inside
`popup.html` renders as the literal text `__MSG_key__`. Use the `data-i18n` pass in Step 6.

### WXT — `wxt.config.ts`

```ts
// wxt.config.ts
import { defineConfig } from 'wxt'

export default defineConfig({
  manifest: {
    default_locale: 'en',
    name: '__MSG_ext_name__',
    short_name: '__MSG_ext_short_name__',
    description: '__MSG_ext_description__',
    action: {
      default_title: '__MSG_ext_action_title__',
      default_popup: 'popup.html',   // NOT localizable — never put __MSG_ here
    },
  },
})
```

### Plain `manifest.json` (CRXJS, plain Vite, webpack, no build step)

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

For CRXJS with `manifest.config.ts`, or Plasmo's `manifest` key in `package.json`, apply the same keys in that
file's own shape and confirm against the built manifest.

### Why this matters for the store listing

The `_locales` directories present in the uploaded package determine **which locales appear in the Chrome Web
Store / Edge Partner Center listing-language dropdown**, and the listing's title and short description come
from the manifest's `__MSG_` references. **Hardcoding `name`/`description` in the manifest collapses the store
listing to a single language** even when the extension itself is fully translated — the most common failure in
this whole area. The detailed description, screenshots and localized promo video stay dashboard-only, per
locale; the Small and Marquee promo tiles are not localizable at all.

---

## Step 6: The Runtime Accessor

Everything in this step lives under `src/i18n/` (WXT projects that keep UI in `entrypoints/` still put shared
modules in `src/`). Add a barrel so call sites import from one stable path — the generated coding rules
reference `t` as coming from the project's i18n module, and the barrel keeps that true in both branches:

```ts
// src/i18n/index.ts
export { browser } from './browser'
export * from './t'        // branch A — or: export * from './loader'  (branch B)
export { localizeDocument } from './dom'
export { plural } from './plural'
```

Two branches on `decisions.setup.localeSwitcher`. Both start with the same shim.

### The `browser` shim (both branches)

```ts
// src/i18n/browser.ts
// Chrome 148 (2026-05-08) shipped the `browser` namespace for all extension APIs; this shim
// keeps older Chrome working and covers the pre-Chrome-152 bug where declaring `devtools_page`
// disabled `browser` for the whole extension. Never add `webextension-polyfill` — Mozilla
// archived it on 2026-07-30.
const g = globalThis as unknown as { browser?: any; chrome?: any }
export const browser = g.browser ?? g.chrome
export const isDev = !('update_url' in browser.runtime.getManifest())   // unpacked build
```

Both APIs used here work under the shim: `i18n.getUILanguage()` is synchronous in every engine, and
`storage.sync.get()` returns a promise in Chrome MV3 and in Firefox.

---

### Branch A — `localeSwitcher === "native"`

The browser picks the catalog. `getMessage()` is synchronous, so there is no bootstrap, no async, and no flash
of untranslated content.

```ts
// src/i18n/t.ts
import { browser, isDev } from './browser'

/** `substitutions` fills the entry's $1..$9 placeholder contents in order. Max 9 — Chrome returns undefined past the ninth. */
export function t(key: string, substitutions: string[] = []): string {
  const value = browser.i18n.getMessage(key, substitutions)
  if (value) return value
  if (isDev) console.warn(`[i18n] missing message: ${key}`)
  return key
}

/** Text direction for the active UI locale. */
export const dir = (): 'ltr' | 'rtl' =>
  (browser.i18n.getMessage('@@bidi_dir') as 'ltr' | 'rtl') || 'ltr'

/** The browser UI locale, BCP-47 and hyphenated (e.g. "en-US"). */
export const uiLocale = (): string => browser.i18n.getUILanguage()
```

`t()` is the **only** call site allowed to touch `browser.i18n.getMessage` — the convert phase and the coding
rules both assume it.

#### The `data-i18n` DOM pass (required for every `.html` entrypoint)

Mark up the HTML with data attributes; a startup pass fills them in. The source-language text stays in the
markup as a readable default and as what a reviewer sees in the diff.

```html
<!-- entrypoints/popup/index.html -->
<body hidden>
  <h1 data-i18n="popup_heading">Quick actions</h1>
  <input data-i18n-placeholder="popup_search_placeholder" placeholder="Search tabs" />
  <button data-i18n="popup_save_button" data-i18n-title="popup_save_tooltip">Save</button>
  <img src="/logo.png" data-i18n-alt="popup_logo_alt" />
  <script type="module" src="./main.ts"></script>
</body>
```

```ts
// src/i18n/dom.ts
import { t, dir, uiLocale } from './t'

const ATTRIBUTE_TARGETS = [
  ['data-i18n-placeholder', 'placeholder'],
  ['data-i18n-title', 'title'],
  ['data-i18n-aria-label', 'aria-label'],
  ['data-i18n-alt', 'alt'],
] as const

/** Replace every data-i18n marker under `root` with its translated value. */
export function localizeDocument(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = el.getAttribute('data-i18n')
    if (key) el.textContent = t(key)
  }
  for (const [dataAttr, domAttr] of ATTRIBUTE_TARGETS) {
    for (const el of root.querySelectorAll<HTMLElement>(`[${dataAttr}]`)) {
      const key = el.getAttribute(dataAttr)
      if (key) el.setAttribute(domAttr, t(key))
    }
  }
  document.documentElement.dir = dir()
  document.documentElement.lang = uiLocale()   // the HTML attribute keeps its own name
}
```

```ts
// entrypoints/popup/main.ts
import { localizeDocument } from '@/src/i18n/dom'

const start = () => { localizeDocument(); document.body.removeAttribute('hidden') }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
else start()
```

Call `localizeDocument(container)` again after any dynamic render so newly inserted nodes get translated. In
the service worker there is no DOM — just call `t()` directly in the handler.

---

### Branch B — `localeSwitcher === "custom-loader"`

The user picks the language inside the extension. **`browser.i18n.getMessage()` is NOT used in this mode** —
it has no locale argument and no `setLocale`, so it can only ever return the browser's UI language. The
standards proposal to add one (w3c/webextensions#258, opened 2022-08-19) is still open and unimplemented; do
not plan around it.

Instead, `_locales/<code>/messages.json` stays the on-disk format (so Globalize, the manifest substitution and
the store listing all keep working) and the extension reads its own catalogs over `fetch` — the same approach
Bitwarden ships. `browser.runtime.getURL()` resolves to your own extension origin, so `_locales` is readable
without any permission. **The cost is losing native fallback**, which you must re-implement.

```ts
// src/i18n/loader.ts
import { browser, isDev } from './browser'

type Entry = { message: string; placeholders?: Record<string, { content: string }> }
type Catalog = Record<string, Entry>

const DEFAULT_LOCALE = 'en'                              // must equal the manifest's default_locale
const AVAILABLE: readonly string[] = ['en', 'es', 'pt_BR']  // the _locales dirs you ship, underscored

let catalog: Catalog = {}
let activeLocale = DEFAULT_LOCALE

export const toChromeCode = (locale: string) => locale.replace(/-/g, '_')
export const toBcp47 = (code: string) => code.replace(/_/g, '-')
export const getLocale = () => activeLocale

/** Re-implements Chrome's chain: exact → base language → default_locale. */
export function resolveLocale(requested: string): string {
  const code = toChromeCode(requested)
  if (AVAILABLE.includes(code)) return code
  const base = code.split('_')[0]
  return AVAILABLE.includes(base) ? base : DEFAULT_LOCALE
}

async function loadCatalog(code: string): Promise<Catalog> {
  const url = browser.runtime.getURL(`_locales/${code}/messages.json`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`[i18n] cannot read ${url}`)
  return (await res.json()) as Catalog
}

/** Load the stored (or browser) locale. Await this before the first render. */
export async function initI18n(): Promise<string> {
  const stored = await browser.storage.sync.get('locale')
  activeLocale = resolveLocale(stored?.locale ?? browser.i18n.getUILanguage())
  const base = await loadCatalog(DEFAULT_LOCALE)
  const selected = activeLocale === DEFAULT_LOCALE ? {} : await loadCatalog(activeLocale)
  catalog = { ...base, ...selected }   // per-key fallback to the default locale
  return activeLocale
}

/** Persist a new choice. Every context reacts via storage.onChanged, below. */
export const setLocale = (locale: string) =>
  browser.storage.sync.set({ locale: toChromeCode(locale) })

export function t(key: string, substitutions: string[] = []): string {
  const entry = catalog[key]
  if (!entry) {
    if (isDev) console.warn(`[i18n] missing message: ${key}`)
    return key
  }
  let out = entry.message
  for (const [name, def] of Object.entries(entry.placeholders ?? {})) {
    const filled = def.content.replace(/\$(\d)/g, (_m, i: string) => substitutions[Number(i) - 1] ?? '')
    out = out.replace(new RegExp(`\\$${name}\\$`, 'gi'), filled)
  }
  return out.replace(/\$\$/g, '$')
}

export const dir = (): 'ltr' | 'rtl' =>
  (browser.i18n.getMessage('@@bidi_dir') as 'ltr' | 'rtl') || 'ltr'
```

> `@@bidi_dir` still comes from `browser.i18n` even here — it reflects the **browser** UI locale, not the
> chosen one. If the picker can select an RTL language while the browser is LTR, derive direction from the
> chosen locale instead: `new Intl.Locale(toBcp47(getLocale())).getTextInfo?.().direction ?? 'ltr'`, with a
> hardcoded RTL list (`ar he fa ur`) as the fallback for engines without `getTextInfo`.

#### Async bootstrap before first paint

```ts
// entrypoints/popup/main.ts
import { initI18n } from '@/src/i18n/loader'
import { localizeDocument } from '@/src/i18n/dom'   // same dom.ts, importing t/dir from loader.ts
import { browser } from '@/src/i18n/browser'

async function start() {
  await initI18n()
  localizeDocument()
  document.body.removeAttribute('hidden')          // <body hidden> ⇒ no flash of source language
}
start()

// Re-render every open context when the choice changes anywhere.
browser.storage.onChanged.addListener(async (changes: any, area: string) => {
  if (area === 'sync' && changes.locale) {
    await initI18n()
    localizeDocument()
  }
})
```

In the **service worker**, kick the load off once per worker start and await it inside each handler — the
worker terminates and restarts, so module-scope state is not durable:

```ts
// entrypoints/background.ts
import { initI18n, t } from '@/src/i18n/loader'
import { browser } from '@/src/i18n/browser'

const ready = initI18n()   // re-runs on every worker start

browser.runtime.onInstalled.addListener(async () => {
  await ready
  browser.contextMenus.create({ id: 'tidy-tabs', title: t('context_menu_tidy_tabs'), contexts: ['page'] })
})
```

Use **static imports everywhere**, including popup and options pages: MV3 forbids dynamic `import()` in the
service worker (w3c/webextensions#212 and crbug 40760920 are both still open), and one rule with no per-context
exception is worth more than a few kilobytes on local disk.

#### The language `<select>`

```html
<!-- entrypoints/options/index.html -->
<label data-i18n="options_language_label" for="locale-picker">Language</label>
<select id="locale-picker"></select>
```

```ts
// src/components/LanguagePicker.ts
import { setLocale, getLocale, toBcp47 } from '@/src/i18n/loader'

// Endonyms — a language's name in its own language. NEVER put these in the catalog:
// "Español" must read "Español" in every UI language, so translating it is a bug.
const LOCALE_LABELS: Record<string, string> = { en: 'English', es: 'Español', pt_BR: 'Português (Brasil)' }

export function mountLanguagePicker(select: HTMLSelectElement): void {
  select.replaceChildren(...Object.entries(LOCALE_LABELS).map(([code, label]) => {
    const opt = document.createElement('option')
    opt.value = code
    opt.textContent = label
    opt.lang = toBcp47(code)          // the HTML attribute keeps its own name
    opt.selected = code === getLocale()
    return opt
  }))
  select.addEventListener('change', () => void setLocale(select.value))
}
```

---

### Direction and RTL (both branches)

- `@@bidi_dir` returns `ltr` / `rtl`; `@@bidi_reversed_dir`, `@@bidi_start_edge` (`left`/`right`) and
  `@@bidi_end_edge` are also available. Set `document.documentElement.dir` from `dir()` at startup — the DOM
  pass above already does.
- Do **not** hand-write per-direction CSS here. Physical properties (`margin-left`, `text-align: left`) must be
  converted to logical properties (`margin-inline-start`, `text-align: start`). That is the job of the separate
  **`css-i18n`** skill — offer it, and do not duplicate its work in this setup.

---

## Step 7: The Plural Workaround

**`chrome.i18n` has no plural support at all** — no `{count, plural, …}`, no CLDR categories, nothing. What
follows is a **workaround**, not a feature. If the extension has more than a handful of count-bearing strings,
the Lingui variant (which has real ICU plurals) is the better answer; say so.

The convention: one catalog key per CLDR category, suffixed `_zero` / `_one` / `_two` / `_few` / `_many` /
`_other`. `_other` is mandatory — it is the fallback for every language.

```json
"inbox_count_one": {
  "message": "$count$ unread message",
  "description": "PLURAL CATEGORY ONE (English singular). One key of a plural set — see inbox_count_other. Badge text in the popup header; $count$ is the number of unread messages.",
  "placeholders": { "count": { "content": "$1", "example": "1" } }
},
"inbox_count_other": {
  "message": "$count$ unread messages",
  "description": "PLURAL CATEGORY OTHER (English plural; the required fallback for every language with no more specific form). Badge text in the popup header; $count$ is the number of unread messages.",
  "placeholders": { "count": { "content": "$1", "example": "5" } }
}
```

```ts
// src/i18n/plural.ts
import { browser } from './browser'

/**
 * Pick the right `<baseKey>_<category>` entry for `count` using CLDR rules.
 * Intl.PluralRules is available in every extension context, including the MV3
 * service worker. Pass a hyphenated BCP-47 locale, not a Chrome underscored code.
 */
export function plural(baseKey: string, count: number, locale?: string): string {
  const resolved = locale ?? browser.i18n.getUILanguage()   // already hyphenated
  const category = new Intl.PluralRules(resolved).select(count)
  const subs = [String(count)]
  return (
    browser.i18n.getMessage(`${baseKey}_${category}`, subs) ||
    browser.i18n.getMessage(`${baseKey}_other`, subs) ||
    baseKey
  )
}
```

In **custom-loader** mode, swap the two `browser.i18n.getMessage` calls for the loader's `t()` and pass
`toBcp47(getLocale())` as the locale; the shape is otherwise identical.

Call it as `plural('inbox_count', n)` — never as `n === 1 ? t('inbox_count_one') : t('inbox_count_other')`,
which is wrong in every language with more than two forms.

### Be honest about what this costs

- **The translator sees N independent keys, not one plural message.** There is no structure telling them these
  belong together. That is why **each `description` must state its plural category explicitly** (the example
  above does). Without it, a translator has no way to know that `inbox_count_one` means "the ONE category".
- **A language with more categories than the source needs keys the source does not have.** English has `one`
  and `other`; Russian needs `one`, `few`, `many`, `other`; Arabic needs all six. The selector looks up
  `${baseKey}_${category}` at runtime, so a Russian catalog that *does* define `inbox_count_few` will be used —
  but those extra keys exist only in the target file and must be added there deliberately. Confirm with the
  user that the translation workflow preserves target-only keys before promising full plural coverage.
- **No ordinals, no `select`, no gender.** `Intl.PluralRules` with `{type: 'ordinal'}` can drive the same
  suffix convention if the project needs "1st / 2nd / 3rd", but there is nothing in the format for it.

---

## Step 8: Generate Coding Rules (`generate_coding_rules` — always runs)

The browser-extension i18n coding rules are a **generated file**, not a shipped one:
`references/languages/js-ts/frameworks/webext/webext-native.rules.template.md` covers string externalization,
the `data-i18n` markup contract, `t()` usage, key charset and case-insensitivity, `description` authoring,
placeholders and the 9-substitution cap, the plural convention, manifest field legality, and what not to wrap.
Follow the **core coding-rules section** in
`references/languages/js-ts/frameworks/webext/setup.add-ons.md`: it renders the template down to this project's
one configuration — condition `localeSwitcher` picks the native or custom-loader branch, and the values
`localesDir` (the `<localesRoot>` from Step 1), `sourceLocale`, `targetLocales` and `manifestFile` (the
authored manifest from Step 1) are substituted in — then writes `.agents/globalize-rules.md`. That section carries the missing-template handling (stop in guided
mode / record a skipped-warning in unguided mode; never recreate the file) and the fail-closed rule — there is
no generic `code.md` to fall back to.

**Never skip this step**: it is not gated on a `SKILL.md §1.10` selection, because Phase 3's wrap subagents
read the generated file as their authoring contract. Then follow the **second core step** in the same file,
which points `CLAUDE.md` (`@.agents/globalize-rules.md`) and `AGENTS.md` (a pointer section) at the generated
file. It always runs too, and is likewise not a §1.10 selection.

---

## Common Gotchas

- **Underscore vs hyphen.** `_locales/pt-BR/` is silently ignored; the directory is `pt_BR`. Meanwhile
  `getUILanguage()` returns `pt-BR`, and `Intl.*` requires the hyphenated form. Convert at every boundary.
- **Case-insensitive keys.** `popupTitle` and `popuptitle` collide and one silently wins. Never rely on casing
  to distinguish keys.
- **Missing `default_locale`.** A `_locales` directory with no `default_locale` in the manifest makes the
  extension fail to load outright.
- **`__MSG_` in HTML.** Never substituted — it renders literally. Use `data-i18n`.
- **`__MSG_` in a non-listed manifest field.** `action.default_popup`, `icons`, `permissions`,
  `options_ui.page` are emitted verbatim, producing a broken path. Only the fields in Step 5 work, and only the
  four portable ones work in both Chrome and Firefox.
- **The 10th substitution.** `getMessage()` returns `undefined` — not a truncated string, not an error.
- **A literal `$` in a message.** Must be written `$$`, or the parser looks for a placeholder.
- **`_locales` in the wrong directory.** WXT/CRXJS/Vite need it under `public/`; anything under `src/` is
  bundled, not copied, and never reaches the package root. Plasmo needs `assets/_locales/`.
- **`escapeLt`.** `getMessage(key, subs, { escapeLt: true })` (Chrome 79+) escapes `<` in the **message body
  only, not in the substitutions**. Prefer `textContent` over `innerHTML`; if you must use `innerHTML`, escape
  the substitutions yourself.
- **Store listing collapsed to one language.** Caused by hardcoding `name`/`description` in the manifest — see
  Step 5.
- **Safari.** `browser.i18n.getMessage()` has open reports of returning empty strings after
  `safari-web-extension-converter`. Warn; do not claim it works.
- **`webextension-polyfill`.** Archived 2026-07-30. Never add it; the three-line shim covers everything here.

---

## Next Steps

- **Wrap existing strings** — run the convert phase (`webext-native.convert.md`): it finds user-visible text in
  the `.html` entrypoints, the `.ts`/`.tsx`/`.js` UI code, the service worker (notifications, context-menu
  titles) and the manifest, authors the catalog entries with descriptions, and replaces each literal with
  `data-i18n` / `t()` / `__MSG_`.
- **Optional add-ons** — `setup.add-ons.md` offers `web-ext lint` in CI (catches missing `_locales` keys and
  an empty or absent `messages.json` before a store upload rejects them — though not a dangling `__MSG_` reference, which the convert-phase verify owns) and a store-listing locale checklist.
- **RTL layout** — if any target locale is RTL (`ar`, `he`, `fa`), run the separate **`css-i18n`** skill to
  convert physical CSS properties to logical ones.
- **Connect a translation service** — with `<localesRoot>/<sourceLocale>/messages.json` populated, connect via
  the `globalize-now-project-setup` skill (sign in first via `globalize-now-account-setup`). The format is
  **`chrome-messages`**, the pattern is `_locales/{locale}/messages.json`, and every target locale whose code
  carries a region or script subtag needs a `pathLocales` override mapping the BCP-47 code to the underscored
  directory spelling (`pt-BR` → `pt_BR`, `zh-CN` → `zh_CN`, `es-419` → `es_419`).
