# next-intl: Coding Rules + Optional Add-Ons

This file is invoked from the framework-specific next-intl setup files (`nextjs/app-router/next-intl.setup.md`, `nextjs/pages-router/next-intl.setup.md`) after the core setup has been applied.

It has two parts. **The three core steps below always run** — they are not add-ons and are not gated on any selection. The add-ons after them are the ones `SKILL.md §1.10` lets the user multi-select: run only the sub-steps that match the user's selections in `decisions.md` — skip the rest in silence. Every section here is independently re-runnable: if it has already been applied, detect that and skip without prompting.

Apply the same guided / unguided rules used elsewhere in setup:
- **Guided mode**: describe the change before making it and wait for confirmation.
- **Unguided mode**: apply directly; only stop on hard errors.

---

## Core step 0: generate the format helpers (`generate_format_helpers` — always runs)

**This is a core Phase 2 step, not an add-on**, and like the two steps that follow it, it is **not** gated on a `SKILL.md §1.10` selection. Phase 3's wrap subagents route every number, currency, date, and list they touch through this module, so conversion cannot start until it exists. It always runs first — Core step 1 below renders `<<formatModule>>` from what this step writes.

next-intl is the one stack in this skill where delegation earns its keep over building on raw `Intl`. `useFormatter()` (any component) and `getFormatter()` (server-only async code) already read the active request's `now` and `timeZone` — set once in `getRequestConfig` — which a call straight to `Intl.DateTimeFormat` cannot see. The module below wraps next-intl's own formatter instead of replacing it, which is the whole point of this variant.

### 1. Resolve `<i18nDir>`

The same directory `i18nRequestPath` and `i18nNavigationPath` resolve against in Core step 1 below — `src/i18n/` on a project with a `src/` root, `i18n/` otherwise. Glob for it; do not assume.

### 2. Create `<i18nDir>/format.ts`

**The module's shape differs by router.** `next-intl/server` — where `getFormatter` lives — is App Router only. Read `.globalize/manifest-snapshot.json` → `match.router` and emit the matching version below; do not emit both, and do not emit the App Router version's `getFormatters` on a Pages Router project.

**App Router** (`match.router == "app"`):

```ts
// <i18nDir>/format.ts
import { useFormatter } from 'next-intl'
import { getFormatter } from 'next-intl/server'

export type DateInput = Date | number | string
export const DEFAULT_CURRENCY = 'USD'   // adjust to this project's currency

export type Formatters = {
  money(amount: number, currency?: string): string
  number(value: number, opts?: Intl.NumberFormatOptions): string
  percent(value: number): string
  compact(value: number): string
  unit(value: number, unit: string): string
  date(value: DateInput, preset?: 'short' | 'medium' | 'long'): string
  time(value: DateInput): string
  dateTime(value: DateInput): string
  relativeTime(value: DateInput, now?: DateInput): string
  list(items: string[], type?: 'and' | 'or'): string
}

/**
 * THE SEAM. next-intl resolves the locale for us, so there is nothing to override
 * here today. To give this project a separate regional preference, stop calling
 * next-intl's formatter and build an Intl-based one against a locale chosen here.
 */
export function formatLocale(uiLocale: string): string {
  return uiLocale
}

const toDate = (v: DateInput): Date => (v instanceof Date ? v : new Date(v))

type NextFormatter = ReturnType<typeof useFormatter>

function bind(format: NextFormatter): Formatters {
  return {
    money: (amount, currency = DEFAULT_CURRENCY) =>
      format.number(amount, { style: 'currency', currency }),
    number: (value, opts) => format.number(value, opts),
    percent: (value) => format.number(value, { style: 'percent' }),
    compact: (value) => format.number(value, { notation: 'compact' }),
    unit: (value, unit) => format.number(value, { style: 'unit', unit }),
    date: (value, preset = 'medium') => format.dateTime(toDate(value), preset),
    time: (value) => format.dateTime(toDate(value), 'time'),
    dateTime: (value) => format.dateTime(toDate(value), 'dateTime'),
    // Uses next-intl's request-scoped `now` when the second argument is omitted,
    // which is what keeps server and client on one reference instant.
    relativeTime: (value, now) =>
      format.relativeTime(toDate(value), now === undefined ? undefined : toDate(now)),
    list: (items, type = 'and') => format.list(items, type) as string,
  }
}

/** In Client Components, and in a Server Component that has no `await` in its body. */
export function useFormatters(): Formatters {
  return bind(useFormatter())
}

/** In an `async` Server Component, `generateMetadata`, route handlers, server actions. */
export async function getFormatters(): Promise<Formatters> {
  return bind(await getFormatter())
}
```

