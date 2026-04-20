# Catalog Format: PO (gettext)

PO-specific guidance for the `next-intl-convert` skill. Used when `catalogFormat === 'po'` was detected in Step 2 of the main SKILL.md.

This reference covers three things the JSON path handles implicitly:

1. **Translation of ICU patterns to PO shape** — where a JSON key-value goes vs. a `msgid`/`msgstr` pair with metadata
2. **Subagent output format** — the flat entry list that replaces the nested-JSON output in Step 7.2
3. **Merge algorithm** — how collected entries get appended to existing `.po` files without corrupting the header or duplicating `msgid`s

Everything else in the main SKILL.md (detection rules, API decision tree, namespace conventions, ICU patterns, workflow ordering) applies unchanged.

---

## § ICU Patterns in PO

The Step 5 ICU examples in the main SKILL.md are written in JSON. Here's how each one looks in PO. Every ICU body lives inside `msgstr`; the `msgid` is a dot-path that matches the namespace/key the component uses at the call site.

### Interpolation

```
#. Greeting shown on the home page
#: src/app/[locale]/page.tsx
msgid "HomePage.greeting"
msgstr "Hello, {name}!"
```

Call site (unchanged): `t('greeting', {name: user.name})` with `useTranslations('HomePage')`.

### Plurals

```
#. Cart item count badge
#: src/components/Cart.tsx
msgid "Cart.items"
msgstr "You have {count, plural, one {# item} other {# items}}"
```

Call site: `t('items', {count: items.length})`.

### Select

```
#. Activity feed line describing who liked a post
#: src/components/Feed.tsx
msgid "Feed.liked"
msgstr "{gender, select, male {He} female {She} other {They}} liked your post"
```

### Rich text

```
#. Footer consent notice with a link to the terms page
#: src/components/Footer.tsx
msgid "Legal.terms"
msgstr "By signing up you agree to our <link>terms</link>."
```

Call site: `t.rich('terms', { link: (chunks) => <a href=\"/terms\">{chunks}</a> })`.

### Nested namespaces (sub-namespace via dot notation)

The `msgid` simply has more segments. `useTranslations('Auth.login')` + `t('title')` resolves to `msgid "Auth.login.title"`:

```
#. Login page heading
#: src/app/[locale]/login/page.tsx
msgid "Auth.login.title"
msgstr "Sign in"

#. Login page submit button
#: src/app/[locale]/login/page.tsx
msgid "Auth.login.submit"
msgstr "Log in"
```

---

## § Adding Entries

When wrapping a string in Step 7.1 (sequential processing), add an entry to every locale file for each new `msgid`. Every entry must carry:

| Field | Required | Notes |
|-------|----------|-------|
| `msgid` | yes | Dot-path: `Namespace.key` (or `Namespace.sub.key` for sub-namespaces). Must be unique per file. |
| `msgstr` | yes | ICU body. Source locale → actual text. Other locales → placeholder (copy the source text; globalize.now or a human translator will replace it later). |
| `#. description` | yes | One-line note about intent, audience, or tone. **The point of choosing PO. Do not skip it.** |
| `#: reference` | yes | `src/path/to/File.tsx` pointing at the file that renders the string. Line number optional but helpful (`src/components/Header.tsx:42`). |
| `msgctxt` | occasional | Only when two strings with identical source text need different translations (e.g. "Post" as verb vs. noun). Pair it with a distinguishing suffix in the `msgid`. |

Order inside an entry is comment lines first, then `msgctxt` (if any), then `msgid`, then `msgstr`. Example:

```
#. Tooltip on the delete icon in the item list
#: src/components/ItemRow.tsx:64
msgctxt "icon-tooltip"
msgid "ItemRow.delete"
msgstr "Delete"
```

### Writing good descriptions

A good `#.` description answers one of: *Where does this appear? Who reads it? What tone?* If the string's intent is obvious from context (button label "Save"), a single-word role is fine ("Save button"). If there's any ambiguity ("Open" — a verb on a button, or an adjective on a status label?), spell it out.

Examples:

| Bad | Good |
|-----|------|
| `#. Welcome` | `#. Homepage hero heading shown to signed-out visitors` |
| `#. Button` | `#. Primary CTA on the pricing page — drives sign-up` |
| `#. Error` | `#. Form error shown when the email already exists` |

The descriptions are the main quality lever for AI translation — models will use them to disambiguate tone, formality, and audience. Treat them as part of the wrap, not an afterthought.

---

## § Subagent Output Format

Replaces the JSON output block in Step 7.2's subagent prompt template.

The subagent must **not** edit any `.po` file directly. Instead, after processing its files, it outputs a flat list of entries — one per new `msgid` it produced — in this shape:

```json
[
  {
    "msgid": "HomePage.title",
    "msgstr": "Welcome",
    "description": "Homepage hero heading",
    "reference": "src/app/[locale]/page.tsx:12"
  },
  {
    "msgid": "HomePage.cta",
    "msgstr": "Get started",
    "description": "Primary CTA button on the homepage hero",
    "reference": "src/app/[locale]/page.tsx:18"
  }
]
```

