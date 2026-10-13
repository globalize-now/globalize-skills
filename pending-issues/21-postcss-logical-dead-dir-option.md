# `postcss-logical` config snippet passes a `dir` option that was removed three majors ago

**Draft written:** 2026-09-26 (library check). **Unfiled** — the GitHub PAT returns
`401 Bad credentials`, so no PR could be opened. See § Filing.

**Type:** PR (implementable — a config snippet and one paragraph of prose).
**Severity:** Medium. Nothing errors and nothing warns; the option is silently ignored,
and the one case where a user would most want it — RTL — silently produces LTR output.

**File:** `skills/css-i18n/references/css-modules-and-vanilla.md` L222–240
(§ *PostCSS Plugin (Optional Tooling)*).

**Duplicate check (item 52):** the changed-file lists of all 11 open PRs were read via
the API. **Nothing open touches `skills/css-i18n/`** at all, let alone this file. A fresh
branch is safe.

---

## What the reference says

```bash
npm install 'postcss-logical@^9' --save-dev
```

```js
// postcss.config.js
module.exports = {
  plugins: [
    require('postcss-logical')({ dir: 'ltr' }),
  ],
}
```

## Why it is wrong

`dir` is not an option of `postcss-logical@9`. The shipped type declaration
(`dist/index.d.ts` in the 9.0.1 tarball) is the whole option surface:

```ts
export declare type pluginOptions = {
    /** Ignore logical properties with values containing `var()` */
    ignoreCustomProperties?: true;
    /** Sets the direction for block. default: top-to-bottom */
    blockDirection?: DirectionFlow;
    /** Sets the direction for inline. default: left-to-right */
    inlineDirection?: DirectionFlow;
};
```

The plugin merges the caller's object over its defaults
(`Object.assign({blockDirection, inlineDirection}, opts)`) and validates only the two
direction keys, so an unknown key is dropped without a warning.

`dir` **was** real, in `postcss-logical@4` and `@5` — the 4.0.2 and 5.0.4 READMEs both
document `{ dir: 'ltr' }`. It was removed in **6.0.0 (2023-01-24)**, whose CHANGELOG
says:

> Updated: The plugin now requires block and inline direction to be configured (uses
> `top-to-bottom` and `left-to-right` respectively) and no longer introduces `:dir`
> (major).

So the snippet pairs a **v9 install pin** with **v5-era option syntax**: no version
satisfies both halves.

### Measured, not inferred

