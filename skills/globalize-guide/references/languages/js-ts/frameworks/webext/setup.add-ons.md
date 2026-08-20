# Browser extension i18n: Coding Rules + Optional Add-Ons

Invoked from `references/languages/js-ts/frameworks/webext/webext-native.setup.md` (Step 8) on the
native variant, and offered at `SKILL.md §1.10` to all three `webext` variants.

It has two parts.

**Part 1 — the two core coding-rules steps. They always run, and only on the `webext-native-messages`
variant.** They are not add-ons and are not gated on any §1.10 selection. On the **Lingui** variants
(`webext-babel-lingui`, `webext-swc-lingui`) they are already done by the time this file is read:
`references/languages/js-ts/libraries/lingui/setup.add-ons.md` owns them there, rendering
`libraries/lingui/rules.template.md` with its `appTarget == "browser-extension"` branch and the
`manifestStringsModule` / `localesBridgeScript` values. **Skip Part 1 entirely on a Lingui variant** —
re-rendering would overwrite the correct file with the wrong template.

**Part 2 — the §1.10 add-ons.** Run only the sub-steps the user selected in `decisions.md`; skip the
rest in silence. Every section here is independently re-runnable: if it is already applied, detect
that and skip without prompting.

Apply the same guided / unguided rules used elsewhere in setup:
- **Guided mode**: describe the change before making it and wait for confirmation.
- **Unguided mode**: apply directly; only stop on hard errors.

| Section | `webext-native-messages` | `webext-*-lingui` |
|---|---|---|
| Core steps 1–2 (coding rules) | **run here** | already done — see `libraries/lingui/setup.add-ons.md` |
| Add-on 1 — `web-ext lint` in CI | applies | applies (must run **after** the build) |
| Add-on 2 — CI catalog extraction | n/a (nothing to extract) | applies |
| Add-on 3 — store-listing checklist | applies | applies |
| Add-on 4 — `Intl.PluralRules` helper | applies | n/a (ICU plurals are built in) |
| Add-on 5 — Safari verification | applies | applies |
| Add-on 6 — ESLint | applies | n/a (`eslint-plugin-lingui` covers it) |

---

## Core step 1: generate the coding rules (`generate_coding_rules` — always runs)

**Native variant only.** Phase 3's wrap subagents read `.agents/globalize-rules.md` as their authoring
contract — the externalization rule, the `data-i18n` markup contract, `t()` usage, key charset and
case-insensitivity, `description` authoring, placeholders and the 9-substitution cap, the plural
convention, manifest field legality, and the skip-list — so conversion cannot start until this step has
produced it. Wiring it into `CLAUDE.md` and `AGENTS.md` is core step 2, which also always runs.

The rules are a **generated file**, not a shipped one.
`references/languages/js-ts/frameworks/webext/webext-native.rules.template.md` covers every
configuration this variant supports; this step renders it down to the one configuration this project
actually has and writes the result to `.agents/globalize-rules.md`.

**Read `references/rules-template-format.md` before rendering.** It is the whole rendering contract —
template anatomy, the conditional grammar, the `<<placeholder>>` form, the step order, the header, the
fail-closed rule. The steps below only add where *this variant's* values come from.

### 1. Locate the template

Read `.globalize/manifest-snapshot.json` → `references.rulesTemplate`. **If the entry has no
`rulesTemplate`**, the installed skill is out of date — `webext-native-messages` carries one. Do not
look for a generic `code.md`; none exists for this variant. Treat it as the missing-file case.

Verify the template exists in the target project.

- **If it exists**: proceed.
- **If it is missing — guided mode**: tell the user the `globalize-guide` skill is not installed in
  their project and stop this step. The fix is to reinstall it
  (`npx skills add globalize-now/globalize-skills --skill globalize-guide -a claude-code`). Don't
  recreate the file.
- **If it is missing — unguided mode**: do not block. Skip this step and record
  `⚠ Browser-extension coding rules not generated — template missing` in the end-of-run summary, with
  the reinstall command. Treat it as the fail-closed case in step 6.

### 2. Resolve the template's `conditions`

The template declares exactly one: `conditions: [localeSwitcher]`. Resolve it and write it to
`.globalize/rules-values.json`.

| Condition | Where to read it |
|---|---|
| `localeSwitcher` | `"native"` or `"custom-loader"`. Source of truth is `decisions.setup.localeSwitcher` in `.globalize/decisions.md`. **Corroborate against disk** — a `src/i18n/loader.ts`, a locale preference read from `browser.storage`, or a language `<select>` in a `.html` entrypoint all mean `"custom-loader"`; a `src/i18n/t.ts` that calls `browser.i18n.getMessage` and nothing else means `"native"`. **If the two disagree, disk wins**: `decisions.md` records what was asked for, disk records what landed, and the rules must describe the code that exists. |

