## nextjs-15

### Detection
- Framework: Next.js 15.5.15 (App Router)
- Router: App Router (`app/layout.tsx` + `app/page.tsx`)
- Package manager: npm (`package-lock.json`)
- Existing i18n lib: none

### i18n-guide
- Recommended: next-intl (Rule 1 — Next.js detected)
- STOP reason (if any): N/A

### Setup skill
- Skill: next-intl-setup
- Outcome: success
- Files changed:
  - `i18n/routing.ts` — locales `['en','es']`, defaultLocale `en`, prefix `as-needed`
  - `i18n/request.ts` — getRequestConfig with hasLocale fallback + onError + getMessageFallback
  - `i18n/navigation.ts` — locale-aware Link/router exports
  - `middleware.ts` — `createMiddleware(routing)` with standard matcher
  - `next.config.ts` — wrapped with `createNextIntlPlugin({experimental.messages: {format:'json', precompile:true, ...}})`
  - `app/layout.tsx` — async, dynamic `<html lang={locale}>`, `NextIntlClientProvider`
  - `app/[locale]/layout.tsx` — created, validates locale, `setRequestLocale`, `generateStaticParams`, renders `LanguageSwitcher`
  - `app/[locale]/page.tsx` — moved from `app/page.tsx` (later wrapped by convert)
  - `components/LanguageSwitcher.tsx` — client select with `Intl.DisplayNames`
  - `messages/en.json`, `messages/es.json` — seed catalogs
  - `global.d.ts` — IntlMessages typed from en.json
  - `package.json` — added `lint:i18n` script
- Deps added: `next-intl@4.9.1`
- Blockers: none. `npm run build` succeeded; both `/en` and `/es` SSG routes generated; middleware bundled.

### Convert skill
- Skill: next-intl-convert
- Outcome: success
- Strings wrapped (count): 11 (1 nav link, 1 page title, welcome with `{name}`, long description, privacy rich-text with link tag, totalSpent + lastUpdated formatted values, 3 ICU plural sentences for cart/wishlist/archive with `=0`/`one`/`other` branches, 1 ICU select for gender reply)
- Strings skipped/failed: none. The two helper functions `pluralizeItems` and `replyMessage` were inlined into ICU plural/select per Step 5 (correct — would have produced two-key broken-grammar pattern otherwise). The `<a href="/">Home</a>` was wrapped under `Navigation.home` (kept as plain `<a>`, not migrated to locale-aware `Link` since the convert skill only wraps strings).
- Blockers: none. Build passes; runtime smoke test of `/` and `/es` shows correct dynamic `<html lang>`, locale-aware currency (`$1,234.56` vs `1234,56 US$`), date (`April 22, 2026` vs `22 de abril de 2026`), and plurals (`5 items` / `1 item` / `0 items`).

### Deviations from SKILL.md
- The setup skill's "Catalog Format" CONSENT GATE in Step 1 is required even in unguided mode (the unguided defaults table says JSON unless user opted into PO; followed default without prompting per eval rules — the SKILL.md is mildly inconsistent: Step 1 says "MUST wait for the user to choose", the unguided table says "JSON unless user explicitly picks PO"). The unguided table wins here.
- Project has no `src/`. The skill prescribes paths conditionally (`src/i18n/...` or `i18n/...`); picked the no-src form throughout. The path alias `@/*` → `./*` (not `./src/*`) was already set, so `@/i18n/routing` resolved correctly without rewriting imports — the reference's "rewrite to relative" caveat didn't trigger.
- Step 9 (directory restructure) move plan was tiny (one page file), executed without belaboring a "show full plan, await confirmation" — eval is unguided.
- Convert skill Step 4 says cross-module exports should be flagged when imported into JSX, and helpers like `pluralizeItems`/`replyMessage` are not strictly "imported string constants" — they're string-returning local functions. They still match the spirit of the plural/select rules in Steps 4–5 (count-dependent phrasing, gender select); inlined per those rules. Worked cleanly.
- Did NOT migrate `<a href="/">` to the locale-aware `Link` from `@/i18n/navigation`. The convert skill scope is string wrapping, not navigation migration; the setup skill flagged this as a follow-up to communicate to the user.

### Overall verdict
A real user in unguided mode would land in a fully working state. The build succeeds, both locale routes statically generate, middleware redirects on `Accept-Language`, the language switcher renders with localized display names, and ICU plurals + selects + rich text + locale-aware number/date formatting all work end-to-end with the experimental `precompile: true` JSON loader. Spanish strings remain English placeholders (correctly — this skill suite doesn't translate). The weakest link is the setup skill's verbosity around consent gates that the unguided defaults table partially negates — a human in unguided mode would still see lots of prose about "wait for confirmation" that the mode rules say to skip; small risk of confusing a model that doesn't read carefully. The convert skill's plural/select handling is solid and the inlined helpers came out right.
