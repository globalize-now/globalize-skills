## solid

### Detection
- Framework: Vite + SolidJS (vite-plugin-solid)
- Router: N/A (no router dependency detected; single `index.html` entry, no SolidRouter in deps)
- Package manager: npm (package-lock.json)
- Existing i18n lib: none

### i18n-guide
- Recommended: none — STOP at Step 2
- STOP reason (if any): Unsupported framework — `solid-js` is the primary dependency; no `react` or `vue` in deps/devDeps. Per i18n-guide Step 2 rule 1, the skill halts with "No supported i18n skill for this stack yet. This guide currently covers React-based and Vue-based projects."

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
- None. The `solid-js` case is explicitly enumerated in Step 2 rule 1 as an unsupported-framework stop, and the skill's STOP message fits this project exactly. The detection table in Step 1 does not list Solid as a framework signal, but rule 1's explicit mention of `solid-js` makes the routing unambiguous.

### Overall verdict
A real user running i18n-guide on this Solid project would correctly be told "no supported i18n skill for this stack yet" and stop — which is the right outcome given no Solid setup skill exists in the suite. The guide handles this cleanly without dead-ends or false routing. Weakest link: the Step 1 detection table doesn't explicitly list Solid as a framework signal (only React, Vue, Next, Nuxt, CRA, Vite), so detection relies on the negative check in Step 2 rule 1 rather than a positive Solid row; minor, but if more non-React/Vue frameworks get added to rule 1 over time, the table may drift further from the stop list.
