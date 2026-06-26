# Nuxt Conversion

Nuxt-specific guidance for the convert phase. Covers Nuxt 3 and Nuxt 4 projects using `@nuxtjs/i18n`. Everything in the shared convert reference applies; this file covers what's different about Nuxt and what's unsafe.

---

## When you hit ICU

The the shared convert reference Step 6 gates ICU emission on framework. This section is the Nuxt-specific decision recipe. Apply it before writing any catalog entry that uses `plural`, `select`, or `selectordinal`.

**Default — PO catalog routes ICU through the runtime compiler.** If the setup skill configured `catalogFormat === 'po'`, write `plural` / `select` / `selectordinal` entries straight into the locale `.po` file using the namespacing rules from Step 7. PO files pass through the `poLoader` Vite plugin (which runs with `enforce: 'pre'` before `@nuxtjs/i18n`'s own transform), so the raw ICU string reaches the custom `messageCompiler` at runtime.

**JSON catalog path is not verified ICU-safe on Nuxt.** `@nuxtjs/i18n`'s lazy-loading pipeline has historically pre-compiled JSON locale files at build time using the default (non-ICU) compiler — the `bundle.dropMessageCompiler` option on v10 hints this pre-compile is still the default path. Until the combination "ICU plural in JSON + v10 + default bundle settings" is validated end-to-end against a real Nuxt build, treat JSON as interpolation-only on Nuxt. When you hit an ICU keyword with a JSON catalog, surface this to the user:

1. Re-run the setup phase and pick PO — unblocks ICU under the lazy path immediately.
2. Drop `langDir` + `lazy` and import locale JSON statically (Vite SPA pattern). The custom `messageCompiler` then handles ICU end-to-end, at the cost of `@nuxtjs/i18n`'s SSR-aware lazy loading.
3. Leave the string interpolation-only and flag the plural for manual catalog authoring with a workaround.

Both options 1 and 2 require user consent — surface them, do not apply silently.

**Do NOT route ICU into SFC `<i18n>` blocks.** Custom blocks are transformed by `@intlify/unplugin-vue-i18n`'s default (non-ICU) compiler at build time, regardless of the custom `messageCompiler` in `i18n.config.ts`. Emitting `plural` / `select` into an `<i18n>` block triggers `unplugin-vue-i18n:resource` build failures (`error code: 2`). This applies on every `@nuxtjs/i18n` version.

**`<i18n>` blocks — opt-in for non-ICU, component-scoped strings only.** Plain interpolation or bare strings are safe in a custom block if a team prefers colocation. Flag this as a user-driven choice; do not route strings there by default. The central catalog stays the source of truth.

See § "ICU workarounds (advanced)" below for the root-cause explanation.

---

## ICU workarounds (advanced)

Root cause: `@nuxtjs/i18n` delegates lazy-JSON handling to `@intlify/unplugin-vue-i18n`, which pre-compiles every lazy locale file at build time using Intlify's **default** (non-ICU) compiler. The custom `messageCompiler` registered in `i18n.config.ts` only runs on messages evaluated at runtime, but the lazy-loaded bundle has already been pre-compiled by the time it lands on the client. Build-time pre-compilation of `{count, plural, one {...} other {...}}` fails with `error code: 2` and breaks the whole locale file.

The v10 migration removed the top-level `lazy` option and moved to per-locale `file:` entries, but **does not document a JSON-path bypass for pre-compilation**. The `bundle.dropMessageCompiler` flag surfaces the inverse: opting *into* pre-compiling every resource, which presumes the default path still pre-compiles JSON. Treat the v10 JSON ICU path as unverified until someone ships a green Nuxt build with an ICU plural in a `.json` catalog.

PO files are the documented ICU-safe catalog on Nuxt because the setup skill's `poLoader` Vite plugin runs with `enforce: 'pre'` and intercepts `.po` imports before the module's bundling step. The raw string then reaches the runtime compiler unchanged. SFC `<i18n>` blocks remain transformed by the default (non-ICU) compiler on every version — that is a separate code path from lazy-JSON loading, and moving ICU there is never the right answer.

Interpolation (`{name}`) works fine under default Nuxt bundling — it's only the ICU-specific keywords (`plural`, `select`, `selectordinal`) that trip the non-ICU pre-compile on the lazy JSON path.

---

## SSR safety

`@nuxtjs/i18n` runs `t()` during server render using the locale chosen from URL / cookie / `accept-language`. The locale is decided before the component renders, so `{{ t('…') }}` in templates works transparently on both server and client.

The places where SSR can break:

- **Reading `navigator.language` / `localStorage` during setup.** These are client-only. Let `@nuxtjs/i18n`'s `browserLanguageDetector` (configured in `nuxt.config.*`) handle locale detection.
- **Setting `i18n.global.locale.value = '…'` synchronously at the top of `<script setup>`.** During SSR this runs with no client context; the route-based strategy is the right path. If you find this pattern during conversion, flag it — don't try to wrap strings inside it.
- **Conditional `t()` calls that differ between server and client** (e.g. `isMobile ? t('mobile') : t('desktop')` where `isMobile` comes from `navigator.userAgent`). These cause hydration mismatches. Flag for manual review.

Wrap strings that always render on both server and client. Code behind `onMounted()` is client-only by convention — wrapping there is safe (the string won't render during SSR).

---

## `useI18n()` vs `useNuxtApp().$i18n`

| Context | API to use |
|---------|-----------|
| Component `<script setup>` | `const { t, n, d } = useI18n()` |
| Composable called from setup | `const { t } = useI18n()` |
| Pinia store action called during user interaction | `const { t } = useI18n()` |
| Nuxt plugin (`plugins/*.ts`) | `const { $i18n } = useNuxtApp(); $i18n.t('…')` |
| Route middleware (`middleware/*.ts`) | `const { $i18n } = useNuxtApp(); $i18n.t('…')` |
| Utility module (`utils/*.ts` imported anywhere) | `const { $i18n } = useNuxtApp(); $i18n.t('…')` — but ensure it's called from a Nuxt-aware context |
| Server route (`server/api/*.ts`) | **Out of scope.** Flag for manual follow-up. |

For plugins and middleware, `useNuxtApp()` must be called inside the plugin/middleware function body — not at module top level.

---

## Server routes (`server/api/**`)

Server routes run in Nitro's h3 handler context, outside Nuxt's Vue runtime. They do **not** have access to `useI18n()` or `useNuxtApp().$i18n`. Strings returned from a server route (error messages, JSON responses, redirects) need a separate localization strategy:

- Read the `accept-language` header from the event and pick a locale manually.
- Load catalog JSON / PO content from disk in the server route.
- Format with `intl-messageformat` directly.

**This convert phase does not wrap server-route strings.** When the scan finds hardcoded text in `server/api/**`, include those files in a "server-side follow-up" list at the end of the conversion with a one-line remediation note:

> These server routes contain user-visible strings. Server routes run outside vue-i18n's runtime — they need their own localization. Consider: (a) moving user-visible text out of server routes into client components that call the API and localize responses, or (b) loading the catalog manually in the server route and formatting with `intl-messageformat`.

---

## Locale-aware internal links

`@nuxtjs/i18n` rewrites `<NuxtLink :to="...">` based on the active locale and the configured `strategy`. When wrapping text inside a `<NuxtLink>`, **only wrap the visible label text**:

```vue
<!-- Before -->
<NuxtLink to="/about">About us</NuxtLink>

<!-- After -->
<NuxtLink to="/about">{{ t('Navigation.about') }}</NuxtLink>
```

**Never rewrite the `to` prop.** Raw string paths like `/about` are intentional — the module resolves them to the right locale-prefixed URL at render time. The only exception is if you see a raw `<a href="/about">` inside the template: replace the `<a>` tag with `<NuxtLink to="...">` so the locale prefix actually applies. Flag that as a warning, don't auto-rewrite — changing tags affects styling and event handlers.

For programmatic navigation:

```ts
const localePath = useLocalePath()
const router = useRouter()
router.push(localePath('/settings'))
```

If you find `router.push('/…')` with a raw string during conversion, flag it for manual review — this is a routing bug under locale prefixing, not a string-wrapping concern.

---

## SEO metadata via `useLocaleHead()`

`useLocaleHead()` owns `<html lang>`, `<html dir>`, and `hreflang` alternate links. Do **not** wrap anything inside that helper.

The head metadata that *is* in scope — `title` / `description` meta strings — should route through `t()`:

```vue
<script setup lang="ts">
const { t } = useI18n()
useHead({
  title: t('HomePage.metaTitle'),
  meta: [{ name: 'description', content: t('HomePage.metaDescription') }],
})
</script>
```

Flag any `useHead({ title: 'Static String' })` or `useSeoMeta({ ... })` with raw strings during the scan. The wrapping works the same as for any other `<script setup>` string.

---

## Catalog locations

| Nuxt version | Locales dir |
|--------------|-------------|
| Nuxt 3 | `locales/{locale}.{json,po}` |
| Nuxt 4 | `i18n/locales/{locale}.{json,po}` |

Step 10's cost estimate reads `wc -c` from the matching path.

---

## Composable file locations

| Nuxt version | Composables dir |
|--------------|-----------------|
| Nuxt 3 | `composables/**/*.ts` |
| Nuxt 4 | `app/composables/**/*.ts` |

Nuxt auto-imports these, so `useI18n()` usage inside them needs no additional import line — but you still need to write `const { t } = useI18n()` at the top of each composable that uses `t`.

---

## `onMounted()` caveat

When wrapping strings inside `onMounted()`, the code runs only on the client. `useI18n()` still works (the component is mounted at that point). The string won't render during SSR, so no hydration concern — but if the same string is shown elsewhere in the template too, make sure both call sites use the same key so translations stay in sync.
