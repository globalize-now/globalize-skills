# LinguiJS: Coding Rules + Optional Add-Ons

This file is invoked from the framework-specific lingui setup files — `nextjs/app-router/lingui.setup.md`, `vite/react-swc/lingui.setup.md`, `vite/react-babel/lingui.setup.md`, `tanstack-start/lingui.setup.md`, `tanstack-start/swc/lingui.setup.md`, `remix/lingui.setup.md`, `remix/swc/lingui.setup.md`, `react-router-framework/lingui.setup.md`, `react-router-framework/swc/lingui.setup.md` — after the core setup has been applied, and after `setup.navigation.md` has emitted the navigation module (the `localeNavigation` condition below is resolved from its presence on disk).

It has two parts. **The two core steps below always run** — they are not add-ons and are not gated on any selection. The add-ons after them are the ones `SKILL.md §1.10` lets the user multi-select: run only the sub-steps that match the user's selections in `decisions.md` — skip the rest in silence. Every section here is independently re-runnable: if it has already been applied, detect that and skip without prompting.

Apply the same guided / unguided rules used elsewhere in setup:
- **Guided mode**: describe the change before making it and wait for confirmation.
- **Unguided mode**: apply directly; only stop on hard errors.

The catalog path and build command vary by framework — read `decisions.md` and `lingui.config.{ts,js}` to find the project's actual `catalogs.path`, package manager, and build script before emitting any snippet below.

---

## Core step 1: generate the coding rules (`generate_coding_rules` — always runs)

**This is a core Phase 2 step, not an add-on**, and it is **not** gated on a `SKILL.md §1.10` selection. Phase 3's wrap subagents read `.agents/globalize-rules.md` as their authoring contract — macro decision tree, plural rules, skip-list, real catalog paths — so conversion cannot start until this step has produced it. Wiring that file into `CLAUDE.md` and `AGENTS.md` is the second core step below, which also always runs.

