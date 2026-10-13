# The Node floor gate covers only Lingui, fires only at §2.0, and is hand-written rather than derived

> **CORRECTED 2026-08-22.** The 2026-08-21 version of this draft claimed the skill "states no Node requirement anywhere" and cited a repo-wide grep returning zero hits. **That claim was false.** A Lingui-specific Node gate has existed at `SKILL.md` §2.0 L480 since **2026-06-05** (commit `12e34d08`). The 2026-08-21 grep missed it because it searched for ASCII `>=` while the repo writes the Unicode `≥`. The issue is real but much narrower than first written, and the severity drops from Medium to **Low-medium**. Counts below are also restated against the 23-stack manifest at `ac59bc3` (#55 landed three new stacks on 2026-08-20, after the original draft was written).

**Labels:** `enhancement`, `skills/globalize-guide`, `manifest`

**Severity:** Low-medium. A gate exists and covers the highest floor (Lingui, `>=22.19.0`, 11 of 23 stacks). What is missing is coverage of the three Vue stacks, placement early enough to matter, and derivation from the manifest instead of prose.

**Verified:** 2026-08-22, against the npm packuments for every package named in `skills/globalize-guide/manifest.json` at the versions the manifest's caret pins resolve to today. Re-grep before editing if this draft is more than a few days old.

---

## Summary

`skills/globalize-guide/manifest.json` installs 17 distinct npm packages across 23 stacks. **Fourteen stacks install at least one package declaring an `engines.node` floor.** The highest is `>=22.19.0`, on the `@lingui/*` v6 packages — which is to say, on **all eleven Lingui stacks**.

The skill *does* gate on this, at `SKILL.md` §2.0 L480:

> **Lingui (v6+) requires Node ≥ 22.19 or ≥ 24** — it ships ESM-only and fails to load on older Node. If the resolved stack installs `@lingui/*`, check the project's Node version (`node -v`, plus any `.nvmrc` / `engines` field) before installing. If it's older, tell the user and pause rather than installing a runtime they can't run.

Three gaps remain:

1. **Lingui only.** `vite-vue-i18n` and `quasar-vue-i18n` carry `>= 22.13` from `@intlify/unplugin-vue-i18n@^11`, and `nuxt-vue-i18n` carries `>= 22` transitively. Nothing checks those. This is exactly open item 1, still unaddressed.
2. **Too late.** §2.0 runs *after* §1.12's final go. Every other version constraint in the skill — `@sveltejs/kit < 2.3`, `@remix-run/dev < 2.7`, Remix v1, CRA, MV2 — is a §1.2 hard-stop that fires before the user invests in a plan. The Node check is the one that makes the user approve a plan first and then get told to stop.
3. **Prose, not derived.** "Node ≥ 22.19 or ≥ 24" is hand-typed and pinned to Lingui's floor as of 2026-06-05. It cannot track a floor change, and it cannot express the disjoint range shape (see `@vitejs/plugin-react{,-swc}` below). `detection.json` (§1.1) has no `nodeVersion` field, so a §1.2 row could not gate on it even if one were written.

This issue **supersedes open item 1** (2026-05-29, "Add a Node ≥ 22.13 detection gate to the Vue i18n setup references"), which is the same defect scoped to three Vue stacks. Item 1's claims were re-audited today and all hold; see "Item 1 is correct and too narrow" below.

## The floors, per stack

Resolved from each stack's `packages.runtime` + `packages.dev` at the version each caret pin resolves to on 2026-08-21.

| Stacks | Effective Node floor | Set by |
|---|---|---|
| All 11 Lingui stacks (`nextjs-app-router-lingui`, `vite-{swc,babel}-lingui`, `tanstack-start-{babel,swc}-lingui`, `remix-{babel,swc}-lingui`, `react-router-framework-{babel,swc}-lingui`, and — new in #55 — `webext-{babel,swc}-lingui`) | **`>=22.19.0`** | `@lingui/*@^6` → 6.6.0 |
| `vite-vue-i18n`, `quasar-vue-i18n` | **`>=22.13`** | `@intlify/unplugin-vue-i18n@^11` → 11.2.5 |
| `nuxt-vue-i18n` | **`>= 22`** (transitive — see below) | `@nuxtjs/i18n@^10` → 10.6.0 → `vue-i18n@^11.4.8` |
| `nextjs-app-router-next-intl`, `nextjs-pages-router-next-intl`, `sveltekit-paraglide` | none | `next-intl`, `@inlang/paraglide-js` declare no `engines` |
| `rails-yaml`, `android-strings`, 3 × iOS, `webext-native-messages` | n/a | no npm packages |

Raw declarations at current `latest`:

| Package | Pin | Resolves to | `engines.node` |
|---|---|---|---|
| `@lingui/core`, `cli`, `react`, `detect-locale`, `vite-plugin`, `babel-plugin-lingui-macro`, `format-po` | `^6` | 6.6.0 | `>=22.19.0` |
| `@lingui/swc-plugin` | `^6` | 6.6.0 | *(none)* |
| `@intlify/unplugin-vue-i18n` | `^11` | 11.2.5 | `>= 22.13` |
| `vue-i18n` | `^11` | 11.4.8 | `>= 22` |
| `@nuxtjs/i18n` | `^10` | 10.6.0 | `>=20.11.1` |
| `@vitejs/plugin-react-swc` | `^4` | 4.3.3 | `^20.19.0 \|\| >=22.12.0` |
| `@vitejs/plugin-react` | `^5` | 5.2.0 | `^20.19.0 \|\| >=22.12.0` |
| `next-intl`, `@inlang/paraglide-js`, `intl-messageformat` | — | — | *(none)* |

Two details worth calling out:

**`@vitejs/plugin-react{,-swc}` declares a disjoint range, not a floor.** `^20.19.0 || >=22.12.0` excludes **all of Node 21 and Node 22.0–22.11**. A project on Node 22.5 reads "Node 22, fine" and is wrong. On the three SWC Lingui stacks this is subsumed by Lingui's `>=22.19.0`, so it costs nothing there — but the range is the kind of thing a hand-written "requires Node 22+" note would get wrong, which is an argument for deriving the gate from the manifest rather than writing it as prose.

**`nuxt-vue-i18n`'s own declaration understates its real floor.** `@nuxtjs/i18n` 10.6.0 declares `>=20.11.1`, but depends on `vue-i18n@^11.4.8`, and every `vue-i18n` ≥ 11.4.3 declares `>= 22`. So the stack's effective floor is `>= 22` regardless of what `@nuxtjs/i18n` says. This got *stronger* recently: 10.4.1 depended on `vue-i18n@^11.4.0`, a range that still admitted 11.4.2 (`engines: >= 16`); 10.6.0's `^11.4.8` does not. The transitive floor is now unconditional.

## What the user actually sees

Depends on package manager, which is why this is medium and not high:

- **npm** — `EBADENGINE` warning, install proceeds. Becomes a hard failure with `engine-strict=true` in `.npmrc`.
- **pnpm / Yarn Berry** — surfaced per their own strictness settings; both can be configured to fail the install.
- **bun** — ignores `engines`.

So on a default npm project the install "works" and the problem lands later, at `lingui extract` or at build. That is the worst shape for a user: the skill reports success, then something unrelated-looking breaks two phases downstream. §1.2 exists precisely to move failures like this to the front.

## Proposed fix

Three parts, smallest first. **Ship this together with item 14** (the ungated `@lingui/vite-plugin@^6` → Vite ≥ 6.3 peer floor) — same mechanism, different axis, and item 14 is the higher-severity of the two.

1. **Add `nodeVersion` to `detection.json`** (§1.1). Read `process.version` on the main thread; also record `engines.node` from the target's own `package.json` if present, since that is what the user's CI will enforce.

2. **Add a §1.2 row.** Suggested shape — a warn, not a stop, since npm will proceed and the user may be intending to bump Node anyway:

   > `language === "js-ts"` AND `nodeVersion` does not satisfy the resolved stack's floor → **Warn (non-blocking):** "This stack installs {package}@{pin}, which requires Node {range}. You're on Node {detected}. The install may warn or fail depending on your package manager, and `lingui extract` will not run. Upgrade Node to {range}, or pick a stack without that floor. Proceeding."

   It has to run **after** §1.3/§1.5 resolve the variant, because the floor is a property of the chosen stack, not of the project — a Next.js project on Node 20 is fine on next-intl and broken on Lingui. That makes it a §1.5-adjacent check rather than a literal §1.2 row; §1.2 can hold the generic "no supported stack clears your Node version" stop for the case where *every* candidate is out of reach.

3. **Derive the floor from the manifest, don't hand-write it.** Add an optional `nodeFloor` per stack in `manifest.json` (+ `manifest.schema.json`), or compute it at check time, and replace the §2.0 L480 prose with the derived value. The existing note is the argument for this: it is already one Lingui minor away from being wrong, it silently excludes the Vue stacks, and it cannot express `^20.19.0 || >=22.12.0`. The `5.8.0` remediation example in item 15 is the same failure mode in a different file — a hardcoded version in a file nothing version-checks.

Deliberately **not** proposed: adding `engines` to anything the skill *emits*. This is about gating the install, not about constraining the user's app.

## Scope

- `skills/globalize-guide/SKILL.md` — §1.1 detection schema, §1.2 / §1.5 gate
- `skills/globalize-guide/manifest.json` + `manifest.schema.json` — optional `nodeFloor`
- Setup references for the 14 affected stacks — only if the gate is *not* manifest-derived

## Item 1 is correct and too narrow

Open item 1 was audited today under the claim-staleness trigger. Its path (`libraries/vue-i18n/setup.shared.md`) is intact, the vite/vue, quasar and nuxt setup files it names all exist, and every upstream claim holds — and now holds through versions later than the ones it cites:

| Item 1 claim | Verdict |
|---|---|
| `vue-i18n@11.4.3+` sets `engines.node >= 22` | **Confirmed, and the boundary is exact** — 11.4.2 (2026-05-07) = `>= 16`; 11.4.3 (2026-05-17) = `>= 22` |
| `@intlify/unplugin-vue-i18n@11.2.x` sets `>= 22.13` | **Confirmed**, and still `>= 22.13` at 11.2.5 (2026-08-14), one version past the item's stamp |
| Floor unchanged by the 11.4.7 patch | **Still true at 11.4.8** (2026-07-26) — item's re-confirmation stamp is one version stale, the claim is not |
| `@nuxtjs/i18n` declares only `node>=20.11.1`, inherits `>= 22` via `vue-i18n` | **Confirmed at 10.6.0**, and now stronger — the dep tightened `^11.4.0` → `^11.4.8`, removing the 11.4.2 escape hatch |

Recommendation: close item 1 into this issue rather than fixing it separately. Item 1 is now the *sharpest* part of this issue rather than a narrower duplicate of it: the eleven Lingui stacks are covered by the §2.0 note, and the three Vue stacks item 1 names are precisely the ones that are not covered by anything.

---

Filed: https://github.com/globalize-now/globalize-skills/pull/64 (2026-08-26, **draft**) — with item 14, per this draft's own "ship together" instruction. All floors re-verified at the versions the manifest pins resolve to today, including `vue-i18n@11.4.10`, published during this run's window, whose `engines.node` is unchanged at `>= 22`. Draft rather than ready: §1.5a's placement, whether the §2.0 Lingui prose should now be deleted, and whether a `stop` row should be overridable are design decisions, listed under `## Needs a human`.
