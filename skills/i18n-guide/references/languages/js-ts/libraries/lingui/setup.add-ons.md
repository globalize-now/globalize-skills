# LinguiJS: Optional Add-Ons

This file is invoked from the framework-specific lingui setup files (`nextjs/app-router/lingui.setup.md`, `vite/react-swc/lingui.setup.md`, `vite/react-babel/lingui.setup.md`, `tanstack-start/lingui.setup.md`, `tanstack-start/swc/lingui.setup.md`) after the core setup has been applied. The orchestrator's `SKILL.md §1.10` lets the user multi-select up to four add-ons. Run only the sub-steps below that match the user's selections in `decisions.md` — skip the rest in silence. Each sub-step is independently re-runnable: if it has already been applied, detect that and skip without prompting.

Apply the same guided / unguided rules used elsewhere in setup:
- **Guided mode**: describe the change before making it and wait for confirmation.
- **Unguided mode**: apply directly; only stop on hard errors.

The catalog path and build command vary by framework — read `decisions.md` and `lingui.config.{ts,js}` to find the project's actual `catalogs.path`, package manager, and build script before emitting any snippet below.

---

## Add-on 1: Coding rules (`@import`)

The lingui coding rules at `references/languages/js-ts/libraries/lingui/code.md` contain the rules for wrapping strings, props, plurals, ordinals, numbers, currencies, and dates correctly as new code is written, plus translator-comment guidance and the App-Router server-vs-client split. They ship as part of the `i18n-guide` skill, so the file already lives at `.claude/skills/i18n-guide/references/languages/js-ts/libraries/lingui/code.md` in the target project.

Claude Code doesn't reliably auto-trigger passive "coding rules" references during routine edits — they aren't consulted unless explicitly invoked. To make the rules always-available, reference the file from the project's root `CLAUDE.md` using Claude Code's `@` import syntax.

Verify `.claude/skills/i18n-guide/references/languages/js-ts/libraries/lingui/code.md` exists.

- **If it exists**: proceed.
- **If it is missing — guided mode**: tell the user the `i18n-guide` skill is not installed in their project and stop this add-on. The fix is to reinstall it (`npx skills add globalize-now/globalize-skills --skill i18n-guide -a claude-code`). Don't attempt to recreate the file.
- **If it is missing — unguided mode**: do not block. Skip the CLAUDE.md append and record `⚠ lingui coding rules not installed — wiring skipped` in the end-of-run summary, with the reinstall command shown above.

Check whether `CLAUDE.md` exists at the project root.

- **If it doesn't exist**, create it:
  ```
  # Project Instructions

  @.claude/skills/i18n-guide/references/languages/js-ts/libraries/lingui/code.md
  ```

- **If it exists**, describe the change to the user ("I'll append `@.claude/skills/i18n-guide/references/languages/js-ts/libraries/lingui/code.md` to your CLAUDE.md so the lingui coding rules auto-load every session") and wait for confirmation in guided mode before appending. Put the line at the end of the file on its own line. Do not remove or reorder existing content.

If the exact `@` line is already present, skip silently — this add-on is idempotent.

Tell the user: "The first time you start a Claude Code session in this project, you'll see a one-time prompt asking to approve the `@` import. Approve it — otherwise the rules won't load."

Verify: in a fresh session, ask Claude "how should I wrap a plural string in this project?" — the answer should reference the `<Plural>` macro and ICU plural patterns from the imported file.

---

## Add-on 2: ESLint plugin

