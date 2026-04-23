## nestjs

### Detection
- Framework: NestJS (Node.js server, Express platform, EJS views)
- Router: N/A (NestJS controller routing; no React/Vue router)
- Package manager: npm (package-lock.json present)
- Existing i18n lib: none

### i18n-guide
- Recommended: none
- STOP reason (if any): Unsupported framework (Step 2, hard stop #1) — no `react` and no `vue` in deps/devDeps. NestJS is not in the supported set. Message returned: "No supported i18n skill for this stack yet. This guide currently covers React-based and Vue-based projects."

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
- None. The hard-stop fired cleanly on the first compatibility check. The stop message is accurate but a bit thin for a Node-server case: a NestJS user might benefit from a pointer to `nestjs-i18n` (the canonical Nest module) the way the Remix/Gatsby/RN stops point to alternatives, instead of being told only that this guide covers React/Vue. Not a deviation, just a UX gap.
- Minor: hard stop #1's wording ("No supported i18n skill for this stack yet") implies SPA-only; it doesn't acknowledge server-rendered template setups (EJS views here). The guide's signal table also doesn't list any server-framework signal (express/fastify/nest), so detection terminates correctly but without nuance.

### Overall verdict
- A real user lands in the correct state: politely turned away with no destructive changes, no installs, no edits. The guide's hard-stop logic does its job. Weakest link is the stop message's helpfulness — for a NestJS project the user is left without a concrete next step (e.g. "use `nestjs-i18n`"), unlike the Remix/Gatsby/RN stops which name an alternative library. Functionally correct, marginally unhelpful.
