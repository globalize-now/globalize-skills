# The `web-ext lint` empty-catalog claim is evidenced by a byte-comparison against 10.6.0 — `^10` has installed 10.7.0 since 2026-09-21, and the claim's real reason never needed a version

**Draft written:** 2026-09-27 (library check). **Unfiled** — the GitHub PAT returns
`401 Bad credentials` for a third consecutive day, so no PR could be opened. See § Filing.

**Type:** PR (implementable — three prose edits, no code, no snippet behaviour change).
**Severity:** Low as breakage. Medium as trust: the empty-catalog claim is the stated justification for
`build-locales.mjs` failing closed, and its only evidence is a byte-comparison of one release's output
that no reader can re-run against the version `^10` now installs.

**Scope note, and read this before touching `setup.add-ons.md`:** a fourth stale stamp — L227's
"`web-ext@10` is the current major (10.6.0, 2026-08-04)" — **is deliberately not in this patch.** It is
already draft `19-…` §Fix step 3 and draft `20-…` §Acceptance, and draft 19's treatment of it is better
than mine was: *drop* the parenthetical rather than re-stamp it, because re-stamping re-arms the same
rot on the next publish. That line belongs to draft 19, and #89 is already editing that file. Do not
ship it twice.

**Labels:** `docs`, `webext`, `lingui`

**Verified:** 2026-09-27, against `origin/main` `a997b6d`, the `web-ext` and `addons-linter`
packuments, and `addons-linter@10.13.0`'s `src/parsers/manifestjson.js` read from source.

