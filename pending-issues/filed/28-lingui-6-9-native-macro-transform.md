# `fix(lingui)`: `@lingui/vite-plugin@6.9.0` transforms macros natively, and the Vite references still route every `@vitejs/plugin-react@6+` project into SWC

**Status: UNFILED — no write path on any of three transports** (repo PAT 401; cloud git proxy 403 'not in this session's authorized repository set'; GitHub MCP server reads fine but every write returns 403 `Resource not accessible by integration`). `lc_have_token` → rc 1. Decomposed in the same call: `lc_token` reads `library-checks/.github-token` **OK** (93 chars, `github_pat_…`), prefix `case` check **PASS**, `GET https://api.github.com/repos/globalize-now/globalize-skills` with `Authorization: Bearer <token>` → **`401`**, body `{"message": "Bad credentials", "documentation_url": "https://docs.github.com/rest", "status": "401"}`; the same GET **without** the header → **`200`** in the same call (control: `default_branch` main, `pushed_at` 2026-10-01T19:44:53Z). Token file mtime **2026-08-25 17:27:18Z**, unchanged for 38 days. **Ninth** consecutive run without a write path. Found 2026-10-02.

Type: **PR**, and it should be opened as a **draft** — see *Needs a human*. Patch: [`28-lingui-6-9-native-macro-transform.patch`](./28-lingui-6-9-native-macro-transform.patch) — `git apply --check` clean against `main` **`7d85ace`**, **2 files, `+51/-10`**.

> **Scope reduced 2026-10-02, after reading #63's branch.** The patch originally carried a third file, `vite/react-swc/lingui.setup.md`, inserting a new item 3 into that file's numbered escalation list. **#63 rewrites items 1 and 2 of that same list** (`pull_request_read` on #63: `manifest.json` +6/-1 and `vite/react-swc/lingui.setup.md` +16/-5), so the two conflict directly. The react-swc hunk is **dropped from this patch** and the full 3-file version kept as `28-…full-3file.patch.bak` for whoever lands it. **It belongs in #63, not in a PR around it** — and #63 needs it, because its own rewritten item 2 ends *"If the host genuinely cannot be raised, use `@lingui/babel-plugin-lingui-macro` with the Babel variant of this stack instead,"* which `6.9.0` supersedes. A comment for #63 saying exactly that is at the end of this draft, ready to paste; posting it returned `403 Resource not accessible by integration`.
>
> The three standalone evals and `bash -n` were re-run on the 2-file version: `verify-manifest` 6/0/0, `verify-rules-template` 104/0/0, `verify-format-helpers` 88/0/0, rc 0, `lingui.sh` syntax clean. `git apply --check` clean on `7d85ace`.

**Suggested branch:** `library-check/lingui-6-9-native-macro-transform`
**Labels:** `enhancement`, `globalize-guide`, `lingui`, `library-check`, `evals`

---

## What moved upstream

`@lingui/*` **6.9.0** published 2026-10-01T14:51:38Z–14:55:46Z — eight of the tracked packages in one release train, the only non-`typescript` publishes in this run's window.

The release is not a version bump. Read as a tag compare rather than as a release title ([`v6.8.0...v6.9.0`](https://github.com/lingui/js-lingui/compare/v6.8.0...v6.9.0), 13 commits, 73 files), the load-bearing commit is [`2a576d3` `feat(vite-plugin): add native macro transformer (#2686)`](https://github.com/lingui/js-lingui/commit/2a576d324), `packages/vite-plugin/src/index.ts` **+158/-86**:

- `LinguiPluginOpts` gains `macroTransform?: boolean | { macro?, parser? }`, `@default false`, documented upstream as *"Native transform is up to 2.5x times faster than SWC + Plugin and 29x times faster than Babel"* and *"Will be a default option in the next major release"*.
- When set, the plugin pushes a second Vite plugin, `vite-plugin-lingui-macro-transform`, with `enforce: "pre"` and a `transform` filter on `/\.(?:[jt]sx?|[cm][jt]s)(?:$|\?)/` plus a code filter built by the new `buildMacroFilterRe()` from `config.macro.corePackage` / `jsxPackage`. The handler lazily `await import("@lingui/native-tools")` and calls `transform(code, basename, { macro: { descriptorFields: isProduction ? "id-only" : "all", ...mapMacroOptions(config, …) }, parser })`.
- `packages/vite-plugin/package.json` gains `"@lingui/native-tools": "^0.1.5"` in **`dependencies`**, and `@lingui/babel-plugin-lingui-macro` stays an **optional** peer.
- Upstream's own README changed in the same commit: *"With `lingui({ macroTransform: true })` it also transforms Lingui macros natively via `@lingui/native-tools`, so no Babel or SWC plugin is needed for Lingui."*
- `website/docs/installation.mdx` (**+41/-7**) now calls this **the recommended Vite setup**, states it *"doesn't need `@lingui/babel-plugin-lingui-macro` or `@lingui/swc-plugin`"* and *"works with `@vitejs/plugin-react`, `@vitejs/plugin-react-swc` and Vite 8+ with Rolldown"*, and demotes the old Babel/SWC tabs to a *"Transforming Macros with Babel or SWC"* subsection. The Rolldown tab lost its `default` flag.

## Why the skills need to change

`vite/react-babel/lingui.setup.md` L8–15 carries a version gate. `@vitejs/plugin-react@6.0.0` dropped the `babel` option, so on v6+ the file's own `react({ babel: … })` form is silently ignored and macros never get transformed. The gate's remedy, verbatim on `main` `7d85ace`:

> 1. Switch the project to `@vitejs/plugin-react-swc` + `@lingui/swc-plugin`.
> 2. Use `references/vite-swc.md` instead of this file for the rest of the setup.

`@vitejs/plugin-react`'s `latest` is **6.1.1**, so that is the path every current project takes. It routes the user out of the Babel variant and into the SWC variant — and the SWC variant is the one this queue has spent five runs documenting as having a live host-side failure of its own ([draft 24](./24-swc-core-1-16-12-native-binding-cache.md), [draft 25](./25-next-intl-swc-native-binding-troubleshooting.md), [#69](https://github.com/globalize-now/globalize-skills/pull/69)): `@swc/core@1.16.12`/`1.16.13` ship a native stub that fails to load on some installs, and `1.16.13` made the ancestor-permission predicate load-bearing on macOS for the first time.

As of yesterday there is a third option that needs neither Babel nor SWC, and the references do not mention it. `grep -rn 'macroTransform\|native-tools\|native macro' skills/` → **zero hits** across all 14 files that name `@lingui/vite-plugin`.

The same gap appears at the bottom of `vite/react-swc/lingui.setup.md`: its plugin/host-mismatch escalation ends at *"3. If no such pair exists, switch to the **Babel** variant of this stack"* — which, on `@vitejs/plugin-react@6`, is the dead end the other file's gate describes. The two files currently point at each other.

## Measured, not read

The claim that this is an escape from the `@swc/core` failure is verified by execution in this sandbox, with the failing path as a same-run control. Both trees were hand-built from registry tarballs (no `npm`), so neither result can be an install artefact:

| probe | result |
|---|---|
| `@lingui/native-tools@0.1.5` + `@lingui/native-tools-linux-arm64-gnu@0.1.5`, `await import()` | **loads** — exports `transform, extractMessages, extractMessagesFromFiles, createSwcExtractor, mapMacroOptions, default` |
| `transform("import { msg } from \"@lingui/core/macro\"; const m = msg\`Hello ${name}\`;", "x.ts", { macro: { descriptorFields: "all" } })` | **correct output**: `const m = /*i18n*/ { id: "OVaF9k", message: "Hello {name}", values: { name: name } };` |
| `@swc/core@1.16.13` + `@swc/core-linux-arm64-gnu@1.16.13`, `require()` — **control, same run, same method** | **throws** `Failed to load native binding`, cause chain `[MODULE_NOT_FOUND] ./swc.linux-arm64-gnu.node` → `[ERR_SWC_NATIVE_CACHE] validate cache root …/.cache: cache root has a parent writable by another user without trusted sticky protection` |

So on this machine the native transform works and the SWC plugin's host cannot even be loaded. That is one machine, not a proof about the user's, but it is the direction the patch claims and it was executed rather than inferred.

`@lingui/native-tools` is itself a napi addon (nine platform packages in `optionalDependencies`), so it is worth saying what it is *not*: `strings` over `lingui-native-tools.linux-arm64-gnu.node` finds **no** `ERR_SWC_NATIVE_CACHE`, no `sticky`, no `cache root`, no `materialize`. It is a plain 9 553 992-byte addon loaded by a standard NAPI-RS `binding.js`, not a stub that materialises itself into a cache directory, so it does not inherit the `@swc/core` failure mode. Its only non-optional dependency is `@swc/types` (types only).

## Level 2 caught the new edge, which is the other half of this finding

`walkers.diff_dep_ranges` this run: **227 edges / 172 dep names** (baseline 225/171), **2 added**, **0 removed**, **19 changed**. The two additions are the point:

```
+ ('@lingui/cli',         '@lingui/native-tools (dep)', '^0.1.5')
+ ('@lingui/vite-plugin', '@lingui/native-tools (dep)', '^0.1.5')
```

`@lingui/cli@^6` appears **11** times in `manifest.json` and `@lingui/vite-plugin@^6` **10** times, both resolving to `6.9.0`, so **every Lingui stack in the manifest now installs a second native addon** whether or not it opts into `macroTransform` — `@lingui/cli` pulls it as a plain `dependencies` entry. That is a new fact for [draft 19](./19-untracked-installed-and-gating-packages.md) (untracked installed packages) and it is recorded there rather than patched here. `@lingui/native-tools` declares `engines.node >= 22.19.0`, which matches the existing Node floor both references already state, so no floor claim goes stale.

Level 3 (`diff_resolved_edges`, open item 65): **2 added, 0 removed, 0 range_moved, 0 resolution_moved**. The watch list was extended with both new edges per item 65's rule; `@lingui/native-tools@^0.1.5` → `0.1.5`.

## The patch

3 files, `+65/-11`.

**1. `vite/react-babel/lingui.setup.md` — the version gate** (`+13/-5`). The v6+ remedy becomes an ordered pair: option 1 is `@lingui/vite-plugin@^6.9.0` with `macroTransform`, which keeps the project on `@vitejs/plugin-react`; option 2 is the existing switch to SWC, now conditioned on `@lingui/vite-plugin` being unable to move to `>= 6.9.0` or on needing a macro option the native transform lacks, and it tells the reader to read the SWC file's compatibility note first. The v5-and-lower paragraph keeps its "do not proactively downgrade" instruction and gains one sentence saying the native transform is available and better there too, but optional because the `babel` option still works on v5.

**2. same file — `## Build Tool Integration`** (`+30/-1`, plus `+10/-0` in `## Packages`). The existing config block is now under a `### Babel macro transform` heading, scoped to v5-or-lower with `@lingui/vite-plugin < 6.9.0`, and a new `### Native macro transform` heading precedes it with the two-plugin config, the `^6.9.0` floor and four caveats:

- **`lingui.config.ts` must exist first.** Read from `index.ts`, not from the docs: when `macroTransform` is set the plugin calls `getOrLoadConfig()` **eagerly at construction**, before Vite's `configResolved`. The old code path only called `getConfig()` inside `configResolved`. A project that adds `macroTransform` before creating `lingui.config.ts` fails while `vite.config.ts` is being evaluated.
- **`@lingui/native-tools` is a native addon**, with the nine prebuilt platforms enumerated from its `optionalDependencies` (darwin x64/arm64, linux x64/arm64 × gnu/musl, win32 x64/arm64, android arm64). Outside that list the transform cannot load and option 2 of the gate applies.
- **React Compiler via `@rolldown/plugin-babel`** keeps its Babel plugin, with `lingui()` placed before it — upstream's own note.
- **Nothing else in the file changes** — catalog layout, provider setup, extraction and the `lingui compile` → `vite build` → `tsc --noEmit` ordering are all independent of which transformer handles the macros.

**3. `vite/react-swc/lingui.setup.md` — the escalation list** (`+15/-1`). The old item 3 ("switch to the Babel variant") becomes item 4, and a new item 3 offers `macroTransform` with `@vitejs/plugin-react-swc` left in place for React itself. Same `^6.9.0` floor, same `lingui.config.ts` ordering note, and the one documented gap (`macro.jsxRuntime: "solid"` is not supported, so a Solid project keeps the SWC plugin).

**4. `evals/library-checks/lingui.sh`** (`+12/-6`). This is the part the patch could not leave out. The `vite-swc` branch asserted `grep -q "@lingui/swc-plugin" vite.config.ts` and **failed** when absent, so a correct native-transform setup — the thing items 1–3 now tell the skill to produce — would have failed the eval. Both branches now accept either route. The `vite-babel` branch also had a latent false pass: it asserted only `grep -q "lingui"`, which any config importing `@lingui/vite-plugin` satisfies, so a config with **no macro transform at all** passed it and was labelled *"Lingui babel plugin in vite.config.ts"*. It now requires `@lingui/babel-plugin-lingui-macro` or `macroTransform`.

**Deliberately not in the patch:**

- **The four other SWC copies** (`react-router-framework/swc`, `remix/swc`, `tanstack-start/swc`, `webext/swc`) carry the same escalation shape and the same gap. **#69 is open against exactly those four files** plus `lovable-i18n/SKILL.md`. One library per branch, and not a batch that collides with an in-flight PR.
- **`nextjs/app-router/lingui.setup.md`.** The native transform is a *Vite plugin*; it does nothing for Next.js. That file's `@lingui/swc-plugin@~6.6.0` split pin exists because `6.7.0`'s `swc_core@77.1.1` outruns every Next.js plugin runner, and nothing in 6.9.0 changes that. Claiming otherwise would be the overreach this finding most invites.
- **`manifest.json`.** `@lingui/vite-plugin@^6` admits `6.9.0`, so the native path is reachable without a manifest change, and raising 10 specs to `^6.9.0` would force the floor on stacks that do not use the new option. The references state the floor where it is needed. A reviewer may disagree — see *Needs a human*.
- **No change to any provider, catalog, extraction or `lingui.config.ts` content.**
- **`@lingui/macro`** stays at `5.9.5` (not part of the 6.x train) and `@lingui/swc-plugin` at `6.7.0` — neither published in this window.

## Evals

Run from a fresh `--depth 1` clone at `origin/main` **`7d85ace`**, before and after the patch — identical:

| | before | after |
|---|---|---|
| `evals/verify-manifest.sh` | **6 / 0 / 0**, rc 0 | **6 / 0 / 0**, rc 0 |
| `evals/verify-rules-template.sh` | **104 / 0 / 0**, rc 0 | **104 / 0 / 0**, rc 0 |
| `evals/verify-format-helpers.sh` | **88 / 0 / 0**, rc 0 | **88 / 0 / 0**, rc 0 |

`evals/verify-setup.sh`, `verify-orchestration.sh`, `verify-hard-stop.sh` and `verify-string-wrapping.sh` all exit 1 with a usage message — each needs `<workdir> <fixture>`, i.e. a live project. `evals/library-checks/lingui.sh` is the same: it is dispatched by `verify-setup.sh` and refuses to run standalone. So the file this patch edits **cannot be executed here**, and its branch logic was verified by extracting the two `case` arms and running them against five synthetic `vite.config.ts` shapes:

| branch | config | verdict |
|---|---|---|
| `vite-swc` | `react({ plugins: [['@lingui/swc-plugin', {}]] }), lingui()` | PASS (swc-plugin route) |
| `vite-swc` | `react(), lingui({ macroTransform: true })` | PASS (macroTransform route) |
| `vite-swc` | `react(), lingui()` | **FAIL** — correct |
| `vite-babel` | `react({ babel: { plugins: ['@lingui/babel-plugin-lingui-macro'] } }), lingui()` | PASS (babel route) |
| `vite-babel` | `react(), lingui({ macroTransform: true })` | PASS (macroTransform route) |
| `vite-babel` | `react(), lingui()` | **FAIL** — correct, and the pre-patch assertion **passed** this one |

`bash -n evals/library-checks/lingui.sh` clean. Fence parity re-counted on both edited markdown files, counting indented fences too: **88** and **86**, both even.

`git apply --check` on `7d85ace`: clean. All five other queued `main`-targeted patches re-checked on the new head in the same call — 21, 22, 23, 25, 27 all clean. This patch shares no file with any of them, so no ordering question arises.

## Duplicate checks

- **Open PRs (item 52), read on `main` `7d85ace`.** 8 open (#91, #78, #77, #69, #67, #64, #63, #21) — #87, #88 and #89 merged in this window. **#69 and #63 are the collision candidates.** #69's file list is the four sibling SWC copies plus `lovable-i18n/SKILL.md` — it does **not** include either file this patch touches. Verified by cloning `library-check/swc-abi-direction-sweep` (head `2b0fc93`) and reading `vite/react-swc/lingui.setup.md` on that branch: byte-identical to `main` through the escalation list, item 3 unchanged. Per item 63 this was read from the branch, not inferred from the file list. **#63** (`library-check/vite-swc-lingui-host-floor`, "install an SWC host floor on vite-swc-lingui") targets the same stack by title and its branch was **not** cloned — it is 5 weeks old and a host-floor change plausibly lands in the same section of `vite/react-swc/lingui.setup.md` that this patch's item 3 sits in. **Recorded as an open collision risk, not discharged.**
- **#64** (`library-check/install-constraint-gate`, "derive Node and Vite install floors from the manifest") touches install-floor derivation. If it lands, the `^6.9.0` floor this patch states in prose is the kind of thing it would want to derive. Noted, not blocking.
- **Draft queue (item 58).** `pending-issues/` grepped for `macroTransform`, `native-tools`, `vite-plugin`, `react-babel`, `react-swc`. Hits: drafts 24, 25 and 26 reference the Vite-family SWC story but none touches either file's macro-transform sections; **draft 20** is about the app-router split pin, which this patch deliberately leaves alone. No overlap.
- **Not a restatement of 24/25/26.** Those are about a release of `@swc/core` failing to load and about how the skills describe the plugin/host relationship. This is about a new upstream capability that removes the dependency, and it would be worth landing even on a machine where every `@swc/core` release loads fine — the `@vitejs/plugin-react@6` dead end exists independently.

## Needs a human

**Open it as a draft.** Three things are not settled:

- **The eval change is the uncertain part, and it cannot be executed here.** `evals/library-checks/lingui.sh` only runs under `verify-setup.sh` against a live project; the sandbox has no such project and `/sessions` is at 98 %. The branch logic was verified against synthetic configs (table above), which exercises the greps but not the dispatch, the fixture set, or whether any `evals/prefills/` or `evals/expectations/` artefact asserts the old `vite.config.ts` shape elsewhere. **One `verify-setup.sh <workdir> vite-swc-lingui` run on a laptop settles it.** The `vite-babel` tightening is the riskier half: it turns a grep that almost anything satisfied into a real assertion, so a fixture that was passing on a technicality will now fail — which is the point, but it should be seen failing before this merges.
- **Should `manifest.json` raise `@lingui/vite-plugin` to `^6.9.0`?** The patch says no and states the floor in prose where the option is offered. The argument for yes: 10 specs, and `^6` lets a resolver that already has a lockfile sit on `6.8.0` where `macroTransform` is silently not an option — the plugin takes unknown keys without complaint, so the failure is "macros were never transformed", which is the exact failure mode the `@vitejs/plugin-react@6` gate exists to prevent. The argument for no: it forces a floor on stacks that never opt in. This is a maintainer's call about how the manifest is meant to be read, and it is why this is a draft.
- **`#63`'s branch was not read.** See Duplicate checks. One `git clone --depth 1 --branch library-check/vite-swc-lingui-host-floor` and a `grep -n 'If no such pair exists'` settles whether its diff lands in the same hunk as item 3.

Two smaller ones: whether the `### Native macro transform` / `### Babel macro transform` headings should also appear in the four sibling SWC files once #69 lands (consistency argues yes, and that is a separate branch); and whether the upstream claim *"up to 2.5x faster than SWC + Plugin and 29x faster than Babel"* belongs in the reference at all — the patch quotes no benchmark numbers, only the capability, because the numbers are upstream's and unverified here.

## Sources

- **npm:** full packuments for all **32** tracked packages (32/32, each asserted to parse and to carry the requested `name`, zero fetch failures), `time` maps walked in full for in-window publishes, `dist-tags` diffed field-by-field against the 2026-10-01 baseline, `dependencies`/`peerDependencies`/`optionalDependencies` of each `latest` captured as a range map. Additionally full version lists for `@swc/core`, `@babel/core`, `@lingui/native-tools` and `next-intl-swc-plugin-extractor` for the level-3 resolver. Queried 2026-10-02 ~06:05–06:4xZ.
- **npm tarballs:** `@lingui/native-tools@0.1.5`, `@lingui/native-tools-linux-arm64-gnu@0.1.5`, `@swc/core@1.16.13`, `@swc/core-linux-arm64-gnu@1.16.13` — extracted, probed, and deleted.
- **`lingui/js-lingui`:** tag compare [`v6.8.0...v6.9.0`](https://github.com/lingui/js-lingui/compare/v6.8.0...v6.9.0) (13 commits, 73 files) read with full patches; `packages/vite-plugin/src/index.ts`, `packages/vite-plugin/package.json`, `packages/vite-plugin/README.md`, `packages/vite-plugin/src/buildMacroFilterRe.ts`, `packages/cli/package.json`, `packages/cli/src/extract-experimental/bundlers/macroTransformOptions.ts`, `website/docs/installation.mdx`, `website/docs/ref/conf.md` read as patches in that compare.
- **Repo:** `origin/main` **`7d85ace`** via a fresh `--depth 1` clone, and `library-check/swc-abi-direction-sweep` head **`2b0fc93`** via a second `--branch` clone. Commit list, open PR list (8), open issue list (26) and #69's file list read via the unauthenticated REST API.
- **Executed, not read:** `await import('@lingui/native-tools')` + `transform()` on a hand-built tree; `require('@swc/core')@1.16.13` on a hand-built tree as the same-run control; `strings` over both native binaries; `evals/verify-manifest.sh`, `verify-rules-template.sh`, `verify-format-helpers.sh` before and after; the four other `verify-*.sh` attempted and refused with usage errors; the two patched `case` arms against five synthetic `vite.config.ts` files; `bash -n` on the patched eval; `git apply --check` for all six queued patches on `7d85ace`; `walkers.dep_ranges` / `diff_dep_ranges` / `resolved_edges` / `diff_resolved_edges`; fence parity counts on both edited files.
- **Tooling:** `library-checks/walkers.py` for the three reconciliation legs and for levels 2 and 3.


---

## Comment prepared for #63 (could not be posted — `403`)

> **`@lingui/vite-plugin@6.9.0` (2026-10-01) changes the remedy list this PR rewrites.**
>
> This PR's new item 2 ends with *"If the host genuinely cannot be raised, use `@lingui/babel-plugin-lingui-macro` with the Babel variant of this stack instead."* As of yesterday there is a better answer that needs neither plugin.
>
> `@lingui/vite-plugin@6.9.0` adds `lingui({ macroTransform: true })`, which transforms Lingui macros natively via the new `@lingui/native-tools` ([`2a576d3`](https://github.com/lingui/js-lingui/commit/2a576d324), `packages/vite-plugin/src/index.ts` +158/-86). Upstream's `installation.mdx` now calls it the recommended Vite setup, says it *"doesn't need `@lingui/babel-plugin-lingui-macro` or `@lingui/swc-plugin`"*, and the in-code doc comment says it *"Will be a default option in the next major release"*. It runs as its own `enforce: 'pre'` Vite transform, so it is independent of the host's `@swc/core` version — the floor this PR is about stops applying to Lingui entirely on that path.
>
> Worth folding into item 2 as the preferred escape when the host cannot be raised, rather than the Babel variant. Two caveats if you do: require `@lingui/vite-plugin@^6.9.0` explicitly (`^6` admits `6.8.0`, where `macroTransform` is an unrecognised key the plugin accepts silently — failure mode is "macros were never transformed"), and `lingui.config.ts` must exist before `vite.config.ts` is evaluated, because the plugin reads the Lingui config eagerly at construction when `macroTransform` is set rather than in `configResolved`.
>
> Measured rather than inferred, on hand-built trees from registry tarballs with no `npm`: `@lingui/native-tools@0.1.5` loads and `transform()` returns correct output, while `@swc/core@1.16.13` by the identical method throws `ERR_SWC_NATIVE_CACHE`. `strings` over the Lingui addon finds none of the SWC native-cache machinery.
>
> **Conflict heads-up:** the check has a prepared change to `vite/react-swc/lingui.setup.md` inserting a new item 3 into this same list. It was held back rather than opened as a PR, because this branch rewrites items 1–2 and the surrounding section. This PR should land first; the native-transform item is better folded in here than merged around it.

---

## Freshness note, 2026-10-10 — `@lingui/vite-plugin@6.9.1` confirms this draft's option 2 and fixes a filename bug

`@lingui/*` **6.9.1** published 2026-10-09T12:44–12:47Z. Read as a tarball diff rather than a release
title: **six of the eight packages are byte-identical to 6.9.0 except `package.json`** (`core`, `react`,
`babel-plugin-lingui-macro`, `format-po`, `format-po-gettext`, `detect-locale`). Only two carry code:

- **`@lingui/vite-plugin`** (`dist/index.mjs`, the file this draft's patch configures) gains two things:
  1. a **hard throw** when `macroTransform` is set and `macro.jsxRuntime === "solid"` — *"The native macro
     transform doesn't support macro.jsxRuntime: \"solid\" yet. Remove macroTransform from the plugin
     options and transform macros with @lingui/babel-plugin-lingui-macro instead."* This **confirms this
     draft's option 2 verbatim**, which already names `macro.jsxRuntime: "solid"` as a case the native
     transform does not support. The draft's remedy (switch to `@vitejs/plugin-react-swc` +
     `@lingui/swc-plugin`) differs from upstream's (fall back to the Babel macro plugin) and stays as
     written, because the gate this draft sits under exists precisely because `@vitejs/plugin-react@6`
     dropped the `babel` option. **No stack in this repo is affected** — `grep -rn 'jsxRuntime' skills/`
     → 2 hits, both in the `@vitejs/plugin-react@6` gate prose; `macroTransform` → 0 hits on `main`;
     `solid` → no Solid stack in the 24-stack manifest.
  2. the transform's filename argument now strips a Vite query string:
     `path.basename(id.replace(/\?.*$/, ""))` instead of `path.basename(id)`. The native transform is
     given a *filename*, so `Foo.tsx?v=abc` used to reach it with the query attached.
- **`@lingui/cli`** — 13 files, all under `extract-experimental/` and `api/{stats,typedPool,workerPools}`:
  a named worker pool (`createNamedWorkerPool`) and `getAllStats` / `printCatalogStats` splitting
  computation from terminal styling. **`extract-experimental` is taught nowhere in `skills/`**, so no
  claim moves.

**No change to this draft's patch.** It requires `@lingui/vite-plugin@^6.9.0`, a **floor**, not a stamp —
`^6.9.0` now resolves to `6.9.1`, which is the version a reviewer would install, and `6.9.1` only makes
the draft's own caveat enforceable. Per **open item 75**, checked for a quoted value whose movement is
this draft's subject: the draft quotes `6.9.0` as *the release that added the feature*, which is a
historical fact and does not go stale. Also re-checked today: `git apply --check` **clean** on `main`
`48a676ae`, and `@lingui/native-tools` moved `^0.1.5` → `^0.1.6` in both `@lingui/cli` and
`@lingui/vite-plugin` — the draft's prose quotes `@lingui/native-tools@^0.1.5` as what
`@lingui/vite-plugin@6.9.0` declares, which also remains true of `6.9.0`.

Filed: https://github.com/globalize-now/globalize-skills/pull/96 (2026-10-13, draft)
