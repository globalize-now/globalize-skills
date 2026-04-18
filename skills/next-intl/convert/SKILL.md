---
name: next-intl-convert
description: >-
  Wrap hardcoded UI strings with next-intl translation functions in a Next.js
  project that already has next-intl configured. Use this skill when the user
  asks to "wrap strings", "find hardcoded text", "internationalize existing
  components", "make the UI translatable", "detect localization gaps",
  "find unwrapped strings", or "convert strings for translation". Also use when
  the user mentions missing useTranslations or getTranslations usage in existing
  code. This is a one-time batch job. This skill does NOT translate content into
  other languages — it only makes strings translatable. It does NOT install
  packages or create config — run next-intl-setup first if next-intl is not yet
  configured.
---

# next-intl String Wrapping

This skill finds hardcoded user-facing strings and wraps them with next-intl translation functions. It also identifies localization gaps: numbers, currencies, dates, and plurals that need locale-aware handling.

> **Scope:** This skill converts strings to make them translatable — it does not translate content. All strings remain in the source language after conversion.

---

## Step 1: Prerequisite Check

Before wrapping anything, verify next-intl is configured:

1. Check that `next-intl` is in `node_modules` (i.e., `npm ls next-intl` exits 0)
2. Check that `next.config.*` uses `createNextIntlPlugin()` (import from `next-intl/plugin`)
3. Check that message files exist in the `messages/` directory (e.g., `messages/en.json`)
4. Check that `NextIntlClientProvider` is wired in the root layout (`app/layout.tsx` or `app/[locale]/layout.tsx`) or `_app.tsx`

5. **Pages Router only:** Check that at least one page has `getStaticProps` or `getServerSideProps` returning `messages` in its props. Without this, `useTranslations` will silently return empty strings. Spot-check the most visited page (e.g., `pages/index.tsx`).

If any check fails, stop and tell the user to run the `next-intl-setup` skill first. This skill never installs packages or modifies build configuration.

---

## Step 2: Detect the Project

Read `package.json` and the directory structure to determine the project type:

| Signal | How to detect |
|--------|--------------|
| **Framework** | `next` in deps → Next.js |
| **Router** | `app/` directory with `layout.tsx` → App Router. `pages/` directory with `_app.tsx` → Pages Router. |
| **TypeScript** | `typescript` in devDeps or `tsconfig.json` exists. |

Examine existing message files (`messages/*.json`) to understand the current namespace structure — top-level keys represent namespaces, nested objects represent sub-namespaces.

Based on detection, read the relevant reference file for framework-specific patterns:

- **Next.js App Router** → read `references/nextjs-app-router.md`
- **Next.js Pages Router** → read `references/nextjs-pages-router.md`

Then continue with the steps below.

---

## Step 3: API Decision Tree

Choose the right function for each situation:

```
Does the string's wording change based on a number (e.g. "3 items" / "1 item", "You have {n} messages")?
  YES → store as ICU plural in messages/*.json and call t('key', {count}) (see Step 5)
        then continue below to pick the right translator API (server vs. client)

Is this a Server Component (no 'use client' directive, in app/ directory)?
  YES → getTranslations(namespace) from next-intl/server (async, must await)

Is this a Client Component ('use client' directive)?
  YES → useTranslations(namespace) from next-intl (hook)

Need to format dates/numbers/relative time?
  Server → getFormatter() from next-intl/server
  Client → useFormatter() from next-intl

Need current locale?
  Server → getLocale() from next-intl/server
  Client → useLocale() from next-intl

Pages Router?
  All components → useTranslations(namespace) from next-intl (hook)
  Formatting → useFormatter() from next-intl
```

### Import reference table

| Function | Import | Use case |
|----------|--------|----------|
| `useTranslations(ns)` | `next-intl` | Client component translations |
| `getTranslations(ns)` | `next-intl/server` | Server component translations (async) |
| `useFormatter()` | `next-intl` | Client date/number formatting |
| `getFormatter()` | `next-intl/server` | Server date/number formatting |
| `useLocale()` | `next-intl` | Client current locale |
| `getLocale()` | `next-intl/server` | Server current locale |

