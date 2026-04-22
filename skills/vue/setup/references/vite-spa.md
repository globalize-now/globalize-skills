# Vite SPA Setup

This covers Vite projects using Vue 3 with `@vitejs/plugin-vue` — including projects with and without `vue-router`. Quasar and Nuxt have their own reference files.

## Packages (Step 2)

Install:

| Package | Type | Purpose |
|---------|------|---------|
| `vue-i18n` | runtime | Vue 3 i18n engine |
| `intl-messageformat` | runtime | ICU MessageFormat parser, wired into the custom `messageCompiler` |
| `@intlify/unplugin-vue-i18n` | dev | Pre-compiles resources and enables `<i18n>` SFC blocks |

**Example (npm):**

```bash
npm install vue-i18n@^11 intl-messageformat
npm install -D @intlify/unplugin-vue-i18n
```

Use the project's detected package manager (pnpm / yarn / bun) instead of `npm` if applicable.

## Build Tool Integration (Step 4)

**This modifies `vite.config.ts`.** Describe the change before making it: adding `VueI18nPlugin` with `runtimeOnly: false` (so the message-compiler runtime our custom ICU compiler plugs into stays in the bundle) and `strictMessage: false` (so ICU placeholder syntax doesn't trip the plugin's HTML check).

**Do NOT set the `include` option.** Pre-compiling the catalog JSON would hand our custom ICU `messageCompiler` a pre-built function instead of the raw source string, breaking ICU parsing. Vite's built-in JSON importer loads the catalogs as plain objects, which is what we want.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'

export default defineConfig({
  plugins: [
    vue(),
    VueI18nPlugin({
      // No `include` — keep catalogs as plain JSON so the custom ICU compiler
      // (see src/i18n/messageCompiler.ts) can process raw strings at runtime.
      runtimeOnly: false,
      compositionOnly: true,
      strictMessage: false,
    }),
  ],
})
```

If the project already has other Vite plugins (Vue DevTools, Vitest setup, etc.), keep them — just add `VueI18nPlugin()` alongside them.

## Provider Setup (Step 5)

### Locale Routing Strategy

**If the project uses `vue-router`, STOP and present this to the user:**

> Choose a locale routing strategy:
> 1. **Unprefixed source locale** — source locale (e.g., English) keeps original URLs (`/about`). Other locales use `/{locale}/about` (e.g., `/fr/about`). Best for preserving existing URLs and SEO.
> 2. **All locales prefixed** — every locale gets a prefix (`/en/about`, `/fr/about`). Bare paths (`/about`) redirect to the source locale (`/en/about`). Cleanest structure, single route tree.
> 3. **Skip locale routing** — use a `?lang=` query param, `localStorage`, or browser detection only, no URL path changes. Simplest setup.

**You MUST wait for the user to choose before proceeding. Do NOT default to option 1.**

For plain SPAs without `vue-router`, skip the routing choice — use Option 3 (catalog loads driven by localStorage / navigator).

---

### Main entry (`src/main.ts`)

All three options share the same `main.ts` — they differ in how `setLocale()` is called and whether the router participates.

```ts
// src/main.ts
import { createApp } from 'vue'
import App from './App.vue'
import { i18n, setLocale } from './i18n'
// import router from './router'  // if the project has vue-router

const app = createApp(App)
app.use(i18n)
// app.use(router)
app.mount('#app')

// Initialize locale direction on first load.
setLocale(i18n.global.locale.value as 'en' /* source locale constant */).catch(console.error)
```

Show the user the proposed edit to their existing `main.ts` before making it.

---

### Strategy 1: Unprefixed source locale

Route table uses a dynamic segment for non-source locales. Source-locale routes live at the bare path.

```ts
// src/router/index.ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { locales, sourceLocale, type Locale } from '../i18n/locales'
import { setLocale, i18n } from '../i18n'
import Home from '../pages/Home.vue'
import About from '../pages/About.vue'

const pageRoutes: RouteRecordRaw[] = [
  { path: '', name: 'home', component: Home },
  { path: 'about', name: 'about', component: About },
]

