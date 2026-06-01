# Remix v2 Setup (SWC)

This covers projects built on [Remix v2](https://remix.run/) (`@remix-run/*` ≥ 2.7) using the Vite-based build with `@vitejs/plugin-react-swc` — typically because the project is already on `@vitejs/plugin-react@6` (which dropped the `babel.plugins` option, making the Babel-based Lingui macro a silent no-op), or because the team has standardized on SWC for faster local transforms. Remix renders HTML on every request via its `loader` chain, so locale must be resolved server-side to avoid hydration mismatches and flash-of-untranslated-content (FOUC). The setup leans on Remix's native primitives: a root `loader` resolves the locale (cookie → `Accept-Language` → source-locale fallback), `<html lang>` is rendered from that loader's data, and per-route `loader`s import their own compiled catalog on demand.

**Detection signal:** any `@remix-run/*` runtime package in `dependencies`, `@remix-run/dev` ≥ 2.7 in `devDependencies`, `vite` in `devDependencies`, and `@vitejs/plugin-react-swc` in `devDependencies` (or `@vitejs/plugin-react@6` which the SWC variant replaces). Remix v1 and the classic (pre-Vite) compiler are rejected upstream by the orchestrator's hard-stop in `SKILL.md §1.2`.

> **Switching from `@vitejs/plugin-react` to `@vitejs/plugin-react-swc`.** If the project currently has `@vitejs/plugin-react@6+`, the orchestrator's package install already replaced it with `@vitejs/plugin-react-swc`. Both expose a default-export factory called `react`, so the `vite.config.ts` edit below replaces the import source and otherwise keeps the same call site. Describe this swap to the user before touching `vite.config.ts` — it's a dev-dep change with the same call shape, but it should be explicit so they understand why the import line moved.

## Packages

The orchestrator pre-installed the manifest's runtime and dev packages on its main thread (Phase 2.0) before dispatching you. Treat them as already on disk — do **not** re-run `npm install` / `pnpm add` for them. The set is:

- Runtime: `@lingui/core@^6`, `@lingui/react@^6`
- Dev: `@lingui/cli@^6`, `@lingui/swc-plugin@^6`, `@lingui/vite-plugin@^6`, `@vitejs/plugin-react-swc@^4`

The reasoning behind these pins: Lingui 6 is the current major (paired with React 18/19 and the new `@lingui/react/macro` import path), `@lingui/swc-plugin@^6` expands the macros under SWC, `@lingui/vite-plugin@^6` is the Vite-side companion that compiles `.po` catalogs into the runtime `.ts` modules each route loads, and `@vitejs/plugin-react-swc@^4` is the current LTS major of the SWC React plugin. The swap from `@vitejs/plugin-react` (Babel) to `@vitejs/plugin-react-swc` is what makes the SWC variant possible — the latter accepts a `plugins` option that wires arbitrary SWC plugins (including Lingui's) into the React transform.

No `@lingui/detect-locale` — that library is browser-only (`navigator`, `localStorage`, `window.location`) and would throw on the server or produce hydration mismatches under SSR. Remix resolves locale from request headers and a cookie instead, on the server side, before any client code runs.

> **Version pinning for `@lingui/swc-plugin`.** `@lingui/swc-plugin` must match the `swc_core` version shipped by `@vitejs/plugin-react-swc`. If the build fails with an AST schema or plugin invocation error (e.g., `failed to invoke plugin: ...` or `swc_core version mismatch`), look up the compatible version at <https://plugins.swc.rs> and pin it exactly — e.g. `npm install -D '@lingui/swc-plugin@5.8.0'` (note the single quotes per the project's package-pinning rule). If this happens, write `status: "needs_decision"` with `needsDecision: { step: "swc_plugin_version_pin", question: "@lingui/swc-plugin@^6 is incompatible with the swc_core in @vitejs/plugin-react-swc. Pin to a specific compatible version?", options: ["pin_exact_version", "abort_and_pick_babel_variant"] }` and exit. The orchestrator will run the pinned install on the main thread.

## Build Tool Integration

**This modifies `vite.config.ts`.** Describe the changes to the user before making them: swapping the React plugin import to `@vitejs/plugin-react-swc`, adding `['@lingui/swc-plugin', {}]` to the `react()` plugin's `plugins` array, and adding `lingui()` as a top-level Vite plugin. The Remix plugin stays first, the React plugin stays after it, and `lingui()` runs last so its catalog transform sees the already-expanded macro output from the React/SWC pass.

**Plugin order matters.** `remix()` registers Remix's route discovery and SSR transforms; `@vitejs/plugin-react-swc` (with the Lingui SWC plugin nested inside it) expands `<Trans>` and `t\`\`` into runtime calls; `lingui()` then bundles the compiled `.po` → `.ts` catalogs into the module graph so each route's `await import('./locales/...ts')` resolves at build time. Reordering breaks the chain — most commonly, putting `lingui()` before the React plugin causes catalog imports to resolve before macros expand, producing empty translations at runtime.

```ts
// vite.config.ts
import { vitePlugin as remix } from '@remix-run/dev'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { lingui } from '@lingui/vite-plugin'

export default defineConfig({
  plugins: [
    remix(),
    react({
      plugins: [['@lingui/swc-plugin', {}]],
    }),
    lingui(),
  ],
})
```

If the project already passes options to `remix()` (e.g. `ignoredRouteFiles`, `serverBuildFile`, `future` flags), preserve them — only swap the React plugin import and add the Lingui plugin around the existing call. If `react()` is already in the config with other SWC plugins, append `['@lingui/swc-plugin', {}]` to the existing `plugins` array rather than replacing it. Do not reorder other plugins — preserve any `tsconfigPaths()`, `tailwindcss()`, or custom plugins that were already present.

If both `@vitejs/plugin-react` and `@vitejs/plugin-react-swc` are present in `devDependencies` after the orchestrator's install, run `npm uninstall @vitejs/plugin-react` (or the equivalent for the project's package manager) to remove the leftover — Vite may otherwise resolve either depending on import order and lockfile state, and a stale install is the most common cause of "my SWC config is correct but macros still don't transform." If the uninstall isn't on the manifest, write `status: "needs_decision"` with `needsDecision: { step: "extra_install", question: "Remove leftover @vitejs/plugin-react (was replaced by @vitejs/plugin-react-swc). Run uninstall on the main thread?", options: ["yes", "skip"] }` and exit.

If the project's `tsconfig.json` doesn't include `"types": ["vite/client"]` (or a `references` path that does), add a `/// <reference types="vite/client" />` triple-slash directive at the top of `vite.config.ts` so `defineConfig` typings resolve.

## `lingui.config.ts`

Create `lingui.config.ts` at the project root:

```ts
// lingui.config.ts
import { defineConfig } from '@lingui/cli'

export default defineConfig({
  sourceLocale: 'en',
  locales: ['en'],
  catalogs: [
    {
      path: '<rootDir>/app/locales/{locale}/messages',
      include: ['app'],
    },
  ],
  format: 'po',
  compileNamespace: 'ts',
})
```

Replace the `locales` array with the source + target locales collected in Phase 1 (`decisions.md`). The `<rootDir>/app/locales/{locale}/messages` path means each locale gets one catalog file at `app/locales/<locale>/messages.po` (source) and a generated `app/locales/<locale>/messages.ts` (compiled). `include: ['app']` constrains extraction to Remix's app directory; if the project keeps additional source under `app/components/` or similar, that subtree is already covered. `compileNamespace: 'ts'` is required for the per-route dynamic imports below to type-check.

Add the extract and compile scripts to `package.json`:

```json
{
  "scripts": {
    "lingui:extract": "lingui extract --clean",
    "lingui:compile": "lingui compile"
  }
}
```

## Locale Resolution at the Edge

Remix has no built-in i18n primitive — locale resolution lives entirely in the root `loader`. Create a shared locale module that holds the configured locales, validates incoming strings, and exposes the cookie session helper:

```ts
// app/i18n/locales.ts
export const sourceLocale = 'en'
export const locales = ['en'] as const
export type Locale = (typeof locales)[number]

const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi'])

export function getDirection(locale: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale.split('-')[0]) ? 'rtl' : 'ltr'
}

export function resolveLocale(raw: string | undefined | null): Locale {
  if (!raw) return sourceLocale
  if ((locales as readonly string[]).includes(raw)) return raw as Locale
  // Regional fallback: es-MX → es
  const base = raw.split('-')[0]
  if ((locales as readonly string[]).includes(base)) return base as Locale
  return sourceLocale
}

export function pickFromAcceptLanguage(header: string | null): string | undefined {
  if (!header) return undefined
  // Parse the highest-q-value entry. Browsers send a sorted list already,
  // so taking the first segment is sufficient for the common case.
  return header.split(',')[0]?.split(';')[0]?.trim()
}
```

Now create the cookie session storage. A cookie-backed session is enough — we only need to read and write a single `locale` field:

```ts
// app/i18n/locale.server.ts
import { createCookieSessionStorage } from '@remix-run/node'
import { pickFromAcceptLanguage, resolveLocale, type Locale } from './locales'

const { getSession, commitSession } = createCookieSessionStorage<{ locale: Locale }>({
  cookie: {
    name: '__locale',
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  },
})

export async function resolveRequestLocale(request: Request): Promise<{ locale: Locale; setCookie: string | null }> {
  const session = await getSession(request.headers.get('Cookie'))
  const stored = session.get('locale')
  if (stored && (await isKnownLocale(stored))) {
    return { locale: stored, setCookie: null }
  }

  const headerLocale = pickFromAcceptLanguage(request.headers.get('Accept-Language'))
  const resolved = resolveLocale(stored ?? headerLocale)
  session.set('locale', resolved)
  return { locale: resolved, setCookie: await commitSession(session) }
}

export async function writeLocaleCookie(locale: string): Promise<string> {
  const session = await getSession()
  session.set('locale', resolveLocale(locale))
  return commitSession(session)
}

async function isKnownLocale(raw: string): Promise<boolean> {
  return resolveLocale(raw) === raw
}
```

If `@remix-run/cloudflare` or `@remix-run/deno` is the runtime instead of `@remix-run/node`, swap the import source — `createCookieSessionStorage` is exported identically by all three adapters. Pick the import that matches the project's existing `@remix-run/*` runtime package.

The two-step contract is: `resolveRequestLocale` reads the cookie, falls back to `Accept-Language`, validates against `locales`, and returns both the resolved value and a `Set-Cookie` string when the cookie needs to be (re)written. `writeLocaleCookie` is the inverse — called from the language-switcher action — and returns just the `Set-Cookie` string.

## Root Layout (`app/root.tsx`)

**This modifies the root route.** Show the user the exact changes before writing them. Read the existing `app/root.tsx` first and note the current `<html>` attributes — if `<html lang="en">` (or any hardcoded value) is present, flag it to the user: "Your `root.tsx` has `<html lang='en'>`. This will become `<html lang={locale} dir={dir}>` where `locale` comes from the root loader."

Remix's root route exposes two seams the setup uses: a `loader` (runs on every SSR render and root revalidation) and a default component (renders the `<html>` shell). The loader returns `{ locale, dir }` and the component reads it via `useLoaderData`.

```tsx
// app/root.tsx
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from '@remix-run/react'
import { I18nProvider } from '@lingui/react'
import { resolveRequestLocale } from './i18n/locale.server'
import { getDirection } from './i18n/locales'
import { getI18nInstance } from './i18n'

export async function loader({ request }: LoaderFunctionArgs) {
  const { locale, setCookie } = await resolveRequestLocale(request)
  return json(
    { locale, dir: getDirection(locale) },
    setCookie ? { headers: { 'Set-Cookie': setCookie } } : undefined,
  )
}

export default function Root() {
  const { locale, dir } = useLoaderData<typeof loader>()
  const i18n = getI18nInstance(locale)

  return (
    <html lang={locale} dir={dir}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <I18nProvider i18n={i18n}>
          <Outlet />
        </I18nProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
```

If `Set-Cookie` is `null`, the loader returns the JSON body with no extra headers — the `Set-Cookie` is only re-sent when the resolved locale differs from what the cookie already stored (first visit, or a stale value). This keeps cache headers clean for repeat visitors.

The `i18n` singleton is keyed by locale through a `Map` so each request reuses the same activated instance — relevant for Remix's per-request SSR model where loaders can run multiple times against the same server process:

```ts
// app/i18n/index.ts
import { i18n as defaultI18n, type I18n, setupI18n } from '@lingui/core'

const instances = new Map<string, I18n>()

export function getI18nInstance(locale: string): I18n {
  let instance = instances.get(locale)
  if (!instance) {
    instance = setupI18n({ locale, messages: {} })
    instances.set(locale, instance)
  }
  return instance
}

export { defaultI18n as i18n }
```

The `messages` payload starts empty — each route's `loader` calls `instance.loadAndActivate({ locale, messages })` with its own catalog before rendering. The component tree pulls `i18n` via React context (`I18nProvider`), so once the route loader activates the catalog the matching `<Trans>` and `useLingui()` calls render in the new locale automatically.

This module is shaped like the Next.js App Router singleton at `references/languages/js-ts/frameworks/nextjs/app-router/lingui.setup.md` (Section 1, "I18n Instance Factory") — same `Map<locale, I18n>` pattern, same one-instance-per-locale contract. The difference is wiring: Remix activates the catalog in each route `loader`, while App Router activates it in the locale layout / page server component via `setI18n`.

---

## STOP and ask user — locale routing strategy

**Remix v2 uses file-based routing. Before proceeding, present this to the user:**

> Choose a locale routing strategy:
> 1. **Unprefixed source locale** — source locale (e.g., English) keeps original URLs (`/about`). Other locales use `/<locale>/about` (e.g., `/de/about`). Best for preserving existing URLs and SEO on a site that's already live in the source locale.
> 2. **All locales prefixed** — every locale gets a prefix (`/en/about`, `/de/about`). Bare paths (`/about`) redirect to the source-locale prefix. Cleanest structure, single route tree.
> 3. **Cookie-only** — no URL changes. Locale is stored in a cookie, resolved server-side each request. Simplest setup; works well for apps that don't need locale-specific URLs.

**You MUST wait for the user to choose before proceeding. Do NOT default to option 1.** If the user does not pick one, write `status: "needs_decision"` with `needsDecision: { step: "routing_strategy", question: "Choose a locale routing strategy (A unprefixed source / B all prefixed / C cookie-only).", options: ["A_unprefixed_source", "B_all_prefixed", "C_cookie_only"] }` and exit.

The three strategies share the loader and root layout from the previous section — they differ only in route file layout and how the language switcher reshapes the URL. The next subsections walk through each.

### Strategy A — Unprefixed source locale

Source-locale URLs stay bare (`/about`); target-locale URLs gain a `/<locale>` prefix (`/de/about`). Remix v2 supports this elegantly via the **optional segment** file convention — parentheses around a dynamic segment make it optional, so a single route file handles both shapes.

> **CONSENT GATE.** This restructures route files. Show the user the rename plan (existing → new) before writing. In guided mode, wait for explicit "yes" before applying. In unguided mode, apply directly but include the rename diff in the end-of-run summary.

File layout after restructuring:

```
app/
├── routes/
│   ├── ($lang)._index.tsx          ← was _index.tsx — handles "/" and "/<locale>"
│   ├── ($lang).about.tsx           ← was about.tsx — handles "/about" and "/<locale>/about"
│   ├── ($lang).products.$id.tsx    ← was products.$id.tsx
│   └── set-locale.ts               ← language switcher action (new)
└── root.tsx
```

The `($lang)` prefix is Remix v2's optional-segment syntax (the parentheses make the segment optional in the URL). Inside the route, `params.lang` is either a locale string or `undefined` — `undefined` means the bare path was hit, which resolves to the source locale.

Override the root `loader` to derive locale from the URL when present, falling back to the cookie-driven resolver:

```ts
// app/root.tsx — Strategy A loader replacement
export async function loader({ request, params }: LoaderFunctionArgs) {
  const urlLocale = pickUrlLocale(new URL(request.url).pathname)
  if (urlLocale && urlLocale !== sourceLocale) {
    return json({ locale: urlLocale, dir: getDirection(urlLocale) })
  }
  // No prefix in URL → cookie / Accept-Language flow as before.
  const { locale, setCookie } = await resolveRequestLocale(request)
  return json(
    { locale, dir: getDirection(locale) },
    setCookie ? { headers: { 'Set-Cookie': setCookie } } : undefined,
  )
}

function pickUrlLocale(pathname: string): Locale | null {
  const first = pathname.split('/').filter(Boolean)[0]
  if (!first) return null
  if ((locales as readonly string[]).includes(first)) return first as Locale
  return null
}
```

(Import `sourceLocale`, `locales`, `type Locale`, and `getDirection` from `./i18n/locales`.)

**Tradeoff:** Bare URLs (`/about`) always render the source locale, even for a returning German visitor whose cookie says `de`. That's by design — Strategy A treats the URL as authoritative for SEO and shareable-link consistency. Users hit their preferred locale by following the language switcher (which sends them to `/de/about`).

### Strategy B — All locales prefixed

Every URL carries a locale prefix; bare paths redirect to the source-locale prefix. Same optional-segment routing as Strategy A — but the root `loader` redirects when the segment is missing instead of falling back to the bare-path render.

> **CONSENT GATE.** Same file restructuring as Strategy A. Show the rename plan; wait for "yes" in guided mode.

File layout (identical to Strategy A — only the loader behaviour differs):

```
app/
├── routes/
│   ├── ($lang)._index.tsx
│   ├── ($lang).about.tsx
│   └── set-locale.ts
└── root.tsx
```

Loader replacement:

```ts
// app/root.tsx — Strategy B loader replacement
import { redirect } from '@remix-run/node'

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const urlLocale = pickUrlLocale(url.pathname)
  if (urlLocale) {
    return json({ locale: urlLocale, dir: getDirection(urlLocale) })
  }
  // Bare path — resolve preferred locale and redirect into its prefix.
  const { locale, setCookie } = await resolveRequestLocale(request)
  const target = `/${locale}${url.pathname === '/' ? '' : url.pathname}${url.search}`
  throw redirect(target, setCookie ? { headers: { 'Set-Cookie': setCookie } } : undefined)
}
```

The `pickUrlLocale` helper is the same as Strategy A. The redirect is a 302 by default; if your site is public and you want search-engine caching, pass `301` as the second arg (`redirect(target, { status: 301, headers: ... })`).

**Tradeoff:** Slightly more chatty for first-visit URLs (every bare path becomes a redirect), but cleaner SEO since each locale variant has exactly one canonical URL. The cookie still gets written so subsequent direct hits skip the redirect resolution.

### Strategy C — Cookie-only

No route restructuring. The root `loader` from the previous section is unchanged. Every visitor sees the same URLs; their locale is whatever the cookie / `Accept-Language` resolver chose. The language switcher writes a new cookie and reloads the current path.

**Tradeoff:** Simplest setup, but no locale-specific URLs means no per-locale SEO and no shareable "this page in French" link. Best for internal apps, dashboards, or anything where URL stability across locales is desirable.

Skip the route renaming and SEO sections below if you chose this strategy.

---

## Per-Route Catalogs

Each route's `loader` activates the locale's catalog before the component renders. With per-locale catalogs (the default `lingui.config.ts` from above), every route imports the same compiled module — Vite tree-shakes per route, so each chunk only ships the messages it actually uses.

```tsx
// app/routes/($lang).about.tsx — Strategy A or B
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { Trans } from '@lingui/react/macro'
import { getI18nInstance } from '../i18n'
import { resolveLocale } from '../i18n/locales'

export async function loader({ params, request }: LoaderFunctionArgs) {
  const locale = resolveLocale(params.lang ?? new URL(request.url).searchParams.get('locale'))
  const { messages } = await import(`../locales/${locale}/messages.ts`)
  getI18nInstance(locale).loadAndActivate({ locale, messages })
  return json({ locale })
}

export default function AboutPage() {
  return (
    <h1>
      <Trans>About us</Trans>
    </h1>
  )
}
```

```tsx
// app/routes/about.tsx — Strategy C (cookie-only)
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Trans } from '@lingui/react/macro'
import { resolveRequestLocale } from '../i18n/locale.server'
import { getI18nInstance } from '../i18n'

export async function loader({ request }: LoaderFunctionArgs) {
  const { locale } = await resolveRequestLocale(request)
  const { messages } = await import(`../locales/${locale}/messages.ts`)
  getI18nInstance(locale).loadAndActivate({ locale, messages })
  return json({ locale })
}

export default function AboutPage() {
  return (
    <h1>
      <Trans>About us</Trans>
    </h1>
  )
}
```

The dynamic-import specifier (`../locales/${locale}/messages.ts`) must match `lingui.config.ts`'s `catalogs[].path` resolved against `<rootDir>` exactly — `<rootDir>/app/locales/{locale}/messages` in the config means `app/locales/<locale>/messages.ts` on disk and `../locales/<locale>/messages.ts` from inside `app/routes/`. If you change the catalog path, change the import specifier too.

Routes that don't render any translatable text don't need the loader — only routes whose component (or any descendant) uses `<Trans>` / `useLingui()` need to activate the catalog. In practice this is most pages, so the pattern usually goes everywhere.

## Catalog Bootstrapping

**Bootstrap before the first `npx lingui extract --clean` run.** The dynamic imports above resolve `../locales/<locale>/messages.ts` at build time. On a fresh project that file doesn't exist yet, so the first build fails with `Cannot find module ../locales/en/messages.ts`. Seed an empty stub per locale before the first extract:

```sh
for loc in en de fr; do
  mkdir -p "app/locales/$loc"
  printf "export const messages = {}\n" > "app/locales/$loc/messages.ts"
done
```

Replace the `en de fr` list with the project's actual locales from `decisions.md`. After the first `npx lingui extract --clean && npx lingui compile`, these stubs get overwritten with real compiled catalogs — but the file needs to exist beforehand so the route `loader`'s dynamic import resolves during the build.

The same step is documented in the TanStack Start setup (§5a). The Remix-specific shape is simpler because catalogs are per-locale rather than per-route, so you only seed one stub per locale rather than per route.

## Language Switcher

Remix's idiomatic switcher uses a `<Form method="post">` posting to a dedicated action route. The action writes the locale cookie and `redirect`s back to the page the user was on. Full-page navigation is intentional — it avoids the SSR / cookie desync that a client-side-only swap would produce (the next page render must re-read the cookie to pick the right catalog).

Create the action route first:

```ts
// app/routes/set-locale.ts
import type { ActionFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { writeLocaleCookie } from '../i18n/locale.server'
import { resolveLocale } from '../i18n/locales'

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData()
  const locale = resolveLocale(String(form.get('locale') ?? ''))
  const returnTo = String(form.get('returnTo') ?? '/')
  const setCookie = await writeLocaleCookie(locale)
  return redirect(rewriteReturnTo(returnTo, locale), {
    headers: { 'Set-Cookie': setCookie },
  })
}

function rewriteReturnTo(returnTo: string, locale: string): string {
  // Strategy C (cookie-only) — return as-is.
  // Strategies A/B may override this to swap the prefix; see the strategy notes below.
  return returnTo
}
```

For Strategy A and B, `rewriteReturnTo` should swap the locale prefix on the path so the redirect target carries the new locale. Replace the function body with:

```ts
function rewriteReturnTo(returnTo: string, locale: string): string {
  const url = new URL(returnTo, 'http://placeholder')
  const segments = url.pathname.split('/').filter(Boolean)
  if (segments[0] && (locales as readonly string[]).includes(segments[0])) {
    segments.shift() // drop existing prefix
  }
  // Strategy A: source-locale URLs stay bare.
  const needsPrefix = locale !== sourceLocale // Strategy A
  // For Strategy B, replace the previous line with: const needsPrefix = true
  const prefixed = needsPrefix ? `/${locale}/${segments.join('/')}` : `/${segments.join('/')}`
  return prefixed.replace(/\/+$/, '') + url.search || '/'
}
```

(Import `locales` and `sourceLocale` from `../i18n/locales` at the top of `set-locale.ts`.) Use the `needsPrefix = true` variant for Strategy B; keep the `locale !== sourceLocale` check for Strategy A.

Now the switcher itself, placed inside the root layout (or a shared header component):

```tsx
// app/components/LanguageSwitcher.tsx
import { Form, useLocation, useLoaderData } from '@remix-run/react'
import { locales } from '../i18n/locales'
import type { loader as rootLoader } from '../root'

export function LanguageSwitcher() {
  const { locale: currentLocale } = useLoaderData<typeof rootLoader>()
  const location = useLocation()
  const displayNames = new Intl.DisplayNames([currentLocale], { type: 'language' })

  return (
    <Form method="post" action="/set-locale" style={{ display: 'flex', gap: '0.5rem' }}>
      <input type="hidden" name="returnTo" value={location.pathname + location.search} />
      {locales.map((loc) => (
        <button
          key={loc}
          type="submit"
          name="locale"
          value={loc}
          style={{
            padding: '0.25rem 0.5rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: loc === currentLocale ? 600 : 400,
          }}
        >
          {displayNames.of(loc) ?? loc}
        </button>
      ))}
    </Form>
  )
}
```

The `name="locale"` on each submit button is how form submission picks which locale to write — only the clicked button's value is sent. `returnTo` is captured from the current URL so the redirect lands the user back where they were, in the new locale.

If `useLoaderData<typeof rootLoader>()` produces a TypeScript error about importing across route boundaries, add `// eslint-disable-next-line import/no-relative-packages` or fall back to `useRouteLoaderData('root')` from `@remix-run/react`. Both patterns are supported in Remix v2.

Wire the switcher into `root.tsx`:

```tsx
// app/root.tsx — modify the body
import { LanguageSwitcher } from './components/LanguageSwitcher'

// inside <body>:
<body>
  <I18nProvider i18n={i18n}>
    <LanguageSwitcher />
    <Outlet />
  </I18nProvider>
  <ScrollRestoration />
  <Scripts />
</body>
```

If the project already has a header or navigation component, place `<LanguageSwitcher />` inside that instead.

**Styling**: The example uses inline styles as a baseline. Adapt to match the project's CSS approach (Tailwind, CSS Modules, etc.) and the visual style of the surrounding navigation.

## Link Handling

**Only relevant for Strategy A and B.** If the user chose Strategy C, skip — URLs don't change between locales.

Remix's `<Link>` and `<NavLink>` from `@remix-run/react` accept a plain string `to`, so a hook that prefixes paths with the current locale is the cleanest approach. It works for `<Link>`, `<NavLink>`, `<a href>`, `redirect()`, and `useNavigate()`.

```ts
// app/i18n/useLocalePath.ts
import { useLoaderData } from '@remix-run/react'
import { sourceLocale } from './locales'
import type { loader as rootLoader } from '../root'

export function useLocalePath() {
  const { locale } = useLoaderData<typeof rootLoader>()

  return function localePath(path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path}`
    // Strategy A: source-locale paths stay bare.
    if (locale === sourceLocale) return normalized
    // Strategy B variant: drop the `locale === sourceLocale` early return — every locale gets a prefix.
    return `/${locale}${normalized}`
  }
}
```

For Strategy B, remove the `if (locale === sourceLocale) return normalized` line so every locale gets a prefix.

Usage:

```tsx
import { Link } from '@remix-run/react'
import { useLocalePath } from '~/i18n/useLocalePath'

