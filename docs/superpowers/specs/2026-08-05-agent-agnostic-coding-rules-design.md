# Agent-agnostic delivery for generated coding rules

## Context

`globalize-guide` renders a per-project coding-rules file from a library
`rules.template.md` and wires it into the target repo so it loads on every future
edit. Both halves of that delivery are hardcoded to Claude Code:

- the rendered file is written to `.claude/globalize-rules.md`
- the only bridge is `@.claude/globalize-rules.md` appended to `CLAUDE.md`

There is no agent detection anywhere in the skill — `.claude/globalize-rules.md`
appears as a literal on 112 lines across 18 files (115 occurrences). A repo whose
team uses Codex, Cursor, Copilot, Gemini CLI, Aider or Cline gets a rules file none
of those agents will ever load.

The rules content itself is already agent-neutral: it is plain imperative markdown
about wrapping strings, plurals, catalog paths and skip-lists, with a hard
self-containment invariant that forbids pointing back into the skill directory.
Only its location and its wiring assume Claude Code.

`AGENTS.md` is now read by Codex CLI, Cursor, Copilot, Gemini, Aider and Cline.
Claude Code still reads only `CLAUDE.md`. Those two files together therefore reach
effectively every agent in use.

## Scope

**In scope:** the artifact `globalize-guide` leaves behind — where the generated
rules file lives and how agents are pointed at it.

**Out of scope:** the skill's own runtime. `globalize-guide` continues to be a
Claude Code skill and keeps background subagent dispatch, `Skill`-tool delegation
to `globalize-now-account-setup` / `globalize-now-project-setup`, and
`.globalize/progress/*.json` polling. Porting the orchestrator to other agents is
a separate project and is not started or prepared for here.

Also out of scope:

- `skills/lovable-i18n` — a backwards-compat copy, maintained in its own repo, and
  it already writes rules into `AGENTS.md` by a different mechanism.
- The three `rules.template.md` files that `manifest.json` declares but that do not
  exist on disk yet (`rails.rules.template.md`,
  `string-catalog.rules.template.md`, `android-strings.rules.template.md`). They
  are referenced by 5 manifest entries. When they land they inherit the new path
  from `rules-template-format.md`; their surrounding setup prose *is* in scope,
  because it already hardcodes `.claude/`.

## What lands in the target repo

```
.agents/globalize-rules.md    generated, committed, whole-file overwrite on re-run
CLAUDE.md                     + @.agents/globalize-rules.md
AGENTS.md                     + an "Internationalization" pointer section (created if absent)
```

`.agents/` is agent-neutral and is the direction the ecosystem is drifting — it is
a proposed convention (`bgreenwell/dotagents`, `agentsstandard.com`) for
agent-facing resources, and no common toolchain gitignores it. The proposal is
still in flux and currently names `skills/`, `personas/`, `settings/`, `memory/`
without a rules slot, so the exact filename may need revisiting if that settles
differently. That risk is accepted.

`.globalize/` remains gitignored and keeps `rules-values.json`; only the rendered
rules file is committed.

### Rules content

Unchanged. Same templates, same `conditions` / `values` frontmatter, same
`<!-- if: -->` grammar, same `<<placeholder>>` substitution, same rendering
procedure, same fail-closed rule, same budgets.

### The AGENTS.md pointer

`AGENTS.md` has no import syntax. The rules therefore reach non-Claude agents as a
pointer, which those agents load only if they choose to follow it. This is
knowingly best-effort — inlining a copy would guarantee loading but would put the
rules in two places that drift, and it was rejected for that reason.

Appended as a named section:

```markdown
## Internationalization

Before adding or editing any user-facing string, read `.agents/globalize-rules.md`
and follow it. It is this project's authoritative i18n authoring contract — which
API to use, how to handle plurals, where catalogs live, and what not to wrap.
```

Idempotency key: the literal string `.agents/globalize-rules.md` appearing anywhere
in `AGENTS.md`. Present → skip silently.

When `AGENTS.md` does not exist, create it with an `# AGENTS.md` heading and that
section only. Setup does not author a project brief on the user's behalf.

### Gitignore guard

After writing, run `git check-ignore` on the generated file. Some repos ignore
whole dotfile directories, and a rules file that is ignored is a rules file no
teammate receives. If it is ignored, report it rather than silently succeeding.

## Consent model and plan steps

`generate_coding_rules` keeps its name and stays a core Phase 2 step.

`install_coding_rules` keeps its name but **moves out of the `SKILL.md` §1.10
optional list into the core Phase 2 checklist**. It now writes both bridges and
always runs.

They stay two steps rather than one because the existing "if the render failed,
do not write a bridge pointing at a file that is not there" logic already lives on
that boundary, and `plan.md` stays readable.

Unconditional means *unconditional as a plan step*, not *silent*. The skill's
global guided/unguided rule still applies: guided mode describes each file edit
and waits for confirmation; unguided mode applies directly and stops only on hard
errors.

§1.10 consequently loses its fourth checkbox and the paragraph explaining that the
import is the opt-in part. Remaining optionals: ESLint plugin, CI/CD integration,
test setup wrapper.

## Migration off `.claude/`

