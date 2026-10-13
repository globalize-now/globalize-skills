# 30 — `@vitejs/plugin-react-swc >= 4.2.3` is the ABI floor, not an installable floor: on Vite 8 it is `4.3.0`

**Status:** PR-shaped, **ready for review** (every claim executed). Unfiled — no GitHub write path on any transport (see 2026-10-04 report, "The write path").
**Patch:** [`30-swc-host-vite8-floor.patch`](./30-swc-host-vite8-floor.patch) — 5 files, `+7/-7`, `git apply --check` clean on `main` `48a676ae`.
**Branch name when it can be opened:** `library-check/swc-host-vite8-floor`
**Found:** 2026-10-04, by the (F) leg on a quiet registry — not by a publish.

## What the skills say

Five SWC setup references carry a "Version compatibility for `@lingui/swc-plugin`" block that names **`@vitejs/plugin-react-swc >= 4.2.3`** as the host floor:

| file | line | wording |
|---|---|---|
| `vite/react-swc/lingui.setup.md` | 28 | "`@vitejs/plugin-react-swc >= 4.2.3` is no longer a sufficient floor" |
| `tanstack-start/swc/lingui.setup.md` | 34, **738** | same; L738 "the host is new enough — `@vitejs/plugin-react-swc >= 4.2.3`" |
| `react-router-framework/swc/lingui.setup.md` | 31 | same as L34 |
| `remix/swc/lingui.setup.md` | 26 | "`4.2.3`'s dependency is `@swc/core@^1.15.11`…" |
| `webext/swc/lingui.setup.md` | 95, **951** | same; L951 "the host resolved below `4.2.3`" |

Every one of those statements is about **one** constraint: whether the host's bundled `@swc/core` clears the Wasm-plugin ABI floor of 1.15.0. On that question `4.2.3` is correct — its dependency is `@swc/core@^1.15.11`.

## The defect

`@vitejs/plugin-react-swc` added `vite@^8` to its **peer range** only in **`4.3.0`**. Read from the live packument, every 3.x and 4.x release:

| `@vitejs/plugin-react-swc` | `peerDependencies.vite` |
|---|---|
| `4.0.0` – `4.2.3` | `^4 \|\| ^5 \|\| ^6 \|\| ^7` |
| **`4.3.0`** | `^4 \|\| ^5 \|\| ^6 \|\| ^7 \|\| ^8` |
| `4.3.1`, `4.3.2`, `4.3.3` (latest) | `^4 \|\| ^5 \|\| ^6 \|\| ^7 \|\| ^8` |
| `3.11.0` | `^4 \|\| ^5 \|\| ^6 \|\| ^7` |
| `3.10.2` | `^4 \|\| ^5 \|\| ^6 \|\| ^7.0.0-beta.0` |

`vite` is a **required** peer (no `peerDependenciesMeta` entry), so on a Vite 8 project the documented floor cannot be installed at all.

### Measured, with controls, `npm 10.9.8` / `node v22.23.2`

`npm install --dry-run` per cell, minimal fixture pinning only `vite`:

| project `vite` | spec | flags | result |
|---|---|---|---|
| `8.3.2` | `@vitejs/plugin-react-swc@4.2.3` | — | **ERESOLVE** — `peer vite@"^4 \|\| ^5 \|\| ^6 \|\| ^7" from @vitejs/plugin-react-swc@4.2.3` |
| `8.3.2` | `@vitejs/plugin-react-swc@4.3.0` | — | **OK** → 4.3.0 ← control, the corrected floor |
| `8.3.2` | `@vitejs/plugin-react-swc@^4` | — | **OK** → 4.3.3 ← why a fresh install hides this |
| `7.3.6` | `@vitejs/plugin-react-swc@4.2.3` | — | **OK** → 4.2.3 ← control, floor is fine below Vite 8 |
| `8.3.2` | `@vitejs/plugin-react-swc@4.2.3` | `--legacy-peer-deps` | "OK" — **4.2.3 installed against Vite 8** |

