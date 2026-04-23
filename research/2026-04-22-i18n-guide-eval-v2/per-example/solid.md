## solid

### Detection
- Framework: Solid (Vite SPA, vite-plugin-solid)
- Router: N/A (no router dependency in package.json)
- Package manager: npm (package-lock.json present)
- Existing i18n lib: none

### i18n-guide
- Recommended: none — STOP at Step 2 compatibility check #1
- STOP reason (if any): Unsupported framework — `solid-js` is the primary dependency, neither `react` nor `vue` present in deps/devDeps. Message: "No supported i18n skill for this stack yet. This guide currently covers React-based and Vue-based projects."

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
- None. The skill's hard-stop rule for unsupported frameworks fired exactly as designed on the first check, before any setup/convert routing.

### Overall verdict
A real user with a Solid.js project would land in a clean, informative dead-end: i18n-guide correctly detects the unsupported framework on its very first compatibility check and tells the user that only React- and Vue-based projects are covered today. No false routing to lingui-setup or vue-setup occurred. The weakest link is just that there is no follow-up suggestion (e.g. pointing Solid users at `@solid-primitives/i18n` or similar) — the STOP message is accurate but offers no alternative path. That's a content nit, not a correctness bug; the skill behaves correctly.
