# Paraglide JS: Coding Rules + Optional Add-Ons

This file is invoked from the SvelteKit Paraglide setup file (`frameworks/sveltekit/paraglide.setup.md`) after the core setup has been applied.

It has two parts. **The two core steps below always run** — they are not add-ons and are not gated on any selection. The add-ons after them are the ones `SKILL.md §1.10` lets the user multi-select: run only the sub-steps that match the user's selections in `decisions.md` — skip the rest in silence. Every section here is independently re-runnable: if it has already been applied, detect that and skip without prompting.

Apply the same guided / unguided rules used elsewhere in setup:
- **Guided mode**: describe the change before making it and wait for confirmation.
- **Unguided mode**: apply directly; only stop on hard errors.

Core setup's defaults are `messages/{locale}.po` for the catalogs (`.json` on the ICU-JSON format), `project.inlang/` for the inlang project, and `src/lib/paraglide/` for the compiled output — but read the real values from `project.inlang/settings.json` (`pathPattern`, `baseLocale`, `locales`) and the `paraglideVitePlugin({ outdir })` call in `vite.config.{ts,js}` rather than assuming them. Detect the package manager from the lockfile (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` / `bun.lock` → bun, `package-lock.json` → npm) before emitting any snippet below.

---

## Core step 1: generate the coding rules (`generate_coding_rules` — always runs)

**This is a core Phase 2 step, not an add-on**, and it is **not** gated on a `SKILL.md §1.10` selection. Phase 3's wrap subagents read `.agents/globalize-rules.md` as their authoring contract — message decision tree, plural rules, skip-list, real catalog paths — so conversion cannot start until this step has produced it. Wiring that file into `CLAUDE.md` and `AGENTS.md` is the second core step below, which also always runs.

