# Catalog Format: ICU-JSON — Paraglide / SvelteKit

ICU-JSON variant of the SvelteKit + Paraglide setup. This file is a **substitution companion** to `references/languages/js-ts/frameworks/sveltekit/paraglide.setup.md` (which documents the **default** PO format). Apply it only when `decisions.setup.catalogFormat === "json"` — typically an already-configured project that wants to stay on ICU-JSON rather than convert to PO. It provides **only** the sections that differ from the PO base — Packages, `project.inlang/settings.json`, the seed catalog, Verify, and Translator comments. Substitute these in place of their PO equivalents; **leave every other section of `paraglide.setup.md` unchanged** (see "What stays the same" below).

The catalog format swaps the inlang plugin that owns the message files (`@globalize-now/paraglidejs-po-format` reading `messages/{locale}.po` → `@inlang/plugin-icu1` reading `messages/{locale}.json`). The Paraglide compiler, runtime, and all framework wiring are identical — Paraglide compiles from the inlang model and never sees the file format.

**Trade-off vs. the PO default:** ICU-JSON cannot carry translator comments (the inlang/ICU JSON model has no comment field), so the only disambiguation lever is descriptive key naming. If translator comments matter, prefer PO (the base file) — the migration is lossless.

## Packages

Same as the PO base: install `@inlang/paraglide-js@^2` (the Packages section of `paraglide.setup.md`). The **ICU MessageFormat plugin** is not an npm dependency either — like the PO plugin, it loads at config time via the CDN module URL in `project.inlang/settings.json` below, so do not `npm install` it.

## `project.inlang/settings.json`

Use this in place of the PO base's `settings.json`. The ICU MessageFormat 1 plugin **replaces** the default `@inlang/plugin-message-format` and must be the only catalog-owning plugin (do not list the PO module alongside it):

```json
{
  "baseLocale": "en",
  "locales": ["en", "fr"],
  "modules": [
    "https://cdn.jsdelivr.net/npm/@inlang/plugin-icu1@1/dist/index.js"
  ],
  "plugin.inlang.icu-messageformat-1": {
    "pathPattern": "./messages/{locale}.json"
  }
}
```

- Set `baseLocale` to the project's source language and `locales` to every locale the project ships.
- The module URL is pinned to **`@1`** (a major), not `@latest` — keep it pinned per repo convention.
- `plugin.inlang.icu-messageformat-1` is the settings key the ICU1 plugin reads; `pathPattern` tells it where the flat per-locale catalogs live.

## Seed catalog

Use this in place of the PO base's `messages/en.po`. Create the base-locale catalog with a sample ICU message. ICU1 catalogs are plain key → ICU-string maps with **no `$schema` key**:

```json
// messages/en.json
{
  "hello_world": "Hello, {name}!",
  "likes": "{count, plural, one {# like} other {# likes}}"
}
```

Only the base-locale file needs entries to make code compile; the other locale files are populated by the translation platform. (Authoring conventions — plurals, select, descriptive keys — are in `paraglide/rules.template.md`.)

## What stays the same

Everything not listed above is identical to the PO base. Do **not** re-emit these — apply them straight from `references/languages/js-ts/frameworks/sveltekit/paraglide.setup.md`:

- **Packages** install of `@inlang/paraglide-js@^2` (only the catalog plugin differs).
- **Vite plugin** (`paraglideVitePlugin`, `outdir`, `strategy`).
- **`src/hooks.server.ts`** (`paraglideMiddleware`, `%lang%` / `%dir%` rewrite).
- **`src/hooks.ts`** (`reroute` + `deLocalizeUrl`).
- **`src/app.html`** (`%lang%` / `%dir%` tokens).
- **Locale and routing strategy** (prefix vs. no-prefix, `urlPatterns`).
- **Language switcher** component and layout wiring.
- **`.gitignore`** (`src/lib/paraglide/`).

The compile command is also unchanged: `npx '@inlang/paraglide-js@^2' compile --project ./project.inlang --outdir ./src/lib/paraglide`.

## Verify

1. Start the dev server (`npm run dev` or the detected manager's equivalent). It should boot without errors and the page should render the sample message.
2. Switch locale via the switcher — the visible text changes and (with `url` in the strategy) the URL gains the locale prefix; reloading that URL keeps the chosen locale (cookie + URL persistence working under SSR).
3. Run the production build (`npm run build`). **Exit 0 is not the check — read the warnings.** Three outcomes, all verified against `@inlang/plugin-icu1@1.1.0` on Paraglide 2.25.2:

   - A **malformed ICU string** *does* fail the build, exit 1 — this is the one place ICU-JSON is stricter than PO, whose plugin imports an unparsed body as literal text with no build error:

     ```
      ERROR  [paraglide-js] Failed to compile project: Unexpected message end at line 1 col 45
     ✗ Build failed
     ```

   - A **missing** `project.inlang/settings.json` also fails the build, exit 1 (`ENOENT … project.inlang/settings.json`).
   - A **misconfigured** one does **not**. A wrong or misspelled `plugin.inlang.icu-messageformat-1` key, or a `pathPattern` that matches no file, hydrates zero messages; the build exits **0** and the only signal is a Rollup warning per call site:

     ```
     src/routes/+page.svelte (4:7): "hello_world" is not exported by "src/lib/paraglide/messages.js", imported by "src/routes/+page.svelte".
     ```

     **Treat any `is not exported by "…/paraglide/messages.js"` warning as a build failure.** Shipping past it produces a server that returns **500 on every page** — the missing named import bundles as `undefined`, so the first `m.*()` call throws `TypeError: (void 0) is not a function` during SSR. Step 1 above is what catches it cheaply: a page that renders the sample message cannot have an empty catalog.

## Translator comments

**Not supported on ICU-JSON.** The inlang/ICU JSON message model has no comment, context, or description field, so there is nowhere to attach translator notes — see the "Translator comments" section in `paraglide/rules.template.md`. The only disambiguation lever is a descriptive key name (`cart_remove_button`, not `remove`). Do not attempt to wire comment metadata into JSON messages. To get translator comments, use the default PO format (`paraglide.setup.md`) — its migration section converts an existing ICU-JSON project losslessly.
