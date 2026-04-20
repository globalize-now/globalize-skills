# Next.js Pages Router

This covers Next.js projects using the Pages Router (`pages/` directory, `_app.tsx`). The setup is simpler than the App Router variant — no middleware, no `[locale]` directory restructuring, and no server/client component distinction.

> **Catalog format note:** the code samples below use `.json` message imports (including the shared `getMessages` helper and the namespace-filtered variant). If the user chose **PO** as the catalog format in the main SKILL.md, swap `.json` for `.po` in every `import(`../../messages/${locale}.json`)` expression and use the seed file format from `catalog-format-po.md`. The rest of the Pages Router setup (i18n config, provider, `getStaticProps` pattern) is format-independent.

## Packages

Only one package is required:

| Package | Type | Purpose |
|---------|------|---------|
| `next-intl` | runtime | Full i18n: translations, formatting, provider |

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

Create `src/i18n/routing.ts` (or `i18n/routing.ts` if the project does not use a `src/` directory):

```ts
import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'de'],
  defaultLocale: 'en'
});
```

This file centralizes the locale definitions. The actual locale routing is handled by Next.js built-in `i18n` config in `next.config.js` (configured in Step 5), not by next-intl middleware. This file is still useful as a single source of truth for the locale list, which other parts of the code can import.

**Note:** The `localePrefix` option from the main SKILL.md Step 3 does not apply to Pages Router. Pages Router uses the built-in `i18n` config for routing, which always uses prefix-based routing (e.g., `/de/about`). The default locale can be unprefixed via the `i18n.localeDetection` option in `next.config.js`.

Ask the user for their locale list and default locale at this step.

## Steps 4 and 6: Skipped

Pages Router does not use `request.ts` -- messages are loaded via `getStaticProps` in each page (see "Message Loading" section below).

Pages Router does not use middleware for locale routing -- locale routing is handled by the built-in `i18n` config in `next.config.js`, which Next.js processes automatically. The `i18n` config is set up in Step 5 alongside the next-intl plugin.

## Step 5: Next.js Config

**CONSENT GATE: This modifies `next.config.*`. Show the exact change before applying.**

Wrap the existing config with `createNextIntlPlugin()` and add the `i18n` key for Pages Router locale routing.

**For `next.config.js` (CommonJS):**

```js
const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  i18n: {
    locales: ['en', 'de'],
    defaultLocale: 'en',
  },
  // existing config options preserved
};

module.exports = withNextIntl(nextConfig);
```

**For `next.config.mjs` (ESM):**

```js
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  i18n: {
    locales: ['en', 'de'],
    defaultLocale: 'en',
  },
  // existing config options preserved
};

export default withNextIntl(nextConfig);
```

**For `next.config.ts` (TypeScript):**

```ts
import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  i18n: {
    locales: ['en', 'de'],
    defaultLocale: 'en',
  },
  // existing config options preserved
};

export default withNextIntl(nextConfig);
```

The `i18n` key tells Next.js to:
- Recognize locale prefixes in URLs (`/de/about`, `/en/about`)
- Provide `locale` to `getStaticProps`, `getServerSideProps`, and `useRouter`
- Set the `<html lang>` attribute automatically
- Redirect bare paths (`/about`) based on the `Accept-Language` header or cookie

### Composing with other plugins

If the project already uses other plugins, wrap them in sequence:

```js
const createNextIntlPlugin = require('next-intl/plugin');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const withNextIntl = createNextIntlPlugin();

const nextConfig = {
  i18n: {
    locales: ['en', 'de'],
    defaultLocale: 'en',
  },
};

module.exports = withBundleAnalyzer(withNextIntl(nextConfig));
```

## Step 7: Provider in `_app.tsx`

**CONSENT GATE: This modifies `_app.tsx`. Show the exact change before applying.**

Wrap the application with `NextIntlClientProvider` in `pages/_app.tsx`:

```tsx
import {NextIntlClientProvider} from 'next-intl';
import type {AppProps} from 'next/app';
import {useRouter} from 'next/router';

export default function App({Component, pageProps}: AppProps) {
  const router = useRouter();

  return (
    <NextIntlClientProvider
      locale={router.locale}
      timeZone="UTC" // optional: set your project's default timezone
      messages={pageProps.messages}
    >
      <Component {...pageProps} />
    </NextIntlClientProvider>
  );
}
```

### Provider props

