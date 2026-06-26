# SvelteKit + Paraglide Setup

This covers wiring **Paraglide JS 2.x** into a **SvelteKit 2.x** project running **Svelte 5** (runes era). Paraglide is compiler-based and key-authored: there is no extraction step — you author messages directly into `messages/{locale}.po` and call the generated `m` functions. This file sets up the build plugin, server middleware, routing, and a language switcher; the per-edit authoring rules live in `references/languages/js-ts/libraries/paraglide/code.md`.

## Scope

- **In scope:** SvelteKit (SSR/adapter-based) projects only.
- **Out of scope (v1):** Plain Vite + Svelte SPAs (no SvelteKit). Paraglide works there, but the request-scoped SSR locale resolution, `reroute`, and `hooks.server.ts` wiring below are SvelteKit-specific. Do not apply this file to a non-SvelteKit Svelte project.

### Version targets and legacy notes

- **Primary target:** SvelteKit 2.x + Svelte 5 + Paraglide 2.x.
- **Svelte 4** works with Paraglide 2.x but is not the primary target — the language-switcher component below uses Svelte 5 runes (`$props`, `$derived`); on Svelte 4 rewrite it with `export let` / `$:` reactive statements.
- **SvelteKit < 2.3:** the `reroute` hook was added in `@sveltejs/kit` 2.3.0, so it is absent on 1.x and on early 2.0–2.2. **Recommend the user upgrade to SvelteKit ≥ 2.3** before proceeding — without `reroute`, URL-based locale routing requires a different (deprecated) approach this file does not cover. Hard-stop and ask before continuing on SvelteKit < 2.3.
- **Existing Paraglide 1.x (`@inlang/paraglide-sveltekit` adapter):** Paraglide 2.x replaced the dedicated SvelteKit adapter with the framework-agnostic `reroute` + `handle` model shown here. If the project has `@inlang/paraglide-sveltekit` installed, this is a **migration**, not a fresh setup — flag it to the user, remove the old adapter, and re-wire using the hooks below. Do not run both in parallel.

## Catalog format

This file documents the **default** catalog format: **PO (gettext)** with ICU message bodies, via the `@globalize-now/paraglidejs-po-format` plugin reading `messages/{locale}.po`. A fresh Paraglide setup uses this format because a `.po` catalog carries `#.` translator comments that flow to the Globalize platform (the single biggest quality lever for AI translation), which the ICU-JSON model cannot.

The alternative is **ICU-JSON** (flat `messages/{locale}.json` via `@inlang/plugin-icu1`, no translator comments). It is the right choice only for an **already-configured** project that wants to stay on JSON. When `decisions.setup.catalogFormat === "json"`, apply `references/languages/js-ts/libraries/paraglide/json-format.setup.md` — it **overrides** the *Packages*, *`project.inlang/settings.json`*, *Seed catalog*, *Verify*, and *Translator comments* sections below. Every other section here (Vite plugin, hooks, app.html, routing, switcher, `.gitignore`) is shared by both formats.

## Packages

Paraglide ships as a single package:

**Detect the package manager first.** Check for a lockfile in the project root: `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` / `bun.lock` → bun, `package-lock.json` → npm. Use the detected manager for the install command.

**Example (npm):**

```bash
npm install -D '@inlang/paraglide-js@^2'
```

Equivalents: `pnpm add -D '@inlang/paraglide-js@^2'`, `yarn add -D '@inlang/paraglide-js@^2'`, `bun add -D '@inlang/paraglide-js@^2'`. The caret is single-quoted so zsh's `EXTENDED_GLOB` does not eat it.

The **PO catalog plugin** (`@globalize-now/paraglidejs-po-format`) is **not** an npm dependency — like the ICU plugin, it is loaded at config time via a CDN module URL in `project.inlang/settings.json` (see below). inlang fetches and runs the module from that URL at compile time, so there is nothing to `npm install` (this is verified: the compiler resolves the plugin from the URL with no `node_modules` entry).

### The `sv add paraglide` scaffold — reconciliation

`npx sv add paraglide` is the vendor's canonical scaffold and will wire most of the files below for you. **It is not the default path here** because:

1. It pins `@inlang/paraglide-js` to its own caret range (e.g. `^2.15.2`), which may not match this repo's `^2` pin convention — so the pin still needs reconciling afterward.
2. It defaults to the **non-ICU** `@inlang/plugin-message-format` writing JSON, not the PO + ICU format this setup uses.

