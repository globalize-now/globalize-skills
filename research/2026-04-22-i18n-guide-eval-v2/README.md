# i18n-guide eval v2 — 2026-04-22

Second end-to-end run of the `globalize-skills` suite against the 27 TypeScript example projects in `example-websites/typescript/`. Same method as the original `research/2026-04-22-i18n-guide-eval/` run. See `findings.md` for consolidated analysis and `per-example/<name>.md` for individual project reports.

## Method

1. **Stage** — For each example, `rsync` (excluding `node_modules`, `.next`, `dist`, `.nuxt`, `.output`, `build`, `.turbo`, `.cache`, `.astro`) into `/tmp/i18n-skill-eval/<name>/`. Install all skills into `.claude/skills/` with flattened names (`i18n-guide`, `lingui-{setup,convert,code}`, `next-intl-{setup,convert}`, `vue-{setup,convert,code}`, `css-i18n`).
2. **Fan out** — One `general-purpose` subagent per example, dispatched in a single message for parallelism.
3. **Brief** — Each agent reads `.claude/skills/i18n-guide/SKILL.md`, follows it, and any setup/convert skills it routes to. Unguided mode. Locales: `en` → `es`. Real installs (match lockfile for package manager). Real edits. No git ops. 10-min timebox per step.
4. **Report** — Each agent fills a fixed schema (Detection / i18n-guide / Setup / Convert / Deviations / Verdict).
5. **Consolidate** — Per-example reports persisted; findings grouped by theme.

## Results table

| # | Example | Route | Setup | Convert | Outcome |
|---|---|---|---|---|---|
| 1 | angular | STOP (rule 1: unsupported) | — | — | STOP correctly |
| 2 | astro | STOP (rule 1: unsupported) | — | — | STOP correctly |
| 3 | express | STOP (rule 1: unsupported) | — | — | STOP correctly |
| 4 | fastify | STOP (rule 1: unsupported) | — | — | STOP correctly |
| 5 | gatsby | STOP (rule 4: Gatsby) | — | — | STOP correctly |
| 6 | hono | STOP (rule 1: unsupported) | — | — | STOP correctly |
| 7 | lit | STOP (rule 1: unsupported) | — | — | STOP correctly |
| 8 | nestjs | STOP (rule 1: unsupported) | — | — | STOP correctly |
| 9 | nextjs-14 | next-intl | success | success | setup+convert success (improvised: Next-14 sync params, path aliases) |
| 10 | nextjs-15 | next-intl | success | success | setup+convert success (clean) |
| 11 | nextjs-16 | next-intl | success | success | setup+convert success (clean; `proxy.ts` rename) |
| 12 | nextjs-pages-router | next-intl | success | success | setup+convert success (improvised: `i18n/request.ts` stub required) |
| 13 | nuxt | vue-i18n → vue-setup | success | **failed** | setup ok, convert breaks build (ICU+JSON+lazy incompatible) |
| 14 | qwik-city | STOP (rule 1: unsupported) | — | — | STOP correctly |
| 15 | react-email | STOP (rule 5: react-email) | — | — | STOP correctly |
| 16 | react-native-expo | STOP (rule 3: RN/Expo) | — | — | STOP correctly |
| 17 | react-router | lingui (vite-babel) | success | success | setup+convert success (improvised: RR7 declarative-mode routing) |
| 18 | remix | STOP (rule 6: Remix) | — | — | STOP correctly |
| 19 | solid | STOP (rule 1: unsupported) | — | — | STOP correctly |
| 20 | solid-start | STOP (rule 1: unsupported) | — | — | STOP correctly |
| 21 | svelte | STOP (rule 1: unsupported) | — | — | STOP correctly |
| 22 | sveltekit | STOP (rule 1: unsupported) | — | — | STOP correctly |
| 23 | tanstack-router | lingui (vite-babel) | success | success | setup+convert success (improvised: catalog stub seeding, route ignore pattern) |
| 24 | tanstack-start | lingui (tanstack-start) | success | success | setup+convert success (improvised: plugin-react v6→v5 downgrade, catalog stubs) |
| 25 | trpc | STOP (rule 1: unsupported) | — | — | STOP correctly |
| 26 | vite-react | lingui (vite-swc) | success | success | setup+convert success (plugin-react v6 → SWC route) |
| 27 | vue | vue-i18n → vue-setup | success | success | setup+convert success (clean) |

## Summary

- **STOP correctly**: 17/27 (angular, astro, express, fastify, gatsby, hono, lit, nestjs, qwik-city, react-email, react-native-expo, remix, solid, solid-start, svelte, sveltekit, trpc)
- **STOP at setup**: 0
- **Silent misroute**: 0
- **Setup+convert success (clean)**: 4 (nextjs-15, nextjs-16, vue, vite-react)
- **Setup+convert success (with improvisation)**: 5 (nextjs-14, nextjs-pages-router, react-router, tanstack-router, tanstack-start)
- **Setup success, convert failed**: 1 (nuxt)
- **Setup or convert partial/failed**: 1 (nuxt)

## Highlights

- **All 17 unsupported stacks produced clean stops** with no destructive changes. The guide's compatibility gate is solid.
- **One build-breaker**: vue-convert + Nuxt + JSON catalogs + ICU plural/select. vue-setup's Nuxt reference documents the incompatibility; vue-convert doesn't know about it. See findings.md §1 of High-impact bugs.
- **Two silent-footgun risks** on React + Vite stacks: (a) `@vitejs/plugin-react` v6 contradicts `tanstack-start.md`; (b) per-page Lingui extractor needs pre-seeded stubs. Both are documented as gotchas but not automated.
- **Pages Router needs a request-config stub** on next-intl 4.9.x even when the skill says it's skippable — a first-run `npm run dev` failure for a straightforward Pages Router project.
- **Unguided-mode tension** with consent-gate prose inside setup skills — the defaults table overrides the gate text but a careless model could stall.

See `findings.md` for full list and priority ordering.
