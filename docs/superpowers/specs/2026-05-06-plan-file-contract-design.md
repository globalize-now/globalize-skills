# Plan File Contract — Design Spec

**Date:** 2026-05-06
**Branch:** `feat/localize-orchestrator`
**Project context:** This is Plan 1 of the orchestrator initiative. Strategy and rationale live in `research/2026-04-26-orchestrator-strategy/RESEARCH.md`. This spec is implementation-ready and self-contained.

---

## 1. Scope & non-goals

### Scope

Define the schema, parser, validator, fingerprint algorithm, and bootstrap flow for `.globalize/PLAN.md`. Ship a TypeScript module that consumers (orchestrator skill, MCP server, CLI) import to read, write, validate, and mutate the plan file.

### Non-goals

- The orchestrator's "what to do next" logic — Plan 3.
- The MCP `plan.*` tool surface (depends on this contract but lives in Plan 2).
- Sub-skill refactoring — Plan 4.
- Hooks and slash commands — Plans 5–6.
- Monorepo / multi-package workspaces. Plan 1 ships a single-plan-per-repo contract; a multi-package extension is deferred to a later plan.
- The validator's package home (which npm package owns the schema). Deferred — the spec defines the module surface; the package shape is decided when Plan 1 starts implementation.

---

## 2. Lifecycle model

The plan file is a **migration artifact**, not durable project state. It exists during the one-time conversion of an existing project to be i18n-aware. Once the migration completes, the file is deleted.

- **Greenfield project, user runs `/localize`** → orchestrator creates `.globalize/PLAN.md`.
- **Mid-migration session re-entry** → presence of the file signals "in flight." Orchestrator reads it, computes status, picks up.
- **Project already has i18n installed but no plan** → bootstrap flow (§6).
- **All canonical sections fully checked** → orchestrator detects completion, asks the user to confirm, deletes the file. Migration is over.
- **Day-to-day work afterward** (new components, new strings, adding a locale) does not use the plan. It goes through the regular channels: passive coding rules, hooks (Claude), MCP platform tools.
- **Future migration** (e.g., "now restructure for SSR-aware routing") creates a fresh plan. Plans are per-migration, not per-project.

There is no `status: complete` field, no archive, no version-of-completion record. File presence is the only state signal.

---

## 3. File location

`.globalize/PLAN.md` at the repo root. Committable. The `.globalize/` directory exists to leave room for future siblings (e.g., a config file) without renegotiation.

---

## 4. Schema

### 4.1 Frontmatter (YAML)

```yaml
---
schema_version: 1

# Decisions — sticky; only changed by explicit user re-decide
decisions:
  library: lingui | next-intl | vue-i18n | nuxt-i18n
  catalog_format: po | json
  source_locale: <BCP47 string>           # e.g., "en", "en-US"
  target_locales: [<BCP47>, ...]          # non-empty
  routing_strategy: subpath | domain | none
  mode: auto | guided
  allow_icu_in_sfc_blocks: true | false   # OPTIONAL — Vue/Nuxt-only escape hatch (§4.3)

# Detection snapshot — regenerated on fingerprint drift
detected:
  framework: nextjs | vite | nuxt | tanstack-start | react-router | ...
  framework_version: <semver string>
  router: app | pages | declarative | framework | null
  typescript: bool
  package_manager: npm | pnpm | yarn | bun
  build_tool: webpack | turbopack | vite | rspack | ...
  detected_at: <ISO-8601 date>
  fingerprint: <string>                   # see §5

# Bootstrap audit — present only when plan was bootstrapped from existing setup
bootstrap:
  imported_from: detected-state
  imported_at: <ISO-8601 date>
  reconciliation_actions: [<short string>, ...]
---
```

#### Field rules

- `schema_version` mandatory. Currently `1`.
- `decisions.target_locales` non-empty.
- `decisions.source_locale` MUST NOT appear in `decisions.target_locales`.
- All BCP-47 locale strings normalized to lowercase script-region (`en`, `en-US`, `pt-BR`, `zh-Hant`).
- `bootstrap` block is absent on greenfield plans.
- Fields not listed above are not allowed (parser rejects unknown top-level keys at schema_version 1; sub-fields under `decisions` / `detected` / `bootstrap` follow the same rule).

### 4.2 Body (markdown — rigid sections, loose items)

```markdown
## Setup
- [ ] Install packages
- [x] Configure routing  (chose subpath, locale prefix)

## Convert
- [ ] Wrap UI strings

## RTL / CSS
- [ ] Run css-i18n audit

## Translation pipeline
- [ ] Connect Globalize repository
- [ ] Add target locales to project
```

#### Body rules

- **Canonical sections** are declared by the orchestrator per detected library (Plan 3 owns the actual list). Plan 1's parser only enforces that:
  - Section identity is by exact name match (case-sensitive).
  - Section order is preserved on read/write.
  - Items within a section are `- [ ]` / `- [x]` lines.
  - Free-form content between items (paragraphs, sub-headings, links, comments) is opaque — preserved verbatim across read/write but not parsed.
