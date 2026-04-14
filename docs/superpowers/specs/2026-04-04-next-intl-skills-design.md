# next-intl Skills Design

## Context

The globalization-skills repo currently covers LinguiJS (setup, convert, code) and CSS i18n. next-intl is the most popular i18n library specifically built for Next.js, with native App Router and Server Component support. Adding next-intl skills expands coverage to the dominant Next.js i18n choice.

Two skills will be created:
- **next-intl-setup** — Install and configure next-intl in a Next.js project
- **next-intl-convert** — Wrap hardcoded strings with next-intl APIs in an already-configured project

## Structure

```
skills/next-intl/
  setup/
    SKILL.md
    references/
      nextjs-app-router.md
      nextjs-pages-router.md
  convert/
    SKILL.md
    references/
      nextjs-app-router.md
      nextjs-pages-router.md
```

Follows the existing pattern: SKILL.md orchestrates generic steps and dispatches to variant-specific reference files based on project detection.

---

## Skill 1: next-intl-setup

### Frontmatter

```yaml
name: next-intl-setup
description: >-
  Set up next-intl internationalization in a Next.js project. Use this skill
  when the user asks to add localization, i18n, translations, or multi-language
  support to a Next.js app — whether App Router or Pages Router. Also trigger
  on mentions of next-intl, or general translation intent like "translate my
  Next.js app", "add language support", "make my app multilingual". This skill
  handles the full setup: package installation, routing config, middleware,
  provider wiring, and message file scaffolding. It does NOT cover converting
  existing strings — that's next-intl-convert.
```

### Step Risk Classification

| Step | Risk | Notes |
|------|------|-------|
| 1. Detect | Read-only | No changes to the project |
| 2. Install | Additive | `next-intl` package only |
| 3. Configure routing | Additive | New `src/i18n/routing.ts` |
| 4. Configure request | Additive | New `src/i18n/request.ts` (App Router only) |
| 5. Next.js plugin | **Modifies existing** | Wraps `next.config.*` with `createNextIntlPlugin()` |
| 6. Middleware | Additive | New `src/middleware.ts` (App Router only) |
| 7. Provider | **Modifies existing** | Wraps root layout/`_app.tsx`, sets `html lang` |
| 8. Message files | Additive | Scaffold `messages/{locale}.json` |
| 9. Directory restructure | **Modifies existing** | Move pages under `[locale]/` segment (App Router only) |
| 10. Navigation helpers | Additive | New `src/i18n/navigation.ts` with `createNavigation(routing)` |
| 11. Scaffold & verify | Read-only | Dev server check |
| 12. CI/CD | **Modifies existing** | Optional — ask first |

**RULE: Steps that modify existing files require describing the exact change and getting confirmation.**

### Step 1: Detect the Project

Read `package.json`, build config, and directory structure:

| Signal | How to detect |
|--------|--------------|
| **Framework** | `next` in deps → Next.js. No `next` → STOP. |
| **Router type** | `app/` dir with `layout.tsx` → App Router. `pages/` dir with `_app.tsx` → Pages Router. Both → App Router (hybrid, treat as App Router). |
| **TypeScript** | `typescript` in devDeps or `tsconfig.json` exists. |
| **Package manager** | `package-lock.json` → npm. `yarn.lock` → yarn. `pnpm-lock.yaml` → pnpm. `bun.lock` → bun. |
| **src directory** | Check if project uses `src/` prefix for app/pages directories. |

### Incompatibility Checks (Hard Stops)

| Check | Detection | Action |
|-------|-----------|--------|
| **Not Next.js** | No `next` in deps | **STOP.** "next-intl requires Next.js. This project uses {framework}. Consider react-i18next or LinguiJS for non-Next.js React apps." |
| **Existing i18n library** | `react-i18next`, `i18next`, `@lingui/core`, `next-translate`, `react-intl`, `@formatjs/intl`, `typesafe-i18n` in deps | **STOP.** "{library} is already installed. Adding next-intl alongside it will create conflicting translation pipelines." |
| **next-intl already installed** | `next-intl` in deps | **STOP.** "next-intl is already installed. If setup is incomplete, review the existing configuration manually." |

After detection, dispatch to the appropriate reference file:
- App Router → `references/nextjs-app-router.md`
- Pages Router → `references/nextjs-pages-router.md`

### Step 2: Install Package

Single package: `next-intl`

```bash
npm install next-intl    # or yarn/pnpm/bun equivalent
```

### Step 3: Configure Routing

**CONSENT GATE: Present locale prefix strategy choice.**

Create `src/i18n/routing.ts` (or `i18n/routing.ts` if no `src/`):

