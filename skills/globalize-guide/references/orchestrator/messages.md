# Per-stack user-facing messages

Loaded by SKILL.md at the Phase 2 start, §2.0, §2.4 and the Phase 3 start. SKILL.md carries the JS/TS wording; this file carries every stack's variant verbatim — use the one matching `detection`.

## Phase 2 start

> **User-facing message** (at Phase 2 start):
> "Starting Phase 2 — setup. {for JS/TS: `First I'll install the i18n packages on my main thread so your lockfile stays in sync, then I'll dispatch one background worker that wires your build config, sets up the provider, scaffolds catalog folders for your locales, and verifies with a typecheck and build.`; for Rails: `I'll dispatch one background worker that installs the i18n gems with Bundler, wires `config/application.rb`, scaffolds `config/locales/` for your locales, sets up the locale switcher in `ApplicationController`, and verifies by booting the app and parsing the source catalog.`; for Android: `Nothing to install — string resources are built into the platform. I'll dispatch one background worker that creates `res/values/strings.xml` as your source catalog, scaffolds `res/values-<qualifier>/strings.xml` for your target locales, optionally wires per-app language selection, and verifies by parsing the catalogs (and running Lint if the Android SDK is available).`; for Swift: `No packages to install — Apple's localization stack ships with the SDK. I'll dispatch one background worker that creates the String Catalog (`Localizable.xcstrings`), enables build-time string extraction (`SWIFT_EMIT_LOC_STRINGS`), registers your locales, and verifies the catalog is valid.`; for Angular: `First I'll run `ng add @angular/localize`, matched to your Angular major, on my main thread so your lockfile stays in sync, then I'll dispatch one background worker that configures extraction, adds the XLIFF → JSON compile step, rewires `main.ts` to load translations before the app starts, and verifies with an extract, compile and build.`} I'll show progress as a checklist that updates every ~30 seconds. If the worker hits something it can't decide on its own, it'll pause and ask."

## §2.0 — before running the install

> **User-facing message** (before running):
> "Installing the i18n packages on my main thread first so your lockfile stays in sync — I'll run `{install command}` and stream the output."

## §2.4 — setup succeeded / failed

- `succeeded` → archive `progress/setup.json` to `progress/archive/<timestamp>/setup.json`, render summary (files created, files modified, verification result), advance to Phase 3. User-facing wrap-up:
  > "Setup verified — {for JS/TS: `typecheck and build are clean`; for Rails: `the app boots and the i18n config loads`; for Android: `the string resources parse and cover every locale (Lint clean)` or, when the SDK was absent, `the string resources parse and cover every locale (Lint skipped — no Android SDK)`; for Swift: `the String Catalog is valid and registered`; for Angular: `extraction, compile and build are clean`}. Files created: {N}, files modified: {M}. Moving on to Phase 3 — wrapping your hardcoded strings."
- `failed` → archive, render error, ask user how to proceed (retry, edit plan, abort). User-facing wrap-up:
  > "Setup hit an error during `{step}`: {one-line error summary}. Want me to retry, edit the plan, or stop here?"

## Phase 3 start

> **User-facing message** (at Phase 3 start):
> "Starting Phase 3 — converting hardcoded strings and hand-rolled formatting. I'm splitting **{file count}** files across **{N}** workers that run in parallel — each one walks its assigned files, wraps user-visible strings with the right macro, adds short translator comments where context isn't obvious, and routes hand-rolled prices, numbers and dates through the formatters module set up in Phase 2 (some files need only one of the two — each worker is told which). After they all finish, a final verify worker {for JS/TS: `runs extract + compile + build, then a recall self-check that catches any user-facing string the first pass missed (data modules, helpers) and self-heals it, so nothing ships unwrapped`; for Rails: `checks that every wrapped key has a matching source-locale entry, tidies any leftover scaffold keys, and runs your test suite if you have one`; for Android: `checks every `strings.xml` is well-formed and that target locales cover the source keys (running Lint for `MissingTranslation` if the Android SDK is available)`; for Swift: `runs a catalog-integrity check — confirming the String Catalog is valid JSON and covers the keys your code uses (no extract/compile step; the build populates the catalog)`; for Angular: `runs extraction, checks every message has a description, compiles the runtime JSON, builds, and runs a recall scan over templates and overlay-controller calls`}."

The `{file count}` above is the size of the **union** of `candidateFiles` and `formatCandidateFiles`, not of `candidateFiles` alone.
