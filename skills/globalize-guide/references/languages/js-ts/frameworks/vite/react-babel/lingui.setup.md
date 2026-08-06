# Vite + Babel Setup

> This is one of three setup references for this stack — read them in the order `references.setup` lists. `setup.locale-module.md` runs first and owns `src/i18n/locales.ts`; `setup.navigation.md` runs last and owns `src/i18n/navigation.ts` plus the language switcher. **This file imports those modules and never defines them.**


This covers Vite projects using `@vitejs/plugin-react` (Babel-based, without the `-swc` suffix).

> **Version gate — `@vitejs/plugin-react` v6+**: `@vitejs/plugin-react@6.0.0` (Oct 2025) dropped the `babel` option from its public `Options` type. Only `include`, `exclude`, `jsxImportSource`, `jsxRuntime`, and `reactRefreshHost` remain. The `react({ babel: {...} })` form below is silently ignored on v6+ — macros never get transformed, `tsc` errors with TS2353 on the `babel` property, and `@lingui/vite-plugin`'s macro-import check fails at build time.
>
> Before applying this reference, read the project's installed `@vitejs/plugin-react` version (from `package.json` or `package-lock.json` / `pnpm-lock.yaml` / `bun.lock`). If the major is 6 or higher:
>
> 1. Switch the project to `@vitejs/plugin-react-swc` + `@lingui/swc-plugin`.
> 2. Use `references/vite-swc.md` instead of this file for the rest of the setup.
>
> If the project is locked to v5 or lower (e.g. the lockfile pins a Vite/React combo that pre-dates v6), this reference still applies verbatim. Do not proactively downgrade `@vitejs/plugin-react`.

## Packages

In addition to the core Lingui packages (`@lingui/core`, `@lingui/react`, `@lingui/cli`), install:

| Package | Type | Purpose |
|---------|------|---------|
| `@lingui/detect-locale` | runtime | Browser locale detection (navigator, URL, storage, cookie) |
| `@lingui/babel-plugin-lingui-macro` | dev | Babel macro transform |
| `@lingui/vite-plugin` | dev | Vite integration for catalog compilation |

**Example (npm):**

```bash
npm install '@lingui/core@^6' '@lingui/react@^6' '@lingui/detect-locale@^6'
npm install -D '@lingui/cli@^6' '@lingui/babel-plugin-lingui-macro@^6' '@lingui/vite-plugin@^6'
```

## Build Tool Integration

**This modifies `vite.config.ts`.** Describe the changes to the user before making them: adding `@lingui/babel-plugin-lingui-macro` to the `react()` plugin's Babel config and adding `lingui()` as a top-level Vite plugin. If the config has unusual structure or unfamiliar plugins, show the proposed diff and ask for confirmation.

Modify `vite.config.ts` to add the Babel plugin and the Lingui Vite plugin:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { lingui } from '@lingui/vite-plugin'

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['@lingui/babel-plugin-lingui-macro'],
      },
    }),
    lingui(),
  ],
})
```

If the project already has Babel plugins configured in the `react()` call, add `@lingui/babel-plugin-lingui-macro` to the existing array.

**Example with TanStack Router:**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import { lingui } from '@lingui/vite-plugin'

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      // Exclude per-route locale catalogs (`./locales/{route}/{locale}.ts`)
      // so the router plugin doesn't try to treat them as route files
      // (avoids "Route module not found" warnings on first build, before
      // the catalog stubs exist).
      routeFileIgnorePattern: 'locales/',
    }),
    react({
      babel: {
        plugins: ['@lingui/babel-plugin-lingui-macro'],
      },
    }),
    lingui(),
  ],
})
```

**First-run ordering.** On a clean clone, run `vite build` (or start `vite dev` once) before `tsc -b` / `tsc --noEmit`. The TanStack Router plugin generates `src/routeTree.gen.ts` on first Vite run; `tsc` fails if the generated file does not yet exist. If the project's `npm run build` currently runs `tsc -b && vite build`, reorder to `vite build && tsc --noEmit` (or add a pre-build `vite build --mode dev` step) so the route tree is present before type-checking. `lingui compile` goes first in that chain — the compiled catalogs are gitignored as well, so on a clean clone they do not exist until the compiler has run; the full order is `lingui compile` → `vite build` → `tsc --noEmit`, which is exactly what the prefixed `build` script in "Catalog artifacts" (end of this file) sets up.

