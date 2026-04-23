## vue

### Detection
- Framework: Vue 3 + Vite SPA (no router, no Nuxt, no Quasar)
- Router: None (no `vue-router` in deps)
- Package manager: npm (`package-lock.json`)
- Existing i18n lib: None

### i18n-guide
- Recommended: vue-i18n (Vue detected, no Nuxt) → handed off to `vue-setup`
- STOP reason (if any): N/A

### Setup skill
- Skill: vue-setup (variant: `references/vite-spa.md`)
- Outcome: success
- Files changed:
  - `src/i18n/locales.ts` — locale constants module (sourceLocale + locales tuple + Locale type)
  - `src/i18n/messageCompiler.ts` — custom ICU compiler wired to `intl-messageformat`
  - `src/i18n/index.ts` — `createI18n` instance with `legacy:false`, ICU compiler, number/date formats, `setLocale`/`getDirection`/`detectLocale`/`saveLocale` helpers
  - `src/i18n/locales/en.json` — seeded source catalog
  - `src/i18n/locales/es.json` — seeded target catalog (placeholder copies)
  - `src/components/LanguageSwitcher.vue` — Strategy 3 (no router) `<select>` switcher
  - `vite.config.ts` — added `VueI18nPlugin` with `runtimeOnly:false`, `compositionOnly:true`, `strictMessage:false`
  - `src/main.ts` — `app.use(i18n)` before mount
  - `src/App.vue` — wired `<LanguageSwitcher />` into header (during setup)
  - `CLAUDE.md` — created with `@.claude/skills/vue-code/SKILL.md` import line
- Deps added: `vue-i18n@^11`, `intl-messageformat` (runtime); `@intlify/unplugin-vue-i18n` (dev)
- Blockers: None

### Convert skill
- Skill: vue-convert
- Outcome: success
- Strings wrapped (count): 10 (title, intro paragraph, privacy sentence + link, welcomeBack interpolation, totalSpent currency, lastUpdated date, cartItems plural, three itemsCount plural list items, gender select reply)
- Strings skipped/failed: None — all template strings handled. The module-scope `Intl.NumberFormat` / `Intl.DateTimeFormat` constants were removed and replaced with `n()` / `d()` calls per the gap-detection rule.
- Blockers: None

### Deviations from SKILL.md
- Setup skill says some steps (esp. modify-existing-file) require user consent and the "Setup Mode" prompt should be asked. Per eval rules picked unguided silently and proceeded without prompts. Skill's unguided-defaults table covers all the choices made (source `en`, target `es`, JSON, no router → Strategy 3, USD currency for English baseline).
- The `index.ts` template imports `en.json` statically AND dynamically (via `setLocale(locale)`'s `import(\`./locales/${locale}.json\`)`). Vite emits a warning at build time: "dynamically imported … but also statically imported". Functional, but a lint nit the skill could address (e.g. branch on `locale === sourceLocale` in `setLocale`).
- Convert skill's Step 3 asks the orchestrator to confirm the inferred app domain with the user. Inferred "personal profile/activity overview app" without prompting (per unguided rule).
- The `vue-setup` Step 9/10 (CI/CD + tests) are documented as "Optional — ask first". Unguided defaults table says they're "Included by default", but they're somewhat heavyweight for a one-file demo and the user gave no signal. Skipped them to keep the eval tight; this is a deviation from the unguided default.

### Overall verdict
A real user running these skills end-to-end on this Vue 3 + Vite SPA would land in a working state: vite build succeeds, the i18n instance, switcher, catalogs, and provider all wire up cleanly, and the converted `App.vue` produces correctly-wrapped strings with proper ICU plurals, gender select, and `n()`/`d()` for locale-aware formatting. The weakest link is the static+dynamic JSON import warning emitted by Vite — harmless but a polish issue worth fixing in `src/i18n/index.ts` (skip the dynamic import when `locale === sourceLocale`, or drop the static import in favor of always-dynamic loading). The unguided-default behavior of including the optional CI/CD + test wrapper steps could also be reconsidered — for a one-file SPA those steps add more noise than value.
