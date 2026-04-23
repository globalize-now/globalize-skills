# i18n-guide eval findings (v2, 2026-04-22)

27 example projects evaluated end-to-end. Source: `example-websites/typescript/`. Mode: unguided, `en` → `es`. See `per-example/` for full per-project reports.

## High-impact bugs (multiple examples affected)

### 1. `@vitejs/plugin-react` v6 handling is contradictory across lingui-setup variants
- **vite-react** (plain Vite+React, plugin-react v6): setup resolved cleanly by routing to `references/vite-swc.md`. But the "treat v6+ as SWC" rule is a detection-table footnote, not a Step 4 instruction — a careless operator could miss the swap and end up with a silently-ignored `babel` option (no macro transform).
- **tanstack-start** (plugin-react v6 + TanStack Start): the main SKILL.md says v6 → SWC, but `references/tanstack-start.md` uses `viteReact({ babel })`. The two rules collide and there is no "TanStack Start + SWC" variant. Only resolution today is downgrading `@vitejs/plugin-react` to v5, which is an undocumented silent fix.
- **Impact**: real users on current Vite/TanStack-Start project scaffolds land on plugin-react v6 by default and will hit a silent no-op. Hardest to debug because the build still "succeeds" but `<Trans>` / `<Plural>` never get transformed.
- **Fix**: add an SWC variant to `tanstack-start.md`, OR pin plugin-react to v5 in tanstack-start.md, OR promote the v6 swap to an explicit setup step.

### 2. Per-page Lingui extractor breaks on first run without pre-seeded catalog stubs
- **tanstack-router** and **tanstack-start** both needed manually-seeded empty `messages = {}` files under every `locales/<entry>/<locale>.ts` path before the first `lingui extract-experimental` would succeed.
- Root cause: the per-page pattern uses dynamic imports that esbuild tries to resolve before any catalog exists.
- **Impact**: the first extract fails with `Could not resolve import(...)`; a user who hasn't read the reference file's gotchas is stuck.
- **Fix**: have lingui-setup seed the stubs as part of Step 4, OR switch to a static-glob import map, OR document this prominently as a step (not a gotcha).

### 3. Convert skill is unaware of framework-specific catalog constraints — Nuxt build-breaker
- **nuxt** (only): vue-convert emits ICU plural/select into JSON catalogs, but `@nuxtjs/i18n` + `bundle.runtimeOnly:false` + lazy JSON cannot parse ICU syntax. vue-setup's own `references/nuxt.md` documents this incompatibility, but vue-convert has no awareness of it. Result: setup passes, first convert with a plural breaks both `nuxt build` and `nuxt dev` — locale files fail to load entirely.
- **Impact**: Nuxt users land in a broken state the moment they pluralize anything.
- **Fix**: vue-convert should gate ICU plural/select emission on `framework !== 'nuxt' || catalogFormat !== 'json'`, OR auto-route ICU-bearing strings into SFC `<i18n>` blocks per the Nuxt reference's workarounds.

### 4. Pages Router + next-intl 4.9.x needs `i18n/request.ts` even on the JSON path
- **nextjs-pages-router**: the skill's dispatch table marks Step 4 (request config) as "skipped" for Pages Router with JSON catalogs, but next-intl 4.9.x hard-errors at boot with `Could not locate request configuration module` unless a stub request file exists. Manual one-line stub was required.
- **Impact**: first `npm run dev` fails for any Pages Router user following the skill verbatim.
- **Fix**: either require the stub universally in the Pages Router reference, or call out the version-specific requirement.

## Detection / routing gaps

