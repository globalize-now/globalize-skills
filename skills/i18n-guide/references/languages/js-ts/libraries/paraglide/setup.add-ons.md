# Paraglide JS: Optional Add-Ons

This file is invoked from the SvelteKit Paraglide setup file (`frameworks/sveltekit/paraglide.setup.md`) after the core setup has been applied. The orchestrator's `SKILL.md §1.10` lets the user multi-select the add-ons below. Run only the sub-steps that match the user's selections in `decisions.md` — skip the rest in silence. Each sub-step is independently re-runnable: if it has already been applied, detect that and skip without prompting.

Apply the same guided / unguided rules used elsewhere in setup:
- **Guided mode**: describe the change before making it and wait for confirmation.
- **Unguided mode**: apply directly; only stop on hard errors.

Paraglide paths are fixed by the core setup: catalogs live in `messages/{locale}.json`, the inlang project is at `project.inlang/`, and compiled output goes to `src/lib/paraglide/`. Detect the package manager from the lockfile (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` / `bun.lock` → bun, `package-lock.json` → npm) before emitting any snippet below.

---

## Add-on 1: Coding rules (`@import`)

> **Pick the file that matches the catalog format.** This add-on wires in `code.md` (the **default PO** coding rules — `#.` comments, `msgid`/`msgstr`). If `decisions.setup.catalogFormat === "json"`, substitute **`json-format.code.md`** for `code.md` in **every** path below — same directory, same `@import` mechanics; it carries the ICU-JSON authoring rules (key→ICU JSON, no comments). Wire in exactly one of the two, never both (they would conflict).

The Paraglide coding rules at `references/languages/js-ts/libraries/paraglide/code.md` contain the rules for authoring strings, numbers, currencies, dates, and plurals correctly as new code is written, plus the descriptive-key guidance and the SSR request-scoped-locale rules. They ship as part of the `i18n-guide` skill, so the file already lives at `.claude/skills/i18n-guide/references/languages/js-ts/libraries/paraglide/code.md` in the target project.

Claude Code doesn't reliably auto-trigger passive "coding rules" references during routine edits — they aren't consulted unless explicitly invoked. To make the rules always-available, reference the file from the project's root `CLAUDE.md` using Claude Code's `@` import syntax.

Verify `.claude/skills/i18n-guide/references/languages/js-ts/libraries/paraglide/code.md` exists.

- **If it exists**: proceed.
- **If it is missing — guided mode**: tell the user the `i18n-guide` skill is not installed in their project and stop this add-on. The fix is to reinstall it (`npx skills add globalize-now/globalize-skills --skill i18n-guide -a claude-code`). Don't attempt to recreate the file.
- **If it is missing — unguided mode**: do not block. Skip the CLAUDE.md append and record `⚠ paraglide coding rules not installed — wiring skipped` in the end-of-run summary, with the reinstall command shown above.

Check whether `CLAUDE.md` exists at the project root.

- **If it doesn't exist**, create it:
  ```
  # Project Instructions

  @.claude/skills/i18n-guide/references/languages/js-ts/libraries/paraglide/code.md
  ```

- **If it exists**, describe the change to the user ("I'll append `@.claude/skills/i18n-guide/references/languages/js-ts/libraries/paraglide/code.md` to your CLAUDE.md so the paraglide coding rules auto-load every session") and wait for confirmation in guided mode before appending. Put the line at the end of the file on its own line. Do not remove or reorder existing content.

If the exact `@` line is already present, skip silently — this add-on is idempotent.

Tell the user: "The first time you start a Claude Code session in this project, you'll see a one-time prompt asking to approve the `@` import. Approve it — otherwise the rules won't load."

Verify: in a fresh session, ask Claude "how should I author a plural string in this project?" — the answer should reference an ICU `plural` body in a `messages/{locale}.po` entry (or `messages/{locale}.json` on the ICU-JSON format) called through `m`, not a JS conditional.

---

## Add-on 2: ESLint

**Be honest with the user: Paraglide has no first-party ESLint plugin.** Unlike Lingui (which ships `eslint-plugin-lingui`), there is no officially maintained linter that detects untranslated, hardcoded user-facing strings in a Paraglide project. Do not install or configure a plugin that claims to do this — none exists, and inventing one would mislead the user.

What is available, and what it does **not** cover:

- **`eslint-plugin-svelte`** lints general Svelte authoring (unused directives, accessibility, reactivity mistakes). It is a reasonable addition to any SvelteKit project, but **it does not detect hardcoded user-facing strings** and is not an i18n tool. Only suggest it if the project wants general Svelte linting; frame it accordingly, not as catching missing translations.

  If the user wants it and it isn't already installed, pin it per the project's pinning rule:

  ```bash
  # npm
  npm install --save-dev 'eslint-plugin-svelte@^3'
  # pnpm
  pnpm add -D 'eslint-plugin-svelte@^3'
  # yarn
  yarn add -D 'eslint-plugin-svelte@^3'
  # bun
  bun add -D 'eslint-plugin-svelte@^3'
  ```

  (Confirm the current major with `npm view eslint-plugin-svelte version` and adjust the pin if it has advanced past `3`. Most SvelteKit scaffolds already include this — check `package.json` before installing.)

There is no generic "no hardcoded JSX/markup strings" ESLint rule that works reliably for Svelte templates the way `lingui/no-unlocalized-strings` does for JSX. The practical substitute is the **coding rules** in Add-on 1 plus the CI drift check in Add-on 3, which together keep the catalog authoritative.

**Recommendation:** unless the project already lints Svelte, skip this add-on and rely on Add-ons 1 and 3. If you skip, say so plainly — do not leave the user thinking a translation linter was wired up.

---

## Add-on 3: CI/CD integration

Paraglide is **compiler-based with no extract step** — messages are hand-authored into `messages/{locale}.po` (default format) and the compiler turns them into the runtime `m` object. So the Lingui-style "extract → diff" flow does not apply. The CI integration here has two parts:

1. **Compile** — regenerate the runtime output so the build consumes up-to-date message functions.
2. **Catalog consistency (drift) check** — fail the build if a non-base locale file is missing keys present in the base locale (someone added a key to `messages/en.po` but didn't add it to the others), so untranslated keys surface in review instead of rendering as fallbacks in production.

### Compile command

The canonical compile invocation is **exactly** (both flags are required — without `--outdir` it compiles to the wrong directory):

```bash
npx '@inlang/paraglide-js@^2' compile --project ./project.inlang --outdir ./src/lib/paraglide
```

`--project ./project.inlang` and `--outdir ./src/lib/paraglide` mirror the `project` / `outdir` options set on the Vite plugin in the core setup. Keep both in sync if the project ever moves those paths.

### Drift check

The drift check is a small custom script — there is **no Paraglide subcommand for it**. It compares the key set of every locale catalog against the base locale and exits non-zero on any mismatch. On the default **PO** format the keys are `msgid` values; the skill authors PO entries one-key-per-`msgid` on a single line, so a dependency-free line scan is enough. Create `scripts/check-i18n-catalogs.mjs`:

```js
// scripts/check-i18n-catalogs.mjs  (PO — default)
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const MESSAGES_DIR = 'messages'
const BASE_LOCALE = 'en' // set to the project's baseLocale from project.inlang/settings.json

const keysOf = (locale) => {
  const raw = readFileSync(join(MESSAGES_DIR, `${locale}.po`), 'utf8')
  const keys = new Set()
  let ctx = null
  for (const line of raw.split('\n')) {
    const c = line.match(/^msgctxt\s+"(.*)"\s*$/)
    if (c) { ctx = c[1]; continue }
    const m = line.match(/^msgid\s+"(.*)"\s*$/)
    if (m) {
      if (m[1] !== '') keys.add(ctx ? `${ctx}::${m[1]}` : m[1]) // skip the empty header msgid; fold msgctxt like the plugin does
      ctx = null
    }
  }
  return keys
}

const baseKeys = keysOf(BASE_LOCALE)
const locales = readdirSync(MESSAGES_DIR)
  .filter((f) => f.endsWith('.po'))
  .map((f) => f.replace(/\.po$/, ''))

let failed = false
for (const locale of locales) {
  if (locale === BASE_LOCALE) continue
  const keys = keysOf(locale)
  const missing = [...baseKeys].filter((k) => !keys.has(k))
  const extra = [...keys].filter((k) => !baseKeys.has(k))
  if (missing.length || extra.length) {
    failed = true
    console.error(`✗ messages/${locale}.po out of sync with ${BASE_LOCALE}`)
    if (missing.length) console.error(`  missing keys: ${missing.join(', ')}`)
    if (extra.length) console.error(`  extra keys:   ${extra.join(', ')}`)
  }
}

if (failed) {
  console.error('\nCatalog drift detected. Add the missing keys (the translation platform fills the values).')
  process.exit(1)
}
console.log('✓ all locale catalogs are in sync with the base locale')
```

Set `BASE_LOCALE` to the project's actual `baseLocale` from `project.inlang/settings.json`. The line scan assumes the skill's authoring style (single-line `msgid` keys); if a TMS has reformatted the `.po` (wrapped lines, reordered entries), parse with `gettext-parser` instead — but that adds a devDependency, so only reach for it if the line scan proves insufficient.

**Critical — compile does NOT validate ICU under PO.** Unlike the ICU-JSON plugin, the PO plugin in `icu` mode imports a malformed ICU `msgstr` **verbatim as literal text with no error**, so `paraglide compile` succeeds and the broken string ships. There is no build-time guard for ICU validity. Keep a render-level check in CI (or at minimum in the convert/verify step) — assert a known plural renders its selected form, not the raw `{count, plural, …}` source. The drift script above only enforces key parity.

#### ICU-JSON catalog format (`catalogFormat === "json"`)

If the project uses the ICU-JSON format, the catalogs are `messages/{locale}.json`, so the drift script compares JSON keys. Replace `keysOf` and the locale glob:

```js
const keysOf = (locale) => {
  const raw = JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8'))
  return new Set(Object.keys(raw).filter((k) => k !== '$schema'))
}

const locales = readdirSync(MESSAGES_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
// …rest of the script (baseKeys, the per-locale comparison, exit codes) is unchanged, swapping `.po` → `.json` in the error message.
```

**On ICU-JSON, compile covers ICU validity:** the ICU1 plugin parses every catalog at compile time, so running the compile command above in CI already fails on malformed ICU (no separate ICU parser or render check needed — the drift script only enforces key parity). This is the one safety net the PO format lacks.

### `package.json` scripts

Add (or merge with existing):

```json
{
  "scripts": {
    "i18n:compile": "paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide",
    "i18n:check": "node scripts/check-i18n-catalogs.mjs"
  }
}
```

`paraglide-js` resolves to the locally installed `@inlang/paraglide-js` binary in scripts, so the `npx '@inlang/paraglide-js@^2'` form is only needed when running outside an install (e.g. a standalone CI step without `node_modules`).

Note: the Vite plugin already recompiles on dev and build, so `i18n:compile` is mainly for CI or one-off regeneration — you do not need to prepend it to the `build` script the way Lingui does (Lingui's compile is a real prerequisite of its build; Paraglide's runs automatically inside `vite build`).

### GitHub Actions workflow

If the project has `.github/workflows/`, scaffold `.github/workflows/i18n.yml`:

```yaml
name: i18n

on:
  pull_request:
    paths:
      - 'messages/**'
      - 'project.inlang/**'
      - 'scripts/check-i18n-catalogs.mjs'
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
      - name: Compile catalogs (also validates ICU)
        run: npm run i18n:compile
      - name: Verify locale catalogs are in sync
        run: npm run i18n:check
```

Adjust the install command and `paths` to match the project's package manager. If the project does not have `.github/workflows/`, skip the workflow scaffold and just install the npm scripts; tell the user how to wire `i18n:check` into their CI of choice.

### Why the drift check matters

Because Paraglide messages are hand-authored per locale, a contributor can add `messages/en.json` keys and forget the other locales. Those keys then fall back to the base locale (or render as the key) for every other language until someone notices. The drift check makes "every locale has every base key" part of the PR contract — the translation platform fills the *values*, but the *keys* must exist.

---

## Add-on 4: Test setup helper

This add-on is **not required** for the initial setup to work. Tests that don't assert on locale-specific output are unaffected. But a test that needs to render a component under a specific locale must set the active locale first — otherwise the `m` functions resolve under whatever locale the test environment defaults to.

Detect the test runner from `package.json`. Vitest is the standard for Vite/SvelteKit projects; this helper targets Vitest with `@testing-library/svelte` and jsdom. If neither is present, install them pinned (`'vitest@^3'`, `'@testing-library/svelte@^5'`, `'jsdom@^26'`) — confirm current majors with `npm view <pkg> version` and adjust.

### Test helper

`setLocale()` from the runtime sets the active locale via the configured strategies. **By default it reloads the page** (see `paraglide.setup.md` and `paraglide/code.md`), which throws "navigation not implemented" under jsdom. Pass `{ reload: false }` so the helper works in tests:

```ts
// src/test/renderWithLocale.ts
import { render } from '@testing-library/svelte'
import type { Component, ComponentProps } from 'svelte'
import { setLocale, baseLocale, type Locale } from '$lib/paraglide/runtime.js'

export function renderWithLocale<C extends Component<any>>(
  component: C,
  options: { locale?: Locale; props?: ComponentProps<C> } = {},
) {
  const { locale = baseLocale, props } = options
  // reload:false is required — the default reload throws under jsdom
  setLocale(locale, { reload: false })
  return render(component, { props })
}
```

`Locale` and `baseLocale` are exported from the generated `$lib/paraglide/runtime.js`. Keep the `.js` extension on the import — that is what the compiler emits and SvelteKit resolves.

### Usage

```ts
import { describe, it, expect } from 'vitest'
import { renderWithLocale } from '../test/renderWithLocale'
import Greeting from './Greeting.svelte'

it('renders the French greeting', () => {
  const { getByRole } = renderWithLocale(Greeting, {
    locale: 'fr',
    props: { name: 'Marie' },
  })
  expect(getByRole('heading')).toHaveTextContent('Bonjour, Marie !')
})
```

Because the locale is global (module-scoped runtime state), tests that assert on a specific locale should set it via the helper rather than relying on test ordering. If a suite mixes locales, reset to `baseLocale` between tests (e.g. in a `beforeEach`) so one test's `setLocale` doesn't leak into the next.

### SSR-rendered components

The helper above renders client-side under jsdom, which is correct for component unit tests. Components whose locale resolution depends on the request-scoped server middleware (`paraglideMiddleware`) — i.e. behavior that only happens during a real SSR request — can't be exercised by a client render. Test those through a SvelteKit end-to-end harness (e.g. Playwright) instead, and keep unit tests focused on component output under an explicitly set locale.

---

## End

Record applied add-ons in the end-of-run summary so the user has an audit trail of what was wired up.
