# Plan, decisions and progress formats

Loaded by SKILL.md §1.11 (writing `plan.md` / `decisions.md`) and by every worker that writes a progress file.

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

<!-- Include the Phase 1.5 section only when decisions.scope.globalize === true -->
## Phase 1.5 — Globalize account
Orchestrator-owned steps (main thread, delegated to `globalize-now-account-setup`):
- [ ] delegate_account_setup

## Phase 2 — Setup
Subagent: `setup`
Progress: `.globalize/progress/setup.json`
References:
- {paths joined from manifest.references.setup}
- {paths joined from manifest.references.rulesTemplate}

Orchestrator-owned steps (main thread, before subagent dispatch):
- [ ] upgrade_vite   <!-- only when decisions.setup.viteUpgrade is set (compat.js-ts.md "Lingui + Vite version gate"): `npm install -D 'vite@^6'` (+ React plugin bump if needed), then the project's build must pass BEFORE install_packages_main_thread -->
- [ ] install_packages_main_thread
- [ ] ng_add_localize   <!-- Angular only: `npx ng add '@angular/localize@^<major>' --skip-confirmation --use-at-runtime --project <decisions.setup.angularProject>` on the main thread (§2.0); replaces install_packages_main_thread -->

Subagent steps:
- [ ] checkout_branch
- [ ] create_config
- [ ] build_tool_integration
- [ ] provider_wiring
- [ ] language_switcher
- [ ] scaffold_catalogs
- [ ] gitignore_artifacts   <!-- libraries that emit on-disk generated catalogs only. Lingui: the compiled `.ts`/`.js` siblings of the committed `.po` sources. Paraglide: the compiler `outdir` (`src/lib/paraglide/`). Angular: `<assetsDir>/i18n/*.json` written by `scripts/xliff-to-json.mjs` (never the `src/locale/*.xlf` sources). Runs BEFORE the first seed/extract/compile so generated files are never staged. Omit for runtime-catalog libraries (next-intl, vue-i18n, Rails, Android, iOS) — nothing lands on disk to ignore. -->
- [ ] extract_compile   <!-- compile-time libraries only (Lingui), and Angular (`npm run i18n:extract` + `npm run i18n:compile`, the XLIFF → runtime JSON step); runtime-catalog libraries (next-intl, vue-i18n) consume the scaffolded catalogs directly — omit this step. Compile-from-catalog libraries (Paraglide) use `paraglide_compile` instead — see below. Lingui: after the first compile, run the setup reference's catalog-import check where it ships one (every `import()` target exists for every locale), then its stray sweep (compiled stubs **and** `.po` files at paths the final config no longer produces — deleting only paths in `filesCreated`; a pre-existing catalog is the user's, kept and reported), then the import check again. -->
- [ ] paraglide_compile   <!-- compile-from-catalog libraries only (Paraglide): `npx '@inlang/paraglide-js@^2' compile --project ./project.inlang --outdir ./src/lib/paraglide`; replaces extract_compile, omit for all other libraries -->
- [ ] generate_format_helpers   <!-- ALWAYS present, every library, every variant, including the collapse case. Creates the project's formatters module (the `generate_format_helpers` section inside manifest.references.setup) and writes `.globalize/format-module.json`. MUST precede generate_coding_rules, which resolves `<<formatModule>>` from that file and fails closed without it. Phase 3's format pass rewrites hand-rolled formatting toward this module. Never gate this on a §1.10 selection. -->
- [ ] generate_coding_rules   <!-- ALWAYS present, every library, every variant, including the collapse case. Runs AFTER generate_format_helpers. Renders manifest.references.rulesTemplate against this project's resolved values into `.agents/globalize-rules.md`, then removes any `.claude/globalize-rules.md` left by an older version of this skill. Phase 3 wrap subagents read that file, so Phase 2 cannot be considered done without it. Never gate this on a §1.10 selection. -->
- [ ] install_coding_rules   <!-- ALWAYS present, same as above. Points `CLAUDE.md` (`@.agents/globalize-rules.md`) and `AGENTS.md` (pointer section) at the generated file, creating either if absent, and strips any stale `@.claude/globalize-rules.md` line. Writes nothing else into either file — no rules summary, catalog path or locale list — and is not complete until the reference's bridge check passes (exact `@.agents/globalize-rules.md` line, verbatim pointer section, no other added lines). Skipped only if generate_coding_rules produced no file. Never gate this on a §1.10 selection. -->
- [ ] {optional steps if opted in}
- [ ] build_verification

