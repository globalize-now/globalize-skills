## lit

### Detection
- Framework: Vite SPA with Lit (`lit` ^3.3.2 in deps, `vite` in devDeps)
- Router: N/A (single `index.html` + `src/profile-page.ts`)
- Package manager: npm (`package-lock.json` present)
- Existing i18n lib: none

### i18n-guide
- Recommended: none — STOP at Step 2, hard stop #1 (unsupported framework)
- STOP reason (if any): "No supported i18n skill for this stack yet. This guide currently covers React-based and Vue-based projects." Lit is neither React nor Vue.

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
- None. The guide's hard-stop logic handled Lit cleanly: no `react` and no `vue` in deps triggers stop #1 verbatim. The STOP message lists "React-based and Vue-based projects" as covered — Lit users are correctly turned away without ambiguity. Minor note: the message doesn't suggest a specific Lit-native alternative (e.g. `@lit/localize`), which would be a friendlier off-ramp but is consistent with the skill's scope.

### Overall verdict
A real user would land in a correct, non-broken state: the guide cleanly identifies Lit as out-of-scope and stops without attempting a setup that would fail. The weakest link is the absence of a Lit-specific suggestion (`@lit/localize` is the obvious recommendation) — the user is told what isn't supported but not pointed anywhere useful. For an "is the suite safe on unsupported stacks?" question, the answer is yes; for "does it help every JS user find an i18n path?", no, but that's by explicit scope.
