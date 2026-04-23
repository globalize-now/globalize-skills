# Findings

## High-impact bugs (multiple examples affected)

### 1. `@vitejs/plugin-react` v6 drops the `babel` option
**Affects**: `vite-react`, `tanstack-start`. Likely latent in `react-router`, `tanstack-router` too.

`references/vite-babel.md` wires the Lingui macro via `react({ babel: { plugins: ['@lingui/babel-plugin-lingui-macro'] } })`. `@vitejs/plugin-react@6.0.0` (Oct 2025) removed the `babel` option — the `Options` type now exposes only `include`, `exclude`, `jsxImportSource`, `jsxRuntime`, `reactRefreshHost`. The option is silently ignored; macros are never transformed; `tsc` errors with TS2353; `vite build` fails at the `@lingui/vite-plugin` macro-import check.

**Fix**: version-gate `@vitejs/plugin-react`; fall back to `@vitejs/plugin-react-swc` + `@lingui/swc-plugin`, or add `vite-plugin-babel` as a standalone plugin.

### 2. `<Select>` macro example is TypeScript-invalid
**Affects**: `react-router`, `tanstack-router`, `vite-react`.

`lingui-convert/SKILL.md` Step 6 shows `<Select value={gender} male="..." female="..." other="..." />`. `@lingui/react@5.x` `SelectChoiceProps` type requires `_male` / `_female` keys. The example compiles to correct ICU at runtime but fails `tsc`.

**Fix**: update the example to `<Select value={gender} _male="..." _female="..." other="..." />`.

### 3. Next.js Pages Router + PO `precompile: true` is broken
**Affects**: `nextjs-pages-router`.

With `next-intl@4.9.1`, `next@15.5.15`, webpack, Pages Router: every ICU message (interpolation, plural, select, rich text) throws `INVALID_MESSAGE` at render in both dev and prod. The webpack alias `use-intl/format-message` → `use-intl/format-message/format-only` that the plugin installs does not take effect for Pages Router bundles. The skill's explicit fallback advice ("do NOT keep the block and set precompile: false") is empirically wrong: that combination does work.

**Related**: the reference says Pages Router skips `i18n/request.ts`, but `createNextIntlPlugin` with `experimental.messages` hard-errors at build ("Could not locate request configuration module") without one. A stub file suffices.

**Fix**: invert the advice, or disable `experimental.messages` entirely for Pages Router until fixed upstream.

### 4. Nuxt + ICU plural seed breaks build
**Affects**: `nuxt`.

`@nuxtjs/i18n` + `bundle.runtimeOnly: false` has `unplugin-vue-i18n` pre-compile lazy JSON catalogs at build time using the **default** (non-ICU) compiler, before the custom `messageCompiler` in `i18n.config.ts` gets a chance. Seed catalog key `{count, plural, one {# item selected} other {# items selected}}` fails with `error code: 2`. Non-ICU `{var}` interpolations work.

**Fix**: add a `compilation` flag to disable build-time pre-compilation of lazy JSON, or ship a non-ICU seed for the Nuxt variant with a note on how to add ICU later.

## Detection/routing gaps in `i18n-guide`

### 5. React Native / Expo silently routes to Lingui
`i18n-guide` Rule 3 only checks "has `react`, no `next`, no `vue`". `react-native` / `expo` aren't distinguished. Result: confident LinguiJS recommendation → `lingui-setup` hits the "Custom build pipeline" STOP blaming the build tool rather than "React Native not supported."

**Fix**: add a Step 2 STOP for `react-native` or `expo` in deps, with pointer to `expo-localization` + `i18n-js` or `react-i18next` for manual setup.

### 6. Gatsby and react-email silently fall through to Lingui
Same pattern as #5: `i18n-guide` recommends LinguiJS; `lingui-setup` hits "Custom build pipeline" STOP (no `vite.config.*`, `next.config.*`, `react-scripts`). Gatsby has `gatsby-node.ts#onCreateBabelConfig` which would make manual setup easy; react-email uses its own CLI with no plugin hook.

**Fix**: either add Gatsby detection + early STOP (with Babel-hook guidance) or build a Gatsby reference file. For react-email, add an early STOP pointing at `@formatjs/intl` / plain `Intl.*` for email templates.

### 7. Remix has no lingui reference
`i18n-guide` Rule 3 ("Vite / CRA / other React SPA") routes Remix to `lingui-setup`. The closest variant `vite-babel.md` doesn't fit — `@remix-run/dev`'s vitePlugin doesn't accept `babel.plugins` the way `@vitejs/plugin-react` does, and the provider pattern uses `window`/`localStorage` at module scope which crashes under Remix SSR. Required improvisations: add `vite-plugin-babel`, replace top-level `loadCatalog(detectLocale())` with SSR-safe source-locale activation.

