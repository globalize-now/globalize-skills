# Nuxt Conversion

Nuxt-specific guidance for the `vue-convert` skill. Covers Nuxt 3 and Nuxt 4 projects using `@nuxtjs/i18n`. Everything in the main SKILL.md applies; this file covers what's different about Nuxt and what's unsafe.

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

**This skill does not wrap server-route strings.** When the scan finds hardcoded text in `server/api/**`, include those files in a "server-side follow-up" list at the end of the conversion with a one-line remediation note:

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
