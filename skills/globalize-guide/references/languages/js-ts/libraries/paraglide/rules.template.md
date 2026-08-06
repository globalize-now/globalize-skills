---
name: paraglide-code
user_invocable: false
description: >-
  Apply automatically whenever writing or modifying UI code in a Paraglide JS /
  SvelteKit project — new components, new strings, edited copy, new form fields,
  anything that adds or changes user-visible text. Not user-invocable. Ensures
  strings, numbers, currencies, dates, plurals, and translator comments are
  authored correctly as code is written.
template: paraglide
templateVersion: 2
conditions: [catalogFormat, ssr]
values: [catalogPath, sourceCatalog, sourceLocale, targetLocales, paraglideImportBase, hooksServerPath, formatModule]
budget: { "default": 200 }
---

# Paraglide JS Coding Rules

Apply these rules as you write code. Paraglide is **compiler-based and key-authored**: there is no extraction step — you write the message into the source catalog yourself, then call the generated message function. Every user-visible string must have a catalog entry and be called through `m` before the task is complete.

**This project:**
- Catalogs: `<<catalogPath>>` — one hand-authored file per locale.
- Author every new message in `<<sourceCatalog>>`, in the same change that uses it. Only that file needs the entry for code to compile; the other locales are filled by the translation platform.
- Source locale: `<<sourceLocale>>` — write every source string in this locale.
- Target locales: `<<targetLocales>>`.
<!-- if: catalogFormat == "po" -->
- Catalog format: **PO (gettext)** with ICU bodies. Each `msgid` is the Paraglide message key (`msgid "likes"` → `m.likes()`) and each `msgstr` is the **message body** — ICU MessageFormat 1, parsed as ICU because the catalog plugin is configured with `"messageFormat": "icu"`.
<!-- else -->
- Catalog format: **ICU-JSON**. Each JSON key is the Paraglide message key (`"likes"` → `m.likes()`) and each value is the **message body** — ICU MessageFormat 1.
<!-- /if -->

## Message decision tree
<!-- if: catalogFormat == "po" -->

```
Does the string's wording change based on a number (e.g. "3 items" / "1 item")?
  YES → ICU plural inside the msgstr
        #. Number of likes on a post
        msgid "likes"
        msgstr "{count, plural, one {# like} other {# likes}}"
        call: m.likes({ count })
        (see "Plurals, select, ordinal" below)

Does the string change based on a category (gender, status, type)?
  YES → ICU select inside the msgstr
        call: m.key({ g })

Does the string interpolate a value (name, count, date)?
  YES → put a {placeholder} in the msgstr, pass it as an argument
        msgid "greeting"
        msgstr "Hello, {name}!"
        call: m.greeting({ name })

Plain static text?
  YES → add the entry to <<sourceCatalog>>, call m.key()
```
<!-- else -->

```
Does the string's wording change based on a number (e.g. "3 items" / "1 item")?
  YES → ICU plural inside the message value
        "likes": "{count, plural, one {# like} other {# likes}}"
        call: m.likes({ count })
        (see "Plurals, select, ordinal" below)

Does the string change based on a category (gender, status, type)?
  YES → ICU select inside the message value
        call: m.key({ g })

Does the string interpolate a value (name, count, date)?
  YES → put a {placeholder} in the message value, pass it as an argument
        "greeting": "Hello, {name}!"
        call: m.greeting({ name })

Plain static text?
  YES → add the entry to <<sourceCatalog>>, call m.key()
```
<!-- /if -->

Check the plural question first. A plain string with a number baked in (`"You have 3 messages"`) hardcodes English number agreement and breaks every language with different plural rules.

### Authoring workflow

1. Add the entry to `<<sourceCatalog>>` in the shape below.
2. Call it as `m.key()` / `m.key({ name })` in your code.
3. The Vite plugin recompiles the generated `m` object on save — no extraction or build step to run manually.
<!-- if: catalogFormat == "po" -->

```po
#. <translator comment — what this string is, audience, tone>
msgid "<descriptive_key>"
msgstr "<ICU body>"
```

`msgid` is the Paraglide key (→ `m.key()`), `msgstr` is the ICU body, `#.` is the translator comment.
<!-- else -->

