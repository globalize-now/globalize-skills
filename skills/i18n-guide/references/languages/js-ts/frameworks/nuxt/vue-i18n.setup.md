# Nuxt Setup

This covers Nuxt 3 and Nuxt 4 projects using `@nuxtjs/i18n`. The module wraps vue-i18n and adds SSR-aware routing, browser-language detection, SEO metadata, and the `<NuxtLink>` / `$switchLocalePath` helpers.

## Packages (Step 2)

Install:

| Package | Type | Purpose |
|---------|------|---------|
| `@nuxtjs/i18n` | runtime (dep) | Nuxt module wrapping vue-i18n |
| `intl-messageformat` | runtime (dep) | ICU MessageFormat parser, used by the custom `messageCompiler` |

**Do NOT install raw `vue-i18n` separately.** The module bundles a compatible version. Installing it manually risks a version mismatch.

**Pin to `@nuxtjs/i18n@^10`.** v10 simplified the lazy-loading contract (removed the top-level `lazy` option and consolidated config around per-locale `file:` entries) and is the shape the snippets below emit. Older v9 usage is documented separately at the end of this file — prefer upgrading over pinning the legacy shape.

```bash
npm install '@nuxtjs/i18n@^10' 'intl-messageformat@^11'
```

Use the project's detected package manager (pnpm / yarn / bun) instead of `npm` if applicable.

## Directory Convention

`@nuxtjs/i18n` (modern versions) uses an `i18n/` directory at project root as the default location for config and locale files. Older Nuxt 3 projects may still place them elsewhere. Pick by detection:

| Nuxt version | Convention |
|--------------|-----------|
| Nuxt 4 | `i18n/locales/{locale}.json` with `langDir: 'locales'` under `i18n/` root |
| Nuxt 3 | `locales/{locale}.json` with `langDir: 'locales'` relative to project root |

The module resolves `langDir` relative to its own base (the `i18n/` directory in recent versions, or the Nuxt root for older configs). When in doubt, use the Nuxt 4 convention — the module is backward-compatible on Nuxt 3.

## Module Configuration (Step 4)

**This modifies `nuxt.config.ts`.** Describe the change before making it: adding `'@nuxtjs/i18n'` to `modules`, then an `i18n:` block with strategy, locales, langDir, and bundle settings.

```ts
// nuxt.config.ts  —  shape for @nuxtjs/i18n@^10
export default defineNuxtConfig({
  modules: ['@nuxtjs/i18n'],
  i18n: {
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    langDir: 'locales',
    // v10 removed the top-level `lazy` option — locale files are always lazy-loaded now.
    locales: [
      { code: 'en', language: 'en-US', file: 'en.json' },
      // Add additional locales here, e.g.:
      // { code: 'fr', language: 'fr-FR', file: 'fr.json' },
      // { code: 'ar', language: 'ar-EG', file: 'ar.json', dir: 'rtl' },
    ],
    bundle: {
      compositionOnly: true,  // tree-shake Legacy API
      runtimeOnly: false,     // include the message compiler — required for our custom ICU compiler
      fullInstall: true,      // keep <i18n-t> / <i18n-d> / <i18n-n> available
    },
    compilation: {
      strictMessage: false,   // ICU placeholders may look HTML-ish; disable the strict check
    },
    // vueI18n points at the config file. Path differs by Nuxt major:
    //   Nuxt 4: './i18n/i18n.config.ts'  (config lives inside the i18n/ directory)
    //   Nuxt 3: './i18n.config.ts'        (config lives at project root)
    vueI18n: './i18n/i18n.config.ts',
  },
})
```

### PO loader when `catalogFormat === 'po'`

> **Experimental — verify end-to-end before shipping.** The Nuxt wiring shown here assumes `@nuxtjs/i18n`'s lazy-loading pipeline routes `.po` file imports through Vite's transform chain, so `poLoader()` with `enforce: 'pre'` intercepts them before the module's own bundling runs. This *should* hold — the module calls `import(...)` for locale files and Vite's `enforce: 'pre'` runs before any other transform — but the skill has not been validated against a real Nuxt 3 / Nuxt 4 project in every routing strategy. If locales don't load correctly, re-run the setup phase and pick JSON while we validate the Nuxt path, or drop into the `@nuxtjs/i18n` issue tracker with a minimal reproduction. The Vite-SPA and Quasar PO paths are better-tested.

Create the loader module. Path depends on Nuxt major:

