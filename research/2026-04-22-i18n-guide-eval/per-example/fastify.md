## fastify

### Detection
- Framework: Fastify (server) + EJS templating, TypeScript (not supported by guide — guide covers React/Vue only)
- Router: N/A (Fastify HTTP routes, not a client-side router)
- Package manager: npm (`package-lock.json`)
- Existing i18n lib: None

### i18n-guide
- Recommended: None
- STOP reason (if any): Step 2, hard stop #1 — "Unsupported framework": no `react` and no `vue` in deps or devDeps. Guide message: "No supported i18n skill for this stack yet. This guide currently covers React-based and Vue-based projects."

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
- None. The skill's detection table and Step 2 compatibility check handled this project cleanly: `package.json` exists (so the "no package.json" stop does not trigger), but neither `react` nor `vue` appear in deps/devDeps, so hard stop #1 fires before reaching Rule 1/2/3. No ambiguity, no improvisation required.
- Minor observation (not a deviation affecting this run): the detection table in Step 1 does not enumerate server-only Node frameworks (Fastify/Express/Koa/Hapi). That is fine because Step 2 catches them via the absence of React/Vue, but a user might wonder whether their backend framework was "detected." The STOP message is accurate regardless.

### Overall verdict
A real user on this Fastify + EJS + TS project would land exactly where they should: an immediate, honest STOP telling them the guide does not cover their stack. The skill correctly refuses to recommend a React/Vue library for a server-rendered Node backend. Weakest link is purely cosmetic — the STOP message says "React-based and Vue-based projects" without suggesting any alternative path (e.g., "consider `i18next` standalone, or `fluent` for server-rendered templates"), so the user is left without next-step guidance. But given the stated scope of `globalize-skills`, the refusal is correct behavior, not a bug.
