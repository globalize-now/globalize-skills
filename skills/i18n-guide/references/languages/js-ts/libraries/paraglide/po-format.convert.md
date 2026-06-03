# Catalog Format: PO (gettext) — Paraglide

PO-specific overrides for the Paraglide convert phase. Apply only when the user chose `catalogFormat: po` and setup installed `@globalize-now/paraglidejs-po-format` with `"messageFormat": "icu"`.

This is a **substitution companion** to `references/languages/js-ts/frameworks/sveltekit/paraglide.convert.md`. Read that file first — it is the base. Everything there (the conversion loop, markup/attribute/interpolation patterns, `{#each}`/conditional handling, module-scope rules, `load`/server strings, numbers/dates) holds unchanged. This file changes only **two** things:

1. The catalog **shape** — entries are `.po` `msgid`/`msgstr` pairs, not JSON key-values.
2. **Translator comments** — `#.` comments are now supported and encouraged. (The base path forbids them; PO reverses that. See below.)

Call sites in `.svelte`/`.ts` are **byte-identical to the base**: `{m.cart_remove_button()}`, `m.dashboard_greeting({ name })`, with `import { m } from '$lib/paraglide/messages.js'` unchanged.

---

## What stays the same

- `msgid` = the **Paraglide message key** — the same descriptive, context-encoding snake_case key the base path uses (`cart_remove_button`, not `remove`). It compiles to `m.cart_remove_button()`. Key-naming discipline is unchanged; see "Key naming" in the base convert.md and `paraglide/code.md`.
- `msgstr` = the **ICU message body** — the same ICU syntax used everywhere in this skill family (`{count, plural, …}`, `{g, select, …}`, `{name}`). ICU compiles to real CLDR logic **only because setup set `"messageFormat": "icu"` on the plugin** — assume it did.
- There is still **no extractor and no macro**. You author keys into the catalog and call `m.key()`. Do not run any extraction tool.

---

## What changes: `#.` translator comments are now supported — and encouraged

The base Paraglide path (and `paraglide/code.md`) say *do not add translator comments*: the inlang/ICU JSON model has no comment field, so there is nowhere to put one. **Under PO this is reversed.** A `.po` entry carries a `#.` extracted-comment line, and Globalize reads it from the `.po` — so comments flow to the translation platform.

> The plugin drops `#.` comments when it hydrates the inlang model at compile time (they do not reach `m.key()`), but they **live in the `.po` that Globalize imports**. That round-trip is what makes them worth writing.

A `#.` comment is the **single biggest quality lever for AI translation** — models use it to disambiguate tone, formality, and audience. Treat it as part of the wrap, not an afterthought. Optionally add `#:` source references too.

### The conversion loop under PO

For each hardcoded string:

1. **Choose a descriptive, context-encoding key** — the `msgid` (`cart_remove_button`, not `remove`).
2. **Add a `#.` comment** describing intent / audience / tone. ← new vs the JSON path. Optionally add `#:` source references.
3. **Write the ICU body as `msgstr`.**
4. **Replace the literal** in the component with `{m.key()}` / `m.key({ ... })`.

### Writing good descriptions

A good `#.` comment answers one of: *Where does this appear? Who reads it? What tone?* If intent is obvious (a full sentence), a one-word role is fine. For bare words, action labels, and domain terms, spell it out.

| Bad | Good |
|-----|------|
| `#. Welcome` | `#. Homepage hero heading shown to signed-out visitors` |
| `#. Button` | `#. Primary CTA on the pricing page — drives sign-up` |
| `#. Save` | `#. Save button in the document editor toolbar — not Save As` |

---

## Examples as PO entries

Each entry mirrors the base convert.md example set. Order inside an entry: comments (`#.`, `#:`) first, then `msgid`, then `msgstr`.

**Markup text:**
```
#. Remove button in the shopping cart line item
msgid "cart_remove_button"
msgstr "Remove"
```
```svelte
<button>{m.cart_remove_button()}</button>
```

**Attribute:**
```
#. Placeholder in the global search box
msgid "search_placeholder"
msgstr "Search…"
```
```svelte
<input placeholder={m.search_placeholder()} />
```

**Interpolation:**
```
#. Greeting on the dashboard, addressed to the signed-in user
msgid "dashboard_greeting"
msgstr "Hello, {name}!"
```
```svelte
<p>{m.dashboard_greeting({ name: user.name })}</p>
```

