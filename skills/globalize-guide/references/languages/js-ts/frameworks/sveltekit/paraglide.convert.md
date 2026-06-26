# SvelteKit + Paraglide: String Wrapping Patterns

This covers converting hardcoded UI strings in an existing **SvelteKit 2.x + Svelte 5 + Paraglide 2.x** codebase into Paraglide messages, using the **default PO (gettext) catalog format** (`@globalize-now/paraglidejs-po-format`, `messageFormat: "icu"`). The build plugin, middleware, and routing are assumed already wired (see `paraglide.setup.md`). The per-edit authoring rules — plurals, numbers/dates, what-not-to-wrap — live in `references/languages/js-ts/libraries/paraglide/code.md`; this file is the **mechanics of finding and converting existing literals**.

> **ICU-JSON catalog format?** If `decisions.setup.catalogFormat === "json"`, the catalog entries are JSON key-values and translator comments are not available — apply `references/languages/js-ts/libraries/paraglide/json-format.convert.md`, which overrides the entry shape and the comment rule below. The call sites (`m.key(...)`) are identical across both formats.

Paraglide is **key-authored and compile-from-catalog** — there is no extraction step and no macro. **Do NOT run any extractor.** For each hardcoded string, the conversion loop is:

1. **Choose a descriptive, context-encoding key** — `cart_remove_button`, not `remove`. (See "Key naming" below.)
2. **Add a `#.` translator comment** describing the string's intent / audience / tone — this is the reason to use PO and a top translation-quality lever. Optionally add `#:` source references.
3. **Add the entry** to the base catalog `messages/{baseLocale}.po` (e.g. `messages/en.po`) as `msgid "<key>"` / `msgstr "<text or ICU body>"`.
4. **Replace the literal** in the component with `{m.key()}` (or `m.key({ ... })`).

Import the message object once per file that calls it:

```ts
import { m } from '$lib/paraglide/messages.js'
```

**Order inside a `.po` entry:** comment lines (`#.`, `#:`) first, then `msgid`, then `msgstr`.

---

## Markup text

Plain text in a `.svelte` template becomes a `{m.key()}` call.

```svelte
<script lang="ts">
  import { m } from '$lib/paraglide/messages.js'
</script>

<h1>{m.dashboard_title()}</h1>
<p>{m.dashboard_empty_state()}</p>
```

```po
# messages/en.po
#. Heading at the top of the main dashboard
msgid "dashboard_title"
msgstr "Dashboard"

#. Shown on the dashboard when the user has no data yet
msgid "dashboard_empty_state"
msgstr "Nothing here yet."
```

---

## Attributes

`placeholder`, `title`, `aria-label`, `alt`, and any other user-visible attribute take the call as the attribute value:

```svelte
<input placeholder={m.search_placeholder()} aria-label={m.search_label()} />
<img src={logo} alt={m.company_logo_alt()} />
```

Leave non-UI attributes alone — `class`, `data-testid`, `href` route paths, `name`. See the skip-list in `paraglide/code.md`.

---

## Interpolation

Replace a string-concatenated or template-literal value with a `{placeholder}` in the catalog and pass the value as a named argument. The argument name must match the placeholder exactly.

```svelte
<!-- Before -->
<p>Hello, {user.name}!</p>

<!-- After -->
<p>{m.greeting({ name: user.name })}</p>
```

```po
#. Greeting on the dashboard, addressed to the signed-in user
msgid "greeting"
msgstr "Hello, {name}!"
```

Wrap the **whole sentence** as one message — never concatenate a translated fragment with a literal (`m.greeting_prefix() + user.name`), which bakes one language's word order into the code.

---

## Plurals and select

Any string whose wording changes with a number or a category (gender, status, type) is ICU **inside the `msgstr`**, not a JS conditional. Do not pick between two messages with a ternary.

```po
#. Cart item count badge in the header
msgid "cart_item_count"
msgstr "{count, plural, one {# item} other {# items}}"
```

```svelte
<span>{m.cart_item_count({ count })}</span>
```

