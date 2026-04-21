# TanStack Start Setup

This covers projects built on [TanStack Start](https://tanstack.com/start) — the full-stack SSR framework from the TanStack team, built on TanStack Router + Vite. Start renders HTML on every request, so locale must be resolved server-side to avoid hydration mismatches and flash-of-untranslated-content (FOUC). The setup differs from a plain TanStack Router SPA in several places: a server middleware reads the locale, the root document lives in `__root.tsx` (not `index.html`), and the language switcher writes a cookie that the server reads on the next request.

**Detection signal:** `@tanstack/react-start` in `dependencies`. Start uses `@vitejs/plugin-react` (Babel), not the SWC variant.

## Packages

In addition to the core packages from Step 2, install:

| Package | Type | Purpose |
|---------|------|---------|
| `@lingui/babel-plugin-lingui-macro` | dev | Babel macro transform |
| `@lingui/vite-plugin` | dev | Vite integration for catalog compilation |

**Example (npm):**

```bash
npm install @lingui/core @lingui/react @lingui/macro
npm install -D @lingui/cli @lingui/babel-plugin-lingui-macro @lingui/vite-plugin
```

> **No `@lingui/detect-locale`.** That library only works in the browser (`navigator`, `localStorage`, `window.location`). Under SSR it would throw on the server or return a wrong value, producing a hydration mismatch. Start resolves locale from the request headers and cookie instead — see "Server Middleware" below.

## Build Tool Integration (Step 4)

**This modifies `vite.config.ts`.** Describe the changes to the user before making them: adding `@lingui/babel-plugin-lingui-macro` to the `viteReact` plugin's Babel config and adding `lingui()` as a top-level Vite plugin. The existing `tanstackStart()` plugin must stay, and `viteReact()` must remain **after** `tanstackStart()` — the Start docs state this explicitly: "react's vite plugin must come after start's vite plugin."

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { lingui } from '@lingui/vite-plugin'

export default defineConfig({
  plugins: [
    tanstackStart(),
    viteReact({
      babel: {
        plugins: ['@lingui/babel-plugin-lingui-macro'],
      },
    }),
    lingui(),
  ],
})
```

If the project already has Babel plugins configured in the `viteReact()` call, add `@lingui/babel-plugin-lingui-macro` to the existing array. Do not reorder other plugins — preserve any `tailwindcss()`, `nitro()`, or custom plugins that were already present.

## Provider Setup (Step 5)

TanStack Start needs five pieces: a server middleware that resolves the locale for every request, a tiny server function that the router calls to read the resolved locale, an i18n helper module, the root document with `<html lang>`, and per-route catalog loading.

### Locale Routing Strategy

**If the project uses file-based routing (Start always does), STOP and present this to the user:**

> Choose a locale routing strategy:
> 1. **Unprefixed source locale** — source locale (e.g., English) keeps original URLs (`/about`). Other locales use `/$locale/about` (e.g., `/fr/about`). Best for preserving existing URLs and SEO.
> 2. **All locales prefixed** — every locale gets a prefix (`/en/about`, `/fr/about`). Bare paths (`/about`) redirect to the source locale. Cleanest structure, single route tree.
> 3. **Cookie-only** — no URL changes. Locale is stored in a cookie, resolved server-side each request. Simplest setup; works well for apps that don't need locale-specific URLs.

**You MUST wait for the user to choose before proceeding. Do NOT default to option 1.**

> **Note on Strategy 1 trade-off:** Even with server middleware, TanStack Router treats `/about` and `/$locale/about` as distinct file routes with different param types. Strategy 1 requires defining source-locale routes at both paths. Shared page components avoid duplicating the UI code, but each file-route pair needs two route files. Strategy 2 avoids this with a single `$locale/`-prefixed tree. Strategy 3 avoids URL changes entirely.

> **`lingui.config.ts` entries glob:** The default `src/routes/**/*.tsx` glob covers both unprefixed and `$locale/`-prefixed route files recursively — no changes needed.

---

### 0. Locale resolver (shared)

Both the server middleware and the `setLocale` server function need the same logic for validating a raw locale string against the configured locales with a regional fallback. Extend `src/i18n/locales.ts` (created in Step 3) with a `resolveLocale` helper so there's a single source of truth:

```ts
// src/i18n/locales.ts
export const sourceLocale = 'en'
export const locales = ['en'] as const
export type Locale = (typeof locales)[number]

export function resolveLocale(raw: string | undefined | null): Locale {
  if (!raw) return sourceLocale
  if ((locales as readonly string[]).includes(raw)) return raw as Locale
  // Regional fallback: es-MX → es
  const base = raw.split('-')[0]
  if ((locales as readonly string[]).includes(base)) return base as Locale
  return sourceLocale
}
```

This is pure and depends only on the locale constants, so it's safe to import from anywhere — client, server middleware, or server functions.

### 1. Server Middleware (all strategies)

Create `src/start.ts` to register a global request middleware. This runs on every server request (including SSR renders and server-function calls) before routes execute. It resolves the locale from the cookie (set by a previous visit or the language switcher) with `Accept-Language` as a fallback, and persists the resolved value back to the cookie.

```ts
// src/start.ts
import { createStart, createMiddleware } from '@tanstack/react-start'
import { getRequestHeader, getCookie, setCookie } from '@tanstack/react-start/server'
import { resolveLocale } from './i18n/locales'

const localeMiddleware = createMiddleware().server(async ({ next }) => {
  const cookieLocale = getCookie('locale')
  const headerLocale = getRequestHeader('accept-language')?.split(',')[0]?.split(';')[0]?.trim()
  const locale = resolveLocale(cookieLocale || headerLocale)

  // Persist for subsequent requests
  setCookie('locale', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

  return next({ context: { locale } })
})

export const startInstance = createStart(() => ({
  requestMiddleware: [localeMiddleware],
}))
```

If `src/start.ts` already exists (the user already registered other global middleware), merge `localeMiddleware` into the existing `requestMiddleware` array rather than overwriting the file. Show the merged version to the user before writing.

### 2. Locale Server Function

Create a tiny server function the router calls from `beforeLoad` to read the resolved locale. This is cheap — it just reads the cookie the middleware already set.

```ts
// src/server/locale.ts
import { createServerFn } from '@tanstack/react-start'
import { getCookie, setCookie } from '@tanstack/react-start/server'
import { resolveLocale } from '../i18n/locales'

export const getLocale = createServerFn({ method: 'GET' }).handler(async () => {
  return resolveLocale(getCookie('locale'))
})

export const setLocale = createServerFn({ method: 'POST' })
  .inputValidator((locale: string) => locale)
  .handler(async ({ data }) => {
    const locale = resolveLocale(data)
    setCookie('locale', locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    return { locale }
  })
```

### 3. I18n Helper Module

```ts
// src/i18n/index.ts
import { i18n } from '@lingui/core'

const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi'])

export function getDirection(locale: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale.split('-')[0]) ? 'rtl' : 'ltr'
}

export function activateLocale(locale: string, messages: Record<string, string>) {
  i18n.loadAndActivate({ locale, messages })
}

export { i18n }
```

Unlike the Vite SPA setup, this module does **not** touch `document.documentElement` — the `<html lang>` and `dir` attributes are rendered directly by the server from route context (see the root document below), so they're correct on the first byte of HTML. Mutating `document` on top would cause a double-write and fight the SSR output.

### 4. Root Document (`src/routes/__root.tsx`)

**This modifies the root route.** Show the user the exact changes before writing them. Read the existing `__root.tsx` first and note the current `<html>` attributes — if `<html lang="en">` (or any hardcoded value) is present, flag it to the user: "Your `__root.tsx` has `<html lang='en'>`. This will become `<html lang={locale} dir={direction}>` where `locale` comes from route context."

Start's root route exposes two seams: `beforeLoad` (runs before render; merges into route context) and a `RootDocument` / `shellComponent` function (renders the `<html>` shell). We use `beforeLoad` to resolve the locale (shape depends on routing strategy — see below) and `RootDocument` to apply `<html lang>` and `<I18nProvider>`.

The example below shows the **Strategy 3** (cookie-only) `beforeLoad`. Strategy 1 and Strategy 2 override `beforeLoad` to derive the locale from the URL path — see their sections below for the replacements.

```tsx
// src/routes/__root.tsx
/// <reference types="vite/client" />
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import { I18nProvider } from '@lingui/react'
import type { ReactNode } from 'react'
import { getLocale } from '../server/locale'
import { getDirection, i18n } from '../i18n'

export const Route = createRootRoute({
  // Strategy 3 default — see Strategy 1 / Strategy 2 sections below for URL-based overrides.
  beforeLoad: async () => {
    const locale = await getLocale()
    return { locale }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  const { locale } = Route.useRouteContext()
  return (
    <RootDocument locale={locale}>
      <I18nProvider i18n={i18n}>
        <Outlet />
      </I18nProvider>
    </RootDocument>
  )
}

function RootDocument({ locale, children }: { locale: string; children: ReactNode }) {
  return (
    <html lang={locale} dir={getDirection(locale)}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
```

`activateLocale()` is called in each page route's `beforeLoad` (next section), not here — the root route knows the locale but not which catalog a given page needs.

If the project uses `shellComponent` instead of wrapping in `component`, move the `<html>` element into `shellComponent` and read locale via `Route.useRouteContext()` there. The pattern is the same.

---

### 5. Page Route Catalog Loading

Each page route's `beforeLoad` reads `locale` from the root context and loads its co-located catalog. With per-page catalogs this means one dynamic import per route — catalogs are co-located next to each route file (e.g., `src/routes/about/locales/about/en.ts`). The extractor generates these paths from `lingui.config.ts`.

#### Strategy 1: Unprefixed source locale

Source-locale routes live at `/about`; target-locale routes live at `/$locale/about`. Both point at the same shared page component:

```
src/
  pages/
    About.tsx              ← shared page component
  routes/
    __root.tsx             ← root document (above)
    about.tsx              ← /about (source locale)
    $locale/
      about.tsx            ← /$locale/about (target locales)
```

Replace the baseline `beforeLoad` in `__root.tsx` with the URL-first version below. The URL is authoritative — a valid target-locale prefix wins, and any other path is treated as the source locale.

```tsx
import { locales, sourceLocale, type Locale } from '../i18n/locales'

export const Route = createRootRoute({
  beforeLoad: ({ location }) => {
    const segments = location.pathname.split('/').filter(Boolean)
    const firstSegment = segments[0]
    // Target-locale prefix (e.g. /fr/about) wins over cookie
    if (
      firstSegment &&
      (locales as readonly string[]).includes(firstSegment) &&
      firstSegment !== sourceLocale
    ) {
      return { locale: firstSegment as Locale }
    }
    // Unprefixed path — source locale by design
    return { locale: sourceLocale }
  },
  // ...
})
```

Strategy 1 doesn't call `getLocale()` — the cookie is only meaningful for first-visit Accept-Language redirects, which Strategy 1 doesn't perform (`/about` is always source locale). The cookie middleware still runs so server functions and future strategy changes behave consistently, but it's not consulted here.

> **Canonicalization:** Visiting `/en/about` (when `en` is the source locale) will render the target-locale route tree with an English catalog — not the canonical `/about`. For SEO hygiene, add a redirect for source-locale-prefixed paths if your site is public: inside the check above, when `firstSegment === sourceLocale`, `throw redirect({ to: location.pathname.slice(sourceLocale.length + 1) || '/' })`.

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
import { activateLocale } from '../i18n'
import { sourceLocale } from '../i18n/locales'
import { AboutPage } from '../pages/About'

export const Route = createFileRoute('/about')({
  beforeLoad: async () => {
    const { messages } = await import(`./locales/about/${sourceLocale}.ts`)
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
    const { messages } = await import(`./locales/about/${params.locale}.ts`)
    activateLocale(params.locale, messages)
  },
  component: AboutPage,
})
```

Bare paths under Strategy 1 use the source locale directly; users reach target locales via the language switcher.

#### Strategy 2: All locales prefixed

All routes live under `/$locale/`. Bare paths redirect to the source-locale prefix:

```
src/routes/
  __root.tsx             ← root document + bare-path redirect
  $locale/
    about.tsx            ← /$locale/about
```

Replace the baseline `beforeLoad` in `__root.tsx` with the URL-first version below. The URL prefix is authoritative — the cookie is only consulted as a default when the path is bare.

```tsx
export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    const segments = location.pathname.split('/').filter(Boolean)
    const firstSegment = segments[0]
    if (!firstSegment || !(locales as readonly string[]).includes(firstSegment)) {
      // Bare path — redirect to cookie-resolved (or Accept-Language) locale
      const locale = await getLocale()
      throw redirect({ to: `/${locale}${location.pathname}` })
    }
    // URL already carries a valid locale — use it as context
    return { locale: firstSegment as Locale }
  },
  // ...
})
```

(Import `redirect` from `@tanstack/react-router`, and `locales` + `type Locale` from `../i18n/locales`.)

This ensures `Route.useRouteContext().locale` always matches the URL segment, so components like the language switcher highlight the correct locale even when the cookie is stale.

```tsx
// src/routes/$locale/about.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'
import { activateLocale } from '../../i18n'

export const Route = createFileRoute('/$locale/about')({
  beforeLoad: async ({ params }) => {
    const { messages } = await import(`./locales/about/${params.locale}.ts`)
    activateLocale(params.locale, messages)
  },
  component: AboutPage,
})

function AboutPage() {
  return <h1><Trans>About us</Trans></h1>
}
```

#### Strategy 3: Cookie-only (no URL changes)

No route restructuring. Each page reads `locale` from root context and loads its catalog:

```tsx
// src/routes/about.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'
import { activateLocale } from '../i18n'

export const Route = createFileRoute('/about')({
  beforeLoad: async ({ context }) => {
    const { messages } = await import(`./locales/about/${context.locale}.ts`)
    activateLocale(context.locale, messages)
  },
  component: AboutPage,
})

function AboutPage() {
  return <h1><Trans>About us</Trans></h1>
}
```

`context.locale` comes from the root route's `beforeLoad` return value — `beforeLoad` contexts compose from parent routes down.

---

## Link Handling

**Only relevant for Strategy 1 and 2.** If the user chose Strategy 3, skip this — URLs don't change.

TanStack Router's `<Link>` is deeply typed — wrapping it loses type inference on `to` and `params`. Use the router's native API instead.

**Strategy 2** (all prefixed): every `<Link>` already requires a `locale` param.

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

**Strategy 1** (unprefixed source): source-locale routes have no `$locale` param, target-locale routes do. Links must point to the correct route variant. This duplication is the trade-off of Strategy 1 with TanStack Router's type system — for apps with many links, Strategy 2 is significantly simpler.

```tsx
import { Link, useParams } from '@tanstack/react-router'
import { Route as RootRoute } from '../routes/__root'
import { sourceLocale } from '../i18n/locales'

function Navigation() {
  const { locale } = RootRoute.useRouteContext()
  const isSource = locale === sourceLocale
  return (
    <nav>
      {isSource ? (
        <>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
        </>
      ) : (
        <>
          <Link to="/$locale" params={{ locale }}>Home</Link>
          <Link to="/$locale/about" params={{ locale }}>About</Link>
        </>
      )}
    </nav>
  )
}
```

### Existing link migration

Tell the user:

> Existing internal links need updating to include the locale param. Search for:
> - `<Link to="/...">` — wrap the `to` and `params` per the pattern above
> - `<a href="/...">` with internal paths — convert to `<Link>` with locale handling
> - `navigate({ to: '/...' })` / `router.navigate(...)` — include the `locale` param or use a source/target branch
>
> Navigation components (headers, sidebars, footers) are the highest priority since they appear on every page.

---

## Root Document: `<html lang>`

**Do not modify `index.html`.** TanStack Start projects do not have a project-root `index.html` — the `<html>` element is rendered from `__root.tsx` (see Section 4 above). The `<html lang={locale} dir={getDirection(locale)}>` attribute comes from route context on every request. If you find an `index.html` in the project, it's either unrelated (e.g., a static preview file) or a legacy leftover — confirm with the user before touching it.

---

## 6. Language Switcher

The switcher calls the `setLocale` server function (Section 2) to update the cookie, then triggers a reload so the server re-renders in the new locale. This is the idiomatic Start pattern — a pure client-side swap would desync from the cookie on the next SSR, producing mixed-locale renders.

#### Strategy 1 and 2: URL-based routing

For URL-based strategies, the switcher navigates to the same page under the new locale prefix. The cookie is updated alongside so the next SSR matches:

```tsx
// src/components/LanguageSwitcher.tsx
import { Link, useLocation } from '@tanstack/react-router'
import { locales, sourceLocale } from '../i18n/locales'
import { Route as RootRoute } from '../routes/__root'
import { setLocale } from '../server/locale'

export function LanguageSwitcher() {
  const { locale: currentLocale } = RootRoute.useRouteContext()
  const location = useLocation()
  const displayNames = new Intl.DisplayNames([currentLocale], { type: 'language' })

  // Strip current locale prefix to get the base path.
  // Two cases: prefix followed by more path ("/fr/about" → "/about"),
  // or bare locale ("/fr" → "/"). Everything else is already unprefixed.
  let basePath = location.pathname
  for (const loc of locales) {
    if (basePath.startsWith(`/${loc}/`)) { basePath = basePath.slice(loc.length + 1); break }
    if (basePath === `/${loc}`) { basePath = '/'; break }
  }

  function hrefFor(loc: string): string {
    // Strategy 2: always prefix. Strategy 1: source locale is unprefixed.
    if (loc === sourceLocale) return basePath  // Strategy 1 only — remove this line for Strategy 2
    return `/${loc}${basePath}`
  }

  return (
    <nav style={{ display: 'flex', gap: '0.5rem' }}>
      {locales.map((loc) => (
        <a
          key={loc}
          href={hrefFor(loc)}
          onClick={async (e) => {
            e.preventDefault()
            await setLocale({ data: loc })
            window.location.href = hrefFor(loc)
          }}
          style={{
            padding: '0.25rem 0.5rem',
            textDecoration: 'none',
            color: 'inherit',
            fontWeight: loc === currentLocale ? 600 : 400,
          }}
        >
          {displayNames.of(loc) ?? loc}
        </a>
      ))}
    </nav>
  )
}
```

A full browser navigation (`window.location.href = ...`) is used instead of TanStack Router's client-side `<Link>` so the next request goes back through the server and picks up the updated cookie + catalog on the server side. This avoids a brief flash where the URL is in the new locale but the HTML is still in the old one.

For Strategy 2, remove the `if (loc === sourceLocale) return basePath` line — every locale gets a prefix.

#### Strategy 3: Cookie-only

No URL change. The switcher updates the cookie and reloads; the server re-renders with the new locale on the reload:

```tsx
// src/components/LanguageSwitcher.tsx
import { locales } from '../i18n/locales'
import { Route as RootRoute } from '../routes/__root'
import { setLocale } from '../server/locale'

export function LanguageSwitcher() {
  const { locale: currentLocale } = RootRoute.useRouteContext()
  const displayNames = new Intl.DisplayNames([currentLocale], { type: 'language' })

  async function switchTo(loc: string) {
    await setLocale({ data: loc })
    window.location.reload()
  }

  return (
    <select
      value={currentLocale}
      onChange={(e) => switchTo(e.target.value)}
      style={{ padding: '0.375rem 0.5rem' }}
    >
      {locales.map((loc) => (
        <option key={loc} value={loc}>
          {displayNames.of(loc) ?? loc}
        </option>
      ))}
    </select>
  )
}
```

### Wiring

Place the switcher inside the `RootDocument` body so it appears on every page:

```tsx
// src/routes/__root.tsx (modify RootComponent)
import { LanguageSwitcher } from '../components/LanguageSwitcher'

function RootComponent() {
  const { locale } = Route.useRouteContext()
  return (
    <RootDocument locale={locale}>
      <I18nProvider i18n={i18n}>
        <LanguageSwitcher />
        <Outlet />
      </I18nProvider>
    </RootDocument>
  )
}
```

If the project has a shared header or navigation component, place the switcher there instead.

**Styling**: The examples use inline styles as a baseline. Adapt to match the project's CSS approach (Tailwind, CSS Modules, etc.) and the visual style of the surrounding navigation.

---

## Server Function Locale Access

Server functions (`createServerFn`) run in the request context, so they can read the resolved locale directly via `getCookie` — useful if you need to translate server-rendered emails, error messages, or response bodies:

```ts
import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

export const sendConfirmationEmail = createServerFn({ method: 'POST' }).handler(async () => {
  const locale = getCookie('locale') || 'en'
  const { messages } = await import(`../locales/emails/${locale}.ts`)
  // ... render email using messages
})
```

## Common gotchas specific to Start

- **Hydration mismatch on `<html>`**: if you set `document.documentElement.lang` in client code (e.g., an `activateLocale` that mutates the DOM), it will fight the server-rendered `<html lang>`. Keep DOM mutation out of `src/i18n/index.ts` — the server renders the correct attributes on first byte.
- **Plugin order**: `@vitejs/plugin-react` must come **after** `tanstackStart()` in `vite.config.ts`. Reversing the order breaks Start's code splitting and server/client boundary handling.
- **Missing `src/start.ts` before the router builds**: `createStart(...)` must be imported somewhere in the server bundle (often via `src/server.ts` / `src/server-entry.ts` re-exporting or importing `src/start.ts`). If `startInstance` is unused, Vite tree-shakes the middleware away — verify that your server entry imports `./start` (even as a side-effect import: `import './start'`).
- **Catalog missing on a route**: `lingui extract-experimental` generates co-located `locales/{route}/{locale}.po` files on first extraction. If a route's `beforeLoad` fails with "Cannot find module ./locales/...", run `npm run lingui:extract` followed by `npm run lingui:compile` before starting the dev server.
- **`@lingui/detect-locale` errors on the server**: if the package got installed (e.g., copied from the Vite SPA guide), its `fromStorage`/`fromNavigator` detectors throw during SSR because `localStorage` and `navigator` don't exist. Uninstall it — the server middleware above replaces it.
