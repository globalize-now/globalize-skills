# React Router v7 (framework mode) Setup

This covers projects built on [React Router v7 in framework mode](https://reactrouter.com/start/framework/installation) — the official continuation of Remix. The runtime shape is the same as Remix v2 (route module `loader` / `action`, root-as-HTML-shell, Vite-based build), but the packages and ergonomics changed: `@react-router/dev` replaces `@remix-run/dev`, `react-router` replaces `@remix-run/react`, types are generated per route into `./+types/<route-name>`, and routes are declared in `app/routes.ts` (config-based) or via `@react-router/fs-routes` (file convention).

Framework mode renders HTML on every request when `ssr: true` (the default), so locale must be resolved server-side to avoid hydration mismatches and flash-of-untranslated-content (FOUC). The root `loader` reads the cookie + `Accept-Language` header, the root `Layout` renders `<html lang>` from the resolved locale, and the language switcher posts to an action route that writes the cookie and `redirect()`s.

**Detection signal:** `react-router@^7` in `dependencies`, `@react-router/dev@^7` in `devDependencies`, and a `react-router.config.{ts,js}` at the repo root. This is the Babel variant — the project uses `@vitejs/plugin-react` (or none) and does **not** have `@vitejs/plugin-react-swc` in devDeps. If `@vitejs/plugin-react-swc` is present, use the SWC sibling at `swc/lingui.setup.md` instead.

## 1. Packages

The orchestrator (Phase 2.0) pre-installed these on the main thread before dispatching the setup subagent:

| Package | Type | Purpose |
|---------|------|---------|
| `@lingui/core` | runtime | i18n engine |
| `@lingui/react` | runtime | `I18nProvider`, `Trans`, `useLingui` |
| `@lingui/cli` | dev | `lingui extract` / `lingui compile` |
| `@lingui/babel-plugin-lingui-macro` | dev | Babel macro transform |
| `@lingui/vite-plugin` | dev | Vite integration for catalog compilation |
| `@vitejs/plugin-react` | dev | Hosts the Babel macro transform; pinned to `^5` (v6 dropped `babel.plugins`) |

Treat the install step as already done. Do **not** re-run `npm install` / `yarn add` / `pnpm add` / `bun add` for those packages.

**Why `@vitejs/plugin-react` is in the manifest for this variant.** The default React Router v7 scaffold does **not** install `@vitejs/plugin-react` — the `reactRouter()` Vite plugin handles React internally. Lingui's Babel macro transform has to run inside a Babel-capable React plugin, so the manifest adds `@vitejs/plugin-react@^5` to the dev-deps install. The `^5` pin is deliberate: `@vitejs/plugin-react@^6` removed the `babel.plugins` option this setup relies on. If `package.json` already pins `@vitejs/plugin-react@^6` (rare in RR7 projects, since the scaffold doesn't include it at all), write `status: "needs_decision"` with `needsDecision: { step: "react_plugin_major_mismatch", question: "This project pins @vitejs/plugin-react@6, which dropped babel.plugins. Downgrade to ^5 (recommended) or switch to the SWC variant?", options: ["downgrade_to_v5", "switch_to_swc"] }` and exit.

> **No `@lingui/detect-locale`.** That library only works in the browser (`navigator`, `localStorage`, `window.location`). Under SSR it would throw on the server or return a wrong value, producing a hydration mismatch. React Router v7 resolves locale from the request headers and cookie inside the root `loader` instead — see Section 4.