The Paraglide coding rules are a **generated file**, not a shipped one. `references/languages/js-ts/libraries/paraglide/rules.template.md` covers every configuration Paraglide supports on SvelteKit — both catalog formats (PO and ICU-JSON), the message decision tree, the authoring workflow, plurals/select/ordinal, numbers, currencies, dates, the SSR request-scoped-locale rules, and translator comments. This step renders it down to the one configuration this project actually has (only the branches that apply, with the project's real catalog path, generated-module import base, and locales substituted in) and writes the result to `.agents/globalize-rules.md`.

One template, one output file. There is no longer a PO file and a JSON file to choose between — the catalog format is a **condition** resolved in step 2 below, and the branch that doesn't apply is deleted before anything is written.

**Read `references/rules-template-format.md` before rendering.** It is the whole rendering contract — template anatomy, the conditional grammar, the `<<placeholder>>` form, the step order, the header, the fail-closed rule. The steps below only add where *this library's* values come from.

### 1. Locate the template

Read `.globalize/manifest-snapshot.json` → `references.rulesTemplate`.

**If the entry has no `rulesTemplate`**, the installed skill is out of date — the Paraglide variant carries one. Do not look for a generic `code.md` or a `json-format.code.md`; neither exists for this library any more. Treat this exactly like the missing-file case below.

Verify the template exists in the target project.

- **If it exists**: proceed.
- **If it is missing — guided mode**: tell the user the `globalize-guide` skill is not installed in their project and stop this step. The fix is to reinstall it (`npx skills add globalize-now/globalize-skills --skill globalize-guide -a claude-code`). Don't attempt to recreate the file.
- **If it is missing — unguided mode**: do not block. Skip this step and record `⚠ paraglide coding rules not generated — template missing` in the end-of-run summary, with the reinstall command shown above. Treat it as the fail-closed case in step 6: a core step did not complete, so Phase 3 has no rules file.

### 2. Resolve the template's `conditions`

Resolve every key listed in the template frontmatter's `conditions` and write them to `.globalize/rules-values.json`. Comparison values are string literals, so booleans resolve to `"true"` / `"false"`.

| Condition | Where to read it |
|---|---|
| `catalogFormat` | `project.inlang/settings.json`, confirmed against the catalogs on disk: `"po"` when `modules` lists the `@globalize-now/paraglidejs-po-format` URL and the `plugin.globalizeNow.po` key is present; `"json"` when it lists `@inlang/plugin-icu1` with a `plugin.inlang.icu-messageformat-1` key. Cross-check `.globalize/decisions.md`; **the settings file on disk wins** if they disagree. Exactly one catalog-owning plugin may be listed — if both are, stop and fail closed (step 6), because the project is misconfigured and neither branch is correct. |
| `ssr` | `"true"` unless the project is globally SPA-only. Read the **root** layout — `src/routes/+layout.js` / `+layout.ts` — and resolve `"false"` only when it exports `ssr = false` (optionally corroborated by `@sveltejs/adapter-static` with a `fallback` in `svelte.config.js`). Anything else — no root layout, no `ssr` export, `ssr = true`, per-route `ssr = false` on some routes but not the root — resolves `"true"`. The asymmetry is deliberate: the SSR branch is the correct default for every project this setup targets, and the `"false"` branch is a strict subset of it, so an over-broad `"true"` costs a few lines while an over-broad `"false"` would drop a rule that applies. |

### 3. Eliminate branches, then resolve the surviving `values`

Delete every false branch **and every marker line** (`<!-- if:`, `<!-- else -->`, `<!-- /if -->` all disappear, kept branch or not). Only then resolve the `values` still referenced in what survived — from the config **on disk**, the files core setup actually wrote, not from `decisions.md`, which records what was asked for rather than what landed — appending them to the same `.globalize/rules-values.json`.

**The order is load-bearing.** `hooksServerPath` lives inside the `ssr == "true"` branch: a project rendered as an SPA has no request-scoped middleware and no path to name. Resolving up front would demand a value that doesn't exist and trip step 6 on a perfectly healthy project.

Paraglide is **hand-authored** — there is no extraction step, so the agent writes catalog entries directly at the path these rules name. A wrong `catalogPath` or `sourceCatalog` here is not a cosmetic error: every future message lands in a file the compiler never reads. Resolve both from `project.inlang/settings.json`, and confirm the file exists on disk before rendering.

| Value | Where to read it |
|---|---|
| `catalogPath` | The catalog plugin's `pathPattern` in `project.inlang/settings.json` — `plugin.globalizeNow.po.pathPattern` on PO, `plugin.inlang.icu-messageformat-1.pathPattern` on ICU-JSON. Strip a leading `./` and keep the `{locale}` token exactly as the settings file writes it — it is part of the **path format**, not a template placeholder, and must survive into the rendered file (e.g. `messages/{locale}.po`). |
| `sourceCatalog` | `catalogPath` with `{locale}` replaced by `baseLocale` from `project.inlang/settings.json` — e.g. `messages/en.po`. Verify that exact file exists; if it does not, the base catalog was never seeded and this add-on has nothing correct to say. |
| `sourceLocale` | `baseLocale` in `project.inlang/settings.json`. |
| `targetLocales` | `locales` in `project.inlang/settings.json` minus `baseLocale`, comma-separated: `de, fr, ja`. |
| `paraglideImportBase` | The **import specifier** for the compiler's `outdir`, not the filesystem path. Read `outdir` from `paraglideVitePlugin({ ... })` in `vite.config.{ts,js}` (setup writes `./src/lib/paraglide`). Anything under `src/lib` maps to the SvelteKit `$lib` alias — `./src/lib/paraglide` → `$lib/paraglide`. A custom `outdir` outside `src/lib` has no `$lib` form; use the specifier the project's own imports use (an alias from `svelte.config.js` `kit.alias`, or a project-relative path). Do **not** assume `$lib/paraglide`. |
| `hooksServerPath` | The **actual on-disk** server hook that calls `paraglideMiddleware` — `src/hooks.server.ts` on a TypeScript project, `src/hooks.server.js` on a JavaScript one. Glob for it; do not assume the extension. (Only needed when `ssr == "true"`.) |

### 4. Render

Substitute every surviving `<<name>>` with its resolved value, strip the frontmatter, and **copy everything retained verbatim** — do not rewrite, summarize, reflow, re-order, or improve the prose. Prepend the two-line generated header:

```
<!-- globalize-rules v<templateVersion> | template=paraglide | variant=<manifest-snapshot variant> | generated by globalize-guide -->
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

One extra check for this library, because both formats render from the same template: the generated file must describe **exactly one** catalog format. If it mentions both `msgid`/`msgstr` and ICU-JSON message values, a branch survived that should have been deleted — fail closed and re-render.

### 6. Fail closed

If **any** surviving condition or value can't be resolved, or the self-check fails: **never write a partial file.** Delete anything already written to `.agents/globalize-rules.md`, then:

- **Guided mode** — ask the user for the specific value. Every one of these is a one-line answer ("Where do your message catalogs live?", "Which locale is the source?", "What does the Paraglide compiler's `outdir` import as?"), and getting one beats shipping either wrong rules or none. Resolve, re-render, re-check. Only if the user can't answer, or the self-check still fails, stop this step and say which key or check failed.
- **Unguided mode** — don't block the run. Skip this step and record `⚠ paraglide coding rules not generated (catalogPath unresolved) — no rules file installed` in the end-of-run summary.

Either way a **core step did not complete**, so surface it instead of letting the run drift into conversion: report `generate_coding_rules` as failed, leave it unchecked in `plan.md`, and tell the orchestrator that Phase 3 has no `.agents/globalize-rules.md` to wrap against. The user then either supplies the missing value and re-runs this step, or converts knowing the wrap subagents are working without this project's rules.

There is no generic-rules fallback: `paraglide/rules.template.md` **and** `paraglide/rules.template.md` were both deleted when this library moved to a single template, so the template is the only source of truth for Paraglide rules. Installing nothing is recoverable — re-run this step. Installing rules that name the wrong catalog path is not: Paraglide is hand-authored, so the agent writes every future message straight into a file the compiler never reads, and nothing signals it.

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
- **If it exists**, append `@.agents/globalize-rules.md` at the end of the file on its own line ("I'll append `@.agents/globalize-rules.md` to your CLAUDE.md so the paraglide coding rules auto-load every session"). Do not remove or reorder existing content.
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

Verify: in a fresh session, ask Claude "how should I author a plural string in this project?" — the answer should reference an ICU `plural` body written into this project's own source catalog and called through `m`, not a JS conditional.

---

<!-- Add-on numbering starts at 2 on purpose: what used to be Add-on 1 (importing the coding
     rules) is now the second core step above, and the remaining numbers are left unchanged so
     cross-references elsewhere in this file stay valid. -->

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

There is no generic "no hardcoded JSX/markup strings" ESLint rule that works reliably for Svelte templates the way `lingui/no-unlocalized-strings` does for JSX. The practical substitute is the generated **coding rules** from the core step above plus the CI drift check in Add-on 3, which together keep the catalog authoritative.

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

Detect the test runner from `package.json`. Vitest is the standard for Vite/SvelteKit projects; this helper targets Vitest with `@testing-library/svelte` and jsdom. If neither is present, install them pinned (`'vitest@^4'`, `'@testing-library/svelte@^5'`, `'jsdom@^29'`) — confirm current majors with `npm view <pkg> version` and adjust.

### Test helper

`setLocale()` from the runtime sets the active locale via the configured strategies. **By default it reloads the page** (see `paraglide.setup.md` and `paraglide/rules.template.md`), which throws "navigation not implemented" under jsdom. Pass `{ reload: false }` so the helper works in tests:

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
