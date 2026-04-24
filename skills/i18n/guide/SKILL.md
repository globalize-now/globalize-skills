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
  (LinguiJS, Lingui, next-intl, i18next, react-intl, vue-i18n, @nuxtjs/i18n,
  Nuxt i18n, @intlify, i18next-vue, @tolgee/vue) — those go directly to
  library-specific skills.
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
| **Astro** | `astro` in deps. |
| **Other frontend frameworks** | `@angular/core` → Angular. `@sveltejs/kit` → SvelteKit. `svelte` (without `@sveltejs/kit`) → Svelte. `@solidjs/start` → Solid Start. `solid-js` (without `@solidjs/start`) → Solid. `lit` → Lit. `@builder.io/qwik-city` → Qwik City. `@builder.io/qwik` (without `qwik-city`) → Qwik. |
| **API server (no frontend framework)** | `express`, `fastify`, `hono`, `@nestjs/core`, or `@trpc/server` in deps with no React, Vue, or other frontend framework present. |
| **Existing i18n lib** | `@lingui/core`, `@lingui/react`, `next-intl`, `react-intl`, `i18next`, `react-i18next`, `vue-i18n`, `@nuxtjs/i18n`, `i18next-vue`, `@tolgee/vue`, `fluent-vue` in deps or devDeps. |
| **Next.js router** | `app/` directory with `layout.tsx` or `layout.js` → App Router. `pages/` directory with `_app.tsx` or `_app.jsx` → Pages Router. |
| **Package manager** | `package-lock.json` → npm. `yarn.lock` → yarn. `pnpm-lock.yaml` → pnpm. `bun.lock` → bun. |

---

## Step 2: Check Compatibility

Evaluate these hard stops top-to-bottom. If any applies, stop immediately — do not proceed to Step 3.

1. **Unsupported framework** — no `react` and no `vue` in deps or devDeps, **and `astro` is not in deps** (Astro has its own dedicated stop below). Identify which framework was detected in Step 1 and tailor the message:
   **STOP.** Tell the user (pick the matching branch):
   - **Angular** (`@angular/core`): "No Angular i18n skill here yet. Use `@angular/localize` — the official Angular i18n package, integrated with the Angular CLI and AOT compiler."
   - **Svelte / SvelteKit** (`svelte`, `@sveltejs/kit`): "No Svelte i18n skill here yet. For SvelteKit use `@inlang/paraglide-sveltekit` (compile-time, type-safe, SSR-aware). For plain Svelte, `svelte-i18n` is a simpler runtime alternative."
   - **Solid / Solid Start** (`solid-js`, `@solidjs/start`): "No Solid i18n skill here yet. Use `@solid-primitives/i18n` — the community-standard primitive-based library that fits Solid's reactivity model."
   - **Lit** (`lit`): "No Lit i18n skill here yet. Use `@lit/localize` — the official Lit i18n package. Wrap strings with `msg()` and configure runtime mode via `configureLocalization()` (or transform mode via `configureTransformLocalization()`). It ships an XLIFF-based extraction pipeline via `lit-localize extract`."
   - **Qwik / Qwik City** (`@builder.io/qwik`, `@builder.io/qwik-city`): "No Qwik i18n skill here yet. Use `qwik-speak` — the community standard for Qwik, compatible with Qwik City's resumability model."
   - **API server only** (`express`, `fastify`, `hono`, `@nestjs/core`, `@trpc/server` with no frontend framework): "Server-only API stacks are out of scope here — translation typically happens on the consumer client (React / Vue). If the server renders templates or returns localized responses directly, look at `i18next` (with `i18next-http-middleware`), `nestjs-i18n`, or `@fastify/i18n`."
   - **Fallback** (nothing identifiable): "No supported i18n skill for this stack yet. This guide currently covers React-based and Vue-based projects."

2. **Already has an i18n library installed** — any of `@lingui/core`, `@lingui/react`, `next-intl`, `react-intl`, `i18next`, `react-i18next`, `vue-i18n`, `@nuxtjs/i18n`, `i18next-vue`, `@tolgee/vue`, `fluent-vue` found in deps or devDeps.
   **STOP.** Tell the user: "This project already uses `{library}`. For React projects, run the matching convert skill (`lingui-convert` or `next-intl-convert`) to wrap existing strings. A Vue convert skill is not yet available — if you have `vue-i18n` (or `@nuxtjs/i18n`) installed but setup is incomplete, re-run `vue-setup`; otherwise continue with your library's own conventions."

3. **React Native / Expo** — `react-native`, `expo`, or any `@expo/*` package found in deps.
   **STOP.** Tell the user: "This guide doesn't cover React Native / Expo. The LinguiJS setup expects a web build pipeline (Vite / Next.js / CRA) and would fail. For React Native, set up manually with `expo-localization` (for device locale) plus either `i18n-js` or `react-i18next` as the message runtime. vue-i18n / next-intl do not apply here."

4. **Gatsby** — `gatsby` found in deps.
   **STOP.** Tell the user: "This guide doesn't cover Gatsby yet. The LinguiJS setup would hit a 'custom build pipeline' stop because Gatsby doesn't use Vite / Next.js / CRA. For manual setup, use `gatsby-plugin-react-i18next` (if you want a turn-key solution), or wire Lingui yourself via Gatsby's `gatsby-node.ts#onCreateBabelConfig` hook to add `@lingui/babel-plugin-lingui-macro`. If you want a dedicated Gatsby reference added to this skill, open an issue."

5. **react-email** — `react-email` or any `@react-email/*` package found in deps.
   **STOP.** Tell the user: "This guide doesn't cover react-email. Email templates don't fit the SPA model — there is no client runtime, no Vite/Next.js plugin hook, and messages are rendered through react-email's own CLI. For localizing email templates, use `@formatjs/intl` or direct `Intl.*` calls with locale-specific template files."

6. **Astro** — `astro` found in deps.
   **STOP.** Tell the user: "Astro has its own i18n primitives (`astro:i18n`, content-collection-based catalogs) and an island architecture that doesn't fit the React-SPA / Next.js / Vue model assumed here. Even with `@astrojs/react`, Astro's islands hydrate independently — none of our setup recipes apply cleanly. Use Astro's built-in i18n, or `astro-i18next` if you need more features. If you want a dedicated Astro reference added to this guide, open an issue."

7. **Remix** — `@remix-run/dev`, `@remix-run/react`, or `@remix-run/node` found in deps.
   **STOP.** Tell the user: "This guide doesn't cover Remix yet. The LinguiJS Vite reference assumes `@vitejs/plugin-react`'s `babel.plugins` passthrough, which Remix's `vitePlugin` does not expose, and the provider pattern used here reads `window` / `localStorage` at module scope which crashes under Remix SSR. Use `remix-i18next` for a Remix-native i18n setup. If you want a dedicated Remix reference added to this skill, open an issue."

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
