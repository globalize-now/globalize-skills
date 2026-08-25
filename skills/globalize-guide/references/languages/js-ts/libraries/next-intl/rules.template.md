---
name: next-intl-code
user_invocable: false
description: >-
  Apply automatically whenever writing or modifying UI code in a next-intl
  project — new components, new strings, edited copy, new form fields, anything
  that adds or changes user-visible text. Not user-invocable. Ensures strings,
  numbers, currencies, dates, and plurals are wrapped correctly as code is
  written, so nothing needs fixing after the fact.
template: next-intl
templateVersion: 2
conditions: [router, localeNavigation, catalogFormat, paramsShape, localeSource]
values: [i18nRequestPath, i18nNavigationPath, importPrefix, localeSegment, catalogPath, sourceLocale, targetLocales]
budget: { "router == \"app\"": 240, "default": 200 }
---

# next-intl Coding Rules

Apply these rules as you write code. Every user-visible string must be wrapped before the task is complete.

**This project:**
- Catalogs: `<<catalogPath>>` — add every new message here in the same change that uses it.
- Source locale `<<sourceLocale>>` (write every source string in it); target locales `<<targetLocales>>`.

## API decision tree

```
Does the string's wording change based on a number ("3 items" / "1 item")?
  YES → ICU plural inside one message — t('key', { count })
        (see "Plurals, select, and ICU MessageFormat" below)

Does the string contain markup (a link, <strong>, …)?
  YES → t.rich('key', { tag: chunks => <Component>{chunks}</Component> })
        Trusted raw HTML you control end-to-end → t.markup (rare; never with
        translator-provided markup)
```
<!-- if: router == "app" -->

```
Server Component (the file has no 'use client' directive)?
  YES → const t = await getTranslations('Namespace')   // 'next-intl/server'

Client Component ('use client'), or a custom hook used by one?
  YES → const t = useTranslations('Namespace')          // 'next-intl'

Need a number, date, currency, or relative time?
  YES → useFormatter() (client) / await getFormatter() (server)
```
<!-- else -->

```
Any component — a page, or anything nested under one?
  ALL → const t = useTranslations('Namespace')          // 'next-intl'
        There is no getTranslations on the Pages Router request lifecycle.

Loading a page's messages?
  YES → getStaticProps/getServerSideProps → props.messages → <NextIntlClientProvider>

Need a number, date, currency, or relative time?
  YES → useFormatter()
```
<!-- /if -->

Check the plural question first. Two separate keys ("oneItem" / "manyItems") plus a JS ternary bakes English plural rules into the call site and breaks every language whose rules differ.

### Import reference

| API | Module |
|-----|--------|
| `useTranslations`, `useFormatter`, `useLocale`, `useNow`, `useTimeZone`, `NextIntlClientProvider` | `next-intl` |
<!-- if: router == "app" -->
| `getTranslations`, `getFormatter`, `getLocale`, `getNow`, `getTimeZone`, `getMessages`, `setRequestLocale` | `next-intl/server` |
<!-- /if -->
<!-- if: localeNavigation == "create-navigation" -->
| `Link`, `redirect`, `useRouter`, `usePathname`, `getPathname` | `<<i18nNavigationPath>>` (locale-aware wrappers from `createNavigation`) |
<!-- /if -->
<!-- if: router == "app" -->

Server async APIs (`getTranslations`, `getFormatter`, `getMessages`, …) **must be `await`ed**. They throw at runtime if used unawaited.
<!-- /if -->

## Common patterns

**JSX text:**
<!-- if: router == "app" -->
```tsx
// Server component (no 'use client')
const t = await getTranslations('Dashboard');   // 'next-intl/server'
return <h1>{t('title')}</h1>;

// Client component ('use client')
const t = useTranslations('Counter');           // 'next-intl'
return <button>{t('increment')}</button>;
```
<!-- else -->
```tsx
const t = useTranslations('Counter');           // 'next-intl'
return <button>{t('increment')}</button>;
```
<!-- /if -->