So the **default path is the manual wiring below**, under pin control. The `sv add` route is allowed only as a documented pinning **exception** (mirroring the `@lingui/swc-plugin` exact-pin exception in the repo CLAUDE.md): if you run `npx sv add paraglide`, you MUST afterward (a) edit `package.json` to pin `@inlang/paraglide-js` to `^2` and reinstall, and (b) replace the scaffolded message-format plugin in `project.inlang/settings.json` with the PO plugin (swap the module URL and the plugin settings key, add `"messageFormat": "icu"`) per the settings section below. If you are not going to enforce both, use the manual path.

## `project.inlang/settings.json`

Create `project.inlang/settings.json`. The PO plugin owns the message catalogs — list **only** the PO module (it must not coexist with another catalog-owning plugin such as `@inlang/plugin-icu1` or the default `@inlang/plugin-message-format`):

```json
{
  "baseLocale": "en",
  "locales": ["en", "fr"],
  "modules": [
    "https://cdn.jsdelivr.net/npm/@globalize-now/paraglidejs-po-format@0.1/dist/index.js"
  ],
  "plugin.globalizeNow.po": {
    "pathPattern": "./messages/{locale}.po",
    "messageFormat": "icu"
  }
}
```

- Set `baseLocale` to the project's source language and `locales` to every locale the project ships.
- **The CDN module URL is what inlang loads and runs at compile time** — pin it. `@0.1` resolves the latest `0.1.x`, which is the first ICU-capable line (ICU support landed in `0.1.2`). This mirrors the icu1 plugin's `@1` pin and keeps the loaded version reproducible. Do not drop the `@0.1` — an unpinned URL would float to a future `0.2` with breaking changes.
- `plugin.globalizeNow.po` is the settings key the plugin reads. `pathPattern` must contain `{locale}` and end in `.po`.

> **`messageFormat: "icu"` is required and load-bearing.** The default is `"plain"`, which reads only `{name}`-style placeholders and renders ICU `plural` / `select` / `selectordinal` bodies as **literal text** — silently, with no build error. Without `"messageFormat": "icu"` every plural and select message in the project is broken. Always set it.

Then create the base-locale catalog with a sample message and an ICU plural. A `.po` file opens with the required empty-`msgid` header block:

```po
# messages/en.po
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\n"
"Language: en\n"
"MIME-Version: 1.0\n"

#. Greeting shown on the dashboard
msgid "hello_world"
msgstr "Hello, {name}!"

#. Number of likes on a post
msgid "likes"
msgstr "{count, plural, one {# like} other {# likes}}"
```

- The empty `msgid ""` header block is required by the PO spec; keep `Content-Type` and `Language`.
- `msgid` is the **Paraglide message key** — `hello_world` compiles to `m.hello_world()`. `msgstr` is the **ICU message body**.
- `#.` lines are translator comments — the reason to use PO. Write a one-line intent note per message.
- Only the base-locale file needs entries to make code compile; the other locale files are populated by the translation platform. (Authoring conventions — plurals, select, descriptive keys, comments — are in `paraglide/code.md`.)

## Vite plugin

Add the Paraglide Vite plugin to `vite.config.ts` (or `.js`), alongside the existing `sveltekit()` plugin. Compiled output goes to `src/lib/paraglide/`:

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'

export default defineConfig({
  plugins: [
    sveltekit(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/lib/paraglide',
      strategy: ['url', 'cookie', 'baseLocale'],
    }),
  ],
})
```

The `strategy` array sets locale-resolution ordering — see "Locale and routing strategy" below for why `cookie` matters under SSR. Keep existing plugins in the array; just add `paraglideVitePlugin()`.

With `outdir: './src/lib/paraglide'`, the compiler emits `messages.js` and `runtime.js` under `$lib/paraglide/`, so import them as `$lib/paraglide/messages.js` and `$lib/paraglide/runtime.js` (keep the `.js` extension — that is what the compiler emits and SvelteKit resolves).

## `src/hooks.server.ts`

The server hook runs Paraglide's middleware around each request. `paraglideMiddleware` resolves the request's locale, stores it in request-scoped context (AsyncLocalStorage) so `getLocale()` and the `m` functions read it automatically, and hands back the localized request. The `transformPageChunk` callback rewrites two placeholders in the served HTML:

```ts
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit'
import { paraglideMiddleware } from '$lib/paraglide/server.js'
import { getTextDirection } from '$lib/paraglide/runtime.js'

const paraglideHandle: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
    event.request = localizedRequest
    return resolve(event, {
      transformPageChunk: ({ html }) =>
        html
          .replace('%lang%', locale)
          .replace('%dir%', getTextDirection(locale)),
    })
  })

