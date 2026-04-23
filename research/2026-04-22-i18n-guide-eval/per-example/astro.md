## astro

### Detection
- Framework: Astro (v6.1.8)
- Router: N/A (Astro file-based pages; project has `src/pages/` with no `@astrojs/react` or `@astrojs/vue` integration)
- Package manager: npm (`package-lock.json`)
- Existing i18n lib: none

### i18n-guide
- Recommended: none
- STOP reason (if any): Step 2 hard stop #1 — "Unsupported framework." The project has no `react` and no `vue` in deps/devDeps (only `astro`). Message surfaced: "No supported i18n skill for this stack yet. This guide currently covers React-based and Vue-based projects."

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
- None. The skill's Step 2 compatibility gate handled this project cleanly and stopped before Step 3. No ambiguity encountered.
- Minor observation (not a deviation executed against): Astro supports React/Vue via integrations (`@astrojs/react`, `@astrojs/vue`). The skill's detection table and STOP messaging don't mention Astro by name nor suggest "install an integration first" as a path forward; a user on a bare Astro project just gets a flat "not supported." This is arguably correct scope-wise but could be friendlier.

### Overall verdict
The skill behaves correctly: it detects an unsupported stack and stops without attempting setup. A real user on a bare Astro project lands in a dead end by design — which is the right outcome given no Astro-specific skill exists. The weakest link is UX polish: the STOP message lists React/Vue as the covered surface but doesn't acknowledge Astro specifically or hint that adding `@astrojs/react`/`@astrojs/vue` would unblock the respective skills. No working i18n setup is produced, but that matches the skill suite's stated scope.
