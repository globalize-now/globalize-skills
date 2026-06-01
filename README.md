# globalization-skills

Agent skills for localizing software projects. Each skill is a self-contained set of instructions that an AI coding agent can follow to set up or modify i18n in a target project.

The repo follows the [Agent Skills](https://github.com/vercel-labs/skills) open standard, so every skill is a flat top-level directory under `skills/` and installable via the standard tooling.

## Installation

### `npx skills` (recommended)

Install via the standard [`npx skills`](https://github.com/vercel-labs/skills) CLI:

```bash
# Install a single skill into the current project
npx skills add globalize-now/globalize-skills --skill i18n-guide -a claude-code

# Install all skills
npx skills add globalize-now/globalize-skills -a claude-code
```

### Manual install

Copy a skill directly into your project:

```bash
cp -r skills/i18n-guide /path/to/your/project/.claude/skills/i18n-guide
```

The skill will be available next time you start a Claude Code conversation.

## Available skills

| Skill | Description |
|---|---|
| `i18n-guide` | Orchestrates the full i18n journey for a project: detect stack, recommend a library (Lingui or next-intl), install + configure, wrap existing strings, optionally connect Globalize.now for translation. Drives the work through subagents with shared progress tracking. |
| `globalize-now-cli-setup` | Install the Globalize CLI, authenticate, create a translation project, connect a GitHub or GitLab repository. |
| `globalize-now-cli-use` | Manage existing Globalize translation resources (languages, glossaries, style guides, repositories, team members, API keys). |
| `css-i18n` | Audit and convert CSS to logical properties for RTL/bidirectional layout support. Library-agnostic — works with Tailwind, CSS Modules, vanilla CSS, CSS-in-JS. |

## Repository conventions

Each skill lives at `skills/<skill-name>/` and contains:

- `SKILL.md` — main skill file with `name` + `description` frontmatter (required)
- `metadata.json` — skill metadata (optional, used by `npx skills` ecosystem)
- `references/` — supporting guides loaded by the skill (optional; internal nesting is fine)
- `scripts/` — helper scripts (optional)

Skill name = directory name = `name:` field, all lowercase-with-hyphens.

See `CLAUDE.md` for the full convention guide.