The lingui coding rules are a **generated file**, not a shipped one. `references/languages/js-ts/libraries/lingui/rules.template.md` covers every configuration lingui supports — wrapping strings, props, plurals, ordinals, numbers, currencies, dates, translator comments, the App-Router server-vs-client split. This step renders it down to the one configuration this project actually has (only the branches that apply, with the project's real catalog path and locales substituted in) and writes the result to `.agents/globalize-rules.md`.

**Read `references/rules-template-format.md` before rendering.** It is the whole rendering contract — template anatomy, the conditional grammar, the `<<placeholder>>` form, the step order, the header, the fail-closed rule. The steps below only add where *this library's* values come from.

### 1. Locate the template

Read `.globalize/manifest-snapshot.json` → `references.rulesTemplate`.

**If the entry has no `rulesTemplate`**, the installed skill is out of date — every lingui variant carries one. Do not look for a generic `code.md`; it no longer exists for this library. Treat this exactly like the missing-file case below.

Verify the template exists in the target project.

- **If it exists**: proceed.
- **If it is missing — guided mode**: tell the user the `globalize-guide` skill is not installed in their project and stop this step. The fix is to reinstall it (`npx skills add globalize-now/globalize-skills --skill globalize-guide -a claude-code`). Don't attempt to recreate the file.
- **If it is missing — unguided mode**: do not block. Skip this step and record `⚠ lingui coding rules not generated — template missing` in the end-of-run summary, with the reinstall command shown above. Treat it as the fail-closed case in step 6: a core step did not complete, so Phase 3 has no rules file.

### 2. Resolve the template's `conditions`

Resolve every key listed in the template frontmatter's `conditions` and write them to `.globalize/rules-values.json`. Comparison values are string literals, so booleans resolve to `"true"` / `"false"`.

| Condition | Where to read it |
|---|---|
| `router` | `.globalize/manifest-snapshot.json` → `match.router`. `"app"` on the Next.js App Router variant; the key is **absent** on the Vite and TanStack Start variants — treat absent as not-`"app"`. |
| `perPageCatalogs` | `lingui.config.{ts,js}`: `"true"` when it sets `experimental.extractor`, `"false"` otherwise. That block is what switches the project to `lingui extract-experimental` and co-located per-route catalogs. |
| `appTarget` | `"browser-extension"` when `.globalize/manifest-snapshot.json` → `variant` starts with `webext-`, `"web"` otherwise. This is the one condition read off the variant rather than off disk, because it is a property of what is being built, not of what setup happened to write. An extension always resolves `router` to not-`"app"`, `perPageCatalogs` to `"false"`, and `localeNavigation` to `"none"` — it has no URLs — so those three branches collapse on their own and need no special-casing here. |
| `localeNavigation` | A composite of "does the URL carry a locale" × "which router". Resolve in two steps, both from disk. **(1)** Glob for the navigation module — `app/i18n/navigation.{ts,js}`, `src/i18n/navigation.{ts,js}`. **No match → `"none"`**: the shared navigation reference only emits it under a URL-based strategy, and it ran earlier in this same Phase 2, so its absence *is* the answer. **(2)** Match → read `package.json` dependencies: `@tanstack/react-router` or `@tanstack/react-start` → `"typed-links"`; anything else (`next`, `react-router`, `@remix-run/react`) → `"path-helpers"`. If both a TanStack router and `react-router` appear, open one route file and use whichever package it imports `Link` from. Cross-check `## Routing strategy` in `decisions.md`, but **disk wins** — it records what landed, not what was asked for. This condition cannot fail to resolve: a glob either matches or it doesn't, and `package.json` always exists. |

### 3. Eliminate branches, then resolve the surviving `values`

Delete every false branch **and every marker line** (`<!-- if:`, `<!-- else -->`, `<!-- /if -->` all disappear, kept branch or not). Only then resolve the `values` still referenced in what survived — from the config **on disk**, the file core setup actually wrote, not from `decisions.md`, which records what was asked for rather than what landed — appending them to the same `.globalize/rules-values.json`.

**The order is load-bearing.** A value that lives inside a false branch has no value to resolve — there is no navigation path on a project without prefix routing, and no per-page catalog output on a project without the experimental extractor. Resolving up front would demand values that don't exist and trip step 6 on a perfectly healthy project.

| Value | Where to read it |
|---|---|
| `catalogPath` | `catalogs[].path` in `lingui.config.{ts,js}` — e.g. `src/locales/{locale}/messages`. Keep the `{locale}` token exactly as the config writes it. If the config declares several catalog entries, use the one covering the project's source root. |
| `sourceLocale` | `sourceLocale` in `lingui.config.{ts,js}`. |
| `targetLocales` | `locales` in `lingui.config.{ts,js}` minus `sourceLocale`, comma-separated: `de, fr, ja`. |
| `localesModule` | The import specifier for the shared locale module. Glob in this order: `app/i18n/locales.{ts,js}` → `src/i18n/locales.{ts,js}` → `src/i18n.{ts,js}`. Then express it the way project code imports it: use the path alias if `tsconfig.json` `compilerOptions.paths` declares one (`~/i18n/locales`, `@/i18n/locales`), otherwise the source-root-relative path (`app/i18n/locales`). **Never assume `@/` — read the config.** If the glob finds nothing, core setup did not complete: fail closed rather than guessing a path. |
| `navModule` | Same rule, for `app/i18n/navigation.{ts,js}` / `src/i18n/navigation.{ts,js}`. Referenced only inside the two non-`"none"` `localeNavigation` branches, so on a cookie-only project the branch is already gone and this is never resolved. Read the specifier off the language switcher setup just wrote and reuse it verbatim. |
| `manifestStringsModule` | Browser-extension variants only — referenced solely inside the `appTarget == "browser-extension"` branch, so on a web project the branch is already gone and this is never resolved. The import specifier for the module holding the manifest and store copy as `msg({ id: 'manifest.…' })` descriptors: glob `src/i18n/manifest-strings.{ts,js}` and express it the way project code imports it (path alias from `tsconfig.json` `compilerOptions.paths` if one is declared, otherwise the source-root-relative path). If the glob finds nothing on an extension variant, core setup did not complete — fail closed. |
| `localesBridgeScript` | Browser-extension variants only, same branch. The project-root-relative path of the script that compiles the PO catalog into `public/_locales/` — `scripts/build-locales.mjs` as setup writes it. Confirm it is on disk and that a `package.json` script actually invokes it; a bridge nothing runs is why an extension ships an untranslated manifest. Fail closed if absent. |
| `navHooksModule` | The specifier for `useLocale` / `useLocalePath`. **Next.js App Router:** setup splits the module, so this is `navModule` with `.hooks` appended — `@/i18n/navigation.hooks`. Confirm `src/i18n/navigation.hooks.{ts,js}` is on disk. If it is missing **but `navigation.ts` itself exports `useLocale` / `useLocalePath`**, the project came from an earlier version of this skill that emitted one combined module; that shape fails the build the moment a Server Component imports it, so split it now per `setup.navigation.md` §4 instead of failing closed. If neither module exists, core setup did not complete — fail closed. Never fall back to `navModule`: pointing a hook import at the pure module yields code that does not compile. **Every other variant:** one module holds both halves, so this is identical to `navModule`. Resolved in the same branches as `navModule`. |

### 4. Render

Substitute every surviving `<<name>>` with its resolved value, strip the frontmatter, and **copy everything retained verbatim** — do not rewrite, summarize, reflow, re-order, or improve the prose. Prepend the two-line generated header:

```
<!-- globalize-rules v<templateVersion> | template=lingui | variant=<manifest-snapshot variant> | generated by globalize-guide -->
<!-- Generated file. Re-running globalize-guide overwrites it. Put your own project rules in CLAUDE.md or AGENTS.md. -->
```

Write the result to `.agents/globalize-rules.md`, overwriting any file left by an earlier run.

**`.agents/globalize-rules.md` should be committed.** It is team-shared coding guidance, exactly like `CLAUDE.md` — every contributor's agent needs it. Do **not** add it to `.gitignore`; it is not a `.globalize/` progress artifact.
Then confirm the file is actually tracked: run `git check-ignore .agents/globalize-rules.md`. Some repos ignore whole dotfile directories, and a rules file no teammate receives is not doing its job. If it comes back ignored, say so — do not silently succeed.

**Migrate off the old path.** Earlier versions of this skill wrote the rules to `.claude/globalize-rules.md`. **Only after the write above succeeded**, delete that file if it exists *and* its line 1 carries the generated header. A file at that path without the header is not ours — leave it and warn. Never remove the `.claude/` directory itself; it holds settings and installed skills that are not ours. The matching `@.claude/globalize-rules.md` line in `CLAUDE.md` is removed by the wiring step below.

### 5. Self-check the generated file

All four must hold:

- zero occurrences of `<!-- if:`, `<!-- else -->`, `<!-- /if -->`
- zero occurrences of `<<`
- the header is on line 1
- the line count is within the template's `budget` for the resolved conditions

### 6. Fail closed

If **any** surviving condition or value can't be resolved, or the self-check fails: **never write a partial file.** Delete anything already written to `.agents/globalize-rules.md`, then:

- **Guided mode** — ask the user for the specific value. `catalogPath`, `sourceLocale`, and `targetLocales` are all one-line answers ("Where do your catalogs live?"), and getting one beats shipping either wrong rules or none. Resolve, re-render, re-check. Only if the user can't answer, or the self-check still fails, stop this step and say which key or check failed.
- **Unguided mode** — don't block the run. Skip this step and record `⚠ lingui coding rules not generated (catalogPath unresolved) — no rules file installed` in the end-of-run summary.

Either way a **core step did not complete**, so surface it instead of letting the run drift into conversion: report `generate_coding_rules` as failed, leave it unchecked in `plan.md`, and tell the orchestrator that Phase 3 has no `.agents/globalize-rules.md` to wrap against. The user then either supplies the missing value and re-runs this step, or converts knowing the wrap subagents are working without this project's rules.

There is no generic-rules fallback: `lingui/code.md` was deleted when this library moved to a template, so the template is the only source of truth for lingui rules. Installing nothing is recoverable — re-run this step. Installing rules that name the wrong catalog path is not; the agent follows them into a bug on every future edit and nothing signals it.

---

## Core step 2: wire the coding rules in (`install_coding_rules` — always runs)

**This is a core Phase 2 step, not an add-on**, and it is **not** gated on a `SKILL.md §1.10` selection. Rules that nothing loads are close to useless, so the wiring is not a decision the user is asked to make up front. It does edit files the user owns, so the usual mode rule applies: **guided mode** describes each change and waits for confirmation, **unguided mode** applies it directly.

If the core step above failed and there is no `.agents/globalize-rules.md` on disk, **skip this step entirely and create neither file** — an import or pointer aimed at a missing file opens every future session with a dangling reference.

Two bridges, because no single mechanism reaches every agent.

### `CLAUDE.md` — Claude Code

Claude Code doesn't reliably auto-trigger passive "coding rules" references during routine edits, but an `@`-imported file loads into every session's context.

- **If it doesn't exist**, create it:
  ```
  # Project Instructions

  @.agents/globalize-rules.md
  ```
- **If it exists**, append `@.agents/globalize-rules.md` at the end of the file on its own line ("I'll append `@.agents/globalize-rules.md` to your CLAUDE.md so the lingui coding rules auto-load every session"). Do not remove or reorder existing content.
- **If a stale `@.claude/globalize-rules.md` line is present** — written by an older version of this skill, which put the rules file under `.claude/` — remove it in the same edit. Leaving it behind means every future session opens with a dangling import.

If the exact `@.agents/globalize-rules.md` line is already present, skip silently — this step is idempotent.

Tell the user: "The first time you start a Claude Code session in this project, you'll see a one-time prompt asking to approve the `@` import. Approve it — otherwise the rules won't load."

### `AGENTS.md` — Codex CLI, Cursor, Copilot, Gemini, Aider, Cline

All of these read a repo-root `AGENTS.md`. None of them support an import syntax, so the rules reach them as a pointer they must choose to follow rather than a guaranteed load. That is the honest ceiling here: inlining a second copy of the rules would guarantee loading at the cost of two copies that drift out of sync.

- **If it doesn't exist**, create it with an `# AGENTS.md` heading and the section below — nothing else. Do not author a project brief on the user's behalf.
- **If it exists**, append the section at the end. Do not remove or reorder existing content.

```markdown
## Internationalization

Before adding or editing any user-facing string, read `.agents/globalize-rules.md`
and follow it. It is this project's authoritative i18n authoring contract — which
API to use, how to handle plurals, where catalogs live, and what not to wrap.
```

Idempotent on the literal `.agents/globalize-rules.md` appearing anywhere in `AGENTS.md`: present → skip silently.

Verify: in a fresh session, ask Claude "how should I wrap a plural string in this project?" — the answer should reference the `<Plural>` macro and ICU plural patterns from the generated file.

---

<!-- Add-on numbering starts at 2 on purpose: what used to be Add-on 1 (importing the coding
     rules) is now the second core step above, and the remaining numbers are left unchanged so
     cross-references elsewhere in this file stay valid. -->

## Add-on 2: ESLint plugin

Lingui ships an officially maintained ESLint plugin: [`eslint-plugin-lingui`](https://github.com/lingui/eslint-plugin-lingui). It catches the most common authoring mistakes — hardcoded JSX strings outside macros, missing translator comments, malformed `<Plural>` props — and is the right default for any lingui project.

### Install

Detect the package manager from the lockfile (`package-lock.json` → npm, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` → bun). The plugin is pre-1.0 — pin to the current minor with a caret per the project's pinning rule:

```bash
# npm
npm install --save-dev 'eslint-plugin-lingui@^0.14'
# pnpm
pnpm add -D 'eslint-plugin-lingui@^0.14'
# yarn
yarn add -D 'eslint-plugin-lingui@^0.14'
# bun
bun add -D 'eslint-plugin-lingui@^0.14'
```

(If the published current major has advanced past `0.14`, bump the pin accordingly — confirm via `npm view eslint-plugin-lingui version` if uncertain.)

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

This rule is the noisiest by default because it flags every string literal in JSX. Tune the rule's `ignoreNames` (attribute, property, and variable names — e.g. `data-testid`, `id`, `slug`), `ignoreFunctions` (functions whose string arguments to skip), and `ignore` (regex patterns for literal values to skip) to match the codebase before running across the full repo, otherwise the first lint pass produces hundreds of false positives in tests, fixtures, and `data-testid` attributes. A reasonable starting point:

```js
{
  rules: {
    'lingui/no-unlocalized-strings': ['error', {
      // ignoreNames covers JSX attribute names, object property names, and variable names.
      ignoreNames: ['data-testid', 'href', 'src', 'srcSet', 'id', 'slug', 'sku', 'key', 'type', 'variant', 'role', 'className', 'class', 'style', 'styleName', 'width', 'height', 'displayName'],
      ignoreFunctions: ['Symbol', 'cva', 'cn', 'console.*'],
      // Skip ALL_CAPS enum values / internal codes (see code.md 'What not to wrap').
      ignore: ['^[A-Z0-9_-]+$'],
    }],
  },
}
```

Apply this only inside `src/` (or the project's source root), not test files or scripts.

### After install

Run the project's lint command once and report the count of new errors to the user. If the count is large (>50), suggest running `lingui extract` first so any missed wraps surface as proper catalog entries before the lint-driven cleanup pass.

> **Note:** the convert **verify** phase now installs and runs `lingui/no-unlocalized-strings` as a recall self-check regardless of this add-on (see `references/languages/js-ts/convert.recall-self-check.md`), so a converted project keeps this guardrail even if the add-on wasn't selected. Selecting this add-on additionally wires the full recommended preset and (with Add-on 3) the CI drift check.

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

**Script-name reconciliation — read `package.json` before adding anything.** The framework setup references (`nextjs/app-router/lingui.setup.md`, the Vite files, the TanStack Start files) create a `lingui:extract` / `lingui:compile` pair as part of core setup. This add-on was written around an `i18n:extract` / `i18n:compile` pair. They run the same commands. If the `lingui:*` pair already exists, **reuse it** and add only what is missing — in practice just the drift check, `i18n:check` — rather than creating a second, near-duplicate pair. Point the GitHub Actions workflow below at whichever names the project actually has.

Add (or merge with existing):

```json
{
  "scripts": {
    "i18n:extract": "lingui extract --clean",
    "i18n:compile": "lingui compile --typescript",
    "i18n:check": "lingui compile && lingui extract --clean && git diff --exit-code -- src/locales"
  }
}
```

Replace `src/locales` in `i18n:check` with the project's actual catalog path. Drop `--typescript` if the project is plain JavaScript.

**Why `i18n:check` compiles first.** Compiled catalogs are gitignored (see the `` `.gitignore` `` section of the stack's setup reference), so a clean CI checkout has the `.po` sources but none of the compiled output. That breaks extraction on the per-route stacks: the per-page extractor resolves each route file's dynamic-import target with esbuild **before writing anything**, and fails with `Could not resolve import(...)` when those targets are absent — see `frameworks/tanstack-start/lingui.setup.md:423`. Running `lingui compile` first materialises them so the extract can proceed. Without the leading compile, the old form of this script fails on every clean CI checkout for those stacks.

A side effect: `git diff --exit-code` can now only ever report `.po` changes, because the compiled catalogs it would otherwise have flagged are untracked. That is the intended contract — the drift check is about catalog *sources*, not build artifacts.

**Build wiring — check before you write.** Core setup now prepends `lingui compile` to the `build` and `dev` scripts itself (see the "Catalog scripts" section of the stack's setup reference). Read `package.json`: if the `build` script already starts with `lingui compile`, leave it alone — do **not** add a second compile invocation. Only wire it in here when it is absent, which means an older setup that predates that change, or a hand-built project that never went through the setup reference:

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
      - name: Compile catalogs
        run: npm run i18n:compile
      - name: Verify catalogs are in sync
        run: npm run i18n:check
```

**Compile before anything that type-checks or builds.** The compile step comes first on purpose. Compiled catalogs are gitignored, so a CI checkout starts without them and the route files' catalog imports cannot resolve until something generates them. Any job that runs `tsc --noEmit`, `next build`, `vite build`, or the project's `build` script on a clean checkout must run `i18n:compile` first (or invoke a `build` script that already prepends `lingui compile`). Keep this ordering if you add typecheck or build steps to this workflow, and apply it to any other workflow that touches the app.

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
