---
name: lingui-convert
description: >-
  Wrap hardcoded UI strings with LinguiJS macros and detect localization gaps in
  any React-based project that already has LinguiJS set up. Use this skill when
  the user explicitly asks to "wrap strings", "find hardcoded text",
  "internationalize existing components", "make the UI translatable",
  "detect localization gaps", "find unwrapped strings", or "convert strings for
  translation". Also use when the user mentions missing <Trans>, t, or useLingui
  usage in existing code. This is a one-time batch job — for wrapping strings as
  new code is written, use lingui-code instead. This skill does NOT translate
  content into other languages — it only makes strings translatable. It does NOT
  install packages or create config — run lingui-setup first if LinguiJS is not
  yet configured.
---

# LinguiJS String Wrapping

This skill finds hardcoded user-facing strings and wraps them with the correct Lingui macros. It also identifies localization gaps: numbers, currencies, dates, and plurals that need locale-aware handling.

> **Scope:** This skill converts strings to make them translatable — it does not translate content. All strings remain in the source language after conversion.

---

## Step 1: Prerequisite Check

Before wrapping anything, verify LinguiJS is configured:

1. Check that `lingui.config.ts` (or `lingui.config.js`) exists
2. Check that `@lingui/core` is in `node_modules` (i.e., `npm ls @lingui/core` exits 0)
3. Check that the macro plugin is wired into the build tool — look for `@lingui/swc-plugin` in `next.config.*` or `vite.config.*`, or `@lingui/babel-plugin-lingui-macro` in `.babelrc`

If any check fails, stop and tell the user to run the `lingui-setup` skill first. This skill never installs packages or modifies build configuration.

---

## Step 2: Detect the Project

Read `package.json` and build config to determine the project type:

| Signal | How to detect |
|--------|--------------|
| **Framework** | `next` in deps → Next.js. `vite` in devDeps → Vite. |
| **Router** | App Router: `app/` directory exists with `layout.tsx`. Pages Router: `pages/` directory. |
| **TypeScript** | `typescript` in devDeps or `tsconfig.json` exists. |

Based on detection, read the relevant reference file for framework-specific patterns:

- **Next.js App Router** → read `references/nextjs-app-router.md`
- **Everything else** (Vite + SWC, Vite + Babel, React Router, TanStack Router) → read `references/react-standard.md`

Then continue with the steps below.

---

## Step 3: Detect App Domain

Before wrapping strings, understand what the app does — this directly affects comment quality. A word like "Track" needs different comments in a music app vs. a shipping app.

1. **Infer** the domain from signals already available:
   - `package.json` `description` field
   - README first paragraph
   - Route and page names (e.g., `/checkout`, `/patients`, `/fleet`)
   - Component names (e.g., `ParkingSpotCard`, `PatientList`)

2. **Confirm** with the user: *"This looks like a [parking management app]. I'll use this to write better translator comments — for example, 'Park' will get a comment clarifying it means a parking area, not a nature park. Is that right?"*

3. **Carry forward** the domain as context for the rest of the workflow. No config file — just context for this session.

---

## Step 4: Macro Decision Tree

Choose the right macro for each situation:

```
Does the string's wording change based on a number (e.g. "3 items" / "1 item", "You have {n} messages")?
  YES → <Plural> in JSX, or t`{count, plural, one {...} other {...}}` in non-JSX (see Step 6)

Is this a string in JSX content (visible text between tags)?
  YES → <Trans>text</Trans>

Is this a string used as a prop value (placeholder, aria-label, title, alt)?
  YES, inside a component function → useLingui() + t`text`
  YES, outside a component (constant, config object) → msg`text` to define, t(descriptor) in component

Is this a string in non-JSX code (utility function, class method)?
  YES → t from @lingui/core/macro
```

Check the plural question first. A count-dependent string wrapped in plain `<Trans>` is a bug — the singular/plural choice is baked into English and can't be translated to languages with different plural rules.

### Import reference table

| Macro | Import | Use case |
|-------|--------|----------|
| `<Trans>` | `@lingui/react/macro` | JSX text content |
| `<Plural>` | `@lingui/react/macro` | JSX plural expressions |
| `<Select>` | `@lingui/react/macro` | JSX gender/enum selection |
| `<SelectOrdinal>` | `@lingui/react/macro` | JSX ordinal numbers (1st, 2nd, 3rd) |
| `useLingui()` → `t`, `i18n` | `@lingui/react/macro` | Attributes/props, number/date formatting |
| `msg` | `@lingui/core/macro` | Define messages outside components |
| `t` (standalone) | `@lingui/core/macro` | Non-React code, utility functions |

