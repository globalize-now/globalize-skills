> ## ⛔ SUPERSEDED 2026-08-23 — DO NOT FILE
>
> The headline claim below is **wrong** and has been withdrawn. The unverified step it flagged
> ("check <https://plugins.swc.rs> before treating this as a live break") was checked on 2026-08-23:
> SWC's Wasm plugin ABI has been **backward-compatible since `@swc/core` v1.15.0**, and
> `@lingui/swc-plugin@6.2.0+` builds against `swc_core@66.0.3`, well inside that window.
> The 1.15 → 1.16 host bump breaks nothing.
>
> The draft mistook `devDependencies["@swc/core"]` (the JS test host) for the build ABI;
> the real constraint is the Rust crate `swc_core`, which npm metadata does not expose.
>
> **File [`15-swc-pinning-guidance-stale.md`](./15-swc-pinning-guidance-stale.md) instead** — it keeps
> the two findings from this draft that survived (the stale `5.8.0` remediation example, and the
> tracked-set tripwire) and replaces the ABI claim with three checkable ones.
>
> Retained only as the record of the correction. See [`../2026-08-23.md`](../2026-08-23.md).

---

# `@swc/core` crossed 1.15 → 1.16 upstream; `@vitejs/plugin-react-swc@^4` floats into it while `@lingui/swc-plugin@6.6.0` was built against 1.15

**Labels:** `bug`, `globalize-guide`, `library-check`

**Severity:** Medium-high, and **unverifiable from package metadata alone** — see "What is and isn't established" below. Five stacks are exposed. If the ABI did break, the failure is a build-time `failed to invoke plugin` on a fresh install, with nothing in the install output pointing at the cause.

**Verified:** 2026-08-22. Answers **open item 3** ("re-verify `@lingui/swc-plugin` swc_core ABI compat through 6.6.0"), open since 2026-04-25 and never audited until now.

---

## Summary

`@lingui/swc-plugin` ships a prebuilt Wasm binary (`"main": "./lingui_macro.wasm"`). SWC Wasm plugins are compiled against a specific `swc_core` and are only loadable by a host whose `swc_core` matches that ABI. The plugin therefore has a hidden coupling to whatever `@swc/core` the host resolves.

The two sides have now drifted across a minor boundary:

| | Resolves to | `@swc/core` |
|---|---|---|
| `@lingui/swc-plugin@6.6.0` (2026-07-24) | the Wasm in the tarball | built against `@swc/core` **`^1.15.33`** (its `devDependencies` at build time) |
| `@vitejs/plugin-react-swc@4.3.3` | the host | `"dependencies": { "@swc/core": "^1.15.46" }` |

`^1.15.46` is `>=1.15.46 <2.0.0`. `@swc/core` published **1.16.0 on 2026-08-14** and **1.16.1 on 2026-08-19**. So a *fresh install today* resolves the host to `@swc/core@1.16.1` while the plugin's Wasm was built on the 1.15 line. Yesterday it did not; the boundary was crossed eight days ago and this check did not notice because `@swc/core` is not in the tracked set (see item 13 — same class of blind spot).

**Five stacks are exposed, four of them explicitly.** `manifest.json` L127 (`tanstack-start-swc-lingui`), L163 (`remix-swc-lingui`), L202 (`react-router-framework-swc-lingui`) and L366 (`webext-swc-lingui`) install **both** packages. L70 (`vite-swc-lingui`) installs `@lingui/swc-plugin@^6` and inherits the host from whatever `@vitejs/plugin-react-swc` is already in the project — the same exposure, with one less variable the manifest controls. A sixth, `nextjs-app-router-lingui` (L11), pairs against Next.js's bundled SWC instead and is out of scope for this issue.

## What is and isn't established