Rules for subagents to follow (lift these into the dispatch prompt):

- Output a JSON array, not nested JSON. Nesting is expressed through dot-pathed `msgid`s.
- Include every entry the subagent used in a `t(...)` call — no fewer, no more.
- `description` is required and must be non-empty. Do not ship placeholder text like "TODO" or "Welcome title" — write a real one-line intent note.
- `reference` points at the first source file where the entry is used. If the subagent added the same entry in multiple files, list them separated by a single space: `"src/a.tsx:10 src/b.tsx:24"`.
- If the subagent wraps a plural or select, the `msgstr` contains the full ICU body (`{count, plural, one {# item} other {# items}}`) — not a split across multiple entries.
- Locale files are the merger's job. The subagent only authors the source-language `msgstr`.

---

## § Merge Algorithm

Replaces the JSON deep-merge step in "After all subagents complete — merge message keys".

Inputs:
- One entry array per subagent (from § Subagent Output Format).
- Existing `.po` files in `messages/` — one per configured locale.
- `sourceLocale` from the i18n config (for picking which file gets the real `msgstr` values).
- `targetLocales = locales \ [sourceLocale]`.

Algorithm:

1. **Concatenate all subagent outputs** into a single entry list. Preserve order — it reflects file/partition processing order, which tends to cluster related messages.

2. **Deduplicate by `msgid`.** For each duplicate group:
   - `msgstr`: keep the longer/more descriptive value. If they're identical, pick any.
   - `description`: keep the more specific description (more words, or names concrete UI context).
   - `reference`: union the references — join unique values with a single space. Drop empty strings.

3. **Read the existing source-locale `.po` file** (`messages/{sourceLocale}.po`). Parse enough of it to identify existing `msgid`s. You don't need a full PO parser — a regex matching `^msgid "([^"]*)"$` over each entry block is enough. Keep the file's header block (the entry with `msgid ""`) verbatim.

   > **Caveat:** this single-line regex will miss multi-line `msgid`s produced by some TMS exports (`msgid ""\\n"line one..."\\n"line two..."`). Files authored by this skill only use short dot-paths, so collisions with TMS multi-line entries are rare. If the user mixes TMS round-trips with convert runs, warn them that re-used `msgid`s authored in multi-line form may be duplicated. Do not build a full PO parser — a one-line caveat is the right tradeoff.

4. **For each entry in the deduplicated list**:
   - If its `msgid` already exists in the source-locale file → **soft-merge the metadata** into the existing entry instead of skipping:
     - `msgstr`: leave untouched. This preserves any existing translations and avoids clobbering a manually-tuned source string.
     - `#.` description: if the incoming description is strictly more specific (longer, or names concrete UI context that the existing one doesn't), replace. Otherwise keep the existing one.
     - `#:` reference: union with the existing reference — split on whitespace, dedupe, re-join with a single space. A re-used string picks up additional source locations this way, which is useful when the same `msgid` is rendered from multiple files.
     - Apply the same metadata soft-merge to every target-locale file for this `msgid` so metadata stays identical across locales.
     - Log this for the user at the end: count of re-used `msgid`s and count of those whose metadata was updated.
   - Otherwise, append it to each locale file as follows.

5. **For the source-locale file**, each new entry renders as:
   ```
   #. {description}
   #: {reference}
   msgid "{msgid}"
   msgstr "{msgstr}"
   ```
   Escape `\\`, `"`, and newlines in `msgstr` per PO rules (`\\n` for newline, `\\"` for quote, `\\\\` for backslash).

6. **For each target-locale file** (`messages/{targetLocale}.po`), write the same block but with `msgstr "{msgstr}"` set to the source-language text as a placeholder. Keep the `#.` and `#:` identical across locales — they are authoritative metadata shared among translators regardless of language.

7. **Preserve file ordering.** Appending new entries at the bottom is fine and matches how most TMS round-trips write PO. If the user prefers grouping by namespace, resort afterwards — but do not resort a pre-existing file without warning the user, because round-trip tools may treat resorting as churn.

8. **Do not touch the header block.** The `msgid ""` entry at the top carries `Content-Type`, `Language`, and possibly `Plural-Forms` — the merger must not rewrite it even if headers look stale.

9. **Verification pass** (ends the merge step):
   - Every new `msgid` exists in every locale file.
   - `#.` and `#:` lines are identical across locales for each new `msgid`.
   - Every locale file still parses: headers intact, every entry has `msgid` + `msgstr`, no dangling half-entries.

---

## § Notes on PO tooling round-trips

If the user ships this PO catalog through Poedit, Crowdin, Lokalise, Weblate, or another TMS, the platform may:

- Reorder entries (alphabetical or by reference path).
- Reflow long `msgstr` lines using multi-line PO syntax (`msgstr ""` on the head line, then `"partial..."` continuation lines).
- Strip `#:` references the next time it exports.

None of these break next-intl's loader — it only reads `msgid` → `msgstr`. But they will produce noisy diffs. If the user cares about clean diffs, recommend they (a) pick one authoring source (repo or TMS) and (b) run a `msgcat --sort-by-msgid` (or equivalent) in pre-commit to keep order stable.
