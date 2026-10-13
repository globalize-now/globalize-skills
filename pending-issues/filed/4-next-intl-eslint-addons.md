# Add-on 2 of the next-intl setup emits a broken ESLint config on both plugin paths

**Labels:** `bug`, `skills/globalize-guide`, `next-intl`

**Severity:** Medium-high. Mitigated by the add-on defaulting to *skip* — the broken paths only fire when a user explicitly opts in. Not a silent breakage for the common case.

**File:** `skills/globalize-guide/references/languages/js-ts/libraries/next-intl/setup.add-ons.md` (Add-on 2, L148–228)

**Verified:** 2026-08-19, against `eslint-plugin-next-intl@1.3.1` and `@ts-intl/eslint-plugin-ts-intl@2.0.0` npm tarballs and the `next-intl@4.13.7` packument. Re-grep before editing if this draft is more than a few days old.

---

## Summary

Open item 4 has tracked this section since 2026-05-10 as a *staleness* problem — "prune or move to a legacy section, upstream hasn't published in ~22 months." That framing is wrong, and it undersells the issue. Staleness is not the defect. **The defect is that the instructions in this section cannot be followed as written, on either of the two plugin branches.** A user who opts in gets a lint config that hard-errors, and — if they enable the plugin's own `recommended` preset — an autofixer that rewrites working next-intl v4 code into imports removed two majors ago.

The section should be deleted, not relegated to a "legacy" heading.

## Defect 1 — the emitted rule names do not exist (L192–193, L205–206)

Both config snippets emit:

```js
'next-intl/no-missing-keys': 'error',
'next-intl/no-unused-keys': 'warn',
```

`eslint-plugin-next-intl@1.3.1` ships exactly three rules. Verified from `dist/src/index.js` in the published tarball:

| Rule | Autofix |
|---|---|
| `no-dynamic-translation-key` | — |
| `use-next-intl-link-over-next-link` | 🔧 |
| `use-router-from-next-intl` | 🔧 |

There is no `no-missing-keys` and no `no-unused-keys`, in this or any prior version. ESLint treats an unknown rule in config as a **fatal error** (`Definition for rule 'next-intl/no-missing-keys' was not found`), so the emitted config does not degrade — it fails the lint run outright. Affects the flat-config snippet (L192–193) and the legacy snippet (L205–206) identically.

## Defect 2 — the plugin caps at ESLint 8, but the section targets ESLint 9+ (L180–197)

`eslint-plugin-next-intl@1.3.1` declares:

```json
"peerDependencies": { "eslint": "^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0" }
```

No ESLint 9, no ESLint 10. Current ESLint stable is **10.8.1** (2026-08-07), so the cap is two majors behind.

Meanwhile L180 instructs the agent to detect `eslint.config.{js,mjs,cjs,ts}` — described in that same line as "flat config, ESLint 9+" — and L182–197 emits a flat-config block for exactly that case. So the section's own primary branch targets a configuration the plugin does not support. On an ESLint 9/10 project the install fails `ERESOLVE` on npm 7+ and errors by default on pnpm; it only proceeds under `--legacy-peer-deps`.

## Defect 3 — the plugin's own preset autofixes to next-intl v2 entry points

The two autofixable rules target APIs that no longer exist:

- `use-next-intl-link-over-next-link` — "Replace `next/link` imports with **`next-intl/link`**"
- `use-router-from-next-intl` — "Use `useRouter` from **`next-intl/client`**"

Both `./link` and `./client` were last present in the `next-intl` exports map at **2.22.1**, and were gone by **2.22.2** (verified by walking the exports map across every stable version in the packument). `next-intl@4.13.7` exports only `.`, `./config`, `./plugin`, `./server`, `./routing`, `./extractor`, `./middleware`, `./navigation`, and two extractor subpaths.

