# Phase 4.1 — Assemble `.globalize/globalize-inputs.json`

Loaded by SKILL.md §4.1. The orchestrator owns this one piece of Globalize knowledge because it depends on the just-converted catalog.

Build the inputs bundle the project skill consumes, from data already on hand — no re-detection:

- **projectName**, **provider**, **sourceLocale**, **targetLocales** ← `decisions.md` (collected in 1.7 / 1.9).
- **owner**, **repo**, **gitUrl** ← `detection.json` `git.remote` (parse owner/repo; convert SSH → HTTPS for `--git-url`).
- **catalogPath** ← Phase 3 verify `result.catalogPath`.
- **localePathPattern** + **fileFormat** ← derive from the library (the one piece of Globalize knowledge the orchestrator still owns, because it depends on the just-converted catalog):
  - **Lingui** → `po`, e.g. `src/locales/{locale}/messages.po`.
  - **next-intl** → `json-nested`, e.g. `messages/{locale}.json`.
  - **Paraglide** → `po` at `messages/{locale}.po` by default; if `decisions.setup.catalogFormat === "json"`, `json-flat` at `messages/{locale}.json`.
  - **Rails** (`detection.language === "ruby"`, `framework === "rails"`) → `yaml-rails` at `config/locales/{locale}.yml`; source = detected `default_locale` (or `en`). Rails locale codes are already hyphenated (`pt-BR`, `zh-TW`) — pass through verbatim, no underscore normalization.
  - **Android** (`detection.language === "android"`) → `android-strings`; **no `{locale}` segment** — point `localePathPattern` at the source `app/src/main/res/values/strings.xml` and let the handler discover the `values-*` target overlays (it normalizes legacy `values-pt-rBR` and BCP47 `values-b+sr+Latn` ⇄ BCP47). Do not synthesize a `{locale}` token.
  - **Browser extension, native** (`detection.framework === "webext"`, variant `webext-native-messages`) → `chrome-messages` at `_locales/{locale}/messages.json`. The `{locale}` segment **is** used, but Chrome spells locale directories with an **underscore** while Globalize languages are BCP-47, and `{locale}` is a literal substitution with no transform. So also assemble a **`pathLocales`** array — one `{ pattern, locale, pathLocale }` entry per target locale whose code carries a region or script subtag (`pt-BR` → `pt_BR`, `zh-CN` → `zh_CN`, `en-GB` → `en_GB`, `es-419` → `es_419`) — and pass it through to `globalize-now-project-setup`, which forwards it to `repositories create --path-locales`. Plain two-letter locales (`de`, `fr`, `ja`) need no entry. Emit the overrides explicitly rather than relying on server-side normalization: an override that states the spelling the handler would have derived anyway is consistent either way, whereas omitting one that was needed silently mis-targets every file for that language.
  - **Browser extension, Lingui** (`detection.framework === "webext"`, variant `webext-*-lingui`) → `po` at `src/locales/{locale}/messages.po`, exactly as for any other Lingui stack, and **no `pathLocales`** (PO directories are spelled with the BCP-47 code). The generated `public/_locales/**` must **not** get a pattern of its own — it is build output derived from the PO, and a second pattern over it would re-import machine-written files as source.
  - **Angular** (`detection.framework === "angular"`) → `xliff-2` at `src/locale/messages.{locale}.xlf` (read `extract-i18n.options.outputPath` / `outFile` from `angular.json` if they differ). The source file `messages.<sourceLocale>.xlf` matches the same pattern. No `pathLocales`.
  - **Swift / Apple** (`detection.language === "swift"`) → `xcstrings`; **single file, no `{locale}` segment** — `Localizable.xcstrings` (or `**/*.xcstrings` for multiple tables). The catalog holds every locale; source = the catalog's `sourceLanguage` / `CFBundleDevelopmentRegion`.
- **pathLocales** ← the array derived above; omit the key entirely (or send `[]`) for every stack other than the native browser-extension variant.
- **importMode**: `"ignore"`, **importScope**: `"new_keys_only"`, **mode**: `"orchestrated"`.

Write the file to `.globalize/globalize-inputs.json` and mark `assemble_globalize_inputs` done in `plan.md`.
