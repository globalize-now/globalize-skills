# Catalog Format: PO (gettext)

PO-specific guidance for the convert phase. Used when `catalogFormat === 'po'` was detected in Step 2 of the shared convert reference.

This reference covers four things the JSON path handles differently:

1. **Translation of ICU patterns to PO shape** — where a JSON key-value goes vs. a `msgid`/`msgstr` pair with metadata
2. **`msgctxt` handling in Vue** — the `poLoader` mangling convention and how call sites reference disambiguated entries
3. **Subagent output format** — the flat entry list that replaces the nested-JSON output in Step 8.2
4. **Merge algorithm** — how collected entries get appended to existing `.po` files without corrupting the header or duplicating `(msgid, msgctxt)` pairs

Everything else in the shared convert reference (detection rules, decision tree, namespace conventions, ICU patterns, workflow ordering, comment review) applies unchanged.

---

## § ICU Patterns in PO

The Step 6 ICU examples in the shared convert reference show the call site and the catalog value. Here's the full PO entry for each. Every ICU body lives inside `msgstr`; the `msgid` is a dot-path matching the namespace + key used at the call site.

### Interpolation

```
#. Greeting shown on the home page
#: src/pages/HomePage.vue:12
msgid "HomePage.greeting"
msgstr "Hello, {name}!"
```

Call site (unchanged): `{{ t('HomePage.greeting', { name: user.name }) }}`.

### Plurals

```
#. Cart item count badge in the header
#: src/components/CartBadge.vue:18
msgid "Cart.items"
msgstr "You have {count, plural, one {# item} other {# items}}"
```

Call site: `{{ t('Cart.items', { count: items.length }) }}`.

### Select

```
#. Activity feed line describing who liked a post
#: src/components/Feed.vue:55
msgid "Feed.liked"
msgstr "{gender, select, male {He} female {She} other {They}} liked your post"
```

### SelectOrdinal

```
#. Race results page — user's finishing position
#: src/pages/RaceResults.vue:24
msgid "Race.finish"
msgstr "You finished {position, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}"
```

### Rich text with embedded components

PO stores the raw message (with `{slotName}` placeholders). The template renders it via `<i18n-t keypath>`:

```
#. Footer consent notice with a link to the terms page
#: src/components/Footer.vue:42
msgid "Legal.terms"
msgstr "By signing up you agree to our {link}."
```

Call site:
```vue
<i18n-t keypath="Legal.terms" tag="p">
  <template #link>
    <RouterLink to="/terms">{{ t('Legal.termsLink') }}</RouterLink>
  </template>
</i18n-t>
```

### Nested namespaces (sub-namespace via dot notation)

The `msgid` simply has more segments. `t('Auth.login.title')` resolves to `msgid "Auth.login.title"`:

```
#. Login page heading
#: src/pages/auth/Login.vue:8
msgid "Auth.login.title"
msgstr "Sign in"

#. Login page submit button
#: src/pages/auth/Login.vue:34
msgid "Auth.login.submit"
msgstr "Log in"
```

The `poLoader` re-hydrates these into:
```js
{ Auth: { login: { title: 'Sign in', submit: 'Log in' } } }
```

---

## § `msgctxt` for Disambiguation

`msgctxt` is the PO-level mechanism for splitting same-`msgid` entries that need different translations. Vue-i18n's runtime has no concept of contexts — so the `poLoader` (installed by setup Step 4 when `catalogFormat === 'po'`) mangles the two pieces into a single key at build time.

### The mangling convention

```
msgid "Common.right" + msgctxt "direction"   →  Common.right__ctx_direction
msgid "Common.right" + msgctxt "correctness" →  Common.right__ctx_correctness
```

The loader produces:

```js
{ Common: {
  'right__ctx_direction': 'Right',
  'right__ctx_correctness': 'Right',
}}
```

### Writing call sites

When you wrap a string that needs `msgctxt`, the call site must reference the mangled key. Two styles:

**Inline string** (fine for short contexts):

```vue
{{ t('Common.right__ctx_direction') }}
```

