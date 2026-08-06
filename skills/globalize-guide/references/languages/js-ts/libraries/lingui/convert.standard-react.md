# React Standard: String Wrapping Patterns

This covers Vite (SWC or Babel), React Router, TanStack Router, Create React App, and any other React setup without React Server Components. All hooks are available in all components — no RSC constraints.

---

## Core macro usage

All components can use `useLingui()` and `<Trans>` without restriction.

```tsx
import { Trans, useLingui } from '@lingui/react/macro'

function WelcomeBanner({ name }: { name: string }) {
  const { t } = useLingui()
  return (
    <section aria-label={t`Welcome section`}>
      <h1><Trans>Welcome back, {name}!</Trans></h1>
      <p><Trans>Here's what's happening today.</Trans></p>
    </section>
  )
}
```

---

## Sidebar and navigation data

Navigation items are often defined as constant arrays outside components. Use `msg` to mark them for extraction, then resolve with `t()` inside the component that renders them.

```tsx
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import type { MessageDescriptor } from '@lingui/core'

// Define at module scope — msg marks strings for extraction without calling t
const sidebarItems: Array<{ label: MessageDescriptor; href: string }> = [
  { label: msg({ message: `Dashboard`, comment: "Main navigation sidebar" }), href: '/' },
  { label: msg`Users`, href: '/users' },
  { label: msg`Settings`, href: '/settings' },
  { label: msg`Reports`, href: '/reports' },
]

// Resolve inside the rendering component
function Sidebar() {
  const { t } = useLingui()
  const localePath = useLocalePath()   // only on projects with locale-prefixed URLs — see below
  return (
    <nav>
      {sidebarItems.map(item => (
        <a key={item.href} href={localePath(item.href)}>
          {t(item.label)}
        </a>
      ))}
    </nav>
  )
}
```

> **Why not `t` at module scope?** `t` at module scope would be called once at module initialization, before the i18n instance is activated with the user's locale. `msg` returns a descriptor object that is resolved lazily when `t(descriptor)` is called inside a component.

**The `href` matters as much as the label.** Translating the label and leaving `href: '/'` bare gives a localized nav that sends every user back to the source locale. Whether paths need the prefix is a project fact — check the project's i18n rules file, or look for a `navigation` module beside the locale constants.

## Locale-aware links

Read the project's generated i18n rules before touching an `href`; they state which of these applies.

- **The project has an i18n `navigation` module** — take `useLocalePath()` from it inside components (`localePath('/about')`), and the two-argument `localePath(path, locale)` in loaders, actions, `redirect()` and Server Components, where hooks don't run. Never hand-build `` `/${locale}/about` ``.
- **The project uses TanStack Router** — do not wrap `<Link>`; its `to` and `params` are typed against the route tree. Use `<Link to="/$locale/about" params={{ locale }}>` with the locale from `useLocale()`.
- **The project has no locale in its URLs** (cookie-only or single-locale) — leave every `href` and `to` exactly as it is. There is nothing to prefix.

When wrapping strings in a file whose links look wrong for the project's strategy, fix the label and **flag the link** rather than silently rewriting routing — say which file and which `href`.

> **Translator comments:** Use the object form `msg({ message: \`...\`, comment: "..." })` when a string is ambiguous — short words like "Dashboard" benefit from context like "Main navigation sidebar" so translators know the UI location.

---

## Route titles (TanStack Router)

TanStack Router's `loader` runs in a component context when using `@tanstack/react-router`, so you can use `getI18n()` or pass the i18n instance through context. The simplest approach is to use `msg` for route meta and resolve in the component.

```tsx
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { createFileRoute } from '@tanstack/react-router'

// Define message descriptor
const pageTitle = msg`User Management`

export const Route = createFileRoute('/users')({
  component: UsersPage,
})

function UsersPage() {
  const { t } = useLingui()
  return (
    <>
      <title>{t(pageTitle)}</title>
      <h1><Trans>User Management</Trans></h1>
    </>
  )
}
```

---

## Form validation messages

Form validators typically run outside React render (in schema definitions or event handlers). Use `msg` for schema-level messages and resolve them in the component, or use `t` from `@lingui/core/macro` in utility functions that run within the i18n context.

```tsx
// In a Zod schema — use msg and resolve at render time
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { z } from 'zod'
import type { MessageDescriptor } from '@lingui/core'

const fieldErrors = {
  required: msg`This field is required`,
  email: msg`Enter a valid email address`,
  minLength: msg`Must be at least 8 characters`,
} satisfies Record<string, MessageDescriptor>

function SignUpForm() {
  const { t } = useLingui()

  function validate(value: string) {
    if (!value) return t(fieldErrors.required)
    if (value.length < 8) return t(fieldErrors.minLength)
    return null
  }

  // ...
}
```

---

## Toast and notification messages

Toast libraries like `react-hot-toast`, `sonner`, or `react-toastify` accept strings. Call `t` inside the event handler (which runs inside a component context via closures).

```tsx
import { useLingui } from '@lingui/react/macro'
import { toast } from 'sonner'

function SaveButton() {
  const { t } = useLingui()

  async function handleSave() {
    try {
      await save()
      toast.success(t`Changes saved successfully`)
    } catch {
      toast.error(t`Failed to save changes. Please try again.`)
    }
  }

  return <button onClick={handleSave}><Trans>Save</Trans></button>
}
```

---

## Numbers, currencies, and dates

Use `i18n.number()` and `i18n.date()` for locale-aware formatting — they wrap `Intl.NumberFormat` / `Intl.DateTimeFormat` with the active locale automatically. Pass the project's shared presets (`CURRENCY`, `DATE_SHORT`, `DATE_MEDIUM`, `DATE_TIME`, exported from the locale module) rather than retyping an options object at each call site — the currency code in particular must not drift.

```tsx
import { useLingui } from '@lingui/react/macro'
import { CURRENCY, DATE_MEDIUM } from '<the project's locale module>'

function PriceDisplay({ amount }: { amount: number }) {
  const { i18n } = useLingui()
  return <span>{i18n.number(amount, CURRENCY)}</span>
}

function EventDate({ timestamp }: { timestamp: number }) {
  const { i18n } = useLingui()
  return <time>{i18n.date(new Date(timestamp), DATE_MEDIUM)}</time>
}
```

The generated i18n rules file carries the real import path. If a format the project needs has no preset yet, add one to the locale module rather than inlining the options.

In non-component code where you have a locale string but no `i18n` instance, use `Intl.NumberFormat` / `Intl.DateTimeFormat` directly — still with the presets:

```tsx
const formatted = new Intl.NumberFormat(locale, CURRENCY).format(amount)
const date = new Intl.DateTimeFormat(locale, DATE_MEDIUM).format(new Date(timestamp))
```
