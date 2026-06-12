---
name: lovable-i18n
description: >-
  Add multi-language support (i18n) to this Lovable app using Lingui.
  Use when the user asks to add i18n, internationalization, localization,
  or translations — "translate my app", "make my app multilingual",
  "add Spanish/French/German support", "add a language switcher",
  "support multiple languages", or "connect Globalize". Covers setup
  (Vite SPA and TanStack Start), wrapping hardcoded text, PO catalogs,
  a GitHub Action that keeps catalogs in sync, coding rules in AGENTS.md,
  and hand-off to the Globalize.now translation platform.
---

# Lovable i18n with Lingui

You are the Lovable agent working on one project. You cannot run terminal commands — no npm, no lingui CLI, no git. You can edit files, add npm dependencies, and read preview build errors and console logs. Everything below is designed around that.

Three consequences of that design, worth internalizing before you start:

1. **You never run `lingui compile`.** `@lingui/vite-plugin` compiles `.po` catalogs at build time, when the app dynamically imports them. The preview build is the compiler.
2. **You never run `lingui extract`.** A GitHub Actions workflow (Phase 5) runs extraction in CI after Lovable syncs commits to GitHub. Until that lands, you maintain `.po` files by hand, following the catalog maintenance protocol later in this skill.
3. **You scaffold catalogs yourself.** Since nothing can run the CLI here, you create the `messages.po` files directly, with valid PO headers (step A7).

The library is **Lingui v6**, with one PO catalog per locale at `src/locales/{locale}/messages.po`.

## Phases

| Phase | What happens |
|---|---|
| 1.1 Detect | Identify the project stack (Vite SPA or TanStack Start) and any existing i18n |
| 1.2 Ask | One chat message collecting source locale, target locales, URL routing, opt-ins |
| 2A / 2B Setup | Add dependencies, build config, `i18n.ts`, provider, catalogs, language switcher |
| 3 Rules | Add Lingui coding rules to `AGENTS.md` so every future edit stays localized |
| 4 Wrap | Wrap the app's existing hardcoded strings in Lingui macros |
| 5 CI | Add a GitHub Action that runs `lingui extract` and keeps catalogs in sync |
| 6 Connect | Hand off catalogs to the Globalize.now translation platform |

Work the phases in order. Detect and Ask are quick; Setup is the bulk of the work.

---

## Phase 1: Detect & Ask

### 1.1 Detect

Read `package.json` and decide which stack this project is. **First match wins.**

**Path B — TanStack Start (SSR).** Authoritative signal: `@tanstack/react-start` in `dependencies`. Corroborating signals (any of these confirm, none is required once the dependency is present):

- `src/routes/__root.tsx` exists
- `src/router.tsx` exporting a `getRouter()` function
- `@lovable.dev/vite-tanstack-config` wrapping the config in `vite.config.ts`
- `wrangler.jsonc` at the project root (Cloudflare Workers deploy target)

→ Follow **Phase 2B: Setup — TanStack Start (SSR)**.

**Path A — Vite SPA (legacy stack).** `vite` in `devDependencies` and **no** `@tanstack/react-start`. Corroborating signals:

- `@vitejs/plugin-react-swc` in `devDependencies`
- `react-router-dom` in `dependencies` and a `<Routes>` block in `src/App.tsx`
- `components.json` at the project root (shadcn/ui)
- `lovable-tagger` in `devDependencies`
- root `index.html` and `src/main.tsx`

→ Follow **Phase 2A: Setup — Vite SPA**.

If neither matches, tell the user what you found and that this skill covers Lovable's two project stacks only — don't guess your way into a setup.

#### Escape hatches

Check these before starting setup. They change or stop the plan.

**Babel instead of SWC (Path A).** If `vite.config.ts` uses `@vitejs/plugin-react` (no `-swc` suffix), the SWC macro plugin won't work. Tell the user, then substitute the Babel plugin:

> This project uses the Babel-based React plugin instead of SWC. Same result, slightly different wiring: I'll use `@lingui/babel-plugin-lingui-macro` instead of the SWC plugin.

Add `@lingui/babel-plugin-lingui-macro@^6` as a dev dependency (instead of `@lingui/swc-plugin`), and in A2 configure the React plugin as:

```ts
react({
  babel: {
    plugins: ['@lingui/babel-plugin-lingui-macro'],
  },
})
```

Everything else in Phase 2A is identical.