## Provider Setup

The setup depends on whether the project uses per-page catalogs (file-based routing) or a single global catalog.

### Locale Routing Strategy

**If the project uses file-based routing (TanStack Router, React Router), STOP and present this to the user:**

> Choose a locale routing strategy:
> 1. **Unprefixed source locale** — source locale (e.g., English) keeps original URLs (`/about`). Other locales use `/$locale/about` (e.g., `/fr/about`). Best for preserving existing URLs and SEO.
> 2. **All locales prefixed** — every locale gets a prefix (`/en/about`, `/fr/about`). Bare paths (`/about`) redirect to the source locale (`/en/about`). Cleanest structure, single route tree.
> 3. **Skip locale routing** — use query param / localStorage / browser detection only, no URL path changes. Simplest setup.

**You MUST wait for the user to choose before proceeding. Do NOT default to option 1.**

For plain SPAs without file-based routing, skip the routing choice — use option 3 (the single catalog setup at the end of this section).

> **Note on Strategy 1 trade-off:** Client-side routers cannot rewrite URLs (serve different content while keeping the URL unchanged) the way server middleware can. Strategy 1 requires defining source locale routes at both `/about` and `/$locale/about`, resulting in some route file duplication. Shared page components avoid duplicating the actual UI code. Strategy 2 avoids this with a single route tree under `/$locale/`.

> **`lingui.config.ts` entries glob:** The default `entries` glob (`src/routes/**/*.tsx` for TanStack Router, `app/routes/**/*.tsx` for React Router) covers both unprefixed and `$locale/`-prefixed route files recursively — no glob changes needed for any strategy. Each route file gets its own co-located catalog regardless of whether it is prefixed or not.

---

### Per-page catalogs (TanStack Router, React Router with file-based routing)

**This pattern modifies the root route file** (`__root.tsx` for TanStack Router, root layout for React Router) by wrapping it with `I18nProvider`. Show the user what changes before making them.

> **Heads-up for Step 8 (first extract):** the per-route dynamic imports shown below (`import(\`./locales/{route}/${locale}.ts\`)`) must resolve at extract time, so every target path needs an `export const messages = {}` stub on first run. See *"Catalog artifacts: bootstrapping, scripts, `.gitignore`"* at the end of this file — follow its stub-bootstrapping step before running `lingui extract-experimental` the first time.

#### Strategy 1: Unprefixed source locale (per-page catalogs)

Source locale routes live at `/about`, target locale routes at `/$locale/about`. The i18n setup reads the locale from the URL path:

```ts
// src/i18n/index.ts
import { i18n } from '@lingui/core'
import { getDirection, sourceLocale, type Locale } from './locales'
import { stripLocalePrefix } from './navigation'

// Re-export the locale module so consumers need one import.
export * from './locales'

/** Extract the locale from a URL path. Returns the source locale for unprefixed paths. */
export function getLocaleFromPath(pathname: string = window.location.pathname): Locale {
  return stripLocalePrefix(pathname).locale ?? sourceLocale
}

export function activateLocale(locale: string, messages: Record<string, string>) {
  i18n.loadAndActivate({ locale, messages })
  document.documentElement.lang = locale
  document.documentElement.dir = getDirection(locale)
}

export { i18n }
```

`locales`, `sourceLocale`, `Locale`, `resolveLocale` and `getDirection` live in `src/i18n/locales.ts`; `stripLocalePrefix` lives in `src/i18n/navigation.ts`. Both are created by the shared Lingui setup references — do not redeclare them here.

Routes are split between unprefixed (source locale) and prefixed (target locales). Shared page components avoid duplicating UI code:

```
src/
  pages/
    About.tsx               ← shared page component
  routes/
    __root.tsx              ← I18nProvider
    about.tsx               ← /about (source locale)
    $locale/
      about.tsx             ← /$locale/about (target locales)
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
import { activateLocale, sourceLocale } from '../i18n'
import { AboutPage } from '../pages/About'

export const Route = createFileRoute('/about')({
  beforeLoad: async () => {
    const { messages } = await import('./locales/about/' + sourceLocale + '.ts')
    activateLocale(sourceLocale, messages)
  },
  component: AboutPage,
})
```