export const handle: Handle = paraglideHandle
```

If `src/hooks.server.ts` already exists with other `handle` logic (auth, headers), compose it with SvelteKit's `sequence()` rather than overwriting — show the user the merged version before writing.

**`%lang%` / `%dir%` are user-defined placeholder tokens**, not reserved Paraglide names. They must match exactly between the `.replace()` calls here and the `app.html` tokens below — the pair only works if both files agree. `getTextDirection(locale)` returns `'ltr'` or `'rtl'`.

## `src/hooks.ts`

The universal `reroute` hook strips the locale prefix from the URL before SvelteKit matches it against your routes, so you do not have to create a `[locale]` route directory. `deLocalizeUrl` maps a localized URL back to the canonical (de-localized) path:

```ts
// src/hooks.ts
import type { Reroute } from '@sveltejs/kit'
import { deLocalizeUrl } from '$lib/paraglide/runtime.js'

export const reroute: Reroute = (request) => deLocalizeUrl(request.url).pathname
```

`reroute` requires SvelteKit 2.x — see the version note above if the project is on 1.x.

## `src/app.html`

Change the `<html>` tag to use the placeholder tokens the server hook rewrites. The HTML `lang` and `dir` attributes stay as attribute names; only their values become placeholders:

```html
<!-- src/app.html -->
<html lang="%lang%" dir="%dir%">
```

These `%lang%` / `%dir%` tokens must match the `.replace()` calls in `src/hooks.server.ts` exactly.

## Locale and routing strategy

The `strategy` array (set in the Vite plugin) is the ordered list of sources Paraglide checks to resolve the active locale per request. The recommended ordering is:

```ts
strategy: ['url', 'cookie', 'baseLocale']
```

- **`url`** — locale taken from the URL (e.g. `/fr/about`). This is what `localizeHref()` and the `reroute` hook operate on. Maps to **prefixed** routing.
- **`cookie`** — locale read from a cookie. **Required for SSR correctness:** on the first document request the server cannot read `localStorage` or `navigator.language`, so without a server-readable source the server would render the wrong locale and hydration would mismatch. The cookie gives the server a locale it can read on that first request. `setLocale()` (below) writes this cookie.
- **`baseLocale`** — final fallback to `baseLocale` from `settings.json`.

**Prefix vs. no-prefix routing** is governed by the strategy and Paraglide's URL patterns:

- With `url` in the strategy, non-base locales are served under a path prefix and the base locale stays unprefixed by default — `/about` (base) and `/fr/about` (French). The `reroute` hook de-localizes the prefixed path so your single set of routes serves every locale.
- To prefix **every** locale (including the base), or to customize the prefix shape, configure `urlPatterns` on the Vite plugin. The exact `urlPatterns` object shape varies by Paraglide minor — **look it up in the Paraglide docs for the installed version before emitting it**; do not guess the shape. If the user just wants the default prefix behavior, omit `urlPatterns` entirely.

If the user does not want URL-based locales at all, drop `url` from the strategy and rely on `['cookie', 'baseLocale']` — the locale then follows the cookie only, with no per-locale URLs.

## Language switcher

Create a small Svelte 5 component that switches locale and offers localized links. `setLocale()` updates the active locale (and writes the cookie used by the `cookie` strategy), and `localizeHref()` builds locale-correct hrefs:

```svelte
<!-- src/lib/LocaleSwitcher.svelte -->
<script lang="ts">
  import { locales, getLocale, setLocale } from '$lib/paraglide/runtime.js'

  const current = $derived(getLocale())
  const displayNames = new Intl.DisplayNames([getLocale()], { type: 'language' })
</script>

