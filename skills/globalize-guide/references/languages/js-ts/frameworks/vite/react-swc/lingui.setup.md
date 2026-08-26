# Vite + SWC Setup

> This is one of three setup references for this stack — read them in the order `references.setup` lists. `setup.locale-module.md` runs first and owns `src/i18n/locales.ts`; `setup.navigation.md` runs last and owns `src/i18n/navigation.ts` plus the language switcher. **This file imports those modules and never defines them.**


This covers Vite projects using `@vitejs/plugin-react-swc` — including plain Vite, TanStack Router, React Router, and any other SWC-based Vite setup.

## Packages


> **Before installing — Node ≥ 22.19 and ESM-only.** Every `@lingui/*` v6 package except `@lingui/swc-plugin` declares `engines.node >= 22.19.0`, and all of them are `"type": "module"` with no `require` condition, so no CJS file can `require()` them. `setup.locale-module.md` (read first on this variant) carries the full check and the failure modes. Do not use `@lingui/swc-plugin` to test the Node floor — it declares no `engines` at all.

In addition to the core Lingui packages (`@lingui/core`, `@lingui/react`, `@lingui/cli`), install:

| Package | Type | Purpose |
|---------|------|---------|
| `@lingui/detect-locale` | runtime | Browser locale detection (navigator, URL, storage, cookie) |
| `@lingui/swc-plugin` | dev | SWC macro transform |
| `@lingui/vite-plugin` | dev | Vite integration for catalog compilation |
| `@vitejs/plugin-react-swc` | dev | The SWC host the macro plugin runs inside — **`^4` is a floor, not a preference** (see below) |

**Example (npm):**

```bash
npm install '@lingui/core@^6' '@lingui/react@^6' '@lingui/detect-locale@^6'
npm install -D '@lingui/cli@^6' '@lingui/swc-plugin@^6' '@lingui/vite-plugin@^6' '@vitejs/plugin-react-swc@^4'
```

> **Why `@vitejs/plugin-react-swc@^4` is in that install line.** This variant is selected *because* the project already uses `@vitejs/plugin-react-swc`, so the package is normally present — but the version matters. `@lingui/swc-plugin@6.2.0`+ is built against `swc_core@66.0.3` under SWC's post-1.15 Wasm plugin ABI; `@vitejs/plugin-react-swc` only reaches `@swc/core >= 1.15.11` at **4.2.3**, and the whole 3.x line sits below it (`3.11.0` → `@swc/core@^1.12.11`, `3.8.1` → `^1.11.11`). On a 3.x host the macros hit a pre-cbor runtime and the build fails with an AST schema or plugin-invocation error. The four sibling SWC stacks (`tanstack-start`, `remix`, `react-router-framework`, `webext`) already install this package at `^4`; this one did not, and was the only Lingui-SWC stack shipping no host at all.
>
> **This can upgrade an existing `@vitejs/plugin-react-swc@3.x` to 4.x.** That is a major bump of the project's build plugin — describe it to the user before running the install. `@vitejs/plugin-react-swc@^4` accepts `vite ^4 || ^5 || ^6 || ^7 || ^8`, so it does not itself constrain Vite. If the project cannot move off 3.x, use the **Babel** variant of this stack instead of forcing the SWC one.

**Version pinning:** `@lingui/swc-plugin` must match the `swc_core` version shipped by `@vitejs/plugin-react-swc`. If the build fails with an AST schema or plugin invocation error, look up the compatible version at https://plugins.swc.rs and pin it exactly — e.g. `npm install -D @lingui/swc-plugin@5.8.0`. See "SWC plugin version mismatch" in Common Gotchas.

