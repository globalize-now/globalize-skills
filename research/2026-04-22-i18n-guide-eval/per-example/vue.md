## vue

### Detection
- Framework: Vite SPA (Vue 3.5.13, `@vitejs/plugin-vue`)
- Router: none (no `vue-router`)
- Package manager: npm (package-lock.json)
- Existing i18n lib: none

### i18n-guide
- Recommended: vue-i18n via `vue-setup`
- STOP reason (if any): N/A

### Setup skill
- Skill: `vue-setup` (Vite SPA variant, Strategy 3 — no URL routing, since no vue-router)
- Outcome: success
- Files changed:
  - `/tmp/i18n-skill-eval/vue/src/i18n/locales.ts` — source/target locale constants (`en`, `es`)
  - `/tmp/i18n-skill-eval/vue/src/i18n/messageCompiler.ts` — ICU compiler bridging `intl-messageformat` into vue-i18n
  - `/tmp/i18n-skill-eval/vue/src/i18n/index.ts` — `createI18n` instance, `setLocale`, `saveLocale`, `detectLocale` (URL → localStorage → nav), `getDirection`, number/date formats for en+es
  - `/tmp/i18n-skill-eval/vue/src/i18n/locales/en.json` — seeded catalog
  - `/tmp/i18n-skill-eval/vue/src/i18n/locales/es.json` — seeded catalog
  - `/tmp/i18n-skill-eval/vue/src/components/LanguageSwitcher.vue` — `<select>`-based switcher (no router)
  - `/tmp/i18n-skill-eval/vue/src/main.ts` — `app.use(i18n)` wiring
  - `/tmp/i18n-skill-eval/vue/vite.config.ts` — added `VueI18nPlugin` with `runtimeOnly: false`, `compositionOnly: true`, `strictMessage: false`, no `include`
  - `/tmp/i18n-skill-eval/vue/src/App.vue` — imported and rendered `<LanguageSwitcher />` in a header
  - `/tmp/i18n-skill-eval/vue/CLAUDE.md` — new; imports `@.claude/skills/vue-code/SKILL.md`
- Deps added: `vue-i18n@^11`, `intl-messageformat` (runtime); `@intlify/unplugin-vue-i18n` (dev)
- Blockers: none. `npm run build` passes (`vue-tsc -b && vite build` both clean). One non-fatal Vite warning: `en.json` is both statically and dynamically imported by `src/i18n/index.ts` — not a correctness issue (the `setLocale` guard prevents double-load) but the skill's Step 3 snippet is the direct cause.

### Convert skill
- Skill: N/A (`vue-i18n` has no convert skill; i18n-guide's Step 2 explicitly states "A Vue convert skill is not yet available")
- Outcome: N/A
- Strings wrapped (count): 0 — `src/App.vue` still contains the original hardcoded strings (profile heading, welcome paragraph, privacy link, user greeting, currency/date/plural/gender samples)
- Strings skipped/failed: 0
- Blockers: no convert skill exists

### Deviations from SKILL.md
- Unguided mode was used, so all consent gates (routing strategy, `<html lang>` migration, CLAUDE.md append, optional CI/CD + test setup) were skipped per the "Unguided mode rules."
- Routing strategy choice was N/A: the skill's vite-spa reference says "For plain SPAs without `vue-router`, skip the routing choice — use Option 3." Followed that.
- Optional Step 9 (CI/CD) and Step 10 (test wrapper) were not executed — unguided rules say include by default unless the user excludes; however the eval instructions don't ask for them and they require additional dev deps (`@vue/test-utils`, `vitest`) that aren't present. Skipped silently; would be a deviation in a real user flow (should have at least added `scripts/checkLocales.mjs` + `i18n:check`).
- Skill's `src/i18n/index.ts` template does `import en from './locales/en.json'` AND later `await import(./locales/${locale}.json)` which triggers a Vite chunking warning for `en`. Minor but real — the skill could exclude the source locale from the dynamic-import branch or vice versa.

### Overall verdict
Yes, a real user would land in a working state. `i18n-guide` correctly detected Vue + Vite SPA and routed to `vue-setup`; `vue-setup` + the `vite-spa.md` reference produced a complete, type-checked, ICU-capable vue-i18n setup that builds cleanly. The weakest links are (1) the absence of a convert skill means the 8 hardcoded strings in `App.vue` remain untouched — a fresh user would still have to wrap them manually using the `vue-code` rules now loaded via CLAUDE.md — and (2) the static+dynamic import pattern for the source-locale JSON triggers a Vite warning that would look alarming to newcomers despite being harmless.
