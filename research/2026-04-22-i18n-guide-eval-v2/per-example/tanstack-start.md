## tanstack-start

### Detection
- Framework: TanStack Start (React 19, Vite 8, Nitro)
- Router: File-based via `@tanstack/react-start` / `@tanstack/react-router` (SSR), `src/routes/`
- Package manager: npm (`package-lock.json`)
- Existing i18n lib: None

### i18n-guide
- Recommended: LinguiJS (Rule 3: Vite/CRA/other React SPA — no `next`, no `vue`, `react` present)
- STOP reason (if any): N/A

### Setup skill
- Skill: `lingui-setup` → `references/tanstack-start.md`
- Outcome: success
- Files changed:
  - `package.json` — added lingui deps + `lingui:extract`/`lingui:compile`/`build` scripts
  - `vite.config.ts` — added `@lingui/babel-plugin-lingui-macro` via `viteReact({ babel })`, `lingui()` plugin, `routeFileIgnorePattern: 'locales/'`
  - `lingui.config.ts` — per-page experimental extractor, JSON formatter
  - `src/i18n/locales.ts` — `locales`, `sourceLocale`, `resolveLocale`
  - `src/i18n/index.ts` — `i18n`, `activateLocale`, `getDirection`
  - `src/start.ts` — `createStart` global request middleware resolving locale from cookie/Accept-Language
  - `src/server/locale.ts` — `getLocale`/`setLocale` server functions
  - `src/routes/__root.tsx` — Strategy 1 URL-first `beforeLoad`, `shellComponent` renders `<html lang>`/`dir`, wraps `I18nProvider` + `LanguageSwitcher`, side-effect imports `../start`
  - `src/routes/index.tsx` — source-locale route loading co-located catalog
  - `src/routes/$locale/index.tsx` — target-locale twin route
  - `src/pages/Profile.tsx` — shared page component (extracted from index.tsx)
  - `src/components/LanguageSwitcher.tsx` — Strategy 1 switcher
  - `.gitignore` — added `src/**/locales/**/*.ts`
  - `CLAUDE.md` — `@.claude/skills/lingui-code/SKILL.md` import
  - Seed catalogs at `src/routes/locales/index/{en,es}.ts` and `src/routes/$locale/locales/index/{en,es}.ts` (bootstrap; overwritten on first compile)
- Deps added: `@lingui/core`, `@lingui/react`, `@lingui/macro` (runtime); `@lingui/cli`, `@lingui/babel-plugin-lingui-macro`, `@lingui/vite-plugin`, `@lingui/format-json` (dev); plus downgraded `@vitejs/plugin-react` `^6.0.1` → `^5.2.0` (see Deviations)
- Blockers: None

### Convert skill
- Skill: `lingui-convert`
- Outcome: success
- Strings wrapped (count): 8 (Your profile h1; Welcome back with interpolation; long paragraph; privacy-policy inline-link paragraph; currency total via `i18n.number`; date via `i18n.date`; plural with `<Plural>` incl. `_0`; gender `<Select>`). Extractor confirms 8 messages per page entry.
- Strings skipped/failed: 0
- Blockers: None. `npm run build` succeeds; dev server returns 200 for `/` (`<html lang="en">`) and `/es` (`<html lang="es">`) with all 8 strings rendered correctly.

### Deviations from SKILL.md
- **`@vitejs/plugin-react` v5/v6 contradiction.** Main `lingui-setup/SKILL.md` Step 1 says plugin-react v6+ dropped the `babel` option and the project should be treated as SWC (`references/vite-swc.md`). But the project also has `@tanstack/react-start` in deps, which routes to `references/tanstack-start.md`, whose Step 4 uses `viteReact({ babel: { plugins: [...] } })`. The two rules collide; there's no "TanStack Start + plugin-react@6" variant. Resolved by downgrading `@vitejs/plugin-react` to `^5.2.0` so the Babel seam in tanstack-start.md works. Skill should either (a) add a TanStack-Start-on-SWC variant, or (b) have tanstack-start.md pin the plugin-react range.
- **Catalog format vs. reference file.** Unguided default is JSON, but tanstack-start.md examples (gotchas section) reference `.po` filenames. JSON worked fine — compiled output is still `.ts` — but the reference text is misleading.
- **`routeFileIgnorePattern: 'locales/'` still warns.** With the pattern set, `@tanstack/router-plugin` still emits `Warning: Route file "..." does not export a Route. This file will not be included in the route tree.` for every seed/compiled catalog `.ts` under `locales/`. Files are excluded (correctly), but dev-server output is noisy. Consider recommending `-` prefix or a tighter pattern in the reference.
- **Strategy 1 language-switcher href has trailing slash mismatch.** `hrefFor(loc)` returns `/es/` (because `basePath` keeps the trailing slash after prefix strip) while TanStack Router's canonical path is `/es`. The server responds 307 on `/es/` → `/es`, so navigation still works but users pay a redirect round-trip on locale switch. Worth tightening in the reference.
- **Bootstrap seed files.** The "First extract fails" gotcha in tanstack-start.md is correct; had to manually seed `export const messages = {}` at every target path because the glob is resolved before extraction. Gotcha is documented but there's no automation — easy to miss.
- **`sideEffects: false` warning on `import '../start'`.** Both esbuild (during extract) and Vite warn that `src/start.ts` gets ignored because `package.json` has `"sideEffects": false`. The side-effect import appears to still work in practice (middleware runs), but the reference should advise either adding `"sideEffects": ["./src/start.ts"]` or importing `startInstance` and referencing it.
- **No git repo.** `.gitignore` exists but no `.git/`. Branch recommendation skipped silently as the skill prescribes.

### Overall verdict
A real user in unguided mode lands in a working state: `npm run build` passes, dev server serves both locales with correct `<html lang>`/`dir`, all 8 example strings are wrapped with the right macros (including plural/select), and the switcher renders. The weakest link is the **setup skill's handling of modern (`@vitejs/plugin-react@6`) TanStack Start projects** — the main SKILL.md and tanstack-start.md give contradictory compiler advice, and an unguided run without the plugin-react downgrade would have produced a silently ignored `babel` option and no macro transform. Secondary friction: noisy `routeFileIgnorePattern` warnings and the trailing-slash quirk in the switcher. Both are cosmetic but a real user would notice and be uncertain whether something is broken.