**`useFormatter()` is a hook — it cannot be called from an `async` component.** That is precisely why the awaitable `getFormatter()` exists. Almost every Server Component that renders translated text is itself `async` (it `await`s `getTranslations()`), so in practice most Server Components need `getFormatters()`, not `useFormatters()` — the same async/sync split `getTranslations()` already forces on translation. Reach for `getFormatters()` in an `async` Server Component, or in non-component async code — `generateMetadata`, route handlers, server actions — and **`await` it**: next-intl's server APIs throw at runtime when used unawaited, and this module's `getFormatters()` is no exception. `useFormatters()` stays available in Client Components and in the rare Server Component with no `await` anywhere in its body.

**Pages Router** (`match.router == "pages"`):

```ts
// <i18nDir>/format.ts
import { useFormatter } from 'next-intl'

export type DateInput = Date | number | string
export const DEFAULT_CURRENCY = 'USD'   // adjust to this project's currency

export type Formatters = {
  money(amount: number, currency?: string): string
  number(value: number, opts?: Intl.NumberFormatOptions): string
  percent(value: number): string
  compact(value: number): string
  unit(value: number, unit: string): string
  date(value: DateInput, preset?: 'short' | 'medium' | 'long'): string
  time(value: DateInput): string
  dateTime(value: DateInput): string
  relativeTime(value: DateInput, now?: DateInput): string
  list(items: string[], type?: 'and' | 'or'): string
}

/**
 * THE SEAM. next-intl resolves the locale for us, so there is nothing to override
 * here today. To give this project a separate regional preference, stop calling
 * next-intl's formatter and build an Intl-based one against a locale chosen here.
 */
export function formatLocale(uiLocale: string): string {
  return uiLocale
}

const toDate = (v: DateInput): Date => (v instanceof Date ? v : new Date(v))

type NextFormatter = ReturnType<typeof useFormatter>

function bind(format: NextFormatter): Formatters {
  return {
    money: (amount, currency = DEFAULT_CURRENCY) =>
      format.number(amount, { style: 'currency', currency }),
    number: (value, opts) => format.number(value, opts),
    percent: (value) => format.number(value, { style: 'percent' }),
    compact: (value) => format.number(value, { notation: 'compact' }),
    unit: (value, unit) => format.number(value, { style: 'unit', unit }),
    date: (value, preset = 'medium') => format.dateTime(toDate(value), preset),
    time: (value) => format.dateTime(toDate(value), 'time'),
    dateTime: (value) => format.dateTime(toDate(value), 'dateTime'),
    relativeTime: (value, now) =>
      format.relativeTime(toDate(value), now === undefined ? undefined : toDate(now)),
    list: (items, type = 'and') => format.list(items, type) as string,
  }
}

/** In every page and component. There is no `getFormatters()` on the Pages Router. */
export function useFormatters(): Formatters {
  return bind(useFormatter())
}
```

**No `getFormatters`, and no `next-intl/server` import, on this branch — do not "restore" it on a later pass.** `next-intl/server` (where `getFormatter` lives) is App Router only; this repo's own Pages Router setup states every import comes from `next-intl`, never `next-intl/server`. Calling `getFormatter` from the client stub throws `` `getFormatter` is not supported in Client Components ``, and there is no per-request server context here for it to read from anyway — the Pages Router setup's `request.ts` is a no-op stub that exists only to satisfy `next-intl/plugin`'s load-time assertion, not to serve real request data. `useFormatters()` is a plain hook here, and there is no Server/Client Component split on the Pages Router, so it works the same in every page and every component underneath it.

**The ten-entry `surface` recorded in `.globalize/format-module.json` (step 7) is identical on both routers.** Only the *access form* differs: `useFormatters()` alone on the Pages Router, `useFormatters()` plus `getFormatters()` on the App Router.

### 3. Register the named formats the module calls by name

`date`, `time`, `dateTime` and `list` above pass preset *names* (`'short'`, `'medium'`, `'time'`, `'and'`), which only resolve to real `Intl` options if they are registered. **An unregistered name does not throw — it silently falls back to next-intl's defaults**, so a missing registration is a silent failure, not a build error that would catch it. Add this object to what `getRequestConfig` returns (App Router) or the `formats` prop of `<NextIntlClientProvider>` in `_app.tsx` (Pages Router):

