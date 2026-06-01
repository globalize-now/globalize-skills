# Next.js Pages Router: String Wrapping Patterns

This covers Next.js with Pages Router. There are no Server Components -- all components use the `use*` hooks from `next-intl`. The `get*` async server functions are not available.

---

## Key Difference from App Router

| Function | Available |
|----------|:-:|
| `useTranslations()` | Yes |
| `useFormatter()` | Yes |
| `useLocale()` | Yes |
| `getTranslations()` | No |
| `getFormatter()` | No |
| `getLocale()` | No |

Everything uses hooks from `next-intl`. There is no `next-intl/server` import.

---

## Core Usage

`useTranslations(namespace)` in every component:

```tsx
import {useTranslations} from 'next-intl';

// Before
export default function HomePage() {
  return (
    <main>
      <h1>Welcome back</h1>
      <p>Your dashboard is ready.</p>
    </main>
  );
}

// After
export default function HomePage() {
  const t = useTranslations('HomePage');
  return (
    <main>
      <h1>{t('title')}</h1>
      <p>{t('subtitle')}</p>
    </main>
  );
}
```

Attributes:

```tsx
const t = useTranslations('Search');
<input placeholder={t('placeholder')} aria-label={t('label')} />
```

---

## Message Loading Per Page

Every page needs `getStaticProps` (or `getServerSideProps`) to load messages:

```tsx
export async function getStaticProps({locale}: {locale: string}) {
  return {
    props: {
      messages: (await import(`../../messages/${locale}.json`)).default
    }
  };
}
```

Shared helper to reduce boilerplate:

```ts
// lib/getMessages.ts
export async function getMessages(locale: string) {
  return (await import(`../messages/${locale}.json`)).default;
}
```

```tsx
import {getMessages} from '@/lib/getMessages';

export async function getStaticProps({locale}: {locale: string}) {
  return {props: {messages: await getMessages(locale)}};
}
```

**Important**: Pages without `getStaticProps` returning messages will not have translations available. Every page that uses translations must load its messages.

---

## Rich Text

Same `t.rich()` pattern as App Router, using hooks:

```json
{"terms": "By signing up you agree to our <link>terms</link> and <bold>privacy policy</bold>."}
```

```tsx
import {useTranslations} from 'next-intl';

function Legal() {
  const t = useTranslations('Legal');
  return (
    <p>
      {t.rich('terms', {
        link: (chunks) => <a href="/terms">{chunks}</a>,
        bold: (chunks) => <strong>{chunks}</strong>
      })}
    </p>
  );
}
```

**HTML in messages** -- for line breaks and simple HTML:

```json
{"description": "First line.<br></br>Second line."}
```

```tsx
t.rich('description', {br: () => <br />})
```

---

## Navigation Data

Use `next/link` with the `locale` prop for locale-aware navigation:

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
import Link from 'next/link';
import {useTranslations} from 'next-intl';

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

---

## Numbers, Currencies, and Dates

`useFormatter()` only -- no server variant in Pages Router:

```tsx
import {useFormatter} from 'next-intl';

function PriceTag({amount}: {amount: number}) {
  const format = useFormatter();
  return <span>{format.number(amount, {style: 'currency', currency: 'USD'})}</span>;
}

function EventDate({date}: {date: Date}) {
  const format = useFormatter();
  return <time>{format.dateTime(date, {dateStyle: 'medium'})}</time>;
}
```

Common formatting examples:

```tsx
const format = useFormatter();

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

// After
const format = useFormatter();
<span>{format.dateTime(new Date(), {dateStyle: 'medium'})}</span>
<span>{format.number(price, {style: 'currency', currency: 'USD'})}</span>
<span>{format.number(ratio, {style: 'percent'})}</span>
```

---

## Dynamic Page Titles

Use `useTranslations` combined with Next.js `<Head>`:

```tsx
import Head from 'next/head';
import {useTranslations} from 'next-intl';

export default function AboutPage() {
  const t = useTranslations('About');
  return (
    <>
      <Head>
        <title>{t('pageTitle')}</title>
        <meta name="description" content={t('pageDescription')} />
      </Head>
      <main>
        <h1>{t('heading')}</h1>
      </main>
    </>
  );
}
```

---

## Plurals

Count-dependent strings go into `messages/*.json` as ICU plurals — not as plain strings. Pages Router uses `useTranslations` everywhere (no server-component variant):

```tsx
import {useTranslations} from 'next-intl';

export default function Inbox({count}: {count: number}) {
  const t = useTranslations('Inbox');
  return <p>{t('unread', {count})}</p>;
}
```

```json
// messages/en.json
{"Inbox": {"unread": "{count, plural, one {# unread message} other {# unread messages}}"}}
```

Always pass `{count}` — even for a hardcoded literal like `<p>1 unread message</p>`, rewrite it as `{t('unread', {count: 1})}` with the ICU plural key. Translators will then produce the right wording for every language.
