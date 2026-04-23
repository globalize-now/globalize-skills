## solid-start

### Detection
- Framework: Solid Start (solid-js + @solidjs/start, vinxi)
- Router: @solidjs/router (file-based via @solidjs/start)
- Package manager: npm (package-lock.json)
- Existing i18n lib: none

### i18n-guide
- Recommended: none (STOP)
- STOP reason (if any): Unsupported framework — no `react` and no `vue` in deps/devDeps; primary dependency is `solid-js`. Message returned: "No supported i18n skill for this stack yet. This guide currently covers React-based and Vue-based projects."

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
- None. The hard stop at Step 2 #1 covers `solid-js` explicitly ("a non-supported framework like `svelte`, `@angular/core`, or `solid-js` is the primary dependency"). Detection and halt were unambiguous.

### Overall verdict
A real user would land in a clear, correct "not supported" state — the i18n-guide skill identifies Solid as out of scope at Step 2 and gives an honest message rather than shoehorning the user into a React or Vue skill. Weakest link: the suite simply has no Solid coverage, so the user gets rejected rather than helped; but given the stated scope (React + Vue), the routing behavior is exactly right. No working i18n setup is produced, by design.