Lingui ships an officially maintained ESLint plugin: [`eslint-plugin-lingui`](https://github.com/lingui/eslint-plugin-lingui). It catches the most common authoring mistakes — hardcoded JSX strings outside macros, missing translator comments, malformed `<Plural>` props — and is the right default for any lingui project.

### Install

Detect the package manager from the lockfile (`package-lock.json` → npm, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` → bun). The plugin is pre-1.0 — pin to the current minor with a caret per the project's pinning rule:

```bash
# npm
npm install --save-dev 'eslint-plugin-lingui@^0.13'
# pnpm
pnpm add -D 'eslint-plugin-lingui@^0.13'
# yarn
yarn add -D 'eslint-plugin-lingui@^0.13'
# bun
bun add -D 'eslint-plugin-lingui@^0.13'
```

(If the published current major has advanced past `0.13`, bump the pin accordingly — confirm via `npm view eslint-plugin-lingui version` if uncertain.)

### Configure

Detect the project's ESLint config style by looking for `eslint.config.{js,mjs,cjs,ts}` (flat config, ESLint 9+) vs `.eslintrc.{js,cjs,json,yaml}` (legacy).

**Flat config (ESLint 9+):**

```js
// eslint.config.mjs
import lingui from 'eslint-plugin-lingui';

export default [
  // existing config...
  lingui.configs['flat/recommended'],
];
```

**Legacy config (ESLint 8 and earlier):**

```json
{
  "extends": ["plugin:lingui/recommended"]
}
```

The recommended preset enables (subject to plugin version):

| Rule | What it catches |
|---|---|
| `lingui/no-unlocalized-strings` | Plain string literals in JSX or component props (the most common gap) |
| `lingui/t-call-in-function` | `t\`…\`` outside a component / hook / `msg` context — would resolve at the wrong locale |
| `lingui/no-single-tag-to-translate` | `<Trans>{x}</Trans>` with only an interpolation — extracts to `{x}`, useless to translators |
| `lingui/no-trans-inside-trans` | Nested `<Trans>`, which produces broken catalog entries |
| `lingui/no-expression-in-message` | Template-string expressions inside `t\`…\`` that the macro can't statically extract |

Read the plugin README for the exact rule list at the installed version — rules and severities shift between minor releases.

### `no-unlocalized-strings` configuration

This rule is the noisiest by default because it flags every string literal in JSX. Tune the project's `ignoredAttributes`, `ignoredProperties`, and `ignoreFunction` to match the codebase before running across the full repo, otherwise the first lint pass produces hundreds of false positives in tests, fixtures, and `data-testid` attributes. A reasonable starting point:

```js
{
  rules: {
    'lingui/no-unlocalized-strings': ['error', {
      ignoreAttribute: ['data-testid', 'href', 'src', 'id', 'className', 'class'],
      ignoreFunction: ['Symbol', 'cva'],
    }],
  },
}
```

Apply this only inside `src/` (or the project's source root), not test files or scripts.

### After install

Run the project's lint command once and report the count of new errors to the user. If the count is large (>50), suggest running `lingui extract` first so any missed wraps surface as proper catalog entries before the lint-driven cleanup pass.

---

## Add-on 3: CI/CD integration

Lingui has a real extract/compile build step. The canonical CI integration runs:

1. **Extract** — `lingui extract --clean` regenerates the source-locale catalog from the wrapped strings. The `--clean` flag drops obsolete entries.
2. **Drift check** — fail the build if extraction produced uncommitted changes (someone wrapped a string but forgot to commit the catalog update).
3. **Compile** — `lingui compile` produces the optimized `*.ts` / `*.js` runtime catalogs that the build consumes.

Detect from `package.json` and `lingui.config.{ts,js}`:
- The package manager (npm / pnpm / yarn / bun).
- The catalog path (`catalogs[].path`) — typically `src/locales/{locale}/messages` or similar.
- Whether TypeScript is in use (presence of `tsconfig.json`) — `lingui compile --typescript` writes `.ts` runtime catalogs in that case.

### `package.json` scripts

Add (or merge with existing):

```json
{
  "scripts": {
    "i18n:extract": "lingui extract --clean",
    "i18n:compile": "lingui compile --typescript",
    "i18n:check": "lingui extract --clean && git diff --exit-code -- src/locales"
  }
}
```

Replace `src/locales` in `i18n:check` with the project's actual catalog path. Drop `--typescript` if the project is plain JavaScript.

Wire `i18n:compile` into the build script so production bundles include compiled catalogs. Look at the existing `build` script:

```json
{
  "scripts": {
    "build": "lingui compile --typescript && next build"
  }
}
```

(For Vite / TanStack Start, prepend before `vite build` / the Vinxi build command instead.)

### GitHub Actions workflow

If the project has `.github/workflows/`, scaffold `.github/workflows/i18n.yml`:

```yaml
name: i18n

on:
  pull_request:
    paths:
      - 'src/**'
      - 'src/locales/**'
      - 'lingui.config.*'
      - '.github/workflows/i18n.yml'

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
      - run: npm ci
      - name: Verify catalogs are in sync
        run: npm run i18n:check
      - name: Compile catalogs
        run: npm run i18n:compile
```

Adjust `paths`, source directory, and the install command to match the project. If the project does not have `.github/workflows/`, skip the workflow scaffold and just install the npm scripts. Tell the user how to wire `i18n:check` into their CI of choice.

### Why drift check matters

Without `git diff --exit-code` after extract, a contributor can wrap a string in code, forget to run `lingui extract`, and merge a PR where the catalog is silently out of date. The string then renders as its key (or fallback) for every non-source locale until someone notices. The drift check makes the catalog state part of the PR contract.

---

## Add-on 4: Test setup wrapper

This add-on is **not required** for the initial setup to work. Tests that don't render lingui-using components are unaffected. Components using `useLingui()` or `<Trans>` need an `<I18nProvider>` ancestor (or a hand-activated `i18n` instance) in tests, otherwise `useLingui` throws and `<Trans>` renders empty — this is the most common test failure after adding i18n.

Detect the test runner from `package.json` (`vitest`, `jest`, both, or neither). If both are present, ask in guided mode which to wire up; in unguided mode prefer `vitest` (the modern default for Vite-based projects) and `jest` for Next.js projects that already use it.

### Test wrapper

Create a render helper that wraps a component with a synchronously-loaded `i18n` instance:

```tsx
// src/test/renderWithLingui.tsx
import { render, type RenderOptions } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import type { ReactElement } from 'react';

type Messages = Record<string, string>;

i18n.load('en', {});
i18n.activate('en');

export function renderWithLingui(
  ui: ReactElement,
  {
    locale = 'en',
    messages = {},
    ...options
  }: { locale?: string; messages?: Messages } & Omit<RenderOptions, 'wrapper'> = {},
) {
  i18n.load(locale, messages);
  i18n.activate(locale);
  return render(ui, {
    wrapper: ({ children }) => <I18nProvider i18n={i18n}>{children}</I18nProvider>,
    ...options,
  });
}
```

The same helper works under both Vitest and Jest — only the test-runner-specific imports (e.g. `vi.mock` vs `jest.mock`) differ in the calling test files.

With an empty `messages` payload (the default), `<Trans>...</Trans>` renders the source text unchanged because lingui falls back to the message ID — tests stay deterministic and decoupled from translation content.

### Usage

```tsx
import { describe, it, expect } from 'vitest';
import { renderWithLingui } from '../test/renderWithLingui';
import Greeting from './Greeting';

it('renders the welcome heading', () => {
  const { getByRole } = renderWithLingui(<Greeting name="World" />);
  expect(getByRole('heading')).toHaveTextContent('Hello, World!');
});
```

### Server component testing (App Router)

Testing async server components that call `setI18n()` and `<Trans>` is constrained by the React/Next.js runtime. The pragmatic options are:

1. **Test the underlying logic, not the component.** Extract data-shaping into pure functions and unit-test those; render-test the component via Playwright or a Next.js end-to-end harness instead.
2. **Mock `@lingui/react/server` and `@lingui/core/macro`** for unit tests:

   ```ts
   // vitest setup file
   import { vi } from 'vitest';

   vi.mock('@lingui/react/server', () => ({
     setI18n: vi.fn(),
   }));
   ```

   Combined with the synchronous `renderWithLingui` helper above, this lets server-component unit tests run without booting Next's request lifecycle.

Document the choice in the project's `CONTRIBUTING.md` or test README so contributors don't reinvent it per file.

---

## End

Record applied add-ons in the end-of-run summary so the user has an audit trail of what was wired up.
