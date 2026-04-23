## react-router

### Detection
- Framework: Vite + React 19 SPA
- Router: `react-router` v7 (programmatic `BrowserRouter` in `main.tsx`, no `app/routes/` framework mode)
- Package manager: npm (`package-lock.json`)
- Existing i18n lib: none

### i18n-guide
- Recommended: LinguiJS (Rule 3: React SPA, no Next.js)
- STOP reason (if any): N/A

### Setup skill
- Skill: `lingui-setup` → `references/vite-babel.md` (uses `@vitejs/plugin-react`, not SWC). Plain SPA (no file-based routing) → single catalog + Option 3 (no URL locale routing).
- Outcome: success
- Files changed:
  - `/tmp/i18n-skill-eval/react-router/src/i18n/locales.ts` — new: shared `sourceLocale` + `locales` constants
  - `/tmp/i18n-skill-eval/react-router/lingui.config.ts` — new: single-catalog Lingui config
  - `/tmp/i18n-skill-eval/react-router/vite.config.ts` — modified: added `@lingui/babel-plugin-lingui-macro` and `lingui()` plugin
  - `/tmp/i18n-skill-eval/react-router/src/i18n.ts` — new: runtime locale detection, catalog loader, `saveLocale`, kicks off initial `loadCatalog`
  - `/tmp/i18n-skill-eval/react-router/src/components/LanguageSwitcher.tsx` — new: `<select>`-based switcher using `useLingui` + `loadCatalog`
  - `/tmp/i18n-skill-eval/react-router/src/main.tsx` — modified: wrapped tree with `<I18nProvider>`, rendered `<LanguageSwitcher>` inside the router
  - `/tmp/i18n-skill-eval/react-router/package.json` — modified: added `lingui:extract`/`lingui:compile` scripts, prepended `lingui compile --typescript` to build
  - `/tmp/i18n-skill-eval/react-router/.gitignore` — modified: ignore compiled `src/locales/*/messages.ts`
  - `/tmp/i18n-skill-eval/react-router/src/locales/{en,es}/messages.po` — new: source catalogs (initially empty)
  - `/tmp/i18n-skill-eval/react-router/CLAUDE.md` — new: `@.claude/skills/lingui-code/SKILL.md` import
- Deps added: runtime `@lingui/core @lingui/react @lingui/macro @lingui/detect-locale`; dev `@lingui/cli @lingui/babel-plugin-lingui-macro @lingui/vite-plugin`
- Blockers: none (`npm run build` succeeded end-to-end)

### Convert skill
- Skill: `lingui-convert` (react-standard reference implied; not separately read — only two source files)
- Outcome: success
- Strings wrapped (count): 12 extracted messages (covers all user-visible strings across `ProfilePage.tsx` and `PrivacyPage.tsx`: headings, paragraphs, plurals via `<Plural>`, gender select via `<Select>`, currency via `i18n.number`, date via `i18n.date`, interpolated variables, inline `<Link>` inside `<Trans>`)
- Strings skipped/failed: none (one TS error fixed mid-run — see deviations)
- Blockers: none

### Deviations from SKILL.md
- The convert skill's `<Select>` example uses bare option props (`male="..." female="..." other="..."`), but `@lingui/react/macro` v5's `SelectChoiceProps` type only permits `other` and index-signature keys shaped like `_<option>` (e.g. `_male`, `_female`). The literal example from Step 6 produces a TS2322 error under `tsc -b`. Had to change to `_male` / `_female` to pass TypeScript. The skill should update the React `<Select>` example (the ICU output in the PO file is still correct: `male { ... } female { ... }`).
- `src/i18n.ts` dynamic import path (`./locales/${locale}/messages.ts`) produced an extra Vite chunk per locale (messages-*.js) — works, but worth noting that the skill's glob pattern will match in a way that may confuse projects using `.js` catalogs.
- Setup skill's unguided summary template wasn't emitted verbatim (not strictly required, but the skill prescribes a markdown block).
- No git repo present, so branch recommendation and `git` detection steps were silently skipped — consistent with the skill's "skip silently" clause.
- lingui-guide's Step 3 (app domain detection) was skipped because only 2 tiny files existed and the convert step ran sequentially without a real user to confirm a domain.

### Overall verdict
A real user following the guide unguided would land in a working, buildable state: `npm run build` succeeds, the dev server boots with `<I18nProvider>`, catalogs compile to TypeScript, the language switcher dynamically loads and activates `es` via `localStorage` + URL param detection, and all 12 UI strings (including plural, gender select, currency, and date) are extracted into `messages.po`. Weakest link: the `<Select>` JSX example in `lingui-convert` Step 6 is not TypeScript-valid against `@lingui/react/macro`'s current `SelectChoiceProps`, so an agent pasting the skill verbatim will hit a `tsc` error and must pivot to `_<option>` keys. Small fix, but it's the one place the skill's sample code is wrong.
