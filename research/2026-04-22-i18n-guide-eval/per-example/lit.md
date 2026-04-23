## lit

### Detection
- Framework: Vite + Lit (Web Components)
- Router: N/A (single-page Lit app, no router)
- Package manager: npm (package-lock.json)
- Existing i18n lib: None

### i18n-guide
- Recommended: None — STOP triggered
- STOP reason (if any): Step 2 hard stop #1: "Unsupported framework — no `react` and no `vue` in deps or devDeps." Lit is not covered by the current skill set. Message delivered to (simulated) user: "No supported i18n skill for this stack yet. This guide currently covers React-based and Vue-based projects."

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
- None. The skill's detection table and Step 2 hard stops handle this case cleanly: Lit appears as "no react and no vue in deps," which maps to the unsupported-framework STOP. No improvisation needed.
- Minor observation: the SKILL.md Step 1 detection table does not enumerate Lit explicitly, but that's by design — the Step 2 hard stop catches everything outside React/Vue. The hard-stop message is slightly imprecise for Lit (Lit is not listed among the example "non-supported frameworks" like svelte/angular/solid) but is functionally correct.

### Overall verdict
A real user on a Lit + Vite project would land in a correct, early-exit state: the guide detects no supported framework and stops before proposing anything. No setup is attempted, no files are changed, nothing to break. The weakest link is only cosmetic — the STOP message lists React/Vue as supported but doesn't acknowledge Lit by name or suggest alternatives (e.g., `@lit/localize`, which is Lit's first-party i18n package). A helpful enhancement would be for i18n-guide to mention known-good library choices for common unsupported stacks (`@lit/localize` for Lit, `svelte-i18n` for Svelte, etc.) even when no skill exists — so the user isn't left entirely empty-handed. Functionally, though, the skill behaved as designed.
