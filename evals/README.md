# Skill Evals

Evaluates whether the `i18n-guide` skill makes the right decisions and produces working setups when followed by Claude Code.

Testing runs in two layers:

- **Layer A — orchestration.** Runs the skill through Phase 1 only (detect → decide → generate plan). No package installs, no setup execution. Fast and cheap. Asserts framework detection, the generated plan, and — for incompatible stacks — that the skill refuses with a hard-stop instead of planning.
- **Layer B — end-to-end.** Injects a pre-generated plan, then runs the skill's Phase 2 to completion (install packages, wire build config, scaffold catalogs, extract/compile, build). Slow. Asserts the resulting project actually works.

Both layers drive the real skill via `claude -p`, so they exercise the SKILL.md prose as shipped — not a mirrored copy of its logic.

## Quick Start

```bash
# Layer A — Phase 1 only, ~3 min, no installs
./evals/run-eval-layer-a.sh nextjs-app-router-lingui
./evals/run-eval-layer-a.sh cra-react                       # hard-stop fixture
./evals/run-eval-layer-a.sh nextjs-app-router-next-intl-configured   # collapse fixture

# Layer B — full setup + build, ~5 min, requires a prefill
./evals/run-eval-layer-b.sh nextjs-app-router-lingui
```

Keep the work directory for debugging:

```bash
KEEP_WORKDIR=1 ./evals/run-eval-layer-a.sh nextjs-app-router-lingui
```

With `KEEP_WORKDIR=1` the temp dir survives, so you can re-run a verifier against the captured output without re-invoking the model:

```bash
./evals/verify-orchestration.sh /tmp/tmp.XXXX nextjs-app-router-lingui
```

## How It Works

**Layer A** (`run-eval-layer-a.sh`):
1. Prepare a fixture project in a temp dir (`helpers/prepare-workdir.sh`).
2. Install the skill into `.claude/skills/i18n-guide/`.
3. Run `claude -p` with a prompt that pre-answers every Phase 1 question (positive/collapse) or simply asks the skill to inspect (hard-stop), and stops before Phase 2.
4. Verify the `.globalize/` artifacts: `verify-orchestration.sh` (positive/collapse) or `verify-hard-stop.sh` (hard-stop).

**Layer B** (`run-eval-layer-b.sh`):
1. Prepare the fixture; install the skill.
2. Copy the fixture's **prefill** into `.globalize/` so the skill skips Phase 1.
3. `npm install` the fixture's baseline deps.
4. Run `claude -p` with a "resume" prompt → the skill runs Phase 2 to completion.
5. Verify: `verify-setup.sh` (dispatches to the per-library checker), `check-behavior.sh`, and `verify-string-wrapping.sh` (if an expectations file exists).

## Fixtures

Fixtures are defined in `evals/fixtures.json`. Local fixture projects live under `fixtures/` at the repo root.

### Categories

| Category | Meaning | Layers |
|----------|---------|--------|
| `positive` | A supported stack the skill should set up cleanly | A + B |
| `hard-stop` | An incompatible stack the skill must refuse (CRA, Remix v1, non-React/Vue, …) | A only |
| `collapse` | i18n already configured — Phase 2 should reduce to verification-only steps | A (B once a collapse prefill exists) |

### Types

| Type | How the workdir is built |
|------|--------------------------|
| `local` | Copy `fixtures/<path>/.` into the workdir |
| `git` | Clone `<repo>` and checkout the pinned `<commit>` |
| `derived` | Copy `<base>/.`, then overlay `<overlay>/.` (overlay wins on conflict) |

`derived` lets a collapse fixture reuse a positive fixture as its base and only check in the files that differ (e.g. the next-intl config + provider + catalogs that simulate an already-configured project).

### `fixtures.json` schema

```jsonc
{
  "nextjs-app-router-lingui": {
    "category": "positive",
    "type": "local",
    "path": "fixtures/nextjs-app-router",
    "library": "lingui",                 // drives the Layer B verifier; null for hard-stops
    "variant": "nextjs-app-router-lingui",
    "prefill": "evals/prefills/nextjs-app-router-lingui",   // Layer B only
    "expectedDetection": "evals/expectations/detection/nextjs-app-router-lingui.json",
    "expectedPlan": "evals/expectations/plan/nextjs-app-router-lingui.json"
  },
  "cra-react": {
    "category": "hard-stop",
    "type": "local",
    "path": "fixtures/hard-stop/cra-react",
    "library": null,
    "variant": null,
    "expectedHardStop": "evals/expectations/hard-stop/cra-react.json"
  },
  "nextjs-app-router-next-intl-configured": {
    "category": "collapse",
    "type": "derived",
    "base": "fixtures/nextjs-app-router",
    "overlay": "fixtures/collapse/nextjs-app-router-next-intl-configured",
    "library": "next-intl",
    "variant": "nextjs-app-router-next-intl",
    "expectedDetection": "evals/expectations/detection/nextjs-app-router-next-intl-configured.json",
    "expectedPlan": "evals/expectations/plan/nextjs-app-router-next-intl-configured.json"
  }
}
```

## Expectation Files

### Detection golden — `expectations/detection/<fixture>.json`

