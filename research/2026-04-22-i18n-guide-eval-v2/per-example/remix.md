## remix

### Detection
- Framework: Remix (Vite-based, v2.15.0)
- Router: Remix file-based routing (no `app/` Next.js layout, has `app/` with Remix `root.tsx`/`routes/`)
- Package manager: npm (package-lock.json present)
- Existing i18n lib: none

### i18n-guide
- Recommended: N/A — hard stop hit
- STOP reason (if any): Hard stop #6 (Remix). `@remix-run/dev`, `@remix-run/react`, and `@remix-run/node` are all in deps. Skill message: Remix is not covered; the LinguiJS Vite reference assumes `@vitejs/plugin-react`'s `babel.plugins` passthrough (which Remix's `vitePlugin` does not expose), and the provider pattern reads `window`/`localStorage` at module scope which crashes under Remix SSR. Recommends `remix-i18next` for a Remix-native setup, with an invitation to open an issue for a dedicated Remix reference.

### Setup skill
- Skill: N/A
- Outcome: N/A
- Files changed: N/A
- Deps added: N/A
- Blockers: i18n-guide hard-stopped before any setup skill could be selected.

### Convert skill
- Skill: N/A
- Outcome: N/A
- Strings wrapped (count): N/A
- Strings skipped/failed: N/A
- Blockers: No setup ran, so no convert step.

### Deviations from SKILL.md
- None. The skill's Remix hard stop fired cleanly on the first compatibility check pass; no improvisation needed.

### Overall verdict
- A real user would land in a clean, honest "we don't support this yet" state with a concrete next step (use `remix-i18next`) and a rationale that names the actual technical blockers (Vite plugin babel passthrough, SSR-unsafe module-scope `window`/`localStorage`). No half-installed deps, no broken edits — exactly the conservative behavior the project's CLAUDE.md asks for. Weakest link: the suite has no Remix path at all, so the user is fully off-ramped to a third-party guide; if Remix support is a goal, this is a gap to fill, but as a routing decision the guide behaves correctly.
