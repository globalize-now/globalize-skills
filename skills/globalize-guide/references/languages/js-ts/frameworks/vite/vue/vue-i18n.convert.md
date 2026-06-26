# Vite SPA Conversion

Vite-specific guidance for the convert phase. Everything in the shared convert reference applies; this file covers what's different about Vite SPAs.

---

## Composables and stores

setup places composables in `src/composables/` and Pinia stores in `src/stores/`. `useI18n()` works inside any composable called from setup — the common case:

```ts
// src/composables/useGreeting.ts
import { useI18n } from 'vue-i18n'

export function useGreeting() {
  const { t } = useI18n()
  return { greet: (name: string) => t('Common.hello', { name }) }
}
```

For composables or utilities that run *after* teardown (async callbacks, timer handlers), use the global instance:

```ts
import { i18n } from '@/i18n'
i18n.global.t('Common.save')
```

When wrapping strings inside a composable, check whether the composable is invoked synchronously from setup (safe — use `useI18n()`) or from an async context that may resolve post-unmount (prefer `i18n.global.t()`).

## Router topology and `localePath()`

If setup wired Strategy 1 (unprefixed source) or Strategy 2 (all prefixed), it created `src/i18n/localePath.ts`. Check for its existence in Step 2's detection. When it exists, the following rules apply to every `<RouterLink>` you wrap text inside:

- **Leave the `to` prop alone if it already uses `localePath(...)`.**
- **Warn if `to` is a raw string path.** Example: `<RouterLink to="/about">About</RouterLink>` — wrap the text (`<RouterLink to="/about"><Trans>About</Trans></RouterLink>` → `<RouterLink to="/about">{{ t('Navigation.about') }}</RouterLink>`), then flag the `to` prop: "This `<RouterLink>` uses a raw path; under your locale routing strategy it should go through `localePath(locale, '/about')`. Wrapping only the text for now — please review the `to` prop."
- **Never rewrite the `to` prop yourself.** Changing routing is outside this convert phase's scope; it could break tests, external links, or SSR assumptions.

If the user chose Strategy 3 (no URL routing) or the project has no router, skip the `localePath` rules entirely.

## Plain SPAs without vue-router

No route-scoped namespace decisions. Use the page component name as the namespace: `components/pages/Dashboard.vue` → `Dashboard`; `src/views/Settings.vue` → `Settings`.

The language switcher from setup drives `setLocale()` directly (no route navigation). Nothing to wrap around navigation; focus purely on template text and attribute wrapping.

## Options API — no auto-migration

If you encounter a `.vue` file without `<script setup>`, it uses the Options API. **Do not auto-migrate.** Record the file path in the manual-follow-up list and continue. The user must either migrate to `<script setup>` (out of scope here) or use vue-i18n's Legacy API (`this.$t`, deprecated in v12) manually.

When reporting the follow-up list at the end of the conversion, include a one-line remediation tip:

> These SFCs use the Options API and were skipped. To convert them:
> 1. Migrate each component to `<script setup>` (see the Vue 3 Composition API migration guide).
> 2. Re-run the convert phase.
>
> Alternatively, keep them on Options API and use `this.$t('Namespace.key')` plus entries in the catalog — but note that the Legacy API is scheduled for removal in vue-i18n v12.

## Number and date formats

Vite-SPA apps typically register number/date formats inside `createI18n({ ... })` in `src/i18n/index.ts`. When wrapping `toFixed()` / currency concatenations / date format strings, first check `src/i18n/index.ts` for registered `numberFormats` and `datetimeFormats`:

- If a `currency` format exists for the source locale → use `n(price, 'currency')`.
- If no currency format exists → warn the user: "I'm about to wrap a currency value with `n(price, 'currency')`, but no `currency` format is registered in `src/i18n/index.ts`. Either (a) add one (see setup Step 3), or (b) inline the currency code: `n(price, { style: 'currency', currency: 'USD' })`. Which do you prefer?"
- Same pattern for `short` / `long` date formats.

Default to option (a) — adding a named format — unless the user overrides.
