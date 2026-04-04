# Vite + SWC Setup

This covers Vite projects using `@vitejs/plugin-react-swc` — including plain Vite, TanStack Router, React Router, and any other SWC-based Vite setup.

## Packages

In addition to the core packages from Step 2, install:

| Package | Type | Purpose |
|---------|------|---------|
| `@lingui/detect-locale` | runtime | Browser locale detection (navigator, URL, storage, cookie) |
| `@lingui/swc-plugin` | dev | SWC macro transform |
| `@lingui/vite-plugin` | dev | Vite integration for catalog compilation |

**Example (npm):**

```bash
npm install @lingui/core @lingui/react @lingui/macro @lingui/detect-locale
npm install -D @lingui/cli @lingui/swc-plugin @lingui/vite-plugin
```

**Version pinning:** `@lingui/swc-plugin` must match the `swc_core` version shipped by `@vitejs/plugin-react-swc`. If the build fails with an AST schema or plugin invocation error, look up the compatible version at https://plugins.swc.rs and pin it exactly — e.g. `npm install -D @lingui/swc-plugin@5.8.0`. See "SWC plugin version mismatch" in Common Gotchas.

## Build Tool Integration (Step 4)

**This modifies `vite.config.ts`.** Describe the changes to the user before making them: adding `@lingui/swc-plugin` to the `react()` plugin's `plugins` array and adding `lingui()` as a top-level Vite plugin. If the config has unusual structure or unfamiliar plugins, show the proposed diff and ask for confirmation.

Modify `vite.config.ts` to add the SWC plugin and the Lingui Vite plugin:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { lingui } from '@lingui/vite-plugin'

export default defineConfig({
  plugins: [
    react({
      plugins: [['@lingui/swc-plugin', {}]],
    }),
    lingui(),
  ],
})
```

If the project already has other Vite plugins (e.g., TanStack Router plugin), keep them — just add the `lingui()` plugin alongside them and add `@lingui/swc-plugin` to the `react()` plugin's `plugins` array.

**Example with TanStack Router:**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import { lingui } from '@lingui/vite-plugin'

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react({
      plugins: [['@lingui/swc-plugin', {}]],
    }),
    lingui(),
  ],
})
```

## Provider Setup (Step 5)

The setup depends on whether the project uses per-page catalogs (file-based routing) or a single global catalog.

### Locale Routing Strategy

**If the project uses file-based routing (TanStack Router, React Router), STOP and present this to the user:**

> Choose a locale routing strategy:
> 1. **Unprefixed source locale** — source locale (e.g., English) keeps original URLs (`/about`). Other locales use `/$lang/about` (e.g., `/fr/about`). Best for preserving existing URLs and SEO.
> 2. **All locales prefixed** — every locale gets a prefix (`/en/about`, `/fr/about`). Bare paths (`/about`) redirect to the source locale (`/en/about`). Cleanest structure, single route tree.
> 3. **Skip locale routing** — use query param / localStorage / browser detection only, no URL path changes. Simplest setup.

**You MUST wait for the user to choose before proceeding. Do NOT default to option 1.**

For plain SPAs without file-based routing, skip the routing choice — use option 3 (the single catalog setup at the end of this section).

> **Note on Strategy 1 trade-off:** Client-side routers cannot rewrite URLs (serve different content while keeping the URL unchanged) the way server middleware can. Strategy 1 requires defining source locale routes at both `/about` and `/$lang/about`, resulting in some route file duplication. Shared page components avoid duplicating the actual UI code. Strategy 2 avoids this with a single route tree under `/$lang/`.

> **`lingui.config.ts` entries glob:** The default `entries` glob (`src/routes/**/*.tsx` for TanStack Router, `app/routes/**/*.tsx` for React Router) covers both unprefixed and `$lang/`-prefixed route files recursively — no glob changes needed for any strategy. Each route file gets its own co-located catalog regardless of whether it is prefixed or not.

---

### Per-page catalogs (TanStack Router, React Router with file-based routing)

**This pattern modifies the root route file** (`__root.tsx` for TanStack Router, root layout for React Router) by wrapping it with `I18nProvider`. Show the user what changes before making them.

#### Strategy 1: Unprefixed source locale (per-page catalogs)

Source locale routes live at `/about`, target locale routes at `/$lang/about`. The i18n setup reads the locale from the URL path:

```ts
// src/i18n.ts
import { i18n } from '@lingui/core'

// Must match the `locales` array in lingui.config.ts
export const LOCALES: readonly string[] = ['en', 'fr']
export const SOURCE_LOCALE = 'en'
const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi'])

function getDirection(locale: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale.split('-')[0]) ? 'rtl' : 'ltr'
}

/** Extract locale from URL path. Returns source locale for unprefixed paths. */
export function getLocaleFromPath(pathname: string = window.location.pathname): string {
  const segments = pathname.split('/')
  const maybeLocale = segments[1]
  if (maybeLocale && LOCALES.includes(maybeLocale)) return maybeLocale
  return SOURCE_LOCALE
}

export function activateLocale(locale: string, messages: Record<string, string>) {
  i18n.loadAndActivate({ locale, messages })
  document.documentElement.lang = locale
  document.documentElement.dir = getDirection(locale)
}

export { i18n }
```

Routes are split between unprefixed (source locale) and prefixed (target locales). Shared page components avoid duplicating UI code:

```
src/
  pages/
    About.tsx               ← shared page component
  routes/
    __root.tsx              ← I18nProvider
    about.tsx               ← /about (source locale)
    $lang/
      about.tsx             ← /$lang/about (target locales)
```

**TanStack Router:**

```tsx
// src/routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { I18nProvider } from '@lingui/react'
import { i18n } from '../i18n'

export const Route = createRootRoute({
  component: () => (
    <I18nProvider i18n={i18n}>
      <Outlet />
    </I18nProvider>
  ),
})
```

```tsx
// src/pages/About.tsx — shared page component
import { Trans } from '@lingui/react/macro'

export function AboutPage() {
  return <h1><Trans>About us</Trans></h1>
}
```

```tsx
// src/routes/about.tsx — source locale (unprefixed)
import { createFileRoute } from '@tanstack/react-router'
import { activateLocale, SOURCE_LOCALE } from '../i18n'
import { AboutPage } from '../pages/About'

export const Route = createFileRoute('/about')({
  beforeLoad: async () => {
    const { messages } = await import('./locales/about/' + SOURCE_LOCALE + '.ts')
    activateLocale(SOURCE_LOCALE, messages)
  },
  component: AboutPage,
})
```

```tsx
// src/routes/$lang/about.tsx — target locales (prefixed)
import { createFileRoute } from '@tanstack/react-router'
import { activateLocale } from '../../i18n'
import { AboutPage } from '../../pages/About'

export const Route = createFileRoute('/$lang/about')({
  beforeLoad: async ({ params }) => {
    const { messages } = await import('./locales/about/' + params.lang + '.ts')
    activateLocale(params.lang, messages)
  },
  component: AboutPage,
})
```

**React Router:**

```tsx
// Root layout (unchanged)
import { Outlet } from 'react-router'
import { I18nProvider } from '@lingui/react'
import { i18n } from './i18n'

export default function RootLayout() {
  return (
    <I18nProvider i18n={i18n}>
      <Outlet />
    </I18nProvider>
  )
}
```

```tsx
// app/routes/about.tsx — source locale (unprefixed)
import { activateLocale, SOURCE_LOCALE } from '../i18n'
import { AboutPage } from '../pages/About'

export async function loader() {
  const { messages } = await import('./locales/about/' + SOURCE_LOCALE + '.ts')
  activateLocale(SOURCE_LOCALE, messages)
  return null
}

export default AboutPage
```

```tsx
// app/routes/$lang/about.tsx — target locales (prefixed)
import type { Route } from './+types/about'
import { activateLocale } from '../../i18n'
import { AboutPage } from '../../pages/About'

export async function loader({ params }: Route.LoaderArgs) {
  const { messages } = await import('./locales/about/' + params.lang + '.ts')
  activateLocale(params.lang, messages)
  return null
}

export default AboutPage
```

Each route loads its own co-located catalog. Shared component strings are duplicated across route catalogs — this is the expected trade-off for smaller per-page bundles.

---

#### Strategy 2: All locales prefixed (per-page catalogs)

All routes live under `/$lang/`. Bare paths redirect to the source locale. This is the cleanest structure — single route tree, no duplication:

```ts
// src/i18n.ts
import { i18n } from '@lingui/core'

// Must match the `locales` array in lingui.config.ts
export const LOCALES: readonly string[] = ['en', 'fr']
export const SOURCE_LOCALE = 'en'
const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi'])

function getDirection(locale: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale.split('-')[0]) ? 'rtl' : 'ltr'
}

/** Extract locale from URL path. */
export function getLocaleFromPath(pathname: string = window.location.pathname): string {
  const segments = pathname.split('/')
  const maybeLocale = segments[1]
  if (maybeLocale && LOCALES.includes(maybeLocale)) return maybeLocale
  return SOURCE_LOCALE
}

export function activateLocale(locale: string, messages: Record<string, string>) {
  i18n.loadAndActivate({ locale, messages })
  document.documentElement.lang = locale
  document.documentElement.dir = getDirection(locale)
}

export { i18n }
```