> **Important import path:** Use `@lingui/react/macro` (not `@lingui/macro`) for React components. The old `@lingui/macro` package still works but is deprecated.

### Examples

**JSX text content:**
```tsx
import { Trans } from '@lingui/react/macro'

// Before
<h1>Welcome back</h1>
<button>Save changes</button>

// After
<h1><Trans>Welcome back</Trans></h1>
<button><Trans>Save changes</Trans></button>
```

**Props and attributes inside a component:**
```tsx
import { useLingui } from '@lingui/react/macro'

// Before
function SearchBar() {
  return <input placeholder="Search..." aria-label="Search" />
}

// After
function SearchBar() {
  const { t } = useLingui()
  return <input placeholder={t`Search...`} aria-label={t`Search`} />
}
```

**Constants and config objects outside components:**
```tsx
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import type { MessageDescriptor } from '@lingui/core'

// Define outside the component (msg marks for extraction)
const navItems = [
  { label: msg`Dashboard`, href: '/' },
  { label: msg`Settings`, href: '/settings' },
]

// Resolve inside a component
function Nav() {
  const { t } = useLingui()
  return (
    <nav>
      {navItems.map(item => (
        <a key={item.href} href={item.href}>{t(item.label)}</a>
      ))}
    </nav>
  )
}
```

**String interpolation with variables:**
```tsx
import { Trans } from '@lingui/react/macro'
import { useLingui } from '@lingui/react/macro'

// JSX interpolation
<p><Trans>Hello, {user.name}!</Trans></p>

// Template literal interpolation
const { t } = useLingui()
const message = t`Hello, ${user.name}!`
```

---

## Step 5: Localization Gap Detection

Scan files systematically for these patterns. Apply the confidence tiers to decide what to flag.

### Always flag (high confidence)

- **Bare JSX text**: Visible text between tags that is not wrapped in `<Trans>`
  ```tsx
  <h1>Welcome</h1>              // ← flag
  <h1><Trans>Welcome</Trans></h1> // ← ok
  ```

- **User-visible attributes without `t`**:
  - `placeholder="..."` — input placeholder
  - `aria-label="..."` — screen reader label
  - `title="..."` — tooltip text
  - `alt="..."` — image alt text (when descriptive, not decorative)

- **Concatenated strings**: User-visible strings built from `+` or template literals
  ```tsx
  const msg = "Hello " + name + "!"  // ← flag, use t`Hello ${name}!` instead
  ```

- **Count-dependent phrasing — plural candidates**: Any UI string that combines a number (literal, variable, prop, or expression) with wording that changes based on that number. This is the most commonly-missed gap — do not wrap these in plain `<Trans>`. Route them to Step 6.
  ```tsx
  <p>You have 3 new messages</p>              // ← flag — plural
  <span>{`${count} items`}</span>              // ← flag — plural
  <div>{items.length} results</div>            // ← flag — plural

  // Wrong — plain wrap bakes English plural rules into the message
  <p><Trans>{count} items selected</Trans></p>

  // Right — Plural macro handles every language's plural rules
  <p><Plural value={count} one="# item selected" other="# items selected" /></p>
  ```
  Also flag `count === 1 ? t\`item\` : t\`items\`` ternaries — two translation keys cannot express plural rules in other languages. Rewrite as a single `<Plural>` or ICU plural `t`.

- **Imported strings referenced in JSX**: `<h1>{title}</h1>` where `title` is an imported identifier. Trace the import to its definition; if it resolves to a bare string literal (e.g. `export const title = "Welcome"`), flag **the definition site**, not the JSX site — that is where the wrapping goes.

  **Disambiguation — a JSX expression `{foo}` can be:**
  1. An import resolving to a string literal in another module → **flag the definition** (see the cross-module pattern in `lingui-code`)
  2. A component prop passed from a parent → **skip** (the parent will be processed on its own turn)
  3. A local variable or function parameter → **handle at the assignment site in the same file**
  4. A formatted or computed value (`{formatDate(x)}`, `{count + 1}`) → **not a string** — handle the underlying data, not the expression

  Only case (1) adds a new flag. The others are covered by existing rules or belong elsewhere. Files matching `**/{constants,copy,strings,labels,messages,i18n}*.{ts,tsx,js,jsx}` are the highest-signal locations for case (1).

