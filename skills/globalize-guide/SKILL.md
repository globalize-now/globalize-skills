---
name: globalize-guide
description: >-
  Drive the full internationalization journey for a project — detect the stack,
  recommend a library, set up the chosen library, wrap existing strings, and
  connect a translation platform (Globalize.now, default-on). Use when the user asks to add or
  configure i18n, internationalization, localization, multi-language support,
  or translations — including when they explicitly mention LinguiJS, Lingui,
  next-intl, "wrap strings", "find hardcoded text", "make my app translatable",
  or "set up translations". Triggers on generic phrasings like "add i18n",
  "internationalize my app", "add translations", "multi-language support",
  "localize my app", and on library-specific phrasings like "set up Lingui",
  "set up next-intl", "use Lingui in this project". Also triggers for browser
  extensions — "localize my Chrome extension", "translate my extension",
  "add _locales", "chrome.i18n", "translate my extension's store listing" —
  for WXT, CRXJS, plain Vite and build-less MV3 extensions alike. Does not trigger for
  unrelated CSS-only RTL questions (those use css-i18n) or for managing an
  already-set-up Globalize.now project (those use globalize-now-cli-use).
---

# i18n Orchestrator

## Start here

This file is the map. The detailed instructions for every step live in `references/` and are loaded **on demand**. You will not find library setup code in this file — do not write any from memory.

### Phase map

| Stage | Goal | Load before acting |
|---|---|---|
| 1 — Inspect and decide | Detect stack, ask all questions, write the plan | `references/orchestrator/inspect.md` + `detect.<language>.md`, then `compat.<language>.md`, `library-choice.md`, `setup-choices.md` |
| 1.5 — Globalize account | Sign in, via the `globalize-now-account-setup` skill | — |
| 2 — Setup | Install + configure the library | `references/orchestrator/setup-subagent.md` + every `references.setup` and `references.rulesTemplate` path |
| 3 — Convert | Wrap strings, convert formatting, extract + compile | `references/orchestrator/wrap-subagent.md`, `verify-subagent.md`, `cleanup-loop.md` + every `references.convert` path |
| 4 — Globalize project | Push the setup, create or reuse the project, connect the repo, start the first translation — via `globalize-now-project-setup` | `references/orchestrator/globalize-inputs.md` |

Stages 1.5 and 4 run only when Globalize stays in scope (default-on; §1.6). Account sign-in needs no project data, so it runs **upfront**; project + repo setup needs the converted catalog paths, so it runs at the **end** — and ends by starting the first translation.

### How to load references

1. **Orchestrator procedure files** live in `references/orchestrator/` and are named in the phase map and in each section below.
2. **Stack-specific files come from `manifest.json`.** Its `stacks[]` entries each carry `match` (the §1.3 predicate), `packages` (`runtime` / `dev`, pinned) and `references`: `setup` (array, read in order), `convert` (array, read in order), `rulesTemplate`, optional `optional.*`. All paths are relative to this skill's directory. After §1.11, read `.globalize/manifest-snapshot.json` (the frozen chosen entry) instead of the live manifest.
3. **Read before you edit.** Every reference a step names is read **in full, before the first project file is edited for that step**. If a tool truncates or pages output, keep reading by offset / line range until the end of the file — never act on a partial file. Ordering and ownership rules for multi-file arrays: `references/orchestrator/reading-references.md`.

### Execution mode

**Default — subagents.** The orchestrator asks the Phase 1 questions, writes the plan, dispatches workers, polls, and surfaces results; all project-file edits, build commands and reference reading for Phases 2–3 happen inside workers. Phase 1.1 inspect runs as a foreground subagent; Phase 2 setup, Phase 3 wrap (all partitions in **one** tool-use message, so they run in parallel) and verify run in the background, and the orchestrator polls `.globalize/progress/*.json`. Each worker's full prompt is its `references/orchestrator/*-subagent.md` / `inspect.md` file — pass the worker that file's path plus the paths it lists, not a paraphrase.

**Single-agent fallback.** Use it when there is no subagent/Agent tool, a dispatch fails, or the harness is headless / non-interactive. Then the main agent does each worker's job itself, **in the same order**, and:

- **First reads the worker's file** (`inspect.md`, `setup-subagent.md`, `wrap-subagent.md`, `verify-subagent.md`, `cleanup-loop.md`) **and every reference that file tells the worker to read** — exactly as the worker would. No project file is edited before that reading is done.
- Processes Phase 3 partitions one after another instead of in parallel.
- Still writes `.globalize/progress/*.json` (resumability depends on it); skips polling.
- Treats a worker's `needs_decision` as its own: ask the user; if no user can answer (headless), **stop and report the question** — never improvise past it.
- Headless: Phase 1 answers come from the user's prompt. A question it leaves open takes the default this file or the reference names (pre-checked, "recommended", "unguided default"); with no named default — e.g. the Lingui + Vite version gate — stop and report.

The Globalize stages (1.5, 4) are never subagents in either mode: they delegate to the `globalize-now-account-setup` / `globalize-now-project-setup` skills via the Skill tool, and the orchestrator never inlines Globalize CLI commands.

**When the Skill tool can't load a sibling skill, read it from disk — never ask the user to reinstall.** A skill installed during this session is on disk but not yet registered with the Skill tool. Read the first of these that exists, in full: `.claude/skills/<name>/SKILL.md`, `.agents/skills/<name>/SKILL.md` (both in the project root), or `<name>/SKILL.md` beside this skill's own directory. Then follow it on the main thread exactly as if the Skill tool had loaded it — same inputs, same steps. Only when none of those files exists, say which skill is missing and give the install command: `npx skills add globalize-now/globalize-skills --skill '*' -a claude-code -a universal -y`.

### Rules that hold in every phase

- No library setup or wrapping from memory — only from the manifest's references and `.agents/globalize-rules.md`.
- Never install with `--legacy-peer-deps` or `--force`. A peer conflict is a version gate: pick a compatible version the references name, or stop and ask.
- A step the references do not cover → `needs_decision`, not a guess.
- A passing build is not the finish line — every verify gate in `verify-subagent.md` for the stack must pass.

---

## Workspace: `.globalize/`

Created in the **target project root**. Every artifact the orchestrator and workers share lives here:

```
.globalize/
  detection.json              # Phase 1.1 output
  decisions.md                # frozen user choices from Phase 1
  plan.md                     # executable plan for phases 1.5/2/3/4
  manifest-snapshot.json      # frozen copy of the chosen manifest entry
  rules-values.json           # resolved template values (Phase 2 generate_coding_rules)
  format-module.json          # formatters module record (Phase 2 generate_format_helpers)
  globalize-inputs.json       # Globalize project inputs (Phase 4)
  progress/
    setup.json, wrap-1.json…wrap-N.json, verify.json, wrap-cleanup-{round}.json
    archive/<ISO-timestamp>/  # archived after each phase completes
```

**First run.** If `.globalize/` is absent, create it and append `/.globalize/` to the project's `.gitignore` (create the file if missing; if it already has rules, show the diff first). Tell the user: "Created `.globalize/` in your project root and added it to `.gitignore`. It holds local progress files, decisions, and plans so we can resume mid-run and you can audit what was decided. It stays out of git." The project's **own** generated i18n artifacts (compiled catalogs) are ignored later by Phase 2's `gitignore_artifacts` step, never here.

