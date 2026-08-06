# LinguiJS: locale-aware navigation and the language switcher

This is the **last** of three setup references for every React/Lingui variant. Read it after the framework-specific file — it needs the routing strategy that file asked the user to choose.

It owns `<i18nDir>/navigation.ts` and `<componentsDir>/LanguageSwitcher.tsx`. The ownership rule and the module inventory are in `setup.locale-module.md`; the same rule applies here.

Apply the usual guided / unguided rules.

---

## 1. Prerequisites

Do not start this file until both hold:

1. The **Locale Routing Strategy** gate in the framework setup reference has been presented and answered, and the answer is recorded in `.globalize/decisions.md` → `## Routing strategy`.
2. `<i18nDir>/locales.ts` from `setup.locale-module.md` is on disk.

If the gate was never presented, **do not pick a default.** Write `status: "needs_decision"` to the progress file with `needsDecision: { step: "locale_routing_strategy" }` and stop. A navigation module built on the wrong strategy silently emits wrong URLs on every page.

`<i18nDir>` and `<componentsDir>` are the values resolved in `setup.locale-module.md` §1. Do not re-derive them.

## 2. Strategy vocabulary

Framework references name the same three strategies `1/2/3` (Next.js, Vite, TanStack) or `A/B/C` (Remix, React Router). Map the user's answer once, then use only the right-hand column for the rest of this file.

| Framework wording | Canonical |
|---|---|
| "Unprefixed source locale" — Strategy 1 / Strategy A | `unprefixed-source` |
| "All locales prefixed" — Strategy 2 / Strategy B | `all-prefixed` |
| "Skip locale routing" / "Cookie-only" — Strategy 3 / Option 3 / Strategy C | `no-url-locale` |

## 3. What to emit

**Under `no-url-locale`, do not create `navigation.ts` at all.** Skip to §6 for the switcher and stop.

Do not emit an identity `useLocalePath` that returns its argument. It is a permanent import that does nothing, and its presence tells every future agent reading the project that URL locales exist here — which is the opposite of true.

For the two URL strategies, which exports land depends on the **router**, not only the variant. The Vite references cover TanStack Router, React Router, and a plain SPA in one document, so read the router from `package.json` before filling this in.

| Variant / router | `stripLocalePrefix` | `localePath` | `switchLocalePath` | `useLocale` | `useLocalePath` |
|---|---|---|---|---|---|
| `nextjs-app-router-lingui` | yes | yes | yes | yes | yes |
| `react-router-framework-*` | yes | yes | yes | yes | yes |
| `remix-*` | yes | yes | yes | yes | yes |
| `vite-*` + React Router | yes | yes | yes | yes | yes |
| `vite-*` + **TanStack Router** | yes | yes | yes | yes | **no** |
| `tanstack-start-*` | yes | yes | yes | yes | **no** |

The TanStack opt-out is **per-export, not per-file** — those stacks still need the string helpers for the switcher, canonical tags, `hreflang`, and any non-router URL. See §5.

## 4. Create `<i18nDir>/navigation.ts`

### The pure half

```ts
// <i18nDir>/navigation.ts
import { locales, sourceLocale, type Locale } from './locales'

/** Split a pathname into its locale prefix (if any) and the rest. Pass a pathname, not a full URL. */
export function stripLocalePrefix(pathname: string): { locale: Locale | null; pathname: string } {
  const segments = pathname.split('/')
  const first = segments[1]
  if (first && (locales as readonly string[]).includes(first)) {
    const rest = '/' + segments.slice(2).join('/')
    return { locale: first as Locale, pathname: rest === '/' ? '/' : rest.replace(/\/$/, '') }
  }
  return { locale: null, pathname }
}

/** Prefix a locale-free route path with a locale. */
export function localePath(path: string, locale: Locale): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (locale === sourceLocale) return normalized   // ← `unprefixed-source` only; delete for `all-prefixed`
  return normalized === '/' ? `/${locale}` : `/${locale}${normalized}`
}

/** The current page in another locale. Powers the switcher, hreflang, and canonical tags. */
export function switchLocalePath(pathname: string, targetLocale: Locale): string {
  return localePath(stripLocalePrefix(pathname).pathname, targetLocale)
}
```

Four things here are deliberate:

