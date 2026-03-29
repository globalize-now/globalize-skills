---
name: lingui-code
description: >-
  Apply automatically whenever writing or modifying UI code in a LinguiJS
  project — new components, new strings, edited copy, new form fields, anything
  that adds or changes user-visible text. Not user-invocable. Ensures strings,
  numbers, currencies, dates, and plurals are wrapped correctly as code is
  written, so nothing needs fixing after the fact.
---

# LinguiJS Coding Rules

Apply these rules as you write code. Every user-visible string must be wrapped before the task is complete.

---

## Macro decision tree

```
Is this text rendered in JSX?
  YES → <Trans>text</Trans>

Is this a prop value (placeholder, aria-label, title, alt) inside a component?
  YES → const { t } = useLingui()  then  t`text`

Is this defined outside a component (constant, config object, array)?
  YES → msg`text` to define, t(descriptor) to resolve inside the component

Is this in non-React code (utility, class, standalone function)?
  YES → import { t } from '@lingui/core/macro'
```

### Import reference

| Macro | Import |
|-------|--------|
| `<Trans>` | `@lingui/react/macro` |
| `<Plural>` | `@lingui/react/macro` |
| `<Select>` | `@lingui/react/macro` |
| `<SelectOrdinal>` | `@lingui/react/macro` |
| `useLingui()` → `t`, `i18n` | `@lingui/react/macro` |
| `msg` | `@lingui/core/macro` |
| `t` (standalone) | `@lingui/core/macro` |

> Use `@lingui/react/macro` — not the deprecated `@lingui/macro`.

---

## Common patterns

**JSX text:**
```tsx
import { Trans } from '@lingui/react/macro'
<h1><Trans>Dashboard</Trans></h1>
<p><Trans>No results found.</Trans></p>
```

**Props and attributes:**
```tsx
import { useLingui } from '@lingui/react/macro'
function Field() {
  const { t } = useLingui()
  return <input placeholder={t`Search...`} aria-label={t`Search`} />
}
```

**Interpolation:**
```tsx
<Trans>Hello, {user.name}!</Trans>
t`Welcome back, ${user.name}!`
```

**Constants outside components:**
```tsx
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'

const items = [
  { label: msg`Home`, href: '/' },
  { label: msg`Settings`, href: '/settings' },
]

function Nav() {
  const { t } = useLingui()
  return items.map(item => <a href={item.href}>{t(item.label)}</a>)
}
```

---

## Numbers, currencies, dates

Do not hardcode formatted numbers, currency symbols, or date strings. Use Lingui's `i18n.number()` and `i18n.date()` helpers — they wrap `Intl.NumberFormat` / `Intl.DateTimeFormat` with the active locale automatically.

```tsx
import { useLingui } from '@lingui/react/macro'

function Price({ amount }: { amount: number }) {
  const { i18n } = useLingui()
  return <span>{i18n.number(amount, { style: 'currency', currency: 'USD' })}</span>
}

function EventDate({ timestamp }: { timestamp: number }) {
  const { i18n } = useLingui()
  return <time>{i18n.date(new Date(timestamp), { dateStyle: 'medium' })}</time>
}
```

In Next.js server components, get `i18n` from your server-side setup (e.g. `getI18nInstance()`) rather than `useLingui()`.

**Flag for review:** `toFixed()`, currency symbols concatenated with numbers (`"$" + price`), date format strings like `"MM/DD/YYYY"`.

---

## Plurals, select, and ICU MessageFormat

In JSX, prefer the `<Plural>` and `<Select>` macros — they are more readable and compile to `<Trans>` with ICU syntax automatically. In non-JSX contexts (template literals), use ICU syntax inside `t`.

Never use ternaries to pick between two separate translation strings.

```tsx
import { Plural, Select } from '@lingui/react/macro'

// JSX — use Plural macro (preferred)
<Plural value={count} one="# item" other="# items" />

// JSX — exact match for zero
<Plural value={count} _0="No items" one="# item" other="# items" />

// Non-JSX — use ICU syntax in t
t`{count, plural, one {# result} other {# results}}`

// Wrong — two messages, broken in many languages
count === 1 ? t`item` : t`items`
```

**Select (gender, status):**
```tsx
// JSX — use Select macro (preferred)
<Select value={gender} male="He liked it" female="She liked it" other="They liked it" />

// Non-JSX — use ICU syntax in t
t`{gender, select, male {He liked it} female {She liked it} other {They liked it}}`
```

### Rules

- `other` is **always required** — it is the fallback for all languages
- `#` is the count placeholder — do not repeat the variable name
- CLDR categories: `zero`, `one`, `two`, `few`, `many`, `other` — not `singular` / `plural`
- English only uses `one` and `other` — no need for `zero` in English plurals
- Keep all plural branches in one message — never split them into separate `t` calls

---

## What not to wrap

Skip these — wrapping them would cause false extractions:

- CSS class names: `className="font-bold text-sm"`
- `console.log` / debug strings
- Import paths and module identifiers
- Object keys and internal codes
- `ALL_CAPS` enum values
- `data-testid` attributes
- URL strings and API paths
