# Next.js App Router

This covers Next.js 13+ projects using the App Router with React Server Components. The setup is simpler than some i18n libraries because next-intl has first-class App Router support — no separate compiler plugin needed.

> **Catalog format note:** the code samples below use `.json` message imports. If the user chose **PO** as the catalog format in the main SKILL.md, substitute the `.json` imports and file scaffolds with their `.po` equivalents from `catalog-format-po.md`. The rest of the App Router setup (routing, middleware, provider wiring, `[locale]` layout) is format-independent.

## Packages

Only one package is required:

| Package | Type | Purpose |
|---------|------|---------|
| `next-intl` | runtime | Full i18n: translations, formatting, routing, navigation |

Unlike LinguiJS (which requires `@lingui/swc-plugin` separately), next-intl bundles everything — routing, middleware, server/client APIs — in a single package.

The main SKILL.md (Step 2) determines which next-intl version to install based on the detected Next.js version. Use the install command it selects.

**Example (npm):**

```bash
npm install next-intl
```

**Example (pnpm):**

```bash
pnpm add next-intl
```

**Example (yarn):**

```bash
yarn add next-intl
```

**Example (bun):**

```bash
bun add next-intl
```

## Step 3: Routing Configuration

**CONSENT GATE: Present locale prefix strategy choice before proceeding.**

Ask the user for:
1. Their list of locales (e.g., `['en', 'de', 'fr']`)
2. Their default/source locale (e.g., `'en'`)
3. Their preferred locale prefix strategy (see options below)

Create `src/i18n/routing.ts` (or `i18n/routing.ts` if the project does not use a `src/` directory):

```ts
import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  // All locales the application supports
  locales: ['en', 'de'],

  // The locale used when no locale matches
  defaultLocale: 'en',

  // Locale prefix strategy (see options below)
  localePrefix: 'as-needed'
});
```

### Routing options

#### `locales` (required)

Array of all locale strings the application supports. These must match the message file names in `messages/`.

```ts
locales: ['en', 'de', 'fr', 'ja']
```

#### `defaultLocale` (required)

The source/fallback locale. Used when no locale matches the request.

```ts
defaultLocale: 'en'
```

#### `localePrefix` (required)

Controls how locale prefixes appear in URLs. Present these options to the user:

1. **`'as-needed'`** (recommended) -- Default locale has no prefix (`/about`), other locales are prefixed (`/de/about`). Best for SEO when the source language dominates traffic.

2. **`'always'`** -- All locales get a prefix (`/en/about`, `/de/about`). Clean and consistent, every URL clearly signals its locale.

3. **`'never'`** -- No prefixes at all; locale determined by domain, cookie, or other means. Requires custom domain setup outside this skill's scope. Mention only; do not recommend unless the user specifically asks.

```ts
// Option 1: as-needed (recommended)
localePrefix: 'as-needed'

// Option 2: always
localePrefix: 'always'

// Option 3: never
localePrefix: 'never'
```

**Wait for the user to choose before proceeding.**

#### `pathnames` (optional)

Map internal paths to localized external paths. Useful for translating URL slugs:

```ts
import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'de'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',

  pathnames: {
    '/': '/',
    '/about': {
      de: '/ueber-uns'
    },
    '/blog/[slug]': {
      de: '/blog/[slug]'
    }
  }
});
```

With this config, `/ueber-uns` in the German locale maps to the same page as `/about` in English. Dynamic segments like `[slug]` are preserved across locales.

#### `localeDetection` (optional)

By default, the middleware detects the user's preferred locale from the `Accept-Language` header and sets a cookie. To disable automatic detection:

```ts
localeDetection: false
```

This is useful when you want full control over locale selection (e.g., only via explicit URL navigation or a language picker).

## Step 4: Request Configuration

Create `src/i18n/request.ts` (or `i18n/request.ts` if no `src/` directory):

```ts
import {getRequestConfig} from 'next-intl/server';
import {hasLocale} from 'next-intl';
import {routing} from './routing';

export default getRequestConfig(async ({requestLocale}) => {
  // This typically corresponds to the `[locale]` segment
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});
```

This file runs on every request and provides the locale and messages to all Server Components.