export function Navigation() {
  const localePath = useLocalePath()
  return (
    <nav>
      <Link to={localePath('/')}>Home</Link>
      <Link to={localePath('/about')}>About</Link>
    </nav>
  )
}
```

### Existing link migration

Tell the user:

> Existing internal links need updating to include the locale prefix. Search for:
> - `<Link to="/...">` — wrap the `to` with `localePath()`
> - `<NavLink to="/...">` — same wrapping
> - `<a href="/...">` with internal paths — convert to `<Link>` with `localePath()`
> - `navigate('/...')` / `useNavigate()` calls — wrap the path with `localePath()`
> - `redirect('/...')` inside loaders/actions — prefix with the current locale: `` redirect(`/${locale}/...`) ``
>
> Navigation components (headers, sidebars, footers) are the highest priority since they appear on every page.

For server-side `redirect()` inside loaders, `useLocalePath()` doesn't apply (it's a hook). Either prefix the path inline (`` redirect(`/${locale}${path}`) ``) or extract a tiny `localePathServer(locale, path)` helper alongside the hook.

## SEO

**Only relevant for Strategy A and B.** If the user chose Strategy C, skip — there are no locale-specific URLs to declare.

Alternate-language tags (`<link rel="alternate" hreflang="...">`) tell search engines which locale variants exist for each page, preventing duplicate-content penalties and helping each user land on their preferred language.

Add a `meta` export to `app/root.tsx`. Remix v2's `meta` export returns an array of objects matching the meta-tag shape; `tagName: 'link'` produces a `<link>` element instead of a `<meta>` element.

```tsx
// app/root.tsx — add meta export
import type { MetaFunction } from '@remix-run/node'
import { sourceLocale, locales } from './i18n/locales'

