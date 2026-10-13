# `fix(next-intl)`: the App Router reference tells the user next-intl needs no SWC plugin, and next-intl pins one as a runtime dependency

**Status: UNFILED — no write path.** `lc_have_token` → rc 1. Decomposed in the same call: `lc_token` reads `library-checks/.github-token` **OK** (93 chars, `github_pat_…`), prefix `case` check **PASS**, `GET https://api.github.com/repos/globalize-now/globalize-skills` with `Authorization: Bearer <token>` → **`401`**, body `{"message": "Bad credentials", …, "status": "401"}`; the same GET **without** the header → **`200`** in the same call (control). Token file mtime **2026-08-25 17:27:18Z**, unchanged. **Eighth** consecutive run without a write path. Found 2026-10-01.

Type: **PR**, ready for review once a write path exists. Patch: [`27-next-intl-single-package-claim.patch`](./27-next-intl-single-package-claim.patch) — `git apply --check` clean against `main` `f4f71a1`, 1 file, `+1/-1`.

**Suggested branch:** `library-check/next-intl-single-package-claim`
**Labels:** `bug`, `globalize-guide`, `next-intl`, `library-check`, `docs`

---

## The claim

`skills/globalize-guide/references/languages/js-ts/frameworks/nextjs/app-router/next-intl.setup.md`, read at `origin/main` **`f4f71a1`** from a fresh `--depth 1` clone:

> **L53** Only one package is required:
>
> **L55–57** | Package | Type | Purpose |
> | `next-intl` | runtime | Full i18n: translations, formatting, routing, navigation |
>
> **L59** Unlike LinguiJS (which requires `@lingui/swc-plugin` separately), next-intl bundles everything — routing, middleware, server/client APIs — in a single package.

L59 makes a positive architectural claim: next-intl does not need a separate SWC plugin, and LinguiJS does. The contrast is the whole point of the sentence.

## It is false, and `@swc/core` is the part it gets wrong

`next-intl@4.14.8`'s own `dependencies` block, read from the npm packument this run (not from a lockfile, not inferred):

```json
"use-intl": "^4.14.8",
"@swc/core": "~1.16.0",
"icu-minify": "^4.14.8",
"negotiator": "^1.0.0",
"@eloqnt/config": "^0.1.1",
"@parcel/watcher": "^2.4.1",
"@eloqnt/format-po": "^0.1.1",
"@eloqnt/format-json": "^0.1.0",
"@formatjs/intl-localematcher": "^0.8.1",
"next-intl-swc-plugin-extractor": "4.14.8"
```

Ten runtime dependencies, not a bundle. Two of them are the point:

- **`@swc/core`: `~1.16.0`** — a native SWC toolchain, a `dependencies` entry rather than a peer, so it is installed whether or not the project uses SWC itself.
- **`next-intl-swc-plugin-extractor`: `4.14.8`** — exact-pinned, and named for what it is.

So next-intl does use an SWC plugin. The difference from LinguiJS is not that one needs a plugin and the other does not; it is that next-intl pins and loads its plugin for you while LinguiJS asks you to install `@lingui/swc-plugin` yourself. That is a real and worthwhile difference, and it is not what L59 says.

`npm install 'next-intl@^4'` is one line, which is what L53's "Only one package is required" is actually about, and that part is defensible. L59 generalises it from *one install line* to *one package*, which is where it goes wrong.

## Why it is worth a patch and not just pedantry

The sentence actively obstructs the diagnosis of a failure these skills already know about. [Draft 24](./24-swc-core-1-16-12-native-binding-cache.md) and [draft 25](./25-next-intl-swc-native-binding-troubleshooting.md) document that `~1.16.0` resolves to `@swc/core@1.16.13` (today; `1.16.12` yesterday), that `next-intl/plugin` loads it at module scope by both entry points, and that on an affected machine the result is:

```
Error: Failed to load native binding
  [cause] ERR_SWC_NATIVE_CACHE: SWC native addon: validate cache root <path>: …
```

thrown while Next.js is reading `next.config`, naming neither next-intl nor SWC plugins. A user who has just read "next-intl bundles everything, unlike LinguiJS which requires `@lingui/swc-plugin` separately" has been told, in the same document, that SWC is not part of their install. The sentence is the reason the error looks like it cannot be about next-intl.

## The patch

`+1/-1` in one file. L59 becomes:

> That is one package to install **by name** — routing, middleware and the server/client APIs all come from `next-intl` itself. It is not a single-package install, though: `next-intl@4.14.8` declares ten runtime dependencies, among them `@swc/core@~1.16.0` and `next-intl-swc-plugin-extractor@4.14.8`. next-intl does use an SWC plugin — unlike LinguiJS it pins and loads one for you, rather than asking you to install `@lingui/swc-plugin` yourself. Expect a failing build to be able to surface inside `@swc/core` rather than inside next-intl.

It keeps the comparison with LinguiJS, because the comparison is useful once it is accurate, and it keeps L53 and the package table untouched.

