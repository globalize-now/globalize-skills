---
name: lingui-setup
description: >-
  Set up LinguiJS internationalization in a React-based project. Use this skill when the
  user explicitly mentions LinguiJS, Lingui, or @lingui — or when the i18n-guide skill
  hands off to it after recommending LinguiJS. Supports Vite SPA, Next.js (App Router or
  Pages Router), TanStack Router, React Router, or any other React setup. This skill
  handles the full setup: package installation, config file, build tool integration,
  provider wiring, and locale scaffolding. It does NOT cover converting existing strings
  to macros — that's a separate concern (lingui-convert).
---

# LinguiJS Setup

LinguiJS is a compile-time i18n framework — macros like `<Trans>` and `` t`...` `` are transformed at build time into optimized message lookups, so there's zero runtime overhead from the macro syntax.

Follow these steps in order. Each builds on the last.

### Step Risk Classification

| Step | Risk | Notes |
|------|------|-------|
| 1. Detect | Read-only | No changes to the project |
| 2. Install packages | Additive | New dependencies only |
| 3. Configure | Additive | New `lingui.config.ts` file |
| 4. Build tool | **Modifies existing file** | Changes `vite.config` or `next.config` |
| 5. Provider | **Modifies existing file** | Routing strategy choice, changes root layout / `main.tsx`, may add middleware or new route files |
| 6. Language Switcher | **Modifies existing file** | New component file + wired into layout/navigation |
| 7. ESLint | Additive | Already asks user |
| 8. Scaffold | Additive | New catalog files |
| 9. CI/CD | **Modifies existing file** | Changes build script — **optional, ask first** |
| 10. Tests | Additive | New test wrapper file — **optional, ask first** |

**RULE: Steps that modify existing files require you to describe the exact change to the user and get confirmation before proceeding. Do NOT silently modify existing project files.** _(This rule is modified by the setup mode chosen below.)_

---

## Setup Mode

After Step 1 (detection) completes without blockers, ask the user:

> **How would you like to proceed with the setup?**
> 1. **Guided** — I'll explain each step before and after, and you'll confirm changes to existing files.
> 2. **Unguided** — I'll run all steps without pausing and show a full summary at the end. Optional steps (CI/CD, test setup) will be included — tell me now if you'd like to skip any.

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
- Optional steps (CI/CD, test setup) are **included by default** unless the user excluded them.
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

If the project uses file-based routing, the **locale routing strategy** choice (from the variant reference file) must be presented immediately after mode selection. Collect the answer before proceeding with Step 2.

---

## Step 1: Detect the Project

Read the project's `package.json`, build config (`vite.config.*`, `next.config.*`), and check for `.babelrc` to determine:

| Signal | How to detect |
|--------|--------------|
| **Framework** | `next` in deps → Next.js. `vite` in devDeps → Vite. `react-scripts` → CRA. |
| **Compiler** | `@vitejs/plugin-react-swc` → SWC. `@vitejs/plugin-react` (no `-swc`) → Babel. Next.js → SWC unless `.babelrc` exists. |
| **Router** | `@tanstack/react-router` → TanStack Router. `react-router` → React Router. Next.js → file-based routing. |
| **TypeScript** | `typescript` in devDeps or `tsconfig.json` exists. |
| **Package manager** | `package-lock.json` → npm. `yarn.lock` → yarn. `pnpm-lock.yaml` → pnpm. `bun.lock` → bun. |
| **Route entry points** | Next.js App Router: `src/app/**/page.tsx` exists. TanStack Router (file-based): `src/routes/` directory exists. React Router v7 framework mode: `app/routes/` exists. If none found → plain SPA (no file-based routing). |

Determine whether the project uses **file-based routing** with identifiable page entry points. This decides whether to use per-page catalog splitting (Step 3) or a single global catalog.

### Incompatibility Checks