**Props and attributes** — `placeholder`, `aria-label`, `alt`, `title` are user-visible too:
```tsx
const t = useTranslations('Search');
return <input placeholder={t('placeholder')} aria-label={t('label')} />;
```

Never write an inline English fallback (`t('greeting') ?? 'Hello'`). next-intl handles missing keys; a fallback masks catalog drift.

**Interpolation and rich text.** The variable name in the message (`{name}`) and at the call site (`{name: ...}`) must match exactly. Reach for `t.rich` whenever a translated sentence wraps part of itself in markup: splitting it into separate keys ("By signing up you agree to our", "terms", ".") produces ungrammatical translations, because word order varies between languages. Every tag handler is a function taking `chunks` — never a bare JSX element.

<!-- if: catalogFormat == "po" -->
```po
#. Greeting at the top of the dashboard
#: src/components/Dashboard.tsx
msgid "Dashboard.greeting"
msgstr "Hello, {name}!"
msgid "SignUp.terms"
msgstr "By signing up you agree to our <link>terms</link>."
```
<!-- else -->
```json
{
  "greeting": "Hello, {name}!",
  "terms": "By signing up you agree to our <link>terms</link>."
}
```
<!-- /if -->
```tsx
t('greeting', { name: user.name })
t.rich('terms', { link: (chunks) => <a href="/terms">{chunks}</a> })
```

**Constants and copy modules.** Never put translated strings in module-level constants — `t` is undefined at module load, and the locale is bound per request, so whichever locale loaded first would freeze across all of them:

```tsx
// WRONG
const NAV_ITEMS = [{ label: t('home') }, { label: t('settings') }];
```

Resolve translations inside the component (or async server function). When shared copy lives in another module, export the **key**, not a translated value:

```tsx
// lib/nav.ts
export const NAV = [{ key: 'home', href: '/' }, { key: 'settings', href: '/settings' }] as const;
// components/Nav.tsx — import { NAV } from '<<importPrefix>>lib/nav'
const t = useTranslations('Nav');
return NAV.map(item => <Link key={item.key} href={item.href}>{t(item.key)}</Link>);
```

Keep keys statically analysable: a string literal, or a member of an `as const` literal union as above. ``t(`home_${variant}`)`` and `t(someArbitraryString)` defeat both type-checking and extraction — branch in JS and call `t` with the right literal in each branch.

<!-- if: router == "app" -->
## App Router (RSC) rules

Decide **server vs client** before choosing a pattern.

**Server components** (no `'use client'`):
- Use `getTranslations()` and `getFormatter()` — both async, both must be `await`ed.
- Leave `<NextIntlClientProvider>` in `app/<<localeSegment>>/layout.tsx` without an explicit `messages` prop unless you need to filter; next-intl then serialises only what the client tree references. Passing every message ships the whole catalog to every page.

**Client components** (`'use client'`):
- Use `useTranslations()` and `useFormatter()` (synchronous hooks), inside the `<NextIntlClientProvider>` tree.
- Take `Link`, `useRouter`, `usePathname` and `redirect` from `<<i18nNavigationPath>>`, never from `next/link` or `next/navigation`.

```tsx
'use client';
const t = useTranslations('Cart');
const format = useFormatter();
return <span>{t('total', { amount: format.number(amount, { style: 'currency', currency: 'USD' }) })}</span>;
```
<!-- else -->
## Pages Router rules

`useTranslations` and `useFormatter` are the canonical APIs in every page and nested component — there is no `getTranslations` equivalent on the Pages Router request lifecycle. Load `messages` in `getStaticProps` (or `getServerSideProps`) and feed them to a top-level `<NextIntlClientProvider>` in `_app.tsx`:

```tsx
// pages/_app.tsx — wraps the whole tree once
const { locale } = useRouter();                    // 'next/router'
return (
  <NextIntlClientProvider locale={locale} messages={pageProps.messages}>
    <Component {...pageProps} />
  </NextIntlClientProvider>
);
```

In every page that renders translated text, `getStaticProps` must dynamic-`import()` this project's catalog file for the requested `locale` (see `<<catalogPath>>`) and return it as `props.messages`. The literal file extension inside the `import()` string is what next-intl's loader matches on — it must match the catalogs on disk.
<!-- /if -->