const siteUrl = process.env.PUBLIC_SITE_URL ?? ''

export const meta: MetaFunction<typeof loader> = ({ location }) => {
  if (!siteUrl) return []
  const path = stripLocalePrefix(location.pathname)
  return [
    ...locales.map((loc) => ({
      tagName: 'link',
      rel: 'alternate',
      hrefLang: loc,
      href: `${siteUrl}${localeHref(loc, path)}`,
    })),
    {
      tagName: 'link',
      rel: 'alternate',
      hrefLang: 'x-default',
      href: `${siteUrl}${localeHref(sourceLocale, path)}`,
    },
  ]
}

function stripLocalePrefix(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] && (locales as readonly string[]).includes(segments[0])) {
    segments.shift()
  }
  return '/' + segments.join('/')
}

function localeHref(locale: string, path: string): string {
  // Strategy A: source locale stays bare.
  if (locale === sourceLocale) return path
  // Strategy B: drop the `=== sourceLocale` branch — every locale prefixed.
  return `/${locale}${path === '/' ? '' : path}`
}
```

For Strategy B, change `localeHref` so it always prefixes (drop the source-locale special case).

`PUBLIC_SITE_URL` must be set in the environment (e.g., `https://example.com`) — hreflang requires absolute URLs. If the env var is missing, the `meta` export returns an empty array rather than emitting broken relative links.