**Resume.** If `.globalize/` exists, read `plan.md` and `progress/*.json`. If a plan is in flight: "Found an in-progress i18n setup at `.globalize/`. Last completed step: `<step>`. Want me to resume from there, or start over with a fresh plan?" Globalize auth lives in `~/.globalize/config.json` / `GLOBALIZE_API_KEY`, never in `.globalize/` — on resume, just re-delegate; both Globalize skills are idempotent (the account skill self-skips when `auth status` is valid; in orchestrated mode the project skill reuses the organisation's project when it is the only one, and a repository already connected to it). That is why Phase 4 has no progress file.

---

## Phase 1 — Inspect and Decide

Phase 1 ends with a fully populated `.globalize/` and the user's "go" before any work happens. **Every decision lives in Phase 1**; later phases execute.

> **Kickoff message:** "Hey — I'll walk you through internationalizing this project: inspect the stack, sign in to Globalize, set up the library, wrap your hardcoded strings, and finally create your Globalize project, connect the repo and start the first translation. First a read-only scan — framework, router, existing i18n setup, files with translatable text. No changes yet. Then a few questions to shape the plan (including whether to connect Globalize — on by default, you can opt out)."

### 1.1 Inspect

Dispatch the inspect worker (foreground) with `references/orchestrator/inspect.md` as its instructions — or, single-agent, read that file and the matching `detect.<language>.md` and do it yourself. Output: `.globalize/detection.json`, nothing else. Then surface the scan-done message from the end of `inspect.md`.

### 1.2 Compatibility hard-stops

Read `detection.json`. **Signal stops first** (independent of `language`):

| Condition | Stop message |
|---|---|
| `react-native` in `package.json` AND an `android/` folder present | "This is a React Native app. React Native localizes through JS i18n libraries (i18next, react-intl, Lingui), not native Android string resources. Native `android-strings` support targets native Kotlin/Java apps. Use the JS path, or wait for RN support." |
| `pubspec.yaml` present (Flutter) | "This is a Flutter app. Flutter localizes via `.arb` files and `gen_l10n`, not native Android `strings.xml`. Flutter support isn't available yet." |

Then read the language's file — `references/orchestrator/compat.js-ts.md`, `compat.ruby.md`, `compat.android.md` or `compat.swift.md` — and apply its rows top-to-bottom. Prefix every stop with `Compatibility check — found a blocker:`. A STOP ends the run before §1.3. Rows marked **Decision** (e.g. the Lingui + Vite ≥ 6.3 gate) are asked, and their answer is recorded in `decisions.md` before the plan is written.

### 1.3 Resolve supported stacks from manifest

Filter `manifest.json` `stacks[]` to the entries whose `match` is satisfied by `detection`. The result is the §1.5 choice set.

- **Structural keys** — every `match` key except `library` (`framework`, `router`, `compiler`, `platform`, `buildSystem`, `uiFramework`, …) — must equal the same-named `detection` field.
- **`language`**: present → must equal `detection.language`; **absent → treated as `"js-ts"`**. This keeps the JS, Ruby, Android and Swift entry sets disjoint.
- **`library`** is not a predicate. It names the option an entry offers and is never compared to `detection.existing.library` (which only drives §1.2 stops and the already-configured handling). Two entries can share structural keys and differ only in `library` — e.g. Next App Router yields {lingui, next-intl}.

Empty result → STOP: "Your stack is supported in principle but no manifest entry currently matches. Detected: {summary}. File an issue or pick a different setup." Worked examples: `references/orchestrator/matcher-traces.md`.

### 1.4 Branch recommendation

If `git.isRepo` AND `git.branch` ∈ {`main`, `master`, `develop`}: "You're on `{branch}`. Setup will modify several files, so I'd recommend a dedicated branch (`git checkout -b chore/i18n-setup`). Want me to create it when Phase 2 starts, stay on `{branch}`, or use a different name? (No git commands run yet.)" Record in `decisions`. No git repo → skip silently.

### 1.5 Library choice

Read `references/orchestrator/library-choice.md` (recommendation table + confirmation wording). "Picking the i18n library. Based on **{framework}** + **{router}**, my recommendation is **{library}** — {rationale}. You can override." Multiple variants → AskUserQuestion; one → confirm. State `supportLevel: "experimental"` when it applies. After the choice, apply any `compat.<language>.md` rows that depend on it (Pages Router + Lingui stop; Lingui + Vite version gate).

### 1.6 Journey scope

"Which parts do you want to run? I've pre-checked the ones that make sense given what's already in the project. Connecting **Globalize.now** is included by default — uncheck it to skip the platform." AskUserQuestion, multi-select (setup / convert / connect translation platform), defaults:

- setup — when `existing.configured === false`
- convert — when (`existing.stringsWrapped !== "yes"` AND `candidateFiles.length > 0`) **or** `formatCandidateFiles.length > 0` (wrapped strings say nothing about hand-rolled prices and dates)
- connect — **always pre-checked**; only an explicit uncheck skips 1.5 and 4

Record `decisions.scope` (`scope.globalize` is `true` unless unchecked).

### 1.7 Setup choices

If setup is in scope: "A few setup details — locales drive which catalog folders we scaffold, routing decides how the locale shows up in URLs, and setup mode is how chatty I am during Phase 2." Read `references/orchestrator/setup-choices.md` and collect: setup mode (guided / unguided), source locale, target locales, routing strategy (with its stack-specific skips), and the stack-specific extras it lists (Paraglide catalog format, Angular project, extension locale source). Record under `decisions.setup`.

### 1.8 Convert choices

If convert is in scope: "What's this app about? One sentence is fine — it goes to the wrapping workers so their translator comments have the right context." Infer a default from `package.json` description / README / route names. Record `decisions.appDomain`. (On Paraglide ICU-JSON it informs key naming only — that format has no comment field.)

### 1.9 Globalize-now choices

If connect is in scope: project name (default: repo name from `package.json`) and repo provider (auto-detect from `git.remote`; confirm).

### 1.10 Optional steps

"Optional add-ons — none required. Not optional: I always generate a coding-rules file for this setup (`.agents/globalize-rules.md`) and point `CLAUDE.md` and `AGENTS.md` at it — conversion wraps strings against it, and it keeps future edits from re-introducing hardcoded strings."

Multi-select: ESLint plugin, CI/CD integration (extract+compile in build), test setup wrapper. Angular instead: CI extraction check. Browser extensions instead: `web-ext lint` in CI (catches a missing `default_locale`, `messages.json` or empty message — not a dangling `__MSG_` reference, which the verify worker's manifest-wiring check owns), a store-listing locale checklist, and (Lingui variant) CI extract+compile including the `_locales` bridge.

**`generate_format_helpers` → `generate_coding_rules` → `install_coding_rules` are core Phase 2 steps, never options, in that order:** the formatters module and `.globalize/format-module.json` must exist before the rules render (it fails closed without them), and the rules must exist before Phase 3 wraps against them. `install_coding_rules` edits `CLAUDE.md` / `AGENTS.md` (creating either if absent); guided mode confirms each edit.

### 1.11 Write `plan.md`, `decisions.md`, `manifest-snapshot.json`

"Got everything I need. Writing your plan to `.globalize/plan.md` and your choices to `.globalize/decisions.md` so this run is auditable and resumable." Formats: `references/orchestrator/plan-format.md`. Copy the chosen manifest entry verbatim to `manifest-snapshot.json`.

### 1.12 Final go

Show `plan.md` as a checklist: "Here's the plan. Ready to execute? (**yes** / **cancel** / **edit**) Once you say yes, I won't pause for more questions unless a worker gets stuck or a phase finishes." Cancel writes nothing further; edit re-enters the relevant 1.x step; yes → Phase 1.5 (Globalize in scope) or Phase 2.

---

## Phase 1.5 — Globalize account (upfront, interactive)

Gate: `decisions.scope.globalize === true`; otherwise skip 1.5 **and** 4.

"Before we touch your code, let's get you signed in to Globalize so it's ready when your catalogs are done. A browser window may open for device-flow sign-in. (Near the very end, when we connect your repo, you'll do one quick browser approval for Globalize's GitHub/GitLab app — I'll remind you.)"

Invoke the **`globalize-now-account-setup`** skill (Skill tool, main thread). It installs, signs in (self-skips if `auth status` is valid) and verifies. Record the org under `decisions.md` → `## Globalize-now` → `Authenticated org`; mark `delegate_account_setup` done. Skill tool can't load it → read it from disk (Execution mode). User cancels sign-in → continue to Phase 2; §4.3 re-offers it.

---

## Phase 2 — Setup

One setup worker. The orchestrator installs packages on the main thread first (lockfile stays in sync), then dispatches.

> **Start message:** "Starting Phase 2 — setup. I'll install the i18n packages on my main thread, then one worker wires the build config and provider, scaffolds catalogs for your locales, generates the coding rules, and verifies with a typecheck and build. If it hits something it can't decide, it'll pause and ask." Other stacks' wording (Rails, Android, Swift, Angular): `references/orchestrator/messages.md`.

### 2.0 Install packages (main thread)

1. **`upgrade_vite` first**, only when `decisions.setup.viteUpgrade` is set (`compat.js-ts.md` → Lingui + Vite version gate): `npm install -D 'vite@^6'` (plus the React plugin bump that gate names, if needed), then run the project's build — it must pass before anything else is installed.
2. Install `manifest-snapshot.packages.runtime` and `.dev` with the detected package manager — `npm install` / `yarn add` / `pnpm add` / `bun add`, dev with `-D`. **Single-quote every pinned spec** (`'@lingui/core@^6'`) — zsh `EXTENDED_GLOB` eats an unquoted `^`. Runtime packages go to `dependencies`, dev packages to `devDependencies`; never move one.
3. **Never `--legacy-peer-deps` / `--force`.** An `ERESOLVE` is a version gate the plan missed: stop and surface it — do not retry with a flag.
4. Lingui v6 needs **Node ≥ 22.19 or ≥ 24** (ESM-only). Check `node -v` / `.nvmrc` / `engines` first; older → tell the user and pause.

Both lists are empty by design for Rails (gems install inside the worker, `bundle install`), Android and Swift (platform built-ins) — 2.0 is a no-op there, not an error. **Angular** runs `ng_add_localize` here instead: `npx ng add '@angular/localize@^<major>' --skip-confirmation --use-at-runtime --project <decisions.setup.angularProject>` (`<major>` = detection `version` major; `pnpm exec` / `yarn` / `bunx` for other managers). Install failure → stop the run with the error.

### 2.1 Pre-create `progress/setup.json`

`{ "subagentId": "setup", "phase": 2, "status": "pending", "plan": [...steps from plan.md...], "completed": [], "current": null, "startedAt": null, "updatedAt": "<now>" }` — full schema in `plan-format.md`.

### 2.2 Run the setup worker

Dispatch in the background with `references/orchestrator/setup-subagent.md` as the prompt (or, single-agent, follow it yourself). It reads `references.setup`, `references.rulesTemplate`, and the `.globalize/` inputs **before editing anything**. Already-configured projects (`existing.configured === true`) and the Paraglide ICU-JSON → PO migration use the reduced plans in `references/orchestrator/setup-collapse.md`.

### 2.3 Poll

Every 30–60 s read `progress/setup.json`, update one todo per `plan` step, surface `currentDetail`.

### 2.4 On completion

- `succeeded` → archive to `progress/archive/<timestamp>/`, summarize files created / modified / verification. "Setup verified — {stack's verification summary, from `messages.md`}. Files created: {N}, modified: {M}. Moving on to Phase 3."
- `failed` → archive, show the error: "Setup hit an error during `{step}`: {summary}. Want me to retry, edit the plan, or stop here?"
- `needs_decision` → ask, append the answer to `decisions.md`, re-dispatch (it resumes from `completed`). "The setup worker paused — it needs you to decide on `{question}`."

---

## Phase 3 — Convert

Parallel wrap workers, then one verify worker.

> **Start message:** "Starting Phase 3 — converting hardcoded strings and hand-rolled formatting. I'm splitting **{file count}** files across **{N}** workers; each wraps user-visible strings with the right macro, adds translator comments where context isn't obvious, and routes hand-rolled prices, numbers and dates through the formatters module. Then a verify worker extracts, compiles, builds, and runs a recall scan that catches anything missed." `{file count}` is the size of the union in §3.1. Other stacks' verify wording: `messages.md`.

### 3.1 Partition

Partition the **union** of `candidateFiles` and `formatCandidateFiles` — neither contains the other — and tag each file: `strings` (in `candidateFiles` only), `formatting` (in `formatCandidateFiles` only — do not hunt for strings), `both` (wrap first, then format). Never split one file across two workers. **Angular:** a component's `.html` and its sibling `.ts` go in the same partition (add the missing sibling, tagged `strings`). Write each `<path> — <tag>` into `plan.md` and pre-create `progress/wrap-N.json` plus `progress/verify.json` (`status: "pending"`).

### 3.2 Run the wrap workers

Each partition gets `references/orchestrator/wrap-subagent.md` as its prompt, with its file list and `decisions.appDomain`. All in **a single tool-use message** (parallel). Single-agent: one partition at a time, after reading `.agents/globalize-rules.md` and every `references.convert` file. Workers never run extract or compile.

### 3.3 Poll / 3.4 wait

Every 30–60 s read all `wrap-N.json` ("wrap-1: 3/8 files, wrap-2: 4/4 ✓"). `needs_decision` → ask and re-dispatch as in Phase 2. `failed` → surface it; verify still runs over what succeeded unless the failure is catastrophic.

### 3.5 Run the verify worker

Dispatch `references/orchestrator/verify-subagent.md`. Its steps are library-specific (extract/compile/build, catalog-integrity gates, recall self-check, format-violation scan on every language) and it writes `result` into `progress/verify.json`.

#### 3.5.1 Cleanup loop

On `status: "needs_cleanup"`, follow `references/orchestrator/cleanup-loop.md`: up to 2 `wrap-cleanup` rounds over `recallViolations ∪ formatViolations` (JS/TS only), then report any residuals with file + line.

### 3.6 Cost estimate (Phase 3 → 4 bridge)

Parse the source catalog for a word count (`result.catalogPath`: the extracted `.po` on Lingui; the source XLIFF's `<source>` text on Angular; the source YAML on Rails; `res/values/strings.xml` on Android; `_locales/{sourceLocale}/messages.json` on a native extension): "Phase 3 complete. Catalog: **{totalMessages}** messages, ~**{wordCount}** words. Translating into **{N}** target locales (`{targets}`) would cost roughly **~${estimate}** on Globalize.now." Prepend the self-heal summary when `stringsWrappedInCleanup > 0`. When `result.formatViolations` is non-empty, append every entry **with file + line** — never a bare count, never omitted because the catalog gate passed.

Globalize in scope → "Moving on to Phase 4 — pushing this setup, creating your Globalize project, connecting the repo and starting the first translation. You're already signed in, so this is mostly automated (one quick browser approval for the GitHub/GitLab app)." Otherwise → "Skipping the translation-platform step. Re-run `globalize-guide` with `connect translation platform` checked when you're ready."

### Phase 3 collapse-cases

- `stringsWrapped === "yes"` AND `formatCandidateFiles` empty → skip wrap workers; run verify only.
- `stringsWrapped === "yes"` AND `formatCandidateFiles` non-empty → wrap workers over `formatCandidateFiles` alone, all tagged `formatting`.
- `stringsWrapped === "partial"` → `candidateFiles` already excludes wrapped files; `formatCandidateFiles` is partitioned in full.

---

## Phase 4 — Globalize project (connect repo, first translation)

"Phase 4 — connecting Globalize. Globalize reads your catalogs from GitHub/GitLab, so I'll check this setup is pushed, then the project-setup skill creates the project (or reuses your only one), connects the repo, wires the catalog patterns and starts the first translation — delivered as a pull request. One quick browser approval authorizes Globalize's GitHub/GitLab app."

### 4.1 Assemble `.globalize/globalize-inputs.json`

Follow `references/orchestrator/globalize-inputs.md` (per-library `localePathPattern` + `fileFormat`, `pathLocales` for native extensions). Mark `assemble_globalize_inputs` done.

### 4.2 Push the setup

Globalize translates the branch **on the remote**, never this working copy: until the converted catalogs are pushed, the first translation finds nothing to translate. Skip this step (and the first translation) when the remote is neither GitHub nor GitLab — the project skill won't connect a repository then.

1. Read `git branch --show-current`, `git status --porcelain` and `git log @{u}..HEAD --oneline` (fails when the branch has no upstream — that counts as unpushed).
2. Nothing uncommitted and nothing unpushed → this branch is already on the remote.
3. Otherwise ask, listing `git status --short`: "Globalize reads your catalogs from `{remote}`, not from this machine, so the first translation needs this setup pushed. Commit these files and push `{branch}` now? (**yes** / **I'll push it myself** / **skip the first translation**)". **yes** → `git add -A`, `git commit -m "chore(i18n): set up {library}"`, `git push -u origin {branch}`; a failed push is shown verbatim and the question asked again. **I'll push it myself** → wait, then re-check from 1. **skip** → no first translation. Headless: never commit or push — skip and report it.

Write `firstTranslationBranch` into `globalize-inputs.json`: the pushed branch, or `null` when skipped. Mark `push_setup` done.

### 4.3 Re-check auth

Delegate a quick `auth status` check; not authenticated → invoke `globalize-now-account-setup` first.

### 4.4 Delegate to `globalize-now-project-setup` (main thread)

Invoke it via the Skill tool (from disk if the Skill tool can't load it — Execution mode): "Orchestrated mode. Read `.globalize/globalize-inputs.json` for all inputs; skip detection and the Setup Mode prompt; run unguided. Connect the git provider (one browser approval if the GitHub App / GitLab OAuth isn't installed yet), reuse the organisation's project if it is the only one or create one, connect the repo, set the catalog patterns from the supplied `localePathPattern` + `fileFormat`, and start the first translation of `firstTranslationBranch` as a pull request." The skill owns the whole CLI surface. Mark `delegate_project_setup` done, and `start_first_translation` once its summary reports the translation started.

### 4.5 Finish

Translation started → "All set. Project: **{projectUrl}**. Repo connected, catalog patterns wired, and the first translation of `{branch}` has started — Globalize opens a pull request with the translated catalogs when it's done; merge it to ship them. From here on, use the `globalize-now-cli-use` skill (or the `globalize` CLI) for ongoing translation work — tracking status, requesting new languages."

Not started → the same, but say plainly why ("Skipped — no GitHub or GitLab remote", "Skipped — not pushed", or the refusal the project skill reported) and that the `globalize-now-cli-use` skill can start it once that is fixed.

---

## Edge cases

- **Multiple frameworks** (e.g. `next` and `vite`): Next.js wins (§1.5 first row).
- **Monorepo**: use the `package.json` closest to the working directory; never aggregate deps across workspace packages.
- **Override to an unsupported library**: show the supported list and ask the user to pick from it.
- **`decisions.md` hand-edited between runs**: re-validate against `manifest-snapshot.json` before re-dispatching — fail loudly if invalid.