- **`localePath(path, locale)` takes the path first**, matching `stripLocalePrefix(pathname)` and `switchLocalePath(pathname, …)`. The thing being transformed always comes first.
- **The second parameter is typed `Locale`, not `string`.** Two adjacent string parameters invite a silent argument swap that produces `/en/fr` at runtime instead of a type error. The literal union makes the swap a compile error and forces untrusted input — a route param, a cookie, a header — through `resolveLocale()` first.
- **The strategy lives in exactly one line.** `unprefixed-source` keeps the `sourceLocale` early return; `all-prefixed` deletes it. Nothing else in the module, and nothing in the generated coding rules, needs to know which the project chose.
- **`switchLocalePath` replaces the strip-then-reprefix loop** that was previously written out in every language switcher and every `hreflang` export. An `hreflang` list becomes `locales.map(l => siteUrl + switchLocalePath(pathname, l))`.

Known limitation worth stating to the user if it applies: a top-level route whose path equals a locale code — `/no` in a project that also ships Norwegian — is ambiguous, and `stripLocalePrefix` will read it as a locale. Rename the route or add an explicit exception.

### The hooks half

Append to the same file. Only `useLocale` differs per framework; everything below it is identical everywhere.

```ts
export function useLocale(): Locale { /* per framework — table below */ }

export function useLocalePath(): (path: string) => string {
  const locale = useLocale()
  return useCallback((path: string) => localePath(path, locale), [locale])
}
```

Add `import { useCallback } from 'react'` and `import { resolveLocale } from './locales'` to the file header. `useCallback` is not decoration — without it, every consumer passing `localePath` down to a memoized child re-renders on each parent render.

| Stack | `useLocale()` body |
|---|---|
| Next.js App Router | `import { useParams } from 'next/navigation'`<br>`const params = useParams()`<br>`return resolveLocale(typeof params?.locale === 'string' ? params.locale : null)` |
| React Router v7 | `import { useRouteLoaderData } from 'react-router'`<br>`const root = useRouteLoaderData('root') as { locale?: string } \| undefined`<br>`return resolveLocale(root?.locale)` |
| Remix v2 | `import { useRouteLoaderData } from '@remix-run/react'` — body identical to React Router v7 |
| Vite + React Router | `import { useParams } from 'react-router'`<br>`return resolveLocale(useParams().locale)` |
| TanStack Start / TanStack Router | `import { useParams } from '@tanstack/react-router'`<br>`const params = useParams({ strict: false }) as { locale?: string }`<br>`return resolveLocale(params.locale)` |

On React Router v6, `useParams` comes from `react-router-dom`, not `react-router`. Check the installed major.

Three notes on why these bodies are what they are:

- **Use `useRouteLoaderData('root')`, never `useLoaderData()`.** `useLoaderData` returns the *closest* route's loader data, so it only carries `locale` in components rendered directly by `root.tsx`. Any navigation component mounted under a child route would get `undefined`, fall through to the source locale, and emit unprefixed links for every target locale — a bug that shows up only on nested routes.
- **TanStack reads `useParams({ strict: false })`, not the root route's context.** Reading `Route as RootRoute` from `routes/__root` would make `<i18nDir>/` import from the route tree, an inverted dependency. `strict: false` returns `undefined` on unprefixed `unprefixed-source` routes, which `resolveLocale` maps to the source locale — correct under both strategies, with no import cycle.
- **`resolveLocale` absorbs the fallback**, which is why no call site needs `locale ?? sourceLocale` any more.

### One module or two

Keep the pure functions and the hooks in one unmarked `navigation.ts` — no `'use client'`, no `.client.ts` / `.server.ts` suffix. Next.js only errors when a client hook is *invoked* during a server render, not when its module is imported, and on React Router v7 and Remix a `.client.ts` suffix is a bundler directive that would strip `useLocalePath` from the server bundle and break SSR.

**Do not import this module from Next.js middleware or `proxy.ts`.** Middleware runs on the Edge runtime and does not need it — it builds paths from the `locales.ts` constants directly. If a Next build ever objects to the mixed module, split it into `navigation.ts` (pure) and `navigation.hooks.ts`, and say so in the progress file so the coding-rules step points at the right specifier.

## 5. Using it

```tsx
// Inside a React component
import { useLocalePath } from '<specifier>/navigation'
const localePath = useLocalePath()
<Link href={localePath('/about')}>About</Link>      // `href` on Next.js, `to` on React Router / Remix
```

```tsx
// Anywhere hooks don't run — Server Components, loaders, actions, redirect(), generateMetadata
import { localePath } from '<specifier>/navigation'
redirect(localePath('/dashboard', locale))
```

Pass `localePath` a **locale-free** path. Feeding it one that already carries a prefix double-prefixes it; strip it first with `stripLocalePrefix`.

### Migrating existing links

Tell the user which call sites need review, and do the mechanical ones:

- `<Link href="/…">` / `<Link to="/…">` / `<NavLink to="/…">` — wrap the target with `localePath(...)`
- `<a href="/…">` pointing at an internal route — convert to the framework's `<Link>`, then wrap
- `navigate('/…')`, `router.push('/…')`, `router.replace('/…')` — wrap the argument
- `redirect('/…')` inside a loader, action, or Server Component — wrap with the two-argument form
- Any `` `/${locale}/…` `` template literal already in the codebase — replace with `localePath`

Navigation components — headers, sidebars, footers — are the highest priority; they appear on every page.

### TanStack Router: use the router's own `<Link>`

TanStack Router's `<Link>` is deeply typed: `to` and `params` are generic over the generated route tree, and a component wrapper erases that inference. Do not wrap it, and do not emit `useLocalePath` on these stacks. Take the locale from `useLocale()` and use the native API:

```tsx
import { Link } from '@tanstack/react-router'
import { useLocale } from '<specifier>/navigation'

const locale = useLocale()
<Link to="/$locale/about" params={{ locale }}>About</Link>
```

Under `unprefixed-source` the route tree genuinely holds two routes per page — `/about` and `/$locale/about` — with different param types, so links must branch. Write the branch **once per navigation component, not once per link**, by declaring the items as an `as const` array:

```tsx
const NAV = [
  { label: msg`Home`,  to: '/',      localeTo: '/$locale' },
  { label: msg`About`, to: '/about', localeTo: '/$locale/about' },
] as const

function Navigation() {
  const { t } = useLingui()
  const locale = useLocale()
  const isSource = locale === sourceLocale
  return (
    <nav>
      {NAV.map((item) =>
        isSource
          ? <Link key={item.to} to={item.to}>{t(item.label)}</Link>
          : <Link key={item.to} to={item.localeTo} params={{ locale }}>{t(item.label)}</Link>,
      )}
    </nav>
  )
}
```

`as const` keeps `to` and `localeTo` literal types, so `<Link>`'s inference is fully intact. Under `all-prefixed`, drop the `localeTo` column and the branch.

For URLs that are **not** router navigation — canonical tags, `hreflang`, `window.location`, external redirects — use the string helpers from `navigation.ts` as normal.

## 6. Language switcher

Create `<componentsDir>/LanguageSwitcher.tsx`. Every stack shares the same shape:

- iterate `locales` from the locale module
- label each option with `localeDisplayName(loc)` — never construct `Intl.DisplayNames` by hand
- mark the active locale (`fontWeight: 600`, `aria-current`, or the project's own convention)
- under a URL strategy, the target is `switchLocalePath(pathname, loc)`

What differs is **how the choice is committed**, which the framework file already established. Use its mechanism:

| Stack | Commit mechanism |
|---|---|
| Next.js App Router | `router.replace(switchLocalePath(usePathname(), loc))` from `next/navigation` in a `'use client'` component; write the cookie too under `no-url-locale` |
| React Router v7 | `<Form method="post" action="/set-locale">` with hidden `locale` and `returnTo={switchLocalePath(location.pathname, loc)}`; the action route sets the cookie and redirects |
| Remix v2 | same `<Form>`-to-action shape as React Router v7 |
| TanStack Start | `await setLocale({ data: loc })`, then `window.location.href = switchLocalePath(location.pathname, loc)` — a full document navigation so the next SSR sees the new cookie |
| Vite + any router (SPA) | write the locale to `localStorage`, call `activateLocale`, and navigate to `switchLocalePath(window.location.pathname, loc)` |

Under `no-url-locale` there is no URL to change: commit the cookie or `localStorage` value and reload. A `<select>` is the right control there — there is nothing to link to.

Keep the framework file's rationale for its mechanism; it explains why a client-side swap alone desyncs from the cookie. **Styling:** inline styles are a baseline only — match the project's CSS approach and the surrounding navigation.

Place the switcher wherever the framework file says. If the project already has a header or navigation component, put it there rather than in the root layout.

## 7. Self-check

```bash
# The strip-and-reprefix loop exists once, inside the navigation module.
grep -rn "startsWith(\`/\${" <source root> | grep -v "/i18n/navigation"   # → no output
# No hand-built display names outside the locale module.
grep -rn "new Intl.DisplayNames" <source root> | grep -v "/i18n/locales"  # → no output
# No inline locale prefixing left in components.
grep -rn '`/\${locale}' <source root>                                     # → review every hit
# Vite variants: the superseded flat helper is gone.
test -f src/localePath.ts && echo "FAIL: src/localePath.ts superseded by <i18nDir>/navigation.ts"
```

Then continue with the framework file's remaining sections and the coding-rules step.