- **Nuxt 4**: `i18n/poLoader.ts`
- **Nuxt 3**: `poLoader.ts` at project root (alongside `i18n.config.ts`)

The loader body is identical to the Vite SPA variant (see `references/languages/js-ts/frameworks/vite/vue/vue-i18n.setup.md` § PO loader). Copy it verbatim — it's framework-agnostic (uses only Vite's `Plugin` type and `node:fs`).

Then wire it through `nuxt.config.ts` via `vite.plugins` — **not** `modules` (it's a Vite plugin, not a Nuxt module):

```ts
// nuxt.config.ts  (PO variant)  —  shape for @nuxtjs/i18n@^10
import { poLoader } from './i18n/poLoader'   // Nuxt 4
// import { poLoader } from './poLoader'     // Nuxt 3

export default defineNuxtConfig({
  modules: ['@nuxtjs/i18n'],
  vite: {
    plugins: [poLoader()],
  },
  i18n: {
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    langDir: 'locales',
    // v10 removed the top-level `lazy` option — locale files are always lazy-loaded now.
    locales: [
      { code: 'en', language: 'en-US', file: 'en.po' },   // note: .po extension
      // { code: 'fr', language: 'fr-FR', file: 'fr.po' },
      // { code: 'ar', language: 'ar-EG', file: 'ar.po', dir: 'rtl' },
    ],
    bundle: {
      compositionOnly: true,
      runtimeOnly: false,
      fullInstall: true,
    },
    compilation: {
      strictMessage: false,
    },
    vueI18n: './i18n/i18n.config.ts',
  },
})
```

The `@nuxtjs/i18n` module's `file` field accepts any extension — when the file is requested, Nuxt goes through Vite, which runs `poLoader` before handing the transformed JS to the module's loader.

**Source-map caveat:** the Vite SPA caveat applies — `.po` files have no source-map back-references after transform. Parse errors throw from `gettext-parser` with a line number; runtime errors point at compiled JS.

### Strategy choice

The module's `strategy` option decides how locale routing works:

| Value | Behavior |
|-------|----------|
| `prefix_except_default` | Default locale stays at `/about`; others get `/fr/about`. **Default — recommended.** |
| `prefix` | Every locale prefixed: `/en/about`, `/fr/about`. |
| `prefix_and_default` | Default locale is reachable at **both** `/about` and `/en/about`. Not recommended (SEO duplicate-content risk). |
| `no_prefix` | No URL prefixes — locale is detected from cookies / browser. |

If the user already has a strong preference, honor it. Otherwise default to `prefix_except_default` in guided mode (confirm) and in unguided mode (proceed).

## Vue I18n Config (Step 3)

Create the i18n config file. Path depends on Nuxt major:

- **Nuxt 4**: `i18n/i18n.config.ts` (inside the `i18n/` directory, alongside `locales/`)
- **Nuxt 3**: `i18n.config.ts` at project root

This is where the ICU `messageCompiler` lives — `@nuxtjs/i18n` picks it up via the `vueI18n` option in `nuxt.config.ts` (make sure that path matches the location you chose above):

```ts
// i18n/i18n.config.ts  (Nuxt 4)  —  or  i18n.config.ts at project root (Nuxt 3)
import IntlMessageFormat from 'intl-messageformat'
import type { MessageCompiler, MessageContext, CompileError } from 'vue-i18n'

const messageCompiler: MessageCompiler = (message, { locale, key, onError }) => {
  if (typeof message !== 'string') {
    onError?.(new Error(`[i18n] ICU compiler requires string messages (key: ${key})`) as CompileError)
    return () => key
  }
  const formatter = new IntlMessageFormat(message, locale)
  return (ctx: MessageContext) => formatter.format(ctx.values) as string
}

export default defineI18nConfig(() => ({
  legacy: false,
  fallbackLocale: 'en',
  messageCompiler,
}))
```

`defineI18nConfig` is auto-imported by the module — no `import` is needed. `locale` is deliberately omitted here: the module sets the active locale based on URL / cookie / browser detection per the chosen `strategy`.

Locale JSON files and the config file live at (Nuxt 4 convention):

```
i18n/
  i18n.config.ts
  locales/
    en.json
    fr.json  (etc.)
nuxt.config.ts
```

For Nuxt 3, swap `i18n/locales/` for `locales/` at project root and put `i18n.config.ts` at project root too (the Nuxt 3 convention pre-dates the `i18n/` directory). Update the `vueI18n:` path in `nuxt.config.ts` to match whichever layout you choose.

### ICU seed — why the Nuxt catalog is non-ICU by default

The the shared setup reference Step 7 ships a **non-ICU seed** for Nuxt (`{"welcome": "Welcome to {appName}"}`, no plural entry). Root cause: `@nuxtjs/i18n` delegates lazy-JSON handling to `@intlify/unplugin-vue-i18n`, which pre-compiles every lazy locale file at build time using Intlify's **default** (non-ICU) compiler. The custom `messageCompiler` registered in `i18n.config.ts` runs for messages evaluated at runtime (e.g. SFC `<i18n>` blocks, plain-string fallbacks), but the lazy-loaded bundle has already been pre-compiled by the time it lands on the client. Build-time pre-compilation of `{count, plural, one {...} other {...}}` fails with `error code: 2`.

v10 removed the top-level `lazy` option (locale files are always lazy) but the docs do not describe a JSON-path bypass for pre-compilation; `bundle.dropMessageCompiler` opts further *into* pre-compiling every resource, which is the opposite direction. Treat "ICU plural in JSON + v10 + default bundle settings" as unverified until validated end-to-end against a real build.

Real escape hatches for ICU on Nuxt:

1. **Switch `catalogFormat` to PO.** The `poLoader` Vite plugin runs with `enforce: 'pre'` and hands the raw PO string to the runtime `messageCompiler` unchanged. This is the documented ICU-safe path.
2. **Drop the `langDir` lazy-loading pattern** and import locale JSON statically, the same way the Vite SPA variant does. The custom `messageCompiler` then handles ICU end-to-end. Trade-off: loses `@nuxtjs/i18n`'s SSR-aware lazy loading.
3. **Move an individual ICU message into an SFC `<i18n>` block** ONLY if the rest of the catalog is non-ICU. Caveat: custom blocks are themselves transformed by the default (non-ICU) compiler — emitting `plural` / `select` there produces `unplugin-vue-i18n:resource` build failures. This hatch is therefore *not* a general ICU workaround and is listed only for completeness; prefer hatches 1 or 2.

Until one of the lazy-path fixes lands upstream, keep the JSON seed interpolation-only and advise users that ICU plurals / select require PO or static imports. Interpolation (`{name}`) works fine under default Nuxt bundling — it's only the ICU-specific keywords (`plural`, `select`, `selectordinal`) that trip the non-ICU pre-compile.

## Provider (Step 5)

**No manual `app.use(i18n)` call is needed** — the module registers vue-i18n during Nuxt bootstrapping. The `useI18n()` composable works directly inside any component's `<script setup>`.

### `<html lang>` and `<html dir>` via `useLocaleHead()`

The module exposes a `useLocaleHead()` composable that returns locale-aware head attributes (including `lang` and `dir`) and SEO meta tags. Wire it in `app.vue`:

```vue
<!-- app.vue -->
<script setup lang="ts">
const i18nHead = useLocaleHead({ seo: true })

useHead(() => ({
  htmlAttrs: {
    lang: i18nHead.value.htmlAttrs?.lang ?? 'en',
    // `useHead` types `dir` as the literal union `'ltr' | 'rtl' | 'auto'`,
    // but `useLocaleHead()` returns `string | undefined`. Narrow explicitly.
    dir: (i18nHead.value.htmlAttrs?.dir ?? 'ltr') as 'ltr' | 'rtl' | 'auto',
  },
  link: [...(i18nHead.value.link ?? [])],
  meta: [...(i18nHead.value.meta ?? [])],
}))
</script>

<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
```

`useLocaleHead({ seo: true })` emits `hreflang` alternate links and `og:locale` meta tags per the configured `locales[].language` values — point `baseUrl` at the site's canonical URL in `nuxt.config.ts` for these to be fully-qualified URLs.

### `baseUrl` for SEO

Add `baseUrl` to the `i18n` config when the user wants SEO / `hreflang`:

```ts
// nuxt.config.ts inside i18n: {}
baseUrl: process.env.NUXT_PUBLIC_SITE_URL,
```

This is required for the alternate-URL tags emitted by `useLocaleHead({ seo: true })` to be absolute.

### SSR hydration

`@nuxtjs/i18n` handles the server / client locale handoff — on first render the server picks the locale from URL / cookie / `accept-language`, and the client hydrates with the same locale. Avoid the following during `<script setup>` to prevent hydration mismatches:

- Reading `navigator.language` directly (exists only on client — let the module do it).
- Calling `useI18n().locale.value = 'xx'` during server render or top-of-setup synchronously — use `$switchLocalePath()` navigation or let the module's route-based resolution drive it.
- Conditional `t()` output that differs between server and client.

If the app requires explicitly gating code to "after hydration", use `onMounted()` for that logic.

## Language Switcher (Step 6)

`@nuxtjs/i18n` exposes `useSwitchLocalePath()` which returns a function that maps a target locale to the same page's URL in that locale:

```vue
<!-- components/LanguageSwitcher.vue -->
<script setup lang="ts">
import { computed } from 'vue'
const { locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()

// Use `typeof locale.value` so `loc.code` is the same `Locale` union `switchLocalePath` expects.
const availableLocales = computed(
  () => locales.value as Array<{ code: typeof locale.value; language?: string }>,
)
const displayNames = computed(() => new Intl.DisplayNames([locale.value], { type: 'language' }))
</script>

<template>
  <nav class="lang-switcher">
    <NuxtLink
      v-for="loc in availableLocales"
      :key="loc.code"
      :to="switchLocalePath(loc.code)"
      :class="{ active: loc.code === locale }"
    >
      {{ displayNames.of(loc.code) ?? loc.code }}
    </NuxtLink>
  </nav>
</template>

<style scoped>
.lang-switcher { display: flex; gap: 0.5rem; align-items: center; }
.lang-switcher a { padding: 0.25rem 0.5rem; border-radius: 0.25rem; text-decoration: none; color: inherit; }
.lang-switcher a.active { font-weight: 600; background-color: rgba(0, 0, 0, 0.06); }
</style>
```

Alternative: use the module's built-in `<SwitchLocalePathLink>` component, which correctly updates routes using dynamic route parameters during SSR:

```vue
<template>
  <SwitchLocalePathLink v-for="loc in availableLocales" :key="loc.code" :locale="loc.code">
    {{ displayNames.of(loc.code) ?? loc.code }}
  </SwitchLocalePathLink>
</template>
```

### Wiring

Import the switcher into `app.vue`, a shared layout under `layouts/`, or a header component:

```vue
<!-- app.vue (continued) -->
<script setup lang="ts">
import LanguageSwitcher from '~/components/LanguageSwitcher.vue'
// ...existing useLocaleHead wiring above...
</script>

<template>
  <div>
    <header>
      <LanguageSwitcher />
    </header>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
```

**Styling**: the scoped styles are a baseline. If the project uses Tailwind / UnoCSS / Nuxt UI / component libraries, rewrite the template to use those conventions.

## Link handling

Internal links should use `<NuxtLink>` throughout — the module rewrites the `to` prop based on the active locale and the chosen `strategy`. For same-page locale switches, use `$switchLocalePath()` / `useSwitchLocalePath()` rather than constructing URLs manually.

For programmatic navigation, use `useLocalePath()`:

```vue
<script setup lang="ts">
const localePath = useLocalePath()
const router = useRouter()

function goToSettings() {
  router.push(localePath('/settings'))
}
</script>
```

## If the project already uses `@nuxtjs/i18n@^9`

The skill emits v10 by default. If the project is pinned to v9 and the user does not want to upgrade, emit the following v9 shape instead of the snippets above:

```ts
// nuxt.config.ts — v9 shape
export default defineNuxtConfig({
  modules: ['@nuxtjs/i18n'],
  i18n: {
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    langDir: 'locales',
    lazy: true,                                      // v9 requires this explicitly
    locales: [
      { code: 'en', language: 'en-US', file: 'en.json' },
      // ...
    ],
    bundle: { compositionOnly: true, runtimeOnly: false, fullInstall: true },
    compilation: { strictMessage: false },
    vueI18n: './i18n/i18n.config.ts',
  },
})
```

Surface the decision to the user before writing:

> Your project currently uses `@nuxtjs/i18n@^9`. v10 simplifies the lazy-loading contract and is what this setup phase emits by default. Upgrading is a one-line change to `package.json` + removing the `lazy: true` line. Would you like to upgrade, or emit the v9 shape?

In unguided mode, prefer upgrading — but never silently bump a major-version dependency; if the project is pinned, fall back to the v9 shape and note it in the end-of-run summary.
