## nextjs-pages-router

### Detection
- Framework: Next.js 15.0 (`next ^15.0.0`)
- Router: Pages Router (`pages/_app.tsx`)
- Package manager: npm (`package-lock.json`)
- Existing i18n lib: none

### i18n-guide
- Recommended: next-intl (Rule 1: Next.js detected)
- STOP reason (if any): N/A

### Setup skill
- Skill: `next-intl-setup`
- Outcome: success (with one undocumented manual fix; see Deviations)
- Files changed:
  - `next.config.mjs` — wrapped with `createNextIntlPlugin()`, added `i18n` block (`locales: ['en','es']`, `defaultLocale: 'en'`)
  - `i18n/routing.ts` — `defineRouting({locales:['en','es'], defaultLocale:'en'})`
  - `i18n/request.ts` — stub created (NOT prescribed by skill for JSON Pages Router; see Deviations)
  - `lib/getMessages.ts` — shared message loader helper
  - `messages/en.json`, `messages/es.json` — seed catalogs
  - `pages/_app.tsx` — wrapped app in `NextIntlClientProvider`, mounted `<LanguageSwitcher />`
  - `components/LanguageSwitcher.tsx` — locale switcher using `next/link` + `Intl.DisplayNames`
- Deps added: `next-intl@4.9.1`
- Blockers: none (after applying the request-stub workaround)

### Convert skill
- Skill: `next-intl-convert`
- Outcome: success
- Strings wrapped (count): 12 (heading, pageTitle, welcome, nav.home, about.heading, about.body, privacyNotice rich text, totalSpent, lastUpdated, cart.heading, cart.items plural, activity.heading, activity.reply select)
- Strings skipped/failed: none
- Blockers: none. ICU plural (`=0/one/other`) and select (gender) render correctly; `useFormatter` produces `$1,234.56` / `April 22, 2026` for `en` and `1234,56 US$` / `22 de abril de 2026` for `es`. `t.rich` link renders as anchor.

### Deviations from SKILL.md
- **Catalog-format prompt skipped (unguided default).** Setup skill says JSON is the unguided default → followed.
- **Locale prefix prompt skipped on Pages Router.** The Pages Router reference notes `localePrefix` doesn't apply (Next.js' built-in `i18n` config is used) — main SKILL.md Step 3 still presents the prefix prompt unconditionally; treated as N/A here.
- **Required `i18n/request.ts` stub for Pages Router + bare plugin.** The skill says Step 4 is "Skipped" for Pages Router and the catalog-format-po reference only mentions the stub requirement when `experimental.messages` is set. In practice on `next-intl@4.9.1`, even a bare `createNextIntlPlugin()` with JSON catalogs hard-errors at boot with `Could not locate request configuration module` if no `i18n/request.ts` exists. Had to add a one-line stub returning `{locale:'en', messages:{}}`. The Pages Router JSON path needs the same "stub required" note that the PO branch has.
- **Spurious next-intl warning.** With `i18n` set in `next.config.mjs` (which the Pages Router reference instructs), `next-intl` logs an `i18n property was found...should be removed if you use the App Router` warning at every boot — this is App-Router-only advice but the plugin emits it unconditionally. Cosmetic, not a blocker. Could be worth a callout in the Pages Router reference so users don't think the setup is broken.
- **Path aliases.** Project has no `@/*` alias; followed the skill's instruction to use relative imports throughout.
- **Port collision in unguided dev verification.** Not a skill issue; `npm run dev` ignored my `PORT=` env so `next dev -p` was used directly to verify.

### Overall verdict
A real user following the unguided path lands in a working state for translations, plurals, select, rich text, and locale-aware number/date formatting on both `/` and `/es`. The weakest link is the Pages Router request-config stub: the skill's own dispatch table says Step 4 is skipped, but the next-intl 4.9.x plugin won't boot without `i18n/request.ts` even on the JSON path. A novice user would hit a hard-fail at first `npm run dev` and have no in-skill instruction explaining the stub. Adding a one-line note in the Pages Router reference (and probably adjusting Step 4 wording in the main SKILL.md) would close that gap. The misleading `i18n property was found` warning is also worth pre-empting in the docs.
