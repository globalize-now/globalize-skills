# Rails i18n support for `i18n-guide` — Design Spec

**Date:** 2026-06-05
**Status:** Approved (design); ready for implementation planning.
**Research basis:** `reports/rails-i18n-research-2026-06-04.md` (Part 5).
**Branch:** `feat/rails-i18n-support`

---

## Goal

Extend the `i18n-guide` skill to drive the full i18n journey (detect → setup → convert → connect) for **Ruby on Rails** projects using Rails' **built-in `I18n` API with locale-rooted YAML catalogs**, connecting `config/locales/{locale}.yml` to Globalize.now as the **`yaml-rails`** fileFormat.

This is the first **Ruby** language branch in a skill that today supports JS/TS only (Python/Django is researched but not built).

## Locked decisions

| Decision | Choice |
|---|---|
| **v1 catalog scope** | **Locale-rooted YAML only** → Globalize `yaml-rails`. `gettext_i18n_rails`/PO projects are **detected and warned**, PO overlay **deferred** to a later pass. |
| **Verification** | **Thorough**: stand up a modern Ruby (rbenv/asdf, ≥3.2) + Rails toolchain, scaffold fixtures, run a real `yaml-rails` round-trip. |
| **Pin convention** | Emit **Bundler `~> N.0`** pins in skill files; **leave repo CLAUDE.md unchanged** (convention-doc update deferred). |
| **Staging** | **Full vertical slice** on this branch (references + manifest + SKILL.md + globalize-now-cli-setup + library-checks). |

## Key platform/technical facts (locked with the user, Globalize owner)

