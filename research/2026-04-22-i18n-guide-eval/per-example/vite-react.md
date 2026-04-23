## vite-react

### Detection
- Framework: Vite SPA (no router)
- Router: N/A (plain SPA — `main.tsx` directly renders `<App />`)
- Package manager: npm (`package-lock.json`)
- Existing i18n lib: none

### i18n-guide
- Recommended: LinguiJS (Rule 3 — Vite/React SPA, no Next.js, no Vue)
- STOP reason (if any): N/A

### Setup skill
- Skill: `lingui-setup` → variant `references/vite-babel.md`
- Outcome: partial
- Files changed:
  - `/tmp/i18n-skill-eval/vite-react/package.json` — added Lingui deps, `lingui:extract`/`lingui:compile` scripts, prepended `lingui compile --typescript` to `build`
  - `/tmp/i18n-skill-eval/vite-react/lingui.config.ts` — single-catalog config
  - `/tmp/i18n-skill-eval/vite-react/vite.config.ts` — added `@lingui/babel-plugin-lingui-macro` via `react({ babel: … })` and `lingui()` top-level plugin
  - `/tmp/i18n-skill-eval/vite-react/src/i18n/locales.ts` — `sourceLocale`/`locales` constants
  - `/tmp/i18n-skill-eval/vite-react/src/i18n.ts` — runtime `detectLocale`/`loadCatalog`/`saveLocale` + auto-load on import
  - `/tmp/i18n-skill-eval/vite-react/src/main.tsx` — wrapped `<App />` in `I18nProvider`
  - `/tmp/i18n-skill-eval/vite-react/src/components/LanguageSwitcher.tsx` — new `<select>`-based switcher
  - `/tmp/i18n-skill-eval/vite-react/src/App.tsx` — imported + rendered `<LanguageSwitcher />`
  - `/tmp/i18n-skill-eval/vite-react/src/locales/en/messages.po`, `src/locales/es/messages.po`, `.ts` (compiled)
  - `/tmp/i18n-skill-eval/vite-react/eslint.config.js` — added `eslint-plugin-lingui` flat preset
  - `/tmp/i18n-skill-eval/vite-react/.gitignore` — added `src/locales/*/messages.ts`
  - `/tmp/i18n-skill-eval/vite-react/CLAUDE.md` — created with `@.claude/skills/lingui-code/SKILL.md` import
- Deps added: `@lingui/core`, `@lingui/react`, `@lingui/macro`, `@lingui/detect-locale`, `@lingui/cli` (dev), `@lingui/babel-plugin-lingui-macro` (dev), `@lingui/vite-plugin` (dev), `eslint-plugin-lingui` (dev)
- Blockers:
  - `@vitejs/plugin-react` v6 (installed, 6.0.1) removed the `babel` option entirely — its `Options` interface now only exposes `include`/`exclude`/`jsxImportSource`/`jsxRuntime`/`reactRefreshHost`. The vite-babel reference's recipe (`react({ babel: { plugins: ['@lingui/babel-plugin-lingui-macro'] } })`) produces a TS2353 error during `tsc -b` and — more importantly — no longer runs Babel at build time, so `@lingui/babel-plugin-lingui-macro` is never applied and macros will not be transformed. `npm run build` fails at the `tsc -b` stage. Extract/compile still work (they read source directly), but the runtime/dev pipeline is broken. The skill has no fallback for plugin-react v6 (e.g. swapping to `@vitejs/plugin-react-swc` + `@lingui/swc-plugin`, adding `vite-plugin-babel` as a standalone, or pinning to `@vitejs/plugin-react@^5`). No version gating on plugin-react.