A snapshot of the stable fields the inspect subagent should report. `verify-orchestration.sh` asserts every leaf in `match` exactly (including nested `existing.*`), skips the `ignore` keys, and treats `softAssert.candidateFilesMinCount` as a warn-only check.

```jsonc
{
  "match": {
    "framework": "next", "router": "app", "compiler": "swc",
    "react": true, "vue": false, "typescript": true,
    "packageManager": "npm", "sourceDir": "app",
    "existing": { "library": "none", "configured": false, "providerWired": false,
                  "catalogsScaffolded": false, "stringsWrapped": "no" }
  },
  "ignore": ["candidateFiles", "routeEntries", "git", "localeSignals"],
  "softAssert": { "candidateFilesMinCount": 1 }
}
```

The golden covers the stable spine only. `candidateFiles` ranking, route enumeration, and git state are content/FS-sensitive and are deliberately ignored.

### Plan expectation — `expectations/plan/<fixture>.json`

Structural assertions parsed from `.globalize/plan.md`. Each checklist line looks like `- [ ] <step_id> — <annotation>`; the matchers below anchor on the `<step_id>`.

```jsonc
{
  "variant": "nextjs-app-router-lingui",
  "library": "lingui",
  "phasesIncluded": ["setup"],
  "phase2StepsContain": ["create_config", "build_tool_integration",
                         "provider_wiring", "scaffold_catalogs", "extract_compile"],
  "phase2StepsContainPattern": ["verify_"],   // optional: ≥1 step matching this regex
  "phase2StepsAbsent": ["create_config"]       // optional: none of these may appear
}
```

- `phase2StepsContain` — exact step ids (prefix match) that must each appear.
- `phase2StepsContainPattern` — regexes where at least one checklist step must match. Use this when the exact id varies run-to-run but the *family* is what matters.
- `phase2StepsAbsent` — step ids that must NOT appear.

**Collapse fixtures** assert the *behavior* rather than a literal step list: a `verify_` step is present (config is verified, not recreated), `build_verification` runs, and the from-scratch `create_config` step is absent. This is deliberately tolerant — when a project is already configured, the skill generates a library-appropriate verify-and-complete plan (e.g. next-intl drops `extract_compile` because it has no compile step), so hardcoding SKILL.md's generic collapse list would be brittle.

### Hard-stop expectation — `expectations/hard-stop/<fixture>.json`

```jsonc
{
  "messageContains": "Create React App is no longer supported",
  "mustNotCreate": [".globalize/plan.md", ".globalize/manifest-snapshot.json"],
  "mustCreate": [".globalize/detection.json"],
  "depsMustBeUnchanged": true
}
```

## Prefills

`evals/prefills/<fixture>/` holds a frozen `.globalize/` (detection, decisions, plan, manifest-snapshot) so Layer B can skip Phase 1 and resume straight into setup. Regenerate one by running Layer A against the fixture with `KEEP_WORKDIR=1` and copying its `.globalize/`:

```bash
KEEP_WORKDIR=1 ./evals/run-eval-layer-a.sh nextjs-app-router-lingui
cp -R /tmp/tmp.XXXX/.globalize/. evals/prefills/nextjs-app-router-lingui/
```

Refresh prefills when the manifest's package pins or plan step ids change.

## Layer B Verification

`verify-setup.sh` reads the fixture's `library` and dispatches to `library-checks/<library>.sh`. Currently `lingui.sh` is implemented (locales in an imported module, per-page catalogs, optional ESLint add-on, `app/` source dir, Next 16 `proxy.ts` / `[locale]` routing). `next-intl.sh` and `vue-i18n.sh` are added as those variants come online.

Each library checker runs three layers:

1. **Functional correctness** — config exists with the right locales, packages installed, extract/compile work, `npm run build` succeeds.
2. **Code quality** — `tsc --noEmit` passes, no `any` in i18n files, ESLint plugin wired (if ESLint is present).
3. **Variant-specific** — correct plugins in the build config, framework-specific wiring (middleware/proxy, provider, routing).

`check-behavior.sh` analyzes the agent's output (detection happened, correct variant) and the file changes (no originals deleted, only i18n-related files created). `verify-string-wrapping.sh` runs only when `expectations/<fixture>.json` exists (a convert-phase check).

## Adding a New Fixture

1. **Author the project** under `fixtures/<category>/<name>/` (or reuse a base via a `derived` overlay for collapse cases). Keep it minimal — a handful of files with a few translatable strings.
2. **Register it** in `evals/fixtures.json` with its category, type, library, variant, and expectation pointers.
3. **Author the goldens**: a detection golden always; a plan expectation for positive/collapse; a hard-stop expectation for hard-stops.
4. **For Layer B**, generate a prefill (see above) and ensure a `library-checks/<library>.sh` exists.
5. **Run it** with `KEEP_WORKDIR=1` and iterate on the golden until the run is reliably green.

## Interpreting Results

```
PASS: All checks passed
FAIL: Hard failures — the setup or decision is wrong
WARN: Soft issues — content-sensitive or informational
```

When a run fails, re-run with `KEEP_WORKDIR=1`, then inspect `.globalize/` (detection, plan), `.eval-agent-output.txt` (what the skill said), and the modified project files in the work dir.
