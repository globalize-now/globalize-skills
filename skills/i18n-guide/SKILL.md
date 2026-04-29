---
name: i18n-guide
description: >-
  Drive the full internationalization journey for a project — detect the stack,
  recommend a library, set up the chosen library, wrap existing strings, and
  optionally connect a translation platform. Use when the user asks to add or
  configure i18n, internationalization, localization, multi-language support,
  or translations — including when they explicitly mention LinguiJS, Lingui,
  next-intl, "wrap strings", "find hardcoded text", "make my app translatable",
  or "set up translations". Triggers on generic phrasings like "add i18n",
  "internationalize my app", "add translations", "multi-language support",
  "localize my app", and on library-specific phrasings like "set up Lingui",
  "set up next-intl", "use Lingui in this project". Does not trigger for
  unrelated CSS-only RTL questions (those use css-i18n) or for managing an
  already-set-up Globalize.now project (those use globalize-now-cli-use).
---

# i18n Orchestrator

This skill drives the full i18n journey through four phases:

| Phase | Goal |
|---|---|
| 1 — Inspect & decide | Detect stack, ask all user questions, generate an executable plan |
| 2 — Setup | Install + configure the chosen library |
| 3 — Convert | Wrap hardcoded strings, extract + compile catalogs |
| 4 — Globalize-now (optional) | Connect a translation platform |

The orchestrator (this SKILL.md) is library-agnostic. Library- and stack-specific guidance lives in `references/` and is loaded by subagents at dispatch time, driven by `manifest.json`.

**Architectural rule:** the orchestrator never executes work directly. It asks Phase 1 questions, generates the plan, dispatches subagents in the background, polls a shared progress workspace at `.globalize/`, and surfaces results. All file modifications, all bash commands, and all reference reading happen inside subagents.

---

## Workspace: `.globalize/`

Created in the **target project root** (the project being internationalized). Every artifact the orchestrator and subagents share lives here.

```
.globalize/
  detection.json              # output of inspect subagent (Phase 1.1)
  decisions.md                # frozen user choices from Phase 1
  plan.md                     # executable plan for phases 2/3/4
  manifest-snapshot.json      # frozen copy of the chosen manifest entry
  progress/
    setup.json                # Phase 2 setup subagent
    wrap-1.json…wrap-N.json   # Phase 3 wrap subagents (one per partition)
    verify.json               # Phase 3 verify subagent
    globalize.json            # Phase 4 project subagent
    archive/<ISO-timestamp>/  # archived after each phase completes
```

### First-run setup

If `.globalize/` does not exist in the target project, create it and append `/.globalize/` to the project's `.gitignore` (create the file if missing). Confirm with the user only if `.gitignore` exists and already has rules — show the diff before appending.

### Resumability

If `.globalize/` exists when the orchestrator starts, read `plan.md` and `progress/*.json` to determine state. If a plan is already in flight (some phases incomplete), tell the user: "Detected an in-progress i18n setup at `.globalize/`. Resume from <last completed step>, or start fresh?" and proceed accordingly.

---

## Phase 1 — Inspect & Decide

Phase 1 ends with a fully populated `.globalize/` (detection, decisions, plan, manifest snapshot) and the user's "go" before any work happens. Every user prompt this skill ever asks lives in Phase 1 — Phases 2/3/4 are pure execution.

### 1.1 Inspect subagent

Dispatch a subagent (foreground, blocking — small output, no progress polling needed) with this prompt:

> You are inspecting a project to gather i18n setup context. Read-only — do not modify any files.
>
> Read the project's `package.json`, build config files (`vite.config.*`, `next.config.*`, `.babelrc`), and survey the source tree. Output **only** a single JSON object matching this schema, written to `.globalize/detection.json`:
>
> ```json
> {
>   "framework": "next" | "vite" | "tanstack-start" | "nuxt" | "quasar" | "cra" | "unknown",
>   "router": "app" | "pages" | "tanstack-router" | "tanstack-start" | "react-router" | "vue-router" | "none",
>   "compiler": "swc" | "babel",
>   "react": true | false,
>   "vue": true | false,
>   "typescript": true | false,
>   "packageManager": "npm" | "yarn" | "pnpm" | "bun",
>   "sourceDir": "src" | "app" | string,
>   "routeEntries": ["src/app/**/page.tsx", ...] | null,
>   "git": { "isRepo": true | false, "branch": string | null, "remote": string | null },
>   "existing": {
>     "library": "lingui" | "next-intl" | "react-intl" | "i18next" | "react-i18next" | "next-translate" | "typesafe-i18n" | "vue-i18n" | "@nuxtjs/i18n" | "i18next-vue" | "@tolgee/vue" | "fluent-vue" | "none",
>     "configured": true | false,
>     "providerWired": true | false,
>     "catalogsScaffolded": true | false,
>     "stringsWrapped": "yes" | "partial" | "no"
>   },
>   "candidateFiles": [
>     { "path": "src/components/Navbar.tsx", "matchCount": 8 }
>   ],
>   "localeSignals": {
>     "existingLocaleDirs": ["src/locales/en", "src/locales/de"],
>     "envHints": ["DEFAULT_LOCALE=en"],
>     "readmeHints": ["mentions: English, German, French"]
>   }
> }
> ```
>
> **Detection rules:**
>
> | Field | How to detect |
> |---|---|
> | `framework` | `next` in deps → next. `nuxt` in deps → nuxt. `quasar` in deps → quasar. `@tanstack/react-start` in deps → tanstack-start. `vite` in devDeps (and none of the above) → vite. `react-scripts` in deps → cra. |
> | `router` | App Router: `app/` or `src/app/` with `layout.tsx`/`layout.js`. Pages Router: `pages/` with `_app.tsx`/`_app.jsx`. TanStack Start: deps include `@tanstack/react-start`. TanStack Router (client): `@tanstack/react-router` without `react-start`. React Router: `react-router` in deps. Vue Router: `vue-router` in deps (Vite SPA / Quasar). |
> | `compiler` | `@vitejs/plugin-react-swc` → swc. `@vitejs/plugin-react` (no `-swc`) → babel. Next.js → swc unless `.babelrc` exists. TanStack Start → swc if `@vitejs/plugin-react-swc` (or `@vitejs/plugin-react@6+`) is in devDeps; babel otherwise. |
> | `react` | `react` in deps or devDeps. |
> | `vue` | `vue` in deps or devDeps. |
> | `packageManager` | `package-lock.json` → npm. `yarn.lock` → yarn. `pnpm-lock.yaml` → pnpm. `bun.lock` → bun. |
> | `routeEntries` | App Router: `<root>/src/app/**/page.tsx`. TanStack file-based: `<root>/src/routes/**/*.tsx`. React Router v7 framework mode: `<root>/app/routes/**/*.tsx`. None if no file-based routing detected. |
> | `existing.library` | First match in deps/devDeps from the union of i18n libraries listed above. |
> | `existing.configured` | `lingui.config.*` present AND macro plugin wired in build config; OR `next-intl` config present AND plugin wired; OR (Vue) `createI18n(` present in `src/i18n/index.*` (Vite/Quasar) or `defineI18nConfig(` in `i18n.config.*` (Nuxt) AND `messageCompiler` wired. |
> | `existing.providerWired` | Layout/main file imports and renders `I18nProvider` (Lingui) or `NextIntlClientProvider` (next-intl); OR (Vue) `app.use(i18n)` in `main.*` (Vite) / boot file registered (Quasar) / `@nuxtjs/i18n` listed in `modules` (Nuxt). |
> | `existing.catalogsScaffolded` | Locale directories with at least one message file exist. |
> | `existing.stringsWrapped` | Glob source tree, sample up to 50 files, count files with bare JSX text vs. files importing macros: > 80% imported → "yes", > 20% → "partial", else → "no". |
> | `candidateFiles` | Glob `src/**/*.{tsx,ts,jsx,js}`, exclude tests/configs/`.d.ts`, grep each for: bare JSX text (`>Word<`), user-visible attrs (`placeholder=`, `aria-label=`, `title=`, `alt=`), exported user-facing string literals. Return files with ≥1 match, sorted by match count desc. |
> | `localeSignals` | List existing locale dirs (e.g., `src/locales/`), env vars matching `*LOCALE*`, README mentions of language names. |
>
> Write the JSON file and exit. Do not engage in conversation.

### 1.2 Apply compatibility hard-stops

Read `detection.json`. Apply these rules top-to-bottom. If any matches, **STOP** the orchestrator with the corresponding message — do not proceed to 1.3.

