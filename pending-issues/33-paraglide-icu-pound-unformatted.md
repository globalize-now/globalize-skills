# 33 — ICU `#` in Paraglide: implemented on ICU-JSON from 2.27.0, still unformatted on PO, and the skill teaches it everywhere

**Status:** PR-shaped, **ready for review**. Unfiled — no write path on 2026-10-07, 10-08, 10-09 or 10-10 (connector absent, PAT `401`).
**Patch:** [`33-paraglide-icu-pound-unformatted.patch`](./33-paraglide-icu-pound-unformatted.patch) — **5 files, `+21/-12`**, `git apply --check` clean on `main` `48a676ae`.
**Target:** `main`.
**Branch to use when a write path exists:** `library-check/paraglide-icu-pound`.
**Overlap:** disjoint by file from 21, 22, 23, 25, 27, 28, 29, 30, 31, 32, 34, 35. **Shares `frameworks/sveltekit/paraglide.convert.md` with new draft 36** — the hunks are ~145 lines apart and **commute**: `33→36` and `36→33` produce an identical tree (`sha256 16232ea9…`, measured 2026-10-10).
**Found:** 2026-10-07, by running `paraglide-js compile` on purpose-built catalogs. **Rewritten 2026-10-10** after `@inlang/paraglide-js@2.27.0`.

> ## ⚠ REWRITTEN 2026-10-10 — upstream implemented `#`, on one of the two formats
>
> `@inlang/paraglide-js@2.27.0` (published **2026-10-09T23:07:37.119Z**, ~7 h before this run, and what
> `@inlang/paraglide-js@^2` installs today) **implements ICU `#` and `offset:`**. The draft's original
> headline — *"Paraglide does not implement ICU `#`"* — is **no longer true as written**, and the fourth
> Verify outcome the old patch added to `json-format.setup.md` described a warning that **no longer
> appears** on the ICU-JSON path.
>
> It is still true on the format this skill makes the **default**. The patch therefore keeps every
> example change and **replaces the rationale**: the rule is now stated as a split, measured on both
> formats at both compiler versions. A patch that had landed yesterday would be teaching a false reason
> today; one that is reverted entirely would leave the default path broken and silent.
>
> **Isolated to the compiler, not the plugin** (single-variable, same catalog):
>
> | compiler | catalog plugin | `#` compiles to |
> |---|---|---|
> | 2.26.0 | `plugin-icu1@1.1.1` | `${i?.count}` + one `icu:pound` warning |
> | 2.26.0 | `plugin-icu1@**1.2.0**` | `${i?.count}` + one `icu:pound` warning |
> | **2.27.0** | `plugin-icu1@1.1.1` | **`registry.icuPound(…)`**, no warning |
> | **2.27.0** | `plugin-icu1@1.2.0` | **`registry.icuPound(…)`**, no warning |
>
> `@inlang/plugin-icu1` **1.2.0** (also in this window) is not what changed the behaviour. Both 1.1.1 and
> 1.2.0 import `#` as a `function-reference` named `icu:pound`; **2.27.0 is the first compiler that maps
> that name to a registry function** — `dist/compiler/compile-annotation.js:16`, `["icu:pound",
> "icuPound"]`, with `offset` carried through (`offsetAnnotations = new Set(["plural", "icu:pound"])`).

## What is wrong, as measured today

`skills/.../libraries/paraglide/rules.template.md` — the file this skill **installs into the user's repo
as coding rules** — says at L199:

> `#` is the count placeholder inside a plural/selectordinal branch — do not repeat the variable name there.

Measured on one catalog, `count = 1234567`, every cell a real `paraglide-js compile` + `node` run:

| message body | PO plugin `0.1.2`, compiler 2.26.0 | PO `0.1.2`, **2.27.0** | ICU-JSON `plugin-icu1@1.2.0`, 2.26.0 | ICU-JSON, **2.27.0** |
|---|---|---|---|---|
| `{count, plural, one {# like} other {# likes}}` | `1234567 likes` | **`1234567 likes`** | `1234567 likes` | **`1,234,567 likes`** |
| `{count, plural, one {{count, number} …}}` | `1,234,567 likes` | `1,234,567 likes` | `1,234,567 likes` | `1,234,567 likes` |
| `{count, plural, one {{count} like} …}` | `1234567 likes` | `1234567 likes` | `1234567 likes` | `1234567 likes` |
| `{n, selectordinal, one {#st} …}` | `1234567th` | `1234567th` | `1234567th` | **`1,234,567th`** |
| `{count, plural, offset:1 one {# other} …}` | `1234567 others` | `1234567 others` | `1234567 others` | **`1,234,566 others`** |
| build signal for `#` | **silent** | **silent** | one `icu:pound` warning per build | none |

