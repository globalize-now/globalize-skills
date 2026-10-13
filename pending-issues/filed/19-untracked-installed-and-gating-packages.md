# The daily check does not watch four packages the skills install or depend on for documented behaviour — and one has already gone stale in a shipped reference

**Labels:** `chore`, `tooling`, `library-check`

**Severity:** Medium as a *check-integrity* defect. One consequence has already materialised: a version claim in a shipped reference has been wrong for four days and four consecutive runs, and this check is the thing that was supposed to catch it. Low as a *content* defect today — the ranges the skills pin are all still correct.

**Verified:** 2026-09-25, against `origin/main` `a997b6d` (fresh `--depth 1` clone, not the mounted working copy) and the npm registry.

**Relationship to [#60](https://github.com/globalize-now/globalize-skills/issues/60):** this is the next instance of the rule #60 already asked for — *"the rule needs to include direct dependencies of manifest packages that the skill's own prose treats as a compatibility constraint"* — plus a **category #60 does not cover**: packages the *references* tell a user to install that never appear in `manifest.json` at all. File as a comment extending #60 rather than a new issue if that reads better; the content below stands either way.

---

## Summary

The daily check tracks 27 npm names. All 17 names in `manifest.json` are covered (reconciled clean again this run). The blind spot is everything else the skills actually make a user run:

| Package | How the skills reach it | Tracked | Current `latest` | Status |
|---|---|---|---|---|
| `web-ext` | `npx 'web-ext@^10' lint` — five call sites across four references | ❌ | **10.7.0** (2026-09-21) | **Already caused a stale claim.** See below. |
| `eslint-plugin-i18next` | `npm install --save-dev 'eslint-plugin-i18next@^6'` — `webext/setup.add-ons.md` L661–662 | ❌ | 6.1.5 (2026-06-28) | In range, no drift today |
| `eslint-plugin-svelte` | `npm install --save-dev 'eslint-plugin-svelte@^3'` — `paraglide/setup.add-ons.md` L166–172 | ❌ | 3.23.0 (2026-08-13) | In range; this one **self-corrects** (L176 tells the agent to run `npm view`) |
| `@eloqnt/format-po` | transitive: `next-intl@^4` → `"@eloqnt/format-po": "^0.1.0"` | ❌ | 0.1.0 (2026-09-01) | In range today, but see § The gating one |
| `typescript` | `npm install -D 'typescript@^6'` — `vue-i18n/setup.shared.md` L140, inside a bootstrap prompt | ❌ | **7.0.2** (2026-07-08) | **A major behind.** See § By-catch |

None of these is in `manifest.json`, so a manifest-only reconciliation — which is what (C) does, and what it did again cleanly this morning — will never surface any of them.

## The one that already bit

`skills/globalize-guide/references/languages/js-ts/frameworks/webext/setup.add-ons.md` L227:

> `web-ext@10` is the current major (10.6.0, 2026-08-04) and needs Node ≥ 20.

`web-ext@10.7.0` was published **2026-09-21T11:46:40Z**. The sentence has been wrong since, through the 2026-09-21, 09-22, 09-23 and 09-24 runs, none of which could have seen it.

What is still correct, checked rather than assumed:

- `web-ext@10` **is** still the current major — `dist-tags` is `{"latest": "10.7.0"}`, no `11.x` anywhere in the `time` map.
- `engines.node` is `>=20.0.0` on **both** 10.6.0 and 10.7.0 (read from the registry version documents), so the "needs Node ≥ 20" half holds.
- `npx 'web-ext@^10'` resolves 10.7.0 automatically, so **no user is broken** — the reference merely tells them something untrue about what they just ran.

A second, narrower claim is now version-dated too. `webext/lingui.setup.md` L423:

> `web-ext lint` reports no i18n finding on an extension whose manifest says `"name": "__MSG_extName__"` and whose default-locale catalog is `{}` — verified against `web-ext@10.6.0` […]

10.7.0's release notes bump `addons-linter` 10.12.0 → 10.13.0, and `addons-linter`'s own `lint` rules are what that negative claim rests on. I checked the last eight `addons-linter` releases (10.7.0 … 10.13.0) for any entry mentioning `locale`, `i18n`, `messages.json`, `__MSG` or `translat`: **there are none**, so there is no evidence the claim changed. It has not been re-verified by running the linter, and this draft does not assert that it holds — only that nothing in the changelogs suggests it does not.

## The gating one

`@eloqnt/format-po` is the sharpest case, because a skill reference documents a **build-breaking behaviour keyed to its version**. `next-intl/po-format.setup.md` L202–213:

> `4.14.2` (2026-09-01) moved its PO codec dependency from `@eloqnt/format-po@^0.0.3` to `^0.1.0`. At `0.0.x` a caret range is an exact pin, so every `4.14.0`/`4.14.1` install resolved `0.0.3`; `^0.1.0` now resolves `0.1.0`, which carries the `0.0.5` change *"throw a clear error when a PO file contains an empty `msgstr` but no source locale is known"*.

That paragraph is the reason L131 says `sourceLocale` is **"not optional on current next-intl"**. The reference is right about the mechanism and right about why the caret behaves differently at `0.1.x` than at `0.0.x` — and that is exactly what makes the package dangerous to leave untracked. `^0.1.0` floats across the **whole** `0.1.x` line. Its publish history:

| Version | Published |
|---|---|
| 0.0.3 | 2026-08-27 |
| 0.0.4 | 2026-08-27 |
| 0.0.5 | 2026-08-28 |
| 0.0.6 | 2026-08-31 |
| **0.1.0** | **2026-09-01** ← current `latest` |

Four publishes in six days, and one of them changed the behaviour this reference teaches. A `0.1.1` with another change to the empty-`msgstr` path would be picked up by every `next-intl@^4` install on the next `npm update`, would change what `po-format.setup.md` documents, and **this check would not see it** — `@eloqnt/format-po` is not in the tracked set and is not in `manifest.json`.

It is quiet today (0.1.0, unchanged since 2026-09-01). That is luck, not coverage.

## By-catch: `typescript@^6` is a major behind, inside a "set this project up" instruction

The install-site sweep that produced the table above also turned up `vue-i18n/setup.shared.md` L140. It fires when a Vue project has no TypeScript at all, and offers:

> 1. Add TypeScript to the project first (`npm install -D 'typescript@^6'` plus a minimal `tsconfig.json`), then re-run.

`typescript@latest` has been **7.0.2** since **2026-07-08**. `^6` still resolves — 6.0.3, published 2026-04-16 — so nothing errors; a project that takes option 1 gets TypeScript 6, caret-pinned, and will never see 7 from an `npm update`.

Checked rather than assumed: stable `6.x` does exist (`6.0.2` 2026-03-23, `6.0.3` 2026-04-16) and `semver.maxSatisfying(versions, "^6")` returns `6.0.3`, so this is a stale floor, **not** a broken install. `dist-tags` today: `latest 7.0.2`, `rc 7.0.1-rc`, `beta 6.0.0-beta`, `next 7.1.0-dev.20260924.1`.

**This one needs a decision, not just a bump.** TypeScript 7 is the native port, and a Vue/`vue-tsc` toolchain may well have a reason to stay on 6 — this draft has not tested that and does not claim it either way. Both outcomes have the same shape of fix:

- if `^6` is deliberate, the line should **say why**, so the next sweep does not re-flag it;
- if it is merely stale, it should be `^7`, or dropped to `typescript` unpinned, since the prompt's purpose is "this project has no TypeScript" and any current major satisfies that.

Either way it is the fourth instance in this draft of the same failure: a major or patch number written into prose, with nothing watching it.

## Why it keeps happening

The tracked set is maintained by hand, and the only reconciliation the daily run performs is against `manifest.json`. That check is *correct* and it passes — which is the problem, because it reads as coverage. #60 named the same failure eleven months into the same shape: a set that "had just been reconciled was stale again" the next day.

Three distinct entry paths exist, and only the first is reconciled:

1. `manifest.json` `packages` / `gems` — **reconciled every run**.
2. A *direct dependency of a manifest package that the prose treats as a constraint* — `@swc/core` (caught in #60, now tracked), `@eloqnt/format-po` (**not** caught, this draft).
3. A package a *reference* tells the user to install with `npx` or `npm install`, that is in no manifest at all — `web-ext`, `eslint-plugin-i18next`, `eslint-plugin-svelte`, `typescript` (**not** caught, this draft). #60 does not have this category.

## Fix

**Task-side (nothing in this repo to change; `library-checks/` is gitignored):**

1. Add `web-ext`, `eslint-plugin-i18next`, `eslint-plugin-svelte`, `@eloqnt/format-po` and `typescript` to the tracked set in `.last-versions.json`. Baseline them at today's values: 10.7.0, 6.1.5, 3.23.0, 0.1.0, 7.0.2. **Applied this run.**
2. Replace hand-maintenance with derivation. A grep over `skills/**/*.md` for `<name>@<range>` in an `npm install` / `npx` / `pnpm add` / `yarn add` / `bun add` line already recovers categories 2 and 3 — it is the instrument that produced this draft's table. Run it as part of (C) and fail the reconciliation when it names something untracked, instead of comparing against `manifest.json` alone. **Applied this run; the walker is saved at `library-checks/walkers.py` so it is not re-derived daily.**

**Repo-side (one PR, blocked on the write path today — see the 2026-09-25 report):**

3. `webext/setup.add-ons.md` L227: drop the parenthetical or restate it as a floor. The sentence is only ever going to be right for as long as nobody publishes; `web-ext@10` is the current major and needs Node ≥ 20` says everything the reader needs and cannot go stale. Same treatment as the claim in `nextjs/app-router/lingui.setup.md` L31 — see draft `20-app-router-split-pin-count-stale.md`, which is the identical failure in another file and should ship in the same PR or an adjacent one.
4. `webext/lingui.setup.md` L423: leave the `web-ext@10.6.0` attribution alone — a verification note *should* name the version it was run on. It is only the "this is the current version" claims that rot.

   **Revisited 2026-09-27.** Draft `22-webext-lint-version-stamps-stale.md` takes a different view of L423 and the identical sentence at `webext/swc/lingui.setup.md` L421, having read `addons-linter@10.13.0`'s source: there the byte-comparison against 10.6.0 is not an attribution attached to a claim proved elsewhere, it *is* the whole proof, and it only ever covered one release. Draft 22 replaces it with the mechanism (the linter checks that `_locales/<default_locale>/messages.json` exists, never reads its contents, and resolves no `__MSG_` placeholder) and still names a version. **Step 3 above — L227 — remains this draft's, and draft 22 deliberately does not touch it:** dropping the parenthetical, as step 3 says, beats re-stamping it. Do not ship L227 from both drafts.

## Acceptance

- [ ] The five packages appear in `.last-versions.json` and in the next run's "What moved" table.
- [ ] (C) reconciles against install-site greps as well as `manifest.json`, and reports the count for both.
- [ ] `webext/setup.add-ons.md` L227 no longer names a specific patch version as "current".
- [ ] `vue-i18n/setup.shared.md` L140 either moves off `^6` or states why it stays.
- [ ] A future `@eloqnt/format-po@0.1.1` appears in a report within a day of publication.

---

**Still unfiled 2026-09-26.** Second consecutive run blocked on the same `401 Bad credentials` from `library-checks/.github-token` (unchanged since 2026-08-25). Re-checked this run with an unauthenticated control on the same repo in the same call returning `200`, so egress is fine and the credential is not. The duplicate check in this draft was re-run against the 11 open PRs today and still holds.

---

**Still unfiled 2026-09-27.** Third consecutive run blocked on the same `401 Bad credentials` from `library-checks/.github-token` (mtime still 2026-08-25 17:27:18Z). Re-checked this run with an unauthenticated control on the same repo in the same call returning `200`, so egress is fine and the credential is not. The duplicate check in this draft was re-run against the 11 open PRs today (unchanged set) and still holds.

---

**Still unfiled 2026-09-28.** Fourth consecutive run blocked on the same `401 Bad credentials` from `library-checks/.github-token` (mtime still 2026-08-25 17:27:18Z); an unauthenticated control on the same repo in the same call returned `200`, so egress is fine and the credential is not. Re-checked this run against the unchanged set of 11 open PRs and 25 open issues on `main` `a997b6d`; the duplicate checks in this draft still hold.

**Still unfiled 2026-09-29.** Fifth consecutive run blocked on the same `401 Bad credentials` from `library-checks/.github-token` (mtime still 2026-08-25 17:27:18Z); an unauthenticated control on the same repo in the same call returned `200`, so egress is fine and the credential is not. **The repo moved this run**: `main` is now `f4f71a1` ([#84](https://github.com/globalize-now/globalize-skills/pull/84) merged, 2026-09-28T07:07Z) and the open-PR set is **10**, not 11. The duplicate checks in this draft were re-run against that set and against `main` `f4f71a1`, and still hold.

**Still unfiled 2026-09-30.** **Sixth** consecutive run blocked on the same `401 Bad credentials` from `library-checks/.github-token` (mtime still 2026-08-25 17:27:18Z); an unauthenticated control on the same repo in the same call returned `200`, so egress is fine and the credential is not. `main` is **unchanged** at `f4f71a1`, and the open set is unchanged at **10 PRs / 25 issues**, so the duplicate checks in this draft carry forward on the same baseline they were last verified against. The four packages this draft names are all still untracked in `manifest.json` — today's (C) leg returned the same 15-name `tracked_not_in_manifest` list. **New evidence for this draft's thesis:** the package that produced today's finding, `@swc/core`, is reached by `next-intl` as a *direct* dependency (`~1.16.0`), and nothing in the manifest or in any install line names it — exactly the blind spot described here, now with a second route through it.

**Still unfiled 2026-10-02.** **Ninth** consecutive run blocked on the same `401 Bad credentials` from `library-checks/.github-token` (mtime still 2026-08-25 17:27:18Z); an unauthenticated control on the same repo in the same call returned `200`, so egress is fine and the credential is not. `main` moved to **`7d85ace`** and the open set is **8 PRs / 26 issues**; today's (C) leg returned the same 15-name `tracked_not_in_manifest` list, `manifest_untracked` and `install_only_untracked` both empty, so the four packages this draft names are all still untracked.

**A new, and larger, instance of this draft's thesis arrived this run.** `@lingui/*` 6.9.0 added `@lingui/native-tools@^0.1.5` to the `dependencies` of **both** `@lingui/cli` and `@lingui/vite-plugin` — level 2 caught it as the only two added edges in a 227-edge map (`walkers.diff_dep_ranges`: 2 added, 0 removed, 19 changed). `@lingui/cli@^6` appears **11** times in `manifest.json` and `@lingui/vite-plugin@^6` **10** times, all resolving to `6.9.0`, so **every Lingui stack in the manifest now installs a 9.5 MB-per-platform native addon that nothing in the manifest, in any install line, or in any reference names.** It arrives through `@lingui/cli` as a plain `dependencies` entry, so it is installed whether or not the project opts into the `macroTransform` feature it exists for ([draft 28](./28-lingui-6-9-native-macro-transform.md)).

Three things make it a sharper example than the four already listed:

- **It is a native addon, not a JS package.** Nine platform packages in `optionalDependencies` (darwin x64/arm64, linux x64/arm64 × gnu/musl, win32 x64/arm64, android arm64). A platform outside that list resolves no binary — the same class of install-time surprise as `@swc/core`, which is already the subject of drafts 24 and 25 and is itself on the untracked list.
- **It arrived in a patch-range bump.** Nothing in the manifest changed; `^6` simply started resolving to a release with a new transitive native dependency. That is open item 65's rule (a fixed range is not a fixed resolution) reaching a *new edge* rather than a moved resolution — level 3 reported it as `added`, not `resolution_moved`.
- **Its Node floor happens to agree.** `@lingui/native-tools@0.1.5` declares `engines.node >= 22.19.0`, identical to the `@lingui/*` v6 floor the references already state, so no claim went stale this time. That is luck, not design, and it is exactly what this draft argues the tracking set should not be relying on. Verified by execution: it loads and transforms correctly in this sandbox, where `@swc/core@1.16.13` does not (see draft 28).

**Recommended addition to this draft's fix:** `@lingui/native-tools` belongs in the tracked set and in whatever the fix adopts for naming install-time-only transitive packages, alongside `@swc/core`. It is, for now, a `0.x` package — `^0.1.5` admits only `0.1.x` — which makes its resolution tighter than `@swc/core`'s but its stability guarantee weaker.

---

**Still unfiled 2026-10-03.** **Tenth** consecutive run blocked on the same `401 Bad credentials` from `library-checks/.github-token` (mtime still `2026-08-25 17:27:18Z`, **39 days**); an unauthenticated control on the same repo in the same call returned `200`, so egress is fine and the credential is not. This run the GitHub MCP server that read successfully on 10-02 is **not in the session at all**, and the cloud container's git proxy returns `403 … not in this session's authorized repository set`. `main` moved to **`48a676ae`** ([#91](https://github.com/globalize-now/globalize-skills/pull/91) merged) and the open set is **7 PRs / 26 issues**.

## 2026-10-03: the thesis caught a whole new library, and caught the instrument lying about it

This is the largest instance yet, and the first where **the (C) leg returned clean while a new library entered the repo.**

`#91` added the `angular-localize` stack. Its manifest entry declares:

```json
"packages": { "runtime": [], "dev": [] }
```

Empty — deliberately, because `@angular/localize` is installed by `ng add` with a version computed from the project rather than from a manifest pin (`SKILL.md` §2.0). The consequence is that **`@angular/localize` is in no manifest `packages` block, in no tracked set, and therefore in nothing this check watches** — while being installed by every project that takes the Angular path. The manifest's own figures are unchanged by #91: **17 npm names across 18 distinct spec strings, 78 occurrences**, byte-for-byte the same counts as 10-02 despite the stack count going 23 → **24**. A reconciliation keyed on manifest `packages` cannot see a stack whose `packages` are empty.

### And `install_only_untracked` returned 0, which was false

Category 3 of `walkers.reconcile()` exists precisely for "packages a reference tells the user to install that are in no manifest". It reported **empty**. It was wrong, and the reason is mechanical:

- `walkers.INSTALL_LINE` matches `npm install|npm i|npx|pnpm add|yarn add|bun add`. The Angular line *does* contain `npx`, so the line was a candidate.
- `walkers.QUOTED_SPEC` requires the range to begin with a **digit**: `([\^~>=<]*[\d][\w.\-|\s^~<>=]*)`. The Angular spec is `'@angular/localize@^<angular-major>'` — a **placeholder** range. No match, so the line yielded nothing.

The repair, applied to `walkers.py` this run, admits placeholder ranges (`^<…>`, `{{…}}`) in the spec and adds `ng add`, `ng update`, `bunx`, `pnpm dlx`, `yarn dlx`, `npm add`, `gem install` and `bundle add` as install runners. Measured over `skills/` on `main` `48a676ae`, old instrument against new in the same run:

| | install-site names | `install_only_untracked` |
|---|---|---|
| old | 22 | `[]` ← the false clean |
| **repaired** | **23** | **`['@angular/localize']`** |

Exactly one name gained, nothing lost:

| name | sites | tracked? | in manifest? |
|---|---|---|---|
| `@angular/localize` | **3** — `skills/globalize-guide/SKILL.md` L533 (`^<major>`) and L870 (`^<major>`), `…/frameworks/angular/angular-localize.setup.md` L151 (`^<angular-major>`) | ❌ | ❌ |

It is in `SKILL.md` itself, not only in a reference.

**One thing the repair deliberately does *not* do.** An exploratory version that also dropped the **quote** requirement reported a 24th name, `swc_core`, from `remix/swc/lingui.setup.md` L28 and `webext/swc/lingui.setup.md` L97. That is a **false positive**: the string there is `` `swc_core@50.2.3` `` in backticks — the Rust crate named in prose, not an npm package. The shipped repair keeps `['"]` required around the spec, which excludes it, and the reason is recorded in a comment above the regex so the next person widening it does not re-introduce it.

### Why this one matters more than the four in the table above

Those four are packages the check does not watch. This is a package the check **cannot** watch under the current design, because the stack that installs it declares no packages by design — and the version it installs is computed from the user's project, so there is no single range for the check to compare a `latest` against. The honest form of the fix for this case is not "add it to the tracked set and compare ranges" but "track it and compare **the peer-compatibility shape**": [draft 29](./29-angular-localize-exact-pin.md) found, the same morning the stack landed, that `@angular/localize` declares its peers as **exact versions** back to v16, which is why #91's caret pin fails with `ERESOLVE` on any project not on the newest patch of its major. That is a property of the package's metadata, and it would have been visible to a check that was watching the package at all.

**Recommended additions to this draft's fix, cumulative with the 10-02 entry:**

1. `@angular/localize` into the tracked set. Done locally this run: the tracked set is **33** names, up from 32.
2. `walkers.install_sites()`'s two regexes repaired — a spec range may be a placeholder, and `ng add` is an install runner. Done locally this run; the before/after name counts (22 → 24) are recorded above so the change is auditable.
3. **A fourth reconciliation category: a manifest stack whose `packages` block is empty while its references contain install lines.** Rails, Android, Swift and Angular all legitimately declare empty `packages`, so "empty is a finding" is wrong — but "empty *and* the stack's own references tell the user to install something" is exactly the hole #91 fell into, and it is mechanically checkable from `references.setup` plus the repaired `install_sites()`.

---

## 2026-10-04 — recommendation 3 built and run; it has a second hit

The fourth reconciliation category proposed above is no longer a proposal. Implemented this run (local, `walkers.py` is gitignored), reading each stack's own `references.*` through the repaired `install_sites()` regexes, over `main` `48a676ae`:

| stack (empty `packages`, no `gems`) | install lines in its own references |
|---|---|
| `angular-localize` | **1** — `@angular/localize@^<angular-major>` at `angular-localize.setup.md:151` (the [draft 29](./29-angular-localize-exact-pin.md) defect, the one this category was designed around) |
| `webext-native-messages` | **2** — `web-ext@^10` at `webext-native.setup.md:173` and `webext-native.convert.md:349` |
| `android-strings`, `ios-swiftui-string-catalog`, `ios-uikit-string-catalog`, `ios-spm-string-catalog` | 0 — correctly empty, nothing to install |

So the category is **not** a one-instance rule written to fit `@angular/localize`: it fires twice on today's tree, in two unrelated stacks, and stays silent on the four that legitimately install nothing. `rails-yaml` is excluded by construction — it declares `gems`, not an empty block.

`web-ext` is already in the tracked set (`latest` 10.7.0) and `^10` resolves to it, so this second hit is **not** a live defect. It is the stronger argument for the category: a package can be installed by a stack that declares no packages *and* be tracked, which means the existing three categories would never have shown the connection between the two. Four stacks in, two with install lines, zero false positives.

**Status of the three recommendations:** (1) done 10-03, tracked set 33. (2) done 10-03, 22 → 23 names. (3) **done 10-04**, numbers above. All three are local; none has reached the repo, because there is still no write path.

Filed: https://github.com/globalize-now/globalize-skills/issues/60#issuecomment-6140900275 (2026-10-13, cutover run)