### Flag with judgment (medium confidence)

Review these and wrap only if they appear in the actual UI:

- **`toFixed()` and number formatting**: Raw `toFixed()` won't respect locale decimal separators. Use `i18n.number()` instead.
- **Currency symbols hardcoded near numbers**: `"$" + price` or `price + " USD"` — use `i18n.number(price, { style: 'currency', currency: 'USD' })`.
- **Date formatting without locale**: `date.toLocaleDateString()` without a locale argument uses the runtime locale, which may be fine. Explicit format strings like `"MM/DD/YYYY"` are not locale-aware.
- **Toast and notification messages**: Often user-visible strings passed to a `toast()` or `notify()` call.
- **Error messages shown to users**: Strings in `throw new Error(...)` that surface in the UI.

### Never flag (skip these)

- CSS class names: `className="text-red-500 font-bold"`
- `console.log`, `console.error` strings
- Import paths: `import ... from './components'`
- Object keys and property names: `{ name: "foo" }`
- Regex literals
- Test IDs: `data-testid="submit-btn"`
- `ALL_CAPS` constants used as enum values or internal codes: `STATUS = "ACTIVE"`
- URL strings, API endpoints
- Developer-facing error messages (not shown in the UI)
- Long-form prose content: article bodies, blog post text, documentation paragraphs, changelogs, legal copy (terms of service, privacy policy). These are content, not UI — they require a content localization strategy (per-locale files, CMS translation), not string wrapping. Still wrap UI elements in the same files (buttons, labels, navigation, form fields).

---

## Step 6: Plurals, Select, and ICU MessageFormat

ICU MessageFormat handles plurals, gender selection, and other locale-sensitive patterns. This is the most commonly misused feature — get it right the first time.

In JSX, prefer the `<Plural>`, `<Select>`, and `<SelectOrdinal>` macros — they are more readable and compile to `<Trans>` with ICU syntax automatically. In non-JSX contexts, use ICU syntax inside `t`.

### Plurals