<!-- if: paramsShape == "promise" -->
Route `params` is a **Promise** on Next.js 15+ — `await` it before anything else:

```tsx
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // then apply the locale-resolution rule below
}
```

<!-- /if -->
<!-- if: paramsShape == "sync" -->
Route `params` is a **plain object** on Next.js 13–14 — destructure it directly and never `await` it:

```tsx
export default async function Page({ params: { locale } }: { params: { locale: string } }) {
  // `locale` is available synchronously; then apply the locale-resolution rule below
}
```

<!-- /if -->
<!-- if: localeSource == "request-locale" -->
## Locale resolution (server)

Every page rendered under `generateStaticParams` (or any static segment) **must call `setRequestLocale(locale)` before any translation lookup** — in the page itself, not only in the layout. Next does not propagate the layout's call into pages. Without it the page silently drops back to dynamic rendering on every request, and the tests still pass.

```tsx
import {setRequestLocale} from 'next-intl/server';
setRequestLocale(locale);            // first statement, before any getTranslations/useTranslations
```

Client components (`'use client'`) do not need it — static rendering applies to server components only.
<!-- /if -->
<!-- if: localeSource == "root-params" -->
## Locale resolution (server)

Locale is resolved once in `<<i18nRequestPath>>` via `await rootParams.locale()`. **Never call `setRequestLocale`** — it is deprecated and does nothing this project needs. Pages under `generateStaticParams` still need `generateStaticParams` itself for static rendering; nothing else per page.

`next/root-params` does not work in **Route Handlers or Server Actions**. There, take the locale as an explicit function argument and pass it through: `getTranslations({locale})`.
<!-- /if -->

## Plurals, select, and ICU MessageFormat

Any time a string's wording depends on a number — singular/plural nouns, subject-verb agreement, anything count-sensitive — it is a plural string. Keep every form inside a single message; never branch in JS.

<!-- if: catalogFormat == "po" -->
`msgid` is the full namespace dot-path: `useTranslations('Cart')` + `t('items')` → `msgid "Cart.items"`. ICU goes inside `msgstr`. Never use gettext `msgid_plural` / `msgstr[0]` / `msgstr[1]` — next-intl evaluates ICU in a single `msgstr`, and the gettext `Plural-Forms` header is informational only. Give every entry a `#.` description and a `#:` source reference (elided in the examples below for brevity — never elide them in a real catalog), and use `msgctxt` to disambiguate identical source strings.

```po
msgid "Cart.items"
msgstr "{count, plural, one {# item} other {# items}}"
msgid "Cart.itemsLeft"
msgstr "{count, plural, =0 {No items} one {# item} other {# items}}"
msgid "Search.results"
msgstr "Found {count, plural, one {# result} other {# results}} for \"{query}\"."
msgid "Post.reaction"
msgstr "{gender, select, male {He liked it} female {She liked it} other {They liked it}}"
msgid "Race.place"
msgstr "You finished in {position, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} place."
msgid "Poll.votes"
msgstr "{count, plural, one {<strong>1</strong> vote} other {<strong>#</strong> votes}}"
```
<!-- else -->
```json
{
  "items":     "{count, plural, one {# item} other {# items}}",
  "itemsLeft": "{count, plural, =0 {No items} one {# item} other {# items}}",
  "results":   "Found {count, plural, one {# result} other {# results}} for \"{query}\".",
  "reaction":  "{gender, select, male {He liked it} female {She liked it} other {They liked it}}",
  "place":     "You finished in {position, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} place.",
  "votes":     "{count, plural, one {<strong>1</strong> vote} other {<strong>#</strong> votes}}"
}
```
<!-- /if -->
```tsx
t('items', { count })                    // plural
t('itemsLeft', { count })                // exact match on zero
t('results', { count, query })           // plural inside a longer sentence
t('reaction', { gender })                // select
t('place', { position })                 // selectordinal — 1st / 2nd / 3rd
t.rich('votes', { count, strong: (chunks) => <strong>{chunks}</strong> })   // plural + markup
```

