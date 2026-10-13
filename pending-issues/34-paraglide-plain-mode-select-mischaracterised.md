# 34 — Paraglide PO plugin: the `messageFormat: "plain"` failure is mischaracterised in six places (a `select` renders `undefined`, not raw ICU — and the typecheck catches it)

- **Raised:** 2026-10-08 (scheduled run). **Trigger:** (F) — oldest unverified behavioural claim. Head carried from 2026-10-07's (F) section verbatim: *"the PO path's `messageFormat: "icu"` warning in `paraglide.setup.md` … is now the only unmeasured behavioural claim left in the two Paraglide setup files, and the harness to measure it is already built."*
- **Shape:** PR-shaped. **Ready for review**, not draft.
- **Branch when a write path exists:** `library-check/paraglide-plain-mode-symptoms`
- **Patch:** [`34-paraglide-plain-mode-select-mischaracterised.patch`](./34-paraglide-plain-mode-select-mischaracterised.patch) — **5 files, `+15/-7`**, `git apply --check` clean on `main` `48a676ae`.
- **Overlap:** touches 4 of draft **33**'s 5 files and 1 of draft **29**'s 2 files. **Both pairs commute** — identical tree hashes in either order (measured, below). No non-commuting pair introduced.
- **Not a regression.** Nothing published in this window reaches Paraglide. The claim has read this way since the file was written; it was never measured.

## The claim under test

`skills/globalize-guide/references/languages/js-ts/frameworks/sveltekit/paraglide.setup.md` **L70**, a block quote in the settings section of the **default** (PO) Paraglide setup file:

> **`messageFormat: "icu"` is required and load-bearing.** The default is `"plain"`, which reads only `{name}`-style placeholders and renders ICU `plural` / `select` / `selectordinal` bodies as **literal text** — silently, with no build error. Without `"messageFormat": "icu"` every plural and select message in the project is broken. Always set it.

Five other places restate or derive from it:

| file | line | the derived claim |
|---|---|---|
| `sveltekit/paraglide.setup.md` | 380 | Verify step 3: render a **plural**; raw source means `messageFormat` is missing; *"it is the only signal that ICU is actually being evaluated"* |
| `sveltekit/paraglide.convert.md` | 308 | Verify step 3: *"both fail silently at import, so this is the only check that catches them"* |
| `libraries/paraglide/rules.template.md` | 289 | the diagnostic, **in the rules file the skill installs into the user's repo**: *"If a string renders as raw `{count, plural, …}` on screen, the ICU body is malformed or the plugin's `"messageFormat": "icu"` setting is missing."* |
| `libraries/paraglide/json-format.convert.md` | 25 | *"the PO plugin's **silent-literal** behavior is a PO-only footgun"* |
| `SKILL.md` | 608, 683 | the orchestrator: *"fails **silently** (renders raw ICU)"* and *"both fail silently"* |

## What was measured

`@inlang/paraglide-js@2.26.0` (the version `^2` resolves to) + `@globalize-now/paraglidejs-po-format@0.1.2` (the version the `@0.1` CDN pin resolves to, loaded from the identical `dist/index.js` out of the npm tarball — `cdn.jsdelivr.net` is blocked on both transports, see Sandbox note in the report). One `project.inlang/settings.json`, one `messages/en.po`, eight bodies, standalone `paraglide-js compile`, rendered through `node`. The **only** difference between the two columns is the presence of `"messageFormat": "icu"` in the plugin settings block.

