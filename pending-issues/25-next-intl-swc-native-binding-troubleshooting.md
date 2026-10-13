# `fix(next-intl)`: `next.config` dies with `Failed to load native binding` and nothing points at next-intl — document it in both Next.js setup references

**Status: UNFILED — no write path.** `lc_have_token` → rc 1. Decomposed in the same call: `lc_token` reads `library-checks/.github-token` **OK** (93 chars, `github_pat_…`), prefix `case` check **PASS**, `GET https://api.github.com/repos/globalize-now/globalize-skills` with `Authorization: Bearer <token>` → **`401`**, body `{"message": "Bad credentials", "documentation_url": "https://docs.github.com/rest", "status": "401"}`; the same GET **without** the header → **`200`** in the same call (control). Token file mtime **2026-08-25 17:27:18Z**, unchanged since it was added. **Nineteenth** consecutive check without a write path (GitHub MCP connector absent for the ninth run; PAT `401`, token unchanged for 47 days). Found 2026-09-30, **patch refreshed 2026-10-01** for `@swc/core@1.16.13` (see § "Refreshed 2026-10-01"), and **substantially rewritten 2026-10-11** when `1.16.17` shipped an explicit opt-out (see § "Rewritten 2026-10-11").

Type: **PR**, ready for review once a write path exists. Patch: [`25-next-intl-swc-native-binding.patch`](./25-next-intl-swc-native-binding.patch) — `git apply --check` clean against `main` `48a676ae`, 2 files, **+122/-0** (regenerated 2026-10-11).

**Suggested branch:** `library-check/next-intl-swc-native-binding`
**Labels:** `bug`, `globalize-guide`, `next-intl`, `library-check`

---

## What moved upstream

`next-intl@4.14.8` published **2026-09-29T11:11:30.097Z**, taking `latest` from `4.14.7`. The release itself is small and unrelated to this finding — PO references gain an optional `column`, and the sort tie-breaks on it (see § "The 4.14.8 diff itself" below). What the bump does is **re-resolve `@swc/core`**, one day after `@swc/core@1.16.12` landed.

`next-intl` has carried `@swc/core` in its own `dependencies` — not `peerDependencies` — since `4.5.0`:

| `next-intl` | declared `@swc/core` range | from |
|---|---|---|
| `4.5.0` | `^1.13.19` | 2025-11-07 |
| `4.5.4` | `^1.15.2` | 2025-11-19 |
| `4.13.7` | `~1.15.47` | 2026-08-17 |
| **`4.14.0`–`4.14.8`** | **`~1.16.0`** | 2026-08-27 |

`~1.16.0` is `>=1.16.0 <1.17.0`. The published stable 1.16 line was `1.16.0`, `1.16.1`, `1.16.2`, `1.16.12` — so it resolved to **`1.16.12`**, the release that [draft 24](./24-swc-core-1-16-12-native-binding-cache.md) found ships the native addon as a stub validated by **ancestor ownership** of its materialization cache root.

## Why the skills need to change

Not because of the resolution — because of the **error text**. `next-intl/plugin` loads `@swc/core` at module scope, by both entry points:

| entry | path to `@swc/core` |
|---|---|
| `require('next-intl/plugin')` — `next.config.js` | `dist/cjs/development/plugin.cjs` **line 9**, `require('@swc/core')`, top of file, unconditional |
| `import … from 'next-intl/plugin'` — `next.config.ts` / `.mjs` | `plugin/createNextIntlPlugin.js` → `plugin/extractor/initExtractionCompiler.js` → `extractor/ExtractionCompiler.js` → `extractor/extractor/MessageExtractor.js`, static `import {transform} from '@swc/core'` |

So on an affected machine the failure happens **while Next.js is reading its own config**, before any i18n code runs, and it says:

```
Error: Failed to load native binding
  [cause][1] ERR_SWC_NATIVE_CACHE: SWC native addon: validate cache root
  /…/.cache: cache root has a parent writable by another user without trusted
  sticky protection. Reinstall the native package if its payload is damaged;
  check SWC_NATIVE_BINDING_CACHE and directory permissions for materialization
  failures.
```