### Convert skill
- Skill: `lingui-convert` (variant `references/react-standard.md`, sequential, 1 file)
- Outcome: partial
- Strings wrapped (count): 9 (7 distinct messages + one reused Plural + one Select)
  - `"Your profile"` → `<Trans comment=…>`
  - Long welcome paragraph → `<Trans>`
  - Privacy policy with inline `<a>` → `<Trans>` (inline component preserved, extracts as `<0>…</0>`)
  - `"Welcome back, {user.name}."` → `<Trans>` with JSX interpolation
  - Currency formatter → `i18n.number(..., { style: 'currency', currency: 'USD' })` wrapped in `<Trans>Total spent: …</Trans>`
  - Date formatter → `i18n.date(...)` wrapped in `<Trans>Last updated …</Trans>`
  - Cart items sentence → `<Trans>You have <Plural …/> in your cart.</Trans>` with `_0`/`one`/`other`
  - Three standalone `<li>` plural examples → reuse same `<Plural>` (dedupes to one msgid)
  - Gender reply → `<Select>` with `_female`/`_male`/`other`
- Strings skipped/failed:
  - Initial attempt used `female="…" male="…"` on `<Select>` per the convert skill's examples — this fails TS checks against `@lingui/react@5.9.5`'s `SelectChoiceProps` type, which requires `_${string}` keys. Had to rename to `_female`/`_male` to satisfy the type.
  - `itemsLabel()`/`replyLine()` helper functions in the original `App.tsx` were not refactored away even though the new JSX no longer calls them; they were removed when App.tsx was rewritten entirely.
- Blockers: none at the conversion/extraction level — extract + compile succeed, 9 messages land in `src/locales/{en,es}/messages.po`. Blocker is inherited from setup: without a working macro transform at runtime, the wrapped code would throw `ReferenceError: Trans is not defined` in the browser.

### Deviations from SKILL.md
- **Convert skill's `<Select>` example uses bare `female="..."` / `male="..."` props, but `@lingui/react@5.9.5` `SelectChoiceProps` requires `_female` / `_male`.** The skill's Step 4 example in `lingui-convert/SKILL.md` lines 293–303 is not valid against the current type definitions. Had to deviate to make the JSX type-check.
- **Setup skill's `references/vite-babel.md` assumes `@vitejs/plugin-react` exposes a `babel` option.** That API was removed in v6 (v6.0.0 released Oct 2025 per npm). The skill does not detect plugin-react major version, does not warn, and has no v6 fallback path. This is the root blocker of the setup outcome.
- **CLAUDE.md creation** — the skill says to describe the append to the user if CLAUDE.md exists, but in unguided mode that's suspended; file didn't exist here, so just created it with the import line.
- **Step 11 (Tests)** — skipped because no test framework is in the project (no `vitest`/`jest` in deps). Unguided mode says optional-by-default, but there's nothing to wire into. Skill doesn't say "skip when no test runner detected" explicitly.
- **Numbers and dates**: Replaced the hardcoded `new Intl.NumberFormat('en-US', …)` and `new Intl.DateTimeFormat('en-US', …)` constants with inline `i18n.number()` / `i18n.date()` calls inside the component. The convert skill's Step 5 flags these as medium-confidence gaps but doesn't give an explicit recipe for module-scope `Intl.*Format` constants — improvised by moving formatting into the component and using the `useLingui()` i18n instance.

### Overall verdict
A real user running this end-to-end in unguided mode on a fresh Vite 8 + `@vitejs/plugin-react` v6 scaffold would NOT land in a working state. The conversion output is high quality — strings wrap cleanly, plurals/selects use the right CLDR shapes, inline markup is preserved, extraction produces a usable `.po` file with reasonable translator comments. But the setup pipeline is broken at the compiler-plugin layer: `@vitejs/plugin-react` v6 silently drops the `babel` option, the TS build fails, and even if the TS error is ignored the macros will never be transformed at runtime because v6 doesn't invoke Babel. The weakest link is `references/vite-babel.md` — it needs a version check on `@vitejs/plugin-react` and a documented fallback (most naturally: switch the project to `@vitejs/plugin-react-swc` + `@lingui/swc-plugin`, or add `vite-plugin-babel` as a standalone plugin). A secondary polish item is fixing the `<Select>` example in `lingui-convert` to use underscore-prefixed option keys matching current Lingui v5 types.
