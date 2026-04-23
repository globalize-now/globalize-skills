## remix

### Detection
- Framework: Remix v2 (on Vite)
- Router: Remix file-based routing at `app/routes/` (v2 flat-file convention)
- Package manager: npm (package-lock.json)
- Existing i18n lib: none

### i18n-guide
- Recommended: LinguiJS (Rule 3 — `vite` in devDeps, `react` in deps, no `next`, no `vue`)
- STOP reason (if any): N/A

### Setup skill
- Skill: `lingui-setup` (variant: vite-babel, used as the closest fit — no Remix reference exists)
- Outcome: partial
- Files changed:
  - `/tmp/i18n-skill-eval/remix/app/i18n/locales.ts` — source/target locale constants
  - `/tmp/i18n-skill-eval/remix/app/i18n/i18n.ts` — i18n instance, `getDirection`, `resolveLocale`, `loadCatalog`
  - `/tmp/i18n-skill-eval/remix/lingui.config.ts` — per-page extractor config rooted at `app/routes/**/*.tsx`
  - `/tmp/i18n-skill-eval/remix/vite.config.ts` — added `vite-plugin-babel` (not in skill) + `@lingui/vite-plugin`
  - `/tmp/i18n-skill-eval/remix/app/root.tsx` — synchronous source-locale activation + `I18nProvider` wrap; kept hardcoded `<html lang>`
  - `/tmp/i18n-skill-eval/remix/app/components/LanguageSwitcher.tsx` — Option-3-style reload-on-change switcher (not wired into layout)
  - `/tmp/i18n-skill-eval/remix/package.json` — `lingui:extract` and `lingui:compile` scripts
  - `/tmp/i18n-skill-eval/remix/.gitignore` — ignore compiled catalogs under `app/**/locales/**/*.ts`
  - `/tmp/i18n-skill-eval/remix/CLAUDE.md` — created, `@import`s `lingui-code/SKILL.md`
- Deps added: `@lingui/core`, `@lingui/react`, `@lingui/macro`, `@lingui/detect-locale` (runtime); `@lingui/cli`, `@lingui/babel-plugin-lingui-macro`, `@lingui/vite-plugin`, `vite-plugin-babel`, `@babel/preset-typescript` (dev — the last two are deviations from the skill)
- Blockers: none hard-blocking, but: (1) no Remix reference in `references/`; (2) `@remix-run/dev`'s vitePlugin does not accept `babel.plugins` the way `@vitejs/plugin-react` does, so the skill's Step 4 instructions are unexecutable as written — used `vite-plugin-babel` to inject the macro transform, which works but is outside the skill; (3) Remix is SSR by default and none of the reference variants handle hydration of locale; (4) the skill's provider patterns (and the vite-babel "single catalog" top-level `loadCatalog(detectLocale())`) use `window`/`localStorage` at module scope, which would crash under Remix's SSR — replaced with a minimal SSR-safe source-locale activation.

### Convert skill
- Skill: `lingui-convert`
- Outcome: success (manual, following the skill's macro decision tree for one route file)
- Strings wrapped (count): 9 messages extracted from `app/routes/_index.tsx` (short heading, long paragraph, paragraph with inline `<Link>`, interpolated greeting, currency line, date line, `<Trans>` containing `<Plural>`, two standalone `<Plural>` items, gender `<Select>`). Also replaced `"en-US"` locale literals in `Intl.NumberFormat`/`DateTimeFormat` with `i18n.locale` (localization-gap fix).
- Strings skipped/failed: none in the single route file. The `<li>{itemsLabel(0)}</li>`/`(1)`/`(5)` set was rewritten to three bare `<Plural>` components — this changes the call-site shape (the original `itemsLabel` helper is gone). Acceptable per the convert skill's cross-module rule but worth flagging.
- Blockers: none

### Deviations from SKILL.md
- i18n-guide's Rule 3 covers Remix only implicitly ("Vite / CRA / other React SPA"). Remix is SSR, not an SPA — Rule 3 routes it to Lingui but the setup skill has no SSR-aware variant.
- `lingui-setup` Step 1 detection table has no entry for Remix: no `@vitejs/plugin-react-swc`, no `@vitejs/plugin-react`, no `next`, no `@tanstack/react-start`. Four reference files; none matches Remix.
- "Custom build pipeline" STOP does not fire (vite.config.ts is present), so the skill silently proceeds into a variant that doesn't fit.
- `vite-babel.md` Step 4 wires macros via `react({ babel: { plugins: [...] } })`. Remix's `@remix-run/dev` vitePlugin exposes no such option. Added `vite-plugin-babel` + `@babel/preset-typescript` to inject the macro transform — this works but is an improvisation.
- `vite-babel.md` "Single catalog" path executes `loadCatalog(detectLocale())` at module top level and calls `localStorage`/`document`/`window` unconditionally. Under Remix SSR this throws. Replaced with synchronous empty-catalog activation of the source locale and a `typeof window === "undefined"` guard in the switcher.
- `app/routes/` looks like the React Router v7 framework-mode glob, but Remix v2's loader return/types differ from RR v7 (no `+types/...` generated files, no `redirect` with same typing). The reference's per-page catalog loader examples would need adaptation.
- No language-switcher wiring into `root.tsx` was performed (the reference's wiring examples assume TanStack/React-Router/main.tsx patterns) — left the component created but unwired, which is a documented deviation.
- Step 9 (`CLAUDE.md` creation) succeeded; Steps 10 (build-script prepend of `lingui compile`) and 11 (test wrapper) were skipped in the interest of the timebox.

### Overall verdict
A real user would land in a half-working state without a human-guided course correction. The i18n-guide handoff is correct (LinguiJS is genuinely the right library for a React-based Remix app given the available skills), and the macro pipeline does end up functional — `lingui extract-experimental`, `lingui compile --typescript`, and `remix vite:build` all succeed, and the compiled output shows `<Trans id="okRPtW">`, confirming the Babel macro plugin actually ran. But getting there required two meaningful improvisations the skill does not document: adding `vite-plugin-babel` because Remix's vitePlugin cannot accept Lingui's Babel plugin the way the reference assumes, and replacing the SSR-hostile module-top-level `loadCatalog(detectLocale())` with synchronous source-locale activation. The weakest link is the absence of a Remix-aware reference file — the detection table in Step 1 of `lingui-setup` silently funnels Remix into `vite-babel`, whose build-config shape and SPA-only provider assumption both mismatch. A full, user-switchable, SSR-correct locale pipeline (cookie-based locale on the server, matching catalog on the client for hydration parity) is not set up and would be the next real piece of work.
