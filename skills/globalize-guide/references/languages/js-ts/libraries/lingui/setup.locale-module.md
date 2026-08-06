# LinguiJS: the shared locale module

This is the **first** of three setup references for every React/Lingui variant. Read it before the framework-specific file — `lingui.config.{ts,js}` imports from the module this file creates, so it must exist by the time the framework file writes the config.

Read the three in the order `references.setup` lists them:

1. **this file** — `<i18nDir>/locales.ts`
2. the framework file — build config, `lingui.config.*`, provider and root-document wiring, routes, middleware, catalogs, `.gitignore`
3. `setup.navigation.md` — `<i18nDir>/navigation.ts` and the language switcher

Apply the usual guided / unguided rules: guided mode describes the change and waits for confirmation, unguided mode applies it directly. Every section is independently re-runnable — if it has already been applied, detect that and skip without prompting.

---

## Ownership

**The two shared Lingui references own every file under `<i18nDir>/`, plus the language switcher component. The framework reference owns everything else.**

A framework reference must never *define* a module listed in the inventory below. Where it needs one, it shows an import and a call site. If a framework reference and a shared reference disagree about a file under `<i18nDir>/`, **the shared reference wins** — do not merge the two shapes, and report the disagreement in the progress file so the skill can be fixed.

### Module inventory

| Path | Owner | Exports |
|---|---|---|
| `<i18nDir>/locales.ts` | this file | `sourceLocale`, `locales`, `Locale`, `resolveLocale`, `getDirection`, `localeDisplayName`, `CURRENCY`, `DATE_SHORT`, `DATE_MEDIUM`, `DATE_TIME` |
| `<i18nDir>/navigation.ts` | `setup.navigation.md` | `stripLocalePrefix`, `localePath`, `switchLocalePath`, `useLocale`, `useLocalePath` |
| `<componentsDir>/LanguageSwitcher.tsx` | `setup.navigation.md` | the switcher |

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

/** Shared format presets. Plain option objects — pass them to i18n.number() / i18n.date(). */
export const CURRENCY: Intl.NumberFormatOptions = { style: 'currency', currency: 'USD' }
export const DATE_SHORT: Intl.DateTimeFormatOptions = { dateStyle: 'short' }
export const DATE_MEDIUM: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
export const DATE_TIME: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }
```

Substitute the real locale list from `.globalize/decisions.md` — `export const locales = ['en', 'fr', 'de'] as const` — and the real source locale. `sourceLocale` must be a member of `locales`.

**Set `CURRENCY` to the project's currency.** Grep the codebase for an existing `currency:` option, a `toLocaleString`/`Intl.NumberFormat` call, or a hardcoded symbol before defaulting. If nothing is findable, leave `'USD'` and append `// adjust to this project's currency` to the line — a wrong currency that looks deliberate is worse than one that flags itself.

Add or remove date presets to match what the codebase actually formats. Presets nothing uses are dead exports; a format used in three places and typed out three times is the duplication these exist to remove.

### Why these live here rather than at each call site

- `getDirection` was previously re-declared in every framework file, often unexported and therefore unusable from a language switcher or a `dir={}` attribute. One exported definition ends that.
- `localeDisplayName` caches its `Intl.DisplayNames` instances in a module-scope `Map`. The map holds no request state, so it is safe under SSR and across concurrent requests on every variant.
- The format presets are **option objects, not formatting functions.** Lingui's `i18n.number()` / `i18n.date()` already bind the active locale and cache their `Intl` instances; a wrapper on top would have nowhere to get `i18n` from except the module-scope `@lingui/core` singleton, and reading that at module scope is a request-bleed bug on every server-rendering variant. The duplication worth removing is the options object — the currency code and date styles are project decisions that must not drift between call sites.

## 4. Point the framework file at it

The framework reference imports from this module rather than declaring its own copies. Expect these, and fix them if the framework file still shows a local definition:

| Framework file needs | Import |
|---|---|
| `lingui.config.ts` locale list | `import { sourceLocale, locales } from './<i18nDir>/locales'` (relative to the repo root) |
| `<html dir>` in the root document | `import { getDirection } from '<specifier>/locales'` |
| Locale validation in a loader, middleware, or route param | `import { resolveLocale } from '<specifier>/locales'` |

Use the project's path alias (`~/`, `@/`) when `tsconfig.json` declares one in `compilerOptions.paths`; otherwise use a relative specifier. Do not assume `@/` — check.

**On React Router v7 and Remix**, `getDirection` previously lived in `locale.server.ts`, which Vite strips from the client bundle. Moving it here makes it reachable from client components for the first time; leave `localeCookie`, `readLocaleFromRequest`, and `pickFromAcceptLanguage` in `locale.server.ts` where they belong — they touch `Request` and cookies.

## 5. Self-check

Before handing off to the framework file:

```bash
# Exactly one definition of the RTL set, and it is in the locale module.
grep -rn "RTL_LOCALES" <source root> | grep -v "/i18n/locales"     # → no output
# Exactly one Intl.DisplayNames construction, and it is in the locale module.
grep -rn "new Intl.DisplayNames" <source root> | grep -v "/i18n/locales"   # → no output
# Vite variants only: the flat module is gone.
test -f src/i18n.ts && echo "FAIL: flat src/i18n.ts still present alongside src/i18n/"
```

Then continue with the framework setup reference.
