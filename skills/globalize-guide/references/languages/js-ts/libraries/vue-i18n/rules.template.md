---
name: vue-i18n-code
user_invocable: false
description: >-
  Apply automatically whenever writing or modifying UI code in a vue-i18n
  project — new components, new strings, edited copy, new form fields, anything
  that adds or changes user-visible text. Not user-invocable. Ensures strings,
  attributes, plurals, numbers, currencies, and dates are wrapped correctly as
  code is written, so nothing needs fixing after the fact.
template: vue-i18n
templateVersion: 1
conditions: [framework, catalogFormat, icuCatalogSupport, namedFormats]
values: [catalogPath, sourceLocale, targetLocales, globalImport, globalI18n, currencyFormat, dateFormat, numberFormats, dateFormats, nuxtStrategy]
budget: { "framework == \"nuxt\"": 215, "default": 175 }
---

# vue-i18n Coding Rules

Apply these rules as you write code. Every user-visible string must be wrapped before the task is complete.

**This project:**
- Catalogs: `<<catalogPath>>` — add every new message here in the same change that uses it.
- Source locale `<<sourceLocale>>` (write every source string in it); target locales `<<targetLocales>>`.
- Scope: Vue 3 + Composition API + vue-i18n v11 with ICU MessageFormat. Vue 2 and Options-API `this.$t` code paths are out of scope — if you meet one, follow that code's own conventions instead of these rules.

## Composable decision tree

```
Is this a template text node (between tags, e.g. <p>Hello</p>)?
  YES → {{ t('key') }}
        Requires: const { t } = useI18n() in <script setup>

Is this an attribute value (placeholder, alt, title, aria-label, value)?
  YES → Bind the attribute: :placeholder="t('key')"
        The colon is required — placeholder="t('key')" renders the literal string.

Is this rich text with embedded HTML or components (a link inside a sentence,
a <strong> inside a paragraph)?
  YES → <i18n-t keypath="..." tag="p"> with named slots
        Never v-html with t() output — loses interpolation and opens XSS.

Is this a string defined OUTSIDE any component (module-level array of menu
items, error-code map, constants file)?
  YES → Prefer: store the key as a string, call t(key) at the render site.
        Only if the resolved string is truly needed at module level:
        <<globalImport>> and use <<globalI18n>>.t('key').
        The key-at-definition pattern stays reactive to locale changes;
        module-level t() calls freeze the locale at first evaluation.

Is this inside a composable, Pinia store, or any function called from setup?
  YES → const { t } = useI18n() inside the composable / store action.
        For code that runs OUTSIDE setup (utility functions called from
        lifecycle hooks after teardown, async handlers resolved after
        unmount), use the global instance: <<globalI18n>>.t('key').

Is this in plain non-Vue code (a .ts utility, a helper module)?
  YES → <<globalImport>>
        Use <<globalI18n>>.t('key'), <<globalI18n>>.n(value), <<globalI18n>>.d(date).
```

Check the attribute-binding question carefully — forgetting the colon on `:placeholder` / `:alt` / `:title` is the most common mistake and renders `t('key')` as literal text in the DOM.

## Plurals, select, and ICU MessageFormat

**Always use ICU MessageFormat.** Never use vue-i18n's native pipe-plural syntax (`"one | many"`). Pipe syntax bakes English plural rules (one/other) into source strings and breaks languages with other plural categories — Russian, Arabic, Polish, Welsh and many more use `zero`, `few`, `many`.

Any time a string's wording depends on a number — singular/plural nouns, subject-verb agreement, anything count-sensitive — it is a plural string. Keep every form inside one message.

<!-- if: icuCatalogSupport == "limited" -->
**Exception — do not put ICU keywords in this project's catalog.** `@nuxtjs/i18n` pre-compiles lazy JSON locale files with a non-ICU compiler at build time, so a `plural`, `select`, or `selectordinal` keyword fails the whole locale file (`error code: 2`). Plain interpolation (`{name}`, `{count}`) is fine. When a string genuinely needs a plural, stop and raise it with the user rather than writing it: the fixes are switching the catalog to PO, or importing locale JSON statically instead of via `langDir` — both change project configuration.

<!-- /if -->
<!-- if: catalogFormat == "po" -->
`msgid` is the full dot-path used at the call site: `t('Cart.items')` → `msgid "Cart.items"`. ICU goes inside `msgstr`. Never use gettext `msgid_plural` / `msgstr[0]` / `msgstr[1]` — the ICU compiler evaluates a single `msgstr`, and the `Plural-Forms` header is informational only. Give every entry a `#.` description and a `#:` source reference (elided below for brevity — never elide them in a real catalog).