## Build Tool Integration

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
    TanStackRouterVite({
      // Exclude per-route locale catalogs (`./locales/{route}/{locale}.ts`)
      // so the router plugin doesn't try to treat them as route files
      // (avoids "Route module not found" warnings on first build, before
      // the catalog stubs exist).
      routeFileIgnorePattern: 'locales/',
    }),
    react({
      plugins: [['@lingui/swc-plugin', {}]],
    }),
    lingui(),
  ],
})
```

**First-run ordering.** On a clean clone, run `vite build` (or start `vite dev` once) before `tsc -b` / `tsc --noEmit`. The TanStack Router plugin generates `src/routeTree.gen.ts` on first Vite run; `tsc` fails if the generated file does not yet exist. If the project's `npm run build` currently runs `tsc -b && vite build`, reorder to `vite build && tsc --noEmit` (or add a pre-build `vite build --mode dev` step) so the route tree is present before type-checking. `lingui compile` goes first in that chain — the compiled catalogs are gitignored as well, so on a clean clone they do not exist until the compiler has run; the full order is `lingui compile` → `vite build` → `tsc --noEmit`, which is exactly what the prefixed `build` script in "Catalog artifacts" (end of this file) sets up.

## Provider Setup

The setup depends on the project's **routing shape**, which also decides the catalog layout. Determine it first, by reading `package.json` and the app entry (`src/main.tsx`, `src/App.tsx`):

| Shape | Signal | Catalogs | Follow |
|---|---|---|---|
| **File-based routing** | `@tanstack/react-router` in deps and a `src/routes/` tree | per-page, co-located | *Per-page catalogs* |
| **Declarative React Router** | `react-router` in deps and **no** `@react-router/dev` — `<Routes>`/`<Route>` in `App.tsx`, or a `createBrowserRouter([...])` array | single | *Declarative React Router (SPA)* |
| **No router** | neither of the above | single | *Single catalog (plain SPA without a router)* |

A project with `@react-router/dev` is React Router **framework mode** and does not reach this file — it has its own setup reference. Nothing here applies to it.

### Locale Routing Strategy

**Unless the project has no router at all, STOP and present this to the user:**

> Choose a locale routing strategy:
> 1. **Unprefixed source locale** — source locale (e.g., English) keeps original URLs (`/about`). Other locales use `/fr/about`. Best for preserving existing URLs and SEO.
> 2. **All locales prefixed** — every locale gets a prefix (`/en/about`, `/fr/about`). Bare paths (`/about`) redirect to the source locale (`/en/about`). Cleanest structure, single route tree.
> 3. **Skip locale routing** — use query param / localStorage / browser detection only, no URL path changes. Simplest setup.

**You MUST wait for the user to choose before proceeding. Do NOT default to option 1.**

Both the file-based and the declarative React Router shape support all three. **Declarative React Router is not a reason to skip the question** — a `<Routes>` tree takes a locale segment as readily as a file-based one; see *Declarative React Router (SPA)* below. Only the third shape skips the choice: with no router there is no path to prefix, so use option 3 (the single catalog setup at the end of this section).

> **Note on Strategy 1 trade-off:** Client-side routers cannot rewrite URLs (serve different content while keeping the URL unchanged) the way server middleware can. Strategy 1 requires mounting the source locale routes at both `/about` and the prefixed path, resulting in some route duplication. Shared page components avoid duplicating the actual UI code. Strategy 2 avoids this with a single prefixed route tree.

> **`lingui.config.ts` entries glob:** For file-based routing, the default `entries` glob (`src/routes/**/*.tsx`) covers both unprefixed and `$locale/`-prefixed route files recursively — no glob changes needed for any strategy, and each route file gets its own co-located catalog regardless of whether it is prefixed. Declarative React Router uses a single catalog, so its glob covers the whole source tree and does not change with the strategy either.

---

### Per-page catalogs (TanStack Router file-based routing)

**This pattern modifies the root route file** (`src/routes/__root.tsx`) by wrapping it with `I18nProvider`. Show the user what changes before making them.

> **Declarative React Router does not belong in this section.** Without route files there is nothing for `lingui extract-experimental` to co-locate a catalog against, so that shape uses a single catalog — see *Declarative React Router (SPA)* below.

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

Each route loads its own co-located catalog. Shared component strings are duplicated across route catalogs — this is the expected trade-off for smaller per-page bundles.

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
  // `detectLocale()` reads `?lang=` *before* localStorage, so the URL has to be updated too.
  // Writing only storage would let a stale `?lang=` from a shared link win on the next reload.
  const url = new URL(window.location.href)
  url.searchParams.set('lang', locale)
  history.replaceState(history.state, '', url)
}

export { i18n }
```

`detectLocale()` tries sources in order: `?lang=` URL parameter, `lang` key in localStorage, browser language settings. `resolveLocale` (from `src/i18n/locales.ts`) validates the result against the configured locales, falls back to the base language tag (`es-MX` → `es`), and finally to the source locale — so this file holds no locale list of its own. Call `saveLocale()` when the user explicitly switches locale so the choice persists across visits.