| Condition | Stop message |
|---|---|
| `react === false` AND `vue === false` | "i18n-guide currently supports React-based and Vue-based projects only. This project uses {framework}. No supported library available." |
| `framework === "cra"` | "Create React App is no longer supported by this skill. Migrate to Vite or Next.js, then re-run." |
| `existing.library` is one of `react-intl`, `i18next`, `react-i18next`, `next-translate`, `typesafe-i18n`, `i18next-vue`, `@tolgee/vue`, `fluent-vue` | "This project already uses {library}. Migrating between i18n libraries is out of scope for this skill. Either continue with {library} (use its native tooling), or remove it first and re-run." |
| `framework === "next"` AND `router === "pages"` AND user wants Lingui | (Surface only after library choice in 1.5) "Lingui setup does not currently cover the Next.js Pages Router. Use next-intl on Pages Router, or migrate to App Router." |
| Custom build pipeline (no `vite.config`, `next.config`, `nuxt.config`, `quasar.config`, or `react-scripts`) | "This project uses an unsupported build pipeline. Lingui requires SWC or Babel; next-intl requires Next.js; vue-i18n requires Vite, Nuxt, or Quasar." |

### 1.3 Resolve supported stacks from manifest

Read `manifest.json`. Filter `stacks[]` entries whose `match` predicate is satisfied by `detection`. The result is the set of `(library, variant)` options the user can choose from in 1.5.

If the filtered list is empty, surface a STOP with: "Your stack is supported in principle but no manifest entry currently matches. Detected: {summary}. File an issue or pick a different setup."

### 1.4 Branch recommendation

If `git.isRepo === true` AND `git.branch` is one of `main`, `master`, `develop`:

> You're on `{branch}`. This setup will modify several files. I'd recommend creating a dedicated branch first so you can review or revert the changes easily:
> ```
> git checkout -b chore/i18n-setup
> ```
> Want me to create this branch as part of Phase 2, stay on `{branch}`, or use a different name?

Record the answer in `decisions`.

### 1.5 Library choice

Show the user the list of supported variants from 1.3, with the recommendation marked. Recommendation rules (apply first match):

| Detection | Recommendation | Rationale |
|---|---|---|
| `framework === "next"` | **next-intl** | Purpose-built for Next.js; first-class App Router (RSC + middleware) and Pages Router support. Uses ICU MessageFormat. No compile step. |
| `framework === "next"` AND user wants compile-time extraction | **Lingui** (alternative) | Compile-time macros, zero-runtime-overhead translations. |
| `framework === "nuxt"` | **vue-i18n via @nuxtjs/i18n** | The Nuxt module wraps vue-i18n with SSR-aware routing, lazy-loaded locale catalogs, and locale meta via `useLocaleHead`. The canonical Nuxt choice. |
| `framework === "quasar"` OR (`vue === true` AND `framework === "vite"`) | **vue-i18n** | The official Intlify library and de-facto standard across Vue 3 projects. Composition API + ICU via custom `messageCompiler`. |
| anything else (vite + react, tanstack-start, etc.) | **Lingui** | The only library with reference support for non-Next.js React stacks today. |

Use AskUserQuestion if multiple variants apply. If only one variant matches, surface the choice as confirmation rather than a multi-option prompt.

### 1.6 Journey scope

Ask which phases to run. Defaults derived from `existing`:

- If `existing.configured === false` → setup is suggested
- If `existing.stringsWrapped !== "yes"` AND `candidateFiles.length > 0` → convert is suggested
- Globalize-now is opt-in only; default unchecked

Use AskUserQuestion with three multi-select options (setup / convert / connect translation platform) and the inferred defaults pre-checked.

### 1.7 Setup choices

If `setup` is in scope, collect:

- **Setup mode** — guided (per-step explanations, consent gates on file modifications) vs. unguided (run end-to-end, summarize at end)
- **Source locale** — default to `localeSignals` first existing or `en`
- **Target locales** — multi-input. Suggest from `localeSignals.existingLocaleDirs` and README hints
- **Routing strategy** — only if file-based routing is detected; ask: prefix-based (`/en/...`) or domain-based or none

Record under `decisions.setup`.

### 1.8 Convert choices

If `convert` is in scope, ask the user to confirm the **app domain**. Infer from `package.json` description, README, route names, or component names. Default suggestion + freeform override.

The domain string flows into wrap-subagent prompts so they write better translator comments.

### 1.9 Globalize-now choices

If `connect translation platform` is in scope, collect:

- **Project name** — default = repo name (from `package.json`).
- **Repo provider** — auto-detect from `git.remote` (github.com → GitHub, gitlab.com → GitLab); confirm.

### 1.10 Optional steps

Multi-select for setup-time optionals: ESLint plugin, CI/CD integration (extract+compile in build), test setup wrapper, install passive coding rules (`@import` line in target `CLAUDE.md`).