```ts
formats: {
  dateTime: {
    short: { dateStyle: 'short' },
    medium: { dateStyle: 'medium' },
    long: { dateStyle: 'long' },
    time: { timeStyle: 'short' },
    dateTime: { dateStyle: 'medium', timeStyle: 'short' },
  },
  list: { and: { style: 'long', type: 'conjunction' },
          or:  { style: 'long', type: 'disjunction' } },
}
```

next-intl's global `formats` also accepts `number` and `displayName` categories beyond the two the module uses today — extend the same object if this project later needs a named number or display-name preset. Verify the registration by rendering one of each preset once.

**Set `timeZone` and `now`**, and say why: `timeZone` otherwise defaults to the server's time zone, which is a hydration mismatch waiting to happen once the browser's zone disagrees — one that never shows up in development. `now` gives server and client one shared reference instant for `relativeTime`. Both are request-scoped context that a raw `new Intl.DateTimeFormat()` call has no way to see — that request scoping is what makes wrapping `useFormatter()` worth more than calling `Intl` directly, and it is the reason this variant delegates instead of building its own formatters the way the other stacks do.

- **App Router**: set both directly in the same object `getRequestConfig` returns — `timeZone: 'Europe/Berlin'`, `now: new Date()`. `getRequestConfig` runs fresh per request, on the server, before anything renders, so this naturally produces one shared instant.
- **Pages Router**: `_app.tsx`'s `<NextIntlClientProvider>` re-renders on both server and client, so a `now={new Date()}` written directly in its render body is **not** one shared instant — the expression re-evaluates every render, server and client independently, exactly the failure `relativeTime` needs one instant to avoid. Compute `now` once, in `getStaticProps` / `getServerSideProps`, alongside `messages`; serialize it (`now: new Date().toISOString()`) into `props`; then in `_app.tsx` parse it back and pass it through: `<NextIntlClientProvider now={new Date(pageProps.now)} timeZone="...">`. `timeZone` has no such trap — it is a static string, safe to hardcode directly on the provider prop as the existing setup already does.

### 4. Resolve `DEFAULT_CURRENCY`

Grep the codebase for an existing `currency:` option, an `Intl.NumberFormat` / `toLocaleString` call, or a hardcoded symbol before defaulting. Record the hit as `currencySource` (`grep:<file>:<line>`); when nothing is findable leave `'USD'`, keep the `// adjust to this project's currency` comment, and record `currencySource: "default"`.

### 5. No TypeScript `lib` gate here

Lingui's format module needs `Intl.ListFormat` and `Intl.RelativeTimeFormat` types directly, which gates on `tsconfig.json`'s `compilerOptions.lib`. This module never constructs those types itself — every call goes through next-intl's own typed `format.number` / `format.dateTime` / `format.relativeTime` / `format.list`, not through `Intl.ListFormat` or any other `Intl` constructor directly. There is no `lib` requirement to check here; do not add one — it cannot fire.

### 6. Do not overwrite existing project code

If `<i18nDir>/format.ts` already exists as project code, do not overwrite it — add the exports into it, or create `<i18nDir>/i18n-format.ts` instead. Either way record the specifier actually used.

### 7. Write `.globalize/format-module.json`