```
src/routes/
  __root.tsx              ← I18nProvider + bare-path redirect
  $lang/
    about.tsx             ← /$lang/about (all locales)
```

**TanStack Router:**

```tsx
// src/routes/__root.tsx
import { createRootRoute, Outlet, redirect } from '@tanstack/react-router'
import { I18nProvider } from '@lingui/react'
import { i18n, LOCALES, SOURCE_LOCALE } from '../i18n'

export const Route = createRootRoute({
  beforeLoad: ({ location }) => {
    const segments = location.pathname.split('/').filter(Boolean)
    const firstSegment = segments[0]
    if (!firstSegment || !LOCALES.includes(firstSegment)) {
      // Bare path → redirect to source locale prefix
      throw redirect({ to: `/${SOURCE_LOCALE}${location.pathname}` })
    }
  },
  component: () => (
    <I18nProvider i18n={i18n}>
      <Outlet />
    </I18nProvider>
  ),
})
```

```tsx
// src/routes/$lang/about.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'
import { activateLocale } from '../../i18n'

export const Route = createFileRoute('/$lang/about')({
  beforeLoad: async ({ params }) => {
    const { messages } = await import('./locales/about/' + params.lang + '.ts')
    activateLocale(params.lang, messages)
  },
  component: AboutPage,
})

function AboutPage() {
  return <h1><Trans>About us</Trans></h1>
}
```

**React Router:**

```tsx
// Root layout — redirects bare paths to source locale
import { Outlet, redirect } from 'react-router'
import { I18nProvider } from '@lingui/react'
import { i18n, LOCALES, SOURCE_LOCALE } from './i18n'
import type { Route } from './+types/root'

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const firstSegment = segments[0]
  if (!firstSegment || !LOCALES.includes(firstSegment)) {
    throw redirect(`/${SOURCE_LOCALE}${url.pathname}`)
  }
  return null
}

export default function RootLayout() {
  return (
    <I18nProvider i18n={i18n}>
      <Outlet />
    </I18nProvider>
  )
}
```

```tsx
// app/routes/$lang/about.tsx
import { Trans } from '@lingui/react/macro'
import type { Route } from './+types/about'
import { activateLocale } from '../../i18n'

export async function loader({ params }: Route.LoaderArgs) {
  const { messages } = await import('./locales/about/' + params.lang + '.ts')
  activateLocale(params.lang, messages)
  return null
}

export default function AboutPage() {
  return <h1><Trans>About us</Trans></h1>
}
```

Each route loads its own co-located catalog. Shared component strings are duplicated across route catalogs — this is the expected trade-off for smaller per-page bundles.

#### Link handling

**Only relevant for Strategy 1 and 2.** If the user chose Option 3, skip this.

When locale routing is enabled, internal links must include the locale prefix.

**TanStack Router** — do NOT wrap `<Link>`. TanStack Router's `<Link>` has deeply typed `to` and `params` props; wrapping it loses type safety. Instead, use the router's native API:

Strategy 2 (all prefixed) — all routes are under `/$lang/`, so every `<Link>` already requires the `lang` param:

```tsx
import { Link, useParams } from '@tanstack/react-router'

function Navigation() {
  const { lang } = useParams({ strict: false })

  return (
    <nav>
      <Link to="/$lang" params={{ lang }}>Home</Link>
      <Link to="/$lang/about" params={{ lang }}>About</Link>
    </nav>
  )
}
```

Strategy 1 (unprefixed source) — source locale routes don't have a `$lang` param, while target locale routes do. Links must point to the correct route variant:

```tsx
import { Link, useParams } from '@tanstack/react-router'
import { SOURCE_LOCALE } from '../i18n'

function Navigation() {
  const params = useParams({ strict: false })
  const lang = (params as { lang?: string }).lang ?? SOURCE_LOCALE
  const isSource = lang === SOURCE_LOCALE

  return (
    <nav>
      {isSource ? (
        <>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
        </>
      ) : (
        <>
          <Link to="/$lang" params={{ lang }}>Home</Link>
          <Link to="/$lang/about" params={{ lang }}>About</Link>
        </>
      )}
    </nav>
  )
}
```

This duplication is the trade-off of Strategy 1 with TanStack Router's type system — the router treats `/$lang/about` and `/about` as distinct routes with different param types. For apps with many navigation links, Strategy 2 is significantly simpler.

**React Router** — `<Link to="...">` takes a plain string, so a path utility works cleanly:

```ts
// src/localePath.ts
import { SOURCE_LOCALE } from './i18n'

/** Build a locale-prefixed path. */
export function localePath(lang: string, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `/${lang}${normalized}`
}
```

Strategy 1 variant — only prefix non-source locales:

```ts
export function localePath(lang: string, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (lang === SOURCE_LOCALE) return normalized
  return `/${lang}${normalized}`
}
```

Write the variant that matches the user's chosen strategy.

Usage:

```tsx
import { Link, useParams } from 'react-router'
import { localePath } from '../localePath'
import { SOURCE_LOCALE } from '../i18n'

function Navigation() {
  const { lang } = useParams()
  const currentLang = lang ?? SOURCE_LOCALE

  return (
    <nav>
      <Link to={localePath(currentLang, '/')}>Home</Link>
      <Link to={localePath(currentLang, '/about')}>About</Link>
    </nav>
  )
}
```

Programmatic navigation:

```tsx
import { useNavigate, useParams } from 'react-router'
import { localePath } from '../localePath'
import { SOURCE_LOCALE } from '../i18n'

function SearchForm() {
  const navigate = useNavigate()
  const { lang } = useParams()

  function onSubmit(query: string) {
    navigate(localePath(lang ?? SOURCE_LOCALE, `/search?q=${encodeURIComponent(query)}`))
  }
  // ...
}
```

#### Existing link migration

Tell the user:

> Existing internal links need updating to include the locale prefix. Search for:
> - `<Link to="/...">` — update to use the locale-aware pattern shown above
> - `<a href="/...">` with internal paths — convert to router `<Link>` with locale handling
> - `navigate("/...")` — use `localePath()` or pass `params: { lang }`
>
> Navigation components (headers, sidebars, footers) are the highest priority since they appear on every page.

---

#### Option 3: Skip locale routing (per-page catalogs)

No URL path changes. Locale is detected from query param (`?lang=`), localStorage, or browser settings. This is the simplest setup — add path-based routing later if needed.

Create a minimal i18n setup file — catalog loading happens at the route level, not here:

```ts
// src/i18n.ts
import { i18n } from '@lingui/core'
import { detect, fromUrl, fromStorage, fromNavigator } from '@lingui/detect-locale'

// Must match the `locales` array in lingui.config.ts
const LOCALES: readonly string[] = ['en']
export const DEFAULT_LOCALE = 'en'
const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi'])

function getDirection(locale: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale.split('-')[0]) ? 'rtl' : 'ltr'
}

export function detectLocale(): string {
  const detected = detect(fromUrl('lang'), fromStorage('lang'), fromNavigator())
  if (detected) {
    if (LOCALES.includes(detected)) return detected
    // Regional fallback: es-MX → es
    const base = detected.split('-')[0]
    if (LOCALES.includes(base)) return base
  }
  return DEFAULT_LOCALE
}

export function activateLocale(locale: string, messages: Record<string, string>) {
  i18n.loadAndActivate({ locale, messages })
  document.documentElement.lang = locale
  document.documentElement.dir = getDirection(locale)
}

export function saveLocale(locale: string) {
  localStorage.setItem('lang', locale)
}

export { i18n }
```

The `detectLocale()` function tries sources in order: `?lang=` URL parameter, `lang` key in localStorage, browser language settings. The detected locale is validated against `LOCALES` — if there's no exact match, it tries the base language tag (e.g., `es-MX` → `es`) before falling back to `DEFAULT_LOCALE`. Keep `LOCALES` in sync with the `locales` array in `lingui.config.ts`. Call `saveLocale()` when the user explicitly switches locale (e.g., via a language picker) so the choice persists across visits.

Wrap the app with `I18nProvider` at the root (same as single catalog — only the loading location changes).

**TanStack Router** — wrap in `__root.tsx`, load catalogs in each route:

```tsx
// src/routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { I18nProvider } from '@lingui/react'
import { i18n } from '../i18n'

export const Route = createRootRoute({
  component: () => (
    <I18nProvider i18n={i18n}>
      <Outlet />
    </I18nProvider>
  ),
})
```

```tsx
// src/routes/about.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'
import { activateLocale, detectLocale, DEFAULT_LOCALE } from '../i18n'

export const Route = createFileRoute('/about')({
  beforeLoad: async () => {
    const locale = detectLocale()
    try {
      const { messages } = await import('./locales/about/' + locale + '.ts')
      activateLocale(locale, messages)
    } catch (e) {
      console.error(`Failed to load "${locale}" catalog, falling back to "${DEFAULT_LOCALE}"`, e)
      const { messages } = await import('./locales/about/' + DEFAULT_LOCALE + '.ts')
      activateLocale(DEFAULT_LOCALE, messages)
    }
  },
  component: AboutPage,
})

function AboutPage() {
  return <h1><Trans>About us</Trans></h1>
}
```