`fr` for the same cells on ICU-JSON 2.27.0: `1 234 567 j'aime`, `1 234 566 autres` — so it is real
locale formatting, not a hardcoded `en` grouping. (A fallback message compiles the **base** locale's
`registry.*(…, "en", …)` calls, so the fr column is only meaningful with a real fr catalog; one was
written for these cells.)

**So, in one sentence:** `#` is correct **only** on ICU-JSON **and only** from compiler `2.27.0`; it is
unformatted on the PO default at every `2.x`, and silently so. `{count, number}` is correct in **all four**
cells.

### Why the patch still changes the examples to `{count, number}`

Three reasons, in order of weight:

1. **PO is this skill's default** (`paraglide.setup.md` L19) and is unfixed — the plugin maps ICU `#` to a
   bare `variable-reference` with no annotation (`dist/index.js`: `case TYPE.pound: … pattern.push({ type:
   "expression", arg: { type: "variable-reference", name: arg } })`), so the compiler never sees an
   `icu:pound` to format and `offset:` is discarded with it. **Upstream-in-our-own-repo; see "Needs a human".**
2. **`^2` floats both ways.** A project set up by this skill yesterday has `2.26.0` in its lockfile and
   `#` does not work; one set up today has `2.27.0` and it does. A rule installed into a user's repo
   cannot be right only for lockfiles written after 2026-10-09T23:07Z.
3. **`{count, number}` is correct everywhere** — all four cells above, both formats, both versions,
   byte-identical output to `#` where `#` works.

`#` being idiomatic ICU is the argument on the other side, and a reviewer who wants the ICU-JSON branch
of `rules.template.md` to permit `#` with a `>= 2.27.0` floor can say so — the file already has
`<!-- if -->` / `<!-- else -->` format conditionals, and the rule bullet this patch rewrites sits in the
**shared** `### Rules` section, which is why it is written as a split rather than as a prohibition.

## The fix

Five files, `+21/-12`:

1. **`libraries/paraglide/rules.template.md`** — the L199 rule replaced by the measured split (which
   format × which compiler version × what you get × which build signal), naming `{count, number}` /
   `{n, number}` as the form that is right in every cell; the `offset:` bullet rewritten the same way
   (honoured on ICU-JSON `>= 2.27.0`, dropped silently everywhere else). The six example bodies
   (decision tree ×2, "Plurals, select, ordinal" ×2, ordinal ×2) updated, because the agent copies the
   example, not the rule.
2. **`frameworks/sveltekit/paraglide.setup.md`** — seed catalog (`likes`).
3. **`libraries/paraglide/json-format.setup.md`** — seed catalog (`likes`); the Verify stamp moved to
   `plugin-icu1@1.2.0` on Paraglide 2.27.0 **and** 2.26.0; the fourth outcome rewritten as a
   **version-gated** one — the `icu:pound` warning below `2.27.0`, nothing at or above it, and the PO
   contrast kept because that is the format the reader may migrate to.
4. **`libraries/paraglide/json-format.convert.md`** — `cart_item_count` example.
5. **`frameworks/sveltekit/paraglide.convert.md`** — `cart_item_count` example.

## Verification

- `git apply --check` **clean** on `main` `48a676ae` (2026-10-10).
- Every replacement asserted an **exact expected occurrence count before editing**, script aborting and
  writing nothing on any mismatch: **13 anchors, all matched** (two needed widening with a neighbouring
  line — the unindented PO and JSON `likes` bodies are substrings of the indented decision-tree copies,
  and the first attempt aborted on `found 2, expected 1` rather than editing the wrong line).
- Standalone verifiers, run on clean `main` and on `main`+33+36, **identical both ways**:
  `verify-manifest.sh` **6 passed / 0 failed / 0 warnings**, `verify-format-helpers.sh` **99/0/0**,
  `verify-rules-template.sh` **114/0/0**. `bash -n` clean on all 10 `evals/*.sh` and all 4
  `evals/library-checks/*.sh`.
- **The eval suite asserts nothing about any of this.** `grep -rlF` over `evals/` and `fixtures/` for
  `icu:pound`, `icuPound`, `selectordinal`, `offset:`, `plugin-icu1`, `2.27.0` → **0 files each**.
  `evals/library-checks/` has no paraglide script at all (`angular-localize`, `lingui`, `next-intl`,
  `vue-i18n`).

## Needs a human

1. **`@globalize-now/paraglidejs-po-format` is ours, and it is now the only thing standing between the
   default path and a correct `#`.** The compiler implements `icuPound` with offset support; the plugin
   never emits the annotation. The import is one `case` in `dist/index.js`'s pattern walker: emit
   `{type: "expression", arg: {type:"variable-reference", name: arg}, annotation: {type:
   "function-reference", name: "icu:pound", options: offset ? [{name:"offset", …}] : []}}` instead of the
   bare expression. **Different repo — not in this patch**, and the version floor that would then belong
   in the skill (`@inlang/paraglide-js@>=2.27.0`) is a product decision.
