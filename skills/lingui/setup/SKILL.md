---
name: lingui-setup
description: >-
  Set up LinguiJS internationalization (i18n) in any React-based project. Use this skill
  whenever the user asks to add localization, internationalization, i18n, translations, or
  multi-language support to a React app — whether it's a Vite SPA, Next.js (App Router or
  Pages Router), TanStack Router, React Router, or any other React setup. Also use when
  the user mentions LinguiJS, Lingui, @lingui, or asks "how do I add translations" or
  "make my app support multiple languages." This skill handles the full setup: package
  installation, config file, build tool integration, provider wiring, and locale scaffolding.
  It does NOT cover converting existing strings to macros — that's a separate concern.
---

# LinguiJS Setup

LinguiJS is a compile-time i18n framework — macros like `<Trans>` and `` t`...` `` are transformed at build time into optimized message lookups, so there's zero runtime overhead from the macro syntax.

Follow these steps in order. Each builds on the last.

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

Based on the detection, pick the right variant reference file:

- **Next.js App Router** → read `references/nextjs-app-router.md`
- **Vite + SWC** (including TanStack Router, React Router, plain Vite) → read `references/vite-swc.md`
- **Vite + Babel** → read `references/vite-babel.md`

Then continue with Steps 2-7 below, using the variant-specific instructions from the reference file for Steps 4 and 5.

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

```ts
import type { LinguiConfig } from '@lingui/conf'

const config: LinguiConfig = {
  sourceLocale: 'en',
  locales: ['en'],
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['src'],
    },
  ],
}

export default config
```

Adjust based on context:

- **`sourceLocale`**: The language the source code is written in. Almost always `'en'`.
- **`locales`**: Include the source locale plus any target languages the user requested.
- **`catalogs[].path`**: Where message catalog files go. The `{locale}` placeholder creates per-language directories.
- **`catalogs[].include`**: Which directories to scan for translatable strings.
- **Monorepos**: The config goes in the package that contains the UI code, not the monorepo root. Adjust `include` paths accordingly.

Add extract and compile scripts to `package.json`:

```json
{
  "scripts": {
    "lingui:extract": "lingui extract",
    "lingui:compile": "lingui compile --typescript"
  }
}
```

The `--typescript` flag generates `.ts` catalog files instead of `.js`, giving type checking on message IDs. Omit it for JavaScript-only projects.

---

## Step 4: Integrate with the Build Tool

Follow the variant-specific reference file for this step. It tells you exactly how to modify the build config (vite.config.ts, next.config.js, etc.) and which compiler plugin to wire in.

---

## Step 5: Wire Up the Provider

Follow the variant-specific reference file for this step. The provider pattern differs significantly between standard React apps (simple `I18nProvider` wrapper) and Next.js App Router (RSC-aware setup with `setI18n` + client provider + middleware).

For **standard React apps** (Vite, CRA), the provider goes in:
- `main.tsx` if the app has no router
- The root layout component if using TanStack Router (`__root.tsx`) or React Router (root layout)

The goal is to wrap the entire component tree once, at the highest level.

---

## Step 6: Set Up ESLint Plugin

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

## Step 7: Scaffold and Verify

Run extraction to generate the initial catalog files:

```bash
npx lingui extract
```

Then compile so the app can boot:

```bash
npx lingui compile --typescript
```

Add compiled catalogs to `.gitignore` — they're build artifacts:

```
# Lingui compiled catalogs
src/locales/*/messages.ts
```

The `.po` source files (created by `lingui extract`) are the source of truth and should be committed.

**Verify the setup works:**

1. The app starts without errors
2. Add a test translatable string:
   ```tsx
   import { Trans } from '@lingui/react/macro'
   function Example() {
     return <h1><Trans>Hello World</Trans></h1>
   }
   ```
3. `npx lingui extract` finds the message
4. `npx lingui compile --typescript` compiles without errors
5. The string renders in the browser

If any step fails, check the build tool integration (Step 4) first — that's where most setup issues originate.

---

## Common Gotchas

- **SWC plugin version mismatch**: `@lingui/swc-plugin` must match the SWC core version used by Vite/Next.js. "Failed to load SWC plugin" means a version mismatch.
- **Missing macro transform**: `ReferenceError: Trans is not defined` at runtime means the macro plugin isn't running. Check the build tool config.
- **ESM/CJS conflicts**: ESM projects use `lingui.config.ts`. CJS projects use `lingui.config.js` with `module.exports`.
- **Monorepo root vs package**: `lingui.config.ts` goes next to the `package.json` of the package that contains the UI code, not the monorepo root.
