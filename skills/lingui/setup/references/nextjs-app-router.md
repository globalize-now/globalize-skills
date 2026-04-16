# Next.js App Router Setup

This covers Next.js 13+ projects using the App Router with React Server Components (RSC). The setup is more involved than standard React because RSC can't use React context — LinguiJS provides a server-side `setI18n` API alongside a client-side provider.

## Packages

In addition to the core packages from Step 2, install:

| Package | Type | Purpose |
|---------|------|---------|
| `@lingui/swc-plugin` | dev | SWC macro transform (Next.js uses SWC by default) |

If the project has a `.babelrc`, use `@lingui/babel-plugin-lingui-macro` instead.

**Example (npm):**

```bash
npm install @lingui/core @lingui/react @lingui/macro
npm install -D @lingui/cli @lingui/swc-plugin
```

**Version pinning:** `@lingui/swc-plugin` must match the `swc_core` version shipped by the project's Next.js version. Installing without a version specifier grabs the latest, which may not be compatible. Look up the correct version at https://plugins.swc.rs (select "next" + the project's Next.js version), then pin it exactly — e.g. `npm install -D @lingui/swc-plugin@4.0.8`. See "SWC plugin version mismatch" in Common Gotchas if the build fails with an AST schema error.

Note: No `@lingui/vite-plugin` — Next.js has its own build pipeline.

## Build Tool Integration (Step 4)

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

## Provider Setup (Step 5)

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
- Does `src/middleware.ts` or `middleware.ts` already exist? If yes, read it. Record this — the middleware section below must handle it.

**If no existing locale routing exists, STOP and present this to the user:**

> To support multiple locales in Next.js App Router, pages move under a `[locale]/` dynamic segment. This is a significant structural change:
> - The root layout moves from `src/app/layout.tsx` to `src/app/[locale]/layout.tsx`
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
  [locale]/
    layout.tsx              ← root layout (was src/app/layout.tsx)
    page.tsx                ← home page (was src/app/page.tsx)
    locales/page/           ← catalog for the home page (generated by extract)
      en.po
      fr.po
    about/
      page.tsx
      locales/page/         ← catalog for the about page
        en.po
        fr.po
  appRouterI18n.ts
  LinguiClientProvider.tsx
```

The `locales/` directories are generated by `lingui extract-experimental` — they appear co-located next to each page file.

The root layout creates the i18n instance and sets it. With per-page catalogs, the layout does **not** load any catalog itself — each page loads its own:

Create a direction helper used by the root layout:

```ts
// src/app/getDirection.ts
const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi'])

export function getDirection(locale: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale.split('-')[0]) ? 'rtl' : 'ltr'
}
```

**`<html lang>` migration:** Before rewriting the layout, read the existing `src/app/layout.tsx` and note the current `<html lang="...">` value. Tell the user: "Your layout currently has `<html lang="X">`. This will become `<html lang={locale} dir={direction}>` where `locale` comes from the `[locale]` route parameter." If the existing value differs from `sourceLocale` in `lingui.config.ts`, flag it — the source locale config may need updating to match.

```tsx
// src/app/[locale]/layout.tsx
import { setI18n } from '@lingui/react/server'
import { getI18nInstance } from '../appRouterI18n'
import { LinguiClientProvider } from '../LinguiClientProvider'
import { getDirection } from '../getDirection'
import { locales } from '../i18n/locales'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function RootLayout({
  params,
  children,
}: {
  params: Promise<{ locale: string }>
  children: React.ReactNode
}) {
  const { locale } = await params
  const direction = getDirection(locale)
  const i18n = getI18nInstance(locale)
  setI18n(i18n)

  return (
    <html lang={locale} dir={direction}>
      <body>
        <LinguiClientProvider
          initialLocale={locale}
          initialMessages={i18n.messages}
        >
          {children}
        </LinguiClientProvider>
      </body>
    </html>
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

**If `src/middleware.ts` or `middleware.ts` already exists:** Read the existing middleware. Do NOT overwrite it. Instead:
- If it already handles locale routing, adapt the locale detection logic to work with Lingui's locale list and move on.
- If it handles other concerns (auth, headers, rewrites), you MUST merge the locale routing into the existing middleware rather than replacing it. Show the user the merged version and ask for confirmation before writing.
- If the middleware is complex and you cannot safely merge, explain what it does and ask the user to review your proposed merge.

**If no middleware exists**, create the middleware variant that matches the user's chosen strategy.

Note: `@lingui/detect-locale` is a client-side library — it's not used in middleware since this runs on the server.

#### Strategy 1 middleware: Unprefixed source locale

Bare paths (`/about`) serve the source locale directly — the middleware rewrites the request internally to `/{sourceLocale}/about` without changing the URL. Prefixed paths (`/fr/about`) pass through unchanged. The user navigates between locales via a language picker that links to prefixed paths.

```ts
// src/middleware.ts — Strategy 1: unprefixed source locale
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
// src/middleware.ts — Strategy 2: all locales prefixed
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
    <div style={{display: 'flex', gap: '8px'}}>
      {locales.map((loc) => (
        <Link
          key={loc}
          href={loc === sourceLocale ? basePath : `/${loc}${basePath}`}
          style={{fontWeight: loc === currentLocale ? 'bold' : 'normal'}}
        >
          {loc}
        </Link>
      ))}
    </div>
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
    <div style={{display: 'flex', gap: '8px'}}>
      {locales.map((loc) => (
        <Link
          key={loc}
          href={`/${loc}${basePath}`}
          style={{fontWeight: loc === currentLocale ? 'bold' : 'normal'}}
        >
          {loc}
        </Link>
      ))}
    </div>
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

**Displaying locale names**: The examples above render raw locale codes (`en`, `fr`). For a better user experience, use `Intl.DisplayNames` to show locale names in the user's language:

```tsx
const displayNames = new Intl.DisplayNames([currentLocale], {type: 'language'});

// In the Link:
{displayNames.of(loc) ?? loc}
```

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
