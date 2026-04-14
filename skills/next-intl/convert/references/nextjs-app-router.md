# Next.js App Router: String Wrapping Patterns

This covers Next.js 13+ with App Router and React Server Components (RSC). The key constraint: server functions (`getTranslations`, `getFormatter`) are async and must be awaited. Client hooks (`useTranslations`, `useFormatter`) are synchronous and require `'use client'`.

---

## Which API works where

| Function | Server Components | Client Components |
|----------|:-:|:-:|
| `getTranslations()` | Yes (async) | No |
| `useTranslations()` | No | Yes |
| `getFormatter()` | Yes (async) | No |
| `useFormatter()` | No | Yes |
| `getLocale()` | Yes (async) | No |
| `useLocale()` | No | Yes |

Server functions come from `next-intl/server`. Client hooks come from `next-intl`.

---

## Server Components

`getTranslations` is async and must be awaited. The component itself must be `async`.

```tsx
import {getTranslations} from 'next-intl/server';

// Before
export default async function Page() {
  return (
    <main>
      <h1>Welcome back</h1>
      <p>Your dashboard is ready.</p>
    </main>
  );
}

// After
export default async function Page() {
  const t = await getTranslations('Dashboard');
  return (
    <main>
      <h1>{t('title')}</h1>
      <p>{t('subtitle')}</p>
    </main>
  );
}
```

Attributes in Server Components:

```tsx
const t = await getTranslations('Search');
<input placeholder={t('placeholder')} aria-label={t('label')} />
```

---

## Client Components

`useTranslations` is a synchronous hook. The file must have the `'use client'` directive.

```tsx
'use client';
import {useTranslations} from 'next-intl';

// Before
export default function Counter({count}: {count: number}) {
  return <button>Increment ({count})</button>;
}

// After
export default function Counter({count}: {count: number}) {
  const t = useTranslations('Counter');
  return <button>{t('increment', {count})}</button>;
}
```

---

## Page Metadata (generateMetadata)

Use `getTranslations` in the async `generateMetadata` export:

```tsx
import {getTranslations} from 'next-intl/server';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'Metadata'});
  return {
    title: t('title'),
    description: t('description')
  };
}
```

For Next.js 13-14 (synchronous params): use `params: {locale: string}` without `await`.

---

## Rich Text

Use `t.rich()` to map custom tags in messages to React components:

```json
{"terms": "By signing up you agree to our <link>terms</link> and <bold>privacy policy</bold>."}
```

```tsx
// Server Component
const t = await getTranslations('Legal');
t.rich('terms', {
  link: (chunks) => <a href="/terms">{chunks}</a>,
  bold: (chunks) => <strong>{chunks}</strong>
})

// Client Component
const t = useTranslations('Legal');
t.rich('terms', {
  link: (chunks) => <a href="/terms">{chunks}</a>,
  bold: (chunks) => <strong>{chunks}</strong>
})
```

Tags can be arbitrarily nested:

```json
{"highlight": "This is <important><very>very</very> important</important>."}
```

```tsx
t.rich('highlight', {
  important: (chunks) => <strong>{chunks}</strong>,
  very: (chunks) => <em>{chunks}</em>
})
```

**HTML in messages** -- for line breaks and simple HTML:

```json
{"description": "First line.<br></br>Second line."}
```

```tsx
t.rich('description', {br: () => <br />})
```

---

## Passing Server Translations to Client Components

You can translate strings on the server and pass them as props to avoid loading translation bundles in the client:

```tsx
// Server Component (page.tsx)
import {getTranslations} from 'next-intl/server';
import {ClientWidget} from './ClientWidget';

export default async function Page() {
  const t = await getTranslations('Widget');
  return <ClientWidget title={t('title')} description={t('description')} />;
}
```

Alternatively, use `useTranslations` directly in the Client Component (simpler, slight bundle cost):

```tsx
'use client';
import {useTranslations} from 'next-intl';

export function ClientWidget() {
  const t = useTranslations('Widget');
  return (
    <div>
      <h2>{t('title')}</h2>
      <p>{t('description')}</p>
    </div>
  );
}
```

Recommend the direct `useTranslations` approach for most cases. Use server-passing for performance-critical paths where minimizing client bundle size matters.

