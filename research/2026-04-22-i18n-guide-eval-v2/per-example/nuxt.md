## nuxt

### Detection
- Framework: Nuxt 4 (4.4.2)
- Router: Nuxt file-based routing (no `vue-router` usage in code; `vue-router` is in `package.json` deps but unused)
- Package manager: npm (`package-lock.json`)
- Existing i18n lib: none

### i18n-guide
- Recommended: `@nuxtjs/i18n` (Vue + Nuxt → Rule 2)
- STOP reason (if any): N/A

### Setup skill
- Skill: `vue-setup` (Nuxt variant via `references/nuxt.md`)
- Outcome: success
- Files changed:
  - `package.json` — added `@nuxtjs/i18n`, `intl-messageformat`; added `i18n:check` script
  - `nuxt.config.ts` — added `@nuxtjs/i18n` module + i18n config (locales, langDir, lazy, ICU bundle settings, `vueI18n: './i18n/i18n.config.ts'`)
  - `i18n/i18n.config.ts` — created `defineI18nConfig` with custom ICU `messageCompiler`, numberFormats, datetimeFormats
  - `i18n/locales.ts` — locale constants module
  - `i18n/locales/en.json`, `es.json` — non-ICU seeds (just `welcome`)
  - `app/components/LanguageSwitcher.vue` — switcher component
  - `app/app.vue` — added `useLocaleHead`, switcher, `<NuxtPage>`
  - `CLAUDE.md` — created with `@.claude/skills/vue-code/SKILL.md` import
  - `scripts/checkLocales.mjs` — CI catalog sanity check
- Deps added: `@nuxtjs/i18n@^10.2.4`, `intl-messageformat@^11.2.1`
- Blockers: none. `nuxt prepare` and `nuxt build` both succeeded with the seed catalogs.

### Convert skill
- Skill: `vue-convert`
- Outcome: failed
- Strings wrapped (count): 11 entries from `app/pages/index.vue` (title, intro, privacy + privacyLink, welcomeBack, totalSpent, lastUpdated, cartLine, items plural, replied select; plus pre-existing `welcome` seed). Currency wrapped via `n(amount, 'currency')`, date via `d(date, 'long')`, inline link via `<i18n-t>`.
- Strings skipped/failed: none skipped during wrapping. The `items` ICU plural and `replied` ICU select cause `unplugin-vue-i18n` build error 2 ("Invalid token in placeholder: 'count,'"), breaking both `nuxt build` and `nuxt dev` (locale files fail to load entirely; `WARN Failed to load messages for locale "en"`).
- Blockers: ICU plural/select syntax in JSON catalogs is incompatible with the `@nuxtjs/i18n` + `bundle.runtimeOnly: false` lazy-load pipeline. This is the exact failure mode that vue-setup's `references/nuxt.md` § "ICU seed" documents — but vue-convert Step 6 still prescribes `{count, plural, …}` / `{gender, select, …}` in JSON without warning the user or routing them to one of the three workarounds the Nuxt reference lists (SFC `<i18n>` blocks, drop `langDir`+`lazy`, wait upstream).

### Deviations from SKILL.md
- vue-setup says to pin `@nuxtjs/i18n` to `^9` ("at time of writing"); npm installed `^10.2.4` because no version was passed. Latest `@nuxtjs/i18n` works (build + prepare succeed) but the skill's hint is stale.
- vue-setup Step 1 prescribes a "Setup Mode" prompt and a catalog-format prompt; both skipped per unguided-mode rules and defaults table (JSON, `prefix_except_default`, `es` target).
- vue-convert Step 8 verification (dev server boots) was not performed before declaring success. The Nuxt-specific contradiction means following vue-convert as written produces ICU JSON catalogs that vue-setup's own Nuxt reference file warns will fail. The convert skill should either (a) detect Nuxt + JSON catalogs and skip plural/select branches, or (b) seed an SFC `<i18n>` block / static-import workaround as part of the wrap.
- vue-convert Step 5 flags module-scope `Intl.NumberFormat` / `Intl.DateTimeFormat` constants as "always flag". The originals on lines 32–41 of `index.vue` were removed in favor of `n()`/`d()` — handled correctly. (Minor note: did not pass `useScope: 'global'` to `useI18n()` because vue-convert doesn't say to; for `@nuxtjs/i18n` with `defineI18nConfig`, this happens to work because the module installs the global scope as the default, but it's not stated in the skill.)
- vue-convert Step 10 (cost estimate + Globalize CLI offer) was skipped — no user to interact with in eval mode.

### Overall verdict
A real user following these skills end-to-end would land in a broken state. vue-setup alone produces a working baseline (build passes, switcher renders, seed catalogs load) — that part is solid. The failure is the seam between the two skills: vue-convert's Step 6 prescribes ICU plural/select inside JSON catalogs, but vue-setup's Nuxt reference explicitly warns this combination doesn't work with `@nuxtjs/i18n` + lazy JSON. After the convert skill runs its first plural, the project is dead — neither `nuxt build` nor `nuxt dev` can load the locale files. The weakest link is vue-convert's lack of awareness of the Nuxt-specific ICU restriction; it should either gate ICU plural/select emission on `framework !== 'nuxt' || catalogFormat !== 'json'`, or auto-route ICU-bearing strings into SFC `<i18n>` blocks the way the Nuxt reference suggests as a workaround.
