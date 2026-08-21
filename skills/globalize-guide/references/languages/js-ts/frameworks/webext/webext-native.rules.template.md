---
name: webext-native-code
user_invocable: false
description: >-
  Apply automatically whenever writing or modifying UI code in a browser
  extension that localizes through the built-in message catalogs — popup,
  options, side panel, content scripts, the service worker, the manifest, or any
  change that adds or edits user-visible text. Not user-invocable. Ensures every
  string lands in messages.json with a translator description, that placeholders
  and plurals are authored correctly, and that manifest and store copy stay
  localizable.
template: webext-native
templateVersion: 2
conditions: [localeSwitcher]
values: [localesDir, sourceLocale, targetLocales, manifestFile, formatModule]
budget: { "localeSwitcher == \"custom-loader\"": 250, "default": 225 }
---

# Browser-Extension Message-Catalog Coding Rules

Apply these rules as you write code. Every user-visible string must have an entry in the message catalog and be read back through the accessor before the task is complete. The browser localizes extensions through `_locales` and nothing else — there is no runtime formatting library here.

**This project:**
- Source catalog: `<<localesDir>>/<<sourceLocale>>/messages.json`. Author every new key there, in `<<sourceLocale>>`. Never hand-fill a target locale.
- Target locales `<<targetLocales>>` live in sibling directories under `<<localesDir>>/`, spelled with an **underscore** and the browser's own casing — `pt_BR`, `zh_CN`, `en_GB`, `es_419`. A hyphen (`pt-BR`) is not a valid directory name and is silently ignored.
- Manifest: `<<manifestFile>>`.

## Externalize every user-visible string

A literal reaching a UI sink is never translated and fails silently — no build error, no lint warning, just English in every language.

<!-- if: localeSwitcher == "native" -->
```ts
import { t } from '@/src/i18n'         // the project's accessor — never call browser.i18n.getMessage at a call site

button.textContent = 'Save'           // Wrong — ships as English everywhere
button.textContent = t('action_save') // Right
```
<!-- /if -->
<!-- if: localeSwitcher == "custom-loader" -->
```ts
import { t } from '@/src/i18n'         // the project's own loader, not browser.i18n.getMessage

button.textContent = 'Save'           // Wrong — ships as English everywhere
button.textContent = t('action_save') // Right
```

**Never call `browser.i18n.getMessage()` directly in this project.** It reads the *browser's* UI language, so it would ignore the locale the user picked and quietly disagree with everything else on screen. The only exception is `browser.i18n.getUILanguage()`, used once inside the loader as the fallback when no preference is stored.
<!-- /if -->

```json
{ "action_save": { "message": "Save", "description": "Button in the popup footer that commits the current edit." } }
```

## Every entry gets a `description`

`description` is the only translator-comment channel this format has, and it is what the translation platform shows the translator. An entry without one is a string translated blind.

Write what a translator cannot see from the text alone: **where it appears**, **what any placeholder holds**, and **any length limit**. Skip restating the string itself.

```json
{
  "popup_empty_state": {
    "message": "Nothing saved yet",
    "description": "Shown in the popup body when the user has no saved items. Fits on one line, keep under ~30 characters."
  }
}
```

## Key naming

Keys match `[A-Za-z0-9_@]` only — **no dots, no hyphens**. `popup.title` is invalid. Use `surface_element_purpose`: `popup_header_title`, `options_sync_toggle_label`, `sw_notification_update_body`.

Keys are **case-insensitive**. `saveButton` and `savebutton` are the same key and one silently overwrites the other. Use lowercase with underscores throughout so the collision cannot arise.

Names beginning `@@` are reserved for the browser's predefined messages (`@@ui_locale`, `@@bidi_dir`, `@@extension_id`). Never define one.

## Interpolation — named placeholders, never concatenation

Declare a `placeholders` block and reference each by `$name$` in the body. Positional `$1`–`$9` works but tells the translator nothing.

```json
{
  "popup_saved_count": {
    "message": "Saved $count$ items to $folder$",
    "description": "Popup status line. $count$ is a number, $folder$ is a user-named folder.",
    "placeholders": {
      "count":  { "content": "$1", "example": "12" },
      "folder": { "content": "$2", "example": "Reading list" }
    }
  }
}
```

```ts
t('popup_saved_count', [String(count), folder])
```

Rules that bite:
- **Hard cap of nine substitutions.** A tenth makes the call return `undefined`, not a partial string.
- Always fill `example` — it is the difference between a translator guessing and knowing.
- `$$` escapes a literal `$` in a message body.
- Never build a sentence by concatenating translated fragments. Word order differs by language; one key with placeholders is the only correct shape.

## Plurals — the format has none

There is no plural support. Do not fake one with a placeholder: `"$count$ items"` reads as "1 items" in English and is unfixable in Russian.