**React Router** — wrap in root layout, load catalogs in each route loader:

```tsx
// Root layout (unchanged)
import { Outlet } from 'react-router'
import { I18nProvider } from '@lingui/react'
import { i18n } from './i18n'

export default function RootLayout() {
  return (
    <I18nProvider i18n={i18n}>
      <Outlet />
    </I18nProvider>
  )
}
```

```tsx
// app/routes/about.tsx
import { Trans } from '@lingui/react/macro'
import { activateLocale, detectLocale, DEFAULT_LOCALE } from '../i18n'

export async function loader() {
  const locale = detectLocale()
  try {
    const { messages } = await import('./locales/about/' + locale + '.ts')
    activateLocale(locale, messages)
  } catch (e) {
    console.error(`Failed to load "${locale}" catalog, falling back to "${DEFAULT_LOCALE}"`, e)
    const { messages } = await import('./locales/about/' + DEFAULT_LOCALE + '.ts')
    activateLocale(DEFAULT_LOCALE, messages)
  }
  return null
}

export default function AboutPage() {
  return <h1><Trans>About us</Trans></h1>
}
```

Each route loads its own co-located catalog. Shared component strings are duplicated across route catalogs — this is the expected trade-off for smaller per-page bundles.

---

### `index.html` lang attribute

Vite projects have an `index.html` at the project root with a static `<html lang="...">` attribute (typically `<html lang="en">`). Since `activateLocale()` sets `document.documentElement.lang` dynamically at runtime, the static value serves as the default before JavaScript executes.

**Read `index.html` and check the `<html lang="...">` value.** Then update it:

- Set `<html lang="...">` to the source locale value from `lingui.config.ts` (e.g., `<html lang="en">`). If it already matches, no change is needed.
- If the existing value doesn't match `sourceLocale`, flag it to the user — the source locale config may need updating.
- Remove any hardcoded `dir` attribute (e.g., `dir="ltr"`). The `activateLocale()` function sets `dir` dynamically, and a hardcoded value would flash incorrect direction for RTL locales.

Describe the exact change to the user before making it (e.g., 'I will update `<html lang="en">` to `<html lang="es">` in `index.html` to match the source locale').

---

### Single catalog (plain SPA without file-based routing)

**This pattern modifies `main.tsx`** by wrapping the existing render tree with `I18nProvider`. Show the user the modified file before making the change.

For plain SPAs without file-based routing, use the option 3 (skip locale routing) i18n setup — locale is detected from query param, localStorage, or browser settings:

```ts
// src/i18n.ts
import { i18n } from '@lingui/core'
import { detect, fromUrl, fromStorage, fromNavigator } from '@lingui/detect-locale'

// Must match the `locales` array in lingui.config.ts
const LOCALES: readonly string[] = ['en']
const DEFAULT_LOCALE = 'en'
const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi'])

function getDirection(locale: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale.split('-')[0]) ? 'rtl' : 'ltr'
}

export function detectLocale(): string {
  const detected = detect(fromUrl('lang'), fromStorage('lang'), fromNavigator())
  if (detected) {
    if (LOCALES.includes(detected)) return detected
    // Regional fallback: es-MX → es
    const base = detected.split('-')[0]
    if (LOCALES.includes(base)) return base
  }
  return DEFAULT_LOCALE
}

export async function loadCatalog(locale: string) {
  try {
    const { messages } = await import(`./locales/${locale}/messages.ts`)
    i18n.loadAndActivate({ locale, messages })
  } catch (e) {
    console.error(`Failed to load "${locale}" catalog, falling back to "${DEFAULT_LOCALE}"`, e)
    const { messages } = await import(`./locales/${DEFAULT_LOCALE}/messages.ts`)
    i18n.loadAndActivate({ locale: DEFAULT_LOCALE, messages })
  }
  document.documentElement.lang = i18n.locale
  document.documentElement.dir = getDirection(i18n.locale)
}

export function saveLocale(locale: string) {
  localStorage.setItem('lang', locale)
}

// Detect and load the user's preferred locale
loadCatalog(detectLocale())

export { i18n }
```

Wrap the app with `I18nProvider` in `main.tsx`:

```tsx
import { I18nProvider } from '@lingui/react'
import { i18n } from './i18n'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <I18nProvider i18n={i18n}>
    <App />
  </I18nProvider>,
)
```
