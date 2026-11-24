# Phase 1.2b — Existing i18n: choose the path

Loaded by SKILL.md §1.2b, whenever `detection.existing.present === true`. Read it before §1.3. Workers read the **Change contract** section below, the setup worker and every wrap worker alike.

## Why this gate exists

The from-scratch flow assumes a project with no i18n. Pointed at a project that already has it, the flow rewrites the config, moves every route under `app/[locale]/` and scaffolds new catalogs next to the old ones. One tester ran it on a Next.js + next-intl app with working `messages/*.json` catalogs and a working language switcher, and got a diff of about 200 files, with deletes and moves. They did not commit it. What that project needed was its existing catalogs connected to Globalize, which changes no code at all.

So before any library or scope question, the user picks what happens to the setup they already have. **The full setup is never the default**, and a run with no user to answer it never picks the full setup.

## What counts as existing i18n

`detection.existing.signals` lists the evidence, and `detection.existing.present` is true when the list is non-empty. The rules are in `detect.<language>.md`. On JS/TS any one of these counts: an i18n dependency, an i18n config file, locale catalog files, an i18n API in use, a language switcher, or locale routing. A **single** signal is enough. Partial states are exactly the ones a full setup damages most, because the run does not see what it is overwriting.

## The three paths

| Path | `decisions.existing.mode` | What runs | What it may change |
|---|---|---|---|
| **Connect what you have** | `connect` | Phase 1.5 and Phase 4 only. No library setup, no conversion. Globalize reads the catalogs that are already in the repo. | Nothing in the project except the `/.globalize/` line in `.gitignore`. |
| **Keep {library} and fill the gaps** | `extend` | Phase 2 with the existing library (the collapse plan in `setup-collapse.md` when `existing.configured`), Phase 3 over the strings that are still bare, then Phase 4. | Additive edits only, under the **Change contract** below. Nothing moves, nothing is deleted, and no existing key is rewritten. |
| **Full setup** | `replace` | The from-scratch flow: library choice, routing and scaffolding. | Anything the setup references do, including moving route files and replacing config. Every move and delete is listed and confirmed before it happens. |

### When each path is available

- **connect**: `existing.catalogs.files` is non-empty, and `existing.catalogs.format` is one of the Globalize file formats (`json-flat`, `json-nested`, `po`, `xliff-1`, `xliff-2`, `yaml-rails`, `arb`, `xcstrings`, `android-strings`, `chrome-messages`, `wxt-i18n`) or is `null`. When it is `null`, Phase 4 detects the format, and that detection can fail. Catalogs in any other format (`.ftl`, `.properties`, `.strings`, or locale objects in `.ts`/`.js`) cannot be connected as they are. Say so when you take the path away for that reason.
- **extend**: the existing library is the `library` of a manifest entry that matches this project's structural keys (§1.3). Compare after aliasing: `@nuxtjs/i18n` → `vue-i18n`, `@angular/localize` → `angular-localize`. On Rails, Android and iOS the platform built-in is the existing library, so `rails-i18n`, `android-strings` and `string-catalog` qualify whenever `existing.present`. Any other library, including `other`, has no setup or convert reference here, so extend is not offered.
- **replace**: `existing.library` is `none` (catalogs or a do-it-yourself setup without a library), or it is a supported library from the extend rule above. For a library on the `compat.js-ts.md` unsupported list, or for `other`, the full setup is not offered. Migrating off a library is out of scope, so tell the user: "remove {library} and its usages first, then re-run". Replace never removes or migrates an existing library, its call sites or its catalogs. When the user picks a **different** library than the existing one, say so before planning: "{existing} stays installed, and its `t()` calls and catalogs are not migrated. The new setup only covers strings that are still bare."

No path available → stop: "This project already has i18n ({signals summary}), and none of the paths I support fits it: {the reason for each path}. I'm stopping here rather than overwrite it."

### Recommendation (first match wins)

1. `connect` is available AND `existing.stringsWrapped === "yes"` → **connect**. The strings are already translatable, so the only missing piece is the translation platform.
2. `extend` is available → **extend**.
3. `connect` is available → **connect**.
4. Otherwise, recommend nothing. Ask the question if a user can answer it. Headless runs stop and report it.

`replace` is never recommended.

## Asking

"This project already has i18n set up: **{signals, one per line, with the evidence}**. I won't redo what's there. How do you want to proceed?"

One AskUserQuestion, recommended option first, available options only:

- **Connect what you have** (no code changes): "Connect your existing `{existing.catalogs.pattern}` catalogs to Globalize and start translating. I won't edit any project file."
- **Keep {library} and fill the gaps**: "Keep your {library} config, routing, switcher and catalogs exactly as they are. I'll only add what's missing: {N} files with bare strings get wrapped, new keys are appended to your catalogs, and I add the coding rules file. No file is moved or deleted."
- **Full setup** (rewrites your setup): "Redo the setup from scratch. This can replace your i18n config and move files (on Next.js with locale-prefix routing, every route file moves under `app/[locale]/`). Pick this only if you want to replace the current setup."