**Existing i18n library.** If `react-i18next`, `i18next`, `react-intl`, `next-translate`, or any other i18n library is already in `dependencies`: **STOP and ask the user.** Two options: keep the existing library (this skill doesn't apply — its setup, catalogs, and CI are Lingui-specific), or remove the existing library and its usages first, then re-run this skill. Never migrate or rip out an i18n library silently.

**Existing Lingui config.** If a `lingui.config.ts` (or `.js`) already exists, run in **additive mode**: verify the config matches the shape in A3 (PO formatter, `src/locales/{locale}/messages` catalog path), add any locales the user requested that are missing (config + new `.po` files per A7), confirm the provider is wired (A5) and the vite plugins are present (A2) — fix only what's missing — then continue from Phase 3 (make sure the AGENTS.md coding rules are in place) before wrapping strings in Phase 4.

### 1.2 Ask

Auto-detect before asking — pull defaults from the project so the user mostly confirms:

- **Source locale**: the `<html lang="...">` value in `index.html`; any existing `src/locales/<locale>/` directories; default `en`.
- **Target locales**: any language the user already named in their request ("add Spanish" → `es` is pre-selected); existing locale directories.

Then send **one chat message** with every question and a sensible default pre-selected. Do not drip-feed questions one at a time. Include question 3 only on Path A (Vite SPA) — TanStack Start routing is decided in Phase 2B. Shape it like this:

> Before I set up translations, a few choices — defaults in bold, just say "go" to accept all:
>
> 1. **Source language** — the language your app is written in. Detected: **en** (from `<html lang>`).
> 2. **Target languages** — which languages to translate into. You mentioned **Spanish (es)**; common additions: French (fr), German (de), Portuguese (pt), Japanese (ja). Which do you want?
> 3. **Locale in the URL?**
>    - **No URL locale (default)** — language is remembered per visitor (saved choice → browser language). URLs stay exactly as they are. Simplest, no link changes.
>    - URL prefix (`/es/dashboard`) — every page exists per language; shareable, SEO-friendly language URLs, but all internal links need a locale prefix.
> 4. **Catalog sync via GitHub Actions** — a workflow that extracts new texts into the catalogs whenever code changes. **Default: yes.** Requires GitHub to be connected in Lovable (Settings → GitHub).
> 5. **Connect Globalize.now** — a translation platform that fills in the actual translations via PRs. Optional, can be added later.

After the user answers, execute the whole plan without further pauses. Only stop again for blockers: a build error you cannot resolve, an escape hatch from 1.1, or a missing GitHub connection when the user asked for CI.

Record the answers — `SOURCE_LOCALE`, the locale list, routing choice, opt-ins — you will substitute them into every snippet below. The snippets use `en` as source and `['en', 'es', 'fr']` as the locale list; replace with the real choices everywhere.

**Narrate structural edits.** Before modifying `vite.config.ts`, `src/main.tsx`, `src/App.tsx`, or `index.html`, state in one chat sentence what will change and why (e.g. "I'm adding the Lingui plugins to vite.config.ts so translations compile at build time"), then make the edit. Don't wait for permission — just narrate.

---

## Phase 2A: Setup — Vite SPA

Nine steps, A1–A9, in order. Then the optional URL-routing variant if the user opted in.

### A1. Dependencies

Add these dependencies (do not write install commands — add them to the project's dependencies directly):

Runtime dependencies:

| Package | Version | Purpose |
|---|---|---|
| `@lingui/core` | `^6` | i18n runtime |
| `@lingui/react` | `^6` | React bindings (`I18nProvider`, `Trans`, `useLingui`) |
| `@lingui/detect-locale` | `^6` | Browser locale detection (URL, storage, navigator) |

Dev dependencies:

| Package | Version | Purpose |
|---|---|---|
| `@lingui/cli` | `^6` | Used only by the GitHub Actions workflow (Phase 5) — never run here |
| `@lingui/swc-plugin` | `^6` | SWC macro transform (skip if on the Babel escape hatch) |
| `@lingui/vite-plugin` | `^6` | Compiles `.po` catalogs when the app imports them |
| `@lingui/format-po` | `^6` | PO catalog formatter for `lingui.config.ts` |

**Version pinning caveat:** `@lingui/swc-plugin` must match the `swc_core` version shipped by `@vitejs/plugin-react-swc`. If the preview build fails with an AST schema error or a plugin invocation error after this setup, look up the compatible version at https://plugins.swc.rs and pin `@lingui/swc-plugin` to that exact version (e.g. `5.8.0` — no caret). This exact pin overrides the `^6` default for this one package only.

### A2. `vite.config.ts`

Add two things: the SWC macro plugin inside the existing `react()` call, and `lingui()` as a top-level Vite plugin. **Preserve everything already there** — `lovable-tagger`'s `componentTagger()`, the `@` path alias, server options, conditional plugin logic. Only add, never replace.

A typical Lovable Vite config becomes:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { lingui } from '@lingui/vite-plugin'
import { componentTagger } from 'lovable-tagger'
import path from 'path'

export default defineConfig(({ mode }) => ({
  server: {
    host: '::',
    port: 8080,
  },
  plugins: [
    react({
      plugins: [['@lingui/swc-plugin', {}]],
    }),
    lingui(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))
```

The SWC plugin entry **must** be the tuple shape `['@lingui/swc-plugin', {}]` — a string + options object. Passing the plugin name as a bare string silently disables the macro transform: the build succeeds, but `<Trans>` never resolves and raw macro output leaks into the UI.

### A3. `lingui.config.ts`

Create `lingui.config.ts` at the project root:

```ts
// lingui.config.ts
import type { LinguiConfig } from '@lingui/conf'
import { formatter } from '@lingui/format-po'

const config: LinguiConfig = {
  sourceLocale: 'en',
  locales: ['en', 'es', 'fr'],
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['<rootDir>/src'],
      exclude: ['**/node_modules/**', '**/locales/**'],
    },
  ],
  format: formatter(),
}

export default config
```

Substitute `sourceLocale` and `locales` from the Ask phase. `format: formatter()` from `@lingui/format-po` is required — Lingui 6 removed the `format: 'po'` string form, so a string here fails. The `**/locales/**` exclusion keeps the extractor (in CI) from scanning the catalogs themselves.

### A4. `src/i18n.ts`

Create `src/i18n.ts` — locale constants, detection, activation, persistence:

```ts
// src/i18n.ts
import { i18n } from '@lingui/core'
import { detect, fromUrl, fromStorage, fromNavigator } from '@lingui/detect-locale'

// Must match the `locales` array in lingui.config.ts
export const LOCALES: readonly string[] = ['en', 'es', 'fr']
export const SOURCE_LOCALE = 'en'
const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi'])

function getDirection(locale: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale.split('-')[0]) ? 'rtl' : 'ltr'
}

export function detectLocale(): string {
  let detected: string | null
  try {
    detected = detect(fromUrl('lang'), fromStorage('lang'), fromNavigator())
  } catch {
    // localStorage threw (sandboxed iframe / blocked storage) — retry without it
    detected = detect(fromUrl('lang'), fromNavigator())
  }
  if (detected) {
    if (LOCALES.includes(detected)) return detected
    // Regional fallback: es-MX → es
    const base = detected.split('-')[0]
    if (LOCALES.includes(base)) return base
  }
  return SOURCE_LOCALE
}

export async function activateLocale(locale: string) {
  try {
    const { messages } = await import(`./locales/${locale}/messages.po`)
    i18n.loadAndActivate({ locale, messages })
  } catch (e) {
    console.error(`Failed to load "${locale}" catalog, falling back to "${SOURCE_LOCALE}"`, e)
    const { messages } = await import(`./locales/${SOURCE_LOCALE}/messages.po`)
    i18n.loadAndActivate({ locale: SOURCE_LOCALE, messages })
  }
  document.documentElement.lang = i18n.locale
  document.documentElement.dir = getDirection(i18n.locale)
}

export function saveLocale(locale: string) {
  try {
    localStorage.setItem('lang', locale)
  } catch {
    // Storage unavailable — the choice just won't persist
  }
}

export { i18n }
```

Notes:

- The dynamic import targets the **`.po` file directly** (`./locales/${locale}/messages.po`) — `@lingui/vite-plugin` compiles it to runtime messages at that moment. No compiled `.js`/`.ts` catalogs ever exist in the repo.
- `detectLocale()` tries sources in order: `?lang=` URL parameter → `lang` key in localStorage → browser language (with regional fallback, `es-MX` → `es`) → source locale.
- `activateLocale()` also keeps `<html lang>` and `<html dir>` in sync, so RTL locales (Arabic, Hebrew, Farsi, Urdu…) flip the document direction automatically.
- Call `saveLocale()` only on an explicit user choice (the language switcher), so the choice persists across visits.
- Why the try/catch around storage: in sandboxed preview iframes and cookie-blocking browsers, touching `localStorage` throws a `SecurityError` — unguarded, that happens inside `detectLocale()` before first render and leaves the app blank.

TypeScript doesn't know what a `.po` import is, so add a module declaration. Append to `src/vite-env.d.ts` (it exists in every Lovable Vite project), or create `src/po-modules.d.ts` if you prefer not to touch it:

```ts
declare module '*.po' {
  import type { Messages } from '@lingui/core'
  export const messages: Messages
}
```

### A5. Provider in `src/main.tsx`

Wrap the app with `I18nProvider`, and detect + activate the locale **before** the first render so the UI never flashes untranslated. Preserve the file's existing imports (`./index.css`, etc.):

```tsx
// src/main.tsx
import { createRoot } from 'react-dom/client'
import { I18nProvider } from '@lingui/react'
import { i18n, detectLocale, activateLocale } from './i18n'
import App from './App.tsx'
import './index.css'

async function bootstrap() {
  await activateLocale(detectLocale())
  createRoot(document.getElementById('root')!).render(
    <I18nProvider i18n={i18n}>
      <App />
    </I18nProvider>,
  )
}

void bootstrap()
```

If `main.tsx` already wraps `<App />` in other providers, keep them and put `I18nProvider` outermost (everything that renders text needs it above them in the tree).

The preview will show a dynamic-import error from this point until step A7 creates the `.po` catalogs — complete A7 before reading anything into the build output.

### A6. `index.html`

Check the `<html lang="...">` value at the project root:

- Set it to the source locale (e.g. `<html lang="en">`). It's the pre-JavaScript default; `activateLocale()` takes over at runtime.
- If the existing value disagrees with the chosen source locale, flag it to the user — one of the two is wrong.
- Remove any hardcoded `dir` attribute. `activateLocale()` sets `dir` dynamically; a hardcoded value flashes the wrong direction for RTL locales.

### A7. Scaffold the catalogs

Nothing here can run `lingui extract`, so create the catalog files yourself. For **every** locale — including the source locale — create `src/locales/{locale}/messages.po` containing only a valid PO header:

```po
msgid ""
msgstr ""
"Content-Type: text/plain; charset=utf-8\n"
"Language: es\n"
"MIME-Version: 1.0\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\n"
```

Set `Language:` to the file's locale. Set `Plural-Forms` from this list where the locale appears (one line per locale group, expression after the `→`); omit the line otherwise (Lingui stores plurals as ICU expressions inside messages, so the header is informational):

```text
en, es, de, it, nl, pt → nplurals=2; plural=(n != 1);
fr, pt-BR, tr          → nplurals=2; plural=(n > 1);
ja, zh, ko, th, vi, id → nplurals=1; plural=0;
ru, uk                 → nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);
pl                     → nplurals=3; plural=(n==1 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);
ar                     → nplurals=6; plural=(n==0 ? 0 : n==1 ? 1 : n==2 ? 2 : n%100>=3 && n%100<=10 ? 3 : n%100>=11 ? 4 : 5);
```

A header-only catalog is valid: it compiles to an empty message set, and Lingui falls back to the source text for any missing message. Entries get added by the Wrap phase and by CI extraction later.

### A8. Language switcher

Every Lovable project ships shadcn/ui, so build the switcher on the shadcn `Select`:

```tsx
// src/components/LanguageSwitcher.tsx
import { useLingui } from '@lingui/react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LOCALES, activateLocale, saveLocale } from '@/i18n'

export function LanguageSwitcher() {
  const { i18n } = useLingui()
  const displayNames = new Intl.DisplayNames([i18n.locale], { type: 'language' })

  async function switchLocale(locale: string) {
    await activateLocale(locale)
    saveLocale(locale)
  }

  return (
    <Select value={i18n.locale} onValueChange={switchLocale}>
      <SelectTrigger className="w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LOCALES.map((locale) => (
          <SelectItem key={locale} value={locale}>
            {displayNames.of(locale) ?? locale}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

`useLingui()` subscribes the component to locale changes, so the selected value updates after `activateLocale()` resolves. `Intl.DisplayNames` renders each language's name in the **current** locale ("Spanish" / "espagnol" / "Spanisch") with no hand-maintained name map.

Place the switcher where the user can see it — the app's existing header or navigation component if there is one, otherwise the top-level layout in `App.tsx`. Match the surrounding styling (Tailwind classes) rather than keeping the bare `w-[140px]`.

### A9. Verify via the preview

You can't run a build, but you can read the preview:

1. **The preview builds with no errors.** If it fails mentioning the SWC plugin, an AST schema, or plugin invocation — that's the version-pinning caveat from A1; pin `@lingui/swc-plugin` exactly.
2. **Switching languages works.** Pick a locale in the switcher; `document.documentElement.lang` updates (visible in the element inspector, or log it), and the choice survives a reload (localStorage).
3. **Strings still show source text.** Expected — the catalogs are empty until strings are wrapped (Phase 4) and translations arrive (Phase 6). No console errors about failed catalog imports should appear.

Tell the user what to expect at this point: the plumbing is live, the visible text doesn't change yet.

### Opt-in: URL locale routing (`/:locale` prefix)

Only if the user chose the URL-prefix option in the Ask phase. Lovable Vite SPAs use **declarative `react-router-dom`** routes in `src/App.tsx` — wrap the existing `<Routes>` content in a locale segment.

**1. Locale layout.** Create a layout route that validates the URL locale and activates it:

```tsx
// src/components/LocaleLayout.tsx
import { useEffect } from 'react'
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { LOCALES, SOURCE_LOCALE, activateLocale } from '@/i18n'

export function LocaleLayout() {
  const { locale } = useParams()
  const { pathname } = useLocation()
  const valid = locale !== undefined && LOCALES.includes(locale)

  useEffect(() => {
    if (valid) void activateLocale(locale!)
  }, [locale, valid])

  if (!valid) {
    // Bare path like /dashboard — re-prefix with the source locale
    return <Navigate to={`/${SOURCE_LOCALE}${pathname}`} replace />
  }
  return <Outlet />
}
```

**2. Route tree.** In `src/App.tsx`, nest the existing routes under `/:locale` (the old `path="/"` route becomes `index`; other paths lose their leading slash) and redirect the bare root:

```tsx
import { Navigate, Route, Routes } from 'react-router-dom'
import { LocaleLayout } from '@/components/LocaleLayout'
import { detectLocale } from '@/i18n'

// Inside the existing <BrowserRouter>:
<Routes>
  <Route path="/:locale" element={<LocaleLayout />}>
    <Route index element={<Index />} />
    <Route path="dashboard" element={<Dashboard />} />
    {/* ...every other existing route, path without the leading slash... */}
    <Route path="*" element={<NotFound />} />
  </Route>
  <Route path="/" element={<Navigate to={`/${detectLocale()}`} replace />} />
</Routes>
```

Bare deep links (`/dashboard`) match `/:locale` with an invalid param and get re-prefixed by `LocaleLayout`; the bare root (`/`) redirects to the visitor's detected locale. Keep the `main.tsx` bootstrap from A5 unchanged — it sets the initial locale, and `LocaleLayout` re-activates per URL from then on.

**3. Link helper.** Internal links need the prefix:

```ts
// src/localePath.ts
export function localePath(locale: string, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `/${locale}${normalized}`
}
```

```tsx
import { Link, useParams } from 'react-router-dom'
import { localePath } from '@/localePath'
import { SOURCE_LOCALE } from '@/i18n'

function Navigation() {
  const { locale } = useParams()
  const currentLocale = locale ?? SOURCE_LOCALE

  return (
    <nav>
      <Link to={localePath(currentLocale, '/')}>Home</Link>
      <Link to={localePath(currentLocale, '/dashboard')}>Dashboard</Link>
    </nav>
  )
}
```

Update every existing internal `<Link to="/...">`, `<a href="/...">` (internal paths), and `navigate('/...')` call to go through `localePath()`. Navigation components (header, sidebar, footer) first — they're on every page.

**4. Switcher navigates instead of activating.** With the locale in the URL, switching language means navigating to the same page under the new prefix — `LocaleLayout` handles activation:

```tsx
// src/components/LanguageSwitcher.tsx (routing variant)
import { useLingui } from '@lingui/react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LOCALES, saveLocale } from '@/i18n'

export function LanguageSwitcher() {
  const { i18n } = useLingui()
  const { locale } = useParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const displayNames = new Intl.DisplayNames([i18n.locale], { type: 'language' })

  function switchLocale(next: string) {
    saveLocale(next)
    const basePath = locale ? pathname.slice(locale.length + 1) : pathname
    navigate(`/${next}${basePath || '/'}`)
  }

  return (
    <Select value={i18n.locale} onValueChange={switchLocale}>
      <SelectTrigger className="w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LOCALES.map((loc) => (
          <SelectItem key={loc} value={loc}>
            {displayNames.of(loc) ?? loc}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

Verify in the preview: `/` redirects to `/<locale>`, deep links re-prefix, switching languages keeps you on the same page under the new prefix.

---

## Phase 2B: Setup — TanStack Start (SSR)

Eight steps, B1–B8, in order. The defining constraint of this path: the app renders on the server (Cloudflare Workers), so **i18n state must be per-request**. A module-level i18n singleton activated per request would leak locales across concurrent users — request 2 activating `fr` mid-render of request 1 sends French HTML to an English visitor. Every server-side snippet below creates a fresh `setupI18n()` instance per request instead.

Locale selection on this path is **cookie-based**: a `locale` cookie carries the visitor's choice, the `accept-language` header is the fallback, and the server picks the locale before rendering — so the first paint is already in the right language, with no client-side flash.

### B1. Dependencies

Add these dependencies (do not write install commands — add them to the project's dependencies directly):

Runtime dependencies:

| Package | Version | Purpose |
|---|---|---|
| `@lingui/core` | `^6` | i18n runtime (`setupI18n` for per-request instances) |
| `@lingui/react` | `^6` | React bindings (`I18nProvider`, `Trans`, `useLingui`) |

Do **not** add `@lingui/detect-locale` on this path — it reads `window` and `localStorage` and throws on the server. Locale detection happens from the request (cookie + `accept-language`) in B4.

Dev dependencies:

| Package | Version | Purpose |
|---|---|---|
| `@lingui/cli` | `^6` | Used only by the GitHub Actions workflow (Phase 5) — never run here |
| `@lingui/babel-plugin-lingui-macro` | `^6` | Babel macro transform — Start uses `@vitejs/plugin-react` (Babel-based), not SWC |
| `@lingui/vite-plugin` | `^6` | Compiles `.po` catalogs when the app imports them |
| `@lingui/format-po` | `^6` | PO catalog formatter for `lingui.config.ts` |

Note the macro plugin difference from Path A: Lovable's TanStack Start template ships the **Babel** React plugin, so this path always uses `@lingui/babel-plugin-lingui-macro`, never `@lingui/swc-plugin`.

### B2. `vite.config.ts`

Lovable's Start template wraps the entire Vite config in `@lovable.dev/vite-tanstack-config` — it bundles `tanstackStart()`, `viteReact()`, Tailwind, the Cloudflare plugin, `lovable-tagger`, env injection, and the `@` alias internally. **Do not add any of those plugins manually** — duplicates break the build (the config's own comment warns about this). The wrapper exposes exactly the two options Lingui needs: `plugins` for extra Vite plugins and `react` for options forwarded to `viteReact()`:

```ts
// vite.config.ts
import { defineConfig } from '@lovable.dev/vite-tanstack-config'
import { lingui } from '@lingui/vite-plugin'

export default defineConfig({
  plugins: [lingui()],
  react: { babel: { plugins: ['@lingui/babel-plugin-lingui-macro'] } },
})
```

Preserve any options already passed to `defineConfig` — merge, don't replace.

**Fallback — Start project without the Lovable wrapper.** If `vite.config.ts` uses plain Vite `defineConfig` with explicit plugins, the order matters: `lingui()`, then `tanstackStart()`, then the React plugin (it must come after Start's):

```ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { lingui } from '@lingui/vite-plugin'

export default defineConfig({
  plugins: [
    lingui(),
    tanstackStart(),
    viteReact({ babel: { plugins: ['@lingui/babel-plugin-lingui-macro'] } }),
  ],
})
```

### B3. `lingui.config.ts`

Identical to Path A — create the file exactly as in **A3** (PO formatter, `src/locales/{locale}/messages` catalog path, locales from the Ask phase).

### B4. Per-request i18n: shared module, locale resolution, middleware, router

This is the load-bearing step — six files. Pick these paths and keep them consistent everywhere.

**1. `src/i18n.ts`** — isomorphic (safe to import on server and client). No `document`, no `localStorage`:

```ts
// src/i18n.ts
import type { Messages } from '@lingui/core'

// Must match the `locales` array in lingui.config.ts
export const LOCALES: readonly string[] = ['en', 'es', 'fr']
export const SOURCE_LOCALE = 'en'
const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi'])

export function getDirection(locale: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale.split('-')[0]) ? 'rtl' : 'ltr'
}

export async function loadCatalog(locale: string): Promise<Messages> {
  try {
    const { messages } = await import(`./locales/${locale}/messages.po`)
    return messages
  } catch (e) {
    console.error(`Failed to load "${locale}" catalog, falling back to "${SOURCE_LOCALE}"`, e)
    const { messages } = await import(`./locales/${SOURCE_LOCALE}/messages.po`)
    return messages
  }
}
```

The dynamic import targets the `.po` file directly — `@lingui/vite-plugin` compiles it into the bundle at build time, so catalog loading works on Cloudflare Workers with no runtime filesystem. Add the same `*.po` module declaration from **A4** (in `src/vite-env.d.ts` or `src/po-modules.d.ts`).

**2. `src/modules/lingui/i18n.server.ts`** — server-only locale resolution from the request. Plain string parsing, no extra dependencies:

```ts
// src/modules/lingui/i18n.server.ts
import { LOCALES, SOURCE_LOCALE } from '@/i18n'

function matchLocale(candidate: string): string | null {
  if (LOCALES.includes(candidate)) return candidate
  // Regional fallback: es-MX → es
  const base = candidate.split('-')[0]
  if (LOCALES.includes(base)) return base
  return null
}

export function getLocaleFromRequest(request: Request): string {
  // 1. Explicit choice — `locale` cookie set by the language switcher (B7)
  const cookieHeader = request.headers.get('cookie')
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const [name, ...rest] = part.trim().split('=')
      if (name === 'locale') {
        const matched = matchLocale(decodeURIComponent(rest.join('=')))
        if (matched) return matched
      }
    }
  }

  // 2. Browser preference — accept-language header, entries in preference order
  const acceptLanguage = request.headers.get('accept-language')
  if (acceptLanguage) {
    for (const part of acceptLanguage.split(',')) {
      const candidate = part.split(';')[0].trim() // strip ;q=... weights
      if (!candidate || candidate === '*') continue
      const matched = matchLocale(candidate)
      if (matched) return matched
    }
  }

  // 3. Default
  return SOURCE_LOCALE
}
```

**3. `src/modules/lingui/lingui-middleware.ts`** — request middleware that builds the per-request i18n instance and passes it down through the start context:

```ts
// src/modules/lingui/lingui-middleware.ts
import { setupI18n } from '@lingui/core'
import { createMiddleware } from '@tanstack/react-start'
import { loadCatalog } from '@/i18n'
import { getLocaleFromRequest } from './i18n.server'

export const linguiMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ request, next }) => {
    const locale = getLocaleFromRequest(request)
    const i18n = setupI18n() // fresh instance per request — never a module-level singleton
    i18n.load(locale, await loadCatalog(locale))
    i18n.activate(locale)
    return next({ context: { locale, i18n } })
  },
)
```

**4. `src/start.ts`** — register the middleware. If the file already exists (the template sometimes ships it), add `linguiMiddleware` to the existing `requestMiddleware` array; if not, create it:

```ts
// src/start.ts
import { createStart } from '@tanstack/react-start'
import { linguiMiddleware } from './modules/lingui/lingui-middleware'

export const startInstance = createStart(() => ({
  requestMiddleware: [linguiMiddleware],
}))
```

**5. `src/router.tsx`** — `getRouter()` is called once per request on the server (the template already creates a fresh QueryClient per call for the same reason). Pull the per-request i18n from the start context, wrap the app in `I18nProvider`, and wire dehydrate/hydrate so the client first paint matches the server exactly:

```tsx
// src/router.tsx
import { setupI18n, type I18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { createRouter } from '@tanstack/react-router'
import { getGlobalStartContext } from '@tanstack/react-start'
import { SOURCE_LOCALE } from './i18n'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  // Server: the lingui middleware put a per-request i18n instance in the start
  // context. Client: no middleware ran — create a fresh instance; hydrate()
  // below fills it from the server's dehydrated state before first render.
  const i18n: I18n =
    getGlobalStartContext()?.i18n ??
    setupI18n({ locale: SOURCE_LOCALE, messages: { [SOURCE_LOCALE]: {} } })

  return createRouter({
    routeTree,
    context: { i18n }, // merge into the existing context object (queryClient, ...)
    Wrap: ({ children }) => <I18nProvider i18n={i18n}>{children}</I18nProvider>,
    dehydrate: () => ({
      locale: i18n.locale,
      messages: i18n.messages, // catalog for the active locale
    }),
    hydrate: (dehydrated) => {
      i18n.loadAndActivate({ locale: dehydrated.locale, messages: dehydrated.messages })
    },
  })
}
```

Keep everything already in `getRouter()` — the QueryClient, existing `context` entries, `defaultPreload`, etc. Only add the i18n pieces.

> **API drift warning:** `getGlobalStartContext` has been moving between `@tanstack/react-start` versions. If the import doesn't exist in the installed version, check how the installed `@tanstack/react-start` exposes the request-scoped start context (the export name and location have changed across releases) and adapt this one line — the rest of the pattern is unchanged.

**6. `src/routes/__root.tsx`** — extend the route context type with `i18n` and replace the template's hardcoded `<html lang="en">`. The template's root route uses `createRootRouteWithContext` with a `shellComponent` (RootDocument); `Wrap` from step 5 renders above the shell, so `useLingui()` works here:

```tsx
// src/routes/__root.tsx (i18n-relevant parts — keep everything else in the file)
import type { I18n } from '@lingui/core'
import { useLingui } from '@lingui/react'
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { getDirection } from '@/i18n'

// Add `i18n` to the EXISTING context type — e.g. if the template already has
// { queryClient: QueryClient }, it becomes { queryClient: QueryClient; i18n: I18n }
export const Route = createRootRouteWithContext<{ i18n: I18n }>()({
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { i18n } = useLingui()
  return (
    <html lang={i18n.locale} dir={getDirection(i18n.locale)}>
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

Because the server resolved the locale before rendering, the HTML arrives already translated with the correct `lang` and `dir` — no client-side correction, no flash.

> **Do not localize `head()` / meta titles yet.** Putting translated strings in a route's `head()` triggers a known TanStack Router hydration bug (issue #4279) that duplicates head content. Leave route titles and meta descriptions in the source language for now; localize body content only.

### B5. Scaffold the catalogs

Same as Path A — create `src/locales/{locale}/messages.po` for every locale exactly as in **A7** (valid PO header, `Language:` and `Plural-Forms` per locale, source locale included).

### B6. Routing: cookie-based by default

The default flow keeps URLs untouched — the locale lives in the cookie, and every URL serves the visitor's language. No route changes, no link rewriting.

A URL-prefix variant (`/es/dashboard` via an `src/routes/$locale/` layout route that validates the param and activates that locale's catalog) exists and matters more under SSR than in a SPA — per-language URLs are crawlable and indexable. It's out of scope for the default flow; mention it to the user as a future option if they ask about SEO for translated pages.

### B7. Language switcher

Two files. The switcher calls a server function that sets the `locale` cookie, then does a full reload so the server re-renders everything under the new cookie — simple and correct, since i18n state is per-request.

> **Critical file-split rule:** a file that defines `createServerFn` must **not** also use Lingui macros — the macro transform and the server-function extraction conflict and break the build. Keep the server function in its own macro-free file. Inside any server-function handler that needs translated text, use ``i18n._(msg`...`)`` with the request's i18n instance — never bare `t` macros.

**1. `src/modules/lingui/locale-fn.ts`** — the server function (no macros in this file):

```ts
// src/modules/lingui/locale-fn.ts
// No Lingui macros in this file — see the file-split rule above.
import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import { LOCALES } from '@/i18n'

export const setLocaleServerFn = createServerFn({ method: 'POST' })
  .inputValidator((locale: string) => {
    if (!LOCALES.includes(locale)) throw new Error(`Unsupported locale: ${locale}`)
    return locale
  })
  .handler(async ({ data: locale }) => {
    setResponseHeader(
      'Set-Cookie',
      `locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`,
    )
  })
```

(Older Start versions name the validator step `.validator()` instead of `.inputValidator()` — match what the installed `@tanstack/react-start` exports.)

**2. `src/components/LanguageSwitcher.tsx`** — shadcn `Select`, same look as Path A's:

```tsx
// src/components/LanguageSwitcher.tsx
import { useLingui } from '@lingui/react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LOCALES } from '@/i18n'
import { setLocaleServerFn } from '@/modules/lingui/locale-fn'

export function LanguageSwitcher() {
  const { i18n } = useLingui()
  const displayNames = new Intl.DisplayNames([i18n.locale], { type: 'language' })

  async function switchLocale(locale: string) {
    await setLocaleServerFn({ data: locale })
    // Full reload: the server re-renders with the new cookie, so SSR output,
    // hydration state, and <html lang/dir> all change together.
    window.location.reload()
  }

  return (
    <Select value={i18n.locale} onValueChange={switchLocale}>
      <SelectTrigger className="w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LOCALES.map((locale) => (
          <SelectItem key={locale} value={locale}>
            {displayNames.of(locale) ?? locale}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

Place it in the app's existing header or navigation, matching the surrounding styling.

### B8. Verify via the preview

1. **The preview builds with no errors.** A build break right after adding a server function almost always means macros and `createServerFn` ended up in the same file — re-check the B7 file split.
2. **First paint is already localized.** With a non-source `accept-language` (or the cookie set), the page arrives in that language with no flash of source-language content.
3. **Switching locale round-trips.** Pick a language in the switcher: the `locale` cookie is set, the page reloads, and the new locale renders.
4. **`<html lang>` is correct in view-source.** The server-rendered HTML (not just the live DOM) carries the right `lang` and `dir` — that's the SSR proof.

Tell the user what to expect: the plumbing is live, but visible text doesn't change until strings are wrapped (Phase 4) and translations arrive (Phase 6).

## Phase 3: Add the coding rules to AGENTS.md

Setup makes translation *possible*; this phase makes it *stick*. Every future edit to this project — by you, in any later chat — must keep new strings wrapped and catalogs updated. Write the rules below into the repo-root `AGENTS.md` so they're always in force.

Mechanics:

- If `AGENTS.md` doesn't exist, create it containing exactly the block below.
- If it exists, append the block at the end.
- The block is wrapped in `<!-- lovable-i18n:rules:start -->` / `<!-- lovable-i18n:rules:end -->` markers. If those markers already exist in the file, **replace** everything between them (inclusive of nothing else) — this makes re-running the skill safe.
- Substitute the real source locale for `en` in the catalog-upkeep section if it differs.

Write this block (everything between and including the markers):

````markdown
<!-- lovable-i18n:rules:start -->
# i18n coding rules (Lingui)

This app is localized with Lingui. Every user-visible string must be wrapped in a Lingui macro, and every NEW string must also be added to the PO catalogs (see "Catalog upkeep" below). Apply these rules to every edit.

## Picking the right macro

```
Does the wording change with a number ("1 item" / "3 items")?
  YES → <Plural> in JSX, or t`{count, plural, one {...} other {...}}` elsewhere

Is the text rendered in JSX?
  YES → <Trans>text</Trans>

Is it a prop/attribute value (placeholder, aria-label, title, alt) or a string
built in an event handler (toast message)?
  YES → const { t } = useLingui()  then  t`text`

Is it defined outside a component (constant, config object, array)?
  YES → msg`text` to define; resolve with t(descriptor) inside the component

Is it inside a TanStack Start server-function handler?
  YES → i18n._(msg`text`) with the request's i18n instance — never bare t
```

Imports: JSX macros and `useLingui` come from `@lingui/react/macro`; `msg`, `t`, and `ph` come from `@lingui/core/macro`. Never import from the deprecated `@lingui/macro`.

## Patterns

JSX text:

```tsx
import { Trans } from '@lingui/react/macro'
<h1><Trans>Dashboard</Trans></h1>
```

Props, attributes, and event-handler strings:

```tsx
import { useLingui } from '@lingui/react/macro'
function Field() {
  const { t } = useLingui()
  return <input placeholder={t`Search...`} aria-label={t`Search`} />
}
// In handlers: toast.success(t`Changes saved`)
```

Module-scope constants — `msg` defines, `t(descriptor)` resolves at render. Bare ``t`...` `` at module scope evaluates once at import time, in the source locale, and never updates:

```tsx
import { msg } from '@lingui/core/macro'
const navItems = [{ label: msg`Home`, href: '/' }]
// in the component: const { t } = useLingui(); ... {t(item.label)}
```

Interpolation: only a bare variable (`${name}`) auto-names its placeholder. Any other expression (`user.name`, a function call) extracts as `{0}`, meaningless to translators — name it with `ph()`:

```tsx
import { ph } from '@lingui/core/macro'
t`Total: ${ph({ total: i18n.number(amount) })}`   // → "Total: {total}", not "{0}"
```

## Plurals

```tsx
<Plural value={count} one="# item" other="# items" />
// non-JSX: t`{count, plural, one {# item} other {# items}}`
```

- `other` is always required — it's the fallback for every language.
- `#` is the count placeholder; don't repeat the variable name.
- Categories are CLDR: `zero`, `one`, `two`, `few`, `many`, `other`.
- Never build plurals with a ternary between two separate strings — that bakes English plural rules into the code.
- `value` must be a number.

## Numbers and dates

Use `i18n.number()` and `i18n.date()` (from `useLingui()`) — never hand-rolled formatting. Flag for review any `toFixed()`, `"$" + price` concatenation, or hardcoded date patterns like `"MM/DD/YYYY"`.

## What not to wrap

CSS class names, `console.log`/debug strings, import paths, object keys and internal codes, `ALL_CAPS` enum/variant values, `data-testid` attributes, URL strings and API paths, code identifiers.

## Translator comments

Add a comment when the string is ambiguous without seeing the UI:

- 1–2 word strings with multiple possible readings ("Home", "Track").
- Action labels without a visible object ("Remove" — remove what?).
- Placeholders whose meaning isn't obvious (`{count} remaining` — remaining what?).
- Domain-specific terms whose meaning depends on this app's domain.

Syntax: `<Trans comment="Main nav link, not the building">Home</Trans>`, `t({ message: 'Clear', comment: 'Clear search input' })`, `msg({ message: 'Save', comment: 'Save document button' })`. Describe where the string appears and what it refers to (not what the word means); keep it under 80 characters.

Use `context` (not `comment`) when the **same text needs different translations** in different places — it splits the catalog entry: `<Trans context="direction">Right</Trans>` vs `<Trans context="correctness">Right</Trans>`.

## Catalog upkeep (this project's workflow)

- Every NEW user-visible string must be wrapped AND appended as an entry to **every** `src/locales/*/messages.po` file — including the source-locale (`en`) file. `msgid` is the exact source text (or full ICU expression); `msgstr` stays **empty** in all files (do not copy the msgid into msgstr — Lingui falls back to the source text at runtime).
- Never run lingui CLI commands (`extract`, `compile`) — there is no terminal here; a GitHub Actions workflow runs extraction.
- Never hand-edit `#.` or `#:` comment lines in `.po` files — extraction regenerates them. Translator comments belong in code, via `comment=`.
- When adding a new locale: update `locales` in `lingui.config.ts`, update `LOCALES` in `src/i18n.ts`, and scaffold `src/locales/<locale>/messages.po` with a valid PO header.
<!-- lovable-i18n:rules:end -->
````

After writing the file, tell the user in one sentence that the coding rules are now in `AGENTS.md`, so future edits in any chat will keep new text translatable.

## Phase 4: Wrap existing strings

The app's existing hardcoded text becomes translatable here. Apply the Phase 3 rules (they're in `AGENTS.md` now — they bind you too); this phase adds the conversion-specific workflow on top.

**For every string you wrap, add the matching entry to every catalog file** per the [PO catalog maintenance protocol](#po-catalog-maintenance-protocol) below. Wrapping without the catalog entry means the string can never receive a translation until CI runs; do both in the same edit.

### Work order

1. **App shell and navigation first** — header, sidebar, footer, nav data. These appear on every page, so they pay off immediately.
2. **Shared components** — buttons, dialogs, empty states, form fields used across pages.
3. **Pages/routes** — one page at a time, top of the route tree downward.

Work **file by file**, and after each batch of a few files, confirm the preview still builds before continuing. A macro typo discovered three files later is much harder to locate.

### What counts as user-visible

Wrap: JSX text, placeholders, `aria-label` / `title` / `alt` attributes, button labels, toast and notification messages, validation messages, empty states, loading/error copy, confirmation dialogs, page headings. Skip: everything on the Phase 3 "what not to wrap" list. On Path B, leave route `head()` titles and meta strings unwrapped for now (hydration bug — see B4).

### Conversion patterns

Basics — `<Trans>` for JSX, `useLingui()` + `` t`...` `` for props and handlers — are in the Phase 3 rules. The patterns below are the ones conversion work actually trips over.

**Nav/sidebar data arrays.** Constants at module scope can't call `t` (it would resolve once, at import time, in the source locale). Mark with `msg`, resolve at render:

```tsx
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import type { MessageDescriptor } from '@lingui/core'

const sidebarItems: Array<{ label: MessageDescriptor; href: string }> = [
  { label: msg({ message: `Dashboard`, comment: 'Main navigation sidebar' }), href: '/' },
  { label: msg`Users`, href: '/users' },
  { label: msg`Settings`, href: '/settings' },
]

function Sidebar() {
  const { t } = useLingui()
  return (
    <nav>
      {sidebarItems.map((item) => (
        <a key={item.href} href={item.href}>{t(item.label)}</a>
      ))}
    </nav>
  )
}
```

The same pattern applies to copy exported from shared modules (`lib/copy.ts`): export `MessageDescriptor` values via `msg`, never raw strings, and resolve with `t(descriptor)` at the call site.

**Form validation (zod and friends).** Schema definitions run outside render — same `msg`-then-resolve pattern:

```tsx
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'

const fieldErrors = {
  required: msg`This field is required`,
  email: msg`Enter a valid email address`,
  minLength: msg`Must be at least 8 characters`,
}

function SignUpForm() {
  const { t } = useLingui()
  function validate(value: string) {
    if (!value) return t(fieldErrors.required)
    if (value.length < 8) return t(fieldErrors.minLength)
    return null
  }
  // ...
}
```

**Toasts inside handlers.** Handlers close over the component's `t`, so plain `` t`...` `` works:

```tsx
const { t } = useLingui()
async function handleSave() {
  try {
    await save()
    toast.success(t`Changes saved successfully`)
  } catch {
    toast.error(t`Failed to save changes. Please try again.`)
  }
}
```

**Hand-rolled formatting.** Replace `"$" + price`, `toFixed()`, and date-string concatenation with the locale-aware helpers:

```tsx
const { i18n } = useLingui()
<span>{i18n.number(amount, { style: 'currency', currency: 'USD' })}</span>
<time>{i18n.date(new Date(timestamp), { dateStyle: 'medium' })}</time>
```

**Count-dependent strings.** Anything like `` `${items.length} results` `` is a plural, even when the English happens to look fine — convert to `<Plural>` / ICU per the Phase 3 rules, and put the **full ICU expression** in the catalog msgid.

**Path B server functions.** Inside `createServerFn` handlers, use ``i18n._(msg`...`)`` with the request's i18n instance, and keep macros out of files that define server functions (B7 rule).

### Translator comments — now, not later

This is the moment the Phase 3 comment rules bite: while wrapping, you're looking at each string in its UI context, which is exactly what the comment must capture. Run the ambiguity check (short strings, bare action labels, unclear placeholders, domain terms) on every wrap and add `comment=` inline. The comments flow into the `.po` files via CI extraction and reach translators through Globalize.

### End-of-phase verification

1. **The preview builds** with no macro or import errors.
2. **Spot-check key pages** — nothing renders as a raw descriptor object, `{0}`, or unprocessed ICU text.
3. **Switch locale** — strings still show source text (translations don't exist yet; that's Phase 6), with no console errors about catalog imports.
4. **Hunt for stragglers** — scan components for remaining string literals in JSX text positions and in `placeholder=` / `aria-label=` / `title=` / `alt=` attributes; wrap what you find.
5. **Catalog parity** — every wrapped string has an entry in every `src/locales/*/messages.po`.

Tell the user what changed: how many files were converted, and that the app is now fully translatable but still shows source-language text until translations arrive.

## PO catalog maintenance protocol

Until the CI workflow (Phase 5) takes over, you maintain the `.po` files by hand. Follow this protocol exactly so your entries are byte-compatible with what `lingui extract` produces — then CI's first run normalizes rather than fights your work.

### Entry shape

This is exactly what `lingui extract` writes; match it:

```po
#. A translator comment from the comment= prop
#: src/components/Header.tsx
msgid "Welcome back, {name}!"
msgstr ""
```

- `#.` line: only when the code has a `comment=` for this string.
- `#:` line: the source file path where the string lives.
- `msgid`: the **exact** source text — including placeholder names (`{name}`) exactly as the macro produces them.
- `msgstr`: empty (see below).
- One blank line between entries.
- When the code uses `context=`, add `msgctxt "the context value"` on its own line directly above `msgid`.

Plural and other ICU strings put the **full ICU expression** in the msgid:

```po
#: src/components/CartBadge.tsx
msgid "{count, plural, one {# item} other {# items}}"
msgstr ""
```

### Rules

- **Every locale gets the entry — including the source locale.** All with `msgstr ""`. Lingui falls back to the source text (the msgid) at runtime for any missing message, so empty msgstr renders correctly in the source locale and signals "untranslated" to the translation platform for the targets. Never copy the msgid into msgstr.
- **Append-only.** Add new entries at the end of each file. Never reorder existing entries, never rewrite `#.` / `#:` lines on entries you didn't author, never reformat the file.
- **Formatting is CI-owned after the first CI run.** Extraction regenerates `#:` references and `#.` comments from code, adds missing entries, removes entries whose source strings are gone (`--clean`), and normalizes ordering — while **preserving existing `msgstr` translations**. Any hand-decoration you add beyond the shape above will be erased; any translation in msgstr survives.

### "Translate it now"

If the user asks for translations before Globalize is connected, you may fill the target-locale `msgstr` values yourself — but tell the user these are machine-draft translations, unreviewed, and that Globalize will manage real translations once connected (Phase 6). Drafts in msgstr survive CI extraction and get superseded by platform translations later.

### Sync conflicts

If Lovable reports a GitHub sync conflict on a `.po` file (you and CI/Globalize edited it simultaneously), take the **remote** version — CI and Globalize are the catalog authorities — then re-apply only the entries of yours that are missing from it.

## Phase 5: CI — catalog extraction workflow

Only if the user opted in during Ask. **Precondition:** GitHub is connected in Lovable (Settings → GitHub). If it isn't, tell the user to connect it first — without the sync, the workflow file never reaches GitHub and CI never runs.

This workflow is what retires the hand-maintenance protocol: after every code push, it runs `lingui extract` and commits the normalized catalogs back. You keep adding entries by hand only as a same-edit courtesy (so strings are immediately visible to translators); CI is the authority that fixes anything you got slightly wrong.

Create `.github/workflows/i18n-extract.yml`:

```yaml
name: i18n-extract
on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'lingui.config.*'
      - '!src/locales/**'
permissions:
  contents: write
concurrency:
  group: i18n-extract
  cancel-in-progress: true
jobs:
  extract:
    if: github.actor != 'github-actions[bot]'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24   # Lingui 6 is ESM-only and needs Node >= 22.19
      - run: npm ci
      - run: npx lingui extract --clean
      - name: Commit catalog updates
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add src/locales
          git diff --staged --quiet || (git commit -m "chore(i18n): sync message catalogs [skip ci]" && git push)
```

If the project's default branch isn't `main`, adjust `branches:` to match — Lovable syncs with the default branch.

**If the workflow file fails to sync to GitHub:** Lovable's GitHub App may lack the `workflows` permission, and GitHub rejects pushes that create workflow files without it. In that case, give the user the file path and the full YAML above and ask them to add it via the GitHub web UI (repo → Add file → paste). Everything else proceeds normally.

### Why it's shaped this way

- **No compile step, ever.** `@lingui/vite-plugin` compiles `.po` catalogs during the app build — there is nothing for CI to compile, only extraction to run.
- **Loop prevention is three-layer.** The commit-back could re-trigger the workflow forever; three independent guards stop that: (1) pushes made with the default `GITHUB_TOKEN` don't trigger `on: push` workflows at all; (2) the `!src/locales/**` path filter ignores catalog-only pushes — which also keeps Globalize's translation deliveries from triggering extraction; (3) belt-and-braces, the `[skip ci]` commit tag and the `github.actor` guard.
- **`concurrency` prevents racing pushes.** Two quick Lovable syncs would otherwise run two extractions that both try to push; the group cancels the stale one.
- **The round-trip is fast.** Lovable auto-commits your edit and syncs it to GitHub → the workflow extracts and normalizes the catalogs → the commit-back lands on the default branch → Lovable's two-way sync pulls it into the project within seconds. From then on, treat catalog formatting as CI-owned (see the PO protocol).

Verify with the user after the next code push: the `i18n-extract` run shows up in the repo's Actions tab, and a `chore(i18n): sync message catalogs` commit appears and flows back into Lovable.

## Phase 6: Connect Globalize.now

Only if the user opted in. The Globalize CLI can't run inside Lovable — these steps happen **outside this chat**, on the Globalize dashboard or the user's machine. Your job is to print everything the user needs, ready to paste.

Print this connection summary (with the project's real values):

> **Globalize.now connection details**
> - Project name: `<repo name>` (suggestion)
> - Source language: `en`
> - Target languages: `es`, `fr`
> - Catalog pattern: `src/locales/{locale}/messages.po`
> - File format: `po`

**Option 1 — Globalize.now dashboard (no tooling needed).** On [globalize.now](https://globalize.now): create a project with those source/target languages, connect the GitHub repository (this installs the Globalize GitHub App — approve it in the browser), and set the catalog pattern and file format above.

**Option 2 — Globalize CLI on the user's machine (requires Node.js).** Give the user this sequence to run locally:

```bash
# 1. Sign in (opens the browser for device authorization)
npx @globalize-now/cli-client auth login

# 2. Find the language IDs for your locales (each entry has a `locale` and an `id`)
npx @globalize-now/cli-client languages list --json

# 3. Create the project with those IDs
npx @globalize-now/cli-client projects create \
  --name "<PROJECT_NAME>" \
  --source-language <SOURCE_LANGUAGE_ID> \
  --target-languages <TARGET_ID_1> <TARGET_ID_2> \
  --json

# 4. Install the Globalize GitHub App (opens the browser), then list installations
#    and note both ids: the numeric installationId and the UUID id
npx @globalize-now/cli-client github install
npx @globalize-now/cli-client github installations --json

# 5. Connect the repository with the catalog pattern (use the UUID id here)
npx @globalize-now/cli-client repositories create \
  --project-id <PROJECT_ID> \
  --git-url https://github.com/<OWNER>/<REPO>.git \
  --provider github \
  --github-installation-id <INSTALLATION_UUID> \
  --patterns '[{"pattern": "src/locales/{locale}/messages.po", "fileFormat": "po"}]' \
  --json
```

`@globalize-now/cli-client` is deliberately unpinned — the platform manages its release cadence. If the user works with a local coding agent (Claude Code etc.), point them at the `globalize-now-cli-setup` skill instead — it walks the same flow with full auto-detection.

**Close the loop.** Once connected, Globalize picks up the catalogs from the repo, translates new entries, and delivers translated `.po` files back via PRs or pushes to the default branch. Lovable's GitHub sync pulls them in, and the language switcher starts showing real translations — no action needed in this chat. The CI workflow ignores locale-only pushes (the `!src/locales/**` path filter), so translation deliveries never trigger extraction loops.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Preview build error mentioning "AST schema mismatch" or "failed to invoke plugin" (Path A) | `@lingui/swc-plugin` compiled against a different `swc_core` than `@vitejs/plugin-react-swc` ships | Look up the compatible version at https://plugins.swc.rs and pin `@lingui/swc-plugin` to that **exact** version (no caret) — see the A1 caveat |
| Build fails resolving `@lingui/vite-plugin`, or ESM/`ERR_REQUIRE_ESM`-style errors from Lingui packages | The build image's Node is too old for Lingui 6 (ESM-only, needs Node ≥ 22.19) | Pin **all** `@lingui/*` packages to `@^5` instead. Keep `lingui.config.ts` as-is — the `formatter()` form from `@lingui/format-po` works in v5 too |
| TS error `Cannot find module './locales/en/messages.po'` | Missing the `*.po` module declaration | Add the declaration from A4 (`src/vite-env.d.ts` or `src/po-modules.d.ts`) |
| Strings render as raw ICU (`{count, plural, ...}`) or stay in the source language after switching | Catalog not loaded for that locale (typo in the dynamic import path, missing `.po` file) or the entry is missing from that locale's catalog | Check the `src/locales/<locale>/messages.po` file exists with a valid header (A7) and contains the entry (PO protocol) |
| `<Trans>` renders as literal macro output, but the build succeeds (Path A) | SWC plugin registered as a bare string instead of the `['@lingui/swc-plugin', {}]` tuple | Use the tuple shape in `vite.config.ts` (A2) |
| (Path B) Build breaks right after adding a server function | Lingui macros and `createServerFn` in the same file | Split them: server functions in their own macro-free file; use ``i18n._(msg`...`)`` inside handlers (B7) |
| (Path B) Duplicated `<title>` / head content after hydration | Known TanStack Router issue (#4279) with localized `head()` strings | Don't localize `head()` / meta strings for now — keep them in the source language (B4) |
| (Path B) `getGlobalStartContext` not found / not exported | TanStack Start API drift between versions | Check how the installed `@tanstack/react-start` exposes the request-scoped start context and adapt that one line in `src/router.tsx` (B4) |
| CI workflow never runs | GitHub not connected in Lovable; the workflow file didn't sync (GitHub App lacks the `workflows` permission); or the default branch isn't `main` | Connect GitHub; add the YAML via the GitHub web UI; fix `branches:` in the workflow (Phase 5) |
| CI commits catalog updates but Lovable doesn't show them | Lovable's sync follows the default branch only | Confirm the workflow pushed to the default branch (check the Actions log and the branch of the `chore(i18n)` commit) |