**`saveLocale()` writes the URL as well as storage, and both writes are required.** `detectLocale()` reads `fromUrl` first, so a visitor who arrives on `/?lang=es` from a shared link, picks another locale, and reloads would be thrown back into Spanish if only `localStorage` had been updated — with no way out short of hand-editing the URL. Writing the param keeps read and write agreed, and has the useful side effect that the address bar always reflects the active locale, so the URL stays shareable. `history.replaceState` is deliberate over `pushState`: switching locale should not add a back-button entry.

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

Each route loads its own co-located catalog. Shared component strings are duplicated across route catalogs — this is the expected trade-off for smaller per-page bundles.

**Declarative React Router under Option 3** uses the single-catalog setup instead — see *Declarative React Router (SPA) → Option 3* below.

---

### Declarative React Router (SPA)

A Vite project with `react-router` in `dependencies` but **no** `@react-router/dev` is a declarative SPA: routes are `<Route>` elements in `src/App.tsx` (or a `createBrowserRouter([...])` array), not files on disk. Two consequences shape everything in this section:

- **There are no route modules.** `import type { Route } from './+types/…'`, route-module `loader` / `action` exports, and `react-router.config.ts` all belong to React Router framework mode. None of them exist here — do not write them, and if you find them in the project, it is framework mode and this file is the wrong reference.
- **Catalogs are single, not per-page.** With no route files, `lingui extract-experimental` has nothing to co-locate against. Use the single-catalog layout (`src/locales/{locale}/messages`) that `lingui.config.ts` already declares, and **skip the per-page stub-bootstrapping step** in "Catalog artifacts" at the end of this file.

**This pattern modifies `src/App.tsx`** (the route tree) **and `src/main.tsx`** (the provider). Show the user both files before making the change.

Everything below is React Router v7 (`import … from 'react-router'`). On v6 the same components and hooks come from `react-router-dom` — check the installed major before writing imports.

#### The i18n module (Strategy 1 and 2)

Under a URL strategy the **path is the only locale source**. There is no `detectLocale()` here and no `@lingui/detect-locale` import — a query param or a stale localStorage value competing with the path is exactly the desync Option 3 exists to contain.

```ts
// src/i18n/index.ts
import { i18n } from '@lingui/core'
import { getDirection, sourceLocale, type Locale } from './locales'

// Re-export the locale module so consumers need one import.
export * from './locales'

/** Load and activate a locale's catalog. Falls back to the source locale if the import fails. */
export async function loadCatalog(locale: Locale) {
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

export { i18n }
```

`locales`, `sourceLocale`, `Locale`, `resolveLocale` and `getDirection` live in `src/i18n/locales.ts`, created by the shared Lingui setup references — do not redeclare them here.

#### The locale layout route

Both strategies mount the same layout element. It reads the locale **from the path via `useParams()`**, validates it, loads the catalog, and only then renders the page — so no frame ever paints with the wrong catalog.

```tsx
// src/i18n/LocaleLayout.tsx
import { useEffect, useState, type ReactNode } from 'react'
import { Outlet, useParams } from 'react-router'
import { I18nProvider } from '@lingui/react'
import { i18n, loadCatalog, locales, sourceLocale, type Locale } from '.'

export function LocaleLayout({ fallback }: { fallback?: ReactNode }) {
  // Strategy 1 mounts this route twice: with a `:locale` param and without.
  // No param means the unprefixed source-locale tree.
  const { locale: param } = useParams()
  const locale = (param ?? sourceLocale) as Locale
  const known = (locales as readonly string[]).includes(locale)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!known) return
    let cancelled = false
    setReady(false)
    loadCatalog(locale).then(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [locale, known])

  // An unknown first segment is not a locale — each strategy decides what that means.
  if (!known) return <>{fallback ?? null}</>
  if (!ready) return null   // swap in the project's own loading UI if it has one

  return (
    <I18nProvider i18n={i18n}>
      <Outlet />
    </I18nProvider>
  )
}
```

