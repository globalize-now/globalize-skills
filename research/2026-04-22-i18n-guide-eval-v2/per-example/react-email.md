## react-email

### Detection
- Framework: react-email (Node CLI-based email template builder)
- Router: N/A
- Package manager: npm (package-lock.json present)
- Existing i18n lib: none

### i18n-guide
- Recommended: none — STOP per hard stop #5
- STOP reason (if any): `react-email` and `@react-email/*` packages found in deps. Per i18n-guide Step 2 rule 5: "This guide doesn't cover react-email. Email templates don't fit the SPA model — there is no client runtime, no Vite/Next.js plugin hook, and messages are rendered through react-email's own CLI. For localizing email templates, use `@formatjs/intl` or direct `Intl.*` calls with locale-specific template files."

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
- None. The skill explicitly enumerates react-email as a hard-stop case (Step 2, rule 5), and detection was unambiguous (`react-email` and `@react-email/*` both present in deps). No improvisation needed.

### Overall verdict
- A real user would land in a correct, intentional non-action state. The i18n-guide skill cleanly identifies react-email as out of scope and gives the user a sensible alternative path (formatjs/Intl with locale-specific templates) rather than routing them into a setup skill that would fail. The weakest link is that no react-email-specific skill exists yet — the user is told what to use but not handed off to anything that automates it. Given the scope of the suite (SPA/SSR React + Vue), this is an appropriate boundary, not a defect.
