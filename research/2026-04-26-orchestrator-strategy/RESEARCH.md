# Orchestrator Strategy — Research & Decisions

**Date:** 2026-04-26
**Branch:** `feat/localize-orchestrator`
**Status:** Big-picture locked. Sub-system plans pending.

---

## 1. Context

Today the repo ships discrete skills (`lingui-setup`, `lingui-convert`, `lingui-code`, `next-intl-setup`, `next-intl-convert`, `vue-*`, `css-i18n`, `i18n-guide`, `globalize-now-cli-*`) plus an installer CLI (`npx globalize-skills`), an MCP server for the Globalize platform, and an API client. Skills are independently routed by description match. The v2 eval (27 example projects, see `research/2026-04-22-i18n-guide-eval-v2/findings.md`) surfaced systemic friction that isn't fixable by editing individual skill files — it's structural.

The user goal:

> Guide users through making a website translatable, applying best practices, converting current code. Users must stay on track and can start at any point in their codebase. Transparency is critical — users must see what's happening and what's required of them. Two modes: fully automated (decisions made for them) and guided (user decides along the way).

---

## 2. Problems with the current shape

Distilled from the v2 eval and direct reading of the skill files:

1. **Skills are islands.** Each skill detects from scratch, picks its own mode, makes its own decisions. No shared journey memory between `setup` → `convert` → `code` → `css-i18n` → `globalize-now-cli`. Re-entering after a week starts cold.
2. **"Start anywhere" is aspirational.** Skills implicitly assume linear order. Mid-journey state is only acknowledged by the `i18n-guide` STOP rule for "library already installed."
3. **Mode-toggle tension.** Eval finding: consent-gate prose throughout setup files conflicts with the unguided defaults table. Mode is decided per-skill instead of once for the whole journey.
4. **No persisted decisions.** Catalog format, source locale, routing strategy, plural-emission rules — all decided in conversation, never written down. Sibling skills don't know what was chosen. (The Nuxt-vue-convert ICU bug — eval finding #3 — is exactly this: convert had no idea setup chose JSON catalogs that can't carry ICU.)
5. **Reference dispatch is bloated.** `lingui-setup/SKILL.md` is 829 lines because variant logic, mode logic, consent logic, and verification logic all live in the main file.
6. **No transparency surface.** A user can't see "I am 60% through localizing my app — these 3 files remain." The artifacts that exist (catalog files, config) don't read as progress.
7. **Universal vs Claude conflation.** The repo wires `@import` into `CLAUDE.md` for passive rules, ships an installer that targets Claude/Cursor/Codex, and has an MCP server. The split is unstated and inconsistent.

---

## 3. Design axes (decisions any answer must take)

- **Where does state live?** Conversation only / repo file / service.
- **Who orchestrates?** Skills self-route / single entry skill drives sub-skills / out-of-band agent-or-command.
- **How does mode propagate?** Per-skill toggle / journey-level toggle / per-step override against journey default.
- **What does Claude get that others don't?** Hooks, slash commands, plugins — or nothing.
- **Where do passive coding rules live?** `@import` (Claude) / `.cursorrules` (Cursor) / `AGENTS.md` (Codex) — adapter required.

---

## 4. Options considered

Four were weighed in detail (see conversation transcript for full pros/cons).

- **Option 1 — Plan file as source of truth (universal-first).** A `.globalize/PLAN.md` is the canonical artifact. Skills read/write it. Universal everywhere.
- **Option 2 — Single orchestrator skill, sub-skills as workers.** One headline skill drives the journey; sub-skills become callable workers.
- **Option 3 — Claude-native plugin (full).** Skills + slash commands + hooks + MCP, Claude-only.
- **Option 4 — Hybrid: universal core + Claude polish layer.** Plan file + orchestrator + MCP as the universal core (Option 1+2). Slash commands + hooks added as Claude-only polish (subset of Option 3). Cursor/Codex get the full journey via skills+MCP; Claude gets enforcement and convenience on top.

---

## 5. Decision — Option 4 (Hybrid)

**Locked.** Why:

- The universal layer captures most of the value (resumability, transparency, decision recording, mode-once).
- The Claude layer earns its keep on **enforcement** (hooks gate edits deterministically; passive `@import` rules only nudge) and **status surface** (`SessionStart` hook synthesizes "where am I"), not on infrastructure.
- It's the only option that takes the user's explicit Claude-vs-universal framing seriously: the answer is "you don't have to pick if the universal layer is strong enough that Claude features become polish, not infrastructure."

