# Lingui Comment Improvements — Design Spec

## Context

Lingui supports `comment` (translator notes) and `context` (disambiguation) on translation macros. Both the `lingui-convert` and `lingui-code` skills document the mechanics, but comments are treated as an afterthought — a reference section rather than an active part of the workflow. This leads to under-commented catalogs where translators see ambiguous strings like "Save", "Post", or "Park" without context.

The goal: make comments a first-class part of both skills — detected smartly, added inline during wrapping, and reviewed after the fact.

## Design

### 1. Detect App Domain (new Step 3 in convert skill)

Inserted after "Detect the Project" (current Step 2). Remaining steps shift by one.

1. **Infer** from: `package.json` description, README first paragraph, route/page names, component names
2. **Confirm** with user: "This looks like a [parking management app]. I'll use this to write better translator comments. Is that right?"
3. **Carry forward** as context for the session — no config file, no persistence

The code skill does not get this step. Instead, a note says: "If the app's domain is known from context (prior conversation, CLAUDE.md, or obvious from surrounding code), use it to inform comment decisions."

### 2. Ambiguity Heuristic Checklist

Added to both skills. This is the core decision engine for when to add comments.

**Must comment** (always add):
- Single words or two-word phrases that could have multiple meanings in the source language
- Action labels without a visible object — comment should say what is being acted on
- Strings with placeholders where the placeholder meaning isn't obvious
- Domain-sensitive terms whose meaning depends on the app's domain

**Should comment** (add unless meaning is obvious from surrounding message):
- UI jargon that a translator might read literally: "Toast", "Drawer", "Badge", "Chip"
- Abbreviations and acronyms shown to users that may not have universal equivalents
- Sentence fragments — comment should give the full sentence context

**Skip** (no comment needed):
- Full sentences with clear meaning
- Strings where the surrounding message makes context obvious (e.g., plural forms)
- Labels that match their form field name

**Comment quality rules:**
- Describe where it appears and what it refers to, not what the word means. Bad: "Save — means to store". Good: "Save button in document editor toolbar".
- Keep under 80 characters. One short sentence.
- Reference app domain when relevant. Good: "Park — a parking spot, not a nature park".
- Write comments in the source language.

### 3. Inline Comment Addition During Wrapping

Both skills instruct the agent to run the heuristic checklist as each string is wrapped.

**Translate skill:** Instruction added to the Workflow step: "When wrapping each string, run the ambiguity checklist. If the string matches a must/should rule, add the `comment` prop/field in the same edit."

**Code skill:** "Translator comments" section rewritten: "Before finishing any string wrap, check the ambiguity checklist. If the string matches, add the comment inline."

### 4. Comment Review Pass (new Step 9 in convert skill)

After all wrapping and extraction:

1. Run `npx lingui extract` to get the current catalog
2. Scan PO files for entries with no `#.` comment that match any "must comment" heuristic
3. Go back to source files and add `comment` prop/field for flagged entries
4. Re-run extraction to verify comments appear

Does NOT: add comments to every string, second-guess existing comments, or touch `context`.

Code skill does not get a review pass — inline checklist is sufficient for one-at-a-time wrapping.

## Files Modified

- `skills/lingui/convert/SKILL.md` — new Step 3 (domain detection), heuristic checklist prepended to Step 7 (comments section), inline instruction in Step 8 (workflow), new Step 9 (review pass)
- `skills/lingui/code/SKILL.md` — rewrite "Translator comments" section with heuristic checklist, add domain awareness note

No new files.

## Step Renumbering (convert skill)

| Old | New | Title |
|-----|-----|-------|
| 1 | 1 | Prerequisite Check |
| 2 | 2 | Detect the Project |
| — | 3 | Detect App Domain (NEW) |
| 3 | 4 | Macro Decision Tree |
| 4 | 5 | Localization Gap Detection |
| 5 | 6 | Plurals, Select, ICU MessageFormat |
| 6 | 7 | Translator Comments and Context |
| 7 | 8 | Workflow |
| — | 9 | Comment Review Pass (NEW) |

## Verification

- Read both modified SKILL.md files end-to-end
- Verify step numbering is sequential and cross-references are correct
- Verify no duplicate content between heuristic checklist and existing syntax examples
- Check cross-references to lingui-setup still work
