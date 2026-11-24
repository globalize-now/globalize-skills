# Detection rules — Ruby / Rails

Read by the inspect worker (`inspect.md`) when `language === "ruby"`. The JS / TS table (`detect.js-ts.md`) does not apply.

**Ruby / Rails detection rules** (apply only when `language === "ruby"`):

| Field | How to detect |
|---|---|
| `framework` | `rails` gem in `Gemfile`/`Gemfile.lock`, OR `bin/rails`, OR `config/application.rb` → `rails`. Otherwise `unknown` (non-Rails Ruby — Sinatra, Hanami, plain `i18n` gem — is not supported; see 1.2). |
| `packageManager` | `bundler` (Rails projects use Bundler + `Gemfile`). |
| `version` | Parse `Gemfile.lock`: the line `rails (N.M.x)` → extract `N.M` (e.g. `"8.1"`). Used for the soft EOL warning in 1.2 and the `rails-i18n` pin. `null` if not resolvable. |
| `router` | `none` (Rails routing is not modeled here; the `version` field is what the Rails path keys on). |
| `existing.library` | `rails-i18n` in `Gemfile`/`Gemfile.lock` → `rails-i18n`; else `none`. (Rails' built-in `I18n` API is always present; `rails-i18n` adds CLDR plural data.) |
| `existing.configured` | `config.i18n.*` keys (e.g. `default_locale`, `available_locales`) set in `config/application.rb` or a `config/initializers/*.rb`. |
| `existing.providerWired` | An `around_action`/`switch_locale` or `I18n.with_locale` locale switcher present in `app/controllers/application_controller.rb`. |
| `existing.catalogsScaffolded` | `config/locales/*.{yml,rb}` present with at least one populated, non-stub locale file (note split layouts — `devise.en.yml`, nested dirs — all auto-loaded by Rails). |
| `existing.stringsWrapped` | Glob `app/views/**/*.erb`, `app/controllers/**/*.rb`, sample up to 50 files, count files using `t(`/`l(` helpers vs. files with bare user-visible text: > 80% using helpers → "yes", > 20% → "partial", else → "no". |
| `existing.signals` / `existing.present` | Rails always ships `I18n` and a stub `config/locales/en.yml` (`hello: "Hello world"`), and **neither counts**. A signal is: a `catalogs` entry when `existing.catalogsScaffolded` is true (name the files), a `config` entry per `config.i18n.*` setting, a `dependency` entry for `rails-i18n` or `i18n-tasks` (never for `globalize`, `mobility` or `traco`; see the guardrail below), `usage` when `existing.stringsWrapped` is not `no`, `switcher` when `existing.providerWired`, and `routing` for a `scope "(:locale)"` / `"/:locale"` in `config/routes.rb`. `existing.present` = `signals.length > 0`. `existing.library` stays as above, and `otherPackages` is `[]`. |
| `existing.catalogs` | `files`: the populated `config/locales/**/*.yml` files. `pattern`: `config/locales/{locale}.yml` when the files are per-locale at the top level, otherwise the dominant layout with `{locale}`. `format`: `yaml-rails`. `sourceLocale`: `config.i18n.default_locale`, else `en`. `locales`: the codes present. `existing.localeRouting`: `prefix` for a `:locale` route scope, `none` otherwise, `null` when nothing is present. |
| `candidateFiles` | Glob `app/views/**/*.erb`, `app/controllers/**/*.rb`, `app/mailers/**/*.rb`, `app/models/**/*.rb`; grep for bare user-visible text and string literals not already wrapped in `t(`/`l(`. Return files with ≥1 match, sorted by match count desc. |
| `formatCandidateFiles` | Glob `app/views/**/*.erb`, `app/helpers/**/*.rb`, `app/models/**/*.rb`, `app/mailers/**/*.rb`; grep for `strftime(`, `$#{` (a literal `$` immediately before a Ruby interpolation — match it **without** a leading `"`, since the overwhelmingly common form is mid-string, `"Total: $#{amount}"`, where the quote is nowhere near the `$`), `number_to_currency(` carrying an inline `unit:` or `precision:`, `number_with_delimiter(`, `number_with_precision(`, `time_ago_in_words(`, `.join(", ")`, and `.round(` **inside an ERB output tag** (`<%= … .round( … %>` — a `.round(` in a controller is arithmetic, not display). **Exclude `app/helpers/format_helper.rb`** — that is the formatters module the setup phase creates or extends, and it calls these helpers on purpose. Return files with ≥1 match, sorted by match count desc. |
| `localeSignals` | List `config/locales/` files and the locale codes present; `config.i18n.default_locale`/`available_locales` values; README mentions of language names. |

**Name-collision guardrail (Ruby):** the gems `globalize`, `mobility`, and `traco` translate **DB/model content** (per-row data like a product's `name`), NOT UI strings, and are entirely **unrelated to Globalize.now**. Do **not** treat `globalize` (the gem) as the Globalize.now platform. If any is present in `Gemfile`/`Gemfile.lock`, record it in `localeSignals.readmeHints` (or a free-form note) as a detect-and-warn signal — it must never trigger UI-string i18n logic and is surfaced to the user in 1.2 but is non-blocking.