```typescript
import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en'],       // user provides their locale list
  defaultLocale: 'en',   // user provides default
  localePrefix: '...',   // chosen strategy
});
```

Present two actionable strategies plus a mention of domain-based:

1. **`as-needed`** (recommended) — Default locale has no prefix (`/about`), other locales are prefixed (`/de/about`). Best for SEO when source language dominates traffic.
2. **`always`** — All locales prefixed (`/en/about`, `/de/about`). Clean and consistent, every URL clearly signals its locale.
3. *(Mention only)* `never` — No prefixes at all; locale determined by domain or other means. Requires custom domain setup outside this skill's scope.

**Wait for user choice before proceeding.**

Also ask user for their locale list and default locale at this step.

### Step 4: Configure Request (App Router only)

Create `src/i18n/request.ts`:

```typescript
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

Skipped for Pages Router — messages are loaded via `getStaticProps`.

### Step 5: Next.js Plugin

**CONSENT GATE: Modifies `next.config.*`**

Wrap existing config with `createNextIntlPlugin()`:

```typescript
import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin();

// wrap existing config
export default withNextIntl(existingConfig);
```

Show user the exact change to their config file before applying.

### Step 6: Middleware (App Router only)

Create `src/middleware.ts`:

```typescript
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)'
};
```

If `middleware.ts` already exists, **CONSENT GATE** — show what needs to be composed.

Skipped for Pages Router — locale routing uses Next.js built-in `i18n` config in `next.config.js`:

```javascript
// next.config.js (Pages Router)
module.exports = withNextIntl({
  i18n: {
    locales: ['en', 'de'],
    defaultLocale: 'en',
  },
});
```

This is configured in Step 5 (Next.js plugin) for Pages Router, not in a separate middleware file.

### Step 7: Provider Setup

**CONSENT GATE: Modifies root layout or `_app.tsx`**

**App Router** — modify `app/layout.tsx` (or `app/[locale]/layout.tsx` after restructure):
```typescript
import {NextIntlClientProvider} from 'next-intl';
import {getLocale, getMessages} from 'next-intl/server';

