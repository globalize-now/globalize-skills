---
name: paraglide-code
user_invocable: false
description: >-
  Apply automatically whenever writing or modifying UI code in a Paraglide JS /
  SvelteKit project (PO/gettext catalog format) — new components, new strings,
  edited copy, new form fields, anything that adds or changes user-visible text.
  Not user-invocable. Ensures strings, numbers, currencies, dates, plurals, and
  translator comments are authored correctly as code is written.
---

# Paraglide JS Coding Rules

> These coding rules are for the **default PO (gettext) catalog format**. If your project uses the **ICU-JSON** catalog format instead, a different passive-rules file applies: `references/languages/js-ts/libraries/paraglide/json-format.code.md`. The project's `CLAUDE.md` `@import` points at whichever one matches the chosen format.

Apply these rules as you write code. Paraglide is **compiler-based and key-authored**: you write the message into the source PO catalog yourself (there is no extraction step), then call the generated message function. Every user-visible string must have a catalog entry and be called through `m` before the task is complete.

These rules assume **Paraglide JS 2.x** on **SvelteKit (SSR)** with the **PO (gettext) plugin** running in ICU mode. Messages live in flat `messages/{locale}.po` files: each `msgid` is the Paraglide key and each `msgstr` is the ICU MessageFormat 1 body. ICU parsing depends on the plugin's `"messageFormat": "icu"` setting (configured at setup) — you just write ICU bodies as usual; that setting is why ICU works inside `.po`.

---

## Message decision tree

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
  YES → add the entry to messages/{baseLocale}.po, call m.key()
```

Check the plural question first. A plain string with a number baked in (`"You have 3 messages"`) hardcodes English number agreement and breaks every language with different plural rules.

### Authoring workflow

1. Add the entry to the **source** catalog `messages/{baseLocale}.po` (the base locale, e.g. `messages/en.po`):

   ```po
   #. <translator comment — what this string is, audience, tone>
   msgid "<descriptive_key>"
   msgstr "<ICU body>"
   ```

   `msgid` is the Paraglide key (→ `m.key()`); `msgstr` is the ICU body. `#.` is the translator comment.
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

The argument names must match the `{placeholder}` names in the `msgstr` exactly.

**Localized links:**
```svelte
<a href={localizeHref('/about')}>{m.about()}</a>
```

---

## Plurals, select, ordinal

Any time a string's wording depends on a number — singular/plural nouns, subject-verb agreement, anything count-sensitive — use ICU inside the `msgstr`, not a JS conditional. This matches the ICU conventions used across this skill family (lingui, next-intl, vue-i18n).

**Plural:**
```po
#. Number of likes on a post
msgid "likes"
msgstr "{count, plural, one {# like} other {# likes}}"
```
```ts
m.likes({ count })
```

**Select (gender, status, type):**
```po
#. Reaction line under a post; g is the reacting user's gender
msgid "reaction"
msgstr "{g, select, male {He liked it} female {She liked it} other {They liked it}}"
```
```ts
m.reaction({ g })
```

**Ordinal (1st, 2nd, 3rd):**
```po
#. Finishing position in a race, e.g. "1st"
msgid "rank"
msgstr "{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}"
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
- Keep all branches in **one** `msgstr` — never split them into separate entries.

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

## ICU-mode caveats (footguns)

The PO plugin parses `msgstr` as ICU, not as plain gettext. A few things behave differently than you might expect:

- **Escaping is ICU apostrophe-based, not backslash.** Use `'{'` to emit a literal `{`, and `''` to emit a literal `'`. This matters for elision languages — French `l'{article}` must be written so the apostrophe and placeholder both survive ICU parsing (e.g. `l''{article}` for a literal apostrophe before the placeholder).
- **ICU markup like `<b>…</b>` is treated as literal text.** Do not put HTML or component tags inside a `msgstr` — they will render as literal characters. Compose formatting in markup instead (wrap the message in the element, or split the copy).
- **A malformed ICU `msgstr` is silently imported as literal text — no build error.** If a string renders as raw `{count, plural, …}` on screen, the ICU body is malformed or the plugin's `"messageFormat": "icu"` setting is missing.

---

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

---

## Translator comments — use `#.`

The PO catalog **carries translator comments**. Every entry should have a one-line `#.` comment above its `msgid` describing the string's intent, audience, and tone. This is the single biggest quality lever for AI-assisted and human translation — it tells the translator what the string means and where it appears, and it flows through to the Globalize platform.

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

(Note: the inlang SDK model has no comment field, so the plugin drops `#.` when it imports the `.po` into its internal model. But the comment lives in the `.po` file on disk, which is what Globalize reads — so it still reaches translators. Always write the `#.`.)
