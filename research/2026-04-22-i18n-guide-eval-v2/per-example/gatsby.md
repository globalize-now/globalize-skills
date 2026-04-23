## gatsby

### Detection
- Framework: Gatsby 5 (gatsby ^5.14.6)
- Router: N/A (Gatsby's own page routing via `src/pages`)
- Package manager: npm (package-lock.json present)
- Existing i18n lib: none

### i18n-guide
- Recommended: none — STOP triggered
- STOP reason (if any): Hard stop #4 (Gatsby). Message delivered: "This guide doesn't cover Gatsby yet. The LinguiJS setup would hit a 'custom build pipeline' stop because Gatsby doesn't use Vite / Next.js / CRA. For manual setup, use `gatsby-plugin-react-i18next`, or wire Lingui yourself via Gatsby's `gatsby-node.ts#onCreateBabelConfig` hook to add `@lingui/babel-plugin-lingui-macro`."

### Setup skill
- Skill: N/A
- Outcome: N/A
- Files changed: N/A
- Deps added: N/A
- Blockers: N/A — i18n-guide correctly halted before routing

### Convert skill
- Skill: N/A
- Outcome: N/A
- Strings wrapped (count): N/A
- Strings skipped/failed: N/A
- Blockers: N/A

### Deviations from SKILL.md
- None. The Gatsby hard-stop fires cleanly before framework recommendation. The skill's STOP message is well-formed and points the user at concrete alternatives (`gatsby-plugin-react-i18next` or a Babel-plugin wiring path). One minor observation: the Gatsby stop is checked at position #4, after the "already has i18n lib" check — correct order, but worth noting the check sequence relies on Gatsby projects not having any of the listed i18n libs already, which holds here.

### Overall verdict
The guide handles Gatsby exactly as designed: it identifies the unsupported build pipeline, refuses to route to a setup skill that would fail downstream, and gives the user two actionable manual paths. A real user lands in a non-broken state — no half-applied config, no install attempted — with a clear next-step pointer. The weakest link is product-shaped rather than skill-shaped: there is no first-party Gatsby setup skill yet, so the user is on their own once routed away. For the eval question ("does this skill suite produce a working setup?"), the answer for Gatsby is "it correctly declines, which is the right behavior."
