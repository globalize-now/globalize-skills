# `@swc/core@1.16.12` moved the native addon behind a validated materialization cache — `require('@swc/core')` now hard-fails in environments where an ancestor directory is owned by a non-root user

**Status: UNFILED — no write path.** `lc_have_token` → rc 1; `GET /repos/globalize-now/globalize-skills` with the token in `library-checks/.github-token` → **`401 Bad credentials`**; the same GET without the header → `200` in the same call. Token file mtime **2026-08-25 17:27:18Z**, unchanged. **Eighth** consecutive run without a write path. Found 2026-09-29, **exposure materially widened 2026-09-30** (see "A second, more central route" below), **and the “wait for 1.16.13” option closed 2026-10-01** (see "1.16.13 answers the wait-or-pin question" below).

Type: **issue**, not a PR. See "Why this is not a PR" below — there is no change to these skills that is both safe and justified by what is established so far.

**Labels:** `bug`, `globalize-guide`, `lovable-i18n`, `library-check`, `upstream`

---

## What moved upstream

`@swc/core@1.16.12` was published **2026-09-29T04:48:22.382Z** — about eighty minutes before this run — taking `latest` from `1.16.2` (2026-09-04). The nightly channel restarted at the same time (`1.16.12-nightly-20260929.1`, 03:18Z) after fifteen days and twelve empty windows.

The stable jump is not the interesting part. The packaging is:

| `@swc/core-linux-arm64-gnu` | unpacked | files |
|---|---|---|
| `1.16.0` | 32 731 319 | 4 |
| `1.16.1` | 32 735 415 | 4 |
| `1.16.2` | 33 325 239 | 4 |
| **`1.16.12`** | **10 664 616** | 4 |

Same file count, one third the size. The shipped `swc.linux-arm64-gnu.node` (10 650 960 bytes) is no longer the addon — it is a stub that materializes the real binary into a cache directory at `dlopen` time, and **validates that directory first**:

```
Error: SWC native addon: validate cache root <path>: cache root has a parent
writable by another user without trusted sticky protection. Reinstall the native
package if its payload is damaged; check SWC_NATIVE_BINDING_CACHE and directory
permissions for materialization failures.
  code: 'ERR_SWC_NATIVE_CACHE'
```

The predicate is about **ancestors**, not about the cache root itself. On the machine this check runs on, `/` is `drwxr-xr-x nobody:nogroup`, so *every* candidate root is rejected — including `/tmp` and `/var/tmp`, which carry the sticky bit the message names as the exemption:

| `SWC_NATIVE_BINDING_CACHE` | result |
|---|---|
| unset (default `$HOME/.cache`) | rejected |
| `/tmp/swcA` (`drwxrwxrwt`) | rejected |
| `/var/tmp/swcB` (`drwxrwxrwt`) | rejected |
| a fresh `0700` dir under the project | rejected |

So the escape hatch the error text names cannot be used when the offending directory is one the caller does not own. Neither can "make either directory writable" — the directory is not unwritable; it is owned by the wrong uid.

## Measured, on one machine, same probe, same plugin

`@lingui/swc-plugin@6.7.0`, `t\`Hello ${name}\`` through `transform()` with the Wasm plugin:

| host | `swc_core` | result |
|---|---|---|
| `@swc/core@1.16.2` | 78.0.0 | **OK** — emits `$_i18n._({ id: "OVaF9k", message: "Hello {name}", values: { name } })` |
| `@swc/core@1.16.12` | 81.0.1 | **`Error: Failed to load native binding`** (`ERR_SWC_NATIVE_CACHE`) — thrown from `require('@swc/core')`, before any plugin is resolved |

The 1.16.12 row is a *load* failure, not a plugin failure. Whether the plugin itself still runs on a `swc_core@81.0.1` host is **unmeasured** — this sandbox cannot load that host at all. That is the open question under "Needs a human".

`swc_core` versions read from `crates/swc_core/Cargo.toml` at each git tag: `v1.16.0` → 77.0.0, `v1.16.1` → 77.0.2, `v1.16.2` → 78.0.0, `v1.16.12` → 81.0.1. (`1.16.3`–`1.16.11` have no tags; they existed only as nightlies.)

