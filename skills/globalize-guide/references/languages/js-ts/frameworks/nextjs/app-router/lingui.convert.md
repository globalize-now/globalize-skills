# Next.js App Router: String Wrapping Patterns

This covers Next.js 13+ with App Router and React Server Components (RSC). The key constraint: hooks (`useLingui()`) cannot be called in server components. `<Trans>` works everywhere.

---

## Which macro works where

| Macro | Server components | Client components |
|-------|:-----------------:|:-----------------:|
| `<Trans>` | ✓ | ✓ |
| `useLingui()` → `t` | ✓ (reads `setI18n` from layout) | ✓ (reads from `I18nProvider`) |
| `msg` | ✓ | ✓ |

In the App Router, `useLingui()` works in both server and client components when the layout uses `setI18n()`. Server components read the i18n instance set by the root layout, not from React context.

---

## Server components

Server components can use `<Trans>` and `useLingui()`:

```tsx
// app/[locale]/page.tsx — server component (no 'use client')
import { Trans, useLingui } from '@lingui/react/macro'

export default async function HomePage() {
  const { t } = useLingui()
  return (
    <main>
      <h1><Trans>Welcome to our app</Trans></h1>
      <p aria-label={t`Main content area`}>
        <Trans>Start exploring our features.</Trans>
      </p>
    </main>
  )
}
```

> `useLingui()` in server components reads from the `setI18n()` call in the root layout — not from React context. This is why the layout's `setI18n(i18n)` call must happen before any server component renders.

---

## Client components

Client components use the same macros — no difference from standard React:

```tsx
'use client'
import { Trans, useLingui } from '@lingui/react/macro'

export function SearchBar() {
  const { t } = useLingui()
  return (
    <input
      type="search"
      placeholder={t`Search...`}
      aria-label={t`Search`}
    />
  )
}
```

---

## Page metadata (generateMetadata)

`generateMetadata` runs as a server function. Use `getI18nInstance` (from the setup's `appRouterI18n.ts`) directly — not `useLingui()`, which is a hook.

```tsx
// app/[locale]/settings/page.tsx
import type { Metadata } from 'next'
import { getI18nInstance } from '../../appRouterI18n'
import { msg } from '@lingui/core/macro'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const i18n = getI18nInstance(locale)
  return {
    title: i18n._(msg({ message: `Settings`, comment: "Settings page title" })),
    description: i18n._(msg`Manage your account settings`),
  }
}
```

For Next.js 13-14 (synchronous params): use `params: { locale: string }` without `await`.

---

## Shared layout components

Components used in `layout.tsx` files may render on both server and client. Prefer `<Trans>` for text content — it avoids the client/server boundary question entirely.

```tsx
// app/[locale]/layout.tsx — server component
import { Trans } from '@lingui/react/macro'

function Header() {
  return (
    <header>
      <nav aria-label="Main navigation">
        <a href="/"><Trans>Home</Trans></a>
        <a href="/about"><Trans>About</Trans></a>
      </nav>
    </header>
  )
}
```

---

## Navigation and sidebar data

Define with `msg` at module scope, resolve in a client component (since the sidebar is typically interactive):

```tsx
// components/sidebar-data.ts
import { msg } from '@lingui/core/macro'
import type { MessageDescriptor } from '@lingui/core'

export const sidebarItems: Array<{ label: MessageDescriptor; href: string }> = [
  { label: msg({ message: `Dashboard`, comment: "Main navigation sidebar" }), href: '/' },
  { label: msg`Users`, href: '/users' },
  { label: msg`Settings`, href: '/settings' },
]
```

```tsx
// components/sidebar.tsx
'use client'
import { useLingui } from '@lingui/react/macro'
import { sidebarItems } from './sidebar-data'

export function Sidebar() {
  const { t } = useLingui()
  const localePath = useLocalePath()   // only on projects with locale-prefixed URLs
  return (
    <nav>
      {sidebarItems.map(item => (
        <a key={item.href} href={localePath(item.href)}>{t(item.label)}</a>
      ))}
    </nav>
  )
}
```

**The `href` matters as much as the label.** Translating the label and leaving `href: '/'` bare gives a localized nav that sends every user back to the source locale. Read the project's generated i18n rules: if they describe a `navigation` module, take `useLocalePath()` from it in client components and the two-argument `localePath(path, locale)` in Server Components; if the project has no locale in its URLs, leave every `href` untouched. Never hand-build `` `/${locale}/about` ``. When a link looks wrong for the project's strategy and you are only here to wrap strings, **flag it** — name the file and the `href` — rather than silently rewriting routing.

---

## loading.tsx and error.tsx

These special files are always client components in Next.js App Router. Use hooks freely:

```tsx
// app/[locale]/loading.tsx
'use client'
import { Trans } from '@lingui/react/macro'

export default function Loading() {
  return <p><Trans>Loading...</Trans></p>
}
```

```tsx
// app/[locale]/error.tsx
'use client'
import { Trans, useLingui } from '@lingui/react/macro'

export default function Error({ reset }: { reset: () => void }) {
  const { t } = useLingui()
  return (
    <div role="alert">
      <h2><Trans>Something went wrong</Trans></h2>
      <button onClick={reset} aria-label={t`Try again`}>
        <Trans>Try again</Trans>
      </button>
    </div>
  )
}
```

---

## Numbers, currencies, and dates

**Call the project's formatters module.** Phase 2 created it (`generate_format_helpers`) and
`.agents/globalize-rules.md` carries its real import specifier. Do **not** reach for `i18n.number()` /
`i18n.date()` off the Lingui instance, and never construct `Intl` at a call site — both bypass the
module's currency default, its date presets and its formatting-locale seam.

**Formatting and translation are resolved separately on this router**, and the split is not the same
one. `getI18nInstance(locale)` + `setI18n(i18n)` is for `<Trans>` and `useLingui()`; formatting comes
from the formatters module regardless of which side of the boundary you are on.

```tsx
// Client components — the hook reads the locale from <I18nProvider> context
'use client'
import { useFormatters } from '<the specifier from .agents/globalize-rules.md>'

function Price({ amount }: { amount: number }) {
  const f = useFormatters()
  return <span>{f.money(amount)}</span>
}

function EventDate({ timestamp }: { timestamp: number }) {
  const f = useFormatters()
  return <time>{f.date(timestamp)}</time>
}
```

```tsx
// Server components — no provider context, so take the locale from params
import { getFormatters } from '<the specifier from .agents/globalize-rules.md>'

export default async function PricePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const price = getFormatters(locale).money(29.99)
  return <p><Trans>Price: {price}</Trans></p>
}
```

`useFormatters()` requires a Client Component — it calls `useLingui()`, which needs `<I18nProvider>`
context a Server Component does not have. Never add `'use client'` to the formatters module to work
around that; it would break `getFormatters` for every server caller.

The ten helpers are `money`, `number`, `percent`, `compact`, `unit`, `date`, `time`, `dateTime`,
`relativeTime`, `list`. In utility functions, route handlers and `generateMetadata`, use
`getFormatters(locale)` with an explicit locale — never `Intl` directly.

For the full find-and-replace table, what must never be converted, and the ordering rule, follow
`references/languages/js-ts/convert.format-pass.md`.
