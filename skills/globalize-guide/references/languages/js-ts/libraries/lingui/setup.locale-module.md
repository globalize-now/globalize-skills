# LinguiJS: the shared locale module

This is the **first** setup reference for every React/Lingui variant — of three on the web variants, of two on the browser-extension variants. Read it before the framework-specific file — `lingui.config.{ts,js}` imports from the module this file creates, so it must exist by the time the framework file writes the config.

Read them in the order `references.setup` lists them:

1. **this file** — `<i18nDir>/locales.ts`
2. the framework file — build config, `lingui.config.*`, provider and root-document wiring, routes, middleware, catalogs, `.gitignore`
3. `setup.navigation.md` — `<i18nDir>/navigation.ts` and the language switcher

**On the `webext-*-lingui` variants there is no step 3.** A browser extension has no URLs, so
`setup.navigation.md` is deliberately absent from `references.setup` — nothing there applies.
Its one non-routing export, `LanguageSwitcher.tsx`, is owned by the webext framework file
instead, because an extension's switcher writes to `browser.storage.sync` rather than
navigating. `<i18nDir>/navigation.ts` is never created on those variants. Everything in *this*
file still applies unchanged: `resolveLocale` takes an untrusted string and normalizes it, so
it works just as well on a value read out of `browser.storage` as on one read out of a URL.

Apply the usual guided / unguided rules: guided mode describes the change and waits for confirmation, unguided mode applies it directly. Every section is independently re-runnable — if it has already been applied, detect that and skip without prompting.

---

## Ownership

**The two shared Lingui references own every file under `<i18nDir>/`, plus the language switcher component. The framework reference owns everything else.**

A framework reference must never *define* a module listed in the inventory below. Where it needs one, it shows an import and a call site. If a framework reference and a shared reference disagree about a file under `<i18nDir>/`, **the shared reference wins** — do not merge the two shapes, and report the disagreement in the progress file so the skill can be fixed.

### Module inventory

| Path | Owner | Exports |
|---|---|---|
| `<i18nDir>/locales.ts` | this file | `sourceLocale`, `locales`, `Locale`, `resolveLocale`, `getDirection`, `localeDisplayName`, `DEFAULT_CURRENCY`, `DATE_PRESETS`, `DatePreset`, `CURRENCY`, `DATE_SHORT`, `DATE_MEDIUM`, `DATE_TIME` |
| `<i18nDir>/format.ts` | this file | `formatLocale`, `createFormatters`, `useFormatters`, `getFormatters`, `Formatters`, `DateInput` |
| `<i18nDir>/navigation.ts` | `setup.navigation.md` | `stripLocalePrefix`, `localePath`, `switchLocalePath`, `useLocale`, `useLocalePath` — **not created on the `webext-*` variants** |
| `<componentsDir>/LanguageSwitcher.tsx` | `setup.navigation.md`, **or the framework file on the `webext-*` variants** | the switcher |

Everything else under `<i18nDir>/` — `locale.server.ts`, `index.ts`, `appRouterI18n.ts`, the catalog loader — belongs to the framework file.

---

## 1. Resolve `<i18nDir>` and `<componentsDir>`

Read `.globalize/manifest-snapshot.json` → `variant` and look it up here. Use these values for every path in **both** shared references.

| `variant` | `<i18nDir>` | `<componentsDir>` |
|---|---|---|
| `nextjs-app-router-lingui` | `src/i18n/` | `src/app/` |
| `vite-swc-lingui`, `vite-babel-lingui` | `src/i18n/` | `src/components/` |
| `tanstack-start-babel-lingui`, `tanstack-start-swc-lingui` | `src/i18n/` | `src/components/` |
| `remix-babel-lingui`, `remix-swc-lingui` | `app/i18n/` | `app/components/` |
| `react-router-framework-babel-lingui`, `react-router-framework-swc-lingui` | `app/i18n/` | `app/components/` |
| `webext-babel-lingui`, `webext-swc-lingui` | `src/i18n/` | `src/components/` |

**Source-root override.** If `.globalize/detection.json` reports no `src/` directory on a `src/`-rowed variant, substitute the detected source root — `i18n/` and `components/` at the repo root. Next.js projects without `src/` are common; this is the same rule the framework file already applies to catalog paths.

If `<componentsDir>` does not exist and the project has no components directory at all, put the switcher next to the root layout instead. Do not create a `components/` convention a project has not adopted.

## 2. Migrate an earlier flat layout (Vite variants only)

Earlier versions of this skill emitted the Vite setup as a flat `src/i18n.ts` plus a `src/localePath.ts` at the source root. Check for both **before** creating `<i18nDir>/`.