`postcss@8.5.6` + `postcss-logical@9.0.1` (resolved from the reference's own `^9`),
input `.a{ margin-inline-start: 10px; padding-inline: 1px 2px; text-align: start; }`:

| options passed | output | warnings |
|---|---|---|
| `{ dir: 'ltr' }` — as the reference writes it | `margin-left: 10px; padding-left: 1px; padding-right: 2px; text-align: left;` | none |
| `{ dir: 'rtl' }` | **identical to the above** — still `margin-left`, `text-align: left` | none |
| `{ inlineDirection: 'right-to-left' }` — documented | `margin-right: 10px; padding-right: 1px; padding-left: 2px; text-align: right;` | none |
| no options at all | identical to `{ dir: 'ltr' }` | none |

The second row is the damaging one. A reader of a **CSS internationalisation** reference
who copies this snippet and changes `'ltr'` to `'rtl'` — the obvious thing to do — gets
LTR physical properties, no warning, and a silently mis-mirrored stylesheet.

`require()` of this ESM-only package is *not* a defect: 9.x declares
`engines.node >= 20.19.0`, where `require(esm)` works. Verified on Node 22.23.2 — the
`require` in the snippet loads fine. Only the option is wrong.

## The second half: v9 flattens to one direction

Worth fixing in the same edit, because it is the reason the `dir` option existed at all.
`postcss-logical@5` could emit direction-aware CSS (`:dir(ltr)` / `:dir(rtl)` rule
pairs). **6.0.0 removed that** — see the CHANGELOG line above. In v9 the plugin rewrites
each logical property to the physical equivalent for **one** configured direction and
removes the original declaration; there is no `:dir()` in the output (confirmed in all
four runs above).

For a skill whose subject is RTL support, that consequence should be stated: running this
plugin **discards** the direction-agnostic source. A site that must serve both LTR and RTL
needs either two builds with different `inlineDirection` values, or — better, and what the
reference's own closing note already recommends — to keep the logical properties and not
run the plugin at all.

## Proposed change

Replace the config block with the documented options:

```js
// postcss.config.js
module.exports = {
  plugins: [
    require('postcss-logical')({
      blockDirection: 'top-to-bottom',
      inlineDirection: 'left-to-right',
    }),
  ],
}
```

and add, after it:

> Both options default to these values, which suit any LTR latin-script language. The
> plugin rewrites each logical property to the physical equivalent for the **one**
> direction configured here and drops the logical declaration — since 6.0.0 it no longer
> emits `:dir(ltr)` / `:dir(rtl)` pairs. So a single build serves a single direction: for
> an RTL locale set `inlineDirection: 'right-to-left'` in a separate build, and if the
> site must serve both directions from one stylesheet, keep the logical properties and
> skip this plugin.

The existing closing note ("a build-time convenience, not a substitute for writing
logical properties") stays — it is right, and the new paragraph is what makes it concrete.

## Verification — already done

**The change is written and verified; only the push is blocked.** It is applied in a
scratch `--depth 1` clone of `origin/main` (`a997b6d`) and saved next to this draft as
`21-postcss-logical-dead-dir-option.patch` — `git apply` it and the PR is ready.

`evals/` has no eval covering `skills/css-i18n/`, so the three standalone evals were run
as regression controls with the change applied:

| eval | result |
|---|---|
| `evals/verify-manifest.sh` | **6 passed, 0 failed, 0 warnings** (rc 0) |
| `evals/verify-rules-template.sh` | **104 passed, 0 failed, 0 warnings** (rc 0) |
| `evals/verify-format-helpers.sh` | **88 passed, 0 failed, 0 warnings** (rc 0) |

Identical to the controls recorded on unmodified `main` on 2026-09-25, so the edit
regresses nothing. The substantive verification is the option-behaviour table above: four
`postcss().process()` calls against the real 9.0.1 — cheap to re-run in review, no
Next.js or framework build involved.

## How this was found

`postcss-logical` published **9.0.1** on 2026-09-25T14:20:10Z (the only tracked `latest`
to move in the window). The release itself is **not** actionable — `^9` picks it up, and
the tarball diff against 9.0.0 is one guarded `throw` when a `transition` transform would
exceed 10 000 combinations (caught by the plugin's own handler and downgraded to a PostCSS
warning) plus a `hasOwnProperty` guard and two cosmetic rewrites. Sweeping from that
publish to the call site (trigger G) is what surfaced the dead option, which has been
wrong since the reference was written.

## Filing

Blocked on the PAT. `library-checks/.github-token` (added 2026-08-25, unchanged) returns
`401 Bad credentials`; an unauthenticated request to the same repo in the same call
returns `200`, so egress is fine and the credential is not. Once rotated, this becomes a
**ready-for-review** PR on branch `library-check/postcss-logical-dir-option` — the change
is measured end to end and nothing about it is uncertain.

Filed: (pending)

---

**Still unfiled 2026-09-27.** Third consecutive run blocked on the same `401 Bad credentials` from `library-checks/.github-token` (mtime still 2026-08-25 17:27:18Z). Re-checked this run with an unauthenticated control on the same repo in the same call returning `200`, so egress is fine and the credential is not. The duplicate check in this draft was re-run against the 11 open PRs today (unchanged set) and still holds.

---

**Still unfiled 2026-09-28.** Fourth consecutive run blocked on the same `401 Bad credentials` from `library-checks/.github-token` (mtime still 2026-08-25 17:27:18Z); an unauthenticated control on the same repo in the same call returned `200`, so egress is fine and the credential is not. Re-checked this run against the unchanged set of 11 open PRs and 25 open issues on `main` `a997b6d`; the duplicate checks in this draft still hold.

**Still unfiled 2026-09-29.** Fifth consecutive run blocked on the same `401 Bad credentials` from `library-checks/.github-token` (mtime still 2026-08-25 17:27:18Z); an unauthenticated control on the same repo in the same call returned `200`, so egress is fine and the credential is not. **The repo moved this run**: `main` is now `f4f71a1` ([#84](https://github.com/globalize-now/globalize-skills/pull/84) merged, 2026-09-28T07:07Z) and the open-PR set is **10**, not 11. `git apply --check library-checks/pending-issues/21-postcss-logical-dead-dir-option.patch` was re-run against the **new** `main` `f4f71a1` — still applies clean, so this is a re-verification rather than a re-stamp. Duplicate checks re-run against the 10 open PRs; still hold.

**Still unfiled 2026-09-30.** **Sixth** consecutive run blocked on the same `401 Bad credentials` from `library-checks/.github-token` (mtime still 2026-08-25 17:27:18Z); an unauthenticated control on the same repo in the same call returned `200`, so egress is fine and the credential is not. `main` is **unchanged** at `f4f71a1`, and the open set is unchanged at **10 PRs / 25 issues**, so the duplicate checks in this draft carry forward on the same baseline they were last verified against. `git apply --check library-checks/pending-issues/21-postcss-logical-dead-dir-option.patch` re-run against `f4f71a1` — **still applies clean**. `postcss-logical` has not published since 2026-09-25. Touches `skills/css-i18n/references/css-modules-and-vanilla.md` only; disjoint from the new draft 25 patch, so order does not matter.

---

**Still unfiled 2026-10-03.** Ninth consecutive run blocked on the same `401 Bad credentials`; `main` moved to **`48a676ae`** ([#91](https://github.com/globalize-now/globalize-skills/pull/91)) and the patch was re-checked on that head — **`git apply --check` clean, 1 file, `+6/-1`**, no overlap with any of the seven other queued patches. #91 touched nothing under `skills/css-i18n/`, so the duplicate check (nothing open touches that directory) still holds against the new 7-PR open set.

**`postcss-logical` published `9.0.2` in this run's window** (2026-10-02T15:54:34.813Z, `latest` 9.0.1 → 9.0.2), so the claim was re-verified at the version `^9` now installs rather than carried.

**Nothing in this draft changes.** `9.0.2` is one internal performance commit — read as a diff, not a release title: `c55aafa7d` *"improve performance (#1931)"* replaces a per-declaration `cloneBefore` loop with a single `decl.before(transformed)` batch in `plugins/postcss-logical/src/index.ts` (**+6/-6**, two identical hunks). The release commit `4117e101a` touches only `CHANGELOG.md` and `package.json`. `engines.node` unchanged at `>=20.19.0`; `type: module` unchanged.

**The option surface is byte-identical, and re-measured on 9.0.2:**

```ts
export declare type pluginOptions = {
    ignoreCustomProperties?: true;
    blockDirection?: DirectionFlow;
    inlineDirection?: DirectionFlow;
};
```

`grep` for `dir` in `9.0.2`'s shipped `dist/index.d.ts`: **no hits**. Executed on `postcss@8` + `postcss-logical@9.0.2`, input `.a{ margin-inline-start: 10px; padding-inline: 1px 2px; text-align: start; }`:

| options passed | output | warnings |
|---|---|---|
| none | `margin-left: 10px; padding-left: 1px; padding-right: 2px; text-align: left;` | 0 |
| `{ dir: 'rtl' }` | **identical to none** — `margin-left`, `padding-left/right`, `text-align: left` | **0** |
| `{ inlineDirection: 'right-to-left' }` | `margin-right: 10px; padding-right: 1px; padding-left: 2px; text-align: right;` | 0 |

So on the current `latest`, the reference's `{ dir: 'ltr' }` is still silently ignored, still warning-free, and the third row is still the control proving the real option works. The draft's severity rationale — *"the one case where a user would most want it, RTL, silently produces LTR output"* — is now confirmed on 9.0.2 by execution, with `dir: 'rtl'` as the input rather than `dir: 'ltr'`, which is the harsher version of the same demonstration.
