## astro

### Detection
- Framework: Astro (v6.1.8)
- Router: N/A (Astro file-based, no React/Vue integration)
- Package manager: npm (package-lock.json present)
- Existing i18n lib: none

### i18n-guide
- Recommended: none — STOP at Step 2, rule 1 (Unsupported framework)
- STOP reason (if any): No `react` and no `vue` in deps/devDeps. Per skill instructions: "No supported i18n skill for this stack yet. This guide currently covers React-based and Vue-based projects."

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
- None. The skill explicitly enumerates supported stacks (React, Vue) and lists `svelte`, `@angular/core`, `solid-js` as examples of unsupported frameworks; Astro is not called out by name but clearly falls under the same category since it has no `react`/`vue` dep. The STOP message is appropriate, though arguably the skill's detection table (Step 1) could mention Astro explicitly given Astro is a popular framework that supports React/Vue integrations — a project with `@astrojs/react` or `@astrojs/vue` would have `react`/`vue` in deps and slip through to LinguiJS or vue-setup, which may not actually work inside Astro's island architecture. This particular project has no integrations, so the STOP is correct.

### Overall verdict
- A real user lands in a clean STOP with a clear, accurate message: there is no i18n skill for plain Astro yet. The guide behaves correctly here. The weakest link is upstream of this case: if the same user added `@astrojs/react` and one React component to translate, the guide would route them to `lingui-setup`, which assumes a Vite-with-`@vitejs/plugin-react` toolchain and would likely misconfigure an Astro project. That is a latent gap, not a failure on this specific project — the eval target produced the correct stop.