The `^4` row is the reason this has not been reported: `^4` resolves to `4.3.3` today, so the *install step* in these references works. The defect bites where a number, not a range, is used — a lockfile or explicit pin at `4.2.x`, or an agent checking the project against the stated floor and accepting `4.2.3` as "new enough" on a Vite 8 project where it is not installable.

### Why Vite 8 is the live case, not a hypothetical

Three of the five references are reached *because* the project has `@vitejs/plugin-react@6` — `tanstack-start/swc` L6 ("`create-tanstack-start` now installs `@vitejs/plugin-react@6`"), `remix/swc` L6, `react-router-framework/swc`. And `@vitejs/plugin-react@6.x` declares:

```json
"peerDependencies": { "vite": "^8.0.0", … }
```

`vite: ^8.0.0` with **no** `peerDependenciesMeta.optional` entry — `^8` only, where `5.2.0` peered `^4.2.0 || ^5 || ^6 || ^7 || ^8`. So a project that has `@vitejs/plugin-react@6` is **necessarily on Vite 8**. The population these SWC references exist to serve is exactly the population the documented floor cannot install on.

(Also measured while here, since the same references assert it: `@vitejs/plugin-react@6.1.1`'s published `dist/index.d.ts` has **no `babel` key** in `Options` and no `api.reactBabel` hook, where `5.2.0` has both — so the skills' "v6 dropped the `babel` option, making the Babel macro a silent no-op" claim is **correct**. Verified, not changed.)

## What the patch does

One sentence appended to the version-compatibility block in all five files, after the existing `**Do not pin the plugin backwards by default either.**`:

> **On Vite 8 the installable floor is `4.3.0`, not `4.2.3`.** `@vitejs/plugin-react-swc` only added `vite@^8` to its peer range in **`4.3.0`** — `4.0.0`-`4.2.3` peer `^4 || ^5 || ^6 || ^7` — so on a Vite 8 project `npm install -D '@vitejs/plugin-react-swc@4.2.3'` fails with `ERESOLVE`: *`peer vite@"^4 || ^5 || ^6 || ^7" from @vitejs/plugin-react-swc@4.2.3`*, while `^4` resolves to `4.3.3` and installs cleanly. `4.2.3` is the **ABI** floor (its `@swc/core@^1.15.11`), not an installable one: when the project's resolved Vite is 8.x, treat **`4.3.0`** as the host floor, and do not reach for `--legacy-peer-deps`, which installs `4.2.3` against Vite 8 and leaves the mismatch in place.

Plus the two troubleshooting statements that read as a bare floor check:

- `tanstack-start/swc` L738 — "the host is new enough — `>= 4.2.3`" → "`>= 4.2.3`, or `>= 4.3.0` if this project is on Vite 8, where `4.2.3` cannot install at all".
- `webext/swc` L951 — "the host resolved below `4.2.3`" → "below `4.2.3` (below `4.3.0` on Vite 8, where `4.2.3` cannot install at all)".

No install command changes: every one of them already says `^4`, which is correct.

## Verification

- `git apply --check` clean on `main` `48a676ae`.
- `evals/verify-manifest.sh` **6/0/0**, `evals/verify-format-helpers.sh` **99/0/0**, `evals/verify-rules-template.sh` **114/0/0** — run on clean `main` and on the patched tree, **identical both ways**. `bash -n` clean on all 10 `evals/*.sh` and all 4 `evals/library-checks/*.sh`.
- The behavioural verifiers (`verify-setup.sh`, `verify-orchestration.sh`, `verify-hard-stop.sh`, `verify-string-wrapping.sh`, `library-checks/*.sh`) each exit 1 with a `<workdir> <fixture>` usage message in this sandbox and were not run — unchanged from every prior run (open item 21).
- File-overlap matrix against the seven other `main`-targeted patches: overlaps **22** only, on `webext/swc/lingui.setup.md`. **Tested and they commute** — both orders apply clean (different hunks: 22 is at L418, 30 at L95/L951). No overlap with 21, 23, 25, 27, 28, 29.

## This collides with PR #69, and #69 makes it worse

