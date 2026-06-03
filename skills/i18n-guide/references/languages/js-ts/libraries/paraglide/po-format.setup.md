# Catalog Format: PO (gettext) — Paraglide / SvelteKit

PO-specific variant of the SvelteKit + Paraglide setup. This file is a **substitution companion** to `references/languages/js-ts/frameworks/sveltekit/paraglide.setup.md`: apply it when the user has chosen `catalogFormat: po`. It provides **only** the sections that differ from the base ICU-JSON setup — packages, `project.inlang/settings.json`, the seed catalog, and verification. Substitute these in place of their JSON equivalents in the base file; **leave every other section of `paraglide.setup.md` unchanged** (see "What stays the same" below).

The catalog format swaps the inlang plugin that owns the message files (`@inlang/plugin-icu1` reading `messages/{locale}.json` → `@globalize-now/paraglidejs-po-format` reading `messages/{locale}.po`). The Paraglide compiler, runtime, and all framework wiring are identical — Paraglide compiles from the inlang model and never sees the file format.

## Why PO

The reason to pick PO over ICU-JSON here is **translator comments**. The inlang/ICU message model has no comment, context, or description field — JSON catalogs have nowhere to attach a translator note, so the only disambiguation lever there is a descriptive key name (`cart_remove_button`, not `remove`). A `.po` file carries `#.` translator-comment lines, and Globalize ingests the `.po` directly — so the comments reach translators even though the plugin drops them from the inlang model on import.

The plugin is **import-only**: it reads `.po` into the inlang model so Paraglide can compile, but it does not write `.po` back. Authoring and round-tripping of `.po` happen through your editor and the Globalize platform, not through Paraglide tooling.

## Packages

This is in **addition to** the base `@inlang/paraglide-js@^2` install. The PO plugin is a devDependency:

**Detect the package manager first** (lockfile in project root: `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` / `bun.lock` → bun, `package-lock.json` → npm), then:

```bash
npm install -D '@globalize-now/paraglidejs-po-format@^0.1.2'
```

Equivalents: `pnpm add -D '@globalize-now/paraglidejs-po-format@^0.1.2'`, `yarn add -D '@globalize-now/paraglidejs-po-format@^0.1.2'`, `bun add -D '@globalize-now/paraglidejs-po-format@^0.1.2'`. The caret is single-quoted so zsh's `EXTENDED_GLOB` does not eat it.

**Pin to `^0.1.2`, not `^0.1`.** ICU support landed in `0.1.2`; `^0.1` would admit `0.1.0` / `0.1.1`, which read ICU `plural`/`select` bodies as **literal text** with no build error. `^0.1.2` keeps the same `< 0.2.0` upper bound but raises the floor to the first ICU-capable release. Do not "simplify" it back to `^0.1`.

**This package is conditional on the user choosing PO**, so it is **not** in the manifest's static `packages`. The orchestrator pre-installs only manifest packages on the main thread (`SKILL.md` § 2.0). The setup subagent must therefore flag this install through the orchestrator's existing **`extra_install`** protocol (`SKILL.md` § 2.2): write `status: "needs_decision"` with `needsDecision: { step: "extra_install", question: "An extra package install is needed: npm install -D '@globalize-now/paraglidejs-po-format@^0.1.2'. Run it on the main thread?", options: ["yes", "skip"] }` and exit, so the orchestrator runs it on the main thread. Do not edit `manifest.json`.

## `project.inlang/settings.json`

Use this in place of the base file's ICU-JSON `settings.json`. The PO plugin **replaces** the `@inlang/plugin-icu1` module and its settings key — both plugins would claim the catalogs, and only one may own them, so list **only** the PO module:

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
- **The CDN module URL is what inlang actually loads and runs at compile time** — exactly like the base file's icu1 plugin, which is loaded from its `@1`-pinned CDN URL (and, in fact, is not npm-installed at all). So **pin the URL**: `@0.1` resolves to the latest `0.1.x`, which is the first ICU-capable line (ICU landed in `0.1.2`). This mirrors icu1's `@1` and keeps the loaded version reproducible. The npm devDependency above declares the dependency and provides editor/types; the URL pin is what governs the running plugin. (Do not drop the `@0.1` from the URL — an unpinned URL would float to a future `0.2` with breaking changes.)
- `plugin.globalizeNow.po` is the settings key the PO plugin reads. `pathPattern` must contain `{locale}` and end in `.po`.

> **`messageFormat: "icu"` is required and load-bearing.** The default is `"plain"`, which reads only `{name}`-style placeholders and renders ICU `plural` / `select` / `selectordinal` bodies as **literal text** — and it does so **silently, with no build error**. Without `"messageFormat": "icu"` every plural and select message in the project is broken. Always set it.

## Seed catalog

Use this in place of the base file's `messages/en.json`. Create `messages/{baseLocale}.po` (e.g. `messages/en.po`):

```po
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\n"
"Language: en\n"
"MIME-Version: 1.0\n"

#. Greeting shown on the dashboard
msgid "hello_world"
msgstr "Hello, {name}!"

#. Cart item count badge
msgid "cart_item_count"
msgstr "{count, plural, one {# item} other {# items}}"
```

