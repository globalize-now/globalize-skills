# 37 — Herb's rule set moved 18 days ago and the gem check never saw it; two stamped claims in the Rails skill are stale (the claims themselves still hold)

**Status:** PR-shaped, **ready for review**. Unfiled — no write path on 2026-10-12 (connector absent for the tenth run, PAT `401`).
**Patch:** [`37-herb-0-11-0-rule-set-stamps-stale.patch`](./37-herb-0-11-0-rule-set-stamps-stale.patch) — **2 files, `+2/-2`**, `git apply --check` clean on `main` `48a676ae`.
**Target:** `main`.
**Branch to use when a write path exists:** `library-check/herb-0-11-0-stamps`.
**Overlap:** **disjoint from all fourteen** other `main`-targeted patches (21, 22, 23, 25, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36) — verified on `+++ b/` **full paths**, per open item 82. It is the only patch in the queue that touches `references/languages/ruby/`.
**Found:** 2026-10-12, by the gem leg of the daily scan — 18 days late. See "Why this is 18 days old".

## What moved upstream

`herb` **0.11.0**, published **2026-09-24T14:20:28.191Z** (`ruby` platform; eleven platform builds, 14:19:47Z–14:20:28Z). No yank on either 0.10.4 or 0.11.0. The npm twin **`@herb-tools/linter@0.11.0`** published **2026-09-24T14:32:54.372Z**, ~12 minutes after the gem.

Read from the package, not from a release note — the npm tarballs for `0.10.4` and `0.11.0` were extracted and their `src/rules/` directories enumerated and grepped:

| | `v0.10.4` | `v0.11.0` |
|---|---|---|
| `src/rules/*.ts` files | **107** | **171** |
| added | — | **69** |
| removed | — | **5**, all shared utility modules (`action-view-utils.ts`, `file-utils.ts`, `prism-rule-utils.ts`, `rule-utils.ts`, `string-utils.ts`) |
| filenames matching `i18n\|hardcode\|locale\|translat` | **0** | **0** |
| files whose *contents* match those terms | **0** | **2**, both unrelated |

Prefix histogram at `0.11.0`: `erb` 50, `html` 48, `herb` 29, `actionview` 22, `a11y` 10, `ujs` 5, `turbo` 2, `svg` 2, plus `index.ts`, `parser-*`, `source-*`.

**The two content matches are false positives, and naming them is the point** — the next person to re-verify this claim will hit the same two files:

- `erb-strict-locals-required.ts:77` — `locals.sort((left, right) => left.name.localeCompare(right.name))`. `localeCompare` is a `String` method.
- `herb-config-framework-option.ts:46` — `"translate"`, one entry in an `AMBIGUOUS_HELPERS` set of **ActionView helper names** (`t`, `translate`, `render`, `tag`, `raw`, `select`, `submit`, …) that the rule refuses to resolve. It is a `.herb.yml` config rule, not a lint for unlocalized text.

## Why the skill needs to change

Two **version-stamped** claims about Herb, both in the Rails stack, both stale:

1. `skills/globalize-guide/references/languages/ruby/frameworks/rails/rails.convert.md` L91 — *"As of `v0.10.4` (2026-09-10), Herb's rule set covers a11y, ActionView, and ERB formatting"*. The rule set now also covers HTML, Turbo, UJS, SVG and Herb's own component/state directives.
2. `skills/globalize-guide/references/languages/ruby/frameworks/rails/setup.add-ons.md` L206 — *"verified against the linter's rule directory at `v0.10.4` (2026-09-10), where 107 rule files contain no `i18n`, `hardcode`, `locale` or `translat` rule"*. Both the version and the **107** are now wrong, and the grep result is no longer "nothing": at `0.11.0` a content search returns two files.

**The recommendation itself is unchanged and re-verified: Herb still ships no hardcoded-string or i18n rule, so `erb_lint`'s `HardCodedString` is still the ERB discovery tool.** This patch refreshes the evidence behind that recommendation; it does not change it. A reviewer who re-runs the check at `0.11.0` and finds two grep hits would otherwise have reason to doubt a claim that is in fact still true — which is exactly the failure mode a stale stamp produces.

## Files touched

- `skills/globalize-guide/references/languages/ruby/frameworks/rails/rails.convert.md` — `+1/-1`
- `skills/globalize-guide/references/languages/ruby/frameworks/rails/setup.add-ons.md` — `+1/-1`