### 3. Eliminate branches, then resolve the surviving `values`

Delete every false branch **and every marker line** (`<!-- if:`, `<!-- else -->`, `<!-- /if -->` all
disappear, kept branch or not). Only then resolve the `values` still referenced in what survived —
from the project **on disk**, what core setup actually created — appending them to the same
`.globalize/rules-values.json`. The order is load-bearing: resolving up front would demand values that
live only inside a deleted branch.

The template declares `values: [localesDir, sourceLocale, targetLocales, manifestFile]`.

| Value | Where to read it |
|---|---|
| `localesDir` | The project-root-relative directory holding the locale subdirectories, **no trailing slash** — the `<localesRoot>` resolved by `webext-native.setup.md` Step 1. It varies by `extensionFramework`: `public/_locales` for WXT / CRXJS / plain Vite / webpack, `assets/_locales` for Plasmo, `_locales` for a build-less extension. **Glob `**/_locales/*/messages.json` rather than assuming**, excluding `node_modules`, `dist` and `.output`; if several match, use the one the authored manifest's `default_locale` actually resolves against (i.e. the one that contains a directory named for it). |
| `sourceLocale` | BCP-47. Read the authored manifest's `default_locale`, which is spelled with an **underscore**, and hyphenate it: `pt_BR` → `pt-BR`, `zh_CN` → `zh-CN`, `es_419` → `es-419`. Cross-check `decisions.setup.sourceLocale`; the manifest wins, because that is what the browser loads. |
| `targetLocales` | Every other locale directory under `localesDir`, normalized to BCP-47, source locale removed, comma-separated: `_locales/de`, `_locales/fr`, `_locales/pt_BR` → `de, fr, pt-BR`. Cross-check `decisions.setup.targetLocales`; the directories on disk win. |
| `manifestFile` | The file a **developer edits**, which is not always the shipped manifest: `wxt.config.ts` (the `manifest:` key) for WXT; `manifest.config.ts` — or `manifest.json` — for CRXJS; `manifest.json` for plain Vite, webpack and no-build projects; `package.json` for Plasmo (`displayName` / `description` / the `manifest` override key). Project-root-relative. Never name the build output. |

### 4. Render

Substitute every surviving `<<name>>` with its resolved value, strip the frontmatter, and **copy
everything retained verbatim** — do not rewrite, summarize, reflow, re-order, or improve the prose.
Prepend the two-line generated header:

```
<!-- globalize-rules v<templateVersion> | template=webext-native | variant=<manifest-snapshot variant> | generated by globalize-guide -->
<!-- Generated file. Re-running globalize-guide overwrites it. Put your own project rules in CLAUDE.md or AGENTS.md. -->
```

`<templateVersion>` is the template frontmatter's `templateVersion`; `template=webext-native` is its
`template` key — use both as written there, do not invent values.

Write the result to `.agents/globalize-rules.md`, overwriting any file left by an earlier run.

**`.agents/globalize-rules.md` should be committed.** It is team-shared coding guidance, exactly like
`CLAUDE.md`. Do **not** add it to `.gitignore`; it is not a `.globalize/` progress artifact. Then
confirm it is actually tracked: run `git check-ignore .agents/globalize-rules.md`. Some repos ignore
whole dotfile directories, and a rules file no teammate receives is not doing its job. If it comes back
ignored, say so — do not silently succeed.

**Migrate off the old path.** Earlier versions of this skill wrote the rules to
`.claude/globalize-rules.md`. **Only after the write above succeeded**, delete that file if it exists
*and* its line 1 carries the generated header. A file at that path without the header is not ours —
leave it and warn. Never remove the `.claude/` directory itself. The matching
`@.claude/globalize-rules.md` line in `CLAUDE.md` is removed by core step 2.

### 5. Self-check the generated file

All four must hold:

- zero occurrences of `<!-- if:`, `<!-- else -->`, `<!-- /if -->`
- zero occurrences of `<<`
- the header is on line 1
- the line count is within the template's `budget` for the resolved condition — `205` when
  `localeSwitcher == "custom-loader"`, `180` otherwise

### 6. Fail closed

If **any** surviving condition or value can't be resolved, or the self-check fails: **never write a
partial file.** Delete anything already written to `.agents/globalize-rules.md`, then:

