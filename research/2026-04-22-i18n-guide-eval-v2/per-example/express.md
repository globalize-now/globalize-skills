## express

### Detection
- Framework: Express 5 + EJS (server-side, TypeScript)
- Router: N/A (Express routes; no front-end router)
- Package manager: npm (package-lock.json)
- Existing i18n lib: none

### i18n-guide
- Recommended: none — STOP at Step 2 rule #1
- STOP reason (if any): Unsupported framework. No `react` and no `vue` in deps/devDeps. Project is Express + EJS server-side. Per i18n-guide: "No supported i18n skill for this stack yet. This guide currently covers React-based and Vue-based projects."

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
- None. The guide's Step 2 rule #1 cleanly catches this case. The STOP message correctly tells the user the stack isn't covered.
- Minor observation: the skill's framework detection table (Step 1) only enumerates SPA/meta frameworks (Next, Vite, CRA, Nuxt, Vue). It doesn't explicitly name server-side Node frameworks (Express, Fastify, Hono, Koa). Detection still works because Step 2 rule #1 fires on absence of `react`/`vue`, but a user reading Step 1 alone might be unsure how to classify an Express app. Not a blocker.

### Overall verdict
A real user would land in a correct, honest "we don't cover this stack" state. The guide refused fast and pointed at the right reason (no React/Vue). The weakest link is purely scope, not skill quality: there is no Express/EJS i18n skill in this suite, so the user is left to set up something like `i18next` with `i18next-http-middleware` and an EJS helper themselves. The STOP message could optionally suggest a concrete server-side path (e.g., "for Express/EJS, consider i18next + i18next-http-middleware") the way the React Native, Gatsby, Remix, and react-email STOPs do, but as written it is accurate and not misleading.
