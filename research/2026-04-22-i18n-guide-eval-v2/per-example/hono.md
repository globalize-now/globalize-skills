## hono

### Detection
- Framework: Hono (Node.js HTTP framework using Hono's own JSX runtime)
- Router: Hono app router (`new Hono()` with `app.get(...)`) — N/A for i18n-guide's framework router signals
- Package manager: npm (`package-lock.json` present)
- Existing i18n lib: none

### i18n-guide
- Recommended: none
- STOP reason (if any): Hard stop #1 — "Unsupported framework". `package.json` has neither `react` nor `vue` in deps or devDeps; primary deps are `hono` and `@hono/node-server`. Per the skill: "No supported i18n skill for this stack yet. This guide currently covers React-based and Vue-based projects."

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
- None. The detection table in Step 1 doesn't enumerate Hono explicitly, but Step 2 hard-stop #1 cleanly catches "no react and no vue" stacks, which is exactly this case. The `.tsx` extension on `src/server.tsx` could superficially suggest React, but the dependency-based detection in the skill correctly ignores file extensions and looks at `package.json` deps — the right call, since Hono ships its own JSX runtime (`hono/jsx`).
- Minor observation (not a deviation): The STOP message lists "svelte, @angular/core, solid-js" as examples of unsupported frameworks but doesn't name Hono or other server frameworks (Express, Fastify, Koa, NestJS). The rule still fires correctly via the "no react and no vue" clause.

### Overall verdict
A real user would land in the correct state: a clear STOP with an accurate explanation that React-based and Vue-based projects are the only supported stacks, and no destructive changes attempted. The weakest link is purely cosmetic — the STOP message could mention server-side JS frameworks (Hono, Express, Fastify, NestJS) as a recognized "out of scope" category so users aren't left wondering whether the skill simply failed to recognize their stack. But functionally, the guide behaves correctly: detection, hard stop, no install, no edits.