- **Neither exists** — nothing to do, continue to step 3.
- **`src/i18n.ts` exists and matches an earlier version of this skill's output** (locale constants, `getDirection`, `getLocaleFromPath` / `detectLocale`, `activateLocale`, `loadCatalog`, and nothing project-specific): move its contents into `<i18nDir>/` — locale constants and `getDirection` into `locales.ts` per step 3, the catalog and activation helpers into `<i18nDir>/index.ts` — and **delete the flat file in the same step**. Update every importer from `'./i18n'` / `'../i18n'` to the new specifier.
- **`src/i18n.ts` carries project-specific code** you cannot confidently classify: write `status: "needs_decision"` to the progress file with

  ```json
  { "step": "flat_i18n_module_migration",
    "question": "This project has a flat src/i18n.ts from an earlier setup. Move it into src/i18n/ (recommended) or keep the flat layout?",
    "options": ["migrate", "keep_flat"] }
  ```

  and stop. Do not guess.
- **`src/localePath.ts` exists**: same rule — it is superseded by `<i18nDir>/navigation.ts` in `setup.navigation.md`. Delete it there, not here.

**Never leave both `src/i18n.ts` and `src/i18n/` on disk.** `src/i18n.ts` shadows `src/i18n/index.ts` in Vite's and Node's resolution order, so every existing import keeps resolving to the stale flat module while the new helpers sit on disk as dead code. The build passes, `tsc` passes, and the app is quietly wrong.

## 3. Create `<i18nDir>/locales.ts`

This module is **always** created, on every variant and under every routing strategy. It is pure — no React, no framework imports, no `@lingui/core` — so it is safe to import from a config file, a loader, a Server Component, middleware, an Edge runtime, and a test alike.

```ts
// <i18nDir>/locales.ts
export const sourceLocale = 'en'
export const locales = ['en'] as const
export type Locale = (typeof locales)[number]

/** Normalize an untrusted locale string: exact match, then regional fallback (es-MX → es), then source. */
export function resolveLocale(raw: string | undefined | null): Locale {
  if (!raw) return sourceLocale
  if ((locales as readonly string[]).includes(raw)) return raw as Locale
  const base = raw.split('-')[0]
  if ((locales as readonly string[]).includes(base)) return base as Locale
  return sourceLocale
}

const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi'])

/** Text direction for `<html dir>` and any direction-sensitive component. */
export function getDirection(locale: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale.split('-')[0]) ? 'rtl' : 'ltr'
}

const displayNames = new Map<string, Intl.DisplayNames>()

/**
 * A language's name. Defaults to its autonym — "Deutsch", not "German" — which is
 * what a language picker should show. Pass `displayIn` to name it in another locale.
 */
export function localeDisplayName(locale: string, displayIn: string = locale): string {
  let dn = displayNames.get(displayIn)
  if (!dn) {
    dn = new Intl.DisplayNames([displayIn], { type: 'language' })
    displayNames.set(displayIn, dn)
  }
  return dn.of(locale) ?? locale
}

/** The project's currency. Formatting follows the locale; the currency follows the data. */
export const DEFAULT_CURRENCY = 'USD'   // adjust to this project's currency

export type DatePreset = 'short' | 'medium' | 'long'

/** Date presets, consumed by format.ts. Trim to what this codebase actually formats. */
export const DATE_PRESETS: Record<DatePreset, Intl.DateTimeFormatOptions> = {
  short: { dateStyle: 'short' },
  medium: { dateStyle: 'medium' },
  long: { dateStyle: 'long' },
}

/** @deprecated Kept so an earlier setup's call sites keep compiling. Use format.ts instead. */
export const CURRENCY: Intl.NumberFormatOptions = { style: 'currency', currency: DEFAULT_CURRENCY }
/** @deprecated Use `useFormatters().date(v, 'short')`. */
export const DATE_SHORT: Intl.DateTimeFormatOptions = DATE_PRESETS.short
/** @deprecated Use `useFormatters().date(v)`. */
export const DATE_MEDIUM: Intl.DateTimeFormatOptions = DATE_PRESETS.medium
/** @deprecated Use `useFormatters().dateTime(v)`. */
export const DATE_TIME: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }
```

Substitute the real locale list from `.globalize/decisions.md` — `export const locales = ['en', 'fr', 'de'] as const` — and the real source locale. `sourceLocale` must be a member of `locales`.