## How it was verified

- **Patch generated and checked in a fresh `--depth 1` clone of `main`** at `48a676ae`, never in the mounted working copy. Two-pass replacement script: pass 1 asserted both anchors present **exactly once** and the replacement text **absent**, and wrote nothing; pass 2 edited. `git apply --check` clean, re-checked a second time from the patch's installed location under `library-checks/pending-issues/`.
- **Evals.** The touched files are Rails reference docs with no eval coverage (see below), so the three standalone verifiers were run on clean `main` and on `main`+37 and compared: `verify-manifest.sh` **6 passed / 0 failed / 0 warnings**, `verify-format-helpers.sh` **99/0/0**, `verify-rules-template.sh` **114/0/0** — **identical both ways**. `bash -n` clean on all 14 `evals/*.sh` + `evals/library-checks/*.sh`. The other four verifiers require a scaffolded project (`Usage: … <workdir> <fixture>`) and cannot run standalone (open item 21).
- **Eval coverage of this finding: none.** `grep -rilF` over `evals/` and `fixtures/` for `herb`, `herb-tools`, `HardCodedString`, `erb_lint`, `0.10.4`, `0.11.0` → **0 files each**. The suite could not have caught this and cannot regress on the correction. Ninth consecutive finding in territory the suite asserts nothing about.

## Why this is 18 days old — the part worth more than the patch

The gem leg of this check reads `https://rubygems.org/api/v1/versions/<gem>/latest.json` through `WebFetch` (open item 64 — `rubygems.org` is unreachable by direct HTTP from **both** sandboxes: `curl` returns `000` from the device shell and `CONNECT tunnel failed, response 403` from the cloud container). Every run from 2026-09-25 to 2026-10-11 recorded `herb` as **0.10.4**, `version_created_at` **2026-09-10T07:40:02.278Z**, and asserted it identical to the previous run.

Today, measured on the same URL, three ways:

| probe | answer |
|---|---|
| `api/v1/versions/herb/latest.json` | **0.11.0** |
| `api/v1/gems/herb.json` | **0.11.0**, `version_created_at` **2026-09-24T14:20:28.191Z** |
| `api/v1/versions/herb.json`, full list | 0.11.0 (11 platform builds, 2026-09-24), 0.10.4 (11 builds, 2026-09-10), no yank field on either |
| the other four tracked gems, full version lists | all agree with the baseline — `rails-i18n` 8.1.0, `i18n-tasks` 1.1.2, `erb_lint` 0.9.0, `rubocop-i18n` 3.3.0 |

**The root cause of the 18-day lag is not established, and this draft does not claim one.** Both rubygems endpoints agree *today*; what they returned on 2026-09-25 cannot be re-measured from here, and `WebFetch`'s cache is 15 minutes, not 18 days. Only `herb` was affected, so it is not a systematic failure of the endpoint for this check's gem set.

**What is established is the detection gap, and it is fixable.** `@herb-tools/linter` publishes the same upstream release to **npm**, within ~12 minutes, over a transport both sandboxes reach directly and that this check already fetches 38 packuments from every day. For 18 days there was a second, independent, fully-reachable signal that the check never looked at. The hardening is recorded in the baseline as `npmTwins` (**open item 86**) rather than by adding `@herb-tools/linter` to the 33-package tracked set, which would disturb `depRanges`, the item-74 key-set guard and the reconciliation categories for no gain.

## Needs a human

Nothing blocks this patch — it is a two-line evidence refresh behind an unchanged recommendation, measured end to end. Two questions are for you and are **not** reasons to hold it:

1. **The `npmTwins` cross-check is one row deep.** `herb` → `@herb-tools/linter` is the only tracked gem with an npm twin. If you would rather the gem leg read the full `api/v1/versions/<gem>.json` list and take the max itself, instead of trusting `latest.json`, that is a change to the check and not to the repo. Draft [`18-rubygems-check-false-negative.md`](./18-rubygems-check-false-negative.md) is the home for it and has been updated with this instance.
2. **`setup.add-ons.md` tells the reader to "watch for" a Herb i18n rule.** `0.11.0` added 69 rule files and none is one, which is mild evidence the project is not heading there soon. If you want that watch dropped or given an owner, say so; this patch leaves the sentence alone.