Before proceeding, check for blockers. **If any check below says STOP, you MUST stop and communicate the issue to the user. Do NOT proceed with Step 2 or any subsequent step. Do NOT attempt workarounds.**

| Check | How to detect | Action |
|-------|--------------|--------|
| **Existing i18n library** | `react-intl`, `react-i18next`, `i18next`, `next-intl`, `next-translate`, `typesafe-i18n`, `@formatjs/intl` in `package.json` deps or devDeps | **STOP.** Tell the user: "{library} is already installed. Adding LinguiJS alongside it will create conflicting translation pipelines. Options: (1) migrate from {library} to LinguiJS (separate effort, not covered by this skill), or (2) remove {library} first, then re-run this setup." Do NOT proceed. |
| **Not a React project** | No `react` in deps. Or: `vue`, `svelte`, `@angular/core`, `solid-js` in deps. | **STOP.** Tell the user: "LinguiJS requires React. This project uses {framework}. This skill cannot set up i18n for non-React projects." Do NOT proceed. |
| **Next.js Pages Router** | `next` in deps AND `pages/` directory with `_app.tsx`/`_app.jsx`, but no `app/` directory with `layout.tsx`/`layout.jsx` | **STOP.** Tell the user: "This project uses the Next.js Pages Router. This skill only covers the App Router. The Pages Router requires a different provider approach (`_app.tsx` wrapping, no RSC, no `setI18n`). Manual setup is needed — refer to the LinguiJS docs for Pages Router guidance." Do NOT proceed. |
| **Custom build pipeline** | No `vite.config.*`, `next.config.*`, or `react-scripts` in deps. Build uses esbuild, Rollup, Webpack (without CRA), Parcel, or another tool directly. | **STOP.** Tell the user: "This project uses {tool} as its build tool. LinguiJS requires a macro transform plugin (SWC or Babel) integrated into the build. This skill does not cover {tool} integration. To set up manually: install `@lingui/babel-plugin-lingui-macro` and add it as a Babel plugin in your build config. See https://lingui.dev/ref/babel-plugin for details." Do NOT proceed. |

Based on the detection, pick the right variant reference file:

- **Next.js App Router** → read `references/nextjs-app-router.md`
- **Vite + SWC** (including TanStack Router, React Router, plain Vite) → read `references/vite-swc.md`
- **Vite + Babel** → read `references/vite-babel.md`

Then continue with Steps 2-9 below, using the variant-specific instructions from the reference file for Steps 4, 5, and 6.

If no blockers were found, proceed to the **Setup Mode** prompt before continuing to Step 2.

---

## Step 2: Install Packages

Use the project's existing package manager. The packages to install depend on the variant — the reference file specifies exactly which ones.

**Core packages (always needed):**

| Package | Type | Purpose |
|---------|------|---------|
| `@lingui/core` | runtime | Core i18n engine |
| `@lingui/react` | runtime | React bindings (`I18nProvider`, hooks) |
| `@lingui/macro` | runtime | Compile-time macros (`Trans`, `t`, `msg`) |
| `@lingui/cli` | dev | CLI for extract/compile commands |

Additional packages (compiler plugin, build tool plugin) are specified in the reference file.

---

## Step 3: Configure LinguiJS

Create `lingui.config.ts` (or `.js` for CJS projects) in the project root, next to `package.json`.

First, create the shared locale constants module. This file is the single source of truth for locale configuration — both `lingui.config.ts` and runtime code (layouts, middleware) import from it:

```ts
// src/i18n/locales.ts
export const sourceLocale = 'en'
export const locales = ['en'] as const
export type Locale = (typeof locales)[number]
```

Populate `sourceLocale` with the detected source locale, and `locales` with the source locale plus any target locales the user requested.

### Per-page catalogs (default for file-based routing)

If the project has file-based routing (detected in Step 1), use Lingui's experimental extractor to produce per-page catalogs. This crawls the dependency tree from each route entry point, so every page only loads the translations it actually uses — critical for keeping bundle sizes small at scale.

