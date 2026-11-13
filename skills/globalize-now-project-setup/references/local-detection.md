# Local i18n detection

Loaded by `globalize-now-project-setup` when it needs the repository's languages or catalog patterns from this working copy: to suggest answers to a Workflow preview's `needs`, or on the Project path for a `gitlab.com` repository. Each value found here is a suggestion the user confirms, never a guessed language.

A pattern found here becomes one entry of Workflow setup's `--patterns` (`{"pattern": …, "format": <fileFormat>}`, plus `"pathLocales"` where a layout spells a locale differently), or of the Project path's `repositories create --patterns` (`{"pattern": …, "fileFormat": …}`).

## Existing localization setup

Scan for known i18n config files to auto-detect source and target languages. Use the first match found — the project likely has one primary i18n setup.

| Signal | How to detect | What to extract |
|--------|--------------|-----------------|
| **LinguiJS** | `lingui.config.ts` or `lingui.config.js` exists | `sourceLocale` → source language, `locales` array → all languages |
| **next-intl** | `src/i18n/routing.ts` or `i18n/routing.ts` exists | `defaultLocale` → source language, `locales` array → all languages |
| **Paraglide** | `project.inlang/settings.json` exists (and/or `@inlang/paraglide-js` in `package.json` deps) | `baseLocale` → source language, `locales` array → all languages |
| **i18next** | `i18next` in `package.json` deps + config file (`i18n.ts`, `i18n.js`, `i18next.config.*`) | `lng` or `fallbackLng` → source language, `supportedLngs` → all languages |
| **react-intl** | `react-intl` or `@formatjs/intl` in `package.json` deps | Check for `defaultLocale` in config; scan `lang/` or `translations/` directories |
| **Angular** (`@angular/localize`) | `angular.json` has `projects.<p>.i18n.sourceLocale` and `@angular/localize` is in `package.json` | `i18n.sourceLocale` → source language; target languages from `src/locale/messages.<code>.xlf` file names (or `extract-i18n.options.outputPath`) minus the source |
| **Locale directories** | Directories named `locales/`, `messages/`, `translations/`, `lang/` | Subdirectory names or JSON file names (e.g., `en.json`, `fr.json`) indicate available locales |
| **Rails** | `config/locales/` directory exists with locale-named `.yml` files (e.g. `en.yml`, `pt-BR.yml`). Optionally, parse `config/application.rb` for `config.i18n.default_locale`. | `config.i18n.default_locale` (or `en` if absent) → source language; all other locale codes in `config/locales/*.yml` filenames → target languages. Locale codes may be hyphenated (`pt-BR`, `zh-TW`) — pass through verbatim. |
| **Android** | `res/values/strings.xml` exists (the locale-less default, typically under `app/src/main/res`), with per-locale `res/values-<qualifier>/strings.xml` overlays. | `res/values/strings.xml` → source language (the app default; report as `en` unless otherwise known). Each `res/values-<qualifier>/` dir → a target language: parse the qualifier and normalize **both** the legacy form (`values-pt-rBR` → `pt-BR`, `values-es` → `es`) and the BCP47 `b+` form (`values-b+sr+Latn` → `sr-Latn`) to BCP47. |
| **Locale files** | `*.po`, `*.pot`, `*.xliff`, `*.xlf`, `*.json` files in locale-like paths | File/directory names map to locale codes |

**Detection priority**: Config files (explicit locale lists) take precedence over directory/file scanning (inferred locales).

**Source vs target**: The source language is the `sourceLocale` / `defaultLocale` / `lng` from config. All other locales in the list are target languages. **Always exclude the source locale from the target list.**

If none of the above signals are found, record "no localization setup detected."

## Locale path pattern

During detection, also determine the **locale file path pattern** — a path template showing where locale files live. Supported placeholders and wildcards:

- `{locale}` — locale code. Required for **per-locale file layouts** (one file per language, where the locale appears in the file or directory **name**). **Omitted** for formats where the locale lives outside a filename token: a **single multi-locale file** such as an Apple String Catalog (`xcstrings`) holds every locale, so the pattern is the file path itself with no `{locale}` segment; and **`android-strings`** carries the locale in a resource **directory qualifier** (`res/values-<qualifier>/`), so its pattern points at the source `res/values/strings.xml` and the handler discovers target locales from the `values-*` dirs. Do not synthesize a `{locale}` segment for these formats (see their pattern rows below).
- `{namespace}` — namespace name (optional, for multi-namespace setups)
- `*` and `**` — wildcards for matching multiple files/directories

