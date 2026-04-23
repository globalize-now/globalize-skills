## express

### Detection
- Framework: Express 5 + EJS (TypeScript, ESM), run via tsx / tsc
- Router: N/A (Express server; no React/Vue router)
- Package manager: npm (package-lock.json)
- Existing i18n lib: none

### i18n-guide
- Recommended: N/A
- STOP reason (if any): Step 2 hard stop #1 — "Unsupported framework". Neither `react` nor `vue` is present in deps or devDeps; primary deps are `express` and `ejs`. Per SKILL.md: "No supported i18n skill for this stack yet. This guide currently covers React-based and Vue-based projects."

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
- None. The guide's Step 2 hard stop fired cleanly and the correct STOP message was produced. No improvisation needed.
- Minor note: the guide's Step 1 "Framework" detection table doesn't enumerate Express/Fastify/NestJS/etc. — it relies entirely on the Step 2 hard stop (absence of `react`/`vue`) to reject them. That works here, but a bare Node server with no React/Vue would not be explicitly classified in Step 1; the skill just falls through to the hard stop. Acceptable behavior, but worth noting for eval.

### Overall verdict
Correct outcome for this project. A real user running i18n-guide on an Express+EJS server would be told this stack isn't covered and stopped before any files are touched — which is the right call given the skills suite has no server-rendered-template (EJS/Pug/Handlebars) or generic Node i18n skill. Weakest link: the STOP message suggests the guide covers React and Vue but doesn't point the user anywhere else (e.g., i18next standalone, which would actually fit an Express+EJS app). That's a guidance gap, not a correctness bug.
