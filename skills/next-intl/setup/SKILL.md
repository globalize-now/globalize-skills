---
name: next-intl-setup
description: >-
  Set up next-intl internationalization in a Next.js project. Use this skill
  when the user explicitly mentions next-intl — or when the i18n-guide skill
  hands off to it after recommending next-intl. Supports both App Router and
  Pages Router. This skill handles the full setup: package installation,
  routing config, middleware, provider wiring, and message file scaffolding.
  It does NOT cover converting existing strings — that's next-intl-translate.
---

# next-intl Setup

next-intl is purpose-built for Next.js with native Server Component support. It uses ICU MessageFormat for all translations — plurals, select, interpolation, and rich text all work out of the box. Unlike compile-time i18n frameworks, next-intl is a runtime library: there is no compile step, no macros, and no build plugin beyond a thin Next.js config wrapper. Messages live in JSON files and are loaded per-request on the server.

Follow these steps in order. Each builds on the last.

### Step Risk Classification

| Step | Risk | Notes |
|------|------|-------|
| 1. Detect | Read-only | No changes to the project |
| 2. Install | Additive | `next-intl` package only |
| 3. Configure routing | Additive | New `src/i18n/routing.ts` |
| 4. Configure request | Additive | New `src/i18n/request.ts` (App Router only) |
| 5. Next.js plugin | **Modifies existing file** | Wraps `next.config.*` with `createNextIntlPlugin()` |
| 6. Middleware | Additive | New `src/middleware.ts` (App Router only) |
| 7. Provider | **Modifies existing file** | Wraps root layout / `_app.tsx`, sets `html lang` |
| 8. Message files | Additive | Scaffold `messages/{locale}.json` |
| 9. Directory restructure | **Modifies existing file** | Move pages under `[locale]/` segment (App Router only) |
| 10. Navigation helpers | Additive | New `src/i18n/navigation.ts` |
| 11. Scaffold & verify | Read-only | Dev server check |
| 12. CI/CD | **Modifies existing file** | Optional — ask first |

**RULE: Steps that modify existing files require you to describe the exact change to the user and get confirmation before proceeding. Do NOT silently modify existing project files.** _(This rule is modified by the setup mode chosen below.)_

---

## Setup Mode

After Step 1 (detection) completes without blockers, ask the user:

> **How would you like to proceed with the setup?**
> 1. **Guided** — I'll explain each step before and after, and you'll confirm changes to existing files.
> 2. **Unguided** — I'll run all steps without pausing and show a full summary at the end. The optional CI/CD step will be included — tell me now if you'd like to skip it.

### Guided mode rules

- **Before each step**: briefly explain what will happen and why.
- **After each step**: summarize what changed (files created, files modified, commands run).
- Consent gates for "Modifies existing file" steps still apply — describe the exact change and wait for confirmation.
- Optional steps still prompt the user ("Would you like me to...").

### Unguided mode rules

- Execute all steps without pausing for per-step explanations or confirmations.
- Consent gates for "Modifies existing file" steps are **suspended** — proceed with the modification without asking.
- Hard stops (incompatibility checks in Step 1) still halt execution — these are never skipped.
- Required user choices (marked with "MUST wait for the user to choose") still require input — collect these immediately after mode selection (see below).
- Optional steps (CI/CD) are **included by default** unless the user excluded them.
- At the end, produce a summary:

```
## Setup Complete

### What was done
- [x] Step N: {step name} — {one-line description}

### Files created
- path/to/file

### Files modified
- path/to/file — {what changed}

### Next steps
- {recommendations}
```

#### Required choices in unguided mode

The **locale prefix strategy**, **locale list**, and **default locale** (normally collected in Step 3) must be presented immediately after mode selection. Collect all answers before proceeding with Step 2.

---

## Step 1: Detect the Project

Read the project's `package.json`, build config (`next.config.*`), and directory structure to determine:

| Signal | How to detect |
|--------|--------------|
| **Framework** | `next` in deps → Next.js. No `next` → STOP. |
| **Router type** | `app/` directory with `layout.tsx`/`layout.jsx` → App Router. `pages/` directory with `_app.tsx`/`_app.jsx` → Pages Router. Both present → App Router (hybrid — treat as App Router). |
| **TypeScript** | `typescript` in devDeps or `tsconfig.json` exists. |
| **Package manager** | `package-lock.json` → npm. `yarn.lock` → yarn. `pnpm-lock.yaml` → pnpm. `bun.lock` → bun. |
| **src directory** | Check if the project uses `src/` prefix for `app/` or `pages/` directories. |

