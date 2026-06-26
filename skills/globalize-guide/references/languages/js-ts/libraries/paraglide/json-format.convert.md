# Catalog Format: ICU-JSON — Paraglide convert

ICU-JSON overrides for the Paraglide convert phase. Apply only when `decisions.setup.catalogFormat === "json"`.

This is a **substitution companion** to `references/languages/js-ts/frameworks/sveltekit/paraglide.convert.md` (the default PO path). Read that file first — it is the base. Everything there (the conversion loop, markup/attribute/interpolation patterns, `{#each}`/conditional handling, module-scope rules, `load`/server strings, numbers/dates, key naming, what-not-to-wrap, after-conversion verify) holds unchanged, because the **call sites are identical** across both formats (`{m.key()}`, `m.greeting({ name })`). This file changes only **two** things:

1. The catalog **shape** — entries are flat JSON key-values, not `.po` `msgid`/`msgstr` pairs.
2. **Translator comments** — they are **not supported** on ICU-JSON. Do **not** add `#.` comments or any description metadata; the inlang/ICU JSON model has no field for them and they will not round-trip. Descriptive key naming is the only disambiguation lever.

## Catalog shape

Where the base PO file shows a `.po` entry, ICU-JSON uses a flat key → ICU-string pair in `messages/{baseLocale}.json`:

```json
// messages/en.json
{
  "dashboard_title": "Dashboard",
  "greeting": "Hello, {name}!",
  "cart_item_count": "{count, plural, one {# item} other {# items}}"
}
```

Call sites are identical to the base: `{m.dashboard_title()}`, `m.greeting({ name })`, `m.cart_item_count({ count })`.

The ICU message bodies (`{name}`, `{count, plural, …}`, `{g, select, …}`, selectordinal) are exactly the same strings as in the PO base — only the envelope (JSON value vs. `msgstr`) differs. No ICU-mode `messageFormat` setting and no apostrophe/`<b>` caveats apply: the ICU1 plugin always parses ICU and **fails the build** on malformed ICU (the PO plugin's silent-literal behavior is a PO-only footgun).

## Key naming carries all the context

Because there are no translator comments, the key name is the translator's only signal. Make keys specific for ambiguous words, bare action labels, and domain-sensitive terms:

```json
{
  "cart_remove_button": "Remove",
  "filter_remove_button": "Remove",
  "nav_home_link": "Home"
}
```

Use `cart_remove_button`, not `remove`; two different "Remove" buttons need distinct keys so they can diverge across languages. (If translator comments would help the project, prefer the default PO format — `paraglide.convert.md` — which supports them; the setup migration is lossless.)

## Everything else

Follow `paraglide.convert.md` and `paraglide/json-format.code.md` unchanged for: the conversion loop mechanics, markup/attributes/interpolation, `{#each}`/conditionals/dynamic labels, module-scope constants, `load`/server strings, numbers/currencies/dates, and what-not-to-wrap. Only swap the catalog entry shape (JSON key-value) and drop the comments.