---

## 6. Architecture summary

```
skills/
  localize/                           # NEW — orchestrator (replaces i18n-guide as front door)
    SKILL.md
    references/
      detection.md                    # SHARED detection contract (single source of truth)
      plan-format.md                  # frontmatter + checklist contract
      mode.md                         # auto/guided rules, journey-level
      next-step.md                    # state-machine rules: given plan, what's next?

  lingui/setup/                       # existing — detection/mode prose stripped out
  lingui/convert/                     # existing — reads plan frontmatter, no re-prompting
  lingui/code/                        # passive @import (Claude); .cursorrules (Cursor); AGENTS.md (Codex)
  next-intl/{setup,convert}/          # same treatment
  vue/{setup,convert,code}/           # same treatment
  css/i18n/                           # plan-aware; only runs if rtl_targets: true
  globalize-now-cli/{setup,use}/      # gated by "Translation pipeline" plan section
  i18n/guide/                         # collapsed into skills/localize (or thin redirect)

mcp-server/src/tools/
  plan.ts                             # NEW — get_plan, update_plan, mark_done (validated CRUD)
  # detect.ts deliberately NOT created — see §10
  # existing platform tools unchanged

plugins/claude-globalize/             # NEW — Claude-only thin shell
  commands/                           # /localize {start, status, next, add-locale, redetect, translate}
  hooks/                              # SessionStart, PostToolUse on JSX/Vue, Stop
  agents.json                         # bundles skills/* and the plugin
```

**Single load-bearing claim:** orchestrator + plan file + MCP form a closed loop — *detect → decide → record → execute → mark → re-detect*. Sub-skills are pure workers. Hooks are pure enforcement. The user's mental model collapses to one entry point and one artifact (`PLAN.md`); everything else is mechanism.

---

## 7. Plan file contract

`.globalize/PLAN.md` is the canonical artifact. Plain markdown, committable, human-readable, agent-readable.

```markdown
---
# Decisions (set once, sticky — only changed by explicit user re-decide)
library: next-intl
catalogFormat: json
sourceLocale: en
targetLocales: [es, fr]
mode: auto              # or guided
plural_strategy: icu-messages

# Detection snapshot (recorded by agent, refreshed only on fingerprint drift)
detected:
  framework: nextjs
  framework_version: "15.0.3"
  router: app
  typescript: true
  package_manager: pnpm
  rtl_targets: false
  build_tool: turbopack
  detected_at: 2026-04-26
  fingerprint: "pkg:a3f1...|next.config:b88c...|tsconfig:7e2a..."
---

## Setup
- [x] Install packages
- [x] Configure routing  (chosen: subpath, locale prefix, source locale shown)
- [x] Provider wired
- [x] Switcher

## Convert  (8/14 files)
- [x] app/page.tsx
- [ ] app/dashboard/page.tsx
- [ ] components/Header.tsx

## RTL / CSS
- [ ] Run css-i18n audit  (skipped while rtl_targets: false)

## Translation pipeline
- [ ] Connect Globalize repository
- [ ] Add target locales to project
- [ ] First export
```

**Frontmatter contract — locked decisions:**

- **Decisions block top, detection block bottom.** Audit-friendly separation. Decisions are sticky; detection is regenerable.
- **Fingerprint required.** Hash of `package.json` deps + key config files. Re-evaluation only triggers when fingerprint drifts. Major version bumps surface as warnings before sub-skills run against stale assumptions.
- **`detected_at` required.** Staleness audit at a glance.
- **Consistency invariants enforced server-side.** `plan.update` (MCP) rejects internally inconsistent states (e.g., Nuxt + JSON + ICU plurals, or `library: next-intl` with `detected.framework: vite`). Same place the eval-bug class gets blocked.
- **Mode is journey-level.** `mode: auto | guided` set once, propagates to all sub-skills. Per-step override always allowed but never re-prompted.
- **Decisions are explicit, not inferred.** If frontmatter is missing a key, the orchestrator prompts; if present, it's authoritative.
- **Checklist sections mirror sub-skills.** Each `## Section` maps to a worker skill. Sub-skill's only persistence side-effect is updating its section.