```tsx
// src/routes/$locale/about.tsx — target locales (prefixed)
import { createFileRoute } from '@tanstack/react-router'
import { activateLocale } from '../../i18n'
import { AboutPage } from '../../pages/About'

export const Route = createFileRoute('/$locale/about')({
  beforeLoad: async ({ params }) => {
    const { messages } = await import('./locales/about/' + params.locale + '.ts')
    activateLocale(params.locale, messages)
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
import { activateLocale, sourceLocale } from '../i18n'
import { AboutPage } from '../pages/About'

export async function loader() {
  const { messages } = await import('./locales/about/' + sourceLocale + '.ts')
  activateLocale(sourceLocale, messages)
  return null
}

export default AboutPage
```

```tsx
// app/routes/$locale/about.tsx — target locales (prefixed)
import type { Route } from './+types/about'
import { activateLocale } from '../../i18n'
import { AboutPage } from '../../pages/About'

export async function loader({ params }: Route.LoaderArgs) {
  const { messages } = await import('./locales/about/' + params.locale + '.ts')
  activateLocale(params.locale, messages)
  return null
}

export default AboutPage
```

Each route loads its own co-located catalog. Shared component strings are duplicated across route catalogs — this is the expected trade-off for smaller per-page bundles.

---

#### Strategy 2: All locales prefixed (per-page catalogs)

All routes live under `/$locale/`. Bare paths redirect to the source locale. This is the cleanest structure — single route tree, no duplication:

```ts
// src/i18n/index.ts
import { i18n } from '@lingui/core'
import { getDirection, sourceLocale, type Locale } from './locales'
import { stripLocalePrefix } from './navigation'

// Re-export the locale module so consumers need one import.
export * from './locales'

/** Extract the locale from a URL path. Returns the source locale for unprefixed paths. */
export function getLocaleFromPath(pathname: string = window.location.pathname): Locale {
  return stripLocalePrefix(pathname).locale ?? sourceLocale
}

export function activateLocale(locale: string, messages: Record<string, string>) {
  i18n.loadAndActivate({ locale, messages })
  document.documentElement.lang = locale
  document.documentElement.dir = getDirection(locale)
}

export { i18n }
```

`locales`, `sourceLocale`, `Locale`, `resolveLocale` and `getDirection` live in `src/i18n/locales.ts`; `stripLocalePrefix` lives in `src/i18n/navigation.ts`. Both are created by the shared Lingui setup references — do not redeclare them here.

```
src/routes/
  __root.tsx              ← I18nProvider + bare-path redirect
  $locale/
    about.tsx             ← /$locale/about (all locales)
```

**TanStack Router:**

```tsx
// src/routes/__root.tsx
import { createRootRoute, Outlet, redirect } from '@tanstack/react-router'
import { I18nProvider } from '@lingui/react'
import { i18n, locales, sourceLocale } from '../i18n'

export const Route = createRootRoute({
  beforeLoad: ({ location }) => {
    const segments = location.pathname.split('/').filter(Boolean)
    const firstSegment = segments[0]
    if (!firstSegment || !locales.includes(firstSegment)) {
      // Bare path → redirect to source locale prefix
      throw redirect({ to: `/${sourceLocale}${location.pathname}` })
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
// src/routes/$locale/about.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'
import { activateLocale } from '../../i18n'

export const Route = createFileRoute('/$locale/about')({
  beforeLoad: async ({ params }) => {
    const { messages } = await import('./locales/about/' + params.locale + '.ts')
    activateLocale(params.locale, messages)
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
import { i18n, locales, sourceLocale } from './i18n'
import type { Route } from './+types/root'

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const firstSegment = segments[0]
  if (!firstSegment || !locales.includes(firstSegment)) {
    throw redirect(`/${sourceLocale}${url.pathname}`)
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
// app/routes/$locale/about.tsx
import { Trans } from '@lingui/react/macro'
import type { Route } from './+types/about'
import { activateLocale } from '../../i18n'

export async function loader({ params }: Route.LoaderArgs) {
  const { messages } = await import('./locales/about/' + params.locale + '.ts')
  activateLocale(params.locale, messages)
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

Strategy 2 (all prefixed) — all routes are under `/$locale/`, so every `<Link>` already requires the `locale` param:

```tsx
import { Link, useParams } from '@tanstack/react-router'