**TypeScript constant** (preferred for readability and long contexts):

```ts
// src/i18n/keys.ts  (create if not already present)
export const RIGHT_DIRECTION = 'Common.right__ctx_direction'
export const RIGHT_CORRECTNESS = 'Common.right__ctx_correctness'
```

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RIGHT_DIRECTION } from '@/i18n/keys'
const { t } = useI18n()
</script>

<template>
  <span>{{ t(RIGHT_DIRECTION) }}</span>
</template>
```

For any msgctxt context whose name is longer than ~8 characters, prefer the constant form. This keeps templates readable and centralizes key changes.

### When to introduce `msgctxt`

Only when the **same `msgid` source text** genuinely needs different translations in different places. Examples:

- "Right" as a direction vs. "Right" as correctness.
- "Post" as a verb ("click here to Post") vs. "Post" as a noun ("delete this Post").
- "Open" as a verb on a button vs. "Open" as an adjective on a status label.

Do **not** use `msgctxt` for:

- **Namespacing** (`HomePage` / `Dashboard` / `Common`) — dot-paths in the `msgid` handle this.
- **Routing organisation** — same.
- **Comments** — use `#.` for translator notes. `msgctxt` affects the translated output; `#.` does not.

---

## § Adding Entries

When wrapping a string in Step 8.1 (sequential) or when the merge step runs in Step 8.2, each catalog file gets a new entry per unique `(msgid, msgctxt)` pair. Every entry must carry:

| Field | Required | Notes |
|-------|----------|-------|
| `msgid` | yes | Dot-path: `Namespace.key` (or `Namespace.sub.key` for sub-namespaces). Unique within a `(msgid, msgctxt)` pair per file. |
| `msgstr` | yes | ICU body. Source locale → actual text. Other locales → placeholder (copy the source text; globalize.now or a human translator replaces it later). |
| `#. description` | yes when ambiguous | One-line note about intent, audience, or tone. Use the ambiguity checklist from Step 7 — skip for full sentences with obvious meaning. **The main reason to pick PO is first-class comments; lean into them.** |
| `#: reference` | yes | Path-to-source: `src/path/to/File.vue` pointing at the file that renders the string. Line number optional but helpful. |
| `msgctxt` | occasional | Only when disambiguating same-msgid entries (see § `msgctxt` above). Pair with the call-site key suffix. |

Order inside an entry: comment lines first (`#.`, `#:`), then `msgctxt` (if present), then `msgid`, then `msgstr`.

Example with `msgctxt`:

```
#. Status label in the content moderation queue — article publication state
#: src/pages/admin/Queue.vue:77
msgctxt "status"
msgid "Common.open"
msgstr "Open"

#. Verb — button that opens a record detail drawer
#: src/components/RecordTable.vue:40
msgctxt "verb"
msgid "Common.open"
msgstr "Open"
```

Call-site rendering:

```vue
{{ t('Common.open__ctx_status') }}     <!-- first entry -->
{{ t('Common.open__ctx_verb') }}       <!-- second entry -->
```

### Writing good descriptions

A good `#.` description answers one of: *Where does this appear? Who reads it? What tone?* If intent is obvious from context, a single-word role is fine ("Save button"). If there's any ambiguity, spell it out.

Examples:

| Bad | Good |
|-----|------|
| `#. Welcome` | `#. Homepage hero heading shown to signed-out visitors` |
| `#. Button` | `#. Primary CTA on the pricing page — drives sign-up` |
| `#. Error` | `#. Form error shown when the email already exists` |
| `#. Save` | `#. Save button in the document editor toolbar — not Save As` |

The descriptions are the main quality lever for AI translation — models will use them to disambiguate tone, formality, and audience. Treat them as part of the wrap, not an afterthought.

### PO header block — do not rewrite

Every `.po` file starts with a header entry:

```
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\n"
"Language: en\n"
"MIME-Version: 1.0\n"
```

The setup phase scaffolds this. The convert phase **must not** rewrite it during merge — even if the headers look stale. TMS round-trips own the header metadata (especially `Plural-Forms`, `Last-Translator`, `X-Generator`). Preserving the existing block avoids spurious diffs and TMS re-import churn.