## `npm install` exits 0, and the wasm fallback that should catch this is unreachable

The install succeeds. `@swc/core`'s own `postinstall.js` notices the native binding will not load and installs `@swc/wasm` as a fallback — confirmed present in the 1.16.12 tree and **absent** in the 1.16.2 tree, where the native load worked.

That fallback never runs. `@swc/core/index.js` wires it correctly at lines 76–93:

```js
const bindings = (() => {
    let binding;
    try {
        binding = require("./binding.js");
        const triple = binding.getTargetTriple();
        assert.ok(triple, "Failed to read target triple from native binary.");
        return binding;
    } catch (_) {
        // postinstall supposed to install `@swc/wasm` already
        fallbackBindings = require("@swc/wasm");
    } finally { return binding; }
})();
```

— but **line 66**, ten lines above and outside that block, is:

```js
var binding_1 = require("./binding");
```

added for the `experimental_newMangleNameCache` re-export. It throws at module scope, so the guarded block is never reached and `@swc/wasm` is installed and ignored. Line 66 is byte-identical in `1.16.2`, so the unreachable fallback is **pre-existing**; `1.16.12` is what makes it load-bearing, because it is the first release that can fail there on a machine with a working native binary for its own platform.

Net effect for a user of these skills: `npm install` is green, and `vite build` dies on `require('@swc/core')` with a message about cache-root permissions that mentions neither SWC plugins nor i18n.

## Exposure in this repo

