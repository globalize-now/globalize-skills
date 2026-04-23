## nextjs-14

### Detection
- Framework: Next.js 14.2 (App Router)
- Router: App Router (`app/layout.tsx`, no `pages/`)
- Package manager: npm (`package-lock.json`)
- Existing i18n lib: none

### i18n-guide
- Recommended: next-intl (Rule 1: Next.js detected)
- STOP reason (if any): N/A

### Setup skill
- Skill: next-intl-setup
- Outcome: success
- Files changed:
  - `/tmp/i18n-skill-eval/nextjs-14/i18n/routing.ts` — locales `['en','es']`, default `en`, `localePrefix: 'as-needed'`
  - `/tmp/i18n-skill-eval/nextjs-14/i18n/request.ts` — getRequestConfig loading `.po` messages
  - `/tmp/i18n-skill-eval/nextjs-14/i18n/navigation.ts` — locale-aware Link / router wrappers
  - `/tmp/i18n-skill-eval/nextjs-14/middleware.ts` — next-intl middleware with recommended matcher
  - `/tmp/i18n-skill-eval/nextjs-14/next.config.mjs` — wrapped with `createNextIntlPlugin({experimental: {messages: {format: 'po', precompile: true, ...}}})`
  - `/tmp/i18n-skill-eval/nextjs-14/app/layout.tsx` — dynamic `<html lang>`, root NextIntlClientProvider
  - `/tmp/i18n-skill-eval/nextjs-14/app/[locale]/layout.tsx` — new locale layout with `setRequestLocale`, `generateStaticParams`, `notFound` guard, provider, switcher
  - `/tmp/i18n-skill-eval/nextjs-14/app/[locale]/page.tsx` — moved from `app/page.tsx`
  - `/tmp/i18n-skill-eval/nextjs-14/components/LanguageSwitcher.tsx` — client select component using `Intl.DisplayNames`
  - `/tmp/i18n-skill-eval/nextjs-14/messages/en.po` — source catalog with header + seed + verify keys
  - `/tmp/i18n-skill-eval/nextjs-14/messages/es.po` — target catalog
- Deps added: `next-intl@4.9.1`
- Blockers: none (production build succeeded; both `/en` and `/es` prerender statically)

### Convert skill
- Skill: next-intl-convert
- Outcome: success
- Strings wrapped (count): 8 distinct user-facing strings in `app/[locale]/page.tsx` (profile title, welcome paragraph, privacy notice w/ rich `<link>` tag, welcome-back interpolation, total-spent w/ currency formatter, last-updated w/ date formatter, cart plural used in 4 call sites, gender-select reply line) — 8 new `HomePage.*` PO entries
- Strings skipped/failed: none
- Blockers: none

### Deviations from SKILL.md
- Setup skill Step 1 says `params` in the locale layout is `Promise<{locale: string}>` for Next 15+; for Next 14 the reference says to use a plain object. Used the plain-object form to match Next 14.2 — build passed. The main SKILL.md's "App Router" code sample at Step 9 ships the Promise form only; a skimmer on Next 14 would hit a runtime error. The variant reference file does call this out correctly in a parenthetical note.
- Unguided-mode "required choices" (locale list, default locale, prefix strategy) plus the catalog-format PO gate are specified as MUST-WAIT prompts even in unguided mode. For an automated eval run there is no user to answer, so I took the defaults (`en`/`es`, `as-needed`, PO). The skill could tighten by saying "in fully non-interactive contexts, apply these defaults" — right now unguided still gates on four prompts.
- The project has no `src/` and no `@/*` path alias in `tsconfig.json`. The skill's reference file uses `@/i18n/routing` throughout; I substituted relative imports (`../i18n/routing`, `../../i18n/routing`). No friction, but a note like "if no `baseUrl`/`paths` alias exists, use relative imports" would make it fully copy-pasteable.
- No `next-intl-setup` step wires a path alias when one is missing — minor.
- Setup Step 12 verification requires running the dev server and visually confirming plural rendering; the eval environment blocks binding a server port, so verified via production build (clean compile, both locales statically generated) + `tsc --noEmit` (clean). The PO+precompile ICU bodies compiled at build time, which is a stronger check than runtime fetch would have been for the parse path (but does not exercise the ~650 B runtime evaluator against a real request). The skill's Step 12 notes the plural runtime-path blind spot; without a port this cannot be fully closed.
- Convert skill's Step 7.2 cost estimate / Globalize offer is a trailing "offer" — irrelevant for a 1-file project (7.1 sequential path was correctly selected); no deviation, just noting it wasn't exercised.

### Overall verdict
A real user would land in a working state. The setup skill's detection path was clean, the PO+precompile build path succeeded end-to-end, types check, both locales statically prerender, and the convert skill correctly handled every string shape in the sample page (plain text, long copy, rich text with inline link, variable interpolation, currency + date formatting, plurals including exact `=0`, gender select). The weakest link is that "unguided" mode as written still has four blocking prompts — so a truly non-interactive run (CI, eval, or a user who picks "unguided" hoping for zero interruption) hits consent gates the mode docs suggested were suspended. The App Router variant reference correctly handles Next 14's synchronous `params`, but the main SKILL.md's inline snippet only shows the Next 15 Promise form — a user who reads only the top-level file and is on 14 would ship a broken locale layout.
