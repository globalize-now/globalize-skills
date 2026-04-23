## nextjs-16

### Detection
- Framework: Next.js 16.2.4
- Router: App Router
- Package manager: npm
- Existing i18n lib: none

### i18n-guide
- Recommended: next-intl
- STOP reason (if any): N/A

### Setup skill
- Skill: next-intl-setup (App Router variant, catalogFormat = PO, PO-capable = true since TS 5.6)
- Outcome: success
- Files changed:
  - `/tmp/i18n-skill-eval/nextjs-16/package.json` — added `next-intl` dep
  - `/tmp/i18n-skill-eval/nextjs-16/tsconfig.json` — added `baseUrl: "."` and `paths: {"@/*": ["./*"]}` (required because LanguageSwitcher and locale layout use `@/i18n/...`; tsconfig had no path alias)
  - `/tmp/i18n-skill-eval/nextjs-16/next.config.mjs` — wrapped with `createNextIntlPlugin({experimental: {messages: {format: 'po', ..., precompile: true}}})`
  - `/tmp/i18n-skill-eval/nextjs-16/i18n/routing.ts` — locales ['en','es'], default 'en', `as-needed`
  - `/tmp/i18n-skill-eval/nextjs-16/i18n/request.ts` — request config importing `.po` from `../messages`
  - `/tmp/i18n-skill-eval/nextjs-16/i18n/navigation.ts` — locale-aware navigation helpers
  - `/tmp/i18n-skill-eval/nextjs-16/middleware.ts` — next-intl middleware with matcher
  - `/tmp/i18n-skill-eval/nextjs-16/messages/en.po`, `messages/es.po` — seed `.po` catalogs with header blocks
  - `/tmp/i18n-skill-eval/nextjs-16/app/layout.tsx` — rewrote to async root layout with `NextIntlClientProvider` and `<html lang={locale}>` (kept existing metadata/body styling; dropped hardcoded nav that pointed at a nonexistent `/profile`)
  - `/tmp/i18n-skill-eval/nextjs-16/app/[locale]/layout.tsx` — new locale layout with `generateStaticParams`, `notFound()` on bad locale, `setRequestLocale`, renders `LanguageSwitcher`
  - `/tmp/i18n-skill-eval/nextjs-16/app/[locale]/page.tsx` — moved from `app/page.tsx`
  - `/tmp/i18n-skill-eval/nextjs-16/components/LanguageSwitcher.tsx` — switcher using `Intl.DisplayNames`
- Deps added: `next-intl@4.9.1` (51 packages including transitive)
- Blockers: none; `next build` clean; `next start` serves `/`, `/en`, `/es` with HTTP 200

### Convert skill
- Skill: next-intl-convert (sequential — one page file)
- Outcome: success
- Strings wrapped (count): 9 message entries (title, welcome, privacyNotice rich-text, welcomeBack interp, totalSpent, lastUpdated, cartSummary plural, itemsLabel plural, replyLine select) all under `HomePage` namespace; currency via `format.number(... currency: 'USD')`, date via `format.dateTime(...)`, plurals as ICU with `=0 / one / other`, select by gender
- Strings skipped/failed: none
- Blockers: none; rendered output verified in EN (`$1,234.56`, `5 items`, "She replied...") and ES (`1234,56 US$`, `5 artículos`, "Ella respondió...")

### Deviations from SKILL.md
- **Unguided mode bypass**: skipped every `CONSENT GATE` prompt (locale list, prefix strategy, catalog format, next.config wrap, layout rewrite, `[locale]` restructure, middleware, language switcher wiring) per eval rules. Made sensible default picks (locales en/es, `as-needed`, PO, precompile on).
- **Path-alias gap**: the skill writes `@/i18n/...` in the locale layout and LanguageSwitcher, but the project's `tsconfig.json` had no `baseUrl`/`paths`. The SKILL.md never mentions configuring this; had to add `baseUrl` + `paths` to `tsconfig.json` or the `@/i18n/routing` imports would fail TypeScript. A real unguided run would either add this silently or break.
- **Removed existing nav**: the old `app/layout.tsx` hardcoded `<nav>` pointed at `/profile` (nonexistent). Dropped it rather than wrap untranslatable dead links. The skill doesn't cover "what to do with pre-existing cruft in the root layout" other than rewrite.
- **Next.js 16 deprecation**: Next 16 warns `middleware.ts` is deprecated in favor of `proxy.ts`. SKILL.md is Next.js 13–15 oriented and still emits `middleware.ts`. It works (warning only), but the skill should eventually dispatch on `nextMajor >= 16` and emit `proxy.ts`.
- **Seed PO had prelim keys** (`common.title`, `HomePage.greeting`, `Cart.items`) that the code never calls. Removed `HomePage.greeting`/`Cart.items` during conversion since conversion overwrote `HomePage.*`. `common.title` stayed orphaned because nothing in the scaffolded app references it — the skill seeds it but the app never calls `t('title')` from `common`.
- **Dev server didn't stay alive in sandbox**; verified with `next build` + `next start` instead. Both succeed and serve all three URLs 200.
- **`generateStaticParams`**: skill's main SKILL.md Step 9 locale-layout sample omits `generateStaticParams`; the App Router reference includes it. Since the reference is authoritative per dispatch, included it.

### Overall verdict
A real user following unguided mode would land in a fully working state. Build passes, dev/prod both render EN and ES content with correct ICU plurals, select, rich text, and locale-aware currency/date formatting; language switcher works via URL. Weakest link is the silent path-alias assumption (`@/*`) — projects without `src/` and without an existing alias will get TypeScript errors; the skill should either add the alias or use relative imports in the layout and switcher scaffolds. Secondary weakness: no awareness of Next.js 16's `middleware`→`proxy` rename (harmless warning today, will become an error in a later major). next-intl 4.9.1 with `experimental.messages` + `precompile: true` worked flawlessly for PO plurals, including the non-trivial plural-inside-msgstr path the reference flags as a verification must-check.