```json
{
  "<descriptive_key>": "<ICU body>"
}
```

The key is the Paraglide key (→ `m.key()`) and the value is the ICU body.
<!-- /if -->

## Imports

```ts
import { m } from '<<paraglideImportBase>>/messages.js'                       // message functions (generated)
import { getLocale, setLocale, locales, baseLocale, localizeHref } from '<<paraglideImportBase>>/runtime.js'   // runtime helpers (generated)
```

`m` is a single object holding every message function — `m.greeting`, `m.likes`, etc. Keep the `.js` extension on both paths; that is what the compiler emits and what SvelteKit resolves.

## Common Svelte patterns

**Text in markup:**
```svelte
<script lang="ts">
  import { m } from '<<paraglideImportBase>>/messages.js'
</script>

<h1>{m.dashboard()}</h1>
<p>{m.no_results()}</p>
```

**Attributes (placeholder, aria-label, title, alt):**
```svelte
<input placeholder={m.search()} aria-label={m.search()} />
```

**Interpolation:**
```svelte
<p>{m.greeting({ name: user.name })}</p>
```

The argument names must match the `{placeholder}` names in the message body exactly.

**Localized links:**
```svelte
<a href={localizeHref('/about')}>{m.about()}</a>
```

## Plurals, select, ordinal

Any time a string's wording depends on a number — singular/plural nouns, subject-verb agreement, anything count-sensitive — use ICU inside the message body, not a JS conditional.

**Plural** — call `m.likes({ count })`:
<!-- if: catalogFormat == "po" -->
```po
#. Number of likes on a post
msgid "likes"
msgstr "{count, plural, one {# like} other {# likes}}"
```
<!-- else -->
```json
{
  "likes": "{count, plural, one {# like} other {# likes}}"
}
```
<!-- /if -->

**Select (gender, status, type)** — call `m.reaction({ g })`:
<!-- if: catalogFormat == "po" -->
```po
#. Reaction line under a post; g is the reacting user's gender
msgid "reaction"
msgstr "{g, select, male {He liked it} female {She liked it} other {They liked it}}"
```
<!-- else -->
```json
{
  "reaction": "{g, select, male {He liked it} female {She liked it} other {They liked it}}"
}
```
<!-- /if -->

**Ordinal (1st, 2nd, 3rd)** — call `m.rank({ n })`:
<!-- if: catalogFormat == "po" -->
```po
#. Finishing position in a race, e.g. "1st"
msgid "rank"
msgstr "{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}"
```
<!-- else -->
```json
{
  "rank": "{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}"
}
```
<!-- /if -->

**Never** pick between two translated strings with a ternary (`count === 1 ? m.like() : m.likes()`) — that is two messages, and it bakes one language's grammar into the code.

### Rules

- `other` is **always required** — it is the fallback for every language.
- `#` is the count placeholder inside a plural/selectordinal branch — do not repeat the variable name there.
- CLDR categories: `zero`, `one`, `two`, `few`, `many`, `other` — not `singular` / `plural`. English cardinals need only `one` + `other`.
- Ordinal categories differ from cardinal — English ordinals use `one` (1st, 21st), `two` (2nd, 22nd), `few` (3rd, 23rd), `other` (4th+).
- Keep all branches in **one** message body — never split them into separate entries.
<!-- if: ssr == "true" -->

## SSR correctness

Under SSR the active locale is request-scoped. Paraglide resolves it through `paraglideMiddleware` (wired in `<<hooksServerPath>>`), which stores the locale in request-scoped context (AsyncLocalStorage). `getLocale()` and the `m` functions read from that context automatically — you do not pass a locale around.

Because the locale is request-scoped, **never read it from browser-only APIs during SSR**:

```ts
// Wrong — undefined on the server, leaks one user's locale across requests
const locale = navigator.language

// Right — request-scoped, safe on server and client
const locale = getLocale()
```

Do not cache `getLocale()` in module scope or read `window` / `navigator` / `document` in code that runs during render. Call `getLocale()` where you need it.
<!-- else -->

## Reading the active locale

The active locale is whatever Paraglide's configured strategies resolved, not what the browser reports. Read it with `getLocale()` — never from `navigator.language`, `localStorage`, or the URL directly, and never cache it in module scope:

