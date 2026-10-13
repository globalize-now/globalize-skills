# `nextjs/app-router/lingui.setup.md` L31 tells the reader the plugin is "one minor behind the rest of the family" — it is two, and the sentence will be wrong again next release

**Labels:** `bug`, `docs`, `lingui`, `nextjs`

**Severity:** Low as breakage — nothing fails to build, and the pin itself is correct. Medium as trust: the line's whole job is to pre-empt *"`npm ls` shows a mismatch, should I fix it?"*, and a reader who runs `npm ls` today sees a number the reference says they will not see. A reader who concludes the reference is describing a different setup than theirs may well "fix" the split — which L31's last sentence exists to stop them doing.

**Verified:** 2026-09-25, against `origin/main` `a997b6d` and the published npm tarballs for `@lingui/core` and `@lingui/react` at 6.7.0 and 6.8.0.

**Related:** [#71](https://github.com/globalize-now/globalize-skills/issues/71) — *"No check relates a manifest version range to what it resolves to"* — is this defect's general form. This draft is one concrete instance, and the (F) head carried from the [2026-09-24 report](../2026-09-24.md).

---

## The line

`skills/globalize-guide/references/languages/js-ts/frameworks/nextjs/app-router/lingui.setup.md` L31:

> - **The pin is a split pin, and that is fine.** `@lingui/swc-plugin@~6.6.0` alongside `@lingui/core`/`@lingui/react`/`@lingui/cli` at `^6` means `npm ls` shows the plugin **one minor behind** the rest of the family. **Verified by build on Next.js 16.3.4 with plugin `6.6.0` + core/react/cli/format-po `6.7.0`**: `next build` succeeds with the macro transformed, and `lingui extract` then `lingui compile` both exit 0. […]

Two claims, both dated, for two different reasons.

### 1. "one minor behind" — wrong as of 2026-09-23

`@lingui/swc-plugin@~6.6.0` resolves **6.6.0**. It has not moved since 2026-07-24 (`latest` is 6.7.0, which L29 documents as a hard build break on every Next.js release — the reason for the `~` pin).

`@lingui/{core,react,cli,format-po}@^6` resolved 6.7.0 when the line was written. The family shipped **6.8.0** on 2026-09-23. So the split is now **two** minors, not one, and will be three the next time the family ships without the plugin following.

The number was never load-bearing; it was scene-setting for the reader running `npm ls`. That is exactly the kind of detail that goes stale silently, because nothing builds against it.

### 2. "verified by build … + core/react/cli/format-po `6.7.0`" — dated, and *its substance is intact*

This one deserves care, because the tempting fix — re-run the build on 6.8.0 and re-stamp the number — is more work than the question needs, and the cheap measurement answers it outright.

The verification's subject is the **plugin↔runtime contract**: does the macro transform emitted by plugin 6.6.0 still produce code that the installed `@lingui/core` / `@lingui/react` consume? I diffed the published tarballs rather than the repo, because dist is what installs:

```
npm pack @lingui/core@6.7.0 @lingui/core@6.8.0 @lingui/react@6.7.0 @lingui/react@6.8.0
```

| Package | `dist/` + `macro/` 6.7.0 → 6.8.0 |
|---|---|
| `@lingui/core` | **byte-identical.** `diff -r` clean on both directories. The only differences in the whole tarball are `version`, the two `@lingui/*` dependency pins and `gitHead` in `package.json`. |
| `@lingui/react` | **one line.** The shared chunk is renamed (`react.DZONiYSA.mjs` → `react.BfnMv8hy.mjs`) and differs by exactly the `formatElements` tag regex: |

```diff
-const tagRe = /<([a-zA-Z0-9]+)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9]+)\/>/;
+const tagRe = /<([a-zA-Z0-9_](?:[\w.-]*\w)?)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9_](?:[\w.-]*\w)?)\/>/;
```

4312 → 4340 bytes. The new pattern is a **strict superset** of the old one: every tag name matching `[a-zA-Z0-9]+` matches `[a-zA-Z0-9_](?:[\w.-]*\w)?`. This is the change the [2026-09-24 report](../2026-09-24.md) already measured and set aside as non-actionable, and it lives in `Trans` element interpolation — nowhere near the macro transform.

The upstream compare confirms it from the other side: in `lingui/js-lingui` `v6.7.0...v6.8.0` (8 commits, 124 files), the only files touched under `packages/core/` and `packages/react/` are `CHANGELOG.md`, `package.json`, `format.tsx` (+4/−1) and `format.test.tsx` (+67/−0). **No source change at all in `packages/core/`.**

**So the build described on L31 verified something that has not changed.** The sentence is stale in its version numbers, not in its finding. Re-running `next build` to re-stamp "6.8.0" would cost a full Next.js install and confirm what the tarball diff already shows.

## Why restating beats re-stamping

Re-stamping puts the line back where it started: correct until the next `@lingui/*` release, which for this family has been roughly monthly. L31 has now gone stale once; the fix that ends it is to state the **invariant** the reader needs and stop asserting a count.

What is actually invariant, and checked this run:

- `@lingui/swc-plugin@6.6.0`'s `peerDependencies` is `@lingui/core@5 || 6` — so the whole `^6` line is admitted, by construction, however far the family advances within 6.x. (Also true of 6.7.0; both read from the registry.)
- The plugin is pinned `~6.6.0` for a *host* reason (Next.js's bundled SWC plugin runner, L29), not a *family* reason. Those two facts are independent, and the line reads better when it says so.

## Suggested fix

Replace the count and the version list with the invariant. Something like:

> - **The pin is a split pin, and that is fine.** `@lingui/swc-plugin@~6.6.0` alongside `@lingui/core`/`@lingui/react`/`@lingui/cli` at `^6` means `npm ls` shows the plugin behind the rest of the family — the family ships more often than the plugin does, so expect the gap to widen. That is not a mismatch to repair: the plugin's own peer range is `@lingui/core@5 || 6`, which admits every `6.x` the family will publish, and the `~6.6.0` pin exists for a **host** reason (L29 — Next.js's bundled plugin runner), not a family one. Verified by build on Next.js 16.3.4 with plugin `6.6.0` and the `^6` family as it stood at `6.7.0`; `@lingui/core`'s published `dist/` is byte-identical at `6.8.0`, so that build still describes what `^6` installs. Do **not** pin the rest of the family back to `6.6.0` to "match" the plugin.

That keeps the verification honest (it names the version it was run on, which a verification note *should* do — see draft 19 §Fix step 4), states why it still applies, and removes the two things that rot: the count and the implication that the family version is part of the contract.

## Ship with

Draft `19-untracked-installed-and-gating-packages.md` §Fix step 3 is the identical failure — a hardcoded "current version" parenthetical in `webext/setup.add-ons.md` L227. Same one-line treatment, different file. Worth one PR touching both if nothing else is in flight on those files; **check open PRs by changed-file list first** (item 52). As of this run, `library-check/*` open PRs are #89, #88, #87, #84, #69, #67, #64, #63 — #89 touches `webext/setup.add-ons.md`, so the L227 edit must be rebased onto or folded into it rather than opened as a conflicting branch.

## Acceptance

- [ ] L31 no longer states a minor-version gap as a number.
- [ ] L31 still names the Next.js version and plugin version the build was run on.
- [ ] The reason for `~6.6.0` is attributed to the host runner, not to family compatibility.
- [ ] `webext/setup.add-ons.md` L227 gets the same treatment, without conflicting with #89.

---

**Still unfiled 2026-09-26.** Second consecutive run blocked on the same `401 Bad credentials` from `library-checks/.github-token` (unchanged since 2026-08-25). Re-checked this run with an unauthenticated control on the same repo in the same call returning `200`, so egress is fine and the credential is not. The duplicate check in this draft was re-run against the 11 open PRs today and still holds.

---

**Still unfiled 2026-09-27.** Third consecutive run blocked on the same `401 Bad credentials` from `library-checks/.github-token` (mtime still 2026-08-25 17:27:18Z). Re-checked this run with an unauthenticated control on the same repo in the same call returning `200`, so egress is fine and the credential is not. The duplicate check in this draft was re-run against the 11 open PRs today (unchanged set) and still holds.

---

**Still unfiled 2026-09-28.** Fourth consecutive run blocked on the same `401 Bad credentials` from `library-checks/.github-token` (mtime still 2026-08-25 17:27:18Z); an unauthenticated control on the same repo in the same call returned `200`, so egress is fine and the credential is not. Re-checked this run against the unchanged set of 11 open PRs and 25 open issues on `main` `a997b6d`; the duplicate checks in this draft still hold.

**Still unfiled 2026-09-29.** Fifth consecutive run blocked on the same `401 Bad credentials` from `library-checks/.github-token` (mtime still 2026-08-25 17:27:18Z); an unauthenticated control on the same repo in the same call returned `200`, so egress is fine and the credential is not. **The repo moved this run**: `main` is now `f4f71a1` ([#84](https://github.com/globalize-now/globalize-skills/pull/84) merged, 2026-09-28T07:07Z) and the open-PR set is **10**, not 11. The duplicate checks in this draft were re-run against that set and against `main` `f4f71a1`, and still hold.

**Still unfiled 2026-09-30.** **Sixth** consecutive run blocked on the same `401 Bad credentials` from `library-checks/.github-token` (mtime still 2026-08-25 17:27:18Z); an unauthenticated control on the same repo in the same call returned `200`, so egress is fine and the credential is not. `main` is **unchanged** at `f4f71a1`, and the open set is unchanged at **10 PRs / 25 issues**, so the duplicate checks in this draft carry forward on the same baseline they were last verified against. Re-derived rather than carried (item 61): `@lingui/swc-plugin` pinned `~6.6.0` resolves **6.6.0**, family `latest` is **6.8.0** — still **two** minors, so this draft's title is still correct. (Not to be confused with the plugin's own `latest` 6.7.0, which is one minor behind the family; different comparison, same packages.)

**Still unfiled 2026-10-02.** **Ninth** consecutive run blocked on the same `401 Bad credentials` from `library-checks/.github-token` (mtime still 2026-08-25 17:27:18Z, 38 days); an unauthenticated control on the same repo in the same call returned `200`, so egress is fine and the credential is not. **The count moved, and it moved exactly as this draft predicted.** Re-derived rather than carried (item 61), from the registry this run: `@lingui/swc-plugin@~6.6.0` resolves **6.6.0** (`6.6.0` is still the only published `6.6.x`), and the `@lingui/{core,react,cli,format-po}@^6` family shipped **6.9.0** on 2026-10-01T14:51Z without the plugin following — `@lingui/swc-plugin`'s own `latest` is unchanged at `6.7.0`. So the split is now **three** minors, not two, which is the sentence L25 of this draft wrote on 2026-09-25: *"will be three the next time the family ships without the plugin following."* That happened yesterday.

**This does not change the draft's finding or its proposed rewrite** — it confirms it. The rewrite deliberately removed the number ("shows the plugin behind the rest of the family — the family ships more often than the plugin does, so expect the gap to widen") precisely so that this run would not have to re-stamp it, and that is now demonstrated rather than argued: a patch that said "one minor" would have been wrong twice in eight days. **The title of this draft is now itself slightly stale** — "pin count stale" was written when the live number was wrong by one; it is wrong by two. The title needs no change, but a reviewer reading it should know the skill's L31 still says "one minor behind".

**Unaffected by 6.9.0's headline change.** [Draft 28](./28-lingui-6-9-native-macro-transform.md) covers `@lingui/vite-plugin@6.9.0`'s native macro transform, which removes the need for `@lingui/swc-plugin` on **Vite**. It does nothing for this draft: `nextjs/app-router/lingui.setup.md` is a Next.js stack with no Vite plugin in it, the `~6.6.0` pin exists because `6.7.0`'s `swc_core@77.1.1` outruns every Next.js plugin runner, and nothing in the 6.9.0 train touched `@lingui/swc-plugin` or the Next.js path. The split pin stays, and so does the reason for it.

**Duplicate checks re-run on the new baseline.** `main` moved this window to **`7d85ace`** (#87, #88, #89 merged, 2026-10-01T15:25–19:29Z) and the open set is now **8 PRs / 26 issues** (new: PR #91, issue #90). None of the three merged commits touched `nextjs/app-router/lingui.setup.md` — the 10 files they changed are the react-router-framework, remix, vue-i18n, webext and lingui add-ons references. The duplicate checks in this draft hold on `7d85ace`.

---

**Still unfiled 2026-10-03.** Tenth consecutive run blocked on the same `401 Bad credentials`. **The split is unchanged at three minors and the carried claim holds:** `@lingui/*` family `latest` **6.9.0** (no publish in this run's window — the 6.9.0 train was 10-01), `@lingui/swc-plugin` `latest` still **6.7.0** (`next` still `6.0.0-next.3`, did not follow the train for a second day), and `~6.6.0` still resolves **6.6.0**. The App Router pin is therefore still three minors behind the family. Checked against `main` `48a676ae`; #91 touched no Lingui pin (its two `lingui.setup.md` edits are both in the *Locale Routing Strategy* section, +2/-0 each, a Capacitor skip note).