---

## § Subagent Output Format

Replaces the JSON output block in Step 8.2's subagent prompt template.

The subagent must **not** edit any `.po` file directly. Instead, after processing its files, it outputs a flat JSON array of entries — one per new `(msgid, msgctxt)` pair it produced — in this shape:

```json
[
  {
    "msgid": "HomePage.title",
    "msgstr": "Welcome",
    "description": "Homepage hero heading shown to signed-out visitors",
    "reference": "src/pages/HomePage.vue:12"
  },
  {
    "msgid": "HomePage.cta",
    "msgstr": "Get started",
    "description": "Primary CTA button on the homepage hero",
    "reference": "src/pages/HomePage.vue:18"
  },
  {
    "msgid": "Common.right",
    "msgstr": "Right",
    "description": "Direction indicator, opposite of Left — not 'correct'",
    "reference": "src/components/ArrowNav.vue:8",
    "msgctxt": "direction"
  }
]
```

Rules for subagents (lift these into the dispatch prompt verbatim):

- Output a **JSON array**, not nested JSON. Nesting is expressed through dot-pathed `msgid`s.
- Include every `(msgid, msgctxt)` pair the subagent used in a `t(...)` call — no fewer, no more.
- `description` is required **when the ambiguity checklist triggers** (single words, action without visible object, domain-sensitive term, non-obvious placeholder). For full sentences with obvious meaning, omit the field entirely rather than writing "TODO".
- `reference` points at the first source file and line where the entry is used.
- If the subagent uses the same `(msgid, msgctxt)` pair in multiple files, list references separated by a single space: `"src/a.vue:10 src/b.vue:24"`.
- If the subagent wraps a plural or select, `msgstr` contains the full ICU body (`{count, plural, one {# item} other {# items}}`) — never split across multiple entries.
- `msgctxt` is **optional** — include it only for disambiguation. When present, write the call-site as `t('Namespace.key__ctx_<context>')` or via a TS constant (see § `msgctxt` above).
- Locale files are the orchestrator's job. The subagent only authors the source-language `msgstr`.

---

## § Merge Algorithm

Replaces the JSON deep-merge step in "After all subagents complete — merge catalog entries".

**Inputs:**
- One entry array per subagent (from § Subagent Output Format).
- Existing `.po` files under `locales/` — one per configured locale.
- `sourceLocale` from the i18n config (picks which file gets the real `msgstr` values).
- `targetLocales = locales \ [sourceLocale]`.

**Algorithm:**

1. **Concatenate all subagent outputs** into a single entry list. Preserve order — it reflects file/partition processing order, which tends to cluster related messages.

2. **Deduplicate by `(msgid, msgctxt)` pair.** For each duplicate group:
   - `msgstr`: keep the longer/more descriptive value. If identical, pick any.
   - `description`: keep the more specific description (more words, or names concrete UI context).
   - `reference`: union the references — split on whitespace, dedupe, re-join with a single space. Drop empty strings.

3. **Read the existing source-locale `.po` file.** Parse with `gettext-parser` (same library the `poLoader` uses) to get the existing entry set keyed by `(msgid, msgctxt)`. Keep the header block (`msgid ""` entry) verbatim.

