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

### Next.js App Router (RSC) rules

If the project uses Next.js App Router, determine whether the component is a server or client component before choosing a pattern:

**Server components** (no `'use client'` directive):
- `<Trans>` works — but only if `setI18n(i18n)` has been called earlier in the render (typically in the layout or at the top of the page component).
- `useLingui()` works — it reads from the `setI18n()` instance, not React context. But `setI18n()` must have been called first.
- Every server page component must call `setI18n(i18n)` before rendering any translated content. If you're writing a new page, include the `setI18n` boilerplate. If you're editing an existing page, verify `setI18n` is already called upstream.
- For `i18n.number()` / `i18n.date()`, get the instance from `getI18nInstance(locale)` — not from `useLingui()`.

**Client components** (`'use client'`):
- Use the standard patterns below — `useLingui()`, `<Trans>`, etc. all read from `<I18nProvider>` context as usual.

```
Is this a server component (no 'use client')?
  YES → Verify setI18n(i18n) is called upstream in this request
      → Use <Trans>, useLingui() as normal — they read from setI18n()
      → For i18n.number()/i18n.date(), use getI18nInstance(locale) directly

Is this a client component ('use client')?
  YES → Use standard patterns below (useLingui, <Trans>, etc.)
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
| `setI18n` | `@lingui/react/server` |

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

> **Tree-shaking caveat:** Module-scope `msg` calls are side-effects that bundlers cannot remove, so the containing array/object ships in every chunk that imports the module — even if unused. For lazy-loaded routes in large apps, wrap the definition in a `/* @__PURE__ */` IIFE so the bundler can drop it when nothing references it:
> ```tsx
> const items = /* @__PURE__ */ (() => [
>   { label: msg`Home`, href: '/' },
>   { label: msg`Settings`, href: '/settings' },
> ])()
> ```

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

In Next.js App Router server components, get `i18n` from `getI18nInstance(locale)` directly:

```tsx
// Server component — no 'use client'
import { getI18nInstance } from '../appRouterI18n'

export default async function PricePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const i18n = getI18nInstance(lang)
  return <span>{i18n.number(42.5, { style: 'currency', currency: 'USD' })}</span>
}
```

**Flag for review:** `toFixed()`, currency symbols concatenated with numbers (`"$" + price`), date format strings like `"MM/DD/YYYY"`.

---

## Plurals, select, and ICU MessageFormat

In JSX, prefer the `<Plural>`, `<Select>`, and `<SelectOrdinal>` macros — they are more readable and compile to `<Trans>` with ICU syntax automatically. In non-JSX contexts (template literals), use ICU syntax inside `t`.

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

**SelectOrdinal (ordinal positions):**
```tsx
// JSX — use SelectOrdinal macro (preferred)
<SelectOrdinal value={position} one="#st" two="#nd" few="#rd" other="#th" />

// With surrounding text
<Trans>You finished in <SelectOrdinal value={position} one="#st" two="#nd" few="#rd" other="#th" /> place.</Trans>

// Non-JSX — use ICU syntax in t
t`{position, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}`
```

Ordinal categories differ from cardinal — English ordinals use `one` (1st, 21st), `two` (2nd, 22nd), `few` (3rd, 23rd), `other` (4th+).

### Rules

- `other` is **always required** — it is the fallback for all languages
- `#` is the count placeholder — do not repeat the variable name
- CLDR categories: `zero`, `one`, `two`, `few`, `many`, `other` — not `singular` / `plural`
- English only uses `one` and `other` — no need for `zero` in English plurals
- Keep all plural branches in one message — never split them into separate `t` calls

---

## What not to wrap

Skip these — wrapping them would cause false extractions:

- CSS class names: `className="font-bold text-sm"` — but when writing new CSS, use logical properties (`margin-inline-start`, not `margin-left`; `ms-4`, not `ml-4` in Tailwind). See the `css-i18n` skill.
- `console.log` / debug strings
- Import paths and module identifiers
- Object keys and internal codes
- `ALL_CAPS` enum values
- `data-testid` attributes
- URL strings and API paths

---

## Translator comments

Add a `comment` when the string is ambiguous out of context — short generic words ("Save", "Post", "Home"), action labels, or strings with non-obvious placeholders.

```tsx
<Trans comment="Main navigation link, not the building">Home</Trans>

const items = [
  { label: msg({ message: `Save`, comment: "Save document button" }), href: '/save' },
]
```

Use `context` when the same English text needs different translations in different places:

```tsx
<Trans context="direction">Right</Trans>
<Trans context="correctness">Right</Trans>
```

---

## A note on domain namespacing

You do not need to add domain prefixes (like `auth.login` or `dashboard.alerts`) to `context` values as a namespacing strategy. With AI-powered translation, the reasons for domain namespacing largely disappear:

- **Identical strings should share translations.** "Save" in auth and "Save" in dashboard mean the same thing — one translation entry is correct. Domain namespacing via `context` would create duplicate entries that must be translated identically.
- **`context` is for disambiguation, not organization.** Use it only when the same English text genuinely needs different translations in different places (e.g., "Right" as direction vs. correctness).
- **Per-page catalogs already provide organization.** If you use Lingui's per-page catalog extraction (see `lingui-setup`), translations are automatically scoped to each route's dependency tree.
