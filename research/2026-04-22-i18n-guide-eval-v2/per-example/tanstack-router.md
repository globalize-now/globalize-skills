## tanstack-router

### Detection
- Framework: Vite (React SPA)
- Router: TanStack Router (client-only, file-based via `src/routes/`)
- Package manager: npm (`package-lock.json`)
- Existing i18n lib: none

### i18n-guide
- Recommended: LinguiJS (Rule 3 — React, no Next.js)
- STOP reason (if any): N/A

### Setup skill
- Skill: `lingui-setup` (Vite + Babel reference; `@vitejs/plugin-react` v4.7 → Babel path per the version gate)
- Outcome: success
- Files changed:
  - `src/i18n/locales.ts` — locale constants module (source `en`, target `es`)
  - `lingui.config.ts` — per-page experimental extractor, JSON catalog format
  - `src/i18n.ts` — runtime helpers (`activateLocale`, `getDirection`, `getLocaleFromPath`, `LOCALES`, `SOURCE_LOCALE`)
  - `vite.config.ts` — added Babel macro plugin to `react()`, added `lingui()` plugin, added `routeFileIgnorePattern: "locales"` so TanStack Router ignores catalog dirs
  - `src/routes/__root.tsx` — wrapped Outlet with `I18nProvider` and rendered `LanguageSwitcher`
  - `src/routes/index.tsx`, `src/routes/privacy.tsx` — converted to thin route files that load source-locale catalogs in `beforeLoad`
  - `src/routes/$locale/index.tsx`, `src/routes/$locale/privacy.tsx` — Strategy 1 prefixed routes for target locales
  - `src/pages/Home.tsx`, `src/pages/Privacy.tsx` — extracted shared page components (per Strategy 1 pattern)
  - `src/components/LanguageSwitcher.tsx` — locale switcher with `Intl.DisplayNames`
  - `package.json` — added `lingui:extract` / `lingui:compile` scripts; prepended `lingui compile --typescript` to `build`
  - `.gitignore` — ignored compiled per-page catalogs (`src/**/locales/**/*.ts`)
  - `CLAUDE.md` (new) — `@import` of `lingui-code` SKILL.md
  - 8 stub catalog files under `src/routes/{,**locales}` so esbuild can resolve dynamic catalog imports during extract (see Deviations)
- Deps added: runtime `@lingui/core`, `@lingui/react`, `@lingui/macro`, `@lingui/detect-locale`; dev `@lingui/cli`, `@lingui/babel-plugin-lingui-macro`, `@lingui/vite-plugin`, `@lingui/format-json`
- Blockers: none. ESLint not configured in project — Step 7 skipped per the skill's "decline" branch (no user to ask in unguided mode).

### Convert skill
- Skill: `lingui-convert` (sequential path, 2 page files)
- Outcome: success
- Strings wrapped (count): 11 — 9 in `pages/Home.tsx`, 2 in `pages/Privacy.tsx`. Includes 4 `<Plural>` macros (replacing the `itemsLabel` ternary), 1 `<Select>` (replacing `replyLine` gender ternary), and conversion of two module-scope `Intl.NumberFormat` / `Intl.DateTimeFormat` constants to `i18n.number()` / `i18n.date()` calls (locale-gap fix from Step 5).
- Strings skipped/failed: 0
- Blockers: none. Final `npm run build` runs `lingui compile --typescript && tsc -b && vite build` cleanly with no warnings or type errors.

### Deviations from SKILL.md
- **Catalog dynamic-import bootstrap**: lingui-setup's per-page pattern uses `import('./locales/<entry>/' + locale + '.ts')` in `beforeLoad`. Lingui's `extract-experimental` walks the entry tree with esbuild, which fails on the unresolvable dynamic import before any catalog files exist (`Could not resolve import("./locales/index/**/*.ts")`). The skill doesn't mention this chicken-and-egg. Workaround: created empty stub `messages = {}` files under each `routes/.../locales/<entry>/<locale>.ts` before the first extract. After extract+compile, real catalogs overwrite them. A real user would hit this and likely be stuck — the skill should either (a) tell the setup script to seed stubs, (b) use a static-glob import map, or (c) catch the import error in `beforeLoad` and pre-write empty catalogs.
- **TanStack Router catalog warnings**: The catalog directories sit under `src/routes/`, so TanStack Router's file router emits "does not export a Route" warnings for every catalog file. Skill doesn't mention this. Fix added: `routeFileIgnorePattern: "locales"` in `tanstackRouter()` config. Worth bubbling into `references/vite-babel.md`'s TanStack-Router subsection.
- **Strategy-1 routes for an existing app**: The skill shows the `<shared page component> + thin route file` pattern as if starting fresh. Translating an existing `src/routes/index.tsx` (which holds JSX directly) into the pattern requires extracting the JSX into `src/pages/Home.tsx` first. Skill could call this out as a structural migration step, not just a code template.
- **Unguided defaults**: Honored source `en`, target `es`, JSON catalog format, Strategy 1 (unprefixed source). The skill says "Optional steps included by default" — included CI/CD (build script change). Skipped Step 11 (test setup) since the project has no test framework configured. ESLint Step 7 was skipped because the project has no ESLint config and unguided mode has no user to ask.
- **`comment` annotations**: Convert added comments only on the "must comment" candidates ("Your profile" h1, "Privacy policy" h1). Other strings were full sentences with clear meaning per Step 7 "skip" rules.

### Overall verdict
A real user running this end-to-end in unguided mode would land in a working state for the most part — the build is clean, all 11 strings extract and compile, the language switcher is wired, and Strategy 1 locale routing is intact. The single sharp edge is the per-page extractor's dynamic-import resolution: without seeding empty catalog stubs, the very first `lingui extract-experimental` blows up with an esbuild error and the user is stuck before they ever see a working pipeline. That's the weakest link, and it's a documentation gap in the lingui-setup vite-babel reference (the same trap presumably exists in vite-swc.md). The TanStack Router `routeFileIgnorePattern` collision is a smaller second weak link — annoying warnings on every build until the user figures out the regex. Both are fixable with a few lines added to the reference file.
