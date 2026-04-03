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

- Does a `[lang]/` or `[locale]/` directory already exist under `src/app/`? If yes, use the existing structure — do not restructure.
- Does `src/middleware.ts` or `middleware.ts` already exist? If yes, read it. Record this — the middleware section below must handle it.

**If no existing locale routing exists, STOP and present this to the user:**

> To support locale-based URL routing in Next.js App Router, all pages need to move under a `[lang]/` dynamic segment. This is a significant structural change:
> - Every URL changes (e.g., `/about` becomes `/en/about`)
> - All internal links and `<Link>` hrefs must include the locale prefix
> - External links, bookmarks, and SEO-indexed URLs break without redirects
> - The root layout moves from `src/app/layout.tsx` to `src/app/[lang]/layout.tsx`
> - New middleware intercepts all requests to add locale prefixes
>
> Options:
> 1. **Proceed with `[lang]` restructuring** — full locale-based URL routing
> 2. **Skip locale routing for now** — set up LinguiJS with a hardcoded locale, no URL changes, add routing later
> 3. **Show me the full impact first** — list every file that would be moved before deciding

**You MUST wait for the user to choose before proceeding. Do NOT default to option 1.**

---

#### Option 1: Full `[lang]` restructuring

Move pages under a `[lang]` dynamic segment:

```
src/app/
  [lang]/
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

```tsx
// src/app/[lang]/layout.tsx
import { setI18n } from '@lingui/react/server'
import { getI18nInstance } from '../appRouterI18n'
import { LinguiClientProvider } from '../LinguiClientProvider'
import { getDirection } from '../getDirection'

const locales = ['en', 'fr']  // adjust to match lingui.config.ts

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export default async function RootLayout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>
  children: React.ReactNode
}) {
  const { lang } = await params
  const direction = getDirection(lang)
  const i18n = getI18nInstance(lang)
  setI18n(i18n)

  return (
    <html lang={lang} dir={direction}>
      <body>
        <LinguiClientProvider
          initialLocale={lang}
          initialMessages={i18n.messages}
        >
          {children}
        </LinguiClientProvider>
      </body>
    </html>
  )
}
```

Note: `params` is `Promise<{ lang: string }>` in Next.js 15+. For Next.js 13-14, use `params: { lang: string }` directly (no `await`).

---

#### Option 2: Skip locale routing (hardcoded locale)

This approach adds LinguiJS without changing the URL structure. The app uses a single hardcoded locale. Locale routing can be added later by restructuring to option 1.

Modify the existing `src/app/layout.tsx` in place — do not move it:

```tsx
// src/app/layout.tsx (modified — no [lang] restructuring)
import { setI18n } from '@lingui/react/server'
import { getI18nInstance } from './appRouterI18n'
import { LinguiClientProvider } from './LinguiClientProvider'

// To add locale-based URL routing later, restructure pages under [lang]/
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
- Each page still loads its own catalog, but without a `lang` route param — use `DEFAULT_LOCALE` instead
- Skip the "Locale Middleware" section (section 4 below)

**Option 2 page example** — each page loads its catalog using the hardcoded locale:

```tsx
// src/app/about/page.tsx (option 2 — no [lang] segment)
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

#### Option 3: Show full impact

List every file under `src/app/` that would need to move under `src/app/[lang]/`, and every file that references these paths (imports, links). Present the list and wait for the user to choose option 1 or option 2.

### Loading per-page catalogs

Each page's server component must load its own co-located catalog before rendering translated content:

```tsx
// src/app/[lang]/about/page.tsx
import { setI18n } from '@lingui/react/server'
import { Trans } from '@lingui/react/macro'
import { getI18nInstance, loadPageCatalog } from '../../appRouterI18n'

export default async function AboutPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const i18n = getI18nInstance(lang)
  const { messages } = require(`./locales/page/${lang}`)
  loadPageCatalog(i18n, lang, messages)
  setI18n(i18n)

  return <h1><Trans>About us</Trans></h1>
}
```

Each page must call `loadPageCatalog` and `setI18n` before rendering any translated content. This is more per-page boilerplate than the single-catalog approach, but ensures each page only loads the translations it needs. For layouts that contain translatable strings, the same pattern applies — the layout loads its own catalog.

> **Error handling note:** Unlike the Vite client-side setup, the `require()` call here runs on the server and resolves at build time. If a catalog file is missing, the build fails rather than producing a runtime error. Since `lang` comes from a `[lang]` route segment constrained by `generateStaticParams`, invalid locales cannot reach this code in production. A missing catalog indicates a build or deployment problem that should be fixed, not silently recovered from — so try/catch is not needed here.

### 4. Locale Middleware

**Only needed if the user chose option 1 (full `[lang]` restructuring).** If they chose option 2 (hardcoded locale), skip this section entirely.

**If `src/middleware.ts` or `middleware.ts` already exists:** Read the existing middleware. Do NOT overwrite it. Instead:
- If it already handles locale routing, adapt the locale detection logic to work with Lingui's locale list and move on.
- If it handles other concerns (auth, headers, rewrites), you MUST merge the locale routing into the existing middleware rather than replacing it. Show the user the merged version and ask for confirmation before writing.
- If the middleware is complex and you cannot safely merge, explain what it does and ask the user to review your proposed merge.

**If no middleware exists**, create middleware to redirect bare paths to locale-prefixed paths. The middleware parses the `Accept-Language` header with quality values and tries regional fallback (e.g., `es-MX` → `es`) before falling back to the default locale. A `lang` cookie persists the user's explicit language choice (e.g., from a language picker) so it takes priority over browser settings.

Note: `@lingui/detect-locale` is a client-side library — it's not used in middleware since this runs on the server. The cookie serves the same persistence purpose as `localStorage` in the Vite setup.

```ts
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'

const locales = ['en', 'fr']  // adjust to match lingui.config.ts
const defaultLocale = 'en'

function resolveLocaleTag(tag: string): string | undefined {
  if (locales.includes(tag)) return tag
  const base = tag.split('-')[0]
  if (locales.includes(base)) return base
  return undefined
}

function resolveAcceptLanguage(header: string): string {
  const entries = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=')
      return { tag: tag.trim(), quality: q ? parseFloat(q) : 1.0 }
    })
    .sort((a, b) => b.quality - a.quality)

  for (const { tag } of entries) {
    const resolved = resolveLocaleTag(tag)
    if (resolved) return resolved
  }

  return defaultLocale
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  )

  if (pathnameHasLocale) return

  // Cookie from explicit user choice takes priority over browser settings
  const cookieLocale = request.cookies.get('lang')?.value
  const resolvedCookie = cookieLocale ? resolveLocaleTag(cookieLocale) : undefined
  const detectedLocale =
    resolvedCookie ?? resolveAcceptLanguage(request.headers.get('accept-language') ?? '')

  request.nextUrl.pathname = `/${detectedLocale}${pathname}`
  return NextResponse.redirect(request.nextUrl)
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
}
```

To persist the user's language choice, set the `lang` cookie from a client component when the user switches locale (e.g., via a language picker): `document.cookie = 'lang=' + locale + ';path=/;max-age=31536000'`.

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
