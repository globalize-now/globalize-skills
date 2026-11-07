# Run checklist — tracking the work in `plan.md`

Loaded by SKILL.md ("Track the run in `plan.md`") and by every worker. A setup run outlives what an agent can hold in its head: context gets compacted, workers get re-dispatched, sessions end. Anything not written down gets dropped without anyone noticing. So `.globalize/plan.md` is the single list of what is done and what is left. It is the only checklist: do not start a second one.

## Syntax

```markdown
- [ ] create_config
  - [x] write lingui.config.ts
  - [ ] run the catalog-import check
- [x] language_switcher — skipped: no UI chrome to host it, per decisions.md
- [ ] build_verification — blocked: tsc fails in src/App.tsx (see progress/setup.json)
```

A plan step keeps its id as the first token; a detail item is nested two spaces under its step. Only `[ ]` and `[x]` exist, because tools parse them. A step that legitimately does not apply is `[x]` with `— skipped: <reason>`. A step that failed or is waiting on a decision stays `[ ]` with `— blocked: <reason>`. Never delete an item, and never tick one you did not do.

## Who may write

There is one writer at a time, so nothing gets overwritten. Rewrite the file atomically (`<file>.tmp`, then `mv`).

| While this runs | Writer | Ticks |
|---|---|---|
| Phases 1.5 and 4, §2.0, §3.1, §3.6 | orchestrator | its own steps, as it finishes them; §3.1 also writes the file entries |
| Setup worker | setup worker | the Phase 2 subagent steps |
| Wrap workers (parallel) | **orchestrator only** — wrap workers never write `plan.md` | file entries, from each `wrap-N.json` `completed` list, at every poll |
| Verify worker | verify worker | the `### verify` section |
| Cleanup loop | orchestrator | `### wrap-cleanup-{round}` and any verify steps still open |

In single-agent mode the main agent does all of this itself, and ticks each item as it finishes instead of on a poll.

## Expand your steps before the first edit

`plan.md` is written in Phase 1, before anyone has read the stack's references, so it starts with step ids only. The setup and verify workers add the detail. Right after reading your references, and **before your first edit or command**, write nested items under each of your steps: one per concrete thing the references require on this project.

- **Actions:** each file to create or edit (with its real path) and each command to run.
- **Checks:** every check the references name gets its own item — the catalog-import check, the stray sweep, the bridge check, *Mechanical self-checks*, each verify gate, each bundle grep. These are the items most likely to be forgotten, and a passing build does not replace them.
- **Only what applies:** leave out branches for other stacks and options this run did not choose. Take items from what you read; do not add work the references do not ask for.
- **Short:** one line each, no code. A step with a single action needs no children.
- **On a re-dispatch:** do not expand again. The list is already there, so continue from the first open item.

## While working

1. **Tick as you go.** Tick an item right after the work and its check succeed, one at a time, never in a batch at the end. Tick a step once all its children are ticked.
2. **Tick `plan.md` first, then update your progress file.** The progress file remains what the orchestrator polls, and it gets archived when a phase ends. `plan.md` is what a resume trusts: a step with an open box gets re-checked, even if a progress file lists it as completed.
3. **Write down new work.** If you find something the list does not cover (a second layout file, an extra config), add an item before doing it.
4. **Lost your place?** After compaction, a resume or a re-dispatch, re-read `plan.md`. The next thing to do is the first open item in your section, whatever you remember.
5. **The harness's todo tool is a view.** If your harness has one, mirror the current phase's steps into it so the user can see progress, and rebuild it from `plan.md` whenever they might differ. `plan.md` wins.

## Before reporting done

List what is still open in a phase, here Phase 2:

```bash
awk '/^## Phase 2/{f=1;next} /^## /{f=0} f && /^[[:space:]]*- \[ \]/' .globalize/plan.md
```

- **Worker:** report `succeeded` only when your section has no open items. Otherwise report `failed` or `needs_decision`, naming the open items. The exception is verify's `needs_cleanup`: it stops with its later steps open, and the orchestrator takes over the section.
- **Orchestrator, at the end of a phase:** if a worker reported `succeeded` but items are open, the work is not finished. Re-dispatch once to finish them, then surface whatever is still open to the user instead of advancing.
- **Orchestrator, at the end of the run:** run `grep -nE '^[[:space:]]*- \[ \]' .globalize/plan.md`. Say "All set" only if it prints nothing. Otherwise tell the user which items are open and why.
