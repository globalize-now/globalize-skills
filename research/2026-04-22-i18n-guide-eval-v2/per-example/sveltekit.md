## sveltekit

### Detection
- Framework: SvelteKit (svelte 5 + @sveltejs/kit, vite)
- Router: SvelteKit file-based router (N/A to skill — guide only checks Next.js routers)
- Package manager: npm (package-lock.json)
- Existing i18n lib: none

### i18n-guide
- Recommended: none
- STOP reason (if any): Hard-stop #1 — unsupported framework. No `react` and no `vue` in deps/devDeps; `svelte` is the primary dependency. Message returned to user: "No supported i18n skill for this stack yet. This guide currently covers React-based and Vue-based projects."

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
- None. The skill's compatibility check fired exactly as designed on the first hard-stop. Detection signals were unambiguous: only Svelte/SvelteKit in deps, lockfile clearly npm.

### Overall verdict
- A real user would land in a correct-but-terminal state: the guide cleanly refuses with an accurate explanation rather than mis-routing them to a React/Vue setup skill that would then explode mid-install. That is the right outcome for an out-of-scope stack. Weakest link is the absence of any forward pointer for Svelte users — the STOP message ends the conversation without naming a Svelte-native option (e.g. `@inlang/paraglide-sveltekit`, `svelte-i18n`, `sveltekit-i18n`), so users get a clear "no" but no "try this instead." Easy improvement: mirror the Remix/Gatsby stops, which name a recommended manual path.
