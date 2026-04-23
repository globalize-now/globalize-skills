## nextjs-pages-router

### Detection
- Framework: Next.js 15.0 (resolved to 15.5.15)
- Router: Pages Router (`pages/_app.tsx` + `pages/index.tsx`; no `app/`)
- Package manager: npm (`package-lock.json`)
- Existing i18n lib: none

### i18n-guide
- Recommended: next-intl (Rule 1: `next` in deps)
- STOP reason (if any): N/A

### Setup skill
- Skill: next-intl-setup (Pages Router + PO catalog)
- Outcome: partial — setup produced a running app only after flipping `precompile: true` to `precompile: false`. With the skill's default (`precompile: true`), every ICU message (interpolation, plural, select, rich text) throws `INVALID_MESSAGE` at render, in both dev and prod. Non-ICU plain keys work. The `use-intl/format-message` → `format-only` webpack alias the plugin installs does not take effect for the Pages Router page bundle on next-intl 4.9.1 / Next 15.5.15 / webpack — the precompiled arrays reach the runtime that still expects string ICU source.
- Files changed:
  - `/tmp/i18n-skill-eval/nextjs-pages-router/next.config.mjs` — wrapped with `createNextIntlPlugin`, added `i18n` key for Pages Router locale routing (final value has `precompile: false` after the fix)
  - `/tmp/i18n-skill-eval/nextjs-pages-router/pages/_app.tsx` — added `NextIntlClientProvider` + mounted `LanguageSwitcher`
  - `/tmp/i18n-skill-eval/nextjs-pages-router/tsconfig.json` — added `baseUrl` + `@/*` path alias so `@/components/...` and `@/lib/...` imports resolve (skill uses them without adding the mapping)
- Files created:
  - `/tmp/i18n-skill-eval/nextjs-pages-router/i18n/routing.ts` — `defineRouting({locales: ['en','es'], defaultLocale: 'en'})`
  - `/tmp/i18n-skill-eval/nextjs-pages-router/i18n/request.ts` — required even for Pages Router; plugin errors otherwise (not documented in the reference)
  - `/tmp/i18n-skill-eval/nextjs-pages-router/messages/en.po`, `messages/es.po` — PO catalogs with dot-path msgids
  - `/tmp/i18n-skill-eval/nextjs-pages-router/lib/getMessages.ts` — shared helper from the Pages Router reference, using `.po`
  - `/tmp/i18n-skill-eval/nextjs-pages-router/components/LanguageSwitcher.tsx` — from the reference, styled with inline CSS
- Deps added: `next-intl@4.9.1` (+49 transitive)
- Blockers: none that stopped the run, but two skill-prescribed instructions produced broken behavior and had to be overridden: (a) `precompile: true` in the plugin block; (b) the reference says Pages Router skips `i18n/request.ts`, but `createNextIntlPlugin` with `experimental.messages` errors at build ("Could not locate request configuration module") until one exists.

### Convert skill
- Skill: next-intl-convert (Pages Router + PO)
- Outcome: success
- Strings wrapped (count): 15 unique msgids on `pages/index.tsx` (`Profile.pageTitle`, `home`, `heading`, `welcome`, `aboutHeading`, `aboutBody`, `privacyLine`, `totalSpent`, `lastUpdated`, `cartHeading`, `cartSummary`, `itemsLabel`, `activityHeading`, `reply`, plus the setup-seeded `HomePage.greeting` / `Cart.items`). Patterns exercised: plain text, interpolation, rich text (`t.rich`), plural with `=0/one/other`, select on `gender`, `useFormatter().number` (currency), `useFormatter().dateTime`.
- Strings skipped/failed: `toLocaleDateString`/`Intl.NumberFormat` calls in the original `getServerSideProps` were removed in favor of `useFormatter` in the component (server-side pre-formatting also works, but `useFormatter` gives proper locale-aware output in each locale at render time — verified: ES shows `1234,56 US$` and `22 de abril de 2026`).
- Blockers: none — only surfaced after the setup `precompile` fix above.

### Deviations from SKILL.md
- **`precompile: true` default is broken on Pages Router + PO** (next-intl 4.9.1, Next 15.5.15, webpack). The webpack alias `use-intl/format-message` → `use-intl/format-message/format-only` that the plugin wires up does not reach the client runtime for Pages Router bundles; every ICU message throws `INVALID_MESSAGE` at render. Had to set `precompile: false`. The skill's fallback instructions explicitly forbid "keep `experimental.messages` and set `precompile: false`" (it claims this rewires the loader path) — empirically that advice is wrong: `precompile: false` with the block kept produces a working build. The real advice should be the opposite: on Pages Router, keep the block and leave `precompile: false`, or drop the whole block (bare `createNextIntlPlugin()`), but do NOT enable precompile until this is fixed upstream.
- **Pages Router requires `i18n/request.ts` when `experimental.messages` is passed.** The Pages Router reference says "Steps 4 and 6: Skipped", but the plugin hard-errors at build without a request file ("Could not locate request configuration module"). A stub is enough; the file is never consulted at runtime in Pages Router, but its presence is mandatory.
- **Path alias setup is implicit.** Both setup and convert references use `@/lib/getMessages` / `@/components/LanguageSwitcher`, but the starter `tsconfig.json` has no `paths` mapping. The skill should either add the alias or use relative imports.
- **Misleading warning** — `createNextIntlPlugin` logs "An `i18n` property was found in your Next.js config... should therefore be removed if you use the App Router" on every run, even though the Pages Router path explicitly requires this `i18n` property. The skill does not mention this warning is expected and safe on Pages Router; a real user will likely try to "fix" it.
- **Unguided mode consent gates** — the skill says PO choice MUST be user-confirmed even in unguided mode, but the eval forbids prompting. Took "PO recommended" as a sensible default. If the skill truly wants unguided to still gate PO, it contradicts the eval's "unguided only / no user" contract. Recommend making PO the silent default in unguided.

### Overall verdict
A real user following the skill in unguided mode on a Pages Router project would **not** land in a working state: they'd get a clean build, a rendering switcher, and simple keys would work — but the first ICU message (any plural, any `{name}` interpolation, anything using `useFormatter`) throws at render time and the page crashes. The weakest link is the default `precompile: true` recommendation combined with the skill's explicit (and wrong) warning against "keeping the block but setting precompile: false." Two secondary gaps — the implicit `@/*` path alias and the undocumented requirement for `i18n/request.ts` on Pages Router — would each be a 10-minute detour for a user not comfortable reading stack traces. With `precompile: false` and a request.ts stub, the full end-to-end (setup + convert) produces a correct, locale-aware app; the convert skill itself is solid and the PO authoring guidance is good.
