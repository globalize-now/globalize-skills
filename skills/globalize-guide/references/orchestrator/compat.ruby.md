# Compatibility hard-stops — Ruby / Rails

Loaded by SKILL.md §1.2 when `language === "ruby"`.

**Ruby / Rails compatibility rules** (apply only when `language === "ruby"`):

| Condition | Action |
|---|---|
| `language === "ruby"` AND `framework !== "rails"` | **STOP.** "globalize-guide currently supports Ruby only through Rails (built-in `I18n` API + locale-rooted YAML). Non-Rails Ruby (Sinatra, Hanami, plain `i18n` gem) is not supported. Point me at a Rails app, or use the `i18n` gem docs directly." |
| `gettext_i18n_rails` OR `fast_gettext` in `Gemfile`/`Gemfile.lock` | **STOP.** "This project uses `gettext_i18n_rails` — the catalog format is PO, not YAML. The v1 Rails path supports locale-rooted YAML only; the PO/gettext overlay for Rails is not yet supported. Proceed manually, or wait for the PO overlay." |

**Name-collision warning (Ruby, non-blocking):** if `globalize`, `mobility`, or `traco` was detected (the model/DB-content translation gems — unrelated to Globalize.now), surface but do **not** stop: "I found `{gem}` in your Gemfile. It translates DB/model content (per-row data), not UI strings, and is unrelated to Globalize.now. The i18n setup won't touch it, and its content won't be in the connected catalog. Proceeding with UI-string i18n." Never conflate the `globalize` gem with the Globalize.now platform.

**Soft EOL warning (Ruby, non-blocking — NO emission gating):** if `language === "ruby"` AND the detected Rails `version` is `7.1` or earlier: "This project is on Rails {version}, which reached end-of-life. The Rails path supports 6.1 → 8.1 at the same code level (no version-gated i18n branches) — the emitted code is identical — but running EOL Rails in production isn't recommended. Consider upgrading. Proceeding." The default target is Rails 8.1; support runs down to 6.1. There is **no** version-gated emission for Rails (clean contrast with the JS framework version branches above).
