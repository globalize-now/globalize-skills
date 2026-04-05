# i18n Guide Skill Design

## Context

Users who want to add internationalization to their project often don't know which library to use. Currently, each skill (lingui-setup, next-intl-setup) triggers on its own library name, but there's no entry point for generic intent like "add i18n" or "internationalize my app." This skill fills that gap — it detects the project stack, recommends the best supported library, and hands off to the matching setup skill automatically.

## Skill Identity

- **Name**: `i18n-guide`
- **Location**: `skills/i18n/guide/SKILL.md`
- **Trigger**: Generic i18n intent without a specific library named
  - "add i18n", "internationalize", "add translations", "multi-language support", "localize my app", "make my app multilingual"
  - Does NOT trigger when a specific library is mentioned (lingui, next-intl, i18next, react-intl) — those go directly to library-specific skills

## Detection

Read the nearest `package.json` (for monorepos, use the one closest to the working directory) and project structure:

| Signal | How to detect |
|---|---|
| Framework | `next` in deps → Next.js. `vite` in devDeps → Vite. `react-scripts` → CRA |
| React | `react` in deps |
| Existing i18n lib | `@lingui/*`, `next-intl`, `react-intl`, `i18next`, `react-i18next` in deps |
| Next.js router | `app/` dir with `layout.tsx`/`layout.js` → App Router. `pages/` dir → Pages Router |
| Package manager | `package-lock.json` → npm. `yarn.lock` → yarn. `pnpm-lock.yaml` → pnpm. `bun.lock` → bun |

## Decision Rules

Evaluated top-to-bottom, first match wins:

1. **Not a React project** → STOP: "No supported i18n skill for this stack yet. This guide currently covers React-based projects."

2. **Already has an i18n library installed** → STOP: "Project already uses `{library}`. If it needs configuration, run the matching setup skill."

3. **Next.js App Router** → Recommend **next-intl**.
   Rationale: "next-intl is purpose-built for Next.js App Router with first-class RSC support, middleware-based locale routing, and type-safe message keys."

4. **Next.js Pages Router** → STOP: "No supported skill covers Next.js Pages Router yet."

5. **Vite / CRA / other React SPA** → Recommend **lingui**.
   Rationale: "LinguiJS is a compile-time i18n framework that extracts messages at build time, producing zero-runtime-overhead translations with ICU MessageFormat support."

### Edge cases

- **Multiple frameworks detected** (e.g., both `next` and `vite` in deps): Next.js takes precedence.
- **Monorepo**: Detect from the closest `package.json` to the working directory.
- **User disagrees**: The setup skills have their own hard-stop checks. If the user insists on a different supported library (e.g., lingui for a Next.js project), that's fine — lingui-setup handles Next.js App Router too.

## Handoff

After presenting the recommendation with a one-paragraph rationale, immediately invoke the matching setup skill (`lingui-setup` or `next-intl-setup`). No confirmation step — the setup skill's own guided/unguided mode and incompatibility checks provide the safety net.

## Skill Structure

```
skills/i18n/guide/
  SKILL.md          # Detection, decision tree, rationale text, handoff instructions
```

No `references/` directory needed — the logic is simple enough for a single file.

## Verification

1. Install the skill into a Next.js App Router project → should recommend next-intl and hand off to next-intl-setup
2. Install into a Vite + React project → should recommend lingui and hand off to lingui-setup
3. Install into a project with `react-intl` already in deps → should stop with "already uses react-intl"
4. Install into a non-React project (e.g., plain Node.js) → should stop with "not supported"
5. Say "add lingui to my project" → skill should NOT trigger (specific library mentioned)