**Fix**: dedicated Remix reference or explicit STOP with pointers to `remix-i18next`.

## Skill-prescribed improvisations (smaller but real)

### 8. Path-alias assumption in `next-intl-setup`
Scaffolds use `@/i18n/routing`, `@/i18n/navigation`. Starter `tsconfig.json` for Next 14/15/16 examples has no `baseUrl`/`paths`. Types break until alias is added. Affects `nextjs-14`, `nextjs-16`, `nextjs-pages-router`.

**Fix**: either configure the alias or use relative imports in scaffolds.

### 9. Extract-before-compile chicken-and-egg
Per-page catalogs with dynamic-import paths (`import(\`./locales/${locale}.ts\`)`) fail the **first** `lingui extract-experimental` because esbuild pre-resolves the glob and finds no matches. Affects `tanstack-router`, `tanstack-start`.

**Fix**: instruct to pre-create empty compiled catalogs (seed `{}.ts`) before first extract, or re-order "compile → extract → compile" on bootstrap.

### 10. TanStack Router treats catalog files as routes
When catalogs live at `src/routes/$locale/locales/{page}/{locale}.ts`, the `@tanstack/router-plugin` scans them as route modules and warns (or pollutes `routeTree.gen.ts`). Fix in-project needs `routeFileIgnorePattern: "locales/"` on the router plugin. Not mentioned in `vite-babel.md` or tanstack-start reference.

### 11. Next.js 16 `middleware.ts` deprecation
Next 16 warns that `middleware.ts` is deprecated in favor of `proxy.ts`. `next-intl-setup` still emits `middleware.ts`. Warning-only today; will break when the rename becomes hard.

### 12. TanStack Start `redirect({ to: ... })` strict typing
`to` is typed to known routes; template literal `/${SOURCE_LOCALE}${location.pathname}` fails TS. Works with `redirect({ href: ... })`. Needs updating in the tanstack-start reference.

## "Unguided" mode tension

Several skills have `CONSENT GATE: MUST wait for user response` lines for choices like catalog format (JSON vs PO), locale list, prefix strategy, `next.config` wrap, layout modification. These don't suspend under unguided mode. For non-interactive runs the skill hangs or forces the agent to guess.

**Recommendation**: predefine sensible defaults that apply when unguided + no user input is available:
- Locales: `en` + one target (user-specified or fall back to `es`)
- Catalog format: JSON (avoids experimental flag)
- Prefix strategy: `as-needed`
- Layout modifications: apply silently
- Log the default choice so the user can revisit

## Convert coverage gaps

### 13. Vue has no convert skill (known)
`vue` example ends with `App.vue` still hardcoded. User must hand-wrap via `vue-code` rules imported through CLAUDE.md. i18n-guide already documents this but it shows up as a functional gap end-to-end.

### 14. Module-scope `Intl.*Format` constants
Pattern `const USD = new Intl.NumberFormat('en-US', {...})` at module scope is not in the `lingui-convert` decision tree. Had to improvise in `vite-react`, `react-router`, `tanstack-router`, `remix` (move formatting into component, use `i18n.number()`/`i18n.date()`). Worth an explicit recipe.

### 15. Next.js page `setRequestLocale` per-page
`next-intl-setup` mentions `setRequestLocale` in the layout but doesn't explicitly spell out adding it to each page with `params`. The convert pass improvised this for static rendering.

## What works well

- **Next.js App Router happy path (14/15/16)** — detection is clean, PO+precompile works for App Router, types check, both locales statically prerender, convert handles all eight required string shapes cleanly.
- **Vue Vite SPA happy path** — `vue-setup` + `vite-spa.md` produces a complete, type-checked, ICU-capable setup that builds cleanly.
- **Unsupported-stack STOP** — fires correctly and cleanly in every case where Step 2 lists the framework. No false-positive setups, no destructive edits.
- **Convert decision tree** — correctly handled plurals (`<Plural>`), gender select (`<Select>`), rich inline links (`<Trans>` with child components), interpolation, currency, date formatting, with good dedup across call sites.

## Priority fixes (suggested order)

1. Fix the `<Select>` example (#2) — 5-minute edit.
2. Fix plugin-react v6 blocker (#1) — affects fresh projects on current Vite 8.
3. Fix Pages Router PO precompile advice (#3) — silently broken today.
4. Add Step-2 STOPs for React Native, Gatsby, react-email, Remix (#5, #6, #7).
5. Fix Nuxt ICU plural seed (#4).
6. Predefine unguided-mode defaults across all setup skills.
7. Path-alias handling in next-intl scaffolds (#8).
8. Extract/compile bootstrap ordering and TanStack router ignore pattern (#9, #10).
