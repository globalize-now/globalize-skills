# Data-Module Recall Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `globalize-guide` managed conversion from shipping unwrapped user-facing strings that live in data/content modules (`export const products = [{ name: '…' }]`), which the Phase 1 `candidateFiles` detection grep never surfaces.

**Architecture:** Two complementary layers. **Layer 1** widens the `candidateFiles` detection grep (`SKILL.md:151`) with a narrow rule for display-copy string literals in exported data modules, so the common case is wrapped in the normal Phase 3 pass. **Layer 2** adds a self-heal recall loop to Phase 3.5 verify: a per-library recall scan (Lingui = install + run `lingui/no-unlocalized-strings`; next-intl/Paraglide = tuned grep) finds any string that slipped through, the orchestrator dispatches a `wrap-cleanup` subagent (reusing Phase 3.2 wrap machinery + the `code.md` skip-list for precision), re-scans, and loops to a bounded budget. A regression fixture + local eval-harness wiring makes it a permanent guard.

**Tech Stack:** Markdown skill prose (`SKILL.md`, `references/**`), JSON (`manifest.json`, eval goldens/expectations), Bash (`evals/**`), Vite + React 19 + Lingui + `eslint-plugin-lingui` (fixture + gates).

## Global Constraints

- **Do NOT rewrite the convert references** (`code.md`, `convert.standard-react.md`). They are correct and predate the failure. Only the detection rule, the verify phase, a new recall reference, and the eval harness change.
- **Pin every package install to a SemVer-major caret**, single-quoted in shell so zsh `EXTENDED_GLOB` doesn't eat the caret. The recall lint uses `'eslint-plugin-lingui@^0.14'` (matches `lingui/setup.add-ons.md:54`; bump only if the published current major has advanced — confirm with `npm view eslint-plugin-lingui version`).
- **`eslint-plugin-lingui` install is the single source of truth in Add-on 2** (`references/languages/js-ts/libraries/lingui/setup.add-ons.md:44`). The verify recall step reuses that recipe (install + tuned `ignoreAttribute`/`ignoreFunction` config), never duplicates it.
- **Orchestrator never executes work directly.** All file wrapping happens inside subagents. The `wrap-cleanup` subagent is dispatched by the orchestrator exactly like Phase 3.2 wrap subagents; the verify subagent *reports* violations, it does not wrap.
- **BCP47 locale variables are named `locale`** in any emitted code (HTML `lang`/DOM `.lang` stay). Not central here but applies to fixture code.
- **Guided vs unguided consent:** the verify recall step installs `eslint-plugin-lingui` only after confirming in **guided** mode; in **unguided** mode it installs directly (convert is already opted-in). If the user declines in guided mode, fall back to the grep recall scan for that run.
- **No silent caps:** if the cleanup loop stops with residual violations (budget hit or a round wrapped zero new strings), `log()`/report exactly what remains and why.
- **Commits:** no `Co-Authored-By: Claude` trailer, no "Generated with Claude Code" line (user global rule). Do not push; commit locally only. Branch is the worktree branch `worktree-robust-doodling-summit`.
- **Scope this pass:** concrete + validated for **Lingui**; wired generically for the other JS libraries (next-intl/Paraglide grep, vue-i18n plugin/grep). Rails/Android/Swift extension is an explicit follow-up, not built here.

---

## File Structure

**New files:**
- `fixtures/vite-swc-data-module/` — standalone `local` regression fixture (Vite+React+Lingui) with a data module that reproduces the miss.
- `references/languages/js-ts/convert.recall-self-check.md` — the recall-scan + cleanup-loop reference, pointed to from the Phase 3.5 verify prompt.
- `evals/expectations/vite-swc-data-module.json` — string-wrapping expectation listing the 13 data-module strings.
- `evals/expectations/detection/vite-swc-data-module.json` — detection golden with a `candidateFilesMustContain` assertion for the data-module file.

**Modified files:**
- `skills/globalize-guide/SKILL.md` — `candidateFiles` rule (`:151`, Layer 1); Phase 3.5 verify prompt + cleanup loop (Layer 2); plan skeleton verify step list; progress schema; Phase 3 user-facing messages.
- `evals/verify-string-wrapping.sh` — Check 1 wrapper regex widened to recognize `msg\`…\`` / `t\`…\`` tagged-template forms.
- `evals/verify-orchestration.sh` — support a `softAssert.candidateFilesMustContain` list assertion.
- `evals/fixtures.json` — register `vite-swc-data-module`.

---

## Task 1: Harness capability — recognize tagged-template wraps + assert candidateFiles containment

**Files:**
- Modify: `evals/verify-string-wrapping.sh` (Check 1 regex, ~line 44)
- Modify: `evals/verify-orchestration.sh` (softAssert block, after `candidateFilesMinCount`)

**Interfaces:**
- Produces: `verify-string-wrapping.sh` Check 1 recognizes a string wrapped as `msg\`…\``, `t\`…\``, `<Trans>`, `t(`, `msg(`, or `defineMessage`. `verify-orchestration.sh` reads `.softAssert.candidateFilesMustContain` (array of substrings) from a detection golden and warns per missing entry.

- [ ] **Step 1: Write the failing test for the wrapper regex**

Create a throwaway probe (do not commit):
```bash
cat > /tmp/wrap-probe.tsx <<'EOF'
export const products = [
  { id: 'sku-1', name: msg`Wireless Headphones`, description: msg`Premium noise-cancelling headphones.` },
]
EOF
# Current regex from verify-string-wrapping.sh:
grep -nF 'Wireless Headphones' /tmp/wrap-probe.tsx | grep -qE '(Trans|t\(|msg\(|defineMessage)' && echo "MATCH" || echo "NO MATCH"
```
Expected: `NO MATCH` (the current regex misses `msg\`…\``).

