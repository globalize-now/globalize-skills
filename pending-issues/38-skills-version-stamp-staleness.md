# Eleven version stamps in `skills/` are stale, nobody could have known, and the instrument that finds them now exists

**Draft written:** 2026-10-13 (library check). **Unfiled** — the GitHub MCP connector is absent for an
eleventh consecutive run and the PAT returns `401 Bad credentials` (token untouched for 49 days), so no
issue or PR could be opened. See § Filing.

**Type:** **ISSUE** for the six stamps that are not already queued, and that classification is the
substance of this draft rather than a fallback — see § Why this is an issue and not a PR. The
**instrument is already shipped**: `library-checks/stamp-check.py`, installed this run. `library-checks/`
is gitignored (`/library-checks/` in `.gitignore`), so the tooling half of open item 87 needed no write
path and is done.

**Severity:** Low as breakage — nothing fails to build, and **every claim checked so far is still
substantively TRUE**. Medium-high as trust, for the reason 2026-10-12 named: a stale stamp does not
merely age, it manufactures a false alarm. `setup.add-ons.md:208` tells a reviewer that a grep "returns
nothing"; at `0.11.0` it returns two files. The reader who re-runs the stated check gets a result the
page says they will not get, and reasonable cause to doubt a claim that is correct.

**Verified:** 2026-10-13, against `origin/main` `48a676ae` in a fresh `--depth 1` clone, the 38 npm
packuments read twice this run (dist-tag maps asserted byte-identical, `sha256 7763259a6bdced3f`),
`@herb-tools/linter`'s packument, and `rubygems.org/api/v1/versions/erb_lint.json` via `WebFetch`.