---

## loading.tsx and error.tsx

These special files are always Client Components in App Router:

```tsx
'use client';
import {useTranslations} from 'next-intl';

export default function Loading() {
  const t = useTranslations('Common');
  return <p>{t('loading')}</p>;
}
```

```tsx
'use client';
import {useTranslations} from 'next-intl';

export default function Error({reset}: {reset: () => void}) {
  const t = useTranslations('Error');
  return (
    <div role="alert">
      <h2>{t('title')}</h2>
      <button onClick={reset}>{t('tryAgain')}</button>
    </div>
  );
}
```

---

## Numbers, Currencies, and Dates

Server Components use `getFormatter()` (async). Client Components use `useFormatter()` (sync).

```tsx
// Server Component
import {getFormatter} from 'next-intl/server';

export default async function PricePage() {
  const format = await getFormatter();
  return <span>{format.number(29.99, {style: 'currency', currency: 'USD'})}</span>;
}
```

```tsx
// Client Component
'use client';
import {useFormatter} from 'next-intl';

function PriceTag({amount}: {amount: number}) {
  const format = useFormatter();
  return <span>{format.number(amount, {style: 'currency', currency: 'USD'})}</span>;
}
```

Common formatting examples:

```tsx
// Date
format.dateTime(new Date(), {dateStyle: 'medium'})

// Number
format.number(1234.5)

// Currency
format.number(price, {style: 'currency', currency: 'EUR'})

// Relative time
format.relativeTime(pastDate)

// Percentage
format.number(0.85, {style: 'percent'})
```

Before/after for common patterns:

```tsx
// Before
<span>{new Date().toLocaleDateString()}</span>
<span>${price.toFixed(2)}</span>
<span>{(ratio * 100).toFixed(0)}%</span>

// After (Client Component)
const format = useFormatter();
<span>{format.dateTime(new Date(), {dateStyle: 'medium'})}</span>
<span>{format.number(price, {style: 'currency', currency: 'USD'})}</span>
<span>{format.number(ratio, {style: 'percent'})}</span>

// After (Server Component)
const format = await getFormatter();
<span>{format.dateTime(new Date(), {dateStyle: 'medium'})}</span>
<span>{format.number(price, {style: 'currency', currency: 'USD'})}</span>
<span>{format.number(ratio, {style: 'percent'})}</span>
```

---

## Navigation and Sidebar Data

For navigation items defined as arrays, use `useTranslations` with key-based lookups:

```json
{
  "Navigation": {
    "home": "Home",
    "about": "About",
    "contact": "Contact"
  }
}
```

```tsx
'use client';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';

const navItems = [
  {key: 'home', href: '/'},
  {key: 'about', href: '/about'},
  {key: 'contact', href: '/contact'},
] as const;

export function Nav() {
  const t = useTranslations('Navigation');
  return (
    <nav>
      {navItems.map(item => (
        <Link key={item.key} href={item.href}>{t(item.key)}</Link>
      ))}
    </nav>
  );
}
```

For Server Component navigation (non-interactive):

```tsx
import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';

export default async function Footer() {
  const t = await getTranslations('Footer');
  return (
    <footer>
      <Link href="/privacy">{t('privacy')}</Link>
      <Link href="/terms">{t('terms')}</Link>
    </footer>
  );
}
```

---

## Form Validation Messages

```json
{
  "Form": {
    "required": "This field is required",
    "minLength": "Must be at least {min} characters",
    "email": "Please enter a valid email"
  }
}
```

```tsx
'use client';
import {useTranslations} from 'next-intl';

function ContactForm() {
  const t = useTranslations('Form');

  const validate = (value: string) => {
    if (!value) return t('required');
    if (value.length < 3) return t('minLength', {min: 3});
  };

  // ...
}
```

---

## Toast and Notification Messages

Toast libraries accept plain strings. Call `t()` inside the event handler:

```tsx
'use client';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';

function SaveButton() {
  const t = useTranslations('Actions');

  async function handleSave() {
    try {
      await save();
      toast.success(t('saveSuccess'));
    } catch {
      toast.error(t('saveFailed'));
    }
  }

  return <button onClick={handleSave}>{t('save')}</button>;
}
```