```ts
// Wrong — bypasses the configured locale strategies
const locale = navigator.language

// Right
const locale = getLocale()
```
<!-- /if -->

## Numbers, currencies, dates

Paraglide has no formatting API. `<<formatModule>>` holds this project's presets and reads the active locale itself — never construct `Intl` at a call site:

```ts
import { formatCurrency, formatDate } from '<<formatModule>>'
formatCurrency(amount)   // not new Intl.NumberFormat(getLocale(), { style: 'currency', … })
formatDate(timestamp)
```

Need a format it has no preset for? Add one to `<<formatModule>>` — a currency code or date style written out at two call sites will drift.

**Flag for review:** `toFixed()`, currency symbols concatenated with numbers (`'$' + price`), hardcoded date formats like `'MM/DD/YYYY'`, any `new Intl.` outside `<<formatModule>>`.
<!-- if: catalogFormat == "po" -->

## ICU-mode caveats (footguns)

The PO plugin parses `msgstr` as ICU, not as plain gettext. A few things behave differently than you might expect:

- **Escaping is ICU apostrophe-based, not backslash.** Use `'{'` to emit a literal `{`, and `''` to emit a literal `'`. This matters for elision languages — French `l'{article}` must be written so the apostrophe and placeholder both survive ICU parsing (e.g. `l''{article}` for a literal apostrophe before the placeholder).
- **ICU markup like `<b>…</b>` is treated as literal text.** Do not put HTML or component tags inside a `msgstr` — they will render as literal characters. Compose formatting in markup instead (wrap the message in the element, or split the copy).
- **A malformed ICU `msgstr` is silently imported as literal text — no build error.** If a string renders as raw `{count, plural, …}` on screen, the ICU body is malformed or the plugin's `"messageFormat": "icu"` setting is missing.
<!-- /if -->

## What not to wrap

Do not give these catalog entries — they are not user-visible UI text:

- CSS class names: `class="font-bold text-sm"` — but when writing new CSS, use logical properties (`margin-inline-start`, not `margin-left`; `ms-4`, not `ml-4` in Tailwind). See the `css-i18n` skill.
- `console.log` / debug strings
- Import paths and module identifiers
- Object keys and internal codes
- `ALL_CAPS` enum values
- `data-testid` attributes
- URL strings and API paths
- **SvelteKit route IDs** (`/blog/[slug]`) and route segment names
- **`load` return values that aren't UI text** — IDs, slugs, raw API payloads. Only wrap fields that are rendered as copy.
<!-- if: catalogFormat == "po" -->

## Translator comments — use `#.`

The PO catalog **carries translator comments**. Every entry should have a one-line `#.` comment above its `msgid` describing the string's intent, audience, and tone. This is the single biggest quality lever for AI-assisted and human translation — it tells the translator what the string means and where it appears, and it flows through to the translation platform.

```po
#. Button that removes an item from the shopping cart
msgid "cart_remove_button"
msgstr "Remove"

#. Top nav link back to the landing page
msgid "nav_home_link"
msgstr "Home"
```

Write the comment for ambiguous single words, bare action labels, domain-sensitive terms, and anything whose meaning isn't obvious from the string alone (tone, formality, length constraints, where it renders).

Descriptive key names are **still** good practice — prefer `cart_remove_button` over `remove`, `nav_home_link` over `home` — but with PO the `#.` comment is the primary disambiguation lever, not the only one. Use both.
<!-- else -->

## Translator comments — not supported on ICU-JSON

The ICU-JSON message format has **no translator-comment, context, or description field** — the inlang data model does not carry one. Do **not** attempt to attach `comment:`, `context:`, or any description metadata to a JSON message; there is nowhere for it to go, and it will not round-trip.

The only disambiguation lever is a **descriptive key name**. When a bare word could be read multiple ways, encode the context in the key:

```json
{
  "cart_remove_button": "Remove",
  "nav_home_link": "Home"
}
```

Use `cart_remove_button`, not `remove`; `nav_home_link`, not `home`. The key is the translator's only signal about where the string appears and what it refers to, so make it specific for ambiguous single words, bare action labels, and domain-sensitive terms.
<!-- /if -->
