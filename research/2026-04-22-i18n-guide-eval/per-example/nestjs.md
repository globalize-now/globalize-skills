## nestjs

### Detection
- Framework: NestJS (Node/Express backend, no React/Vue/Next/Nuxt/Vite)
- Router: N/A (backend app; uses EJS views via @nestjs/platform-express)
- Package manager: npm (package-lock.json present)
- Existing i18n lib: none

### i18n-guide
- Recommended: none
- STOP reason (if any): Unsupported framework — no `react` and no `vue` in deps/devDeps. Per Step 2 rule 1, the guide stops with: "No supported i18n skill for this stack yet. This guide currently covers React-based and Vue-based projects."

### Setup skill
- Skill: N/A
- Outcome: N/A
- Files changed: N/A
- Deps added: N/A
- Blockers: N/A

### Convert skill
- Skill: N/A
- Outcome: N/A
- Strings wrapped (count): N/A
- Strings skipped/failed: N/A
- Blockers: N/A

### Deviations from SKILL.md
- None. The NestJS project cleanly matches the "unsupported framework" hard stop. The skill correctly declined to proceed without improvisation needed.
- Minor note: NestJS ships server-rendered EJS views that could plausibly benefit from i18n (e.g., via `nestjs-i18n` or `i18next`), but the guide explicitly scopes itself to React/Vue frontends, which is a defensible product decision rather than a defect.

### Overall verdict
A real user would land in a correct-but-dead-end state: the guide stops cleanly and tells them no skill covers their stack. That is the right call for this suite's current scope (React/Vue only). The weakest link is not the guide itself but the coverage gap — there's no server-side/Node/NestJS i18n skill, so a NestJS user gets a clear "no" and no pointer to community options (e.g., `nestjs-i18n`, `i18next` standalone). Within its stated scope, the detection + STOP behavior worked correctly end-to-end.