---

## 8. Detection — agent-driven, recorded once

**Decision (revised mid-discussion):** detection runs in the agent, not on the MCP server. The MCP server stays a pure API client — no filesystem access.

Rationale:

1. **Cleaner security model.** No `read_file`-shaped tools on the server. No working-directory coupling.
2. **Detection is the most-changed surface.** Framework versions, routers, edge cases — easier to iterate as markdown the agent reads than as TypeScript on a server users must reinstall.
3. **No round-trip latency on every sub-skill entry.** Inline reads are already cheap.
4. **Cross-agent parity is easier.** Agent-side detection works identically across Claude, Cursor, Codex; server-side would have required filesystem-mounted MCP everywhere.

**But results are recorded.** The plan's `detected:` block + `fingerprint` mean re-detection only fires on real drift. Warm sessions skip it entirely. This is the best-of-both-worlds resolution: agent owns the algorithm; plan owns the cache.

A single shared reference file (`skills/localize/references/detection.md`) is the canonical detection contract — every skill that needs to detect reads from this file. Eval finding "detection drift across setup skills" goes away.

---

## 9. Hooks (Claude-only) — what they actually do for us

Hooks are not just guardrails. They support free-text injection back into the model's context, which makes them useful as **on-demand prompts**, not just pass/fail gates. Verified mechanisms:

- **`SessionStart`** — JSON output with `additionalContext` field is injected like a system reminder. Reads `.globalize/PLAN.md`, computes status, prints "i18n status: setup ✓, convert 14/14 ✓, translations 9/14 to es; next: review platform translations." Free orientation on every Claude session, agent and user both primed.
- **`PostToolUse` on `Edit`/`Write` for `*.tsx` / `*.vue` / `*.jsx`** — diff the change, run the same string-literal detector that `convert` uses, exit code 2 with stderr containing the fix instruction ("Found 4 unwrapped strings in app/settings/page.tsx: line 12: 'Settings'… Wrap before continuing. Use `<Trans>` for JSX text, `t\`…\`` via `useLingui()` for prop values."). Model sees as tool-error, immediately re-edits. Deterministic enforcement that `@import` rules can only nudge toward.
- **`PostToolUse` on `Edit` of `package.json` / `vite.config.*` / `next.config.*`** — catches the eval bug class where a removed plugin or downgraded version silently breaks the build.
- **`Stop`** — runs `extract --check` after work that touched localizable files, reports drift in the final message.
- **`UserPromptSubmit`** — light routing: if the user says "translate this" / "add Spanish" / "wrap these strings", inject a one-line nudge pointing at `/localize` so the orchestrator isn't bypassed.

**Caveat:** payload size limits and exact JSON schema between events should be verified against current Claude Code docs before locking the contract. Capability is confirmed; field details to confirm during Plan 6.

---

## 10. MCP scope (post-revision)

After dropping server-side detection, the MCP server's job is crisp:

- **Plan CRUD** — `plan.get`, `plan.update`, `plan.mark_done`. Typed, schema-validated. The validation schema is where consistency invariants from §7 live.
- **Existing platform tools** — projects, languages, glossary, repositories, members, api-keys, patterns, project-languages, style-guides, gitlab. Unchanged.

Universal benefit: any MCP-aware agent (Claude, Cursor, Codex, Cline) gets identical journey mechanics. Without MCP plan tools, the universal fallback is direct file edit (brittle — formatting, frontmatter parsing, consistency-check absence). With MCP, the agent calls a typed tool and the server enforces the contract.

---

## 11. Workflow — typical journeys

Detailed walkthrough lives in conversation transcript. Summary table:

| Touchpoint | What user sees | Universal mechanism | Claude polish |
|---|---|---|---|
| First entry | One prompt, one mode question, then watch | Orchestrator skill + agent detection + plan file | `/localize` slash command shortcut |
| Resumption | Status line at session start | Plan file `@import` into context | `SessionStart` hook synthesizes status |
| Day-to-day editing | Strings get wrapped without thinking | Passive `@import` rules (best-effort) | `PostToolUse` hook enforces (deterministic) |
| Decisions | Asked once, never re-asked | Frontmatter in plan file | Same |
| Translation pipeline | Single command per locale add | MCP platform tools | `/localize add-locale` shortcut |
| Drift detection | Catalog/source mismatches surface automatically | Available via agent on demand | `Stop` hook runs check after every edit |

