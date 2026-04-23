## hono

### Detection
- Framework: Hono (server-side, `hono` + `@hono/node-server`)
- Router: N/A (Hono app, not a React/Vue router)
- Package manager: npm (`package-lock.json`)
- Existing i18n lib: None

### i18n-guide
- Recommended: None (STOP at Step 2)
- STOP reason (if any): Unsupported framework — no `react` and no `vue` in deps/devDeps. Message per SKILL.md: "No supported i18n skill for this stack yet. This guide currently covers React-based and Vue-based projects."

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
- None. The Hono project uses `.tsx` files (Hono's JSX for HTML rendering), which could superficially look React-like, but the detection table correctly keys off the `react` dep, not the file extension, so no ambiguity arose. Step 2 rule 1 fired cleanly.

### Overall verdict
A real user would land in a clean stop state with an accurate explanation — the guide correctly identifies that Hono (a server framework using its own JSX) isn't in scope and doesn't attempt to misroute it to `lingui-setup` or similar. The weakest link is purely scope: there's no Hono/server-i18n track offered, so the user gets a polite "not supported" rather than guidance — but that matches the skill suite's stated coverage (React + Vue only). No incorrect recommendations, no broken setups, no false starts.
