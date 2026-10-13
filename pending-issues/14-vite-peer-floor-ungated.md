# `@lingui/vite-plugin@^6` requires Vite ≥ 6.3 — ten stacks install it with no Vite version check

**Labels:** `bug`, `globalize-guide`, `library-check`

**Severity:** Medium-high. Unlike an `engines.node` mismatch (a warning on npm), an unsatisfiable **required** peer is an `ERESOLVE` hard failure on npm ≥ 7 by default. It fires in Phase 2.0 — *after* the user has read the plan and said go.

**Verified:** 2026-08-22, from the npm packument for `@lingui/vite-plugin` (all 6.x and 5.x versions) and `skills/globalize-guide/manifest.json` @ `ac59bc3`.

---

## Summary

`@lingui/vite-plugin@6.6.0` declares:

```json
"peerDependencies": { "vite": "^6.3.0 || ^7 || ^8", ... }
"peerDependenciesMeta": { "@babel/core": {"optional": true},
                          "@lingui/babel-plugin-lingui-macro": {"optional": true},
                          "@rolldown/plugin-babel": {"optional": true},
                          "rolldown": {"optional": true} }
```

`vite` is **not** in `peerDependenciesMeta` — it is a required peer. **Vite 5 and below are excluded.**

**Ten of the twenty-three stacks install `@lingui/vite-plugin@^6`** — `manifest.json` L70, 88, 106, 127, 145, 163, 184, 202, 335, 366. That is every Lingui stack except `nextjs-app-router-lingui`.

**No Vite version gate exists anywhere in the skill.** Two greps confirm it — ASCII (`vite >=`, `"vite": "`) and Unicode (`≥`) — across `skills/globalize-guide/`. `detection.json` has no Vite version field. §1.2 checks *whether* `vite` is in devDeps (the Remix row, L248) but never *which* version.

## The floor moved in the v5 → v6 bump, and moved a long way

| `@lingui/vite-plugin` | Released | `vite` peer |
|---|---|---|
| 4.7.0 | 2024-01-05 | `^3 \|\| ^4 \|\| ^5.0.9` |
| 5.1.0 | 2024-12-06 | `^3 \|\| ^4 \|\| ^5.0.9 \|\| ^6` |
| 5.9.3 | 2026-03-13 | `^3 \|\| ^4 \|\| ^5.0.9 \|\| ^6 \|\| ^7 \|\| ^8` |
| **6.0.0** | **2026-04-22** | **`^6.3.0 \|\| ^7 \|\| ^8`** |

6.0.0 dropped three majors at once (3, 4, 5) and set a *minor*-level floor inside 6 (`^6.3.0`, so 6.0–6.2 are excluded too). The 5.x line accepted Vite 3 through 8; the 6.x line accepts 6.3 through 8.

## Why this bites in practice

The other Vite-peered packages in the manifest are permissive, so `@lingui/vite-plugin` is the binding constraint on every stack that installs it:

| Package | Manifest pin | `vite` peer | Required? |
|---|---|---|---|
| `@lingui/vite-plugin` | `^6` | `^6.3.0 \|\| ^7 \|\| ^8` | **required** |
| `@vitejs/plugin-react-swc` | `^4` | `^4 \|\| ^5 \|\| ^6 \|\| ^7 \|\| ^8` | required |
| `@vitejs/plugin-react` | `^5` | `^4.2.0 \|\| ^5 \|\| ^6 \|\| ^7 \|\| ^8` | required |
| `@intlify/unplugin-vue-i18n` | `^11` | `^6 \|\| ^7 \|\| ^8` | *optional* |
| `@inlang/paraglide-js` | `^2` | `>=5.0.0` | *optional* |

A project on Vite 5 — still a very common floor — passes every §1.2 stop, gets a plan, approves it, and then `npm install -D '@lingui/vite-plugin@^6'` fails with `ERESOLVE`. §2.0 says "If the install command fails … stop the run with the error", so the user gets a raw npm error at the point of maximum invested effort.

Package-manager behaviour differs, which makes it worse rather than better: npm ≥ 7 errors, pnpm errors by default (`strict-peer-dependencies`), Yarn Berry warns, bun warns. So on two of the four supported package managers it is a hard stop and on the other two the plugin loads against an unsupported Vite and fails later at build.

## Proposed fix

This should ship in the **same change** as the Node floor gate (open item 12) — same mechanism, different axis.

1. Add `viteVersion: string | null` to the `detection.json` schema (§1.1). §1.1 already reads `vite.config.*`; it just needs to read the version out of `package.json`/lockfile too.
2. Gate **after §1.5 resolves the variant**, not in §1.2: the floor is a property of the chosen stack. A Vite 5 project is fine on `vue-i18n` or Paraglide and broken on Lingui. §1.2 keeps only the all-candidates-fail case.
3. Derive the range from an optional `peerFloor` block in `manifest.json` (+ schema) rather than writing "Vite ≥ 6.3" into ten reference files. Hand-written prose is what produced the disjoint-range bug in item 12 and the stale `5.8.0` example in item 15.
4. Message should offer the real alternative, not just the upgrade: **`@lingui/vite-plugin@^5` accepts Vite 3 through 8**, and its line ran to 5.9.5 (2026-04-06) — two weeks *after* 6.0.0 shipped, so it is a maintained fallback rather than an abandoned one. "Upgrade to Vite ≥ 6.3, or pin `@lingui/vite-plugin@^5`" is a materially better stop than "upgrade Vite".

Explicitly **not** proposed: loosening the manifest pin to `^5 || ^6`. That would split every Lingui reference file down a version branch for a constraint that a detection gate can resolve once.

## Verification

- npm packument for `@lingui/vite-plugin`, every non-prerelease version, `peerDependencies.vite` + `peerDependenciesMeta` (queried 2026-08-22).
- Same for `@vitejs/plugin-react`, `@vitejs/plugin-react-swc`, `@intlify/unplugin-vue-i18n`, `@inlang/paraglide-js`.
- `manifest.json` `stacks[].packages.dev` — ten occurrences enumerated above.
- `grep -rniE 'vite (>=|>= )|"vite": "' skills/globalize-guide/ | grep -viE 'vitejs|vitest'` → 0 hits. `grep -rn '≥' skills/globalize-guide/ --include=*.md | grep -i vite` → only Remix `@remix-run/dev ≥ 2.7` rows, no Vite version.
- `SKILL.md` §1.1 schema block and §1.2 (L233–298) read in full.

---

Filed: https://github.com/globalize-now/globalize-skills/pull/64 (2026-08-26, **draft**) — shipped together with item 12 as the draft itself instructed, since both add the same `requires[]` mechanism to the same three files. Correction on filing: the draft's peer table listed `@vitejs/plugin-react` at `^4.2.0 || ^5 || ^6 || ^7 || ^8` for `latest`; `latest` is now **6.1.0**, which peers `vite ^8.0.0` **only**. The manifest pins `^5` deliberately (v6 dropped `babel.plugins`), so the correct range — read at the resolved version rather than at `latest` — is the one the draft had, but for the wrong reason. Everything else in the draft held at the resolved pins.