### Examples

**Server Component (App Router):**
```tsx
import {getTranslations} from 'next-intl/server';

// Before
export default async function HomePage() {
  return <h1>Welcome back</h1>;
}

// After
export default async function HomePage() {
  const t = await getTranslations('HomePage');
  return <h1>{t('title')}</h1>;
}
```

Note: `getTranslations` is async and must be awaited. If the component is not already `async`, make it `async` when adding `getTranslations`.

**Client Component:**
```tsx
'use client';
import {useTranslations} from 'next-intl';

// Before
export default function SearchBar() {
  return <input placeholder="Search..." aria-label="Search" />;
}

// After
export default function SearchBar() {
  const t = useTranslations('Search');
  return <input placeholder={t('placeholder')} aria-label={t('label')} />;
}
```

**Formatting (Client Component):**
```tsx
import {useFormatter} from 'next-intl';

// Before
<span>{price.toFixed(2)} USD</span>
<time>{date.toLocaleDateString()}</time>

// After
const format = useFormatter();
<span>{format.number(price, {style: 'currency', currency: 'USD'})}</span>
<time>{format.dateTime(date, {year: 'numeric', month: 'short', day: 'numeric'})}</time>
```

**Formatting (Server Component):**
```tsx
import {getFormatter} from 'next-intl/server';

const format = await getFormatter();
<p>{format.number(amount, {style: 'currency', currency: 'EUR'})}</p>
```

**Relative time:**
```tsx
import {useFormatter, useNow} from 'next-intl';

const format = useFormatter();
const now = useNow({updateInterval: 1000 * 60});
<span>{format.relativeTime(date, now)}</span>
```

**Generating metadata (App Router):**
```tsx
import {getTranslations} from 'next-intl/server';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'Metadata'});
  return {title: t('title'), description: t('description')};
}
```

---

## Step 4: Localization Gap Detection

Scan files systematically for these patterns. Apply the confidence tiers to decide what to flag.

### Always flag (high confidence)

- **Bare JSX text**: Visible text between tags that is not wrapped in `{t('key')}`
  ```tsx
  <h1>Welcome</h1>                // <- flag
  <h1>{t('title')}</h1>           // <- ok
  ```

- **User-visible attributes without `t()`**:
  - `placeholder="..."` — input placeholder
  - `aria-label="..."` — screen reader label
  - `title="..."` — tooltip text
  - `alt="..."` — image alt text (when descriptive, not decorative)

- **Concatenated strings**: User-visible strings built from `+` or template literals
  ```tsx
  const msg = "Hello " + name + "!"  // <- flag, use t('greeting', {name}) instead
  ```

- **Count-dependent phrasing — plural candidates**: Any UI string that combines a number (literal, variable, prop, or expression) with wording that changes based on that number. This is the most commonly-missed gap — do not store these as plain strings in `messages/*.json`. Route them to Step 5.
  ```tsx
  <p>You have 3 new messages</p>              // <- flag — plural
  <span>{`${count} items`}</span>              // <- flag — plural
  <div>{items.length} results</div>            // <- flag — plural
  ```
  ```tsx
  // Wrong — plain key, English plural baked into the message
  <p>{t('itemsSelected', {count})}</p>
  // messages/en.json: {"itemsSelected": "{count} items selected"}

  // Right — ICU plural, every language's rules are localizable
  <p>{t('itemsSelected', {count})}</p>
  // messages/en.json:
  //   {"itemsSelected": "{count, plural, one {# item selected} other {# items selected}}"}
  ```
  Also flag `count === 1 ? t('itemSingular') : t('itemPlural')` ternaries — two keys cannot express plural rules in other languages. Rewrite as a single ICU plural key.