function Navigation() {
  const { locale } = useParams({ strict: false })

  return (
    <nav>
      <Link to="/$locale" params={{ locale }}>Home</Link>
      <Link to="/$locale/about" params={{ locale }}>About</Link>
    </nav>
  )
}
```

Strategy 1 (unprefixed source) — source locale routes don't have a `$locale` param, while target locale routes do. Links must point to the correct route variant:

Declare the items once as an `as const` array so the branch is written **once per navigation component, not once per link**:

```tsx
import { Link } from '@tanstack/react-router'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { sourceLocale } from '../i18n'
import { useLocale } from '../i18n/navigation'

const NAV = [
  { label: msg`Home`,  to: '/',      localeTo: '/$locale' },
  { label: msg`About`, to: '/about', localeTo: '/$locale/about' },
] as const

function Navigation() {
  const { t } = useLingui()
  const locale = useLocale()
  const isSource = locale === sourceLocale

  return (
    <nav>
      {NAV.map((item) =>
        isSource
          ? <Link key={item.to} to={item.to}>{t(item.label)}</Link>
          : <Link key={item.to} to={item.localeTo} params={{ locale }}>{t(item.label)}</Link>,
      )}
    </nav>
  )
}
```

`as const` keeps `to` and `localeTo` literal types, so `<Link>`'s inference survives the indirection. The branch remains — the router treats `/$locale/about` and `/about` as distinct routes with different param types — but it no longer scales with link count. Under Strategy 2, drop the `localeTo` column and the branch entirely.

**React Router** — `<Link to="...">` takes a plain string, so use the helpers from `src/i18n/navigation.ts` (owned by the shared navigation reference — do not write a `src/localePath.ts` here):

```tsx
import { Link } from 'react-router'
import { useLocalePath } from '../i18n/navigation'

function Navigation() {
  const localePath = useLocalePath()
  return (
    <nav>
      <Link to={localePath('/')}>Home</Link>
      <Link to={localePath('/about')}>About</Link>
    </nav>
  )
}
```

Programmatic navigation:

```tsx
import { useNavigate } from 'react-router'
import { useLocalePath } from '../i18n/navigation'

function SearchForm() {
  const navigate = useNavigate()
  const localePath = useLocalePath()

  function onSubmit(query: string) {
    navigate(localePath(`/search?q=${encodeURIComponent(query)}`))
  }
  // ...
}
```

`useLocalePath()` reads the active locale itself, so no call site needs `useParams()` or a `?? sourceLocale` fallback, and the chosen strategy is baked into the helper — nothing above differs between Strategy 1 and Strategy 2.

#### Existing link migration

Tell the user:

> Existing internal links need updating to include the locale prefix. Search for:
> - `<Link to="/...">` — wrap the `to` with `localePath()` (React Router), or add the `$locale` param (TanStack Router)
> - `<a href="/...">` with internal paths — convert to a router `<Link>` with locale handling
> - `navigate("/...")` — wrap with `localePath()`, or pass `params: { locale }`
>
> Navigation components (headers, sidebars, footers) are the highest priority since they appear on every page.

---

#### Option 3: Skip locale routing (per-page catalogs)

No URL path changes. Locale is detected from query param (`?lang=`), localStorage, or browser settings. This is the simplest setup — add path-based routing later if needed.

Create a minimal i18n setup file — catalog loading happens at the route level, not here:

```ts
// src/i18n/index.ts
import { i18n } from '@lingui/core'
import { detect, fromUrl, fromStorage, fromNavigator } from '@lingui/detect-locale'
import { getDirection, resolveLocale, type Locale } from './locales'

// Re-export the locale module so consumers need one import.
export * from './locales'

