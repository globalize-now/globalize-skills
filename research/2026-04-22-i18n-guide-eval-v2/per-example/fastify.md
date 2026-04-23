## fastify

### Detection
- Framework: Fastify (Node.js server) with EJS views
- Router: N/A (Fastify HTTP routes, no client-side router)
- Package manager: npm (`package-lock.json`)
- Existing i18n lib: none

### i18n-guide
- Recommended: none — STOP at Step 2, hard stop #1
- STOP reason (if any): "No supported i18n skill for this stack yet. This guide currently covers React-based and Vue-based projects." Project has neither `react` nor `vue` in deps/devDeps; primary deps are `fastify`, `@fastify/view`, `ejs`.

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
- None. The skill's hard-stop rule is unambiguous and matched cleanly on the first compatibility check. The STOP message is accurate and actionable: it tells the user what is covered (React/Vue) and implicitly that server-side Node + EJS is not. One minor observation: the guide offers no suggested manual paths for Fastify/EJS users (e.g., pointing them at `i18next` + `i18next-fs-backend` with a Fastify decorator, or `@fastify/i18n` if it existed) — but that is intentional per the project's React/Vue scope.

### Overall verdict
A real user would land in a correct, non-destructive state: nothing was installed, nothing was edited, and they receive a clear message that this stack is out of scope. The weakest link is purely informational — the STOP message could optionally point Node/Fastify users toward a sensible community path (e.g., i18next), but that is a scope-expansion suggestion, not a defect. The guide behaved exactly as specified.