**Plural:**
```
#. Cart item count badge in the header
msgid "cart_item_count"
msgstr "{count, plural, one {# item} other {# items}}"
```
```svelte
<span>{m.cart_item_count({ count })}</span>
```

**Select:**
```
#. Activity feed line describing who reacted to a post
msgid "feed_reaction"
msgstr "{g, select, male {He liked it} female {She liked it} other {They liked it}}"
```
```svelte
<span>{m.feed_reaction({ g })}</span>
```

**Ordinal:**
```
#. Race results page — user's finishing position
msgid "race_finish_position"
msgstr "You finished {n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}"
```
```svelte
<span>{m.race_finish_position({ n })}</span>
```

The full ICU rules (CLDR categories, `#`, `other` required, selectordinal) live in `paraglide/code.md` — apply them there, don't re-derive per string.

---

## `msgctxt` — available but discouraged

This plugin folds `msgctxt` into the bundle id as `"<msgctxt>::<msgid>"`. So:

```
msgctxt "direction"
msgid "cart_right"
msgstr "Right"
```

produces the key `direction::cart_right`, which is **not** reachable via Paraglide's `m.` dot-access — you would have to call `m["direction::cart_right"]()` instead of `m.cart_right()`. That is awkward and easy to get wrong.

**Prefer distinct descriptive keys** over `msgctxt`, consistent with the key-naming guidance. When the same source text needs to diverge across UI locations, give it two keys (`cart_direction_right`, `quiz_answer_correct`), each with its own `#.` comment. Reserve `msgctxt` for cases where an external PO toolchain forces it on you.

---

## ICU-mode caveats / footguns

The plugin runs in ICU mode, which has escaping and feature rules that differ from plain PO text:

- **Escaping is ICU apostrophe-based, not backslash.** `'{'` renders a literal `{`; `''` renders a literal `'`. This bites elision languages — French `l'{article}` needs the apostrophe handled carefully so the `{article}` placeholder isn't quoted out.
- **`<b>…</b>` and other HTML in a `msgstr` is literal text**, not markup. There is no rich-text / embedded-component message via ICU — keep markup in the template and interpolate plain values.
- **ICU exact matches (`=0`, `=1`) are dropped** to CLDR keyword branches (`one`, `other`, …). Don't rely on `=0`/`=1`; author the keyword branches.
- **A malformed ICU `msgstr` is silently imported as literal text — there is no build error.** A typo'd plural ships the raw `{count, plural, …}` source to users. You must verify the rendered output (see "After conversion").

---

## Unchanged — point back, don't duplicate

For everything below, follow the base `paraglide.convert.md` and `paraglide/code.md`; do not restate it here:

- **What not to wrap** — CSS classes, debug strings, route IDs, IDs/slugs/raw `load` payloads.
- **Module-scope strings and reused constants** — store the message *function* (`m.nav_dashboard`), never call it at module load; invoke during render.
- **`load` functions and server-side strings** — call `m`/`getLocale()` directly inside the request context; never read the locale from a browser API.
- **Numbers, currencies, dates** — keep `Intl` + `getLocale()` as the safe default. ICU `number` works inside `msgstr`, but ICU `date`/`time` skeletons are **not yet runtime-verified** in this setup — use `Intl.DateTimeFormat(getLocale(), …)` for dates/times.
- **Key naming** — the descriptive-key discipline that disambiguates messages.

---

## After conversion

Compile, then run dev and build, same as the base — plus a plural-render check.

```bash
npx '@inlang/paraglide-js@^2' compile --project ./project.inlang --outdir ./src/lib/paraglide
```

Then verify:

1. The dev server boots and converted pages render the expected base-locale text.
2. Switching locale via the language switcher changes the visible copy with no missing-key warnings.
3. The production build (`npm run build` or the detected manager's equivalent) completes.
4. **Plural renders as CLDR logic, not raw ICU.** Render a plural message at `n = 5` (and `n = 1`) and confirm the output is `5 items` / `1 item`, **not** the literal string `{count, plural, one {# item} other {# items}}`. Raw ICU showing through means either `"messageFormat": "icu"` is missing from the plugin config or the `msgstr` is malformed — both fail silently at import, so this is the only check that catches them.
