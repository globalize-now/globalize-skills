# TanStack Start Setup (SWC)

> This is one of three setup references for this stack — read them in the order `references.setup` lists. `setup.locale-module.md` runs first and owns `src/i18n/locales.ts`; `setup.navigation.md` runs last and owns `src/i18n/navigation.ts` plus the language switcher. **This file imports those modules and never defines them.**


This covers projects built on [TanStack Start](https://tanstack.com/start) that use `@vitejs/plugin-react-swc` — typically because `create-tanstack-start` now installs `@vitejs/plugin-react@6`, which dropped the `babel` option, making the Babel-based Lingui macro integration a silent no-op. The SWC variant avoids that cliff entirely.

Start renders HTML on every request, so locale must be resolved server-side to avoid hydration mismatches and flash-of-untranslated-content (FOUC). The setup differs from a plain TanStack Router SPA in several places: a server middleware reads the locale, the root document lives in `__root.tsx` (not `index.html`), and the language switcher writes a cookie that the server reads on the next request.

**Detection signal:** `@tanstack/react-start` in `dependencies` **and** `@vitejs/plugin-react@6+` (or `@vitejs/plugin-react-swc`) in devDeps. If the project is on `@vitejs/plugin-react@5`, use `references/tanstack-start.md` (the Babel variant) instead — that path is still supported.

> **Switching from `@vitejs/plugin-react` to `@vitejs/plugin-react-swc`.** If the project currently has `@vitejs/plugin-react@6+`, remove it and install `@vitejs/plugin-react-swc`. Both expose a default-export factory called `react` / `viteReact`, so the `vite.config.ts` edit below replaces the import source and otherwise keeps the same call site. Describe this swap to the user before touching `package.json` — it's a dev-dep change, not a breaking one, but it should be explicit.

## Packages


> **Before installing — Node ≥ 22.19 and ESM-only.** Every `@lingui/*` v6 package except `@lingui/swc-plugin` declares `engines.node >= 22.19.0`, and all of them are `"type": "module"` with no `require` condition, so no CJS file can `require()` them. `setup.locale-module.md` (read first on this variant) carries the full check and the failure modes. Do not use `@lingui/swc-plugin` to test the Node floor — it declares no `engines` at all.

In addition to the core packages from Step 2, install:

| Package | Type | Purpose |
|---------|------|---------|
| `@lingui/swc-plugin` | dev | SWC macro transform |
| `@lingui/vite-plugin` | dev | Vite integration for catalog compilation |

**Example (npm):**

```bash
npm install '@lingui/core@^6' '@lingui/react@^6'
npm install -D '@lingui/cli@^6' '@lingui/swc-plugin@^6' '@lingui/vite-plugin@^6' '@vitejs/plugin-react-swc@^4'
npm uninstall @vitejs/plugin-react   # only if it was present
```

**Version compatibility for `@lingui/swc-plugin`.** SWC's Wasm plugin ABI has been backward-compatible since **`@swc/core` 1.15.0** ([announcement](https://blog.swc.rs/2025-11-4-wasm-backward-compatibility)) — **in one direction only: it makes an *older* plugin keep working on a *newer* host, and says nothing about the reverse**, and `@lingui/swc-plugin` is built against a pinned `swc_core`: `6.2.0`-`6.6.0` against `swc_core@66.0.3`, and **`6.7.0`+ against `swc_core@77.1.1`** ([plugin table](https://github.com/lingui/swc-plugin/blob/6.7.0/packages/lingui-macro/README.md#compatibility)). `^6` resolves to `6.7.0` today, so the host must ship `swc_core` 77.x — that is `@swc/core` **≥ 1.16.0**. The number that actually has to line up is `swc_ecma_ast`, not `swc_core` — `6.7.0` is built against `swc_ecma_ast@29.0.0`, which first appears in a released host at `1.16.0` (`1.15.47` → `27.0.0`, `1.15.46` → `26.0.0`). The `swc_core` numbers never match on their own: `@swc/core@1.16.1` ships `swc_core@77.0.2`, the plugin embeds `77.1.1`. So `^6` needs no pinning on a **current** host — but `@vitejs/plugin-react-swc >= 4.2.3` is no longer a sufficient floor: its dependency is `@swc/core@^1.15.11` (`4.3.3`: `^1.15.46`), and a caret range is not a resolved version. A lockfile holding `@swc/core` anywhere in the `1.15` line is below the plugin — including `1.15.46`, which is the *floor of `4.3.3`'s own range*, and including any lockfile written between `1.15.46` (2026-07-19) and `1.16.0` (2026-08-14). Check `npm ls @swc/core`, not the `@vitejs/plugin-react-swc` version. Install `@vitejs/plugin-react-swc@^4` **and** let `@swc/core` resolve to `1.16.x`; do not pin the host's `@swc/core` backwards. **Do not pin the plugin backwards by default either.**

If the build fails with an AST schema or plugin invocation error (`failed to run Wasm plugin transform`, `failed to invoke plugin: ...`), the host is older than that. In order:

1. **Raise the host** — `npm install -D '@vitejs/plugin-react-swc@^4'`. The 3.x line pulls `@swc/core` ~1.11-1.12, from before the compatible ABI existed.
2. If the project must stay on `@vitejs/plugin-react-swc@3.x`, the plugin has to match the host's `swc_core` exactly. Look up the host's range at <https://plugins.swc.rs> and pin a `@lingui/swc-plugin` version **whose `@lingui/core` peer admits the major this project installs**. For a v6 project that means `6.0.0`-`6.1.0` (`swc_core@50.2.3`) and nothing older: every `5.x` requires `@lingui/core@5` and every `4.x` requires `@lingui/macro@4`, so both fail `ERESOLVE` here.
3. If no such pair exists, switch to the **Babel** variant of this stack rather than downgrading `@lingui/core`.

> **No `@lingui/detect-locale`.** That library only works in the browser (`navigator`, `localStorage`, `window.location`). Under SSR it would throw on the server or return a wrong value, producing a hydration mismatch. Start resolves locale from the request headers and cookie instead — see "Server Middleware" below.

## Build Tool Integration (Step 4)

**This modifies `vite.config.ts`.** Describe the changes to the user before making them: swapping the React plugin import to `@vitejs/plugin-react-swc`, adding `@lingui/swc-plugin` to the `react()` plugin's `plugins` array, and adding `lingui()` as a top-level Vite plugin. The existing `tanstackStart()` plugin must stay, and the React plugin must remain **after** `tanstackStart()` — the Start docs state this explicitly: "react's vite plugin must come after start's vite plugin." The same ordering rule applies to the SWC variant.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react-swc'
import { lingui } from '@lingui/vite-plugin'

export default defineConfig({
  plugins: [
    tanstackStart({
      router: {
        // Catalog files live at src/routes/**/locales/** — keep the router plugin from
        // scanning them as route modules (they're not routes; ignoring avoids routeTree.gen.ts pollution
        // and "Route module not found" warnings from @tanstack/router-plugin).
        routeFileIgnorePattern: 'locales/',
      },
    }),
    viteReact({
      plugins: [['@lingui/swc-plugin', {}]],
    }),
    lingui(),
  ],
})
```

If the project already has SWC plugins configured in the `viteReact()` call, add `['@lingui/swc-plugin', {}]` to the existing `plugins` array. Do not reorder other plugins — preserve any `tailwindcss()`, `nitro()`, or custom plugins that were already present.

If `tanstackStart()` is already configured with a `router` block (e.g. `routesDirectory`, `generatedRouteTree`, `entry`, `basepath`), merge `routeFileIgnorePattern: 'locales/'` into that existing block rather than overwriting it. The `router` key accepts both the Start-specific options (`entry`, `basepath`) and the full set of `@tanstack/router-plugin` config options — `routeFileIgnorePattern`, `routesDirectory`, `generatedRouteTree`, etc. are forwarded through.

## Provider Setup (Step 5)

TanStack Start needs five pieces: a server middleware that resolves the locale for every request, a tiny server function that the router calls to read the resolved locale, an i18n helper module, the root document with `<html lang>`, and per-route catalog loading.

### Locale Routing Strategy

**If the project uses file-based routing (Start always does), STOP and present this to the user:**

> Choose a locale routing strategy:
> 1. **Unprefixed source locale** — source locale (e.g., English) keeps original URLs (`/about`). Other locales use `/$locale/about` (e.g., `/fr/about`). Best for preserving existing URLs and SEO.
> 2. **All locales prefixed** — every locale gets a prefix (`/en/about`, `/fr/about`). Bare paths (`/about`) redirect to the source locale. Cleanest structure, single route tree.
> 3. **Cookie-only** — no URL changes. Locale is stored in a cookie, resolved server-side each request. Simplest setup; works well for apps that don't need locale-specific URLs.

**You MUST wait for the user to choose before proceeding. Do NOT default to option 1.**

> **Note on Strategy 1 trade-off:** Even with server middleware, TanStack Router treats `/about` and `/$locale/about` as distinct file routes with different param types. Strategy 1 requires defining source-locale routes at both paths. Shared page components avoid duplicating the UI code, but each file-route pair needs two route files. Strategy 2 avoids this with a single `$locale/`-prefixed tree. Strategy 3 avoids URL changes entirely.

> **`lingui.config.ts` entries glob:** The default `src/routes/**/*.tsx` glob covers both unprefixed and `$locale/`-prefixed route files recursively — no changes needed.

---

### 0. Locale resolver (shared)

Both the server middleware and the `setLocale` server function need the same logic for validating a raw locale string against the configured locales with a regional fallback. `resolveLocale` — along with `sourceLocale`, `locales`, `Locale`, `getDirection` and `localeDisplayName` — lives in `src/i18n/locales.ts`, created by `setup.locale-module.md` before this file runs.

Confirm that module is on disk before continuing; do not declare a second copy here. It is pure and depends only on the locale constants, so it's safe to import from anywhere — client, server middleware, or server functions.

### 1. Server Middleware (all strategies)

Create `src/start.ts` to register a global request middleware. This runs on every server request (including SSR renders and server-function calls) before routes execute. It resolves the locale from the cookie (set by a previous visit or the language switcher) with `Accept-Language` as a fallback, and persists the resolved value back to the cookie.

```ts
// src/start.ts
import { createStart, createMiddleware } from '@tanstack/react-start'
import { getRequestHeader, getCookie, setCookie } from '@tanstack/react-start/server'
import { resolveLocale } from './i18n/locales'

const localeMiddleware = createMiddleware().server(async ({ next }) => {
  const cookieLocale = getCookie('locale')
  const headerLocale = getRequestHeader('accept-language')?.split(',')[0]?.split(';')[0]?.trim()
  const locale = resolveLocale(cookieLocale || headerLocale)

  // Persist for subsequent requests
  setCookie('locale', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

  return next({ context: { locale } })
})

export const startInstance = createStart(() => ({
  requestMiddleware: [localeMiddleware],
}))
```

If `src/start.ts` already exists (the user already registered other global middleware), merge `localeMiddleware` into the existing `requestMiddleware` array rather than overwriting the file. Show the merged version to the user before writing.

### 2. Locale Server Function

Create a tiny server function the router calls from `beforeLoad` to read the resolved locale. This is cheap — it just reads the cookie the middleware already set.

```ts
// src/server/locale.ts
import { createServerFn } from '@tanstack/react-start'
import { getCookie, setCookie } from '@tanstack/react-start/server'
import { resolveLocale } from '../i18n/locales'

export const getLocale = createServerFn({ method: 'GET' }).handler(async () => {
  return resolveLocale(getCookie('locale'))
})

export const setLocale = createServerFn({ method: 'POST' })
  .inputValidator((locale: string) => locale)
  .handler(async ({ data }) => {
    const locale = resolveLocale(data)
    setCookie('locale', locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    return { locale }
  })
```

### 3. I18n Helper Module

```ts
// src/i18n/index.ts
import { i18n } from '@lingui/core'

// Re-export the locale module so consumers need one import.
export * from './locales'

export function activateLocale(locale: string, messages: Record<string, string>) {
  i18n.loadAndActivate({ locale, messages })
}

export { i18n }
```

`getDirection` is **not** declared here — it lives in `src/i18n/locales.ts` and reaches this module through the re-export, so `import { getDirection } from '../i18n'` keeps working in the root document.

Unlike the Vite SPA setup, this module does **not** touch `document.documentElement` — the `<html lang>` and `dir` attributes are rendered directly by the server from route context (see the root document below), so they're correct on the first byte of HTML. Mutating `document` on top would cause a double-write and fight the SSR output.

### 4. Root Document (`src/routes/__root.tsx`)

**This modifies the root route.** Show the user the exact changes before writing them. Read the existing `__root.tsx` first and note the current `<html>` attributes — if `<html lang="en">` (or any hardcoded value) is present, flag it to the user: "Your `__root.tsx` has `<html lang='en'>`. This will become `<html lang={locale} dir={direction}>` where `locale` comes from route context."

Start's root route exposes two seams: `beforeLoad` (runs before render; merges into route context) and a `RootDocument` / `shellComponent` function (renders the `<html>` shell). We use `beforeLoad` to resolve the locale (shape depends on routing strategy — see below) and `RootDocument` to apply `<html lang>` and `<I18nProvider>`.

The example below shows the **Strategy 3** (cookie-only) `beforeLoad`. Strategy 1 and Strategy 2 override `beforeLoad` to derive the locale from the URL path — see their sections below for the replacements.

```tsx
// src/routes/__root.tsx
/// <reference types="vite/client" />
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import { I18nProvider } from '@lingui/react'
import type { ReactNode } from 'react'
import { getLocale } from '../server/locale'
import { getDirection, i18n } from '../i18n'

export const Route = createRootRoute({
  // Strategy 3 default — see Strategy 1 / Strategy 2 sections below for URL-based overrides.
  beforeLoad: async () => {
    const locale = await getLocale()
    return { locale }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  const { locale } = Route.useRouteContext()
  return (
    <RootDocument locale={locale}>
      <I18nProvider i18n={i18n}>
        <Outlet />
      </I18nProvider>
    </RootDocument>
  )
}

function RootDocument({ locale, children }: { locale: string; children: ReactNode }) {
  return (
    <html lang={locale} dir={getDirection(locale)}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
```

`activateLocale()` is called in each page route's `beforeLoad` (next section), not here — the root route knows the locale but not which catalog a given page needs.

If the project uses `shellComponent` instead of wrapping in `component`, move the `<html>` element into `shellComponent` and read locale via `Route.useRouteContext()` there. The pattern is the same.

---

### 5. Page Route Catalog Loading

Each page route's `beforeLoad` reads `locale` from the root context and loads its co-located catalog. With per-page catalogs this means one dynamic import per route — catalogs are co-located next to each route file (e.g., `src/routes/about/locales/about/en.ts`). The extractor generates these paths from `lingui.config.ts`.

#### Strategy 1: Unprefixed source locale

Source-locale routes live at `/about`; target-locale routes live at `/$locale/about`. Both point at the same shared page component:

```
src/
  pages/
    About.tsx              ← shared page component
  routes/
    __root.tsx             ← root document (above)
    about.tsx              ← /about (source locale)
    $locale/
      about.tsx            ← /$locale/about (target locales)
```

Replace the baseline `beforeLoad` in `__root.tsx` with the URL-first version below. The URL is authoritative — a valid target-locale prefix wins, and any other path is treated as the source locale.

```tsx
import { locales, sourceLocale, type Locale } from '../i18n/locales'

export const Route = createRootRoute({
  beforeLoad: ({ location }) => {
    const segments = location.pathname.split('/').filter(Boolean)
    const firstSegment = segments[0]
    // Target-locale prefix (e.g. /fr/about) wins over cookie
    if (
      firstSegment &&
      (locales as readonly string[]).includes(firstSegment) &&
      firstSegment !== sourceLocale
    ) {
      return { locale: firstSegment as Locale }
    }
    // Unprefixed path — source locale by design
    return { locale: sourceLocale }
  },
  // ...
})
```

Strategy 1 doesn't call `getLocale()` — the cookie is only meaningful for first-visit Accept-Language redirects, which Strategy 1 doesn't perform (`/about` is always source locale). The cookie middleware still runs so server functions and future strategy changes behave consistently, but it's not consulted here.

> **Canonicalization:** Visiting `/en/about` (when `en` is the source locale) will render the target-locale route tree with an English catalog — not the canonical `/about`. For SEO hygiene, add a redirect for source-locale-prefixed paths if your site is public: inside the check above, when `firstSegment === sourceLocale`, `throw redirect({ href: location.pathname.slice(sourceLocale.length + 1) || '/' })`. **Use `href`, not `to`.** `to` is strictly typed against TanStack Router's inferred route tree — a `string` built by concatenation doesn't narrow to a known route and fails TypeScript. `href` accepts an arbitrary path string, which is exactly what these locale-prefix redirects need.

```tsx
// src/pages/About.tsx — shared page component
import { Trans } from '@lingui/react/macro'

export function AboutPage() {
  return <h1><Trans>About us</Trans></h1>
}
```

```tsx
// src/routes/about.tsx — source locale (unprefixed)
import { createFileRoute } from '@tanstack/react-router'
import { activateLocale } from '../i18n'
import { sourceLocale } from '../i18n/locales'
import { AboutPage } from '../pages/About'

export const Route = createFileRoute('/about')({
  beforeLoad: async () => {
    const { messages } = await import(`./locales/about/${sourceLocale}.ts`)
    activateLocale(sourceLocale, messages)
  },
  component: AboutPage,
})
```

```tsx
// src/routes/$locale/about.tsx — target locales (prefixed)
import { createFileRoute } from '@tanstack/react-router'
import { activateLocale } from '../../i18n'
import { AboutPage } from '../../pages/About'

export const Route = createFileRoute('/$locale/about')({
  beforeLoad: async ({ params }) => {
    const { messages } = await import(`./locales/about/${params.locale}.ts`)
    activateLocale(params.locale, messages)
  },
  component: AboutPage,
})
```

Bare paths under Strategy 1 use the source locale directly; users reach target locales via the language switcher.

#### Strategy 2: All locales prefixed

All routes live under `/$locale/`. Bare paths redirect to the source-locale prefix:

```
src/routes/
  __root.tsx             ← root document + bare-path redirect
  $locale/
    about.tsx            ← /$locale/about
```

Replace the baseline `beforeLoad` in `__root.tsx` with the URL-first version below. The URL prefix is authoritative — the cookie is only consulted as a default when the path is bare.

```tsx
export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    const segments = location.pathname.split('/').filter(Boolean)
    const firstSegment = segments[0]
    if (!firstSegment || !(locales as readonly string[]).includes(firstSegment)) {
      // Bare path — redirect to cookie-resolved (or Accept-Language) locale
      const locale = await getLocale()
      throw redirect({ href: `/${locale}${location.pathname}` })   // href, not to — `to` is strictly typed to known routes and rejects template-literal strings
    }
    // URL already carries a valid locale — use it as context
    return { locale: firstSegment as Locale }
  },
  // ...
})
```

(Import `redirect` from `@tanstack/react-router`, and `locales` + `type Locale` from `../i18n/locales`.)

This ensures `Route.useRouteContext().locale` always matches the URL segment, so components like the language switcher highlight the correct locale even when the cookie is stale.

```tsx
// src/routes/$locale/about.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'
import { activateLocale } from '../../i18n'

export const Route = createFileRoute('/$locale/about')({
  beforeLoad: async ({ params }) => {
    const { messages } = await import(`./locales/about/${params.locale}.ts`)
    activateLocale(params.locale, messages)
  },
  component: AboutPage,
})

function AboutPage() {
  return <h1><Trans>About us</Trans></h1>
}
```

#### Strategy 3: Cookie-only (no URL changes)

No route restructuring. Each page reads `locale` from root context and loads its catalog:

```tsx
// src/routes/about.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'
import { activateLocale } from '../i18n'

export const Route = createFileRoute('/about')({
  beforeLoad: async ({ context }) => {
    const { messages } = await import(`./locales/about/${context.locale}.ts`)
    activateLocale(context.locale, messages)
  },
  component: AboutPage,
})

function AboutPage() {
  return <h1><Trans>About us</Trans></h1>
}
```

`context.locale` comes from the root route's `beforeLoad` return value — `beforeLoad` contexts compose from parent routes down.

### 5a. Before first extract: seed route-scoped catalog stubs (required)

Every route shown above loads its catalog via `await import(\`./locales/{route}/${locale}.ts\`)`. Lingui's per-page extractor resolves those dynamic imports with esbuild at extract time — *before* it writes any `.po` or compiled catalog files. On a fresh project the `locales/` directories don't exist yet, so the very first run of `lingui extract-experimental` fails with either `Could not resolve import(...)` or `No matches for the glob in ./locales/${locale}.ts`, and exits before generating anything.

**Bootstrap before the first `lingui extract-experimental` run (the `scaffold_catalogs` step of Phase 2):** for every route that declares `import(\`./locales/{route}/${locale}.ts\`)`, create a compiled-catalog stub at each `locales/{route}/{locale}.ts` target containing a single line:

```ts
export const messages = {}
```

For the Strategy 1 layout with `locales = ['en', 'fr']` and routes `about.tsx` + `dashboard.tsx`, that's:

```
src/routes/locales/about/en.ts
src/routes/locales/about/fr.ts
src/routes/locales/dashboard/en.ts
src/routes/locales/dashboard/fr.ts
```

One `export const messages = {}` line per file — the extractor will overwrite these with real compiled catalogs after the first `lingui:extract` + `lingui:compile` cycle.

If the route list is long, enumerate it with grep (adapt the locales to the project's `locales` array):

```sh
grep -rlE "import\\(\\\`\\./locales/" src/routes/ | while read f; do
  name="$(basename "$f" .tsx)"
  dir="$(dirname "$f")/locales/$name"
  mkdir -p "$dir"
  for loc in en fr; do echo "export const messages = {}" > "$dir/$loc.ts"; done
done
```

The script is a convenience — the load-bearing step is verifying that every `import()` target path listed in the route files has a matching stub. Routes using non-default paths (e.g. `./locales/profile/${locale}.ts` inside `src/routes/user/settings.tsx`) must have stubs at the exact specifier the code uses.

> **These stubs are local-only scaffolding.** They are written to the paths you just gitignored, so they are never committed — and they do not need to be. They exist for exactly one situation: the **very first** `lingui extract` on a project that has no `.po` files yet, where the extractor must resolve the route files' dynamic catalog imports before any catalog exists.
>
> **On a fresh clone, do not re-seed stubs — run `lingui compile`.** The `.po` sources are committed, so `lingui compile` regenerates the real compiled catalogs. Seeding is only correct when there is no `.po` file at all.
>
> Order inside setup: append the `.gitignore` rule → seed stubs → `lingui extract` → `lingui compile`. After the first compile the stubs are overwritten by real catalogs, which stay untracked.
>
> Do not run `git add -A` between seeding and the ignore rule landing.

### 5b. Compiled catalogs: scripts, build wiring, `.gitignore` (required)

#### Catalog scripts

Add the extract and compile scripts to `package.json`, and **prepend** `lingui compile && ` to `dev`, `build`, and `typecheck` (if present) — prefix the existing value, never replace it:

```json
{
  "scripts": {
    "lingui:extract": "lingui extract-experimental",
    "lingui:compile": "lingui compile",
    "dev": "lingui compile && vite dev",
    "build": "lingui compile && vite build"
  }
}
```

**`lingui compile` must run before the app is built, type-checked, or served.** The compiled catalogs are not in git, so every fresh clone and every CI run starts without them. Call the binary directly (`lingui compile && …`), not through `npm run`, so the scripts work under npm, pnpm, yarn, and bun alike. Do **not** use a `prebuild` hook — pnpm ≥7 disables pre/post scripts by default and Yarn Berry dropped them entirely, so it would silently no-op for two of the four package managers this skill supports.

Known limitation: in dev, a `.po` edited after startup (e.g. a Globalize delivery pulled mid-session) needs a dev-server restart, because the compile ran at startup.

**TypeScript projects:** this reference ships no `lingui.config.ts` block, so there is no `compileNamespace: 'ts'` to rely on. If the project has a `tsconfig.json`, use `lingui compile --typescript` everywhere `lingui compile` appears above (the `lingui:compile` script and the `dev` / `build` prefixes) so the compiler emits `.ts` catalogs the route `import()`s can resolve and type-check. Omit the flag for plain-JS projects.

#### `.gitignore`

Compiled catalogs are build output, not source. Lingui's own CLI docs are explicit: *"Compiled files should be ignored by version control as they are generated during deployment."* Unlike Paraglide, the Lingui compiler does **not** emit a `.gitignore` of its own, so add the rule yourself.

Append to the project's root `.gitignore` (create it if missing). In guided mode, show the diff first if the file already has rules. If an equivalent rule is already present, skip — this step is idempotent.

```gitignore
# Lingui compiled catalogs — regenerated by `lingui compile`
src/routes/**/locales/**/*.ts
src/routes/**/locales/**/*.js
```

**Extension caveat.** This reference does not ship a `lingui.config.ts` block, so the compiled extension depends on the config you created in `create_config`: with `compileNamespace: 'ts'` (or `lingui compile --typescript`) the output is `.ts`; with the default (`cjs`) it is `.js`. The block above ignores both, so the rule is correct either way — but derive the real *directory* from the config you wrote (`catalogs[].path`, or `experimental.extractor.output` for the per-page extractor) and from the actual `import()` / `require()` specifiers in the route files, and adjust the paths above if they differ. Confirm with the `git check-ignore` self-check below.

**Do not ignore the `.po` files, and do not ignore the directory.** The compiled catalog sits in the *same directory* as its `.po` source, and the `.po` is the translation source of truth — it is what Globalize imports from the repo in Phase 4. So:

- never `<dir>/` (directory rule — swallows the `.po`),
- never `<dir>/*/messages.*` (extension wildcard — swallows the `.po`),
- always the explicit compiled extensions shown above.

A pattern containing a `/` is anchored to the `.gitignore`'s directory, so no leading slash is needed. `**/` matches zero or more directories. `*.ts` already covers `*.d.ts`; the anchored `messages.ts` form does not, hence the explicit line.

Self-check before moving on (both must hold):

```bash
git check-ignore -v <one real compiled path>   # prints the matching rule → ignored
git check-ignore    <its .po sibling>          # exits 1, prints nothing → still tracked
```

**Sweep for strays before you finish.** Bootstrap stubs seeded at a path the final config does not emit to — e.g. a single-catalog `locale/{locale}/messages.ts` left behind after the config settled on per-page catalogs — are compiled artifacts too, and the pattern above will not match them. After the first successful `lingui compile`, list every compiled catalog on disk and delete any that the resolved `lingui.config.*` no longer produces. Do **not** widen the ignore rule to cover a path nothing imports.

**Already-tracked artifacts.** `.gitignore` does not untrack files. If `git ls-files` shows compiled catalogs already committed (an existing project, or a re-run), tell the user and, with their consent, run:

```bash
git rm --cached --quiet <compiled paths>
```

The files stay on disk; git stops tracking them. Without this, the ignore rule has no effect on those paths.

Ignoring the compiled catalogs is only safe because `lingui compile` runs before every build — see the catalog scripts above. Do not do one without the other.

---

## Link Handling

**Only relevant for Strategy 1 and 2.** If the user chose Strategy 3, skip this — URLs don't change.

TanStack Router's `<Link>` is deeply typed — wrapping it loses type inference on `to` and `params`. Use the router's native API instead.

**Strategy 2** (all prefixed): every `<Link>` already requires a `locale` param.

```tsx
import { Link, useParams } from '@tanstack/react-router'

function Navigation() {
  const { locale } = useParams({ strict: false })
  return (
    <nav>
      <Link to="/$locale" params={{ locale }}>Home</Link>
      <Link to="/$locale/about" params={{ locale }}>About</Link>
    </nav>
  )
}
```

**Strategy 1** (unprefixed source): source-locale routes have no `$locale` param, target-locale routes do. Links must point to the correct route variant. This duplication is the trade-off of Strategy 1 with TanStack Router's type system — for apps with many links, Strategy 2 is significantly simpler.

Declare the items once as an `as const` array so the branch is written **once per navigation component, not once per link**:

```tsx
import { Link } from '@tanstack/react-router'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { sourceLocale } from '../i18n/locales'
import { useLocale } from '../i18n/navigation'

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

`as const` keeps `to` and `localeTo` literal types, so `<Link>`'s inference survives the indirection. Under Strategy 2, drop the `localeTo` column and the branch entirely.

`useLocale()` comes from `src/i18n/navigation.ts` and reads `useParams({ strict: false })` — prefer it over `RootRoute.useRouteContext()`, which would make the i18n module depend on the route tree.

### Existing link migration

Tell the user:

> Existing internal links need updating to include the locale param. Search for:
> - `<Link to="/...">` — wrap the `to` and `params` per the pattern above
> - `<a href="/...">` with internal paths — convert to `<Link>` with locale handling
> - `navigate({ to: '/...' })` / `router.navigate(...)` — include the `locale` param or use a source/target branch
>
> Navigation components (headers, sidebars, footers) are the highest priority since they appear on every page.

---

## Root Document: `<html lang>`

**Do not modify `index.html`.** TanStack Start projects do not have a project-root `index.html` — the `<html>` element is rendered from `__root.tsx` (see Section 4 above). The `<html lang={locale} dir={getDirection(locale)}>` attribute comes from route context on every request. If you find an `index.html` in the project, it's either unrelated (e.g., a static preview file) or a legacy leftover — confirm with the user before touching it.

---

## 6. Language Switcher

The switcher calls the `setLocale` server function (Section 2) to update the cookie, then triggers a reload so the server re-renders in the new locale. This is the idiomatic Start pattern — a pure client-side swap would desync from the cookie on the next SSR, producing mixed-locale renders.

#### Strategy 1 and 2: URL-based routing

For URL-based strategies, the switcher navigates to the same page under the new locale prefix. The cookie is updated alongside so the next SSR matches:

```tsx
// src/components/LanguageSwitcher.tsx
import { useLocation } from '@tanstack/react-router'
import { locales, localeDisplayName, type Locale } from '../i18n/locales'
import { useLocale, switchLocalePath } from '../i18n/navigation'
import { setLocale } from '../server/locale'

export function LanguageSwitcher() {
  const currentLocale = useLocale()
  const location = useLocation()
  const hrefFor = (loc: Locale) => switchLocalePath(location.pathname, loc)

  return (
    <nav style={{ display: 'flex', gap: '0.5rem' }}>
      {locales.map((loc) => (
        <a
          key={loc}
          href={hrefFor(loc)}
          hrefLang={loc}
          aria-current={loc === currentLocale ? 'true' : undefined}
          onClick={async (e) => {
            e.preventDefault()
            await setLocale({ data: loc })
            window.location.href = hrefFor(loc)
          }}
          style={{
            padding: '0.25rem 0.5rem',
            textDecoration: 'none',
            color: 'inherit',
            fontWeight: loc === currentLocale ? 600 : 400,
          }}
        >
          {localeDisplayName(loc)}
        </a>
      ))}
    </nav>
  )
}
```

A full browser navigation (`window.location.href = ...`) is used instead of TanStack Router's client-side `<Link>` so the next request goes back through the server and picks up the updated cookie + catalog on the server side. This avoids a brief flash where the URL is in the new locale but the HTML is still in the old one. A plain `<a>` is also required here because `switchLocalePath` returns a string — the target route type is not statically known.

`switchLocalePath` encodes the chosen strategy, so this component is identical under Strategy 1 and Strategy 2.

#### Strategy 3: Cookie-only

No URL change. The switcher updates the cookie and reloads; the server re-renders with the new locale on the reload:

```tsx
// src/components/LanguageSwitcher.tsx
import { locales, localeDisplayName } from '../i18n/locales'
import { Route as RootRoute } from '../routes/__root'
import { setLocale } from '../server/locale'

export function LanguageSwitcher() {
  const { locale: currentLocale } = RootRoute.useRouteContext()

  async function switchTo(loc: string) {
    await setLocale({ data: loc })
    window.location.reload()
  }

  return (
    <select
      value={currentLocale}
      onChange={(e) => switchTo(e.target.value)}
      style={{ padding: '0.375rem 0.5rem' }}
    >
      {locales.map((loc) => (
        <option key={loc} value={loc}>
          {localeDisplayName(loc)}
        </option>
      ))}
    </select>
  )
}
```

### Wiring

Place the switcher inside the `RootDocument` body so it appears on every page:

```tsx
// src/routes/__root.tsx (modify RootComponent)
import { LanguageSwitcher } from '../components/LanguageSwitcher'

function RootComponent() {
  const { locale } = Route.useRouteContext()
  return (
    <RootDocument locale={locale}>
      <I18nProvider i18n={i18n}>
        <LanguageSwitcher />
        <Outlet />
      </I18nProvider>
    </RootDocument>
  )
}
```

If the project has a shared header or navigation component, place the switcher there instead.

**Styling**: The examples use inline styles as a baseline. Adapt to match the project's CSS approach (Tailwind, CSS Modules, etc.) and the visual style of the surrounding navigation.

---

## Server Function Locale Access

Server functions (`createServerFn`) run in the request context, so they can read the resolved locale directly via `getCookie` — useful if you need to translate server-rendered emails, error messages, or response bodies:

```ts
import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

export const sendConfirmationEmail = createServerFn({ method: 'POST' }).handler(async () => {
  const locale = getCookie('locale') || 'en'
  const { messages } = await import(`../locales/emails/${locale}.ts`)
  // ... render email using messages
})
```

## Common gotchas specific to Start

- **Hydration mismatch on `<html>`**: if you set `document.documentElement.lang` in client code (e.g., an `activateLocale` that mutates the DOM), it will fight the server-rendered `<html lang>`. Keep DOM mutation out of `src/i18n/index.ts` — the server renders the correct attributes on first byte.
- **Plugin order**: `@vitejs/plugin-react-swc` must come **after** `tanstackStart()` in `vite.config.ts`. The rule is identical to the Babel variant — "react's vite plugin must come after start's vite plugin." Reversing the order breaks Start's code splitting and server/client boundary handling.
- **SWC plugin silently not transforming macros**: if `<Trans>` renders as raw JSX at runtime (e.g. the extracted key rather than the translated string, or a `ReferenceError`), the SWC plugin isn't being picked up. Verify the `plugins` array is on the `viteReact()` call itself (not on `tanstackStart()`), that the plugin tuple is `['@lingui/swc-plugin', {}]` (string + options object), and that the host is new enough — `@vitejs/plugin-react-swc >= 4.2.3` — see the version-compatibility note in Packages above.
- **Leftover `@vitejs/plugin-react`**: if both `@vitejs/plugin-react` and `@vitejs/plugin-react-swc` are present in devDeps, Vite may resolve either depending on import order and lockfile state. Uninstall `@vitejs/plugin-react` after switching — a stale install is the most common cause of "my SWC config is correct but macros still don't transform."
- **Missing `src/start.ts` before the router builds**: `createStart(...)` must be imported somewhere in the server bundle (often via `src/server.ts` / `src/server-entry.ts` re-exporting or importing `src/start.ts`). If `startInstance` is unused, Vite tree-shakes the middleware away — verify that your server entry imports `./start` (even as a side-effect import: `import './start'`).
- **Catalog missing on a route**: `lingui extract-experimental` generates co-located `locales/{route}/{locale}.po` files on first extraction. If a route's `beforeLoad` fails with "Cannot find module ./locales/...", run `npm run lingui:extract` followed by `npm run lingui:compile` before starting the dev server.

- **First extract fails: `Could not resolve import(...)` or "No matches for the glob in `./locales/${locale}.ts`"**: the per-route dynamic imports must resolve at extract time, but on first run no `locales/` directories exist yet. **This is now a required setup step, not a gotcha** — see Section 5a ("Before first extract: seed route-scoped catalog stubs") above. If you hit either error and landed here via a search, you skipped the seeding step.
- **`@lingui/detect-locale` errors on the server**: if the package got installed (e.g., copied from the Vite SPA guide), its `fromStorage`/`fromNavigator` detectors throw during SSR because `localStorage` and `navigator` don't exist. Uninstall it — the server middleware above replaces it.

---

## Coding rules + optional add-ons

First apply the **core coding-rules section** of `references/languages/js-ts/libraries/lingui/setup.add-ons.md` (step `generate_coding_rules`) — it always runs, whatever the user selected, because Phase 3 wraps against the file it generates. Then apply the **second core section** (step `install_coding_rules`), which points `CLAUDE.md` and `AGENTS.md` at the generated file — it always runs too. Finally, if the user selected any optional add-ons in `SKILL.md §1.10` (ESLint plugin, CI/CD integration, test setup wrapper), apply the matching sub-steps from the same file. Skip add-ons the user did not select.