- The canonical sections **always include** `## RTL / CSS`. RTL preparation is unconditional — every migration runs the css-i18n audit.
- Items within a section are matched by exact label string for `markItemDone` operations (whitespace and trailing notes are part of the label and significant for matching).

### 4.3 Validation invariants

Enforced on every write — `validatePlan` returns violations; consumers (MCP `plan.update`, CLI lint) reject the write.

1. `decisions.target_locales` non-empty.
2. `decisions.source_locale` ∉ `decisions.target_locales`.
3. **Library/framework consistency**:
   - `decisions.library: next-intl` → `detected.framework: nextjs`
   - `decisions.library: nuxt-i18n` → `detected.framework: nuxt`
   - `decisions.library: vue-i18n` → `detected.framework` ∈ {`vite`, `nuxt`} and `decisions.library` is not `nuxt-i18n`
   - `decisions.library: lingui` → `detected.framework` ∈ {`nextjs`, `vite`, `tanstack-start`, `react-router`}
4. **ICU/catalog incompatibility (Nuxt build-breaker)**:
   - `decisions.library: nuxt-i18n` + `decisions.catalog_format: json` is **rejected** unless `decisions.allow_icu_in_sfc_blocks: true`.
   - This invariant catches the eval finding #3 class of bug at write time.
5. `schema_version` recognized by the validator. Higher versions trigger migration (§7).

---

## 5. Fingerprint algorithm

The agent computes the fingerprint and stores it in `detected.fingerprint`. Re-detection fires only on drift.

### 5.1 Input

A normalized JSON object built from decision-relevant signals only:

```json
{
  "fingerprint_schema_version": 1,
  "deps": {
    "next": "15.0.3",
    "nuxt": null,
    "vue": null,
    "@lingui/core": null,
    "@lingui/react": null,
    "@lingui/swc-plugin": null,
    "@lingui/babel-plugin-lingui-macro": null,
    "next-intl": null,
    "vite": null,
    "@vitejs/plugin-react": null,
    "@vitejs/plugin-vue": null,
    "@tanstack/start": null,
    "react-router": null,
    "vue-i18n": null,
    "@nuxtjs/i18n": null,
    "typescript": "5.6.2"
  },
  "presence": {
    "app_dir": false,
    "pages_dir": false,
    "lingui_config": false,
    "next_intl_request_config": false,
    "src_dir": true,
    "tsconfig": true
  }
}
```

- The list of tracked dep names + presence flags is declared in `skills/localize/references/detection.md` — single source of truth shared with the agent's detection algorithm. (This file is created in Plan 3; Plan 1 ships the constants inline in the validator and Plan 3 will move them to the shared reference.)
- Versions are read from the workspace-root `package.json`. `null` means the dep is not installed.
- Presence flags are booleans only — never paths or content hashes.

### 5.2 Algorithm

1. Build the input object.
2. Canonical-JSON-serialize (sorted keys, no whitespace, UTF-8 encoding).
3. SHA-256 the serialized bytes.
4. Take first 12 hex chars of the digest.
5. Format the stored value: `v1:<12 hex>`.

### 5.3 Drift detection

`diffFingerprint(stored, current)` returns:

- `"match"` — strings equal.
- `"schema-bump"` — version prefix differs.
- `"drift"` — version prefix matches but hash differs.

On every orchestrator entry, recompute current. If not `"match"`, re-run detection and update the snapshot.

### 5.4 Bumping `fingerprint_schema_version`

When the tracked dep list or presence-flag list changes (new framework, new presence flag), the version bumps. In Plan 1 those lists live inline in the validator; in Plan 3 they migrate to `skills/localize/references/detection.md`. Either way, a list change requires a version bump. Every existing plan re-detects on next entry. Cost is one cheap re-scan; benefit is no stale snapshots from outdated tracking.

---

## 6. Bootstrap flow

When the orchestrator runs and finds an i18n library installed but no `.globalize/PLAN.md`:

1. **Detect** — same algorithm as a greenfield run. Gather framework, library, catalog format, source/target locales (from existing config — e.g., `lingui.config.ts`'s `locales`), routing strategy.
2. **Synthesize plan** — build a draft `.globalize/PLAN.md` in memory:
   - Frontmatter with detected decisions.
   - `bootstrap:` audit block populated with `imported_from: detected-state` and current date.
   - Body sections initialized with all canonical checkboxes for the detected library.
   - For each checkbox: re-scan the codebase to determine `[x]` vs `[ ]` (e.g., `## Setup → Provider wired` is `[x]` if a provider is detected; `## Convert → Wrap UI strings` is `[x]` only if a fresh scan finds zero unwrapped strings).
3. **Confirm** — show the synthesized plan to the user. Format: "Here's what I detected — confirm or correct: library, source locale, target locales, catalog format, routing." Each field individually correctable.
4. **Reconcile** — when the user corrects a decision:
   - **Cheap reconciliation** (locales, target list, catalog format within the same library) — orchestrator inserts a reconciliation task into the appropriate section (e.g., `[ ] Update source locale in lingui.config.ts to en-US`) and adds a short string to `bootstrap.reconciliation_actions`.
   - **Library-class change** (`lingui` → `next-intl` or vice versa) — hard-stop with: "Library swap is out of scope. Migrate manually first, then re-run."
5. **Write** — once confirmed, write `.globalize/PLAN.md` to disk.

The bootstrap path is the only time the orchestrator infers decisions. From this point forward, decisions are read from frontmatter, never re-inferred.

---

## 7. Schema versioning & migration

`schema_version: 1` mandatory in frontmatter. Strategy:

### Additive changes (no version bump)

New optional fields can land without bumping the version. `parsePlan` ignores unknown fields under recognized blocks (forward-compat: a v1 parser reading a v1+additions plan succeeds and preserves the unknown fields on round-trip).

### Incompatible changes (bump version)

Removing or renaming a field, or tightening an existing invariant, requires `schema_version: 2`. A migration function ships alongside the bump: `migrate_v1_to_v2(plan: PlanV1): PlanV2`.

### On-read migration

`parsePlan` reading `schema_version: 1` while the validator is at v2 automatically runs `migrate_v1_to_v2` and writes the migrated plan back on the next save. Transparent to the user.

### Sunset policy

No more than two live schema versions at a time. When v3 lands, v1 is sunset — projects on v1 see "schema too old; re-bootstrap from current state" rather than a multi-step migration.

---

## 8. Module surface

The validator/parser ships as a TypeScript module with the following exports.

**Case convention:** YAML keys in the on-disk plan file use `snake_case` (§4.1). The parser converts to `camelCase` for the TypeScript types below. Round-tripping preserves the on-disk casing — TS-side mutations are re-serialized to `snake_case` by `serializePlan`.

```ts
// Types
type Plan = {
  schemaVersion: 1;
  decisions: PlanDecisions;
  detected: PlanDetected;
  bootstrap?: PlanBootstrap;
  body: PlanBody;             // structured: section list + per-section item list + opaque ranges
};

type PlanDecisions = { /* per §4.1 */ };
type PlanDetected   = { /* per §4.1 */ };
type PlanBootstrap  = { /* per §4.1 */ };
type PlanBody       = {
  opaqueLeading: string;                                              // content before the first H2
  sections: { name: string; items: { label: string; checked: boolean }[]; opaqueBefore: string }[];
  opaqueTrailing: string;                                             // content after the last section
};

type FingerprintInput = { fingerprint_schema_version: number; deps: Record<string, string | null>; presence: Record<string, boolean> };

// Operations
parsePlan(content: string): Plan | ParseError;
serializePlan(plan: Plan): string;                                     // round-trip stable modulo normalized newlines
validatePlan(plan: Plan): { ok: true } | { ok: false; violations: ValidationViolation[] };
markItemDone(plan: Plan, section: string, itemLabel: string): Plan;     // pure; throws if section/item not found
isComplete(plan: Plan): boolean;                                        // all canonical-section items checked
computeFingerprint(input: FingerprintInput): string;                    // returns "v1:<12 hex>"
diffFingerprint(stored: string, current: string): "match" | "drift" | "schema-bump";
```

### Round-trip property

`serializePlan(parsePlan(x))` is byte-equal to `x` modulo line-ending normalization (CRLF → LF). Opaque content is stored as raw byte ranges and re-emitted unchanged. This protects user edits (notes, prose, custom sub-headings) across orchestrator updates.

### Test coverage gates for Plan 1 implementation

- Round-trip golden files (greenfield, mid-migration, bootstrapped).
- Validation invariants (each §4.3 invariant — pass and fail cases).
- Fingerprint stability across OS line endings.
- Bootstrap synthesis given a fixture project tree.
- `markItemDone` no-op when item already checked; throw when item missing.

---

## 9. Open questions deferred to implementation

- **Validator package home** (Q3 from brainstorming). Decide when Plan 1 starts implementation. Options: standalone `@globalize-now/plan-spec`, hosted in `mcp-server`, or hosted in `cli`.
- **Test fixture corpus** — reuse `evals/fixtures.json` projects, or build a smaller dedicated corpus? Decide during Plan 1 task breakdown.
- **CLI lint command shape** — `npx @globalize-now/cli-client plan lint` vs. a separate binary. Decide alongside the validator package home.

---

## 10. Acceptance criteria

Plan 1 is done when:

1. The TypeScript module ships with the surface in §8 and 100% test coverage of validation invariants and fingerprint behavior.
2. A round-trip golden test passes for at least three plan-file fixtures: greenfield, mid-migration with reconciliation actions, and bootstrapped-from-existing-setup.
3. The Nuxt+JSON+ICU invariant rejects the eval finding #3 fixture deterministically.
4. The library/framework consistency invariant rejects a fixture with `library: next-intl` + `detected.framework: vite`.
5. Migration dispatch infrastructure exists and a unit test confirms `parsePlan` of a `schema_version: 1` document returns a Plan unchanged. (No actual v1→v2 migration ships in Plan 1; the goal is to prove the dispatch path is wired so future bumps don't require structural rework.)
6. The contract is documented in `docs/PLAN-FILE.md` (or equivalent) for downstream Plan 2/3/4 implementers.
