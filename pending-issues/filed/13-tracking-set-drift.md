# The daily library check tracks a package the skills don't install, and misses two they do

**Labels:** `chore`, `tooling`, `library-check`

**Severity:** Medium-low. No user-facing breakage. It is a monitoring hole: two packages the skills install are outside the daily check's field of view, so a breaking release in either would land silently.

**Verified:** 2026-08-21; **re-run and extended 2026-08-22** against the post-#55 manifest (`ac59bc3`, 23 stacks), which added two more untracked packages.

---

## Summary

The daily `library-check` task tracked 21 npm packages. `manifest.json` installs 17. The two sets are not nested — they cross:

| Package | In manifest | Tracked | Note |
|---|---|---|---|
| `@lingui/format-po` | ✅ `^6`, 6 stacks | ❌ | Untracked, actively installed. **Added to baseline 2026-08-21.** |
| `@vitejs/plugin-react` | ✅ `^5`, 1 stack | ❌ | Untracked, actively installed. **Added to baseline 2026-08-21.** |
| `babel-plugin-macros` | ✅ `^3`, 1 stack (`webext-babel-lingui`, new in #55) | ❌ | **Untracked, actively installed. Added to baseline 2026-08-22.** |
| `@swc/core` | ⚠️ transitive, 5 stacks | ❌ | **Untracked, and the ABI counterpart of `@lingui/swc-plugin` — see item 15. Added to baseline 2026-08-22.** |
| `@lingui/format-po-gettext` | ❌ | ✅ | **Tracked, referenced nowhere in `skills/`** |

### The 2026-08-22 re-run is the argument for the structural fix

The original draft was written against a 20-stack manifest. #55 landed on 2026-08-20 and was pulled into the working clone at 20:50 that evening — *after* the 2026-08-21 run read the tree. So the very next day, a set that had just been reconciled was stale again, by exactly the mechanism the draft describes: a new stack shipped a new package (`babel-plugin-macros@^3`) and nothing told the check about it.

`@swc/core` is the more expensive miss. It is not in `manifest.json` at all — it arrives transitively through `@vitejs/plugin-react-swc@^4`'s `"@swc/core": "^1.15.46"` — and it is the package whose version determines whether `@lingui/swc-plugin`'s prebuilt Wasm loads. It crossed 1.15 → 1.16 on 2026-08-14 and this check did not see it. A manifest-only reconciliation would still not have caught it; the rule needs to include **direct dependencies of manifest packages that the skill's own prose treats as a compatibility constraint**.

`grep -rn 'format-po-gettext' skills/` returns nothing. `@lingui/format-po` — a different package — appears in `manifest.json` at L145/163/184/202 and is documented at length in the Remix setup references. This looks like a straight substitution error in the tracked set: the wrong sibling package got entered, and nobody noticed because both live on the same `@lingui/*` release train and move in lockstep, so the tracked one's version number always looked plausible.

## Why it matters now

`@vitejs/plugin-react` published **6.1.0 on 2026-08-20T02:49Z**. That is before yesterday's run, and yesterday's run reported "zero publishes across all 21 tracked packages" — correctly, within its own scope, because this package is not one of the 21.

6.1.0 is not itself actionable: the manifest pins `^5` **deliberately**, and the reason is documented in `frameworks/react-router-framework/lingui.setup.md` L28 — v6 dropped the `babel.plugins` option that Lingui's Babel macro transform depends on. So the pin is doing its job. But the daily check is structurally unable to tell us that, which is the point: the v5 line is at 5.2.0 (2026-03-12) and has not moved in five months. If it were abandoned, or if it took a security patch, or if v7 changed the babel calculus, the check would not notice.

`@lingui/format-po` is currently at 6.6.0 (2026-07-24), same as its tracked siblings — the lockstep that hid the error.

## Fix

1. In `library-checks/.last-versions.json`, add `@lingui/format-po` and `@vitejs/plugin-react` to `packages`.
2. Decide on `@lingui/format-po-gettext`: drop it, or keep it and document why a package no skill installs is worth watching. (It is a real package and a plausible future choice for a Rails/PO overlay, so keeping it is defensible — but it should be labelled as prospective, not implied to be in use.)
3. **Add a drift check to the task itself.** Every run should diff `manifest.json`'s package set against the tracked set and report any package in one and not the other. This is a five-line check and it is the only reason this issue exists — the drift has been present since at least the `#49`/`#50` restructure and no calendar-based audit would have found it.

`@vitejs/plugin-react` needs one wrinkle: the tracked field stores a single `latest`, but the manifest pin is `^5` and `latest` is `6.1.0`. Either store the max-satisfying version for the pin rather than `latest`, or store both. The pin-relevant line is what matters for this package, and the same will be true of any other deliberately-held-back pin.

## Applied ahead of the fix

The 2026-08-21 run added both packages to `.last-versions.json` at their current versions so tomorrow's diff is not blind:

- `@lingui/format-po` → `6.6.0`
- `@vitejs/plugin-react` → `6.1.0` (`latest`; pin-relevant 5.x line is at `5.2.0`)

`@lingui/format-po-gettext` was left in place pending the decision in step 2.

---

**Filed: https://github.com/globalize-now/globalize-skills/issues/60** (2026-08-25). Filed as an issue, not a PR: all three fix steps land outside the repo (`library-checks/` is gitignored), so there is no file here to change. Steps 1 and 3 are applied task-side; step 2 (`@lingui/format-po-gettext` keep-or-drop) is the open decision. Extended on filing with the gem-side sibling — `herb` is tracked but absent from the manifest `gems` block, same shape.