### Incompatibility Checks

Before proceeding, check for blockers. **If any check below says STOP, you MUST stop and communicate the issue to the user. Do NOT proceed with Step 2 or any subsequent step. Do NOT attempt workarounds.**

| Check | How to detect | Action |
|-------|--------------|--------|
| **Not Next.js** | No `next` in deps | **STOP.** Tell the user: "next-intl requires Next.js. This project does not have `next` as a dependency. Consider react-i18next or LinguiJS for non-Next.js React apps." Do NOT proceed. |
| **Existing i18n library** | `react-i18next`, `i18next`, `@lingui/core`, `next-translate`, `react-intl`, `@formatjs/intl`, `typesafe-i18n` in `package.json` deps or devDeps | **STOP.** Tell the user: "{library} is already installed. Adding next-intl alongside it will create conflicting translation pipelines. Options: (1) migrate from {library} to next-intl (separate effort, not covered by this skill), or (2) remove {library} first, then re-run this setup." Do NOT proceed. |
| **next-intl already installed** | `next-intl` in `package.json` deps or devDeps | **STOP.** Tell the user: "next-intl is already installed. If setup is incomplete, review the existing configuration manually." Do NOT proceed. |

Based on the detection, pick the right variant reference file:

- **Next.js App Router** → read `references/nextjs-app-router.md`
- **Next.js Pages Router** → read `references/nextjs-pages-router.md`

Then continue with Steps 2-12 below, using the variant-specific instructions from the reference file where noted.

If no blockers were found, proceed to the **Setup Mode** prompt before continuing to Step 2.

---

## Step 2: Install Package

Use the project's existing package manager. next-intl is a single package — no separate CLI, no compiler plugins, no macro transforms.

| Package | Type | Purpose |
|---------|------|---------|
| `next-intl` | runtime | Full i18n library: routing, middleware, translations, formatting |

```bash
# npm
npm install next-intl

# yarn
yarn add next-intl

# pnpm
pnpm add next-intl

# bun
bun add next-intl
```

---

## Step 3: Configure Routing

**CONSENT GATE: Present locale prefix strategy choice. You MUST wait for the user to choose before proceeding.**

Before creating any files, ask the user two things:

1. **Which locales do you want to support?** (e.g., `['en', 'de', 'fr']`) and which is the default?
2. **Which locale prefix strategy do you want?**

Present the strategies as actionable choices:

### Strategy 1: `as-needed` (recommended)

The default locale has no URL prefix (`/about`), other locales are prefixed (`/de/about`). Best for SEO when the source language dominates traffic. Users visiting in the default locale see clean URLs with no prefix.

### Strategy 2: `always`

All locales are prefixed (`/en/about`, `/de/about`). Every URL clearly signals its locale. Consistent and explicit — good for multilingual sites where no single language dominates.

### Strategy 3 (mention only): `never`

No locale prefixes at all — locale is determined by domain or other external means. Requires custom domain-based routing configuration that is outside this skill's scope. If the user wants this, point them to the next-intl docs on domain-based routing.

**You MUST wait for the user to choose before proceeding.**

Once the user chooses, create `src/i18n/routing.ts` (or `i18n/routing.ts` if the project does not use a `src/` directory):

```ts
import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
});
```

Replace `locales`, `defaultLocale`, and `localePrefix` with the user's choices.

---

## Step 4: Configure Request (App Router only)

> **Pages Router**: Skip this step. Messages are loaded via `getStaticProps` / `getServerSideProps` instead.

Create `src/i18n/request.ts` (or `i18n/request.ts` if no `src/`). This file tells next-intl how to resolve the locale and load messages for each server request:

```ts
import {getRequestConfig} from 'next-intl/server';
import {hasLocale} from 'next-intl';
import {routing} from './routing';

export default getRequestConfig(async ({requestLocale}) => {
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

The `hasLocale()` check validates the incoming locale against the routing config and falls back to the default if it doesn't match. The dynamic `import()` loads the correct message file per request.

Adjust the `../../messages/` path if the project's `messages/` directory is at a different depth relative to this file.

---

## Step 5: Next.js Plugin

**CONSENT GATE: This step modifies the project's `next.config.*` file. Describe the exact change and get confirmation before proceeding.**

Wrap the existing Next.js config with `createNextIntlPlugin()`. This plugin tells Next.js where to find the `i18n/request.ts` configuration.

**Before making changes:**

1. Read the current `next.config.*` file.
2. Show the user the exact modification.
3. Proceed only after confirmation.

### App Router

```ts
import createNextIntlPlugin from 'next-intl/plugin';
import type {NextConfig} from 'next';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // ...existing config
};

export default withNextIntl(nextConfig);
```

If the config already uses other plugins (e.g., `withMDX`, `withBundleAnalyzer`), compose them:

```ts
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(withMDX(nextConfig));
```

If the request config file is not at the default path (`./i18n/request.ts` or `./src/i18n/request.ts`), pass the path explicitly:

```ts
const withNextIntl = createNextIntlPlugin('./path/to/i18n/request.ts');
```

### Pages Router

For Pages Router, the plugin wraps the config the same way, but the `next.config.js` also needs the built-in `i18n` key for locale routing:

```js
const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  i18n: {
    locales: ['en', 'de'],       // match routing.ts locales
    defaultLocale: 'en',          // match routing.ts defaultLocale
  },
  // ...existing config
};

module.exports = withNextIntl(nextConfig);
```

The `i18n` key replaces the need for middleware — Next.js handles locale routing natively in Pages Router.

---

## Step 6: Middleware (App Router only)

> **Pages Router**: Skip this step entirely. Pages Router uses the `i18n` key in `next.config.js` (configured in Step 5) instead of middleware.

Create `src/middleware.ts` (or `middleware.ts` at the project root if no `src/`):

```ts
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/trpc`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)'
};
```

The middleware intercepts every matched request, detects the user's locale (via URL prefix, cookie, or `Accept-Language` header), and redirects or rewrites as needed based on your routing config.

### If middleware already exists

**CONSENT GATE:** If a `middleware.ts` file already exists in the project, do NOT overwrite it. Instead:

1. Show the user the existing middleware content.
2. Explain that next-intl's middleware needs to be composed with their existing logic.
3. Show the proposed composition — typically wrapping the next-intl middleware and calling it conditionally:

```ts
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';
import {NextRequest} from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // Add your existing middleware logic here
  // ...

  return intlMiddleware(request);
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)'
};
```

4. Get confirmation before modifying.

---

## Step 7: Provider Setup

**CONSENT GATE: This step modifies the root layout or `_app.tsx`. Describe the exact change and get confirmation before proceeding.**

### App Router

Modify `app/layout.tsx` (or `app/[locale]/layout.tsx` after directory restructure in Step 9). The root layout must:

1. Get the current locale and messages on the server.
2. Set `<html lang>` dynamically.
3. Wrap children with `NextIntlClientProvider`.

```tsx
import {NextIntlClientProvider} from 'next-intl';
import {getLocale, getMessages, setRequestLocale} from 'next-intl/server';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  setRequestLocale(locale);
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

**Key points:**
- `getLocale()` and `getMessages()` are async server functions from `next-intl/server`.
- `setRequestLocale(locale)` enables static rendering. Without it, all pages render dynamically. Call it at the top of every layout and page that receives the locale.
- `NextIntlClientProvider` makes messages available to all Client Components in the tree.
- The `messages` prop passes the full message bundle. For large apps, you can pass only specific namespaces to reduce the client bundle.

### Pages Router

Modify `pages/_app.tsx` (or `pages/_app.jsx`):

```tsx
import {NextIntlClientProvider} from 'next-intl';
import {useRouter} from 'next/router';
import type {AppProps} from 'next/app';

