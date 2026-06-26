---
name: next-intl-code
user_invocable: false
description: >-
  Apply automatically whenever writing or modifying UI code in a next-intl
  project — new components, new strings, edited copy, new form fields, anything
  that adds or changes user-visible text. Not user-invocable. Ensures strings,
  numbers, currencies, dates, and plurals are wrapped correctly as code is
  written, so nothing needs fixing after the fact.
---

# next-intl Coding Rules

Apply these rules as you write code. Every user-visible string must be wrapped before the task is complete.

---

## API decision tree

```
Does the string's wording change based on a number (e.g. "3 items" / "1 item")?
  YES → ICU plural inside the message — t('key', { count })
        (see "Plurals, select, and ICU MessageFormat" below)

Does the string contain markup (a link, <strong>, etc.)?
  YES → t.rich('key', { tag: chunks => <Component>{chunks}</Component> })

Does the message contain trusted raw HTML you control end-to-end?
  YES → t.markup (rare; never with translator-provided markup)

Are you in a Server Component (the file has no 'use client' directive)?
  YES → const t = await getTranslations('Namespace')   // from 'next-intl/server'
        Pages Router server data fns → return { props: { messages } } and
        wrap _app.tsx in <NextIntlClientProvider>

Are you in a Client Component ('use client') or a custom hook used by one?
  YES → const t = useTranslations('Namespace')          // from 'next-intl'

Need a number, date, currency, or relative time?
  YES → useFormatter() (client) / await getFormatter() (server)
```

Check the plural question first. Plain `t('itemCount')` with two separate keys ("oneItem"/"manyItems") and a JS ternary bakes English plural rules into the call site and breaks every language with different rules.

### Import reference

| API | Module |
|-----|--------|
| `useTranslations` | `next-intl` |
| `useFormatter`, `useLocale`, `useNow`, `useTimeZone` | `next-intl` |
| `getTranslations` | `next-intl/server` |
| `getFormatter`, `getLocale`, `getNow`, `getTimeZone`, `getMessages` | `next-intl/server` |
| `setRequestLocale` | `next-intl/server` |
| `NextIntlClientProvider` | `next-intl` |
| `Link`, `redirect`, `useRouter`, `usePathname`, `getPathname` | the project's `i18n/navigation.ts` (locale-aware wrappers from `createNavigation`) |

Server async APIs (`getTranslations`, `getFormatter`, `getMessages`, …) **must be `await`ed**. They throw at runtime if used unawaited.

---

## Common patterns

**JSX text:**
```tsx
// Server component
import { getTranslations } from 'next-intl/server';
export default async function Dashboard() {
  const t = await getTranslations('Dashboard');
  return <h1>{t('title')}</h1>;
}

// Client component
'use client';
import { useTranslations } from 'next-intl';
export function Counter() {
  const t = useTranslations('Counter');
  return <button>{t('increment')}</button>;
}
```

**Props and attributes (placeholder, aria-label, alt, title):**
```tsx
const t = useTranslations('Search');
return <input placeholder={t('placeholder')} aria-label={t('label')} />;
```

**Interpolation:**
```json
{ "greeting": "Hello, {name}!" }
```
```tsx
t('greeting', { name: user.name })
```

The variable name in the message (`{name}`) and the call site (`{name: ...}`) must match exactly.

**Rich text — markup interpolation:**
```json
{ "terms": "By signing up you agree to our <link>terms</link>." }
```
```tsx
t.rich('terms', {
  link: (chunks) => <a href="/terms">{chunks}</a>,
})
```

Use `t.rich` whenever a translated sentence wraps part of itself in markup. Splitting the sentence into separate keys ("By signing up you agree to our", "terms", ".") almost always produces ungrammatical translations because word order varies between languages.

**Constants and copy modules:**

Do **not** put translated strings in module-level constants outside a component:

```tsx
// WRONG — t() is undefined at module load; even if it weren't, the locale
// is bound per-request and this would freeze whichever locale loaded first.
const NAV_ITEMS = [{ label: t('home') }, { label: t('settings') }];
```

Resolve translations inside the component (or async server function) where the request locale is bound:

```tsx
function Nav() {
  const t = useTranslations('Nav');
  const items = [
    { key: 'home',     label: t('home'),     href: '/' },
    { key: 'settings', label: t('settings'), href: '/settings' },
  ];
  return items.map(i => <Link key={i.key} href={i.href}>{i.label}</Link>);
}
```

If shared copy lives in another module, export the **key** (a string literal), not a translated value:

```ts
// lib/nav.ts
export const NAV = [
  { key: 'home',     href: '/' },
  { key: 'settings', href: '/settings' },
] as const;
```

```tsx
// components/Nav.tsx
import { NAV } from '@/lib/nav';
const t = useTranslations('Nav');
return NAV.map(item => <Link key={item.key} href={item.href}>{t(item.key)}</Link>);
```

---

