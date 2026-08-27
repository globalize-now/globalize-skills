# vue-i18n Setup

`vue-i18n` v11 (Intlify) is the dominant i18n library for Vue 3. This setup phase configures it with the Composition API (`createI18n({ legacy: false })`, `useI18n()` in `<script setup>`) and enables ICU MessageFormat — matching the rest of this repo's message-format stance and avoiding vue-i18n's pipe-plural syntax, which bakes English-style plurals into source strings.

Unlike compile-time i18n frameworks, vue-i18n is a runtime library: there is no macro transform, and no build step is strictly required. The `@intlify/unplugin-vue-i18n` plugin is installed to enable `<i18n>` custom blocks inside SFCs and to support `@intlify/eslint-plugin-vue-i18n` linting. It is configured **without** the `include` option — pre-compiling catalogs would bypass the custom ICU `messageCompiler` (see Step 4) — so locale JSON is loaded by Vite's built-in JSON importer as plain objects and processed by `intl-messageformat` at lookup time.

Follow these steps in order. Each builds on the last.

## Out of Scope

This setup phase covers **Vue 3** projects using the **Composition API** on **Vite** (SPA) or **Nuxt 3/4** (SSR). It does not cover:

- **Vue 2.x** — separate ecosystem (`vue-i18n@8`, different plugin API, Options API assumed). Recommend upgrading to Vue 3 first; point at the official [Vue 3 migration guide](https://v3-migration.vuejs.org/). **Hard stop.**
- **Vue 3 projects on the Options API only** — vue-i18n's Legacy API is deprecated and scheduled for removal in v12. This setup phase emits Composition API setup (`createI18n({ legacy: false })`, `useI18n()` in `<script setup>`). If the codebase is entirely `export default { }` Options-style, the setup still works but the user must adopt `<script setup>` for new strings. Warn, don't block.
- **Vue CLI / webpack-based projects** — effectively EOL. Recommend migrating to Vite first. **Hard stop.**
- **VitePress** — has native `locales` config and doesn't use vue-i18n. **Hard stop**, point at the [VitePress i18n docs](https://vitepress.dev/guide/i18n).
- **Quasar** — partially covered (experimental reference file). Warn the user v1 treats this as experimental; proceed only on explicit confirmation.
- **Non-ICU message format** — this setup phase configures ICU MessageFormat via a custom `messageCompiler`. Projects that need vue-i18n's native pipe-plural / custom-format syntax for existing content should not run this setup.
- **Converting existing hardcoded strings** to `t('...')` across the codebase — handled by the convert phase. This setup phase only scaffolds; it does not rewrite your views. Run the convert phase after setup is complete.
- **Other Vue i18n libraries** (`i18next-vue`, `@tolgee/vue`, `fluent-vue`, Lingui-for-Vue, Paraglide) — this setup phase installs `vue-i18n` exclusively. If one of these is already installed, **hard stop** (same pattern as Lingui's "existing i18n library" check). Paraglide (`@inlang/paraglide-js`) is a supported library for **SvelteKit** projects via the globalize-guide skill, but inside a **Vue** project it is a competing library — the hard stop still applies here.

---

### Step Risk Classification

| Step | Risk | Notes |
|------|------|-------|
| 1. Detect | Read-only | No changes to the project |
| 2. Install packages | Additive | New dependencies only |
| 3. Configure i18n instance + format helpers | Additive | New `src/i18n/index.ts` (Vite/Quasar) or `i18n.config.ts` (Nuxt); new `<i18nDir>/format.ts`; registers `numberFormats`/`datetimeFormats` for every locale |
| 4. Build tool / module | **Modifies existing file** | Changes `vite.config.*`, `nuxt.config.*`, or `quasar.config.*` |
| 5. Provider | **Modifies existing file** | `main.ts` (Vite), boot file (Quasar); Nuxt module handles it |
| 6. Language Switcher | **Modifies existing file** | New component file + wired into layout / header |
| 7. Scaffold | Additive | New `locales/{locale}.json` files |
| 8. Generate + wire coding rules | Additive (+ edits `CLAUDE.md` / `AGENTS.md`) | Writes `.agents/globalize-rules.md` and points `CLAUDE.md` and `AGENTS.md` at it — **always runs**, Phase 3 wraps against it |
| 9. CI/CD | **Modifies existing file** | Adds catalog-freshness check — **optional, ask first** |
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
- "MUST wait for the user to choose" lines in this file and the reference files are **overridden** by the unguided-defaults table below when a default is listed. For choices not covered by that table, still collect input before proceeding.
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

#### Unguided defaults

In unguided mode, apply the defaults below without prompting. Log each default choice in the final summary so the user can revisit any of them:

| Choice | Unguided default | Rationale |
|--------|------------------|-----------|
| **Source locale** | Existing `<html lang="...">` if found; otherwise `en` | Matches what the app already ships. |
| **Target locale** | User-specified if given in the initial prompt; otherwise `es` | One additional locale is enough to validate the pipeline. |
| **Catalog format** | JSON | Zero-config — no `poLoader` plugin, no Nuxt ICU pre-compile surprises. PO remains opt-in if the user explicitly picks it. |
| **Vite-SPA locale routing strategy** (`references/languages/js-ts/frameworks/vite/vue/vue-i18n.setup.md`, when `vue-router` is in deps) | "Unprefixed default locale" — source-locale URLs stay bare, target locales get a prefix (`/es/about`) | Preserves existing URLs. |
| **Nuxt routing strategy** (`references/languages/js-ts/frameworks/nuxt/vue-i18n.setup.md`, when Nuxt is detected) | `prefix_except_default` | Matches both `@nuxtjs/i18n`'s own default and the Vite-SPA default for consistency. |
| **Default currency** (Format helpers `numberFormats` seeding) | Inferred from source locale (`en-US` → `USD`, `en-GB` → `GBP`, `de-DE` → `EUR`, `fr-FR` → `EUR`, `es-ES` → `EUR`, `ja-JP` → `JPY`) with `USD` fallback | Seed a working currency format so `n(amount, 'currency')` works out of the box. This is the **one** currency code used for every locale — see "Format helpers" below for why. |
| **`main.ts` / provider wrapping** | Apply silently | Consent gate suspended in unguided mode per the rule above. |
| **Optional steps** (CI/CD, test wrapper) | Included | Unless the user named them to skip at mode-selection time. |

If the user named a different target locale, a different catalog format, or a different routing strategy at mode-selection time (free-form in the "Unguided" reply), honor that over the default.

---

## Step 1: Detect the Project

Read the project's `package.json`, build config (`vite.config.*`, `nuxt.config.*`, `quasar.config.*`), and any `.vitepress/` directory to determine the project shape. **Record the actual extension of whichever config file exists** (`.ts`, `.mts`, `.js`, `.mjs`, `.cjs`) — later steps (Step 4, Step 5) must edit that exact file, not assume `.ts`.

| Signal | How to detect |
|--------|--------------|
| **Framework** | `nuxt` in deps → Nuxt. `vitepress` in devDeps (and no `nuxt`) → VitePress. `quasar` in deps → Quasar. `vite` in devDeps + `vue` in deps (and none of the above) → Vite SPA. |
| **Vue version** | Parse the `vue` semver major from `package.json` (e.g. `"^3.4.0"` → 3, `"^2.7.0"` → 2). Vue 3 is required. |
| **Nuxt version** | Parse the `nuxt` semver major if present (e.g. `"^3.12.0"` → 3, `"^4.0.0"` → 4). Used to pick the locale file convention. |
| **API style** | Run a quick grep against `src/**/*.vue` (or `app/**/*.vue` / `pages/**/*.vue` for Nuxt) for `<script setup>` vs `export default { }` Options-style. Hint-only; skill emits Composition API output regardless. |
| **TypeScript** | `typescript` in devDeps or `tsconfig.json` exists. |
| **Package manager** | `package-lock.json` → npm. `yarn.lock` → yarn. `pnpm-lock.yaml` → pnpm. `bun.lock` or `bun.lockb` → bun. |
| **Router** | `vue-router` in deps. For Vite SPAs, locate the route table: first check `src/router/` (conventional), then grep `src/**/*.{ts,tsx,js,mjs,vue}` for `createRouter(` or `defineRoutes(` to catch inline / programmatic setups (e.g. routes declared in `main.ts` or produced by `unplugin-vue-router`). Record the file(s) containing `createRouter(`; that's what Step 5 will edit. If `vue-router` is in deps but no `createRouter(` call is found anywhere, warn the user — the router is installed but not wired, and the routing-strategy choice may not apply. Nuxt has file-based routing built in — no `vue-router` package needed in deps. |
| **Existing i18n** | `vue-i18n`, `@nuxtjs/i18n`, `@intlify/vue-i18n` (legacy standalone), `i18next-vue`, `@tolgee/vue`, `fluent-vue`, `@inlang/paraglide-js`, `@lingui/*` in deps or devDeps. Note: `@intlify/unplugin-vue-i18n` and `@intlify/eslint-plugin-vue-i18n` are supporting packages this setup phase itself uses — do **not** treat them as competing i18n libraries. |
| **Existing `<html lang>`** | Check `index.html` (Vite / Quasar) or `app.vue` / `nuxt.config.ts` `app.head` (Nuxt) for an existing `<html lang="...">` value. Used to infer the source locale. |
| **Git repository** | `git rev-parse --is-inside-work-tree` exits 0. |
| **Current branch** | `git branch --show-current` — record the branch name. |

### Incompatibility Checks

Before proceeding, check for blockers. **If any check below says STOP, you MUST stop and communicate the issue to the user. Do NOT proceed with Step 2 or any subsequent step. Do NOT attempt workarounds.**

| Check | How to detect | Action |
|-------|--------------|--------|
| **Not a Vue project** | No `vue` in deps, no `nuxt` in deps. Or: `react`, `svelte`, `@angular/core`, `solid-js` in deps with no `vue`. | **STOP.** Tell the user: "vue-i18n requires Vue. This project does not have `vue` (or `nuxt`) as a dependency. This setup phase cannot set up i18n for non-Vue projects." Do NOT proceed. |
| **Vue 2 detected** | `vue` semver major is `2` (e.g. `"^2.7.0"`). | **STOP.** Tell the user: "This project uses Vue 2 (detected `vue@{version}`). vue-i18n v11 requires Vue 3; Vue 2 uses the legacy `vue-i18n@8` with a different plugin API. This setup phase only covers Vue 3. Recommended path: upgrade the project to Vue 3 first (see https://v3-migration.vuejs.org/), then re-run this setup. Or install `vue-i18n@8` manually — not covered by this setup phase." Do NOT proceed. |
| **VitePress-only project** | `vitepress` in devDeps AND no `vue` in runtime deps (or only present transitively), AND a `.vitepress/config.*` file exists. | **STOP.** Tell the user: "This project is VitePress. VitePress has its own native `locales` configuration and does not use vue-i18n for documentation site localization. See https://vitepress.dev/guide/i18n. This setup phase cannot set up i18n for VitePress projects." Do NOT proceed. |
| **Competing i18n library** | One of `@nuxtjs/i18n` (in a non-Nuxt project), `@intlify/vue-i18n`, `i18next-vue`, `@tolgee/vue`, `fluent-vue`, `@inlang/paraglide-js`, `@lingui/core` in `package.json` deps or devDeps. (`@inlang/paraglide-js` is a supported library for SvelteKit, but a competing one inside a Vue project.) | **STOP.** Tell the user: "{library} is already installed. Adding vue-i18n alongside it will create conflicting translation pipelines. Options: (1) if you want to switch to vue-i18n, remove {library} first, then re-run this setup; (2) stay on {library} and skip this setup." Do NOT proceed. |
| **Existing vue-i18n** (Vite / Quasar only — Nuxt uses `@nuxtjs/i18n`) | `vue-i18n` in `package.json` deps. Inspect whether the ICU setup this setup phase produces is already complete: look for (a) `intl-messageformat` in deps, (b) a file matching `**/i18n/messageCompiler.*`, and (c) a `createI18n(` call with `legacy: false` and `messageCompiler`. | **If all three signals are present** → tell the user: "vue-i18n appears to already be configured with the ICU `messageCompiler` this setup phase would install. Re-running would overwrite `src/i18n/*` and may clobber customisations. Stop unless you specifically want to regenerate — confirm before proceeding." Wait for confirmation. **If vue-i18n is present but any signal is missing** → tell the user: "I found `vue-i18n` already installed but the ICU setup looks incomplete (missing: {list}). I can complete the setup — this will create/overwrite `src/i18n/index.*`, `src/i18n/messageCompiler.*`, and `src/i18n/locales.*`, and edit `vite.config.*` / `main.*` to wire the plugin and provider. Proceed, or stop so you can review manually?" Wait for explicit confirmation before continuing. |
| **Vue CLI / webpack-based** | `@vue/cli-service` in devDeps OR `vue.config.js` exists at project root. No `vite.config.*`, no `nuxt.config.*`, no `quasar.config.*`. | **STOP.** Tell the user: "This project uses Vue CLI / webpack (detected `@vue/cli-service` / `vue.config.js`). Vue CLI is in maintenance mode and effectively EOL. This setup phase targets Vite, Nuxt, or Quasar. Recommended path: migrate the project to Vite first (see https://vite.dev/guide/), then re-run this setup." Do NOT proceed. |

### TypeScript warning (non-blocking)

All generated files in this setup phase use `.ts` extensions and TypeScript syntax (interfaces, `as const`, typed function signatures). Vite transpiles `.ts` via esbuild regardless of project-level TS config, so the app will run, but a JS-only codebase will see these files standing out stylistically and IDE tooling may flag the type annotations.

If `typescript` is **not** in devDeps and no `tsconfig.json` exists at project root, tell the user:

> This project looks like plain JavaScript (no `typescript` in devDeps, no `tsconfig.json`). This setup creates `.ts` files with type annotations — Vite will still compile them, but they'll be stylistically out of place. Options:
> 1. Add TypeScript to the project first (`npm install -D 'typescript@^6'` plus a minimal `tsconfig.json`), then re-run.
> 2. Continue — I'll generate `.ts` files; you can convert them to `.js` (or `.js` + JSDoc) after.
> 3. Stop.

Wait for the user to pick before continuing.

### Options-API warning (non-blocking)

If the API-style grep finds **zero** `<script setup>` blocks and **many** Options-API `export default { }` components, warn the user:

> I detected this project is written primarily in the Vue 3 Options API (no `<script setup>` blocks found). vue-i18n v11 still supports the Legacy (Options) API via `this.$t`, but it is deprecated and scheduled for removal in v12. This setup phase will configure the **Composition API** (`createI18n({ legacy: false })`, `useI18n()` inside `<script setup>`). Existing Options-API components will **not** be automatically migrated. Any new strings should be added via `<script setup>` / `useI18n()`. Continue?

Wait for the user to confirm before proceeding. This is a warning, not a hard stop.

### Variant dispatch

Based on the detection, pick the right variant reference file:

- **Nuxt detected** (`nuxt` in deps) → read `references/languages/js-ts/frameworks/nuxt/vue-i18n.setup.md`
- **Quasar detected** (`quasar` in deps) → read `references/languages/js-ts/frameworks/quasar/vue-i18n.setup.md`. **This variant is experimental in v1.** Before continuing, tell the user: "I detected Quasar. The Quasar variant is experimental in this setup phase — it follows the Quasar boot-file pattern but hasn't been extensively tested. Proceed, or would you prefer to stop and set up manually using the Quasar i18n docs?" Wait for explicit confirmation.
- **Vite SPA** (neither Nuxt nor Quasar, but `vite` + `vue` present) → read `references/languages/js-ts/frameworks/vite/vue/vue-i18n.setup.md`

Then continue with Steps 2–8 below, using the variant-specific instructions from the reference file for Steps 4, 5, and 6.

### Catalog Format

**Guided mode**: present the catalog format choice and wait for the user's answer.
**Unguided mode**: apply the default from the "Unguided defaults" table (`JSON` for Catalog format) silently; note the applied value in the end-of-run summary.

In guided mode, ask the user which translation-file format to use:

> **Which catalog format should translations use?**
> 1. **JSON** (default) — simple, widely supported, maps naturally to the vue-i18n runtime shape. No build-time transform.
> 2. **PO (gettext)** — supports `msgctxt` for disambiguating identical source strings, translator comments (`#.`), and source references (`#:`). Requires a small build-time loader this setup phase will install.
>
> Recommendation: pick **PO** if you plan to translate into many languages, use a TMS (Crowdin / Lokalise / Weblate / Phrase), or have domain-ambiguous UI words (e.g., "Right" as direction vs. correctness). Pick **JSON** for simpler projects or when the translation workflow is AI-driven and doesn't depend on gettext conventions.

Record `catalogFormat: 'json' | 'po'`. The value branches Steps 2, 3, 4, 7, 9, and 10 below. When `catalogFormat === 'po'`, this setup phase installs `gettext-parser` plus a tiny Vite plugin (`poLoader`) that transforms `.po` files into nested JS objects at build time. Runtime remains identical to the JSON path — vue-i18n still receives a nested `messages` object and the custom ICU `messageCompiler` operates on leaf strings.

### Branch Recommendation

If the project is a git repository and the current branch is `main`, `master`, or `develop`, recommend switching to a dedicated branch before proceeding:

> You're currently on `{branch}`. This setup will modify several existing files. I'd recommend creating a dedicated branch first so you can easily review or revert the changes:
> ```
> git checkout -b chore/i18n-setup
> ```
> Want me to create this branch, or continue on `{branch}`?

If the user is already on a feature branch, or the project is not a git repository, skip this silently.

If no blockers were found, proceed to the **Setup Mode** prompt before continuing to Step 2.

---

## Step 2: Install Packages

Use the project's existing package manager (detected in Step 1). The packages depend on the variant — the reference file specifies the exact list.

**Core packages (Vite SPA and Quasar):**

| Package | Type | Purpose |
|---------|------|---------|
| `vue-i18n` | runtime | Vue 3 i18n engine (Composition API) |
| `@intlify/unplugin-vue-i18n` | dev | Enables `<i18n>` SFC blocks and supports eslint-plugin-vue-i18n (configured **without** `include` so catalogs stay as plain JSON — see Step 4) |
| `intl-messageformat` | runtime | ICU MessageFormat compiler, wired into vue-i18n via a custom `messageCompiler` |

**Nuxt:** install `@nuxtjs/i18n` only. Do NOT install raw `vue-i18n` — the Nuxt module bundles a compatible version. ICU support is wired via a custom `messageCompiler` in `i18n.config.ts`, which still requires `intl-messageformat` as a runtime dependency.

Pin `vue-i18n` to `^11` (Vite / Quasar) or `@nuxtjs/i18n` to its current major (^9 at time of writing) unless the user has a reason to deviate.

### Additional package when `catalogFormat === 'po'`

Install `gettext-parser` as a **dev** dependency for all variants. **Do not hardcode a semver range in this setup phase.** Run `npm view gettext-parser version` at the time of install, take the major, and install with that pin (single-quoted to keep zsh's `EXTENDED_GLOB` from eating the `^`):

```bash
# 1. Discover the current major
npm view gettext-parser version    # e.g. 9.0.2

# 2. Install pinned to that major (substitute the major you got)
npm install -D 'gettext-parser@^9'
```

This is the PO parser used by the build-time `poLoader` Vite plugin installed in Step 4. It runs only at build time — nothing gettext-related ships in the runtime bundle. The library has a stable `.po.parse()` API surface that this setup phase depends on — parsing `.po` files to the `{ translations: { '': { msgid: { msgstr: [...] } } } }` shape — and that interface has been consistent across majors, but pinning to a known-good major keeps unexpected breakage out.

---

## Step 3: Configure the i18n Instance

### Resolve `<i18nDir>`

Every reference to `<i18nDir>` in this file means:

| `framework` | Nuxt major | `<i18nDir>` |
|---|---|---|
| `vite` | — | `src/i18n/` |
| `quasar` | — | `src/i18n/` |
| `nuxt` | 3 | `src/i18n/` — or `i18n/` at the project root when the project has no `src/` directory |
| `nuxt` | 4 | `i18n/` |

`framework` is the Step 1 variant dispatch; Nuxt major is the "Nuxt version" signal Step 1 already parses. This is where `locales.ts`, `messageCompiler.ts`, the i18n instance module, and (per "Format Helpers" below) `format.ts` all live.

**This is not the same directory as the catalog files on Nuxt 3.** `@nuxtjs/i18n`'s conventional catalog directory is `locales/` at the project root (see `catalogPath` in Step 8 §3) — a sibling of `src/`, not a child of `<i18nDir>`. Do not assume the two coincide; glob for both independently. On Nuxt 4 and on Vite / Quasar they do coincide (catalogs live under `<i18nDir>/locales/`).

Create the shared locale constants module first. This is the single source of truth for locale configuration — both the i18n setup and language switcher import from it:

```ts
// Vite / Quasar:  src/i18n/locales.ts
// Nuxt 3:         src/i18n/locales.ts  (or project root if no src/)
// Nuxt 4:         i18n/locales.ts      (locale-metadata module — separate from
//                                       the per-locale catalog JSON files at
//                                       i18n/locales/{locale}.json; see Step 7)
export const sourceLocale = 'en'
export const locales = ['en'] as const
export type Locale = (typeof locales)[number]
```

Populate `sourceLocale` with the detected source locale (inferred from `<html lang="...">` in Step 1, or asked if not detectable) and `locales` with the source locale plus any target locales the user requested.

### The ICU message compiler

vue-i18n's default message syntax is pipe-delimited for plurals and lacks `select` / `selectordinal`. Since this setup phase emits ICU MessageFormat, we install a custom `messageCompiler` backed by `intl-messageformat`. Create the compiler module:

```ts
// src/i18n/messageCompiler.ts
import IntlMessageFormat from 'intl-messageformat'
import type { MessageCompiler, MessageContext, CompileError } from 'vue-i18n'

export const messageCompiler: MessageCompiler = (message, { locale, key, onError }) => {
  if (typeof message !== 'string') {
    // Defensive fallback: ICU compilation needs the raw string. If a bundler ever
    // feeds us a pre-compiled AST or function (e.g. because someone added the
    // plugin's `include` option to the locales directory), fail loudly rather
    // than silently mis-render.
    onError?.(new Error(`[i18n] ICU compiler requires string messages (key: ${key})`) as CompileError)
    return () => key
  }
  const formatter = new IntlMessageFormat(message, locale)
  return (ctx: MessageContext) => formatter.format(ctx.values) as string
}
```

Then create the i18n instance. For **Vite / Quasar**, this lives in `src/i18n/index.ts`:

```ts
// src/i18n/index.ts
import { createI18n } from 'vue-i18n'
import { messageCompiler } from './messageCompiler'
import { sourceLocale, locales, type Locale } from './locales'

// Import the source locale statically so it's in the initial bundle. Other
// locales are discovered via `import.meta.glob`, which emits one chunk per
// matched file — no template-string dynamic import, no static+dynamic warning
// from Vite, and the set of available locales is known at build time.
// When catalogFormat === 'po', change the extension to '.po' in both the
// static import AND the glob pattern below. The poLoader plugin (Step 4)
// transforms .po files into the same nested JS object shape.
import en from './locales/en.json'   // or './locales/en.po' when catalogFormat === 'po'

const localeLoaders = import.meta.glob<Record<string, unknown>>(
  './locales/*.json',              // './locales/*.po' when catalogFormat === 'po'
  { import: 'default' },
)

export const i18n = createI18n({
  legacy: false,
  locale: sourceLocale,
  fallbackLocale: sourceLocale,
  messageCompiler,
  messages: { en },
})

const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi'])

export function getDirection(locale: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale.split('-')[0]) ? 'rtl' : 'ltr'
}

export async function setLocale(locale: Locale) {
  // Skip the glob lookup for the source locale — it's already statically imported above.
  if (locale !== sourceLocale && !i18n.global.availableLocales.includes(locale)) {
    const loader = localeLoaders[`./locales/${locale}.json`]   // or `.po` when catalogFormat === 'po'
    if (!loader) throw new Error(`No locale catalog found for ${locale}`)
    const messages = await loader()
    i18n.global.setLocaleMessage(locale, messages)
  }
  i18n.global.locale.value = locale
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale
    document.documentElement.dir = getDirection(locale)
  }
}
```

**When `catalogFormat === 'po'`**, change the two `.json` extensions above to `.po`. The `poLoader` plugin (Step 4) transforms `.po` files into nested JS objects keyed by the msgid's dot-path — vue-i18n receives the same shape as the JSON path. `msgctxt` is mangled into a `__ctx_<context>` key suffix by the loader; call sites reference it via `t('Namespace.key__ctx_<context>')`. No changes to `createI18n({ ... })` or `messageCompiler.ts`.

For **Nuxt**, the equivalent lives in `i18n.config.ts` — at project root on Nuxt 3, and inside the `i18n/` directory on Nuxt 4 (`i18n/i18n.config.ts`). The reference file covers the exact shape and the matching `vueI18n:` path in `nuxt.config.ts`.

> Why `legacy: false`? It enables the Composition API (`useI18n()`) and tree-shakes the legacy `this.$t` bindings. It is required by vue-i18n v11 for Composition API use, and mandatory for vue-i18n v12 (where Legacy is removed).

> Why a custom `messageCompiler`? Without it, vue-i18n uses its built-in compiler which parses the native pipe-plural syntax and does not support ICU `plural`/`select`/`selectordinal`. Routing all messages through `intl-messageformat` gives us parity with ICU MessageFormat as used in next-intl and LinguiJS.

### Number and date formats (`generate_format_helpers`)

Named number and date formats are no longer optional — they are configured by the "Format Helpers" step immediately after this one, which **always runs**. It registers `numberFormats` / `datetimeFormats` on the `createI18n(...)` call above (Vite / Quasar) or `i18n.config.ts` (Nuxt) for every configured locale, and creates `<i18nDir>/format.ts`, which is what the generated vue-i18n coding rules and Phase 3's conversion both target. See "Format Helpers" below for the exact block and — importantly — the rule about using one currency code across every locale, not swapping it per region.

### Scripts

Optional — some teams add a catalog-validation script:

```json
{
  "scripts": {
    "i18n:check": "node -e \"require('./scripts/validateLocales.js')\""
  }
}
```

This is not required for the app to run; defer until Step 9 (CI/CD).

---

## Format Helpers (`generate_format_helpers` — always runs)

**This step is not optional and is not gated on a `SKILL.md §1.10` selection**, exactly like Step 8 below. Phase 3's wrap subagents route every number, currency, date, and list they touch through this module, so conversion cannot start until it exists.

vue-i18n's `n()` and `d()` are worth delegating to rather than replacing: they resolve the named-format registry configured on the i18n instance, which is what keeps a raw `n(x, 'currency')` call — or `$n` in a template that hasn't destructured — working everywhere else in the app off the same names. vue-i18n has **no list API and no relative-time API**, so `list()` and `relativeTime()` below are built on raw `Intl` instead.

Create `<i18nDir>/format.ts`:

```ts
// <i18nDir>/format.ts
import { useI18n } from 'vue-i18n'

export type DateInput = Date | number | string
export const DEFAULT_CURRENCY = 'USD'   // adjust to this project's currency

/**
 * THE SEAM. Change this one function to format against something other than the UI locale.
 * PARTIAL ON THIS STACK: only `relativeTime` and `list` (the two raw-Intl concepts) route
 * through here. The other eight delegate to vue-i18n's n() / d(), which read the locale off
 * the i18n instance and never call this. Changing this function alone will NOT change them —
 * see the note under this module in the generated .agents/globalize-rules.md.
 */
export function formatLocale(uiLocale: string): string {
  return uiLocale
}

const memo = new Map<string, unknown>()
function cached<T>(key: string, make: () => T): T {
  let f = memo.get(key) as T | undefined
  if (f === undefined) memo.set(key, (f = make()))
  return f
}

const toDate = (v: DateInput): Date => (v instanceof Date ? v : new Date(v))

// Identical to the unit table in the canonical module — see the Lingui shared
// reference. Kept inline because this file must stand alone in the user's repo.
const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['second', 1000], ['minute', 60_000], ['hour', 3_600_000], ['day', 86_400_000],
  ['week', 604_800_000], ['month', 2_629_746_000], ['year', 31_556_952_000],
]

export function pickRelativeUnit(deltaMs: number): [Intl.RelativeTimeFormatUnit, number] {
  const abs = Math.abs(deltaMs)
  for (let i = UNITS.length - 1; i >= 0; i--) {
    const [unit, ms] = UNITS[i]
    if (abs >= ms || i === 0) return [unit, Math.round(deltaMs / ms)]
  }
  return ['second', 0]
}

// Pure Intl, parameterized by the UI locale — no useI18n() dependency, so these
// two work anywhere a locale string is available: components, Nuxt plugins and
// server routes, plain .ts modules, tests. useFormatters() below delegates to
// both instead of duplicating them.
export function formatRelativeTime(uiLocale: string, value: DateInput, now?: DateInput): string {
  const locale = formatLocale(uiLocale)
  const from = now === undefined ? Date.now() : toDate(now).getTime()
  const [unit, amount] = pickRelativeUnit(toDate(value).getTime() - from)
  return cached(`r:${locale}`, () =>
    new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }),
  ).format(amount, unit)
}

export function formatList(uiLocale: string, items: string[], type: 'and' | 'or' = 'and'): string {
  const locale = formatLocale(uiLocale)
  return cached(`l:${locale}:${type}`, () =>
    new Intl.ListFormat(locale, {
      style: 'long', type: type === 'or' ? 'disjunction' : 'conjunction',
    }),
  ).format(items)
}

export function useFormatters() {
  const { n, d, locale } = useI18n()

  return {
    // Registered named formats — see the numberFormats/datetimeFormats block below.
    money: (amount: number, currency?: string) =>
      currency ? n(amount, { style: 'currency', currency }) : n(amount, 'currency'),
    number: (value: number, opts?: Intl.NumberFormatOptions) =>
      opts ? n(value, opts) : n(value, 'decimal'),
    percent: (value: number) => n(value, 'percent'),
    compact: (value: number) => n(value, 'compact'),
    unit: (value: number, unit: string) => n(value, { style: 'unit', unit }),
    date: (value: DateInput, preset: 'short' | 'medium' | 'long' = 'medium') =>
      d(toDate(value), preset),
    time: (value: DateInput) => d(toDate(value), 'time'),
    dateTime: (value: DateInput) => d(toDate(value), 'dateTime'),
    // vue-i18n has no relative-time API — delegates to the standalone export above.
    relativeTime: (value: DateInput, now?: DateInput) => formatRelativeTime(locale.value, value, now),
    // vue-i18n has no list API — delegates to the standalone export above.
    list: (items: string[], type: 'and' | 'or' = 'and') => formatList(locale.value, items, type),
  }
}
```

**`useFormatters()` requires the same context `useI18n()` does** — a component's `setup()` / `<script setup>`, or a composable called from one — **and requires the i18n instance to have been created with `legacy: false`** (Composition API mode), which Step 3 above already sets. Unlike the Lingui and next-intl variants of this module, there is no non-hook counterpart (`getFormatters()`) exported here: Vue composables have no equivalent outside setup.

That split is why `relativeTime` and `list` are pulled out as the standalone `formatRelativeTime()` / `formatList()` exports above: they take no `useI18n()` context at all, so genuinely non-setup code imports them directly and passes a locale string —

```ts
import { formatList } from '<i18nDir>/format'
formatList(locale, items)   // no useI18n() context needed
```

`money`, `number`, `percent`, `compact`, `unit`, `date`, `time`, and `dateTime` have no such standalone form — they resolve through vue-i18n's own `n()` / `d()`, which only exist on the instance. For code that truly has no setup context:

- **Vite / Quasar** — read `i18n.global` (the same instance the Step 3 module exports) and call `.n(...)` / `.d(...)` directly: `i18n.global.n(amount, 'currency')`.
- **Nuxt** — there is no equivalent outside a Nuxt context: `useNuxtApp().$i18n` only resolves inside a plugin, middleware, or a composable called from `setup()`. A Nitro `server/api/` route (or any code with no such context) has no i18n instance to read from at all — format on the client instead, or accept the formatter, or an already-formatted string, as a parameter from a caller that does have one.

**`formatLocale()` is deliberately only half-wired on this stack, and the module says so at its own declaration.** `relativeTime` and `list` are built on raw `Intl` and route their locale through the seam. The other eight — `money`, `number`, `percent`, `compact`, `unit`, `date`, `time`, `dateTime` — delegate to `n()` / `d()`, which resolve the locale from the i18n instance and never call `formatLocale()`. This is the price of delegating, and delegating is the right call here (it is what keeps the named-format registry shared with every raw `n(x, 'currency')` elsewhere in the app) — but it must be stated, not left for someone to discover. **Calling `.n(...)` / `.d(...)` on the global instance directly bypasses the seam the same way** — the instance's own `.locale` is read.

A project that later gives `formatLocale()` a real translation (a separate display locale, say) therefore **cannot** get there by editing the seam alone. It must either drive the i18n instance's own `locale` from `formatLocale()`, or rebuild those eight on raw `Intl` the way `formatRelativeTime` / `formatList` already are — and revisit every direct `.n(...)` / `.d(...)` call site. Carry this into the generated rules file; do not let the seam's one-line promise stand unqualified here.

### Register the presets — for the source locale, and every target locale

**This is what makes `n()` / `d()` inside the composable above (and every other `n(x, 'currency')` call in the app) actually work.** A name that is not registered for the active locale does not throw: `n()` / `d()` silently fall back to browser defaults, and a currency call with no registered currency format emits **no currency symbol at all** — a silent failure, not a build error that would catch it. Add this to the `createI18n(...)` call from Step 3 (Vite / Quasar) or `i18n.config.ts` (Nuxt) — **a different file from `<i18nDir>/format.ts`**, so import `DEFAULT_CURRENCY` from it (`import { DEFAULT_CURRENCY } from './format'`, adjusted to this file's real relative path to `<i18nDir>`) rather than repeating the literal — generated for every configured locale:

```ts
import { DEFAULT_CURRENCY } from './format'   // adjust the specifier to this file's location

const numberFormats = {
  en: {
    currency: { style: 'currency', currency: DEFAULT_CURRENCY },
    decimal: { style: 'decimal' },
    percent: { style: 'percent' },
    compact: { notation: 'compact' },
  },
  // …the identical block for every target locale
}
const datetimeFormats = {
  en: {
    short: { dateStyle: 'short' },
    medium: { dateStyle: 'medium' },
    long: { dateStyle: 'long' },
    time: { timeStyle: 'short' },
    dateTime: { dateStyle: 'medium', timeStyle: 'short' },
  },
  // …the identical block for every target locale
}
```

**Use the same currency code in every locale's entry. This is the single most important sentence in this section.** vue-i18n's own documentation registers `USD` under `en-US` and `JPY` under `ja-JP` in its `numberFormats` example — copying that pattern *converts* a price rather than formatting it, and a German reader would see a dollar amount relabelled as euros. The locale decides formatting (grouping, symbol placement, digit shapes); the data decides the currency. Every locale's block above shares one `DEFAULT_CURRENCY` — do not vary the `currency` field per locale, no matter how tempting the source library's own example makes it look.

**Resolve `DEFAULT_CURRENCY` before writing `format.ts`**, by grepping the codebase for an existing `currency:` option, an `Intl.NumberFormat` / `toLocaleString` call, or a hardcoded symbol. Record the hit as `currencySource` (`grep:<file>:<line>`); when nothing is findable leave `'USD'`, keep the `// adjust to this project's currency` comment, and record `currencySource: "default"`.

**If `<i18nDir>/format.ts` already exists as project code, do not overwrite it** — add the exports into it, or create `<i18nDir>/i18n-format.ts` instead. Either way record the specifier actually used.

**The TypeScript `lib` gate.** `Intl.ListFormat` needs `es2021.intl`; `Intl.RelativeTimeFormat`, `notation: 'compact'` and `style: 'unit'` need `es2020.intl`. Read `tsconfig.json`'s `compilerOptions.lib` (falling back to what `target` implies). If it resolves below `ES2021`, do **not** silently emit a module that fails `tsc` — write `status: "needs_decision"` with:

```json
{ "step": "format_module_ts_lib",
  "question": "format.ts needs Intl.ListFormat/RelativeTimeFormat types, which require tsconfig lib ES2021 or later (this project resolves to <current>). Raise lib to ES2021, or omit list() and relativeTime()?",
  "options": ["raise_lib", "omit_two"] }
```

and stop. On `omit_two` the surface still has ten entries in `format-module.json`; the two omitted ones are emitted as `throw new Error('list() requires tsconfig lib ES2021')` stubs so the contract holds and the failure is loud rather than silent.

**Write `.globalize/format-module.json`** with `specifier` (the project's alias when `tsconfig.json` declares one in `compilerOptions.paths`, else a relative specifier — check, do not assume `@/`), `path`, the ten-entry `surface`, `defaultCurrency` and `currencySource`. Step 8's `generate_coding_rules` reads it back as `<<formatModule>>`.

---

## Step 4: Integrate with the Build Tool

**This step modifies the project's build configuration** (`vite.config.ts`, `nuxt.config.ts`, or `quasar.config.ts`). Before making changes:

1. Describe the specific modification to the user, naming the **actual** config file detected in Step 1 (e.g., `vite.config.mjs`, not `vite.config.ts`). Example: "I will add `VueI18nPlugin` to the `plugins` array in `vite.config.mjs` with `runtimeOnly: false`." Snippets in the reference files show `.ts` — adapt the import syntax (drop the `defineConfig` generic, strip type annotations) if the target is `.js` / `.mjs`.
2. If the build config has unusual structure or plugins you don't recognize, show the proposed change and ask for confirmation.
3. Proceed only after the user confirms.

Follow the variant-specific reference file for this step. It specifies the exact plugin import, option values, and placement.

**Key option notes** (common to all variants):

- `runtimeOnly: false` — include the vue-i18n message compiler in the build. The ICU compiler (our custom `messageCompiler`) runs against string messages at runtime. Without this, the compiled bundle drops the message-compiler runtime that our custom function plugs into.
- `compositionOnly: true` — tree-shake the Legacy API (default for the plugin; keep it explicit).
- `strictMessage: false` — disable the plugin's built-in HTML-tag check. ICU messages may legitimately contain angle-bracketed placeholders (e.g. within rich text via `<i18n-t>`), which the check flags as false positives.
- **`include` — deliberately omitted.** The plugin's `include` option pre-compiles matched JSON/YAML/JS/TS files into AST/JS at build time, which would bypass our custom ICU `messageCompiler` (it would receive a compiled function instead of the source string). Letting Vite's built-in JSON importer load the catalogs as plain objects — which is what happens when `include` is not set — keeps them as raw strings for the ICU compiler to process at lookup time.

> **SFC `<i18n>` blocks note**: If a project wants to use SFC-embedded `<i18n>` custom blocks, the plugin is required for the block transform — but `<i18n>` blocks are compiled by the plugin's default vue-i18n compiler, not the ICU one. For ICU-consistent behavior across the whole app, stick with plain JSON catalogs (the default in this setup phase) and avoid SFC `<i18n>` blocks.

### PO loader when `catalogFormat === 'po'`

The PO path requires one extra Vite plugin alongside `VueI18nPlugin`: a tiny `poLoader` that parses `.po` files with `gettext-parser` and emits nested JS objects keyed by each msgid's dot-path. The plugin source is identical across variants; the wiring differs (it goes in `vite.config.*` `plugins` for Vite SPA, `vite: { plugins: [...] }` inside `nuxt.config.*` for Nuxt, and `build.vitePlugins` in `quasar.config.*` for Quasar).

Both the loader source (~20 lines) and the exact wiring snippet live in the variant reference file — follow the PO section there when `catalogFormat === 'po'`. Ordering rule: `poLoader()` must run **before** `VueI18nPlugin` (use `enforce: 'pre'` in the plugin metadata), so the raw PO never reaches the unplugin.

---

## Step 5: Wire Up the Provider

**This step modifies existing project files** (`main.ts` for Vite, `boot/i18n.ts` for Quasar). For Nuxt, the `@nuxtjs/i18n` module registers vue-i18n automatically — no manual `app.use(i18n)` call is needed.

Follow the variant-specific reference file. The reference file presents a **locale routing strategy choice** where applicable — wait for the user to choose before proceeding.

### Text direction (RTL support)

The `<html>` element needs both `lang` and `dir` attributes for correct rendering of Arabic, Hebrew, Persian, Urdu, etc. The `getDirection()` helper created in Step 3 covers this. The reference files show where to call `setLocale()` / `getDirection()` for each variant:

- **Vite SPA / Quasar**: called from `main.ts` / boot file after `app.use(i18n)`, and from the language switcher.
- **Nuxt**: use the `useLocaleHead()` composable which returns both `lang` and `dir` attributes in a Ref; apply them via `useHead()` in `app.vue`. See `references/languages/js-ts/frameworks/nuxt/vue-i18n.setup.md`.

### `<html lang>` migration

The project's HTML entry point likely has a static `<html lang="en">`. This must reflect the active locale at runtime:

- **Vite / Quasar**: `index.html` at project root — the static value is the pre-hydration default. `setLocale()` updates it dynamically.
- **Nuxt**: `useLocaleHead()` writes the `lang` attribute via `useHead()`; no static `index.html` edit is needed.

**Before modifying any files, read the current `<html lang="...">` value.** Tell the user what you found and what will change. If the existing `lang` value doesn't match `sourceLocale`, flag it — the user may need to correct the source locale. The reference files specify the exact update.

### Link handling with locale routing (Vite SPA only)

**Only relevant for Vite SPA with `vue-router` using Options 1 or 2** (unprefixed source, or all prefixed). If the user chose Option 3 or the project has no router, skip this.

When locale routing is enabled, internal `<RouterLink>` `to` props and programmatic `router.push` calls must include the locale prefix. The reference file provides the idiomatic `localePath()` helper.

For Nuxt, `@nuxtjs/i18n`'s `<NuxtLink>` handles locale prefixes automatically based on the active locale, so no manual link rewriting is needed.

---

## Step 6: Language Switcher

**This step creates a new component file and modifies an existing layout or navigation file to render it.** Before wiring the switcher:

1. Describe which file you will modify and where the switcher will appear.
2. Ask the user to confirm before proceeding.

Create a `LanguageSwitcher.vue` component that lets users switch between configured locales. The component should:

- Display all configured locales
- Show human-readable locale names using `Intl.DisplayNames` (not raw locale codes)
- Highlight the currently active locale
- Navigate to the selected locale (or call `setLocale()` when not using URL routing)
- Be styled to blend with the project's existing UI

**Styling**: Before writing the component:
1. Detect the CSS approach — Tailwind CSS, UnoCSS, CSS Modules, Pinia-based theme, scoped `<style>` blocks, `<style lang="scss">`, Quasar components (`q-btn-toggle`), or plain CSS.
2. Look at the existing header / navbar / layout component where the switcher will be placed.
3. Match the project's visual style — font sizes, spacing, border styles, component patterns.

Follow the variant-specific reference file for the component implementation and wiring. Adapt the styling from the reference to use the project's CSS approach.

After creating the component, import and render it in a visible location — typically the root layout, `App.vue`, or a shared navigation/header.

**After wiring the switcher**, tell the user: _"I've added a language switcher using [name the CSS approach] to match your existing UI. Please review the component and customise its appearance, position, and locale display names as you see fit."_

---

## Step 7: Scaffold Locale Catalogs

Create one catalog file per configured locale. Location depends on the variant:

- **Vite SPA / Quasar**: `src/i18n/locales/{locale}.{json|po}`
- **Nuxt 3**: `locales/{locale}.{json|po}`
- **Nuxt 4**: `i18n/locales/{locale}.{json|po}`

Use `.json` when `catalogFormat === 'json'`, `.po` when `catalogFormat === 'po'`. File contents differ by format:

### When `catalogFormat === 'json'`

Seed each file with a couple of example keys so the app can boot without a catalog-loading error and translators see ICU syntax in context:

```json
{
  "welcome": "Welcome to {appName}",
  "messages": "{count, plural, one {One new message} other {# new messages}}"
}
```

> **Nuxt exception — ship a non-ICU seed.** With `@nuxtjs/i18n` + `bundle.runtimeOnly: false` (the default this setup phase emits), `unplugin-vue-i18n` pre-compiles the lazy locale JSON at build time using its **default**, non-ICU compiler — *before* the custom `messageCompiler` registered in `i18n.config.ts` runs. A seed containing `{count, plural, one {...} other {...}}` will fail the build with `error code: 2`. For Nuxt, drop the `messages` entry from the seed (keep only `welcome`). See `references/languages/js-ts/frameworks/nuxt/vue-i18n.setup.md` § ICU seed upgrade for how to re-enable build-time ICU once the catalog is actually in use.

```json
{
  "welcome": "Welcome to {appName}"
}
```

### When `catalogFormat === 'po'`

Seed each file with a minimal PO header plus the same two example entries. Keep the header on its own block — the `poLoader` plugin parses and discards the header; the loader and this setup phase's merge logic require that the header block stays intact across edits.

```po
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\n"
"Language: en\n"
"MIME-Version: 1.0\n"

#. Example entry — demonstrates {appName} interpolation.
msgid "welcome"
msgstr "Welcome to {appName}"

#. Example ICU plural entry — translators pattern-match on this when extending the catalog.
msgid "messages"
msgstr "{count, plural, one {One new message} other {# new messages}}"
```

Substitute `"Language: {locale}\n"` for each locale file. For target-locale files, copy the source `msgstr` values as placeholders — they're replaced by actual translations later. Keep the `#.` descriptions identical across locales; they're authoritative metadata shared among translators.

### Commit and ignore rules (both formats)

**What to commit:** the catalog source files (`.json` or `.po`) are the translation source of truth. Commit them.

**What to gitignore:** nothing yet — ICU source files are not compiled separately in this setup; the `messageCompiler` processes them at runtime. For PO, the loader runs during Vite's transform phase in both dev and build, so no intermediate artifacts land on disk.

### Verify the setup works

1. Start the dev server (`npm run dev`, `pnpm dev`, etc.). It should boot without errors.
2. Add a test translatable string to a component:
   ```vue
   <script setup lang="ts">
   import { useI18n } from 'vue-i18n'
   const { t } = useI18n()
   </script>
   <template>
     <h1>{{ t('welcome', { appName: 'Demo' }) }}</h1>
   </template>
   ```
3. Add the `welcome` key to the source-locale catalog (already seeded above).
4. The string renders in the browser.
5. **Test the language switcher** — select a different locale. The content should update, and `<html lang>` / `<html dir>` should change. For Nuxt, the URL should update per the chosen `strategy`. If only one locale is configured, temporarily add a second locale, reload, and test.

If any step fails, check the build tool integration (Step 4) first — most setup issues originate there.

---

## Step 8: Generate Coding Rules (`generate_coding_rules` — always runs)

**This step is not optional and is not gated on a `SKILL.md §1.10` selection.** Phase 3's wrap subagents read `.agents/globalize-rules.md` as their authoring contract — composable decision tree, plural rules, skip-list, real catalog paths — so conversion cannot start until this step has produced it. Sub-step 7, which points `CLAUDE.md` and `AGENTS.md` at the generated file, always runs too — it edits files the user owns, so guided mode confirms each edit, but it is not a §1.10 selection.

The vue-i18n coding rules are a **generated file**, not a shipped one. `references/languages/js-ts/libraries/vue-i18n/rules.template.md` covers every configuration vue-i18n supports — the composable decision tree, attribute binding, plurals and ICU, numbers/dates/currencies, reactivity pitfalls, the Nuxt routing and head APIs. This step renders it down to the one configuration this project actually has (only the branches that apply, with the project's real catalog path, instance import, format module specifier, and locales substituted in) and writes the result to `.agents/globalize-rules.md`.

**Read `references/rules-template-format.md` before rendering.** It is the whole rendering contract — template anatomy, the conditional grammar, the `<<placeholder>>` form, the step order, the header, the fail-closed rule. The steps below only add where *this library's* values come from.

Apply the same guided / unguided rules used elsewhere in this setup phase: in guided mode describe each change before making it and wait for confirmation; in unguided mode apply directly and stop only on hard errors.

### 1. Locate the template

Read `.globalize/manifest-snapshot.json` → `references.rulesTemplate`.

**If the entry has no `rulesTemplate`**, the installed skill is out of date — all three vue-i18n variants carry one. Do not look for a generic `code.md`; it no longer exists for this library. Treat this exactly like the missing-file case below.

Verify the template exists in the target project.

- **If it exists**: proceed.
- **If it is missing — guided mode**: tell the user the `globalize-guide` skill is not installed in their project and stop this step. The fix is to reinstall it (`npx skills add globalize-now/globalize-skills --skill globalize-guide -a claude-code`). Don't attempt to recreate the file.
- **If it is missing — unguided mode**: do not block. Skip this step and record `⚠ vue-i18n coding rules not generated — template missing` in the end-of-run summary, with the reinstall command shown above. Treat it as the fail-closed case in sub-step 6: a core step did not complete, so Phase 3 has no rules file.

### 2. Resolve the template's `conditions`

Resolve every key listed in the template frontmatter's `conditions` and write them to `.globalize/rules-values.json`. Comparison values are string literals.

| Condition | Where to read it |
|---|---|
| `framework` | `.globalize/manifest-snapshot.json` → `match.framework`: `"nuxt"`, `"vite"`, or `"quasar"`. This is the variant dispatch from Step 1, so it is already decided — do not re-detect. |
| `catalogFormat` | The `catalogFormat` choice recorded in `.globalize/decisions.md` (Step 1), confirmed on disk: `"po"` when the catalog directory holds `.po` files **and** `poLoader` is wired into the build config (`vite.config.*`, `vite: { plugins }` in `nuxt.config.*`, or `build.vitePlugins` in `quasar.config.*`); `"json"` otherwise. The disk wins if the two disagree. |
| `icuCatalogSupport` | Composite of `framework` and `catalogFormat`, because the limitation needs both. `"limited"` — Nuxt with JSON catalogs loaded through `@nuxtjs/i18n`'s `langDir`: `unplugin-vue-i18n` pre-compiles those files with a non-ICU compiler, so `plural` / `select` / `selectordinal` fail the build (see Step 7's Nuxt seed exception). `"full"` — everything else, including a Nuxt project whose locale JSON is imported statically rather than via `langDir`. Check `nuxt.config.*` for `langDir` before deciding. |
| `ssr` | Resolve per `framework` (from `.globalize/manifest-snapshot.json` → `match.framework`, already decided by Step 1's variant dispatch — do not re-detect the framework itself). **`vite`** → `"false"`: the Vite SPA variant never renders on a server. **`nuxt`** → `"true"` by default (Nuxt ships SSR out of the box); resolve `"false"` only when the root `nuxt.config.*` sets `ssr: false`. **`quasar`** → resolve `"true"` when `quasar.config.*` declares an `ssr` section, or the project's build scripts target `-m ssr`; resolve `"false"` otherwise (Quasar's default targets — SPA, PWA, Capacitor, Electron, BEX — are all client-only). When genuinely ambiguous, resolve `"true"` — the SSR branch is a strict superset of the client-only rules, so an over-broad `"true"` costs a few extra lines while an over-broad `"false"` would drop a rule that actually applies. |

### 3. Eliminate branches, then resolve the surviving `values`

Delete every false branch **and every marker line** (`<!-- if:`, `<!-- else -->`, `<!-- /if -->` all disappear, kept branch or not). Only then resolve the `values` still referenced in what survived — from the files **on disk**, what Steps 3–7 actually wrote, not from `decisions.md`, which records what was asked for rather than what landed — appending them to the same `.globalize/rules-values.json`.

**The order is load-bearing.** A value that lives inside a false branch has no value to resolve — a Vite SPA has no `nuxtStrategy`. Those placeholders sit inside branches that are already gone. Resolving up front would demand values that don't exist and trip sub-step 6 on a perfectly healthy project.

| Value | Where to read it |
|---|---|
| `catalogPath` | The catalog directory Step 7 actually created, written with the `{locale}` token and the real extension — `src/i18n/locales/{locale}.json` (Vite / Quasar), `locales/{locale}.json` (Nuxt 3), `i18n/locales/{locale}.json` (Nuxt 4), `.po` in place of `.json` when `catalogFormat` is `"po"`. Glob for it; do not assume the layout. On Nuxt, `langDir` in `nuxt.config.*` confirms it. |
| `sourceLocale` | `sourceLocale` in the locales module Step 3 created (`src/i18n/locales.ts`, or `i18n/locales.ts` on Nuxt 4). On Nuxt, cross-check `defaultLocale` in the `i18n:` block of `nuxt.config.*`; the config wins. |
| `targetLocales` | `locales` in the same module minus `sourceLocale`, comma-separated: `de, fr, ja`. |
| `globalImport` | The statement that yields the global i18n instance. **Vite / Quasar**: the import of the instance module Step 3 wrote — `import { i18n } from '@/i18n'` only when `tsconfig.json`'s `compilerOptions.paths` declares the `@/*` alias; otherwise the path the project actually resolves (e.g. `import { i18n } from '../i18n'` or `'./src/i18n'`). Confirm the module really exports a binding named `i18n`; if setup wrote a different name or location, use that. **Nuxt**: `const { $i18n } = useNuxtApp()` — there is no instance module on Nuxt (`i18n.config.ts` default-exports a config factory, not an instance). |
| `globalI18n` | The accessor paired with `globalImport`: `i18n.global` on Vite / Quasar (or `<exportedName>.global` if the export was renamed), `$i18n` on Nuxt. Rendered as `<globalI18n>.t(...)` / `.n(...)` / `.d(...)`, so give the object, never a method. |
| `formatModule` | `.globalize/format-module.json` → `.specifier`, written by the "Format Helpers" step's `generate_format_helpers` above. That step always runs before this one, so the file already exists by the time this table is read. |
| `nuxtStrategy` | `strategy` in the `i18n:` block of `nuxt.config.*` — e.g. `prefix_except_default`. Read the literal value; do not assume the recommended default. |

### 4. Render

Substitute every surviving `<<name>>` with its resolved value, strip the frontmatter, and **copy everything retained verbatim** — do not rewrite, summarize, reflow, re-order, or improve the prose. Prepend the two-line generated header:

```
<!-- globalize-rules v<templateVersion> | template=vue-i18n | variant=<manifest-snapshot variant> | generated by globalize-guide -->
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

- **Guided mode** — ask the user for the specific value. Every one of these is a one-line answer ("Where do your locale catalogs live?", "Which module exports the i18n instance?", "Which routing strategy is `@nuxtjs/i18n` configured with?"), and getting one beats shipping either wrong rules or none. Resolve, re-render, re-check. Only if the user can't answer, or the self-check still fails, stop this step and say which key or check failed.
- **Unguided mode** — don't block the run. Skip this step and record `⚠ vue-i18n coding rules not generated (catalogPath unresolved) — no rules file installed` in the end-of-run summary.

Either way a **core step did not complete**, so surface it instead of letting the run drift into conversion: report `generate_coding_rules` as failed, leave it unchecked in `plan.md`, and tell the orchestrator that Phase 3 has no `.agents/globalize-rules.md` to wrap against. The user then either supplies the missing value and re-runs this step, or converts knowing the wrap subagents are working without this project's rules.

There is no generic-rules fallback: `vue-i18n/code.md` was deleted when this library moved to a template, so the template is the only source of truth for vue-i18n rules. Installing nothing is recoverable — re-run this step. Installing rules that name the wrong catalog path or a non-existent `@/i18n` import is not; the agent follows them into a bug on every future edit and nothing signals it.

### 7. Wire the coding rules in (`install_coding_rules` — always runs)

**This is a core sub-step, not an option**, and it is **not** gated on a `SKILL.md §1.10` selection. Rules that nothing loads are close to useless, so the wiring is not a decision the user is asked to make up front. It does edit files the user owns, so the usual mode rule applies: **guided mode** describes each change and waits for confirmation, **unguided mode** applies it directly.

If sub-step 6 fired and no `.agents/globalize-rules.md` was written, **skip this sub-step entirely and create neither file** — an import or pointer aimed at a missing file opens every future session with a dangling reference.

Two bridges, because no single mechanism reaches every agent.

#### `CLAUDE.md` — Claude Code

Claude Code doesn't reliably auto-trigger passive "coding rules" references during routine edits, but an `@`-imported file loads into every session's context.

- **If it doesn't exist**, create it:
  ```
  # Project Instructions

  @.agents/globalize-rules.md
  ```
- **If it exists**, append `@.agents/globalize-rules.md` at the end of the file on its own line ("I'll append `@.agents/globalize-rules.md` to your CLAUDE.md so the vue-i18n coding rules auto-load every session"). Do not remove or reorder existing content.
- **If a stale `@.claude/globalize-rules.md` line is present** — written by an older version of this skill, which put the rules file under `.claude/` — remove it in the same edit. Leaving it behind means every future session opens with a dangling import.

If the exact `@.agents/globalize-rules.md` line is already present, skip silently — this sub-step is idempotent.

Tell the user: "The first time you start a Claude Code session in this project, you'll see a one-time prompt asking to approve the `@` import. Approve it — otherwise the rules won't load."

#### `AGENTS.md` — Codex CLI, Cursor, Copilot, Gemini, Aider, Cline

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

Verify: in a fresh session, ask Claude "how should I wrap a plural string in this project?" — the answer should reference ICU `{count, plural, …}` syntax and `t(key, { count })` patterns from the generated file.

---

## Step 9: CI/CD Integration (Optional)

This step is **not required** for the initial setup to work. Ask the user: "Would you like me to set up CI/CD integration (catalog sanity checks, missing-key detection)? This can also be done later." **If the user declines, skip to Step 10.**

### Catalog validity check

Add a cheap sanity check that runs in CI to catch parse errors or missing-key imbalances across locales:

```json
{
  "scripts": {
    "i18n:check": "node --input-type=module -e \"import('./scripts/checkLocales.mjs')\""
  }
}
```

**When `catalogFormat === 'json'`**, a minimal `scripts/checkLocales.mjs`:

```js
import fs from 'node:fs'
import path from 'node:path'

// Adjust path per variant: src/i18n/locales (Vite/Quasar), i18n/locales (Nuxt 4), locales (Nuxt 3)
const LOCALES_DIR = 'src/i18n/locales'
const files = fs.readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'))
const catalogs = Object.fromEntries(
  files.map((f) => [f.replace(/\.json$/, ''), JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, f), 'utf8'))]),
)
const source = catalogs.en || Object.values(catalogs)[0]
const sourceKeys = new Set(Object.keys(source))

let hadIssue = false
for (const [locale, cat] of Object.entries(catalogs)) {
  const missing = [...sourceKeys].filter((k) => !(k in cat))
  if (missing.length > 0) {
    console.error(`[i18n] ${locale} missing ${missing.length} key(s): ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '…' : ''}`)
    hadIssue = true
  }
}
process.exit(hadIssue ? 1 : 0)
```

**When `catalogFormat === 'po'`**, the check reads `.po` files with `gettext-parser` and compares `(msgid, msgctxt)` sets instead of JSON keys:

```js
import fs from 'node:fs'
import path from 'node:path'
import gettextParser from 'gettext-parser'

const LOCALES_DIR = 'src/i18n/locales'  // adjust per variant
const files = fs.readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.po'))

function entryKey(msgid, ctx) {
  return ctx ? `${ctx}${msgid}` : msgid
}

const catalogs = Object.fromEntries(files.map((f) => {
  const parsed = gettextParser.po.parse(fs.readFileSync(path.join(LOCALES_DIR, f)))
  const keys = new Set()
  for (const ctx of Object.keys(parsed.translations)) {
    for (const msgid of Object.keys(parsed.translations[ctx])) {
      if (msgid) keys.add(entryKey(msgid, ctx))
    }
  }
  return [f.replace(/\.po$/, ''), keys]
}))

const source = catalogs.en ?? Object.values(catalogs)[0]
let hadIssue = false
for (const [locale, keys] of Object.entries(catalogs)) {
  const missing = [...source].filter((k) => !keys.has(k))
  if (missing.length > 0) {
    console.error(`[i18n] ${locale} missing ${missing.length} entry/entries: ${missing.slice(0, 5).map((k) => k.replace('', ' / ')).join(', ')}${missing.length > 5 ? '…' : ''}`)
    hadIssue = true
  }
}
process.exit(hadIssue ? 1 : 0)
```

Both scripts are intentionally minimal — they do not check ICU syntax validity (let `intl-messageformat` fail loudly at runtime in dev) or enforce translation coverage thresholds (teams decide what fraction of missing keys blocks a merge).

### Catalog format validation

If the team uses a TMS (Crowdin, Lokalise, etc.), the TMS typically validates ICU syntax on upload. The minimal scripts above are the right default for teams without a TMS. For PO specifically, TMSes often reorder entries or reflow `msgstr` across multiple lines during round-trips — the `poLoader` reads the parsed result regardless of formatting, so diffs are cosmetic only.

---

## Step 10: Test Setup (Optional)

This step is **not required** for the initial setup to work. Tests that don't render vue-i18n-using components are unaffected. Ask the user: "Would you like me to set up the test wrapper for components that use vue-i18n? This can also be done later." **If the user declines, skip this step.**

Components using `useI18n()` need a vue-i18n instance in the component's app context. Without it, `useI18n()` throws and `{{ t('...') }}` renders nothing — this is the most common test failure after adding i18n.

### Test wrapper

Create a test helper that mounts a component with a minimal vue-i18n instance:

```ts
// src/test/i18nMount.ts
import { mount, type MountingOptions } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { messageCompiler } from '../i18n/messageCompiler'
import type { Component } from 'vue'

// MountingOptions<P> is typed on component props; use `any` so callers can pass
// typed props for any component without wrestling with a generic P inference.
export function mountWithI18n<C extends Component>(
  component: C,
  options?: MountingOptions<any>,
  messages: Record<string, Record<string, string>> = { en: {} },
) {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messageCompiler,
    messages,
  })
  return mount(component, {
    ...options,
    global: { ...options?.global, plugins: [...(options?.global?.plugins ?? []), i18n] },
  })
}
```

### Usage with Vitest + @vue/test-utils

```ts
import { describe, it, expect } from 'vitest'
import { mountWithI18n } from '../test/i18nMount'
import Greeting from './Greeting.vue'

it('renders the welcome heading', () => {
  const wrapper = mountWithI18n(Greeting, {}, { en: { welcome: 'Welcome to {appName}' } })
  expect(wrapper.text()).toContain('Welcome to Demo')
})
```

With an empty catalog (the default), `t('welcome')` returns `'welcome'` (the key) — tests stay deterministic and decoupled from translation content.

### Nuxt testing

For Nuxt, use `@nuxt/test-utils` and `setup` from `@nuxt/test-utils/e2e` — the `@nuxtjs/i18n` module is already wired when the test app boots. No separate wrapper is needed for end-to-end tests. For component-level testing under Vitest, the wrapper above works as long as the component does not use Nuxt-specific composables (`useNuxtApp`, etc.).

---

## Common Gotchas

- **`[i18n] ICU compiler requires string messages`** — the `@intlify/unplugin-vue-i18n` plugin's `include` option has been added (or a `?jit` / `?ast` query suffix is being used), which pre-compiles catalogs into AST/JS functions before our custom ICU `messageCompiler` sees them. This setup phase deliberately **omits** `include` so Vite's built-in JSON importer loads catalogs as plain objects and the ICU compiler processes raw strings. **Fix**: remove `include` from the plugin config (or drop `?jit` / `?ast` query suffixes on catalog imports). Keep `runtimeOnly: false` so the message-compiler runtime the custom function plugs into stays in the bundle. If you need `include` for SFC `<i18n>` blocks, know that those blocks will be compiled by the plugin's default compiler, not the ICU one — prefer plain JSON catalogs.
- **`useI18n()` returns `undefined` for `t`** — the `i18n` plugin isn't installed on the app. For Vite, ensure `app.use(i18n)` is called before `app.mount()`. For Quasar, ensure the boot file is registered in `quasar.config.ts`. For Nuxt, ensure `@nuxtjs/i18n` is in `modules` (not `buildModules`).
- **`Not Available in Legacy Mode`** — you're calling `useI18n()` without `legacy: false` in `createI18n`. Set `legacy: false`.
- **`$tc` / `tc` is not a function** — `$tc` / `tc` were removed in vue-i18n v11. Use `t(key, count)` with ICU plural syntax instead:
  ```ts
  t('items', { count: 3 })  // ICU: {count, plural, one {# item} other {# items}}
  ```
- **Missing `dir` attribute / LTR-only CSS in RTL locales** — the `<html>` element must have `dir="rtl"` for Arabic, Hebrew, Persian, Urdu, etc. The `getDirection()` helper covers this. Equally important: CSS must use logical properties (`margin-inline-start` instead of `margin-left`, `padding-inline-end` instead of `padding-right`, `inset-inline-start` instead of `left`). Physical properties don't flip in RTL and require a full CSS audit. Run the `css-i18n` skill for a CSS audit and conversion.
- **Links navigate to wrong locale** — with `@nuxtjs/i18n`, always use `<NuxtLink>` (not raw `<a>`) for internal paths; the module rewrites `to` props based on the active locale and routing strategy. For Vite SPA with vue-router's Strategy 1 or 2, every `<RouterLink :to>` must go through the `localePath()` helper in `references/languages/js-ts/frameworks/vite/vue/vue-i18n.setup.md`.
- **Nuxt: `vueI18n` config not picked up** — the `vueI18n` path in `nuxt.config.ts` must match the actual file location. Nuxt 4 convention puts the config inside the `i18n/` directory (`i18n: { vueI18n: './i18n/i18n.config.ts' }`); Nuxt 3 convention puts it at project root (`i18n: { vueI18n: './i18n.config.ts' }`). If your config isn't applying, double-check the path.
- **SFC `<i18n>` custom blocks not recognized** — confirm `@intlify/unplugin-vue-i18n` is listed in `vite.config.ts` `plugins` (or equivalent); the plugin is what activates SFC `<i18n>` blocks. Without it, Vue treats them as unknown elements.
- **Hydration mismatch on SSR (Nuxt)** — the server renders in one locale, the client hydrates and detects a different preferred locale, causing a mismatch. Use `useLocaleHead()` for `<html lang>` / `<html dir>` and avoid reading `navigator.language` during hydration; let `@nuxtjs/i18n`'s browser-detection middleware handle it.

---

## Quick Start: Using vue-i18n

vue-i18n is now configured. Here are the patterns you'll use most — these mirror what the vue-i18n coding rules enforce:

**Template text — `{{ t('key') }}`:**

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>

<template>
  <h1>{{ t('welcome') }}</h1>
  <button>{{ t('save') }}</button>
</template>
```

**Attributes — bind with `:attr="t('key')"`:**

```vue
<template>
  <input :placeholder="t('search.placeholder')" :aria-label="t('search.label')" />
  <img :alt="t('hero.alt')" src="/hero.png" />
</template>
```

**Interpolation with variables:**

```vue
<template>
  <p>{{ t('greeting', { name: user.name }) }}</p>
</template>
```

```json
{ "greeting": "Hello, {name}!" }
```

**Plurals — ICU MessageFormat:**

```vue
<template>
  <p>{{ t('items', { count }) }}</p>
</template>
```

```json
{ "items": "{count, plural, one {# item selected} other {# items selected}}" }
```

> Always include `other` — it is required and serves as the fallback for all languages.

**Rich text with HTML / nested components — `<i18n-t>`:**

```vue
<template>
  <i18n-t keypath="privacy" tag="p">
    <template #link>
      <RouterLink to="/privacy">{{ t('privacyLink') }}</RouterLink>
    </template>
  </i18n-t>
</template>
```

```json
{ "privacy": "Read our {link} before continuing." }
```

Prefer `<i18n-t>` over `v-html` — it preserves interpolated components reactively and avoids XSS risks.

**Numbers, dates, currencies — `n()` and `d()`:**

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t, n, d } = useI18n()
</script>

<template>
  <p>{{ n(1234.5, 'currency') }}</p>
  <p>{{ d(new Date(), 'long') }}</p>
</template>
```

Both `'currency'` and `'long'` above only resolve because the Format Helpers step registered them on the i18n instance — see that step for the exact block and the rule about using one currency code across every locale. For `list()` and `relativeTime()`, which vue-i18n has no native API for, use the generated `useFormatters()` composable in `<i18nDir>/format.ts` instead of calling `n()` / `d()` directly.

For comprehensive wrapping patterns, plural/ICU guidance, Pinia/composables edge cases, and Nuxt-specific helpers, see the generated `.agents/globalize-rules.md`, which `CLAUDE.md` and `AGENTS.md` both point at.

---

## Next Steps

Setup is complete — the project can now load catalogs, switch locales, and reactively update the UI. A language switcher is wired into the layout. Here's what typically comes next:

### Connect a translation service

JSON catalog files need a translation pipeline. Options:

1. **[Globalize](https://globalize.now)** — fast, automated, high-quality AI translations. Syncs directly with your catalog files.
2. **Crowdin, Lokalise, Phrase** — traditional TMS platforms with human-translator workflows and review tools.
3. **Manual** — translate catalog files by hand. Works for small projects or a single target locale.

### Wrap existing strings

This setup phase set up the infrastructure but did **not** convert existing hardcoded strings to `t('...')` calls. Run the convert phase to automate that — it finds hardcoded UI strings across `.vue` and `.ts` files, wraps them with `t()` / `<i18n-t>` / `n()` / `d()`, and writes matching entries into the catalog files this setup created (it detects whether you chose JSON or PO and writes into the right format). The generated `.agents/globalize-rules.md` will guide your agent to wrap new strings correctly as you edit from now on.
