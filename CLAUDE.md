# Globalization Skills

Agent skills for localizing software projects. Currently targeting Claude Code, with plans to support other agents.

## Repository Structure

Skills live under `skills/{library}/{operation}/`. Each skill is a self-contained directory:

```
skills/
  {library}/
    {operation}/
      SKILL.md           # Main skill file with frontmatter
      references/        # Variant-specific guides (optional)
```

Examples: `skills/lingui/setup/`, `skills/i18next/setup/`, `skills/php-intl/setup/`

## Conventions

- **Self-contained skills**: Each skill directory has everything it needs. No shared abstractions between skills. Duplication is acceptable.
- **SKILL.md frontmatter**: `name` uses `{library}-{operation}` format (e.g. `lingui-setup`). `description` explains when to trigger the skill.
- **Reference files**: Variant-specific instructions that the main SKILL.md dispatches to based on project detection (e.g. `references/nextjs-app-router.md`).
- **Detection-first**: Setup skills should detect the target project's framework, compiler, router, language, and package manager before taking action.

## Installing a Skill

Copy the skill directory into the target project's `.claude/skills/` with a flattened name:

```bash
cp -r skills/lingui/setup /path/to/project/.claude/skills/lingui-setup
```

## Delivery Mechanisms

Not every skill should be delivered the same way. Claude Code's router only consults skills for specialized, multi-step tasks — it doesn't pull in a skill mid-edit for routine code changes. This means skills split into two delivery tracks:

- **Routed skills** — invoked on demand (setup, convert, guide). Live in `.claude/skills/<name>/` as usual and rely on a discriminating `description` to trigger. Examples: `lingui-setup`, `lingui-convert`, `i18n-guide`.

- **Passive-rule skills** — continuous coding guidelines that should apply to every edit in a project (macro wrapping, plural handling, CSS logical properties). These don't trigger reliably via the router. Instead, the corresponding setup skill wires them into the target project's `CLAUDE.md` via Claude Code's `@import` syntax:

  ```
  @.claude/skills/lingui-code/SKILL.md
  ```

  Imported files load into every session's context, so the rules are always in effect without depending on routing. Examples: `lingui-code`, `css-i18n` (intended). The file still lives at `.claude/skills/<name>/SKILL.md`; the frontmatter becomes unused in the import path but stays for parity.

When creating a new skill, decide up front which track it belongs on — and if it's passive-rule, make sure the sibling setup skill installs the `@import` line.