Author one key per CLDR category the source locale needs, suffixed with the category name, and select at the call site:

```json
{
  "popup_item_count_one":   { "message": "$count$ item",  "description": "Item counter, singular form (CLDR category `one`). $count$ is the number." },
  "popup_item_count_other": { "message": "$count$ items", "description": "Item counter, plural form (CLDR category `other`). $count$ is the number." }
}
```

```ts
const pluralKey = (base: string, n: number, locale: string) =>
  `${base}_${new Intl.PluralRules(locale).select(n)}`

t(pluralKey('popup_item_count', n, locale), [String(n)])
```

Every category name must be one of `zero`, `one`, `two`, `few`, `many`, `other` — `Intl.PluralRules` returns exactly those, and translators for Arabic, Russian, Polish and Czech will add the categories their language needs. Say the category in each `description`, because the translator sees the keys separately and cannot infer it. Always ship an `_other` key: it is the fallback every locale has.

## Numbers, currencies, dates

`chrome.i18n` has no formatting API of any kind — no number, currency, date, or list formatting, on top of the no-plurals gap above. `<<formatModule>>` is this project's *only* source of locale-aware formatting; it reads the active locale itself via `formatLocale()` — never construct `Intl` directly at a call site. Import the functions you need as plain module-level imports — there is no hook and no factory to call first:

```ts
import { money, date, relativeTime } from '<<formatModule>>'

money(amount)              // '$42.50' — see below, currency comes from the data
date(value, 'short')       // 'medium' is the default if omitted — '8/21/26'
relativeTime(value)        // '3 days ago'
```

All ten:

```ts
money(amount)                        // '$42.50'
number(1234.5)                       // '1,234.5'
percent(0.42)                        // '42%'
compact(12000)                       // '12K'
unit(5, 'kilometer')                 // '5 km'
date(value, 'short')                 // '8/21/26'
date(value, 'long')                  // 'August 21, 2026'
time(value)                          // '4:05 PM'
dateTime(value)                      // 'Aug 21, 2026, 4:05 PM'
relativeTime(value)                  // '3 days ago'
list(['Alice', 'Bob', 'Carol'])      // 'and' is the default — 'Alice, Bob, and Carol'
list(['Alice', 'Bob'], 'or')         // 'Alice or Bob'
```

**Currency comes from the data, not the reader.** `money(amount)` uses the project default; when a record carries its own currency, pass it: `money(order.total, order.currency)`. Never derive a currency code from the locale — that relabels a dollar price as euros for a German reader.

**A locale this extension cannot *translate* into may still *format* correctly.** `chrome.i18n` only ever loads a catalog from Chrome's ~55-entry `_locales` table (see "Adding a locale" below); `Intl` supports far more locales than that. Never gate a `<<formatModule>>` call, or `formatLocale()` itself, on whether a locale has a `_locales` directory — the two lists are unrelated.

**Never build a formatted value into a `messages.json` entry.** `getMessage()` only fills `$1`–`$9` placeholder *positions* — it applies no formatting of its own. Format first with `<<formatModule>>`, then pass the result in as a substitution:

```ts
// Wrong — the catalog can't format $1; every locale sees the raw JS number
t('cart_total', [String(9.5)])

// Right — money() formats for the active locale; the catalog only substitutes it
t('cart_total', [money(9.5)])
```

**Needs a format the module has no preset for?** Add it to `<<formatModule>>`. A date style or currency code written out at two call sites will drift.

**Flag for review:** `toFixed()`, a currency symbol concatenated with a number (`'$' + price`), hardcoded date formats like `'MM/DD/YYYY'`, `new Date().toLocaleDateString()` with no explicit locale, any `new Intl.` outside `<<formatModule>>`.

MV3's CSP (`script-src 'self' 'wasm-unsafe-eval'`) does not affect any of this — `Intl` is built into the JavaScript engine, not loaded or evaluated as a string.

<!-- if: localeSwitcher == "custom-loader" -->
**`formatLocale()` reads a cache primed by an async `browser.storage.sync.get()`, not storage itself.** Every formatter above is synchronous; storage is not. Calling into `<<formatModule>>` before `primeFormatLocale()` has resolved for the first time — or before it has been re-run after the MV3 service worker restarts — silently formats against the browser's UI language instead of the picked one, with no error. Prime it exactly where `initI18n()` is already primed: once at startup before the first render, again in the `storage.onChanged` listener, and again at the top of the service worker on every restart.
<!-- /if -->

## HTML is not substituted

The browser rewrites `__MSG_key__` in **the manifest** and in **`.css` files**. It does **not** touch `.html`. A `__MSG_…__` written into markup renders literally.

Text in an HTML entrypoint is set from script after the catalog is available:

```html
<h1 data-i18n="popup_header_title"></h1>
<input data-i18n-placeholder="popup_search_placeholder">
```