```po
msgid "Cart.items"
msgstr "{count, plural, one {# item selected} other {# items selected}}"
msgid "Feed.reaction"
msgstr "{gender, select, male {He liked it} female {She liked it} other {They liked it}}"
msgid "Race.place"
msgstr "You finished {position, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}."
```

```vue
{{ t('Cart.items', { count }) }}
{{ t('Feed.reaction', { gender: user.gender }) }}
{{ t('Race.place', { position }) }}
```

Use `msgctxt` to disambiguate identical source strings. vue-i18n has no context concept, so the PO loader mangles the pair into a single key at build time — `msgid "Common.right"` + `msgctxt "direction"` becomes `Common.right__ctx_direction`. Call sites must reference the mangled key: `t('Common.right__ctx_direction')`.
<!-- else -->
```json
{
  "items":    "{count, plural, one {# item selected} other {# items selected}}",
  "reaction": "{gender, select, male {He liked it} female {She liked it} other {They liked it}}",
  "place":    "You finished {position, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}."
}
```

```vue
{{ t('items', { count }) }}
{{ t('reaction', { gender: user.gender }) }}
{{ t('place', { position }) }}
```
<!-- /if -->

The named variable passed at the call site must match the name the message uses. `count` is what triggers plural selection when the catalog entry is an ICU plural.

### Rules

- Plain interpolation is `{name}` in the message and `t('key', { name })` at the call site — never the pipe syntax, in any catalog entry
- `other` is **always required** — it is the fallback for every language
- `#` is the count placeholder — do not repeat the variable name inside branches
- CLDR categories: `zero`, `one`, `two`, `few`, `many`, `other` — not `singular` / `plural`
- English only uses `one` and `other` in plurals — no need for `zero`
- Keep all branches in one message — never split them into separate `t('key.one')` / `t('key.other')` calls
- vue-i18n v11 removed `$tc` and `tc`. Plurals flow through regular `t(key, { count })` with an ICU plural catalog value
- Never use a ternary to pick between two translations. `count === 1 ? t('item') : t('items')` is two messages and breaks in every language whose rules differ; write `t('items', { count })`

## Numbers, dates, currencies

Do not hardcode formatted numbers, currency symbols, or date strings. Use vue-i18n's `n()` (numbers/currencies) and `d()` (dates) — both delegate to `Intl.NumberFormat` / `Intl.DateTimeFormat` with the active locale.

<!-- if: namedFormats == "registered" -->
```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t, n, d } = useI18n()
</script>

<template>
  <p>{{ n(amount, '<<currencyFormat>>') }}</p>
  <time>{{ d(timestamp, '<<dateFormat>>') }}</time>
</template>
```

Only names registered on the i18n instance resolve — for `n()`: `<<numberFormats>>`; for `d()`: `<<dateFormats>>`. An unregistered name silently falls back to browser defaults, and a currency call without a registered currency format produces no currency symbol at all. To add a format, register it under `numberFormats` / `datetimeFormats` on the i18n instance for `<<sourceLocale>>` **and** every target locale.
<!-- else -->
```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t, n, d } = useI18n()
</script>

<template>
  <p>{{ n(amount, { style: 'currency', currency: 'USD' }) }}</p>
  <time>{{ d(timestamp, { dateStyle: 'medium' }) }}</time>
</template>
```

This project registers no named formats on the i18n instance, so pass an options object on every call — a bare name like `n(amount, 'currency')` would silently fall back to browser defaults and emit no currency symbol. When the same format recurs, register it under `numberFormats` / `datetimeFormats` for `<<sourceLocale>>` **and** every target locale first, then call it by name.
<!-- /if -->


**Flag for review:** `toFixed()`, currency symbols concatenated with numbers (`'$' + price`), date format strings like `'MM/DD/YYYY'`, `new Intl.NumberFormat(...)` called directly inside a component.

Do not concatenate locale-formatted substrings into messages. If the value belongs inside a translated sentence, pass it as a named placeholder and format it in the catalog via an ICU number/date argument — `Your total is {amount, number, ::currency/USD}` — or pass the pre-formatted string as an interpolation value.

## Reactivity pitfalls

**Top-of-module destructuring freezes `t`.** Inside a `<script setup>` block, `const { t } = useI18n()` runs every time the component mounts, so `t` is tied to the current i18n instance and stays reactive. Destructuring `t` at the top of a shared `.ts` module, or anywhere outside a setup context, errors or captures a binding that locale changes will never update.