**Established:** the version drift above, and that npm cannot warn about it. `@lingui/swc-plugin@6.6.0` declares `peerDependencies: { "@lingui/core": "5 || 6" }` — `@swc/core` appears only in `peerDependenciesMeta` (`{"@swc/core": {"optional": true}, "next": {"optional": true}}`) **with no corresponding `peerDependencies` entry**, which is a no-op. There is no `engines` field. So no package manager, at any strictness setting, can flag this.

**Not established:** whether swc_core's plugin ABI actually broke between the 1.15 and 1.16 lines. swc bumps the plugin ABI on its own schedule, not on every minor. I could not verify this from registry metadata, and did not attempt to build. **Someone should check <https://plugins.swc.rs> for the 6.6.0 / 1.16.x pair before this is treated as a live break.** If the ABI held, this issue reduces to the tripwire in "Proposed fix" item 3.

## Secondary finding: the remediation example is stale in all five SWC references

The repo already documents this exact failure mode and its fix. Every instance gives a **v5** version as the worked example while the manifest pins `^6`:

| File | Line | Example given |
|---|---|---|
| `frameworks/react-router-framework/swc/lingui.setup.md` | 28 | `@lingui/swc-plugin@5.8.0` |
| `frameworks/vite/react-swc/lingui.setup.md` | 25 | `@lingui/swc-plugin@5.8.0` |
| `frameworks/tanstack-start/swc/lingui.setup.md` | 31 | `@lingui/swc-plugin@5.8.0` |
| `frameworks/remix/swc/lingui.setup.md` | 23 | `@lingui/swc-plugin@5.8.0` |
| `frameworks/webext/swc/lingui.setup.md` | 92 | `@lingui/swc-plugin@5.8.0` |

The last of these landed **two days ago** in #55 (2026-08-20) — the stale example was copied forward into new code. A user following it verbatim downgrades across a major, into a plugin whose `@lingui/core` peer is `5 || 6` (so it installs) but which targets the v5 macro surface.

Two of the five (`remix/swc`, `webext/swc`) do the right thing structurally: they instruct the subagent to emit `status: "needs_decision"` with `step: "swc_plugin_version_pin"` rather than guessing. The other three just tell the reader to go look it up.

## Proposed fix

1. **Check the pair.** Confirm at <https://plugins.swc.rs> whether `@lingui/swc-plugin@6.6.0` is compatible with `@swc/core` 1.16.x. If not, this becomes urgent for five stacks.
2. **Replace the `5.8.0` example in all five files** with the current compatible 6.x version, or — better — with no version at all: "pin the version the compatibility table gives for your `@swc/core`". A worked example with a hardcoded version in a file that is not version-checked will go stale again.
3. **Add `@swc/core` to the daily check's tracked set** with an explicit note that the interesting event is a *minor* bump, not a major. This is the tripwire; it is what would have caught 1.16.0 on 2026-08-14.
4. **Give the other three references the `needs_decision` treatment** that `remix/swc` and `webext/swc` already have, so the failure routes to the orchestrator instead of to a link.

Applied this run: `@swc/core` added to `library-checks/.last-versions.json` at 1.16.1 so tomorrow's diff sees the next move.

## Verification

- npm packuments (queried 2026-08-22): `@lingui/swc-plugin` (6.0.0 → 6.6.0, `main`, `peerDependencies`, `peerDependenciesMeta`, `devDependencies`, `engines`), `@vitejs/plugin-react-swc@4.3.3` (`dependencies`), `@swc/core` (`time` map for the 1.15/1.16 lines, `dist-tags.latest` = 1.16.1).
- `manifest.json` — six `@lingui/swc-plugin@^6` occurrences at L11, 70, 127, 163, 202, 366; `@vitejs/plugin-react-swc@^4` at L127, 163, 202, 366.
- `grep -rn '5\.8\.0' skills/globalize-guide/` → the five reference lines tabulated above.
- `git show --stat 29dcd05` confirms `frameworks/webext/swc/lingui.setup.md` is new in #55 (2026-08-20).