**Related:** open item **87** (2026-10-12) asked for exactly this and named it cheap: *"a grep of
`skills/` for the stamped versions of tracked packages as part of (B) … is cheap and does not need a
decision from anyone."* It was cheap in effort and not at all cheap in correctness — see § Two defects
I shipped into my own instrument. Open item **75** (the placeholder form) is the other half of 87 and is
still undone, now overdue on four drafts. Open item **86**'s `npmTwins` alias is load-bearing here.
Issue [#71](https://github.com/globalize-now/globalize-skills/issues/71) is the general form again.

---

## What this is, in one paragraph

A **stamp** is prose asserting that a measurement was taken *at* a version: *"verified against the
linter's rule directory at `v0.10.4`"*, *"Measured on `@lingui/cli@6.8.0`"*. It creates a standing
maintenance obligation, and until today **nothing in this check could see that obligation come due.**
Levels 1–3 watch manifest specs, declared ranges and resolutions; category 4 watches install lines;
category 5 watches pinned CDN URLs. None of them reads prose. Both Herb stamps went stale for eighteen
days (draft 37), the three `web-ext` stamps for twenty-two (draft 22), and in both cases a human found
them by hand, late, while reading something else.

`stamp-check.py` reads them mechanically. On `main` `48a676ae` it reports **11 stale stamps across 7
files, with zero false positives on inspection of all 11.**

## The two things that make it work, because the plain grep does not

**1. A stamp is not a floor.** `grep` for a version near a package name and most of what comes back is
a **floor** or **gate** claim — *"backward-compatible **since** `@swc/core` 1.15.0"*,
*"`@vitejs/plugin-react@6.0.0` **dropped** the `babel` option"*. A floor names the version at which
something **changed**. It is permanently true and never ages; re-stamping one would be a regression.
The first cut of this instrument reported 41 "stale stamps" and most were floors. Separating them is a
verb test — `verified against` / `as of` / `measured on` age; `since` / `dropped` / `requires` / `≥` /
`fails on` do not — and today's run splits cleanly: **STAMP 11, FLOOR 69, BOTH 1, OTHER 9.** The BOTH
and OTHER buckets are **counted and printed**, not dropped, so the recall gap stays visible instead of
being reported as clean.

**2. Nearest-name attribution is wrong, and wrong silently.** `rails.convert.md:91`:

> … is the intended replacement for `erb_lint`. **As of `v0.10.4` (2026-09-10)**, Herb's rule set covers …

`erb_lint` ends **10** characters before the version; `Herb` starts **16** after it. Nearest-token hands
the stamp to `erb_lint`, whose latest is `0.9.0`, concludes that `0.10.4` is **newer** than latest, and
drops the row as a non-finding. **That is a false negative on one of the two stamps open item 87 was
written about** — the instrument built to catch a specific defect, missing that exact defect, quietly.

The fix is measured, not grammatical: **a stamp of `0.10.4` is a stamp of whichever package actually
published `0.10.4`.**

| name | published `0.10.4`? | source |
|---|---|---|
| `erb_lint` | **no** — 46 releases, `0.0.4` … `0.9.0` | `rubygems.org/api/v1/versions/erb_lint.json`, `WebFetch`, 2026-10-13 |
| `herb` | **yes** | `@herb-tools/linter` packument (open item 86's twin), re-verified agreeing this run |

Attribute by containment. A tie reports `ambiguous`, a name with no version list reports
`unresolvable`; **both are printed and neither is guessed.** Bare names also match case-insensitively on
word boundaries, because prose capitalises a project (`Herb`) while the registry does not (`herb`) — and
gem names match through their `npmTwins` alias, which is the second thing open item 86 has now paid for.

## Validation: two known answers, both hit

The instrument was pointed at a tree whose stale stamps were partly known from weeks of hand analysis:

| what it found | already queued as | written |
|---|---|---|
| `rails/setup.add-ons.md:208`, `rails/rails.convert.md:91` — `herb` `0.10.4` → `0.11.0` | **draft 37** | 2026-10-12 |
| `webext/lingui.setup.md:423`, `webext/swc/lingui.setup.md:421`, `webext/setup.add-ons.md:251` — `web-ext` `10.6.0` → `10.7.0` | **draft 22** | 2026-09-27 |

**Five of eleven findings are drafts a human wrote by hand, up to sixteen days earlier, and the
instrument re-derived all five from a grep and a version list.** Draft 22's patch hunks land at L420,
L418 and L248 — the same three lines. That is the strongest evidence available here that the remaining
six are real too, and it is why this draft does not hedge them.

## The eleven, and who owns each

| # | file:line | package | stamped | today | status |
|---|---|---|---|---|---|
| 1 | `ruby/…/rails/setup.add-ons.md:208` | `herb` | 0.10.4 | **0.11.0** | **draft 37** — patched, ready for review |
| 2 | `ruby/…/rails/rails.convert.md:91` | `herb` | 0.10.4 | **0.11.0** | **draft 37** — patched, ready for review |
| 3 | `js-ts/…/webext/lingui.setup.md:423` | `web-ext` | 10.6.0 | **10.7.0** | **draft 22** — patched, ready for review |
| 4 | `js-ts/…/webext/swc/lingui.setup.md:421` | `web-ext` | 10.6.0 | **10.7.0** | **draft 22** — patched |
| 5 | `js-ts/…/webext/setup.add-ons.md:251` | `web-ext` | 10.6.0 | **10.7.0** | **draft 22** — patched |
| 6 | `js-ts/…/next-intl/po-format.setup.md:136` | `next-intl` | 4.9.1 | **4.14.9** | **NEW — unowned.** Five minors. |
| 7 | `js-ts/…/paraglide/json-format.setup.md:67` | `@inlang/plugin-icu1` | 1.1.0 | **1.3.2** | carried as an (F) head since 2026-10-12, never drafted |
| 8 | `js-ts/…/lingui/setup.add-ons.md:303` | `@lingui/cli` | 6.8.0 | **6.9.1** | **NEW — unowned.** |
| 9 | `js-ts/…/lingui/setup.add-ons.md:353` | `@lingui/cli` | 6.8.0 | **6.9.1** | **NEW — unowned.** |
| 10 | `js-ts/…/nextjs/app-router/lingui.setup.md:31` | `@lingui/core` | 6.6.0 / 6.7.0 | **6.9.1** | **draft 20**'s line, and draft 20 has **no patch** |
| 11 | `js-ts/…/nextjs/app-router/lingui.setup.md:65` | `@lingui/babel-plugin-lingui-macro` | 6.6.0 | **6.9.1** | **NEW — unowned.** |

**Four entirely new findings** (6, 8, 9, 11), one long-carried head finally in a draft (7), one handed to
a draft that needs a patch it does not have (10) — from a run whose entire registry movement was one
TypeScript nightly.

## Why this is an issue and not a PR

**Because the number is not the claim; the measurement is.** Each of these lines records an
experiment — a `next build` on Pages Router with `precompile: true`, a `lingui extract` against a
cleanly-extracted per-page project, a `web-ext lint` on an extension with an empty default catalog.
Advancing `6.8.0` to `6.9.1` without re-running that experiment converts a **stale but honest** claim
into a **fresh-looking false** one, and removes the only signal that it needs checking. That is strictly
worse than leaving it stale, and it is the one thing this instrument must never be used to automate.

Draft 22 is the model for how one is actually fixed, and it is instructive how much work it took: it did
not re-stamp `web-ext@10.6.0` → `10.7.0`. It read `addons-linter@10.13.0`'s
`src/parsers/manifestjson.js` from source, established that the behaviour is **structural** rather than
a property of any release, and rewrote the claim so it no longer needs a stamp at all. **That is the
shape of the fix, and it is one draft's worth of work per stamp.** Six stamps is six drafts, each needing
a build this sandbox can host; they are not one patch and should not be pretended into one.

What *is* shippable today is the instrument, and it is shipped.

## Fix

1. **Done this run:** `library-checks/stamp-check.py` installed; `gemVersionLists` added to
   `.last-versions.json` (`herb`, `erb_lint`), because gem version lists cannot be derived from the
   packuments and `rubygems.org` is unreachable from both sandboxes (open item 64).
2. **Run it every day as part of (B)**, against the fresh clone — **never** the mounted checkout, which
   is `ac59bc3` and 26 commits behind (open item 49). Measured this run: the mounted checkout reports
   **2** stale stamps where `main` reports **11**.
3. **Report the count, and name every new stamp**, so a stamp going stale is a daily finding rather than
   a discovery made sideways eighteen days later.
4. **Fix the six unowned stamps one at a time**, each by re-running its own measurement, cheapest first:
   7 (the import path was already re-measured byte-identical across six plugin versions on 2026-10-12 —
   this is the one where the evidence already exists and only outcomes 2 and 3 need re-running), then
   11, then 8/9, then 6, then 10 with draft 20.
5. **Do not skip open item 75.** This instrument makes a stale stamp *visible*; it does not make the
   obligation smaller. The placeholder form is still the thing that stops the rot.

## Two defects I shipped into my own instrument, both caught, both worth recording

**(a) A bare `except` reported a clean answer from a comparison that raised on every row.** The first
version's `_parts()` ended `(0,)*(3-len(v.split('.')[:3].__len__()))` — `len()` of an `int`, a
`TypeError` on **every call**. It sat inside `except Exception: continue`, so the instrument printed
**"STALE STAMPS: 0"** and `rc=0`. A confident clean answer from a wholly broken check: open item 21's
failure mode, in brand-new code written the day after open item 85 recorded the same shape.
**The comparison failures are now collected, printed and `assert`ed to be zero.**

**(b) A `| head` on the run that writes the output file.** `python3 stamps.py 2>&1 | head -4` closes the
pipe, `SIGPIPE` kills the script before it writes its JSON, and the next command reads the **previous**
run's file. Two fixes were diagnosed as not working when they were working. 2026-10-11 recorded exactly
this for `source … | head` returning a fake `rc 127`; the lesson did not generalise because it was filed
as a fact about `source`. **It is a fact about `| head` and any command with side effects.**

## Acceptance

- [ ] `stamp-check.py` runs in every scan, against the fresh clone, and its stale count appears in the report.
- [ ] A **new** stale stamp is reported as a finding on the day it appears, not on the day someone notices.
- [ ] The six unowned stamps (6, 7, 8, 9, 10, 11) each get a re-measurement and a patch, or get rewritten so they need no stamp (draft 22's shape).
- [ ] Draft 20 gets a patch, or is explicitly merged into the stamp work.
- [ ] Open item 75's placeholder form is decided one way or the other.
- [ ] The FLOOR/OTHER buckets are spot-checked once by a human — this draft asserts zero false positives on the 11 STAMP rows, not zero false **negatives** among the 78 others.

## Filing

Not filed. Both write paths dead, twenty-first consecutive check:

- **GitHub MCP connector — absent.** `ToolSearch "select:mcp__GitHub__get_me,…create_branch,…push_files,…create_pull_request,…create_issue,…list_pull_requests,…list_branches,…get_file_contents"` → **"No matching deferred tools found"**; a deliberately loose `"+github create pull request branch repository commit"` returns only `Monitor` and `WebFetch`. There is no tool to call, so the `create_branch` write probe **cannot be attempted** — which is a different failure from `403 Resource not accessible by integration`, and the distinction decides the fix: the server needs **attaching**, not re-scoping. Eleventh run absent.
- **PAT — `401 Bad credentials`.** `lc_have_token` → `rc 1`, probed once and without a pipe. Token file readable, 93 chars, `github_pat_11A…`, mtime **2026-08-25T17:27:18Z — 49 days**. Authenticated `GET /repos/globalize-now/globalize-skills` → **401**; the same URL **unauthenticated** → **200** (`default_branch` main, `pushed_at` 2026-10-02T10:15:31Z), so egress is fine and the credential is not. `GH_TOKEN` unset in the device shell. A third probe this run: `gh auth status` in the cloud container reports *"The token in GH_TOKEN is invalid"* — so the container's preconfigured `gh` is not a third write path either.
