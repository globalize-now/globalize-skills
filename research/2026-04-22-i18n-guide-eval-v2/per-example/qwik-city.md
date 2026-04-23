## qwik-city

### Detection
- Framework: Qwik / Qwik City (Vite-based, but neither React nor Vue)
- Router: Qwik City (file-based routing)
- Package manager: npm (package-lock.json present)
- Existing i18n lib: none

### i18n-guide
- Recommended: N/A (hard stop)
- STOP reason (if any): Unsupported framework — no `react` and no `vue` in deps/devDeps. Primary deps are `@builder.io/qwik` and `@builder.io/qwik-city`. Per Step 2 rule 1, the guide currently covers only React-based and Vue-based projects.

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
- None. The detection table and the hard-stop list both fired exactly as written. The STOP message is delivered verbatim from rule 1 of Step 2.
- Minor observation (not a deviation that affected this run): the detection table mentions Vite as a Vue/React signal, but Qwik also uses Vite. The hard-stop check for "no react and no vue" correctly catches Qwik anyway, so the table's wording is not load-bearing here.

### Overall verdict
A real user would land in a correct, clean stop state. The guide's framework gate fires before any installs or edits, so no partial setup is left behind. The weakest link is purely a UX one: the STOP message points the user nowhere actionable for Qwik (no suggested third-party Qwik i18n route, unlike the Gatsby/Remix/RN stops which name a community-recommended library). Adding a one-liner pointer to `qwik-speak` or `compiled-i18n` would make this stop more helpful, but it does not affect correctness.