The `known` check is load-bearing, and the reason is how React Router matches: **routes are ranked, not tried in source order**, and a dynamic `:locale` segment matches *any* first segment. `/xyz/about` therefore lands on the `:locale` subtree with `locale === 'xyz'`. Only the static-vs-dynamic ranking rule (`/about` outranks `/:locale`) keeps real pages out of it; anything unrecognised falls through here.

The `cancelled` flag matters for the same reason every fetch-in-effect needs one: two locale changes in quick succession resolve in whatever order the dynamic imports happen to finish, and without the guard the slower one can flip `ready` back on for a catalog that is no longer active.

#### Strategy 2: All locales prefixed (declarative React Router)

One subtree under `:locale`. Bare and unrecognised paths redirect to the source-locale prefix, preserving the rest of the URL:

```tsx
// src/App.tsx
import { Routes, Route, Navigate, useLocation } from 'react-router'
import { LocaleLayout } from './i18n/LocaleLayout'
import { sourceLocale } from './i18n'
import { Home } from './pages/Home'
import { About } from './pages/About'
import { NotFound } from './pages/NotFound'

function RedirectToLocale() {
  const { pathname, search, hash } = useLocation()
  const rest = pathname === '/' ? '' : pathname
  return <Navigate to={`/${sourceLocale}${rest}${search}${hash}`} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path=":locale" element={<LocaleLayout fallback={<RedirectToLocale />} />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      {/* Bare paths: `/` → `/en`, `/about` → `/en/about` */}
      <Route path="*" element={<RedirectToLocale />} />
    </Routes>
  )
}
```

Passing `RedirectToLocale` as the layout's `fallback` covers the second entry point into the same case: `/xyz/about` matches `:locale/about` before the outer `*` route ever gets a chance, so the redirect has to be reachable from inside the layout too. It resolves to `/en/xyz/about`, which the locale subtree's own `*` child then renders as a not-found **in the right locale** — which is why that child is worth adding even if the project had no 404 route before.

Wrap the tree in `main.tsx` as the project already does — `<BrowserRouter>` around `<App />`. `I18nProvider` lives inside `LocaleLayout`, not in `main.tsx`, because the provider must sit below the route that knows the locale.

#### Strategy 1: Unprefixed source locale (declarative React Router)

Two subtrees over one shared page list. Declare the pages once as a fragment so adding a page means touching one place:

```tsx
// src/App.tsx
import { Routes, Route } from 'react-router'
import { LocaleLayout } from './i18n/LocaleLayout'
import { NotFound } from './pages/NotFound'
import { Home } from './pages/Home'
import { About } from './pages/About'

const pages = (
  <>
    <Route index element={<Home />} />
    <Route path="about" element={<About />} />
  </>
)

export default function App() {
  return (
    <Routes>
      {/* Target locales: /fr, /fr/about */}
      <Route path=":locale" element={<LocaleLayout fallback={<NotFound />} />}>{pages}</Route>
      {/* Source locale, unprefixed: /, /about */}
      <Route element={<LocaleLayout />}>{pages}</Route>
    </Routes>
  )
}
```

Three things make this work, all of them consequences of React Router's matching rules rather than of the declaration order:

- **`<Routes>` flattens fragments.** Children are converted by `createRoutesFromChildren` (exported publicly as `createRoutesFromElements`, whose own documented example passes a `<>…</>`), which recurses into `React.Fragment` children. The shared `pages` fragment is therefore legal in both subtrees.
- **A static segment outranks a dynamic one.** `/about` matches the unprefixed subtree's static `about` route, not `:locale`; `/fr/about` matches `:locale/about`. Reordering the two `<Route>` blocks changes nothing.
- **The second `<Route>` has no `path`.** It is a layout route: it contributes no URL segment, so its children mount at `/` and `/about`, and `useParams().locale` is `undefined` there — which is why `LocaleLayout` falls back to `sourceLocale`.

The `fallback` differs by strategy. Under Strategy 1 an unknown first segment (`/xyz/about`) is genuinely not a page — render the project's not-found rather than redirecting, because there is no correct locale to redirect to.