> **Alternative integration (footnote).** Several production projects integrate Lingui macros via [`vite-plugin-babel-macros`](https://www.npmjs.com/package/vite-plugin-babel-macros) instead of `@vitejs/plugin-react`'s `babel.plugins` option. Both work. This doc takes the `@vitejs/plugin-react` path because (a) it matches Lingui's official installation guide verbatim and (b) it keeps the Babel and SWC variants symmetric. If the user later reports a conflict between `@vitejs/plugin-react` and `reactRouter()` route-module handling, fall back to `vite-plugin-babel-macros` and document the switch in `decisions.md`.

## 2. Build Tool Integration

**This modifies `vite.config.ts`.** Describe the changes to the user before making them: keeping `reactRouter()`, adding `@vitejs/plugin-react` with `@lingui/babel-plugin-lingui-macro` nested in its `babel.plugins`, and adding `lingui()` as a top-level Vite plugin.

Plugin order matters. Use exactly this sequence:

1. `reactRouter()` — the framework plugin handles route discovery, the type generator, server bundling, and the SSR/client split. It must run first so subsequent plugins see the rewritten route modules.
2. `react({ babel: { plugins: [...] } })` — runs the Babel macro transform on every module. The macro must expand **before** `lingui()` reads the source for catalog extraction.
3. `lingui()` — compiles `.po` catalogs on import and exposes them as ES modules.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { reactRouter } from '@react-router/dev/vite'
import react from '@vitejs/plugin-react'
import { lingui } from '@lingui/vite-plugin'

export default defineConfig({
  plugins: [
    reactRouter(),
    react({
      babel: {
        plugins: ['@lingui/babel-plugin-lingui-macro'],
      },
    }),
    lingui(),
  ],
})
```

If the project already has Babel plugins configured in the existing `react()` call, append `@lingui/babel-plugin-lingui-macro` to the existing array rather than overwriting it. Preserve every other plugin that was already in `plugins[]` (`tsconfigPaths()`, `tailwindcss()`, custom plugins, etc.) and keep them in their original order — only insert the three plugins above at the positions described.

> **`react-router.config.ts` is unrelated.** This file lives at the repo root and configures `ssr`, `prerender`, `appDirectory`, etc. — it has no `babel` or `transform` option. Do not edit it for Lingui integration.

> **MDX users:** the `react-router:validate-plugin-order` check rejects `@mdx-js/rollup` placed after `reactRouter()`. If the project uses MDX, keep `@mdx-js/rollup` before `reactRouter()`, then `react()`, then `lingui()`. The rule does not apply to the React plugin.

## 3. Lingui Config

Create `lingui.config.ts` at the project root. The catalog path follows React Router v7's convention of putting application source under `app/`:

```ts
// lingui.config.ts
import type { LinguiConfig } from '@lingui/conf'
import { sourceLocale, locales } from './app/i18n/locales'

const config: LinguiConfig = {
  sourceLocale,
  locales: [...locales],
  catalogs: [
    {
      path: '<rootDir>/app/locales/{locale}/messages',
      include: ['<rootDir>/app'],
      exclude: ['**/node_modules/**', '**/locales/**', '**/+types/**'],
    },
  ],
  format: 'po',
  compileNamespace: 'ts',
}

export default config
```

The `compileNamespace: 'ts'` setting emits compiled catalogs as `messages.ts` files alongside `messages.po`. The `**/+types/**` exclusion keeps the extractor from scanning React Router's generated type files.

If the user opted for per-route catalogs in Phase 1 (rare for RR7; the default is a single catalog per locale), substitute the per-route path:

```ts
catalogs: [
  {
    path: '<rootDir>/app/routes/{name}/locales/{locale}',
    include: ['<rootDir>/app/routes/{name}'],
  },
],
```

This requires Lingui's experimental per-page extractor (`lingui extract-experimental`) and matches the TanStack Start pattern. For the rest of this doc, the single-catalog layout is assumed unless explicitly called out.

Create the shared locale-constants module at the same time:

```ts
// app/i18n/locales.ts
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

Replace the `locales` tuple with the array from `decisions.md` (e.g., `['en', 'fr', 'de'] as const`). `resolveLocale` is pure and depends only on the locale constants, so it's safe to import from anywhere — root loader, route loaders, the language-switcher action, server utilities.

## 4. Locale Resolution at the Edge (root `loader`)

The root `loader` runs on every request before the HTML stream starts. It resolves the locale once, loads the matching compiled catalog, and returns `{ locale, dir, messages }` into the route module's data — where the root `Layout` reads `locale` + `dir` via `useRouteLoaderData("root")` and the root `App` activates the catalog before render.

Loading the catalog server-side (and shipping the messages through `loaderData`) is the cleanest SSR-safe approach for a non-RSC framework — it avoids `require()` (RR7's build is ESM) and avoids the need for a synchronous static catalog map.

Create the cookie helper:

```ts
// app/i18n/locale.server.ts
import { createCookie } from 'react-router'
import { resolveLocale, type Locale } from './locales'

export const localeCookie = createCookie('locale', {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
  httpOnly: false, // language-switcher action reads the cookie value, not document.cookie — but leave it readable for debug tools
  secure: process.env.NODE_ENV === 'production',
})

export async function readLocaleFromRequest(request: Request): Promise<Locale> {
  const cookieHeader = request.headers.get('Cookie')
  const cookieValue = (await localeCookie.parse(cookieHeader)) as string | null
  if (cookieValue) return resolveLocale(cookieValue)
  const acceptLanguage = request.headers.get('Accept-Language')
  const headerLocale = acceptLanguage?.split(',')[0]?.split(';')[0]?.trim()
  return resolveLocale(headerLocale)
}

const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi'])

export function getDirection(locale: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale.split('-')[0]) ? 'rtl' : 'ltr'
}
```

The file is named `locale.server.ts` so Vite's import analyzer excludes it from the client bundle — only the server runtime imports `createCookie` from `react-router`.

Then add the root `loader` to `app/root.tsx`. Use the generated `Route.LoaderArgs` type from `./+types/root` — these types are auto-generated by `react-router typegen` (or by the dev server on the fly) into `app/+types/root.d.ts`:

```tsx
// app/root.tsx (loader added; full file in Section 5)
import type { Route } from './+types/root'
import type { Messages } from '@lingui/core'
import { localeCookie, readLocaleFromRequest, getDirection } from './i18n/locale.server'

export async function loader({ request }: Route.LoaderArgs) {
  const locale = await readLocaleFromRequest(request)
  // Dynamic import is resolved by Vite + @lingui/vite-plugin at build time —
  // one chunk per locale, picked at request time.
  const { messages } = (await import(`./locales/${locale}/messages.ts`)) as { messages: Messages }
  return Response.json(
    { locale, dir: getDirection(locale), messages },
    {
      headers: {
        'Set-Cookie': await localeCookie.serialize(locale),
      },
    },
  )
}
```

The loader persists the resolved locale back to the cookie on every request — that way, even an Accept-Language–only first visit leaves a cookie behind, so subsequent visits short-circuit the header parse. Loading the catalog inside the loader means the SSR pass already has `messages` in hand by the time `App` runs, eliminating the need for client-side activation hacks.

## 5. Root Layout (`app/root.tsx`)

**This modifies the root route module.** Show the user the exact changes before writing them. Read the existing `app/root.tsx` first and note the current `<html>` attributes — if `<html lang="en">` (or any hardcoded value) is present, flag it: "Your `app/root.tsx` has `<html lang='en'>`. This will become `<html lang={locale} dir={dir}>` where `locale` and `dir` come from the root loader."

React Router v7's root module follows a specific shape:

- A named `Layout({ children })` export renders the HTML shell. It runs for every route render, **including** error boundaries — so it must read data via `useRouteLoaderData("root")`, not `useLoaderData()` (which throws when the loader errored).
- A default export `Root` (often called `App`) renders the route tree via `<Outlet />`.
- Optional `ErrorBoundary` and `HydrateFallback` exports.

The provider lives in the default export so the entire route tree has access to translations. The `I18nProvider` reads from a per-locale singleton (`Map<Locale, I18n>`) so each locale gets a fresh, independently activated instance — same shape as the Next.js App Router setup in `references/languages/js-ts/frameworks/nextjs/app-router/lingui.setup.md`.

```ts
// app/i18n/index.ts
import { i18n, setupI18n, type I18n } from '@lingui/core'
import type { Locale } from './locales'

const instances = new Map<Locale, I18n>()

export function getI18nInstance(locale: Locale): I18n {
  let instance = instances.get(locale)
  if (!instance) {
    // Distinct instance per locale — avoids cross-request locale bleed during
    // concurrent SSR renders. The fallback shared `i18n` is only used by
    // route modules that prefer a single global (e.g. for client-side use after hydration).
    instance = setupI18n()
    instances.set(locale, instance)
  }
  return instance
}

export function activateLocale(locale: Locale, messages: Record<string, string>): I18n {
  const instance = getI18nInstance(locale)
  instance.loadAndActivate({ locale, messages })
  return instance
}

export { i18n }
```

Each locale gets its own `I18n` instance built via `setupI18n()`, keyed on locale so a second request for the same locale reuses the cached instance. On the server, this matters because two simultaneous requests for different locales would otherwise share the global `i18n` and race over `activate(locale)`. On the client, only one locale is ever active per session, so the Map degenerates to a single entry.

Now the canonical root module. This is the single shape `app/root.tsx` should end up in after Section 5. Subsequent sections add to it (Section 9 inserts `<LanguageSwitcher />`, Section 11 adds the `meta` export) but never rewrite the `App` body or the loader's contract.

```tsx
// app/root.tsx
import type { Route } from './+types/root'
import type { Messages } from '@lingui/core'
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from 'react-router'
import { I18nProvider } from '@lingui/react'
import { localeCookie, readLocaleFromRequest, getDirection } from './i18n/locale.server'
import { activateLocale } from './i18n'
import { sourceLocale, type Locale } from './i18n/locales'

export async function loader({ request }: Route.LoaderArgs) {
  const locale = await readLocaleFromRequest(request)
  const { messages } = (await import(`./locales/${locale}/messages.ts`)) as { messages: Messages }
  return Response.json(
    { locale, dir: getDirection(locale), messages },
    {
      headers: {
        'Set-Cookie': await localeCookie.serialize(locale),
      },
    },
  )
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData('root') as
    | { locale: Locale; dir: 'ltr' | 'rtl' }
    | undefined
  const locale = data?.locale ?? sourceLocale
  const dir = data?.dir ?? 'ltr'
  return (
    <html lang={locale} dir={dir}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App({ loaderData }: Route.ComponentProps) {
  // Activate the per-locale catalog before the route tree renders. Runs on the server
  // during SSR (no DOM access required) and again on the client after hydration.
  // activateLocale() is idempotent for the same (locale, messages) pair.
  const i18n = activateLocale(loaderData.locale, loaderData.messages)
  return (
    <I18nProvider i18n={i18n}>
      <Outlet />
    </I18nProvider>
  )
}
```

`Layout` falls back to `sourceLocale` / `'ltr'` when `data` is undefined (which happens when the root loader itself errors and `Layout` is rendered around the `ErrorBoundary`). Without that guard, the HTML shell would render with `lang={undefined}` and React would emit a hydration warning.

The `<html lang>` is correct on the very first byte of HTML — no client-side mutation of `document.documentElement` is needed, and adding one would fight the server output. The catalog is activated synchronously from `loaderData.messages` (already resolved by the loader's `await import`), so the first server-rendered byte already has translated text in it.

## 6. STOP — Routing Strategy

**Before generating any per-route code, STOP and present this to the user:**

> Choose a locale routing strategy:
> 1. **Unprefixed source locale** — source locale (e.g., English) keeps original URLs (`/about`). Other locales use `/<locale>/about` (e.g., `/de/about`). Best for preserving existing URLs and SEO.
> 2. **All locales prefixed** — every locale gets a prefix (`/en/about`, `/de/about`). Bare paths (`/about`) redirect to the source locale. Cleanest structure, single route tree.
> 3. **Cookie-only** — no URL changes. Locale is stored in a cookie, resolved server-side each request. Simplest setup; works well for apps that don't need locale-specific URLs.

**You MUST wait for the user to choose before proceeding. Do NOT default to option 1.**

Each strategy is expressible in both routing approaches React Router v7 supports — config-based (`app/routes.ts` with `route()`/`index()`/`layout()`/`prefix()` from `@react-router/dev/routes`) and file-convention (`@react-router/fs-routes` flat-routes). Inspect which the project uses by reading `app/routes.ts`:

- If `app/routes.ts` exports `flatRoutes()` from `@react-router/fs-routes`, the project uses file-convention routing.
- If it exports an array of `route()` / `index()` / `layout()` calls, the project uses config-based routing.

What follows shows both for each strategy. Pick the matching approach when editing the project.

### Strategy A: Unprefixed source locale

Source-locale routes keep their original paths (`/about`). Target-locale routes nest under a `:lang` param (`/de/about`, `/fr/about`). The root `loader` resolves locale from either the URL param (when present) or the cookie fallback.

**Config-based (`app/routes.ts`):**

```ts
import { type RouteConfig, route, index, prefix } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('about', 'routes/about.tsx'),
  // Target-locale tree — same files, mounted under :lang
  ...prefix(':lang', [
    index('routes/home.tsx', { id: 'home-lang' }),
    route('about', 'routes/about.tsx', { id: 'about-lang' }),
  ]),
] satisfies RouteConfig
```

The `id` overrides on the prefixed copies are required because React Router uses the file path as the default route id, and the same file can't appear twice without unique ids.

**File-convention (`@react-router/fs-routes`):**

```text
app/routes/
  ($lang)._index.tsx
  ($lang).about.tsx
```

The `($lang)` segment is optional — `flatRoutes` matches both `/about` and `/de/about` with a single file. Read `params.lang` inside the loader and treat `undefined` as the source locale.

In both approaches, update the root `loader` (Section 4) so it prefers the URL param when present and falls back to the cookie. Keep loading messages inside the loader — the only change is how `locale` is resolved.

```ts
// app/root.tsx (replace the Section 4 loader)
import type { Messages } from '@lingui/core'
import { locales, sourceLocale, type Locale } from './i18n/locales'

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const firstSegment = url.pathname.split('/').filter(Boolean)[0]
  const urlLocale =
    firstSegment && (locales as readonly string[]).includes(firstSegment)
      ? (firstSegment as Locale)
      : null

  const locale = urlLocale ?? (await readLocaleFromRequest(request))
  const { messages } = (await import(`./locales/${locale}/messages.ts`)) as { messages: Messages }
  return Response.json(
    { locale, dir: getDirection(locale), messages },
    { headers: { 'Set-Cookie': await localeCookie.serialize(locale) } },
  )
}
```

> **Canonicalization.** Visiting `/en/about` (when `en` is the source locale) renders the prefixed route variant with the English catalog — not the canonical `/about`. For SEO hygiene on a public site, add a redirect in the root loader when `urlLocale === sourceLocale`:
> ```ts
> import { redirect } from 'react-router'
> if (urlLocale === sourceLocale) {
>   throw redirect(url.pathname.replace(`/${sourceLocale}`, '') || '/')
> }
> ```

### Strategy B: All locales prefixed

Every route lives under `:lang`. Bare paths redirect to the resolved locale's prefix.

**Config-based (`app/routes.ts`):**

```ts
import { type RouteConfig, route, index, prefix } from '@react-router/dev/routes'

export default [
  ...prefix(':lang', [
    index('routes/home.tsx'),
    route('about', 'routes/about.tsx'),
  ]),
] satisfies RouteConfig
```

**File-convention (`@react-router/fs-routes`):**

```text
app/routes/
  $lang._index.tsx
  $lang.about.tsx
```

Note the bare `$lang` (no parentheses) — every route under this convention requires the locale segment.

Replace the root `loader` so it redirects bare paths to the resolved-locale prefix. The catalog load stays the same as Section 4:

```ts
// app/root.tsx (replace the Section 4 loader)
import type { Messages } from '@lingui/core'
import { redirect } from 'react-router'
import { locales, type Locale } from './i18n/locales'

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const firstSegment = url.pathname.split('/').filter(Boolean)[0]
  if (!firstSegment || !(locales as readonly string[]).includes(firstSegment)) {
    const locale = await readLocaleFromRequest(request)
    throw redirect(`/${locale}${url.pathname === '/' ? '' : url.pathname}`)
  }
  const locale = firstSegment as Locale
  const { messages } = (await import(`./locales/${locale}/messages.ts`)) as { messages: Messages }
  return Response.json(
    { locale, dir: getDirection(locale), messages },
    { headers: { 'Set-Cookie': await localeCookie.serialize(locale) } },
  )
}
```

### Strategy C: Cookie-only

No route restructuring. `app/routes.ts` keeps its original shape (or `flatRoutes()` keeps its existing files). The root loader from Section 4 stands as-is — the cookie + Accept-Language fallback is the only locale source.

This is the lowest-effort strategy and the right default for apps where SEO and shareable locale-stable URLs don't matter (auth-gated apps, internal tools, single-locale-per-user products).

---

## 7. Per-Route Usage

With the single-catalog layout from Section 3 and the root loader from Section 4, the catalog is already loaded and activated by the time any page route renders. Page routes only need to import the macro and write JSX — no per-route loader logic, no `activateLocale()` calls.

```tsx
// app/routes/about.tsx
import { Trans } from '@lingui/react/macro'

export default function About() {
  return (
    <h1>
      <Trans>About us</Trans>
    </h1>
  )
}
```

If a page needs the imperative `t` macro (for prop values, event handlers, or computed strings), import it from `@lingui/core/macro` and use it inline:

```tsx
import { Trans } from '@lingui/react/macro'
import { useLingui } from '@lingui/react'

export default function About() {
  const { _ } = useLingui()
  return (
    <>
      <h1><Trans>About us</Trans></h1>
      <img src="/team.jpg" alt={_({ id: 'About page team photo', message: 'Our team' })} />
    </>
  )
}
```

For routes that need access to the resolved locale itself (e.g., to format dates with `Intl.DateTimeFormat`), pull it from the root match:

```tsx
import { useRouteLoaderData } from 'react-router'
import { Trans } from '@lingui/react/macro'
import type { Locale } from '../i18n/locales'

export default function About() {
  const { locale } = useRouteLoaderData('root') as { locale: Locale }
  const today = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date())
  return (
    <>
      <h1><Trans>About us</Trans></h1>
      <p><Trans>Today is {today}.</Trans></p>
    </>
  )
}
```

> **Per-route catalogs (advanced).** If the user picked per-route catalogs in Phase 1 (rare for RR7 — the default is a single catalog), each page route's `loader` must import its own catalog instead and call `activateLocale()` itself. The route shape becomes:
> ```tsx
> export async function loader({ request }: Route.LoaderArgs) {
>   const root = await readLocaleFromRequest(request)
>   const { messages } = await import(`./locales/about/${root}.ts`)
>   return { messages }
> }
>
> export default function About({ loaderData }: Route.ComponentProps) {
>   activateLocale(loaderData.locale, loaderData.messages)
>   return <h1><Trans>About us</Trans></h1>
> }
> ```
> Per-route catalogs require the bootstrap stubs described in Section 8 — see the per-route variant there.

## 8. Catalog Bootstrapping

Before the first `npx lingui extract`, the locale directories don't exist yet. Two things break without bootstrap stubs:

1. The root loader's `await import(\`./locales/${locale}/messages.ts\`)` (Section 4) will fail with `Cannot find module` the first time the dev server starts.
2. The extractor scans source files (including the dynamic `import('./locales/...')` specifier in `root.tsx`), and if it can't resolve them it fails with `Could not resolve import(...)` and exits without writing anything.

**For the single-catalog layout (Section 3 default):** seed an empty `messages.ts` stub for every locale before the first dev start.

```bash
for loc in en de fr ; do
  mkdir -p "app/locales/$loc"
  printf 'export const messages = {}\n' > "app/locales/$loc/messages.ts"
done
```

Replace `en de fr` with the actual `locales` array from `decisions.md`.

**For the per-route catalogs layout:** for every route file containing `await import(\`../locales/<route>/${locale}.ts\`)`, seed `app/locales/<route>/<locale>.ts` with one line:

```ts
export const messages = {}
```

Enumerate route files with `grep`:

```bash
grep -rlE "import\\(\\\`\\./locales/" app/routes/ | while read f; do
  name="$(basename "$f" .tsx)"
  dir="$(dirname "$f")/locales/$name"
  mkdir -p "$dir"
  for loc in en de fr ; do echo "export const messages = {}" > "$dir/$loc.ts"; done
done
```

The script is a convenience — the load-bearing step is verifying that every `import()` target path used in route loaders has a matching stub. Routes using non-default paths (e.g. `await import(\`../locales/profile/${locale}.ts\`)` inside `app/routes/user.settings.tsx`) must have stubs at the exact specifier the code uses.

`lingui extract --clean` followed by `lingui compile` will overwrite these stubs with real catalogs on the first successful run.

## 9. Language Switcher

The switcher posts to a dedicated action route (`app/routes/set-locale.ts`) that writes the cookie and `redirect()`s back to the page the user was on. The full-page navigation is intentional — it forces the server to re-render with the new locale on the very next request, eliminating mixed-locale frames during streaming SSR.

Define the action route:

```ts
// app/routes/set-locale.ts
import type { Route } from './+types/set-locale'
import { redirect } from 'react-router'
import { localeCookie } from '../i18n/locale.server'
import { resolveLocale } from '../i18n/locales'

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData()
  const requested = String(form.get('locale') ?? '')
  const returnTo = String(form.get('returnTo') ?? '/')
  const locale = resolveLocale(requested)

  return redirect(returnTo, {
    headers: {
      'Set-Cookie': await localeCookie.serialize(locale),
    },
  })
}

// No default export — this route exists only for its action.
export default function SetLocale() {
  return null
}
```

Wire the route in `app/routes.ts` (config-based):

```ts
route('set-locale', 'routes/set-locale.ts'),
```

Or in `@react-router/fs-routes` — `app/routes/set-locale.ts` is picked up automatically.

Then build the switcher component. For Strategy A and B (URL-based), the switcher also updates the URL so the next request hits the right prefixed route. For Strategy C (cookie-only), the cookie write + reload is enough.

```tsx
// app/components/LanguageSwitcher.tsx
import { Form, useLocation, useRouteLoaderData } from 'react-router'
import { locales, sourceLocale, type Locale } from '../i18n/locales'

export function LanguageSwitcher() {
  const root = useRouteLoaderData('root') as { locale: Locale }
  const location = useLocation()
  const displayNames = new Intl.DisplayNames([root.locale], { type: 'language' })

  // Strip current locale prefix to get the base path (Strategy A / B).
  // For Strategy C, this is a no-op and basePath === location.pathname.
  let basePath = location.pathname
  for (const loc of locales) {
    if (basePath.startsWith(`/${loc}/`)) {
      basePath = basePath.slice(loc.length + 1)
      break
    }
    if (basePath === `/${loc}`) {
      basePath = '/'
      break
    }
  }

  function returnToFor(loc: Locale): string {
    // Strategy C: cookie only, URL unchanged
    // return location.pathname

    // Strategy A: source locale stays unprefixed
    if (loc === sourceLocale) return basePath
    return basePath === '/' ? `/${loc}` : `/${loc}${basePath}`

    // Strategy B: every locale gets a prefix — remove the sourceLocale branch above
    // return basePath === '/' ? `/${loc}` : `/${loc}${basePath}`
  }

  return (
    <nav style={{ display: 'flex', gap: '0.5rem' }}>
      {locales.map((loc) => (
        <Form key={loc} method="post" action="/set-locale">
          <input type="hidden" name="locale" value={loc} />
          <input type="hidden" name="returnTo" value={returnToFor(loc)} />
          <button
            type="submit"
            style={{
              padding: '0.25rem 0.5rem',
              fontWeight: loc === root.locale ? 600 : 400,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'inherit',
            }}
          >
            {displayNames.of(loc) ?? loc}
          </button>
        </Form>
      ))}
    </nav>
  )
}
```

Place the switcher inside the root `App` so it appears on every page. This is an additive edit to the canonical `App` from Section 5 — keep the existing `activateLocale()` call and the `<I18nProvider>` wrapper:

```tsx
// app/root.tsx (modify the default export from Section 5)
import { LanguageSwitcher } from './components/LanguageSwitcher'

export default function App({ loaderData }: Route.ComponentProps) {
  const i18n = activateLocale(loaderData.locale, loaderData.messages)
  return (
    <I18nProvider i18n={i18n}>
      <LanguageSwitcher />
      <Outlet />
    </I18nProvider>
  )
}
```

If the project has a shared header or navigation component, place the switcher there instead and keep the `App` body unchanged.

**Programmatic switching (no full-page navigation):** use `useSubmit()` to post to the same action route from anywhere:

```tsx
import { useSubmit } from 'react-router'

const submit = useSubmit()

function switchTo(loc: Locale) {
  const formData = new FormData()
  formData.append('locale', loc)
  formData.append('returnTo', window.location.pathname)
  submit(formData, { method: 'post', action: '/set-locale' })
}
```

The action's `redirect()` triggers a full document navigation when posted from a non-Form context, so the next render still goes through the server with the new cookie.

**Styling:** the examples use inline styles as a baseline. Adapt to match the project's CSS approach (Tailwind, CSS Modules, etc.) and the visual style of the surrounding navigation.

## 10. Link Handling

**Only relevant for Strategy A and B.** If the user chose Strategy C, skip this — URLs don't change and existing `<Link>` and `<a>` tags work unchanged.

React Router v7's `<Link>` and `useNavigate` come from `react-router` (not `react-router-dom`, not `@remix-run/react`). For URL-prefixed strategies, every internal link needs the current locale prefix.

Build a small hook that reads the root loader data and returns a prefix-aware path builder:

```ts
// app/i18n/useLocalePath.ts
import { useRouteLoaderData } from 'react-router'
import { sourceLocale, type Locale } from './locales'

export function useLocalePath() {
  const root = useRouteLoaderData('root') as { locale: Locale } | undefined
  const locale = root?.locale ?? sourceLocale

  return function localePath(path: string): string {
    // Strategy A: source locale stays unprefixed
    if (locale === sourceLocale) return path

    // Strategy B: every locale gets a prefix — remove the branch above
    return path === '/' ? `/${locale}` : `/${locale}${path}`
  }
}
```

Then use it in navigation components:

```tsx
import { Link } from 'react-router'
import { useLocalePath } from '../i18n/useLocalePath'

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

`useLocalePath()` works the same for Strategy A and Strategy B with the branch tweak shown — the only difference is whether the source locale is prefixed.

### Existing link migration

Tell the user:

> Existing internal links need updating to include the locale prefix. Search for:
> - `<Link to="/...">` — wrap the `to` with `localePath(...)`
> - `<NavLink to="/...">` — same pattern
> - `<a href="/...">` with internal paths — convert to `<Link>` with `localePath(...)`
> - `navigate('/...')` / `useNavigate()` calls — wrap the argument with `localePath(...)`
>
> Navigation components (headers, sidebars, footers) are the highest priority since they appear on every page.

## 11. SEO — `hreflang` Alternates

Add `<link rel="alternate" hreflang="...">` tags to the root document via the `links` export of the route module that owns the page (typically the route itself, falling back to root for global pages). Include `x-default` so search engines have a fallback.

The simplest setup adds them globally in `app/root.tsx`:

```tsx
// app/root.tsx (add this export alongside loader / Layout / App)
import type { Route } from './+types/root'
import { locales, sourceLocale } from './i18n/locales'

export function meta({ data, location }: Route.MetaArgs) {
  const path = location.pathname
  // Strip current locale prefix to derive the canonical base path.
  let basePath = path
  for (const loc of locales) {
    if (basePath.startsWith(`/${loc}/`)) {
      basePath = basePath.slice(loc.length + 1)
      break
    }
    if (basePath === `/${loc}`) {
      basePath = '/'
      break
    }
  }

  function hrefFor(loc: string): string {
    // Strategy A: source locale stays unprefixed
    if (loc === sourceLocale) return basePath
    return basePath === '/' ? `/${loc}` : `/${loc}${basePath}`
    // Strategy B: drop the sourceLocale branch
  }

  return [
    ...locales.map((loc) => ({
      tagName: 'link',
      rel: 'alternate',
      hrefLang: loc,
      href: hrefFor(loc),
    })),
    {
      tagName: 'link',
      rel: 'alternate',
      hrefLang: 'x-default',
      href: hrefFor(sourceLocale),
    },
  ]
}
```

For Strategy C, `hreflang` alternates are usually unnecessary — there's no per-locale URL to point at. Skip this section unless the user specifically asks for SEO scaffolding.

> The `meta` export uses React Router's tag-name-based descriptors (`tagName: 'link'`, etc.). It runs on every route render and merges with `meta` from parent routes. Avoid returning absolute URLs unless the project has a configured site origin; relative paths are correct here because `hreflang` accepts them.

## 12. Verification

Run these in order. Each must pass before moving to the next.

```bash
# 1. Regenerate route types (so Route.LoaderArgs etc. exist)
npx react-router typegen

# 2. TypeScript check
npx tsc --noEmit

# 3. Extract + compile catalogs (this overwrites the Section 8 stubs)
npx lingui extract --clean
npx lingui compile

# 4. Production build
npm run build
```

If `tsc --noEmit` fails with "Cannot find name 'Route'" or similar, re-run `npx react-router typegen` — the type generator is normally invoked by the dev server, but it doesn't run on a fresh clone until `npm run dev` (or `react-router dev`) has been invoked at least once.

If `lingui extract` fails with `Could not resolve import(...)`, revisit Section 8 — there's an unstubbed catalog import in one of the loader files.

If `npm run build` fails with `Trans is not defined` or similar, the macro transform isn't running. Verify:
- `@vitejs/plugin-react@^5` is installed (Section 1 — pre-installed by the orchestrator).
- `vite.config.ts` has the exact plugin order from Section 2: `reactRouter()`, then `react({ babel: { plugins: ['@lingui/babel-plugin-lingui-macro'] } })`, then `lingui()`.
- The macro import is `import { Trans } from '@lingui/react/macro'` (not the deprecated `@lingui/macro`; non-React macros like `t` come from `@lingui/core/macro`).

## 13. Optional add-ons

If the user selected any optional add-ons in `SKILL.md §1.10` (coding rules `@import`, ESLint plugin, CI/CD integration, test setup wrapper), apply the matching sub-steps from `references/languages/js-ts/libraries/lingui/setup.add-ons.md`. Skip add-ons the user did not select. Skip this section entirely if no add-ons were selected.
