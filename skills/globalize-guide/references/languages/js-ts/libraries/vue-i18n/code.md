---
name: vue-code
user_invocable: false
description: >-
  Apply automatically whenever writing or modifying UI code in a vue-i18n
  project — new components, new strings, edited copy, new form fields, anything
  that adds or changes user-visible text. Not user-invocable. Ensures strings,
  attributes, plurals, numbers, currencies, and dates are wrapped correctly as
  code is written, so nothing needs fixing after the fact.
---

# vue-i18n Coding Rules

Apply these rules as you write code. Every user-visible string must be wrapped before the task is complete.

## Out of Scope

These rules apply to Vue 3 + Composition API + vue-i18n v11 (ICU MessageFormat). They do not apply to Vue 2, Options-API-only code paths, or projects using a non-vue-i18n library (`i18next-vue`, `@tolgee/vue`, etc.). If you see those patterns, fall back to the library's own conventions.

---

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
        import { i18n } from '@/i18n' and use i18n.global.t('key').
        The key-at-definition pattern stays reactive to locale changes;
        module-level t() calls freeze the locale at first evaluation.

Is this inside a composable, Pinia store, or any function called from setup?
  YES → const { t } = useI18n() inside the composable / store action.
        For code that runs OUTSIDE setup (utility functions called from
        lifecycle hooks after teardown, async handlers resolved after
        unmount), import the global instance: i18n.global.t('key').

Is this in plain non-Vue code (a .ts utility, a helper module)?
  YES → import { i18n } from '@/i18n'
        Use i18n.global.t('key'), i18n.global.n(value), i18n.global.d(date).
```

Check the attribute-binding question carefully — forgetting the colon on `:placeholder` / `:alt` / `:title` is the most common mistake and renders `t('key')` as literal text in the DOM.

---

## Plurals, select, and ICU MessageFormat

**Always use ICU MessageFormat.** Never use vue-i18n's native pipe-plural syntax (`"one | many"`). Pipe syntax bakes English plural rules (one/other) into source strings and breaks languages with other plural categories — Russian, Arabic, Polish, Welsh, and many more use `zero`, `few`, `many`.

```vue
<template>
  <p>{{ t('items', { count }) }}</p>
</template>
```

```json
{ "items": "{count, plural, one {# item selected} other {# items selected}}" }
```

The named variable `count` triggers plural selection when the catalog entry is an ICU plural. `#` is the count placeholder inside each branch.

**Select (grammatical gender, status):**

```json
{ "reaction": "{gender, select, male {He liked it} female {She liked it} other {They liked it}}" }
```

```vue
{{ t('reaction', { gender: user.gender }) }}
```

**SelectOrdinal (ordinal positions):**

```json
{ "place": "You finished {position, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}." }
```

### Rules

- `other` is **always required** — it is the fallback for every language
- `#` is the count placeholder — do not repeat the variable name inside branches
- CLDR categories: `zero`, `one`, `two`, `few`, `many`, `other` — not `singular` / `plural`
- English only uses `one` and `other` in plurals — no need for `zero`
- Keep all branches in one message — never split them into separate `t('key.one')` / `t('key.other')` calls
- vue-i18n v11 removed `$tc` and `tc`. Plurals flow through regular `t(key, { count })` with an ICU plural catalog value.

### Never use ternaries to pick between translations

```ts
// WRONG — two messages, broken in many languages
count === 1 ? t('item') : t('items')

// RIGHT — single ICU message
t('items', { count })
```

---

## Numbers, dates, currencies

Do not hardcode formatted numbers, currency symbols, or date strings. Use vue-i18n's `n()` (numbers/currencies) and `d()` (dates) — both delegate to `Intl.NumberFormat` / `Intl.DateTimeFormat` with the active locale.

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t, n, d } = useI18n()
</script>

<template>
  <p>{{ n(amount, 'currency') }}</p>
  <time>{{ d(timestamp, 'short') }}</time>
</template>
```

The named formats (`'currency'`, `'short'`) are registered in the i18n instance:

```ts
createI18n({
  numberFormats: {
    en: { currency: { style: 'currency', currency: 'USD' } },
  },
  datetimeFormats: {
    en: { short: { year: 'numeric', month: 'short', day: 'numeric' } },
  },
})
```

**Flag for review:** `toFixed()`, currency symbols concatenated with numbers (`'$' + price`), date format strings like `'MM/DD/YYYY'`, `new Intl.NumberFormat(...)` called directly inside a component.

Do not concatenate locale-formatted substrings into messages. If the value belongs inside a translated sentence, pass it as a named placeholder and format it in the catalog via ICU number/date arguments, or pass the pre-formatted string as an interpolation value:

```json
{ "total": "Your total is {amount, number, ::currency/USD}" }
```

---

## Reactivity pitfalls

**Top-of-module destructuring freezes `t`.** Inside a `<script setup>` block, `const { t } = useI18n()` runs every time the component mounts, so `t` is tied to the current i18n instance and stays reactive. But destructuring `t` at the top of a shared `.ts` module, or anywhere outside a setup context, captures whatever `t` was bound at first call — locale changes will not update it.

```ts
// WRONG — runs at import time, freezes locale
import { useI18n } from 'vue-i18n'
const { t } = useI18n()   // Error or stale binding outside setup
export const label = t('nav.home')

