## nextjs-16

### Detection
- Framework: Next.js 16.2.4 (App Router, Turbopack)
- Router: App Router (`app/` with `layout.tsx`)
- Package manager: npm (`package-lock.json`)
- Existing i18n lib: none

### i18n-guide
- Recommended: next-intl (Rule 1: Next.js detected)
- STOP reason (if any): N/A

### Setup skill
- Skill: next-intl-setup
- Outcome: success
- Files changed:
  - `i18n/routing.ts` — defineRouting (locales en/es, defaultLocale en, localePrefix as-needed)
  - `i18n/request.ts` — getRequestConfig with hasLocale guard, JSON message loader, onError handler
  - `i18n/navigation.ts` — createNavigation(routing) exporting Link/redirect/usePathname/useRouter/getPathname
  - `next.config.mjs` — wrapped with createNextIntlPlugin, experimental.messages JSON precompile=true
  - `proxy.ts` — middleware (uses Next 16 `proxy.ts` rename per skill ref)
  - `app/layout.tsx` — async root layout, dynamic `<html lang={locale}>`, NextIntlClientProvider for root-level fallback
  - `app/[locale]/layout.tsx` — locale layout with hasLocale validation, setRequestLocale, generateStaticParams, NextIntlClientProvider, nav + LanguageSwitcher wired
  - `app/[locale]/page.tsx` — moved from app/page.tsx; setRequestLocale at top
  - `messages/en.json`, `messages/es.json` — seed catalogs
  - `components/LanguageSwitcher.tsx` — client `<select>` using `useLocale`, `useRouter`, `usePathname`, `Intl.DisplayNames`
  - `types/next-intl.d.ts` — IntlMessages augmentation from en.json (Step 13)
  - `package.json` — added `lint:i18n: tsc --noEmit` script (Step 13)
- Deps added: next-intl@4.9.1
- Blockers: none. Verified at runtime: `/` returns 200 with `<html lang="en">`; `/es` returns 200 with `<html lang="es">`; ICU plural rendered correctly in both locales (precompile path confirmed working).

### Convert skill
- Skill: next-intl-convert
- Outcome: success
- Strings wrapped (count): 14
  - Navigation: home, profile (2)
  - HomePage: greeting, title, intro, privacyNotice (rich text), welcomeBack (interpolation), totalSpent (currency via getFormatter), lastUpdated (date via getFormatter), cartItems (plural with =0), itemsLabel (plural), replyLine (gender select) (10 keys, 12 t() call sites)
- Strings skipped/failed: 0 user-facing strings skipped. Root `app/layout.tsx` `<title>` / `<description>` metadata left as-is (lives outside `[locale]`, would require restructuring metadata to a `generateMetadata` in the locale layout — not in scope of skill's incremental wrapping).
- Blockers: none. Verified `/`: lang=en, plurals/select/currency/date/rich-text all render English (`$1,234.56`, `April 22, 2026`, `She replied to your message`). Verified `/es`: lang=es, all render Spanish (`1234,56 US$`, `22 de abril de 2026`, `Ella respondio a tu mensaje`, locale-aware Link emits `/es/profile`).

### Deviations from SKILL.md
- Root layout's `<title>`/`<description>` metadata not wrapped — the convert skill mentions `generateMetadata` only as an example for `[locale]/layout.tsx`; for the root layout (which lives outside the locale segment and runs without per-request locale context) the skill is silent. Left it.
- The setup skill's "Verify Step Translation" block (Step 12) instructs adding the test `<p>{t('greeting')}</p>` etc. snippets to a page. Added them to the home page in the setup pass, then kept the test section when the convert skill ran later. A real user might want them removed at the end of setup.
- The convert skill removed the local helpers `itemsLabel`/`replyLine`/`currencyFormatter`/`dateFormatter`. The skill says to wrap strings, not how to delete redundant helpers — this was a judgment call to avoid dead code, since their behavior was now expressed via ICU + `getFormatter`.
- Path-aliases: `tsconfig.json` had no `@/*` mapping. Per the skill's leading "Path aliases" rule rewrote every `@/...` import in emitted code to relative paths (e.g. `../../i18n/routing`). Worked cleanly.
- Step 13 PO note: skipped — JSON path was used.

### Overall verdict
A real user running both skills end-to-end on a fresh Next.js 16 App Router project would land in a fully working state: package installed, request/routing/navigation/middleware (correctly named `proxy.ts` for Next 16) wired, `[locale]` segment created with proper validation and `setRequestLocale`, language switcher rendered, two locales translating server- and client-rendered content, plurals/select/rich text/date/number formatting all functional. The skill's `experimental.messages` precompile path works on next-intl 4.9.1 without surprises. The weakest link is the convert skill's silence on what to do with hand-rolled formatting helpers (`Intl.NumberFormat` / `Intl.DateTimeFormat` constants outside the component) and root-layout metadata — both can be wrapped, but the skill doesn't spell out either case, so different operators may diverge here.
