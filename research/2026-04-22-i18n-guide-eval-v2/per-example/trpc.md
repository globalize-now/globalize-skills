## trpc

### Detection
- Framework: Node.js (tRPC server/client, `tsx` for dev). No React, Vue, Next.js, Nuxt, Vite, Gatsby, Remix, or React Native.
- Router: N/A (not a web framework with routing)
- Package manager: npm (`package-lock.json` present)
- Existing i18n lib: none

### i18n-guide
- Recommended: none — STOP at Step 2, rule 1
- STOP reason (if any): "Unsupported framework — no `react` and no `vue` in deps or devDeps." Deps are `@trpc/client`, `@trpc/server`, `zod`; devDeps are `@types/node`, `tsx`, `typescript`. The skill instructs to tell the user: "No supported i18n skill for this stack yet. This guide currently covers React-based and Vue-based projects."

### Setup skill
- Skill: N/A
- Outcome: N/A
- Files changed: N/A
- Deps added: N/A
- Blockers: N/A — guide correctly stopped before routing.

### Convert skill
- Skill: N/A
- Outcome: N/A
- Strings wrapped (count): N/A
- Strings skipped/failed: N/A
- Blockers: N/A

### Deviations from SKILL.md
- None. The detection table and Step 2 rule 1 covered this case unambiguously. The unsupported-framework STOP message lists "React-based and Vue-based projects" only — this is correct, but worth noting that backend-only Node projects (tRPC, Express, Fastify, Hono, NestJS) all land here. If the maintainers want to support backend localization (e.g., for tRPC error messages, email subjects rendered server-side, or notification copy in `notifications.ts`/`profile.ts`), a dedicated "node-backend" path would be needed; today the guide correctly declines.

### Overall verdict
A real user would land in a correct end state: the skill cleanly identifies the project as out of scope and declines to proceed, rather than misrouting to a React/Vue setup that would fail. The weakest link is breadth, not correctness — backend-only TypeScript projects (a common shape for tRPC-style services) get a flat "no" with no fallback guidance beyond "covers React/Vue". For an evaluation focused on whether the skills produce a working setup when applicable, this case is a clean negative result and the guide behaves as designed.