### 1.11 Generate `plan.md` + `manifest-snapshot.json` + `decisions.md`

Write the three artifacts to `.globalize/`. See "Plan and decisions formats" below for shape.

Copy the chosen manifest entry verbatim to `.globalize/manifest-snapshot.json` so subsequent runs and subagents read a stable snapshot, not the live manifest.

### 1.12 Render plan + final go

Show `plan.md` to the user as a checklist. Ask: "Ready to execute? (yes / cancel / edit)". Cancel writes nothing further. Edit re-enters the relevant 1.x step. Yes proceeds to Phase 2.

---

## Phase 2 — Setup

Single setup subagent. Orchestrator pre-creates the progress file and dispatches in the background.

### 2.1 Pre-create progress file

```json
{
  "subagentId": "setup", "phase": 2, "status": "pending",
  "plan": [...steps from plan.md...],
  "completed": [], "current": null,
  "startedAt": null, "updatedAt": "<now>"
}
```

### 2.2 Dispatch setup subagent (background)

Subagent prompt skeleton:

> You are executing Phase 2 (Setup) of an i18n journey. Read `.globalize/decisions.md`, `.globalize/detection.json`, `.globalize/plan.md`, and `.globalize/manifest-snapshot.json` for full context.
>
> Your plan steps are listed in `.globalize/progress/setup.json` under `plan`. Execute them in order.
>
> Read these reference files for variant-specific instructions:
> - {paths from manifest-snapshot.references.setup, joined}
> - Coding rules to install (if applicable): {manifest-snapshot.references.code joined}
>
> **Progress reporting:** After each step transition, atomically update `.globalize/progress/setup.json` (write `<file>.tmp` then `mv`). Set `status: "running"` on first update; populate `completed`, `current`, `currentDetail`, `filesCreated`, `filesModified`, `updatedAt`.
>
> **Ambiguity protocol:** If you hit a case the references don't cover (e.g., two layout files, custom config shape), do NOT improvise. Write `status: "needs_decision"` with a `needsDecision: { step, question, options }` object and exit. The orchestrator will ask the user and re-dispatch you.
>
> **Verification:** After all steps, run the project's typecheck (`tsc --noEmit` if TypeScript) and build command. Capture pass/fail in `result.verificationResult`. Set `status: "succeeded"` or `"failed"` accordingly.

### 2.3 Poll progress

While `progress/setup.json` is in `running` state, wake every 30–60 seconds, read the file, update the user-visible todo list (one todo per `plan` step), and surface `currentDetail` as a transient status hint.

### 2.4 On completion

- `succeeded` → archive `progress/setup.json` to `progress/archive/<timestamp>/setup.json`, render summary (files created, files modified, verification result), advance to Phase 3.
- `failed` → archive, render error, ask user how to proceed (retry, edit plan, abort).
- `needs_decision` → surface the question to the user, capture answer, append to `decisions.md`, re-dispatch the same subagent (it reads existing `progress/setup.json` and resumes from `completed`).

### Phase 2 collapse-case

If `existing.configured === true`, `plan.md` reduces Phase 2 to: `verify_config`, `verify_provider`, `add_missing_locale_dirs`, `extract_compile`, `build_verification`. Same dispatch pattern.

---

## Phase 3 — Convert

Multiple wrap subagents in parallel, then one verify subagent.

### 3.1 Pre-create progress files

For each `wrap-N` subagent declared in `plan.md`, write `progress/wrap-N.json` with `status: "pending"` and the planned per-file step list. Write `progress/verify.json` with `status: "pending"` and verify plan.

### 3.2 Dispatch wrap subagents in parallel

Send all wrap subagents in **a single Agent tool message** so they launch in parallel. Each wrap subagent prompt includes:

> You are wrapping hardcoded UI strings with the project's i18n macros. Read `.globalize/decisions.md` and `.globalize/detection.json` for context. App domain: {decisions.appDomain}.
>
> Your assigned files (process in order; layout/shell first, then shared, then pages, then utilities):
> {numbered list from plan.md for this partition}
>
> Read these reference files for macro guidance: {paths from manifest-snapshot.references.convert}.
>
> For each file: identify translatable strings, wrap with the correct macro, add translator comments inline per the rules in the reference. Update `.globalize/progress/wrap-N.json` after each file (atomic write). Do NOT run `extract` or `compile` — that runs once after all wrap subagents complete.
>
> Ambiguity protocol and progress schema as in Phase 2.

### 3.3 Poll all wrap subagents