**Set `DEFAULT_CURRENCY` to the project's currency.** Grep the codebase for an existing `currency:` option, a `toLocaleString`/`Intl.NumberFormat` call, or a hardcoded symbol before defaulting. If nothing is findable, leave `'USD'` and append `// adjust to this project's currency` to the line — a wrong currency that looks deliberate is worse than one that flags itself.

Add or remove date presets to match what the codebase actually formats. Presets nothing uses are dead exports; a format used in three places and typed out three times is the duplication these exist to remove.

### Why these live here rather than at each call site

- `getDirection` was previously re-declared in every framework file, often unexported and therefore unusable from a language switcher or a `dir={}` attribute. One exported definition ends that.
- `localeDisplayName` caches its `Intl.DisplayNames` instances in a module-scope `Map`. The map holds no request state, so it is safe under SSR and across concurrent requests on every variant.
- The presets are now consumed by `format.ts`, not by call sites directly — see §4. Its module-scope `memo` caches `Intl` instances keyed by locale and holds no request state, so it is safe under SSR. The rule it does not break is "never cache the *locale* at module scope," which would pin one request's locale onto every later one.

## 4. Create `<i18nDir>/format.ts` (`generate_format_helpers`)

This module is **always** created, on every variant and under every routing strategy — like `locales.ts`, and for the same reason: Phase 3 rewrites hardcoded formatting toward it.

```ts
// <i18nDir>/format.ts
import { useMemo } from 'react'
import { useLingui } from '@lingui/react'
import { DEFAULT_CURRENCY, DATE_PRESETS, type DatePreset } from './locales'

export type DateInput = Date | number | string

export type Formatters = {
  money(amount: number, currency?: string): string
  number(value: number, opts?: Intl.NumberFormatOptions): string
  percent(value: number): string
  compact(value: number): string
  unit(value: number, unit: string): string
  date(value: DateInput, preset?: DatePreset): string
  time(value: DateInput): string
  dateTime(value: DateInput): string
  relativeTime(value: DateInput, now?: DateInput): string
  list(items: string[], type?: 'and' | 'or'): string
}

/**
 * THE SEAM. Formatting follows the UI locale today. To give this project a
 * separate regional preference — an English UI that still renders 1.234,56 € —
 * change this one function. Every formatter reads its locale from here.
 */
export function formatLocale(uiLocale: string): string {
  return uiLocale
}

/** Intl instances keyed by locale + kind. Holds no request state, so it is safe under SSR. */
const memo = new Map<string, unknown>()
function cached<T>(key: string, make: () => T): T {
  let f = memo.get(key) as T | undefined
  if (f === undefined) memo.set(key, (f = make()))
  return f
}

const toDate = (v: DateInput): Date => (v instanceof Date ? v : new Date(v))

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['second', 1000],
  ['minute', 60_000],
  ['hour', 3_600_000],
  ['day', 86_400_000],
  ['week', 604_800_000],
  ['month', 2_629_746_000],
  ['year', 31_556_952_000],
]

/** Largest unit whose magnitude is at least 1; falls back to seconds. */
export function pickRelativeUnit(deltaMs: number): [Intl.RelativeTimeFormatUnit, number] {
  const abs = Math.abs(deltaMs)
  for (let i = UNITS.length - 1; i >= 0; i--) {
    const [unit, ms] = UNITS[i]
    if (abs >= ms || i === 0) return [unit, Math.round(deltaMs / ms)]
  }
  return ['second', 0]
}

export function createFormatters(uiLocale: string): Formatters {
  const locale = formatLocale(uiLocale)
  const nf = (key: string, opts: Intl.NumberFormatOptions) =>
    cached(`n:${locale}:${key}`, () => new Intl.NumberFormat(locale, opts))
  const df = (key: string, opts: Intl.DateTimeFormatOptions) =>
    cached(`d:${locale}:${key}`, () => new Intl.DateTimeFormat(locale, opts))

  return {
    money: (amount, currency = DEFAULT_CURRENCY) =>
      nf(`cur:${currency}`, { style: 'currency', currency }).format(amount),
    number: (value, opts) =>
      opts
        ? new Intl.NumberFormat(locale, opts).format(value)
        : nf('dec', { style: 'decimal' }).format(value),
    percent: (value) => nf('pct', { style: 'percent' }).format(value),
    compact: (value) => nf('cmp', { notation: 'compact' }).format(value),
    unit: (value, unit) => nf(`unit:${unit}`, { style: 'unit', unit }).format(value),
    date: (value, preset = 'medium') =>
      df(`p:${preset}`, DATE_PRESETS[preset]).format(toDate(value)),
    time: (value) => df('t', { timeStyle: 'short' }).format(toDate(value)),
    dateTime: (value) =>
      df('dt', { dateStyle: 'medium', timeStyle: 'short' }).format(toDate(value)),
    relativeTime: (value, now) => {
      const from = now === undefined ? Date.now() : toDate(now).getTime()
      const [unit, amount] = pickRelativeUnit(toDate(value).getTime() - from)
      return cached(`r:${locale}`, () =>
        new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }),
      ).format(amount, unit)
    },
    list: (items, type = 'and') =>
      cached(`l:${locale}:${type}`, () =>
        new Intl.ListFormat(locale, {
          style: 'long',
          type: type === 'or' ? 'disjunction' : 'conjunction',
        }),
      ).format(items),
  }
}

