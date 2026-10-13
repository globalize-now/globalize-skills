# The RubyGems half of the daily library check reported a false "unchanged" for `herb` for 43 days

**Labels:** `chore`, `library-check`

**Severity:** Medium as a *check-integrity* defect — the tracker's job is to notice movement, and here it confidently reported no movement while a tracked gem shipped two releases. Low as a *content* defect: nothing in the skills needed to change, and the claim the gem is tracked for is still true.

**Verified:** 2026-08-25 (second run of the day, ~17:00Z), against three independent RubyGems sources and the upstream release notes and rule tree at `v0.10.3`.

---

## Summary

`library-checks/.last-versions.json` records:

```json
"herb": "0.10.1"
```

and every report since has asserted the five tracked gems are byte-identical to that snapshot — most recently [2026-08-25](../2026-08-25.md#what-moved):

> All five gems return `version_created_at` identical to the stored snapshot: … `herb` 0.10.1 (2026-04-24).

That is wrong, and has been since **2026-07-13**. The true state:

| Version | Released |
|---|---|
| 0.10.1 | 2026-04-24T07:36:35.575Z ← the stored baseline |
| **0.10.2** | **2026-07-13T01:35:34.642Z** |
| **0.10.3** | **2026-08-01T13:26:19.020Z** ← current `latest` |

Three sources agree, queried this run: `https://rubygems.org/api/v1/gems/herb.json` (`version` = `0.10.3`, `version_created_at` = `2026-08-01T13:26:19.020Z`), `https://rubygems.org/api/v1/versions/herb.json` (80 entries across 8 distinct version numbers; the eight platform-variant rows for 0.10.3 all stamped 2026-08-01), and the rendered gem page `https://rubygems.org/gems/herb` ("Version 0.10.3 — August 01, 2026"). The other four gems re-verified correct against the same two endpoints: `rails-i18n` 8.1.0 (2025-11-24), `i18n-tasks` 1.1.2 (2025-11-27), `erb_lint` 0.9.0 (2025-01-20), `rubocop-i18n` 3.3.0 (2026-04-10).

So the drift is specific to one gem, and the check was right about the other four on the same runs it was wrong about this one.

## What the miss did and did not cost

**Did not cost anything in the skills.** `herb` is tracked for exactly one reason, stated in `skills/globalize-guide/references/languages/ruby/frameworks/rails/setup.add-ons.md` L205–211 and echoed in `rails.convert.md` L91:

> as of June 2026, Herb does not ship a hardcoded-string or i18n rule … When Herb gains an i18n/hardcoded-string rule, it will become the preferred tool for ERB i18n linting — watch for that.

That watch was re-run properly this time, against the code rather than the release titles. Neither missed release contains it:

- **v0.10.2** (2026-07-13) — six new rules, all `a11y-*` (`a11y-no-redundant-image-alt`, `a11y-disabled-attribute`, `a11y-avoid-generic-link-text`, `a11y-svg-has-accessible-text`, `a11y-no-aria-label-misuse`, `a11y-nested-interactive-elements`).
- **v0.10.3** (2026-08-01) — two new rules, `erb-no-commented-out-output-tags` and the re-enabled `html-no-space-in-tag`; the rest is parser/formatter/CLI work.

And directly against the rule tree at the tag, rather than against the notes: `javascript/packages/linter/src/rules` @ `v0.10.3` holds **107 entries**, and filtering the names for `i18n`, `hardcode`, `locale`, `translat` or `string` matches exactly one file — `string-utils.ts`, a shared helper, not a rule. **The skill's claim is still accurate at 0.10.3.** No skill edit follows from this; the "as of June 2026" hedge could be re-stamped to "verified against v0.10.3" but that is cosmetic.

**Did cost the tracker its credibility on gems.** For 43 days the report asserted a positive fact ("identical to the stored snapshot", with a date) that was not checked. Had 0.10.2 or 0.10.3 contained the i18n rule the skill is waiting for, this check would have sailed past the one event it exists to catch, and said "clean" while doing it.

## Probable mechanism, and the part that is not guessable

`curl` cannot reach `rubygems.org` from the task sandbox — every request fails with `curl: (56) Received HTTP code 403 from proxy after CONNECT`, reproduced this run from both the device shell and the cloud container. The gem half of the check therefore runs through `web_fetch`, which returns a *small model's prose summary* of the JSON rather than the JSON itself.

That is the difference between the two halves of this check. npm goes over `curl` and is diffed field-by-field in code; RubyGems goes over a summariser and is diffed by reading a sentence. The npm half has not produced a false negative; the gem half now has. Of the five gems, `herb` is by a wide margin the largest and most repetitive document — 449 published versions, eight platform variants per release, so the newest ~80 rows of `/versions/herb.json` are near-identical strings differing only in `platform` — which is exactly the shape that invites a summariser to collapse rows or answer from the wrong one.

What is *not* determinable after the fact is which run first got it wrong, or whether it was wrong the same way each time: the responses were never stored, only their summaries, and `library-checks/` is gitignored so there is no history to diff. That is itself part of the finding.

## Fix

The point is not "be more careful with `web_fetch`" — it is that an unstructured summary should not be the sole evidence for a negative result.

1. **Cross-check every gem against two endpoints** — `/api/v1/gems/<gem>.json` *and* `/api/v1/versions/<gem>.json` — and treat disagreement as a finding rather than picking one.
2. **Ask for values, never for a verdict.** The prompt must request the literal `version` / `version_created_at` strings; the comparison against the baseline happens in code, on strings, not in the summariser's head. "Confirm these five gems are unchanged" is an invitation to agree.
3. **Never report a gem as unchanged without a date that was read this run.** A version number that matches while its date is absent is not evidence of anything.
4. **Record the raw values in the report** (both endpoints, per gem), so the next run can diff against something concrete instead of against prose.
5. Longer-term, the honest fix is a real transport: the RubyGems host is blocked at the proxy while `registry.npmjs.org`, `api.github.com` and `raw.githubusercontent.com` are not. Allowlisting `rubygems.org` would let the gem half run over `curl` like the npm half and delete this whole failure mode. This is the second standing config gap, alongside the GitHub write path.

## Related

Sibling to open item 13 (tracking-set drift, npm side): `herb` is tracked by the library check but does not appear in `manifest.json`'s Rails `gems` block, which lists `rails-i18n` / `i18n-tasks` / `erb_lint` / `rubocop-i18n`. That absence is *deliberate* — the skill deliberately does not recommend Herb — but it means the gem is watched purely on the strength of a prose sentence in `setup.add-ons.md`, with nothing structural tying the watch to the tracker. Worth folding into item 13's accounting rather than tracking separately.

## Acceptance

- [ ] `.last-versions.json` records `herb` at `0.10.3` with its real release date. *(Done in the 2026-08-25 second run; the baseline is device-local and gitignored, so this box is bookkeeping, not a code change.)*
- [ ] The gem check reads two endpoints per gem and compares literal strings in code.
- [ ] Reports carry the per-gem `version` + `version_created_at` actually read that run.
- [ ] Decision recorded on whether to re-stamp the "as of June 2026" Herb hedge in `setup.add-ons.md` L207 and `rails.convert.md` L91 to name the version it was last verified against.

---

Filed: https://github.com/globalize-now/globalize-skills/issues/66 (2026-08-26) for the check-integrity half — an issue rather than a PR because every fix step lands in `library-checks/`, which is gitignored, so there is no file in this repo to change. Steps 1-4 were applied task-side this run; step 5 (allowlist `rubygems.org` at the proxy) is the only one that needs someone with egress access, and is why the issue stays open. The one repo-side acceptance box — re-stamping the "as of June 2026" hedge — shipped as https://github.com/globalize-now/globalize-skills/pull/65, ready for review, after re-verifying the rule tree at `v0.10.3` (107 entries, only `string-utils.ts` matches) this run rather than trusting yesterday's check.

---

## RECURRENCE 2026-10-12 — the same gem, the same failure mode, 18 days this time

**This draft's issue (#66) is still open, and the defect it describes happened again on the same gem.** First occurrence: `herb` reported unchanged for **43 days** across two releases (2026-08-25). Second occurrence: `herb` reported **0.10.4** on every run from 2026-09-25 to 2026-10-11 while **0.11.0** had been the published latest since **2026-09-24T14:20:28.191Z** — **18 days**.

Measured 2026-10-12, same `WebFetch` transport the check has always used:

| probe | answer |
|---|---|
| `api/v1/versions/herb/latest.json` | **0.11.0** |
| `api/v1/gems/herb.json` | **0.11.0**, `version_created_at` **2026-09-24T14:20:28.191Z** |
| `api/v1/versions/herb.json` (full list) | 0.11.0 and 0.10.4, 11 platform builds each, **no yank field on either** |
| `rails-i18n` / `i18n-tasks` / `erb_lint` / `rubocop-i18n`, full version lists | all four agree with the baseline — **not** a systematic endpoint failure |

**Root cause still not established, and this recurrence narrows why that matters less than it looks.** Both rubygems endpoints agree today; what they returned on 2026-09-25 cannot be re-measured. `WebFetch`'s cache is 15 minutes. Only `herb` was affected, both times. Step 5 of this draft's acceptance list — allowlist `rubygems.org` at the proxy so the gem leg can be read directly and asserted like the npm leg — remains the fix, and remains the only step needing egress access. **Re-confirmed on both sandboxes this run:** device shell `curl` → `000`; cloud container `curl` → `CONNECT tunnel failed, response 403`. Open item 64.

**What changed today is that a second, already-paid-for signal was found.** `@herb-tools/linter` publishes the same upstream release to **npm** within ~12 minutes of the gem (`0.11.0` at **2026-09-24T14:32:54.372Z**), over `registry.npmjs.org` — which this check fetches 38 packuments from every single run, on a transport both sandboxes reach directly and assert on. For 18 days the answer was one packument away. Recorded in the baseline as `npmTwins` and as **open item 86**; deliberately **not** added to the 33-package `distTags` set, which would disturb `depRanges`, item 74's key-set guard and the reconciliation categories for no gain.

**And the repo-side acceptance box this draft closed has re-opened.** The one box that shipped as PR #65 was *"re-stamp the Herb hedge to name the version it was last verified against"*. That stamp — `v0.10.4` (2026-09-10), **107 rule files** — is what went stale, in both `rails.convert.md` L91 and `setup.add-ons.md` L206, and is what **draft 37** now refreshes to `v0.11.0` / **171**. A concrete stamp is the right shape for a claim whose whole content is *"we checked, at this version"* — but it buys a maintenance obligation, and this is the second time that obligation has gone unmet because the gem check was the thing meant to raise the flag. **Open item 75's placeholder form is the structural answer; it is now overdue on four drafts (29, 35, the stamps inside 25, and these two Herb claims).**

### Additional acceptance, 2026-10-12

- [ ] The gem leg reads the full `api/v1/versions/<gem>.json` list and takes the maximum itself, rather than trusting `latest.json`.
- [ ] `npmTwins` is read and compared on every run, and a gem/npm disagreement is reported as an instrument finding.
- [ ] A decision on open item 75's placeholder form for version-stamped claims, so a stale stamp is a scan hit rather than a reading error.