| # | `msgstr` | plain: compiled `Inputs` | plain: rendered | icu (control) |
|---|---|---|---|---|
| a | `Hello {name}` | `{ name }` | `"Hello Ada"` | `"Hello Ada"` |
| b | `{count, plural, one {# like} other {# likes}}` | `{}` | **`"{count, plural, one {# like} other {# likes}}"`** | `"1234567 likes"` |
| c | `{count, plural, one {{count} like} other {{count} likes}}` | `{ count }` | **`"{count, plural, one {1234567 like} other {1234567 likes}}"`** | `"1234567 likes"` |
| d | `{count, plural, one {{count, number} like} …}` | `{}` | literal source | `"1,234,567 likes"` |
| e | `{g, select, female {She} male {He} other {They}} replied` | **`{ She, He, They }`** | **`"{g, select, female undefined male undefined other undefined} replied"`** | `"She replied"` |
| f | `{g, select, female {{n} girls} other {{n} others}} here` | `{ n }` | **`"{g, select, female {1234567 girls} other {1234567 others}} here"`** | `"1234567 girls here"` |
| g | `{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} place` | `{}` | literal source | `"1234567th place"` |
| h | `You have {amount, number} points` | `{}` | **`"You have {amount, number} points"`** | `"You have 1,234,567 points"` |

Inputs: `{ name:'Ada', count:1234567, n:1234567, amount:1234567, g:'female' }`.

**The compiled artifact is the proof, not the rendering.** `messages/replied.js` under plain mode:

```js
/** @typedef {{ She: NonNullable<unknown>, He: NonNullable<unknown>, They: NonNullable<unknown> }} RepliedInputs */
const en_replied = (i) => {
	return (`{g, select, female ${i?.She} male ${i?.He} other ${i?.They}} replied`)
};
```

and the cause, from the plugin's own `dist/index.js`:

```js
const format = settings[PLUGIN_KEY]?.messageFormat ?? "plain";   // L10360 — the default
…
if (format === "plain") { const { pattern, declarations } = parsePattern(msgstr); … }
```

`parsePattern` reads every `{…}` as a `{name}` placeholder. In a `select` body the **branch bodies** are `{…}`, so `She` / `He` / `They` become the message's declared inputs. A plural branch written with `#` has no brace, which is the only reason b and g stay literal.

### Build signal: confirmed silent, in both modes

```
$ npx paraglide-js compile --project ./project.inlang --outdir ./src/paraglide
i [paraglide-js] Compiling inlang project ...
√ [paraglide-js] Successfully compiled inlang project.
rc=0   stderr: 0 bytes   grep -ic warn on stdout+stderr: 0 / 0
```

Measured with b, e and h in the same catalog. There is no warning to read, so the Verify sections' *"Exit 0 is not the check — read the warnings"* has nothing to work with here.

### Typecheck signal: `select` is **not** silent — and nothing else is caught

`tsc --noEmit`, `allowJs`, `types: []`, call sites written as an agent would write them for the ICU bodies:

```
src/callsite.ts(3,30): error TS2353: Object literal may only specify known properties,
                       and 'g' does not exist in type 'RepliedInputs'.
```

- `m.replied({ g: 'female' })` → **TS2353**. Measured identically **with and without `checkJs`**: the JSDoc `@typedef` is read off the emitted `.js` whenever `allowJs` is on, so `checkJs` is not required for the signal.
- `m.likes({ count: 5 })` and `m.points({ amount: 1000 })` → **no error**. Their compiled `Inputs` is `{}`, and `{}` accepts any object, so excess-property checking never fires.

`SKILL.md:572` already prescribes `tsc --noEmit` in Phase-2 verification, so this signal is on a command the skill runs today — and no file says so.

### The half of L289 that is correct, and stays

A **malformed** ICU `msgstr` under `messageFormat: "icu"` *is* silently imported as literal text — measured, `{count, plural, one {# like} other {# likes` (unclosed) compiles exit 0 and emits the body verbatim. Identical under plain. That sentence is accurate and the patch leaves it untouched; only the diagnostic that follows it is extended.

## Why the claim is wrong, precisely

1. **A `select` does not render as literal text.** It renders `undefined`, once per branch. An agent handed L289's diagnostic (*"if a string renders as raw `{count, plural, …}`"*) and looking at `{g, select, female undefined …}` has no stated cause to map it to.
2. **A `select` is not silent.** It is the one construct the prescribed typecheck catches. Three files call the render check *"the only signal"* / *"the only check that catches them"*; for a select that is false, and for plural and `{x, number}` it is true — the opposite of what a reader would guess from the typecheck being mentioned nowhere.
3. **A plural written with `{count}` instead of `#` is not literal either.** It interpolates the count into every branch and keeps the ICU scaffolding around it (`{count, plural, one {1234567 like} other {1234567 likes}}`) — a third distinct symptom.
4. **The enumeration is too narrow.** The claim names `plural` / `select` / `selectordinal`. A bare `{amount, number}` is none of those and is also broken, also silently. A project with no plural and no select anywhere is in scope and no file says so.

