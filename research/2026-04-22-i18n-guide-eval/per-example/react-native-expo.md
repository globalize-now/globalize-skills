## react-native-expo

### Detection
- Framework: React Native (Expo, expo-router v6, Metro bundler)
- Router: expo-router (file-based, `app/` directory) — not matched by i18n-guide's Next.js App Router signal (no `next` in deps)
- Package manager: npm (`package-lock.json` present)
- Existing i18n lib: none

### i18n-guide
- Recommended: LinguiJS (Rule 3: `react` in deps, no `next`, no `vue`)
- STOP reason (if any): None — i18n-guide does not recognize React Native as distinct from React SPA. It falls through Rule 3 and hands off to `lingui-setup`. This is a detection gap: the guide has no signal for `react-native` / `expo` in deps, and no "unsupported: React Native" STOP in Step 2.

### Setup skill
- Skill: lingui-setup
- Outcome: failed (hard-stopped at Step 1 incompatibility check)
- Files changed: none
- Deps added: none
- Blockers:
  - Step 1 "Custom build pipeline" STOP fires: no `vite.config.*`, no `next.config.*`, no `react-scripts` in deps. Expo uses Metro, which the skill explicitly does not cover. Per the skill: *"This project uses {tool} as its build tool. LinguiJS requires a macro transform plugin (SWC or Babel) integrated into the build. This skill does not cover {tool} integration."* Hard-stop, no workaround attempted.
  - (Secondary: even if setup proceeded, its reference files — `nextjs-app-router.md`, `tanstack-start.md`, `vite-swc.md`, `vite-babel.md` — have no React Native / Metro / Expo variant. Provider wiring uses `document.documentElement.dir`/`.lang`, `<html lang>`, `index.html`, etc., none of which exist in React Native.)

### Convert skill
- Skill: N/A
- Outcome: N/A
- Strings wrapped (count): N/A
- Strings skipped/failed: N/A
- Blockers: Setup did not complete, so convert is not reachable.

### Deviations from SKILL.md
- None on my part — I followed the guide literally. The deviation is in the skill suite itself:
  - `i18n-guide` Step 1 detection table has no row for React Native / Expo. The Framework column only matches `next`, `vite`, `react-scripts`, `nuxt`, or bare `vue`. `react-native` and `expo` are invisible signals.
  - `i18n-guide` Step 2 compatibility has no "React Native not supported" STOP, so the guide cheerfully recommends LinguiJS and hands off.
  - The hard-stop only surfaces one level down in `lingui-setup`'s "Custom build pipeline" check — which catches the case by accident (because Metro isn't Vite/Next/CRA) rather than by name. The user gets a message blaming their "build tool" without acknowledging the real reason: none of the skills support React Native.

### Overall verdict
A real user would land stopped, not working. They'd ask Claude "add i18n to my Expo app", get a confident LinguiJS recommendation from `i18n-guide`, then hit a cryptic STOP from `lingui-setup` that says their build tool is unsupported — without ever being told "React Native isn't covered by this skill suite." The weakest link is `i18n-guide`'s detection: it treats "has `react`" as "is a React web app" and never notices `react-native` / `expo` in deps. Fix would be a new STOP in Step 2 ("React Native detected — no skill covers it; consider `expo-localization` + `i18n-js` or `react-i18next` with Expo, set up manually") so the user gets an honest handoff instead of a false recommendation followed by a misleading downstream error.
