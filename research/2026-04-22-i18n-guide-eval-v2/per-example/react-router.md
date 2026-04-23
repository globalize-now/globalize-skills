## react-router

### Detection
- Framework: Vite 6 (SPA)
- Router: React Router v7 (declarative `<BrowserRouter>` mode — not framework mode; no `app/routes/`)
- Package manager: npm (`package-lock.json`)
- Existing i18n lib: none

### i18n-guide
- Recommended: LinguiJS (Rule 3 — React without Next.js)
- STOP reason (if any): N/A

### Setup skill
- Skill: `lingui-setup` (variant: `references/vite-babel.md`, single-catalog plain-SPA path)
- Outcome: success
- Files changed:
  - `src/i18n/locales.ts` — created; source/target locale constants (`en`, `es`)
  - `lingui.config.ts` — created; single-catalog config at `src/locales/{locale}/messages`
  - `src/i18n.ts` — created; `detectLocale`, `loadCatalog`, `saveLocale`, RTL `dir` handling
  - `src/components/LanguageSwitcher.tsx` — created; `<select>` switcher using `Intl.DisplayNames`
  - `vite.config.ts` — added `@lingui/babel-plugin-lingui-macro` to `react({ babel })` and `lingui()` plugin
  - `src/main.tsx` — wrapped tree with `I18nProvider`, awaited `loadCatalog(detectLocale())` before render, mounted `<LanguageSwitcher/>`
  - `package.json` — added `lingui:extract`, `lingui:compile` scripts; prepended `lingui compile --typescript &&` to `build`
  - `.gitignore` — appended `src/locales/*/messages.ts`
  - `CLAUDE.md` — created with `@.claude/skills/lingui-code/SKILL.md` import
- Deps added: `@lingui/core`, `@lingui/react`, `@lingui/macro`, `@lingui/detect-locale` (runtime); `@lingui/cli`, `@lingui/babel-plugin-lingui-macro`, `@lingui/vite-plugin` (dev) — all `^5.9.5`
- Blockers: none. `index.html` already had `<html lang="en">` matching `sourceLocale`, no change needed. ESLint not present in project; per Step 7 it's optional and was skipped (auto mode, no user). CI/CD `build` script update was applied per unguided defaults.

### Convert skill
- Skill: `lingui-convert` (Step 8.1 sequential, 2 source files with strings)
- Outcome: success
- Strings wrapped (count): 12 messages extracted (PrivacyPage: 3 `<Trans>`; ProfilePage: 1 `<Trans>` plus interpolated/`<Plural>`/`<Select>` variants — `<Plural>` produced separate ICU messages per call site since each had a different `value`, totaling the 12)
- Strings skipped/failed: none. Module-scope `Intl.NumberFormat` and `Intl.DateTimeFormat` constants were removed and replaced with in-component `i18n.number()` / `i18n.date()` per Step 5 gap-detection rule. Helper functions `itemsLabel()` and `replyLine()` were inlined as `<Plural>` and `<Select>` macros (they would otherwise have been unsafe — the count→singular/plural mapping was hardcoded English).
- Blockers: none. `npx lingui extract --clean` clean, `npx lingui compile --typescript` clean, `npx tsc -b` clean, `npx vite build` clean.

### Deviations from SKILL.md
- **Setup mode prompt skipped**: Per eval rules, ran unguided without asking. Applied unguided defaults (es target, JSON catalogs were the documented default but lingui-setup's vite-babel reference and config code use PO format — followed the reference template (PO) since the per-page catalog block in SKILL.md was the only place mentioning JSON; vite-babel single-catalog block uses PO. Worth a doc cross-check.)
- **React Router v7 declarative vs. framework mode**: The skill's detection table only mentions React Router v7 *framework mode* (looks for `app/routes/`). This project is v7 in **declarative SPA mode** (`<BrowserRouter>` in `main.tsx`, no file-based routing). The skill never explicitly says "if `react-router` v7 is in deps but no `app/routes/`, treat as plain SPA" — inferred it from Step 1's "If none found → plain SPA". Adding an explicit note would help.
- **Locale routing strategy choice in vite-babel.md**: The reference says "If the project uses file-based routing... STOP and present this to the user." For a plain SPA, it falls through to "use option 3" — but the per-page block above is long and a reader could easily miss the fall-through. The single-catalog block at the bottom is well-marked, though.
- **ESLint optional step**: vital safety net; in unguided mode the skill says "ask the user if they'd like you to add it" — there's no unguided default. Skipped here.
- **Tests step**: no test framework in project, skipped silently.
- **Skill 9 (CLAUDE.md import)** says "describe the change to the user...wait for confirmation before appending" but unguided mode suspends consent gates — created the file directly.

### Overall verdict
A real user lands in a working state. The build pipeline is fully green: `lingui extract`, `lingui compile`, `tsc -b`, and `vite build` all succeed; the runtime path (detect → load catalog → render with `I18nProvider`, with `<LanguageSwitcher>` mounted at the top of the route tree) is sound; module-scope `Intl.*Format` were correctly migrated to `i18n.number/date`; plurals and gender select are properly wrapped. Weakest link is the setup skill's coverage of **React Router v7 declarative mode** — it's a very common shape (CRA-style SPA migrated to RR7) and the skill mentions only the framework mode. The detection table should add an explicit row, and `vite-babel.md` should call out at the top of "Provider Setup" that React Router v7 *without* `app/routes/` should jump straight to the single-catalog plain-SPA block. Catalog-format mismatch (JSON default in skill text vs. PO in reference templates) is also worth reconciling.
