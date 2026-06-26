# Globalization Skills

Agent skills for localizing software projects. Currently targeting Claude Code and the Lovable agent, with plans to support more agents.

## Repository Structure

Skills live as flat top-level directories under `skills/`. Each skill is a self-contained directory following the [Agent Skills](https://github.com/vercel-labs/skills) open standard.

```
skills/
  <skill-name>/
    SKILL.md             # Main skill file with frontmatter (required)
    metadata.json        # Skill metadata for npx skills (optional)
    references/          # Supporting guides loaded by the skill (optional)
    scripts/             # Helper scripts (optional)
```

Skills currently in this repo:

- `skills/globalize-guide/` — orchestrator for the full i18n journey (detect → setup → convert → connect Globalize: account sign-in upfront, project + repo at the end)
- `skills/globalize-now-account-setup/` — install + authenticate the Globalize CLI (account sign-in)
- `skills/globalize-now-project-setup/` — create a Globalize project, connect a GitHub/GitLab repo, set catalog patterns (assumes account-setup is done)
- `skills/globalize-now-cli-use/` — manage existing Globalize translation resources
- `skills/css-i18n/` — audit and convert CSS to logical properties for RTL support
- `skills/lovable-i18n/` — single-file i18n skill for the Lovable.dev agent (Lingui + PO, both Lovable stacks, AGENTS.md coding rules, CI extraction, Globalize connect) — experimental

## Conventions

- **Flat skill directories**: Each skill is exactly one level deep under `skills/`. Skill name = directory name = `name:` field in `SKILL.md` frontmatter, all lowercase-with-hyphens.
- **Self-contained**: Each skill directory has everything it needs. No shared abstractions between skills. Duplication is acceptable.
- **SKILL.md frontmatter**: Required fields are `name` and `description`. Description explains when the skill should trigger.
- **References live inside the skill**: Variant-specific instructions, manifest files, and other supporting docs go in `<skill>/references/`. Internal nesting inside `references/` is unconstrained — organize by stack, language, framework, etc. as the skill needs.
- **Detection-first**: Skills that modify projects should detect the target's framework, compiler, router, language, and package manager before taking action.
- **Pin installs to a major**: Every package install a skill emits must specify a SemVer-major caret range (`pkg@^N`, or `pkg@^0.M` for pre-1.0). This applies to `npm install` / `yarn add` / `pnpm add` / `bun add`, every package name in `manifest.json`, every `npx <pkg>@^N <args>` invocation (unpinned `npx` always fetches latest), and any `npx create-*` scaffold call. Wrap pinned package strings in single quotes in shell snippets (`'pkg@^N'`) so zsh's `EXTENDED_GLOB` doesn't eat the caret. Update the pin deliberately when bumping the skill's supported major. Exceptions: (1) when a build-tool-coupled exact pin is required (e.g. `@lingui/swc-plugin` to match Next.js `swc_core`), document the override in the skill's troubleshooting prose; (2) packages whose cadence the user manages deliberately and intentionally leaves uncapped — currently `@globalize-now/cli-client` (pre-1.0; the user's own CLI).

## Installing a Skill

Skills can be installed via the [`npx skills`](https://github.com/vercel-labs/skills) CLI:

```bash
# Install a single skill into the current project
npx skills add globalize-now/globalize-skills --skill globalize-guide -a claude-code

# Or install all skills from this repo
npx skills add globalize-now/globalize-skills -a claude-code
```

Manual install also works — copy the skill directory directly:

```bash
cp -r skills/globalize-guide /path/to/project/.claude/skills/globalize-guide
```

## Delivery Mechanisms

Not every skill should be delivered the same way. Claude Code's router only consults skills for specialized, multi-step tasks — it doesn't pull in a skill mid-edit for routine code changes. This means skills split into two delivery tracks:

- **Routed skills** — invoked on demand (setup, convert, orchestration). Live in `.claude/skills/<name>/` and rely on a discriminating `description` to trigger. Examples: `globalize-guide`, `globalize-now-account-setup`, `globalize-now-project-setup`.

- **Passive-rule skills** — continuous coding guidelines that should apply to every edit in a project (macro wrapping, plural handling, CSS logical properties). These don't trigger reliably via the router. Instead, an installer skill wires them into the target project's `CLAUDE.md` via Claude Code's `@import` syntax. For example, the `globalize-guide` orchestrator appends:

  ```
  @.claude/skills/globalize-guide/references/languages/js-ts/libraries/<library>/code.md
  ```

  Imported files load into every session's context, so the rules are always in effect without depending on routing. Examples: the `*.code.md` references inside `globalize-guide`, `css-i18n` (when wired in).

- **Platform-bundled single-file skills** — skills written for a non-Claude-Code agent platform (currently Lovable), where everything must live in one `SKILL.md`. Routed delivery is the platform's own skill matching, and passive rules are delivered by having the skill write them into the target project's repo-root `AGENTS.md` (which the platform always reads) instead of `@import`. Example: `lovable-i18n`.

When creating a new skill, decide up front which track it belongs on — and if it's passive-rule, make sure an installer skill writes the `@import` line.