4. **For each entry in the deduplicated list:**
   - If its `(msgid, msgctxt)` already exists in the source-locale file → **soft-merge the metadata** into the existing entry:
     - `msgstr`: **leave untouched.** This preserves existing translations and avoids clobbering manually-tuned source strings.
     - `#.` description: if the incoming description is strictly more specific (longer, or names concrete UI context the existing one doesn't), replace. Otherwise keep existing.
     - `#:` reference: union — split on whitespace, dedupe, re-join with a single space. A re-used string picks up additional source locations this way.
     - Apply the same metadata soft-merge to every target-locale file for this `(msgid, msgctxt)` so metadata stays identical across locales.
     - Log a count at the end: "re-used N existing `(msgid, msgctxt)` pairs (metadata updated on M of them)".
   - Otherwise, append it to each locale file as follows.

5. **For the source-locale file**, each new entry renders as:
   ```
   #. {description}
   #: {reference}
   {msgctxt "context"   (only when msgctxt is set)}
   msgid "{msgid}"
   msgstr "{msgstr}"
   ```
   Escape `\`, `"`, and newlines per PO rules (`\n` for newline, `\"` for quote, `\\` for backslash).

6. **For each target-locale file** (`locales/{targetLocale}.po`), write the same block but with `msgstr` set to the source-language text as a placeholder. Keep `#.`, `#:`, and `msgctxt` identical across locales — they are authoritative metadata shared among translators regardless of language.

7. **Preserve file ordering.** Appending at the bottom is fine and matches how most TMS round-trips write PO. If the user prefers grouping by namespace, resort afterwards — but do not resort a pre-existing file without warning, because round-trip tools may treat resorting as churn.

8. **Do not touch the header block.** The `msgid ""` entry at the top carries `Content-Type`, `Language`, `Plural-Forms`, and possibly TMS-managed fields. The merger must not rewrite it.

9. **Verification pass** (ends the merge step):
   - Every new `(msgid, msgctxt)` pair exists in every locale file.
   - `#.`, `#:`, and `msgctxt` lines are identical across locales for each new entry.
   - Every locale file still parses via `gettext-parser` without errors.

---

## § Notes on PO Tooling Round-Trips

If the user ships this PO catalog through Poedit, Crowdin, Lokalise, Weblate, or another TMS, the platform may:

- Reorder entries (alphabetical or by reference path).
- Reflow long `msgstr` lines using multi-line PO syntax (`msgstr ""` on the head line, then `"partial..."` continuation lines).
- Strip `#:` references the next time it exports.
- Inject or normalize the header block (`X-Generator`, `Last-Translator`, `PO-Revision-Date`).

None of these break the `poLoader` — it parses via `gettext-parser`, which tolerates all standard PO flavours. But they do produce noisy diffs. If the user cares about clean diffs, recommend they:

1. Pick one authoring source (repo or TMS) and let the other be derived.
2. Run `msgcat --sort-by-msgid` (or an equivalent pre-commit hook) to keep order stable.
3. Resist re-running the convert phase on code that the TMS has already modified — the skill's soft-merge preserves `msgstr` but may update `#.` / `#:` in ways the TMS will then re-normalize.

---

## § Vue-Specific Gotchas in PO

- **The `__ctx_` suffix is load-bearing.** If you rename the mangling convention in `src/i18n/poLoader.ts` (e.g. changing `__ctx_` to `___`), every call site must be updated to match. This convert phase assumes the setup-generated `poLoader` is unmodified.
- **`__ctx_` is a reserved substring.** If a user's own `msgid` happens to contain `__ctx_` (e.g. someone defined `msgid "Admin.key__ctx_thing"` manually with no `msgctxt`), the `poLoader` can't distinguish that from a mangled context key, and two entries could collide in the runtime tree. In practice nobody writes this by accident — but during conversion, grep the existing catalog for `__ctx_` before running convert; if a hit appears, rename it (or add a different mangling convention in `poLoader.ts`) before proceeding.
- **`gettext-parser` parses defensively.** Malformed PO files throw at load time; the dev server will fail to start with a parse error. Prefer running the convert phase on a clean working tree so regressions surface against a known-good baseline.
- **`msgstr` strings with ICU placeholders use curly braces.** Do not mistake them for PO's double-quote escaping. `{count, plural, one {# item} other {# items}}` is a single valid `msgstr` value — the curly braces are ICU, not PO syntax.
- **Never emit vue-i18n pipe-plural syntax** (`"one | many"`) in `msgstr`. The `poLoader` strips nothing; pipe-plurals would pass through to the runtime, where the custom ICU `messageCompiler` would try to parse them and fail. Always ICU.
- **Multi-line `msgstr` is fine.** `gettext-parser` concatenates continuation lines before the loader ever sees the value. Your ICU body is preserved regardless of how the TMS formats it on disk.