- The empty `msgid ""` header block is required by the PO spec; keep `Content-Type` and `Language`.
- `msgid` is the **Paraglide message key** — `cart_item_count` compiles to `m.cart_item_count()`. `msgstr` is the **ICU message body**.
- `#.` lines are translator comments. They are the whole point of PO here — write a one-line intent note per message.
- Only the base-locale file needs entries to compile; the other locale files are populated by the translation platform.
- A `Plural-Forms` header maps gettext-native plurals to CLDR and is read **per file**, but with **inline ICU** plurals (as above) it is not required in the base file — omit it.

## What stays the same

Everything not listed above is identical to the base setup. Do **not** re-emit these — apply them straight from `references/languages/js-ts/frameworks/sveltekit/paraglide.setup.md`:

- **Vite plugin** (`paraglideVitePlugin`, `outdir`, `strategy`).
- **`src/hooks.server.ts`** (`paraglideMiddleware`, `%lang%` / `%dir%` rewrite).
- **`src/hooks.ts`** (`reroute` + `deLocalizeUrl`).
- **`src/app.html`** (`%lang%` / `%dir%` tokens).
- **Locale and routing strategy** (prefix vs. no-prefix, `urlPatterns`).
- **Language switcher** component and layout wiring.
- **`.gitignore`** (`src/lib/paraglide/`).

The compile command is also unchanged: `npx '@inlang/paraglide-js@^2' compile --project ./project.inlang --outdir ./src/lib/paraglide`. Compiled output still lands in `src/lib/paraglide/` (gitignored).

## ICU-mode caveats

`messageFormat: "icu"` makes `msgstr` bodies full ICU MessageFormat. Two consequences differ from `plain` mode:

- **Escaping is ICU apostrophe-based, not backslash.** `'{'` → literal `{`, `'}'` → literal `}`, `''` → a literal `'`. In `plain` mode the apostrophe is not special; in `icu` mode it is ICU-significant. This matters for elision languages — French `l'{article}` must be written `l''{article}` or the apostrophe is consumed.
- **ICU tags / markup (`<b>…</b>`) are literal text.** There is no rich-text / embedded-component message support — markup in `msgstr` renders verbatim.

And one failure mode to watch for:

- **A malformed ICU `msgstr` is imported verbatim as literal text — with no build error.** A typo in a `plural` body silently renders the raw `{count, plural, …}` source instead of throwing. The Verify step below exists to catch exactly this.

## Verify

1. Compile: `npx '@inlang/paraglide-js@^2' compile --project ./project.inlang --outdir ./src/lib/paraglide`. It should complete and emit `messages.js` / `runtime.js` under `src/lib/paraglide/`.
2. Start the dev server (`npm run dev` or the detected manager's equivalent). The page should render the sample message and the locale switcher should work (cookie + URL persistence under SSR, per the base file).
3. **Render a plural and confirm it selects the correct form.** Call `m.cart_item_count({ count: 1 })` and `m.cart_item_count({ count: 5 })` somewhere on a page and confirm the output is `1 item` and `5 items` — **not** the raw `{count, plural, …}` source and not an empty string. Raw-source output means `messageFormat: "icu"` is missing (or the plugin is below `0.1.2`); fix that before continuing. This check is non-negotiable — it is the only signal that ICU is actually being evaluated.
4. Run the production build (`npm run build`) and confirm it completes.

## Migration: existing ICU-JSON → PO

For a project where Paraglide is **already** set up with `messages/{locale}.json` and the `@inlang/plugin-icu1` plugin, and the user now wants PO. The conversion is **lossless** — both formats use ICU bodies, so no transpilation is needed; only the envelope changes.

1. **Install the PO plugin** — the devDependency from "Packages" above (via the `extra_install` protocol from a subagent).
2. **Edit `project.inlang/settings.json`** — replace the `@inlang/plugin-icu1` module URL with the PO module URL, drop the `plugin.inlang.icu-messageformat-1` key, and add the `plugin.globalizeNow.po` key **with `"messageFormat": "icu"`** (see the settings section above). Only one catalog-owning plugin may remain.
3. **Rewrite each `messages/{locale}.json` to `messages/{locale}.po`.** For every `"key": "ICU body"` entry, emit:

   ```po
   #. optional translator comment
   msgid "key"
   msgstr "ICU body"
   ```

   Carry `{name}` interpolation, ICU `plural` / `select` / `selectordinal`, and `=N` exact matches across **verbatim** — both sides are ICU, so nothing is rewritten to gettext-native plural forms. Add the required empty `msgid ""` header block (with `Content-Type` and `Language`) at the top of each file. Add `#.` comments where you have intent to record — this is the upgrade PO buys you.
4. **Delete the old `messages/{locale}.json`** files.
5. **Recompile** (`npx '@inlang/paraglide-js@^2' compile …`) and run the Verify step above.

This is parallelizable: the per-file rewrite in step 3 is independent across locales, so it can be dispatched as background parallel subagents (one per `messages/{locale}.json`).

**Caveats that bite during migration** (see "ICU-mode caveats" for detail): apostrophes in JSON values become ICU-significant in PO — re-escape `l'{article}` → `l''{article}`; `<b>…</b>` markup that "worked" in a JSON string is literal text under ICU and stays literal; `=N` exact matches carry over unchanged (they are ICU, not gettext plural categories). A botched escape produces a verbatim-literal `msgstr` with **no build error**, so re-run the plural Verify check after migrating.