```ts
// WRONG — runs at import time, freezes locale
const { t } = useI18n()
export const label = t('nav.home')

// RIGHT — resolve inside the function that uses it
export function getNavLabel() {
  return <<globalI18n>>.t('nav.home')
}
```

**`<<globalI18n>>.t` is not reactive inside a `<template>`.** It reads the string once and will not re-run when the locale changes. In components always take `t` from `useI18n()` — it tracks the locale ref internally, so computed values built on it re-run on locale change:

```vue
<script setup lang="ts">
const { t } = useI18n()
const title = computed(() => t('page.title'))   // re-runs on locale change
</script>
```

**Watch locale changes through the `locale` ref from `useI18n()`, never the DOM** — `document.documentElement.lang` is a derived sink, not a reactive source.

```ts
const { locale } = useI18n()
watch(locale, (next) => { /* ... */ })
```
<!-- if: framework == "nuxt" -->

## Nuxt routing, head, and SSR

**Locale-aware internal links — `useLocalePath()`:**

```vue
<script setup lang="ts">
const localePath = useLocalePath()
</script>

<template>
  <NuxtLink :to="localePath('/about')">About</NuxtLink>
</template>
```

`localePath()` applies this project's `strategy: '<<nuxtStrategy>>'` to produce the right URL for the active locale. Never build internal paths by hand, and never use a raw `<a href="/about">` for an internal route — it bypasses locale prefixing and lands on the wrong URL.

**Switching locales — `useSwitchLocalePath()`** preserves the current route and swaps only the locale segment:

```vue
<script setup lang="ts">
const switchLocalePath = useSwitchLocalePath()
</script>

<template>
  <NuxtLink :to="switchLocalePath('fr')">Français</NuxtLink>
</template>
```

**SEO meta — `useLocaleHead()`** is how `<html lang>` and `<html dir>` get written in Nuxt apps; do not set them by hand. It returns a `Ref` — use `.value` when passing it to `useHead`:

```vue
<script setup lang="ts">
const i18nHead = useLocaleHead()
useHead({
  htmlAttrs: i18nHead.value.htmlAttrs,
  link: i18nHead.value.link,
  meta: i18nHead.value.meta,
})
</script>
```

**SSR locale detection:** `t()` runs during server render using the locale determined by the request (URL prefix, cookie, `accept-language`). Do not read browser-only APIs (`navigator.language`, `localStorage`) to pick the locale — `@nuxtjs/i18n`'s browser detection handles it with SSR-safe logic. Reading browser globals during render causes hydration mismatches.

`<<globalImport>>` resolves only inside a Nuxt context — a plugin, middleware, or a function called during setup. A plain utility module imported outside that context has no instance to read from: take `t` as a parameter from the caller instead.
<!-- /if -->

## Imports reference

| What you need | Import | Source |
|---|---|---|
| `t`, `n`, `d`, `locale`, `availableLocales` (inside `<script setup>` or a composable) | `import { useI18n } from 'vue-i18n'` | Component or composable in setup |
| Global i18n instance (outside setup) | `<<globalImport>>` — use `<<globalI18n>>.t`, `<<globalI18n>>.n`, `<<globalI18n>>.d` | Any code running outside a component's `setup` |
| `<i18n-t>` component | Auto-registered globally once the vue-i18n plugin is installed | Any template |
<!-- if: framework == "nuxt" -->
| `useLocalePath`, `useSwitchLocalePath`, `useLocaleHead`, `useNuxtApp` | Auto-imported by `@nuxtjs/i18n` / Nuxt | Anywhere in the app |
<!-- /if -->

## What not to wrap

Skip these — wrapping them causes false extractions:

- CSS class names: `class="text-red-500 font-bold"`, `:class="[...]"` — but when writing new CSS, use logical properties (`margin-inline-start`, not `margin-left`; `ms-4`, not `ml-4` in Tailwind). See the `css-i18n` skill.
- `console.*` strings and dev-only log messages.
- Import paths and module identifiers.
- Object keys, property names, and regex literals.
- Test IDs: `data-testid="submit-btn"`, and other `data-*` attributes.
- `ALL_CAPS` constants used as enum values or internal codes.
- URL strings and API endpoints.
- Currency codes (`'USD'`, `'EUR'`) and the `<html lang>` value — identifiers, not user-visible copy.
- Developer-facing error messages that never surface to an end user.
- Long-form prose: article bodies, blog posts, changelogs, legal copy. That is content needing a content-localization strategy, not string wrapping — still wrap the UI elements in the same files (buttons, labels, navigation, form fields).
