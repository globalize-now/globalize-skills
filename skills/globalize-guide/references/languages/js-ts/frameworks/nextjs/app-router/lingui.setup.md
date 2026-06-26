# Next.js App Router Setup

This covers Next.js 13+ projects using the App Router with React Server Components (RSC). The setup is more involved than standard React because RSC can't use React context — LinguiJS provides a server-side `setI18n` API alongside a client-side provider.

## Packages

In addition to the core Lingui packages (`@lingui/core`, `@lingui/react`, `@lingui/cli`), install:

| Package | Type | Purpose |
|---------|------|---------|
| `@lingui/swc-plugin` | dev | SWC macro transform (Next.js uses SWC by default) |

If the project has a `.babelrc`, use `@lingui/babel-plugin-lingui-macro` instead.

**Example (npm):**

```bash
npm install '@lingui/core@^6' '@lingui/react@^6'
npm install -D '@lingui/cli@^6' '@lingui/swc-plugin@^6'
```

**Version pinning:** `@lingui/swc-plugin` must match the `swc_core` version shipped by the project's Next.js version. Installing without a version specifier grabs the latest, which may not be compatible. Look up the correct version at https://plugins.swc.rs (select "next" + the project's Next.js version), then pin it exactly — e.g. `npm install -D @lingui/swc-plugin@4.0.8`. See "SWC plugin version mismatch" in Common Gotchas if the build fails with an AST schema error.

Note: No `@lingui/vite-plugin` — Next.js has its own build pipeline.

## Build Tool Integration

Add the SWC plugin to `next.config.js` (or `next.config.mjs` / `next.config.ts`):

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    swcPlugins: [['@lingui/swc-plugin', {}]],
  },
}
module.exports = nextConfig
```

For ESM config (`next.config.mjs`):

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    swcPlugins: [['@lingui/swc-plugin', {}]],
  },
}
export default nextConfig
```

If the project uses Babel instead of SWC, add the plugin to `.babelrc`:

```json
{
  "plugins": ["@lingui/babel-plugin-lingui-macro"]
}
```

## Provider Setup

The App Router needs three pieces: an i18n instance factory, a client provider component, and the root layout wiring. It also needs locale-based routing and middleware.

With per-page catalogs (the default for Next.js App Router), each page loads its own catalog rather than a single global one. If using a single catalog instead, the factory should load from `../locales/${locale}/messages.ts` directly.

### 1. I18n Instance Factory

```ts
// src/app/appRouterI18n.ts
import { i18n, type I18n } from '@lingui/core'

const instances = new Map<string, I18n>()

export function getI18nInstance(locale: string): I18n {
  if (!instances.has(locale)) {
    const instance = i18n.make()
    instance.activate(locale)
    instances.set(locale, instance)
  }
  return instances.get(locale)!
}

export function loadPageCatalog(instance: I18n, locale: string, messages: Record<string, string>) {
  instance.load(locale, messages)
}
```

### 2. Client Provider

```tsx
// src/app/LinguiClientProvider.tsx
'use client'

import type { Messages } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { useMemo } from 'react'
import { getI18nInstance } from './appRouterI18n'

export function LinguiClientProvider({
  children,
  initialLocale,
  initialMessages,
}: {
  children: React.ReactNode
  initialLocale: string
  initialMessages: Messages
}) {
  const i18n = useMemo(() => {
    const instance = getI18nInstance(initialLocale)
    instance.load(initialLocale, initialMessages)
    instance.activate(initialLocale)
    return instance
  }, [initialLocale, initialMessages])

  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}
```

### 3. Locale-based Routing

**Before proceeding, check for existing locale routing:**

- Does a `[locale]/` or `[locale]/` directory already exist under `src/app/`? If yes, use the existing structure — do not restructure.
- Does `src/middleware.ts`, `middleware.ts`, `src/proxy.ts`, or `proxy.ts` already exist? If yes, read it. Record this — the middleware section below must handle it. **`proxy.ts` is the Next.js 16+ rename of `middleware.ts`** — both are the same integration point; never create a second file alongside an existing one.

**If no existing locale routing exists, STOP and present this to the user:**