The full ICU rules (CLDR categories, `#`, `other` required, selectordinal) are in `paraglide/code.md` — follow them there; do not re-derive them per string.

---

## `{#each}`, conditionals, and dynamic labels

Inside loops and conditionals, call the message where it renders:

```svelte
{#if items.length === 0}
  <p>{m.list_empty()}</p>
{:else}
  {#each items as item}
    <li>{item.name} — {m.list_item_added()}</li>
  {/each}
{/if}
```

When the *label* itself is data-driven (e.g. a status that maps to copy), map the value to a message function and call it at render:

```svelte
<script lang="ts">
  import { m } from '$lib/paraglide/messages.js'

  const statusLabel = {
    pending: m.order_status_pending,
    shipped: m.order_status_shipped,
    delivered: m.order_status_delivered,
  } as const
</script>

<span>{statusLabel[order.status]()}</span>
```

Note the map stores the **function reference** (`m.order_status_pending`), and the call `()` happens in markup. Never invoke `m.key()` at module/script-init time for a value used later — see the module-scope section.

---

## Module-scope strings and reused constants

Constant arrays of labels (nav items, menu entries, column headers) are usually defined once outside the render. Paraglide has **no `msg`-style descriptor**, and you must **not** call `m.key()` at module scope: the call would resolve at import time, under whichever locale was active then, and would not update per request. This contradicts the SSR rule in `paraglide/code.md` ("do not cache `getLocale()` in module scope; call where you need it").

The correct shape is to store the **message function** and invoke it during render:

```svelte
<script lang="ts">
  import { m } from '$lib/paraglide/messages.js'

  // Store the function reference, not its result
  const navItems = [
    { label: m.nav_dashboard, href: '/' },
    { label: m.nav_users, href: '/users' },
    { label: m.nav_settings, href: '/settings' },
  ]
</script>

<nav>
  {#each navItems as item}
    <a href={item.href}>{item.label()}</a>
  {/each}
</nav>
```

```po
#. Top-nav link to the dashboard
msgid "nav_dashboard"
msgstr "Dashboard"

#. Top-nav link to the users list
msgid "nav_users"
msgstr "Users"

#. Top-nav link to settings
msgid "nav_settings"
msgstr "Settings"
```

The same rule applies in `.ts` / `.svelte.ts` helper modules: export the message **functions** (or call them inside the function that runs per request), never their resolved strings stored at module load.

---

## `load` functions and server-side strings

`+page.ts` / `+layout.ts` `load`, `+page.server.ts` / `+layout.server.ts`, and form actions all run **within the `paraglideMiddleware` request context** (wired in `src/hooks.server.ts`). That means `getLocale()` and the `m` functions resolve to the request's locale — call them directly:

```ts
// +page.server.ts
import { fail } from '@sveltejs/kit'
import { m } from '$lib/paraglide/messages.js'
import type { Actions } from './$types'

export const actions: Actions = {
  save: async ({ request }) => {
    const data = await request.formData()
    const name = data.get('name')
    if (!name) {
      return fail(400, { error: m.form_name_required() })
    }
    // ...
    return { message: m.form_save_success() }
  },
}
```

Because this is server code, **never read the locale from a browser API** (`navigator.language`, `document`, `window`) — those are undefined on the server and leak one request's locale across others. `getLocale()` is the only correct source. (See the SSR section in `paraglide/code.md`.)

Only wrap fields that are rendered as **copy**. IDs, slugs, and raw API payloads returned from `load` are not UI text — leave them.

---

## Numbers, currencies, dates

Paraglide ships no formatting helper. Format with the platform `Intl` APIs, passing the active locale from `getLocale()`:

```ts
import { getLocale } from '$lib/paraglide/runtime.js'

new Intl.NumberFormat(getLocale(), { style: 'currency', currency: 'USD' }).format(amount)
new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium' }).format(new Date(timestamp))
```

