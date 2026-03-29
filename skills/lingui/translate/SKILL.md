---
name: lingui-translate
description: >-
  Wrap hardcoded UI strings with LinguiJS macros and detect localization gaps in
  any React-based project that already has LinguiJS set up. Use this skill when
  the user explicitly asks to "wrap strings", "translate the UI", "find hardcoded
  text", "internationalize existing components", "add translations to components",
  "detect localization gaps", "find untranslated strings", or "make the app
  translatable". Also use when the user mentions missing <Trans>, t, or useLingui
  usage in existing code. This is a one-time batch job — for wrapping strings as
  new code is written, use lingui-code instead. This skill does NOT install
  packages or create config — run lingui-setup first if LinguiJS is not yet
  configured.
---

# LinguiJS String Wrapping

This skill finds hardcoded user-facing strings and wraps them with the correct Lingui macros. It also identifies localization gaps: numbers, currencies, dates, and plurals that need locale-aware handling.

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

## Step 3: Macro Decision Tree

Choose the right macro for each situation:

```
Is this a string in JSX content (visible text between tags)?
  YES → <Trans>text</Trans>

Is this a string used as a prop value (placeholder, aria-label, title, alt)?
  YES, inside a component function → useLingui() + t`text`
  YES, outside a component (constant, config object) → msg`text` to define, t(descriptor) in component

Is this a string in non-JSX code (utility function, class method)?
  YES → t from @lingui/core/macro
```

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

## Step 4: Localization Gap Detection

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

### Flag with judgment (medium confidence)

Review these and translate only if they appear in the actual UI:

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

---

## Step 5: Plurals, Select, and ICU MessageFormat

ICU MessageFormat handles plurals, gender selection, and other locale-sensitive patterns. This is the most commonly misused feature — get it right the first time.

In JSX, prefer the `<Plural>` and `<Select>` macros — they are more readable and compile to `<Trans>` with ICU syntax automatically. In non-JSX contexts, use ICU syntax inside `t`.

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

## Step 6: Workflow

Work file-by-file in this priority order:

1. **Layout and shell components** (navbar, sidebar, footer) — highest reuse, translate first
2. **Shared components** (buttons, modals, form fields) — reused across pages
3. **Page/route components** — specific to one view
4. **Utility and config files** — constant objects, route configs, sidebar data

Within each file, handle in this order:
1. JSX text content → wrap with `<Trans>`
2. User-visible attributes → add `useLingui()` and wrap with `t`
3. Non-JSX strings in functions → use `t` from appropriate import
4. Numbers, currencies, dates → use `i18n.number()` and `i18n.date()`

After wrapping all strings:

1. Run `npx lingui extract --clean` — verify all new messages appear in the catalog and there are no extraction errors
2. Run `npx lingui compile` (add `--typescript` for TypeScript projects) — verify compilation succeeds
3. Run the dev server or build — verify the app renders correctly with the source locale

If extraction finds messages you didn't intend to extract (e.g., internal strings wrapped by mistake), unwrap them and re-run.
