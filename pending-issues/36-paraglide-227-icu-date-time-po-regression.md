# 36 — `@inlang/paraglide-js@2.27.0` started honouring `datetime` options, and a styleless ICU `{d, date}` on the PO default now renders a time

**Status:** PR-shaped, **ready for review**. Unfiled — no write path on 2026-10-10 (connector absent, PAT `401`).
**Patch:** [`36-paraglide-227-icu-date-time-po-regression.patch`](./36-paraglide-227-icu-date-time-po-regression.patch) — **1 file, `+10/-2`**, `git apply --check` clean on `main` `48a676ae`.
**Target:** `main`.
**Branch to use when a write path exists:** `library-check/paraglide-227-icu-date-time`.
**Overlap:** **shares `frameworks/sveltekit/paraglide.convert.md` with draft 33** (hunks ~145 lines apart); **commutes** — `33→36` and `36→33` give an identical tree (`sha256 16232ea9…`). Disjoint by file from 21, 22, 23, 25, 27, 28, 29, 30, 31, 32, 34, 35.
**Found:** 2026-10-10, by compiling the same PO catalog on two compiler versions. First-hand measurement.

## What moved upstream

`@inlang/paraglide-js` **2.27.0**, published **2026-10-09T23:07:37.119Z** — inside this run's window and
what `@inlang/paraglide-js@^2` installs today. Read as a dist diff against `2.26.0`, not as a release
title, the load-bearing addition is in `dist/compiler/compile-annotation.js`:

- a new `withDefaultDateTimeStyles()` and a `defaultDateTimeStyles` map — `date` → `dateStyle=medium`,
  `time` → `timeStyle=medium`, **`datetime` → `dateStyle=medium timeStyle=short`** — applied *"when the
  options pick no fields"*;
