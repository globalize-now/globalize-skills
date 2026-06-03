# SvelteKit + Paraglide: String Wrapping Patterns

This covers converting hardcoded UI strings in an existing **SvelteKit 2.x + Svelte 5 + Paraglide 2.x** codebase into Paraglide messages. The build plugin, middleware, and routing are assumed already wired (see `paraglide.setup.md`). The per-edit authoring rules — plurals, numbers/dates, what-not-to-wrap — live in `references/languages/js-ts/libraries/paraglide/code.md`; this file is the **mechanics of finding and converting existing literals**.

Paraglide is **key-authored and compile-from-catalog** — there is no extraction step and no macro. **Do NOT run any extractor.** For each hardcoded string, the conversion loop is:

1. **Choose a descriptive, context-encoding key** — `cart_remove_button`, not `remove`. The key is the translator's only signal about where the string lives (see "Key naming" below).
2. **Add `"key": "<text or ICU string>"`** to the base catalog `messages/{baseLocale}.json` (e.g. `messages/en.json`).
3. **Replace the literal** in the component with `{m.key()}` (or `m.key({ ... })`).

Import the message object once per file that calls it:

```ts
import { m } from '$lib/paraglide/messages.js'
```

**Do NOT add translator comments** *(ICU-JSON format only)*. The inlang/ICU JSON data model has no comment, context, or description field — there is nowhere to put one and it will not round-trip. Key naming is the only disambiguation lever.

> **PO catalog format:** if `decisions.setup.catalogFormat === "po"`, this is reversed — `.po` entries carry `#.` translator comments, which you **should** write. Follow `references/languages/js-ts/libraries/paraglide/po-format.convert.md` instead of the JSON examples below; it overrides the catalog shape (`msgid`/`msgstr` instead of JSON key-values) and the comment rule. Call sites (`m.key(...)`) are identical.

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

```json
// messages/en.json
{
  "dashboard_title": "Dashboard",
  "dashboard_empty_state": "Nothing here yet."
}
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

```json
{
  "greeting": "Hello, {name}!"
}
```

Wrap the **whole sentence** as one message — never concatenate a translated fragment with a literal (`m.greeting_prefix() + user.name`), which bakes one language's word order into the code.

---

## Plurals and select

Any string whose wording changes with a number or a category (gender, status, type) is ICU **inside the message value**, not a JS conditional. Do not pick between two messages with a ternary.

```json
{
  "cart_item_count": "{count, plural, one {# item} other {# items}}"
}
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

```json
{
  "nav_dashboard": "Dashboard",
  "nav_users": "Users",
  "nav_settings": "Settings"
}
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

When converting, flag and replace `toFixed()`, concatenated currency symbols (`'$' + price`), and hardcoded date formats (`'MM/DD/YYYY'`). Details in `paraglide/code.md`.

---

## Key naming — the only disambiguation lever

Since there are no translator comments, the key name carries all the context a translator gets. Encode the UI location and intent, especially for bare single words:

```json
{
  "cart_remove_button": "Remove",
  "filter_remove_button": "Remove",
  "nav_home_link": "Home"
}
```

Use `cart_remove_button`, not `remove`; two different "Remove" buttons need distinct keys so they can diverge across languages. Make keys specific for ambiguous words, bare action labels, and domain-sensitive terms.

---

## What not to wrap

Do not give catalog keys to non-UI text — CSS class names, `console`/debug strings, import paths, object keys and internal codes, `ALL_CAPS` enums, `data-testid`, URL/API paths, SvelteKit route IDs (`/blog/[slug]`), and `load` return values that are IDs/slugs/raw payloads rather than copy. The full skip-list is in `paraglide/code.md` — apply it there rather than re-deciding per string.

---

## After conversion

The Vite plugin recompiles `messages/{locale}.json` → `src/lib/paraglide/` automatically on save while the dev server runs, so the new `m.key()` calls become available without a manual step. If the dev server is not running, compile once:

```bash
npx '@inlang/paraglide-js@^2' compile --project ./project.inlang --outdir ./src/lib/paraglide
```

Then verify:

1. The dev server boots and the converted pages render the expected text in the base locale.
2. Switching locale via the language switcher changes the visible copy with no missing-key warnings in the console.
3. The production build (`npm run build`, or the detected manager's equivalent) completes — a malformed ICU value or a key present in code but absent from the base catalog surfaces here.