**Custom path note:** The next-intl plugin expects this file at `./i18n/request.ts` by default (relative to the project root). If the file is at a different location (e.g., `./src/i18n/request.ts` in a project with a `src/` directory), you may need to pass the custom path to the plugin:

```ts
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
```

Check the project structure — if the project uses `src/`, pass the full path. If `i18n/request.ts` is at the project root, the default works.

## Step 5: Next.js Plugin

**CONSENT GATE: This modifies `next.config.*`. Show the exact change before applying.**

Wrap the existing Next.js config with `createNextIntlPlugin()`.

**For `next.config.ts` (TypeScript):**

```ts
import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // existing config options preserved
};

export default withNextIntl(nextConfig);
```

**For `next.config.mjs` (ESM):**

```js
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // existing config options preserved
};

export default withNextIntl(nextConfig);
```

**For `next.config.js` (CommonJS):**

```js
const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // existing config options preserved
};

module.exports = withNextIntl(nextConfig);
```

### Composing with other plugins

If the project already uses other Next.js plugins (e.g., `@next/bundle-analyzer`, `next-pwa`), wrap them in sequence:

```ts
import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import bundleAnalyzer from '@next/bundle-analyzer';

const withNextIntl = createNextIntlPlugin();
const withBundleAnalyzer = bundleAnalyzer({enabled: process.env.ANALYZE === 'true'});

const nextConfig: NextConfig = {
  // existing config
};

export default withBundleAnalyzer(withNextIntl(nextConfig));
```

The innermost wrapper (`withNextIntl`) should wrap the config object directly. Outer wrappers compose around it.

## Step 6: Middleware

Create `src/middleware.ts` (or `middleware.ts` at the project root if the project does not use `src/`):

```ts
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except:
  // - /api, /trpc routes
  // - /_next (Next.js internals)
  // - /_vercel (Vercel internals)
  // - files with extensions (e.g., favicon.ico, images)
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)'
};
```

The middleware handles:
- Detecting the user's locale from the URL path, cookie, or `Accept-Language` header
- Redirecting or rewriting requests based on the `localePrefix` strategy
- Setting the `NEXT_LOCALE` cookie for subsequent requests

### Composing with existing middleware

**If `middleware.ts` already exists**, do NOT overwrite it. This is a **CONSENT GATE**.

Read the existing middleware, then show the user the proposed composition. The pattern depends on what the existing middleware does:

**Pattern: Wrapping existing logic**

```ts
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';
import {NextRequest} from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // Existing middleware logic (e.g., auth checks)
  // ...

  // Then handle i18n routing
  return intlMiddleware(request);
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)'
};
```

**Pattern: Conditional routing (e.g., with auth)**

```ts
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';
import {NextRequest, NextResponse} from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const {pathname} = request.nextUrl;

  // Auth-protected routes — check auth first
  if (pathname.startsWith('/dashboard')) {
    const token = request.cookies.get('auth-token');
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // All routes — handle i18n
  return intlMiddleware(request);
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)'
};
```

Show the user the exact merged version and ask for confirmation before writing.

## Step 7: Provider and Layout

The App Router uses a two-layout pattern: a root layout for the `<html>` tag and provider, and a locale layout for locale validation and static rendering.

### Root layout: `app/layout.tsx`

The root layout provides the `<html>` tag with the dynamic `lang` attribute and wraps all children with `NextIntlClientProvider`. This ensures every route — including root-level routes like `not-found.tsx` and `error.tsx` that live outside `[locale]` — has access to translations.

```tsx
import {NextIntlClientProvider} from 'next-intl';
import {getLocale, getMessages} from 'next-intl/server';

type Props = {
  children: React.ReactNode;
};

export default async function RootLayout({children}: Props) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

**`<html lang>` migration:** Before rewriting the layout, read the existing `app/layout.tsx` and note the current `<html lang="...">` value. Tell the user: "Your layout currently has `<html lang="X">`. This will become `<html lang={locale}>` where `locale` is determined dynamically by next-intl." If the existing value differs from the configured `defaultLocale`, flag it.

**RTL support:** For applications supporting RTL locales (Arabic, Hebrew, Farsi, etc.), add a `dir` attribute:

```tsx
import {NextIntlClientProvider} from 'next-intl';
import {getLocale, getMessages} from 'next-intl/server';