<nav>
  {#each locales as locale}
    <button
      onclick={() => setLocale(locale)}
      aria-current={locale === current ? 'true' : undefined}
    >
      {displayNames.of(locale) ?? locale}
    </button>
  {/each}
</nav>
```

Wire it into the root layout so it appears on every page:

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import LocaleSwitcher from '$lib/LocaleSwitcher.svelte'
  let { children } = $props()
</script>

<LocaleSwitcher />
{@render children()}
```

By default `setLocale()` reloads so the server re-renders under the new locale (correct under SSR). Use `localizeHref('/path')` for in-app links that should carry the active locale's prefix; see `paraglide/code.md` for the markup conventions. Style the switcher to match the project (the inline markup above is a baseline).

## `.gitignore`

The compiled output in `src/lib/paraglide/` is generated by the Vite plugin and must not be committed. Add:

```
# Paraglide compiled output
src/lib/paraglide/
```

## Verify

1. Compile: `npx '@inlang/paraglide-js@^2' compile --project ./project.inlang --outdir ./src/lib/paraglide`. It should complete and emit `messages.js` / `runtime.js` under `src/lib/paraglide/`. (The Vite plugin also recompiles on dev/build; this is a standalone sanity run.)
2. Start the dev server (`npm run dev` or the detected manager's equivalent). It should boot without errors and the page should render the sample message. Switch locale via the switcher — the visible text changes and (with `url` in the strategy) the URL gains the locale prefix; reloading that URL keeps the chosen locale (cookie + URL persistence working under SSR).
3. **Render a plural and confirm it selects the correct form.** Call `m.likes({ count: 1 })` and `m.likes({ count: 5 })` somewhere on a page and confirm the output is `1 like` and `5 likes` — **not** the raw `{count, plural, …}` source and not an empty string. Raw-source output means `messageFormat: "icu"` is missing (or the plugin URL is below `0.1.2`); fix that before continuing. This check is non-negotiable — it is the only signal that ICU is actually being evaluated (a malformed or unparsed ICU body is imported as literal text with no build error).
4. Run the production build (`npm run build`) and confirm it completes — a missing or misconfigured `project.inlang/settings.json` surfaces here.

## Optional add-ons

If the user selected optional add-ons (coding-rules `@import`, CI/CD, test setup), apply the matching sub-steps from `references/languages/js-ts/libraries/paraglide/setup.add-ons.md`. Skip add-ons the user did not select; skip this section entirely if none were selected.

## Translator comments

**The PO catalog carries translator comments — use them.** Each entry can take a `#.` comment line above its `msgid`:

```po
#. Button that removes an item from the shopping cart
msgid "cart_remove_button"
msgstr "Remove"
```

A `#.` comment is the single biggest quality lever for AI-assisted and human translation, and Globalize reads it straight from the `.po`. Write one per message — see the authoring guidance in `paraglide/code.md` and `paraglide.convert.md`.

> The plugin drops `#.` comments when it hydrates the inlang model at compile time (they do not reach `m.key()`), but they **live in the `.po` that Globalize imports**, so they reach translators. That round-trip is what makes them worth writing. (The ICU-JSON alternative has no comment field at all — another reason PO is the default.)

## ICU-mode caveats

`messageFormat: "icu"` makes `msgstr` bodies full ICU MessageFormat. A few rules differ from plain PO text:

- **Escaping is ICU apostrophe-based, not backslash.** `'{'` → literal `{`, `'}'` → literal `}`, `''` → a literal `'`. This matters for elision languages — French `l'{article}` must be written `l''{article}` or the apostrophe is consumed.
- **ICU tags / markup (`<b>…</b>`) are literal text.** There is no rich-text / embedded-component message support — markup in `msgstr` renders verbatim. Compose formatting in markup instead.
- **A malformed ICU `msgstr` is imported verbatim as literal text — with no build error.** A typo in a `plural` body silently renders the raw `{count, plural, …}` source. The plural check in the Verify step exists to catch exactly this.

## Migration: existing ICU-JSON → PO

For a project where Paraglide is **already** set up with `messages/{locale}.json` and the `@inlang/plugin-icu1` plugin, and the user now wants the default PO format. The conversion is **lossless** — both formats use ICU bodies, so no transpilation is needed; only the envelope changes.

1. **Edit `project.inlang/settings.json`** — replace the `@inlang/plugin-icu1` module URL with the PO module URL (`@0.1`), drop the `plugin.inlang.icu-messageformat-1` key, and add the `plugin.globalizeNow.po` key **with `"messageFormat": "icu"`** (see the settings section above). Only one catalog-owning plugin may remain.
2. **Rewrite each `messages/{locale}.json` to `messages/{locale}.po`.** For every `"key": "ICU body"` entry, emit:

   ```po
   #. optional translator comment
   msgid "key"
   msgstr "ICU body"
   ```

   Carry `{name}` interpolation, ICU `plural` / `select` / `selectordinal`, and `=N` exact matches across **verbatim** — both sides are ICU, so nothing is rewritten. Add the required empty `msgid ""` header block (with `Content-Type` and `Language`) at the top of each file. Add `#.` comments where you have intent to record — this is the upgrade PO buys you.
3. **Delete the old `messages/{locale}.json`** files.
4. **Recompile** (`npx '@inlang/paraglide-js@^2' compile …`) and run the Verify step above (the plural-render check is essential — a botched ICU escape fails silently).

This is parallelizable: the per-file rewrite in step 2 is independent across locales, so it can be dispatched as background parallel subagents (one per `messages/{locale}.json`). **Caveats that bite during migration** (see "ICU-mode caveats"): apostrophes in JSON values become ICU-significant in PO — re-escape `l'{article}` → `l''{article}`; `<b>…</b>` markup that "worked" in a JSON string is literal text under ICU and stays literal.