> To support multiple locales in Next.js App Router, pages move under a `[locale]/` dynamic segment. This is a significant structural change:
> - The root layout (`src/app/layout.tsx`) is rewritten to add the i18n provider, and a new locale layout is created at `src/app/[locale]/layout.tsx`
> - All internal links and `<Link>` hrefs must include the locale prefix for non-source locales
> - New middleware intercepts requests to handle locale routing
>
> Choose a routing strategy:
> 1. **Unprefixed source locale** — source locale (e.g., English) keeps original URLs (`/about`). Other locales get prefixed (`/fr/about`, `/de/about`). Best for preserving existing SEO and link stability.
> 2. **All locales prefixed** — every locale gets a prefix (`/en/about`, `/fr/about`). Bare paths (`/about`) permanently redirect (301) to the source locale (`/en/about`). Best for consistent URL structure.
> 3. **Skip locale routing for now** — set up LinguiJS with a hardcoded locale, no URL changes, add routing later
> 4. **Show me the full impact first** — list every file that would be moved before deciding

**You MUST wait for the user to choose before proceeding. Do NOT default to option 1.**

---

#### Directory restructuring (Strategy 1 and 2)

Both strategies use the same `[locale]` directory structure — the difference is in middleware behavior (section 4). Move pages under a `[locale]` dynamic segment:

```
src/app/
  layout.tsx              ← root layout with <html>, provider (rewritten from original)
  [locale]/
    layout.tsx            ← locale layout: validation + setI18n
    page.tsx              ← home page (was src/app/page.tsx)
    locales/page/         ← catalog for the home page (generated by extract)
      en.po
      fr.po
    about/
      page.tsx
      locales/page/       ← catalog for the about page
        en.po
        fr.po
  appRouterI18n.ts
  LinguiClientProvider.tsx
```

The `locales/` directories are generated by `lingui extract-experimental` — they appear co-located next to each page file.

The App Router uses a two-layout pattern: a root layout for the `<html>` tag and provider, and a locale layout for locale validation and `setI18n`. The provider lives in the root layout so that all routes — including root-level routes like `not-found.tsx` and `error.tsx` that live outside `[locale]` — have access to translations.

Create a direction helper used by the root layout:

```ts
// src/app/getDirection.ts
const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi'])

export function getDirection(locale: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale.split('-')[0]) ? 'rtl' : 'ltr'
}
```

**`<html lang>` migration:** Before rewriting the layout, read the existing `src/app/layout.tsx` and note the current `<html lang="...">` value. Tell the user: "Your layout currently has `<html lang="X">`. This will become `<html lang={locale} dir={direction}>` where `locale` is determined by middleware." If the existing value differs from `sourceLocale` in `lingui.config.ts`, flag it — the source locale config may need updating to match.

### Root layout: `src/app/layout.tsx`

The root layout provides the `<html>` tag and wraps all children with `LinguiClientProvider`. It uses `sourceLocale` as the default since the middleware resolves the actual locale before the `[locale]` layout runs:

```tsx
// src/app/layout.tsx
import { getI18nInstance } from './appRouterI18n'
import { LinguiClientProvider } from './LinguiClientProvider'
import { getDirection } from './getDirection'
import { sourceLocale } from './i18n/locales'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const i18n = getI18nInstance(sourceLocale)

  return (
    <html lang={sourceLocale} dir={getDirection(sourceLocale)}>
      <body>
        <LinguiClientProvider
          initialLocale={sourceLocale}
          initialMessages={i18n.messages}
        >
          {children}
        </LinguiClientProvider>
      </body>
    </html>
  )
}
```

Note: The root layout uses `sourceLocale` as a fallback. For routes under `[locale]`, the locale layout below provides the correct locale via `setI18n`, and pages load their own locale-specific catalogs. For root-level routes outside `[locale]` (like `not-found.tsx`), the source locale is used.

### Locale layout: `src/app/[locale]/layout.tsx`

The locale layout validates the locale parameter, sets the i18n instance for server components, and provides `LinguiClientProvider` with the correct locale. The root layout above has a provider too (for root-level routes like `not-found.tsx`), but this inner provider takes precedence via React context and supplies the accurate locale from the URL. With per-page catalogs, the layout does **not** load any catalog itself — each page loads its own:

