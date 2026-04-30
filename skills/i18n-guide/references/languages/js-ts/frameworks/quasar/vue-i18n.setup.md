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
npm install 'vue-i18n@^11' 'intl-messageformat@^11'
npm install -D '@intlify/unplugin-vue-i18n@^11'
```

### Discontinued plugin warning

If the project already has `@intlify/vite-plugin-vue-i18n` in `devDependencies`, **stop and warn the user**:

> I detected `@intlify/vite-plugin-vue-i18n` in your devDependencies. That package has been **discontinued** in favor of `@intlify/unplugin-vue-i18n`, which is what this setup phase installs. To avoid conflicts, remove the old plugin before continuing:
>
> ```bash
> npm uninstall @intlify/vite-plugin-vue-i18n
> ```
>
> Then re-run this setup.

Do not proceed to Step 4 until the old plugin is removed.

## Build Tool Integration (Step 4)

**This modifies `quasar.config.ts` (or `.js`).** Describe the change before making it: registering the boot file and adding the Vite plugin via `vitePlugins`.

Quasar exposes Vite customization under `build.vitePlugins` (recent versions) or `build.extendViteConf` (older). **Do NOT set the plugin's `include` option** — pre-compiling catalogs would bypass the custom ICU `messageCompiler`. Vite's built-in JSON importer loads the locale JSON as plain objects, which is what the ICU compiler expects.

The modern shape:

```ts
// quasar.config.ts (excerpt)
export default configure(() => ({
  // ...existing boot entries
  boot: ['i18n'],   // registers src/boot/i18n.ts

  build: {
    vitePlugins: [
      ['@intlify/unplugin-vue-i18n/vite', {
        // No `include` — keep catalogs as plain JSON so the custom ICU compiler
        // (see src/i18n/messageCompiler.ts) can process raw strings at runtime.
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
      // No `include` — see note above.
      runtimeOnly: false,
      compositionOnly: true,
      strictMessage: false,
    }))
  },
},
```

### PO loader when `catalogFormat === 'po'`

Create `src/i18n/poLoader.ts` using the same body as the Vite SPA variant (see `references/languages/js-ts/frameworks/vite/vue/vue-i18n.setup.md` § PO loader — copy verbatim). Then register it in `quasar.config.ts` as an additional Vite plugin, **before** `@intlify/unplugin-vue-i18n/vite`:

```ts
// quasar.config.ts  (PO variant)
import { poLoader } from './src/i18n/poLoader'

export default configure(() => ({
  boot: ['i18n'],
  build: {
    vitePlugins: [
      [poLoader, {}],            // runs first thanks to enforce: 'pre' inside the plugin
      ['@intlify/unplugin-vue-i18n/vite', {
        runtimeOnly: false,
        compositionOnly: true,
        strictMessage: false,
      }],
    ],
  },
}))
```

Quasar's `vitePlugins` array accepts either a tuple of `[pluginFnOrSpecifier, options]` or a raw plugin factory. The factory form (`[poLoader, {}]`) is preferred when the plugin lives in the project — Quasar invokes it with the options object at build time.

For older Quasar versions using `extendViteConf`, push `poLoader()` before `VueI18nPlugin()`:

```ts
build: {
  extendViteConf(viteConf) {
    viteConf.plugins = viteConf.plugins ?? []
    viteConf.plugins.push(poLoader())
    viteConf.plugins.push(VueI18nPlugin({ runtimeOnly: false, compositionOnly: true, strictMessage: false }))
  },
},
```

**Source-map caveat:** same as the other variants — `.po → JS` transforms don't emit source maps; `gettext-parser` errors point at the `.po` line, but runtime errors surface against compiled JS.

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

And make sure `src/i18n/index.ts` exists per the shared setup reference Step 3 (same shape as the Vite SPA variant — `createI18n({ legacy: false })` plus the custom `messageCompiler`).

Register the boot file in `quasar.config.ts` by adding `'i18n'` to the `boot: []` array (as shown in Step 4 above).

### `<html lang>` / `<html dir>`

Quasar renders its own `index.html` under `src-spa/` (or similar for SSR / Capacitor modes). Read the current `<html lang="...">` value. Update the static lang to the source locale. `setLocale()` (from `src/i18n/index.ts`) sets `document.documentElement.lang` and `.dir` dynamically after hydration.

For Quasar's SSR mode, the static value matters more — the server renders HTML before any client JS runs, and a mismatch between the static `lang` and the locale the server actually renders in will cause a hydration flash. The `setLocale()` helper from Step 3 already guards DOM writes (`typeof document !== 'undefined'`) so it's safe to call in either environment. To resolve the locale on the server before render, use Quasar's `ssrContext` in the boot file:

```ts
// src/boot/i18n.ts (SSR-aware)
import { boot } from 'quasar/wrappers'
import { i18n, setLocale } from '../i18n'
import type { Locale } from '../i18n/locales'
import { locales } from '../i18n/locales'

export default boot(async ({ app, ssrContext }) => {
  app.use(i18n)
  if (ssrContext) {
    const header = (ssrContext.req.headers['accept-language'] ?? '') as string
    const preferred = header.split(',')[0]?.split('-')[0]
    if (preferred && (locales as readonly string[]).includes(preferred)) {
      await setLocale(preferred as Locale)
    }
  }
})
```

Alternatively, skip the server-side resolve and let the client reconcile after hydration — accept a brief flash. For apps with heavy SEO requirements on translated content, the server-side resolve above is the correct path.

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
  localStorage.setItem('locale', next)
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

If the Quasar project uses `vue-router` with locale-prefixed routes (Strategies 1 / 2 from the Vite SPA variant), apply the same `router.beforeEach` + `localePath` helper pattern from `references/languages/js-ts/frameworks/vite/vue/vue-i18n.setup.md`. Quasar's router setup lives in `src/router/index.ts` — the mechanics are identical to plain Vite + vue-router.

If the project uses no URL routing (Strategy 3), skip the router changes; the switcher above is sufficient.
