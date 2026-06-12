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
| Detect | Identify the project stack (Vite SPA or TanStack Start) and any existing i18n |
| Ask | One chat message collecting source locale, target locales, URL routing, opt-ins |
| Setup | Add dependencies, build config, `i18n.ts`, provider, catalogs, language switcher |
| Rules | Add Lingui coding rules to `AGENTS.md` so every future edit stays localized |
| Wrap | Wrap the app's existing hardcoded strings in Lingui macros |
| CI | Add a GitHub Action that runs `lingui extract` and keeps catalogs in sync |
| Connect | Hand off catalogs to the Globalize.now translation platform |

Work the phases in order. Detect and Ask are quick; Setup is the bulk of the work.

---

## Phase 1: Detect

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

### Escape hatches

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

**Existing Lingui config.** If a `lingui.config.ts` (or `.js`) already exists, run in **additive mode**: verify the config matches the shape in A3 (PO formatter, `src/locales/{locale}/messages` catalog path), add any locales the user requested that are missing (config + new `.po` files per A7), confirm the provider is wired (A5) and the vite plugins are present (A2) — fix only what's missing — then skip ahead to Phase 4 (Wrap).

**Before each structural edit.** Before modifying `vite.config.ts`, `src/main.tsx`, `src/App.tsx`, or `index.html`, state in one chat sentence what will change and why (e.g. "I'm adding the Lingui plugins to vite.config.ts so translations compile at build time"), then make the edit. Don't wait for permission — just narrate.

---

## Phase 1: Ask

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

After the user answers, execute the whole plan without further pauses. Only stop again for blockers: a build error you cannot resolve, an escape hatch from Phase 1, or a missing GitHub connection when the user asked for CI.

Record the answers — `SOURCE_LOCALE`, the locale list, routing choice, opt-ins — you will substitute them into every snippet below. The snippets use `en` as source and `['en', 'es', 'fr']` as the locale list; replace with the real choices everywhere.

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
  const detected = detect(fromUrl('lang'), fromStorage('lang'), fromNavigator())
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
  localStorage.setItem('lang', locale)
}

export { i18n }
```

Notes:

- The dynamic import targets the **`.po` file directly** (`./locales/${locale}/messages.po`) — `@lingui/vite-plugin` compiles it to runtime messages at that moment. No compiled `.js`/`.ts` catalogs ever exist in the repo.
- `detectLocale()` tries sources in order: `?lang=` URL parameter → `lang` key in localStorage → browser language (with regional fallback, `es-MX` → `es`) → source locale.
- `activateLocale()` also keeps `<html lang>` and `<html dir>` in sync, so RTL locales (Arabic, Hebrew, Farsi, Urdu…) flip the document direction automatically.
- Call `saveLocale()` only on an explicit user choice (the language switcher), so the choice persists across visits.

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

Set `Language:` to the file's locale. Set `Plural-Forms` from this table where the locale appears; omit the line otherwise (Lingui stores plurals as ICU expressions inside messages, so the header is informational):

| Locales | Plural-Forms |
|---|---|
| en, es, de, it, nl, pt | `nplurals=2; plural=(n != 1);` |
| fr, pt-BR, tr | `nplurals=2; plural=(n > 1);` |
| ja, zh, ko, th, vi, id | `nplurals=1; plural=0;` |
| ru, uk | `nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 \|\| n%100>=20) ? 1 : 2);` |
| pl | `nplurals=3; plural=(n==1 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 \|\| n%100>=20) ? 1 : 2);` |
| ar | `nplurals=6; plural=(n==0 ? 0 : n==1 ? 1 : n==2 ? 2 : n%100>=3 && n%100<=10 ? 3 : n%100>=11 ? 4 : 5);` |

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

<!-- Filled in Task 2 -->

## Phase 3: Add the coding rules to AGENTS.md

<!-- Filled in Task 2 -->

## Phase 4: Wrap existing strings

<!-- Filled in Task 2 -->

## PO catalog maintenance protocol

<!-- Filled in Task 2 -->

## Phase 5: CI — catalog extraction workflow

<!-- Filled in Task 2 -->

## Phase 6: Connect Globalize.now

<!-- Filled in Task 2 -->

## Troubleshooting

<!-- Filled in Task 2 -->