```tsx
import { Plural } from '@lingui/react/macro'

// JSX — use Plural macro (preferred)
<Plural value={count} one="# item" other="# items" />

// With additional surrounding text, use Trans + Plural together
<Trans>You have <Plural value={count} one="# unread message" other="# unread messages" />.</Trans>

// Exact match for zero
<Plural value={count} _0="No items" one="# item" other="# items" />

// Non-JSX — use ICU syntax in t
const { t } = useLingui()
const label = t`{count, plural, one {# result} other {# results}}`
```

**The `#` placeholder** is replaced by the actual number. Do not write the variable name again — write `#`.

### CLDR plural categories

Different languages have different plural forms. English only uses `one` and `other`, but other languages have `zero`, `two`, `few`, `many`. Always include `other` — it is required and serves as the fallback.

| Category | Meaning | When used |
|----------|---------|-----------|
| `zero` | 0 items | Arabic, Welsh, others |
| `one` | 1 item | Most languages |
| `two` | 2 items | Arabic, Welsh |
| `few` | Small number | Slavic languages, Arabic |
| `many` | Large number | Some languages |
| `other` | **Always required** | Default fallback |

### Select (gender and enumerated values)

```tsx
import { Select } from '@lingui/react/macro'

// JSX — use Select macro (preferred)
<Select value={gender} male="He liked your post" female="She liked your post" other="They liked your post" />

// Status selection
<Select value={status} active="Active" inactive="Inactive" other="Unknown" />

// Non-JSX — use ICU syntax in t
t`{gender, select, male {He liked your post} female {She liked your post} other {They liked your post}}`
```

### Ordinal plurals (1st, 2nd, 3rd)

Use `<SelectOrdinal>` for position/ranking strings — "1st place", "2nd floor", "3rd attempt". Ordinal rules differ from cardinal rules: English has `one` (1st, 21st), `two` (2nd, 22nd), `few` (3rd, 23rd), and `other` (4th–20th, 24th+).

```tsx
import { SelectOrdinal } from '@lingui/react/macro'

// JSX — use SelectOrdinal macro (preferred)
<SelectOrdinal value={position} one="#st" two="#nd" few="#rd" other="#th" />

// With surrounding text
<Trans>You finished in <SelectOrdinal value={position} one="#st" two="#nd" few="#rd" other="#th" /> place.</Trans>

// Non-JSX — use ICU syntax in t
const { t } = useLingui()
const label = t`{position, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}`
```

**Cardinal vs. ordinal categories differ.** English cardinal plurals use only `one`/`other`, but English ordinal plurals use `one`/`two`/`few`/`other`. Other languages have their own ordinal rules — always include `other` as fallback.

### Nested plurals (complex cases)

For nested ICU (e.g. plural inside select), use ICU syntax in `<Trans>` — the macro components don't support nesting:

```tsx
<Trans>
  {gender, select,
    male {{count, plural, one {He has # message} other {He has # messages}}}
    female {{count, plural, one {She has # message} other {She has # messages}}}
    other {{count, plural, one {They have # message} other {They have # messages}}}
  }
</Trans>
```

### Top 5 mistakes

1. **Missing `other`**: Every plural/select expression must have `other`. Without it, extraction or compilation will fail.
   ```
   // Wrong
   {count, plural, one {# item}}
   // Right
   {count, plural, one {# item} other {# items}}
   ```

2. **Using `zero` for English**: English has no `zero` CLDR category. Use `other` for zero in English — the English `other` rule matches 0. Adding `=0` is valid syntax but rarely needed.
   ```
   // Unnecessary for English
   {count, plural, zero {no items} one {# item} other {# items}}
   // This is fine for English
   {count, plural, one {# item} other {# items}}
   ```

3. **Forgetting `#`**: The `#` is replaced by the count. Writing the variable name again is wrong.
   ```
   // Wrong
   {count, plural, one {count item} other {count items}}
   // Right
   {count, plural, one {# item} other {# items}}
   ```

4. **Wrong category names**: CLDR categories are `zero`, `one`, `two`, `few`, `many`, `other` — not `singular`, `plural`, `multiple`.

5. **Fragmenting plural branches into separate translations**: Each plural expression should be one message, not multiple separate ones.
   ```tsx
   // Wrong — two separate messages, broken grammar in many languages
   const label = count === 1 ? t`item` : t`items`

   // Right (JSX) — Plural macro
   <Plural value={count} one="# item" other="# items" />

   // Right (non-JSX) — one message with plural logic
   const label = t`{count, plural, one {# item} other {# items}}`
   ```

---

## Step 7: Translator Comments and Context

Ambiguous strings are a top source of translation quality issues. Lingui provides two mechanisms to help translators: **comments** (informational notes) and **context** (disambiguation that generates different message IDs).

### Ambiguity checklist

Run this checklist against each string during wrapping. If a string matches a "must" or "should" rule, add a `comment` in the same edit — don't plan to come back later.

**Must comment** (always add):

- **Single words or two-word phrases** that could have multiple meanings in the source language. The test: *could a translator read this word differently without seeing the UI?*
- **Action labels without a visible object**: "Remove", "Add", "Delete" — the comment should say what is being acted on (e.g., "Remove item from cart")
- **Strings with placeholders where the placeholder meaning isn't obvious**: `{count} remaining` — remaining what? `Hello, {name}` — is name a person, a project, a pet?
- **Domain-sensitive terms**: words whose meaning depends on the app's domain (detected in Step 3). E.g., in a music app, "Track" means a song; in a shipping app, it means package tracking.

**Should comment** (add unless meaning is obvious from surrounding message):

- **UI jargon** that a translator might read literally: "Toast", "Drawer", "Badge", "Chip", "Popover"
- **Abbreviations and acronyms** shown to users that may not have universal equivalents across languages
- **Sentence fragments**: "and {count} more", "Updated {timeAgo}" — the comment should give the full sentence context

**Skip** (no comment needed):

- **Full sentences with clear meaning**: a complete thought that leaves little room for misinterpretation
- **Strings where the surrounding message makes context obvious**: `one="# item" other="# items"` inside a Plural
- **Labels that match their form field name**: `<label>Email</label>` next to an email input

### Comment quality rules

- Describe **where it appears and what it refers to**, not what the word means in the source language. Bad: `"Save — means to store"`. Good: `"Save button in document editor toolbar"`.
- Keep under 80 characters. One short sentence.
- If the app domain is known (Step 3), reference it when relevant. Good: `"Park — a parking spot, not a nature park"`.
- Write comments in the source language (the same language as the string being commented on).

### `comment` prop on `<Trans>`

```tsx
<Trans comment="Main navigation link, not the building">Home</Trans>
<Trans comment="Save button in document editor toolbar">Save</Trans>
<Trans comment="Number of unread notifications">You have {count} new alerts</Trans>
```

### `comment` field in `msg` and `t` descriptors

When using the object form of `msg` or `t`, add the `comment` field:

```tsx
import { msg } from '@lingui/core/macro'

const actions = {
  save: msg({ message: `Save`, comment: "Save document button" }),
  post: msg({ message: `Post`, comment: "Publish a blog post" }),
  run: msg({ message: `Run`, comment: "Execute a code snippet" }),
}
```

```tsx
const { t } = useLingui()
const label = t({ message: `Clear`, comment: "Clear search input field" })
```

### `context` prop for disambiguation

Use `context` when the same English string needs **different translations** in different places. Unlike `comment`, `context` affects the generated message ID — so the same text with different contexts becomes two separate entries in the catalog.

```tsx
import { Trans } from '@lingui/react/macro'

<Trans context="direction">Right</Trans>
<Trans context="correctness">Right</Trans>
```

```tsx
import { msg } from '@lingui/core/macro'

const ex1 = msg({ message: `Open`, context: "door action" })
const ex2 = msg({ message: `Open`, context: "file status" })
```

### What appears in PO files

```po
#. Save document button
msgid "Save"
msgstr ""

#. Clear search input field
msgid "Clear"
msgstr ""

msgctxt "direction"
msgid "Right"
msgstr ""

msgctxt "correctness"
msgid "Right"
msgstr ""
```

`comment` becomes `#.` (translator comment). `context` becomes `msgctxt` (message context — produces a separate translation entry).

### A note on domain namespacing

You do not need to add domain prefixes (like `auth.login` or `dashboard.alerts`) to `context` values as a namespacing strategy. With AI-powered translation, the reasons for domain namespacing largely disappear:

- **Identical strings should share translations.** "Save" in auth and "Save" in dashboard mean the same thing — one translation entry is correct. Domain namespacing via `context` would create duplicate entries that must be translated identically.
- **`context` is for disambiguation, not organization.** Use it only when the same English text genuinely needs different translations in different places (e.g., "Right" as direction vs. correctness).
- **Per-page catalogs already provide organization.** If you use Lingui's per-page catalog extraction (see `lingui-setup`), translations are automatically scoped to each route's dependency tree.

---

## Step 8: Workflow

### 8.0 Discovery and Scale Assessment

Before wrapping strings, scan the project to determine scope:

1. **Glob** for all `.tsx`, `.ts`, `.jsx`, `.js` files under the source directories. Exclude `node_modules`, test files (`*.test.*`, `*.spec.*`, `__tests__/`), config files (`*.config.*`), and type declarations (`.d.ts`). Treat files matching `**/{constants,copy,strings,labels,messages,i18n}*.{ts,tsx,js,jsx}` as high-signal — they often hold exported user-facing string constants that JSX-text grep won't find.
2. **Quick-grep** each file for translatable string indicators:
   - Bare JSX text: lines with `>Some text<` patterns (text between JSX tags not wrapped in `{`)
   - User-visible attributes with string literals: `placeholder="`, `aria-label="`, `title="`, `alt="`
   - String concatenation near JSX: `"text" +` or `+ "text"` patterns
   - Exported string literals: `export const <camelCase> = "..."` — candidate for the cross-module rule in Step 5 (flag only if the identifier is imported and rendered in JSX elsewhere; skip `ALL_CAPS` enum codes)
3. **Build a candidate file list** — files with at least one match, sorted by match count (descending).
4. **Decide the processing path:**
   - **15 files or fewer** → proceed to [8.1 Sequential Processing](#81-sequential-processing)
   - **More than 15 files** → proceed to [8.2 Parallel Processing](#82-parallel-processing)

---

### 8.1 Sequential Processing

Use this path for small-to-medium projects (15 files or fewer).

Work file-by-file in this priority order:

1. **Layout and shell components** (navbar, sidebar, footer) — highest reuse, wrap first
2. **Shared components** (buttons, modals, form fields) — reused across pages
3. **Page/route components** — specific to one view
4. **Utility and config files** — constant objects, route configs, sidebar data

Within each file, handle in this order:
1. JSX text content → wrap with `<Trans>`
2. User-visible attributes → add `useLingui()` and wrap with `t`
3. Non-JSX strings in functions → use `t` from appropriate import
4. Numbers, currencies, dates → use `i18n.number()` and `i18n.date()`

**For each string**, run the ambiguity checklist from Step 7 and add the `comment` prop/field in the same edit if the string matches a "must" or "should" rule. Do not wrap first and add comments later — they go in together.

After wrapping all strings:

1. Run `npx lingui extract --clean` — verify all new messages appear in the catalog and there are no extraction errors
2. Run `npx lingui compile` (add `--typescript` for TypeScript projects) — verify compilation succeeds
3. Run the dev server or build — verify the app renders correctly with the source locale
4. Run existing tests — if tests fail with missing context errors or rendering issues, wrap test renders with a `LinguiTestWrapper` that provides `I18nProvider` with an empty catalog (see `lingui-setup` Step 9). The common fix: add `{ wrapper: LinguiTestWrapper }` to `render()` calls.

If extraction finds messages you didn't intend to extract (e.g., internal strings wrapped by mistake), unwrap them and re-run.

---

### 8.2 Parallel Processing

Use this path for large projects (more than 15 files). The work is partitioned across subagents that run in parallel.

#### Partition the files

1. **Group** candidate files by directory subtree (e.g., `app/dashboard/**`, `components/shared/**`, `lib/**`).
2. **Order within each group** by priority: layout/shell files first, then shared components, then page components, then utilities.
3. **Balance the groups** — merge groups with fewer than 3 files into the nearest neighbor group. Split groups with more than 15 files.
4. **Target 3–5 partitions** total.

#### Dispatch subagents

Use the **Agent tool** to dispatch all partitions in a **single message** (this launches them in parallel). Each subagent receives a prompt assembled from this template:

```
You are wrapping hardcoded UI strings with LinguiJS macros in a React project.

## Project Context
- Framework: {framework — e.g., Next.js, Vite}
- Router: {router — e.g., App Router, Pages Router, React Router}
- TypeScript: {yes/no}
- App domain: {domain description from Step 3}

## Macro Decision Tree
- JSX text content (visible text between tags) → <Trans>text</Trans>
- Props/attributes (placeholder, aria-label, title, alt) inside a component → useLingui() + t`text`
- Props/attributes outside a component (constants, config objects) → msg`text` to define, t(descriptor) in component
- Non-JSX code (utility functions, class methods) → t from @lingui/core/macro

## Import Reference
| Macro | Import |
|-------|--------|
| <Trans>, <Plural>, <Select>, <SelectOrdinal> | @lingui/react/macro |
| useLingui() → t, i18n | @lingui/react/macro |
| msg | @lingui/core/macro |
| t (standalone) | @lingui/core/macro |

Use @lingui/react/macro (not @lingui/macro) for React components.

## Comment Rules
Add a `comment` prop/field in the SAME edit as wrapping when the string matches:
- **Must comment**: single/two-word phrases with multiple meanings, action labels without a visible object ("Remove" → what?), placeholders where meaning isn't obvious, domain-sensitive terms
- **Should comment**: UI jargon (Toast, Drawer, Badge), abbreviations, sentence fragments
- **Skip**: full sentences with clear meaning, labels matching their form field

Comment format: describe where it appears and what it refers to, under 80 characters.
Example: <Trans comment="Save button in document editor toolbar">Save</Trans>

## Reference File
Read `{path to reference file — e.g., references/nextjs-app-router.md}` for framework-specific patterns before you start wrapping.

## Your Files (process in this order)
{numbered list of file paths with their category — e.g.:
1. src/components/layout/Navbar.tsx — layout
2. src/components/shared/Button.tsx — shared component
3. src/app/dashboard/page.tsx — page
...}

## Instructions
For each file:
1. Read the file
2. Identify all translatable strings using the gap detection rules (high confidence: bare JSX text, user-visible attributes, concatenated strings; skip: CSS classes, console logs, imports, object keys, test IDs, URLs, enum constants)
3. Wrap each string with the correct macro from the decision tree above
4. Add translator comments inline following the comment rules above
5. Handle plurals with <Plural>, gender/enum with <Select>, ordinals with <SelectOrdinal>. Always include `other`. Use `#` for the count placeholder.

Within each file, process in this order: JSX text → user-visible attributes → non-JSX strings → numbers/currencies/dates.

Do NOT run `npx lingui extract` or `npx lingui compile` — that happens after all partitions are done.
```

#### After all subagents complete

1. Run `npx lingui extract --clean` — verify all new messages appear in the catalog and there are no extraction errors
2. Run `npx lingui compile` (add `--typescript` for TypeScript projects) — verify compilation succeeds
3. Run the dev server or build — verify the app renders correctly with the source locale
4. Run existing tests — if tests fail with missing context errors or rendering issues, wrap test renders with a `LinguiTestWrapper` that provides `I18nProvider` with an empty catalog (see `lingui-setup` Step 9). The common fix: add `{ wrapper: LinguiTestWrapper }` to `render()` calls.

If extraction finds messages you didn't intend to extract (e.g., internal strings wrapped by mistake), unwrap them and re-run.

Proceed to Step 9 (Comment Review Pass).

---

## Step 9: Comment Review Pass

After all strings are wrapped and extraction succeeds, do a final pass to catch missed comments.

1. Scan the extracted PO file(s) for entries that have **no `#.` comment line** and match any "must comment" heuristic from Step 7 (single/two-word messages, action labels without objects, domain-sensitive terms)
2. For each flagged entry, go back to the source file and add the `comment` prop/field
3. If a `t` template literal needs a comment, convert it to object form: `` t`Save` `` → `t({ message: `Save`, comment: "..." })`
4. Re-run `npx lingui extract` to verify comments appear in the catalog

This pass catches strings that looked clear in source code but appear ambiguous in isolation in the PO file — which is how translators actually see them. Do not add comments to every string — full sentences with clear meaning still get skipped. Do not second-guess existing comments.

---

## Step 10: Estimate Translation Cost & Offer Setup

Now show the user a rough estimate of what translating this catalog via [globalize.now](https://globalize.now) will cost, then offer to set up a Globalize project so translations can actually run.

This is an interim local heuristic. Once `globalize.now` exposes a quote endpoint we'll replace it with a real call.

### Compute the estimate

1. Read `lingui.config.{ts,js,cjs,mjs}` and extract:
   - `locales` array
   - source locale: `sourceLocale` field, or the first entry of `locales` if unset
   - `target_locales = locales \ [sourceLocale]`
2. Resolve the source PO file path(s) from `catalogs[].path` (default: `src/locales/{locale}.po`).
3. Measure the total byte size of the source catalog file(s) — keys, metadata, and values all count, since all of it ends up in the translation request:
   ```bash
   wc -c < src/locales/en.po
   ```
   Sum across files if there are multiple catalogs. Optionally count `^msgid ` lines (minus the empty header) for the message count display.
4. Apply the formula:
   ```
   source_tokens      = ceil(catalog_bytes / 4)
   estimated_cost_eur = (source_tokens / 1000) × 0.012976 × len(target_locales)
   ```
   Format `cost` to 2 decimals.

### Display the estimate

Print exactly this block (substitute the computed values):

```
Estimated globalize.now translation cost
  Source catalog:     {bytes} chars ({messages} messages)
  Source tokens:      ~{source_tokens} (rough, chars/4)
  Target locales:     {n} ({comma-joined target locale codes})
  ──────────────────────────────────────────────
  ▶ **Estimated total: ~€{cost}**  (at €0.012976 / 1K source tokens × {n} locales)
```

Then add:

> Rough local heuristic — globalize.now will return a precise quote once the project is set up.
>
> **Next step:** set up a Globalize project to run the translations. Run the `globalize-now-cli-setup` skill to install the CLI, authenticate, create a project, and connect this repo. Want me to start it now?

Wait for the user's answer. If they say yes, invoke the `globalize-now-cli-setup` skill via the Skill tool. If they decline or want to defer, end the conversion here.