/** In components. Reads the locale from context, so it re-renders on locale change. */
export function useFormatters(): Formatters {
  const { i18n } = useLingui()
  return useMemo(() => createFormatters(i18n.locale), [i18n.locale])
}

/** In loaders, server code, route handlers and tests — anywhere there is no React context. */
export const getFormatters = createFormatters
```

**Why the locale comes from `useLingui()` and not from the module-scope `i18n` singleton.** Reading the singleton at module scope pins one request's locale onto every later request on every server-rendering variant. `useLingui()` reads it from `<I18nProvider>` context, which is per-render. This is the point of the hook; do not "simplify" it to a module-scope read.

**Resolve `DEFAULT_CURRENCY` before writing `locales.ts`**, by grepping for an existing `currency:` option, an `Intl.NumberFormat` / `toLocaleString` call, or a hardcoded symbol. Record the hit as `currencySource` (`grep:<file>:<line>`); when nothing is findable leave `'USD'`, keep the `// adjust to this project's currency` comment, and record `currencySource: "default"`.

**The TypeScript `lib` gate.** `Intl.ListFormat` needs `es2021.intl`; `Intl.RelativeTimeFormat`, `notation: 'compact'` and `style: 'unit'` need `es2020.intl`. Read `tsconfig.json` `compilerOptions.lib` (falling back to what `target` implies). If it resolves below `ES2021`, do **not** silently emit a module that fails `tsc` — write `status: "needs_decision"` with:

```json
{ "step": "format_module_ts_lib",
  "question": "format.ts needs Intl.ListFormat/RelativeTimeFormat types, which require tsconfig lib ES2021 or later (this project resolves to <current>). Raise lib to ES2021, or omit list() and relativeTime()?",
  "options": ["raise_lib", "omit_two"] }
```

and stop. On `omit_two` the surface still has ten entries in `format-module.json`; the two omitted ones are emitted as `throw new Error('list() requires tsconfig lib ES2021')` stubs so the contract holds and the failure is loud rather than silent.

**If `<i18nDir>/format.ts` already exists as project code, do not overwrite it** — add the exports into it, or create `<i18nDir>/i18n-format.ts` instead. Either way record the specifier actually used.

**Write `.globalize/format-module.json`** with `specifier` (the project's alias when `tsconfig.json` declares one in `compilerOptions.paths`, else a relative specifier — check, do not assume `@/`), `path`, the ten-entry `surface`, `defaultCurrency` and `currencySource`. `generate_coding_rules` reads it back as `<<formatModule>>`.

## 5. Point the framework file at it

The framework reference imports from this module rather than declaring its own copies. Expect these, and fix them if the framework file still shows a local definition:

| Framework file needs | Import |
|---|---|
| `lingui.config.ts` locale list | `import { sourceLocale, locales } from './<i18nDir>/locales'` (relative to the repo root) |
| `<html dir>` in the root document | `import { getDirection } from '<specifier>/locales'` |
| Locale validation in a loader, middleware, or route param | `import { resolveLocale } from '<specifier>/locales'` |

Use the project's path alias (`~/`, `@/`) when `tsconfig.json` declares one in `compilerOptions.paths`; otherwise use a relative specifier. Do not assume `@/` — check.

**On React Router v7 and Remix**, `getDirection` previously lived in `locale.server.ts`, which Vite strips from the client bundle. Moving it here makes it reachable from client components for the first time; leave `localeCookie`, `readLocaleFromRequest`, and `pickFromAcceptLanguage` in `locale.server.ts` where they belong — they touch `Request` and cookies.

## 6. Self-check

Before handing off to the framework file:

```bash
# Exactly one definition of the RTL set, and it is in the locale module.
grep -rn "RTL_LOCALES" <source root> | grep -v "/i18n/locales"     # → no output
# Exactly one Intl.DisplayNames construction, and it is in the locale module.
grep -rn "new Intl.DisplayNames" <source root> | grep -v "/i18n/locales"   # → no output
# Vite variants only: the flat module is gone.
test -f src/i18n.ts && echo "FAIL: flat src/i18n.ts still present alongside src/i18n/"
# Exactly one Intl construction site outside the format module.
grep -rn "new Intl\." <source root> | grep -v "/i18n/format" | grep -v "/i18n/locales"   # → no output
# The contract artifact exists and lists ten functions.
jq -e '.surface | length == 10' .globalize/format-module.json
```

Then continue with the framework setup reference.
