---
name: i18n-guide
description: >-
  Guide users to the right i18n library for their project. Use this skill when
  the user asks to add localization, internationalization, i18n, translations,
  or multi-language support without naming a specific library. Triggers on
  "add i18n", "internationalize my app", "add translations", "multi-language
  support", "localize my app", "make my app multilingual", "I want to translate
  my app", "make my app support multiple languages", "add language support",
  or any generic request about translating, localizing, or internationalizing
  an application. Does NOT trigger when a specific library is mentioned
  (LinguiJS, Lingui, next-intl, i18next, react-intl) — those go directly
  to library-specific skills.
---

# i18n Library Guide

This skill detects the project's stack, recommends the best-supported i18n library, and hands off directly to the matching setup skill. It does not perform setup itself.

---

## Step 1: Detect the Project

Read the nearest `package.json` (closest to the working directory) and inspect the project structure. If no `package.json` is found, **STOP** — tell the user: "This guide covers JavaScript/TypeScript projects. No `package.json` found."

| Signal | How to detect |
|--------|--------------|
| **Framework** | `next` in deps → Next.js. `vite` in devDeps → Vite. `react-scripts` in deps → CRA. `nuxt` in deps → Nuxt. `vue` in deps (without Next.js / CRA / Nuxt) → Vue (Vite SPA or Quasar). |
| **React** | `react` in deps or devDeps. |
| **Existing i18n lib** | `@lingui/core`, `@lingui/react`, `next-intl`, `react-intl`, `i18next`, `react-i18next`, `vue-i18n`, `@nuxtjs/i18n`, `i18next-vue`, `@tolgee/vue`, `fluent-vue` in deps or devDeps. |
| **Next.js router** | `app/` directory with `layout.tsx` or `layout.js` → App Router. `pages/` directory with `_app.tsx` or `_app.jsx` → Pages Router. |
| **Package manager** | `package-lock.json` → npm. `yarn.lock` → yarn. `pnpm-lock.yaml` → pnpm. `bun.lock` → bun. |

---

## Step 2: Check Compatibility

Evaluate these hard stops top-to-bottom. If any applies, stop immediately — do not proceed to Step 3.

1. **Unsupported framework** — no `react` and no `vue` in deps or devDeps (or a non-supported framework like `svelte`, `@angular/core`, or `solid-js` is the primary dependency).
   **STOP.** Tell the user: "No supported i18n skill for this stack yet. This guide currently covers React-based and Vue-based projects."

2. **Already has an i18n library installed** — any of `@lingui/core`, `@lingui/react`, `next-intl`, `react-intl`, `i18next`, `react-i18next`, `vue-i18n`, `@nuxtjs/i18n`, `i18next-vue`, `@tolgee/vue`, `fluent-vue` found in deps or devDeps.
   **STOP.** Tell the user: "This project already uses `{library}`. For React projects, run the matching convert skill (`lingui-convert` or `next-intl-convert`) to wrap existing strings. A Vue convert skill is not yet available — if you have `vue-i18n` (or `@nuxtjs/i18n`) installed but setup is incomplete, re-run `vue-setup`; otherwise continue with your library's own conventions."

---

## Step 3: Recommend a Library

Apply these rules in order — use the first match.

### Rule 1: Next.js detected

`next` is present in deps (any router).

**Recommend next-intl.**

Present this rationale to the user:

> next-intl is purpose-built for Next.js, supporting both App Router (with first-class RSC support and middleware-based locale routing) and Pages Router (with built-in i18n routing). It uses ICU MessageFormat and requires no compile step.

### Rule 2: Vue detected

`vue` in deps (and `next` is not present).

**If `nuxt` is also in deps → recommend `@nuxtjs/i18n`.**

Present this rationale to the user:

> `@nuxtjs/i18n` wraps vue-i18n with Nuxt-specific routing (locale-prefixed paths, `switchLocalePath`), lazy-loaded locale catalogs, and SSR-safe SEO meta via `useLocaleHead`. For Nuxt, it is the canonical choice.

**Otherwise (Vite SPA, Quasar, or other Vue 3 setup) → recommend `vue-i18n`.**

Present this rationale to the user:

> vue-i18n is the official Intlify library and the de facto standard across Vue 3 projects. v11 supports the Composition API (`useI18n()` in `<script setup>`), ICU MessageFormat via a custom `messageCompiler`, and integrates with Vite through `@intlify/unplugin-vue-i18n`.

Both paths hand off to `vue-setup` (one skill covers both variants).

### Rule 3: Vite / CRA / other React SPA

No `next` in deps, but `react` is present.

**Recommend LinguiJS.**

Present this rationale to the user:

> LinguiJS is a compile-time i18n framework that extracts messages at build time, producing zero-runtime-overhead translations. It supports ICU MessageFormat with macros like `<Trans>` and `` t`...` `` that get compiled away.

---

## Step 4: Hand Off to the Setup Skill

After presenting the recommendation, proceed to the matching setup skill. The setup skill will offer guided or unguided mode before making any changes.

| Recommendation | Skill to invoke |
|----------------|----------------|
| next-intl | `next-intl-setup` |
| vue-i18n (including Nuxt's `@nuxtjs/i18n`) | `vue-setup` |
| LinguiJS | `lingui-setup` |

---

## Edge Cases

- **Multiple frameworks detected** (e.g., both `next` and `vite` in deps): Next.js takes precedence — apply Rule 1.
- **Both `vue` and `react` in the nearest `package.json`**: Use whichever framework clearly owns the app (look at which framework's meta-files exist — `nuxt.config.*`, `vite.config.*` with react plugin, etc.). If truly ambiguous, ask the user.
- **Monorepo**: Detect from the closest `package.json` to the working directory. Do not aggregate deps across workspace packages.
- **User disagrees with recommendation**: That is fine — the setup skills have their own compatibility checks. If the user insists on lingui for a Next.js project, invoke `lingui-setup` instead. It will handle that case.
