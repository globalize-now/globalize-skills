---
name: paraglide-json-code
user_invocable: false
description: >-
  Apply automatically whenever writing or modifying UI code in a Paraglide JS /
  SvelteKit project that uses the ICU-JSON catalog format — new components, new
  strings, edited copy, new form fields, anything that adds or changes
  user-visible text. Not user-invocable. Ensures strings, numbers, currencies,
  dates, and plurals are authored correctly as code is written.
---

# Paraglide JS Coding Rules (ICU-JSON catalog)

> These coding rules are for the **ICU-JSON** catalog format. The skill's **default** is the PO (gettext) format — if this project is on PO, the applicable file is `references/languages/js-ts/libraries/paraglide/code.md` instead. The project's `CLAUDE.md` `@import` points at whichever one matches the chosen format.

Apply these rules as you write code. Paraglide is **compiler-based and key-authored**: you write the message into the source JSON catalog yourself (there is no extraction step), then call the generated message function. Every user-visible string must have a catalog key and be called through `m` before the task is complete.

These rules assume **Paraglide JS 2.x** on **SvelteKit (SSR)** with the **ICU MessageFormat 1** plugin. Messages live in flat `messages/{locale}.json` files: each key maps to an ICU string.

---

## Message decision tree

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
  YES → put a {placeholder} in the JSON value, pass it as an argument
        "greeting": "Hello, {name}!"
        call: m.greeting({ name })

Plain static text?
  YES → add the key to messages/{baseLocale}.json, call m.key()
```

Check the plural question first. A plain string with a number baked in (`"You have 3 messages"`) hardcodes English number agreement and breaks every language with different plural rules.

### Authoring workflow

1. Add the key + ICU value to the **source** catalog `messages/{baseLocale}.json` (the base locale, e.g. `messages/en.json`).
2. Call it as `m.key()` / `m.key({ name })` in your code.
3. The Vite plugin recompiles the generated `m` object on save — no extraction or build step to run manually.

Only the base-locale file needs a new entry to make code compile; the other locale files are filled by the translation platform.

---

## Imports

```ts
// message functions (generated)
import { m } from '$lib/paraglide/messages.js'

// runtime helpers (generated)
import { getLocale, setLocale, locales, baseLocale, localizeHref } from '$lib/paraglide/runtime.js'
```

`m` is a single object holding every message function — `m.greeting`, `m.likes`, etc. Keep the `.js` extension on both paths; that is what the compiler emits and what SvelteKit resolves.

---

## Common Svelte patterns

**Text in markup:**
```svelte
<script lang="ts">
  import { m } from '$lib/paraglide/messages.js'
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

The argument names must match the `{placeholder}` names in the JSON value exactly.

**Localized links:**
```svelte
<a href={localizeHref('/about')}>{m.about()}</a>
```

---

## Plurals, select, ordinal

Any time a string's wording depends on a number — singular/plural nouns, subject-verb agreement, anything count-sensitive — use ICU inside the message value, not a JS conditional. This matches the ICU conventions used across this skill family (lingui, next-intl, vue-i18n).

**Plural:**
```json
{
  "likes": "{count, plural, one {# like} other {# likes}}"
}
```
```ts
m.likes({ count })
```

**Select (gender, status, type):**
```json
{
  "reaction": "{g, select, male {He liked it} female {She liked it} other {They liked it}}"
}
```
```ts
m.reaction({ g })
```

**Ordinal (1st, 2nd, 3rd):**
```json
{
  "rank": "{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}"
}
```
```ts
m.rank({ n })
```

**Never** pick between two translated strings with a ternary — it bakes one language's grammar into the code:
```ts
// Wrong — two messages, broken in many languages
count === 1 ? m.like() : m.likes()
```

### Rules

- `other` is **always required** — it is the fallback for every language.
- `#` is the count placeholder inside a plural/selectordinal branch — do not repeat the variable name there.
- CLDR categories: `zero`, `one`, `two`, `few`, `many`, `other` — not `singular` / `plural`. English cardinals need only `one` + `other`.
- Ordinal categories differ from cardinal — English ordinals use `one` (1st, 21st), `two` (2nd, 22nd), `few` (3rd, 23rd), `other` (4th+).
- Keep all branches in **one** message value — never split them into separate keys.

---

## SSR correctness

Under SSR the active locale is request-scoped. Paraglide resolves it through `paraglideMiddleware` (wired in `src/hooks.server.ts`), which stores the locale in request-scoped context (AsyncLocalStorage). `getLocale()` and the `m` functions read from that context automatically — you do not pass a locale around.

Because the locale is request-scoped, **never read it from browser-only APIs during SSR**:

```ts
// Wrong — undefined on the server, leaks one user's locale across requests
const locale = navigator.language

// Right — request-scoped, safe on server and client
const locale = getLocale()
```

Do not cache `getLocale()` in module scope or read `window` / `navigator` / `document` in code that runs during render. Call `getLocale()` where you need it.

---

## Numbers, currencies, dates

Paraglide ships no number/date formatting helper. Format with the platform `Intl` APIs, passing the active locale from `getLocale()`:

```ts
import { getLocale } from '$lib/paraglide/runtime.js'

new Intl.NumberFormat(getLocale(), { style: 'currency', currency: 'USD' }).format(amount)
new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium' }).format(new Date(timestamp))
```

**Flag for review:** `toFixed()`, currency symbols concatenated with numbers (`'$' + price`), hardcoded date format strings like `'MM/DD/YYYY'`.

---

## What not to wrap

Do not give these catalog keys — they are not user-visible UI text:

- CSS class names: `class="font-bold text-sm"` — but when writing new CSS, use logical properties (`margin-inline-start`, not `margin-left`; `ms-4`, not `ml-4` in Tailwind). See the `css-i18n` skill.
- `console.log` / debug strings
- Import paths and module identifiers
- Object keys and internal codes
- `ALL_CAPS` enum values
- `data-testid` attributes
- URL strings and API paths
- **SvelteKit route IDs** (`/blog/[slug]`) and route segment names
- **`load` return values that aren't UI text** — IDs, slugs, raw API payloads. Only wrap fields that are rendered as copy.

---

## Translator comments — not supported on ICU-JSON

Unlike Lingui or next-intl, the inlang/ICU **JSON** message format has **no translator-comment, context, or description field** — the inlang data model does not carry one. Do **not** attempt to attach `comment:`, `context:`, or any description metadata to a JSON message; there is nowhere for it to go, and it will not round-trip.

The only disambiguation lever is a **descriptive key name**. When a bare word could be read multiple ways, encode the context in the key:

```json
{
  "cart_remove_button": "Remove",
  "nav_home_link": "Home"
}
```

Use `cart_remove_button`, not `remove`; `nav_home_link`, not `home`. The key is the translator's only signal about where the string appears and what it refers to, so make it specific for ambiguous single words, bare action labels, and domain-sensitive terms.

(If translator comments would help — they are the single biggest quality lever for AI-assisted translation — switch to the default **PO** catalog format, whose rules live in `code.md`. The setup migration from ICU-JSON to PO is lossless.)
