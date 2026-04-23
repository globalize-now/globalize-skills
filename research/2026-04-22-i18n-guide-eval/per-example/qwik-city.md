## qwik-city

### Detection
- Framework: Qwik / Qwik City (Vite-based)
- Router: Qwik City file-system router (`src/routes/`)
- Package manager: npm (package-lock.json)
- Existing i18n lib: none

### i18n-guide
- Recommended: none
- STOP reason (if any): Unsupported framework — neither `react` nor `vue` in deps/devDeps. Primary deps are `@builder.io/qwik` and `@builder.io/qwik-city`. Per Step 2 hard-stop #1, the guide halts with: "No supported i18n skill for this stack yet. This guide currently covers React-based and Vue-based projects."

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
- None. The detection table in Step 1 does not enumerate Qwik explicitly, but the Step 2 hard-stop catches it cleanly via the "no react and no vue" rule. The STOP message is accurate and directs the user correctly.
- Minor note: the hard-stop's parenthetical examples list `svelte`, `@angular/core`, `solid-js` but not Qwik. Adding `@builder.io/qwik` to that example list would make the match more obvious to a reader, but behavior is already correct.

### Overall verdict
A real user on a Qwik City project would land in a correctly-identified dead end: the guide halts with an accurate, polite STOP message explaining the stack isn't supported. No damage done, no misrouting into an incompatible setup skill. The weakest link is purely cosmetic — Qwik isn't named in the hard-stop's example list of unsupported frameworks — but the logic (`no react && no vue → stop`) handles it correctly. This is the intended, working behavior for out-of-scope stacks.