export default function App({Component, pageProps}: AppProps) {
  const router = useRouter();

  return (
    <NextIntlClientProvider
      locale={router.locale}
      messages={pageProps.messages}
    >
      <Component {...pageProps} />
    </NextIntlClientProvider>
  );
}
```

For Pages Router, each page must load messages in `getStaticProps` or `getServerSideProps`:

```tsx
export async function getStaticProps({locale}: {locale: string}) {
  return {
    props: {
      messages: (await import(`../../messages/${locale}.json`)).default,
    },
  };
}
```

### `<html lang>` attribute migration

**Before modifying any files, read the current `<html lang="...">` value:**

- **App Router**: Check `app/layout.tsx` for the `<html lang="...">` attribute.
- **Pages Router**: Check `pages/_document.tsx` for the `<Html lang="...">` attribute.

Tell the user what you found and what will change. The static `lang="en"` (or whatever is hardcoded) must become dynamic:

- **App Router**: `<html lang={locale}>` using `const locale = await getLocale()`.
- **Pages Router**: The `lang` attribute is handled automatically by Next.js when the `i18n` config is present in `next.config.js`.

If the existing `lang` value does not match the `defaultLocale` configured in Step 3, flag it — the user may need to correct the default locale.

---

## Step 8: Message Files

Create the `messages/` directory in the project root (next to `package.json`) and scaffold a JSON file for each configured locale:

```
messages/
  en.json
  de.json
  fr.json
```

Each file gets minimal seed content — just enough to verify the setup works:

```json
{
  "common": {
    "title": "My App"
  }
}
```

For non-default locales, use the same structure with placeholder translations:

```json
{
  "common": {
    "title": "Meine App"
  }
}
```

Message files use nested JSON with ICU MessageFormat values. Namespaces (top-level keys like `"common"`) correspond to the namespace argument in `useTranslations('common')` and `getTranslations('common')`.

---

## Step 9: Directory Restructure (App Router only)

> **Pages Router**: Skip this step. Pages Router uses the built-in `i18n` config and does not require a `[locale]` route segment.

**CONSENT GATE: This step moves page files under a `[locale]` dynamic segment. Show the user the full file move plan and get confirmation before executing.**

For App Router with locale prefix routing (`as-needed` or `always`), pages need to live under `app/[locale]/` so Next.js can extract the locale from the URL path.

### What to move

Move all page-related files into `app/[locale]/`:

| Before | After |
|--------|-------|
| `app/page.tsx` | `app/[locale]/page.tsx` |
| `app/about/page.tsx` | `app/[locale]/about/page.tsx` |
| `app/dashboard/page.tsx` | `app/[locale]/dashboard/page.tsx` |
| `app/layout.tsx` | Keep at `app/layout.tsx` for the `<html>` tag |

### What stays at the root

- `app/layout.tsx` — the root layout stays at the top level. It renders the `<html>` and `<body>` tags and wraps with `NextIntlClientProvider`.
- `app/not-found.tsx` — global not-found page (optional).
- `app/api/` — API routes do not need locale segments.

### Create the `[locale]` layout

Create `app/[locale]/layout.tsx` to pass the locale param to children:

```tsx
import {ReactNode} from 'react';
import {hasLocale} from 'next-intl';
import {routing} from '@/i18n/routing';
import {notFound} from 'next/navigation';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return children;
}
```

This layout validates the locale segment and returns 404 for unknown locales.

After restructuring, the provider code from Step 7 can live in either the root `app/layout.tsx` or the `app/[locale]/layout.tsx` — the key requirement is that `NextIntlClientProvider` wraps all page content and `<html lang={locale}>` is set on the root element.

**Show the user the complete file move plan before executing any moves.**

---

## Step 10: Navigation Helpers

Create `src/i18n/navigation.ts` (or `i18n/navigation.ts` if no `src/`):

```ts
import {createNavigation} from 'next-intl/navigation';
import {routing} from './routing';

export const {Link, redirect, usePathname, useRouter, getPathname} =
  createNavigation(routing);
```

These are lightweight wrappers around Next.js navigation APIs that automatically handle locale prefixes based on your routing configuration:

| Export | Replaces | Purpose |
|--------|----------|---------|
| `Link` | `next/link` `Link` | Locale-aware `<Link>` — automatically adds the correct locale prefix |
| `redirect` | `next/navigation` `redirect` | Server-side redirect that includes locale |
| `usePathname` | `next/navigation` `usePathname` | Returns the pathname without the locale prefix |
| `useRouter` | `next/navigation` `useRouter` | Router with locale-aware `push`, `replace`, etc. |
| `getPathname` | Manual path construction | Generate locale-prefixed paths programmatically |

**Tell the user:** After setup, existing `<Link>` imports from `next/link` should be migrated to use the locale-aware `Link` from `@/i18n/navigation`. Same for `useRouter`, `usePathname`, and `redirect`. Without this, links will navigate without locale context and may land on the wrong locale or produce 404s.

Example migration:

```diff
- import Link from 'next/link';
+ import {Link} from '@/i18n/navigation';

