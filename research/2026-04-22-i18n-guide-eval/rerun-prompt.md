# Re-run prompt

Paste this into a fresh Claude Code session started in `/Users/arturs/Projects/globalize/globalization-skills/` to re-run the i18n-guide evaluation.

---

## Prompt

Re-run the i18n-guide end-to-end evaluation against every example in `/Users/arturs/Projects/globalize/example-websites/typescript/` and write results to `research/<YYYY-MM-DD>-i18n-guide-eval/` in the current project. Use the same method as `research/2026-04-22-i18n-guide-eval/`:

**Setup (you do this, not the subagents):**

1. Create `/tmp/i18n-skill-eval/` (wipe if it exists).
2. For each subdir under `/Users/arturs/Projects/globalize/example-websites/typescript/`:
   - `rsync -a --exclude=node_modules --exclude=.next --exclude=dist --exclude=.nuxt --exclude=.output --exclude=build --exclude=.turbo --exclude=.cache --exclude=.astro <example>/ /tmp/i18n-skill-eval/<name>/`
   - Install every skill into `/tmp/i18n-skill-eval/<name>/.claude/skills/` with flattened names:
     - `skills/i18n/guide` → `.claude/skills/i18n-guide`
     - `skills/lingui/{setup,convert,code}` → `.claude/skills/lingui-{setup,convert,code}`
     - `skills/next-intl/{setup,convert}` → `.claude/skills/next-intl-{setup,convert}`
     - `skills/vue/{setup,code}` → `.claude/skills/vue-{setup,code}`
     - `skills/css/i18n` → `.claude/skills/css-i18n`

**Spawn one `general-purpose` subagent per example, all in a single message for parallelism.** Each subagent gets this brief (substitute `<NAME>` per example):

> You are evaluating the `globalize-skills` suite against one example project.
>
> **Working directory (do not leave)**: `/tmp/i18n-skill-eval/<NAME>`
>
> **Job**: Follow the i18n-guide skill end-to-end on this project, then any setup/convert skills it routes to. Report the outcome in the fixed schema below.
>
> **Rules**:
> - Skills live at `.claude/skills/` inside the working dir. You invoke a skill by reading its `SKILL.md` and acting as if triggered by it. You cannot use the Skill tool — these skills are not registered.
> - **Unguided mode** only. Do not ask the user anything. There is no user. Pick unguided whenever offered.
> - **Locales**: source `en`, target `es`. Accept any other sensible defaults without prompting.
> - **Run real installs** if the setup skill prescribes them (match the lockfile: `package-lock.json`→npm, `pnpm-lock.yaml`→pnpm, `yarn.lock`→yarn, `bun.lock`→bun). If an install fails, log it as a blocker and stop.
> - **Perform real edits** the skills prescribe. The eval asks whether the skills produce a working setup.
> - **Timebox ~10 min wall-clock per step**. If stuck, stop and report as blocker.
> - No git ops.
>
> **Steps**:
> 1. Read `.claude/skills/i18n-guide/SKILL.md`. Follow it. Record detection + recommendation/STOP.
> 2. If routed to a setup skill, read that `SKILL.md` (and referenced `references/*.md`) and follow it.
> 3. If routed to a convert skill after setup, follow that too. (Only `lingui-convert` and `next-intl-convert` exist; `vue-i18n` has none.)
> 4. Fill the report schema.
>
> **Report schema** — output exactly this at the end (fill all fields; use `N/A` where truly not applicable):
>
> ```
> ## <NAME>
>
> ### Detection
> - Framework:
> - Router:
> - Package manager:
> - Existing i18n lib:
>
> ### i18n-guide
> - Recommended:
> - STOP reason (if any):
>
> ### Setup skill
> - Skill:
> - Outcome: success | partial | failed | N/A
> - Files changed: (bullet list: path — 1-line purpose)
> - Deps added:
> - Blockers:
>
> ### Convert skill
> - Skill:
> - Outcome: success | partial | failed | N/A
> - Strings wrapped (count):
> - Strings skipped/failed:
> - Blockers:
>
> ### Deviations from SKILL.md
> - (anywhere the skill's instructions were ambiguous, project-shape edge cases not handled, places you had to improvise)
>
> ### Overall verdict
> - (one paragraph: would a real user land in a working state? weakest link?)
> ```
>
> Keep the response focused on the report — minimize narration.

**After all agents finish:**

1. Write one per-example report per subagent result to `research/<YYYY-MM-DD>-i18n-guide-eval/per-example/<name>.md`.
2. Write a consolidated `findings.md` grouping the results into: high-impact bugs (multiple examples affected), detection/routing gaps, skill-prescribed improvisations, "unguided" mode tension, convert coverage gaps, what-works-well, and priority fixes.
3. Write a `README.md` with method summary + results table (STOP correctly / STOP at setup / silent misroute / setup+convert success / setup or convert partial or failed).

**Expected cost**: ~13 unsupported-stack examples hit the Step-2 STOP in under a minute each. The remaining ~10–12 agents each run 10–30 min of real setup + convert + install. Send all 27 in a single multi-tool-call message to maximize concurrency.

**Before spawning**, call `advisor()` to sanity-check the plan — it will flag consent-gate issues, skill invocation mechanics, and anything else that's drifted since the last run.