The `.claude/` path shipped in commit `6743587` (PR #49). Any project already set
up has `.claude/globalize-rules.md` plus an `@.claude/globalize-rules.md` line in
`CLAUDE.md`. Without migration a re-run leaves that line dangling in every future
session.

- `generate_coding_rules` writes `.agents/globalize-rules.md` **first**, then
  removes `.claude/globalize-rules.md`. Never the reverse — a fail-closed render
  must leave the user with what they already had rather than nothing.
- It only deletes a `.claude/globalize-rules.md` whose line 1 carries the
  generated header (`<!-- globalize-rules v… | generated by globalize-guide -->`).
  A file at that path without the header is not ours: leave it and warn.
- The `.claude/` directory itself is never removed, even if the deletion empties
  it. It routinely holds settings and installed skills that are not ours.
- `install_coding_rules` strips any `@.claude/globalize-rules.md` line from
  `CLAUDE.md` as part of writing the new import, so no project ends up with both
  or with a dangling one.
- If `generate_coding_rules` failed and no `.agents/globalize-rules.md` was
  written, `install_coding_rules` writes **neither** bridge and creates no
  `AGENTS.md` — a pointer or import aimed at a missing file is worse than nothing.
  Because removal is gated on a successful write, a failed run also leaves
  `.claude/globalize-rules.md` and its import untouched: the project keeps the
  working rules it already had, and no state exists in which the old file is gone
  but the new one was never written.

## Invariants

- **Generated header line 2** becomes
  `Put your own project rules in CLAUDE.md or AGENTS.md.`
- **No `templateVersion` bump.** Its contract is "bump when the rendering contract
  changes, not on prose edits", and it exists so a later run can recognise a stale
  generated file. Template bodies, conditions, values and rendered content are
  byte-identical here; only the path moved, and migration detects that by path.
  Bumping all four would falsely signal the rules themselves changed.
- **Self-containment** gains one forbidden substring. Template bodies already may
  not contain `.claude/skills/`, a `references/…` path, or the literal
  `globalize-guide`; add plain `.claude/` so the old path cannot creep back in. No
  template body contains `.claude` today, so this costs nothing.
- The self-containment **rationale prose** in `rules-template-format.md` must be
  rewritten, not find-and-replaced. It currently argues the point through a
  `.claude/` vs `.claude/skills/` contrast that stops parsing once the file lives
  in `.agents/`. The argument survives unchanged; those sentences do not.

## Evals

`evals/verify-rules-template.sh`, `--project` mode:

Changed:
- rules file expected at `.agents/globalize-rules.md`
- `CLAUDE.md` contains `@.agents/globalize-rules.md` exactly once

New:
- `AGENTS.md` exists and contains `.agents/globalize-rules.md` exactly once
- no `.claude/globalize-rules.md` remains on disk (migration ran)
- no `@.claude/globalize-rules.md` remains in `CLAUDE.md` (no dangling import)
- the generated file is not gitignored

Template mode: add `.claude/` to the forbidden-substring list.

Unchanged: header regex, single-header count, marker and `<<` residue checks,
budget cross-check, resolved-keys report.

## File scope

Straight rename in place — no restructuring of the duplicated rendering prose.
That duplication (six near-identical ~70-line copies of the render procedure) is
why this change touches 112 lines, and collapsing it into
`rules-template-format.md` was considered and rejected for this project to keep
the diff mechanical.

Line counts below are lines containing `.claude/globalize-rules`; several also need
prose rewrites beyond the substitution, called out in the third column.

| File | Lines | Also |
|---|---|---|
| `skills/globalize-guide/SKILL.md` | 8 | §1.10 rewrite, `plan.md` checklist, Phase 3 wrap prompt |
| `skills/globalize-guide/references/rules-template-format.md` | 6 | step 8, self-containment rewrite |
| `…/ios/native/string-catalog.setup.md` | 11 | §1.10 gating prose |
| `…/js-ts/libraries/lingui/setup.add-ons.md` | 10 | §1.10 gating prose |
| `…/js-ts/libraries/next-intl/setup.add-ons.md` | 10 | §1.10 gating prose |
| `…/js-ts/libraries/paraglide/setup.add-ons.md` | 10 | §1.10 gating prose |
| `…/ruby/frameworks/rails/setup.add-ons.md` | 10 | §1.10 gating prose |
| `…/android/native/setup.add-ons.md` | 10 | §1.10 gating prose |
| `…/js-ts/libraries/vue-i18n/setup.shared.md` | 10 | §1.10 gating prose |
| `evals/verify-rules-template.sh` | 9 | new assertions |
| `…/ruby/frameworks/rails/rails.setup.md` | 3 | — |
| `…/ios/native/string-catalog.convert.md` | 3 | — |
| `…/android/native/android-strings.setup.md` | 3 | — |
| `…/android/native/android-strings.convert.md` | 2 | — |
| `…/ruby/frameworks/rails/rails.convert.md` | 1 | — |
| `…/js-ts/convert.recall-self-check.md` | 1 | — |

Repo documentation:

| File | Lines | Also |
|---|---|---|
| root `CLAUDE.md` | 3 | Delivery Mechanisms section, lines 60–74 |
| `evals/README.md` | 2 | lines 197 and 199 |

The seven files carrying "§1.10 gating prose" each state that the `CLAUDE.md`
import is the opt-in part and that the rules file lands on disk either way. That
claim is false once `install_coding_rules` becomes core, so those passages are
rewritten, not substituted.

## Verification

1. `evals/verify-rules-template.sh` template mode passes on all four existing
   templates.
2. `grep -rn '\.claude/globalize-rules' skills/ evals/ docs/ CLAUDE.md README.md`
   returns only intentional migration references.
3. A Layer B setup run on the `nextjs-app-router-lingui` fixture produces
   `.agents/globalize-rules.md`, the `CLAUDE.md` import, and the `AGENTS.md`
   pointer; `--project` mode passes.
4. A fixture pre-seeded with the old `.claude/globalize-rules.md` and its import
   migrates cleanly: new file present, old file gone, no `@.claude/` line left.