- **Imported strings referenced in JSX**: `<h1>{title}</h1>` where `title` is an imported identifier. Trace the import to its definition; if it resolves to a bare string literal (e.g. `export const title = "Welcome"`), flag it.

  **Disambiguation — a JSX expression `{foo}` can be:**
  1. An import resolving to a string literal in another module → **flag** (see resolution below)
  2. A component prop passed from a parent → **skip** (the parent will be processed on its own turn)
  3. A local variable or function parameter → **handle at the assignment site in the same file**
  4. A formatted or computed value (`{format.dateTime(x)}`, `{count + 1}`) → **not a string** — handle the underlying data, not the expression

  Only case (1) adds a new flag. Files matching `**/{constants,copy,strings,labels,messages,i18n}*.{ts,tsx,js,jsx}` are the highest-signal locations.

  **Resolution for next-intl:** next-intl has no `msg`-descriptor equivalent and cannot wrap a string at the definition site while keeping the identifier export alive. Pick one:
  - **Pull the string into the component** that renders it. Replace `<h1>{title}</h1>` with `<h1>{t('title')}</h1>` and add `title` to the component's namespace in `messages/{locale}.json`. Delete the export if nothing else uses it.
  - **Keep a key at the definition site** if the string is genuinely shared: `export const titleKey = 'common.welcomeTitle'` and call `t(titleKey)` at the call site. The value lives in `messages/{locale}.json`, not the TS module.

  Do not mimic the Lingui `msg`-at-definition / `t(descriptor)`-at-call-site pattern — it doesn't exist in next-intl.

### Flag with judgment (medium confidence)

Review these and wrap only if they appear in the actual UI:

- **`toFixed()` and number formatting**: Raw `toFixed()` won't respect locale decimal separators. Use `format.number()` instead.
- **Currency symbols hardcoded near numbers**: `"$" + price` or `price + " USD"` — use `format.number(price, {style: 'currency', currency: 'USD'})`.
- **Date formatting without locale**: `date.toLocaleDateString()` without a locale argument uses the runtime locale, which may be fine. Explicit format strings like `"MM/DD/YYYY"` are not locale-aware — use `format.dateTime()`.
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

## Step 5: ICU Patterns in next-intl

Message files (`messages/*.json`) use ICU MessageFormat. All translation values are ICU strings — the same syntax used by FormatJS and other ICU-based libraries.

### Interpolation

```json
{"greeting": "Hello, {name}!"}
```
```tsx
t('greeting', {name: user.name})
```

### Plurals

```json
{"items": "You have {count, plural, one {# item} other {# items}}"}
```
```tsx
t('items', {count: items.length})
```

**The `#` placeholder** is replaced by the actual number. Do not write the variable name again — write `#`.

### Exact numeric matches and ordinals

Use `=0`, `=1`, `=2` for exact value matching: `{count, plural, =0 {No followers yet} =1 {One follower} other {# followers}}`. Use `selectordinal` for ordinals: `{year, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}`.

### Select

```json
{"status": "{gender, select, male {He} female {She} other {They}} liked your post"}
```
```tsx
t('status', {gender: user.gender})
```

### Rich text (HTML-like tags in messages)

Rich text lets you embed React components inside translated strings using XML-like tags:

```json
{"terms": "By signing up you agree to our <link>terms</link>."}
```
```tsx
t.rich('terms', {
  link: (chunks) => <a href="/terms">{chunks}</a>
})
```

Multiple tags work the same way — each tag name maps to a render function.

Use `t.markup` instead of `t.rich` when you need an HTML string (e.g., for `dangerouslySetInnerHTML`) — the tag functions return strings instead of React elements.

### Nested messages (dot notation)

```json
{
  "auth": {
    "login": {"title": "Sign in", "submit": "Log in"},
    "register": {"title": "Create account"}
  }
}
```
```tsx
const t = useTranslations('auth.login');
t('title')   // "Sign in"
t('submit')  // "Log in"
```

### CLDR plural categories

English only uses `one` and `other`, but other languages have `zero`, `two`, `few`, `many`. Always include `other` — it is required and serves as the fallback. Translators will add the categories their language needs.

### Top 5 ICU mistakes

1. **Missing `other`**: Every plural/select expression must have `other`. Without it, formatting will fail at runtime.
   ```
   // Wrong
   {count, plural, one {# item}}
   // Right
   {count, plural, one {# item} other {# items}}
   ```