## Next.js App Router (RSC) rules

If the project uses Next.js App Router, decide **server vs client** before choosing a pattern.

**Server components** (no `'use client'`):

- Use `getTranslations()` and `getFormatter()` (both async, both must be `await`ed).
- Every page that runs under `generateStaticParams` (or any static segment) **must call `setRequestLocale(locale)` before any translation lookup** — including pages, not just layouts. Without it, next-intl falls back to dynamic rendering and the page becomes server-rendered on every request.

```tsx
// app/[locale]/some-page/page.tsx
import { getTranslations, setRequestLocale } from 'next-intl/server';

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);                  // required for static rendering
  const t = await getTranslations('SomePage');
  return <h1>{t('title')}</h1>;
}
```

- For the `<NextIntlClientProvider>` boundary in `app/[locale]/layout.tsx`: pass only the messages your client tree actually uses. Passing all messages bloats every page's client bundle. The simplest safe default is `<NextIntlClientProvider>` without an explicit `messages` prop — next-intl reads from request context and serializes only what's referenced. Pass `messages={...}` explicitly only when you need to filter.

**Client components** (`'use client'`):

- Use `useTranslations()` and `useFormatter()` (synchronous hooks).
- Must be inside the `<NextIntlClientProvider>` tree.
- Locale-aware navigation (`Link`, `useRouter`, `usePathname`) lives in the project's `i18n/navigation.ts` — see the Navigation section below.

```tsx
'use client';
import { useTranslations, useFormatter } from 'next-intl';

export function Price({ amount }: { amount: number }) {
  const t = useTranslations('Cart');
  const format = useFormatter();
  return <span>{t('total', { amount: format.number(amount, { style: 'currency', currency: 'USD' }) })}</span>;
}
```

---

## Pages Router rules

`useTranslations` and `useFormatter` are the canonical APIs across pages — there is no `getTranslations` equivalent on the Pages Router request lifecycle. Load `messages` in `getStaticProps` (or `getServerSideProps`) and feed them to a top-level `<NextIntlClientProvider>` in `_app.tsx`:

```tsx
// pages/_app.tsx
import { NextIntlClientProvider } from 'next-intl';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps }) {
  const { locale } = useRouter();
  return (
    <NextIntlClientProvider locale={locale} messages={pageProps.messages}>
      <Component {...pageProps} />
    </NextIntlClientProvider>
  );
}
```

```tsx
// pages/index.tsx
export async function getStaticProps({ locale }) {
  return {
    props: {
      messages: (await import(`../messages/${locale}.json`)).default,
    },
  };
}
```

Inside any component (page or nested), use `useTranslations` and `useFormatter` exactly as in App Router client components.

---

## Plurals, select, and ICU MessageFormat

**When to reach for this:** Any time a string's wording depends on a number — singular/plural nouns, subject-verb agreement, anything count-sensitive. If a count variable is part of the string, it is a plural string. Keep all forms inside a single message; never branch in JS.

The catalog value uses ICU MessageFormat; the call site passes the count by name:

```json
{ "items": "{count, plural, one {# item} other {# items}}" }
```
```tsx
t('items', { count })
```

**Exact-match for zero:**
```json
{ "items": "{count, plural, =0 {No items} one {# item} other {# items}}" }
```

**With surrounding text:**
```json
{ "results": "Found {count, plural, one {# result} other {# results}} for \"{query}\"." }
```
```tsx
t('results', { count, query })
```

**Select (gender, status):**
```json
{ "reaction": "{gender, select, male {He liked it} female {She liked it} other {They liked it}}" }
```
```tsx
t('reaction', { gender })
```

**SelectOrdinal (1st / 2nd / 3rd):**
```json
{ "place": "You finished in {position, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} place." }
```
```tsx
t('place', { position })
```

**Plural + markup** — combine ICU and `t.rich`:
```json
{ "votes": "{count, plural, one {<strong>1</strong> vote} other {<strong>#</strong> votes}}" }
```
```tsx
t.rich('votes', {
  count,
  strong: (chunks) => <strong>{chunks}</strong>,
})
```

### Rules

- `other` is always required — it is the fallback for all languages.
- `#` is the count placeholder — do not repeat the variable name (`# items`, not `{count} items`).
- CLDR categories: `zero`, `one`, `two`, `few`, `many`, `other` — not `singular` / `plural`.
- English only uses `one` and `other` for cardinals — no need for `zero` unless you want a special-cased phrase.
- Ordinal categories differ from cardinal — English ordinals use `one` (1st, 21st), `two` (2nd, 22nd), `few` (3rd, 23rd), `other` (4th+).
- Never use a JS ternary to pick between two separate translation keys.
- Always pass the variable using the same name the message uses (`count`, `gender`, `position`, …).

---

## Numbers, currencies, dates, relative time

