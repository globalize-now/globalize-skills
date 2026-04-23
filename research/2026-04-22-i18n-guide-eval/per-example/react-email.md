## react-email

### Detection
- Framework: react-email (CLI-based, built on Next.js internally but no user-accessible `next.config.*` or `vite.config.*`)
- Router: N/A (email templates, not a web app)
- Package manager: npm (`package-lock.json` present)
- Existing i18n lib: none

### i18n-guide
- Recommended: LinguiJS (per Rule 3 — `react` present, no `next`, no `vue`)
- STOP reason (if any): i18n-guide itself did not stop; it handed off to `lingui-setup`. However `lingui-setup` Step 1 immediately hits the "Custom build pipeline" STOP: no `vite.config.*`, no `next.config.*`, no `react-scripts` in deps. The project is driven by the `react-email` CLI (`email dev` / `email build`), which exposes no Babel/SWC plugin integration point covered by this skill.

### Setup skill
- Skill: lingui-setup
- Outcome: N/A (halted at Step 1 incompatibility check)
- Files changed: none
- Deps added: none
- Blockers: "Custom build pipeline" STOP — react-email CLI has no documented hook for injecting `@lingui/swc-plugin` or `@lingui/babel-plugin-lingui-macro` into its internal bundler. The skill correctly refuses to proceed rather than guess.

### Convert skill
- Skill: N/A
- Outcome: N/A
- Strings wrapped (count): N/A
- Strings skipped/failed: N/A
- Blockers: Setup never completed, so convert cannot run.

### Deviations from SKILL.md
- None. The i18n-guide correctly routed to `lingui-setup`; `lingui-setup` Step 1 correctly caught the unsupported build tool before any modification. No improvisation needed.
- Minor observation: the i18n-guide's detection table (Step 1) does not mention `react-email` as a framework signal, but its compatibility matrix in Step 2 does not need to — the downstream setup skill catches it. This is arguably the right division of responsibility, though a faster rejection could happen earlier in the guide if desired.

### Overall verdict
A real user asking to localize this react-email project would be routed to LinguiJS, then correctly stopped at the first incompatibility check with a clear message pointing to the manual Babel plugin path (`@lingui/babel-plugin-lingui-macro`). They would NOT land in a working state, but also would not be left with a half-broken project — the skill halts cleanly with actionable guidance. The weakest link is that react-email is a legitimately common React use case (transactional emails) that the skill suite has no first-class story for: the guide implicitly assumes a web-app runtime with a Vite/Next/CRA build. Adding a dedicated react-email path (or at least a more specific STOP message naming react-email and recommending ICU MessageFormat with `@formatjs/intl` or plain `Intl` APIs for email templates) would be a valuable addition. As-is: correct refusal, no damage, but no working setup.
