# globalize-skills

Install globalization skills for AI coding agents (Claude Code, Codex, Cursor).

## Usage

```bash
npx globalize-skills
```

Running without arguments starts an interactive wizard that walks you through selecting and installing skills.

## Commands

### `add`

Install one or more skills into the current project.

```bash
npx globalize-skills add lingui-setup
npx globalize-skills add lingui-setup lingui-extract
npx globalize-skills add --preset lingui
npx globalize-skills add lingui-setup --agent cursor
npx globalize-skills add lingui-setup --agent all
```

| Option                | Description                                                                    |
| --------------------- | ------------------------------------------------------------------------------ |
| `--preset <name>`     | Install a preset bundle of skills                                              |
| `--agent <name>`      | Target agent: `claude`, `codex`, `cursor`, or `all` (auto-detected by default) |
| `--repo <owner/repo>` | Use a different GitHub repository                                              |
| `--no-cache`          | Skip local cache and fetch fresh from GitHub                                   |

### `list`

Show available skills and presets.

```bash
npx globalize-skills list
```

| Option                | Description                                  |
| --------------------- | -------------------------------------------- |
| `--repo <owner/repo>` | Use a different GitHub repository            |
| `--no-cache`          | Skip local cache and fetch fresh from GitHub |

### `update`

Update installed skills to the latest version. Accepts the same arguments and options as `add`.

```bash
npx globalize-skills update lingui-setup
npx globalize-skills update --preset lingui
```

## Agent Detection

The CLI auto-detects which agents are configured in your project by looking for `.claude/`, `.codex/`, `AGENTS.md`, or `.cursor/` directories. If none are found, it defaults to Claude Code. Use `--agent` to override.

## Caching

Skill metadata and files fetched from GitHub are cached locally for 1 hour in `/tmp/globalize-skills-cache`. Pass `--no-cache` to bypass.

## Requirements

- Node.js >= 18

## License

MIT
