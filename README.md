# globalization-skills

Agent skills for localizing software projects. Each skill is a self-contained set of instructions that an AI coding agent can follow to set up or modify i18n in a target project.

The repo follows the [Agent Skills](https://github.com/vercel-labs/skills) open standard, so every skill is a flat top-level directory under `skills/` and installable via the standard tooling.

## Installation

### `npx skills` (recommended)

Install via the standard [`npx skills`](https://github.com/vercel-labs/skills) CLI:

```bash
# Install a single skill into the current project
npx skills add globalize-now/globalize-skills --skill globalize-guide -a claude-code

# Install all skills
npx skills add globalize-now/globalize-skills -a claude-code
```

### Manual install

Copy a skill directly into your project:

```bash
cp -r skills/globalize-guide /path/to/your/project/.claude/skills/globalize-guide
```

The skill will be available next time you start a Claude Code conversation.

### Lovable

`lovable-i18n` targets the [Lovable](https://lovable.dev) platform agent rather than Claude Code. It now lives in its own repo — [globalize-now/lovable-i18n](https://github.com/globalize-now/lovable-i18n) — which is the maintained source; import from there. The copy under this repo's `skills/lovable-i18n` is kept for backwards compatibility and is no longer updated.

## Available skills

| Skill | Description |
|---|---|
| `globalize-guide` | Orchestrates the full i18n journey for a project: detect stack, recommend a library, install + configure, wrap existing strings, and connect Globalize.now for translation (on by default — account sign-in runs upfront, project + repo connection at the end). Drives the work through subagents with shared progress tracking. |
| `globalize-now-account-setup` | Install the Globalize CLI and authenticate (account sign-in). |
| `globalize-now-project-setup` | Create a translation project, connect a GitHub or GitLab repository, and set catalog file patterns. Assumes the CLI is installed and authenticated. |
| `globalize-now-cli-use` | Manage existing Globalize translation resources (languages, glossaries, style guides, repositories, team members, API keys). |
| `css-i18n` | Audit and convert CSS to logical properties for RTL/bidirectional layout support. Library-agnostic — works with Tailwind, CSS Modules, vanilla CSS, CSS-in-JS. |
| `lovable-i18n` | Single-file i18n skill for the [Lovable](https://lovable.dev) agent (not Claude Code): Lingui + PO setup for both Lovable stacks (Vite SPA and TanStack Start), string wrapping, coding rules in `AGENTS.md`, a GitHub Actions extraction workflow, and Globalize.now connect. Experimental — now maintained at [globalize-now/lovable-i18n](https://github.com/globalize-now/lovable-i18n); this copy is kept for backwards compatibility (see the Lovable install note in the Installation section above). |

## Repository conventions

Each skill lives at `skills/<skill-name>/` and contains:

- `SKILL.md` — main skill file with `name` + `description` frontmatter (required)
- `metadata.json` — skill metadata (optional, used by `npx skills` ecosystem)
- `references/` — supporting guides loaded by the skill (optional; internal nesting is fine)
- `scripts/` — helper scripts (optional)

Skill name = directory name = `name:` field, all lowercase-with-hyphens.

See `CLAUDE.md` for the full convention guide.
