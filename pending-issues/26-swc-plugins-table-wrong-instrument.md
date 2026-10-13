# #69 keeps the remedy its own correction withdraws — and upstream explains why the remedy cannot work

**Status:** unfiled, write path unavailable (`401 Bad credentials`, seventh consecutive check). **Shape: an amendment to [#69](https://github.com/globalize-now/globalize-skills/pull/69), not a separate PR.** Patch: `26-swc-plugins-table-wrong-instrument.patch`, against #69's head `2b0fc93`, **not** against `main`.
**Found:** 2026-09-30, second run (out-of-schedule fire), from the (F) head "six files tell a stuck user to look the host range up at <https://plugins.swc.rs>".

## The defect

#69's new compatibility paragraph says, in all five of its files:

> **do not pin the plugin backwards** — no `@lingui/swc-plugin` version runs on a host below the floor; `6.0.0` fails on `1.14.0` exactly as `6.7.0` does.

Three lines below it, in **`react-router-framework/swc/lingui.setup.md`** and **`tanstack-start/swc/lingui.setup.md`**, step 2 of the remediation list is a **context line** in #69's diff — untouched, still reading:

> 2. If the project must stay on `@vitejs/plugin-react-swc@3.x`, the plugin has to match the host's `swc_core` exactly. Look up the host's range at <https://plugins.swc.rs> and pin a `@lingui/swc-plugin` version **whose `@lingui/core` peer admits the major this project installs**. For a v6 project that means `6.0.0`-`6.1.0` (`swc_core@50.2.3`) and nothing older…

So as #69 stands, a user who hits the error is told in one paragraph that pinning the plugin backwards never helps, and in the next numbered step to go and do exactly that. Verified by reading #69's head, not its diff: `git clone --branch library-check/swc-abi-direction-sweep`, `2b0fc93`, both files carry the sentence verbatim at L36 and L39.

`lovable-i18n/SKILL.md` **is** consistent — #69 rewrote both of its occurrences and states plainly that pinning backwards is not a remedy. That is what makes the omission in the other two visible: the same author fixed it in one file and not the others.

## Why the remedy cannot work, from upstream

New this run, and it is the mechanism behind #69's build ladder rather than a restatement of it. Read from [`apps/website/docs/docs/plugin/ecmascript/compatibility.mdx`](https://github.com/swc-project/website/blob/main/apps/website/docs/docs/plugin/ecmascript/compatibility.mdx) in `swc-project/website` (reachable; `plugins.swc.rs` itself is not — see below):

1. Wasm plugin incompatibility was an **`rkyv` layout-matching** problem: serialization and deserialization logic are compiled into *both* host and plugin, so any AST field change broke old plugins.
2. **`@swc/core` v1.15.0** replaced `rkyv` with self-describing **`cbor`** and added an `Unknown` variant to every AST enum. From that release on, plugins are compatible across `@swc/core` versions "to some extent" — field deletions and type changes still break.
3. The plugin side needs exactly two things: **`swc_core >= 47`** and **`--cfg=swc_ast_unknown`** in `.cargo/config.toml`.

Measured against the plugin this repo actually installs — `lingui/swc-plugin@main`:

| condition | value | meets upstream floor |
|---|---|---|
| `Cargo.toml` `swc_core` | **`77.1.1`** | yes (≥ 47) |
| `.cargo/config.toml` `rustflags` for `cfg(target_arch = "wasm32")` | **`--cfg=swc_ast_unknown`** present | yes |

And the older builds the skills tell users to pin back to — `6.0.0`-`6.1.0`, `swc_core@50.2.3` — are **also above 47**. That is the point: the plugin side was never the variable. Pinning back to `6.0.0` on a `1.14.0` host fails because the *host* predates the cbor/extensible-enum change, which is precisely what #69 observed by build (`1.15.0` and up transform; `1.14.0` and below fail) and could not explain. **A per-version host-range lookup is the wrong instrument for a floor.**

## What the patch does

Replaces steps 2 and 3 in the two inconsistent files (one line each in, one line each out, `+2/-2` per file) so the remediation list matches #69's own finding:

- **2.** raise `@swc/core` itself — `npm install -D '@swc/core@^1.15'`, the remedy #69 already verified (`3.11.0` + `@swc/core@1.16.1` builds and transforms) — and say explicitly that pinning the plugin backwards and consulting `plugins.swc.rs` are both wrong here, with the upstream mechanism and a link to the doc above.
- **3.** was "If no such pair exists, switch to the Babel variant" — a premise that dissolves once step 2 stops being about finding a pair. Now "Only if `@swc/core` cannot be raised at all…". Numbering stays 1/2/3; no renumbering.

`remix/swc/lingui.setup.md` and `webext/swc/lingui.setup.md` are **deliberately not touched** — see `## Needs a human`.

## Verification

- `git apply --check` against #69's head `2b0fc93`: **clean**.
- `git apply --check` against `main` `f4f71a1`: **fails, as it must** — #69 rewrites adjacent lines in the same hunks. This is the evidence that it is an amendment and not a separate branch; opening it as one would conflict with #69 on both files.
- Structure after patching: code-fence counts even (64, 56), ordered list reads 1/2/3 in both files, the single surviving `plugins.swc.rs` mention per file is the new negative one.
- `evals/verify-manifest.sh` **6/0/0**, `verify-rules-template.sh` **104/0/0**, `verify-format-helpers.sh` **88/0/0**, rc 0 — run on #69's head before and after the patch, identical both times.
- `verify-string-wrapping.sh`, `verify-hard-stop.sh`, `verify-orchestration.sh`, `verify-setup.sh`, `check-behavior.sh` and `run-eval-layer-a.sh` all require `<project-dir> <fixture>`; not run. No eval in `evals/` references `needsDecision` or `swc_plugin_version_pin` (grepped), so nothing asserts on the text this touches.

## Needs a human

1. **`remix/swc/lingui.setup.md` and `webext/swc/lingui.setup.md` carry the same contradiction, and fixing them is more than a wording change.** In those two files the sentence sits inside a blockquote that ends in an orchestrator contract: `status: "needs_decision"` with `needsDecision: { step: "swc_plugin_version_pin", question: "…Raise the host plugin to ^4, pin @lingui/swc-plugin to a 6.0-6.1 build, or switch to the Babel variant?", options: ["raise_host_plugin", "pin_plugin_6_1", "abort_and_pick_babel_variant"] }`. If pinning to a 6.0-6.1 build is not a remedy, then `pin_plugin_6_1` is an option the orchestrator should not be offering, and the right replacement is probably `raise_swc_core`. That changes a protocol string, not prose. No eval asserts on it, but `setup.navigation.md`, `remix/lingui.setup.md`, `react-router-framework/lingui.setup.md`, `webext/webext-native.setup.md` and `globalize-guide/SKILL.md` all mention `needsDecision`, and whether the option set is enumerated anywhere else was **not** checked. Decide the option name, then it is a one-line change in each.
2. **#69 also edited those two files' version of the sentence and kept the backwards pin**, rewording it to "the plugin must have been built against the host's `swc_ecma_ast` (the `swc_core` numbers will not match even when the pair works)". That is a third model, and upstream's doc says the matching model in any form is the wrong frame from 1.15.0 on. Worth deciding once, for all four files, rather than per file.
3. **`plugins.swc.rs` is live; this task simply cannot read it.** `WebFetch` reaches it — `/` is titled "SWC Plugins", `/versions/range` is titled **"Compat Ranges"**, meta-description "a list of compat ranges for SWC plugins" — but the body is client-rendered from a database imported by a cron route (`apps/plugins/app/api/cron/import-ranges/route.ts` in `swc-project/website`), so no static source for the table exists in git. Both sandboxes return `000`/`403` for the host. So the (F) head "six files point at a host that has never been reached" resolves as: **not a dead pointer, but an unverifiable one that this patch argues should not be consulted for this question anyway.** The remaining four citations (`lovable-i18n/SKILL.md` ×2, `nextjs/app-router/lingui.setup.md`, `vite/react-swc/lingui.setup.md`) were not touched; the App Router one is scoped to #70 and is a genuinely different rule (a ceiling on the plugin plus a floor on Next.js).

## Sources

- **`swc-project/website`** `main`: `apps/website/docs/docs/plugin/ecmascript/compatibility.mdx` (read in full, 4877 bytes, via `api.github.com` raw); tree walked for the plugins-site sources under `apps/plugins/app/versions/range/`.
- **`lingui/swc-plugin`** `main`: `Cargo.toml` (`swc_core = "77.1.1"`), `.cargo/config.toml` (`--cfg=swc_ast_unknown`).
- **`plugins.swc.rs`**: `/` and `/versions/range` via `WebFetch` (titles and meta-descriptions only; body is client-rendered). `curl` from the device shell: `000`. Cloud container: proxy `403 CONNECT tunnel failed`.
- **#69**: metadata, body, full file list and full patch read unauthenticated; head branch `library-check/swc-abi-direction-sweep` cloned at `2b0fc93` and the two files read directly.
- **`globalize-skills`** `main` `f4f71a1`: all eight `plugins.swc.rs` citations enumerated with `grep -rn` over `skills/` (not sampled); `evals/` grepped for `needsDecision` and `swc_plugin_version_pin`.

---

## 2026-10-04 — a third reason to settle #69's sentence once, for all five files

[Draft 30](./30-swc-host-vite8-floor.md) found that `@vitejs/plugin-react-swc` added `vite@^8` to its peer range only in **`4.3.0`** (`4.0.0`-`4.2.3` peer `^4 || ^5 || ^6 || ^7`, `vite` a required peer), so the documented host floor `4.2.3` **cannot install on a Vite 8 project** — measured, `ERESOLVE`, with `4.3.0` and a Vite 7 cell as controls. And a project reaching any of these SWC references because it has `@vitejs/plugin-react@6` is necessarily on Vite 8: that package's `vite` peer is `^8.0.0` and nothing else.

This bears on item 2 of *Needs a human* above. #69's branch rewrites the same sentence to read, bolded, **"`@vitejs/plugin-react-swc >= 4.2.3` is a sufficient floor"**. Scoped to the `swc_core` ABI that is true, and #69's eleven-version build sweep is better evidence than what `main` carries. But the sentence reads as an install instruction, and on Vite 8 that install fails — so #69 landing as it stands would put a *more* authoritative form of the wrong floor on `main`.

Patch 30 targets `main` and **does not apply on `2b0fc93`** (fails at `react-router-framework/swc/lingui.setup.md:28` and `remix/swc/lingui.setup.md:23`), for the same reason this draft targets #69's branch rather than `main`. The two drafts are not in conflict; they are two corrections to one paragraph that five files duplicate. **Whoever lands #69 should settle all three at once:** the matching-vs-floor model (this draft), the `pin_plugin_6_1` option name (item 1 above), and the Vite 8 floor (draft 30). Doing them in three passes over five duplicated blocks is how the contradiction got there.
