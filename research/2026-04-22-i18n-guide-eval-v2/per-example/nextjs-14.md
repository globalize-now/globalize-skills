## nextjs-14

### Detection
- Framework: Next.js 14.2.0
- Router: App Router (`app/layout.tsx` + `app/page.tsx`)
- Package manager: npm (`package-lock.json`)
- Existing i18n lib: none

### i18n-guide
- Recommended: next-intl (Rule 1: Next.js detected)
- STOP reason (if any): N/A

### Setup skill
- Skill: next-intl-setup
- Outcome: success
- Files changed:
  - `i18n/routing.ts` — defineRouting with locales en/es, defaultLocale en, localePrefix `as-needed`
  - `i18n/request.ts` — getRequestConfig loading `messages/${locale}.json`
  - `i18n/navigation.ts` — createNavigation exports
  - `next.config.mjs` — wrapped with `createNextIntlPlugin({experimental.messages.precompile: true})`
  - `middleware.ts` — createMiddleware(routing) with recommended matcher
  - `messages/en.json`, `es.json` — seed catalogs
  - `app/layout.tsx` — async root layout, `<html lang={locale}>`, NextIntlClientProvider
  - `app/[locale]/layout.tsx` — locale layout with hasLocale guard, setRequestLocale, generateStaticParams, nav + LanguageSwitcher
  - `app/[locale]/page.tsx` — moved from `app/page.tsx`, added setRequestLocale
  - `components/LanguageSwitcher.tsx` — client switcher using `Intl.DisplayNames`
  - `global.d.ts` — `IntlMessages` declaration for type-checked keys (Step 13)
  - `package.json` — `lint:i18n` script
- Deps added: `next-intl@4.9.1`
- Blockers: none. `npm run build` succeeded; both `/` (en) and `/es` returned 200 with correct `<html lang>` and locale-prefixed Links.

### Convert skill
- Skill: next-intl-convert
- Outcome: success
- Strings wrapped (count): 13 (HomePage: 9, Navigation: 2, LanguageSwitcher: 1, common.title pre-existed; existing helper functions `itemsLabel` and `replyLine` were collapsed into ICU plural and ICU select messages)
- Strings skipped/failed: none
- Blockers: none. Production build (precompile=true) renders plurals (`0 items` / `1 item` / `5 items`), select (`She replied`), interpolation, locale-aware currency (`$1,234.56` vs `1234,56 US$`), and locale-aware date (`April 22, 2026` vs `22 de abril de 2026`).

### Deviations from SKILL.md
- **Next.js 14 `params` shape**: skill reference repeatedly shows `params: Promise<{locale: string}>` (Next 15+). For Next 14, params is a synchronous object — the skill mentions this only in passing (one parenthetical: "for Next.js 13-14, use `params: {locale: string}` directly"). Easy to miss in unguided execution; had to course-correct after first writing the Next-15 form.
- **Page-level `setRequestLocale`** isn't in the SKILL.md's Step 9 file-move plan; it lives only in the App Router reference. An unguided run that doesn't open the reference would skip it and silently lose static rendering on the home page.
- **Path-alias rewriting**: project has no `@/*` alias in `tsconfig.json`. The skill's "rewrite to relative paths" instruction worked, but had to be applied to every emitted file (routing/request/navigation/layout/component). One small inconsistency: skill samples show `../../i18n/routing` from `app/[locale]/layout.tsx`, but absent the alias the LanguageSwitcher sample also needs rewriting (the skill text doesn't call it out — only the per-file consideration).
- **Layout split**: skill says root layout can keep the provider OR delegate to locale layout. Put a provider in both (root for any root-only routes; locale for actual pages) per the App Router reference's "two-layout" guidance. Worked but means two NextIntlClientProvider wrappers in the tree on every locale request — fine per the reference's note ("inner provider takes precedence via React context") but a bit redundant.
- **Convert skill 7.0 file count threshold**: only 3 source files needed wrapping; sequential path applied trivially.

### Overall verdict
A real user following these skills end-to-end on this project would land in a fully working state: build green, both locales statically generated, plurals/select/currency/date/interpolation all correct in production with `precompile: true`, language switcher functional with `Intl.DisplayNames` rendering localized language names. The weakest link is the Next 14 vs 15 `params` shape — the skill's primary code samples assume Next 15+ and the Next 14 callout is a single parenthetical inside the reference file; an unguided agent that doesn't read the reference closely will write code that fails type-check on Next 14. Second weakest link: `setRequestLocale` is required in every page (not just the layout) for static rendering, and that requirement only appears in the reference, not in the main SKILL.md's Step 9 move plan.