### Rules

- `other` is always required — it is the fallback for all languages.
- `#` is the count placeholder — do not repeat the variable name (`# items`, not `{count} items`).
- CLDR categories: `zero`, `one`, `two`, `few`, `many`, `other` — not `singular` / `plural`.
- English cardinals use only `one` and `other`; add `zero` only for a special-cased phrase.
- Ordinal categories differ from cardinal — English ordinals use `one` (1st, 21st), `two` (2nd, 22nd), `few` (3rd, 23rd), `other` (4th+).
- Never use a JS ternary to pick between two separate translation keys.
- Always pass the variable using the same name the message uses (`count`, `gender`, `position`, …).

## Numbers, currencies, dates, relative time

Never hardcode formatted numbers, currency symbols, or date strings. Use the formatter — it wraps `Intl.NumberFormat` / `Intl.DateTimeFormat` with the active locale.

```tsx
const format = useFormatter();                 // client — 'next-intl'
format.number(amount, { style: 'currency', currency: 'USD' })
format.relativeTime(postedAt)
```
<!-- if: router == "app" -->

```tsx
const format = await getFormatter();           // server — 'next-intl/server'
format.dateTime(publishedAt, { dateStyle: 'medium' })
```

**Named formats** — define reusable presets in `<<i18nRequestPath>>` (part of the object `getRequestConfig` returns), then use them by name: `format.dateTime(date, 'short')`, `format.number(value, 'precise')`.
<!-- else -->

**Named formats** — define reusable presets as the `formats` prop of `<NextIntlClientProvider>` in `_app.tsx`, then use them by name: `format.dateTime(date, 'short')`, `format.number(value, 'precise')`.
<!-- /if -->

```ts
formats: { dateTime: { short: { day: 'numeric', month: 'short', year: 'numeric' } },
           number: { precise: { maximumFractionDigits: 5 } } }
```

**Currency requires a `currency` option** — `Intl` throws without it. Keep currency codes in code, not in messages.

**Flag for review:** `toFixed()`, currency symbols concatenated with numbers (`"$" + price`), date format strings like `"MM/DD/YYYY"`, locale-naive `new Date().toLocaleDateString()` calls without an explicit locale.
<!-- if: localeNavigation == "create-navigation" -->

## Locale-aware navigation

`<<i18nNavigationPath>>` calls `createNavigation(routing)` and re-exports `Link`, `redirect`, `useRouter`, `usePathname`, `getPathname`. Use those, never `next/link` or `next/navigation` — Next's own `Link` is locale-blind and emits `/about` whatever the active locale is.

```tsx
import { Link } from '<<importPrefix>>i18n/navigation';
```

| Replace | With, from the module above |
|---|---|
| `Link` from `next/link` | `Link` |
| `useRouter`, `redirect` from `next/navigation` | `useRouter`, `redirect` |
| `usePathname` from `next/navigation` | `usePathname` — returns the path **without** the locale prefix |

For server-side URL generation (metadata, sitemaps, og tags) use `getPathname({ href, locale })`. When editing a component that imports from `next/link` or `next/navigation`, switch it to the locale-aware module unless the component sits outside every locale-prefixed segment.
<!-- /if -->

## What not to wrap

Skip these — wrapping them causes false extractions or breaks the build:

- CSS class names: `className="font-bold text-sm"` — but when writing new CSS use logical properties (`margin-inline-start`, not `margin-left`; `ms-4`, not `ml-4` in Tailwind). See the `css-i18n` skill.
- `console.log` / debug strings.
- Import paths and module identifiers.
- Object keys, internal codes, `data-testid`, `data-*` attributes.
- `ALL_CAPS` enum values.
- URL strings and API paths.
- Currency codes (`'USD'`, `'EUR'`) — identifiers, not user-visible text.
- `<html lang>` value — a BCP47 tag, not translated copy.

Wrap whole phrases, not isolated words. "Save" on its own translates differently in different contexts; extract the surrounding sentence, or give it a namespace that supplies the context.