- [ ] **Step 2: Widen the regex in `verify-string-wrapping.sh`**

Find (in Check 1):
```bash
    if echo "$CONTEXT" | grep -qE '(Trans|t\(|msg\(|defineMessage)'; then
```
Replace with (adds the tagged-template macro forms `msg\`` and `t\``, and `Plural`/`Select` JSX macros):
```bash
    if echo "$CONTEXT" | grep -qE '(<Trans|<Plural|<Select|useLingui|t\(|t`|msg\(|msg`|defineMessage)'; then
```

- [ ] **Step 3: Re-run the probe to verify it now matches**

Run:
```bash
grep -nF 'Wireless Headphones' /tmp/wrap-probe.tsx | grep -qE '(<Trans|<Plural|<Select|useLingui|t\(|t`|msg\(|msg`|defineMessage)' && echo "MATCH" || echo "NO MATCH"
```
Expected: `MATCH`. Then `rm /tmp/wrap-probe.tsx`.

- [ ] **Step 4: Add `candidateFilesMustContain` support to `verify-orchestration.sh`**

Immediately after the `candidateFilesMinCount` softAssert block (the `if [ -n "$CANDIDATE_MIN" ]; then … fi` inside the detection section), insert:
```bash
    # softAssert: candidateFilesMustContain (warn, not fail) — each substring must
    # appear in at least one candidateFiles[].path. Guards detection-recall for
    # specific file shapes (e.g. data/content modules) without over-constraining
    # the content-sensitive candidate ranking.
    MUST_CONTAIN=$(jq -r '.softAssert.candidateFilesMustContain // [] | .[]' "$EXPECTED_DETECTION_FILE")
    while IFS= read -r NEEDLE; do
      [ -z "$NEEDLE" ] && continue
      if jq -e --arg n "$NEEDLE" '.candidateFiles // [] | any(.path | contains($n))' "$DETECTION_JSON" >/dev/null 2>&1; then
        pass "candidateFiles contains a path matching '$NEEDLE'"
      else
        warn "candidateFiles has no path matching '$NEEDLE' — detection may miss this file shape"
      fi
    done <<< "$MUST_CONTAIN"
```

- [ ] **Step 5: Test the new assertion with fixtures**

Run:
```bash
mkdir -p /tmp/cf-test/.globalize
cat > /tmp/cf-test/.globalize/detection.json <<'EOF'
{ "candidateFiles": [ { "path": "src/data/products.ts", "matchCount": 3 } ] }
EOF
DETECTION_JSON=/tmp/cf-test/.globalize/detection.json
jq -e --arg n "src/data/products.ts" '.candidateFiles // [] | any(.path | contains($n))' "$DETECTION_JSON" && echo OK
jq -e --arg n "src/data/missing.ts" '.candidateFiles // [] | any(.path | contains($n))' "$DETECTION_JSON" || echo "correctly absent"
rm -rf /tmp/cf-test
```
Expected: prints `true`/`OK`, then `false`/`correctly absent`.

- [ ] **Step 6: Commit**

```bash
git add evals/verify-string-wrapping.sh evals/verify-orchestration.sh
git commit -m "test(evals): recognize tagged-template wraps and assert candidateFiles containment"
```

---

## Task 2: Regression fixture (red state — reproduces the miss)

**Files:**
- Create: `fixtures/vite-swc-data-module/` (copy of `fixtures/vite-swc` + data module + consumer)
- Create: `evals/expectations/vite-swc-data-module.json`
- Create: `evals/expectations/detection/vite-swc-data-module.json`
- Modify: `evals/fixtures.json` (register the fixture)

**Interfaces:**
- Consumes: Task 1's harness capabilities (`candidateFilesMustContain`, widened wrapper regex).
- Produces: a `local` positive fixture `vite-swc-data-module` whose `src/data/products.ts` holds exactly 13 display strings under display-copy keys plus decoy identifier keys.

- [ ] **Step 1: Copy the vite-swc scaffold**

```bash
cd /Users/arturs/Projects/globalize/globalization-skills/.claude/worktrees/robust-doodling-summit
rm -rf fixtures/vite-swc-data-module
cp -R fixtures/vite-swc fixtures/vite-swc-data-module
rm -f fixtures/vite-swc-data-module/package-lock.json   # regenerated on install; keep the fixture lean
```

- [ ] **Step 2: Rename the fixture package and add the data module**

Edit `fixtures/vite-swc-data-module/package.json` — change `"name": "vite-swc-fixture"` to `"name": "vite-swc-data-module-fixture"`.

Create `fixtures/vite-swc-data-module/src/data/products.ts` (exactly 13 display strings under `name`/`description`/`label`; `id`/`slug`/`price` are decoys that must NOT be wrapped):
```ts
export const products = [
  { id: 'sku-01', slug: 'wireless-headphones', price: 299, name: 'Wireless Headphones', description: 'Premium noise-cancelling over-ear headphones with 30-hour battery life.' },
  { id: 'sku-02', slug: 'smart-watch', price: 199, name: 'Smart Watch', description: 'Track your fitness, sleep, and notifications on the go.' },
  { id: 'sku-03', slug: 'mechanical-keyboard', price: 149, name: 'Mechanical Keyboard', description: 'Tactile hot-swappable switches for a satisfying typing experience.' },
  { id: 'sku-04', slug: 'usb-c-hub', price: 59, name: 'USB-C Hub', description: 'Seven ports in a compact aluminium body.' },
  { id: 'sku-05', slug: 'desk-lamp', price: 79, name: 'Desk Lamp', description: 'Adjustable warmth and brightness for late-night work.' },
]

export const categories = [
  { id: 'cat-audio', label: 'Audio' },
  { id: 'cat-wearables', label: 'Wearables' },
  { id: 'cat-accessories', label: 'Accessories' },
]
```
(5 products × name+description = 10, + 3 category labels = **13** display strings.)

- [ ] **Step 3: Add a consumer and wire it into App**

Create `fixtures/vite-swc-data-module/src/components/ProductList.tsx`:
```tsx
import { products, categories } from '../data/products'

export function ProductList() {
  return (
    <section>
      <h2>Featured products</h2>
      <ul>
        {categories.map((c) => (
          <li key={c.id}>{c.label}</li>
        ))}
      </ul>
      <ul>
        {products.map((p) => (
          <li key={p.id}>
            <h3>{p.name}</h3>
            <p>{p.description}</p>
            <button>Add to cart</button>
          </li>
        ))}
      </ul>
    </section>
  )
}
```
Replace `fixtures/vite-swc-data-module/src/App.tsx` with:
```tsx
import { ProductList } from './components/ProductList'

function App() {
  return (
    <div>
      <h1>Our Store</h1>
      <ProductList />
    </div>
  )
}

export default App
```
(`Featured products`, `Add to cart`, `Our Store` are *detectable* strings — the normal wrap pass catches them; the 13 in `products.ts` are the ones detection misses.)

- [ ] **Step 4: Confirm the miss reproduces (deterministic, $0)**

Run the three `candidateFiles` grep rules (SKILL.md:151, pre-fix) against the fixture:
```bash
cd fixtures/vite-swc-data-module
echo "Data module surfaces in pre-fix candidateFiles rules?"
grep -rlE '>[A-Za-z]|placeholder=|aria-label=|title=|alt=|export (const|let|var) [A-Za-z0-9_]+ *(:[^=]*)?= *["'\''`]' src/data/products.ts && echo "SURFACED (unexpected)" || echo "NOT SURFACED — miss reproduced"
cd -
```
Expected: `NOT SURFACED — miss reproduced`.

- [ ] **Step 5: Author the string-wrapping expectation**

Create `evals/expectations/vite-swc-data-module.json`:
```json
{
  "wrapped_strings": [
    { "file": "src/data/products.ts", "original": "Wireless Headphones" },
    { "file": "src/data/products.ts", "original": "Premium noise-cancelling over-ear headphones with 30-hour battery life." },
    { "file": "src/data/products.ts", "original": "Smart Watch" },
    { "file": "src/data/products.ts", "original": "Track your fitness, sleep, and notifications on the go." },
    { "file": "src/data/products.ts", "original": "Mechanical Keyboard" },
    { "file": "src/data/products.ts", "original": "Tactile hot-swappable switches for a satisfying typing experience." },
    { "file": "src/data/products.ts", "original": "USB-C Hub" },
    { "file": "src/data/products.ts", "original": "Seven ports in a compact aluminium body." },
    { "file": "src/data/products.ts", "original": "Desk Lamp" },
    { "file": "src/data/products.ts", "original": "Adjustable warmth and brightness for late-night work." },
    { "file": "src/data/products.ts", "original": "Audio" },
    { "file": "src/data/products.ts", "original": "Wearables" },
    { "file": "src/data/products.ts", "original": "Accessories" }
  ],
  "min_files_with_trans": 2,
  "min_extracted_messages": 13
}
```

- [ ] **Step 6: Author the detection golden**

Create `evals/expectations/detection/vite-swc-data-module.json`:
```json
{
  "match": {
    "framework": "vite", "compiler": "swc",
    "react": true, "vue": false, "typescript": true,
    "packageManager": "npm", "sourceDir": "src",
    "existing": { "library": "none", "configured": false, "providerWired": false,
                  "catalogsScaffolded": false, "stringsWrapped": "no" }
  },
  "ignore": ["candidateFiles", "routeEntries", "git", "localeSignals", "router", "version", "platform", "buildSystem", "uiFramework", "svelte"],
  "softAssert": {
    "candidateFilesMinCount": 2,
    "candidateFilesMustContain": ["src/data/products.ts"]
  }
}
```

- [ ] **Step 7: Register the fixture in `evals/fixtures.json`**

Add this entry to the top-level object (after the `vite-swc` entry):
```json
  "vite-swc-data-module": {
    "category": "positive",
    "type": "local",
    "path": "fixtures/vite-swc-data-module",
    "library": "lingui",
    "variant": "vite-swc-lingui",
    "expectedDetection": "evals/expectations/detection/vite-swc-data-module.json"
  },
```
Validate JSON: `jq . evals/fixtures.json >/dev/null && echo OK`.

- [ ] **Step 8: Commit**

```bash
git add fixtures/vite-swc-data-module evals/expectations/vite-swc-data-module.json evals/expectations/detection/vite-swc-data-module.json evals/fixtures.json
git commit -m "test(fixtures): add vite-swc-data-module regression fixture (13 unwrapped data-module strings)"
```

---

## Task 3: Layer 1 — narrow detection nudge in `candidateFiles`

**Files:**
- Modify: `skills/globalize-guide/SKILL.md:151` (JS-TS `candidateFiles` detection rule)

**Interfaces:**
- Consumes: Task 2's fixture as the red→green target.
- Produces: the JS-TS `candidateFiles` rule surfaces display-copy string literals in exported data/content modules.

- [ ] **Step 1: Write the failing structural test**

The nudge target is a grep pattern for display-copy-keyed string literals. Confirm it currently returns nothing conflated with the miss — establish the red proxy:
```bash
cd /Users/arturs/Projects/globalize/globalization-skills/.claude/worktrees/robust-doodling-summit
grep -rlE "(name|title|label|heading|subheading|description|summary|body|text|message|caption|placeholder|tooltip|alt|cta|content) *: *[\"'\`][^\"'\`]" fixtures/vite-swc-data-module/src/data/products.ts && echo "PATTERN MATCHES products.ts" || echo "no match"
```
Expected: `PATTERN MATCHES products.ts` (the pattern itself is sound). The "red" is that SKILL.md:151 does not yet include this pattern, so the model's detection misses it.

- [ ] **Step 2: Edit the `candidateFiles` rule (SKILL.md:151)**

Find:
```
> | `candidateFiles` | Glob `src/**/*.{tsx,ts,jsx,js,svelte}`, exclude tests/configs/`.d.ts`, grep each for: bare markup text (`>Word<`, including Svelte template text), user-visible attrs (`placeholder=`, `aria-label=`, `title=`, `alt=`), exported user-facing string literals. Return files with ≥1 match, sorted by match count desc. |
```
Replace with:
```
> | `candidateFiles` | Glob `src/**/*.{tsx,ts,jsx,js,svelte}`, exclude tests/configs/`.d.ts`, grep each for: bare markup text (`>Word<`, including Svelte template text), user-visible attrs (`placeholder=`, `aria-label=`, `title=`, `alt=`), exported user-facing string literals, **and display-copy string literals inside exported data/content modules** — string *values* under object/array keys whose name matches `name`, `title`, `label`, `heading`, `subheading`, `description`, `summary`, `body`, `text`, `message`, `caption`, `placeholder`, `tooltip`, `alt`, `cta`, or `content` (e.g. `export const products = [{ name: '…', description: '…' }]`). Deliberately narrow — do **not** treat identifier/config keys as display copy (`id`, `slug`, `sku`, `key`, `href`, `src`, `type`, `variant`, `icon`, `role`, `className`, `testid`); those are covered by the `code.md` skip-list and must not inflate the candidate set. This is a recall signal: a data module matching it becomes a wrap candidate so a Phase 3 subagent opens it; the subagent still applies the skip-list, so occasional over-match is harmless. Return files with ≥1 match, sorted by match count desc. |
```

- [ ] **Step 3: Verify the target string shape is captured**

Confirm the fixture's data module would now surface under the new rule's pattern while decoys are excluded:
```bash
# display-copy keys match:
grep -oE "(name|description|label) *: *'[^']+'" fixtures/vite-swc-data-module/src/data/products.ts | wc -l   # expect 13
# identifier keys do NOT match the display-copy key set:
grep -oE "(id|slug) *: *'[^']+'" fixtures/vite-swc-data-module/src/data/products.ts | wc -l                  # expect 13 (decoys present, but excluded by rule)
```
Expected: first count `13` (all display strings caught), confirming the pattern's recall. (The decoys exist to prove the rule's key-name exclusion.)

- [ ] **Step 4: Commit**

```bash
git add skills/globalize-guide/SKILL.md
git commit -m "fix(globalize-guide): surface data-module display strings in candidateFiles detection"
```

---

## Task 4: Layer 2a — recall self-check reference + progress schema

**Files:**
- Create: `references/languages/js-ts/convert.recall-self-check.md`
- Modify: `skills/globalize-guide/SKILL.md` (progress-file schema section, add verify `result` fields + `needs_cleanup` status)

**Interfaces:**
- Produces: `convert.recall-self-check.md` (the recall-scan mechanics + cleanup-loop control), referenced by the Phase 3.5 verify prompt (Task 5). Progress schema gains `recallViolations`, `cleanupRounds`, `stringsWrappedInCleanup`, `residualViolations`, and the `needs_cleanup` status value.

- [ ] **Step 1: Create the recall self-check reference**

Create `references/languages/js-ts/convert.recall-self-check.md`:
````markdown
# Convert: recall self-check + cleanup loop (JS/TS)

The Phase 1 `candidateFiles` detection grep is recall-limited: it surfaces JSX
text, user-visible attrs, exported string literals, and (since the data-module
nudge) display-copy keys in data modules — but it cannot catch every shape of
user-facing string (dynamic content maps, toast/error helpers, email templates,
config-driven copy). Any file it misses is never opened by a Phase 3.2 wrap
subagent, so its strings ship unwrapped. This self-check is the **backstop**: it
scans the *whole* source tree after the build passes, and feeds anything still
unwrapped into a bounded cleanup loop.

## Recall scan (per library)

Run **after** `build_check`, over the project's source root (e.g. `src/`),
excluding tests, stories, configs, and `.d.ts`.

- **Lingui — authoritative lint.** Ensure `eslint-plugin-lingui` is installed and
  configured per **Add-on 2** (`references/languages/js-ts/libraries/lingui/setup.add-ons.md`)
  — the single source of truth for the install (`'eslint-plugin-lingui@^0.14'`)
  and the tuned `no-unlocalized-strings` config (`ignoreAttribute`,
  `ignoreFunction`). Consent rule: **guided** mode → describe and confirm before
  installing; **unguided** mode → install directly. If the user declines in
  guided mode, use the grep scan below for this run. Then run the project's ESLint
  over the source root reporting only `lingui/no-unlocalized-strings`, e.g.:
  ```bash
  npx eslint 'src/**/*.{ts,tsx,js,jsx}' --rule '{"lingui/no-unlocalized-strings":"error"}' --format json
  ```
  Parse the JSON into `{ file, line, text }` violations. Because verify installs
  the plugin, the project keeps it as a **permanent guardrail** — the intended
  bonus.
- **next-intl / Paraglide — no reliable rule → tuned grep scan.** There is no
  officially-maintained `no-unlocalized-strings` equivalent (see each library's
  `setup.add-ons.md`). Scan the full source root for: bare JSX text (`>[A-Za-z]`),
  user-visible attrs (`placeholder=`/`aria-label=`/`title=`/`alt=`), and
  display-copy string literals under keys
  `name|title|label|heading|subheading|description|summary|body|text|message|caption|placeholder|tooltip|alt|cta|content`.
  Exclude the `code.md` skip-list classes: CSS class names, `console`/debug,
  import paths, object keys / internal codes, `ALL_CAPS` enums, `data-testid`,
  URLs/API paths, and identifier keys (`id`/`slug`/`sku`/`key`/`href`/`src`/`type`/`variant`/`icon`/`role`). Emit
  `{ file, line, text }` candidates. This scan needs **recall only** — the cleanup
  subagent supplies precision.
- **vue-i18n:** `@intlify/eslint-plugin-vue-i18n` `no-raw-text` if installed
  (consent as for Lingui), else the grep scan above adapted to `.vue` templates.

Write the violations to `progress/verify.json` as `result.recallViolations`. If
the list is empty, the recall gate passes — set status `succeeded` as usual. If
non-empty, set status `needs_cleanup` and stop (the orchestrator drives the loop).

## Cleanup loop (orchestrator-driven)

The orchestrator, on `needs_cleanup`, loops up to **`maxCleanupRounds` (default
2)** rounds:

1. **File cap.** If `recallViolations` spans more than **40 distinct files**, that
   is a detection catastrophe, not a cleanup job: cap the dispatch to the 40
   highest-violation files, `log()` how many files were dropped, and continue —
   never silently truncate.
2. **Dispatch a `wrap-cleanup` subagent** over the distinct violating files. Its
   prompt mirrors the Phase 3.2 wrap subagent (same `references.convert` +
   `references.code`), with the file list = the recall violations, and the note:
   *"These files were MISSED by detection. Wrap genuine user-facing strings per the
   convert reference and the `code.md` decision tree — for strings defined outside
   a component (data/content modules) use `msg\`text\`` at the definition site and
   resolve with `t(descriptor)` at the call site (`code.md` → 'Constants imported
   from another module'). Apply the `code.md` 'What not to wrap' skip-list: leave
   identifiers, slugs, SKUs, enum values, URLs, class names, and `data-testid`
   untouched. If a flagged string is genuinely non-translatable, leave it and note
   it — do not force a wrap."*
3. **Re-catalog + re-scan (inside the same subagent).** After wrapping, re-run the
   library's catalog step so newly-wrapped strings extract (Lingui:
   `npx lingui extract --clean` + `npx lingui compile`; Paraglide:
   `npx '@inlang/paraglide-js@^2' compile …`; next-intl/vue-i18n: none — runtime
   catalogs), then re-run the recall scan and write the residual
   `result.recallViolations` and `result.stringsWrappedInCleanup` (count wrapped
   this round).
4. **Terminate** when any holds: (a) the recall scan is clean; (b) the round
   wrapped **zero** new strings (the residuals are correctly-skipped false
   positives — the grep-path terminator); (c) `maxCleanupRounds` is reached. On
   (b)/(c) with residuals, **report them to the user** with file+line and the
   reason (`residualViolations`) — never drop them silently.

Record `result.cleanupRounds`. After the loop, run `comment_review_pass` over the
now-complete wrapped set (including the cleanup wraps).

## Why recall-then-judge is safe

The recall scan is deliberately over-inclusive; precision comes from the
`wrap-cleanup` subagent reading `code.md` and applying its skip-list. A raw grep
hit on a SKU or class name is surfaced but *not* wrapped, because the subagent
judges each candidate exactly as a normal Phase 3.2 wrap subagent would. This is
the same recall/precision split the detection→wrap pipeline already uses.
````

- [ ] **Step 2: Verify the reference exists and carries the control elements**

Run:
```bash
cd /Users/arturs/Projects/globalize/globalization-skills/.claude/worktrees/robust-doodling-summit
for needle in "recallViolations" "needs_cleanup" "maxCleanupRounds" "wrap-cleanup" "eslint-plugin-lingui@^0.14" "40 distinct files"; do
  grep -qF "$needle" references/languages/js-ts/convert.recall-self-check.md && echo "OK: $needle" || echo "MISSING: $needle"
done
```
Expected: all `OK`.

- [ ] **Step 3: Extend the progress-file schema in SKILL.md**

In the "Progress file schema (per subagent)" section (~line 804), the `status` enum lists `pending|running|succeeded|failed|needs_decision`. Change it to add `needs_cleanup`:
```
  "status": "pending|running|succeeded|failed|needs_decision|needs_cleanup",
```
Then, in the verify `result` documentation in Phase 3.5 (the `Write \`result\` with { … }` sentence, ~line 599), append the new fields. Find the start of that sentence:
```
> Write `result` with `{ catalogPath, totalMessages, extractOk, compileOk, buildOk, commentsAdded }`.
```
Replace with:
```
> Write `result` with `{ catalogPath, totalMessages, extractOk, compileOk, buildOk, commentsAdded, recallViolations, cleanupRounds, stringsWrappedInCleanup, residualViolations }` — the last four are the recall self-check fields (`recallViolations`: `[{file,line,text}]` from the scan; `cleanupRounds`: how many cleanup rounds ran; `stringsWrappedInCleanup`: total strings the cleanup subagents wrapped; `residualViolations`: any left when the loop stopped, reported to the user). For libraries with no recall scan run (Rails/Android/Swift this pass), set all four to `null`.
```

- [ ] **Step 4: Commit**

```bash
git add references/languages/js-ts/convert.recall-self-check.md skills/globalize-guide/SKILL.md
git commit -m "feat(globalize-guide): add recall self-check reference and verify progress schema"
```

---

## Task 5: Layer 2b — wire the recall step + cleanup loop into Phase 3.5

**Files:**
- Modify: `skills/globalize-guide/SKILL.md` — Phase 3.5 verify prompt (Lingui/next-intl/vue-i18n branch + Paraglide branch), a new cleanup-loop subsection, the plan skeleton verify steps, and Phase 3 user-facing messages.

**Interfaces:**
- Consumes: `convert.recall-self-check.md` (Task 4), `needs_cleanup` status + `recallViolations` schema (Task 4), the Phase 3.2 wrap dispatch prompt (mirrored).
- Produces: Phase 3.5 runs `recall_self_check` and the orchestrator drives the bounded cleanup loop.

- [ ] **Step 1: Add `recall_self_check` to the Lingui / next-intl / vue-i18n verify step list**

In Phase 3.5, the "For Lingui / next-intl / vue-i18n:" numbered list ends at step 4 (comment review). Insert a new step **between** step 3 (build) and step 4 (comment review). Find:
```
> 3. Run the project's typecheck and build command. Capture pass/fail.
> 4. Read the extracted catalog. For entries lacking translator comments where the heuristic in the reference says one should exist (single-/two-word phrases, action labels without object, domain-sensitive terms), edit the source file to add the missing comment.
```
Replace with:
```
> 3. Run the project's typecheck and build command. Capture pass/fail.
> 4. **Recall self-check (backstop for detection misses).** Following `references/languages/js-ts/convert.recall-self-check.md`, scan the full source root for user-facing strings that were never wrapped — Lingui: install + run `lingui/no-unlocalized-strings` (per Add-on 2; guided-mode consent before installing, unguided installs directly; declined → grep scan); next-intl: tuned grep scan; vue-i18n: `@intlify/eslint-plugin-vue-i18n` `no-raw-text` or grep. Write findings to `result.recallViolations`. If **empty**, continue to step 5. If **non-empty**, write `status: "needs_cleanup"` and stop — the orchestrator runs the cleanup loop (below) and re-dispatches verify from step 4 until the recall scan is clean or the budget is hit.
> 5. Read the extracted catalog. For entries lacking translator comments where the heuristic in the reference says one should exist (single-/two-word phrases, action labels without object, domain-sensitive terms), edit the source file to add the missing comment.
```

- [ ] **Step 2: Add the recall step to the Paraglide verify branch**

In the "For Paraglide:" numbered list, after step 2 (compile + plural check + PO comment review), append:
```
> 3. **Recall self-check.** Paraglide has no official `no-unlocalized-strings` rule (see `paraglide/setup.add-ons.md`), so run the tuned grep scan from `references/languages/js-ts/convert.recall-self-check.md` over `src/` (adapted to `.svelte` templates). Write `result.recallViolations`; on non-empty, `status: "needs_cleanup"` and let the orchestrator run the cleanup loop (the cleanup subagent authors the missing `m.key()` entries per the Paraglide convert reference).
```

- [ ] **Step 3: Add the cleanup-loop subsection after 3.5**

After the Phase 3.5 verify prompt block ends (before "### 3.6 Cost estimate"), insert:
```
#### 3.5.1 Cleanup loop (JS/TS recall backstop)

If the verify subagent returns `status: "needs_cleanup"` with `result.recallViolations`, the orchestrator self-heals the missed strings — this is the backstop for any `candidateFiles` detection miss (data modules, toast/error helpers, config copy). Drive it per `references/languages/js-ts/convert.recall-self-check.md`:

For up to `maxCleanupRounds` (default **2**) rounds:
1. Collect the distinct files in `recallViolations`. If more than **40**, cap to the 40 highest-violation files and surface how many were dropped (no silent truncation).
2. Dispatch a **`wrap-cleanup` subagent** (background, same dispatch pattern as Phase 3.2) whose prompt mirrors the Phase 3.2 wrap prompt — same `manifest-snapshot.references.convert` + `references.code` — with the file list = the violating files and the "these files were MISSED by detection; wrap per `code.md`, apply the skip-list, leave genuine non-translatables" note from the recall reference. Pre-create `progress/wrap-cleanup-{round}.json`.
3. When it terminates, re-dispatch the verify subagent from its recall step (re-extract/compile, re-scan). Read the new `recallViolations`.
4. Stop when: the scan is clean; **or** a round wrapped zero new strings (`stringsWrappedInCleanup === 0`); **or** the round budget is reached. Report any `residualViolations` to the user with file+line (never drop silently).

Record `result.cleanupRounds` and surface a one-line summary: "Self-heal wrapped **{stringsWrappedInCleanup}** strings that detection missed{, N left for manual review if residual}." Then proceed to `comment_review_pass` and 3.6.

Rails/Android/Swift do not run this loop this pass — their verify gates (`i18n-tasks missing -t used`, `./gradlew lint`, catalog integrity) already report coverage; extending the loop to them (`erb_lint`, `gradlew` `HardcodedText`, grep) is a follow-up.
```

- [ ] **Step 4: Add `recall_self_check` to the plan.md verify skeleton**

In the plan.md skeleton "### verify" block, the Lingui/next-intl/vue-i18n list is:
```
<!-- compile-time extraction (Lingui) and runtime-catalog (next-intl, vue-i18n): -->
- [ ] extract_clean
- [ ] compile
- [ ] build_check
- [ ] comment_review_pass
```
Change to:
```
<!-- compile-time extraction (Lingui) and runtime-catalog (next-intl, vue-i18n): -->
- [ ] extract_clean
- [ ] compile
- [ ] build_check
- [ ] recall_self_check   <!-- JS/TS backstop: scan for unwrapped strings, self-heal via wrap-cleanup subagents (see convert.recall-self-check.md); ≤2 rounds -->
- [ ] comment_review_pass
```
And in the Paraglide comment block just below, add `- [ ] recall_self_check` after `build_check`.

- [ ] **Step 5: Update the Phase 3 user-facing messages**

In the Phase 3 start message (~line 522), the verify clause for JS/TS reads `runs extract + compile + build to make sure everything still type-checks and the catalog is clean`. Change it to:
```
runs extract + compile + build, then a recall self-check that catches any user-facing string the first pass missed (data modules, helpers) and self-heals it, so nothing ships unwrapped
```
In the 3.6 completion message (~line 605), after the catalog line, the orchestrator should include (when `stringsWrappedInCleanup > 0`) the self-heal summary from 3.5.1.

- [ ] **Step 6: Verify the wiring is internally consistent**

Run:
```bash
cd /Users/arturs/Projects/globalize/globalization-skills/.claude/worktrees/robust-doodling-summit
for needle in "recall_self_check" "3.5.1 Cleanup loop" "wrap-cleanup" "convert.recall-self-check.md" "needs_cleanup"; do
  grep -qF "$needle" skills/globalize-guide/SKILL.md && echo "OK: $needle" || echo "MISSING: $needle"
done
```
Expected: all `OK`.

- [ ] **Step 7: Commit**

```bash
git add skills/globalize-guide/SKILL.md
git commit -m "feat(globalize-guide): run recall self-check + cleanup loop in convert verify"
```

---

## Task 6: $0 validation gate — hand-apply `msg\`\`` and prove the four gates green

**Files:**
- Test only (scratch dir). No committed source changes; the fixture stays in its "before" (unwrapped) state — the *wrapped* form is proven here to lock the target shape.

**Interfaces:**
- Consumes: Task 2 fixture, Add-on 2 install recipe.
- Produces: evidence that a correctly `msg`-wrapped data module passes tsc + build + `lingui extract` + `lingui/no-unlocalized-strings` (i.e. the fix's target is achievable and the eval gate would go 13→0).

- [ ] **Step 1: Copy the fixture to a scratch dir and add Lingui config**

```bash
SCRATCH=$(mktemp -d)
cp -R /Users/arturs/Projects/globalize/globalization-skills/.claude/worktrees/robust-doodling-summit/fixtures/vite-swc-data-module/. "$SCRATCH"/
cd "$SCRATCH"
echo "$SCRATCH"
```
Add a minimal `lingui.config.ts`:
```ts
import { defineConfig } from '@lingui/cli'
export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'de'],
  catalogs: [{ path: '<rootDir>/src/locales/{locale}/messages', include: ['src'] }],
})
```

- [ ] **Step 2: Install deps + Lingui + the recall lint (pinned)**

```bash
npm install
npm install --save-dev '@lingui/cli@^5' '@lingui/core@^5' '@lingui/react@^5' '@lingui/vite-plugin@^5' 'babel-plugin-macros@^3' 'eslint@^9' 'eslint-plugin-lingui@^0.14'
```
(If a pin is stale, confirm with `npm view <pkg> version` and adjust to the current major — do not un-pin.) If the environment has no network and the install fails, **stop and record the limitation** in the final report; the $0 gate is then deferred with the Layer B / deepseek runs.

- [ ] **Step 3: Hand-apply the `msg\`\`` pattern to the data module**

Rewrite `src/data/products.ts` to the wrapped target:
```ts
import { msg } from '@lingui/core/macro'
import type { MessageDescriptor } from '@lingui/core'

type Product = { id: string; slug: string; price: number; name: MessageDescriptor; description: MessageDescriptor }
type Category = { id: string; label: MessageDescriptor }

export const products: Product[] = [
  { id: 'sku-01', slug: 'wireless-headphones', price: 299, name: msg`Wireless Headphones`, description: msg`Premium noise-cancelling over-ear headphones with 30-hour battery life.` },
  { id: 'sku-02', slug: 'smart-watch', price: 199, name: msg`Smart Watch`, description: msg`Track your fitness, sleep, and notifications on the go.` },
  { id: 'sku-03', slug: 'mechanical-keyboard', price: 149, name: msg`Mechanical Keyboard`, description: msg`Tactile hot-swappable switches for a satisfying typing experience.` },
  { id: 'sku-04', slug: 'usb-c-hub', price: 59, name: msg`USB-C Hub`, description: msg`Seven ports in a compact aluminium body.` },
  { id: 'sku-05', slug: 'desk-lamp', price: 79, name: msg`Desk Lamp`, description: msg`Adjustable warmth and brightness for late-night work.` },
]

export const categories: Category[] = [
  { id: 'cat-audio', label: msg`Audio` },
  { id: 'cat-wearables', label: msg`Wearables` },
  { id: 'cat-accessories', label: msg`Accessories` },
]
```
Update `src/components/ProductList.tsx` to resolve descriptors:
```tsx
import { useLingui } from '@lingui/react/macro'
import { Trans } from '@lingui/react/macro'
import { products, categories } from '../data/products'

export function ProductList() {
  const { t } = useLingui()
  return (
    <section>
      <h2><Trans>Featured products</Trans></h2>
      <ul>
        {categories.map((c) => (
          <li key={c.id}>{t(c.label)}</li>
        ))}
      </ul>
      <ul>
        {products.map((p) => (
          <li key={p.id}>
            <h3>{t(p.name)}</h3>
            <p>{t(p.description)}</p>
            <button><Trans>Add to cart</Trans></button>
          </li>
        ))}
      </ul>
    </section>
  )
}
```
Wire the Vite macro plugin in `vite.config.ts` (add `lingui()` and `macros` babel plugin per the Vite SWC setup reference) so `msg`/`Trans` compile.

- [ ] **Step 4: Run the four gates**

```bash
# Gate 1 — typecheck
npx tsc --noEmit && echo "GATE1 tsc PASS"
# Gate 2 — build
npm run build && echo "GATE2 build PASS"
# Gate 3 — extract (expect >=13 messages)
npx lingui extract --clean
# Gate 4 — no-unlocalized-strings must be clean on the wrapped module
npx eslint 'src/**/*.{ts,tsx}' --rule '{"lingui/no-unlocalized-strings":"error"}' --no-eslintrc --parser-options=ecmaFeatures:{jsx:true} ; echo "GATE4 exit=$?"
```
Expected: GATE1/GATE2 PASS; GATE3 reports ≥13 extracted messages; GATE4 exits `0` (no unlocalized strings in the data module — the decoys `id`/`slug` are ignored by the tuned config / are not JSX-rendered literals). Record the exact outputs.

- [ ] **Step 5: Record results and clean up**

Capture the four gate outputs into the final report (this is the proof the lint gate goes 13→0). Then `rm -rf "$SCRATCH"`. No commit (scratch only).

---

## Task 7: Reconcile Add-on 2, document scope, and stage the gated/deferred runs

**Files:**
- Modify: `references/languages/js-ts/libraries/lingui/setup.add-ons.md` (Add-on 2 note that verify now installs it)
- Create: `docs/superpowers/plans/2026-07-22-data-module-recall-fix.md` already holds the plan; append a "Downstream + gated runs" note to the design doc or a NOTES file consumed by the final report.

**Interfaces:**
- Consumes: Tasks 3–5 (the fix), Task 6 (the $0 proof).
- Produces: a coherent story between the opt-in Add-on 2 and the always-run verify recall install; a written list of the gated Layer A/B runs and the downstream globalize.now follow-ups.

- [ ] **Step 1: Add a cross-reference note to Add-on 2**

In `references/languages/js-ts/libraries/lingui/setup.add-ons.md`, at the end of "## Add-on 2: ESLint plugin" (before "## Add-on 3"), append:
```
> **Note:** the convert **verify** phase now installs and runs `lingui/no-unlocalized-strings` as a recall self-check regardless of this add-on (see `references/languages/js-ts/convert.recall-self-check.md`), so a converted project keeps this guardrail even if the add-on wasn't selected. Selecting this add-on additionally wires the full recommended preset and (with Add-on 3) the CI drift check.
```

- [ ] **Step 2: Confirm no convert reference was altered**

```bash
cd /Users/arturs/Projects/globalize/globalization-skills/.claude/worktrees/robust-doodling-summit
git diff --name-only main -- 'skills/globalize-guide/references/**/*.convert.md' 'skills/globalize-guide/references/**/code.md' | grep -q . && echo "WARN: a convert/code reference changed — review" || echo "OK: convert references untouched"
```
Expected: `OK: convert references untouched` (only `setup.add-ons.md` and the new `convert.recall-self-check.md` changed under references).

- [ ] **Step 3: Write the gated/deferred runs note**

Append to the design doc `docs/superpowers/specs/2026-07-22-data-module-recall-fix-design.md` a short "## Post-implementation status" section listing: (a) $0 gate result from Task 6; (b) the two gated model runs and their exact commands (below); (c) the downstream globalize.now follow-ups.

Gated Layer A (detection nudge, ~3 min, model tokens):
```bash
./evals/run-eval-layer-a.sh vite-swc-data-module   # asserts candidateFilesMustContain src/data/products.ts
```
Gated Layer B (self-heal end-to-end, ~5 min, model tokens) — requires a prefill whose plan.md OMITS products.ts from wrap partitions (simulating the miss), so the recall loop must catch it; generate the prefill per `evals/README.md`, then:
```bash
./evals/run-eval-layer-b.sh vite-swc-data-module   # verify-string-wrapping must show the 13 strings wrapped (13→0)
```

- [ ] **Step 4: Commit**

```bash
git add references/languages/js-ts/libraries/lingui/setup.add-ons.md docs/superpowers/specs/2026-07-22-data-module-recall-fix-design.md
git commit -m "docs(globalize-guide): reconcile Add-on 2 with verify recall + record gated/deferred runs"
```

---

## Downstream follow-ups (globalize.now — NOT this repo)

- Re-bake the conversion-plane image (`image/stage.sh`) so the baked copy of `globalize-guide` picks up this fix.
- Promote `fixtures/vite-swc-data-module` (or an equivalent data-module app) into the `conversion-matrix` corpus / `example-websites/typescript/` as a permanent guard.
- Run the deepseek-v4-flash eval cell on the fixture before/after — the `no-unlocalized-strings` gate must go 13→0.

---

## Self-Review

- **Spec coverage:** Layer 1 nudge → Task 3. Layer 2 recall reference + schema → Task 4. Layer 2 verify wiring + cleanup loop → Task 5. Regression fixture + harness → Tasks 1–2. $0 four-gate proof → Task 6. Reconcile Add-on 2 + gated/deferred runs + downstream notes → Task 7. Non-goals (no convert-ref rewrite, wrapping stays in subagents) → enforced by Global Constraints + Task 7 Step 2 guard.
- **Placeholder scan:** no TBD/TODO; every edit shows exact old→new text or full file content; every command has expected output.
- **Type/name consistency:** `recallViolations`, `cleanupRounds`, `stringsWrappedInCleanup`, `residualViolations`, `needs_cleanup`, `maxCleanupRounds` (=2), `wrap-cleanup`, file cap 40, `'eslint-plugin-lingui@^0.14'`, `candidateFilesMustContain` — used identically across Tasks 1, 4, 5, 6.
