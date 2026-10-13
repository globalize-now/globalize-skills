# The SWC plugin pinning guidance is premised on a regime that ended at `@swc/core` 1.15.0 — and both versions it names as remediation now fail to install

**Labels:** `bug`, `docs`, `globalize-guide`, `library-check`

**Severity:** Medium-high. Two of the three findings are certain and checkable from package metadata; the third is a missing floor with one concretely exposed stack.

**Verified:** 2026-08-23. **Supersedes** the 2026-08-22 draft `15-swc-core-abi-drift.md`, whose headline claim is withdrawn — see "Correction" below. Closes **open item 3** ("re-verify `@lingui/swc-plugin` swc_core ABI compat through 6.6.0", open since 2026-04-25).

---

## Correction to the 2026-08-22 draft

Yesterday's draft claimed that `@swc/core` crossing 1.15 → 1.16 put `@lingui/swc-plugin@6.6.0`'s Wasm on the wrong side of an ABI boundary, and flagged one step as deliberately unverified: *"whether swc_core's plugin ABI actually broke between the 1.15 and 1.16 lines … someone should check <https://plugins.swc.rs>."*

Checked. **It did not, and 1.15 is the version where this class of breakage stopped rather than started.**

- SWC announced a stable Wasm plugin ABI **starting at `@swc/core` v1.15.0** ([blog, 2025-11-04](https://blog.swc.rs/2025-11-4-wasm-backward-compatibility)). The rkyv serialization scheme — which required the host and plugin AST memory layouts to match exactly — was replaced with **cbor**, which is self-describing, and every AST enum gained an `Unknown` variant. "A Wasm plugin compiled against v1.15.0 will now work seamlessly with future versions of SWC."
- `@lingui/swc-plugin` adopted it at **5.10.1**, and **6.2.0 onward builds against `swc_core@66.0.3`** ([compatibility table](https://github.com/lingui/swc-plugin/tree/main/packages/lingui-macro#compatibility)). `swc_core@66` is far past the `swc_core >= 47` threshold the scheme requires.
- So `6.6.0` on a `@swc/core@1.16.1` host is the *forward* direction, which is exactly what the guarantee covers.

**Why the draft got it wrong, and the method note that follows.** It read `@lingui/swc-plugin@6.6.0`'s `devDependencies["@swc/core"] = "^1.15.33"` and treated it as the build ABI. It is not. `@swc/core` is the **JS wrapper** used to test the plugin; `swc_core` is the **Rust crate** the Wasm is actually compiled against, and it is not present in any npm metadata. The two version lines are unrelated (`swc_core@66.0.3` ↔ `@swc/core@~1.15.33`). *A Rust-crate ABI constraint cannot be read out of an npm packument — the registry is the wrong source for the question, and no amount of care with it would have produced the right answer.*

Residual risk from SWC's own docs, and it is small: the cbor scheme "does not resolve all compatibility issues, such as those caused by field deletions or changes in field types," and Lingui's [issue #179](https://github.com/lingui/swc-plugin/issues/179) notes they have not yet tested the new scheme against a release that actually changed the AST layout. That is a watch item, not a live break.

---

## Finding 1 (certain) — both documented remediation pins are unsatisfiable in the stacks that cite them

Six reference files carry a "version pinning" note telling the user, on a build failure, to pin `@lingui/swc-plugin` to an exact old version. Every one of those pins now conflicts with the `@lingui/*` majors the same stack installs:

| File | Line | Pin recommended | That version's required peer | Stack installs |
|---|---|---|---|---|
| `frameworks/vite/react-swc/lingui.setup.md` | 25 | `@lingui/swc-plugin@5.8.0` | `@lingui/core: "5"` | `@lingui/core@^6` |
| `frameworks/tanstack-start/swc/lingui.setup.md` | 31 | `@lingui/swc-plugin@5.8.0` | `@lingui/core: "5"` | `@lingui/core@^6` |
| `frameworks/remix/swc/lingui.setup.md` | 23 | `@lingui/swc-plugin@5.8.0` | `@lingui/core: "5"` | `@lingui/core@^6` |
| `frameworks/react-router-framework/swc/lingui.setup.md` | 28 | `@lingui/swc-plugin@5.8.0` | `@lingui/core: "5"` | `@lingui/core@^6` |
| `frameworks/webext/swc/lingui.setup.md` | 92 | `@lingui/swc-plugin@5.8.0` | `@lingui/core: "5"` | `@lingui/core@^6` |
| `frameworks/nextjs/app-router/lingui.setup.md` | 24 | `@lingui/swc-plugin@4.0.8` | `@lingui/macro: "4"` | `@lingui/core@^6`, no `@lingui/macro` at all |

`@lingui/core` is **not** in `5.8.0`'s `peerDependenciesMeta` (which lists only `next` and `@swc/core`), so it is a **required** peer — `ERESOLVE` on npm ≥ 7 and on pnpm. The `4.0.8` row is worse: its required peer is `@lingui/macro@4`, a package the Next.js stack does not install in any version.

The shape of the bug is what makes it worth fixing rather than tweaking: **the repo's documented remediation for an install-or-build failure is itself an install failure.** A user who hits the gotcha, follows the instruction, and hits a second error has no path forward from the reference alone. Two of the six (`remix/swc`, `webext/swc`) at least route to `status: "needs_decision", step: "swc_plugin_version_pin"` rather than asking the reader to guess, which limits the blast radius there; the other four just tell the user to run the command.

## Finding 2 (certain) — the premise of all six notes is four majors out of date

Every one of the six says some form of:

> `@lingui/swc-plugin` must match the `swc_core` version shipped by `@vitejs/plugin-react-swc`.

That was true through `@lingui/swc-plugin@5.10.0` / `@swc/core@1.14.x`. Since the cbor ABI it is no longer the rule, and the advice it generates — *pin the plugin backwards* — moves the user **out** of the compatible-by-construction regime and into the brittle one. `5.8.0` is built with `swc_core@45.0.2`, below the `>= 47` threshold, so it is version-locked to a narrow host range in the way the note describes; `^6` is not.

The `plugins.swc.rs` lookup the notes point at is still correct **for genuinely old runtimes** (Next.js shipping a pre-1.15 `swc_core`, an unupgradable pinned `@swc/core`). It should stay, as the fallback, rather than being the first instruction.

## Finding 3 (a real gap, one stack) — no host floor, and the one stack that needs it most doesn't install a host

Backward compatibility is **forward-only**: a plugin built at `swc_core@66.0.3` needs a host at `swc_core >= 66.0.3`, i.e. roughly **`@swc/core >= 1.15.33`**. Below that, the original layout mismatch is still live.

Of the six SWC stacks:

- Four (`tanstack-start-swc-lingui`, `remix-swc-lingui`, `react-router-framework-swc-lingui`, `webext-swc-lingui`) install `@vitejs/plugin-react-swc@^4`, whose `4.3.3` depends on `@swc/core@^1.15.46`. Safely above the floor.
- `nextjs-app-router-lingui` uses Next's bundled SWC — separate question, genuinely needs `plugins.swc.rs`.
- **`vite-swc-lingui` installs `@lingui/swc-plugin@^6` and no host at all**, inheriting whatever `@vitejs/plugin-react-swc` the project already has. `@vitejs/plugin-react-swc` only reaches the floor at **4.2.3** (`@swc/core@^1.15.11`, and 4.3.2 → `^1.15.46`). The whole 3.x line sits below it — `3.11.0` is `@swc/core@^1.12.11`, `3.8.1` is `^1.11.11`. A Vite project on `@vitejs/plugin-react-swc@3.x` — an entirely ordinary thing to find — gets `@lingui/swc-plugin@^6` against a pre-cbor host and a guaranteed layout mismatch.

Nothing in the skill checks this. `grep -rn '@swc/core' skills/globalize-guide/` returns **zero hits** in any notation.

## Proposed fix

1. **Rewrite the pinning note in all six files.** New content: `^6` is compatible with any host at `@swc/core >= 1.15.33` / `@vitejs/plugin-react-swc >= 4.2.3`, because SWC's Wasm plugin ABI has been backward-compatible since `@swc/core@1.15.0`. Only if the host is *older* than that does the `plugins.swc.rs` lookup apply.
2. **Delete both exact-pin examples** (`5.8.0`, `4.0.8`). If a worked example is wanted, it must be one whose `@lingui/core` peer admits `6` — and as of today no `@lingui/swc-plugin@5.x` does. Better to name the *rule* (match the plugin's `@lingui/core` peer to the installed major) than any version.
3. **Add a host floor to `vite-swc-lingui`.** Either detect `@vitejs/plugin-react-swc` in the project and stop at §1.2 if it is `< 4.2.3`, or add it to the stack's `dev` packages at `^4` as the other four stacks do. The second is simpler and matches the sibling stacks; the first is safer if the project has a reason to be on 3.x.
4. **Keep `@swc/core` in the tracked set** (added 2026-08-22, currently 1.16.1) — but retarget the tripwire. The interesting event is no longer a minor bump; it is a *`swc_core` major* in `@lingui/swc-plugin`'s compatibility table, or an SWC release note mentioning an AST field deletion or type change. Neither is visible in npm metadata, which is the point of Finding 1's method note.

## Sources

- <https://blog.swc.rs/2025-11-4-wasm-backward-compatibility> — stable ABI from `@swc/core` v1.15.0.
- <https://swc.rs/docs/plugin/ecmascript/compatibility> — rkyv → cbor, `Unknown` enum variants, `swc_core >= 47` + `--cfg=swc_ast_unknown`, and the stated limits (field deletions / type changes).
- <https://github.com/lingui/swc-plugin/issues/179> — Lingui's own compatibility explanation, with the `swc_core@47` note added at the top.
- <https://github.com/lingui/swc-plugin/tree/main/packages/lingui-macro#compatibility> — plugin → `swc_core` table; `5.10.1`~`6.1.0` = `50.2.3` + `swc_ast_unknown`, `6.2.0`~* = `66.0.3`.
- npm packuments for `@lingui/swc-plugin` (`peerDependencies` / `peerDependenciesMeta` per version) and `@vitejs/plugin-react-swc` (`dependencies["@swc/core"]` across the 3.x/4.x lines), queried 2026-08-23.
- Local repo @ `ac59bc3`: `skills/globalize-guide/manifest.json`, the six `*/lingui.setup.md` files cited above.

---

Filed: https://github.com/globalize-now/globalize-skills/pull/62 (2026-08-26) — findings 1 and 2, ready for review. Corrections on filing: the six file/line references had all shifted (#57 landed above them), and the candidate set was **incomplete** — a seventh occurrence of the same note lives in `skills/lovable-i18n/SKILL.md` L166 + L1333, outside the `skills/globalize-guide/` scope the draft grepped. Fixed in the same PR. Finding 3 was split out to PR #63 because its fix carries a judgement call the other two do not.
