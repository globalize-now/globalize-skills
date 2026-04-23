## trpc

### Detection
- Framework: None (Node.js/tRPC server+client, no React/Vue/Next/Nuxt/Vite)
- Router: N/A
- Package manager: npm (`package-lock.json` present)
- Existing i18n lib: None

### i18n-guide
- Recommended: None — guide halted at Step 2
- STOP reason (if any): Unsupported framework — neither `react` nor `vue` is in `deps`/`devDeps`. Only `@trpc/client`, `@trpc/server`, `zod` (runtime) and `@types/node`, `tsx`, `typescript` (dev). Per Step 2 Rule 1, i18n-guide stops with: "No supported i18n skill for this stack yet. This guide currently covers React-based and Vue-based projects."

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
- None. The guide's Step 2 Rule 1 handled this stack cleanly. One minor observation: the rule's message to the user says "React-based and Vue-based projects" which correctly covers what the suite supports; nothing in the guide suggests trying a fallback, so no improvisation was needed.
- Detection table in Step 1 doesn't list a row for "plain Node/TS backend," but it doesn't need to — Step 2's compatibility check catches it via the absence of `react`/`vue`.

### Overall verdict
A real user running i18n-guide on this tRPC-only project would get a correct, immediate STOP with a clear explanation that the suite doesn't cover non-React/Vue stacks. No setup or convert work is attempted, no partial state is written, and no install is run. This is the right outcome for a backend-only Node project — server-side message catalogs for tRPC procedures are a legitimate need but genuinely out of scope for the current skill suite. The weakest link (minor) is that the STOP message doesn't point the user anywhere else (e.g., suggesting plain `@formatjs/intl` or `i18next` node usage); but within the suite's stated scope, the guide behaves correctly.