// RIGHT — call t inside the function that uses it
export function getNavLabel() {
  return i18n.global.t('nav.home')
}
```

**`i18n.global.t` is not reactive inside a `<template>`.** Expressions in a template are reactive when they depend on reactive refs — `t` from `useI18n()` tracks the locale ref internally. Calling `i18n.global.t('key')` in a template reads the string once and will not re-run when the locale changes. Always get `t` from `useI18n()` in components.

**Computed values are reactive when they use the setup-bound `t`:**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const title = computed(() => t('page.title'))   // re-runs on locale change
</script>
```

**Watching locale changes:** use the `locale` ref from `useI18n()`, not the DOM.

```ts
const { locale } = useI18n()
watch(locale, (next) => { /* ... */ })

// WRONG — the DOM attribute is a derived sink, not a reactive source
watch(() => document.documentElement.lang, ...)
```

---

## Nuxt-specific (Nuxt + `@nuxtjs/i18n` only)

Skip this section on Vite SPAs and Quasar.

**Locale-aware internal links — `useLocalePath()` / `localePath()`:**

```vue
<script setup lang="ts">
const localePath = useLocalePath()
</script>

<template>
  <NuxtLink :to="localePath('/about')">About</NuxtLink>
</template>
```

With `strategy: 'prefix_except_default'`, `localePath('/about')` returns `/about` for the default locale and `/fr/about` when French is active. Never build internal paths by hand.

**Switching locales — `useSwitchLocalePath()` / `<SwitchLocalePathLink>`:**

```vue
<script setup lang="ts">
const switchLocalePath = useSwitchLocalePath()
</script>

<template>
  <NuxtLink :to="switchLocalePath('fr')">Français</NuxtLink>
</template>
```

This preserves the current route and swaps only the locale segment.

**SEO meta — `useLocaleHead()`:**

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

`useLocaleHead()` returns a `Ref` — use `.value` when passing it to `useHead`. This is how `<html lang>` and `<html dir>` get written in Nuxt apps; do not set them by hand.

**Escape hatch — `useNuxtApp().$i18n`:**

Use this when you need the i18n instance in a place where `useI18n()` isn't allowed — Nuxt plugins, middleware, or utility modules that run outside setup.

```ts
export default defineNuxtRouteMiddleware(() => {
  const { $i18n } = useNuxtApp()
  const msg = $i18n.t('redirect.notice')
})
```

**SSR locale detection:** `t()` runs during server render using the locale determined by the request (URL prefix, cookie, `accept-language`). Do not read browser-only APIs (`navigator.language`, `localStorage`) to pick the locale — `@nuxtjs/i18n`'s `browserLanguageDetector` handles detection with SSR-safe logic. Reading browser globals during render causes hydration mismatches.

---

## Imports reference

| What you need | Import | Source |
|---|---|---|
| `t`, `n`, `d`, `locale`, `availableLocales` (inside `<script setup>` or a composable) | `import { useI18n } from 'vue-i18n'` | Component or composable in setup |
| Global i18n instance (outside setup) | `import { i18n } from '@/i18n'` — use `i18n.global.t`, `i18n.global.n`, `i18n.global.d` | Module-level code, plain `.ts` utilities |
| `<i18n-t>` component | Auto-registered globally when `app.use(i18n)` is called | Any template |
| `useLocalePath`, `useSwitchLocalePath`, `useLocaleHead`, `useNuxtApp` | Auto-imported by `@nuxtjs/i18n` / Nuxt | Nuxt projects only |

---

## Gotchas

- **`$tc` / `tc` removed in vue-i18n v11.** Use `t(key, { count })` with an ICU plural catalog entry.
- **Never use `v-html` with `t()` output.** XSS risk, and interpolated children lose reactivity. Use `<i18n-t>` with named slots for rich text.
- **Attribute translations require a bound attribute.** `:placeholder="t('key')"` is correct; `placeholder="t('key')"` renders the literal string `t('key')` in the DOM.
- **Module-level `t` destructuring is not reactive.** Call `useI18n()` inside setup or the using function — see Reactivity pitfalls.
- **Plain interpolation uses `{name}`; plurals use ICU `{count, plural, ...}`; gender/status uses `{gender, select, ...}`.** Do not mix the vue-i18n pipe-plural syntax into ICU catalogs.
- **Nuxt: always route through `localePath()` / `<NuxtLink>`.** Raw `<a href="/about">` bypasses locale prefixing and lands on the wrong URL.
- **`i18n.global.t` inside a template reads once and does not re-run on locale change.** Use the setup-bound `t` from `useI18n()` in components.

---

For initial setup, locale scaffolding, provider wiring, and language switcher creation, see the setup phase.
