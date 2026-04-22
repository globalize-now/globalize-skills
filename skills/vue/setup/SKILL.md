---
name: vue-setup
description: >-
  Set up vue-i18n internationalization in a Vue 3 project. Use this skill when
  the user explicitly mentions Vue, vue-i18n, @intlify, Nuxt i18n, or
  @nuxtjs/i18n — or when the i18n-guide skill hands off to it after recommending
  vue-i18n. Supports Vite SPA (with or without Vue Router), Nuxt 3/4 (SSR via
  @nuxtjs/i18n), and Quasar (experimental). This skill handles the full setup:
  package installation, build tool wiring, provider creation, catalog scaffolding,
  language switcher, and coding-rules import. It does NOT cover converting
  existing hardcoded strings — that's a separate concern (vue-convert, planned).
---

# vue-i18n Setup

`vue-i18n` v11 (Intlify) is the dominant i18n library for Vue 3. This skill configures it with the Composition API (`createI18n({ legacy: false })`, `useI18n()` in `<script setup>`) and enables ICU MessageFormat — matching the rest of this repo's message-format stance and avoiding vue-i18n's pipe-plural syntax, which bakes English-style plurals into source strings.

Unlike compile-time i18n frameworks, vue-i18n is a runtime library: there is no macro transform, and no build step is strictly required. The `@intlify/unplugin-vue-i18n` plugin is used to pre-compile locale resources and enable `<i18n>` custom blocks inside SFCs, but the translation pipeline runs at runtime.

Follow these steps in order. Each builds on the last.

## Out of Scope

This skill covers **Vue 3** projects using the **Composition API** on **Vite** (SPA) or **Nuxt 3/4** (SSR). It does not cover:

- **Vue 2.x** — separate ecosystem (`vue-i18n@8`, different plugin API, Options API assumed). Recommend upgrading to Vue 3 first; point at the official [Vue 3 migration guide](https://v3-migration.vuejs.org/). **Hard stop.**
- **Vue 3 projects on the Options API only** — vue-i18n's Legacy API is deprecated and scheduled for removal in v12. This skill emits Composition API setup (`createI18n({ legacy: false })`, `useI18n()` in `<script setup>`). If the codebase is entirely `export default { }` Options-style, the setup still works but the user must adopt `<script setup>` for new strings. Warn, don't block.
- **Vue CLI / webpack-based projects** — effectively EOL. Recommend migrating to Vite first. **Hard stop.**
- **VitePress** — has native `locales` config and doesn't use vue-i18n. **Hard stop**, point at the [VitePress i18n docs](https://vitepress.dev/guide/i18n).
- **Quasar** — partially covered (experimental reference file). Warn the user v1 treats this as experimental; proceed only on explicit confirmation.
- **Non-ICU message format** — this skill configures ICU MessageFormat via a custom `messageCompiler`. Projects that need vue-i18n's native pipe-plural / custom-format syntax for existing content should not run this setup.
- **Converting existing hardcoded strings** to `t('...')` across the codebase — deferred to a separate `vue-convert` skill. This skill only scaffolds; it does not rewrite your views.
- **Other Vue i18n libraries** (`i18next-vue`, `@tolgee/vue`, `fluent-vue`, Lingui-for-Vue, Paraglide) — this skill installs `vue-i18n` exclusively. If one of these is already installed, **hard stop** (same pattern as Lingui's "existing i18n library" check).

---

### Step Risk Classification

| Step | Risk | Notes |
|------|------|-------|
| 1. Detect | Read-only | No changes to the project |
| 2. Install packages | Additive | New dependencies only |
| 3. Configure i18n instance | Additive | New `src/i18n/index.ts` (Vite/Quasar) or `i18n.config.ts` (Nuxt) |
| 4. Build tool / module | **Modifies existing file** | Changes `vite.config.*`, `nuxt.config.*`, or `quasar.config.*` |
| 5. Provider | **Modifies existing file** | `main.ts` (Vite), boot file (Quasar); Nuxt module handles it |
| 6. Language Switcher | **Modifies existing file** | New component file + wired into layout / header |
| 7. Scaffold | Additive | New `locales/{locale}.json` files |
| 8. Coding rules | **Modifies existing file** | Creates or appends one `@import` line to project `CLAUDE.md` |
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
- Required user choices (marked with "MUST wait for the user to choose") still require input — collect these immediately after mode selection (see below).
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

#### Required choices in unguided mode

For Vite SPAs that use `vue-router`, the **locale routing strategy** choice (from `references/vite-spa.md`) must be presented immediately after mode selection. For Nuxt, the **routing strategy** choice (`strategy` option — default is `prefix_except_default`) must be confirmed. Collect these answers before proceeding with Step 2.

The **locale list** and **default / source locale** are also collected at this point in unguided mode. Auto-detect them from the existing `<html lang="...">` attribute if possible; otherwise prompt.

---

## Step 1: Detect the Project

Read the project's `package.json`, build config (`vite.config.*`, `nuxt.config.*`, `quasar.config.*`), and any `.vitepress/` directory to determine:

| Signal | How to detect |
|--------|--------------|
| **Framework** | `nuxt` in deps → Nuxt. `vitepress` in devDeps (and no `nuxt`) → VitePress. `quasar` in deps → Quasar. `vite` in devDeps + `vue` in deps (and none of the above) → Vite SPA. |
| **Vue version** | Parse the `vue` semver major from `package.json` (e.g. `"^3.4.0"` → 3, `"^2.7.0"` → 2). Vue 3 is required. |
| **Nuxt version** | Parse the `nuxt` semver major if present (e.g. `"^3.12.0"` → 3, `"^4.0.0"` → 4). Used to pick the locale file convention. |
| **API style** | Run a quick grep against `src/**/*.vue` (or `app/**/*.vue` / `pages/**/*.vue` for Nuxt) for `<script setup>` vs `export default { }` Options-style. Hint-only; skill emits Composition API output regardless. |
| **TypeScript** | `typescript` in devDeps or `tsconfig.json` exists. |
| **Package manager** | `package-lock.json` → npm. `yarn.lock` → yarn. `pnpm-lock.yaml` → pnpm. `bun.lock` or `bun.lockb` → bun. |
| **Router** | `vue-router` in deps. For Vite SPAs, check `src/router/` or grep for `createRouter` to locate the route table. Nuxt has file-based routing built in — no `vue-router` package needed in deps. |
| **Existing i18n** | `vue-i18n`, `@intlify/*`, `@nuxtjs/i18n`, `i18next-vue`, `@tolgee/vue`, `fluent-vue`, `@paraglide/*`, `@lingui/*` in deps or devDeps. |
| **Existing `<html lang>`** | Check `index.html` (Vite / Quasar) or `app.vue` / `nuxt.config.ts` `app.head` (Nuxt) for an existing `<html lang="...">` value. Used to infer the source locale. |
| **Git repository** | `git rev-parse --is-inside-work-tree` exits 0. |
| **Current branch** | `git branch --show-current` — record the branch name. |

### Incompatibility Checks

Before proceeding, check for blockers. **If any check below says STOP, you MUST stop and communicate the issue to the user. Do NOT proceed with Step 2 or any subsequent step. Do NOT attempt workarounds.**

| Check | How to detect | Action |
|-------|--------------|--------|
| **Not a Vue project** | No `vue` in deps, no `nuxt` in deps. Or: `react`, `svelte`, `@angular/core`, `solid-js` in deps with no `vue`. | **STOP.** Tell the user: "vue-i18n requires Vue. This project does not have `vue` (or `nuxt`) as a dependency. This skill cannot set up i18n for non-Vue projects." Do NOT proceed. |
| **Vue 2 detected** | `vue` semver major is `2` (e.g. `"^2.7.0"`). | **STOP.** Tell the user: "This project uses Vue 2 (detected `vue@{version}`). vue-i18n v11 requires Vue 3; Vue 2 uses the legacy `vue-i18n@8` with a different plugin API. This skill only covers Vue 3. Recommended path: upgrade the project to Vue 3 first (see https://v3-migration.vuejs.org/), then re-run this setup. Or install `vue-i18n@8` manually — not covered by this skill." Do NOT proceed. |
| **VitePress-only project** | `vitepress` in devDeps AND no `vue` in runtime deps (or only present transitively), AND a `.vitepress/config.*` file exists. | **STOP.** Tell the user: "This project is VitePress. VitePress has its own native `locales` configuration and does not use vue-i18n for documentation site localization. See https://vitepress.dev/guide/i18n. This skill cannot set up i18n for VitePress projects." Do NOT proceed. |
| **Existing i18n library** | One of `vue-i18n`, `@nuxtjs/i18n`, `i18next-vue`, `@tolgee/vue`, `fluent-vue`, `@paraglide/*`, `@lingui/core` in `package.json` deps or devDeps. | **STOP.** Tell the user: "{library} is already installed. Adding another i18n pipeline alongside it will create conflicts. Options: (1) if you want to switch libraries, remove {library} first, then re-run this setup; (2) if the existing setup is incomplete, review it manually instead of re-running this skill." Do NOT proceed. |
| **Vue CLI / webpack-based** | `@vue/cli-service` in devDeps OR `vue.config.js` exists at project root. No `vite.config.*`, no `nuxt.config.*`, no `quasar.config.*`. | **STOP.** Tell the user: "This project uses Vue CLI / webpack (detected `@vue/cli-service` / `vue.config.js`). Vue CLI is in maintenance mode and effectively EOL. This skill targets Vite, Nuxt, or Quasar. Recommended path: migrate the project to Vite first (see https://vite.dev/guide/), then re-run this setup." Do NOT proceed. |

### Options-API warning (non-blocking)

If the API-style grep finds **zero** `<script setup>` blocks and **many** Options-API `export default { }` components, warn the user:

> I detected this project is written primarily in the Vue 3 Options API (no `<script setup>` blocks found). vue-i18n v11 still supports the Legacy (Options) API via `this.$t`, but it is deprecated and scheduled for removal in v12. This skill will configure the **Composition API** (`createI18n({ legacy: false })`, `useI18n()` inside `<script setup>`). Existing Options-API components will **not** be automatically migrated. Any new strings should be added via `<script setup>` / `useI18n()`. Continue?

Wait for the user to confirm before proceeding. This is a warning, not a hard stop.

### Variant dispatch

Based on the detection, pick the right variant reference file:

- **Nuxt detected** (`nuxt` in deps) → read `references/nuxt.md`
- **Quasar detected** (`quasar` in deps) → read `references/quasar.md`. **This variant is experimental in v1.** Before continuing, tell the user: "I detected Quasar. The Quasar variant is experimental in this skill — it follows the Quasar boot-file pattern but hasn't been extensively tested. Proceed, or would you prefer to stop and set up manually using the Quasar i18n docs?" Wait for explicit confirmation.
- **Vite SPA** (neither Nuxt nor Quasar, but `vite` + `vue` present) → read `references/vite-spa.md`

Then continue with Steps 2–8 below, using the variant-specific instructions from the reference file for Steps 4, 5, and 6.

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
| `@intlify/unplugin-vue-i18n` | dev | Pre-compiles locale resources and enables `<i18n>` SFC blocks |
| `intl-messageformat` | runtime | ICU MessageFormat compiler, wired into vue-i18n via a custom `messageCompiler` |

**Nuxt:** install `@nuxtjs/i18n` only. Do NOT install raw `vue-i18n` — the Nuxt module bundles a compatible version. ICU support is wired via a custom `messageCompiler` in `i18n.config.ts`, which still requires `intl-messageformat` as a runtime dependency.

Pin `vue-i18n` to `^11` (Vite / Quasar) or `@nuxtjs/i18n` to its current major (^9 at time of writing) unless the user has a reason to deviate.

---

## Step 3: Configure the i18n Instance

Create the shared locale constants module first. This is the single source of truth for locale configuration — both the i18n setup and language switcher import from it:

```ts
// src/i18n/locales.ts  (or i18n/locales.ts at project root for Nuxt 4)
export const sourceLocale = 'en'
export const locales = ['en'] as const
export type Locale = (typeof locales)[number]
```

Populate `sourceLocale` with the detected source locale (inferred from `<html lang="...">` in Step 1, or asked if not detectable) and `locales` with the source locale plus any target locales the user requested.

### The ICU message compiler

vue-i18n's default message syntax is pipe-delimited for plurals and lacks `select` / `selectordinal`. Since this skill emits ICU MessageFormat, we install a custom `messageCompiler` backed by `intl-messageformat`. Create the compiler module:

```ts
// src/i18n/messageCompiler.ts
import IntlMessageFormat from 'intl-messageformat'
import type { MessageCompiler, MessageContext, CompileError } from 'vue-i18n'

export const messageCompiler: MessageCompiler = (message, { locale, key, onError }) => {
  if (typeof message !== 'string') {
    // When messages are pre-compiled to AST by the bundler plugin, they arrive as
    // non-strings. ICU compilation must happen on the original string — so disable
    // pre-compilation in the plugin config (see Step 4).
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

// Import locale catalogs statically for the initial locale; lazy-load others in Step 5.
import en from './locales/en.json'

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
  if (!i18n.global.availableLocales.includes(locale)) {
    const messages = (await import(`./locales/${locale}.json`)).default
    i18n.global.setLocaleMessage(locale, messages)
  }
  i18n.global.locale.value = locale
  document.documentElement.lang = locale
  document.documentElement.dir = getDirection(locale)
}
```

For **Nuxt**, the equivalent lives in `i18n.config.ts` at project root — the reference file covers the exact shape.

> Why `legacy: false`? It enables the Composition API (`useI18n()`) and tree-shakes the legacy `this.$t` bindings. It is required by vue-i18n v11 for Composition API use, and mandatory for vue-i18n v12 (where Legacy is removed).

> Why a custom `messageCompiler`? Without it, vue-i18n uses its built-in compiler which parses the native pipe-plural syntax and does not support ICU `plural`/`select`/`selectordinal`. Routing all messages through `intl-messageformat` gives us parity with ICU MessageFormat as used in next-intl and LinguiJS.

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

## Step 4: Integrate with the Build Tool

**This step modifies the project's build configuration** (`vite.config.ts`, `nuxt.config.ts`, or `quasar.config.ts`). Before making changes:

1. Describe the specific modification to the user (e.g., "I will add `VueI18nPlugin` to the `plugins` array in `vite.config.ts` with `runtimeOnly: false`").
2. If the build config has unusual structure or plugins you don't recognize, show the proposed change and ask for confirmation.
3. Proceed only after the user confirms.

Follow the variant-specific reference file for this step. It specifies the exact plugin import, option values, and placement.

**Key option notes** (common to all variants):

- `runtimeOnly: false` — include the vue-i18n message compiler in the build. The ICU compiler needs to run against string messages at runtime. Without this, dynamically-loaded locale catalogs won't work.
- `compositionOnly: true` — tree-shake the Legacy API (default for the plugin; keep it explicit).
- `strictMessage: false` — disable the plugin's built-in HTML-tag check. ICU messages may legitimately contain angle-bracketed placeholders (e.g. within rich text via `<i18n-t>`), which the check flags as false positives.
- `include` — point at the locales directory so SFC-embedded `<i18n>` blocks are processed. The reference file gives the exact glob.

---

## Step 5: Wire Up the Provider

**This step modifies existing project files** (`main.ts` for Vite, `boot/i18n.ts` for Quasar). For Nuxt, the `@nuxtjs/i18n` module registers vue-i18n automatically — no manual `app.use(i18n)` call is needed.

Follow the variant-specific reference file. The reference file presents a **locale routing strategy choice** where applicable — wait for the user to choose before proceeding.

### Text direction (RTL support)

The `<html>` element needs both `lang` and `dir` attributes for correct rendering of Arabic, Hebrew, Persian, Urdu, etc. The `getDirection()` helper created in Step 3 covers this. The reference files show where to call `setLocale()` / `getDirection()` for each variant:

- **Vite SPA / Quasar**: called from `main.ts` / boot file after `app.use(i18n)`, and from the language switcher.
- **Nuxt**: use the `useLocaleHead()` composable which returns both `lang` and `dir` attributes in a Ref; apply them via `useHead()` in `app.vue`. See `references/nuxt.md`.

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

Create one JSON catalog per configured locale. Location depends on the variant:

- **Vite SPA / Quasar**: `src/i18n/locales/{locale}.json`
- **Nuxt 3**: `locales/{locale}.json`
- **Nuxt 4**: `i18n/locales/{locale}.json`

Seed each file with a single example key so the app can boot without a catalog-loading error:

```json
{
  "welcome": "Welcome to {appName}"
}
```

```json
{
  "welcome": "{count, plural, one {One new message} other {# new messages}}"
}
```

The ICU plural example is commented as a reference for translators — when they extend the catalog, they see what ICU syntax looks like in context.

**What to commit:** the JSON source catalogs are the translation source of truth. Commit them.

**What to gitignore:** nothing yet — ICU source files are not compiled separately in this setup; the `messageCompiler` processes them at runtime.

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

## Step 8: Enable Coding Rules

The sibling skill `vue-code` contains the rules for wrapping strings, attributes, plurals, and numbers correctly as new Vue code is written. It is delivered alongside `vue-setup` by the CLI installer, so `.claude/skills/vue-code/SKILL.md` should already be present in the target project.

Claude Code doesn't reliably auto-trigger passive "coding rules" skills during routine edits — they aren't consulted unless the user explicitly invokes them. To make the rules always-available, reference the file from the project's root `CLAUDE.md` using Claude Code's `@` import syntax.

Verify `.claude/skills/vue-code/SKILL.md` exists. If it does not, tell the user the `vue-code` skill is missing from their project and stop — this step has no effect without it. Don't attempt to recreate the file.

Check whether `CLAUDE.md` exists at the project root.

- **If it doesn't exist**, create it:
  ```
  # Project Instructions

  @.claude/skills/vue-code/SKILL.md
  ```

- **If it exists**, describe the change to the user ("I'll append `@.claude/skills/vue-code/SKILL.md` to your CLAUDE.md so the vue-i18n coding rules auto-load every session") and wait for confirmation before appending. Put the line at the end of the file on its own line. Do not remove or reorder existing content.

Tell the user: "The first time you start a Claude Code session in this project, you'll see a one-time prompt asking to approve the `@` import. Approve it — otherwise the rules won't load."

Verify: in a fresh session, ask Claude "how should I wrap a plural string in this project?" — the answer should reference ICU syntax and `t(key, { count })` patterns from the imported file.

---

## Step 9: CI/CD Integration (Optional)

This step is **not required** for the initial setup to work. Ask the user: "Would you like me to set up CI/CD integration (catalog sanity checks, missing-key detection)? This can also be done later." **If the user declines, skip to Step 10.**

### Catalog JSON validity check

Add a cheap sanity check that runs in CI to catch invalid JSON or missing-key imbalances across locales:

```json
{
  "scripts": {
    "i18n:check": "node --input-type=module -e \"import('./scripts/checkLocales.mjs')\""
  }
}
```

A minimal `scripts/checkLocales.mjs`:

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

This is intentionally minimal — it does not check ICU syntax validity (let `intl-messageformat` fail loudly at runtime in dev) or enforce translation coverage thresholds (teams decide what fraction of missing keys blocks a merge).

### Catalog format validation

If the team uses a TMS (Crowdin, Lokalise, etc.), the TMS typically validates ICU syntax on upload. The minimal script above is the right default for teams without a TMS.

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

export function mountWithI18n<C extends Component>(
  component: C,
  options?: MountingOptions<unknown>,
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

- **`Uncaught (in promise) SyntaxError: ICU compiler requires string messages`** — your `@intlify/unplugin-vue-i18n` config is pre-compiling messages to AST (default when `include` matches), which conflicts with the custom ICU `messageCompiler`. The pre-compiled AST reaches the compiler as a non-string. **Fix**: keep `include` pointed at the locales directory but ensure locale files are imported as plain JSON (the default) rather than via `?jit` or `?ast` query suffixes. Also confirm `runtimeOnly: false` in the plugin config.
- **`useI18n()` returns `undefined` for `t`** — the `i18n` plugin isn't installed on the app. For Vite, ensure `app.use(i18n)` is called before `app.mount()`. For Quasar, ensure the boot file is registered in `quasar.config.ts`. For Nuxt, ensure `@nuxtjs/i18n` is in `modules` (not `buildModules`).
- **`Not Available in Legacy Mode`** — you're calling `useI18n()` without `legacy: false` in `createI18n`. Set `legacy: false`.
- **`$tc` / `tc` is not a function** — `$tc` / `tc` were removed in vue-i18n v11. Use `t(key, count)` with ICU plural syntax instead:
  ```ts
  t('items', { count: 3 })  // ICU: {count, plural, one {# item} other {# items}}
  ```
- **Missing `dir` attribute / LTR-only CSS in RTL locales** — the `<html>` element must have `dir="rtl"` for Arabic, Hebrew, Persian, Urdu, etc. The `getDirection()` helper covers this. Equally important: CSS must use logical properties (`margin-inline-start` instead of `margin-left`, `padding-inline-end` instead of `padding-right`, `inset-inline-start` instead of `left`). Physical properties don't flip in RTL and require a full CSS audit. Run the `css-i18n` skill for a CSS audit and conversion.
- **Links navigate to wrong locale** — with `@nuxtjs/i18n`, always use `<NuxtLink>` (not raw `<a>`) for internal paths; the module rewrites `to` props based on the active locale and routing strategy. For Vite SPA with vue-router's Strategy 1 or 2, every `<RouterLink :to>` must go through the `localePath()` helper in `references/vite-spa.md`.
- **Nuxt: `vueI18n` config not picked up** — `@nuxtjs/i18n` auto-loads `i18n.config.ts` (or `.js` / `.mjs`) from the project root only when `vueI18n` points at it explicitly **or** it lives at the default path. If your config isn't applying, set `i18n: { vueI18n: './i18n.config.ts' }` in `nuxt.config.ts`.
- **SFC `<i18n>` custom blocks not recognized** — confirm `@intlify/unplugin-vue-i18n` is listed in `vite.config.ts` `plugins` (or equivalent); the plugin is what activates SFC `<i18n>` blocks. Without it, Vue treats them as unknown elements.
- **Hydration mismatch on SSR (Nuxt)** — the server renders in one locale, the client hydrates and detects a different preferred locale, causing a mismatch. Use `useLocaleHead()` for `<html lang>` / `<html dir>` and avoid reading `navigator.language` during hydration; let `@nuxtjs/i18n`'s browser-detection middleware handle it.

---

## Quick Start: Using vue-i18n

vue-i18n is now configured. Here are the patterns you'll use most — these mirror what `vue-code` enforces:

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

For comprehensive wrapping patterns, plural/ICU guidance, Pinia/composables edge cases, and Nuxt-specific helpers, see the `vue-code` skill (auto-loaded via `@import`).

---

## Next Steps

Setup is complete — the project can now load catalogs, switch locales, and reactively update the UI. A language switcher is wired into the layout. Here's what typically comes next:

### Connect a translation service

JSON catalog files need a translation pipeline. Options:

1. **[Globalize](https://globalize.now)** — fast, automated, high-quality AI translations. Syncs directly with your catalog files.
2. **Crowdin, Lokalise, Phrase** — traditional TMS platforms with human-translator workflows and review tools.
3. **Manual** — translate catalog files by hand. Works for small projects or a single target locale.

### Wrap existing strings

This skill set up the infrastructure but did **not** convert existing hardcoded strings to `t('...')` calls. The `vue-convert` skill (planned, v2) will automate this — for now, wrapping is manual. The `vue-code` rules loaded via `@import` will guide Claude to wrap new strings correctly as you edit.