- **`locale`** -- The current locale from `useRouter().locale`. Next.js sets this automatically based on the URL prefix and `i18n` config.
- **`timeZone`** -- A default timezone for date/time formatting. Ask the user for their preferred timezone, or omit to use the browser's timezone.
- **`messages`** -- Translation messages loaded from `getStaticProps` (see Message Loading below). Each page passes its messages through `pageProps`.

### `<html lang>` attribute

When the `i18n` config is set in `next.config.js`, Next.js automatically sets the `<html lang>` attribute to the current locale. No manual `<html lang>` setup is needed for Pages Router.

If the project has a custom `pages/_document.tsx` with a hardcoded `<Html lang="en">`, remove the hardcoded value:

```tsx
// Before
import {Html, Head, Main, NextScript} from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      {/* ... */}
    </Html>
  );
}

// After -- let Next.js set lang automatically
import {Html, Head, Main, NextScript} from 'next/document';

export default function Document() {
  return (
    <Html>
      {/* ... */}
    </Html>
  );
}
```

## Message Loading

Each page that uses translations must load messages via `getStaticProps` (or `getServerSideProps`):

```tsx
export async function getStaticProps({locale}: {locale: string}) {
  return {
    props: {
      messages: (await import(`../../messages/${locale}.json`)).default
    }
  };
}
```

**Important:** Every page that uses translations needs this. Pages without `getStaticProps` returning `messages` will not have messages available, and `useTranslations` calls will fail.

### Shared helper to reduce boilerplate

Create a shared helper so every page does not repeat the import logic:

```ts
// lib/getMessages.ts
export async function getMessages(locale: string) {
  return (await import(`../messages/${locale}.json`)).default;
}
```

Then use it in pages:

```tsx
import {getMessages} from '@/lib/getMessages';

export async function getStaticProps({locale}: {locale: string}) {
  return {
    props: {
      messages: await getMessages(locale)
    }
  };
}
```

### Loading specific namespaces

To reduce bundle size, load only the namespaces a page needs:

```ts
// lib/getMessages.ts
export async function getMessages(locale: string, namespaces?: string[]) {
  const allMessages = (await import(`../messages/${locale}.json`)).default;

  if (!namespaces) return allMessages;

  const filtered: Record<string, unknown> = {};
  for (const ns of namespaces) {
    if (allMessages[ns]) {
      filtered[ns] = allMessages[ns];
    }
  }
  return filtered;
}
```

```tsx
export async function getStaticProps({locale}: {locale: string}) {
  return {
    props: {
      messages: await getMessages(locale, ['HomePage', 'common'])
    }
  };
}
```

### With `getServerSideProps`

The same pattern works with `getServerSideProps` for pages that need server-side rendering:

```tsx
export async function getServerSideProps({locale}: {locale: string}) {
  return {
    props: {
      messages: (await import(`../../messages/${locale}.json`)).default
    }
  };
}
```

## Navigation

Pages Router uses Next.js built-in locale routing. No `createNavigation` wrapper is needed.

### Link component with `locale` prop

```tsx
import Link from 'next/link';

// Link to the same page in a different locale
<Link href="/about" locale="de">
  Uber uns
</Link>

// Link to current locale (default behavior, no locale prop needed)
<Link href="/about">
  About
</Link>
```

### Current locale

```tsx
import {useRouter} from 'next/router';

function MyComponent() {
  const router = useRouter();
  const {locale} = router;

  return <p>Current locale: {locale}</p>;
}
```

For a full locale switching component, see the Language Switcher step below.

### Programmatic navigation

```tsx
import {useRouter} from 'next/router';

function SearchForm() {
  const router = useRouter();

  function onSubmit(query: string) {
    // Navigate within current locale
    router.push(`/search?q=${encodeURIComponent(query)}`);

    // Navigate to a specific locale
    router.push('/about', '/about', {locale: 'de'});
  }
}
```

### Locale detection behavior

With the `i18n` config in `next.config.js`, Next.js automatically:
- Detects the user's preferred locale from the `Accept-Language` header on first visit
- Redirects to the detected locale prefix (e.g., `/de/about`)
- Stores the preference in a `NEXT_LOCALE` cookie

To override auto-detection and let users always land on the default locale, set `localeDetection: false` in the `i18n` config:

```js
i18n: {
  locales: ['en', 'de'],
  defaultLocale: 'en',
  localeDetection: false,
}
```