With `specifier` (the project's alias when `tsconfig.json` declares one in `compilerOptions.paths`, else a relative specifier — check, do not assume `@/`), `path`, the ten-entry `surface`, `defaultCurrency` and `currencySource`. Core step 1 below reads it back as `<<formatModule>>`.

---

## Core step 1: generate the coding rules (`generate_coding_rules` — always runs)

**This is a core Phase 2 step, not an add-on**, and it is **not** gated on a `SKILL.md §1.10` selection. Phase 3's wrap subagents read `.agents/globalize-rules.md` as their authoring contract — macro decision tree, plural rules, skip-list, real catalog paths — so conversion cannot start until this step has produced it. Wiring that file into `CLAUDE.md` and `AGENTS.md` is the second core step below, which also always runs.

The next-intl coding rules are a **generated file**, not a shipped one. `references/languages/js-ts/libraries/next-intl/rules.template.md` covers every configuration next-intl supports — wrapping strings, attributes, plurals, numbers, dates, currencies, locale-aware navigation. This step renders it down to the one configuration this project actually has (only the branches that apply, with the project's real paths, route segment, and locales substituted in) and writes the result to `.agents/globalize-rules.md`.

**Read `references/rules-template-format.md` before rendering.** It is the whole rendering contract — template anatomy, the conditional grammar, the `<<placeholder>>` form, the step order, the header, the fail-closed rule. The steps below only add where *this library's* values come from.

### 1. Locate the template

Read `.globalize/manifest-snapshot.json` → `references.rulesTemplate`.

**If the entry has no `rulesTemplate`**, the installed skill is out of date — both next-intl variants carry one. Do not look for a generic `code.md`; it no longer exists for this library. Treat this exactly like the missing-file case below.

Verify the template exists in the target project.

- **If it exists**: proceed.
- **If it is missing — guided mode**: tell the user the `globalize-guide` skill is not installed in their project and stop this step. The fix is to reinstall it (`npx skills add globalize-now/globalize-skills --skill globalize-guide -a claude-code`). Don't attempt to recreate the file.
- **If it is missing — unguided mode**: do not block. Skip this step and record `⚠ next-intl coding rules not generated — template missing` in the end-of-run summary, with the reinstall command shown above. Treat it as the fail-closed case in step 6: a core step did not complete, so Phase 3 has no rules file.

### 2. Resolve the template's `conditions`

Resolve every key listed in the template frontmatter's `conditions` and write them to `.globalize/rules-values.json`. Comparison values are string literals.

| Condition | Where to read it |
|---|---|
| `router` | `.globalize/manifest-snapshot.json` → `match.router`: `"app"` or `"pages"`. |
| `localeNavigation` | Composite of router and routing strategy, because `createNavigation` is an App Router API — the Pages Router has no equivalent and uses Next's native i18n routing with `useRouter()` from `next/router`. `"create-navigation"` only when **both** hold: `match.router === "app"`, **and** locale-prefixed routes were scaffolded (`routing.ts`'s `localePrefix` is `'always'` or `'as-needed'` and a locale segment exists under `app/`). `localePrefix: 'never'` is **not** prefix routing — no segment, no moved files. Everything else is `"none"`. Cross-check `## Routing strategy` in `.globalize/decisions.md`; the file on disk wins if they disagree. |
| `catalogFormat` | `.globalize/decisions.md`, confirmed on disk by whether the `po-format-setup` optional actually ran: `"po"` when the messages directory holds `.po` files and `next.config.*` passes `experimental.messages` to `createNextIntlPlugin`, otherwise `"json"`. |
| `paramsShape` | Composite of router and Next major, because route `params` only exist on the App Router and only became a Promise in Next 15. Resolve the installed `next` version from the lockfile when the `package.json` range is loose. `"promise"` — App Router on Next 15+. `"sync"` — App Router on Next 13–14. `"none"` — Pages Router; there is no `app/` directory, so neither `params` block renders. Same async-vs-sync split the setup reference gates on at `next-intl.setup.md:16-20`. |

### 3. Eliminate branches, then resolve the surviving `values`

Delete every false branch **and every marker line** (`<!-- if:`, `<!-- else -->`, `<!-- /if -->` all disappear, kept branch or not). Only then resolve the `values` still referenced in what survived — from the files **on disk**, what core setup actually wrote, not from `decisions.md`, which records what was asked for rather than what landed — appending them to the same `.globalize/rules-values.json`.

**The order is load-bearing.** A value that lives inside a false branch has no value to resolve — a project on `localePrefix: 'never'` has no `[locale]` segment and a Pages Router project has no `i18n/navigation.ts`. Those placeholders sit inside branches that are already gone. Resolving up front would demand values that don't exist and trip step 6 on a perfectly healthy project.

| Value | Where to read it |
|---|---|
| `i18nRequestPath` | The **actual on-disk path** setup wrote — `src/i18n/request.ts` on a project with a `src/` root, `i18n/request.ts` otherwise. Glob for it; do not assume. The argument passed to `createNextIntlPlugin(...)` in `next.config.*` confirms it. |
| `i18nNavigationPath` | Same rule for `navigation.ts` (`src/i18n/navigation.ts` vs `i18n/navigation.ts`). Glob for it. |
| `importPrefix` | `@/` when `tsconfig.json`'s `compilerOptions.paths` declares the `@/*` alias; otherwise the relative form the setup emitted (e.g. `../../`). This mirrors the pre-flight gate at `frameworks/nextjs/app-router/next-intl.setup.md:9-14`, which explicitly refuses to add the alias when it is absent — so never assume `@/`. |
| `localeSegment` | The **actual** dynamic segment directory under `app/` (or `src/app/`) — `[locale]`, `[lang]`, or whatever the project uses. Glob for it, brackets included. |
| `catalogPath` | The message directory in the dynamic import inside `i18n/request.ts` — e.g. `messages/` from `` (await import(`../../messages/${locale}.json`)).default ``. Normalize to a project-root-relative directory. |
| `sourceLocale` | `defaultLocale` in `routing.ts`. |
| `targetLocales` | `locales` in `routing.ts` minus `defaultLocale`, comma-separated: `de, fr, ja`. |
| `formatModule` | `.globalize/format-module.json` → `.specifier`, written by Core step 0's `generate_format_helpers`. That step always runs before this one, so the file already exists by the time this table is read. |

### 4. Render

Substitute every surviving `<<name>>` with its resolved value, strip the frontmatter, and **copy everything retained verbatim** — do not rewrite, summarize, reflow, re-order, or improve the prose. Prepend the two-line generated header:

```
<!-- globalize-rules v<templateVersion> | template=next-intl | variant=<manifest-snapshot variant> | generated by globalize-guide -->
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

- **Guided mode** — ask the user for the specific value. Every one of these is a one-line answer ("Which directory under `app/` holds the locale segment?", "Where do your message catalogs live?"), and getting one beats shipping either wrong rules or none. Resolve, re-render, re-check. Only if the user can't answer, or the self-check still fails, stop this step and say which key or check failed.
- **Unguided mode** — don't block the run. Skip this step and record `⚠ next-intl coding rules not generated (localeSegment unresolved) — no rules file installed` in the end-of-run summary.

Either way a **core step did not complete**, so surface it instead of letting the run drift into conversion: report `generate_coding_rules` as failed, leave it unchecked in `plan.md`, and tell the orchestrator that Phase 3 has no `.agents/globalize-rules.md` to wrap against. The user then either supplies the missing value and re-runs this step, or converts knowing the wrap subagents are working without this project's rules.

There is no generic-rules fallback: `next-intl/code.md` was deleted when this library moved to a template, so the template is the only source of truth for next-intl rules. Installing nothing is recoverable — re-run this step. Installing rules that name the wrong request path or route segment is not; the agent follows them into a bug on every future edit and nothing signals it.

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
- **If it exists**, append `@.agents/globalize-rules.md` at the end of the file on its own line ("I'll append `@.agents/globalize-rules.md` to your CLAUDE.md so the next-intl coding rules auto-load every session"). Do not remove or reorder existing content.
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

Verify: in a fresh session, ask Claude "how should I wrap a plural string in this project?" — the answer should reference ICU `{count, plural, …}` syntax and `t('key', { count })` patterns from the generated file.

---

<!-- Add-on numbering starts at 2 on purpose: what used to be Add-on 1 (importing the coding
     rules) is now the second core step above, and the remaining numbers are left unchanged so
     cross-references elsewhere in this file stay valid. -->

## Add-on 2: ESLint plugin

**No official next-intl ESLint plugin exists.** The maintainers track the idea as an open feature request: <https://github.com/amannn/next-intl/issues/1036>. Two community plugins exist, neither endorsed by the next-intl team:

| Plugin | npm | Scope |
|---|---|---|
| `eslint-plugin-next-intl` | [`eslint-plugin-next-intl`](https://www.npmjs.com/package/eslint-plugin-next-intl) | next-intl-only; rules around static keys, missing keys, unused keys |
| `@ts-intl/eslint-plugin-ts-intl` | [`@ts-intl/eslint-plugin-ts-intl`](https://www.npmjs.com/package/@ts-intl/eslint-plugin-ts-intl) | broader: also covers `i18next` and custom `t()` shapes |

Neither extracts strings (next-intl has no extract step — see Add-on 3). They lint **call-site usage**: that translation keys are static literals, that variables passed match the keys' ICU placeholders, that hardcoded strings inside JSX are flagged for review.

**Default recommendation: skip.** Surface the situation to the user before doing anything:

> "next-intl doesn't ship an official ESLint plugin. Two community plugins exist (`eslint-plugin-next-intl` and `@ts-intl/eslint-plugin-ts-intl`); neither is endorsed by the next-intl maintainers. The passive coding rules generated by the core step cover most of what these plugins do at edit time. Want me to install one anyway? (default: skip)"

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