`library-check/swc-abi-direction-sweep` (head `2b0fc93`, draft 26's target) rewrites the exact blocks this patch edits, so **patch 30 does not apply on #69's branch** — `git apply` fails on `react-router-framework/swc/lingui.setup.md:28` and `remix/swc/lingui.setup.md:23`. That is a collision, not a problem with either change: 30 targets `main`, where it is clean.

What matters for review is the *content* of #69's rewrite. On that branch the sentence reads, bolded:

> **`@vitejs/plugin-react-swc >= 4.2.3` is a sufficient floor**: its `@swc/core` dependency is `^1.15.11` (`4.3.2`+: `^1.15.46`), so every host those ranges admit — including each range's own floor — is above 1.15.0.

Scoped to the ABI that is **true**, and #69's measurement behind it (a build sweep across eleven `@swc/core` versions) is better than what is on `main`. But the sentence reads as an install instruction, and on Vite 8 that install fails. If #69 lands as it stands, `main` gains a bolded, more authoritative version of the claim this draft corrects.

No second patch is offered against #69's branch on purpose: the five files word that sentence five different ways there (only `tanstack-start/swc` L34 and `react-router-framework/swc` L31 carry the "sufficient floor" phrasing verbatim; `vite/react-swc` L28, `remix/swc` L26 and `webext/swc` L95 each differ), and #69 is a draft that yesterday's report already says should not merge as it stands. A patch against a moving draft would rot. The review note is the deliverable: **whoever rebases or lands #69 should scope that sentence to the ABI and add the Vite 8 floor** — the wording above is ready to lift.

## The eval suite cannot reach this, for two independent reasons

Per open item 68's second half ("when the eval suite has nothing to say about a shape, ask why"). `grep -rn "4\.2\.3\|plugin-react-swc\|vite@\^8" evals/` → **0 hits**. Nothing asserts a host floor or a peer range. And the fixtures could not fail it even if something did:

- Only two fixtures carry `@vitejs/plugin-react-swc` — `fixtures/vite-swc` and `fixtures/vite-swc-data-module` — and both pin **`vite@^6.3.0`**. On Vite 6 the `^4 || ^5 || ^6 || ^7` peer is satisfied, so the boundary does not exist in them.
- `fixtures/vite-swc/package-lock.json` resolves `@vitejs/plugin-react-swc` to exactly **`4.3.0`** — the first version that admits Vite 8 — against `vite@6.4.1`. One patch above the boundary, on a major where there is no boundary.
- The highest Vite anywhere in the repo is **`^7.0.0`** (`fixtures/ionic-*`, added by #91). There is **no Vite 8 fixture at all.**

This is #91's lesson one run later on a different stack: a fixture that cannot reach a defect is a kind of false pass, and it is invisible to a grep of `evals/`.

**Eval-side follow-up, deliberately not in this patch** (it needs a maintainer call on fixture policy, and a Vite 8 lockfile could not be verified end to end here because the behavioural verifiers do not run in this sandbox): add a Vite 8 variant of `fixtures/vite-swc` — or a cheap assertion in `evals/library-checks/lingui.sh` that the host floor named in each SWC reference is installable against the fixture's resolved Vite. The second is smaller and catches the whole class rather than this instance.

## Maintainer calls

1. **Is `4.3.0` the right number to state, or should the references stop naming a host version at all?** The floor is doing two jobs (ABI, and Vite peer compatibility) and they move independently — this draft's whole finding is what happens when one number carries both. The alternative is to say "install `^4` and read the resolved `@swc/core` with `npm ls @swc/core`", which is what #69's branch already moves toward and is more durable. This patch states the number because that is the minimal correction to what is on `main` today; collapsing to "`^4` plus a resolved-host check" is a larger edit and #69's call to make.
2. **#64 supplies the input this needs.** Its branch adds a `viteVersion` detection field to `SKILL.md` L162 ("the resolved Vite version, not the declared range"). With that landed, "when the project's resolved Vite is 8.x" becomes a field read rather than prose. #64's branch has **0 occurrences of `4.2.3`** in all five of these files — it predates the ABI prose entirely — so there is no conflict, only a dependency worth sequencing: #64, then this.