```ts
import type { LinguiConfig } from '@lingui/conf'
import { locales, sourceLocale } from './src/i18n/locales'

const config: LinguiConfig = {
  sourceLocale,
  locales: [...locales],
  catalogs: [],
  experimental: {
    extractor: {
      entries: ['<rootDir>/src/app/**/page.tsx'],
      output: '<rootDir>/{entryDir}/locales/{entryName}/{locale}',
    },
  },
}

export default config
```

Set the `entries` glob to match the project's route entry points:

| Router | `entries` glob |
|--------|---------------|
| Next.js App Router | `<rootDir>/src/app/**/page.tsx` |
| TanStack Router (file-based) | `<rootDir>/src/routes/**/*.tsx` |
| React Router v7 framework mode | `<rootDir>/app/routes/**/*.tsx` |

Adjust the file extension (`.tsx` vs `.jsx` / `.ts` vs `.js`) to match the project. The `output` pattern uses `{entryDir}` (directory of the entry file), `{entryName}` (filename without extension), and `{locale}` to place catalogs co-located next to each page — e.g., `src/app/about/page.tsx` produces `src/app/about/locales/page/en.po`.

Shared components imported by multiple pages will have their strings duplicated across each page's catalog. This is the expected trade-off — smaller per-page bundles at the cost of slightly larger total catalog size.

> The experimental extractor is labeled "experimental" in Lingui v4 but is stable for production use.

**Optional: merge per-page catalogs at compile time.** If you want per-page extraction (for translator workflow — translators see only the strings relevant to each page) but prefer loading a single catalog file per locale at runtime (simpler provider wiring, no per-route dynamic imports), add `catalogsMergePath` to the config:

```ts
const config: LinguiConfig = {
  // ...same experimental.extractor config as above...
  catalogsMergePath: 'locales/{locale}',
}
```

With this set, `lingui compile` merges all per-page `.po` files into one output file per locale at `locales/en.ts`, `locales/fr.ts`, etc. The provider wiring then follows the single-catalog pattern (load one file, pass to `i18n.load()`) instead of per-route dynamic imports.

### Single catalog (for plain SPAs without file-based routing)

If the project has no file-based routing (plain Vite SPA, CRA, or programmatic routing only), use a single global catalog:

```ts
import type { LinguiConfig } from '@lingui/conf'
import { locales, sourceLocale } from './src/i18n/locales'

const config: LinguiConfig = {
  sourceLocale,
  locales: [...locales],
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['src'],
    },
  ],
}

export default config
```

### Common config options

Adjust based on context:

- **`sourceLocale`**: The language the source code is written in. Almost always `'en'`.
- **`locales`**: Include the source locale plus any target languages the user requested.
- **Monorepos**: Each package with UI code gets its own `lingui.config.ts` next to its `package.json` — not in the monorepo root. Run extraction and compilation per-package. Shared components imported from other workspace packages are followed automatically by the extractor; their strings appear in the importing package's catalogs. Adjust `include` paths (single catalog) or `entries` paths (per-page) to be relative to the package root.
- **`fallbackLocales`**: Controls what happens when a translation is missing for a given locale. By default, Lingui uses [CLDR parent locales](https://github.com/unicode-cldr/cldr-core/blob/master/supplemental/parentLocales.json) — so a missing `es-MX` translation automatically falls back to `es`, then to the source string. This works out of the box with no configuration. To customize the chain or set a global default:

  ```ts
  const config: LinguiConfig = {
    // ...
    fallbackLocales: {
      'es-MX': 'es',
      'pt-BR': 'pt',
      default: 'en',
    },
  }
  ```

  Set `fallbackLocales: false` to disable fallback entirely (uses the source message or message ID when a translation is missing). The CLDR default is the right choice for most projects — only override if you need non-standard chains.

- **Catalog format**: Lingui defaults to PO (gettext) format — the industry standard with rich metadata and broad TMS/translation tool support. This is the recommended format for most projects. If the team's translation tooling requires a different format, Lingui also supports `@lingui/format-json`, `@lingui/format-csv`, and `@lingui/format-po-gettext`. Ask the user before changing from the default. To use an alternative format, install the format package and add the `format` key to the config:

  ```ts
  import { formatter } from '@lingui/format-json'

  const config: LinguiConfig = {
    // ...
    format: formatter({ style: 'minimal' }),
  }
  ```

### Scripts

Add extract and compile scripts to `package.json`:

**Per-page catalogs:**
```json
{
  "scripts": {
    "lingui:extract": "lingui extract-experimental --clean",
    "lingui:compile": "lingui compile --typescript"
  }
}
```

**Single catalog:**
```json
{
  "scripts": {
    "lingui:extract": "lingui extract --clean",
    "lingui:compile": "lingui compile --typescript"
  }
}
```

The `--typescript` flag generates `.ts` catalog files instead of `.js`, giving type checking on message IDs. **Only add `--typescript` if the project uses TypeScript** (detected in Step 1). For JavaScript-only projects, use `"lingui compile"` without the flag.

---

## Step 4: Integrate with the Build Tool

**This step modifies the project's build configuration** (`vite.config.ts`, `next.config.js`, etc.). Before making changes:

1. Describe the specific modification to the user (e.g., "I will add `@lingui/swc-plugin` to the `plugins` array in the `react()` call in `vite.config.ts`").
2. If the build config has unusual structure or plugins you don't recognize, show the proposed change and ask for confirmation.
3. Proceed only after the user confirms.

Follow the variant-specific reference file for this step. It tells you exactly how to modify the build config and which compiler plugin to wire in.

---

## Step 5: Wire Up the Provider

**This step modifies existing project files** (root layout, `main.tsx`, or root route component). Before making changes:

1. List the specific files you will modify and describe what changes you will make.
2. Ask the user to confirm before proceeding.

Follow the variant-specific reference file for this step. The reference file presents a **locale routing strategy choice** — wait for the user to choose before proceeding. The provider pattern differs significantly between standard React apps (simple `I18nProvider` wrapper) and Next.js App Router (RSC-aware setup with `setI18n` + client provider + middleware), and also depends on the chosen routing strategy.

For **standard React apps** (Vite, CRA), the provider goes in:
- `main.tsx` if the app has no router
- The root layout component if using TanStack Router (`__root.tsx`) or React Router (root layout)

The goal is to wrap the entire component tree once, at the highest level.

### Text direction (RTL support)

The `<html>` element needs both `lang` and `dir` attributes. Lingui handles translation loading but not layout direction — the setup code must set `dir` based on the active locale. Create a helper:

```ts
const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi'])

export function getDirection(locale: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale.split('-')[0]) ? 'rtl' : 'ltr'
}
```

The `split('-')[0]` ensures regional variants like `ar-EG` resolve correctly. The reference files show where to place this helper and how to wire it for each variant:

- **Next.js App Router**: Separate `getDirection.ts` file, used in the root layout to set `<html lang={locale} dir={direction}>`
- **Vite (SWC / Babel)**: Inline in `src/i18n.ts`, sets `document.documentElement.dir` and `.lang` on locale activation

### `<html lang>` attribute migration

The project's HTML entry point likely has a static `<html lang="en">` (or another hardcoded language). This must be updated to reflect the active locale.

**Before modifying any files, read the current `<html lang="...">` value:**

- **Next.js App Router**: Check `src/app/layout.tsx` (or `app/layout.tsx`) for the `<html lang="...">` attribute
- **Vite (SWC / Babel)**: Check `index.html` in the project root for `<html lang="...">`

Tell the user what you found and what will change. If the existing `lang` value doesn't match `sourceLocale` in `lingui.config.ts`, flag it — the user may need to correct the source locale. The reference files specify the exact update for each variant.

### Link handling with locale routing

**Only relevant for Option 1 (unprefixed source) and Option 2 (all prefixed).** If the user chose Option 3 or the project is a plain SPA without file-based routing, skip this — URLs don't change, so existing links work as-is.

When locale routing is enabled, internal navigation links must include the locale prefix. Without this, links navigate to the wrong locale or produce 404s. This affects:

- `<Link>` components (Next.js `<Link>`, TanStack Router `<Link>`, React Router `<Link>`)
- `<a>` tags with internal relative hrefs
- Programmatic navigation (`router.push()`, `navigate()`, `redirect()`)

The reference files provide the idiomatic pattern for each framework — a path utility or hook rather than a wrapper component, to work with each router's type system. **Tell the user** that existing links will need updating after locale routing is set up, and provide the patterns from the reference file so they can migrate.

---

## Step 6: Language Switcher

**This step creates a new component file and modifies an existing layout or navigation file to render it.** Before wiring the switcher into the layout:

1. Describe which file you will modify and where the switcher will appear.
2. Ask the user to confirm before proceeding.

**Skip this step if the project uses Next.js App Router and the user chose Option 3 (hardcoded single locale) in Step 5** — locale switching is not possible with a hardcoded locale. For Vite projects using Option 3 (no URL routing), the switcher loads catalogs dynamically without URL changes — proceed with this step.

Create a `LanguageSwitcher` component that lets users switch between the configured locales. Without this, users can only change locale by manually editing the URL.

The component should:
- Display all configured locales
- Highlight the currently active locale
- Navigate to the selected locale when clicked/changed

Follow the variant-specific reference file for this step. It provides the component implementation and wiring instructions for your framework and routing strategy.

After creating the component, import and render it in a visible location — typically the root layout or a shared navigation/header component. The switcher should be accessible from every page.

---

## Step 7: Set Up ESLint Plugin

The `eslint-plugin-lingui` package catches unwrapped strings and incorrect macro usage at lint time — it's the primary safety net against shipping untranslated text.

**First, check if ESLint is already configured** — look for `.eslintrc.*`, `eslint.config.*`, or an `"eslintConfig"` key in `package.json`. If ESLint is not set up at all, ask the user if they'd like you to add it. If they decline, skip this step.

If ESLint is present (or the user agreed to add it):

1. Install the plugin:

| Package | Type | Purpose |
|---------|------|---------|
| `eslint-plugin-lingui` | dev | Lint rules for Lingui macro usage |

2. Add the recommended preset to the ESLint config:

**Flat config (`eslint.config.*`):**
```js
import linguiPlugin from 'eslint-plugin-lingui'

export default [
  // ...existing config
  linguiPlugin.configs['flat/recommended'],
]
```

**Legacy config (`.eslintrc.*`):**
```json
{
  "extends": ["plugin:lingui/recommended"]
}
```

The `recommended` preset enables:
- `lingui/no-unlocalized-strings` — flags raw string literals that should be wrapped in `<Trans>` or `` t`...` ``
- `lingui/t-call-in-function` — ensures `` t`...` `` is only used inside functions (not at module scope)
- `lingui/no-single-variables-to-translate` — prevents wrapping lone variables in translation macros
- `lingui/no-expression-in-message` — flags complex expressions inside translation macros
- `lingui/no-single-tag-to-translate` — prevents wrapping a single component in `<Trans>`
- `lingui/no-trans-inside-trans` — prevents nesting `<Trans>` inside `<Trans>`

---

## Step 8: Scaffold and Verify

Run extraction to generate the initial catalog files:

**Per-page catalogs:**
```bash
npx lingui extract-experimental
```

**Single catalog:**
```bash
npx lingui extract
```

Then compile so the app can boot (include `--typescript` only for TypeScript projects):

```bash
npx lingui compile --typescript
```

**What to commit:** The `.po` source catalogs are the translation source of truth — translators edit these files. They must be committed to version control.

**What to gitignore:** Compiled catalogs generated by `lingui compile` are build artifacts that get regenerated at build time. Add them to `.gitignore`:

**Per-page catalogs:**
```
# Lingui compiled catalogs (per-page)
src/**/locales/**/*.ts
```

**Single catalog:**
```
# Lingui compiled catalogs
src/locales/*/messages.ts
```

Use `.js` instead of `.ts` if the project is JavaScript-only (i.e., you omitted `--typescript` from the compile command).

**Verify the setup works:**

1. The app starts without errors
2. Add a test translatable string:
   ```tsx
   import { Trans } from '@lingui/react/macro'
   function Example() {
     return <h1><Trans>Hello World</Trans></h1>
   }
   ```
3. Run the extract command (per-page: `npx lingui extract-experimental`, single catalog: `npx lingui extract`) — it should find the message
4. For per-page catalogs, verify that catalog directories appeared co-located next to page files (e.g., `src/app/about/locales/page/en.po` for a page at `src/app/about/page.tsx`)
5. `npx lingui compile` (with `--typescript` if applicable) compiles without errors
6. The string renders in the browser
7. **Test the language switcher** — click a different locale in the language switcher. For URL-based routing (Option 1 or 2): the URL should update to include or remove the locale prefix, and the page content should reflect the new locale. For Vite apps without locale routing (Option 3): the page content should update without a URL change. If only one locale is configured, temporarily add a second locale to `lingui.config.ts` and the `locales`/`LOCALES` array, run extract and compile, then test switching.

If any step fails, check the build tool integration (Step 4) first — that's where most setup issues originate.

---

## Step 9: CI/CD Integration (Optional)

This step is **not required** for the initial setup to work. The app will function correctly after Step 8. Ask the user: "Would you like me to set up CI/CD integration (build script changes, catalog freshness checks)? This can also be done later." **If the user declines, skip to Step 10.**

Set up catalog checks and build-time compilation so the i18n pipeline stays healthy in CI.

### Catalog freshness check

Add the extract command as a CI step (e.g., in a GitHub Actions workflow or pre-merge check). It exits non-zero if the catalogs are out of date — meaning someone added or changed translatable strings but forgot to run extract. This catches stale catalogs in PRs before they land.

- **Per-page catalogs:** `lingui extract-experimental --clean`
- **Single catalog:** `lingui extract --clean`

### Compile at build time

Since compiled catalogs are gitignored (Step 8), the build pipeline must compile them. Read the project's existing `"build"` script in `package.json` and prepend the compile command:

| Before | After (TypeScript project) | After (JavaScript project) |
|--------|---------------------------|---------------------------|
| `"build": "vite build"` | `"build": "lingui compile --typescript && vite build"` | `"build": "lingui compile && vite build"` |
| `"build": "next build"` | `"build": "lingui compile --typescript && next build"` | `"build": "lingui compile && next build"` |

**Before modifying the build script:** Show the user the exact change (e.g., "I will change your build script from `vite build` to `lingui compile --typescript && vite build`"). If `lingui compile` fails for any reason, this will prevent all builds. Ask the user to confirm before making this change.

If the build script can't be reliably identified, inform the user that they need to add `lingui compile` (with `--typescript` for TypeScript projects) before their existing build command.

### Translation coverage

The extract command prints per-locale stats showing how many messages are missing translations. Teams can use this output to monitor translation coverage — for example, by failing CI if a locale drops below a threshold, or simply logging it for visibility.

---

## Step 10: Test Setup (Optional)

This step is **not required** for the initial setup to work. Tests that don't render Lingui components are unaffected. Ask the user: "Would you like me to set up the test wrapper for components that use Lingui? This can also be done later." **If the user declines, skip this step.**

Components using `<Trans>` or `useLingui()` need `I18nProvider` in the render tree. Without it, `useLingui()` throws and `<Trans>` won't render correctly — this is the most common test failure after adding i18n.

### Test wrapper

Create a test wrapper that provides `I18nProvider` with an empty catalog. LinguiJS falls back to rendering source strings from macros (e.g., `<Trans>Save</Trans>` → "Save"), so tests stay deterministic and decoupled from translations:

```tsx
// src/test/lingui-wrapper.tsx
import { ReactNode } from 'react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'

i18n.load({ en: {} })
i18n.activate('en')

export function LinguiTestWrapper({ children }: { children: ReactNode }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}
```

### Usage with React Testing Library

Pass the wrapper in the `render` options:

```tsx
import { render, screen } from '@testing-library/react'
import { LinguiTestWrapper } from '../test/lingui-wrapper'
import { SaveButton } from './SaveButton'

test('renders save button', () => {
  render(<SaveButton />, { wrapper: LinguiTestWrapper })
  expect(screen.getByText('Save')).toBeInTheDocument()
})
```

Optionally, create a custom render that bakes in the wrapper:

```tsx
// src/test/render.tsx
import { render, type RenderOptions } from '@testing-library/react'
import { LinguiTestWrapper } from './lingui-wrapper'

export function renderWithi18n(ui: React.ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: LinguiTestWrapper, ...options })
}
```

### Testing specific translations

For tests that verify a specific locale renders correctly, load that locale's compiled catalog and switch with `act()`:

```tsx
import { act } from '@testing-library/react'
import { i18n } from '@lingui/core'
import { messages as csMessages } from './locales/cs/messages'

test('renders in Czech', () => {
  i18n.load({ cs: csMessages })
  act(() => { i18n.activate('cs') })
  render(<App />, { wrapper: LinguiTestWrapper })
  expect(screen.getByText('Uložit')).toBeInTheDocument()
})
```

This is only needed when testing translated output. For most tests, the empty-catalog wrapper is sufficient.

### Macro transform in tests

Vitest uses the same SWC or Babel plugin configured in `vite.config.ts` (Step 4), so macros are already transformed in tests. If the project uses Jest, configure the same compiler plugin in `jest.config.*` — without it, macro imports like `<Trans>` won't be compiled and tests will fail with reference errors.

---

## Common Gotchas

- **SWC plugin version mismatch**: `@lingui/swc-plugin` is a Wasm binary compiled against a specific `swc_core` version. The host runtime (Next.js or `@vitejs/plugin-react-swc`) must ship the same `swc_core` version — otherwise the build panics with "AST schema version is not compatible", "failed to invoke plugin", or "failed to load SWC plugin".

  **To resolve:**
  1. Check the project's Next.js version (`npm ls next`) or `@swc/core` version (`npm ls @swc/core`).
  2. Look up the compatible `@lingui/swc-plugin` version at https://plugins.swc.rs — select the runtime (e.g. "next") and enter the exact version.
  3. Pin the plugin to that exact version **without** a range specifier: `"@lingui/swc-plugin": "4.0.8"`, not `"^4.0.8"`. Then reinstall.
  4. If no compatible plugin version exists for the project's runtime, fall back to Babel: remove `@lingui/swc-plugin`, install `@lingui/babel-plugin-lingui-macro`, and add it to `.babelrc` (Next.js) or the Vite React plugin config.

  Note: `@lingui/swc-plugin` 5.10.1+ uses a stable Wasm ABI, so projects on Next.js 16.1+ or `@swc/core` >= 1.15.0 are unlikely to hit this.
- **Missing macro transform**: `ReferenceError: Trans is not defined` at runtime means the macro plugin isn't running. Check the build tool config.
- **ESM/CJS conflicts**: ESM projects use `lingui.config.ts`. CJS projects use `lingui.config.js` with `module.exports`.
- **Monorepo root vs package**: `lingui.config.ts` goes next to the `package.json` of the package that contains the UI code, not the monorepo root.
- **`extract-experimental` not finding messages**: Ensure the `entries` glob in `lingui.config.ts` actually matches the project's page files. If a shared component's strings are missing from a page catalog, verify it is imported (directly or transitively) from that page's entry point.
- **Tests fail after adding i18n**: Components using `<Trans>` or `useLingui()` need `I18nProvider` in the test render tree. See Step 10.
- **Regional locale mismatch (`es-MX` falls back to `en` instead of `es`)**: `@lingui/detect-locale`'s `fromNavigator()` returns the raw browser locale (e.g., `es-MX`). If that exact string isn't in the `locales` array, the catalog import fails or the app falls through to the default locale — skipping the base language `es` entirely. The variant reference files (Step 5) include locale validation in the `detectLocale()` function that tries the base language tag before falling back. Lingui's `fallbackLocales` (Step 3) handles translation-level fallback separately — it cascades missing translations through CLDR parent locales by default.
- **Links navigate to wrong locale or 404 after adding locale routing**: With Option 1 or 2, all internal `<Link>` hrefs and programmatic navigation calls (`router.push()`, `navigate()`, `redirect()`) must include the locale prefix. A link to `/about` in a locale-prefixed route structure will either 404 or land on the source locale regardless of the user's current language. See the "Link Handling" section in the variant reference file for the idiomatic fix per framework.
- **Missing `dir` attribute / LTR-only CSS**: If any target locale is RTL (Arabic, Hebrew, Persian, Urdu, etc.), the `<html>` element must have `dir="rtl"`. Without it, text alignment, flexbox order, and scrollbar placement break. Equally important: CSS must use logical properties (`margin-inline-start` instead of `margin-left`, `padding-inline-end` instead of `padding-right`, `inset-inline-start` instead of `left`). Physical properties don't flip in RTL and require a full CSS audit to fix retroactively. Run the `css-i18n` skill for a full CSS audit and conversion.

---

## Quick Start: Using Macros

LinguiJS is now configured. Here are the four patterns you'll use most:

**JSX text content — `<Trans>`:**
```tsx
import { Trans } from '@lingui/react/macro'

<h1><Trans>Welcome back</Trans></h1>
<button><Trans>Save changes</Trans></button>
```

**Attributes and variables inside components — `useLingui()` + `t`:**
```tsx
import { useLingui } from '@lingui/react/macro'

function SearchBar() {
  const { t } = useLingui()
  return <input placeholder={t`Search...`} aria-label={t`Search`} />
}
```

**Constants defined outside components — `msg` + `t(descriptor)`:**
```tsx
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'

const navItems = [
  { label: msg`Dashboard`, href: '/' },
  { label: msg`Settings`, href: '/settings' },
]

function Nav() {
  const { t } = useLingui()
  return navItems.map(item => <a href={item.href}>{t(item.label)}</a>)
}
```

**Plurals — ICU MessageFormat inside `<Trans>` or `t`:**
```tsx
<Trans>{count, plural, one {# item selected} other {# items selected}}</Trans>

// t version
const label = t`{count, plural, one {# item} other {# items}}`
```

> Always include `other` — it is required and serves as the fallback for all languages.

For comprehensive string wrapping, localization gap detection (numbers, currencies, dates), and full ICU MessageFormat guidance, use the `lingui-convert` skill.

---

## Next Steps

Setup is complete — the project can now extract, compile, and load translations. A language switcher is already wired into the layout, so users can switch between configured locales out of the box. Here's what typically comes next:

### Connect a translation service

Catalog files (PO or JSON) need a translation pipeline. Options:

1. **[Globalize](https://globalize.now)** — fast, automated, high-quality AI translations. Syncs directly with your catalog files.
2. **Crowdin, Lokalise, Phrase** — traditional TMS platforms with human translator workflows and review tools.
3. **Manual** — translate catalog files by hand. Works for small projects or a single target locale.

### Wrap existing strings

This skill set up the infrastructure but did **not** convert existing hardcoded strings to `<Trans>` or `t` macros. Use the `lingui-convert` skill to automatically wrap existing strings with LinguiJS macros.