const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi']);

function getDirection(locale: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale.split('-')[0]) ? 'rtl' : 'ltr';
}

export default async function RootLayout({children}: {children: React.ReactNode}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} dir={getDirection(locale)}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

### Locale layout: `app/[locale]/layout.tsx`

The locale layout validates the locale parameter, enables static rendering, and provides `NextIntlClientProvider` with the correct locale. The root layout above has a provider too (for root-level routes like `not-found.tsx`), but this inner provider takes precedence via React context and supplies the accurate locale from the URL:

```tsx
import {NextIntlClientProvider, hasLocale} from 'next-intl';
import {getMessages, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {routing} from '@/i18n/routing';

type Props = {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
};

export default async function LocaleLayout({children, params}: Props) {
  const {locale} = await params;

  // Validate the locale
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
```

Note: `params` is `Promise<{locale: string}>` in Next.js 15+. For Next.js 13-14, use `params: {locale: string}` directly (no `await`).

### Static generation with `generateStaticParams`

Add `generateStaticParams` to the locale layout so Next.js pre-renders all locale variants at build time:

```tsx
import {routing} from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}
```

This goes in `app/[locale]/layout.tsx` alongside the layout component. Without it, locale pages are only rendered on-demand.

## Step 9: Directory Restructure

**CONSENT GATE: This moves existing files. Show the full plan and ask for confirmation.**

For App Router with locale prefix routing (`localePrefix: 'as-needed'` or `'always'`), pages must live under an `app/[locale]/` dynamic segment.

### Before/after directory structure

**Before:**

```
app/
  layout.tsx          <-- root layout with <html> tag
  page.tsx            <-- home page
  about/
    page.tsx          <-- about page
  dashboard/
    page.tsx          <-- dashboard page
    settings/
      page.tsx        <-- settings page
```

**After:**

```
app/
  layout.tsx          <-- root layout (html tag only, dynamic lang)
  [locale]/
    layout.tsx        <-- locale layout (NextIntlClientProvider)
    page.tsx          <-- home page (moved from app/page.tsx)
    about/
      page.tsx        <-- about page (moved from app/about/page.tsx)
    dashboard/
      page.tsx        <-- dashboard page (moved)
      settings/
        page.tsx      <-- settings page (moved)
messages/
  en.json             <-- message files (new)
  de.json
```

### File move plan

Present the exact moves to the user:

1. `app/page.tsx` --> `app/[locale]/page.tsx`
2. `app/about/page.tsx` --> `app/[locale]/about/page.tsx`
3. `app/dashboard/page.tsx` --> `app/[locale]/dashboard/page.tsx`
4. (repeat for all page routes)
5. `app/layout.tsx` --> **keep in place** but rewrite to root layout (html tag only)
6. **Create** `app/[locale]/layout.tsx` (locale layout with provider)

**Important:** Only move page routes. Do not move:
- `app/api/` routes (API routes stay at the root)
- `app/not-found.tsx` (stays at root level)
- `app/error.tsx` (stays at root level)
- `app/loading.tsx` at root level (but loading.tsx inside route groups should move)

**If the project uses route groups** (e.g., `app/(marketing)/about/page.tsx`), the group moves under `[locale]`:
- `app/(marketing)/about/page.tsx` --> `app/[locale]/(marketing)/about/page.tsx`

Show the user the full list of moves and **wait for confirmation before executing**.

### With `localePrefix: 'never'`

If the user chose `localePrefix: 'never'`, the `[locale]` segment is not needed. Pages stay in their current locations. The provider is added to the existing root layout directly:

```tsx
// app/layout.tsx (no [locale] restructuring)
import {NextIntlClientProvider} from 'next-intl';
import {getLocale, getMessages} from 'next-intl/server';

export default async function RootLayout({children}: {children: React.ReactNode}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

With this approach:
- No files are moved
- No URLs change
- No `[locale]` directory is created
- Locale is determined by domain, cookie, or other means configured outside the app

## Step 10: Navigation

Create `src/i18n/navigation.ts` (or `i18n/navigation.ts` if no `src/` directory):

```ts
import {createNavigation} from 'next-intl/navigation';
import {routing} from './routing';