export default async function RootLayout({children}) {
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

**Pages Router** — modify `_app.tsx`:
```typescript
import {NextIntlClientProvider} from 'next-intl';
import {useRouter} from 'next/router';

export default function App({Component, pageProps}) {
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

Also migrate static `html lang` attribute to dynamic value.

### Step 8: Message Files

Create `messages/en.json` (and one for each configured locale):

```json
{
  "common": {
    "title": "My App"
  }
}
```

Minimal scaffold — just enough to verify the setup works.

### Step 9: Directory Restructure (App Router only)

**CONSENT GATE: Moving pages under `[locale]/` segment.**

For App Router with locale prefix routing, pages need to live under `app/[locale]/`:
- Move `app/page.tsx` → `app/[locale]/page.tsx`
- Move `app/layout.tsx` → keep root for `html` tag, create `app/[locale]/layout.tsx` for provider

Show the user the full file move plan before executing.

### Step 10: Scaffold & Verify

1. Run dev server, confirm no errors
2. Visit `/` and `/de` (or equivalent), confirm locale switching works
3. Add a sample `useTranslations('common')` call to verify translations render

### Step 11: CI/CD (Optional)

**CONSENT GATE: Ask before proceeding.**

Options:
- Add a lint step to check for missing translation keys
- Mention `next-intl`'s TypeScript integration for compile-time key checking

### Quick Start: Using next-intl

Brief usage section at the end of SKILL.md covering:

**Server Components:**
```typescript
import {getTranslations} from 'next-intl/server';

export default async function Page() {
  const t = await getTranslations('HomePage');
  return <h1>{t('title')}</h1>;
}
```

**Client Components:**
```typescript
'use client';
import {useTranslations} from 'next-intl';

export default function Counter() {
  const t = useTranslations('Counter');
  return <button>{t('increment')}</button>;
}
```

**Formatting:**
```typescript
import {useFormatter} from 'next-intl';

const format = useFormatter();
format.dateTime(new Date(), {dateStyle: 'medium'});
format.number(1234.5, {style: 'currency', currency: 'EUR'});
```

### Common Gotchas

1. **Hydration mismatch** — Ensure `NextIntlClientProvider` receives `locale` and `timeZone` props for static rendering
2. **Missing middleware matcher** — Without the correct matcher, locale detection won't work for App Router
3. **Server vs Client imports** — `next-intl/server` for Server Components, `next-intl` for Client Components
4. **Dynamic rendering** — Without explicit `now`/`timeZone` props, pages using date formatting render dynamically

---

## Skill 2: next-intl-convert

### Frontmatter

```yaml
name: next-intl-convert
description: >-
  Wrap hardcoded UI strings with next-intl translation functions in a Next.js
  project that already has next-intl configured. Use this skill when the user
  asks to "wrap strings", "translate the UI", "find hardcoded text",
  "internationalize existing components", "add translations", or "find
  untranslated strings". This skill does NOT install packages or create
  config — run next-intl-setup first if next-intl is not yet configured.
```

### Step 1: Prerequisite Check

Verify next-intl is configured:
1. `next-intl` in `node_modules`
2. `next.config.*` uses `createNextIntlPlugin()`
3. Message files exist in `messages/` directory
4. Provider is wired (`NextIntlClientProvider` in layout or `_app`)

If any check fails → stop, tell user to run `next-intl-setup` first.

### Step 2: Detect

- App Router vs Pages Router (determines available APIs)
- TypeScript (for type annotations)
- Existing message namespace structure in `messages/*.json`

Dispatch to reference:
- App Router → `references/nextjs-app-router.md`
- Pages Router → `references/nextjs-pages-router.md`

### Step 3: API Decision Tree

```
Is this a Server Component (no 'use client' directive)?
  YES → getTranslations(namespace) from next-intl/server

Is this a Client Component?
  YES → useTranslations(namespace) from next-intl

Need to format dates/numbers/relative time?
  Server → getFormatter() from next-intl/server
  Client → useFormatter() from next-intl

Need current locale?
  Server → getLocale() from next-intl/server
  Client → useLocale() from next-intl
```

### Step 4: Gap Detection

**Always flag (high confidence):**
- Bare JSX text not wrapped in `t('key')` or `{t('key')}`
- User-visible string attributes: `placeholder`, `aria-label`, `title`, `alt`
- Concatenated user-visible strings: `"Hello " + name`

**Flag with judgment (medium confidence):**
- `toFixed()` without locale-aware formatting → suggest `format.number()`
- Hardcoded currency symbols → suggest `format.number(value, {style: 'currency'})`
- `date.toLocaleDateString()` without explicit locale → suggest `format.dateTime()`
- Toast/notification messages
- Error messages shown to users

**Never flag:**
- CSS classes, console logs, import paths, object keys, regex, test IDs, URLs, ALL_CAPS constants

### Step 5: ICU Patterns in next-intl

next-intl message files use ICU MessageFormat:

**Interpolation:**
```json
{"greeting": "Hello, {name}!"}
```

**Plurals:**
```json
{"items": "You have {count, plural, one {# item} other {# items}}"}
```

**Select:**
```json
{"gender": "{gender, select, male {He} female {She} other {They}} liked your post"}
```

**Rich text (HTML-like tags in messages):**
```json
{"terms": "By signing up you agree to our <link>terms</link>."}
```
```tsx
t.rich('terms', {link: (chunks) => <a href="/terms">{chunks}</a>})
```

### Step 6: Workflow

File-by-file priority:
1. Layout/shell components (navbar, sidebar, footer)
2. Shared components (buttons, modals, form fields)
3. Page components
4. Utility files with user-visible strings

For each file:
1. Determine Server or Client Component
2. Import appropriate hook/function
3. Choose or create namespace matching the component's domain
4. Wrap strings → add keys to `messages/{locale}.json`
5. Verify rendering

After batch wrapping:
1. Check all locales have the same keys (or use TypeScript strict mode)
2. Run dev server, verify no missing key warnings
3. Run existing tests

### Variant Differences (convert)

**App Router reference** covers:
- `getTranslations()` for Server Components (async, awaited)
- `useTranslations()` for Client Components
- Passing server-translated strings as props to Client Components (avoiding unnecessary client bundles)
- `getFormatter()` vs `useFormatter()`

**Pages Router reference** covers:
- `useTranslations()` only (no Server Components)
- Loading messages in `getStaticProps` / `getServerSideProps`
- `useFormatter()` for formatting

---

## Verification Plan

### Setup skill verification
1. Install the skill in a fresh Next.js App Router project and a fresh Pages Router project
2. Run through all steps, confirm each file is created correctly
3. Verify dev server starts without errors
4. Verify locale switching works (URL prefix changes, content changes)
5. Verify Server Component translations render (App Router)
6. Verify Client Component translations render (both routers)

### Convert skill verification
1. Install in a project with next-intl already configured
2. Create a component with hardcoded strings
3. Run the skill, confirm strings are wrapped correctly
4. Confirm message keys are added to JSON files
5. Verify the app still renders correctly

### Eval fixtures (future)
- `fixtures/nextjs-app-router/` — minimal App Router project
- `fixtures/nextjs-pages-router/` — minimal Pages Router project
- Expectations: wrapped strings, min files with translations, message key counts