2. **Using `zero` for English**: English has no `zero` CLDR category. Use `=0` for exact zero matching, or rely on `other` for zero counts.
   ```
   // Unnecessary CLDR category for English
   {count, plural, zero {no items} one {# item} other {# items}}
   // Use exact match if you want special zero text
   {count, plural, =0 {No items} one {# item} other {# items}}
   ```

3. **Forgetting `#`**: The `#` is replaced by the count. Writing the variable name again is wrong.
   ```
   // Wrong
   {count, plural, one {count item} other {count items}}
   // Right
   {count, plural, one {# item} other {# items}}
   ```

4. **Wrong category names**: CLDR categories are `zero`, `one`, `two`, `few`, `many`, `other` — not `singular`, `plural`, `multiple`.

5. **Fragmenting plural branches into separate translation keys**: Each plural expression should be one message, not multiple separate ones.
   ```tsx
   // Wrong — two separate keys, broken grammar in many languages
   const label = count === 1 ? t('itemSingular') : t('itemPlural')

   // Right — one message with plural logic
   // messages/en.json: {"items": "{count, plural, one {# item} other {# items}}"}
   const label = t('items', {count})
   ```

---

## Step 6: Namespace Strategy

next-intl organizes translations by namespace — top-level keys in the messages JSON. Namespaces scope translations so each component only loads the keys it needs.

### How namespaces work

Top-level keys in `messages/*.json` are namespaces. `useTranslations('HomePage')` scopes to the `HomePage` key. Example structure:

```json
{
  "HomePage": {"title": "Welcome", "subtitle": "Get started"},
  "Navigation": {"home": "Home", "about": "About"},
  "Common": {"save": "Save", "cancel": "Cancel"}
}
```

### Namespace naming conventions

- Match namespace to the component's domain: `HomePage`, `Navigation`, `Common`, `Auth`, `Dashboard`
- Use PascalCase for namespace names (consistent with React component naming)
- Keep to 1-2 levels of nesting — avoid deeply nested namespaces
- Shared strings (buttons, labels, status text used across many pages) go in a `Common` namespace
- Page-specific strings get their own namespace matching the page name

### Sub-namespaces with dot notation

Use nested objects and dot notation for related groups: `useTranslations('Auth.login')` scopes to `{"Auth": {"login": {...}}}`. Keep nesting to 1-2 levels.

### Choosing a namespace for new strings

1. Does this component already use `useTranslations('X')` or `getTranslations('X')`? → Add keys to namespace `X`.
2. Is this a shared component used across pages? → Use `Common` or a domain-specific shared namespace.
3. Is this a page component? → Create a namespace matching the page name (e.g., `Dashboard`, `Settings`).
4. Is this a feature-specific component? → Use the feature name as namespace (e.g., `Cart`, `Checkout`).

---

## Step 7: Workflow

### 7.0 Discovery and Scale Assessment

Before wrapping strings, scan the project to determine scope:

1. **Glob** for all `.tsx`, `.ts`, `.jsx`, `.js` files under the source directories. Exclude `node_modules`, test files (`*.test.*`, `*.spec.*`, `__tests__/`), config files (`*.config.*`), and type declarations (`.d.ts`). Treat files matching `**/{constants,copy,strings,labels,messages,i18n}*.{ts,tsx,js,jsx}` as high-signal — they often hold exported user-facing string constants that JSX-text grep won't find.
2. **Quick-grep** each file for translatable string indicators:
   - Bare JSX text: lines with `>Some text<` patterns (text between JSX tags not wrapped in `{`)
   - User-visible attributes with string literals: `placeholder="`, `aria-label="`, `title="`, `alt="`
   - String concatenation near JSX: `"text" +` or `+ "text"` patterns
   - Exported string literals: `export const <camelCase> = "..."` — candidate for the cross-module rule in Step 4 (flag only if the identifier is imported and rendered in JSX elsewhere; skip `ALL_CAPS` enum codes)