// Lightweight wrappers around Next.js navigation APIs
// that automatically consider the routing configuration
export const {Link, redirect, usePathname, useRouter, getPathname} =
  createNavigation(routing);
```

These exports are locale-aware drop-in replacements for their Next.js counterparts.

### Migration: Replace Next.js navigation imports

Search the codebase for Next.js navigation imports and replace them with the locale-aware versions:

**`Link` component:**

```tsx
// Before
import Link from 'next/link';
<Link href="/about">About</Link>

// After
import {Link} from '@/i18n/navigation';
<Link href="/about">About</Link>
```

The locale-aware `Link` automatically prefixes the href with the current locale when needed. No manual prefix required.

**`useRouter` hook:**

```tsx
// Before
import {useRouter} from 'next/navigation';
const router = useRouter();
router.push('/dashboard');

// After
import {useRouter} from '@/i18n/navigation';
const router = useRouter();
router.push('/dashboard');  // automatically includes locale
```

**`usePathname` hook:**

```tsx
// Before
import {usePathname} from 'next/navigation';
const pathname = usePathname();  // returns '/de/about'

// After
import {usePathname} from '@/i18n/navigation';
const pathname = usePathname();  // returns '/about' (locale stripped)
```

The locale-aware `usePathname` returns the path without the locale prefix, making it easier to compare paths across locales.

**`redirect` function:**

```tsx
// Before
import {redirect} from 'next/navigation';
redirect('/dashboard');

// After
import {redirect} from '@/i18n/navigation';
redirect('/dashboard');  // automatically includes locale
```

**`getPathname` for server-side URL generation:**

```tsx
import {getPathname} from '@/i18n/navigation';

// Generate a locale-specific URL on the server
const path = getPathname({
  href: '/about',
  locale: 'de'
});
// Returns '/de/about' (or '/ueber-uns' if pathnames are configured)
```

This is useful for generating URLs in Server Components, metadata, sitemaps, and `og:url` tags.

### Navigation with localized pathnames

If `pathnames` are configured in `routing.ts`, the navigation APIs automatically resolve localized paths:

```tsx
import {Link} from '@/i18n/navigation';

// With pathnames: { '/about': { de: '/ueber-uns' } }
<Link href="/about">About</Link>
// English: renders href="/about"
// German: renders href="/de/ueber-uns"
```

No changes needed in component code — the routing configuration handles the mapping.

## SEO: Alternate Language Tags

hreflang tags tell search engines which locale variants exist for each page, preventing duplicate content issues across localized URLs.

```tsx
// app/[locale]/layout.tsx (add generateMetadata to existing layout)
import type { Metadata } from 'next'
import { routing } from '@/i18n/routing'
import { getPathname } from '@/i18n/navigation'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

function getUrl(pathname: string, locale: string) {
  return `${siteUrl}${getPathname({href: pathname, locale})}`
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
      canonical: getUrl(pathname, locale),
      languages: Object.fromEntries(
        [...routing.locales.map((l) => [l, getUrl(pathname, l)]),
         ['x-default', getUrl(pathname, routing.defaultLocale)]]
      ),
    },
  }
}
```

- `NEXT_PUBLIC_SITE_URL` must be set in the environment (e.g., `https://example.com`) — hreflang requires absolute URLs
- Each page can export its own `generateMetadata` for page-specific paths; the layout version covers the base case
- If `pathnames` are configured in `routing.ts`, `getPathname` automatically resolves localized URL slugs in the hreflang output

## Using Translations

Quick reference for using translations after setup is complete.

### Server Components

Use `getTranslations` from `next-intl/server` (async, must be awaited):

```tsx
import {getTranslations} from 'next-intl/server';

export default async function HomePage() {
  const t = await getTranslations('HomePage');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('welcome', {name: 'World'})}</p>
    </div>
  );
}
```

### Client Components

Use `useTranslations` from `next-intl` (synchronous hook):