Nothing in that names `next-intl`, i18n, or the plugin. `npm install` exited **0**. `@swc/wasm` is sitting in `node_modules`, installed by `@swc/core`'s `postinstall` as a fallback and never reached, because `@swc/core/index.js` line 66 (`var binding_1 = require("./binding")`) throws at module scope, outside the `try/catch` at L76–93 that would use it. A user who followed these skills has a green install, a dead `next build`, and no thread to pull.

That is what the patch fixes: it does not change any resolution, pin, or install line. It tells the user what the error is.

## Exposure, from the (C) leg on `main` `f4f71a1`

**9 `next-intl@^4` install sites across 5 files**, every one of which also writes a `next.config` that imports `next-intl/plugin`:

| file | install sites | `next-intl/plugin` import |
|---|---|---|
| `skills/globalize-guide/manifest.json` | `nextjs-app-router-next-intl`, `nextjs-pages-router-next-intl` | n/a (manifest) |
| `.../frameworks/nextjs/app-router/next-intl.setup.md` | L66, L72, L78, L84 | L268, L282, L297 |
| `.../frameworks/nextjs/pages-router/next-intl.setup.md` | L29, L35, L41, L47 | L94, L113, L133, L159 |
| `.../libraries/next-intl/po-format.setup.md` | — | L104, L139 |
| `skills/globalize-guide/SKILL.md` | L499 (quoting example) | — |

## Measured

One machine, one probe, clean `npm i` into an empty project each time (`--omit=peer`, so `next` itself is absent — see "Needs a human"):

| `@swc/core` resolved for `next-intl@4.14.8` | `require('@swc/core')` | `require('next-intl/plugin')` | `await import('next-intl/plugin')` |
|---|---|---|---|
| **`1.16.12`** (what `~1.16.0` picks today) | **throws** `Failed to load native binding` | **throws** | **throws** |
| **`1.16.2`** (`overrides: {"@swc/core":"1.16.2"}`) | OK | OK, `typeof function` | OK, `typeof function` |

Corroborating detail from the same trees: the `1.16.12` binding is a **10 650 960**-byte stub; the `1.16.2` one is the real **33 313 448**-byte addon. `@swc/wasm` present in the `1.16.12` tree. `npm` exit 0 in both.

## The patch

Adds one `###` subsection to each of the two Next.js setup references, immediately after the `next.config` scaffolds and before `### Composing with other plugins`:

- `skills/globalize-guide/references/languages/js-ts/frameworks/nextjs/app-router/next-intl.setup.md` — inserted at L309, under `## Next.js Plugin`
- `skills/globalize-guide/references/languages/js-ts/frameworks/nextjs/pages-router/next-intl.setup.md` — inserted at L154, under `## Next.js Config`

Same text in both, titled **`### If \`next.config\` fails to load with \`Failed to load native binding\``**. It states the dependency and both load paths, quotes the error, names `1.16.12` and `1.16.13` and the ancestor-ownership predicate, says plainly that `npm install` exits 0 and why the wasm fallback does not fire, and gives the `overrides` / `resolutions` remedy pinning `1.16.2` — with the caveat that this is an **environment-shaped** failure, normal on an ordinary workstation where `/` is root-owned.

It deliberately does **not**: pin anything in `manifest.json`, change any `npm install` line, or touch the `swc_core` compatibility note that #69 rewrites.

## Verification

- `git apply --check` against a fresh `--depth 1` clone of `origin/main` `f4f71a1` — **clean**.
- Markdown structure after apply: code-fence counts even in both files (104, 72); new `###` nests correctly under the existing `##` (app-router L258 `## Next.js Plugin` → L309 new → L344 `### Composing…`; pages-router L85 `## Next.js Config` → L154 new → L189 `### Composing…`).
- `evals/verify-manifest.sh` **6 passed / 0 failed / 0 warnings**, rc 0.
- `evals/verify-rules-template.sh` **104 / 0 / 0**, rc 0.
- `evals/verify-format-helpers.sh` **88 / 0 / 0**, rc 0.
- `evals/verify-setup.sh`, `check-behavior.sh`, `run-eval-layer-a.sh` all require `<workdir> <fixture>` (a scaffolded project); not run — see "Needs a human".

## Refreshed 2026-10-01 — `@swc/core@1.16.13`

`@swc/core` took `latest` from `1.16.12` to **`1.16.13`** at 2026-09-30T09:51:31.904Z, inside this run's window. That is the release this draft's own open question asked to be re-checked on. Measured:

| | `1.16.12` | `1.16.13` |
|---|---|---|
| `@swc/core` npm package, files differing | — | **`package.json` only** (version + pinned optionalDependencies); 13 of 14 files byte-identical |
| `index.js` line 66 unguarded `require("./binding")` | present | **present, byte-identical** — `@swc/wasm` fallback still unreachable |
| `@swc/core-linux-arm64-gnu` unpacked | 10 664 616 | **10 668 712** (still a stub; `1.16.2` is 33 325 239) |
| `ERR_SWC_NATIVE_CACHE` + `cache root has a parent writable by another user without trusted sticky protection` in the stub | present | **present** |
| `require('@swc/core')` on this machine | throws | **throws, same cause chain** |
| `swc_core` | 81.0.1 | 81.0.2 |

So `~1.16.0` now resolves to `1.16.13` rather than `1.16.12`, and the failure, the remedy and the `1.16.2` pin are all unchanged. The patch was regenerated to say so rather than left asserting that `1.16.12` is current `latest`.

**What did change upstream, and why it matters for macOS.** The eight commits between `v1.16.12` and `v1.16.13` are dominated by [`0b151bf` — `perf(node): Optimize macOS native addon first load (#12436)`](https://github.com/swc-project/swc/commit/0b151bf). In `bindings/binding_native_addon/src/lib.rs`, `replacement_carrier` gained `cfg!(target_os = "macos") ||` to its early `return None`. Read against `initialize()` in the same file, that is a routing change: when `replacement_carrier` returns `Some(carrier)`, the loader takes `replacement::try_replace` and `cache::materialize` is never called, so `secure_cache_root` never runs. Returning `None` sends the load to `cache::materialize` → `cache_directory` → `secure_cache_root`.

Before `1.16.13`, a writable macOS installation therefore **bypassed the ancestor predicate entirely** via APFS self-replacement. From `1.16.13` every macOS first load goes through it. Upstream's own measurements (`docs/native-addon-macos-startup.md`, new in this release) show why they did it — 17–18 % off first load, and installed-second-load median from ~255 ms to ~18 ms — and the change is a clear improvement on an ordinary Mac, where the default root `$HOME/Library/Caches` and all its ancestors validate. But it means the predicate is load-bearing on macOS for the first time, so a Mac with `XDG_CACHE_HOME` pointed at a shared or network volume, or at a path under a directory owned by another non-root uid, can now fail where `1.16.12` did not. The patch names this.

This is upstream investing in the cache design, not backing it out — which is the part that bears on [draft 24](./24-swc-core-1-16-12-native-binding-cache.md)'s open "wait or pin" decision.

## Needs a human

- **The behavioural evals were not run.** They need a live Next.js project, and `next`'s `next-swc.linux-arm64-gnu.node` is 89 858 592 bytes; the `/sessions` volume started this run at 97 % (298 M free) and an earlier attempt to install it hit 100 % and aborted. The patch is documentation-only and touched no template or manifest, so the three standalone verifiers are the relevant gate — but a run of `verify-setup.sh` on a `nextjs-app-router-next-intl` fixture would close this properly.
- **`withNextIntl(nextConfig)` was not exercised, only the module load.** With `--omit=peer` there is no `next` in the tree, so applying the plugin throws `Failed to get current Next.js version` — an artefact of the probe, not a finding. The claim in the table is about **loading** `next-intl/plugin`, which is the step `@swc/core` gates.
- **~~Is `1.16.2` the right pin to recommend?~~ ANSWERED 2026-10-01 — yes.** This asked for a re-check if `1.16.13` shipped with the predicate relaxed or `index.js:66` guarded. `1.16.13` shipped 2026-09-30T09:51:31Z and did **neither**: every file in the npm package is byte-identical to `1.16.12` except `package.json` (so line 66 is unchanged and the `@swc/wasm` fallback is still unreachable), the native stub is still 10.6 MB against `1.16.2`'s 33 MB, and `secure_cache_root` in `crates/swc_native_addon/src/platform/unix.rs` at `v1.16.13` carries the same ancestor predicate. `require('@swc/core')@1.16.13` throws the same `ERR_SWC_NATIVE_CACHE` here. The pin stands.
- **How common is the ancestor-ownership condition?** Unresolved, and inherited from draft 24. The patch is written to be honest about this ("treat this as an environment-shaped failure, not a universal one") so it is safe to merge without the answer.

## Duplicate checks

- **Open PRs (item 52), file and hunk level.** All 10 open PR file-lists read on `main` `f4f71a1`. The two files this patch touches — `frameworks/nextjs/app-router/next-intl.setup.md` and `frameworks/nextjs/pages-router/next-intl.setup.md` — appear in **no** open PR. The three PRs in adjacent territory were checked as diffs: **#67** touches `libraries/next-intl/po-format.setup.md` (+48/−3), `po-format.convert.md`, `rules.template.md` — a different directory and about `msgctxt` semantics and PO catalog gating, not the plugin's native dependency; **#69** touches the four Vite-family `swc/lingui.setup.md` files plus `lovable-i18n/SKILL.md`; **#63** touches `manifest.json` + `vite/react-swc/lingui.setup.md`. No overlap with either file, so no hunk can collide.
- **Queued patches.** 21 (`css-i18n/…`), 22 (`webext/…` ×3), 23 (`nuxt/…`, `libraries/vue-i18n/…`) touch disjoint file sets from this one; all four can land in any order.
- **Draft queue (item 58).** `pending-issues/` grepped for `next-intl`, `@swc/core`, `binding`, `native`, `1.16`. `next-intl` hits: `0-next-intl-root-params.md` (root-params migration), `4-next-intl-eslint-addons.md` (ESLint add-ons), `12-node-engines-gate.md`, `19-untracked-installed-and-gating-packages.md`. None concerns the plugin's native dependency. `@swc/core` hits are the five recorded in draft 24, all about the plugin ABI or the manifest gap. **This draft is the skills-side remedy that draft 24 explicitly declines to be**, and draft 24 has been updated to point here; they are one root cause with two different targets (upstream `swc-project/swc` vs this repo).

## The 4.14.8 diff itself

Read as a tarball diff, `4.14.7` → `4.14.8`, not from the release notes. Seven files differ, and every functional change is the same one:

- `extractor/utils.js` + `plugin.cjs` — `compareReferences` gains a column tie-break: `(refA.line ?? 0) - (refB.line ?? 0)` → `… || (refA.column ?? 0) - (refB.column ?? 0)`.
- `extractor/catalog/CatalogManager.js` + `plugin.cjs` — `areSourceMessagesEqual` also compares `msg1.reference.column === msg2.reference.column`.
- `types/…/POCodecLegacy.d.ts` — `references` entries gain `column?: number`.
- `package.json` — `@eloqnt/config` and `@eloqnt/format-po` `^0.1.0` → `^0.1.1`; `icu-minify`, `next-intl-swc-plugin-extractor`, `use-intl` to `4.14.8`.

`@eloqnt/format-po@0.1.1` (published 2026-09-29T10:04:56.637Z) is the producer side and its diff is **one expression**, in the encode-side sort comparator, plus the matching `column?: number` on the type. Changelog, verbatim: *"References can carry an optional `column`, and PO files order messages that share a line by it, so their order no longer depends on the input order."*

**Not actionable for these skills, and this closes part of a carried (F) head.** Open item 57 carried "`@eloqnt/format-po` decode-mode changes" as an unverified claim. This diff is **encode-side only** — `decode` is byte-identical between `0.1.0` and `0.1.1`, so the three-way mode detection (`id-msgid` / `key-msgctxt` / `gettext`) that `po-format.setup.md` documents is untouched. Two further limits keep it out of the skills:

1. The sort runs only when the detected mode is **not** `gettext` (`_ = f === 'gettext' ? s : s.toSorted(g)`), and `po-format.setup.md` records that the scaffold in this reference produces plain **gettext** catalogs. So the new ordering does not apply to catalogs these skills generate.
2. Columns reach the file at all only when the existing catalog already carried line numbers (`m = u.get(locale) ? e => e : c`, where `c` collapses references to unique paths). A catalog written by this reference's conventions is unaffected.

Recorded so a later run does not re-derive it. If anything, it reduces diff churn.

## Sources

- **npm:** full packuments for all 32 tracked packages (32/32, each asserted to parse and to carry the requested `name`); `next-intl` version history walked for the `@swc/core` range table; `@swc/core` version list filtered to the stable 1.16 line. Queried 2026-09-30 ~06:05–06:20Z.
- **Tarballs, diffed:** `next-intl` `4.14.7` and `4.14.8`; `@eloqnt/format-po` `0.1.0` and `0.1.1`.
- **Executed, not read:** `npm i next-intl@4.14.8` into an empty project (twice — once plain, once with `overrides: {"@swc/core":"1.16.2"}`); `require('@swc/core')`, `require('@swc/core/binding')`, `require('next-intl/plugin')` and `await import('next-intl/plugin')` on both trees; `git apply --check` for this patch and for the three queued ones against `f4f71a1`; `evals/verify-manifest.sh`, `verify-rules-template.sh`, `verify-format-helpers.sh`.
- **Read in the installed tree:** `@swc/core/index.js` L60–70, `@swc/core/binding.js` L320–350, `next-intl/dist/cjs/development/plugin.cjs` L1–30, `next-intl/package.json` `exports`.
- **Repo:** `origin/main` **`f4f71a1`** (unchanged from 2026-09-29), fresh `--depth 1` clone; open PRs and issues via the unauthenticated REST API; `library-checks/walkers.py` for the (C) legs with a pinned manifest path and a `stacks` assertion.


---

## Rewritten 2026-10-11 — upstream shipped an opt-out, and it is now the first remedy

`@swc/core` published **twice** in the 2026-10-11 check's window: `1.16.17` at **2026-10-11T04:34:25.935Z** and `1.16.18` at **06:48:29.652Z** — two stable releases 2 h 14 min apart, the second four minutes before the run fired. `1.16.14`, `1.16.15` and `1.16.16` were never published. `latest` went `1.16.13` → `1.16.18`, so **`next-intl@^4`'s `~1.16.0` now resolves to `1.16.18`** (measured: a clean `npm i --omit=peer next-intl@4.14.9` installed `@swc/core@1.16.18`).

### What changed, read from source rather than from a release title

The npm package's **JavaScript side did not move at all.** Every file hashed across all four releases:

```
$ diff <(cd x1.16.13/package && find . -type f | sort | xargs sha256sum) \
       <(cd x1.16.17/package && find . -type f | sort | xargs sha256sum)
9c9
< 30f810dd…  ./package.json
> c87dc2db…  ./package.json
```

— one file, and the difference is `version` plus the pinned `optionalDependencies`. Same for `1.16.17` → `1.16.18`. So **`index.js` line 66** — the unguarded `var binding_1 = require("./binding")` that makes the `@swc/wasm` fallback unreachable — is byte-identical for the **fifth** consecutive release. That half of this draft is unchanged and still live.

The native package is still a stub: `@swc/core-linux-x64-gnu` unpacked **10 676 981** bytes at `1.16.18` (`10 558 149` at `1.16.13`, **32 756 484** at `1.16.2`); arm64 `10 791 640` / `10 668 712` / `33 325 239`. `strings` on the `1.16.18` stub still carries `ERR_SWC_NATIVE_CACHE`, the ancestor-predicate message, and the `swc_native_addon/src/{cache,format,integrity,replacement,platform/unix}.rs` event sites. **Not a revert and not a relaxation of the packaging.**

**What did change is one new escape hatch**, in `crates/swc_native_addon/src/platform/unix.rs`. Diffed at the tags, and bisected across every tag in the gap — `v1.16.14`, `v1.16.15`, `v1.16.16` all have **0** occurrences; `v1.16.17` has **2**:

```diff
 pub fn secure_cache_root(root: &Path) -> io::Result<()> {
     if !root.is_absolute() { … }
+    // Some isolated CI executors cannot satisfy ancestor ownership or mode
+    // requirements. This opt-out also permits symlinked ancestors, so callers
+    // must trust every component against replacement before the native load.
+    if env::var_os("SWC_NATIVE_BINDING_CACHE_SKIP_SECURITY_CHECK").as_deref()
+        == Some(std::ffi::OsStr::new("1"))
+    {
+        tracing::debug!(…, "skipping native cache root security check by explicit environment opt-out");
+        return Ok(());
+    }
     for directory in root.ancestors() { … }
 }
```

`SWC_NATIVE_BINDING_CACHE_SKIP_SECURITY_CHECK` is present in the **shipped** `1.16.18` stub's strings and **absent** from `1.16.13`'s, so this is not a source-only change. The same release also added `fallback_cache_root()`, which canonicalises the temp dir and retries there — visible in the error text, which went from `validate cache root <p>: …` to `user cache failed: validate cache root <p>: …; fallback cache failed: …`.

### Measured end to end, on the affected machine, with four controls

`/` is owned by `nobody` (uid 65534), effective uid 1343 — the predicate's failing case. `next-intl@4.14.9`, `~1.16.0` → `@swc/core@1.16.18`, `@swc/wasm` present in the tree and unused:

| | `require('@swc/core')` | `require('next-intl/plugin')` | `import('next-intl/plugin')` |
|---|---|---|---|
| default install, no variable | **throws** `ERR_SWC_NATIVE_CACHE` | **throws** | **throws** |
| `SWC_NATIVE_BINDING_CACHE_SKIP_SECURITY_CHECK=1` | **OK** | **OK** | **OK** |
| `…SKIP_SECURITY_CHECK=0` ← control, value must be `1` | throws | — | — |
| `SWC_NATIVE_BINDING_CACHE=<fresh dir>` ← control, the knob the error names | throws (`custom cache failed: validate cache root …`) | throws | — |
| the variable against `@swc/core@1.16.13` ← control, must be a no-op | throws | — | — |

And the loaded host really works: `transformSync('const a=1;')` → `"var a = 1;\n"` through the opt-out path, so the addon is materialised, not merely past the check. **One honest note on method:** the first attempt at the positive row failed with `write decoded addon: No space left on device (os error 28)` — the device VM was at 100 %. That is itself weak evidence the check had been skipped (the error moved from *validate* to *write*), but it is not the measurement; 30 MB was freed and the row above is the clean re-run.

### Why this changes the patch rather than just the prose

The old patch offered **one** remedy: `overrides: {"@swc/core": "1.16.2"}`. That is a backwards pin of a transitive host, it drops five patch releases of fixes, and it is the kind of change a reviewer is right to hesitate over. The opt-out is an environment variable, keeps the host current, and is upstream's own documented answer for this exact class of machine.

So the patch now leads with it and keeps the pin as **Remedy 2**, scoped to the case where it is still the only option — a resolved host at `1.16.12` or `1.16.13`, which have no opt-out, or a build where setting an environment variable is not available. Both remedies are measured in the table above. The patch grew from **+78/-0 to +122/-0** across the same 2 files.

Three guardrails are in the new text because each is measured and each is a way to get this wrong:

1. **It must be exactly `1`.** `0` leaves the check on.
2. **It is a no-op below `1.16.17`.** Someone pinned at `1.16.13` who sets it gets the identical failure.
3. **It permits symlinked ancestors.** Upstream's own comment says callers "must trust every component against replacement", so the patch says to use it where you control the filesystem and not on a host whose cache path other users can rename.

### Verification

- `git apply --check` **clean** on `main` `48a676ae`; 2 files, `+122/-0`. The replacement script asserted **4 anchors × 2 files, each exactly once**, and wrote nothing on the first pass.
- Standalone verifiers on clean `main` and on `main`+25 — **identical both ways**: `verify-manifest.sh` **6/0/0**, `verify-format-helpers.sh` **99/0/0**, `verify-rules-template.sh` **114/0/0**. `bash -n` clean on all 14 `evals/*.sh` + `evals/library-checks/*.sh`.
- Overlaps **27** only, on `nextjs/app-router/next-intl.setup.md`. **Re-tested after the rewrite and they still commute** — both orders yield tree `82cbf86a010fa4eb`.
- **The eval suite still asserts nothing here.** `grep -rlF` over `evals/` and `fixtures/` for `SWC_NATIVE_BINDING_CACHE`, `SKIP_SECURITY_CHECK`, `ERR_SWC_NATIVE_CACHE`, `1.16.17`, `1.16.18`, `Failed to load native binding`, `swc_core` → **0 files each, in both trees.**

### Still needs a human

- **Should the same note go on the five Vite/SWC stacks?** They reach `@swc/core` transitively through `@vitejs/plugin-react-swc` and have the identical failure mode, but those five files are what **#69** rewrites, so a patch there would collide with an open draft PR. Deliberately out of scope; flagged for whoever rebases #69.
- **The upstream one-liner is still unfiled.** `index.js:66` should be guarded so the `@swc/wasm` fallback the `postinstall` already installs can actually run. Five releases, five times unguarded. The opt-out helps a machine whose operator can set an environment variable; the guard would help everyone else.
