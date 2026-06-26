# Catalog Format: PO (gettext)

PO-specific variants for `next-intl` setup. Each section below corresponds to a step in the variant's setup reference (Request Config, Next.js Plugin, seed catalogs, verification). Apply these PO substitutions in place of the JSON examples when the user has chosen PO as the catalog format.

PO support is **experimental** in next-intl ≥ 4.5 and is enabled via the `experimental.messages` option on `createNextIntlPlugin`. A Turbopack/Webpack loader compiles `.po` into a plain JS object at build time — no `po2json` or pre-build step is required.

---

## § Pre-flight: bundler & module system

**Run this check before editing `next.config.*`.** The PO loader path interacts with Turbopack in ways that have caused real-world setup failures, particularly on CommonJS projects. Detecting bundler + module system up front lets the skill steer the user to a working combination instead of debugging mid-setup.

1. **Detect module system.** Read the project's `package.json` and the existing Next.js config file:
   - `next.config.mjs` or `next.config.ts` → ESM.
   - `next.config.cjs` → CJS.
   - `next.config.js` → ESM iff `package.json` has `"type": "module"`, otherwise CJS (Node default).
2. **Detect Turbopack usage.** Read `package.json` `scripts` — flag any of `next dev`, `next build`, or `next start` that pass `--turbopack` (or the older `--turbo`).
3. **Decide.** Apply the matrix below:

   | Module system | Turbopack in scripts? | Action |
   |---|---|---|
   | ESM | yes | Proceed with PO loader as documented. |
   | ESM | no | Proceed with PO loader as documented (webpack path). |
   | **CJS** | **yes** | **Stop and present the user a choice (see below).** |
   | CJS | no | Proceed with PO loader (webpack path); no warning needed. |

**If CJS + `--turbopack`:** the experimental PO loader has been observed to fail in this combination during setup runs. The fix is to either drop the `--turbopack` flag (use webpack — well-supported) or migrate the config to ESM (`next.config.mjs` / `next.config.ts`). Show the user this choice before writing any config:

> Your project uses a CommonJS Next.js config and runs `next dev` / `next build` with `--turbopack`. The next-intl experimental PO loader has been observed to fail in this combination. Pick one:
>
> 1. **Drop `--turbopack`** — remove the flag from `package.json` scripts. Webpack handles the PO loader reliably. Lowest-friction option; matches what most next-intl PO users run today.
> 2. **Convert config to ESM** — rename `next.config.js` to `next.config.mjs` and change `module.exports = ...` to `export default ...`. Keeps Turbopack but is a wider edit.
> 3. **Switch catalog format to JSON** — skip the experimental PO loader entirely. Simpler, but loses PO's translator metadata (`#.` descriptions, `#:` source refs, `msgctxt`).

**You MUST wait for the user to choose before proceeding.** Do not silently default.

> **Confidence note:** next-intl's docs do not formally document the CJS + Turbopack failure mode. The guidance here is based on observed setup-time breakage and known general Turbopack issues with `createNextIntlPlugin` (e.g. amannn/next-intl#1779, #1838). If a future next-intl release fixes Turbopack + CJS for the PO loader, this gate can relax.

---

PO carries translator-facing metadata that JSON cannot:

- `#.` — description comments (intent of the message, audience, tone notes)
- `#:` — source-file references (which component/page the string came from)
- `msgctxt` — disambiguating context for otherwise-identical strings

Authoring convention: **`msgid` is a dot-path** matching the namespace hierarchy that `useTranslations` / `getTranslations` use. For example, `useTranslations('HomePage')` + `t('greeting')` resolves to `msgid "HomePage.greeting"`. `msgstr` holds the translated text and may contain ICU syntax (`{name}`, `{count, plural, ...}`, `<link>...</link>`).

---

## § Request Config

Use this in place of the JSON Request Config (App Router only — `i18n/request.ts`). Replace the `.json` import with `.po`. The literal file extension in the import string is what the plugin's loader matches on:

```ts
import {getRequestConfig} from 'next-intl/server';
import {hasLocale} from 'next-intl';
import {routing} from './routing';

export default getRequestConfig(async ({requestLocale}) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.po`)).default
  };
});
```

Adjust the `../../messages/` path for your project depth. Do not wrap the `import()` in `JSON.parse` — the loader already returns a plain JS object.

---

## § Pages Router `getStaticProps`

Use this in place of the JSON `getStaticProps` block (Pages Router only). Swap `.json` → `.po` in every `getStaticProps` (and `getServerSideProps`) that loads messages:

```ts
export async function getStaticProps({locale}: {locale: string}) {
  return {
    props: {
      messages: (await import(`../../messages/${locale}.po`)).default,
    },
  };
}
```

Apply the same swap in any shared helper (e.g. `loadMessages(locale)`) if your project factors message loading out of per-page `getStaticProps`.

---

## § Next.js Plugin

Use this in place of the JSON Next.js Plugin block. Pass the `experimental.messages` option to `createNextIntlPlugin` so the plugin installs the `.po` loader.

### App Router (ESM)

```ts
import createNextIntlPlugin from 'next-intl/plugin';
import type {NextConfig} from 'next';

const withNextIntl = createNextIntlPlugin({
  experimental: {
    messages: {
      format: 'po',
      path: './messages',
      locales: 'infer',
      precompile: true
    }
  }
});

const nextConfig: NextConfig = {
  // ...existing config
};

