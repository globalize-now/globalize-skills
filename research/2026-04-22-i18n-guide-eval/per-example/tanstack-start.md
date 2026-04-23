## tanstack-start

### Detection
- Framework: TanStack Start (SSR) on Vite 8
- Router: TanStack Start file-based routing (`src/routes/`)
- Package manager: npm (`package-lock.json`)
- Existing i18n lib: none

### i18n-guide
- Recommended: LinguiJS (Rule 3 — React present, no Next.js)
- STOP reason (if any): N/A

### Setup skill
- Skill: `lingui-setup` → `references/tanstack-start.md` (Strategy 3, cookie-only, chosen as sensible default)
- Outcome: failed
- Files changed:
  - `/tmp/i18n-skill-eval/tanstack-start/package.json` — added `lingui:extract`, `lingui:compile` scripts; prepended `lingui compile --typescript` to `build`
  - `/tmp/i18n-skill-eval/tanstack-start/vite.config.ts` — added `lingui()` plugin and `viteReact({ babel: { plugins: ['@lingui/babel-plugin-lingui-macro'] } })` (the `babel` option is silently ignored by `@vitejs/plugin-react@6`)
  - `/tmp/i18n-skill-eval/tanstack-start/lingui.config.ts` — new, per-page catalogs config
  - `/tmp/i18n-skill-eval/tanstack-start/src/i18n/locales.ts` — `sourceLocale`, `locales`, `resolveLocale()`
  - `/tmp/i18n-skill-eval/tanstack-start/src/i18n/index.ts` — `i18n`, `getDirection`, `activateLocale`
  - `/tmp/i18n-skill-eval/tanstack-start/src/start.ts` — global request middleware that resolves locale from cookie/Accept-Language
  - `/tmp/i18n-skill-eval/tanstack-start/src/server/locale.ts` — `getLocale`/`setLocale` server functions
  - `/tmp/i18n-skill-eval/tanstack-start/src/router.tsx` — side-effect import of `./start`
  - `/tmp/i18n-skill-eval/tanstack-start/src/routes/__root.tsx` — root route now sets `<html lang dir>` from route context and wraps in `I18nProvider` + switcher; uses `shellComponent`
  - `/tmp/i18n-skill-eval/tanstack-start/src/routes/index.tsx` — `beforeLoad` dynamically imports per-page catalog and calls `activateLocale`; one `<Trans>` added for a smoke test
  - `/tmp/i18n-skill-eval/tanstack-start/src/components/LanguageSwitcher.tsx` — cookie-only select switcher
  - `/tmp/i18n-skill-eval/tanstack-start/CLAUDE.md` — new; imports `@.claude/skills/lingui-code/SKILL.md`
  - `/tmp/i18n-skill-eval/tanstack-start/.gitignore` — added `src/**/locales/**/*.ts`
- Deps added: `@lingui/core`, `@lingui/react`, `@lingui/macro` (runtime); `@lingui/cli`, `@lingui/babel-plugin-lingui-macro`, `@lingui/vite-plugin` (dev)
- Blockers:
  - `vite build` fails with: `The macro you imported from "@lingui/react/macro" is being executed outside the context of compilation.` Root cause: `@vitejs/plugin-react@6.0.1` (shipped with Vite 8) dropped the `babel` option entirely — its `Options` type now exposes only `include`, `exclude`, `jsxImportSource`, `jsxRuntime`, `reactRefreshHost`. The skill's wiring (`viteReact({ babel: { plugins: [...] } })`) silently no-ops, so the macro never gets transformed and `@lingui/vite-plugin` throws on the raw macro import. No alternative path is described in the reference (no SWC fallback for TanStack Start, no `vite-plugin-babel` recipe).

### Convert skill
- Skill: N/A
- Outcome: N/A
- Strings wrapped (count): N/A
- Strings skipped/failed: N/A
- Blockers: macro transform is broken at the build-tool layer; no point running a convert pass until that's fixed.

### Deviations from SKILL.md
- **`@vitejs/plugin-react@6` API mismatch**: `references/tanstack-start.md` assumes the v4/v5 `babel` option exists. On v6 it is silently ignored — the reference needs an SWC fallback, a `vite-plugin-babel` recipe, or a version guard/STOP check for plugin-react >= 6.
- **Per-page catalog location collides with TanStack Router**: `lingui.config.ts`'s default output `<rootDir>/{entryDir}/locales/{entryName}/{locale}` puts compiled `.ts` files inside `src/routes/`, which TanStack Router scans as file routes. Build warns: "Route file … does not export a Route." Skill should either suggest a `routeFileIgnorePattern: /locales\//` in the router config or co-locate catalogs outside `src/routes/` by default.
- **Extractor chicken-and-egg**: the per-route `beforeLoad: async ({ context }) => { const { messages } = await import(\`./locales/index/${context.locale}.ts\`) … }` pattern fails the first `lingui extract-experimental` run with `Could not resolve import("./locales/index/**/*.ts")` because esbuild pre-resolves the glob and finds no matches. Worked around it by stubbing `en.ts`/`es.ts` before the first extract. The skill should pre-create empty catalog stubs or tell the user to run extract before the route tries to import anything.
- **TanStack Start uses `shellComponent`, not `component`**: the reference mentions this at the end of section 4 in a parenthetical but shows the wrong shape in its main example. In this project `shellComponent` is the idiomatic seam; fine once noticed, but the reference's primary example leads the wrong way.
- **No `src/server.ts` entry**: reference says "verify that your server entry imports `./start`". This project has no such entry; added a side-effect import from `router.tsx` as a reasonable proxy, but the skill should say what to do when no server entry exists.
- **`--typescript` + TS errors**: compiled `.ts` catalogs plus TypeScript's noEmit picks up `routeTree.gen` (not generated yet, always transient) and strict-mode errors on `createFileRoute('/')` before the route tree regenerates. Not a skill bug, but the "Verify the setup works" list in Step 8 doesn't call this out.

### Overall verdict
A real user would NOT land in a working state on a current TanStack Start project. The scaffolding (server middleware, root document, locale resolver, switcher, catalogs directory, CLAUDE.md import) is all produced correctly and is internally coherent — but the single most important line, wiring the Lingui Babel macro plugin into the build, is a no-op on `@vitejs/plugin-react@6` (the version TanStack Start currently ships with alongside Vite 8). The weakest link is the reference's assumption that `viteReact({ babel: ... })` still exists; until the reference adds a v6-compatible path (SWC plugin fallback, or `vite-plugin-babel`, or a version guard with guidance), the happy path fails at `vite build`. Secondary friction: per-page catalog directory colliding with TanStack Router's file-route scanner and the first-run extractor chicken-and-egg are smaller but would each burn a real user ~10 minutes of confusion.