- new `date` and `time` annotations alongside the existing `datetime`, with ICU-1-correct defaults
  (upstream's own comment: *"ICU MessageFormat 1 (`{d, date}`) … default to 'medium'"*);
- `["icu:pound", "icuPound"]` in the annotation→registry map (that half is draft 33).

`registry.js`'s `datetime()` is **byte-identical** between the two versions — `new
Intl.DateTimeFormat(locale, options).format(…)`. **What changed is the options object the compiler
passes it**, which `2.26.0` dropped when the annotation carried none.

## Why the skills need to change

The PO plugin — `@globalize-now/paraglidejs-po-format@0.1.2`, **ours**, loaded from the CDN at `@0.1` —
imports **both** ICU `{d, date}` and `{d, time}` as the inlang **`datetime`** annotation, carrying a
style argument through and passing **no options** when there is none (`dist/index.js`: `const name =
element.type === TYPE.number ? "number" : "datetime"`, and `styleOptions()` returns `[]` for a null
style). So on the PO format the compiler's new option-less `datetime` default lands on every styleless
ICU date or time in a catalog.

Same `.po` catalog, same plugin, **compiler version the only variable**, `d = 2026-01-15T14:30:00Z`:

| `msgstr` | compiler `2.26.0` | compiler **`2.27.0`** | build signal |
|---|---|---|---|
| `Due {d, date}` | `Due 1/15/2026` | **`Due Jan 15, 2026, 2:30 PM`** | none, either version |
| `At {d, time}` | `At 1/15/2026` | **`At Jan 15, 2026, 2:30 PM`** | none, either version |
| `Due {d, date, short}` | `Due 1/15/26` | `Due 1/15/26` | none |

`fr`: `Due 15 janv. 2026, 14:30` / `At 15 janv. 2026, 14:30` on `2.27.0`, `Due 15/01/2026` on `2.26.0`.
The compiled call for `Due {d, date}` is `registry.datetime("en", i?.d, {})` on `2.26.0` and
`registry.datetime("en", i?.d, { dateStyle: "medium", timeStyle: "short" })` on `2.27.0`.

Two things follow, and only the second is a defect in **this** repo:

1. **A styleless ICU date in a PO catalog silently gained a time**, in every locale, on any project whose
   lockfile moved to `2.27.0`. `{d, time}` has never rendered a time-only on this path — it was a date
   before and is a date+time now.
2. **The skill's own hedge is now measurably wrong in its direction.**
   `frameworks/sveltekit/paraglide.convert.md` L236 says ICU `date`/`time` skeletons *"are not yet
   runtime-verified in this setup — prefer the format module for dates/times."* The conclusion
   (*prefer the format module*) is right; the reason is now stale, and "not yet verified" reads as *might
   be fine* at exactly the moment a styleless one stopped being fine.

**On the ICU-JSON format the same catalog is correct**, because `@inlang/plugin-icu1@1.2.0` emits the new
`date` / `time` annotations and the compiler keeps ICU's defaults: `{d, date}` → `Jan 15, 2026`,
`{d, time}` → `2:30:00 PM`, `{d, date, short}` → `1/15/26` (measured on `2.27.0`).

## The fix

One file, `+10/-2`. `frameworks/sveltekit/paraglide.convert.md`'s "Numbers, currencies, dates" closing
parenthesis is replaced with the measurement: that the PO plugin imports both ICU `date` and `time` as
`datetime`, that `2.27.0` fills the option-less default `2.26.0` dropped, the three rendered rows above,
that **neither version warns**, that a style is carried through unharmed, and that ICU-JSON is correct.
The standing instruction — **prefer the format module** — is kept and strengthened, and the escape hatch
is made specific: if a catalog must carry an ICU date or time, **always give it a style**.

## Verification

- `git apply --check` **clean** on `main` `48a676ae`.
- The single replacement asserted **exactly 1 expected occurrence before editing**; the script aborts and
  writes nothing on a mismatch. **1 anchor, matched.**
- Verifiers on clean `main` and on `main`+33+36, **identical both ways**: `verify-manifest.sh` **6/0/0**,
  `verify-format-helpers.sh` **99/0/0**, `verify-rules-template.sh` **114/0/0**; `bash -n` clean on all
  14 shell scripts.
- Commutation with 33 measured, not assumed: both orders → `sha256 16232ea9df1545c7…`.
- **Eval suite is silent here too:** `grep -rlF` over `evals/` and `fixtures/` for `dateStyle`,
  `{d, date}`, `timeStyle`, `datetime`, `2.27.0` → **0 files each**.

## Needs a human

1. **The root cause is in our own plugin, not in this repo.**
   `@globalize-now/paraglidejs-po-format` collapses ICU `date` and `time` onto `datetime`. Upstream now
   has distinct `date` and `time` annotations with ICU-correct defaults, so the fix is to emit those two
   names — after which `{d, time}` renders a time for the first time on this path. **Different repo**, and
   it needs a `@inlang/paraglide-js` floor decision to go with it.
2. **Whether to tell existing projects.** Any SvelteKit+Paraglide project on the PO default with a
   styleless `{d, date}` in a catalog changed its rendered output when its lockfile crossed `2.27.0`, with
   no warning at build time. `grep -rn ', date}\|, time}' skills/` → **0 hits**, so no example this skill
   ever emitted is affected; exposure is limited to catalogs a user wrote by hand.
3. **A fixture would catch this class cheaply** — one `.po` with a styleless ICU date, one assertion on
   the compiled `registry.datetime(…)` options object. Drafts 30–36 have each proposed a fixture of this
   shape and each left fixture policy here.

---

## Re-measured 2026-10-12 against `@inlang/plugin-icu1@1.3.2` (open item 77) — CONFIRMED, patch unchanged

`@inlang/plugin-icu1` published `1.3.0` / `1.3.1` / `1.3.2` inside the 2026-10-11/12 window, moving `latest` **1.2.0 → 1.3.2**; the pin this skill emits is `@1`, so ICU-JSON projects now load `1.3.2`. Re-measured rather than re-applied, per item 77.

**The plugin's import path is byte-identical from `1.1.0` through `1.3.2`** — `plugin.importFiles()` on the same catalog returns a result hashing to `sha256 32ac70ef6a11bb70` at all six of `1.1.0`, `1.1.1`, `1.2.0`, `1.3.0`, `1.3.1`, `1.3.2`, with `icu:pound` present in all six. This draft's subject is the **PO** path on compiler `2.27.0`, which the ICU-JSON plugin does not touch at all, and the one shared mechanism that could have moved did not. **`git apply --check` clean on `48a676ae`, 1 file, `+10/-2`. Patch untouched.**

What `1.3.x` changed is the serialize/write-back path (`quoteHashInSelect` removed at `1.3.2`, `selects`/`selectors` added, `escapeIcuText` public from `1.3.0`) plus three new public exports. `grep -rn` over `skills/` for any of those names → **0 occurrences**. No exposure on either format.
