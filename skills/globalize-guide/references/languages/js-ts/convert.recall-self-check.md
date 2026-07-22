# Convert: recall self-check + cleanup loop (JS/TS)

The Phase 1 `candidateFiles` detection grep is recall-limited: it surfaces JSX
text, user-visible attrs, exported string literals, and (since the data-module
nudge) display-copy keys in data modules — but it cannot catch every shape of
user-facing string (dynamic content maps, toast/error helpers, email templates,
config-driven copy). Any file it misses is never opened by a Phase 3.2 wrap
subagent, so its strings ship unwrapped. This self-check is the **backstop**: it
scans the *whole* source tree after the build passes, and feeds anything still
unwrapped into a bounded cleanup loop.

## Recall scan (per library)

Run **after** `build_check`, over the project's source root (e.g. `src/`),
excluding tests, stories, configs, and `.d.ts`.

- **Lingui — authoritative lint.** Ensure `eslint-plugin-lingui` is installed and
  configured per **Add-on 2** (`references/languages/js-ts/libraries/lingui/setup.add-ons.md`)
  — the single source of truth for the install (`'eslint-plugin-lingui@^0.14'`)
  and the tuned `no-unlocalized-strings` config (`ignoreNames`,
  `ignoreFunctions`, `ignore`). Consent rule: **guided** mode → describe and confirm before
  installing; **unguided** mode → install directly. If the user declines in
  guided mode, use the grep scan below for this run. Then run the project's ESLint
  over the source root with the **Add-on 2 config in effect** (so the tuned
  `ignoreNames`/`ignoreFunctions`/`ignore` apply — do **not** pass `--rule`, which
  overrides the rule and drops its options, which would surface the identifier/config
  decoys as noise):
  ```bash
  npx eslint 'src/**/*.{ts,tsx,js,jsx}' --format json
  ```
  Parse the JSON, keep only messages whose `ruleId === "lingui/no-unlocalized-strings"`
  (ignore other rules' messages), into `{ file, line, text }` violations. Because verify installs
  the plugin, the project keeps it as a **permanent guardrail** — the intended
  bonus.
- **next-intl / Paraglide — no reliable rule → tuned grep scan.** There is no
  officially-maintained `no-unlocalized-strings` equivalent (see each library's
  `setup.add-ons.md`). Scan the full source root for: bare JSX text (`>[A-Za-z]`),
  user-visible attrs (`placeholder=`/`aria-label=`/`title=`/`alt=`), and
  display-copy string literals under keys
  `name|title|label|heading|subheading|description|summary|body|text|message|caption|placeholder|tooltip|alt|cta|content`.
  Exclude the `code.md` skip-list classes: CSS class names, `console`/debug,
  import paths, object keys / internal codes, `ALL_CAPS` enums, `data-testid`,
  URLs/API paths, and identifier keys (`id`/`slug`/`sku`/`key`/`href`/`src`/`type`/`variant`/`icon`/`role`). Emit
  `{ file, line, text }` candidates. This scan needs **recall only** — the cleanup
  subagent supplies precision.
- **vue-i18n:** `@intlify/eslint-plugin-vue-i18n` `no-raw-text` if installed
  (consent as for Lingui), else the grep scan above adapted to `.vue` templates.

Write the violations to `progress/verify.json` as `result.recallViolations`. If
the list is empty, the recall gate passes — set status `succeeded` as usual. If
non-empty, set status `needs_cleanup` and stop (the orchestrator drives the loop).

## Cleanup loop (orchestrator-driven)

The orchestrator, on `needs_cleanup`, loops up to **`maxCleanupRounds` (default
2)** rounds:

1. **File cap.** If `recallViolations` spans more than **40 distinct files**, that
   is a detection catastrophe, not a cleanup job: cap the dispatch to the 40
   highest-violation files, `log()` how many files were dropped, and continue —
   never silently truncate.
2. **Dispatch a `wrap-cleanup` subagent** over the distinct violating files. Its
   prompt mirrors the Phase 3.2 wrap subagent (same `references.convert` +
   `references.code`), with the file list = the recall violations, and the note:
   *"These files were MISSED by detection. Wrap genuine user-facing strings per the
   convert reference and the `code.md` decision tree — for strings defined outside
   a component (data/content modules) use `msg\`text\`` at the definition site and
   resolve with `t(descriptor)` at the call site (`code.md` → 'Constants imported
   from another module'). Apply the `code.md` 'What not to wrap' skip-list: leave
   identifiers, slugs, SKUs, enum values, URLs, class names, and `data-testid`
   untouched. If a flagged string is genuinely non-translatable, leave it and note
   it — do not force a wrap."*
3. **Re-catalog + re-scan (inside the same subagent).** After wrapping, re-run the
   library's catalog step so newly-wrapped strings extract (Lingui:
   `npx lingui extract --clean` + `npx lingui compile`; Paraglide:
   `npx '@inlang/paraglide-js@^2' compile …`; next-intl/vue-i18n: none — runtime
   catalogs), then re-run the recall scan and write the residual
   `result.recallViolations` and `result.stringsWrappedInCleanup` (count wrapped
   this round).
4. **Terminate** when any holds: (a) the recall scan is clean; (b) the round
   wrapped **zero** new strings (the residuals are correctly-skipped false
   positives — the grep-path terminator); (c) `maxCleanupRounds` is reached. On
   (b)/(c) with residuals, **report them to the user** with file+line and the
   reason (`residualViolations`) — never drop them silently.

Record `result.cleanupRounds`. After the loop, run `comment_review_pass` over the
now-complete wrapped set (including the cleanup wraps).

## Why recall-then-judge is safe

The recall scan is deliberately over-inclusive; precision comes from the
`wrap-cleanup` subagent reading `code.md` and applying its skip-list. A raw grep
hit on a SKU or class name is surfaced but *not* wrapped, because the subagent
judges each candidate exactly as a normal Phase 3.2 wrap subagent would. This is
the same recall/precision split the detection→wrap pipeline already uses.
