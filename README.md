# globalization-skills

Agent skills for localizing software projects. Each skill is a self-contained set of instructions that an AI coding agent can follow to set up or modify i18n in a target project.

## Installation

### Interactive (recommended)

```bash
npx globalize-skills
```

### Direct install

```bash
# Install a single skill (auto-detects Claude Code, Codex, Cursor)
npx globalize-skills add lingui-setup

# Install all LinguiJS skills
npx globalize-skills add --preset lingui

# Target a specific agent
npx globalize-skills add lingui-setup --agent cursor

# List available skills
npx globalize-skills list

# Update to latest version
npx globalize-skills update lingui-setup
```

### Manual install

Copy a skill into your project:

```bash
cp -r skills/lingui/setup /path/to/your/project/.claude/skills/lingui-setup
```

The skill will be available in Claude Code next time you start a conversation.

## Available Skills

| Skill | Path | Description |
|-------|------|-------------|
| `lingui-setup` | `skills/lingui/setup/` | Set up LinguiJS in any React-based project (Next.js, Vite, CRA) |

## Adding a New Skill

1. Create `skills/{library}/{operation}/SKILL.md` with frontmatter (`name`, `description`)
2. Add variant-specific reference files in `references/` if the skill needs framework-specific paths
3. Update this table
