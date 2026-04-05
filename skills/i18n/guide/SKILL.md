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
| **Framework** | `next` in deps → Next.js. `vite` in devDeps → Vite. `react-scripts` in deps → CRA. |
| **React** | `react` in deps or devDeps. |
| **Existing i18n lib** | `@lingui/core`, `@lingui/react`, `next-intl`, `react-intl`, `i18next`, `react-i18next` in deps or devDeps. |
| **Next.js router** | `app/` directory with `layout.tsx` or `layout.js` → App Router. `pages/` directory with `_app.tsx` or `_app.jsx` → Pages Router. |
| **Package manager** | `package-lock.json` → npm. `yarn.lock` → yarn. `pnpm-lock.yaml` → pnpm. `bun.lock` → bun. |

---

## Step 2: Check Compatibility

Evaluate these hard stops top-to-bottom. If any applies, stop immediately — do not proceed to Step 3.

1. **Not a React project** — no `react` in deps or devDeps (or a non-React framework like `vue`, `svelte`, `@angular/core`, or `solid-js` is the primary dependency).
   **STOP.** Tell the user: "No supported i18n skill for this stack yet. This guide currently covers React-based projects."

2. **Already has an i18n library installed** — any of `@lingui/core`, `@lingui/react`, `next-intl`, `react-intl`, `i18next`, `react-i18next` found in deps or devDeps.
   **STOP.** Tell the user: "This project already uses `{library}`. To wrap existing strings, run the matching translate skill (e.g., `lingui-translate` or `next-intl-translate`). If setup is incomplete, run the matching setup skill directly."

---

## Step 3: Recommend a Library

Apply these rules in order — use the first match.

### Rule 1: Next.js detected

`next` is present in deps (any router).

**Recommend next-intl.**

Present this rationale to the user:

> next-intl is purpose-built for Next.js, supporting both App Router (with first-class RSC support and middleware-based locale routing) and Pages Router (with built-in i18n routing). It uses ICU MessageFormat and requires no compile step.

### Rule 2: Vite / CRA / other React SPA

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
| LinguiJS | `lingui-setup` |

---

## Edge Cases

- **Multiple frameworks detected** (e.g., both `next` and `vite` in deps): Next.js takes precedence — apply Rule 1.
- **Monorepo**: Detect from the closest `package.json` to the working directory. Do not aggregate deps across workspace packages.
- **User disagrees with recommendation**: That is fine — the setup skills have their own compatibility checks. If the user insists on lingui for a Next.js project, invoke `lingui-setup` instead. It will handle that case.