- **React Router v7 declarative mode**: the detection table only names v7 *framework mode* (`app/routes/`). A `<BrowserRouter>` SPA falls through to "plain SPA" by default but nothing in the skill explicitly says so. Happened to resolve correctly for **react-router** via the `else → plain SPA` fallback, but should be explicit.
- **Astro**: not named in the STOP list. Currently falls through via "no react and no vue" correctly (pure **astro** case). Latent risk: adding `@astrojs/react` would put `react` in deps and route to lingui-setup, which assumes a Vite + plugin-react toolchain and would misconfigure Astro's islands.
- **Qwik**: not named explicitly; caught by the "no react/vue" stop. Stop message points nowhere (no `qwik-speak` / `compiled-i18n` pointer).
- **Server-only Node frameworks (Express, Fastify, Hono, NestJS, trpc)**: all correctly hit the "no react/vue" stop, but the STOP message lists "React-based and Vue-based projects" without acknowledging that server-rendered template setups and API servers are a recognized out-of-scope category.
- **Next.js 14 vs 15 `params` shape**: reference samples assume Next 15+ (`Promise<{locale}>`). Next 14 sync params mentioned only in a parenthetical. An unguided run that doesn't open the reference writes code that fails type-check on Next 14.

## Skill-prescribed improvisations (places operators had to fill gaps)

Across the five unambiguously-successful setup+convert projects, every one required at least one small improvisation:

- **Path-alias rewriting** when project had no `@/*` alias: next-intl App Router (Next 14/15/16) and Pages Router. Skill prescribes "rewrite to relative", but doesn't emphasize it covers every emitted file.
- **`setRequestLocale` in page files** (not just layouts) for static rendering: lives only in the App Router reference, not the main SKILL.md Step 9 move plan.
- **Root `app/layout.tsx` metadata**: convert skill is silent on wrapping `<title>`/`<description>` that live outside `[locale]`.
- **Dead helper removal**: convert skill says to wrap strings, but module-scope `Intl.NumberFormat`/`DateTimeFormat` constants and hand-rolled `pluralizeItems`/`replyLine` helpers need removal once their logic is expressed in ICU. Operators handled this correctly, but different operators could diverge.
- **Navigation `<a>` → locale-aware `<Link>` migration**: out of convert-skill scope. Skill should flag it as a follow-up rather than leaving silent.
- **`@lingui/conf` explicit install**: TypeScript needs it for `lingui.config.ts` imports; it's not in the lingui-setup "Core packages" table.
- **ESLint optional step**: unguided mode has no "default yes/no" for ESLint-plugin-lingui; operators silently skipped in projects with no existing ESLint config.

## "Unguided" mode tension with consent gates

Setup skills still contain many "CONSENT GATE" / "wait for user confirmation" instructions that directly conflict with unguided mode:

- **next-intl-setup Step 1** says catalog format requires confirmation; the unguided defaults table says JSON without prompting. The table wins, but a model reading the gate text may stall.
- **vue-setup Step 1** same pattern for "Setup Mode" and catalog format.
- **lingui-setup Step 9** says "describe the change and wait for confirmation" before appending `@import` to CLAUDE.md — but no CLAUDE.md existed, so the right branch (create fresh) had no user to ask.
- **vue-setup Steps 9/10** marked "Optional — ask first" but also "Included by default" in the unguided table. Operators differed (one skipped CI/tests, one included).
- **Pages Router prefix prompt** presented unconditionally in Step 3 but is N/A in Pages Router (Next's own `i18n` config is used).

**Fix**: either strip consent-gate language from setup skills and rely on the unguided defaults table as canonical, or restructure SKILL.md sections so the unguided path is first-class (not a footnote overriding the main text).

## Convert coverage gaps

- **Nuxt-aware ICU handling** — see high-impact bug #3.
- **Hand-rolled Intl formatter migration** — multiple examples (nextjs-14, nextjs-15, nextjs-16, tanstack-router, tanstack-start, react-router, vue, vite-react) had module-scope `Intl.NumberFormat`/`DateTimeFormat` constants. Convert skills correctly prescribe replacing them with `i18n.number()` / `n()` / `getFormatter`, but "always flag" is vague — operators divergently either removed the helpers entirely or inlined.
- **Root-layout (non-locale) metadata** in Next.js App Router — silence in the skill. Wraps or doesn't get wrapped depending on operator.
- **TanStack Router/Start trailing-slash switcher bug** — reference code for Strategy 1 switcher emits `/es/` where canonical is `/es`; causes 307 redirects on every locale switch.
- **Navigation migration** — `<a href="/">` vs locale-aware `<Link>`. Convert skill scope ambiguous.
- **Vue setup static+dynamic import warning** — `src/i18n/index.ts` imports the source catalog statically AND dynamically (via `setLocale`). Vite warns. Cosmetic but polish-level bug in the skill's own emitted code.

## What works well

- **STOP behavior on unsupported stacks** is rock-solid. All 17 unsupported projects correctly hit the appropriate hard-stop (Step 2 rules 1–6) and produce no destructive changes. No silent misroutes occurred.
- **Explicit STOP rules with pointers** (Gatsby → `gatsby-plugin-react-i18next`, Remix → `remix-i18next`, react-email → formatjs, React Native → `expo-localization` + `i18n-js`) are well-written and actionable.
- **next-intl App Router on Next 15 and 16** is the cleanest path end-to-end — both produced working builds with plurals/select/rich-text/currency/date/dynamic-lang all functional on first try.
- **vue-setup on Vite SPA** (non-Nuxt) is clean: build succeeds, switcher works, ICU message compiler wires up correctly.
- **lingui-setup on Vite SPA (Babel or SWC paths)** is clean for **vite-react** and **react-router**.
- **Convert skills inline hand-rolled plural/gender helpers correctly** — all convert runs migrated `pluralizeItems`/`replyLine`-shaped patterns into real ICU plural/select macros rather than leaving them as broken two-key lookups.
- **i18n-guide hard-stops fire before any install/edit**, so even "failure" cases leave the tree clean. Matches the project's "conservative setup" feedback memory.

## Priority fixes

**P0 — build-breakers**
1. **vue-convert Nuxt awareness**: block ICU plural/select emission into JSON catalogs on Nuxt, OR auto-emit SFC `<i18n>` blocks. Without this, every Nuxt user who translates their first plural breaks their build.
2. **TanStack Start + plugin-react v6 contradiction**: either add a tanstack-start-swc reference, pin plugin-react to v5 in tanstack-start.md, or patch the main SKILL.md to route TanStack-Start through the babel path regardless of plugin-react version.

**P1 — first-run failures**
3. **Pages Router request-file stub**: update `next-intl-setup` dispatch table to say "always create `i18n/request.ts`" on Pages Router for next-intl 4.9+.
4. **Lingui per-page bootstrap**: either auto-seed empty catalog stubs in `lingui-setup` Step 4, or add a prominent "Before first extract" step (not a gotcha) in tanstack-*.md and vite-babel.md.
5. **Detection table: React Router v7 declarative mode**: add an explicit row so operators don't infer.

**P2 — UX polish**
6. **STOP message pointers** for Angular (`@angular/localize`), Svelte/SvelteKit (`@inlang/paraglide-sveltekit`), Solid (`@solid-primitives/i18n`), Lit (`@lit/localize`), Qwik (`qwik-speak`), server frameworks (`i18next` / `nestjs-i18n` / `@fastify/i18n`). Mirror the existing Gatsby/Remix/RN/react-email stops.
7. **Next.js 14 params shape** call-out in the main App Router reference (not buried in a parenthetical).
8. **Unguided-mode tension**: reconcile consent-gate prose with the unguided defaults table. Make unguided a first-class path, not an override.
9. **Astro detection**: explicit note in Step 1 that even with `@astrojs/react`, Astro's island architecture is out of scope.
10. **TanStack Strategy-1 switcher**: fix `/es/` → `/es` trailing-slash mismatch in reference code.
11. **Vue i18n static+dynamic import warning**: fix in vue-setup emitted template (`setLocale` should skip dynamic import when `locale === sourceLocale`, or drop the static import).