```tsx
// src/app/[locale]/layout.tsx
import { setI18n } from '@lingui/react/server'
import { getI18nInstance } from '../appRouterI18n'
import { LinguiClientProvider } from '../LinguiClientProvider'
import { locales } from '../i18n/locales'
import { notFound } from 'next/navigation'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  params,
  children,
}: {
  params: Promise<{ locale: string }>
  children: React.ReactNode
}) {
  const { locale } = await params

  // Validate the locale
  if (!locales.includes(locale)) {
    notFound()
  }

  const i18n = getI18nInstance(locale)
  setI18n(i18n)

  return (
    <LinguiClientProvider
      initialLocale={locale}
      initialMessages={i18n.messages}
    >
      {children}
    </LinguiClientProvider>
  )
}
```

Note: `params` is `Promise<{ locale: string }>` in Next.js 15+. For Next.js 13-14, use `params: { locale: string }` directly (no `await`).

---

#### Option 3: Skip locale routing (hardcoded locale)

This approach adds LinguiJS without changing the URL structure. The app uses a single hardcoded locale. Locale routing can be added later by restructuring to strategies 1 or 2.

Modify the existing `src/app/layout.tsx` in place — do not move it:

**`<html lang>` migration:** Read the existing layout's `<html lang="...">` value. Tell the user: "Your layout currently has `<html lang="X">`. This will become `<html lang={DEFAULT_LOCALE}>` (hardcoded to the source locale)." If the values differ, ask the user which is correct.

```tsx
// src/app/layout.tsx (modified — no [locale] restructuring)
import { setI18n } from '@lingui/react/server'
import { getI18nInstance } from './appRouterI18n'
import { LinguiClientProvider } from './LinguiClientProvider'

// To add locale-based URL routing later, restructure pages under [locale]/
// See: https://nextjs.org/docs/app/building-your-application/routing/internationalization
const DEFAULT_LOCALE = 'en'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const i18n = getI18nInstance(DEFAULT_LOCALE)
  setI18n(i18n)

  return (
    <html lang={DEFAULT_LOCALE} dir="ltr">
      <body>
        <LinguiClientProvider
          initialLocale={DEFAULT_LOCALE}
          initialMessages={i18n.messages}
        >
          {children}
        </LinguiClientProvider>
      </body>
    </html>
  )
}
```

With this approach:
- No middleware is needed
- No files are moved
- No URLs change
- Each page still loads its own catalog, but without a `locale` route param — use `DEFAULT_LOCALE` instead
- Skip the "Locale Middleware" section (section 4 below)

**Option 3 page example** — each page loads its catalog using the hardcoded locale:

```tsx
// src/app/about/page.tsx (option 3 — no [locale] segment)
import { setI18n } from '@lingui/react/server'
import { Trans } from '@lingui/react/macro'
import { getI18nInstance, loadPageCatalog } from '../appRouterI18n'

const DEFAULT_LOCALE = 'en'

export default async function AboutPage() {
  const i18n = getI18nInstance(DEFAULT_LOCALE)
  const { messages } = require(`./locales/page/${DEFAULT_LOCALE}`)
  loadPageCatalog(i18n, DEFAULT_LOCALE, messages)
  setI18n(i18n)

  return <h1><Trans>About us</Trans></h1>
}
```

---

#### Option 4: Show full impact

List every file under `src/app/` that would need to move under `src/app/[locale]/`, and every file that references these paths (imports, links). Present the list and wait for the user to choose strategy 1, 2, or 3.

### Loading per-page catalogs

Each page's server component must load its own co-located catalog before rendering translated content:

```tsx
// src/app/[locale]/about/page.tsx
import { setI18n } from '@lingui/react/server'
import { Trans } from '@lingui/react/macro'
import { getI18nInstance, loadPageCatalog } from '../../appRouterI18n'

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const i18n = getI18nInstance(locale)
  const { messages } = require(`./locales/page/${locale}`)
  loadPageCatalog(i18n, locale, messages)
  setI18n(i18n)

  return <h1><Trans>About us</Trans></h1>
}
```

Each page must call `loadPageCatalog` and `setI18n` before rendering any translated content. This is more per-page boilerplate than the single-catalog approach, but ensures each page only loads the translations it needs. For layouts that contain translatable strings, the same pattern applies — the layout loads its own catalog.

> **Error handling note:** Unlike the Vite client-side setup, the `require()` call here runs on the server and resolves at build time. If a catalog file is missing, the build fails rather than producing a runtime error. Since `locale` comes from a `[locale]` route segment constrained by `generateStaticParams`, invalid locales cannot reach this code in production. A missing catalog indicates a build or deployment problem that should be fixed, not silently recovered from — so try/catch is not needed here.