Every skill path pins `next-intl@^4`. So if a user follows L211 ("read the plugin's README") and adopts the documented `plugin:next-intl/recommended` preset, both rules switch on at `"error"` with autofix, and `--fix` will rewrite correct v4 `createNavigation()` imports into module specifiers that do not resolve. This is the one defect here that is actively destructive rather than merely non-functional.

## Defect 4 — the scope table misdescribes the plugin (L154)

> `eslint-plugin-next-intl` — next-intl-only; rules around static keys, missing keys, unused keys

Only "static keys" is right (`no-dynamic-translation-key`). There are no missing-key or unused-key rules — that phrase is the same hallucinated pair as Defect 1. The table also omits the two navigation rules entirely, which are the ones that matter for Defect 3.

## Defect 5 — the `@ts-intl` branch points at a preset that does not exist (L226)

> Configuration follows the plugin's documented presets — apply the `next-intl` preset specifically.

`@ts-intl/eslint-plugin-ts-intl@2.0.0` exports **no configs and no presets**. Its entry point is one line:

```js
__exportStar(require("./rules"), exports);
```

There is no `configs` key, no `recommended`, and no `next-intl` preset. The README only says the plugin is a "best fit" for next-intl in prose. Its ten rules (`no-dynamic-keys`, `no-forbidden-keys`, `no-invalid-keys`, `no-mismatch-t`, `no-missing-keys-in-other-locales`, `no-namespace-hooks`, `no-nested-call`, `no-raw-text`, `syntax-icu-json`, `syntax-icu-ts`) must each be wired up by hand.

On the peer axis this branch is fine — `eslint: ">=8.0"` is open-ended, so ESLint 9/10 resolves. It is 27.1 months since its last publish.

## Verified as NOT a defect

L185's `import nextIntl from 'eslint-plugin-next-intl'` in an ESM flat config is correct. The plugin is CJS (`export =` / `module.exports`), and Node's CJS↔ESM interop binds `module.exports` to the default import. No change needed there.

## Proposed fix

Delete the two install/config subsections (L163–228) and collapse Add-on 2 to a short factual note:

- next-intl ships no official ESLint plugin; the maintainers track it at [amannn/next-intl#1036](https://github.com/amannn/next-intl/issues/1036).
- Two community plugins exist. `eslint-plugin-next-intl` is unmaintained (last publish 2024-09-18, 23.0 months), caps at ESLint 8, and its autofixable rules target next-intl v2 entry points removed at 2.22.2 — **do not install it on a v4 project**. `@ts-intl/eslint-plugin-ts-intl` is also dormant (last publish 2024-05-16, 27.1 months) but is at least ESLint-9/10-compatible and version-agnostic w.r.t. next-intl; it ships no presets, so rules must be wired individually.
- The passive coding rules rendered into `.agents/globalize-rules.md` already cover the static-key and raw-text checks at edit time, which is the bulk of what either plugin offers.

Keeping a corrected install path for `eslint-plugin-next-intl` is not worth it: fixing the rule names (Defect 1) still leaves Defects 2 and 3, and Defect 3 has no fix short of telling users to disable two of the plugin's three rules.

For contrast, the Lingui add-on path is healthy and needs no change — `eslint-plugin-lingui@0.14.0` published 2026-06-05 (2.5 months), peers `eslint: ^8.37.0 || ^9 || ^10`.

## Scope

Contained to one file. Repo-wide grep for `no-missing-keys` / `no-unused-keys` returns hits in `setup.add-ons.md` only (L192, L193, L205, L206). No rules template, no manifest entry, and no other reference file touches this surface — so this is a prose-and-snippet edit with no passive-rule or `templateVersion` implications.

---

**Filed: https://github.com/globalize-now/globalize-skills/pull/58** (2026-08-25, ready for review). Two corrections on filing: ESLint stable is 10.9.1 (2026-08-24), not 10.8.1; and `eslint-plugin-next-intl` DOES ship `configs.all` / `configs.recommended` — which is what makes Defect 3 reachable rather than hypothetical. The no-configs finding is correct for `@ts-intl` only.