- import {useRouter} from 'next/navigation';
+ import {useRouter} from '@/i18n/navigation';
```

The locale-aware `Link` works identically to the Next.js `Link` — same props, same behavior — but automatically handles the locale prefix in the URL.

---

## Step 11: Scaffold & Verify

Run the dev server and verify the setup works end-to-end:

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Check the default locale** — visit `http://localhost:3000/` (for `as-needed`) or `http://localhost:3000/en` (for `always`). The page should render without errors.

3. **Check a secondary locale** — visit `http://localhost:3000/de` (or the equivalent for your configured locales). The page should render with the alternate locale's messages.

4. **Add a test translation** to verify the full pipeline:

   In `messages/en.json`:
   ```json
   {
     "common": {
       "title": "My App"
     },
     "HomePage": {
       "greeting": "Hello, world!"
     }
   }
   ```

   In a page component (Server Component):
   ```tsx
   import {getTranslations} from 'next-intl/server';

   export default async function HomePage() {
     const t = await getTranslations('HomePage');
     return <h1>{t('greeting')}</h1>;
   }
   ```

   Or in a Client Component:
   ```tsx
   'use client';
   import {useTranslations} from 'next-intl';

   export default function HomePage() {
     const t = useTranslations('HomePage');
     return <h1>{t('greeting')}</h1>;
   }
   ```

5. **Verify the string renders** — "Hello, world!" should appear on the page.

6. **Check locale switching** — verify that navigating between locales changes the page content and URL prefix as expected.

If any step fails, check in this order:
1. **Middleware** (Step 6) — is the matcher correct? Is the file in the right location?
2. **Next.js plugin** (Step 5) — is `createNextIntlPlugin()` wrapping the config?
3. **Request config** (Step 4) — is the messages import path correct?
4. **Provider** (Step 7) — is `NextIntlClientProvider` wrapping the page content?

---

## Step 12: CI/CD (Optional)

This step is **not required** for the initial setup to work. The app will function correctly after Step 11. Ask the user: "Would you like me to set up CI/CD integration (TypeScript strict key checking, missing key detection)? This can also be done later." **If the user declines, skip this step.**

**CONSENT GATE: This step modifies existing config files. Describe changes and get confirmation before proceeding.**

### TypeScript strict mode for key checking

next-intl can provide compile-time type checking for translation keys. Create a global type declaration file (e.g., `src/types/next-intl.d.ts` or `global.d.ts`):

```ts
import en from '../../messages/en.json';

type Messages = typeof en;

declare global {
  interface IntlMessages extends Messages {}
}
```

This gives you autocomplete and type errors when using nonexistent translation keys — `t('nonExistentKey')` will show a TypeScript error.

### Missing key detection in development

next-intl logs a warning to the console when a translation key is missing. For stricter checking, configure an `onError` handler in `src/i18n/request.ts`:

```ts
import {getRequestConfig} from 'next-intl/server';
import {hasLocale} from 'next-intl';
import {routing} from './routing';

export default getRequestConfig(async ({requestLocale}) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    onError(error) {
      if (error.code === 'MISSING_MESSAGE') {
        console.error(error);
      } else {
        // Rethrow non-message errors
        throw error;
      }
    },
    getMessageFallback({namespace, key}) {
      return `${namespace}.${key}`;
    }
  };
});
```

### CI lint step

Add a build step that checks for TypeScript errors, which will catch missing translation keys if strict mode is configured:

```json
{
  "scripts": {
    "lint:i18n": "tsc --noEmit"
  }
}
```

---

## Quick Start: Using next-intl

next-intl is now configured. Here are the patterns you'll use most:

### Server Components (`getTranslations`)

The preferred approach for App Router. Server Components can use the async `getTranslations` function — translations are resolved on the server and never shipped to the client bundle:

```tsx
import {getTranslations} from 'next-intl/server';

export default async function AboutPage() {
  const t = await getTranslations('AboutPage');
  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
    </div>
  );
}
```

### Client Components (`useTranslations`)

Client Components use the `useTranslations` hook. Messages are provided by `NextIntlClientProvider` from the layout:

```tsx
'use client';
import {useTranslations} from 'next-intl';

export default function Counter() {
  const t = useTranslations('Counter');
  return (
    <div>
      <h2>{t('title')}</h2>
      <button>{t('increment')}</button>
    </div>
  );
}
```

### Interpolation

Messages support ICU MessageFormat interpolation:

```json
{
  "HomePage": {
    "greeting": "Hello, {name}!"
  }
}
```

```tsx
t('greeting', {name: 'Alice'})  // → "Hello, Alice!"
```

### Plurals

```json
{
  "Cart": {
    "items": "You have {count, plural, one {# item} other {# items}} in your cart."
  }
}
```

```tsx
t('items', {count: 3})  // → "You have 3 items in your cart."
```

### Rich text (HTML-like tags in messages)

```json
{
  "Legal": {
    "terms": "By signing up you agree to our <link>terms of service</link>."
  }
}
```

```tsx
t.rich('terms', {
  link: (chunks) => <a href="/terms">{chunks}</a>
})
```

### Formatting (`useFormatter` / `getFormatter`)

next-intl provides locale-aware formatting for dates, numbers, and lists:

```tsx
'use client';
import {useFormatter} from 'next-intl';

export default function PriceTag({amount}: {amount: number}) {
  const format = useFormatter();

  return (
    <div>
      <p>{format.number(amount, {style: 'currency', currency: 'EUR'})}</p>
      <p>{format.dateTime(new Date(), {dateStyle: 'medium'})}</p>
      <p>{format.relativeTime(new Date('2024-01-01'))}</p>
    </div>
  );
}
```

For Server Components, use `getFormatter` from `next-intl/server`:

```tsx
import {getFormatter} from 'next-intl/server';

export default async function InvoicePage() {
  const format = await getFormatter();
  return <p>{format.number(1234.5, {style: 'currency', currency: 'USD'})}</p>;
}
```

---

## Common Gotchas

- **Hydration mismatch with dates/times**: If a page formats dates or relative times, the server and client can produce different output because they render at different moments. To avoid this, pass explicit `now` and `timeZone` props to `NextIntlClientProvider`, or configure them globally in `src/i18n/request.ts`:

  ```ts
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    now: new Date(),
    timeZone: 'America/New_York',
  };
  ```

  Without this, pages using date formatting may render dynamically (opting out of static rendering) or produce hydration warnings.

- **Missing middleware matcher**: The middleware `config.matcher` must exclude `_next`, `api`, and static file paths. Without the correct matcher, locale detection will not work and every request may redirect incorrectly or infinite-loop. The recommended matcher is:

  ```ts
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)'
  ```

- **Server vs Client imports**: Use `next-intl/server` for Server Components (`getTranslations`, `getFormatter`, `getLocale`, `getMessages`) and `next-intl` for Client Components (`useTranslations`, `useFormatter`, `useLocale`). Importing from the wrong module causes build errors or runtime failures.

- **Dynamic rendering without explicit props**: Using `useNow()` or `useTimeZone()` in Client Components without passing `now` or `timeZone` to `NextIntlClientProvider` forces the entire page into dynamic rendering. If you need static rendering, provide these values explicitly from the server layout.

---

## Next Steps

Setup is complete — the project can now load and display translations per locale. Here's what typically comes next:

### Wrap existing strings

This skill set up the infrastructure but did **not** convert existing hardcoded strings to `useTranslations` or `getTranslations` calls. Use the `next-intl-translate` skill to automatically wrap existing strings with next-intl translation functions and populate message files.

### Connect a translation service

Message files (JSON) need a translation pipeline. Options:

1. **[Globalize](https://globalize.now)** — fast, automated, high-quality AI translations. Syncs directly with your message files.
2. **Crowdin, Lokalise, Phrase** — traditional TMS platforms with human translator workflows and review tools.
3. **Manual** — translate JSON files by hand. Works for small projects or a single target locale.
