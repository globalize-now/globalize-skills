# Quasar Conversion (Experimental)

> **Warning: Experimental.** The Quasar variant of the convert phase follows the same patterns as the Vite SPA variant but receives less validation. Review each file's edits before committing. Report friction back to the skill maintainers.

Quasar v2 projects use Vite under the hood, so most of the convert phase's behavior matches the Vite SPA variant. This file covers Quasar-specific component attribute conventions and the boot-file context.

---

## Quasar component attributes

Quasar's component library uses props like `:label`, `:hint`, `:title`, `:placeholder`, `:message`, `:tooltip` for user-visible text. These bind string values dynamically — just like standard HTML attributes — and should be wrapped with `t()` the same way.

### Always flag

Unbound (no `:` prefix) user-visible Quasar props:

- `label="..."` on `q-btn`, `q-input`, `q-select`, `q-field`, `q-toggle`, `q-radio`, `q-checkbox`
- `hint="..."` on `q-input`, `q-field`
- `placeholder="..."` on `q-input`, `q-select`
- `title="..."` on `q-card-section`, `q-tooltip`, `q-header`
- `message="..."` / `error-message="..."` on `q-input`, `q-field`
- `tooltip="..."` on any Quasar component that renders one

Flag these the same way HTML attribute misses are flagged (see the shared convert reference Step 5). The fix is identical: add the colon and wrap with `t()`:

```vue
<!-- Before -->
<q-input label="Email" hint="We'll never share it" placeholder="you@example.com" />

<!-- After -->
<q-input
  :label="t('Auth.emailLabel')"
  :hint="t('Auth.emailHint')"
  :placeholder="t('Auth.emailPlaceholder')"
/>
```

### Options arrays with `label` fields

`q-btn-toggle`, `q-select`, `q-btn-group`, and similar components accept an `options` array where each item has a `label` property. These are rendered as user-visible text and must be wrapped.

```vue
<!-- Before -->
<q-btn-toggle :options="[
  { value: 'list', label: 'List' },
  { value: 'grid', label: 'Grid' },
]" />

<!-- After -->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const viewOptions = computed(() => [
  { value: 'list', label: t('Common.listView') },
  { value: 'grid', label: t('Common.gridView') },
])
</script>

<template>
  <q-btn-toggle :options="viewOptions" />
</template>
```

Wrap the array in a `computed()` so label values stay reactive when the locale changes. A plain `const` at the top of `<script setup>` would bake in the initial locale's values and not re-render on locale change.

### Notifications — `$q.notify({ message: ... })`

`$q.notify({ message: 'Saved!' })` shows a toast. The `message` field is user-visible:

```vue
<script setup lang="ts">
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
const $q = useQuasar()
const { t } = useI18n()

function onSave() {
  $q.notify({ message: t('Common.savedConfirmation') })
}
</script>
```

Same pattern for `$q.dialog({ title, message, ok, cancel })`.

---

## Boot file — no wrapping needed

setup creates `src/boot/i18n.ts` which registers vue-i18n. This file is pure wiring — no user-visible strings. Skip it during conversion.

---

## Router and locale prefixes

Quasar's `src/router/index.ts` follows the same patterns as a plain Vite SPA with `vue-router`. If setup wired Strategy 1 or 2 with a `localePath` helper, apply the same `<RouterLink>` rules as `references/languages/js-ts/frameworks/vite/vue/vue-i18n.convert.md` — wrap only the visible text, warn on raw string paths, never rewrite the `to` prop yourself.

Quasar SPAs that don't use URL-based locale prefixing (Strategy 3) have no routing-related wrapping concerns. The language switcher from setup drives `setLocale()` directly.

---

## Number and date formats inside Quasar components

`q-date` and `q-time` have their own Quasar-internal locale system (`$q.lang.set(...)`). That's independent from vue-i18n. When wrapping surrounding text, don't try to reconfigure Quasar's own date picker — leave `$q.lang` usage alone.

For user-visible numbers and currencies *outside* Quasar's date/time pickers, use vue-i18n's `n()` with a named format registered in `src/i18n/index.ts`. Same rules as the Vite SPA variant.

---

## SSR mode

If the Quasar project uses `ssr` mode (detected via `quasar.config.ts` having `ssr: { prodPort: ... }` or `ssr: true`), `t()` runs on the server during page render. The same SSR-safety caveats from `references/languages/js-ts/frameworks/nuxt/vue-i18n.convert.md` apply:

- Don't read browser APIs (`navigator.language`, `localStorage`) during setup.
- Don't set the locale synchronously during server render; let the boot file handle it from `ssrContext` (see `references/languages/js-ts/frameworks/quasar/vue-i18n.setup.md` for the SSR-aware boot file).
- Watch for hydration mismatches in conditional `t()` output.

For SPA mode (the default), none of this matters — client-only.