## Step 11: Language Switcher

Create a component that lets users switch between locales. Pages Router has native `<Link locale={loc}>` support, making this straightforward.

**Component**: Create `src/components/LanguageSwitcher.tsx` (or `components/LanguageSwitcher.tsx` if no `src/`):

```tsx
import Link from 'next/link';
import {useRouter} from 'next/router';

export default function LanguageSwitcher() {
  const router = useRouter();
  const {locale, locales, asPath} = router;
  const displayNames = new Intl.DisplayNames([locale ?? 'en'], {type: 'language'});

  return (
    <nav style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
      {locales?.map((loc) => (
        <Link key={loc} href={asPath} locale={loc} style={{
          padding: '0.25rem 0.5rem',
          borderRadius: '0.25rem',
          textDecoration: 'none',
          color: 'inherit',
          fontWeight: loc === locale ? 600 : 400,
          backgroundColor: loc === locale ? 'rgba(0, 0, 0, 0.06)' : 'transparent',
        }}>
          {displayNames.of(loc) ?? loc}
        </Link>
      ))}
    </nav>
  );
}
```

Each `<Link>` points to the same page (`asPath`) but with a different `locale` prop — Next.js handles the locale prefix automatically. `Intl.DisplayNames` renders locale names in the user's current language (e.g. "Deutsch" when viewing in German).

**Styling**: The example uses inline styles as a baseline. Adapt the styling to match the project's CSS approach (Tailwind, CSS Modules, etc.) and the visual style of the surrounding navigation.

**Wiring**: Import into `pages/_app.tsx` or a shared layout/header component:

```tsx
// In pages/_app.tsx:
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function App({Component, pageProps}: AppProps) {
  const router = useRouter();

  return (
    <NextIntlClientProvider
      locale={router.locale}
      messages={pageProps.messages}
    >
      <LanguageSwitcher />
      <Component {...pageProps} />
    </NextIntlClientProvider>
  );
}
```

## SEO: Alternate Language Tags

hreflang tags tell search engines which locale variants exist for each page. In Pages Router, use `next/head` with `useRouter` to render them. Create a reusable component:

```tsx
import { useRouter } from 'next/router'
import Head from 'next/head'

export function AlternateLanguageTags() {
  const { locales, asPath, defaultLocale } = useRouter()
  const pathname = asPath.split('?')[0]
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

  return (
    <Head>
      {locales?.map((locale) => (
        <link
          key={locale}
          rel="alternate"
          hrefLang={locale}
          href={`${siteUrl}/${locale}${pathname}`}
        />
      ))}
      <link
        rel="alternate"
        hrefLang="x-default"
        href={`${siteUrl}/${defaultLocale}${pathname}`}
      />
    </Head>
  )
}
```

- Place `<AlternateLanguageTags />` in `_app.tsx` so it applies to every page automatically.
- `NEXT_PUBLIC_SITE_URL` must be set in the environment without a trailing slash (e.g., `https://example.com`) — hreflang requires absolute URLs.

## Using Translations

All components in Pages Router are client components — there is no server/client distinction.

### Basic usage

```tsx
import {useTranslations} from 'next-intl';

export default function HomePage() {
  const t = useTranslations('HomePage');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('welcome', {name: 'World'})}</p>
    </div>
  );
}
```

Note: `'use client'` directive is not needed in Pages Router — all components are already client components.

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

Use `useFormatter` for locale-aware date, number, and relative time formatting:

```tsx
import {useFormatter} from 'next-intl';

function PriceDisplay({price}: {price: number}) {
  const format = useFormatter();

  return (
    <div>
      <p>{format.number(price, {style: 'currency', currency: 'EUR'})}</p>
      <p>{format.dateTime(new Date(), {dateStyle: 'medium'})}</p>
      <p>{format.relativeTime(new Date('2024-01-01'))}</p>
    </div>
  );
}
```

### API reference for Pages Router

| API | Import | Purpose |
|-----|--------|---------|
| `useTranslations` | `next-intl` | Access translations by namespace |
| `useFormatter` | `next-intl` | Format dates, numbers, relative time |
| `useLocale` | `next-intl` | Get current locale string |
| `useNow` | `next-intl` | Get current time (for hydration-safe rendering) |
| `useTimeZone` | `next-intl` | Get configured timezone |

All imports come from `next-intl` (not `next-intl/server` — that is App Router only).