const routes: RouteRecordRaw[] = [
  // Source locale — unprefixed
  { path: '/', children: pageRoutes },
  // Target locales — prefixed with :locale param
  {
    path: '/:locale',
    children: pageRoutes,
    beforeEnter: (to, _from, next) => {
      const locale = to.params.locale as string
      if (!locales.includes(locale as Locale)) return next({ path: '/' })
      next()
    },
  },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(async (to) => {
  const param = to.params.locale as string | undefined
  const locale = (locales as readonly string[]).includes(param ?? '') ? (param as Locale) : sourceLocale
  if (i18n.global.locale.value !== locale) {
    await setLocale(locale)
  }
})

export default router
```

`localePath` helper for internal links:

```ts
// src/i18n/localePath.ts
import { sourceLocale } from './locales'

export function localePath(locale: string, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (locale === sourceLocale) return normalized
  return `/${locale}${normalized}`
}
```

Usage:

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { localePath } from '../i18n/localePath'
const { locale } = useI18n()
</script>

<template>
  <RouterLink :to="localePath(locale, '/about')">{{ t('nav.about') }}</RouterLink>
</template>
```

---

### Strategy 2: All locales prefixed

All routes live under `/:locale/`. Bare paths redirect.

```ts
// src/router/index.ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { locales, sourceLocale, type Locale } from '../i18n/locales'
import { setLocale, i18n } from '../i18n'
import Home from '../pages/Home.vue'
import About from '../pages/About.vue'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: `/${sourceLocale}` },
  {
    path: '/:locale',
    children: [
      { path: '', name: 'home', component: Home },
      { path: 'about', name: 'about', component: About },
    ],
    beforeEnter: (to, _from, next) => {
      const locale = to.params.locale as string
      if (!locales.includes(locale as Locale)) return next({ path: `/${sourceLocale}` })
      next()
    },
  },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(async (to) => {
  const locale = (to.params.locale as Locale) ?? sourceLocale
  if (i18n.global.locale.value !== locale) {
    await setLocale(locale)
  }
})

export default router
```

`localePath` helper (all prefixed variant):

```ts
// src/i18n/localePath.ts
export function localePath(locale: string, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `/${locale}${normalized}`
}
```

---

### Strategy 3 / plain SPA: No URL routing

No router changes. The locale is detected from `?lang=`, `localStorage`, then `navigator.language`.

Extend `src/i18n/index.ts` from Step 3 with a detector:

```ts
// Append to src/i18n/index.ts
function detectLocale(): Locale {
  const params = new URLSearchParams(window.location.search)
  const fromUrl = params.get('lang')
  if (fromUrl && (locales as readonly string[]).includes(fromUrl)) return fromUrl as Locale

  const fromStorage = localStorage.getItem('lang')
  if (fromStorage && (locales as readonly string[]).includes(fromStorage)) return fromStorage as Locale

  const fromNav = navigator.language.split('-')[0]
  if ((locales as readonly string[]).includes(fromNav)) return fromNav as Locale

  return sourceLocale
}

// Kick off detection once on import:
setLocale(detectLocale()).catch(console.error)
```

And persist the selection when the switcher fires:

```ts
export function saveLocale(locale: Locale) {
  localStorage.setItem('lang', locale)
}
```

---

### `index.html` lang attribute

Vite projects have an `index.html` at project root. Read the current `<html lang="...">` value. Then:

- Set `<html lang="...">` to the source locale value (e.g., `<html lang="en">`). If it already matches, no change is needed.
- If the existing value doesn't match `sourceLocale`, flag it to the user — the source-locale config may need updating.
- Remove any hardcoded `dir` attribute. `setLocale()` sets `dir` dynamically; a hardcoded value would flash incorrect direction for RTL locales during hydration.

Describe the exact change to the user before making it.

## Language Switcher (Step 6)

### Strategies 1 & 2: URL-based routing

```vue
<!-- src/components/LanguageSwitcher.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { locales, sourceLocale } from '../i18n/locales'
import { localePath } from '../i18n/localePath'

const { locale: currentLocale } = useI18n()
const route = useRoute()

const displayNames = computed(() => new Intl.DisplayNames([currentLocale.value], { type: 'language' }))

// Strip the current locale prefix from the pathname to get the base path.
function basePath(): string {
  const path = route.fullPath
  for (const loc of locales) {
    if (path === `/${loc}`) return '/'
    if (path.startsWith(`/${loc}/`)) return path.slice(loc.length + 1)
  }
  return path
}
</script>

<template>
  <nav class="lang-switcher">
    <RouterLink
      v-for="loc in locales"
      :key="loc"
      :to="localePath(loc, basePath())"
      :class="{ active: loc === currentLocale }"
    >
      {{ displayNames.of(loc) ?? loc }}
    </RouterLink>
  </nav>
</template>

<style scoped>
.lang-switcher { display: flex; gap: 0.5rem; align-items: center; }
.lang-switcher a { padding: 0.25rem 0.5rem; border-radius: 0.25rem; text-decoration: none; color: inherit; }
.lang-switcher a.active { font-weight: 600; background-color: rgba(0, 0, 0, 0.06); }
</style>
```

### Strategy 3 / plain SPA: No URL routing

No navigation — the switcher calls `setLocale()` and persists the choice.

```vue
<!-- src/components/LanguageSwitcher.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { locales, type Locale } from '../i18n/locales'
import { setLocale, saveLocale } from '../i18n'

const { locale: currentLocale } = useI18n()
const displayNames = computed(() => new Intl.DisplayNames([currentLocale.value], { type: 'language' }))

async function onChange(e: Event) {
  const next = (e.target as HTMLSelectElement).value as Locale
  await setLocale(next)
  saveLocale(next)
}
</script>

<template>
  <select :value="currentLocale" @change="onChange">
    <option v-for="loc in locales" :key="loc" :value="loc">
      {{ displayNames.of(loc) ?? loc }}
    </option>
  </select>
</template>
```

### Wiring

Import the switcher into `App.vue` (or an existing header component):

```vue
<!-- src/App.vue -->
<script setup lang="ts">
import LanguageSwitcher from './components/LanguageSwitcher.vue'
</script>

<template>
  <header>
    <LanguageSwitcher />
  </header>
  <RouterView />
</template>
```

**Styling**: the examples use minimal `<style scoped>`. If the project uses Tailwind / UnoCSS / CSS modules, rewrite the styles to match. Place the switcher wherever the existing navigation lives.
