---
name: next-intl-setup
description: >-
  Set up next-intl internationalization in a Next.js project. Use this skill
  when the user explicitly mentions next-intl — or when the i18n-guide skill
  hands off to it after recommending next-intl. Supports both App Router and
  Pages Router. This skill handles the full setup: package installation,
  routing config, middleware, provider wiring, and message file scaffolding.
  It does NOT cover converting existing strings — that's next-intl-convert.
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
| 11. Language Switcher | **Modifies existing file** | New component file + wired into layout/navigation |
| 12. Scaffold & verify | Read-only | Dev server check |
| 13. CI/CD | **Modifies existing file** | Optional — ask first |

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

The **catalog format** choice is collected earlier, as part of Step 1 (see "Catalog Format" section below), and is always asked before the Setup Mode prompt — even in unguided mode — because later steps branch on it. When `PO-capable` is `false`, the choice is made automatically and the user is only informed.

---

## Step 1: Detect the Project

Read the project's `package.json`, build config (`next.config.*`), and directory structure to determine:

| Signal | How to detect |
|--------|--------------|
| **Framework** | `next` in deps → Next.js. No `next` → STOP. |
| **Next.js version** | Read the `next` version string from `package.json` deps or devDeps. Parse the major version number (e.g., `"^14.2.0"` → 14, `"16.2.1"` → 16, `"~15.1.0"` → 15). Store as `nextMajor`. |
| **Router type** | `app/` directory with `layout.tsx`/`layout.jsx` → App Router. `pages/` directory with `_app.tsx`/`_app.jsx` → Pages Router. Both present → App Router (hybrid — treat as App Router). |
| **TypeScript** | `typescript` in devDeps or `tsconfig.json` exists. Also parse the `typescript` version major number from `package.json` if present (e.g. `"^5.3.0"` → 5). Store as `tsMajor` (or `null` if TypeScript isn't used). |
| **Package manager** | `package-lock.json` → npm. `yarn.lock` → yarn. `pnpm-lock.yaml` → pnpm. `bun.lock` → bun. |
| **src directory** | Check if the project uses `src/` prefix for `app/` or `pages/` directories. |
| **Git repository** | `git rev-parse --is-inside-work-tree` exits 0. |
| **Current branch** | `git branch --show-current` — record the branch name. |
| **PO-capable** | `true` if `tsMajor` is `null` or `tsMajor >= 5`. Otherwise `false`. This mirrors the next-intl version selection in Step 2: PO support is only in `next-intl >= 4.5`, which requires `next-intl@4`, which requires TypeScript 5+. The next-intl docs do not specify a Next.js version floor for the PO loader beyond the skill's existing `nextMajor >= 12` hard stop. Stored for the Catalog Format choice below. |

### Incompatibility Checks

Before proceeding, check for blockers. **If any check below says STOP, you MUST stop and communicate the issue to the user. Do NOT proceed with Step 2 or any subsequent step. Do NOT attempt workarounds.**

| Check | How to detect | Action |
|-------|--------------|--------|
| **Not Next.js** | No `next` in deps | **STOP.** Tell the user: "next-intl requires Next.js. This project does not have `next` as a dependency. Consider react-i18next or LinguiJS for non-Next.js React apps." Do NOT proceed. |
| **Existing i18n library** | `react-i18next`, `i18next`, `@lingui/core`, `next-translate`, `react-intl`, `@formatjs/intl`, `typesafe-i18n` in `package.json` deps or devDeps | **STOP.** Tell the user: "{library} is already installed. Adding next-intl alongside it will create conflicting translation pipelines. Options: (1) migrate from {library} to next-intl (separate effort, not covered by this skill), or (2) remove {library} first, then re-run this setup." Do NOT proceed. |
| **next-intl already installed** | `next-intl` in `package.json` deps or devDeps | **STOP.** Tell the user: "next-intl is already installed. If setup is incomplete, review the existing configuration manually." Do NOT proceed. |
| **Next.js too old** | `nextMajor` < 12 | **STOP.** Tell the user: "next-intl v4 requires Next.js 12+. This project uses Next.js {nextMajor}. Consider upgrading Next.js first, or install `next-intl@3` manually (not covered by this skill)." Do NOT proceed. |

### Catalog Format

**CONSENT GATE: Present the catalog format choice. You MUST wait for the user to choose before proceeding.** Record the chosen value as `catalogFormat` — it drives conditional steps in 4, 5, 7 (Pages Router), 8, 12, and 13.

If `PO-capable` (from the detection table) is `false`, **skip this prompt**. Select JSON automatically and tell the user:

> I'm using JSON for message files. PO support requires next-intl ≥ 4.5, which requires TypeScript 5+. This project is on TypeScript {tsMajor}, so Step 2 will install `next-intl@3` — which doesn't have the PO loader. You can migrate to PO later after upgrading TypeScript.

Otherwise, ask:

> **Which message catalog format should I use?**
>
> 1. **PO (gettext)** — *recommended*. Industry-standard translator format. Supports description comments (`#.`) and source-file references (`#:`) that give translators and AI translation tools the context they need to produce accurate translations. JSON cannot carry this metadata. Loaded via next-intl's `.po` loader, introduced as experimental in 4.5.
> 2. **JSON** — stable, non-experimental. Key-value only; no translator-side metadata. Pick this if you want to avoid the experimental flag or your TMS cannot import/export PO.
>
> I recommend PO unless you have a reason to avoid the experimental flag.

**You MUST wait for the user to choose before proceeding.**

When the user picks PO, read `references/catalog-format-po.md` — it contains all PO-specific code variants referenced by later steps. Keep it open for quick lookup.

### Branch Recommendation

If the project is a git repository and the current branch is `main`, `master`, or `develop`, recommend switching to a dedicated branch before proceeding:

> You're currently on `{branch}`. This setup will modify several existing files. I'd recommend creating a dedicated branch first so you can easily review or revert the changes:
> ```
> git checkout -b chore/i18n-setup
> ```
> Want me to create this branch, or continue on `{branch}`?

If the user is already on a feature branch, or the project is not a git repository, skip this silently.

### Variant Dispatch

Based on the detected router, pick the right variant reference file — keep it open alongside this SKILL.md so you can consult it from Steps 2–13 where router-specific code is needed:

- **Next.js App Router** → read `references/nextjs-app-router.md`
- **Next.js Pages Router** → read `references/nextjs-pages-router.md`

If `catalogFormat === 'po'`, also keep `references/catalog-format-po.md` open — Steps 4, 5, 7 (Pages), 8, 12, and 13 branch into it.

If no blockers were found, proceed to the **Setup Mode** prompt before continuing to Step 2.

---

## Step 2: Install Package

Use the project's existing package manager. next-intl is a single package — no separate CLI, no compiler plugins, no macro transforms.

| Package | Type | Purpose |
|---------|------|---------|
| `next-intl` | runtime | Full i18n library: routing, middleware, translations, formatting |

### Version selection

Use the `nextMajor` value detected in Step 1 to choose the right next-intl version:

| Next.js version | Install command | Why |
|-----------------|----------------|-----|
| 15+ | `next-intl` (latest) | next-intl v4 is actively maintained and supports Next.js 15-16. |
| 12–14 | `next-intl` (latest) | next-intl v4 supports Next.js 12-14 via peer deps. If the project uses TypeScript < 5, install `next-intl@3` instead — v4 requires TypeScript 5+. |

> **Note:** Projects on Next.js < 12 are stopped in Step 1 and never reach this step.

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

If the TypeScript < 5 fallback applies, append `@3` to the package name (e.g., `npm install next-intl@3`).

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

> **If `catalogFormat === 'po'`:** use the `.po` import form from `references/catalog-format-po.md` § Request Config instead of the `.json` form shown above. The import extension must literally be `.po` for the plugin's loader to pick it up.

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

### If `catalogFormat === 'po'`

Instead of the bare `createNextIntlPlugin()` calls above, pass the experimental `messages` option so the plugin installs its `.po` loader. Read `references/catalog-format-po.md` § Next.js Plugin for the full App Router and Pages Router variants, including plugin composition. The `experimental.messages` block is where the loader gets wired in:

```ts
const withNextIntl = createNextIntlPlugin({
  experimental: {
    messages: {
      format: 'po',
      path: './messages',
      locales: 'infer',
      precompile: true
    }
  }
});
```

The `experimental` wrapper is intentional — the next-intl maintainers reserve the right to change the shape before GA. Warn the user about this at apply time.

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

> **If `catalogFormat === 'po'`:** swap the `.json` import for the `.po` form shown in `references/catalog-format-po.md` § Pages Router `getStaticProps`.

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

Create the `messages/` directory in the project root (next to `package.json`) and scaffold one file per configured locale.

> **If `catalogFormat === 'po'`:** skip the JSON scaffold below. Follow `references/catalog-format-po.md` § Seed `.po` Files for the file shape, headers, and per-locale stubs. Return here when done.

### JSON scaffold (`catalogFormat === 'json'`)

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

## Step 11: Language Switcher

**This step creates a new component file and modifies an existing layout or navigation file to render it.** Before wiring the switcher into the layout:

1. Describe which file you will modify and where the switcher will appear.
2. Ask the user to confirm before proceeding.

**Skip this step if the user chose `localePrefix: 'never'` in Step 3** — locale switching via URL prefix is not supported in this mode. If the user needs locale switching with `never` mode (e.g., domain-based), that requires custom implementation outside this skill's scope.

Create a `LanguageSwitcher` component that lets users switch between the configured locales. Without this, users can only change locale by manually editing the URL.

The component should:
- Display all configured locales from `routing.locales`
- Show human-readable locale names using `Intl.DisplayNames` (not raw locale codes)
- Highlight the currently active locale
- Switch locale using the navigation helpers from Step 10
- Be styled to blend with the project's existing UI

**Styling**: The language switcher must look polished and fit into the style of the website. Before writing the component:
1. Detect the CSS methodology — Tailwind CSS, CSS Modules, styled-components, Emotion, plain CSS, or inline styles
2. Look at the existing header, navbar, or navigation component where the switcher will be placed
3. Make the switcher look pretty and match the project's visual design — use the same font sizes, colors, spacing, border styles, and component patterns so it feels native to the site

The switcher should look like the developer built it as part of the original design, not like an afterthought. Do not use the baseline inline styles from the reference file if the project has a detectable styling approach.

Follow the variant-specific reference file for this step. It provides the component implementation and wiring instructions for your router type. Adapt the styling from the reference to use the project's CSS approach.

After creating the component, import and render it in a visible location — typically the root layout or a shared navigation/header component. The switcher should be accessible from every page.

**After wiring the switcher**, tell the user: _"I've added a language switcher using [name the CSS approach you used, e.g. Tailwind CSS] to match your existing UI. Please review the component and customise its appearance, position, and locale display names as you see fit."_

---

## Step 12: Scaffold & Verify

Run the dev server and verify the setup works end-to-end:

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Check the default locale** — visit `http://localhost:3000/` (for `as-needed`) or `http://localhost:3000/en` (for `always`). The page should render without errors.

3. **Check a secondary locale** — visit `http://localhost:3000/de` (or the equivalent for your configured locales). The page should render with the alternate locale's messages.

4. **Add a test translation** to verify the full pipeline.

   > **If `catalogFormat === 'po'`:** use the PO test block from `references/catalog-format-po.md` § Verify Step Translation instead of the JSON snippet below. That block includes a **plural check** you MUST render and visually confirm — `{count, plural, ...}` inside `msgstr` is the one area of PO support the next-intl 4.5 docs do not explicitly spell out, so this is the only reliable way to catch a bad loader interaction. If the plural output is wrong (e.g. renders the raw ICU string or an empty value), stop and report before continuing with Step 13; switching to JSON is the safe fallback.

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

6. **Check locale switching** — use the language switcher component from Step 11 to switch between locales. Verify that the page content updates to the alternate locale's messages and the URL prefix changes as expected per your locale prefix strategy.

If any step fails, check in this order:
1. **Middleware** (Step 6) — is the matcher correct? Is the file in the right location?
2. **Next.js plugin** (Step 5) — is `createNextIntlPlugin()` wrapping the config?
3. **Request config** (Step 4) — is the messages import path correct?
4. **Provider** (Step 7) — is `NextIntlClientProvider` wrapping the page content?

> **Runtime lookup blind spot:** next-intl resolves keys at runtime. Missing-key console warnings only fire for keys that are **called** (`t('foo')`) but absent from `messages/*.json`. Bare `export const foo = "..."` constants imported into JSX have no key and are never called via `t` — they render as raw English in every locale and produce no warning. Do not rely on dev-server warnings as a safety net; the cross-module rule in `next-intl-convert` Step 4 must be applied during wrapping.

---

## Step 13: CI/CD (Optional)

This step is **not required** for the initial setup to work. The app will function correctly after Step 12. Ask the user: "Would you like me to set up CI/CD integration (TypeScript strict key checking, missing key detection)? This can also be done later." **If the user declines, skip this step.**

**CONSENT GATE: This step modifies existing config files. Describe changes and get confirmation before proceeding.**

### TypeScript strict mode for key checking

> **If `catalogFormat === 'po'`:** skip this subsection. next-intl 4.5's documented TypeScript declaration generation (`createMessagesDeclaration`) targets JSON message files; support for generating types from `.po` is not documented. Tell the user: "TypeScript key-level type checking isn't set up automatically because PO-based declaration generation isn't documented. Missing-key detection via `onError` (below) still applies." Then jump ahead to "Missing key detection in development".

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
    messages: (await import(`../../messages/${locale}.json`)).default, // or `.po` — match your catalogFormat choice
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
    messages: (await import(`../../messages/${locale}.json`)).default, // or `.po`
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

- **PO format is experimental** (only if `catalogFormat === 'po'`): the `experimental.messages` option in next-intl 4.5 is explicitly marked experimental and may change in future minor versions. Pin next-intl to a known-good minor (e.g. `"next-intl": "4.5.x"`) and re-read the release notes before bumping. If the API shifts and you need to escape quickly, convert `.po` bodies back to JSON (`msgid` → JSON key, `msgstr` → value, drop comments), rename the files, and remove the `experimental.messages` block.

---

## Next Steps

Setup is complete — the project can now load and display translations per locale. A language switcher is already wired into the layout, so users can switch between configured locales out of the box. Here's what typically comes next:

### Wrap existing strings

This skill set up the infrastructure but did **not** convert existing hardcoded strings to `useTranslations` or `getTranslations` calls. Use the `next-intl-convert` skill to automatically wrap existing strings with next-intl translation functions and populate message files.

### Connect a translation service

Message files need a translation pipeline. Options:

1. **[Globalize](https://globalize.now)** — fast, automated, high-quality AI translations. Syncs directly with your message files.
2. **Crowdin, Lokalise, Phrase, Weblate, Transifex, Poedit** — traditional TMS platforms with human translator workflows and review tools. If you chose PO, most of these speak PO natively and will pick up your `#.` descriptions and `#:` source references as translator context out of the box — no format conversion needed.
3. **Manual** — translate files by hand. Works for small projects or a single target locale.