**Explicit intent wins.** When the user's own prompt already says what they want ("migrate to Lingui", "redo the i18n setup", "just connect my translations", "only wrap the remaining strings"), record that path without asking. It must still be an available path. Otherwise, explain why it isn't available and ask. A request to set up i18n generically ("add i18n", "set up translations") is **not** a request for the full setup.

**Headless / unguided, nothing pre-answered**: take the recommendation. If there is none, stop and report the question. Never pick `replace` without the user's explicit words.

Record the answer in `decisions.md` under `## Existing i18n`, with the path and the signals it was based on. Example: `**Connect what you have** — next-intl (configured), messages/{locale}.json, 3 locales`.

## How the path shapes the rest of Phase 1

| Step | connect | extend | replace |
|---|---|---|---|
| §1.4 branch | skip (no code changes) | ask | ask |
| §1.5 library | skip, no library work | skip: locked to the existing library, with no override offered | ask as usual, with the different-library warning above |
| §1.6 scope | `globalize` only. Setup and convert are off and not offered (to convert, pick extend). | setup on. Convert pre-checked by the usual rule. Globalize as usual. | as usual |
| §1.7 setup choices | Ask locales only. Source defaults to `existing.catalogs.sourceLocale`, targets to the other `existing.catalogs.locales`. Offer adding more targets. | Routing is **not asked**. Record `decisions.setup.routing` from `existing.localeRouting`: `prefix` → prefix-based (already in place, nothing moves), anything else → `None — kept as is`. Locales default to the existing ones. The other choices are asked as usual. | as usual |
| §1.8–1.10 | skip §1.8 and §1.10. Ask §1.9. | as usual | as usual |
| §1.11 plan | Phase 1.5 and Phase 4 sections only (`plan-format.md` → connect plan) | as usual, collapse plan when `existing.configured` | as usual |

**Changing routing is a structural change.** If the user wants locale-prefix URLs and does not have them, that is the full setup: say so in one sentence and offer to switch paths. Extend does not quietly add the routing.

## Footprint shown at §1.12

Before the final go, state what the plan will touch, as a line at the top of `plan.md` (`Footprint:`) and in the message:

- connect → "No project files change (only `.gitignore` gets `/.globalize/`)."
- extend → "Edits: about {setup file count} setup files plus {union of candidate files} source files. Moves: 0. Deletes: 0. Existing catalog keys: unchanged (new keys appended)."
- replace → the same counts, plus every structural move or delete the references name for this stack and choice. For Next.js App Router with prefix-based routing that is "moves {N} route files under `app/[locale]/`", where N counts the `page`/`layout`/`loading`/`error`/`not-found`/`template` files and route groups under `app/` (or `src/app/`). Then: "The setup worker lists every move and delete before it makes them."

## Change contract (workers)

Applies to the setup worker and every wrap worker. Read the `## Existing i18n` section of `decisions.md`. If it is missing, the project had no i18n and the run is a from-scratch setup. That case follows the `replace` rule at the end of this section.

**`extend`:**

1. **Never move, rename or delete a file that existed before the run.** The only files you may delete are ones you created in this run (listed in `filesCreated`). A reference step that moves files (the next-intl `[locale]` file move plan, a catalog directory restructure) is not run in extend: record the step as `[x] … — skipped: existing setup kept (extend)` and continue.
2. **A create step whose file already exists becomes an edit that adds what's missing.** Insert the missing locale, the missing plugin wrap or the missing provider prop, and keep everything else byte for byte. Never write a reference's full sample over an existing file. If the existing file can't take the addition without being restructured, write `needs_decision` with the minimal diff instead.
3. **Existing catalogs are append-only.** Never rename, re-key, re-order, re-nest or reformat an existing entry, and never touch existing translations in target-locale files. New keys follow the catalog's existing key and namespace convention.
4. **Existing translated call sites stay as they are.** A `t('key')` / `useTranslations` / `<FormattedMessage>` that already works is not rewritten into a different style, even where the coding rules would author new strings differently. Only bare strings get wrapped.
5. **Skip what already exists.** An existing language switcher, middleware or locale routing → `language_switcher` and routing steps are `[x] … — skipped: already present`.

**`replace`, and a from-scratch setup:** before the first move or delete of a file that existed before the run, write each one as a detail item under its step in `plan.md` (`move app/about/page.tsx → app/[locale]/about/page.tsx`). In guided mode, stop with `needs_decision` and the full list ("These {N} files will move and these {M} will be deleted. OK?") before making the first one. A move or delete that is not in that list is not made.