- **Guided mode** — ask the user for the specific value. Every one is a one-line answer ("Where does
  your `_locales` directory live?", "Which file do you edit to change the manifest?", "Does the
  extension let the user pick a language, or does it follow the browser?"), and getting one beats
  shipping either wrong rules or none. Resolve, re-render, re-check. Only if the user can't answer, or
  the self-check still fails, stop this step and say which key or check failed.
- **Unguided mode** — don't block the run. Skip this step and record
  `⚠ Browser-extension coding rules not generated (localesDir unresolved) — no rules file installed` in
  the end-of-run summary.

Either way a **core step did not complete**, so surface it: report `generate_coding_rules` as failed,
leave it unchecked in `plan.md`, and tell the orchestrator that Phase 3 has no
`.agents/globalize-rules.md` to wrap against. There is no generic-rules fallback — the template is the
only source of truth. Installing nothing is recoverable; installing rules that name the wrong
`_locales` directory is not, because the agent follows them into a bug on every future edit and nothing
signals it.

---

## Core step 2: wire the coding rules in (`install_coding_rules` — always runs)

**Native variant only.** Rules that nothing loads are close to useless, so the wiring is not a decision
the user is asked to make up front. It does edit files the user owns, so the usual mode rule applies:
**guided** describes each change and waits, **unguided** applies it directly.

If core step 1 failed and there is no `.agents/globalize-rules.md` on disk, **skip this step entirely
and create neither file** — an import or pointer aimed at a missing file opens every future session
with a dangling reference.

Two bridges, because no single mechanism reaches every agent.

### `CLAUDE.md` — Claude Code

Claude Code doesn't reliably auto-trigger passive "coding rules" references during routine edits, but an
`@`-imported file loads into every session's context.

- **If it doesn't exist**, create it:
  ```
  # Project Instructions

  @.agents/globalize-rules.md
  ```
- **If it exists**, append `@.agents/globalize-rules.md` at the end of the file on its own line ("I'll
  append `@.agents/globalize-rules.md` to your CLAUDE.md so the extension i18n coding rules auto-load
  every session"). Do not remove or reorder existing content.
- **If a stale `@.claude/globalize-rules.md` line is present**, remove it in the same edit.

If the exact `@.agents/globalize-rules.md` line is already present, skip silently — this step is
idempotent.

Tell the user: "The first time you start a Claude Code session in this project, you'll see a one-time
prompt asking to approve the `@` import. Approve it — otherwise the rules won't load."

### `AGENTS.md` — Codex CLI, Cursor, Copilot, Gemini, Aider, Cline

All of these read a repo-root `AGENTS.md`. None support an import syntax, so the rules reach them as a
pointer they must choose to follow. That is the honest ceiling: inlining a second copy would guarantee
loading at the cost of two copies that drift.

- **If it doesn't exist**, create it with an `# AGENTS.md` heading and the section below — nothing else.
- **If it exists**, append the section at the end. Do not remove or reorder existing content.

```markdown
## Internationalization

Before adding or editing any user-facing string, read `.agents/globalize-rules.md`
and follow it. It is this project's authoritative i18n authoring contract — which
API to use, how to handle plurals, where catalogs live, and what not to wrap.
```

Idempotent on the literal `.agents/globalize-rules.md` appearing anywhere in `AGENTS.md`: present →
skip silently.

Verify: in a fresh session, ask Claude "how do I add a user-visible string in this project?" — the
answer should reference `messages.json` with a `description`, and `t()` from the project's i18n module,
not a hardcoded literal.

---

## Add-on 1: `web-ext lint` in CI

`web-ext` is Mozilla's extension CLI; its `lint` command wraps `addons-linter`. No install — run it
through `npx`:

```bash
npx 'web-ext@^10' lint --source-dir dist
```

`web-ext@10` is the current major (10.6.0, 2026-08-04) and needs Node ≥ 20. Older references in this
skill name `web-ext@^10`; the `lint --source-dir` contract is identical, so either runs — pin `^10`.
The flags used below are `--source-dir`/`-s` (required), `--output json` and `--self-hosted`. Also
real, if you need them: `--warnings-as-errors`/`-w`, `--pretty`, `--artifacts-dir`, `--ignore-files`.

### Which directory to lint

Lint the directory holding the `manifest.json` the browser actually loads.

| `extensionFramework` | Built package root |
|---|---|
| `wxt` | `.output/chrome-mv3` (`.output/firefox-mv3` for the Firefox build) |
| `crxjs`, `vite-plain` | `dist` |
| `plasmo` | `build/chrome-mv3-prod` — confirm against `build/` on disk after a build |
| `webpack` | `output.path` from `webpack.config.*` — commonly `dist` |
| `none` | the repo root; nothing is built |

**On the Lingui variant this must run AFTER the build.** `public/_locales/**` is generated by
`scripts/build-locales.mjs`, so linting the source tree reports `NO_DEFAULT_LOCALE` / `NO_MESSAGES_FILE`
on a perfectly healthy project. On the native variant `_locales` is already in the source tree, so
either works — still prefer the built output, because that is what gets uploaded.

### What it actually catches for i18n

Verified by running `web-ext@10.6.0` against fixtures:

| Code | Severity | Trigger |
|---|---|---|
| `NO_DEFAULT_LOCALE` | error | a `_locales/` directory exists but the manifest has no `default_locale` |
| `NO_MESSAGES_FILE` | error | `default_locale` is set but `_locales/<that code>/messages.json` is absent |
| `NO_MESSAGE` | error | a catalog entry has no `message` property |
| `JSON_INVALID`, `JSON_DUPLICATE_KEY` | error | a `messages.json` doesn't parse, or repeats a key |
| `MISSING_PLACEHOLDER` | warning | a `$name$` in a message is not declared in that entry's `placeholders` |
| `PREDEFINED_MESSAGE_NAME` | warning | a key collides with a reserved `@@…` predefined message |

**What it does NOT catch — verified; do not claim otherwise:**

- **Unresolvable `__MSG_key__` references.** A manifest whose `name` is `__MSG_missingKey__`, with that
  key absent from the default-locale catalog, lints completely clean. The convert-phase manifest-wiring
  check (`SKILL.md §3.5`, step 2) is the only gate for this.
- **Illegal message names.** A key of `"manifest.name"` — a `.` is outside Chrome's `A-Za-z0-9_@`
  charset — lints clean, and Chrome then silently fails to substitute it. On the Lingui variant, the id
  → message-name mapping in `scripts/build-locales.mjs` is what must guarantee legality.

**It is an AMO linter, so it reports Firefox-only findings on a healthy Chrome-only extension** —
`ADDON_ID_REQUIRED` (error) and `MISSING_DATA_COLLECTION_PERMISSIONS` (warning) both fire on a valid
Chrome MV3 package. `--self-hosted` drops AMO-hosting messages but not those two. **Do not gate CI on
the raw exit code**; parse the JSON and filter to the i18n codes:

```js
// scripts/check-webext-lint.mjs
import { execFileSync } from 'node:child_process'

const sourceDir = process.argv[2] ?? 'dist'
const I18N_CODES = new Set([
  'NO_DEFAULT_LOCALE', 'NO_MESSAGES_FILE', 'NO_MESSAGES_FILE_IN_LOCALES', 'NO_MESSAGE',
  'MISSING_PLACEHOLDER', 'NO_PLACEHOLDER_CONTENT', 'INVALID_PLACEHOLDER_NAME',
  'INVALID_MESSAGE_NAME', 'PREDEFINED_MESSAGE_NAME', 'JSON_INVALID', 'JSON_DUPLICATE_KEY',
])

let stdout
try {
  stdout = execFileSync('npx', [
    '--yes', 'web-ext@^10', 'lint', '--source-dir', sourceDir, '--output', 'json', '--self-hosted',
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
} catch (error) {
  // `lint` exits non-zero for ANY error, including the Firefox-only ones we filter
  // out, and still prints the report on stdout.
  stdout = error.stdout ?? ''
}

if (!stdout.trim()) {
  console.warn(`web-ext lint could not run against ${sourceDir} — skipping the i18n lint gate.`)
  process.exit(0)                                   // skip-if-absent: never fail the build on a missing tool
}

const report = JSON.parse(stdout)
const findings = [...report.errors ?? [], ...report.warnings ?? [], ...report.notices ?? []]
  .filter((m) => I18N_CODES.has(m.code))

for (const f of findings) console.error(`${f._type}: ${f.code} — ${f.message} (${f.file})`)
console.log(`web-ext lint: ${findings.length} i18n finding(s) in ${sourceDir}`)
process.exit(findings.length > 0 ? 1 : 0)
```

Add the script to `package.json` (skip if a `webext:lint` script already exists):

```json
{ "scripts": { "webext:lint": "node scripts/check-webext-lint.mjs dist" } }
```

### GitHub Actions job

**If the project has no `.github/workflows/` directory, skip the scaffold entirely** and tell the user
the one command to wire into their CI of choice. Otherwise create or extend `.github/workflows/i18n.yml`
— if the file already has a `lint` job pointing at this script, skip:

```yaml
name: i18n

on:
  pull_request:
    paths:
      - 'src/**'
      - 'entrypoints/**'
      - 'public/_locales/**'
      - '_locales/**'
      - 'scripts/**'
      - '.github/workflows/i18n.yml'

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'          # web-ext@10 requires Node >= 20
      - run: npm ci
      - name: Build the extension        # Lingui variant only — _locales is generated
        run: npm run build
      - name: web-ext lint (i18n findings only)
        run: npm run webext:lint
```

Drop the build step on a build-less native extension and point the script at `.` instead of `dist`.

---

## Add-on 2: CI catalog extraction (Lingui variants only)

Skip this add-on on `webext-native-messages` — there is no extraction step there; keys are hand-authored
in `messages.json` and Add-on 1 is the coverage gate.

This mirrors Add-on 3 of `references/languages/js-ts/libraries/lingui/setup.add-ons.md`, extended with
the `_locales` bridge. Three things must hold on every PR: the PO catalog matches the wrapped source,
the catalog compiles, and the bridge can turn it into `_locales`.

**Script-name reconciliation — read `package.json` first.** The extension setup reference already
creates `lingui:extract` (`lingui extract --clean`) and `lingui:compile` (`lingui compile`). **Reuse
them**; add only what is missing, which is normally just the bridge and the drift check:

```json
{
  "scripts": {
    "i18n:locales": "node scripts/build-locales.mjs",
    "i18n:check": "lingui compile && lingui extract --clean && git diff --exit-code -- src/locales"
  }
}
```

Replace `src/locales` with the project's real `catalogs[].path` root from `lingui.config.ts`. **Do not
add `--typescript`** on this variant — setup sets `compileNamespace: 'ts'` in `lingui.config.ts`, which
already emits the `.ts` catalogs the static imports resolve against.

- **Why `i18n:check` compiles first.** Compiled catalogs are gitignored, so a clean CI checkout has the
  `.po` sources but none of the compiled output; anything that resolves a catalog import fails until
  something generates them.
- **The drift check only ever sees `.po` changes.** `public/_locales/**` is gitignored build output, so
  `git diff --exit-code` cannot flag it. That is the intended contract — the gate is about catalog
  *sources*.
- **Run the bridge as its own CI step anyway.** It is the step that fails on a PO the bridge cannot map:
  an id that maps to an illegal Chrome message name, or a malformed entry. Its skip-and-warn lines for
  locales outside Chrome's ~55-entry supported table are informational, not failures — surface them in
  the log.
- **Build wiring — check before you write.** Core setup already prepends
  `lingui compile && node scripts/build-locales.mjs` to `build` and `dev`. Read `package.json`: if
  `build` already starts with `lingui compile`, leave it alone. Do not add a second invocation, and
  never use `prebuild` (pnpm and Yarn Berry do not run it).

Extend the `.github/workflows/i18n.yml` from Add-on 1 with a `check` job (or add these steps before the
lint step if you prefer one job):

```yaml
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - name: Compile catalogs
        run: npm run lingui:compile
      - name: Verify catalogs are in sync
        run: npm run i18n:check
      - name: Build the _locales bridge
        run: npm run i18n:locales
```

Without the drift check, a contributor can wrap a string, forget to run `lingui extract`, and merge a PR
whose catalog is silently stale — the string then renders as its source text in every locale until
someone notices.

---

## Add-on 3: Store-listing locale checklist

Applies to both variants. This add-on writes nothing; it is a checklist to run **before the first
localized upload**, plus a short section added to the project's release notes or `CONTRIBUTING.md` if
the user wants it recorded.

The split is fixed and cannot be worked around:

| Listing field | Where it comes from |
|---|---|
| The set of languages in the store-listing language dropdown | The `_locales/<code>/` directories **in the uploaded package**. A locale with no directory cannot be selected at all. |
| Extension **name** | The manifest's `name` — a `__MSG_…__` reference resolved per locale from `_locales`. |
| **Short description** (the one-line summary under the name) | The manifest's `description`, same mechanism. |
| **Detailed description** | Dashboard only, typed per locale. Not in the package. |
| **Screenshots** | Dashboard only, uploaded per locale. |
| **Promotional video** | Dashboard only, per locale. |
| **Small promo tile** | **Not localizable.** One image for every language. |
| **Marquee promo tile** | **Not localizable.** One image for every language. |

**Edge Partner Center behaves the same way**: package `_locales` drives the available languages and the
name/short description; the long description and store images are entered per locale in the dashboard.

### The failure this prevents

**A hardcoded `name` or `description` in the manifest collapses the entire store listing to one
language**, no matter how many `_locales` directories ship. The dropdown may still offer the locales,
but every listing shows the same untranslated name and summary. The fix is the `__MSG_…__` reference —
core setup wires it, and the convert-phase manifest-wiring check gates it.

### The checklist

Walk these with the user and report the result of each:

1. The authored manifest sets `default_locale`, and `name` / `description` are `__MSG_…__` references,
   not literals. (`action.default_title` too if the extension has a toolbar button.)
2. Every locale you intend to publish in has a `_locales/<code>/messages.json` **in the built package**,
   spelled with an underscore (`pt_BR`, not `pt-BR`).
3. Every one of those codes is in Chrome's supported-locale table (~55 entries). A directory outside it
   is silently ignored — the language simply will not appear in the dropdown.
4. Each of those catalogs defines every key the manifest references. A missing key means an empty name
   or description for that locale.
5. Only the four portable manifest keys carry translations if you also ship to Firefox: `name`,
   `short_name`, `description`, `action.default_title`.
6. Name length ≤ 45 characters and short description ≤ 132 characters **in every locale** — translations
   run longer than English and the store truncates.
7. In the dashboard, for each locale: detailed description written, screenshots uploaded (or accept the
   global ones), promo video set if you have one.
8. Accept that the small and marquee promo tiles are global. If they contain rendered text, that text
   ships in one language to everybody — consider a text-free tile.

---

## Add-on 4: `Intl.PluralRules` plural helper (native variant only)

Skip on the Lingui variants — they have real ICU plurals.

**Check first: `webext-native.setup.md` Step 7 already creates `src/i18n/plural.ts`.** If that file is
on disk, this add-on is applied — confirm it matches the implementation below, then move to the
per-locale seeding work at the end of this section, which Step 7 leaves to you. This section carries the
full implementation so the helper can also be installed standalone (a project that ran an older setup,
or one being converted by hand).

`chrome.i18n` has **no plural support at all** — no ICU, no CLDR categories, nothing. `Intl.PluralRules`
is available in every extension context including the MV3 service worker, so the categories are selected
in JS and the catalog holds one key per category.

### Catalog convention

One key per CLDR category, suffixed with the exact lowercase string `Intl.PluralRules.select()` returns:
**`_zero`, `_one`, `_two`, `_few`, `_many`, `_other`**. `_other` is mandatory in every locale — it is
the fallback. Message names are **case-insensitive** in Chrome, so never distinguish keys by casing.

```json
"inbox_count_one": {
  "message": "$count$ unread message",
  "description": "PLURAL CATEGORY ONE (English singular). One key of a plural set — see inbox_count_other. Badge text in the popup header; $count$ is the number of unread messages.",
  "placeholders": { "count": { "content": "$1", "example": "1" } }
},
"inbox_count_other": {
  "message": "$count$ unread messages",
  "description": "PLURAL CATEGORY OTHER (English plural; the required fallback for every language with no more specific form). Badge text in the popup header; $count$ is the number of unread messages.",
  "placeholders": { "count": { "content": "$1", "example": "5" } }
}
```

The translator sees N independent keys with no structure linking them, so **each `description` must
name its plural category explicitly**, exactly as above.

### The helper

```ts
// src/i18n/plural.ts
import { browser } from './browser'

/**
 * Pick the right `<baseKey>_<category>` entry for `count` using CLDR rules.
 * Intl.PluralRules works in every extension context, including the MV3 service worker.
 * Pass a hyphenated BCP-47 locale, never a Chrome underscored directory code.
 * getMessage() returns "" for an unknown key — that is what drives the _other fallback.
 */
export function plural(baseKey: string, count: number, locale?: string): string {
  const resolved = locale ?? browser.i18n.getUILanguage()   // already hyphenated
  const category = new Intl.PluralRules(resolved).select(count)
  const subs = [String(count)]
  return (
    browser.i18n.getMessage(`${baseKey}_${category}`, subs) ||
    browser.i18n.getMessage(`${baseKey}_other`, subs) ||
    baseKey
  )
}
```

Export it from the `src/i18n/index.ts` barrel (`export { plural } from './plural'`) and call it as
`plural('inbox_count', n)` — **never** `n === 1 ? t('inbox_count_one') : t('inbox_count_other')`, which
is wrong in every language with more than two forms.

- **In `custom-loader` mode**, swap both `browser.i18n.getMessage` calls for the loader's `t()` and pass
  `toBcp47(getLocale())` as the locale. The shape is otherwise identical.
- **Localized digits (optional).** Replace `String(count)` with
  `new Intl.NumberFormat(resolved).format(count)` so `1234` renders as `1.234` in `de` and with
  Eastern-Arabic digits in `ar`. Do this only if the project's other numbers are formatted too;
  a half-formatted UI is worse than a consistently plain one.
- **Ordinals.** `new Intl.PluralRules(resolved, { type: 'ordinal' })` drives the same suffix convention
  for "1st / 2nd / 3rd". There is nothing in the format for `select` or gender — those have no
  workaround here.

### Seeding the extra categories per locale

The source locale rarely has all the categories a target needs: English has `one` and `other`; Russian,
Polish, Czech and Croatian need `few` and `many`; Arabic needs all six. The helper looks up
`${baseKey}_${category}` at runtime, so a Russian catalog that **does** define `inbox_count_few` is used
— but those keys exist only in that target file and must be added deliberately.

For each target locale, for each plural base key, add the categories that locale actually uses (seed the
value from the source string; the translator replaces it) and keep `_other`. `web-ext lint` does not
complain about a target locale carrying more keys than the source, so this is safe. **Confirm with the
user that their translation workflow preserves target-only keys before promising full plural coverage** —
a round-trip that reconciles targets against the source key set will delete them.

A locale left with only `_one`/`_other` still renders — the helper falls back to `_other` — just
grammatically wrong for large counts. That is the whole safety net.

---

## Add-on 5: Safari verification

Applies to both variants. **This is unverified territory, not a known-good path.** There are open,
unresolved reports (`wxt-dev/wxt#1400`) that `browser.i18n.getMessage()` returns empty strings in a
Safari web extension produced by `safari-web-extension-converter`. This add-on is a manual recipe for
finding out whether it happens to *this* extension. Do not tell the user Safari works; report what the
run showed.

**Applicability:** macOS with Xcode installed (`xcrun --find safari-web-extension-converter` succeeds).
On any other platform, skip this add-on and say so.

1. **Build first** (Lingui variant): `npm run build`, so `_locales` exists in the output. On the native
   variant the source tree already has it.

2. **Convert.** Every flag below is from `xcrun safari-web-extension-converter --help`:

   ```bash
   xcrun safari-web-extension-converter ./dist \
     --project-location ./safari \
     --app-name "Acme Clipper" \
     --bundle-identifier com.example.acmeclipper \
     --macos-only --swift --copy-resources --no-prompt --no-open --force
   ```

3. **Build and run** the generated Xcode project once (it installs the app, which registers the
   extension). Then in Safari: **Settings → Advanced → "Show features for web developers"**, then
   **Develop → Allow Unsigned Extensions**, then **Settings → Extensions** and enable it.

4. **Baseline check, in the source locale.** Open the popup, right-click it → **Inspect Element**, and
   run in that console:

   ```js
   const b = globalThis.browser ?? globalThis.chrome
   b.i18n.getUILanguage()          // expect the current UI locale, hyphenated
   b.i18n.getMessage('ext_name')    // expect the source-locale string from _locales/<default>/messages.json
   ```

   Use a key you know exists. **An empty string here is already the failure** — nothing about the target
   locale has been exercised yet.

5. **Switch the language without changing the whole system.** macOS supports a per-app language:
   **System Settings → General → Language & Region → Applications → `+` → Safari → <target language> →
   Add**. Quit Safari completely and reopen it.

6. **Re-run step 4.** `getUILanguage()` should now report the target locale and `getMessage('ext_name')`
   should return that locale's string. Also check the two manifest-driven surfaces, which exercise
   `__MSG_` substitution rather than the JS API: the extension's name in **Safari → Settings →
   Extensions**, and the toolbar button's tooltip (`action.default_title`).

**Record the result either way.** If step 4 or 6 returns empty strings:

- The **native** variant in `localeSwitcher: "native"` mode is broken on Safari — its whole UI depends
  on `getMessage()`. The mitigation is to re-run setup choosing `custom-loader`, which reads
  `fetch(browser.runtime.getURL('_locales/<code>/messages.json'))` and never calls `getMessage()` for
  UI strings.
- The **Lingui** variant already works that way: only the four manifest `__MSG_` keys depend on the
  platform, so a Safari failure there degrades to an untranslated extension *name and description*, not
  an untranslated UI.

---

## Add-on 6: ESLint (native variant only)

Skip on the Lingui variants: `eslint-plugin-lingui`'s `no-unlocalized-strings` covers them, wired by
Add-on 2 of `references/languages/js-ts/libraries/lingui/setup.add-ons.md`, and the convert verify phase
installs it regardless.

**Be honest about the ceiling here. There is no `eslint-plugin-chrome-i18n`** — the name is not on npm
(a `npm view` returns 404). Do not install, configure, or mention one. The only realistic option is
`eslint-plugin-i18next`'s `no-literal-string` rule, and whether it is worth having depends on how the
extension renders its UI.

### When it is worth installing

`no-literal-string` flags **string literals**; it knows nothing about i18next specifically, which is why
it transfers. Its default `mode` is `'jsx-text-only'`.

- **The extension renders with React / Preact / JSX** → install it. `jsx-text-only` is low-noise and
  catches exactly the mistake that matters: text typed straight into markup.
- **The extension builds its UI with plain DOM** (`el.textContent = 'Save'`, `createElement`) →
  `jsx-text-only` catches nothing and you need `mode: 'all'`, which flags every string literal in the
  file, including storage keys, message-type discriminators and selectors. Scope it to the UI directory
  and expect a tuning pass. If the user does not want that noise, **say plainly that no good option
  exists** and install nothing — use the grep gate at the end of this section instead. A rule everyone
  disables is worse than no rule.

### Install and configure

Detect the package manager from the lockfile (`package-lock.json` → npm, `pnpm-lock.yaml` → pnpm,
`yarn.lock` → yarn, `bun.lockb` → bun). Guided mode confirms before installing; unguided installs
directly.

```bash
npm install --save-dev 'eslint-plugin-i18next@^6'
# pnpm add -D 'eslint-plugin-i18next@^6' | yarn add -D 'eslint-plugin-i18next@^6' | bun add -D 'eslint-plugin-i18next@^6'
```

Flat config (ESLint 9+). Detect the style first — `eslint.config.{js,mjs,cjs,ts}` means flat,
`.eslintrc.*` means legacy (`{ "extends": ["plugin:i18next/recommended"] }`, then the same rule options).

```js
// eslint.config.mjs
import i18next from 'eslint-plugin-i18next'

export default [
  // …existing config
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    ignores: ['src/i18n/**'],          // t.ts / loader.ts are the only allowed getMessage call sites
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': ['error', {
        // NOTE: options are SHALLOW-merged over the plugin defaults, so each object
        // below REPLACES the default of the same name — re-list what you want to keep.
        mode: 'jsx-text-only',         // 'all' if the UI is built with plain DOM
        callees: { exclude: [
          // Patterns are full-match regexes with an implicit `(?:.*\.)?` prefix, so the
          // bare name matches browser.i18n.getMessage and chrome.i18n.getMessage alike.
          'getMessage', 'getURL', 't', 'plural', 'require', 'addEventListener',
          'removeEventListener', 'postMessage', 'getElementById', 'querySelector',
          'querySelectorAll', 'includes', 'indexOf', 'startsWith', 'endsWith',
        ] },
        words: { exclude: [
          '[0-9!-/:-@[-`{-~]+', '[A-Z_-]+',
          // Storage keys, alarm names, menu ids and message types are call arguments,
          // not properties — list the project's real ones here.
          'locale', 'sync-clips', 'clip-selection',
        ] },
        'jsx-attributes': { exclude: [
          'className', 'styleName', 'style', 'type', 'key', 'id', 'width', 'height', 'data-testid',
        ] },
        'object-properties': { exclude: [
          '[A-Z_-]+', 'id', 'type', 'action', 'world', 'matches', 'contexts', 'key',
        ] },
      }],
    },
  },
]
```

Run the project's lint once and report the new-error count. If it is large (>50), tune `words.exclude`
and `object-properties.exclude` with the project's real identifiers before handing it over — a first
pass that produces hundreds of false positives gets the rule turned off.

### If no plugin fits: the grep gate

For a plain-DOM extension where `mode: 'all'` is not acceptable, install nothing and add a grep gate
instead. It has no precision, so it is a **review prompt**, not a linter — but it is honest about that
and it catches the common shapes:

```bash
#!/usr/bin/env bash
# scripts/check-bare-strings.sh — recall grep for user-visible text outside the catalog.
set -uo pipefail
hits=$(grep -rnE "(textContent|innerText|innerHTML)[[:space:]]*=[[:space:]]*['\"][A-Za-z]|(placeholder|title|aria-label|alt)=\"[A-Za-z]" \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.html' src entrypoints 2>/dev/null \
  | grep -v 'data-i18n' | grep -v '/i18n/' || true)
if [ -n "$hits" ]; then
  echo "$hits"
  echo
  echo "Bare user-visible strings. Add a key to messages.json and read it with t(), or mark the element with data-i18n."
  exit 1
fi
```

Wire it as `"i18n:grep": "bash scripts/check-bare-strings.sh"` and add a step to the Add-on 1 workflow.
Note that `data-i18n`-annotated markup is excluded on purpose — the source text stays in the HTML there
by design, as the readable default.

---

## End

Record applied add-ons in the end-of-run summary so the user has an audit trail of what was wired up.