The opener was reworded from `Only one package has to be installed …` to `That is one package to install …` so it does not echo L53's `Only one package is required:` three lines above.

**Deliberately not in the patch:**

- **`pages-router/next-intl.setup.md` L18** carries the same `Only one package is required:` line but *not* the L59 sentence. Its claim is about the install line only, which is true, so it is left alone. Changing it would be a style edit, not a correction.
- **No forward reference to draft 25's troubleshooting subsection.** An earlier version of this patch ended "see the troubleshooting section below", which would have made it depend on 25 landing first. Removed — this patch is independently applicable, and 25 and 27 were verified to commute (see Evals).
- **No change to any install line, the package table, or `manifest.json`.**

## Evals

Run against `f4f71a1` from a fresh `--depth 1` clone, before and after applying the patch — identical both times:

| | result |
|---|---|
| `evals/verify-manifest.sh` | **6 / 0 / 0**, rc 0 |
| `evals/verify-rules-template.sh` | **104 / 0 / 0**, rc 0 |
| `evals/verify-format-helpers.sh` | **88 / 0 / 0**, rc 0 |

`git apply --check` on `f4f71a1`: clean. Commutation with the other queued `main`-targeted patches, all five checked clean on `f4f71a1` individually (21, 22, 23, 25, 27) and this pair checked in both orders because they touch the same file:

| order | result |
|---|---|
| 25 applied, then `--check` 27 | clean |
| 27 applied, then `--check` 25 | clean |

The five patches touch `postcss-logical` CSS references (21), webext lint stamps (22), vue-i18n `onCompileError` (23) and the two Next.js setup references (25, 27), so 25 and 27 are the only pair sharing a file and they do not overlap a hunk.

No eval asserts on this prose. `evals/` grepped for `single package`, `bundles everything` and `Only one package` — **zero hits**. `@lingui/swc-plugin` has **six** hits (`evals/library-checks/lingui.sh` L381–384 greps `vite.config.ts` for it; `evals/prefills/nextjs-app-router-lingui/` names it in a manifest snapshot and a plan) — all about the Lingui stacks' own `vite.config.ts` and install lines, none reading this file or this sentence. Recorded rather than collapsed into "zero hits": the first draft of this section claimed zero for all four terms, which was wrong.

## Duplicate checks

- **Open PRs (item 52), read on `main` `f4f71a1`.** All 10 open PRs' file lists read. Two touch next-intl setup references: **#67** (draft, `library-check/next-intl-po-layout`, `msgctxt` semantics and PO catalog gating) and **#69** (draft, the SWC host floor in the Vite-family copies plus `lovable-i18n/SKILL.md`). #69 does **not** touch `nextjs/app-router/next-intl.setup.md`. #67's branch was not cloned this run, so **the collision risk with #67 is not fully discharged** — it is in the same file family, and a human merging both should check L59 specifically. Recorded rather than claimed clean, per item 63: a PR's file list is not its diff.
- **Draft queue (item 58).** `pending-issues/` grepped for `single package`, `bundles everything`, `one package`, `app-router/next-intl.setup`. Hits are drafts 24 and 25, both of which cite this file for the `next.config` load path, neither of which touches L59. Draft 25's patch inserts at L309 of the same file; this one edits L59. No overlap.
- **Not a restatement of 24 or 25.** Those are about a release of `@swc/core` failing to load. This is about a sentence that denies `@swc/core` is in the tree at all, and it would be wrong even on a machine where every release loads fine.

## Needs a human

- **Is the LinguiJS contrast worth keeping at all?** The rewritten sentence keeps it because the underlying distinction (pinned-for-you vs install-it-yourself) is genuinely useful to someone choosing between the two. A reviewer who would rather the file not editorialise about LinguiJS should cut the clause; the first two sentences stand on their own.
- **`#67` overlap.** See Duplicate checks. One `git clone --depth 1 --branch` of #67's head and a `grep -n 'bundles everything'` settles it.
- **Behavioural evals not run**, same constraint as draft 25: they need a live Next.js project and `/sessions` is at 98 %. The change is one prose line in a reference document, touching no template, manifest or code block, so the three standalone verifiers are the relevant gate.

## Sources

- **npm:** `next-intl` packument, `dependencies` and `peerDependencies` of `latest` (`4.14.8`), fetched 2026-10-01 ~06:06Z. `@swc/core` packument for the stable `1.16.x` line.
- **Repo:** `origin/main` **`f4f71a1`** via a fresh `--depth 1` clone; `skills/globalize-guide/references/languages/js-ts/frameworks/nextjs/app-router/next-intl.setup.md` L52–63 read directly, and both files grepped for `Only one package`. Open PR list and file lists read via the unauthenticated REST API.
- **Executed, not read:** `evals/verify-manifest.sh`, `verify-rules-template.sh`, `verify-format-helpers.sh` before and after the patch; `git apply --check` for all five `main`-targeted patches, and for 25/27 in both orders.