Wake every 30–60s, read all `wrap-N.json` files, update the user-visible todo list (per-file todos under each subagent group). Surface aggregated progress: "wrap-1: 3/8 files, wrap-2: 2/5 files, wrap-3: 4/4 ✓".

### 3.4 Wait for all wrap subagents to terminate

If any returns `needs_decision`, pause polling, surface to user, re-dispatch as in Phase 2.

If any returns `failed`, surface error. The verify subagent should still run on whatever files were successfully wrapped — don't block extraction on a single partition failure unless catastrophic.

### 3.5 Dispatch verify subagent (background)

> You are verifying the convert phase. Read `.globalize/decisions.md` for catalog format and locales. Read manifest snapshot for library.
>
> Plan steps: extract_clean, compile, build_check, comment_review_pass.
>
> 1. Run `npx lingui extract --clean` (Lingui) or `npx next-intl extract` if applicable. Capture errors. Atomically update `progress/verify.json` after this step.
> 2. Run `npx lingui compile` (with `--typescript` if TS). Capture errors.
> 3. Run the project's typecheck and build command. Capture pass/fail.
> 4. Read the extracted catalog. For entries lacking translator comments where the heuristic in the reference says one should exist (single-/two-word phrases, action labels without object, domain-sensitive terms), edit the source file to add the missing comment.
>
> Write `result` with `{ catalogPath, totalMessages, extractOk, compileOk, buildOk, commentsAdded }`.

### 3.6 Cost estimate (Phase 3 → 4 bridge)

After verify succeeds, parse the extracted catalog to compute word count. Show the user:

> Catalog: {totalMessages} messages, ~{wordCount} words. Translating into {N} target locales costs roughly ~${estimate} via Globalize.now.

If `decisions.scope.globalize === true`, advance to Phase 4. Otherwise, end with a one-line "Run `i18n-guide` again with scope=globalize to set up translation later" hint.

### Phase 3 collapse-cases

- `existing.stringsWrapped === "yes"` → skip wrap subagents; run only verify.
- `existing.stringsWrapped === "partial"` → Phase 1 candidate list already excluded already-wrapped files.

---

## Phase 4 — Globalize-now (optional)

Auth must stay on the main thread (interactive). Project + repo creation runs in a subagent.

### 4.1 Install CLI (main thread)

If `@globalize-now/cli-client` not installed, run `npm install -g @globalize-now/cli-client` (or `npx` form, depending on user preference). Show output.

### 4.2 Authenticate (main thread)

Run `globalize login`. This is interactive — opens browser device flow. Wait for completion.

### 4.3 Verify org (main thread)

Run `globalize org current` (or equivalent). Show org name. Confirm with user.

### 4.4 Pre-create `progress/globalize.json`

Plan: `create_project`, `configure_languages`, `connect_repo`, `configure_patterns`. (Glossaries and styleguide skipped in v1.)

### 4.5 Dispatch project subagent (background)

> You are creating a Globalize.now project and connecting the repository. CLI is installed and authenticated. Read `.globalize/decisions.md` for project name + locales. Read `.globalize/detection.json` for repo identifier (`git.remote` parsed).
>
> Run, in order:
> 1. `globalize project create --name "{name}" --source {sourceLocale} --targets {targetLocales}` — capture project ID and URL.
> 2. `globalize project languages list` — verify all targets accepted.
> 3. `globalize repo connect --provider {gh|gl} --repo {owner/repo}` — wire repo.
> 4. `globalize repo patterns set --source {catalogPath} --output {targetCatalogPattern}` — configure paths from Phase 3 verify result.
>
> Update `progress/globalize.json` after each step. Final `result` includes `{ projectId, projectUrl, repoConnected, patternsConfigured }`.

### 4.6 Poll, surface, finish

Standard polling. On completion, show project URL and a one-line summary.

---

## Plan and decisions formats

### `plan.md`

Markdown with YAML frontmatter for metadata. Body uses strict checklist syntax (`- [ ] step_id`) so the orchestrator can parse it.