export function detectLocale(): Locale {
  return resolveLocale(detect(fromUrl('lang'), fromStorage('lang'), fromNavigator()))
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

`detectLocale()` tries sources in order: `?lang=` URL parameter, `lang` key in localStorage, browser language settings. `resolveLocale` (from `src/i18n/locales.ts`) validates the result against the configured locales, falls back to the base language tag (`es-MX` → `es`), and finally to the source locale — so this file holds no locale list of its own. Call `saveLocale()` when the user explicitly switches locale so the choice persists across visits.

There is **no** `src/i18n/navigation.ts` under Option 3 — no URL carries a locale, so there is nothing to prefix.

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
import { activateLocale, detectLocale, sourceLocale } from '../i18n'

export const Route = createFileRoute('/about')({
  beforeLoad: async () => {
    const locale = detectLocale()
    try {
      const { messages } = await import('./locales/about/' + locale + '.ts')
      activateLocale(locale, messages)
    } catch (e) {
      console.error(`Failed to load "${locale}" catalog, falling back to "${sourceLocale}"`, e)
      const { messages } = await import('./locales/about/' + sourceLocale + '.ts')
      activateLocale(sourceLocale, messages)
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
import { activateLocale, detectLocale, sourceLocale } from '../i18n'

export async function loader() {
  const locale = detectLocale()
  try {
    const { messages } = await import('./locales/about/' + locale + '.ts')
    activateLocale(locale, messages)
  } catch (e) {
    console.error(`Failed to load "${locale}" catalog, falling back to "${sourceLocale}"`, e)
    const { messages } = await import('./locales/about/' + sourceLocale + '.ts')
    activateLocale(sourceLocale, messages)
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

### Single catalog (plain SPA without file-based routing)

**This pattern modifies `main.tsx`** by wrapping the existing render tree with `I18nProvider`. Show the user the modified file before making the change.

For plain SPAs without file-based routing, use the option 3 (skip locale routing) i18n setup — locale is detected from query param, localStorage, or browser settings:

```ts
// src/i18n/index.ts
import { i18n } from '@lingui/core'
import { detect, fromUrl, fromStorage, fromNavigator } from '@lingui/detect-locale'
import { getDirection, resolveLocale, sourceLocale, type Locale } from './locales'

// Re-export the locale module so consumers need one import.
export * from './locales'

export function detectLocale(): Locale {
  return resolveLocale(detect(fromUrl('lang'), fromStorage('lang'), fromNavigator()))
}

export async function loadCatalog(locale: string) {
  try {
    const { messages } = await import(`../locales/${locale}/messages.ts`)
    i18n.loadAndActivate({ locale, messages })
  } catch (e) {
    console.error(`Failed to load "${locale}" catalog, falling back to "${sourceLocale}"`, e)
    const { messages } = await import(`../locales/${sourceLocale}/messages.ts`)
    i18n.loadAndActivate({ locale: sourceLocale, messages })
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

### 6. Language Switcher

The component depends on the routing strategy.

#### Strategy 1 and 2: URL-based routing

`switchLocalePath(pathname, loc)` from `src/i18n/navigation.ts` gives the current page under another locale, so **one component covers both strategies and both routers** — the four hand-written variants this section used to carry are gone.

```tsx
// src/components/LanguageSwitcher.tsx
import { locales, localeDisplayName } from '../i18n'
import { useLocale, switchLocalePath } from '../i18n/navigation'

export function LanguageSwitcher() {
  const currentLocale = useLocale()

  return (
    <nav style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      {locales.map((loc) => (
        <a
          key={loc}
          href={switchLocalePath(window.location.pathname, loc)}
          hrefLang={loc}
          aria-current={loc === currentLocale ? 'true' : undefined}
          style={{
            padding: '0.25rem 0.5rem',
            borderRadius: '0.25rem',
            textDecoration: 'none',
            color: 'inherit',
            fontWeight: loc === currentLocale ? 600 : 400,
            backgroundColor: loc === currentLocale ? 'rgba(0, 0, 0, 0.06)' : 'transparent',
          }}
        >
          {localeDisplayName(loc)}
        </a>
      ))}
    </nav>
  )
}
```

**Use a plain `<a>`, not a router `<Link>`, in the switcher — on both routers.** On TanStack Router the target route type is not statically known (`switchLocalePath` returns a string), and on either router a full document navigation is what re-runs the route's catalog load in the new locale. A client-side transition would leave the previously activated catalog in place.

On React Router, `useLocation().pathname` is preferable to `window.location.pathname` so the switcher re-renders on navigation:

```tsx
import { useLocation } from 'react-router'
const { pathname } = useLocation()
// ... href={switchLocalePath(pathname, loc)}
```

#### Option 3 / plain SPA: No URL routing

No navigation occurs — the switcher loads a new catalog and re-activates the locale. `useLingui()` ensures the component re-renders when the locale changes. There is no path to link to, so a `<select>` is the right control.

**Single catalog:**

```tsx
// src/components/LanguageSwitcher.tsx
import { useLingui } from '@lingui/react'
import { locales, localeDisplayName, loadCatalog, saveLocale } from '../i18n'

export function LanguageSwitcher() {
  const { i18n } = useLingui()

  async function switchLocale(newLocale: string) {
    await loadCatalog(newLocale)
    saveLocale(newLocale)
  }

  return (
    <select
      value={i18n.locale}
      onChange={(e) => switchLocale(e.target.value)}
      style={{
        padding: '0.375rem 0.5rem',
        borderRadius: '0.375rem',
        border: '1px solid #d1d5db',
        backgroundColor: 'transparent',
        fontSize: 'inherit',
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
    >
      {locales.map((loc) => (
        <option key={loc} value={loc}>
          {localeDisplayName(loc)}
        </option>
      ))}
    </select>
  )
}
```

`loadCatalog` already handles the failed-import fallback and updates `<html lang>` / `<html dir>`, so the switcher does not repeat any of it.

**Per-page catalogs with Option 3:** Each route loads its own co-located catalog, so the switcher cannot import from a single known path. Two approaches:

1. **Reload the page** — simplest. Set the locale in localStorage and reload: `saveLocale(newLocale); window.location.reload()`. The route's `beforeLoad`/`loader` will detect the new locale via `detectLocale()` and load the correct catalog.

2. **Catalog loader prop** — pass a loader function from each page that knows its own catalog path:

   ```tsx
   // In a route component:
   <LanguageSwitcher loadCatalog={async (locale) => {
     const { messages } = await import(`./locales/about/${locale}.ts`)
     return messages
   }} />
   ```

   This avoids a full page reload but requires each page to pass the loader.

Approach 1 is recommended for simplicity unless the reload causes a poor user experience (e.g., loss of form state).

#### Wiring

Import the switcher into the root route component or a shared layout:

**TanStack Router** — in `src/routes/__root.tsx`:

```tsx
import { LanguageSwitcher } from '../components/LanguageSwitcher'

// Inside the component function:
<I18nProvider i18n={i18n}>
  <LanguageSwitcher />
  <Outlet />
</I18nProvider>
```

**React Router** — in the root layout:

```tsx
import { LanguageSwitcher } from './components/LanguageSwitcher'

// Inside the component function:
<I18nProvider i18n={i18n}>
  <LanguageSwitcher />
  <Outlet />
</I18nProvider>
```

**Plain SPA** — in `main.tsx` or `App.tsx`:

```tsx
import { LanguageSwitcher } from './components/LanguageSwitcher'

// Inside the component tree:
<I18nProvider i18n={i18n}>
  <LanguageSwitcher />
  <App />
</I18nProvider>
```

If the project has a shared header/navigation component, place the switcher there instead of directly in the provider wrapper.

**Styling**: The examples use inline styles as a baseline. Adapt the styling to match the project's CSS approach (Tailwind, CSS Modules, etc.) and the visual style of the surrounding navigation.

---

## Catalog artifacts: bootstrapping, scripts, `.gitignore`

Work through this section after the provider setup above and before the first `lingui extract` run.

### Catalog stub bootstrapping (per-page catalogs only)

Skip this if the project uses the single-catalog layout — it applies only to the per-page layout above.

Every per-page route shown above loads its catalog via a dynamic `import()` of `./locales/{route}/{locale}.ts`. Lingui's per-page extractor resolves those dynamic imports with esbuild at extract time — *before* it writes any `.po` or compiled catalog files. On a fresh project the `locales/` directories don't exist yet, so the very first run of `lingui extract-experimental` fails with either `Could not resolve import(...)` or `No matches for the glob in ./locales/${locale}.ts`, and exits before generating anything.

**Bootstrap before the first `lingui extract-experimental` run (the `scaffold_catalogs` step of Phase 2):** for every route that declares `import('./locales/{route}/' + locale + '.ts')`, create a compiled-catalog stub at each `locales/{route}/{locale}.ts` target containing a single line:

```ts
export const messages = {}
```

For the Strategy 1 layout with `locales = ['en', 'fr']` and routes `about.tsx` + `dashboard.tsx`, that's:

```
src/routes/locales/about/en.ts
src/routes/locales/about/fr.ts
src/routes/locales/dashboard/en.ts
src/routes/locales/dashboard/fr.ts
```

React Router projects use `app/routes/` in place of `src/routes/`. Prefixed routes resolve their specifier relative to their own directory, so `src/routes/$locale/about.tsx` needs its stubs at `src/routes/$locale/locales/about/{locale}.ts`.

One `export const messages = {}` line per file — the extractor will overwrite these with real compiled catalogs after the first `lingui:extract` + `lingui:compile` cycle.

If the route list is long, enumerate it with grep (adapt the locales to the project's `locales` array, and the directory to `app/routes/` for React Router):

```sh
grep -rlE "import\\([^)]*\\./locales/" src/routes/ | while read f; do
  name="$(basename "$f" .tsx)"
  dir="$(dirname "$f")/locales/$name"
  mkdir -p "$dir"
  for loc in en fr; do echo "export const messages = {}" > "$dir/$loc.ts"; done
done
```

The script is a convenience — the load-bearing step is verifying that every `import()` target path listed in the route files has a matching stub. Routes using non-default paths (e.g. `'./locales/profile/' + locale + '.ts'` inside `src/routes/user/settings.tsx`) must have stubs at the exact specifier the code uses.

> **These stubs are local-only scaffolding.** They are written to the paths you just gitignored, so they are never committed — and they do not need to be. They exist for exactly one situation: the **very first** `lingui extract` on a project that has no `.po` files yet, where the extractor must resolve the route files' dynamic catalog imports before any catalog exists.
>
> **On a fresh clone, do not re-seed stubs — run `lingui compile`.** The `.po` sources are committed, so `lingui compile` regenerates the real compiled catalogs. Seeding is only correct when there is no `.po` file at all.
>
> Order inside setup: append the `.gitignore` rule → seed stubs → `lingui extract` → `lingui compile`. After the first compile the stubs are overwritten by real catalogs, which stay untracked.
>
> Do not run `git add -A` between seeding and the ignore rule landing.

### Catalog scripts

Add the extract and compile scripts to `package.json`, and **prepend** `lingui compile && ` to `dev`, `build`, and `typecheck` (if present) — prefix the existing value, never replace it:

```json
{
  "scripts": {
    "lingui:extract": "lingui extract --clean",
    "lingui:compile": "lingui compile",
    "dev": "lingui compile && vite",
    "build": "lingui compile && vite build"
  }
}
```

**`lingui compile` must run before the app is built, type-checked, or served.** The compiled catalogs are not in git, so every fresh clone and every CI run starts without them. Call the binary directly (`lingui compile && …`), not through `npm run`, so the scripts work under npm, pnpm, yarn, and bun alike. Do **not** use a `prebuild` hook — pnpm ≥7 disables pre/post scripts by default and Yarn Berry dropped them entirely, so it would silently no-op for two of the four package managers this skill supports.

Known limitation: in dev, a `.po` edited after startup (e.g. a Globalize delivery pulled mid-session) needs a dev-server restart, because the compile ran at startup.

**Which extractor:** `lingui extract --clean` above is the single-catalog form. For the per-page layout the extract script is `lingui extract-experimental` instead — the per-page extractor is what resolves the route files' dynamic `import()` specifiers. Use the one matching the layout you set up.

**TypeScript projects:** this reference ships no `lingui.config.ts` block, so there is no `compileNamespace: 'ts'` to rely on. If the project has a `tsconfig.json`, use `lingui compile --typescript` everywhere `lingui compile` appears above (the `lingui:compile` script and the `dev` / `build` prefixes) so the compiler emits `.ts` catalogs the route `import()`s can resolve and type-check. Omit the flag for plain-JS projects.

### `.gitignore`

Compiled catalogs are build output, not source. Lingui's own CLI docs are explicit: *"Compiled files should be ignored by version control as they are generated during deployment."* Unlike Paraglide, the Lingui compiler does **not** emit a `.gitignore` of its own, so add the rule yourself.

Append to the project's root `.gitignore` (create it if missing). In guided mode, show the diff first if the file already has rules. If an equivalent rule is already present, skip — this step is idempotent.

Emit **only** the block matching the catalog layout the project actually uses — never both.

Per-page catalogs (`src/routes/**/locales/{route}/{locale}.ts`):

```gitignore
# Lingui compiled catalogs — regenerated by `lingui compile`
src/routes/**/locales/**/*.ts
src/routes/**/locales/**/*.js
```

Single catalog (`src/locales/{locale}/messages.ts`):

```gitignore
# Lingui compiled catalogs — regenerated by `lingui compile`
src/locales/*/messages.ts
src/locales/*/messages.js
src/locales/*/messages.d.ts
```

**Extension caveat.** This reference does not ship a `lingui.config.ts` block, so the compiled extension depends on the config you created in `create_config`: with `compileNamespace: 'ts'` (or `lingui compile --typescript`) the output is `.ts`; with the default (`cjs`) it is `.js`. The block above ignores both, so the rule is correct either way — but derive the real *directory* from the config you wrote (`catalogs[].path`, or `experimental.extractor.output` for the per-page extractor) and from the actual `import()` / `require()` specifiers in the route files, and adjust the paths above if they differ. Confirm with the `git check-ignore` self-check below.

**Do not ignore the `.po` files, and do not ignore the directory.** The compiled catalog sits in the *same directory* as its `.po` source, and the `.po` is the translation source of truth — it is what Globalize imports from the repo in Phase 4. So:

- never `<dir>/` (directory rule — swallows the `.po`),
- never `<dir>/*/messages.*` (extension wildcard — swallows the `.po`),
- always the explicit compiled extensions shown above.

A pattern containing a `/` is anchored to the `.gitignore`'s directory, so no leading slash is needed. `**/` matches zero or more directories. `*.ts` already covers `*.d.ts`; the anchored `messages.ts` form does not, hence the explicit line.

Self-check before moving on (both must hold):

```bash
git check-ignore -v <one real compiled path>   # prints the matching rule → ignored
git check-ignore    <its .po sibling>          # exits 1, prints nothing → still tracked
```

**Sweep for strays before you finish.** Bootstrap stubs seeded at a path the final config does not emit to — e.g. a single-catalog `locale/{locale}/messages.ts` left behind after the config settled on per-page catalogs — are compiled artifacts too, and the pattern above will not match them. After the first successful `lingui compile`, list every compiled catalog on disk and delete any that the resolved `lingui.config.*` no longer produces. Do **not** widen the ignore rule to cover a path nothing imports.

**Already-tracked artifacts.** `.gitignore` does not untrack files. If `git ls-files` shows compiled catalogs already committed (an existing project, or a re-run), tell the user and, with their consent, run:

```bash
git rm --cached --quiet <compiled paths>
```

The files stay on disk; git stops tracking them. Without this, the ignore rule has no effect on those paths.

Ignoring the compiled catalogs is only safe because `lingui compile` runs before every build — see the catalog scripts above. Do not do one without the other.

---

## Coding rules + optional add-ons

First apply the **core coding-rules section** of `references/languages/js-ts/libraries/lingui/setup.add-ons.md` (step `generate_coding_rules`) — it always runs, whatever the user selected, because Phase 3 wraps against the file it generates. Then apply the **second core section** (step `install_coding_rules`), which points `CLAUDE.md` and `AGENTS.md` at the generated file — it always runs too. Finally, if the user selected any optional add-ons in `SKILL.md §1.10` (ESLint plugin, CI/CD integration, test setup wrapper), apply the matching sub-steps from the same file. Skip add-ons the user did not select.