### 4. Locale Middleware

**Only needed if the user chose strategy 1 or 2.** If they chose option 3 (hardcoded locale), skip this section entirely.

**File name depends on Next.js major.** On **Next.js 16+**, the file must be named **`proxy.ts`** (the Next 16 rename of `middleware.ts`). On **Next.js 14/15**, keep the name `middleware.ts`. Both files live at the same location with the same contents shown below — only the filename changes. Emitting `middleware.ts` on Next 16 produces a deprecation warning today; the rename is expected to become hard in a later release. Read `next` from the project's `package.json` to determine the major version before creating or editing this file.

**If any of `src/middleware.ts`, `middleware.ts`, `src/proxy.ts`, or `proxy.ts` already exists**: Read the existing file. Do NOT overwrite it, and do NOT create a sibling — `proxy.ts` and `middleware.ts` are the same integration point under different Next.js majors, so a project that already has one must not gain the other. Instead:
- If it already handles locale routing, adapt the locale detection logic to work with Lingui's locale list and move on.
- If it handles other concerns (auth, headers, rewrites), you MUST merge the locale routing into the existing file rather than replacing it. Show the user the merged version and ask for confirmation before writing.
- If the existing file is complex and you cannot safely merge, explain what it does and ask the user to review your proposed merge.
- If the project is on Next 16+ but the existing file is named `middleware.ts`, leave the name alone for now — renaming is a separate concern from locale routing and should not be bundled into this step.

**If no middleware/proxy file exists**, create the file matching the user's Next.js major (`src/proxy.ts` on Next 16+, otherwise `src/middleware.ts`) using the variant for the user's chosen strategy below.

Note: `@lingui/detect-locale` is a client-side library — it's not used in middleware since this runs on the server.

#### Strategy 1 middleware: Unprefixed source locale

Bare paths (`/about`) serve the source locale directly — the middleware rewrites the request internally to `/{sourceLocale}/about` without changing the URL. Prefixed paths (`/fr/about`) pass through unchanged. The user navigates between locales via a language picker that links to prefixed paths.

```ts
// src/middleware.ts (Next 14/15) or src/proxy.ts (Next 16+) — Strategy 1: unprefixed source locale
import { NextRequest, NextResponse } from 'next/server'
import { locales, sourceLocale } from './i18n/locales'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  )

  if (pathnameHasLocale) return

  // Bare path — rewrite to source locale internally, URL stays unchanged
  // /about → serves content from /en/about
  request.nextUrl.pathname = `/${sourceLocale}${pathname}`
  return NextResponse.rewrite(request.nextUrl)
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
}
```

With this strategy, `/about` always shows source locale content. Users switch languages via a language picker that navigates to `/fr/about`, `/de/about`, etc. There is no automatic language detection — each URL maps to exactly one language, which is ideal for SEO and caching.

#### Strategy 2 middleware: All locales prefixed

Every locale has a prefix (`/en/about`, `/fr/about`). Bare paths permanently redirect to the source locale. The 301 status is safe here because the redirect target is always the same (source locale), not detection-based.

```ts
// src/middleware.ts (Next 14/15) or src/proxy.ts (Next 16+) — Strategy 2: all locales prefixed
import { NextRequest, NextResponse } from 'next/server'
import { locales, sourceLocale } from './i18n/locales'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  )

  if (pathnameHasLocale) return

  // Bare path — permanent redirect to source locale prefix
  // /about → 301 → /en/about
  request.nextUrl.pathname = `/${sourceLocale}${pathname}`
  return NextResponse.redirect(request.nextUrl, 301)
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
}
```

The 301 ensures search engines and browsers cache the redirect. Since the target is deterministic (always source locale), this won't cause issues with users who prefer a different language — they navigate to their locale via a language picker that links to `/fr/about`, `/de/about`, etc.

### 5. Link Handling

**Only for Strategy 1 and 2.** If the user chose Option 3, skip this section.

With the `[locale]` directory structure, all internal links must include the locale prefix. Next.js `<Link>` accepts a plain string `href`, so a hook that builds locale-prefixed paths is the cleanest approach — it works for `<Link>`, `<a>`, `router.push()`, and `redirect()`.

#### Locale path hook

Create a client-side hook that reads the current locale from the route params:

```tsx
// src/app/useLocalePath.ts
'use client'

import { useParams } from 'next/navigation'
import { sourceLocale } from '../i18n/locales'

/**
 * Returns a function that prefixes paths with the current locale.
 */
export function useLocalePath() {
  const params = useParams()
  const locale = (params?.locale as string) ?? sourceLocale

  return function localePath(path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path}`
    return `/${locale}${normalized}`
  }
}
```

**Strategy 1 variant** — source locale paths stay bare, non-source get prefixed:

```tsx
export function useLocalePath() {
  const params = useParams()
  const locale = (params?.locale as string) ?? sourceLocale

  return function localePath(path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path}`
    if (locale === sourceLocale) return normalized
    return `/${locale}${normalized}`
  }
}
```

Write the variant that matches the user's chosen strategy.

#### Usage with `<Link>`

```tsx
'use client'

import Link from 'next/link'
import { useLocalePath } from '../useLocalePath'

export function Navigation() {
  const localePath = useLocalePath()

  return (
    <nav>
      <Link href={localePath('/')}>Home</Link>
      <Link href={localePath('/about')}>About</Link>
    </nav>
  )
}
```

#### Programmatic navigation

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useLocalePath } from '../useLocalePath'

export function SearchForm() {
  const router = useRouter()
  const localePath = useLocalePath()

  function onSubmit(query: string) {
    router.push(localePath(`/search?q=${encodeURIComponent(query)}`))
  }
  // ...
}
```

#### Server Components

`useLocalePath()` is a client hook — it cannot be used in Server Components. In Server Components, read `locale` from `params` directly and build paths with template literals:

```tsx
// In a Server Component
const { locale } = await params
// ...
<Link href={`/${locale}/about`}>About</Link>
```

For Strategy 1 in Server Components, conditionally prefix:

```tsx
const href = locale === sourceLocale ? '/about' : `/${locale}/about`
```

#### Existing link migration

Tell the user:

> Existing internal links need updating to include the locale prefix. Search for:
> - `<Link href="/...">` — wrap the href with `localePath()`
> - `<a href="/...">` with internal paths — convert to `<Link>` with `localePath()`, or apply `localePath()` to the href
> - `router.push("/...")` / `router.replace("/...")` — wrap the path with `localePath()`
> - `redirect("/...")` in Server Components — prefix with the `locale` param: `` redirect(`/${locale}/path`) ``
>
> Navigation components (headers, sidebars, footers) are the highest priority since they appear on every page.

### SEO: Alternate Language Tags

Alternate language tags (`hreflang`) tell search engines which locale variants exist for each page, preventing duplicate content issues and helping search engines serve the right locale to each user.

**Only relevant for Strategy 1 and 2.** If the user chose Option 3 (no locale routing), skip this section — there are no locale-specific URLs to declare.

Add `generateMetadata` to the root layout (or to individual page files for page-specific paths):

```tsx
// src/app/[locale]/layout.tsx (add generateMetadata to existing layout)
import type { Metadata } from 'next'
import { locales, sourceLocale } from '../i18n/locales'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

function getLocaleUrl(pathname: string, locale: string) {
  // Strategy 1: source locale unprefixed
  const prefix = locale === sourceLocale ? '' : `/${locale}`
  return `${siteUrl}${prefix}${pathname}`
  // Strategy 2: all prefixed — use `/${locale}${pathname}` for all
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const pathname = '/'  // adjust per page

  return {
    alternates: {
      canonical: getLocaleUrl(pathname, locale),
      languages: Object.fromEntries(
        [...locales.map((l) => [l, getLocaleUrl(pathname, l)]),
         ['x-default', getLocaleUrl(pathname, sourceLocale)]]
      ),
    },
  }
}
```

Notes:

- `NEXT_PUBLIC_SITE_URL` must be set in the environment (e.g., `https://example.com`) — hreflang requires absolute URLs.
- Each page can export its own `generateMetadata` for page-specific paths; the layout version covers the base case.
- If many pages need custom metadata, extract `getLocaleUrl` into `src/i18n/locales.ts` to keep it DRY.

### 6. Language Switcher

**Skip this section if the user chose Option 3 (hardcoded locale).**

Create a client component that renders links to switch between locales. The component reads the current locale from route params and builds links for each configured locale.

#### Strategy 1: Unprefixed source locale

The source locale link points to the bare path (no prefix), while other locales get `/${locale}${basePath}`:

```tsx
// src/app/[locale]/LanguageSwitcher.tsx
'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { locales, sourceLocale } from '../../i18n/locales'

export function LanguageSwitcher() {
  const params = useParams()
  const pathname = usePathname()
  const currentLocale = (params?.locale as string) ?? sourceLocale
  const displayNames = new Intl.DisplayNames([currentLocale], {type: 'language'})

  // Strip locale prefix to get the base path
  let basePath = pathname
  for (const loc of locales) {
    if (pathname.startsWith(`/${loc}/`)) {
      basePath = pathname.slice(loc.length + 1)
      break
    }
    if (pathname === `/${loc}`) {
      basePath = '/'
      break
    }
  }

  return (
    <nav style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
      {locales.map((loc) => (
        <Link
          key={loc}
          href={loc === sourceLocale ? basePath : `/${loc}${basePath}`}
          style={{
            padding: '0.25rem 0.5rem',
            borderRadius: '0.25rem',
            textDecoration: 'none',
            color: 'inherit',
            fontWeight: loc === currentLocale ? 600 : 400,
            backgroundColor: loc === currentLocale ? 'rgba(0, 0, 0, 0.06)' : 'transparent',
          }}
        >
          {displayNames.of(loc) ?? loc}
        </Link>
      ))}
    </nav>
  )
}
```

#### Strategy 2: All locales prefixed

All locale links use the `/${locale}${basePath}` format:

```tsx
// src/app/[locale]/LanguageSwitcher.tsx
'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { locales } from '../../i18n/locales'

export function LanguageSwitcher() {
  const params = useParams()
  const pathname = usePathname()
  const currentLocale = params?.locale as string
  const displayNames = new Intl.DisplayNames([currentLocale], {type: 'language'})

  // Strip locale prefix to get the base path
  let basePath = pathname
  for (const loc of locales) {
    if (pathname.startsWith(`/${loc}/`)) {
      basePath = pathname.slice(loc.length + 1)
      break
    }
    if (pathname === `/${loc}`) {
      basePath = '/'
      break
    }
  }

  return (
    <nav style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
      {locales.map((loc) => (
        <Link
          key={loc}
          href={`/${loc}${basePath}`}
          style={{
            padding: '0.25rem 0.5rem',
            borderRadius: '0.25rem',
            textDecoration: 'none',
            color: 'inherit',
            fontWeight: loc === currentLocale ? 600 : 400,
            backgroundColor: loc === currentLocale ? 'rgba(0, 0, 0, 0.06)' : 'transparent',
          }}
        >
          {displayNames.of(loc) ?? loc}
        </Link>
      ))}
    </nav>
  )
}
```

#### Wiring

Import the switcher into the `[locale]/layout.tsx` so it appears on every page:

```tsx
// In src/app/[locale]/layout.tsx, inside the <body> tag:
import { LanguageSwitcher } from './LanguageSwitcher'

// ...inside the return:
<body>
  <LanguageSwitcher />
  <LinguiClientProvider
    initialLocale={locale}
    initialMessages={i18n.messages}
  >
    {children}
  </LinguiClientProvider>
</body>
```

The `LanguageSwitcher` sits outside the `LinguiClientProvider` because it doesn't use any Lingui macros — it only handles navigation. If the project has a shared header or navigation component, place the switcher there instead.

**Styling**: The examples use inline styles as a baseline. Adapt the styling to match the project's CSS approach (Tailwind, CSS Modules, etc.) and the visual style of the surrounding navigation.

### Using translations in components

Both server and client components can use the same macros:

```tsx
import { Trans, useLingui } from '@lingui/react/macro'

export function MyComponent() {
  const { t } = useLingui()
  return (
    <div>
      <h1><Trans>Welcome</Trans></h1>
      <p>{t`This works in both server and client components`}</p>
    </div>
  )
}
```

In server components, `useLingui` reads the i18n instance set by `setI18n()` in the layout. In client components, it reads from the `I18nProvider` context via `LinguiClientProvider`.

---

## Optional add-ons

If the user selected any optional add-ons in `SKILL.md §1.10` (coding rules `@import`, ESLint plugin, CI/CD integration, test setup wrapper), apply the matching sub-steps from `references/languages/js-ts/libraries/lingui/setup.add-ons.md`. Skip add-ons the user did not select. Skip this section entirely if no add-ons were selected.
