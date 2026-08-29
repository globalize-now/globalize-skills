# Catalog Format: PO (gettext)

PO-specific variants for `next-intl` setup. Each section below corresponds to a step in the variant's setup reference (Request Config, Next.js Plugin, seed catalogs, verification). Apply these PO substitutions in place of the JSON examples when the user has chosen PO as the catalog format.

PO support is **experimental** in next-intl ≥ 4.5 and is enabled via the `experimental.messages` option on `createNextIntlPlugin`. A Turbopack/Webpack loader compiles `.po` into a plain JS object at build time — no `po2json` or pre-build step is required.

**next-intl 4.14.0 replaced the built-in PO codec** with [`@eloqnt/format-po`](https://cli.eloqnt.dev/docs/formats/po) ([#2393](https://github.com/amannn/next-intl/pull/2393), 2026-08-27). Catalogs authored the way this reference describes keep working unchanged; catalogs *written by next-intl's own extractor* on 4.5–4.13 do not. Run the pre-flight check below before touching an existing project.

> **Do not install exactly `4.14.0`.** That release is superseded by [4.14.1](https://github.com/amannn/next-intl/releases/tag/v4.14.1) (2026-08-28), which fixes a build-breaking regression on this exact path: 4.14.0 always passed `sourceLocale` into the catalog loader's options, `undefined` included, and Next.js rejects loader options that do not survive a JSON round-trip ([#2394](https://github.com/amannn/next-intl/issues/2394)). Any project that configures `experimental.messages` **without** an explicit `sourceLocale` fails to build under Turbopack with:
>
> ```
> Error: loader next-intl/extractor/catalogLoader for match "*.po" does not have serializable options. Ensure that options passed are plain JavaScript objects and values.
> ```
>
> (The glob is whatever `getFormatExtension(messages.format)` returns, so a PO project sees `"*.po"`; the upstream report was filed from a JSON project and quotes `"*.json"`. Same defect, same fix.)
>
> The scaffold in this reference does not set `sourceLocale`, so it hits this on 4.14.0. Catalog loading already requires Next.js 16 or higher, and on Next 16 next-intl configures the Turbopack rules whether or not `--turbopack` is passed (`shouldConfigureTurbo = useTurbo || isNextJs16OrHigher()`), so dropping the flag is **not** a way around it. **Install `next-intl@^4.14.1` (or any `4.5`–`4.13.x`); if a lockfile already pins `4.14.0`, upgrade it before running setup.** `^4` on a fresh install resolves to 4.14.1 or later and is fine.

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
> 3. **Switch catalog format to JSON** — skip the experimental PO loader entirely. Simpler, but loses PO's translator metadata (`#.` descriptions, `#:` source refs).

**You MUST wait for the user to choose before proceeding.** Do not silently default.

> **Confidence note:** next-intl's docs do not formally document the CJS + Turbopack failure mode. The guidance here is based on observed setup-time breakage and known general Turbopack issues with `createNextIntlPlugin` (e.g. amannn/next-intl#1779, #1838). If a future next-intl release fixes Turbopack + CJS for the PO loader, this gate can relax.

---

## § Pre-flight: existing catalogs on next-intl ≥ 4.14

**Skip this on a greenfield project** — there are no catalogs yet. Run it whenever `.po` files already exist and next-intl resolves to 4.14.0 or later.

next-intl 4.14.0 moved the built-in PO codec to `@eloqnt/format-po`, which picks its layout from a header in the catalog itself:

| Header in the `msgid ""` block | Layout | Key comes from | Effect on 4.14+ |
|---|---|---|---|
| `X-Crowdin-SourceKey: msgstr` | previous next-intl layout | `msgid` | **Hard build error** with a migration link |
| `X-Message-Key: msgctxt` | current extractor layout | `msgctxt` | Reads normally |
| neither (plain gettext) | gettext | `msgctxt` + `.` + `msgid`, or `msgid` alone | Reads normally — **this is what the scaffold in this reference produces** |

**Check:**

```bash
grep -l "X-Crowdin-SourceKey" messages/*.po
```

- **No output** → nothing to do. Hand-authored catalogs carry only `Content-Type` and `Language`, so they read as plain gettext, and gettext decoding is byte-for-byte the behaviour of the 4.13 codec (`id = msgctxt ? msgctxt + "." + msgid : msgid`, `message = msgstr`).
- **Any file listed** → those catalogs were written by next-intl's own extractor (`useExtracted`) or round-tripped through a TMS that preserved the header, and the build will fail on them. The message key lives in `msgid` and the text in `msgstr` — the reverse of what 4.14 expects. Present the user a choice; do not migrate silently:

  1. **Migrate the catalogs** (recommended, and what upstream recommends). For every entry: move the key from `msgid` into `msgctxt`, put the source text in `msgid` (look it up by key in the source-locale catalog's `msgstr`), leave `msgstr` alone. In each header block, drop `X-Crowdin-SourceKey: msgstr` and add `X-Message-Key: msgctxt`. Preserve entry order, `#.`, `#:` and flags. Verify by building: extraction must not modify the converted files further. Full instructions: [next-intl#2393](https://github.com/amannn/next-intl/pull/2393).
  2. **Keep the previous layout** by configuring [`POCodecLegacy`](https://github.com/amannn/next-intl/blob/main/packages/next-intl/src/extractor/format/codecs/fixtures/POCodecLegacy.tsx) as a custom codec — `format: {codec: './POCodecLegacy.tsx', extension: '.po'}`. No catalog edits, but the project stays off the built-in path.

**You MUST wait for the user to choose before proceeding.**

---

PO carries translator-facing metadata that JSON cannot:

- `#.` — description comments (intent of the message, audience, tone notes)
- `#:` — source-file references (which component/page the string came from)
- `msgctxt` — **part of the key, not translator context.** next-intl's PO codec reads an entry's key as `msgctxt` + `.` + `msgid`. See § Authoring conventions before using it.

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
- `sourceLocale` — **new in 4.14.0**, optional on 4.14.1+. Names the locale whose catalog holds the source strings; with it, an entry whose `msgstr` is empty in the source catalog falls back to the entry's `msgid` instead of rendering as an empty string. Worth setting to the project's default locale on 4.14+ for that reason alone. Versions 4.5–4.13 ignore the key, so it is harmless there. **On 4.14.0 specifically it is not optional** — omitting it breaks the Turbopack build outright (see the release note at the top of this file). Prefer fixing that by upgrading to 4.14.1 rather than by adding this key, so the scaffold stays the same across the whole supported range.

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
- **Do not use `msgctxt` as translator context.** In gettext generally `msgctxt` disambiguates two identical source strings, but next-intl does not read it that way: its PO codec builds the message key as `msgctxt` + `.` + `msgid`. Adding `msgctxt "icon-tooltip"` to `msgid "ItemRow.delete"` produces the key `icon-tooltip.ItemRow.delete`, so `useTranslations('ItemRow')` + `t('delete')` raises `MISSING_MESSAGE` at render. Disambiguate with distinct `msgid` dot-paths instead — `ItemRow.deleteVerb` and `ItemRow.deleteNoun` — and put the human explanation in `#.`. `msgctxt` is only correct as a deliberate namespace prefix: `msgctxt "Cart"` + `msgid "items"` is another spelling of `msgid "Cart.items"`, which is what the codec writes back when it re-encodes a catalog.
- **Keep entries sorted or grouped by namespace.** The loader doesn't care, but humans reviewing diffs and translators importing into a TMS do.
- **Do not hand-edit the `msgstr ""` header block** beyond `Content-Type` and `Language`. Headers like `Plural-Forms` are gettext-native; next-intl relies on ICU plurals in `msgstr`, so the gettext `Plural-Forms` header is informational only.