```tsx
'use client';

import {useTranslations} from 'next-intl';

export default function Counter() {
  const t = useTranslations('Counter');

  return (
    <div>
      <h1>{t('title')}</h1>
      <button>{t('increment')}</button>
    </div>
  );
}
```

### Common patterns

**Interpolation:**

```json
{"greeting": "Hello, {name}!"}
```

```tsx
t('greeting', {name: 'Alice'})
```

**Plurals (ICU MessageFormat):**

```json
{"items": "You have {count, plural, one {# item} other {# items}}"}
```

```tsx
t('items', {count: 3})
```

**Rich text (HTML-like tags in messages):**

```json
{"terms": "By signing up you agree to our <link>terms</link>."}
```

```tsx
t.rich('terms', {
  link: (chunks) => <a href="/terms">{chunks}</a>
})
```

### Formatting

Use `useFormatter` (client) or `getFormatter` (server) for dates, numbers, and relative time:

```tsx
import {useFormatter} from 'next-intl';

function PriceDisplay({price}: {price: number}) {
  const format = useFormatter();

  return (
    <span>
      {format.number(price, {style: 'currency', currency: 'EUR'})}
    </span>
  );
}
```

```tsx
import {getFormatter} from 'next-intl/server';

export default async function DateDisplay() {
  const format = await getFormatter();

  return (
    <time>{format.dateTime(new Date(), {dateStyle: 'medium'})}</time>
  );
}
```

### Server vs Client import reference

| API | Server (RSC) | Client |
|-----|-------------|--------|
| Translations | `getTranslations` from `next-intl/server` | `useTranslations` from `next-intl` |
| Formatting | `getFormatter` from `next-intl/server` | `useFormatter` from `next-intl` |
| Locale | `getLocale` from `next-intl/server` | `useLocale` from `next-intl` |
| Now | `getNow` from `next-intl/server` | `useNow` from `next-intl` |
| Timezone | `getTimeZone` from `next-intl/server` | `useTimeZone` from `next-intl` |

## Step 11: Language Switcher

Create a client component that switches between locales using the navigation helpers from Step 10.

**Component**: Create `src/components/LanguageSwitcher.tsx` (or `components/LanguageSwitcher.tsx` if the project does not use `src/`):

```tsx
'use client';

import {useLocale} from 'next-intl';
import {usePathname, useRouter} from '@/i18n/navigation';
import {routing} from '@/i18n/routing';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const displayNames = new Intl.DisplayNames([locale], {type: 'language'});

  function onSelectChange(event: React.ChangeEvent<HTMLSelectElement>) {
    router.replace(pathname, {locale: event.target.value});
  }

  return (
    <select
      value={locale}
      onChange={onSelectChange}
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
      {routing.locales.map((loc) => (
        <option key={loc} value={loc}>
          {displayNames.of(loc) ?? loc}
        </option>
      ))}
    </select>
  );
}
```

This uses `router.replace()` instead of `router.push()` so the locale switch doesn't add a history entry — pressing "back" doesn't cycle through locales.

**Key points:**
- `useLocale()` from `next-intl` returns the current locale string
- `usePathname()` from `@/i18n/navigation` returns the path **without** the locale prefix, so it works correctly across locales
- `useRouter()` from `@/i18n/navigation` handles locale-prefixed routing automatically
- `routing.locales` is the single source of truth for the locale list — no hardcoded arrays
- `Intl.DisplayNames` renders locale names in the user's current language (e.g. "Deutsch" when viewing in German)

**Styling**: The example uses inline styles as a baseline. Adapt the styling to match the project's CSS approach (Tailwind, CSS Modules, etc.) and the visual style of the surrounding navigation.

**Wiring**: Import into the locale layout or a shared navigation component. The switcher must be inside the `NextIntlClientProvider` tree (it uses client-side hooks).

In `app/[locale]/layout.tsx`:

```tsx
import LanguageSwitcher from '@/components/LanguageSwitcher';

// Inside the return:
<NextIntlClientProvider messages={messages}>
  <LanguageSwitcher />
  {children}
</NextIntlClientProvider>
```

Or in a shared header/navigation component if one exists.
