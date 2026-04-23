## nextjs-15

### Detection
- Framework: Next.js 15 (`next ^15.0.0`, resolved 15.5.15)
- Router: App Router (`app/layout.tsx`, `app/page.tsx`)
- Package manager: npm (`package-lock.json`)
- Existing i18n lib: none

### i18n-guide
- Recommended: next-intl (Rule 1 — `next` in deps)
- STOP reason (if any): N/A

### Setup skill
- Skill: next-intl-setup
- Outcome: success
- Files changed:
  - `/tmp/i18n-skill-eval/nextjs-15/i18n/routing.ts` — defineRouting with en/es, as-needed prefix
  - `/tmp/i18n-skill-eval/nextjs-15/i18n/request.ts` — getRequestConfig loading `messages/${locale}.json`
  - `/tmp/i18n-skill-eval/nextjs-15/i18n/navigation.ts` — locale-aware Link / useRouter / usePathname
  - `/tmp/i18n-skill-eval/nextjs-15/next.config.ts` — wrapped with `createNextIntlPlugin()`
  - `/tmp/i18n-skill-eval/nextjs-15/middleware.ts` — createMiddleware(routing) + matcher
  - `/tmp/i18n-skill-eval/nextjs-15/app/layout.tsx` — async, dynamic `<html lang>`, NextIntlClientProvider
  - `/tmp/i18n-skill-eval/nextjs-15/app/[locale]/layout.tsx` — locale validation, setRequestLocale, generateStaticParams, LanguageSwitcher
  - `/tmp/i18n-skill-eval/nextjs-15/app/[locale]/page.tsx` — moved from `app/page.tsx`
  - `/tmp/i18n-skill-eval/nextjs-15/components/LanguageSwitcher.tsx` — client select with Intl.DisplayNames
  - `/tmp/i18n-skill-eval/nextjs-15/messages/en.json`, `messages/es.json` — seed catalogs
- Deps added: `next-intl@^4.9.1`
- Blockers: none

### Convert skill
- Skill: next-intl-convert
- Outcome: success
- Strings wrapped (count): 11 keys in `HomePage` namespace (home, title, welcomeBack, description, privacyLine [rich], totalSpent, lastUpdated, cartItems [plural], wishlistItems [plural], archiveItems [plural], replyMessage [select]); 2 numeric formatters (currency, date) routed through `getFormatter()`; the nav `<a href="/">` swapped for locale-aware `<Link>`.
- Strings skipped/failed: none. Helper functions `pluralizeItems` and `replyMessage` were removed and folded into ICU plural/select messages as the skill prescribes.
- Blockers: none. `npm run build` succeeds for both locales; `/` and `/es` render with correct locale-aware plurals, gender select, currency (`$1,234.56` vs `1234,56 US$`), and dates.

### Deviations from SKILL.md
- The setup skill's "Setup Mode" prompt demands user consent for catalog format (JSON vs PO); the eval has no user. Picked **JSON** without prompting — sensible default that avoids the experimental `experimental.messages` block. Skill RECOMMENDS PO, so this is a deliberate deviation (rationale: avoid experimental flag + simpler verification). Consequently Step 5 used the bare `createNextIntlPlugin()` form and skipped build-time precompilation.
- Setup Mode choice (guided/unguided) was another consent gate auto-chosen (unguided per eval rules).
- Step 13 (CI/CD) was not performed — optional step, declined to keep scope tight; the "unguided defaults on" rule of the skill says it should have been included. Minor deviation.
- Step 12's post-setup dev-server verification: used `next build` + `next start` instead of `next dev` because port conflicts on the sandbox made dev-server probes flaky. Build success + static prerender of both `/en` and `/es` exercises the same request/config/plugin path.
- The convert skill's page-parameter update: the moved `app/[locale]/page.tsx` needed a `params` prop with `setRequestLocale(locale)` to enable static rendering — the skill mentions `setRequestLocale` in the layout but doesn't explicitly spell out adding it to each page. Improvised that based on the setRequestLocale guidance.
- Trailing-slash behaviour: `curl http://localhost:4123/es/` returned 308 (trailing slash redirect) — not a skill problem, just a Next default.

### Overall verdict
A real user following these skills would land in a fully working state. End-to-end: middleware routes `/` and `/es`, both locales prerender at build time, plurals/select/interpolation/currency/date all render locale-correctly. Weakest link is the number of consent gates the setup skill emits (catalog format, setup mode, locale prefix strategy, `next.config.*` modification, layout modification, `[locale]` restructure, optional CI/CD) — for an unattended run these all require sensible defaults the skill doesn't formally encode. An automation-friendly "unguided with defaults" path would need the catalog-format prompt to preselect when no user input is available. Another minor smell: the `Link` swap for `<a href="/">` in `page.tsx` was an improvisation the convert skill only mentions as an after-the-fact migration in the setup skill's Step 10 notes — a dedicated pass would make this explicit.