Note: Remix's `meta` function receives `location` as one of its args, so the helpers above can read the current pathname without an additional hook. Individual route files can also export their own `meta` to override or extend the root's set per page.

## Verification

Run, in order:

```bash
npx tsc --noEmit
npx lingui extract --clean && npx lingui compile
npm run build
```

- **`tsc --noEmit`** catches mismatched types — the most common failure here is the `Locale` union not containing a locale you listed in `lingui.config.ts`, or a route loader importing the wrong path.
- **`lingui extract --clean`** reads every file under `app/` and produces `app/locales/<locale>/messages.po`. `--clean` drops obsolete entries. The first run will produce zero messages (nothing's wrapped yet) — that's expected; the catalog stubs from "Catalog Bootstrapping" keep the build green.
- **`lingui compile`** turns the `.po` files into the `.ts` runtime modules each route imports. This must succeed before `npm run build`.
- **`npm run build`** is Remix's Vite-driven production build. Failures here usually indicate the plugin-order issue from "Build Tool Integration" — verify `remix()` comes first, `react()` (from `@vitejs/plugin-react-swc`) with the Lingui SWC plugin comes second, and `lingui()` comes last. If macros render as raw JSX at runtime (`<Trans>` showing the message ID), the SWC plugin isn't being picked up — re-check the `plugins` tuple syntax (`['@lingui/swc-plugin', {}]`) and that no leftover `@vitejs/plugin-react` is shadowing the SWC variant.

If any step fails, capture the error to `result.verificationResult` in your progress file and exit with `status: "failed"` per `SKILL.md §2.2`. Do not advance to Phase 3 with a broken build.

## Optional add-ons

If the user selected any optional add-ons in `SKILL.md §1.10` (coding rules `@import`, ESLint plugin, CI/CD integration, test setup wrapper), apply the matching sub-steps from `references/languages/js-ts/libraries/lingui/setup.add-ons.md`. Skip add-ons the user did not select. Skip this section entirely if no add-ons were selected.
