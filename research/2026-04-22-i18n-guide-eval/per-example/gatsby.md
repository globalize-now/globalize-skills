## gatsby

### Detection
- Framework: Gatsby 5 (not covered in i18n-guide detection table; has `react` but none of `next`/`vite`/`react-scripts`/`nuxt`/`vue`)
- Router: Gatsby file-based routing (`src/pages/`) — not recognized by either skill
- Package manager: npm (`package-lock.json`)
- Existing i18n lib: none

### i18n-guide
- Recommended: LinguiJS (via Rule 3: `react` present, no `next`, no `vue`)
- STOP reason (if any): i18n-guide itself did not STOP. It recommended LinguiJS and handed off to `lingui-setup`. The hard stop happened in the setup skill (see below).

### Setup skill
- Skill: lingui-setup
- Outcome: failed (hard-stop triggered at Step 1 incompatibility check)
- Files changed: none
- Deps added: none
- Blockers: "Custom build pipeline" incompatibility check fires — no `vite.config.*`, no `next.config.*`, no `react-scripts`. Gatsby uses its own Webpack-based build pipeline. Per the skill: "This skill does not cover {tool} integration. To set up manually: install `@lingui/babel-plugin-lingui-macro` and add it as a Babel plugin in your build config." Execution halts per the skill's explicit "Do NOT proceed" directive.

### Convert skill
- Skill: N/A
- Outcome: N/A
- Strings wrapped (count): N/A
- Strings skipped/failed: N/A
- Blockers: Setup never completed; convert is not reachable.

### Deviations from SKILL.md
- None in execution — the skill was followed as written and correctly hit its hard-stop. However, there are two gaps in the skill set worth noting:
  - `i18n-guide` detection table does not mention Gatsby at all. A Gatsby project silently falls through to Rule 3 (LinguiJS) even though `lingui-setup` will hard-stop. A user would see an apparent recommendation followed by an immediate dead-end. Adding either (a) a Gatsby detection row + explicit STOP in i18n-guide, or (b) a Gatsby-specific reference in lingui-setup that wires `@lingui/babel-plugin-lingui-macro` via `gatsby-node.ts` `onCreateBabelConfig`, would close the gap.
  - The lingui-setup "Custom build pipeline" STOP conflates "Webpack (without CRA)" into a single bucket. Gatsby specifically exposes a supported Babel hook (`onCreateBabelConfig`) that would make manual setup straightforward — the current message points users to generic Babel-plugin docs without flagging Gatsby's hook.

### Overall verdict
A real user on a Gatsby project would not land in a working state. The skills behave correctly in the sense that no partial/broken setup is written — lingui-setup's custom-build-pipeline check fires and halts cleanly, which matches the documented "conservative setup" policy. But the outcome is a dead-end: the i18n-guide confidently recommends LinguiJS, hands off to lingui-setup, and lingui-setup immediately stops. The weakest link is i18n-guide's detection coverage — Gatsby is a mainstream React meta-framework and warrants either its own setup path or an early, clearly worded STOP in i18n-guide (with pointers to manual Gatsby+Lingui or Gatsby's built-in `gatsby-plugin-react-i18next` / `@herob/gatsby-theme-i18n` options) rather than a silent fall-through to a skill that rejects it.