export default withNextIntl(nextConfig);
```

Option notes:

- `format: 'po'` — activates the PO loader. Without this, next-intl defaults to JSON.
- `path: './messages'` — directory containing the `.po` files, relative to project root.
- `locales: 'infer'` — auto-detects locales from filenames (`en.po`, `de.po`, …). Alternatively pass an explicit array, e.g. `['en', 'de', 'fr']`.
- `precompile: true` — compiles message bodies at build time rather than request time. Recommended. Same flag as the JSON precompile path (`next-intl >= 4.8`); originally introduced for PO in 4.5. See `SKILL.md` § Common Gotchas → **`t.raw` + precompile** for the one known limitation.

### Pages Router (CJS)

**Use `precompile: false` on Pages Router.** With `precompile: true`, the webpack alias that rewires `use-intl/format-message` to the precompiled runtime does not take effect for Pages Router bundles (verified against `next-intl@4.9.1`, `next@15.5.15`, webpack). Every ICU message — interpolation, plurals, select, rich text — throws `INVALID_MESSAGE` at render in both dev and prod. `precompile: false` routes messages through the runtime ICU compiler and works correctly. App Router is not affected.

```js
const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin({
  experimental: {
    messages: {
      format: 'po',
      path: './messages',
      locales: 'infer',
      precompile: false    // Pages Router: precompile: true is broken upstream (webpack alias scoping)
    }
  }
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  i18n: {
    locales: ['en', 'de'],   // match routing.ts locales
    defaultLocale: 'en',      // match routing.ts defaultLocale
  },
  // ...existing config
};

module.exports = withNextIntl(nextConfig);
```

**Stub `i18n/request.ts` required even on Pages Router.** When `experimental.messages` is set, `createNextIntlPlugin` hard-errors at build with "Could not locate request configuration module" if the file is missing, even though Pages Router loads messages through `getStaticProps` and never consumes the config. Create a one-liner stub at `src/i18n/request.ts` (or `i18n/request.ts`):

```ts
import {getRequestConfig} from 'next-intl/server';
export default getRequestConfig(async () => ({locale: 'en', messages: {}}));
```

### Composing with other plugins

If the project already wraps its config with other plugins (e.g. `withMDX`, `withBundleAnalyzer`), compose `withNextIntl` on the outside:

```ts
export default withNextIntl(withMDX(nextConfig));
```

The PO loader attaches to Webpack/Turbopack via `createNextIntlPlugin`'s return value, so composition order does not affect its behavior.

`t.raw` is not supported under `precompile: true`. If the project needs `t.raw`, drop the entire `experimental.messages` block and switch `catalogFormat` back to JSON — see `SKILL.md` § Common Gotchas → **`t.raw` + precompile** for details.

### Request config path override

If `i18n/request.ts` is not at one of the default locations (`./i18n/request.ts` or `./src/i18n/request.ts`), pass the path as the second argument:

```ts
const withNextIntl = createNextIntlPlugin({
  experimental: {
    messages: {format: 'po', path: './messages', locales: 'infer', precompile: true}
  }
}, './custom/path/request.ts');
```

---

## § Seed `.po` Files

Use this in place of the JSON seed file scaffold. Create `messages/` at the project root and one `{locale}.po` file per configured locale.

### `messages/en.po` (default locale)

```
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\n"
"Language: en\n"

#. App title shown in the site header
#: src/app/[locale]/layout.tsx
msgid "common.title"
msgstr "My App"
```

The empty `msgid ""` header block is required by the PO spec. Keep the `Content-Type` and `Language` entries — some TMS platforms refuse to import PO files without them.

### `messages/de.po` (non-default locale)

```
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\n"
"Language: de\n"

#. App title shown in the site header
#: src/app/[locale]/layout.tsx
msgid "common.title"
msgstr "Meine App"
```

Repeat the same `msgid` entries in every locale file with translated `msgstr` values. Keep `#.` and `#:` in sync across locales — the `next-intl/convert` skill (when it supports PO) and most TMS platforms treat these as authoritative metadata shared across languages.

### Adjust Pages Router path

If the project uses Pages Router, swap `#: src/app/[locale]/layout.tsx` for the file where the message is actually consumed (`src/pages/_app.tsx` for provider-level strings, or the specific page file).

---

## § Verify Step Translation

Use this in place of the JSON test-translation block during setup verification.

**Add two messages to `messages/en.po`** — a simple string and a plural. The plural check is non-negotiable: it exercises ICU inside `msgstr`, which the next-intl 4.5 docs do not spell out explicitly. This step is how we confirm the loader handles it.

Append to `messages/en.po`:

```
#. Homepage greeting
#: src/app/[locale]/page.tsx
msgid "HomePage.greeting"
msgstr "Hello, world!"

#. Cart count in the shopping cart
#: src/components/Cart.tsx
msgid "Cart.items"
msgstr "You have {count, plural, one {# item} other {# items}} in your cart."
```

**In a page component** (Server Component shown; Client Component with `useTranslations` works identically):

```tsx
import {getTranslations} from 'next-intl/server';

export default async function HomePage() {
  const t = await getTranslations('HomePage');
  const cart = await getTranslations('Cart');
  return (
    <>
      <h1>{t('greeting')}</h1>
      <p>{cart('items', {count: 1})}</p>
      <p>{cart('items', {count: 5})}</p>
    </>
  );
}
```

**Expected output in the browser**:

- `Hello, world!`
- `You have 1 item in your cart.`
- `You have 5 items in your cart.`

If the plural outputs render as the raw ICU source (`"You have {count, plural, ...}"`) or as empty strings, the PO loader is not evaluating ICU inside `msgstr` the way we rely on. **Stop the setup, report to the user**, and offer two paths: (a) convert to JSON by inlining `msgstr` values as JSON string values, or (b) keep the PO scaffold and open a discussion/issue with next-intl before proceeding.

If the simple string renders but plurals do not, the JSON fallback is low-friction because the message bodies are identical — only the envelope changes.

---

## § Authoring conventions

When writing or editing `.po` messages going forward:

- **`msgid` is the key.** Use a dot-path that mirrors the namespace passed to `useTranslations` / `getTranslations`. `useTranslations('Cart')` + `t('items')` → `msgid "Cart.items"`. Nested namespaces work: `useTranslations('auth.SignUp')` + `t('form.submit')` → `msgid "auth.SignUp.form.submit"`.
- **`msgstr` is the translation.** ICU syntax is supported inside `msgstr` — interpolation (`{name}`), plurals (`{count, plural, one {...} other {...}}`), select (`{gender, select, ...}`), and rich-text tags (`<link>...</link>`).
- **Always keep `#.` descriptions.** One-line intent note for translators. "Button on checkout form", "Error shown when payment fails", "Tooltip on delete icon". These are the single biggest quality lever for AI-assisted translation.
- **Always keep `#:` source references.** Point to the file + line where the message is consumed. Tools like Poedit will let a translator jump straight to the call site. Keep these up to date — stale references are worse than missing ones.
- **Use `msgctxt` for disambiguation.** Two identical source strings with different meanings (e.g. "Post" as a verb vs. "Post" as a noun) need different `msgctxt` values so translators can render them differently per locale.
- **Keep entries sorted or grouped by namespace.** The loader doesn't care, but humans reviewing diffs and translators importing into a TMS do.
- **Do not hand-edit the `msgstr ""` header block** beyond `Content-Type` and `Language`. Headers like `Plural-Forms` are gettext-native; next-intl relies on ICU plurals in `msgstr`, so the gettext `Plural-Forms` header is informational only.