`@swc/core` is **not pinned anywhere in `skills/`**. It is in the library check's tracked set but not in `manifest.json` — it appears in this run's (C) leg under `tracked_not_in_manifest`, which is exactly the blind spot open item 13 and issue [#60](https://github.com/globalize-now/globalize-skills/issues/60) describe.

Five stacks resolve it transitively through `@vitejs/plugin-react-swc` — `4.2.3`–`4.3.1` depend on `@swc/core@^1.15.11`, `4.3.2`–`4.3.3` on `^1.15.46`; **both ranges admit `1.16.12`**:

- `frameworks/vite/react-swc/lingui.setup.md`
- `frameworks/remix/swc/lingui.setup.md`
- `frameworks/react-router-framework/swc/lingui.setup.md`
- `frameworks/tanstack-start/swc/lingui.setup.md`
- `frameworks/webext/swc/lingui.setup.md`

plus `skills/lovable-i18n/SKILL.md`, whose Path A scaffold is `@vitejs/plugin-react-swc`.

**And it lands on an open PR.** [#69](https://github.com/globalize-now/globalize-skills/pull/69) (draft, opened 2026-08-30, last touched 2026-09-17) rewrites the version-compatibility note in all five of the files above plus `lovable-i18n/SKILL.md`, and its remedy for a below-floor host is:

> `npm install -D '@swc/core@^1.15'` lifts a `3.x` host over the floor (verified: `3.11.0` + `@swc/core@1.16.1` builds and transforms)

`^1.15` resolved to `1.16.1` when that was written. It resolves to **`1.16.12`** now. The instruction is still correct on an ordinary machine; on an affected one it replaces a `failed to invoke plugin` error with a `Failed to load native binding` error, which is a worse place to land a user who is already debugging.

### A second, more central route — added 2026-09-30

Yesterday's exposure analysis found only the transitive `@vitejs/plugin-react-swc` route. It missed a **direct** one, and it is the bigger of the two.

`next-intl` carries `@swc/core` in its own `dependencies` — a runtime dependency, not a peer:

| `next-intl` | declared `@swc/core` range | first seen |
|---|---|---|
| `4.5.0` | `^1.13.19` | 2025-11-07 |
| `4.5.4` | `^1.15.2` | 2025-11-19 |
| `4.13.7` | `~1.15.47` | 2026-08-17 |
| **`4.14.0`–`4.14.8`** | **`~1.16.0`** | 2026-08-27 |

`~1.16.0` is `>=1.16.0 <1.17.0`. The published stable 1.16 line is `1.16.0`, `1.16.1`, `1.16.2`, `1.16.12`, so **it resolves to `1.16.12`** — measured, not inferred: a clean `npm i next-intl@4.14.8` in an empty project installed `@swc/core@1.16.12` (29 packages, `npm` exit 0).

`next-intl/plugin` then loads it at **module scope**, by both entry points:

| entry | path to `@swc/core` |
|---|---|
| `require('next-intl/plugin')` — `next.config.js` | `dist/cjs/development/plugin.cjs` **line 9**, `require('@swc/core')`, top of file |
| `import … from 'next-intl/plugin'` — `next.config.ts` / `.mjs` | `plugin/createNextIntlPlugin.js` → `plugin/extractor/initExtractionCompiler.js` → `extractor/ExtractionCompiler.js` → `extractor/extractor/MessageExtractor.js`, static `import {transform} from '@swc/core'` |

Measured on the same machine, same tree:

| `@swc/core` resolved for `next-intl@4.14.8` | `require('@swc/core')` | `require('next-intl/plugin')` | `await import('next-intl/plugin')` |
|---|---|---|---|
| `1.16.12` (what `~1.16.0` picks today) | **throws** | **throws** | **throws** |
| `1.16.2` (via `overrides`) | OK | OK | OK |

The throw is `Failed to load native binding`, with `cause[1]` = `ERR_SWC_NATIVE_CACHE: … validate cache root /…/.cache: cache root has a parent writable by another user without trusted sticky protection` — the same predicate as above, reached through a completely different package. `@swc/wasm` was present in the tree and unused, exactly as § "`npm install` exits 0" describes.

**Why this matters more than the Vite route.** The failure lands while Next.js is reading `next.config`, before any i18n code runs, and the message names neither `next-intl` nor SWC plugins. And the affected stacks are the ones the skills install most:

- `skills/globalize-guide/manifest.json` — `nextjs-app-router-next-intl` and `nextjs-pages-router-next-intl`, both `next-intl@^4` → `4.14.8`
- `frameworks/nextjs/app-router/next-intl.setup.md` — 4 install sites, and the `next.config` scaffold at L268/L282/L297 imports `next-intl/plugin`
- `frameworks/nextjs/pages-router/next-intl.setup.md` — 4 install sites, same import at L94/L113/L133/L159
- `libraries/next-intl/po-format.setup.md` L104/L139 — same import

That is **9 `next-intl@^4` install sites across 5 files** ((C) leg, `origin/main` `f4f71a1`), every one of which writes a `next.config` that loads the addon eagerly.

**This route does have a safe skills-side change**, which is why it is split out as its own PR-shaped draft: [`25-next-intl-swc-native-binding-troubleshooting.md`](./25-next-intl-swc-native-binding-troubleshooting.md). It adds a troubleshooting subsection to the two Next.js setup references — no pin in the manifest, no change to any install line — so it does not touch #69's argument or #63's floor.

## Why this is not a PR

Three reasons, in order:

1. **The obvious change is the wrong one, and as written it is not even a pin.** `~1.16.2` is `>=1.16.2 <1.17.0`, so it admits `1.16.12` and `1.16.13` and resolves to **`1.16.13`** — the release this draft is about. Only an exact `"1.16.2"` pins below the repackaging, which is what draft 25's `overrides` block uses. Setting that aside, a backwards pin is precisely what #69 spends its whole diff arguing against, and that the withdrawn draft [`15-swc-core-abi-drift.md`](./15-swc-core-abi-drift.md) got wrong in the other direction. Shipping it on eighty minutes of upstream would repeat that mistake with the sign flipped.
2. **The blast radius is not established from here.** The predicate rejects an ancestor owned by a *non-root* uid; root-owned ancestors are evidently trusted, or every Unix machine would fail (`/home` is root-owned and root-writable). So the affected class is environments where a non-root uid owns `/` or an intermediate mount — rootless containers with uid remapping, some CI sandboxes, and this device VM. How much of the skills' actual audience that is, this check cannot say, and one sandbox is not a sample. **Revised 2026-09-30:** this still holds for *pinning*, but it no longer rules out documenting the failure — see draft 25, which changes no resolution and only tells a user what the opaque error means.
3. **The fix may not belong here at all.** Guarding line 66 in `@swc/core/index.js` would make the `@swc/wasm` fallback do its job and turn a hard failure into a slow one. That is an upstream one-liner, not a skills change.

What a human should decide is whether to wait or to pin — and that decision wants the answer to the unmeasured question below. **The "wait" half is now evidenced against:** `1.16.13` shipped 2026-09-30 and changed none of this (§ "1.16.13 answers the wait-or-pin question"). **The third option, a troubleshooting row, is no longer waiting on it:** 2026-09-30 measured the whole chain end to end on the `next-intl` route, so draft 25 carries it as a verified patch. This draft stays an upstream issue.

## `1.16.13` answers the wait-or-pin question — added 2026-10-01

This draft said a human should decide "whether to wait (1.16.13 may revert or relax the check) or to pin". `@swc/core@1.16.13` published **2026-09-30T09:51:31.904Z**, taking `latest` from `1.16.12`. It is not a revert and not a relaxation.

**The JavaScript side did not move at all.** Both npm tarballs were fetched and every file hashed:

```
$ diff <(cd x1.16.12/package && find . -type f | sort | xargs sha256sum) \
       <(cd x1.16.13/package && find . -type f | sort | xargs sha256sum)
9c9
< e39a3721…  ./package.json
> 30f810dd…  ./package.json
```

One file differs, and `python3 -m json.tool` on both shows the difference is the `version` field plus the twelve pinned `optionalDependencies`. So:

- `index.js` **line 66**, the unguarded `var binding_1 = require("./binding")` that makes the `@swc/wasm` fallback unreachable, is byte-identical. The pre-existing defect this draft documents is untouched in its third release.
- The native package is still a stub: `@swc/core-linux-arm64-gnu` unpacked **10 668 712** bytes / 4 files at `1.16.13`, against **10 664 616** at `1.16.12` and **33 325 239** at `1.16.2`.
- `strings` on the `1.16.13` stub still carries `ERR_SWC_NATIVE_CACHE`, `cache root has a parent writable by another user without trusted sticky protection`, `cache directory must be a real directory owned by the current user with mode 0700` and the `crates/swc_native_addon/src/cache.rs` event sites.

**Measured on this machine, same probe:** a hand-built tree (`@swc/core@1.16.13` + `@swc/core-linux-arm64-gnu@1.16.13`, both from their registry tarballs, no `npm`) — `require('@swc/core')` throws `Failed to load native binding`, `cause[1]` = `ERR_SWC_NATIVE_CACHE: SWC native addon: validate cache root …/.cache: cache root has a parent writable by another user without trusted sticky protection`. **Control, identical method, `1.16.2`:** loads, and `transformSync('const a=1;')` returns `"const a = 1;\n"`. So the failure is the release, not the hand-built tree.

### The predicate, read from source rather than from `strings`

`crates/swc_native_addon/src/platform/unix.rs` at `v1.16.13`:

```rust
pub fn secure_cache_root(root: &Path) -> io::Result<()> {
    if !root.is_absolute() { … "cache root must be absolute" }
    for directory in root.ancestors() {
        let metadata = fs::symlink_metadata(directory)?;
        if !metadata.is_dir() || metadata.file_type().is_symlink() { … }
        if !cache_ancestor_is_secure(metadata.mode(), metadata.uid(), geteuid()) { … }
    }
}

fn cache_ancestor_is_secure(mode: u32, owner: u32, current: u32) -> bool {
    if owner != current && owner != 0 { return false; }
    mode & 0o022 == 0 || mode & STICKY_BIT != 0
}
```

Two corrections to how this draft has been describing it:

1. The `0o700` requirement quoted in the error table applies to `private_directory`, i.e. the **per-user namespace created under** the root, not to the root itself. A `0755` user-owned `~/.cache` is fine. This draft's earlier phrasing implied otherwise.
2. The default root is `$XDG_CACHE_HOME` if absolute, else `$HOME/Library/Caches` on **macOS** and `$HOME/.cache` elsewhere — and `executable_cache_root` rejects a root on a `noexec` mount as a separate failure with its own message. Every previous version of this draft named only the Linux path.

### What `1.16.13` actually changed, and why it widens macOS exposure

Eight commits between `v1.16.12` and `v1.16.13`; the substantive one is [`0b151bf` — `perf(node): Optimize macOS native addon first load (#12436)`](https://github.com/swc-project/swc/commit/0b151bf). Its only non-test production change, in `bindings/binding_native_addon/src/lib.rs`:

```diff
-    if *mode == CacheMode::Temporary {
+    // APFS self-replacement recompresses the decoded image with ditto and
+    // decodes it again for this process. Keep macOS first loads on the verified
+    // cache path, even for writable installations, before resolving the carrier.
+    if cfg!(target_os = "macos") || *mode == CacheMode::Temporary {
         return None;
     }
```

Read against `initialize()` in the same file: when `replacement_carrier` returns `Some(carrier)` the loader goes through `replacement::try_replace` and `cache::materialize` is **never called**, so `secure_cache_root` never runs. Returning `None` routes the load to `cache::materialize` → `cache_directory` → `secure_cache_root`.

So **until `1.16.13`, a writable macOS installation bypassed the ancestor predicate entirely**, and from `1.16.13` every macOS first load goes through it. On an ordinary Mac this is pure win — upstream's new `docs/native-addon-macos-startup.md` measures 17–18 % off first load and installed-second-load median from ~255 ms to ~18 ms, and the default `$HOME/Library/Caches` chain validates. But the predicate is load-bearing on macOS for the first time, so a Mac whose `XDG_CACHE_HOME` points at a shared or network volume, or under a directory owned by another non-root uid, can now fail where `1.16.12` succeeded. The affected class is still narrow; it is no longer Linux-and-containers only.

### Consequence for the decision

- **"Wait for upstream to back this out" has one data point against it and none for it.** The first release after the repackaging deepens reliance on the cache rather than relaxing it, and leaves the unreachable-fallback bug in place. Three releases, three times unguarded.
- The **upstream issue this draft recommends is now better-specified**: `index.js:66` should be guarded (one line, makes `@swc/wasm` do its job), and the ancestor predicate deserves a stated rationale for rejecting a sticky `/tmp` whose `/` is owned by a non-root uid. Worth filing against `swc-project/swc` with the `1.16.13` evidence, since the macOS routing change means more installations now reach that code path.
- **Draft 25's pin is re-confirmed, not superseded** — `1.16.2` is still the newest release in `~1.16.0` shipping a real addon, and `~1.16.0` now resolves to `1.16.13`. That draft's patch was regenerated this run to say so.

## Needs a human

- **Does `@lingui/swc-plugin@6.7.0` (built against `swc_core@77.1.1`) still run on a `swc_core@81.0.x` host?** Still unmeasured after three runs — neither `1.16.12`'s nor `1.16.13`'s addon loads in this sandbox, so the pairing cannot be exercised here at all. On any ordinary machine this is one `npm i @swc/core@1.16.13 @lingui/swc-plugin@6.7.0` and the probe in "Measured" above. If the answer is no, this stops being an environment-specific packaging story and becomes a live break for five stacks. **This is the one question in this draft that a sandbox cannot answer and a laptop can in two minutes.**
- **Is the ownership predicate intentional, or a regression?** Worth an upstream issue against `swc-project/swc` either way, together with the unguarded `require("./binding")` at `index.js:66`.
- **Should #69 be merged before this is answered?** Its correction is right and independent of this (see the report for 2026-09-29); it has been a draft for thirty days. The only line this touches is its `@swc/core@^1.15` remedy, which is a sentence, not the argument.

## Duplicate checks

- **Open PRs (item 52), hunk level.** All 10 open PR file-lists read on `main` `f4f71a1`. Two PRs touch SWC guidance: **#69** (the five stack files + `lovable-i18n/SKILL.md`) and **#63** (`manifest.json` + `vite/react-swc/lingui.setup.md`). Both were read as diffs. Neither mentions `@swc/core` *versions of the host binary as a packaging concern* — both are about the plugin-ABI floor, a different mechanism. This draft proposes no edit to those files, so there is no hunk to collide; the overlap is recorded above as context rather than resolved as a conflict.
- **Draft queue (item 58).** `pending-issues/` grepped for `@swc/core`, `swc_core`, `1.16`, `binding`, `native`. Five hits: `13-tracking-set-drift.md` (2), `15-swc-core-abi-drift.md` (14, **withdrawn**), `15-swc-pinning-guidance-stale.md` (16, filed), `17-manifest-schema-dangling.md` (1), `19-untracked-installed-and-gating-packages.md` (1). All five concern the **plugin ABI** or the **tracked-set/manifest gap**. None concerns the native addon's packaging or its load path. In particular this is **not** a re-filing of withdrawn draft 15: that draft claimed the 1.15 → 1.16 host bump broke the Wasm plugin ABI, and this run's measurement (`1.16.2`/`swc_core@78.0.0` runs plugin `6.7.0`/`77.1.1` correctly) is further evidence that the withdrawal was right.

## Sources

- npm packuments for `@swc/core` and `@swc/core-linux-arm64-gnu` (`dist.unpackedSize`, `dist.fileCount`, full `time` map), fetched 2026-09-29 ~06:20Z.
- `crates/swc_core/Cargo.toml` at `swc-project/swc` tags `v1.15.11`, `v1.15.46`, `v1.16.0`, `v1.16.1`, `v1.16.2`, `v1.16.12`, via the unauthenticated contents API.
- `crates/swc_plugin_runner/src/transform_executor.rs` and `crates/swc_common/src/plugin/mod.rs` at `v1.16.12` (and `PLUGIN_TRANSFORM_AST_SCHEMA_VERSION` at the other tags).
- `Cargo.toml` and `packages/lingui-macro/README.md` at `lingui/swc-plugin` tag `6.7.0`.
- **Executed:** two throwaway installs (`@swc/core@1.16.12` + `@lingui/swc-plugin@6.7.0`; `@swc/core@1.16.2` + the same plugin), `transform()` with the Wasm plugin on each, plus four `SWC_NATIVE_BINDING_CACHE` roots. Both trees deleted after measurement.

---

## 2026-10-11 — both open questions are answered, and the "wait" option is answered by upstream

`@swc/core` published twice in this check's window — **`1.16.17`** (2026-10-11T04:34:25.935Z) and **`1.16.18`** (06:48:29.652Z), two stable releases 2 h 14 min apart, the second four minutes before the run fired. `1.16.14`–`1.16.16` were never published. `latest` went `1.16.13` → **`1.16.18`**, and `swc_core` went `81.0.2` → **`82.0.1`** (`1.16.17`) → **`82.0.2`** (`1.16.18`) — a **major** `swc_core` bump inside a patch release of `@swc/core`.

### 1. "Does `@lingui/swc-plugin@6.7.x` still run on a `swc_core@81.0.x` host?" — **YES, and on `82.0.x` too**

This question has been carried as unmeasured for **three runs**, with the note *"neither `1.16.12`'s nor `1.16.13`'s addon loads in this sandbox, so the pairing cannot be exercised here at all"*. That was true of the **device VM**. It is not true of the **cloud container**, where `/` is `root:root` and the process runs as uid 0 — so `cache_ancestor_is_secure()`'s `owner != current && owner != 0` is false for every ancestor and the predicate passes. `require('@swc/core@1.16.18')` loads there, first try.

Measured: a real `transform()` of a `msg` macro through the Wasm plugin, one pinned host × one pinned plugin per cell, `@lingui/core@6.9.1`, 12 fresh project trees:

| host (`swc_core`) | plugin `6.6.0` | `6.7.0` | `6.7.1` |
|---|---|---|---|
| `1.16.2` (78.0.0) | ✅ | ✅ | ✅ |
| `1.16.13` (81.0.2) | ✅ | ✅ | ✅ |
| `1.16.17` (**82.0.1**) | ✅ | ✅ | ✅ |
| `1.16.18` (**82.0.2**) | ✅ | ✅ | ✅ |

**All twelve cells emit byte-identical code** — `sha256 e6e0b199755347af`, 231 bytes — and it is the real macro expansion, not a pass-through:

```js
const a = /*i18n*/ { id: "OVaF9k", message: "Hello {name}", values: { name: name } };
const b = /*i18n*/ { id: "-_luD8", message: "You have {count} items", values: { count: count } };
```

**Positive control, so that "everything passed" is readable:** the same harness FAILS on `@swc/core@1.16.2`'s predecessors — `1.14.0` + plugin `6.7.1` gives `x failed to invoke plugin on 'Some("in.tsx")'` — and PASSES at `1.15.0`. So the harness detects incompatibility, and **the floor is still exactly `@swc/core@1.15.0`**, unmoved by two `swc_core` majors. `PLUGIN_TRANSFORM_AST_SCHEMA_VERSION` is `1` at `v1.16.2`, `v1.16.13` and `v1.16.18`, which is why: the plugin ABI is keyed to the schema constant, not to `swc_core`'s own version.

**So this never becomes "a live break for five stacks."** The one question this draft said a sandbox could not answer and a laptop could in two minutes is answered, and the answer is reassuring. What remains is purely the packaging/load-path story.

### 2. "Wait, or pin?" — upstream shipped a third option

`1.16.17` added **`SWC_NATIVE_BINDING_CACHE_SKIP_SECURITY_CHECK=1`** to `secure_cache_root()` in `crates/swc_native_addon/src/platform/unix.rs`, with its own comment naming this draft's population: *"Some isolated CI executors cannot satisfy ancestor ownership or mode requirements."* Bisected across the tags — `v1.16.14`/`v1.16.15`/`v1.16.16` have **0** occurrences, `v1.16.17` has **2** — and the string is present in the **shipped** `1.16.18` stub and absent from `1.16.13`'s, so it is not source-only.

Measured on this device VM (`/` owned by `nobody`, euid 1343), `@swc/core@1.16.18` hand-built from the registry tarballs:

| | result |
|---|---|
| no variable | `Failed to load native binding`, `cause[1] ERR_SWC_NATIVE_CACHE: … user cache failed: validate cache root …; fallback cache failed: …` |
| `SWC_NATIVE_BINDING_CACHE_SKIP_SECURITY_CHECK=1` | **loads**, `transformSync('const a=1;')` → `"var a = 1;\n"` |
| `…=0` ← control | throws |
| same variable on `1.16.13` ← control | throws (**no-op**, as expected: the code does not exist there) |
| `SWC_NATIVE_BINDING_CACHE=<fresh dir>` ← control | throws, `custom cache failed: validate cache root …` |

The last row matters: **the knob the error message names is still useless**, at `1.16.18` as at `1.16.12`. This draft's original table of four rejected roots stands. The *new* variable is a different one.

`1.16.17` also added `fallback_cache_root()` — canonicalise the temp dir and retry there — which is why the error text now has two clauses (`user cache failed: …; fallback cache failed: …`) instead of one.

**Consequence for the decision this draft exists to frame:**

- **"Wait for a revert" is now evidenced against for the fifth time.** Five releases since the repackaging; the stub is still a stub (10.68 MB vs 33 MB), the predicate is unchanged, and `index.js:66` is byte-identical in all five. Upstream's answer is an opt-out, not a retreat.
- **"Pin backwards" is no longer the only remedy**, and it is now the worse of two for anyone on `>= 1.16.17`. [Draft 25](./25-next-intl-swc-native-binding-troubleshooting.md) was rewritten this run to lead with the opt-out and keep the pin scoped to `1.16.12`–`1.16.13`, where there is no opt-out.
- **This draft stays an issue, and its reason narrows to one thing: the unguarded `require("./binding")`.** The ABI fear is dead (§1). The remedy question is answered upstream (§2). What is left is that `@swc/core`'s `postinstall` installs `@swc/wasm` and `index.js:66` guarantees it is never reached — five releases running, now affecting a machine class upstream has explicitly acknowledged. **That is the upstream issue worth filing**, and it is a one-line guard.

### Stale figures corrected

- `~1.16.0` resolves to **`1.16.18`**, not `1.16.13`. (Measured: `npm i --omit=peer next-intl@4.14.9` → `@swc/core@1.16.18`.)
- `latest` is **`1.16.18`**, not `1.16.13`.
- The stub is **10 676 981** bytes unpacked on linux-x64 (`10 791 640` arm64), not `10 668 712`.
