# next-intl: Optional Add-Ons

This file is invoked from the framework-specific next-intl setup files (`nextjs/app-router/next-intl.setup.md`, `nextjs/pages-router/next-intl.setup.md`) after the core setup has been applied. The orchestrator's `SKILL.md §1.10` lets the user multi-select up to four add-ons. Run only the sub-steps below that match the user's selections in `decisions.md` — skip the rest in silence. Each sub-step is independently re-runnable: if it has already been applied, detect that and skip without prompting.

Apply the same guided / unguided rules used elsewhere in setup:
- **Guided mode**: describe the change before making it and wait for confirmation.
- **Unguided mode**: apply directly; only stop on hard errors.

---

## Add-on 1: Coding rules (`@import`)

The next-intl coding rules at `references/languages/js-ts/libraries/next-intl/code.md` contain the rules for wrapping strings, attributes, plurals, numbers, dates, currencies, and locale-aware navigation correctly as new code is written. They ship as part of the `i18n-guide` skill, so the file already lives at `.claude/skills/i18n-guide/references/languages/js-ts/libraries/next-intl/code.md` in the target project.

Claude Code doesn't reliably auto-trigger passive "coding rules" references during routine edits — they aren't consulted unless explicitly invoked. To make the rules always-available, reference the file from the project's root `CLAUDE.md` using Claude Code's `@` import syntax.

Verify `.claude/skills/i18n-guide/references/languages/js-ts/libraries/next-intl/code.md` exists.

- **If it exists**: proceed.
- **If it is missing — guided mode**: tell the user the `i18n-guide` skill is not installed in their project and stop this add-on. The fix is to reinstall it (`npx skills add globalize-now/globalize-skills --skill i18n-guide -a claude-code`). Don't attempt to recreate the file.
- **If it is missing — unguided mode**: do not block. Skip the CLAUDE.md append and record `⚠ next-intl coding rules not installed — wiring skipped` in the end-of-run summary, with the reinstall command shown above.

Check whether `CLAUDE.md` exists at the project root.

- **If it doesn't exist**, create it:
  ```
  # Project Instructions

  @.claude/skills/i18n-guide/references/languages/js-ts/libraries/next-intl/code.md
  ```

- **If it exists**, describe the change to the user ("I'll append `@.claude/skills/i18n-guide/references/languages/js-ts/libraries/next-intl/code.md` to your CLAUDE.md so the next-intl coding rules auto-load every session") and wait for confirmation in guided mode before appending. Put the line at the end of the file on its own line. Do not remove or reorder existing content.

If the exact `@` line is already present, skip silently — this add-on is idempotent.

Tell the user: "The first time you start a Claude Code session in this project, you'll see a one-time prompt asking to approve the `@` import. Approve it — otherwise the rules won't load."

Verify: in a fresh session, ask Claude "how should I wrap a plural string in this project?" — the answer should reference ICU `{count, plural, …}` syntax and `t('key', { count })` patterns from the imported file.

---

## Add-on 2: ESLint plugin

**No official next-intl ESLint plugin exists.** The maintainers track the idea as an open feature request: <https://github.com/amannn/next-intl/issues/1036>. Two community plugins exist, neither endorsed by the next-intl team:

| Plugin | npm | Scope |
|---|---|---|
| `eslint-plugin-next-intl` | [`eslint-plugin-next-intl`](https://www.npmjs.com/package/eslint-plugin-next-intl) | next-intl-only; rules around static keys, missing keys, unused keys |
| `@ts-intl/eslint-plugin-ts-intl` | [`@ts-intl/eslint-plugin-ts-intl`](https://www.npmjs.com/package/@ts-intl/eslint-plugin-ts-intl) | broader: also covers `i18next` and custom `t()` shapes |

Neither extracts strings (next-intl has no extract step — see Add-on 3). They lint **call-site usage**: that translation keys are static literals, that variables passed match the keys' ICU placeholders, that hardcoded strings inside JSX are flagged for review.

**Default recommendation: skip.** Surface the situation to the user before doing anything:

> "next-intl doesn't ship an official ESLint plugin. Two community plugins exist (`eslint-plugin-next-intl` and `@ts-intl/eslint-plugin-ts-intl`); neither is endorsed by the next-intl maintainers. The passive coding rules from Add-on 1 cover most of what these plugins do at edit time. Want me to install one anyway? (default: skip)"

If the user opts in, ask which plugin they prefer (default: `eslint-plugin-next-intl` for next-intl-only projects). Then:

### `eslint-plugin-next-intl`

Detect the package manager from lockfile. Install pinned to the current major:

```bash
# npm
npm install --save-dev 'eslint-plugin-next-intl@^1'
# pnpm
pnpm add -D 'eslint-plugin-next-intl@^1'
# yarn
yarn add -D 'eslint-plugin-next-intl@^1'
# bun
bun add -D 'eslint-plugin-next-intl@^1'
```

Detect the project's ESLint config style by looking for `eslint.config.{js,mjs,cjs,ts}` (flat config, ESLint 9+) vs `.eslintrc.{js,cjs,json,yaml}` (legacy):

**Flat config (`eslint.config.mjs` or `.ts`):**

```js
import nextIntl from 'eslint-plugin-next-intl';

export default [
  // existing config...
  {
    plugins: { 'next-intl': nextIntl },
    rules: {
      'next-intl/no-missing-keys': 'error',
      'next-intl/no-unused-keys': 'warn',
    },
  },
];
```

**Legacy config (`.eslintrc.json`):**

```json
{
  "plugins": ["next-intl"],
  "rules": {
    "next-intl/no-missing-keys": "error",
    "next-intl/no-unused-keys": "warn"
  }
}
```

Read the plugin's README for the up-to-date rule list before merging — the rule set evolves between minor versions and the snippet above is illustrative.

### `@ts-intl/eslint-plugin-ts-intl`

```bash
# npm
npm install --save-dev '@ts-intl/eslint-plugin-ts-intl@^2'
# pnpm
pnpm add -D '@ts-intl/eslint-plugin-ts-intl@^2'
# yarn
yarn add -D '@ts-intl/eslint-plugin-ts-intl@^2'
# bun
bun add -D '@ts-intl/eslint-plugin-ts-intl@^2'
```

Configuration follows the plugin's documented presets — apply the `next-intl` preset specifically. Read the plugin's README and emit the matching config for the project's ESLint style (flat vs legacy).

After installing, run the project's lint command once to confirm there are no immediate errors blocking commits, and report findings to the user.

---

## Add-on 3: CI/CD integration

next-intl has **no extract or compile build step**. Messages live in hand-authored JSON files under `messages/<locale>.json` (or wherever the project's `getRequestConfig` loads them from). The lingui/vue-i18n CI pattern of "extract and diff" therefore doesn't apply.

The right CI add-on for next-intl is narrow: a **catalog validity** check that

1. JSON-parses every locale file and fails on syntax errors,
2. compares key sets between the source locale and each target locale, failing on drift (keys missing in a target, keys stale in a target).

This catches the most common runtime cause of broken pages — a malformed JSON commit or a key added on one side but not the others.

### Script

Detect the messages directory (`messages/` is the next-intl convention; respect any custom path the project loads via `getRequestConfig`). Detect the source locale from `routing.ts` (`defaultLocale`). Then create `scripts/check-messages.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';

// Adjust to match the project's getRequestConfig path
const MESSAGES_DIR = 'messages';
const SOURCE_LOCALE = 'en';

const files = fs.readdirSync(MESSAGES_DIR).filter((f) => f.endsWith('.json'));

const catalogs = {};
for (const file of files) {
  const locale = file.replace(/\.json$/, '');
  const raw = fs.readFileSync(path.join(MESSAGES_DIR, file), 'utf8');
  try {
    catalogs[locale] = JSON.parse(raw);
  } catch (err) {
    console.error(`[i18n] ${locale}: invalid JSON — ${err.message}`);
    process.exit(1);
  }
}

function flatKeys(obj, prefix = '') {
  const out = new Set();
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const nested of flatKeys(v, key)) out.add(nested);
    } else {
      out.add(key);
    }
  }
  return out;
}

const source = catalogs[SOURCE_LOCALE];
if (!source) {
  console.error(`[i18n] source locale ${SOURCE_LOCALE} missing — cannot validate`);
  process.exit(1);
}
const sourceKeys = flatKeys(source);

let hadIssue = false;
for (const [locale, cat] of Object.entries(catalogs)) {
  if (locale === SOURCE_LOCALE) continue;
  const localeKeys = flatKeys(cat);
  const missing = [...sourceKeys].filter((k) => !localeKeys.has(k));
  const stale = [...localeKeys].filter((k) => !sourceKeys.has(k));
  if (missing.length) {
    console.error(`[i18n] ${locale} missing ${missing.length} key(s): ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '…' : ''}`);
    hadIssue = true;
  }
  if (stale.length) {
    console.error(`[i18n] ${locale} stale ${stale.length} key(s): ${stale.slice(0, 10).join(', ')}${stale.length > 10 ? '…' : ''}`);
    hadIssue = true;
  }
}
process.exit(hadIssue ? 1 : 0);
```

Add the npm script to `package.json`:

```json
{
  "scripts": {
    "i18n:check": "node scripts/check-messages.mjs"
  }
}
```

The script intentionally does no ICU validation — `next-intl` and `intl-messageformat` raise loudly at runtime in dev when a message is malformed, and ICU validation is what TMSes (Crowdin, Lokalise, …) typically guarantee on upload.

### GitHub Actions workflow

If the project has `.github/workflows/`, scaffold `.github/workflows/i18n.yml`:

```yaml
name: i18n

on:
  pull_request:
    paths:
      - 'messages/**'
      - 'scripts/check-messages.mjs'
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
      - run: npm run i18n:check
```

If the project does not have `.github/workflows/`, skip the workflow scaffold and just install the script + npm script entry. Tell the user how to wire it into their CI of choice.

---

## Add-on 4: Test setup wrapper

This add-on is **not required** for the initial setup to work. Tests that don't render next-intl-using components are unaffected. Components using `useTranslations()` need a `<NextIntlClientProvider>` ancestor in tests, otherwise `useTranslations` throws and rendered output collapses — this is the most common test failure after adding i18n.

Detect the test runner from `package.json` (`vitest`, `jest`, both, or neither). If both are present, ask in guided mode which to wire up; in unguided mode prefer `vitest` (the modern default).

### Test wrapper

Create a render helper that wraps a component in `NextIntlClientProvider` with a minimal locale + messages payload:

```ts
// src/test/renderWithIntl.tsx (Vitest + @testing-library/react)
import { render, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';

type Messages = Record<string, unknown>;

export function renderWithIntl(
  ui: ReactElement,
  {
    locale = 'en',
    messages = {},
    ...options
  }: { locale?: string; messages?: Messages } & Omit<RenderOptions, 'wrapper'> = {},
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    ),
    ...options,
  });
}
```

The same helper works under Jest — only the imports differ; `NextIntlClientProvider` and React Testing Library are runtime-agnostic.

### Usage

```tsx
import { describe, it, expect } from 'vitest';
import { renderWithIntl } from '../test/renderWithIntl';
import Greeting from './Greeting';

it('renders the welcome heading', () => {
  const { getByRole } = renderWithIntl(<Greeting />, {
    messages: { Greeting: { welcome: 'Welcome to {appName}' } },
  });
  expect(getByRole('heading')).toHaveTextContent('Welcome to');
});
```

With an empty `messages` payload (the default), `useTranslations('X')('y')` falls back to the key path `X.y` — tests stay deterministic and decoupled from translation content.

### Server component testing

Testing async server components is constrained by the React/Next.js runtime — `next-intl/server` calls (`getTranslations`, `getMessages`, `getLocale`) read from request context that doesn't exist in a unit test. The pragmatic options are:

1. **Test the underlying logic, not the component.** Extract data-shaping into pure functions and unit-test those; render-test the component via Playwright or a Next.js end-to-end harness instead.
2. **Mock `next-intl/server`** for unit tests:

   ```ts
   // vitest setup file
   import { vi } from 'vitest';

   vi.mock('next-intl/server', async (orig) => {
     const actual = await orig<typeof import('next-intl/server')>();
     return {
       ...actual,
       getTranslations: async (ns?: string) => (key: string) => ns ? `${ns}.${key}` : key,
       getFormatter: async () => ({
         number: (v: number) => String(v),
         dateTime: (d: Date) => d.toISOString(),
         relativeTime: (d: Date) => d.toISOString(),
       }),
       getLocale: async () => 'en',
     };
   });
   ```

   This produces deterministic, locale-free output for snapshot tests without booting the next-intl request lifecycle.

Document the choice in the project's `CONTRIBUTING.md` or test README so contributors don't reinvent it per file.

---

## End

Record applied add-ons in the end-of-run summary so the user has an audit trail of what was wired up.