2. **Whether to permit `#` on ICU-JSON behind a `>= 2.27.0` floor** rather than standardise on
   `{count, number}`. The patch takes the portable route; the split is written down either way.
3. **`offset:` is taught nowhere** (`grep -rn 'offset:' skills/` → 0 hits), so the preventive bullet is
   the only thing that stops an agent inventing it. On ICU-JSON `>= 2.27.0` it now works correctly, which
   is a reason to revisit that bullet later, not today.

---

## Re-measured 2026-10-12 against `@inlang/plugin-icu1@1.3.2` (open item 77) — CONFIRMED, patch unchanged

`@inlang/plugin-icu1` published **three times** inside the 2026-10-11/12 window — `1.3.0` (18:54:02.513Z), `1.3.1` (23:14:57.705Z), `1.3.2` (01:56:15.261Z) — moving `latest` **1.2.0 → 1.3.2**, a minor bump. The CDN pin this skill emits is `@1`, so **every ICU-JSON project now loads 1.3.2**. Item 77 requires re-measuring, not re-applying, so the draft's central mechanism was re-run rather than re-read.

**The import path is byte-identical across six versions.** `plugin.importFiles()` on one catalog, `{"greeting": "{count, plural, one {# like} other {# likes}}"}`, `JSON.stringify` of the whole result hashed:

| plugin version | import result `sha256` | `icu:pound` occurrences |
|---|---|---|
| `1.1.0` (the version `json-format.setup.md` is stamped against) | `32ac70ef6a11bb70` | 2 |
| `1.1.1` (this draft's first measurement) | `32ac70ef6a11bb70` | 2 |
| `1.2.0` (this draft's 2026-10-10 measurement) | `32ac70ef6a11bb70` | 2 |
| `1.3.0` | `32ac70ef6a11bb70` | 2 |
| `1.3.1` | `32ac70ef6a11bb70` | 2 |
| **`1.3.2`** | **`32ac70ef6a11bb70`** | **2** |

So the draft's isolation holds unchanged: `#` still imports as a `function-reference` named `icu:pound`, and **the compiler, not the plugin, is what maps it** (`2.27.0`'s `["icu:pound", "icuPound"]`). The 2026-10-10 rewrite's four-cell table extends to `1.3.2` with no new row needed. **Patch untouched.**

**What 1.3.x actually changed is the serialize (write-back) path, which this repo does not use.** Read from the tarballs, with the change attributed to the release that carries it (open item 84):

- `escapeIcuText` appears from **1.3.0** (0 occurrences at 1.2.0, 1 from 1.3.0 on) and becomes a **public export** — `escapeIcuText(value, inPlural)`, documented as quoting `{`, `}` and, in a plural, `#`.
- `HashInSelect` and `quoteHashInSelect` are present at 1.3.0 and 1.3.1 (3 occurrences each) and **gone at 1.3.2** (0). `serialize.d.ts` replaces `quoteHashInSelect?: boolean` with `selects?: string[]` and `selectors?: string[]`, and its comment gains the sentence *"No quoting reads the same in both."* — i.e. upstream concluded the escape hatch could not be made correct and removed it.
- `index.d.ts` gains three exports at 1.3.x: `parseMessage` / `ParsedMessage`, `serializeMessage`, `escapeIcuText`.
- Only `dist/index.js`, `dist/index.d.ts`, `dist/serialize.d.ts` and `package.json` differ from 1.2.0; `@inlang/sdk` moved `4.0.0 → 4.0.1 → 4.0.2` (the one level-2 range that moved this window).

**Exposure: none.** `grep -rn 'escapeIcuText\|parseMessage\|serializeMessage\|quoteHashInSelect\|HashInSelect' skills/` → **0 occurrences**. Paraglide imports and never serializes back, so a round-trip API change cannot reach a user of these skills.

**One stamp in a file this patch already touches is now stale.** `json-format.setup.md` L67 reads *"all verified against `@inlang/plugin-icu1@1.1.0` on Paraglide 2.25.2"*, and `@1` resolves to **1.3.2** today — two minors on. The three Verify outcomes were therefore re-measured behaviourally rather than assumed: a malformed body (`{count, plural, one {# like} other {# likes}` — closing brace missing) **throws at every version from 1.1.0 to 1.3.2**, with the message `Unexpected message end at line 1 col 45` — the **exact string the skill quotes**, byte for byte. Outcome 1 holds. **Deliberately not folded into this patch**, which is about `#` and is ready for review; the stamp is carried as a 2026-10-12 (F) head instead so this draft does not grow a second subject.
