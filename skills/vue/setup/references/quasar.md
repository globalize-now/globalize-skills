# Quasar Setup (Experimental)

> **Warning: Experimental.** This variant follows the Quasar boot-file pattern but has received less validation than the Vite SPA and Nuxt variants. Review each generated file before committing, and report any friction back to the skill maintainers. If you want a production-grade setup today, consider running the Vite SPA variant against your Quasar project's `src/` directly, omitting the Quasar-specific boot wiring.

This covers Quasar v2 projects using Vite under the hood. Quasar v1 (webpack-based) is not supported — Quasar v1 is effectively EOL.

## Packages (Step 2)

Install:

| Package | Type | Purpose |
|---------|------|---------|
| `vue-i18n` | runtime | Vue 3 i18n engine |
| `intl-messageformat` | runtime | ICU MessageFormat parser |
| `@intlify/unplugin-vue-i18n` | dev | Pre-compiles resources and enables `<i18n>` SFC blocks |

```bash
npm install vue-i18n@^11 intl-messageformat
npm install -D @intlify/unplugin-vue-i18n
```

### Discontinued plugin warning

If the project already has `@intlify/vite-plugin-vue-i18n` in `devDependencies`, **stop and warn the user**:

> I detected `@intlify/vite-plugin-vue-i18n` in your devDependencies. That package has been **discontinued** in favor of `@intlify/unplugin-vue-i18n`, which is what this skill installs. To avoid conflicts, remove the old plugin before continuing:
>
> ```bash
> npm uninstall @intlify/vite-plugin-vue-i18n
> ```
>
> Then re-run this setup.

Do not proceed to Step 4 until the old plugin is removed.

## Build Tool Integration (Step 4)

**This modifies `quasar.config.ts` (or `.js`).** Describe the change before making it: registering the boot file and adding the Vite plugin via `vitePlugins`.

Quasar exposes Vite customization under `build.vitePlugins` (recent versions) or `build.extendViteConf` (older). The modern shape:

```ts
// quasar.config.ts (excerpt)
export default configure(() => ({
  // ...existing boot entries
  boot: ['i18n'],   // registers src/boot/i18n.ts

  build: {
    vitePlugins: [
      ['@intlify/unplugin-vue-i18n/vite', {
        include: ['src/i18n/locales/**'],
        runtimeOnly: false,
        compositionOnly: true,
        strictMessage: false,
      }],
    ],
  },
}))
```

If the user is on an older Quasar version that still uses `build.extendViteConf`, show the corresponding edit:

```ts
build: {
  extendViteConf(viteConf) {
    viteConf.plugins = viteConf.plugins ?? []
    viteConf.plugins.push(VueI18nPlugin({
      include: resolve(__dirname, 'src/i18n/locales/**'),
      runtimeOnly: false,
      compositionOnly: true,
      strictMessage: false,
    }))
  },
},
```

## Provider Setup (Step 5)

Quasar uses boot files to initialize Vue plugins. Create `src/boot/i18n.ts`:

```ts
// src/boot/i18n.ts
import { boot } from 'quasar/wrappers'
import { i18n } from '../i18n'

export default boot(({ app }) => {
  app.use(i18n)
})
```

And make sure `src/i18n/index.ts` exists per the main SKILL.md Step 3 (same shape as the Vite SPA variant — `createI18n({ legacy: false })` plus the custom `messageCompiler`).

Register the boot file in `quasar.config.ts` by adding `'i18n'` to the `boot: []` array (as shown in Step 4 above).

### `<html lang>` / `<html dir>`

Quasar renders its own `index.html` under `src-spa/` (or similar for SSR / Capacitor modes). Read the current `<html lang="...">` value. Update the static lang to the source locale. `setLocale()` (from `src/i18n/index.ts`) sets `document.documentElement.lang` and `.dir` dynamically after hydration.

For Quasar's SSR mode, the static value matters more — set it to the source locale and rely on `setLocale()` running in `onServerPrefetch()` / middleware if the app detects a different initial locale.

## Language Switcher (Step 6)

Use Quasar's `QBtnToggle` or `QSelect` for a native-looking switcher. Example with `QBtnToggle`:

```vue
<!-- src/components/LanguageSwitcher.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { locales, type Locale } from '../i18n/locales'
import { setLocale } from '../i18n'

const { locale } = useI18n()
const selected = ref<Locale>(locale.value as Locale)

const displayNames = computed(() => new Intl.DisplayNames([locale.value], { type: 'language' }))

const options = computed(() =>
  locales.map((loc) => ({ value: loc, label: displayNames.value.of(loc) ?? loc })),
)

watch(selected, async (next) => {
  await setLocale(next)
  localStorage.setItem('lang', next)
})
</script>

<template>
  <q-btn-toggle
    v-model="selected"
    :options="options"
    no-caps
    unelevated
    toggle-color="primary"
  />
</template>
```

### Wiring

Place the switcher in `MainLayout.vue` (typical Quasar pattern) under `src/layouts/`:

```vue
<!-- src/layouts/MainLayout.vue (excerpt) -->
<template>
  <q-layout view="hHh lpR fFf">
    <q-header>
      <q-toolbar>
        <q-toolbar-title>My App</q-toolbar-title>
        <LanguageSwitcher />
      </q-toolbar>
    </q-header>
    <q-page-container><router-view /></q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import LanguageSwitcher from 'src/components/LanguageSwitcher.vue'
</script>
```

**Styling**: the `QBtnToggle` takes Quasar theme tokens directly — adjust `toggle-color`, `color`, `size` props to match the app's brand.

## Router integration

If the Quasar project uses `vue-router` with locale-prefixed routes (Strategies 1 / 2 from the Vite SPA variant), apply the same `router.beforeEach` + `localePath` helper pattern from `references/vite-spa.md`. Quasar's router setup lives in `src/router/index.ts` — the mechanics are identical to plain Vite + vue-router.

If the project uses no URL routing (Strategy 3), skip the router changes; the switcher above is sufficient.