3. **Build a candidate file list** — files with at least one match, sorted by match count (descending).
4. **Decide the processing path:**
   - **15 files or fewer** → proceed to [7.1 Sequential Processing](#71-sequential-processing)
   - **More than 15 files** → proceed to [7.2 Parallel Processing](#72-parallel-processing)

---

### 7.1 Sequential Processing

Use this path for small-to-medium projects (15 files or fewer).

Work file-by-file in this priority order:

1. **Layout and shell components** (navbar, sidebar, footer) — highest reuse, wrap first
2. **Shared components** (buttons, modals, form fields) — reused across pages
3. **Page/route components** — specific to one view
4. **Utility files** with user-visible strings (constants, route configs, notification messages)

Within each file, handle in this order:

1. **Determine Server or Client Component** (App Router) — check for `'use client'` directive. No directive in `app/` directory means Server Component.
2. **Import the appropriate function**:
   - Server Component → `import {getTranslations} from 'next-intl/server'`
   - Client Component → `import {useTranslations} from 'next-intl'`
   - Pages Router → always `import {useTranslations} from 'next-intl'`
3. **Choose or create a namespace** matching the component's domain (see Step 6)
4. **Wrap strings** using `t('key')` for all user-facing text
5. **Add corresponding keys** to `messages/{locale}.json` under the chosen namespace

### Adding keys to message files

When wrapping a string, add the key to every locale file. For the source locale, use the actual text. For other locales, copy the source text as a placeholder (to be translated later). Every locale file must have the same key structure.

### Passing server-translated strings to Client Components

In App Router, when a Client Component only needs a few static strings, prefer translating in the Server Component and passing strings as props — this avoids sending translation bundles to the client:

```tsx
// Server Component — translate here, pass as props
const t = await getTranslations('Dashboard');
<StatusBadge label={t('status')} />
```

If the Client Component needs many translations or handles dynamic content, use `useTranslations` directly — `NextIntlClientProvider` already sends messages to the client.

### After batch wrapping

1. **Check all locale files have the same keys** — every key in `messages/en.json` must exist in `messages/de.json`, `messages/fr.json`, etc. Missing keys will cause runtime warnings.
2. **Run the dev server** — verify no missing key warnings in the console. next-intl logs warnings for missing messages by default.
3. **Run existing tests** — if tests fail with missing provider errors, ensure the test setup wraps components with `NextIntlClientProvider`:
   ```tsx
   import {NextIntlClientProvider} from 'next-intl';

   function renderWithIntl(ui: React.ReactElement, messages = {}) {
     return render(
       <NextIntlClientProvider locale="en" messages={messages}>
         {ui}
       </NextIntlClientProvider>
     );
   }
   ```
   The common fix: wrap test renders with `NextIntlClientProvider` providing `locale` and `messages` props.

---

### 7.2 Parallel Processing

Use this path for large projects (more than 15 files). The work is partitioned across subagents that run in parallel. Subagents only edit source files — message JSON files are updated in a merge step after all subagents complete.

#### Partition the files

1. **Group** candidate files by directory subtree (e.g., `app/dashboard/**`, `components/shared/**`, `lib/**`).
2. **Order within each group** by priority: layout/shell files first, then shared components, then page components, then utilities.
3. **Balance the groups** — merge groups with fewer than 3 files into the nearest neighbor group. Split groups with more than 15 files.
4. **Target 3–5 partitions** total.

#### Pre-assign namespaces

Before dispatching subagents:

1. Read the existing namespace structure from the source locale message file (e.g., `messages/en.json`).
2. Map each partition's directories to namespaces using the naming conventions from Step 6.
3. Assign each partition a list of namespaces it owns. If a namespace doesn't exist yet, include it in the assignment for the partition whose files will use it.
4. The `Common` namespace (shared strings) should be assigned to the partition that contains shared components. Other partitions that need a common string should create a feature-specific key instead — duplicates are resolved in the merge step.

#### Dispatch subagents

Use the **Agent tool** to dispatch all partitions in a **single message** (this launches them in parallel). Each subagent receives a prompt assembled from this template:

```
You are wrapping hardcoded UI strings with next-intl translation functions in a Next.js project.

## Project Context
- Router: {App Router / Pages Router}
- TypeScript: {yes/no}

## API Decision Tree
- Server Component (no 'use client', in app/ directory) → getTranslations(namespace) from next-intl/server (async, must await)
- Client Component ('use client' directive) → useTranslations(namespace) from next-intl (hook)
- Pages Router → always useTranslations(namespace) from next-intl
- Formatting: Server → getFormatter() from next-intl/server, Client → useFormatter() from next-intl
- Locale: Server → getLocale() from next-intl/server, Client → useLocale() from next-intl

## Your Namespace Assignment
You own these namespaces: {list of namespaces}
Existing namespace structure:
{JSON snippet of current messages/en.json relevant to this partition's namespaces}

Namespace rules:
- PascalCase names matching the component domain (HomePage, Navigation, Common, Auth)
- Sub-namespaces via dot notation: useTranslations('Auth.login')
- Add keys under your assigned namespaces only

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
3. Determine if it's a Server or Client Component (App Router) — check for 'use client' directive
4. Import the correct function (getTranslations for server, useTranslations for client)
5. Wrap each string with t('key') using an appropriate key name
6. Handle plurals, select, and ordinals using ICU syntax in the message values. Always include `other`. Use `#` for the count placeholder.

Within each file, process in this order: JSX text → user-visible attributes → non-JSX strings → numbers/currencies/dates.

## IMPORTANT: Do not edit message files
Do NOT directly edit any files in the messages/ directory.
Instead, after processing all your files, output a JSON object listing every new key you need added:

{
  "Namespace": {
    "key": "English value",
    "anotherKey": "Another English value"
  }
}

Include only keys you actually used in your t() calls. Use the same nesting structure as the message files.
```

#### After all subagents complete — merge message keys

1. **Collect** the JSON key objects from all subagent outputs.
2. **Check for collisions** — if two subagents added the same namespace + key combination with different values, resolve by keeping the more descriptive value.
3. **Deep-merge** all keys into `messages/{locale}.json` for each locale file:
   - Source locale (e.g., `en.json`): use the actual English values from the subagent outputs
   - Other locales: copy the source text as a placeholder (to be translated later)
4. **Verify** all locale files have the same key structure.

#### Verification

1. **Run the dev server** — verify no missing key warnings in the console. next-intl logs warnings for missing messages by default.
2. **Run existing tests** — if tests fail with missing provider errors, ensure the test setup wraps components with `NextIntlClientProvider`:
   ```tsx
   import {NextIntlClientProvider} from 'next-intl';

   function renderWithIntl(ui: React.ReactElement, messages = {}) {
     return render(
       <NextIntlClientProvider locale="en" messages={messages}>
         {ui}
       </NextIntlClientProvider>
     );
   }
   ```
   The common fix: wrap test renders with `NextIntlClientProvider` providing `locale` and `messages` props.

#### Estimate Translation Cost & Offer Setup

Now show the user a rough estimate of what translating this catalog via [globalize.now](https://globalize.now) will cost, then offer to set up a Globalize project so translations can actually run.

This is an interim local heuristic. Once `globalize.now` exposes a quote endpoint we'll replace it with a real call.

**Compute the estimate:**

1. Locate the messages directory (typically `messages/` or `src/messages/`).
2. Determine the source locale from the i18n config (`i18n/request.ts`, `i18n.ts`, or `routing.ts`) — `defaultLocale` if set, otherwise the first entry of `locales`. `target_locales = locales \ [sourceLocale]`.
3. Measure the byte size of the source catalog file (keys + values + JSON structure all count, since all of it ends up in the translation request):
   ```bash
   wc -c < messages/en.json
   ```
4. Apply the formula:
   ```
   source_tokens      = ceil(catalog_bytes / 4)
   estimated_cost_eur = (source_tokens / 1000) × 0.012976 × len(target_locales)
   ```
   Format `cost` to 2 decimals. Optionally count the leaf string values for the message count display.

**Display the estimate.** Print exactly this block (substitute the computed values):

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