Do not hardcode formatted numbers, currency symbols, or date strings. Use the formatter — it wraps `Intl.NumberFormat` / `Intl.DateTimeFormat` with the active locale automatically.

**Client:**
```tsx
import { useFormatter } from 'next-intl';

function Price({ amount }: { amount: number }) {
  const format = useFormatter();
  return <span>{format.number(amount, { style: 'currency', currency: 'USD' })}</span>;
}

function PostedAt({ at }: { at: Date }) {
  const format = useFormatter();
  return <time>{format.relativeTime(at)}</time>;
}
```

**Server:**
```tsx
import { getFormatter } from 'next-intl/server';

export default async function PostHeader({ publishedAt }: { publishedAt: Date }) {
  const format = await getFormatter();
  return <time>{format.dateTime(publishedAt, { dateStyle: 'medium' })}</time>;
}
```

**Named formats** — define reusable presets in `i18n/request.ts` so call sites stay terse:

```ts
// i18n/request.ts
return {
  locale,
  messages,
  formats: {
    dateTime: {
      short: { day: 'numeric', month: 'short', year: 'numeric' },
    },
    number: {
      precise: { maximumFractionDigits: 5 },
    },
  },
};
```
```tsx
format.dateTime(date, 'short')
format.number(value, 'precise')
```

**Currency requires a `currency` option** — Intl will throw without it. Keep currency codes in code, not in messages.

**Flag for review:** `toFixed()`, currency symbols concatenated with numbers (`"$" + price`), date format strings like `"MM/DD/YYYY"`, locale-naive `new Date().toLocaleDateString()` calls without an explicit locale.

---

## Locale-aware navigation

The project keeps locale-aware navigation in `i18n/navigation.ts`, which calls `createNavigation(routing)` and re-exports `Link`, `redirect`, `useRouter`, `usePathname`, `getPathname`. Use these instead of `next/link` and `next/navigation` whenever locale prefixes are in play.

```tsx
// WRONG — Next's Link is locale-blind; it produces /about regardless of the active locale.
import Link from 'next/link';

// RIGHT — locale-aware Link prefixes /de/about / /fr/about as needed.
import { Link } from '@/i18n/navigation';
```

| Original | Locale-aware replacement |
|---|---|
| `next/link` `Link` | `i18n/navigation` `Link` |
| `next/navigation` `useRouter` | `i18n/navigation` `useRouter` |
| `next/navigation` `usePathname` | `i18n/navigation` `usePathname` (returns path **without** the locale prefix) |
| `next/navigation` `redirect` | `i18n/navigation` `redirect` |

For server-side URL generation (metadata, sitemaps, og tags) use `getPathname({ href, locale })`.

When editing existing components that import from `next/link` or `next/navigation`, switch them to the locale-aware module unless the component is explicitly outside any locale-prefixed segment.

---

## What not to wrap

Skip these — wrapping them would cause false extractions or break the build:

- CSS class names: `className="font-bold text-sm"` — but when writing new CSS, use logical properties (`margin-inline-start`, not `margin-left`; `ms-4`, not `ml-4` in Tailwind). See the `css-i18n` skill.
- `console.log` / debug strings.
- Import paths and module identifiers.
- Object keys, internal codes, `data-testid`, `data-*` attributes.
- `ALL_CAPS` enum values.
- URL strings and API paths.
- Currency codes (`'USD'`, `'EUR'`) — they're identifiers, not user-visible text.
- `<html lang>` value — that's a BCP47 tag, not translated copy.

---

## Common pitfalls

- **Translation keys must be string literals.** `t('home')` works; `t(\`home_${variant}\`)` and `t(name)` do not — the build extractor relies on static analysis. If you need conditional keys, branch in JS and call `t` with the right literal in each branch.
- **Don't put translated strings in module-level constants.** The locale isn't bound at module load; either the call fails or whichever locale loaded first gets frozen across all requests.
- **Don't hardcode an English fallback inline** (`t('greeting') ?? 'Hello'`). The library handles missing keys; a fallback masks catalog drift.
- **`t.rich` callbacks must be plain functions taking `chunks`.** `link: <a href="/x">…</a>` is wrong; `link: (chunks) => <a href="/x">{chunks}</a>` is right.
- **Don't pass `messages` blindly to `<NextIntlClientProvider>` in App Router.** Without filtering you ship the entire catalog to every page on the client.
- **Forgetting `setRequestLocale` on a static page** silently downgrades the page to dynamic rendering — easy to miss because tests still pass.
- **Async server APIs must be awaited.** A missed `await getTranslations(...)` returns a Promise; the type system catches some calls but not all (e.g. `t = await ...; t('x')` works, `(await t)('x')` doesn't).
- **Don't split a sentence with markup into multiple keys.** Use `t.rich` so the translator can reorder.
- **Don't extract individual words just because they appear in the UI.** Wrap whole phrases. "Save" alone may translate differently in different contexts; either pass `context` via the namespace or write the surrounding sentence.
