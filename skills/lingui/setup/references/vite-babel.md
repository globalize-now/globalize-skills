# Vite + Babel Setup

This covers Vite projects using `@vitejs/plugin-react` (Babel-based, without the `-swc` suffix).

## Packages

In addition to the core packages from Step 2, install:

| Package | Type | Purpose |
|---------|------|---------|
| `@lingui/babel-plugin-lingui-macro` | dev | Babel macro transform |
| `@lingui/vite-plugin` | dev | Vite integration for catalog compilation |

**Example (npm):**

```bash
npm install @lingui/core @lingui/react @lingui/macro
npm install -D @lingui/cli @lingui/babel-plugin-lingui-macro @lingui/vite-plugin
```

## Build Tool Integration (Step 4)

Modify `vite.config.ts` to add the Babel plugin and the Lingui Vite plugin:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { lingui } from '@lingui/vite-plugin'

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['@lingui/babel-plugin-lingui-macro'],
      },
    }),
    lingui(),
  ],
})
```

If the project already has Babel plugins configured in the `react()` call, add `@lingui/babel-plugin-lingui-macro` to the existing array.

## Provider Setup (Step 5)

The setup depends on whether the project uses per-page catalogs (file-based routing) or a single global catalog.

### Per-page catalogs (TanStack Router, React Router with file-based routing)

Create a minimal i18n setup file — catalog loading happens at the route level, not here:

```ts
// src/i18n.ts
import { i18n } from '@lingui/core'

export function activateLocale(locale: string, messages: Record<string, string>) {
  i18n.load(locale, messages)
  i18n.activate(locale)
}

export { i18n }
```

Wrap the app with `I18nProvider` at the root (same as single catalog — only the loading location changes).

**TanStack Router** — wrap in `__root.tsx`, load catalogs in each route:

```tsx
// src/routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { I18nProvider } from '@lingui/react'
import { i18n } from '../i18n'

export const Route = createRootRoute({
  component: () => (
    <I18nProvider i18n={i18n}>
      <Outlet />
    </I18nProvider>
  ),
})
```

```tsx
// src/routes/about.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'
import { activateLocale } from '../i18n'

export const Route = createFileRoute('/about')({
  beforeLoad: async () => {
    const locale = 'en' // determine from URL, context, or state
    const { messages } = await import('./locales/about/' + locale + '.ts')
    activateLocale(locale, messages)
  },
  component: AboutPage,
})

function AboutPage() {
  return <h1><Trans>About us</Trans></h1>
}
```

**React Router** — wrap in root layout, load catalogs in each route loader:

```tsx
// Root layout (unchanged)
import { Outlet } from 'react-router'
import { I18nProvider } from '@lingui/react'
import { i18n } from './i18n'

export default function RootLayout() {
  return (
    <I18nProvider i18n={i18n}>
      <Outlet />
    </I18nProvider>
  )
}
```

```tsx
// app/routes/about.tsx
import { Trans } from '@lingui/react/macro'
import { activateLocale } from '../i18n'

export async function loader() {
  const locale = 'en' // determine from URL params or cookie
  const { messages } = await import('./locales/about/' + locale + '.ts')
  activateLocale(locale, messages)
  return null
}

export default function AboutPage() {
  return <h1><Trans>About us</Trans></h1>
}
```

Each route loads its own co-located catalog. Shared component strings are duplicated across route catalogs — this is the expected trade-off for smaller per-page bundles.

### Single catalog (plain SPA without file-based routing)

Create an i18n setup file that loads the global catalog:

```ts
// src/i18n.ts
import { i18n } from '@lingui/core'

export async function loadCatalog(locale: string) {
  const { messages } = await import(`./locales/${locale}/messages.ts`)
  i18n.load(locale, messages)
  i18n.activate(locale)
}

// Load default locale
loadCatalog('en')

export { i18n }
```

Wrap the app with `I18nProvider` in `main.tsx`:

```tsx
import { I18nProvider } from '@lingui/react'
import { i18n } from './i18n'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <I18nProvider i18n={i18n}>
    <App />
  </I18nProvider>,
)
```