> **Canonicalization.** `/en/about` (when `en` is the source locale) renders the prefixed subtree with the English catalog rather than the canonical `/about`. For SEO hygiene on a public site, redirect it — add `useLocation` and `Navigate` to `LocaleLayout`'s imports and, before the `known` check, return the unprefixed path:
> ```tsx
> const { pathname, search, hash } = useLocation()
> if (param === sourceLocale) {
>   return <Navigate to={`${stripLocalePrefix(pathname).pathname}${search}${hash}`} replace />
> }
> ```
> `stripLocalePrefix` comes from `src/i18n/navigation.ts`. This applies to Strategy 1 only — under Strategy 2 `/en/about` **is** the canonical URL.

#### Option 3: Skip locale routing (declarative React Router)

The route tree is not touched at all — no `:locale` segment, no layout route, no `LocaleLayout.tsx`. Follow *Single catalog (plain SPA without a router)* below; it is the same setup, and the presence of a router changes nothing about it. There is also no `src/i18n/navigation.ts` under Option 3 — no URL carries a locale, so there is nothing to prefix.

#### `createBrowserRouter` projects

If the project builds routes as an object array instead of JSX, the tree is the same shape — a layout route with an `element` and `children`:

```tsx
createBrowserRouter([
  {
    path: ':locale',
    element: <LocaleLayout fallback={<RedirectToLocale />} />,
    children: [
      { index: true, element: <Home /> },
      { path: 'about', element: <About /> },
    ],
  },
  { path: '*', element: <RedirectToLocale /> },
])
```

Everything else — `LocaleLayout`, the i18n module, the switcher, link handling — is unchanged. Do not add route-module `loader` functions to move the catalog load: the `useEffect` in `LocaleLayout` covers both router flavours, and a `loader` would only work on a data router.

#### Server fallback for prefixed paths

**Strategy 1 and 2 only.** A prefixed SPA serves `/fr/about` out of `index.html` — there is no `fr/about.html` on disk. Vite's dev server and `vite preview` already rewrite unknown paths to `index.html` (`appType: 'spa'`, the default), so `npm run dev` works with no configuration. **Production hosting must be configured to do the same**, or a hard refresh or shared link to `/fr/about` returns 404 while in-app navigation to the same path works — a failure that never shows up in dev.

| Host | Configuration |
|---|---|
| Netlify | `public/_redirects` → `/*    /index.html    200` |
| Cloudflare Pages | `public/_redirects`, same line as Netlify |
| Vercel | `vercel.json` → `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }` |
| nginx | `location / { try_files $uri $uri/ /index.html; }` |
| Apache | `.htaccess` with `FallbackResource /index.html` |
| GitHub Pages / plain static | no rewrite support — copy `index.html` to `404.html` at build time, or stay on Option 3 |

Identify the host from the repo (a `netlify.toml`, `vercel.json`, `Dockerfile`, or deploy workflow) and make the change. If no host is evident, tell the user which rewrite their deployment needs rather than leaving it unsaid. Option 3 introduces no new paths, so none of this applies to it.

### Link handling

**Only relevant for Strategy 1 and 2.** If the user chose Option 3, skip this.

When locale routing is enabled, internal links must include the locale prefix. This applies to both routing shapes — the TanStack Router half below covers file-based routing, the React Router half covers the declarative SPA.

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

**React Router (declarative SPA)** — `<Link to="...">` takes a plain string, so use the helpers from `src/i18n/navigation.ts` (owned by the shared navigation reference — do not write a `src/localePath.ts` here). `useLocalePath()` is built on `useParams()`, the same source `LocaleLayout` reads, so links and layout can never disagree:

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

### `index.html` lang attribute

Vite projects have an `index.html` at the project root with a static `<html lang="...">` attribute (typically `<html lang="en">`). Whichever activation helper this file's chosen branch uses — `activateLocale()` for the per-page layouts, `loadCatalog()` for the single-catalog ones — sets `document.documentElement.lang` dynamically at runtime, so the static value serves only as the default before JavaScript executes.

**Read `index.html` and check the `<html lang="...">` value.** Then update it:

- Set `<html lang="...">` to the source locale value from `lingui.config.ts` (e.g., `<html lang="en">`). If it already matches, no change is needed.
- If the existing value doesn't match `sourceLocale`, flag it to the user — the source locale config may need updating.
- Remove any hardcoded `dir` attribute (e.g., `dir="ltr"`). That same helper sets `dir` dynamically, and a hardcoded value would flash incorrect direction for RTL locales.

