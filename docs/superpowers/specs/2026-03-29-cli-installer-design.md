# CLI Installer for globalize-skills

## Context

Users currently install skills by manually copying directories (`cp -r skills/lingui/setup .claude/skills/lingui-setup`). This is error-prone and doesn't scale to multiple agents. We need a CLI tool that fetches skills from GitHub and installs them into the correct location for Claude Code, Codex, and Cursor.

## Overview

`globalize-skills` is a Node.js CLI published to npm. It fetches skills from the `Globalize-now/globalize-skills` GitHub repo and installs them with format conversion for each target agent platform.

## Commands

### No arguments — Interactive wizard
```
$ npx globalize-skills
```
Multi-step wizard:
1. Action: Add / Update / List
2. Skill selection: Multi-select with presets (e.g., "lingui" selects all 3 lingui skills)
3. Agent target: Auto-detected from cwd, with override options

### Direct commands (scriptable)
- `npx globalize-skills add <skill|--preset name> [--agent claude|codex|cursor|all]`
- `npx globalize-skills update <skill|--preset name>`
- `npx globalize-skills list`

When `--agent` is omitted, auto-detect which agents are in use by checking for `.claude/`, `.codex/` or `AGENTS.md`, `.cursor/` in cwd. Default to Claude Code if none detected.

## Presets

Defined in `presets.json` at the repo root:
```json
{
  "lingui": {
    "description": "All LinguiJS skills (setup, convert, code)",
    "skills": ["lingui-setup", "lingui-convert", "lingui-code"]
  }
}
```

## Agent Converters

### Claude Code (pass-through)
- Target: `.claude/skills/<name>/SKILL.md` + `references/`
- No transformation — native format

### Cursor (multi-file with globs)
- Main skill: `.cursor/rules/<name>.mdc`
- Each reference: `.cursor/rules/<name>-<variant>.mdc`
- Transform SKILL.md frontmatter to MDC frontmatter:
  ```
  ---
  description: <from SKILL.md>
  globs:
  alwaysApply: false
  ---
  ```
- Variant files get appropriate globs derived from variant name:
  - `nextjs-app-router` → `globs: ["next.config.*"]`
  - `vite-swc` → `globs: ["vite.config.*"]`
  - `vite-babel` → `globs: ["vite.config.*", ".babelrc*"]`

### Codex (multi-file)
- Main skill: `.codex/skills/<name>.md`
- Each reference: `.codex/skills/<name>-<variant>.md`
- Strip SKILL.md frontmatter, prepend `<!-- Installed by globalize-skills -->` header

## GitHub Fetching

- Source repo: `Globalize-now/globalize-skills`
- Fetch directory tree via GitHub API: `GET /repos/{owner}/{repo}/git/trees/main?recursive=1`
- Filter for `skills/*/SKILL.md` paths to discover skills
- Fetch raw file content for SKILL.md frontmatter (name, description) to build the skill list
- Fetch all files in a skill directory (SKILL.md + references/*) when installing
- Cache results locally in temp dir for 1 hour; `--no-cache` to bypass
- No auth required (public repo, 60 req/hour unauthenticated)
- Override repo with `--repo owner/repo` for forks

## Project Structure

```
cli/
  bin.mjs                # #!/usr/bin/env node entry point
  commands/
    add.mjs              # Fetch + convert + install
    list.mjs             # Show available skills
    update.mjs           # Re-fetch and overwrite
    wizard.mjs           # Interactive no-args flow
  converters/
    claude.mjs           # Pass-through to .claude/skills/
    codex.mjs            # Transform to .codex/skills/
    cursor.mjs           # Transform to .cursor/rules/ .mdc
  lib/
    github.mjs           # GitHub API fetching + caching
    registry.mjs         # Parse skills & presets from repo
    detect.mjs           # Auto-detect agents in cwd
  package.json
```

## package.json

```json
{
  "name": "globalize-skills",
  "version": "0.1.0",
  "bin": { "globalize-skills": "./bin.mjs" },
  "type": "module",
  "engines": { "node": ">=18" },
  "dependencies": {
    "@inquirer/prompts": "^7"
  },
  "files": ["bin.mjs", "cli/"]
}
```

## Dependencies

- `@inquirer/prompts` — interactive wizard UI (multi-select, list, confirm)
- Node built-in `fetch` (Node 18+) for GitHub API
- No build step — plain ESM, runs directly

## Verification

1. `npx globalize-skills list` shows all skills with descriptions
2. `npx globalize-skills add lingui-setup --agent claude` creates `.claude/skills/lingui-setup/SKILL.md` + `references/`
3. `npx globalize-skills add lingui-setup --agent cursor` creates `.cursor/rules/lingui-setup.mdc` + variant `.mdc` files with correct globs
4. `npx globalize-skills add lingui-setup --agent codex` creates `.codex/skills/lingui-setup.md` + variant files
5. `npx globalize-skills add --preset lingui` installs all 3 lingui skills
6. `npx globalize-skills update lingui-setup` overwrites with latest from GitHub
7. No-args wizard flow completes end-to-end
8. Auto-detection correctly identifies agents from cwd
