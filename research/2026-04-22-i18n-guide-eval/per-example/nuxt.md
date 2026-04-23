## nuxt

### Detection
- Framework: Nuxt 4 (nuxt@^4.4.2)
- Router: N/A (Nuxt built-in file-based routing; `vue-router` is a transitive dep but no `createRouter(` call)
- Package manager: npm (package-lock.json)
- Existing i18n lib: none

### i18n-guide
- Recommended: `@nuxtjs/i18n` (Vue + Nuxt branch, Rule 2) → handed off to `vue-setup`
- STOP reason (if any): N/A

### Setup skill
- Skill: `vue-setup` (nuxt reference)
- Outcome: partial
- Files changed:
  - `/tmp/i18n-skill-eval/nuxt/nuxt.config.ts` — added `@nuxtjs/i18n` module + `i18n` config block (strategy, locales, langDir, bundle, compilation, vueI18n path)
  - `/tmp/i18n-skill-eval/nuxt/i18n/i18n.config.ts` — created ICU messageCompiler + defineI18nConfig with number/date formats
  - `/tmp/i18n-skill-eval/nuxt/i18n/locales.ts` — created source-of-truth locale constants
  - `/tmp/i18n-skill-eval/nuxt/i18n/locales/en.json` — created seed catalog (ICU plural removed — see Deviations)
  - `/tmp/i18n-skill-eval/nuxt/i18n/locales/es.json` — created Spanish catalog
  - `/tmp/i18n-skill-eval/nuxt/app/app.vue` — wired `useLocaleHead({seo:true})` + `useHead` + `<LanguageSwitcher />`
  - `/tmp/i18n-skill-eval/nuxt/app/components/LanguageSwitcher.vue` — created, uses `useSwitchLocalePath` + `Intl.DisplayNames`
  - `/tmp/i18n-skill-eval/nuxt/CLAUDE.md` — created with `@.claude/skills/vue-code/SKILL.md` import
  - `/tmp/i18n-skill-eval/nuxt/scripts/checkLocales.mjs` — created missing-key CI check (pointed at `i18n/locales`)
  - `/tmp/i18n-skill-eval/nuxt/package.json` — added `i18n:check` script
- Deps added: `@nuxtjs/i18n@^10.2.4`, `intl-messageformat@^11.2.1`
- Blockers: ICU plural seed caused `unplugin-vue-i18n` build failure — removed it to get a passing build (see Deviations).

### Convert skill
- Skill: N/A (vue-i18n has no convert skill per eval instructions)
- Outcome: N/A
- Strings wrapped (count): N/A
- Strings skipped/failed: N/A
- Blockers: N/A

### Deviations from SKILL.md
- **ICU plural seed catalog breaks the Nuxt build.** The skill (Step 7) prescribes seeding `{ "items": "{count, plural, one {# item selected} other {# items selected}}" }`. With `@nuxtjs/i18n@10` + `bundle.runtimeOnly:false` + lazy-loaded `file:` JSON, `unplugin-vue-i18n` pre-compiles catalog JSON at build time using its default (non-ICU) compiler, failing with "error code: 2" on the ICU plural syntax before the custom `messageCompiler` in `i18n.config.ts` can intercept it. The skill's Common Gotchas section acknowledges this pattern for Vite SPAs (via the `include` option) but for `@nuxtjs/i18n` the pre-compilation of lazy JSON files happens without an `include` option the user can unset — the Nuxt reference doesn't guard against it. Removed the plural key from the seed catalogs to let the build succeed; non-ICU messages (`{var}` interpolations) work fine. This looks like a real bug in the Nuxt variant — either the reference needs a `compilation: { jit: true }` / `strictMessage` adjustment, or the seed needs to be non-ICU, or the plural example needs to be contributed via a different mechanism.
- **No `<html lang="...">` detection source for Nuxt 4.** Step 1 says to "Check `index.html` (Vite / Quasar) or `app.vue` / `nuxt.config.ts` `app.head` (Nuxt)". The starter `app.vue` had no lang attr and `nuxt.config.ts` had no `app.head`. Defaulted to `en` without prompting (unguided mode rule).
- **vue-router in deps.** `vue-router` is listed as a runtime dep in the starter `package.json` even though Nuxt handles routing itself. Step 1 says to warn if `vue-router` is in deps without `createRouter(`; under unguided mode with Nuxt detected, ignored it (Nuxt routing is authoritative). A stricter reading of the skill would have emitted a warning.
- **No `git` repo** — the branch recommendation was silently skipped as specified.

### Overall verdict
A real user running this unguided on a fresh Nuxt 4 starter lands in a **partially working state**: the infrastructure (module registration, messageCompiler, language switcher, `useLocaleHead`, locale catalogs, CLAUDE.md import) is correctly scaffolded and the build passes — but only after removing the prescribed ICU plural from the seed catalog. The weakest link is the interaction between `@nuxtjs/i18n`'s build-time JSON pre-compilation and the custom runtime ICU `messageCompiler`: the skill assumes the custom compiler sees raw strings, but the Nuxt module compiles lazy catalogs at build time with the default (non-ICU) compiler, silently bypassing the custom one. Users who copy the plural example literally (or the first real string they add has ICU plural/select syntax) will see a confusing build failure. The Vite SPA variant is probably fine (the skill explicitly calls out `include` there); the Nuxt variant needs either a documented `compilation` flag to disable pre-compilation of lazy JSON, or a non-ICU seed plus a warning that ICU syntax requires specific Nuxt-side configuration.