- **Connected format is `yaml-rails`** — a dedicated Rails-flavored YAML format on Globalize.now (not the generic `yaml`). To be confirmed against the live platform during verification.
- Globalize **keys off a populated source-locale file** — Rails always ships `config/locales/en.yml`, so no `.pot`-vs-source ambiguity.
- The parser **understands CLDR plural sub-keys** (`one`/`other`/`few`/`many`…) as plural groups tied to `:count`.
- **No emitted-code version gating** — the Rails I18n surface (`t`, `l`, lazy `t('.key')`, `with_locale`, locale-rooted YAML, CLDR plural keys) is identical across 6.1 → 8.1. Support down to **6.1** with a *soft EOL warning* for ≤7.1; default target **8.1**. (Clean contrast with Django's `USE_L10N`/`ugettext` gating.)
- **`rails-i18n` is near-mandatory**: core Rails ships only the English plural rule; the gem supplies CLDR plural rules + default locale data. Pin **tracks the app's Rails major**.
- **Name-collision guardrail**: the `globalize` gem (+ `mobility`, `traco`) is **DB/model-content translation, unrelated to Globalize.now, OUT OF SCOPE** — detect-and-warn, never act/conflate.
- Per-request locale must use **`I18n.with_locale(locale) { … }` block form**, never bare `I18n.locale =` (thread-bleed).
- Rails locale codes are already hyphenated (`pt-BR.yml`) → minimal BCP47 normalization.
- **Convert phase needs two tool families**: `i18n-tasks` audits existing keys (missing/unused/normalize) but **cannot find hardcoded strings**; raw-text discovery uses **Herb** (preferred; erb_lint is effectively archived) / `erb_lint` `HardCodedString` / `rubocop-i18n`.

## Architecture: where Rails fits

Rails is **framework + built-in i18n library in one** (like Django), so it collapses the `libraries/`/`frameworks/` split into a single **framework-rooted node**. `rails-i18n` is a data/plural *dependency*, not an alternative API, so it does not fork the references.

```
skills/i18n-guide/references/languages/ruby/
└── frameworks/
    └── rails/
        ├── rails.setup.md
        ├── rails.convert.md
        ├── rails.code.md        # PASSIVE, @import-wired
        └── setup.add-ons.md
```

**Reused, unchanged:** SKILL.md's four-phase orchestration, the `.globalize/` workspace + progress polling, subagent dispatch, Phase-4 connection mechanics.

## Components / changes

### 1. Reference files (`references/languages/ruby/frameworks/rails/`)

- **`rails.setup.md`** — `config.i18n.*` (default_locale, available_locales, enforce_available_locales, fallbacks); `config/locales/` scaffold; `ApplicationController` `around_action` + `I18n.with_locale {}` block; optional URL-locale (`scope "/:locale"` + `default_url_options`); `rails-i18n` Gemfile add (`~>` Rails major); `raise_on_missing_translations` in test; explicit "no version gating" note.
- **`rails.convert.md`** — location-aware wrapping: views `t('.key')` + YAML-path mirroring; flashes; model validation messages → symbol keys under `activerecord.errors`; mailers (subject + body); helpers; `%{name}` interpolation (never concatenate); `_html` keys; `l()` for dates/numbers; raw-string discovery via Herb / erb_lint `HardCodedString` / rubocop-i18n; then `i18n-tasks missing/unused/normalize`.
- **`rails.code.md`** — PASSIVE rules (`@import`-wired): `with_locale`; lazy-lookup namespacing; `%{}`-not-concat; `_html`; CLDR plural keys + `rails-i18n`; what-NOT-to-wrap (`globalize`/`mobility`/`traco` model content, `db/`, `rails-i18n` defaults).
- **`setup.add-ons.md`** — `@import` wiring of `rails.code.md`; CI `i18n-tasks health`/`normalize` check; `rails-i18n` dep; Bundler `~>` pins.

### 2. `manifest.json`

Add a `rails-yaml` variant: `match { language: "ruby", framework: "rails", library: "rails-i18n" }`, `supportLevel: "stable"`, gem deps (`rails-i18n` + dev `i18n-tasks`, `herb`) with `~>` pins, `references` → the four files, Phase-4 `fileFormat: "yaml-rails"` with `en`/detected `default_locale` as source. (Gem deps may require a manifest-schema accommodation since `packages` is npm-shaped today — resolve in the plan.)

### 3. `SKILL.md` orchestrator (the riskiest, most invasive edit — keep additive)

- Extend Phase-1.1 detection to a **`language` notion** (`js-ts` | `ruby`); the JS path stays untouched.
- Ruby/Rails signals: `Gemfile`/`Gemfile.lock` with `rails`, `bin/rails`, `config/application.rb`, `config/environments/`, `config/locales/*.yml`, `.ruby-version`; Rails **version** from `Gemfile.lock`; Bundler as package manager; existing-i18n state (`config.i18n.*`, an `around_action`/`with_locale` switcher, `rails-i18n` present, `config/locales` populated/split).
- **Name-collision guardrail**: `globalize`/`mobility`/`traco` = model-content translation → detect-and-warn, never trigger UI logic.
- STOP/branch for `gettext_i18n_rails` ("PO overlay not yet supported in v1").
- Phase-1.2 compatibility: soft EOL warning for ≤7.1; **no emission gating** (support to 6.1, default 8.1).
- Phase-1.5 recommendation row for Rails.
- Phase-2/3 dispatch routes Rails → the new references; Phase-4 emits `config/locales/{locale}.yml`, `fileFormat: yaml-rails`, `en` source.

### 4. `globalize-now-cli-setup`

Recognize `config/locales/{locale}.yml` (locale-rooted nested) → `fileFormat: yaml-rails`; pass through hyphenated locale codes (minimal normalization). Handle split/nested `config/locales/` layouts.

### 5. `library-checks`

Track `rails-i18n` (pin tracks Rails major), `i18n-tasks`, `herb` (note erb_lint effectively archived). Record Bundler `~>` pins, not npm carets.

## Verification (thorough path)

1. Stand up modern Ruby (rbenv/asdf ≥3.2) + Rails; scaffold a Rails **8.1** fixture (and one legacy major, e.g. 7.1/6.1, to exercise the no-gating claim + soft warning).
2. **Setup**: confirm `config.i18n.*`, `config/locales/` scaffold, `around_action` + `I18n.with_locale` block (never bare assignment), `rails-i18n` added (`~>` Rails major), `raise_on_missing_translations` in test, optional URL-locale wiring.
3. **Convert**: views `t('.key')` with mirrored YAML paths, flashes/mailers/model validations/helpers covered, `%{name}` (no concatenation), `_html` keys, `l()`; model-content gems untouched; a hardcoded-string finder discovers raw text; `i18n-tasks health`/`normalize` pass.
4. **Catalogs**: locale-rooted nesting, CLDR plural groups (with `rails-i18n` non-English rules), preserved `_html` markup.
5. **Connect**: Phase-4 → `config/locales/{locale}.yml`, `fileFormat: yaml-rails`, `en` source; round-trip a real `en.yml` with a CLDR plural group, a `%{}` interpolation, and an `_html` key through Globalize; **confirm the `yaml-rails` format string against the live platform**, plurals round-trip as plurals, markup survives.
6. **Passive rules**: `setup.add-ons.md` idempotently appends the `@.claude/skills/i18n-guide/references/languages/ruby/frameworks/rails/rails.code.md` import to project CLAUDE.md.

## Out of scope (v1)

- `gettext_i18n_rails`/PO overlay (detect-and-warn only).
- Non-Rails Ruby (Sinatra/Hanami/plain `i18n` gem).
- Model/DB-content translation (`globalize`/`mobility`/`traco`) — detect-and-warn, never act.
- Repo CLAUDE.md pin-convention doc update (deferred).

## Open items to resolve during implementation

1. Exact `yaml-rails` format string + convention flag on the connected pattern (confirm live).
2. `_html`-key markup round-trips without escaping/stripping.
3. Manifest-schema accommodation for RubyGems deps (npm-shaped `packages` today).
4. Split/nested `config/locales/` glob behavior.