## The fix

Five files, `+15/-7`:

- **`sveltekit/paraglide.setup.md` L70** — replace the one-sentence characterisation with a three-row symptom table (raw source / scaffolding-with-count / `undefined`), name `{amount, number}` as in scope, and state that `select` fails the typecheck with `TS2353` while plural and `number` pass it clean.
- **`sveltekit/paraglide.setup.md` L380** — Verify step 3 now requires rendering **a plural *and* a select**, and says why: a plural-only check passes a project whose every select is broken.
- **`sveltekit/paraglide.convert.md` L308** — same addition to the convert-side verify, and *"the only check"* qualified.
- **`libraries/paraglide/rules.template.md` L289** — the installed diagnostic gains the two unmapped symptoms (`undefined` for a select, verbatim `{amount, number}`), so the rules file in the user's repo can explain what they are looking at. **The first sentence is unchanged — it was measured and it is correct.**
- **`libraries/paraglide/json-format.convert.md` L25** — *"silent-literal behavior"* → *"silent-import behavior — raw ICU for a plural, `undefined` for a select"*.
- **`SKILL.md` L608 / L683** — the orchestrator's two restatements corrected in place.

### The judgement call

**A table in a setup file, rather than one more sentence.** The three symptoms share one cause and one fix, so a sentence is tempting. Rejected: the whole defect is that an agent cannot get from the symptom it is looking at back to the cause, and a prose list of three symptoms that are easy to confuse is how the current single sentence got written. The cost is ~9 lines in one block quote in the default setup file. **If you disagree, correcting L70 and L289 alone is a strict subset of this patch.**

**Not changed: the `#`-vs-`{count, number}` question.** That is draft **33**'s subject and this patch deliberately does not touch any `#` occurrence — which is also why the two commute.

## Verification

- `git apply --check` on `main` `48a676ae`: **clean**.
- **Commutation, measured by tree hash** (`sha256sum` over every file under `skills/` and `evals/`, both orders):
  - `34 × 33` — order A `55b249b8…f535c`, order B `55b249b8…f535c` → **commutes**
  - `34 × 29` — order A `08f8c353…0bcc9`, order B `08f8c353…0bcc9` → **commutes**
- Standalone verifiers, on clean `main`, on `main`+34, and on `main`+33+34 — **identical all three ways**: `verify-manifest` 6/0/0, `verify-format-helpers` 99/0/0, `verify-rules-template` 114/0/0. `bash -n` clean on all 14 `evals/**.sh`.
- **No behavioural eval covers this and none can regress on it** (item 68(b), asked rather than assumed): `grep -rlF` over `evals/` and `fixtures/` for `messageFormat`, `select,`, `selectordinal`, `TS2353`, `silent-literal`, `undefined male` → **0 hits each, in both trees**. There is still no `paraglide` entry under `evals/library-checks/`. **Fifth consecutive finding in a fifth stack that the eval suite asserts nothing about.**
- Every patch replacement asserted an **exact expected occurrence count (1) before editing**, with the script aborting on mismatch. It aborted twice on the first two attempts — two anchors use a straight apostrophe where the draft text had a typographic one — and wrote nothing until all seven matched. Without the assertion, five of seven edits would have landed and the two diagnostics in `rules.template.md` and `json-format.convert.md` would have been silently skipped.

## Suggested eval, left to a human

Same shape as drafts 30–33 propose. One fixture catalog with a plural (`#` form), a `select` and a bare `{x, number}`, compiled by `paraglide-js` twice — with and without `"messageFormat": "icu"` — asserting the three distinct plain-mode strings and the three correct icu-mode strings. Fixture policy is a human's call.