| Source | How to derive the pattern |
|--------|--------------------------|
| **LinguiJS** (single catalog) | Read `catalogs[0].path` from config. Strip `<rootDir>/` prefix. Append `.po`. Example: `src/locales/{locale}/messages.po` |
| **LinguiJS** (per-page catalogs) | Read `catalogs[0].path`. Replace `{entryDir}`/`{entryName}` with `**/*` wildcards, keep `{locale}`. Example: `src/app/{locale}/**/*.po` |
| **next-intl** | Check `messages/` directory. Flat JSON files per locale → `messages/{locale}.json`. Subdirectories with multiple namespace files → `messages/{locale}/{namespace}.json` |
| **Paraglide** | Flat message catalog per locale. `messages/{locale}.po` for the PO format (the globalize-guide default — a `plugin.globalizeNow.po` key in `project.inlang/settings.json`, or `messages/*.po` files present); `messages/{locale}.json` for the ICU-JSON format (`plugin.inlang.icu-messageformat-1`, or `messages/*.json`) |
| **i18next** | Read `backend.loadPath` from config. Replace `{{lng}}` → `{locale}`, `{{ns}}` → `{namespace}`. Example: `locales/{locale}/{namespace}.json` |
| **react-intl** | No standard config key. Derive from directory scanning below. |
| **Rails** | Pattern is always `config/locales/{locale}.yml`. Note in detection output that Rails projects may also have split files (e.g. `config/locales/devise.en.yml`) or subdirectories — the pattern targets the primary per-locale files. |
| **Apple String Catalog** (`.xcstrings`) | A **single multi-locale file** holds every locale, so there is **no `{locale}` segment**. The pattern is the catalog path itself: `Localizable.xcstrings` (the default table), or `**/*.xcstrings` when there are multiple tables/directories (e.g. `InfoPlist.xcstrings`, a per-storyboard `Main.xcstrings`). `fileFormat: xcstrings`; the source language is the catalog's `sourceLanguage` / Info.plist `CFBundleDevelopmentRegion`. The `{locale}` "required" rule above does not apply to this format. |
| **Android** | **No `{locale}` segment** — the locale lives in the directory qualifier (`res/values-<qualifier>/strings.xml`), so point the pattern at the source file `**/res/values/strings.xml` (or the module-specific `app/src/main/res/values/strings.xml`). The `android-strings` handler discovers the target `res/values-*/strings.xml` overlays and normalizes their qualifiers ⇄ BCP47 on its own. When unsure of the path, leave the pattern to Globalize's own detection rather than forcing a `{locale}` token. |
| **Browser extension** (`_locales`) | `_locales/{locale}/messages.json`. The `{locale}` segment **is** used, but Chrome spells locale directories with an **underscore** (`pt_BR`, `zh_CN`, `es_419`) while the platform's languages are BCP-47 (`pt-BR`). Give each affected language a **path-locale override**: `"pathLocales": {"pt-BR": "pt_BR"}` on the Workflow pattern, or the Project path's `--path-locales`. `fileFormat: chrome-messages`. |
| **WXT** (`@wxt-dev/i18n`) | The authoring source, not the generated `_locales` output: `<srcDir>/locales/{locale}.yml` (also `.json`/`.json5`/`.toml`). `fileFormat: wxt-i18n`. Never point a pattern at the `_locales/` build output as well — it would re-import generated files as source. |
| **Angular** | `<outputPath>/messages.{locale}.xlf` from `angular.json` `extract-i18n.options` — `src/locale/messages.{locale}.xlf` in a globalize-guide setup. The source file matches the same pattern **only when `outFile` is `messages.<sourceLocale>.xlf`** (what globalize-guide sets). With no `outFile`, Angular writes the source as `messages.xlf`, which `messages.{locale}.xlf` does not match — set `outFile: "messages.<sourceLocale>.xlf"` and re-run `ng extract-i18n` before connecting, or the source catalog is never imported. |
| **Locale directories/files** | Examine the discovered files. Replace the locale code segment with `{locale}`. If multiple files per locale follow a namespace pattern (e.g., `locales/en/common.json` + `locales/en/auth.json`), use `{namespace}` for the varying filename: `locales/{locale}/{namespace}.json`. If the structure doesn't suggest named namespaces, use wildcards: `locales/{locale}/*.json`. Single file per locale: `locales/{locale}.json`. |

If no pattern can be determined locally, record it as absent and leave it to Globalize's detection.

## File format

When a locale path pattern is determined, also determine the **file format**. The `fileFormat` value must be one of: `json-flat`, `json-nested`, `po`, `xliff-1`, `xliff-2`, `yaml-rails`, `arb`, `xcstrings`, `android-strings`, `chrome-messages`, `wxt-i18n`.

| Source | fileFormat value |
|--------|----------------|
| **LinguiJS** | `po` |
| **next-intl** | `json-nested` (next-intl uses nested key structure) |
| **Paraglide** | `po` if `messages/*.po` are present (the globalize-guide default — PO format via `@globalize-now/paraglidejs-po-format`, carries `#.` translator comments). `json-flat` for `messages/*.json` (ICU-JSON; flat key → ICU string, no translator comments) |
| **i18next** | `json-nested` by default. If `keySeparator: false` in config, use `json-flat`. |
| **react-intl** | Inspect file content (see JSON detection below) |
| **Angular** | `xliff-2` when `extract-i18n.options.format` is `xlf2`/`xliff2`; `xliff-1` when it is `xlf`/`xlif`/`xliff`/absent |
| **`.po` / `.pot` files** | `po` |
| **`.xliff` / `.xlf` files** | `xliff-1` — if you can inspect the file, check the `version` attribute: `2.0` → `xliff-2`, `1.x` → `xliff-1` |
| **`.yaml` / `.yml` files** | `yaml-rails` (Rails-style locale-rooted YAML) |
| **`.arb` files** | `arb` (Flutter Application Resource Bundle) |
| **`.xcstrings` files** | `xcstrings` (Apple String Catalog) |
| **`strings.xml` files** | `android-strings` (Android string resources) |
| **`_locales/<code>/messages.json`** | `chrome-messages` (browser-extension message catalog — `{key: {message, description, placeholders}}`). Do **not** classify these as `json-nested`: that would treat `description` and `placeholders.*.content` as translatable leaves and corrupt the catalog. |
| **`locales/<code>.yml` beside a `wxt.config.*`** | `wxt-i18n` (the `@wxt-dev/i18n` authoring format, which compiles to `_locales/`) |
| **`.json` files** | Inspect content: if all top-level values are strings (`{"greeting": "Hello", "bye": "Goodbye"}`), use `json-flat`. If top-level values contain objects (`{"home": {"greeting": "Hello"}}`), use `json-nested`. |

If the file format cannot be determined locally, record it as absent.
