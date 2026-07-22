# Fix: managed conversion leaves data-module strings unwrapped

**Date:** 2026-07-22
**Skill:** `globalize-guide`
**Status:** Design — awaiting review

## Problem

Three managed-conversion runs (deepseek-v4-flash ×2, deepseek-v4-pro ×1) on a
Vite+React+Lingui app each left the **same 13 user-facing strings** unwrapped,
byte-for-byte identical across all three models. All 13 lived in
`src/data/products.ts` — a product-catalog data module of the shape
`export const products = [{ name: 'Wireless Headphones', description: '…' }]`.
typecheck/build/extract passed; the downstream `no-unlocalized-strings` lint gate
failed on exactly those 13.

## Root cause (confirmed structurally, not from the archived docs)

The failure is an **upstream detection-recall miss**, not a convert-guidance gap.

- **Convert guidance is already correct and predates the failure.** `code.md:31`
  (decision tree: "defined outside a component … → `msg\`text\`` to define,
  `t(descriptor)` to resolve") and `code.md:147` ("Constants imported from another
  module" — the exact `products.ts` case, wrap-at-definition-site spelled out)
  cover this precisely. `git log` puts this at 2026-04-17, months before the runs.
  The `code.md:285` skip-list (object keys/internal codes, ALL_CAPS, URLs,
  data-testid) is import-paths/testids/URLs — it does **not** exclude product data.
  **We do not touch the convert references.**

- **The break is in detection.** SKILL.md Phase 1 `candidateFiles` (`SKILL.md:151`)
  greps `src/**/*.{tsx,ts,jsx,js}` for three things: bare JSX text (`>Word<`),
  user-visible attrs (`placeholder=`/`aria-label=`/`title=`/`alt=`), and "exported
  user-facing string literals." A data module
  (`export const products = [{ name: '…' }]`) matches **none** of the first two,
  and the third only ambiguously — the `export const products =` value is an
  *array*, not a string literal, and the display strings are *nested property
  values*.

- **Reproduced (Step 1, ~$0).** Running the three grep rules against a
  `products.ts`-shaped fixture plus a normal `Navbar.tsx`: `Navbar.tsx` surfaces
  (bare text + attrs); `products.ts` surfaces in **none**. Deterministic and
  model-independent — matching the identical-across-models failure.

- **Consequence.** Phase 3.2 dispatches wrap subagents **only over the files
  listed in `plan.md`**, which come from `candidateFiles`. If `products.ts` is
  never a candidate, no subagent opens it, and the (correct) convert guidance
  never runs on it. Phase 3.5 verify then runs extract → compile → build →
  comment-review — **no unlocalized-strings check** — so nothing catches the miss
  before it ships.

## Findings that shape the fix

1. **Verify runs no lint today** (confirmed): Phase 3.5 for Lingui does
   extract_clean → compile → build_check → comment_review_pass only.
2. **Lingui already ships the exact rule.** The opt-in **ESLint Add-on 2**
   (`lingui/setup.add-ons.md:44`) installs `eslint-plugin-lingui` with
   `lingui/no-unlocalized-strings` — the same rule the eval gate uses, already
   tuned for false positives (`ignoreAttribute`/`ignoreFunction`). What is missing
   is *running it in verify + a cleanup loop*, not the rule itself.
3. **Per-library reality.** A clean `no-unlocalized-strings` rule exists only for
   **Lingui** (official). **next-intl** has no official plugin (community plugins
   lint call-site usage, not comprehensive hardcoded-string detection);
   **Paraglide** has none. **vue-i18n** has `@intlify/eslint-plugin-vue-i18n`
   (`no-raw-text`). So Option B is inherently *"real lint where it exists, grep
   fallback elsewhere."*
4. **Local eval harness is present and runnable here.** `evals/` drives the real
   skill via `claude -p` — Layer A (Phase 1 detect+plan, cheap) and Layer B
   (Phase 2 setup + Phase 3 convert, then `verify-string-wrapping.sh`). The
   sibling globalize.now `conversion-matrix` (deepseek cells, EVAL_SKILLS_DIR) is
   **not** checked out in this environment, so its ~$0.15 cell is deferred.
5. **`verify-string-wrapping.sh` gap.** Check 1's wrapper regex is
   `(Trans|t\(|msg\(|defineMessage)` — it matches `msg(` but **not** the
   `msg\`…\`` tagged-template macro form the data-module fix produces (nor
   `t\`…\``). The regression fixture asserts `products.ts` strings wrapped with
   `msg\`\``, so the checker needs this regex widened or it false-fails a correct
   fix.

## Approach — Option B (self-heal loop) + a narrow detection nudge

Two complementary layers. Layer 2 is the primary, general backstop; Layer 1 is
cheap insurance that handles the common case earlier and reduces how often the
loop fires. Chosen over "broaden detection alone" (whack-a-mole; the next miss is
toast helpers or error maps) and over "self-heal alone" (a round-trip for the
most common miss when a small detection tweak avoids it).

### Layer 1 — narrow detection nudge (`SKILL.md:151`, JS-TS `candidateFiles`)

Add a **fourth** grep target to the JS-TS `candidateFiles` rule: exported
object/array literals whose **display-copy-keyed** properties hold string
literals — property names matching
`name|title|label|heading|subheading|description|summary|body|text|message|caption|placeholder|tooltip|alt|cta|content`
with a plain string-literal value. Deliberately narrow: it does **not** match
`id`, `slug`, `sku`, `href`, `src`, `type`, `variant`, `icon`, `key`, or config
values. This is a recall layer — occasional over-match is fine because the wrap
subagent applies the `code.md:285` skip-list. Scope: JS-TS only (the failure and
corpus are JS); other languages rely on Layer 2 / their existing gates.

### Layer 2 — self-heal recall loop (Phase 3.5 verify + cleanup subagent)

A general backstop for **any** detection miss, not just data modules.

**New verify step `recall_self_check`** (after `build_check`), per library:
- **Lingui:** ensure `eslint-plugin-lingui` is present — if absent, install +
  configure it per Add-on 2 (single source of truth for the install and the
  tuned config). Guided mode: confirm before installing; unguided: apply
  (convert is already opted-in). Run `eslint` with `lingui/no-unlocalized-strings`
  scoped to `src/`; collect violations as `{file, line, text}`. Because verify
  installs the plugin, the project keeps it as a **permanent guardrail** — the
  "bonus" the fix calls for. If the user declines the install in guided mode,
  fall back to the grep recall scan for that run.
- **next-intl / Paraglide:** no reliable rule — run a **tuned grep recall scan**
  over the full source tree (the Layer-1 display-copy patterns + bare JSX text in
  files that were not candidates), excluding the `code.md:285` skip-list classes.
  Collect candidate `{file, line}`.
- **vue-i18n:** `@intlify/eslint-plugin-vue-i18n` `no-raw-text` if installed, else
  grep.

**Cleanup loop (orchestrator-driven).** If `recall_self_check` reports
violations, verify writes them to `progress/verify.json`
(`result.recallViolations`) and reports status `needs_cleanup`. The orchestrator
then, for up to **`maxCleanupRounds` (default 2)** rounds:
1. Dispatch a **`wrap-cleanup` subagent** over the distinct violating files —
   same prompt and references as a Phase 3.2 wrap subagent (so it reads `code.md`
   and applies the skip-list; recall supplies candidates, the subagent supplies
   precision).
2. The cleanup subagent, after wrapping, re-runs the library's catalog step so
   newly-wrapped strings land in the catalog (Lingui: `lingui extract --clean` +
   `compile`; Paraglide: `paraglide compile`; next-intl/vue-i18n: none — runtime
   catalogs), then re-runs the recall scan, writing residual `recallViolations`
   and the count it wrapped this round.
3. **Terminate** when: the recall scan is clean, **or** a round wrapped zero new
   strings (all residuals are correctly-skipped false positives — the grep-path
   terminator), **or** the round budget is hit. Any residual is **reported to the
   user, never silently dropped** (`log` what remains and why).

A soft **file cap** (e.g. 40 files) guards against a pathological recall blow-up
(that many missed files signals a detection catastrophe, not a cleanup job) —
cap dispatch and report.

Finally `comment_review_pass` runs over the now-complete wrapped set.

**Architecture fit.** Wrapping stays inside subagents (the orchestrator dispatches
`wrap-cleanup` the same way it dispatches Phase 3.2 wrap subagents), matching the
skill's "orchestrator never executes work directly" rule and the repo's
subagent-driven-development convention. Verify stays a gate that *reports*; it
does not itself wrap.

### Supporting changes

- **New reference** `references/languages/js-ts/convert.recall-self-check.md`:
  the recall scan mechanics (per-library recall tool + the tuned grep patterns +
  skip-list exclusions), the cleanup-loop control (rounds, termination, file cap,
  residual reporting), pointed to from the Phase 3.5 verify prompt. Keeps SKILL.md
  orchestrator-thin.
- **Plan skeleton** (`SKILL.md` plan.md verify section): add `recall_self_check`
  to the JS verify step list; document the `wrap-cleanup` partition.
- **Progress schema:** add `recallViolations`, `cleanupRounds`,
  `stringsWrappedInCleanup`, `residualViolations` to the verify `result`, and the
  `needs_cleanup` status value.
- **User-facing messaging:** Phase 3 start + 3.5/3.6 mention the recall self-check
  and report "wrapped N additional strings detection missed (self-heal)."
- **Reconcile Add-on 2:** it stays as the documented install/tuning recipe and the
  way to also wire the rule into CI; verify's `recall_self_check` reuses it rather
  than duplicating the install logic.

### Scope this pass

Concrete + validated for **Lingui** (the failing stack: real lint). Wired
generically for the other JS libraries (next-intl/Paraglide via the grep engine,
vue-i18n via its plugin/grep). **Out of scope, documented as follow-up:**
extending the same loop to Rails (`erb_lint HardCodedString`), Android
(`gradlew lint HardcodedText`), and Swift (grep) — their verify gates already
carry coverage checks and the failure is JS-specific.

## Validation (Step 3) — adapted to what runs here

- **Regression fixture (permanent guard).** Add a Vite+React+Lingui fixture with
  `src/data/products.ts` (13 display strings across `name`/`description`, matching
  the real failure) + a consumer component, derived from `fixtures/vite-swc`.
  Register in `evals/fixtures.json`; author detection + plan goldens; add
  `evals/expectations/<fixture>.json` listing the 13 strings under
  `wrapped_strings` with `file: "src/data/products.ts"`.
- **Harness fix.** Widen `verify-string-wrapping.sh` Check 1's wrapper regex to
  recognize the `msg\`…\`` and `t\`…\`` tagged-template forms, so a correct
  data-module wrap is detected rather than false-failed.
- **$0 tier.** Hand-apply the `msg\`\`` pattern to a copy of the fixture and run
  the four gates (tsc, build, `lingui extract`, `eslint lingui/no-unlocalized`) in
  a scratch install → confirm green, proving the target shape. Attempt locally;
  if the toolchain/network blocks the install, note the limitation.
- **Layer A assertion.** Add a strong `candidateFiles` assertion (the data-module
  file must be present) to exercise Layer 1 cheaply.
- **Layer B (`claude -p`).** Reproduce the miss before the fix (products strings
  bare → Check 1 fails), confirm 13→0 after. Runnable here but costs real
  tokens + ~5 min/run — gate behind explicit user go.
- **Deferred:** the sibling globalize.now `conversion-matrix` deepseek-v4-flash
  cell (~$0.15, 13→0) — globalize.now is not checked out here.

## Downstream follow-ups (globalize.now, not this repo)

- Re-bake the conversion-plane image (`image/stage.sh`) so the plane's baked copy
  of `globalize-guide` picks up this fix.
- Promote the regression fixture into the `conversion-matrix` corpus /
  `example-websites/typescript/` so it is a permanent guard there too.
- Run the deepseek-v4-flash eval cell on the fixture before/after → lint gate
  13→0.

## Non-goals

- Rewriting the convert references (they are correct).
- Making the permanent lint guardrail default-on for non-Lingui libraries (no
  reliable rule exists; grep self-check is the backstop there).
- A verify step that wraps strings itself (wrapping stays in subagents).