**Related:** [#71](https://github.com/globalize-now/globalize-skills/issues/71) — *"No check relates a
manifest version range to what it resolves to"* — is the general form. This is the **third** concrete
instance in the queue, after draft `20-app-router-split-pin-count-stale.md`. Three instances in a week
is an argument for #71 being the fix rather than for a fourth draft.

---

## What moved upstream

`web-ext` **10.6.0 → 10.7.0**, published **2026-09-21T11:53:40Z**
([packument](https://registry.npmjs.org/web-ext)). The dependency that matters moved with it:

| `web-ext` | bundles `addons-linter` |
|---|---|
| 10.6.0 (2026-08-04) | 10.10.0 |
| **10.7.0 (2026-09-21)** | **10.13.0** |

`addons-linter` 10.10.0 → 10.13.0 is 33 commits and 18 files
([compare](https://github.com/mozilla/addons-linter/compare/10.10.0...10.13.0)). **Exactly one of
them is logic** — `src/parsers/manifestjson.js`, +1/−4, and it is this:

```diff
-    if (
-      (!this.selfHosted || this.isEnterpriseAddon) &&
-      this.parsedJSON.applications?.gecko?.update_url
-    ) {
+    if (!this.selfHosted && this.parsedJSON.applications?.gecko?.update_url) {
```

An `update_url` condition for enterprise add-ons. Everything else is imported schema
(`alarms`, `contextual_identities`, `theme`, and the removal of `normandyAddonStudy`). **No locale or
i18n code changed at all.**

## Why the skill needs to change anyway

Four places name 10.6.0. All four now describe a version no install this skill produces will resolve.

| # | File | Line | What it says | owner |
|---|---|---|---|---|
| — | `webext/setup.add-ons.md` | 227 | "`web-ext@10` is the current major (10.6.0, 2026-08-04)" | **draft 19**, not this one |
| 1 | `webext/setup.add-ons.md` | 251 | "Verified by running `web-ext@10.6.0` against fixtures:" | this patch |
| 2 | `webext/lingui.setup.md` | 423 | "verified against `web-ext@10.6.0`, whose output on that package is byte-identical to its output on a healthy one" | this patch |
| 3 | `webext/swc/lingui.setup.md` | 421 | identical sentence to #2 | this patch |

**#2 and #3 are a worse shape than staleness.** The claim — *`web-ext lint` reports no i18n finding on
an extension whose manifest says `"name": "__MSG_extName__"` and whose default-locale catalog is
`{}`* — is **true**, and it is load-bearing: it is the justification for `build-locales.mjs` failing
closed. But it is evidenced by a *byte-comparison of one release's output*, so it perishes on every
`web-ext` publish, and a reader who checks the stamp against their own `npm ls` has no way to tell
whether the claim survived. It has survived every release so far and will survive the next one, for a
reason the sentence does not give.

### The reason, which is what the patch puts in its place

Read in `addons-linter@10.13.0`, `src/parsers/manifestjson.js` L823–885. The whole of the locale
validation is:

- `default_locale` set → assert `_locales/<default_locale>/messages.json` is **present in the file
  map** (`NO_MESSAGES_FILE`). The file's *contents* are never opened here.
- every directory under `_locales/` → assert it has a `messages.json` (`noMessagesFileInLocales`).
- `_locales/` present with no `default_locale` → `NO_DEFAULT_LOCALE`.

And `__MSG_` appears **nowhere** in `src/parsers/manifestjson.js`, `src/scanners/json.js` or
`src/messages/manifestjson.js`. The manifest's `name` reaches `validateName()`, whose entire test is:

```js
const trimmedName = name.trim();
if (trimmedName !== name || trimmedName.length < 2) { … }
```

So `"__MSG_extName__"` is an ordinary 15-character string that trims to itself and clears the
two-character floor. There is no placeholder resolution step to fail. **An empty default-locale
catalog lints clean on any `web-ext@10`, not just on 10.6.0** — which is a stronger claim than the one
the file makes today, and one that does not need re-stamping next release.

This also independently re-confirms the existing "**What it does NOT catch — verified; do not claim
otherwise**" list at `setup.add-ons.md` L259–267, whose first bullet is the same fact. That list is
correct and the patch leaves it alone.

## The change

Three edits, each an exact-match substitution with a uniqueness assertion:

1. **`setup.add-ons.md` L251** — keep the empirical record, add the provenance that stops it perishing:
   names the `addons-linter@10.10.0` that 10.6.0 bundled, and states that the table still describes
   10.7.0 because the only `src/` logic change to 10.13.0 is the `update_url` condition.
2. **`lingui.setup.md` L423** and 3. **`swc/lingui.setup.md` L421** — replace the byte-comparison with
   the mechanism above.

**#1 deliberately does *not* re-stamp to 10.7.0.** The fixture run was made on 10.6.0 and re-running it
would need a `web-ext` install this sandbox has no disk for (see § Filing). Writing "verified by
running 10.7.0" would be a claim nobody made. What the patch adds instead is the reason the 10.6.0 run
still generalises, which is checkable from the diff without running anything.

### Where this disagrees with draft 19, and why

Draft 19 §Fix step 4 says, of exactly these lines: *"leave the `web-ext@10.6.0` attribution alone — a
verification note should name the version it was run on. It is only the 'this is the current version'
claims that rot."* **The principle is right and this patch keeps it** — that is precisely why edit #1
leaves the 10.6.0 fixture stamp standing, and why the replacement text at L423/L421 still names a
version (`addons-linter@10.13.0`).

What draft 19 did not have when it was written is the reading of the linter source. L423 is not a
verification note attached to a claim proved some other way; the byte-comparison **is** the entire
proof, and it proves the claim for one release only. Substituting a mechanism that holds for every
`web-ext@10` is not stripping an attribution — it is giving the claim evidence that matches its scope.
If a reviewer disagrees, the fallback is one sentence: keep the existing text and append the mechanism
after it. Either way L227 stays draft 19's.

Nothing in the table, the code snippets, the `_locales` bridge or the pins changes. `^10` is already
the right pin and stays.

## Verification

- **Evals**, run in a `--depth 1` clone of `origin/main` (`a997b6d`) with the patch applied:
  `verify-manifest.sh` **6/0/0**, `verify-rules-template.sh` **104/0/0**,
  `verify-format-helpers.sh` **88/0/0**, all rc 0. **Controls re-run in the same clone with the patch
  stashed: identical.** (`verify-hard-stop.sh`, `verify-orchestration.sh` and
  `verify-string-wrapping.sh` take `<workdir> <fixture>` and are not standalone.) No eval in `evals/`
  covers `webext/` prose, so these are regression controls; the substantive verification is the
  `addons-linter` source read above.
- `git apply --check` passes against clean `a997b6d`.
- **Candidate set (trigger G).** The head carried from the 2026-09-26 report named **one** line,
  `lingui.setup.md` L423. Enumerating `web-ext@1[0-9.]*` and `addons-linter` across `skills/` found
  **four** stamps in **three** files — three of which this patch fixes and one of which turned out to
  already belong to draft 19. Had the head been worked as written, three of the four would have
  survived the fix, and the duplicate with draft 19 would never have surfaced.

## Duplicate check (item 52)

Changed-file lists read via the API for all **11** open PRs. **Three touch the files this patch
edits**, so this needed hunk-level checking rather than a filename check:

| PR | file | its hunks (old-file lines) | overlaps L227 / L251 / L423 / L421? |
|---|---|---|---|
| [#84](https://github.com/globalize-now/globalize-skills/pull/84) | `webext/lingui.setup.md` | 6–12, 887–895, 914–920 | no |
| #84 | `webext/swc/lingui.setup.md` | 885–893, 912–918 | no |
| [#89](https://github.com/globalize-now/globalize-skills/pull/89) | `webext/setup.add-ons.md` | 341–347, 370–390, 404–410, 414–422 | no |
| [#69](https://github.com/globalize-now/globalize-skills/pull/69) | `webext/swc/lingui.setup.md` | 92–100 | no |

**Conflict-free — a fresh branch merges clean.** Unlike draft 19, this one does not need folding.

## Filing

Blocked. `library-checks/.github-token` → `401 Bad credentials`; the same URL unauthenticated in the
same call → `200`. Token file mtime **2026-08-25 17:27:18Z**, untouched. Third consecutive day.

Branch name reserved: **`library-check/webext-lint-version-stamps`**.
Patch: [`22-webext-lint-version-stamps-stale.patch`](./22-webext-lint-version-stamps-stale.patch) —
`git apply` it on a branch and the change is done.

Suggested PR title:

> `docs(webext): evidence the web-ext lint empty-catalog claim by mechanism, not by one release's output`

**Sandbox note.** The `/sessions` volume hit 100% mid-run, which is why the `web-ext@10.7.0` fixture
re-run was not attempted; `addons-linter` was read from `raw.githubusercontent.com` instead, at no disk
cost. This is the cheaper path *and* the stronger one — the fixture run would have confirmed 10.7.0 and
said nothing about 10.8.0.

---

**Still unfiled 2026-09-28.** Fourth consecutive run blocked on the same `401 Bad credentials` from `library-checks/.github-token` (mtime still 2026-08-25 17:27:18Z); an unauthenticated control on the same repo in the same call returned `200`, so egress is fine and the credential is not. Re-checked this run against the unchanged set of 11 open PRs and 25 open issues on `main` `a997b6d`; the duplicate checks in this draft still hold.

**Still unfiled 2026-09-29.** Fifth consecutive run blocked on the same `401 Bad credentials` from `library-checks/.github-token` (mtime still 2026-08-25 17:27:18Z); an unauthenticated control on the same repo in the same call returned `200`, so egress is fine and the credential is not. **The repo moved this run**: `main` is now `f4f71a1` ([#84](https://github.com/globalize-now/globalize-skills/pull/84) merged, 2026-09-28T07:07Z) and the open-PR set is **10**, not 11. `git apply --check library-checks/pending-issues/22-webext-lint-version-stamps-stale.patch` was re-run against the **new** `main` `f4f71a1` — still applies clean, so this is a re-verification rather than a re-stamp. Duplicate checks re-run against the 10 open PRs; still hold.

**Still unfiled 2026-09-30.** **Sixth** consecutive run blocked on the same `401 Bad credentials` from `library-checks/.github-token` (mtime still 2026-08-25 17:27:18Z); an unauthenticated control on the same repo in the same call returned `200`, so egress is fine and the credential is not. `main` is **unchanged** at `f4f71a1`, and the open set is unchanged at **10 PRs / 25 issues**, so the duplicate checks in this draft carry forward on the same baseline they were last verified against. `git apply --check library-checks/pending-issues/22-webext-lint-version-stamps-stale.patch` re-run against `f4f71a1` — **still applies clean**. `web-ext` `latest` unchanged at 10.7.0. Touches three `webext/` files; disjoint from draft 25's two `nextjs/` files.

**Still unfiled 2026-10-06. Tenth day queued, and the first run that measured the claim instead of reading it.** Write path still dead (`lc_have_token` → rc 1, PAT `401 Bad credentials`, token mtime unchanged at 2026-08-25T17:27:18Z — **42 days**); unauthenticated control on the same repo in the same call returned `200`. `main` unchanged at `48a676ae`, open set unchanged at **7 PRs / 26 issues**. `git apply --check` re-run against `48a676ae` — **still clean**.

**The sandbox note above is now obsolete and this draft's central claim is confirmed by fixture run, not by source reading.** `/sessions` was again near-full (251 MB free) on the device, so `web-ext@10.7.0` was installed in the *cloud container* (31 GB free) instead — the first time this check has run `web-ext lint` at all. It bundles **`addons-linter@10.13.0`**, exactly as this draft states. All seven i18n codes in the skill's table reproduce at the documented severity, and both "does NOT catch" bullets reproduce: an extension whose manifest `name` is an unresolvable `__MSG_missingKey__` produces output **byte-identical** to a healthy one (`ADDON_ID_REQUIRED` error + `MISSING_DATA_COLLECTION_PERMISSIONS` warning, nothing else). So the locale validation is untouched between 10.10.0 and 10.13.0 as asserted, now first-hand.

**New adjacent draft: [32](./32-webext-lint-i18n-code-table-incomplete.md)**, same file (`webext/setup.add-ons.md`), different lines — it adds three missing rows to the table and annotates a dead code in the emitted CI filter set. **32 deliberately does not touch L251**, this draft's line. Commutation verified by hash on a clean fixture of `48a676ae`: **22→32 and 32→22 both apply and produce an identical tree** (`sha1(git diff)` = `4234af334b01`). Land 22 first — it is older and the smaller edit. Overlap with draft 30 on `webext/swc/lingui.setup.md` re-tested the same way this run: **commutes, identical tree** (`b976e9d113d8`).

Filed: https://github.com/globalize-now/globalize-skills/pull/93 (2026-10-13, cutover run)