Skeleton:
```markdown
---
version: 1
createdAt: <ISO timestamp>
manifestSnapshot: .globalize/manifest-snapshot.json
detection: .globalize/detection.json
decisions: .globalize/decisions.md
---

# i18n Setup Plan

Stack: **{framework + router}** + **{library}** (variant: `{variant-id}`)
Branch: {decision summary}

## Phase 2 — Setup
Subagent: `setup`
Progress: `.globalize/progress/setup.json`
References:
- {paths joined from manifest.references.setup}
- {paths joined from manifest.references.code}

Steps:
- [ ] checkout_branch
- [ ] install_packages
- [ ] create_config
- [ ] build_tool_integration
- [ ] provider_wiring
- [ ] language_switcher
- [ ] scaffold_catalogs
- [ ] extract_compile
- [ ] install_coding_rules
- [ ] {optional steps if opted in}
- [ ] build_verification

## Phase 3 — Convert
Partitions: {N} wrap subagents covering {file count} files

### wrap-1 ({subtree summary})
- [ ] {file path}
- [ ] {file path}
…

### verify
- [ ] extract_clean
- [ ] compile
- [ ] build_check
- [ ] comment_review_pass

## Phase 4 — Globalize-now
Steps:
- [ ] create_project
- [ ] configure_languages
- [ ] connect_repo
- [ ] configure_patterns
```

### `decisions.md`

Markdown with YAML frontmatter, sections per category. Doubles as a project record if committed (note: `.globalize/` is gitignored by default — see Workspace section).

```markdown
---
createdAt: <ISO>
---

# i18n Setup Decisions

## Library
**{library}** (recommended; user accepted | user override)

## Scope
- [x] Setup
- [x] Convert existing strings
- [x] Connect Globalize.now

## Branch
Create new branch: `chore/i18n-setup`

## Setup mode
**Unguided**

## Locales
- Source: `en`
- Targets: `de`, `fr`, `es`

## Routing strategy
Prefix-based

## App domain
{user-confirmed domain}

## Optional setup steps
- [x] ESLint plugin
- [ ] CI/CD integration
- [ ] Test setup wrapper
- [x] Install passive coding rules (@import)

## Globalize-now
- Project name: `{name}`
- Repo provider: GitHub
```

### Progress file schema (per subagent)

```json
{
  "subagentId": "setup",
  "phase": 2,
  "status": "pending|running|succeeded|failed|needs_decision",
  "startedAt": "<ISO>", "updatedAt": "<ISO>",
  "plan": ["step_id_1", "step_id_2"],
  "completed": ["step_id_1"],
  "current": "step_id_2",
  "currentDetail": "modifying vite.config.ts",
  "skipped": [],
  "filesCreated": [],
  "filesModified": [{ "path": "...", "summary": "..." }],
  "errors": [],
  "needsDecision": null,
  "result": null
}
```

---

## Reading the reference files (subagents)

Reference files under `references/languages/.../*.md` walk through their variant's setup or convert work linearly via section headings (e.g., "Packages", "Build Tool Integration", "Provider Setup", "Language Switcher"). Follow them in document order — section headings are the authoritative ordering, not the orchestrator's plan step IDs (those are higher-level phase markers used by the polling loop).

Some references include catalog-format sub-references (e.g., `references/languages/js-ts/libraries/next-intl/po-format.setup.md`). When the user has chosen the alternate format, substitute that reference's snippets in place of the JSON examples — the variant reference itself flags the substitution points.

If a reference's instructions appear to require user input that wasn't collected in Phase 1, do not improvise: write `status: "needs_decision"` to your progress file and exit so the orchestrator can ask.

## Subagent dispatch mechanics

- Use the Agent tool with `run_in_background: true` for all phase subagents (Phase 2 setup, Phase 3 wrap and verify, Phase 4 project). The orchestrator polls progress files instead of waiting on the subagent's terminal output.
- For Phase 1.1 (inspect), foreground (blocking) is fine — the subagent only writes one JSON file and returns.
- All wrap subagents in Phase 3 must be dispatched **in a single tool-use message** to launch in parallel.
- Subagents must use atomic file writes (write `<file>.tmp`, then `mv`) when updating progress files.
- Each subagent reads the same set of inputs from `.globalize/`: it does not need orchestrator-side state passed via prompt beyond pointers to those files.

---

## Edge cases

- **Multiple frameworks detected** (e.g., both `next` and `vite` in deps): Next.js takes precedence — use Rule 1 in 1.5.
- **Monorepo**: Detect from the closest `package.json` to the working directory. Do not aggregate deps across workspace packages.
- **User overrides recommendation** with a library that doesn't match a manifest entry: surface the supported list and ask them to pick one of those.
- **`.globalize/` already exists from a prior run**: see Resumability section above.
- **No `git` repo**: skip 1.4 (branch recommendation) silently.
- **`decisions.md` is hand-edited between runs**: re-validate against `manifest-snapshot.json` before re-dispatching subagents — fail loudly if invalid.