---

## 12. Big-picture decisions — locked

These are the commitments downstream plans MUST honor:

1. **Hybrid (Option 4) is the architecture.** Universal core; Claude polish layer.
2. **`.globalize/PLAN.md` is the canonical state artifact.** Single file; committable; markdown + frontmatter.
3. **Detection is agent-side; results cached in plan with a fingerprint.**
4. **MCP server scope = plan CRUD + platform API. No filesystem access.**
5. **Sub-skills are pure workers.** They read decisions from the plan; they do not prompt for things already decided. Their only side-effect on plan state is marking their section's checkboxes.
6. **Mode is journey-level (`auto` / `guided`), set once, sticky.** Per-step user override always allowed.
7. **One front door: the `localize` orchestrator skill** (universal) and `/localize` slash command (Claude). `i18n-guide` collapses into it.
8. **Passive coding rules continue to use `@import` on Claude.** Cursor uses `.cursorrules`; Codex uses `AGENTS.md`. Adapter wiring is the setup skill's responsibility.
9. **Hooks are Claude-only enforcement and orientation.** They are NOT a substitute for universal mechanisms — they make Claude better, not the universal layer worse.
10. **Eval suite (`evals/run-all.sh`) is the regression gate.** Sub-skill refactor (Plan 4) cannot ship without eval parity vs. main.

---

## 13. Open questions (to resolve in dedicated plans)

- **Plan-file drift cost.** When the user edits config without going through the orchestrator, does fingerprint detection catch it reliably? Needs a manual session test before Plan 4.
- **Sub-skill independence.** Power users may want to invoke `lingui-convert` standalone (no plan, no orchestrator). Plan 4 must decide: hard-require a plan, or graceful fallback to today's behavior?
- **MCP availability outside Claude.** Cursor/Codex users may not run MCP servers by default. Plan-file CRUD must also work as direct file edits — same contract, two access paths. Validate during Plan 1.
- **Hook reliability for passive enforcement.** `PostToolUse` on every JSX edit could produce alert fatigue. Spike during Plan 6 to measure signal/noise.
- **Hook payload schema.** Verify exact JSON shape per event against current Claude Code docs before locking contract.

---

## 14. Implementation sequencing

Six independently-shippable plans, in this order. Each gates on the previous.

| # | Plan | Risk | Dependencies | Ships value alone? |
|---|---|---|---|---|
| 1 | Plan file contract — schema, parser, validator, fingerprint logic | Low (pure addition) | None | No — foundation |
| 2 | MCP plan tools — `plan.get`, `plan.update`, `plan.mark_done` | Low (pure addition) | Plan 1 | Yes — universal agents can use it directly |
| 3 | Orchestrator skill — `skills/localize/` with detection reference, mode handling, next-step rules | Medium | Plan 1 (uses contract); Plan 2 optional | Yes — universal end-to-end works without polish |
| 4 | Sub-skill refactor — strip detection/mode/consent prose, make plan-aware | **High** | Plans 1–3 | Yes (regression-gated by eval) |
| 5 | Claude slash commands — `/localize` plugin shell | Low | Plans 1–3 | Yes — Claude UX polish |
| 6 | Claude hooks — SessionStart, PostToolUse, Stop | Medium (alert fatigue risk) | Plan 1 | Yes — Claude enforcement |

**Eval gate between Plan 3 and Plan 4.** End-to-end orchestrator works on existing sub-skills (with light shimming) before we start cutting prose out of skills the eval depends on.

**Plan 4 is the dangerous one.** It rewrites every existing setup/convert skill. Should be split per-library (lingui first, then next-intl, then vue) with eval pass required between each.

---

## 15. What's NOT in scope for this initiative

Explicitly deferred — not "won't do," just "not part of this restructure":

- Adding new framework support (Astro, Remix, SvelteKit, etc.). Eval finding lists where pointers should improve, but no new setup/convert skills here.
- New i18n libraries beyond lingui, next-intl, vue-i18n.
- Translation-quality features (glossary enforcement, style-guide review).
- IDE-integration beyond Claude Code (e.g., VS Code extension).
- Multi-repo / monorepo orchestration. Plan file is per-project.

---

*Next step: write Plan 1 (Plan file contract). All subsequent plans inherit decisions locked in §12.*
