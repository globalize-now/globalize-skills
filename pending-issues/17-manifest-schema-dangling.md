# `manifest.json`'s `$schema` points at a file that has never existed

**Labels:** `chore`, `globalize-guide`, `library-check`

**Severity:** Low on its own — nothing at runtime reads `$schema`. Medium as a *precondition*, because four open items (12, 13, 14, 16) all propose adding new constraint fields to `manifest.json`, and there is currently no mechanism anywhere in the repo that would catch a typo in any of them.

**Verified:** 2026-08-25, against `skills/globalize-guide/manifest.json` @ `ac59bc3` and the full git history of the repo.

---

## Summary

`skills/globalize-guide/manifest.json` opens with:

```json
{
  "$schema": "./manifest.schema.json",
  "version": 1,
  "stacks": [
```

`skills/globalize-guide/manifest.schema.json` **does not exist**, and — per `git log --all -- skills/globalize-guide/manifest.schema.json` — **has never existed in this repository**. `find` across the whole tree returns nothing by that name. The pointer has been in place since `c5c1676` (2026-06-26, *"refactor(skills): split Globalize setup into account + project skills (#36)"*), so it has been dangling for **60 days**.

## Why the daily path check never caught it

The library-check run has verified reference-path integrity on every repo-event run since the practice was introduced, and has reported "all 114 reference paths resolve" as recently as [2026-08-23](../2026-08-23.md#trigger-a-repo-event). That number was correct and the conclusion was too narrow.

The extraction walked `references` objects only. `$schema` sits at the manifest root, outside any `references` block, so it was never in the candidate set. Re-running with the predicate widened to *every string value in the manifest ending in `.md` or `.json`* yields:

```
total path-like strings (incl. duplicates): 115
unique:                                      57
unresolved:                    [('/$schema', './manifest.schema.json')]
```

**114 + 1 = 115.** The one path the old check couldn't see is the one that's broken. This is trigger (D) again — a clean negative result proves only what its pattern covered — but with the scope error on the *traversal* rather than on the regex.

**Suggested fix regardless of what happens to `$schema`:** widen the check's predicate to all path-shaped strings, so the assertion becomes "every path in the manifest resolves" rather than "every path in a `references` block resolves."

## Two ways to close it

**(a) Delete the line.** One-line change, honest about the current state: the manifest is hand-maintained and unvalidated.

**(b) Write the schema.** More work, and the option this run recommends, because the manifest is about to grow. There is no JSON-Schema validation anywhere in the repo today — `grep -rn "manifest.schema\|ajv\|jsonschema" evals/ .github/` returns zero hits, and none of the eight `evals/*.sh` scripts touch the manifest's shape. Meanwhile the open queue proposes adding, to a 23-entry hand-edited file:

- a Node `engines` floor per stack (items 1, 12)
- a Vite peer floor (item 14)
- an `@swc/core` host floor (item 16)
- whatever `detection.json` gains alongside them (item 12)

Every one of those is a new optional field that will be present on some stacks and absent on others, which is precisely the shape a schema is good at policing and code review is bad at. A minimal schema covering `stacks[].{id,packages,references}` plus the new floors, wired into an eval script, would pay for itself on the first of those four changes.

## Acceptance

- [ ] Either `skills/globalize-guide/manifest.schema.json` exists and validates the current `manifest.json`, or the `$schema` key is removed.
- [ ] If the schema is written: an eval script validates `manifest.json` against it, and fails on a deliberately malformed copy.
- [ ] The library-check path assertion covers all path-shaped strings in the manifest, not only those under `references`.

## Notes

Found on a near-silent upstream day (one patch publish across 25 npm packages and 5 gems in 48 hours) by widening a check that had been passing for weeks. Filing at low severity: no user of the skill is affected today, and nobody should drop what they're doing for it. It is listed here mainly so that whoever picks up items 12/14/16 sees it first, since (b) is much cheaper to do *before* those land than after.

---

**Filed: https://github.com/globalize-now/globalize-skills/pull/61** (2026-08-25, ready for review). Option (b) taken — schema written rather than the line deleted, plus `evals/verify-manifest.sh` covering all three acceptance criteria. Path check widened to all 115 path-shaped strings. Taken out of oldest-first order deliberately: items 12/14/16 are all marked "see 17 first".