```ts
for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
  el.textContent = t(el.dataset.i18n!)
}
for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-placeholder]')) {
  el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder!))
}
```

Do the same for `title`, `aria-label` and `alt`. The document `<title>` is set the same way, from script.

## Manifest and store copy

`<<manifestFile>>` must keep `default_locale` set, and every user-visible manifest field must be a `__MSG_…__` reference rather than a literal. Hardcoding `name` or `description` collapses the extension's store listing to a single language, however many locale directories ship.

Only four fields are substituted by both Chromium and Firefox — **use only these** unless the extension targets one engine and you have checked its list:

```json
{
  "default_locale": "<<sourceLocale>>",
  "name": "__MSG_ext_name__",
  "short_name": "__MSG_ext_short_name__",
  "description": "__MSG_ext_description__",
  "action": { "default_title": "__MSG_ext_action_title__" }
}
```

Chromium additionally substitutes `omnibox.keyword`, `commands.*.description` and the `chrome_settings_overrides.*` keys; Firefox does not, but does substitute `author`, `homepage_url` and `action.default_popup`. Everything else — `default_popup` on Chromium, `icons`, `permissions`, `content_scripts`, `options_ui.page` — is never substituted, and a `__MSG_` there is a bug.

Adding a locale directory is what makes that language selectable in the Chrome Web Store and Edge Partner Center listing dropdowns. The detailed description and screenshots are entered per locale in the dashboard and are not part of this catalog.

## Direction and RTL

<!-- if: localeSwitcher == "native" -->
Read direction from the browser rather than mapping locales by hand — the UI locale *is* the browser locale here, so the predefined message is authoritative:

```ts
document.documentElement.dir = t('@@bidi_dir')   // 'ltr' | 'rtl'
document.documentElement.lang = locale
```

`@@bidi_start_edge` and `@@bidi_end_edge` resolve to `left`/`right` for one-off cases.
<!-- /if -->
<!-- if: localeSwitcher == "custom-loader" -->
**Do not use `@@bidi_dir` in this project.** It reports the direction of the *browser's* UI locale, so a user who picks Arabic inside the extension on an English browser gets an LTR layout wrapping RTL text. Derive direction from the locale the picker actually selected, through the project's `dir()`:

```ts
document.documentElement.dir = dir()             // 'ltr' | 'rtl', from the selected locale
document.documentElement.lang = locale
```

The same applies to `@@bidi_start_edge` / `@@bidi_end_edge` — they track the browser, not the selection.
<!-- /if -->

For stylesheets, prefer CSS logical properties (`margin-inline-start` over `margin-left`, `padding-block` over `padding-top`/`bottom`, `inset-inline-end` over `right`) so a single rule serves both directions — the separate `css-i18n` skill audits and converts an existing stylesheet wholesale.

## What not to wrap

These are identifiers, not copy. Wrapping them breaks the extension:

- Permission strings and host-match patterns (`"storage"`, `"https://*/*"`)
- Message-passing discriminators — the `type` / `action` field on anything sent through `runtime.sendMessage`
- `storage` keys, alarm names, context-menu `id`s, `commands.*` key names, content-script `world` values
- CSS class names, element ids, `data-*` values other than the `data-i18n*` attributes above
- URLs, file paths, MIME types, and locale codes themselves
- Console logs and thrown `Error` messages that only a developer reads

<!-- if: localeSwitcher == "custom-loader" -->
## Locale resolution and the picker

The active locale is the user's stored preference, falling back to the browser's UI language, falling back to `<<sourceLocale>>`. It lives in `browser.storage.sync`, so **resolving it is asynchronous** — every entrypoint must await the catalog before it renders anything, or the first paint is untranslated.

```ts
const browser = globalThis.browser ?? globalThis.chrome

await loadCatalog()          // resolve locale + fetch the messages.json for it
render()                     // only now
```

When the picker writes a new preference, other open contexts must react rather than keep a stale catalog:

```ts
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.locale) void reload(changes.locale.newValue)
})
```

Because this project reads the catalogs itself, the browser's fallback chain no longer applies. The loader owns it: try the exact code (`pt_BR`), then the base language (`pt`), then `<<sourceLocale>>`. A missing key must fall through to the source catalog rather than render an empty string.
<!-- /if -->

## Adding a locale

Create `<<localesDir>>/<code>/messages.json` with the browser's underscored spelling and let the platform fill it. Chromium ignores a directory whose code is not in its supported list — `ar am bg bn ca cs da de el en en_AU en_GB en_US es es_419 et fa fi fil fr gu he hi hr hu id it ja kn ko lt lv ml mr ms nl no pl pt_BR pt_PT ro ru sk sl sr sv sw ta te th tr uk vi zh_CN zh_TW` — so check the code against it before adding one, and don't spend a translation on a language the browser will not load.
