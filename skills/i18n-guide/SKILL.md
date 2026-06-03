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
| 1 — Inspect and decide | Detect stack, ask all user questions, generate an executable plan |
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

> **User-facing message** (when actually creating the folder):
> "Created `.globalize/` in your project root and added it to `.gitignore`. This folder holds local progress files, decisions, and plans so we can resume mid-run and so you can audit what was decided. It stays out of git."

### Resumability

If `.globalize/` exists when the orchestrator starts, read `plan.md` and `progress/*.json` to determine state. If a plan is already in flight (some phases incomplete), tell the user:

> "Found an in-progress i18n setup at `.globalize/`. Last completed step: `<step>`. Want me to resume from there, or start over with a fresh plan?"

Proceed accordingly.

---

## Phase 1 — Inspect and Decide

Phase 1 ends with a fully populated `.globalize/` (detection, decisions, plan, manifest snapshot) and the user's "go" before any work happens. Every user prompt this skill ever asks lives in Phase 1 — Phases 2/3/4 are pure execution.

> **User-facing message** (orchestrator kickoff, before 1.1):
> "Hey — I'll walk you through internationalizing this project in four phases: inspect, set up the library, wrap your hardcoded strings, and (optionally) connect a translation platform. First I'll do a read-only scan of your project — framework, router, existing i18n setup, files with translatable text. No changes yet. After that I'll ask a small set of questions to shape the plan."

### 1.1 Inspect subagent

Dispatch a subagent (foreground, blocking — small output, no progress polling needed) with this prompt:

> You are inspecting a project to gather i18n setup context. Read-only — do not modify any files.
>
> Read the project's `package.json`, build config files (`vite.config.*`, `next.config.*`, `.babelrc`), and survey the source tree. Output **only** a single JSON object matching this schema, written to `.globalize/detection.json`:
>
> ```json
> {
>   "framework": "next" | "vite" | "tanstack-start" | "remix" | "react-router-framework" | "nuxt" | "quasar" | "sveltekit" | "cra" | "unknown",
>   "router": "app" | "pages" | "tanstack-router" | "tanstack-start" | "react-router" | "vue-router" | "sveltekit" | "none",
>   "compiler": "swc" | "babel",
>   "react": true | false,
>   "vue": true | false,
>   "svelte": true | false,
>   "typescript": true | false,
>   "packageManager": "npm" | "yarn" | "pnpm" | "bun",
>   "sourceDir": "src" | "app" | string,
>   "routeEntries": ["src/app/**/page.tsx", ...] | null,
>   "git": { "isRepo": true | false, "branch": string | null, "remote": string | null },
>   "existing": {
>     "library": "lingui" | "next-intl" | "react-intl" | "i18next" | "react-i18next" | "next-translate" | "typesafe-i18n" | "vue-i18n" | "@nuxtjs/i18n" | "i18next-vue" | "@tolgee/vue" | "fluent-vue" | "paraglide" | "none",
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
> | `framework` | Evaluate in this order, first match wins: `next` in deps → next. `nuxt` in deps → nuxt. `quasar` in deps → quasar. `@tanstack/react-start` in deps → tanstack-start. Any `@remix-run/*` runtime package in deps → remix. `react-router` in deps AND `@react-router/dev` in devDeps AND a `react-router.config.{ts,js}` file at the repo root → react-router-framework. `@sveltejs/kit` in deps or devDeps → sveltekit. `vite` in devDeps (and none of the above) → vite. `react-scripts` in deps → cra. (Order matters: Remix v2, React Router v7 framework mode, and SvelteKit all ship `vite` in devDeps, so they must be checked before the `vite` fallback. React Router v7 SPA mode — `react-router` without `@react-router/dev` — correctly falls through to `vite` with `router: "react-router"`.) |
> | `router` | App Router: `app/` or `src/app/` with `layout.tsx`/`layout.js`. Pages Router: `pages/` with `_app.tsx`/`_app.jsx`. TanStack Start: deps include `@tanstack/react-start`. TanStack Router (client): `@tanstack/react-router` without `react-start`. React Router: `react-router` in deps (also the value reported for `framework: "remix"` and `framework: "react-router-framework"`, since both use react-router internally; this is informational only, no matcher predicates on it for those frameworks). Vue Router: `vue-router` in deps (Vite SPA / Quasar). SvelteKit: `framework === "sveltekit"` — file-based routing under `src/routes/`. |
> | `compiler` | `@vitejs/plugin-react-swc` → swc. `@vitejs/plugin-react` (no `-swc`) → babel. Next.js → swc unless `.babelrc` exists. TanStack Start → swc if `@vitejs/plugin-react-swc` (or `@vitejs/plugin-react@6+`) is in devDeps; babel otherwise. Remix v2 and React Router v7 framework mode → swc if `@vitejs/plugin-react-swc` is in devDeps; babel otherwise (both default to Babel via `@vitejs/plugin-react`). SvelteKit uses neither — the Svelte compiler runs through Vite (esbuild), and none of the rules above match — so the field is a don't-care for SvelteKit; report whatever the heuristic yields (it will not match any rule) and treat the value as not meaningful: the SvelteKit manifest entry does not key on `compiler`. |
> | `react` | `react` in deps or devDeps. |
> | `vue` | `vue` in deps or devDeps. |
> | `svelte` | `svelte` in deps or devDeps. |
> | `packageManager` | `package-lock.json` → npm. `yarn.lock` → yarn. `pnpm-lock.yaml` → pnpm. `bun.lock` → bun. |
> | `routeEntries` | App Router: `<root>/src/app/**/page.tsx`. TanStack file-based: `<root>/src/routes/**/*.tsx`. Remix v2 or React Router v7 framework mode: `<root>/app/routes/**/*.{tsx,jsx,ts,js}`. SvelteKit: `<root>/src/routes/**/*.svelte`. None if no file-based routing detected. |
> | `existing.library` | First match in deps/devDeps from the union of i18n libraries listed above. |
> | `existing.configured` | `lingui.config.*` present AND macro plugin wired in build config; OR `next-intl` config present AND plugin wired; OR (Vue) `createI18n(` present in `src/i18n/index.*` (Vite/Quasar) or `defineI18nConfig(` in `i18n.config.*` (Nuxt) AND `messageCompiler` wired; OR (Paraglide) `project.inlang/settings.json` present AND `paraglideVitePlugin` in `vite.config.*`. |
> | `existing.providerWired` | Layout/main file imports and renders `I18nProvider` (Lingui) or `NextIntlClientProvider` (next-intl); OR (Vue) `app.use(i18n)` in `main.*` (Vite) / boot file registered (Quasar) / `@nuxtjs/i18n` listed in `modules` (Nuxt); OR (Paraglide) `paraglideMiddleware` in `src/hooks.server.ts`. |
> | `existing.catalogsScaffolded` | Locale directories with at least one message file exist. |
> | `existing.stringsWrapped` | Glob source tree (`.{tsx,jsx,js,svelte}`), sample up to 50 files, count files with bare markup text vs. files importing macros/message functions (for Paraglide, `import { m } from '$lib/paraglide/messages.js'`): > 80% imported → "yes", > 20% → "partial", else → "no". |
> | `candidateFiles` | Glob `src/**/*.{tsx,ts,jsx,js,svelte}`, exclude tests/configs/`.d.ts`, grep each for: bare markup text (`>Word<`, including Svelte template text), user-visible attrs (`placeholder=`, `aria-label=`, `title=`, `alt=`), exported user-facing string literals. Return files with ≥1 match, sorted by match count desc. |
> | `localeSignals` | List existing locale dirs (e.g., `src/locales/`), env vars matching `*LOCALE*`, README mentions of language names. |
>
> Write the JSON file and exit. Do not engage in conversation.

> **User-facing message** (after the inspect subagent returns and `detection.json` is written):
> "Scan done. Detected: **{framework}** + **{router}** ({compiler} compiler, {packageManager}). Existing i18n: **{existing.library}** ({existing.configured ? 'already configured' : 'not configured yet'}). Found **{candidateFiles.length}** files with hardcoded strings. Next, a few questions to shape the setup plan."
>
> If `existing.library !== "none"`, also surface:
> "Heads up — you already have `{existing.library}` in your dependencies. If it's compatible, we'll continue with it; if not, I'll flag it in the next step."

### 1.2 Apply compatibility hard-stops

Read `detection.json`. Apply these rules top-to-bottom. If any matches, **STOP** the orchestrator with the corresponding message — do not proceed to 1.3.

When stopping, prefix the message with `Compatibility check — found a blocker:` so the user sees a clear framing rather than an abrupt error.

| Condition | Stop message |
|---|---|
| `react === false` AND `vue === false` AND `svelte === false` | "i18n-guide currently supports React-based, Vue-based, and Svelte-based projects only. This project uses {framework}. No supported library available." |
| `framework === "cra"` | "Create React App is no longer supported by this skill. Migrate to Vite or Next.js, then re-run." |
| `existing.library` is one of `react-intl`, `i18next`, `react-i18next`, `next-translate`, `typesafe-i18n`, `i18next-vue`, `@tolgee/vue`, `fluent-vue` | "This project already uses {library}. Migrating between i18n libraries is out of scope for this skill. Either continue with {library} (use its native tooling), or remove it first and re-run." |
| `framework === "next"` AND `router === "pages"` AND user wants Lingui | (Surface only after library choice in 1.5) "Lingui setup does not currently cover the Next.js Pages Router. Use next-intl on Pages Router, or migrate to App Router." |
| `@remix-run/react` in deps with major version `< 2` (i.e. Remix v1) | "Remix v1 is no longer supported by this skill. Upgrade to Remix v2 (`@remix-run/*` ≥ 2) or migrate to React Router v7 framework mode, then re-run." |
| `framework === "remix"` AND (`@remix-run/dev` major.minor `< 2.7` OR `vite` not in devDeps) | "This Remix v2 project uses the classic compiler (pre-Vite). Lingui requires the Vite-based build. Upgrade to `@remix-run/dev` ≥ 2.7 and follow Remix's classic-compiler → Vite migration, then re-run." |
| `framework === "sveltekit"` AND `@sveltejs/kit` major.minor `< 2.3` | "Paraglide's URL-based locale routing relies on SvelteKit's `reroute` hook, added in `@sveltejs/kit` 2.3.0 — your project is on an older version. Upgrade to SvelteKit ≥ 2.3, then re-run. (If you must stay below 2.3, a different, deprecated routing approach is required that this skill does not cover.)" |
| `svelte === true` AND `framework !== "sveltekit"` | "This skill currently supports Svelte only through SvelteKit (the Paraglide setup relies on SvelteKit's hooks and routing). A plain Vite + Svelte SPA is not yet supported. Adopt SvelteKit, or wait for SPA support, then re-run." |
| Custom build pipeline (no `vite.config`, `next.config`, `nuxt.config`, `quasar.config`, or `react-scripts`) | "This project uses an unsupported build pipeline. Lingui requires SWC or Babel; next-intl requires Next.js; vue-i18n requires Vite, Nuxt, or Quasar." |

These are not hard-stops, but note for the Paraglide path:

- If `existing.library === "paraglide"` AND `existing.configured === true`, do **not** run a from-scratch setup — route Phase 2 to the collapse / already-configured case (see "Phase 2 collapse-case").
- If `@inlang/paraglide-sveltekit` (the Paraglide 1.x SvelteKit adapter) is in deps, this is a **migration**, not a fresh setup: Paraglide 2.x replaced the dedicated adapter with the framework-agnostic `reroute` + `handle` model. Flag it to the user before proceeding; the setup reference covers the migration steps.

### 1.3 Resolve supported stacks from manifest

Read `manifest.json`. Filter `stacks[]` entries whose `match` predicate is satisfied by `detection`. The result is the set of `(library, variant)` options the user can choose from in 1.5.

If the filtered list is empty, surface a STOP with: "Your stack is supported in principle but no manifest entry currently matches. Detected: {summary}. File an issue or pick a different setup."

### 1.4 Branch recommendation

If `git.isRepo === true` AND `git.branch` is one of `main`, `master`, `develop`:

> You're on `{branch}`. Setup will modify several files, so I'd recommend a dedicated branch — easier to review or revert later:
> ```
> git checkout -b chore/i18n-setup
> ```
> Want me to create this branch when Phase 2 starts, stay on `{branch}`, or use a different name? (No git commands run yet — just answering the question.)

Record the answer in `decisions`.

### 1.5 Library choice

> **User-facing message** (before showing options):
> "Picking the i18n library. Based on **{framework}** + **{router}**, my recommendation is **{recommended-library}** — {one-line rationale from the table below}. You can override if you have a strong preference."

Show the user the list of supported variants from 1.3, with the recommendation marked. Recommendation rules (apply first match):

| Detection | Recommendation | Rationale |
|---|---|---|
| `framework === "next"` | **next-intl** | Purpose-built for Next.js; first-class App Router (RSC + middleware) and Pages Router support. Uses ICU MessageFormat. No compile step. |
| `framework === "next"` AND user wants compile-time extraction | **Lingui** (alternative) | Compile-time macros, zero-runtime-overhead translations. |
| `framework === "nuxt"` | **vue-i18n via @nuxtjs/i18n** | The Nuxt module wraps vue-i18n with SSR-aware routing, lazy-loaded locale catalogs, and locale meta via `useLocaleHead`. The canonical Nuxt choice. |
| `framework === "quasar"` OR (`vue === true` AND `framework === "vite"`) | **vue-i18n** | The official Intlify library and de-facto standard across Vue 3 projects. Composition API + ICU via custom `messageCompiler`. |
| `framework === "remix"` | **Lingui** | Remix v2 (≥ 2.7, Vite-based) ships with no first-party i18n primitive. Lingui plugs in via `@lingui/vite-plugin`, gives compile-time extraction, and aligns with Remix's per-route `loader` pattern (dynamic catalog import per route). |
| `framework === "react-router-framework"` | **Lingui** | React Router v7 framework mode is the same shape: Vite + `loader` + root `<html>` rendering. Lingui's per-route catalogs map cleanly onto the routes config. |
| `framework === "sveltekit"` | **Paraglide JS** | First-party Svelte CLI add-on (`sv add paraglide`); compiler-based with tree-shaken messages; SSR-correct via AsyncLocalStorage; integrates through `reroute` + `handle` hooks. |
| anything else (vite + react, tanstack-start, etc.) | **Lingui** | The only library with reference support for non-Next.js React stacks today. |

Use AskUserQuestion if multiple variants apply. If only one variant matches, surface the choice as confirmation rather than a multi-option prompt.

### 1.6 Journey scope

> **User-facing message** (before asking):
> "Which phases do you want to run? I've pre-checked the ones that make sense given what's already in the project."

Ask which phases to run. Defaults derived from `existing`:

- If `existing.configured === false` → setup is suggested
- If `existing.stringsWrapped !== "yes"` AND `candidateFiles.length > 0` → convert is suggested
- Globalize-now is opt-in only; default unchecked

Use AskUserQuestion with three multi-select options (setup / convert / connect translation platform) and the inferred defaults pre-checked.

### 1.7 Setup choices

> **User-facing message** (before asking):
> "A few setup details. Locales drive which catalog folders we scaffold and which CLI flags we pass; the routing strategy determines how locale shows up in URLs; setup mode is just how chatty I should be while running Phase 2."

If `setup` is in scope, collect:

- **Setup mode** — guided (per-step explanations, consent gates on file modifications) vs. unguided (run end-to-end, summarize at end)
- **Source locale** — default to `localeSignals` first existing or `en`
- **Target locales** — multi-input. Suggest from `localeSignals.existingLocaleDirs` and README hints
- **Routing strategy** — only if file-based routing is detected; ask: prefix-based (`/en/...`) or domain-based or none
- **Catalog format** *(Paraglide only)* — defaults to **PO (gettext)** and **do not ask** for a fresh setup. PO is the default because a `.po` catalog carries `#.` translator comments that flow to the Globalize platform (the single biggest quality lever for AI translation), which the ICU-JSON model cannot. Set `decisions.setup.catalogFormat = "po"` silently. The **only** time to surface a choice is an **already-configured** Paraglide project on ICU-JSON (existing `messages/*.json` + `@inlang/plugin-icu1`): ask whether to **convert to PO** (recommended — a lossless migration, since both formats use ICU bodies; see "Phase 2 collapse-case" → migration) or **keep ICU-JSON** (`catalogFormat = "json"`). Omit entirely for non-Paraglide libraries.

Record under `decisions.setup`.

### 1.8 Convert choices

> **User-facing message** (before asking):
> "What's this app about? One-sentence answer is fine. I'll pass it to the wrapping workers in Phase 3 so the translator comments they add have the right context (e.g., '[Cart]', '[Onboarding tooltip]')."

If `convert` is in scope, ask the user to confirm the **app domain**. Infer from `package.json` description, README, route names, or component names. Default suggestion + freeform override.

The domain string flows into wrap-subagent prompts so they write better translator comments. For Paraglide on the default **PO** catalog format, `.po` entries carry `#.` translator comments, so the domain informs comments **and** key naming, exactly as for Lingui/next-intl. For Paraglide on the **ICU-JSON** catalog format (`decisions.setup.catalogFormat === "json"`, which has no translator-comment field), the app domain instead informs *key naming* only — it helps the wrap subagent choose descriptive, context-encoding keys (e.g. `cart_remove_button`), the only disambiguation lever available there.

### 1.9 Globalize-now choices

> **User-facing message** (before asking):
> "Translation-platform setup uses Globalize.now. I just need a project name and which git provider hosts your repo — both have sensible defaults from your `package.json` and git remote."

If `connect translation platform` is in scope, collect:

- **Project name** — default = repo name (from `package.json`).
- **Repo provider** — auto-detect from `git.remote` (github.com → GitHub, gitlab.com → GitLab); confirm.

### 1.10 Optional steps

> **User-facing message** (before asking):
> "Optional add-ons. None of these are required, but the passive coding rules (an `@import` line in your `CLAUDE.md`) are recommended — they keep me from re-introducing hardcoded strings on future edits."

Multi-select for setup-time optionals: ESLint plugin, CI/CD integration (extract+compile in build), test setup wrapper, install passive coding rules (`@import` line in target `CLAUDE.md`).

### 1.11 Generate `plan.md` + `manifest-snapshot.json` + `decisions.md`

> **User-facing message** (before writing):
> "Got everything I need. Writing your plan to `.globalize/plan.md` and your choices to `.globalize/decisions.md` so this run is auditable and resumable."

Write the three artifacts to `.globalize/`. See "Plan and decisions formats" below for shape.

Copy the chosen manifest entry verbatim to `.globalize/manifest-snapshot.json` so subsequent runs and subagents read a stable snapshot, not the live manifest.

### 1.12 Render plan + final go

Show `plan.md` to the user as a checklist. Ask:

> "Here's the plan. Ready to execute? (**yes** / **cancel** / **edit**)
> Once you say yes, I won't pause for more questions unless a subagent gets stuck or finishes a phase."

Cancel writes nothing further. Edit re-enters the relevant 1.x step. Yes proceeds to Phase 2.

---

## Phase 2 — Setup

Single setup subagent. Orchestrator installs packages on the main thread first, then pre-creates the progress file and dispatches the subagent in the background.

> **User-facing message** (at Phase 2 start):
> "Starting Phase 2 — setup. First I'll install the i18n packages on my main thread so your lockfile stays in sync, then I'll dispatch one background worker that wires your build config, sets up the provider, scaffolds catalog folders for your locales, and verifies with a typecheck and build. I'll show progress as a checklist that updates every ~30 seconds. If the worker hits something it can't decide on its own, it'll pause and ask."

### 2.0 Install packages (main thread)

Read `manifest-snapshot.json`'s `packages.runtime` and `packages.dev`. Run the install commands in the foreground using the package manager from `detection.json`. Stream output to the user.

| Package manager | Runtime command | Dev command |
|---|---|---|
| `npm` | `npm install <pkgs>` | `npm install -D <pkgs>` |
| `yarn` | `yarn add <pkgs>` | `yarn add -D <pkgs>` |
| `pnpm` | `pnpm add <pkgs>` | `pnpm add -D <pkgs>` |
| `bun` | `bun add <pkgs>` | `bun add -D <pkgs>` |

**Wrap each `<pkgs>` entry in single quotes** when constructing the shell command — the manifest pins use `^` (e.g. `next-intl@^4`), and zsh interprets unquoted `^` as a glob negation operator under `EXTENDED_GLOB` (common on macOS via oh-my-zsh). Emit `npm install 'next-intl@^4'` rather than `npm install next-intl@^4`. The single quotes are inert under bash/dash and prevent zsh expansion.

Skip the runtime or dev command if its package list is empty. If the install command fails (network error, registry rejection, lockfile conflict), stop the run with the error — do not advance to 2.1.

Running on the main thread keeps the install outside the subagent sandbox, so the user's lockfile stays in sync. The setup subagent in 2.2 will not re-install these packages.

> **User-facing message** (before running):
> "Installing the i18n packages on my main thread first so your lockfile stays in sync — I'll run `{install command}` and stream the output."

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
> **Packages already installed.** The orchestrator ran the package install on the main thread (Phase 2.0) for the manifest's `packages.runtime` and `packages.dev` before dispatching you. Do **not** run `npm install` / `yarn add` / `pnpm add` / `bun add` for those packages. If a reference's setup instructions list an install command for them, treat it as already done and move on. Only flag an extra install if the reference explicitly calls for a package that is **not** in the manifest's `packages` (e.g., a pinned remediation version after a build failure or an opt-in extra) — in that case, write `status: "needs_decision"` with a `needsDecision: { step: "extra_install", question: "An extra package install is needed: <command>. Run it on the main thread?", options: ["yes", "skip"] }` and exit so the orchestrator runs it on the main thread.
>
> **Progress reporting:** After each step transition, atomically update `.globalize/progress/setup.json` (write `<file>.tmp` then `mv`). Set `status: "running"` on first update; populate `completed`, `current`, `currentDetail`, `filesCreated`, `filesModified`, `updatedAt`.
>
> **Ambiguity protocol:** If you hit a case the references don't cover (e.g., two layout files, custom config shape), do NOT improvise. Write `status: "needs_decision"` with a `needsDecision: { step, question, options }` object and exit. The orchestrator will ask the user and re-dispatch you.
>
> **Verification:** After all steps, run the project's typecheck (`tsc --noEmit` if TypeScript) and build command. Capture pass/fail in `result.verificationResult`. Set `status: "succeeded"` or `"failed"` accordingly.

### 2.3 Poll progress

While `progress/setup.json` is in `running` state, wake every 30–60 seconds, read the file, update the user-visible todo list (one todo per `plan` step), and surface `currentDetail` as a transient status hint.

### 2.4 On completion

- `succeeded` → archive `progress/setup.json` to `progress/archive/<timestamp>/setup.json`, render summary (files created, files modified, verification result), advance to Phase 3. User-facing wrap-up:
  > "Setup verified — typecheck and build are clean. Files created: {N}, files modified: {M}. Moving on to Phase 3 — wrapping your hardcoded strings."
- `failed` → archive, render error, ask user how to proceed (retry, edit plan, abort). User-facing wrap-up:
  > "Setup hit an error during `{step}`: {one-line error summary}. Want me to retry, edit the plan, or stop here?"
- `needs_decision` → surface the question to the user, capture answer, append to `decisions.md`, re-dispatch the same subagent (it reads existing `progress/setup.json` and resumes from `completed`). User-facing framing:
  > "The setup worker paused — it needs you to decide on `{question}`. Once you answer I'll send it back to finish from where it left off."

### Phase 2 collapse-case

If `existing.configured === true`, `plan.md` reduces Phase 2 to a verify-and-complete plan (verify what exists, add only what's missing — no from-scratch `create_config`): `verify_config`, `verify_provider`, `add_missing_locale_dirs`, a library-appropriate catalog step, and `build_verification`. The catalog step follows the variant's catalog workflow (see its `references.setup`): a **compile-time** library (Lingui) re-runs `extract_compile` to regenerate runtime catalogs from source; a **runtime-catalog** library (next-intl, vue-i18n) loads message files directly with no compile step, so the step is `verify_catalogs` — confirm the existing catalog files parse and cover every locale; a **compile-from-catalog** library (Paraglide) re-runs `paraglide_compile` (`npx '@inlang/paraglide-js@^2' compile --project ./project.inlang --outdir ./src/lib/paraglide`) to regenerate `src/lib/paraglide/` from the hand-authored `messages/{locale}.{json,po}` catalogs. Same dispatch pattern.

**Paraglide ICU-JSON → PO migration collapse-case.** If `existing.library === "paraglide"`, `existing.configured === true`, the project currently has `messages/*.json` (ICU-JSON / `@inlang/plugin-icu1`), and the user chose `decisions.setup.catalogFormat === "po"`, Phase 2 is a **format migration**, not a from-scratch setup. The plan steps are: `migrate_settings` (swap the icu1 module + key for the PO module + `plugin.globalizeNow.po` with `"messageFormat": "icu"`), `migrate_catalogs` (rewrite each `messages/{locale}.json` → `messages/{locale}.po` — lossless: `"key": "ICU body"` → `msgid "key"` / `msgstr "ICU body"`, carrying interpolation/plural/select verbatim; add the `msgid ""` header block; delete the old `.json`), `paraglide_compile`, and `build_verification`. The migration is driven by the **Migration: existing ICU-JSON → PO** section of `references/languages/js-ts/frameworks/sveltekit/paraglide.setup.md` (the default PO setup file). The per-file `migrate_catalogs` rewrite is independent across locales, so dispatch it as parallel background subagents (one per `messages/{locale}.json`). After migrating, run the plural-render check from that file's **Verify** step — a missing `"messageFormat": "icu"` or a botched ICU escape fails **silently** (renders raw ICU), so the build passing is not sufficient.

---

## Phase 3 — Convert

Multiple wrap subagents in parallel, then one verify subagent.

> **User-facing message** (at Phase 3 start):
> "Starting Phase 3 — converting hardcoded strings. I'm splitting **{file count}** files across **{N}** workers that run in parallel — each one walks its assigned files, wraps user-visible strings with the right macro, and adds short translator comments where context isn't obvious. After they all finish, a final verify worker runs extract + compile + build to make sure everything still type-checks and the catalog is clean."

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
> For each file: identify translatable strings, wrap with the correct macro, add translator comments inline per the rules in the reference. (Paraglide is key-authored with no macro — instead of wrapping, author a descriptive, context-encoding key plus its catalog entry and replace the string with the `m.key()` call. **On the default PO catalog format**, author the entry into `messages/{baseLocale}.po` as `#.` comment + `msgid "key"` + `msgstr "ICU body"` — `.po` carries `#.` comments, so DO add them, following `references/languages/js-ts/frameworks/sveltekit/paraglide.convert.md`. **On the ICU-JSON catalog format** (`decisions.setup.catalogFormat === "json"`), the inlang/ICU JSON model has no translator-comment field, so do NOT add comments — descriptive key naming is the only disambiguation lever; follow `references/languages/js-ts/libraries/paraglide/json-format.convert.md` instead.) Update `.globalize/progress/wrap-N.json` after each file (atomic write). Do NOT run `extract` or `compile` — that runs once after all wrap subagents complete.
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
> Plan steps depend on the library's catalog model:
> - **Compile-time extraction (Lingui)** and **runtime-catalog (next-intl/vue-i18n)**: extract_clean, compile, build_check, comment_review_pass.
> - **Compile-from-catalog (Paraglide)**: paraglide_compile, build_check. There is **no extract step** (keys are authored by hand, not extracted). On the **default PO** format `.po` carries `#.` comments, so a comment_review_pass over the base `.po` **does** apply, plus an ICU plural-render sanity check (see below). On the **ICU-JSON** format (`catalogFormat === "json"`) there is **no comment_review_pass** (the inlang/ICU JSON model has no translator-comment field).
>
> For Lingui / next-intl / vue-i18n:
> 1. Run `npx lingui extract --clean` (Lingui) or `npx next-intl extract` if applicable. Capture errors. Atomically update `progress/verify.json` after this step.
> 2. Run `npx lingui compile` (with `--typescript` if TS). Capture errors.
> 3. Run the project's typecheck and build command. Capture pass/fail.
> 4. Read the extracted catalog. For entries lacking translator comments where the heuristic in the reference says one should exist (single-/two-word phrases, action labels without object, domain-sensitive terms), edit the source file to add the missing comment.
>
> For Paraglide:
> 1. Run `npx '@inlang/paraglide-js@^2' compile --project ./project.inlang --outdir ./src/lib/paraglide` (both flags; single-quoted pin so zsh's `EXTENDED_GLOB` does not eat the caret). Capture errors. Atomically update `progress/verify.json` after this step.
> 2. Run the project's typecheck and build command. Capture pass/fail. (No extract step.) **Default PO format:** (a) inspect a compiled plural message (`src/lib/paraglide/messages/<key>.js`) to confirm it emits CLDR `registry.plural(...)` branches and **not** the raw `{count, plural, …}` source as a literal — raw source means `"messageFormat": "icu"` is missing or an `msgstr` is malformed (both fail silently); (b) run a comment-review pass over the base `messages/{baseLocale}.po`, adding `#.` comments where the reference's heuristic says one should exist. **ICU-JSON format (`catalogFormat === "json"`):** skip both — there is no comment field, and the ICU1 plugin already fails the build on malformed ICU.
>
> Write `result` with `{ catalogPath, totalMessages, extractOk, compileOk, buildOk, commentsAdded }`. For Paraglide, set `extractOk` to `null`; set `commentsAdded` to the count added on the default PO format and to `null` on ICU-JSON; report compile success under `compileOk`.

### 3.6 Cost estimate (Phase 3 → 4 bridge)

After verify succeeds, parse the extracted catalog to compute word count. Show the user:

> "Phase 3 complete. Catalog: **{totalMessages}** messages, ~**{wordCount}** words. Translating into **{N}** target locales (`{targets}`) would cost roughly **~${estimate}** on Globalize.now."

If `decisions.scope.globalize === true`, advance to Phase 4 with:

> "Moving on to Phase 4 — connecting Globalize.now."

Otherwise, end with:

> "Skipping the translation-platform step for now. Re-run `i18n-guide` with `connect translation platform` checked when you're ready to wire it up."

### Phase 3 collapse-cases

- `existing.stringsWrapped === "yes"` → skip wrap subagents; run only verify.
- `existing.stringsWrapped === "partial"` → Phase 1 candidate list already excluded already-wrapped files.

---

## Phase 4 — Globalize-now (optional)

Auth must stay on the main thread (interactive). Project + repo creation runs in a subagent.

> **User-facing message** (at Phase 4 start):
> "Phase 4 — connecting Globalize.now. The first three steps run here in the foreground because they need you: installing the CLI, signing in (a browser window will open for device-flow auth), and confirming your org. After that, a background worker creates the project, configures languages, connects your repo, and sets the catalog file patterns."

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
> 4. `globalize repo patterns set --source {catalogPath} --output {targetCatalogPattern}` — configure paths from Phase 3 verify result. The **file format** follows the catalog: for Paraglide it is `po` with catalog path `messages/{locale}.po` by default; if `decisions.setup.catalogFormat === "json"` it is `json-flat` at `messages/{locale}.json`. (Other libraries: `po` for Lingui, `json-nested` for next-intl, etc.) Pass the format with the pattern if the CLI form in use takes an explicit `fileFormat` (see `globalize-now-cli-use`).
>
> Update `progress/globalize.json` after each step. Final `result` includes `{ projectId, projectUrl, repoConnected, patternsConfigured }`.

### 4.6 Poll, surface, finish

Standard polling. On completion, show project URL and a one-line summary:

> "All set. Project created: **{projectUrl}**. Repo connected, catalog patterns wired. From here on, use the `globalize-now-cli-use` skill (or the `globalize` CLI directly) for ongoing translation work — pulling translations, tracking status, requesting new languages."

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

Orchestrator-owned steps (main thread, before subagent dispatch):
- [ ] install_packages_main_thread

Subagent steps:
- [ ] checkout_branch
- [ ] create_config
- [ ] build_tool_integration
- [ ] provider_wiring
- [ ] language_switcher
- [ ] scaffold_catalogs
- [ ] extract_compile   <!-- compile-time libraries only (Lingui); runtime-catalog libraries (next-intl, vue-i18n) consume the scaffolded catalogs directly — omit this step. Compile-from-catalog libraries (Paraglide) use `paraglide_compile` instead — see below. -->
- [ ] paraglide_compile   <!-- compile-from-catalog libraries only (Paraglide): `npx '@inlang/paraglide-js@^2' compile --project ./project.inlang --outdir ./src/lib/paraglide`; replaces extract_compile, omit for all other libraries -->
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
<!-- compile-time extraction (Lingui) and runtime-catalog (next-intl, vue-i18n): -->
- [ ] extract_clean
- [ ] compile
- [ ] build_check
- [ ] comment_review_pass
<!-- compile-from-catalog (Paraglide) instead: no extract step, no comment_review_pass (inlang/ICU has no comment field):
- [ ] paraglide_compile
- [ ] build_check
-->

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

Some references include catalog-format sub-references for an **alternate** format (e.g., `references/languages/js-ts/libraries/next-intl/po-format.setup.md`, and for Paraglide `references/languages/js-ts/libraries/paraglide/json-format.{setup,convert,code}.md`). When the user is on the alternate format, substitute that reference's snippets in place of the default examples — the variant reference itself flags the substitution points. For Paraglide specifically: the **default is PO**, so the base files (`frameworks/sveltekit/paraglide.{setup,convert}.md` and `libraries/paraglide/code.md`) are the PO path and apply as-is. Only when `decisions.setup.catalogFormat === "json"` does the setup subagent apply `json-format.setup.md` over `paraglide.setup.md`, the wrap subagents apply `json-format.convert.md` over `paraglide.convert.md`, and the coding-rules add-on install `json-format.code.md` instead of `code.md` (see the add-ons reference).

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