Describe the exact change to the user before making it (e.g., 'I will update `<html lang="en">` to `<html lang="es">` in `index.html` to match the source locale').

---

### Single catalog (plain SPA without a router)

**This pattern modifies `main.tsx`** by wrapping the existing render tree with `I18nProvider`. Show the user the modified file before making the change.

This is the Option 3 (skip locale routing) setup — locale is detected from query param, localStorage, or browser settings, and no path ever carries it. It is also the setup a **declarative React Router** project uses under Option 3: the route tree is left exactly as it is, so nothing here changes because a router happens to be present.

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
  // `detectLocale()` reads `?lang=` *before* localStorage, so the URL has to be updated too.
  // Writing only storage would let a stale `?lang=` from a shared link win on the next reload.
  const url = new URL(window.location.href)
  url.searchParams.set('lang', locale)
  history.replaceState(history.state, '', url)
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

The switcher **navigates**; it does not write `localStorage`. Under a URL strategy the path is the only locale source, so a stored value would be a second source of truth that the next prefixed URL silently contradicts.

```tsx
// src/components/LanguageSwitcher.tsx
import { useLocation } from 'react-router'
import { locales, localeDisplayName } from '../i18n'
import { useLocale, switchLocalePath } from '../i18n/navigation'

export function LanguageSwitcher() {
  const currentLocale = useLocale()
  const { pathname, search, hash } = useLocation()

  return (
    <nav style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      {locales.map((loc) => (
        <a
          key={loc}
          href={`${switchLocalePath(pathname, loc)}${search}${hash}`}
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

Three details are load-bearing:

- **Use a plain `<a>`, not a router `<Link>` — on both routers.** On TanStack Router the target route type is not statically known (`switchLocalePath` returns a string), and on either router a full document navigation is what re-runs the route's catalog load in the new locale. A client-side transition would leave the previously activated catalog in place. (On the declarative SPA, `LocaleLayout` would in fact reload the catalog on a client-side transition — but `<a>` keeps one behaviour across all three shapes, and costs nothing on a switch that changes the whole page's language anyway.)
- **`useLocation()`, not `window.location`.** The switcher re-renders on navigation, so the target of each link tracks the page the user is actually on. Reading `window.location` directly gives a value React never invalidates, and the links go stale after the first in-app navigation.
- **Re-append `search` and `hash`.** `switchLocalePath` takes and returns a *pathname*; feeding it a full URL would double-prefix. Without re-appending, switching locale on `/search?q=shoes#results` silently drops the query and the fragment — the user loses their results.

The snippet above is the React Router form, where `useLocation()` returns `search` and `hash` as strings that already carry their leading `?` and `#`. **On TanStack Router the hook returns a `ParsedLocation`, whose `search` is the *parsed object* — interpolating it yields `[object Object]`.** Use `searchStr` there, and normalise the fragment:

```tsx
import { useLocation } from '@tanstack/react-router'

const { pathname, searchStr, hash } = useLocation()
const suffix = `${searchStr}${hash ? `#${hash.replace(/^#/, '')}` : ''}`
// ... href={`${switchLocalePath(pathname, loc)}${suffix}`}
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

**Declarative React Router, Strategy 1 or 2** — in `src/i18n/LocaleLayout.tsx`, inside the provider it already renders:

```tsx
import { LanguageSwitcher } from '../components/LanguageSwitcher'

// Inside LocaleLayout, replacing the bare <Outlet />:
<I18nProvider i18n={i18n}>
  <LanguageSwitcher />
  <Outlet />
</I18nProvider>
```

**Plain SPA (no router, or any shape under Option 3)** — in `main.tsx` or `App.tsx`:

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

Skip this if the project uses the single-catalog layout — it applies only to the per-page layout above, which means **TanStack Router file-based routing only**. A declarative React Router SPA has no route files and therefore no per-page catalogs; do not create stubs for it.

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

Prefixed routes resolve their specifier relative to their own directory, so `src/routes/$locale/about.tsx` needs its stubs at `src/routes/$locale/locales/about/{locale}.ts`.

One `export const messages = {}` line per file — the extractor will overwrite these with real compiled catalogs after the first `lingui:extract` + `lingui:compile` cycle.

If the route list is long, enumerate it with grep (adapt the locales to the project's `locales` array):

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