When converting, flag and replace `toFixed()`, concatenated currency symbols (`'$' + price`), and hardcoded date formats (`'MM/DD/YYYY'`). Details in `paraglide/code.md`. (ICU `number` skeletons inside `msgstr` also work, but ICU `date`/`time` skeletons are not yet runtime-verified in this setup — prefer `Intl` for dates/times.)

---

## Translator comments — write them

Unlike the ICU-JSON format, the PO catalog carries translator comments. **Add a `#.` comment to every entry** you create — a one-line note on intent, audience, or tone. Models use it to disambiguate formality and meaning; Globalize reads it straight from the `.po`.

A good `#.` comment answers one of: *Where does this appear? Who reads it? What tone?*

| Bad | Good |
|-----|------|
| `#. Welcome` | `#. Homepage hero heading shown to signed-out visitors` |
| `#. Button` | `#. Primary CTA on the pricing page — drives sign-up` |
| `#. Save` | `#. Save button in the document editor toolbar — not Save As` |

(The plugin drops `#.` from the compiled inlang model, but it persists in the `.po` Globalize imports — that round-trip is the point.)

---

## `msgctxt` — available but discouraged

The plugin folds `msgctxt` into the bundle id as `"<msgctxt>::<msgid>"`, which yields a key like `direction::cart_right` — **not** reachable via `m.` dot-access (you'd have to call `m["direction::cart_right"]()`). **Prefer distinct descriptive keys** instead (`cart_direction_right`, `quiz_answer_correct`), each with its own `#.` comment. Reserve `msgctxt` for cases an external PO toolchain forces on you.

---

## ICU-mode caveats / footguns

- **Escaping is ICU apostrophe-based, not backslash.** `'{'` renders a literal `{`; `''` renders a literal `'`. Bites elision languages — French `l'{article}` must be `l''{article}` so the `{article}` placeholder survives.
- **`<b>…</b>` and other HTML in a `msgstr` is literal text**, not markup. Keep markup in the template and interpolate plain values.
- **ICU exact matches (`=0`, `=1`) are dropped** to CLDR keyword branches (`one`, `other`, …). Author the keyword branches.
- **A malformed ICU `msgstr` is silently imported as literal text — no build error.** A typo'd plural ships the raw `{count, plural, …}` source. Verify rendered output (see "After conversion").

---

## Key naming — descriptive keys still matter

Even with `#.` comments, keep descriptive, context-encoding keys. Encode the UI location and intent, especially for bare single words:

```po
#. Remove button in the shopping cart line item
msgid "cart_remove_button"
msgstr "Remove"

#. Remove button in the search-filter chips
msgid "filter_remove_button"
msgstr "Remove"
```

Use `cart_remove_button`, not `remove`; two different "Remove" buttons need distinct keys so they can diverge across languages.

---

## What not to wrap

Do not give catalog keys to non-UI text — CSS class names, `console`/debug strings, import paths, object keys and internal codes, `ALL_CAPS` enums, `data-testid`, URL/API paths, SvelteKit route IDs (`/blog/[slug]`), and `load` return values that are IDs/slugs/raw payloads rather than copy. The full skip-list is in `paraglide/code.md` — apply it there rather than re-deciding per string.

---

## After conversion

The Vite plugin recompiles `messages/{locale}.po` → `src/lib/paraglide/` automatically on save while the dev server runs, so the new `m.key()` calls become available without a manual step. If the dev server is not running, compile once:

```bash
npx '@inlang/paraglide-js@^2' compile --project ./project.inlang --outdir ./src/lib/paraglide
```

Then verify:

1. The dev server boots and the converted pages render the expected text in the base locale.
2. Switching locale via the language switcher changes the visible copy with no missing-key warnings in the console.
3. **A plural renders as CLDR logic, not raw ICU.** Render a plural at `count: 5` (and `1`) and confirm the output is `5 items` / `1 item`, not the literal `{count, plural, …}` source. Raw ICU showing through means `"messageFormat": "icu"` is missing from the plugin config or the `msgstr` is malformed — both fail silently at import, so this is the only check that catches them.
4. The production build (`npm run build`, or the detected manager's equivalent) completes.
