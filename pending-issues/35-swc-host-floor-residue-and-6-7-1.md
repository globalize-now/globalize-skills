# 35 — the SWC host-floor correction is already two open PRs, both stuck; `6.7.1` re-confirms them and leaves a two-file residue

**Status:** **Do NOT open this as a PR for the host-floor claim — that is [#69](https://github.com/globalize-now/globalize-skills/pull/69) + [#63](https://github.com/globalize-now/globalize-skills/pull/63), both already open.** What ships here is the **residue** those two do not touch: two stale version stamps. PR-shaped, **ready for review**.
**Patch:** [`35-swc-host-floor-residue-and-6-7-1.patch`](./35-swc-host-floor-residue-and-6-7-1.patch) — 2 files, `+2/-2`, `git apply --check` clean on `main` `48a676ae`.
**Branch name when it can be opened:** `library-check/lingui-6-7-1-stamps`
**Found:** 2026-10-09, by the **level-1 leg** — `@lingui/swc-plugin@6.7.1` published 2026-10-08T14:53:02.933Z and is reached by the manifest spec `@lingui/swc-plugin@^6` in five stacks. First level-1 hit in weeks.

## What moved upstream

`@lingui/swc-plugin` **6.7.0 → 6.7.1**, published 2026-10-08T14:53:02.933Z. Read from the two npm tarballs, not from a release title:

| | 6.7.0 | 6.7.1 |
|---|---|---|
| `lingui_macro.wasm` | 1 890 591 bytes, `sha256 30b77fc49b6ffa4d…` | 1 823 936 bytes, `sha256 5077a531aec3153d…` |
| wasm `producers` section | `rustc 1.85.1 (2025-03-15)`, `clang 19.1.5-wasi-sdk` | **`rustc 1.98.1 (2026-09-01)`, `clang 22.1.0-wasi-sdk`** |
| wasm `target_features` | `bulk-memory, multivalue, mutable-globals, reference-types, sign-ext` | **+`bulk-memory-opt`, `call-indirect-overlong`, `extended-const`, `nontrapping-fptoint`** |
| `dist/*.js`, `dist/*.d.ts` | — | **byte-identical** (all four files) |
| `peerDependencies` | `{"@lingui/core": "5 \|\| 6"}` | unchanged |
| `peerDependenciesMeta` | `{"@swc/core": optional, "next": optional}` | **removed** |
| README compatibility table | `6.7.0 ~ *` → `swc_core@77.1.1` | **identical** |

Two of those rows are traps I checked rather than reported:

- **The `peerDependenciesMeta` removal is a no-op.** Neither `@swc/core` nor `next` is in `peerDependencies` in either version, and a `peerDependenciesMeta` entry for a package that is not a peer does nothing. This is dead-config cleanup, **not** a change from optional to required peers.
- **`useJsdocI18nComment` is not new behaviour.** The 6.7.1 README documents it (`/** i18n */` instead of `/* i18n */`, so the marker survives Rolldown codegen; needs `@lingui/cli >= 6.4.0`). Measured: the option **already worked in 6.7.0** and is already typed in `dist/map-options.d.ts:44` in both. 6.7.1 documents an existing option. (My first read said it was absent from `dist/` — that was a grep scoped to `options.d.ts`, which only re-exports. Corrected before it reached this draft.)

**Net: `6.7.1` is a toolchain rebuild plus README fixes. The macro transform is byte-identical** — measured below.

## What that forced me to measure, and what it found

`^6` now installs `6.7.1` in five manifest stacks, and six files carry a **hard host requirement** keyed to the plugin's build-time `swc_core`:

> "`^6` resolves to `6.7.0` today, so the host must ship `swc_core` 77.x — that is `@swc/core` **1.16.x** … A lockfile holding `@swc/core` at `1.15.11` runs `swc_core@56.0.0`, well below the plugin's 77.x."

### The ladder, re-measured on today's registry

Real `@swc/core` installs, one pinned host per cell, `transform()` on a `msg` macro, `@lingui/core@6.9.0`:

| `@swc/core` | plugin `6.6.0` | `6.7.0` | `6.7.1` |
|---|---|---|---|
| `1.11.31` | ❌ `failed to invoke plugin` | ❌ | ❌ |
| `1.12.11` | ❌ | ❌ | ❌ |
| `1.13.0` | ❌ | ❌ | ❌ |
| `1.14.0` | ❌ | ❌ | ❌ |
| **`1.15.0`** | ✅ | ✅ | ✅ |
| `1.15.11` | ✅ | ✅ | ✅ |
| `1.15.46` | ✅ | ✅ | ✅ |
| `1.16.13` | ✅ | ✅ | ✅ |

**The boundary is exactly `@swc/core` 1.15.0, and it is the same for all three plugin builds** — `6.6.0` (`swc_core@66.0.3`) and `6.7.x` (`77.1.1`) have an identical floor, so the plugin's build-time `swc_core` does not set a host floor. The ABI announcement the same paragraph cites is why.

**And the passing cells are not merely passing.** On a four-message catalog (interpolation, `plural`, `select`, explicit id), the emitted code is **byte-identical across `1.15.0`, `1.15.11`, `1.15.46` and `1.16.13`** — `sha256 ac8241fb687189ad…`, 447 bytes, all four — and **identical between plugin `6.7.0` and `6.7.1`** on the same host. No silent degradation on the older hosts; no behaviour change in `6.7.1`.

**Positive control, because "everything passed" is otherwise unreadable:** the harness does detect failures — `1.11.31`, `1.12.11`, `1.13.0` and `1.14.0` all fail, with every plugin. (A first attempt at a second control — old plugins on a new host — produced `failed to resolve plugin path` for `5.9.0`/`5.10.0`/`6.1.0`. That is a **packaging** difference: those versions ship the wasm at `target/wasm32-wasip1/release/lingui_macro_plugin.wasm`, not `lingui_macro.wasm`. It is not a compatibility result and is not reported as one.)

## Why this is NOT a new PR

**Both halves of that correction are already open PRs, and have been for seven to eight weeks.** Read, not inferred from titles:

| | [#69](https://github.com/globalize-now/globalize-skills/pull/69) | [#63](https://github.com/globalize-now/globalize-skills/pull/63) |
|---|---|---|
| branch | `library-check/swc-abi-direction-sweep` `2b0fc930` | `library-check/vite-swc-lingui-host-floor` `d46384ab` |
| state | open, **draft**, `updated_at` 2026-09-17 | open, **draft**, `updated_at` 2026-08-31 |
| size | 5 files `+11/-11` | 2 files `+22/-6` |
| files | rrf, remix, tanstack, webext, `lovable-i18n/SKILL.md` | `manifest.json`, `vite/react-swc` |
| says | "The floor is **≥ 1.15.0**, the plugin version is irrelevant" | "The floor is **≥ 1.15.0** … observed rather than inferred" |

#63 even carries the `swc_ecma_ast` column and refutes the version-match theory in both directions. **My ladder reproduces both independently, on hosts installed today, and extends them to `6.7.1` — the version `^6` actually installs now, published after both PRs were written.** That is the one thing a reviewer of an eight-week-old draft does not have: evidence the correction still holds for the current release.

### The blocker, measured

- **#63 `git apply --check` is CLEAN on `main` `48a676ae`.** It is merge-ready today.
- **#69 does NOT apply to `main`.** Two hunks fail: `react-router-framework/swc/lingui.setup.md:853` and `webext/swc/lingui.setup.md:92`.

**Both are context-only drift, not a content conflict.** The line #69 *removes* at rrf `853` is byte-identical to `main`'s — it has simply moved to **L872** (the file grew 19 lines in #91). What changed is the **neighbouring** bullet: #69's context reads *"…not a bare string — bare …"* while `main` now reads *"…not a bare string. A bare string is **not** silently ignored: …"*. The webext hunk applies at reduced context (`-C1`, fragment at 94) — pure line drift. **So #69 needs a rebase, and the lines it edits are untouched.** Nobody has rebased it in 22 days of `main` moving.

### The three artifacts are pairwise disjoint

Measured on `+++ b/` paths: **#63 ∩ #69 = ∅, #63 ∩ 35 = ∅, #69 ∩ 35 = ∅.** Together they cover all **7** files that carry the claim. Land in any order.

## What this patch ships

Only the residue neither PR touches — two stale version stamps, both re-verified rather than restamped blind:

1. **`nextjs/app-router/lingui.setup.md` L29** — `` `^6` resolves to `6.7.0` today `` → `6.7.1`, with the byte-identity noted. **The Next.js claim around it is left exactly as it is:** "`@lingui/swc-plugin@6.7.0` does not run on any Next.js release" is first-hand, measured on 16.1.7 / 16.2.12 / 16.3.4, and this stack pins `~6.6.0`, so no user is exposed. It is **not** restated for `6.7.1` — a new binary against Next's bundled plugin runner has not been measured, and the pin makes it moot. Recorded as an (F) head instead.
2. **`libraries/lingui/setup.locale-module.md` L38** — *"Verified against the `@lingui/*` 6.7.0 packuments — the version `^6` installs today"* was stale on **two** axes: the seven family packages are at **6.9.0**, `@lingui/swc-plugin` at **6.7.1**. Neither is 6.7.0. Re-verified at today's `latest` before restamping, so the substance behind the line still stands:

| package | `latest` | `type` | `engines.node` | `main` | `require` condition |
|---|---|---|---|---|---|
| `@lingui/core`, `react`, `detect-locale`, `cli`, `format-po`, `babel-plugin-lingui-macro`, `vite-plugin` | **6.9.0** | `module` | `>=22.19.0` | none | none |
| `@lingui/swc-plugin` | **6.7.1** | `module` | **none** | `./lingui_macro.wasm` | none |

Every precondition the paragraph asserts holds at 6.9.0 / 6.7.1, including the `main`-field trap. Only the stamp moves.

## Verification

- `git apply --check` **clean** on `main` `48a676ae`; 2 files, `+2/-2`.
- Commutes with **#63**, **22**, **28** and **30** (identical tree hash in either order); **disjoint by file** from **#69**.
- Standalone verifiers on `main`+35: `verify-manifest.sh` **6/0/0**, `verify-format-helpers.sh` **99/0/0**, `verify-rules-template.sh` **114/0/0**. `bash -n` clean on all 10 `evals/*.sh` and all 4 `evals/library-checks/*.sh`.
- `evals/library-checks/lingui.sh` exists and covers this skill but **needs a scaffolded project** (`Usage: lingui.sh <project-dir> <fixture-name>`), so it cannot run standalone.
- **The eval suite asserts nothing here.** `grep -rlF` over `evals/` and `fixtures/` for `swc_core`, `1.15.0`, `1.16.x`, `77.1.1`, `useJsdocI18nComment`, `failed to invoke plugin`, `6.7.1` → **0 files each, in both trees.** It could not have caught this and cannot regress on the correction. Sixth consecutive finding in territory the suite is silent on.

## Needs a human

Nothing blocks this 2-file patch. The decisions are upstream of it:

1. **Merge #63** — clean on today's `main`.
2. **Rebase #69** — context-only drift on two hunks; the lines it changes are intact. Or re-cut it from `main` with the ladder above.
3. The wrong claim is live in **7 files** in `main` today, eight weeks after two PRs were opened to remove it. That is the actual finding.

---

## 2026-10-11 — the ladder extends two `@swc/core` releases and one `swc_core` major, unchanged

`@swc/core` published twice this window (`1.16.17` 04:34:25Z, `1.16.18` 06:48:29Z; `1.16.14`–`1.16.16` never published), taking `latest` `1.16.13` → **`1.16.18`** and `swc_core` `81.0.2` → **`82.0.1`** → **`82.0.2`**. A **major** `swc_core` bump inside a patch release of `@swc/core`.

This draft's whole argument is that the plugin's build-time `swc_core` does **not** set a host floor. A `swc_core` major bump is the best available test of that, and it was run in the **cloud container** (where `/` is root-owned, so the `1.16.x` native addon loads — see draft 24 §1 for why the device VM cannot):

| host (`swc_core`) | plugin `6.6.0` | `6.7.0` | `6.7.1` |
|---|---|---|---|
| `1.14.0` ← control | ❌ `failed to invoke plugin` | ❌ | ❌ |
| **`1.15.0`** | ✅ | ✅ | ✅ |
| `1.16.2` (78.0.0) | ✅ | ✅ | ✅ |
| `1.16.13` (81.0.2) | ✅ | ✅ | ✅ |
| `1.16.17` (**82.0.1**) | ✅ | ✅ | ✅ |
| `1.16.18` (**82.0.2**) | ✅ | ✅ | ✅ |

**Every passing cell emits byte-identical code** — `sha256 e6e0b199755347af`, 231 bytes, all twelve — on a two-message fixture (interpolation + plural-style named value). **The boundary is still exactly `@swc/core@1.15.0`**, two `swc_core` majors later, and the reason is visible in source: `PLUGIN_TRANSFORM_AST_SCHEMA_VERSION` is `1` at `v1.16.2`, `v1.16.13` and `v1.16.18` alike. The plugin ABI is keyed to the schema constant, not to `swc_core`'s version — which is exactly what this draft, #63 and #69 all say, and what withdrawn draft 15 got wrong.

**So nothing in this patch moves**, and the two PRs it defers to are re-confirmed against a host two majors newer than when they were written.

## Item 75 re-check, 2026-10-11 — the `6.9.0` stamp is now two days stale, and still not regenerated

`libraries/lingui/setup.locale-module.md` L38's restamp names the seven `@lingui/*` family packages at **6.9.0**; they published **6.9.1** on 2026-10-09 and `latest` is unchanged at `6.9.1` today. `@lingui/swc-plugin` is still **6.7.1** (tenth day off the family train), so that half of the stamp is correct.

Re-verified rather than restamped: at `6.9.1` the seven family packages are still `type: module`, `engines.node >= 22.19.0`, no `main`, no `require` condition; `@lingui/swc-plugin@6.7.1` is still `type: module`, no `engines`, `main: ./lingui_macro.wasm`. **Every precondition the paragraph asserts holds at 6.9.1 / 6.7.1**, so the substance is sound and only the number is stale.

**Still not regenerated** — third run making the same call, and the same reason: a stamp that needs a new patch every time a patch release lands is churn, and the real fix is open item 75's placeholder form (`the version \`^6\` installs today`, with the check asserting resolution rather than a literal). Applied to drafts 29 and 35 together. `git apply --check` is clean on `48a676ae`; the patch's new text is one patch release behind.
