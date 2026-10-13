# 32 — `web-ext lint`'s "What it actually catches for i18n" table is three codes short, and its CI filter lists one code the linter cannot emit

**Status:** PR-shaped, **ready for review**. 1 file, `+11/-1`. `git apply --check` clean on `main` `48a676ae`.
**Patch:** `32-webext-lint-i18n-code-table-incomplete.patch`
**Found:** 2026-10-06, by trigger (F) — oldest unverified claim. Write path dead (PAT `401`), so unfiled.
**Commutes with draft 22** (same file, adjacent hunks) to an identical tree — verified by `sha1` both orders.

## What was verified, and how

`skills/globalize-guide/references/languages/js-ts/frameworks/webext/setup.add-ons.md` carries, at
L249–269, a table headed **"What it actually catches for i18n"** ("Verified by running `web-ext@10.6.0`
against fixtures") and, under it, a list headed **"What it does NOT catch — verified; do not claim
otherwise"**. Forty lines later, at L281–285, the CI script the skill emits filters the linter's JSON
output through an `I18N_CODES` set of **eleven** codes.

This run installed `web-ext@10.7.0` — the version `^10` resolves to, per open item 71 — which bundles
`addons-linter@10.13.0`, and ran `lint --source-dir <fx> --output json --self-hosted` against ten
purpose-built fixtures, one per code. Every row below is a measured result, not a reading of the rule
source.

| `I18N_CODES` entry | in the skill's table | fired on a fixture | measured severity |
|---|---|---|---|
| `NO_DEFAULT_LOCALE` | yes (error) | yes | error |
| `NO_MESSAGES_FILE` | yes (error) | yes | error |
| `NO_MESSAGES_FILE_IN_LOCALES` | **no** | yes | **error** |
| `NO_MESSAGE` | yes (error) | yes | error |
| `MISSING_PLACEHOLDER` | yes (warning) | yes | warning |
| `NO_PLACEHOLDER_CONTENT` | **no** | yes | **error** |
| `INVALID_PLACEHOLDER_NAME` | **no** | yes | **error** |
| `INVALID_MESSAGE_NAME` | no | **never — see below** | n/a |
| `PREDEFINED_MESSAGE_NAME` | yes (warning) | yes | warning |
| `JSON_INVALID` | yes (error) | yes | error |
| `JSON_DUPLICATE_KEY` | yes (error) | yes | error |

### Defect 1 — the table under-reports by three codes, all errors

`NO_MESSAGES_FILE_IN_LOCALES`, `NO_PLACEHOLDER_CONTENT` and `INVALID_PLACEHOLDER_NAME` all fire as
**errors**, and all three are already in the set the emitted CI script gates on. So the skill ships a
gate that fails a build on three conditions its own "verified" catch table never mentions. A reader
debugging a red pipeline looks up the code in that table and does not find it.

Fixtures and results:

- `NO_MESSAGES_FILE_IN_LOCALES` — `_locales/en/messages.json` present, `_locales/fr/` holding only a
  `README.txt`: **error, "Empty language directory"**. A *wholly* empty `_locales/fr/` (no files at all)
  reports **nothing** — the scanner enumerates files, not directories. Both halves measured; the
  parenthetical in the patch exists because the distinction decides whether a reader believes the row.
- `NO_PLACEHOLDER_CONTENT` — `{"b": {"message": "Hi $x$", "placeholders": {"x": {}}}}`: **error**.
- `INVALID_PLACEHOLDER_NAME` — `{"c": {"message": "Yo $y$", "placeholders": {"y!": {"content": "$1"}}}}`:
  **error**.

### Defect 2 — `INVALID_MESSAGE_NAME` is a dead constant, and its presence in the set reads as coverage

`addons-linter@10.13.0` **declares and exports** it:

```js
const INVALID_MESSAGE_NAME = exports.INVALID_MESSAGE_NAME = {
  code: 'INVALID_MESSAGE_NAME',
  message: 'String name contains invalid characters',
  description: i18n._(`String name should only contain alpha-numeric
    characters, _ and @ (https://mzl.la/2Eztyi5).`)
};
```

and **never raises it**. Walking every occurrence of the identifier in `dist/addons-linter.js`: four
hits, all inside the declaration block, **zero reference sites anywhere else**. The contrast is the
point — the same walk gives `PREDEFINED_MESSAGE_NAME` four declaration hits plus one raise site
(`if (message.startsWith('@@')) { this.collector.addWarning({... messages.PREDEFINED_MESSAGE_NAME}) }`),
and `NO_PLACEHOLDER_CONTENT` / `INVALID_PLACEHOLDER_NAME` one raise site each.

Checked against behaviour, not just the bundle: a catalog keyed `"manifest.name"` — a `.`, outside
Chrome's `A-Za-z0-9_@` — produces output **byte-identical** to the healthy fixture's
(`ADDON_ID_REQUIRED` error + `MISSING_DATA_COLLECTION_PERMISSIONS` warning, nothing else).

So **the "does NOT catch" bullet is right** and the filter set is what misleads: a reader reconciling
the two would reasonably conclude the prose is stale. It is not.

### What was NOT changed, and why

The patch **keeps** `INVALID_MESSAGE_NAME` in `I18N_CODES` and annotates it instead of deleting it.
Filtering on a code that is never emitted is a no-op today, and leaving it in means the gate covers the
condition for free if upstream ever wires the message up. Deleting it would be the tidier diff and the
worse gate. Stated here because it is the one judgement call in the change.

### The other claims on the page all hold on 10.7.0

- **Unresolvable `__MSG_key__`** — manifest `"name": "__MSG_missingKey__"`, key absent from the
  default-locale catalog: output byte-identical to the healthy fixture. **Lints clean, as documented.**
- **The AMO-linter paragraph** — on a valid Chrome MV3 package with `--self-hosted`, exactly
  `ADDON_ID_REQUIRED` (error) and `MISSING_DATA_COLLECTION_PERMISSIONS` (warning). **As documented.**
- Table rows for `NO_DEFAULT_LOCALE`, `NO_MESSAGES_FILE`, `NO_MESSAGE`, `JSON_INVALID`,
  `JSON_DUPLICATE_KEY`, `MISSING_PLACEHOLDER`, `PREDEFINED_MESSAGE_NAME` — **all seven reproduce at the
  documented severity on 10.7.0.**

This is the first (F) head to be settled by *running* the tool rather than reading its published
source, and the "verified; do not claim otherwise" list earned its wording: nothing in it was wrong.

## Relationship to draft 22

Draft 22 rewrites the stamp line at L251 (`Verified by running web-ext@10.6.0 against fixtures:`) to
name `addons-linter@10.10.0` vs the 10.13.0 that `web-ext@10.7.0` bundles. **This patch deliberately
does not touch L251** — that line belongs to 22, and today's measurement is first-hand confirmation of
22's claim that the locale validation is untouched between those two linter versions.

Verified today, on a `git status --porcelain`-clean fixture of `main` `48a676ae`:

| order | result |
|---|---|
| 22 then 32 | applies; `sha1(git diff)` = `4234af334b01` |
| 32 then 22 | applies; `sha1(git diff)` = `4234af334b01` |

**Commutes to an identical tree.** Either order is safe; 22 is older and should go first.

## Verification

- `git apply --check` clean on a fresh `--depth 1` clone of `main` at `48a676ae`.
- Three standalone verifiers, run on clean `main` **and** on `main`+32, identical both ways:
  `verify-manifest.sh` **6/0/0**, `verify-format-helpers.sh` **99/0/0**, `verify-rules-template.sh`
  **114/0/0**. `bash -n` clean on all 10 `evals/*.sh` and all 4 `evals/library-checks/*.sh`.
- The behavioural evals still need `<project-dir> <fixture>` — a scaffolded project — and could not run.
  There is **no** webext entry under `evals/library-checks/`; the stack's nearest coverage is
  `verify-format-helpers.sh` line 66, which asserts that `setup.add-ons.md` is *referenced* by the
  `webext-native` row, not anything about its content.
- Per open item 68: `grep -rl` over `evals/` and `fixtures/` for `I18N_CODES`, `INVALID_MESSAGE_NAME`,
  `NO_PLACEHOLDER_CONTENT`, `INVALID_PLACEHOLDER_NAME`, `NO_MESSAGES_FILE_IN_LOCALES`, `web-ext lint`
  and `addons-linter` → **0 hits each, in both trees**. The suite could not have caught this and cannot
  regress on the correction. Same shape as drafts 30 and 31 found on their own stacks.
- Per open items 52/63: all seven open PRs listed with `head` refs — no `library-check/webext*` branch
  exists and no open PR's subject touches the lint code table. `pending-issues/` grepped for the four
  codes and for `What it actually catches` → the only hit is draft 22's patch, handled above.

## Open questions for a human

1. **Should the three missing rows be a fixture assertion rather than prose?** The cheap version is one
   eval that runs `web-ext lint` on a deliberately broken `_locales/` fixture and asserts the emitted
   code set equals `I18N_CODES` minus the dead entry. That would have caught this, and would catch the
   next upstream code addition. It needs a fixture policy decision (a real `npm install web-ext` in CI),
   which is why it is not in the patch — the same call drafts 30 and 31 left open.
2. **Keep or drop `INVALID_MESSAGE_NAME`?** The patch keeps it, annotated. Dropping it is defensible.