## Phase 3 — Convert
Partitions: {N} wrap subagents covering {file count} files
<!-- {file count} is the size of the UNION of detection.candidateFiles and detection.formatCandidateFiles — neither list is a subset of the other (SKILL.md §1.1). Every file entry carries its scope tag. -->

### wrap-1 ({subtree summary})
- [ ] {file path} — strings|formatting|both
- [ ] {file path} — strings|formatting|both
…

### verify
<!-- compile-time extraction (Lingui) and runtime-catalog (next-intl, vue-i18n): -->
- [ ] extract_clean
- [ ] compile
- [ ] build_check
- [ ] recall_self_check   <!-- JS/TS backstop: scan for unwrapped strings, self-heal via wrap-cleanup subagents (see convert.recall-self-check.md); ≤2 rounds -->
- [ ] comment_review_pass
<!-- compile-from-catalog (Paraglide) instead: no extract step, no comment_review_pass (inlang/ICU has no comment field):
- [ ] paraglide_compile
- [ ] build_check
- [ ] recall_self_check
-->
<!-- Angular (@angular/localize) instead:
- [ ] i18n_extract
- [ ] description_check
- [ ] i18n_compile
- [ ] build_check
- [ ] recall_self_check
- [ ] main_ts_import_check
-->
<!-- runtime-catalog, no compile (Rails) instead: no extract step, no compile step, no build step (Rails loads config/locales/*.yml directly at runtime). The gate is base-locale completeness (i18n-tasks missing -t used); there is no normalize-drift gate. test_suite is optional — include only if a spec/ or test/ dir exists (run with raise_on_missing_translations):
- [ ] ensure_i18n_tasks
- [ ] source_completeness_check
- [ ] unused_cleanup
- [ ] test_suite
-->
<!-- runtime-catalog, no compile (Android) instead: no extract step, no compile step (the platform loads res/values*/strings.xml at runtime). lint_check is optional — include only when the Android SDK/Gradle is available:
- [ ] xml_validity_check
- [ ] locale_coverage_check
- [ ] lint_check
-->
<!-- Appended to WHICHEVER arm above applies — format_violations_check is the one verify step that is
     not library-specific and is present on EVERY language, always last so it runs after that arm's
     gate. It re-runs the language's formatCandidateFiles grep (minus the formatters module named by
     .globalize/format-module.json) and records result.formatViolations as [{file,line,text}].
     Never omit it and never report it as null. -->
- [ ] format_violations_check

<!-- Include the Phase 4 section only when decisions.scope.globalize === true -->
## Phase 4 — Globalize project
Orchestrator-owned steps (main thread; the last two delegated to `globalize-now-project-setup`):
- [ ] assemble_globalize_inputs
- [ ] push_setup   <!-- §4.2: the converted catalogs must be on the remote before Globalize can translate them -->
- [ ] delegate_project_setup
- [ ] start_first_translation   <!-- done when the project skill reports the first translation started (pull request delivery) -->
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
- [x] Connect Globalize.now   <!-- default-on; unchecked only if the user declined the platform at 1.6 -->

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
<!-- Generating the coding rules and wiring them into CLAUDE.md / AGENTS.md are core steps, not decisions — do not record them here. -->

## Globalize-now
- Project name: `{name}`
- Repo provider: GitHub
- Authenticated org: `{org}`   <!-- recorded after Phase 1.5 sign-in completes -->
```

### Progress file schema (per subagent)

```json
{
  "subagentId": "setup",
  "phase": 2,
  "status": "pending|running|succeeded|failed|needs_decision|needs_cleanup",
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
