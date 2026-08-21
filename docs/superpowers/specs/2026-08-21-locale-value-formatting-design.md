# Locale-aware value formatting for `globalize-guide` — Design Spec

Date: 2026-08-21
Status: proposed
Branch: `feat/locale-value-formatting`

---

## Goal

Localization is translation **plus** locale-correct rendering of values. Today the skills do the
first well and the second only on paper.

Every rules template already carries a "Numbers, currencies, dates" section, and every one of them
ends with a **"Flag for review"** line naming `toFixed()`, `"$" + price` and `"MM/DD/YYYY"`. But:

- **Only Paraglide generates an actual helper.** The other seven templates describe an API and
  leave the reader to construct `Intl` at the call site — or, on Rails/Android/iOS/webext-native,
  to construct it correctly from prose alone.
- **Lingui ships option objects, not helpers.** `setup.locale-module.md` §"Why these live here"
  explicitly rejects wrapper functions, on the grounds that a wrapper has nowhere to get `i18n`
  from except the module-scope singleton — a request-bleed bug under SSR. That reasoning is
  correct and the conclusion is too narrow: a **React hook** reads `i18n` from context, which is
  precisely the seam the objection was missing.
- **next-intl and vue-i18n rules document named format presets that setup never registers.** The
  vue-i18n template even carries a branch whose text is *"This project registers no named formats
  on the i18n instance"* — describing the state its own setup leaves behind.
- **Nothing detects or converts hardcoded formatting.** §1.1 `candidateFiles` greps for hardcoded
  *strings* only. "Flag for review" is addressed to a human reading the rules file later; no phase
  of the run acts on it.
- **Nothing covers relative time, lists, or units at all** — the three things application code
  hand-rolls most often, and the two (`relativeTime`, `list`) that no library in the matrix except
  next-intl provides.

This spec closes all five gaps across all 23 variants plus `lovable-i18n`.

---

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Architecture | **One contract, N idioms.** Every variant generates a formatters module exposing the same conceptual surface, implemented in the target environment's idiom, delegating to the library's own formatter where one exists | Makes `<<formatModule>>` uniform in all 8 rules templates and gives the Phase 3 convert pass a single target to rewrite toward. The alternative — stay native per library, fill only the gaps — leaves eight templates reading differently and gives `relativeTime`/`list`/`unit` no home on 22 of 23 variants |
| Formatting locale | **The UI locale, resolved through a `formatLocale()` seam** | Formatting follows the translation locale, which is right for the overwhelming majority of apps. But every module routes through one function, so a project that later wants a separate regional preference edits one place instead of every call site. No new Phase 1 question, no new persisted state |
| Step type | **Core step `generate_format_helpers`, always runs**, ordered immediately before `generate_coding_rules` | The rules template resolves `<<formatModule>>` to a real import path and the Phase 3 pass rewrites toward it — both break if the module is optional. Making it optional would need a `hasFormatModule` condition plus a fallback authoring path in every template. Additive, non-breaking, one new file; guided mode still shows the diff |
| Surface | **Fixed ten functions, never pruned** | Reverses, *for this module only*, the "presets nothing uses are dead exports" rule in `setup.locale-module.md` and `paraglide.setup.md`. The rules file is a mechanical projection of a template that documents all ten; a setup step that pruned three would leave the generated rules describing functions that do not exist. The date **preset map** stays trimmed to what the codebase uses — that rule was always about project decisions (currency code, date styles), not about tree-shakeable functions |
| Currency | `money(amount, currency?)` with a project `DEFAULT_CURRENCY` resolved at setup, overridable per call | Satisfies the single-currency common case without violating the rule Android and iOS already state: **currency is a property of the price, not of the reader** |
| Convert | **Fold into the existing wrap subagents**, do not add a parallel fleet | Format bugs and string bugs live in the same files often enough that a second fleet would have two agents editing one file concurrently. Wrap subagents already open every file they own |
| Detection | New `formatCandidateFiles`, **unioned** with `candidateFiles` for subtree assignment | Hardcoded formatting lives in util/currency/date modules that contain no user-visible copy, so it is *not* a subset. Each wrap subagent is told which concern applies to which of its files |
| Paraglide | Rename `formatCurrency`/`formatNumber`/`formatPercent`/`formatDate*` to the uniform names, keep the old names as deprecated aliases | The module is generated into user repos and a re-run overwrites it. Aliases mean an already-set-up project does not break at the call sites |
| `globalize-now-cli-use`, `css-i18n` | Untouched | Formatting is not a CLI-resource concern, and logical properties are a separate axis |

---

## Verified facts

Checked against current library docs, 2026-08-21:

1. **next-intl has global named formats** — `formats: { dateTime, number, list, displayName }` on
   the object `getRequestConfig` returns, or as the `formats` prop of `NextIntlClientProvider`.
   Used as `format.dateTime(d, 'short')`, `format.list(items, 'enumeration')`.
2. **next-intl solves both SSR traps at the config layer** — `now: new Date()` gives server and
   client one shared reference instant for `relativeTime`, and `timeZone: 'Europe/Berlin'` pins
   date rendering (it otherwise "defaults to the server's time zone"). Our helper must surface
   these rather than reimplement them.
3. **`useFormatter()` works in any environment** on next-intl v4, Server Components included.
   `getFormatter()` is still needed in non-component async code (`generateMetadata`, route
   handlers).
4. **vue-i18n named formats are keyed per locale** — `numberFormats['en-US'].currency`. A preset
   must therefore be registered for the source locale **and every target locale**, or the call
   silently falls back to browser defaults and emits no currency symbol at all.
5. **vue-i18n's own documentation demonstrates the bug we are guarding against**: its
   `numberFormats` example registers `USD` under `en-US` and `JPY` under `ja-JP`. That converts a
   price rather than formatting it. Our generated presets register the **same** currency code
   across every locale entry, and the rules template calls this out by name.
6. **vue-i18n has no list and no relative-time API.** Those come from raw `Intl` inside the
   composable.
7. **`Intl.RelativeTimeFormat` takes `(value, unit)`, not two dates.** Choosing the unit is
   application code — which is exactly why it is hand-rolled everywhere and why it belongs in the
   generated module.

---

## The contract

Ten functions, identical in meaning on every stack, plus one seam:

| Function | Backed by |
|---|---|
| `money(amount, currency?)` | `Intl.NumberFormat` `style: 'currency'`, currency defaulting to `DEFAULT_CURRENCY` |
| `number(value, opts?)` | `style: 'decimal'` |
| `percent(value)` | `style: 'percent'` |
| `compact(value)` | `notation: 'compact'` |
| `unit(value, unit)` | `style: 'unit'` |
| `date(value, preset?)` | `Intl.DateTimeFormat`, presets `short` / `medium` / `long` |
| `time(value)` | `timeStyle: 'short'` |
| `dateTime(value)` | `dateStyle: 'medium', timeStyle: 'short'` |
| `relativeTime(value, now?)` | `Intl.RelativeTimeFormat` with `numeric: 'auto'` (so "yesterday", not "1 day ago") over a computed unit |
| `list(items, type?)` | `Intl.ListFormat`, `'and'` (conjunction) / `'or'` (disjunction) |
| `formatLocale()` | **the seam** — the single function every other one calls for its locale |

`relativeTime` unit thresholds: `< 60s` second · `< 60m` minute · `< 24h` hour · `< 7d` day ·
`< 4.35w` week · `< 12mo` month · else year.

`DEFAULT_CURRENCY` is resolved at setup by grepping for an existing `currency:` option, an
`Intl.NumberFormat`/`toLocaleString` call, or a hardcoded symbol. When nothing is findable it stays
`USD` with a `// adjust to this project's currency` comment appended — a wrong currency that flags
itself beats one that looks deliberate. This mirrors the rule already in `setup.locale-module.md`.

### SSR hazards (new template condition `ssr`)

Two failure modes are invisible in development and produce hydration mismatches in production.
Both get a rules-template block gated on `ssr`, and both are named in the generated module's
comments:

1. **Time zone.** `Intl.DateTimeFormat` defaults to the *runtime's* zone, so the server renders in
   the deploy region's zone and the client in the reader's. Fix: pin an explicit zone, or render
   time-of-day client-side only. On next-intl, use its `timeZone` request config rather than a
   local constant.
2. **`relativeTime` reference instant.** Server and client compute `Date.now()` milliseconds apart
   and eventually across a threshold. Fix: pass an explicit `now`. On next-intl, use its global
   `now` config.

---

## Per-environment idiom

| Variants | Module | Shape | Delegates to |
|---|---|---|---|
| Lingui × 11 (9 web + 2 browser-extension) | `<i18nDir>/format.ts` | `useFormatters()` hook + `getFormatters(locale)` for loaders, server code and tests | `i18n.number()` / `i18n.date()` off the `useLingui()` instance — no module-scope singleton read, which is what makes this safe under SSR |
| next-intl × 3 | `<i18nDir>/format.ts` | `useFormatters()` + `await getFormatters()` | `useFormatter()` / `getFormatter()`; presets registered as next-intl **named formats** in the request config (App Router) or the provider prop (Pages Router) |
| vue-i18n × 3 | `<i18nDir>/format.ts` | `useFormatters()` composable | `n()` / `d()` for money/number/percent/date; raw `Intl` for `list`, `relativeTime`, `unit`, `compact`. Presets registered under `numberFormats`/`datetimeFormats` for **every** locale, same currency code in each |
| Paraglide × 1 | `src/lib/format.ts` (exists) | plain module functions | raw `Intl`; extended with `relativeTime`, `list`, `unit`, `compact`; old names kept as deprecated aliases |
| webext-native × 1 | `src/i18n/format.ts` | plain module functions | raw `Intl`. `formatLocale()` reads `chrome.i18n.getUILanguage()`, **or** the stored choice when `decisions.setup.localeSwitcher === "custom-loader"` — the one variant where the seam is load-bearing on day one |
| Rails × 1 | `app/helpers/format_helper.rb` + locale YAML | `format_money`, `format_date`, `format_relative_time`, `format_list`, … (snake_case; `number` alone would collide in a view) | `number_to_currency`, `l()`, `to_sentence`, `distance_of_time_in_words`, backed by `number.*` / `date.formats` / `support.array` keys |
| Android × 1 | `Formatters.kt` + Compose `LocalFormatters` | `Formatters.of(context)` in views, `LocalFormatters.current` in Compose | `NumberFormat`, `DateTimeFormatter`, `android.icu.text.*` — **branched on minSdk** |
| iOS × 3 | `Formatters.swift` | `FormatStyle` extensions → `amount.formatted(.money)`, `Text(amount, format: .money)` | `.currency(code:)`, `Date.FormatStyle`, `Date.RelativeFormatStyle`; cached `NumberFormatter`/`DateFormatter` below the `.formatted()` availability floor |

The iOS shape is deliberately not a `Formatters.money(x)` call: SwiftUI's `format:` initializer
re-formats automatically when the environment locale changes, which formatting into a `String`
does not. Extending `FormatStyle` is what makes `Text(amount, format: .money)` legal.

---

## Components changed

### 1. `SKILL.md`

- **§1.1 inspect** — new `formatCandidateFiles` field in `detection.json`, with a per-language grep
  table: JS/TS `toFixed(`, `toLocaleDateString(`, `toLocaleTimeString(`, `toLocaleString(`,
  `new Intl.` outside the i18n dir, `'$' +` / `"$" +` / a `$` immediately before a template-literal
  interpolation, `moment(`, `dayjs(`, `date-fns` `format(`; Ruby `strftime(`, `number_to_currency(` with an
  inline `unit:`; Kotlin/Java `SimpleDateFormat(`, `DecimalFormat(`, `String.format("%.2f"`;
  Swift `String(format: "%.2f"`, `dateFormat =`, a number or `Date` interpolated straight into a
  user-visible literal.
- **§1.1 scan summary** — one added clause: "… and **{N}** files formatting values by hand."
- **§1.11 / plan format** — `generate_format_helpers` in the Phase 2 step list, before
  `generate_coding_rules`.
- **§2.2 setup prompt** — the new step, and the instruction to write `.globalize/format-module.json`.
- **Phase 2 collapse-case** — `generate_format_helpers` is **not** dropped, for the same reason
  `generate_coding_rules` is not: an already-configured project still needs the module before
  Phase 3 can rewrite toward it.
- **§3.2 wrap prompt** — second concern, with each file tagged `strings` / `formatting` / `both`.
- **§3.5 verify** — a `formatViolations` grep, reported in `result` on every language.
- **§3.5.1 cleanup loop** — `formatViolations` feed the loop where it already runs (JS/TS); on
  Rails/Android/Swift/webext-native they are reported to the user, matching how those stacks
  already sit outside the loop.

### 2. `.globalize/format-module.json` (new artifact)

Written by `generate_format_helpers`, read by `generate_coding_rules`:

```json
{ "specifier": "@/i18n/format", "path": "src/i18n/format.ts", "surface": ["money", "..."],
  "defaultCurrency": "EUR", "currencySource": "grep:src/checkout/price.ts:12" }
```

Formalizes what `paraglide.setup.md` already asks for in prose ("record the specifier you used;
the coding-rules step reads it back as `formatModule`").

### 3. Setup references

The format module is created by whichever reference owns the library's shared runtime directory:

`lingui/setup.locale-module.md` (which already owns everything under `<i18nDir>/`, and whose
module-inventory table gains a `format.ts` row) · `next-intl/setup.add-ons.md` (new **Core step 0**)
· `vue-i18n/setup.shared.md` · `sveltekit/paraglide.setup.md` (extend) ·
`webext/webext-native.setup.md` · `rails/rails.setup.md` · `android/android-strings.setup.md` ·
`ios/string-catalog.setup.md`.

Splitting ownership of a file across two references is what `setup.locale-module.md` §Ownership
exists to forbid, so the content goes wherever the directory's owner is — the uniform thing is the
**step id** in `plan.md`, not the hosting file.

### 4. Rules templates (all 8)

"Numbers, currencies, dates" is rewritten to point at `<<formatModule>>` with the real import,
extended to relative time / lists / units, and gains the currency-from-data rule and the two
`ssr`-gated hydration blocks. New `values` entry `formatModule`; new `conditions` entry `ssr` on the
templates that lack it (Paraglide already has it). `budget:` bumped per template.

The self-containment invariant is unaffected — `<<formatModule>>` resolves to a path in the
*user's* project, never into the skill.

### 5. Convert references

New shared `references/languages/js-ts/convert.format-pass.md`, added to `references.convert` for
all 19 JS/TS variants (**the only `manifest.json` change**). Rails and Android are one variant each
and the three iOS variants already share `string-catalog.convert.md`, so their pass is a section
inside the existing convert reference rather than a shared file.

Variant arithmetic, for the record: 11 Lingui (9 web + 2 browser-extension) + 3 next-intl +
3 vue-i18n + 1 Paraglide + 1 webext-native = **19 JS/TS**; + 1 Rails + 1 Android + 3 iOS = **23**.

### 6. `lovable-i18n`

Single-file, so all of the above collapses into: create `src/i18n/format.ts`, add the ten-function
section to the AGENTS.md rules it writes, and add a formatting sweep to its wrap phase. It already
has a "Hand-rolled formatting" cleanup instruction — that becomes a pointer at the module instead
of an inline options object.

### 7. Evals

- `verify-rules-template.sh` — assert every template declares `formatModule` in `values` (the
  existing declared-but-unused and used-but-undeclared checks then cover the rest for free), and
  re-measure every template against its bumped `budget:`.
- New `verify-format-helpers.sh` — for a rendered fixture, assert `.globalize/format-module.json`
  exists, its `specifier` resolves to a real file, and the file exports all ten names.

---

## Implementation order

Each phase leaves the repo consistent, so the work can stop between phases.

1. **Contract + one stack end to end** — Lingui (`setup.locale-module.md`, `rules.template.md`,
   `convert.format-pass.md`, `format-module.json`, SKILL.md wiring). Nine variants, and it is where
   the hook-vs-singleton question is hardest.
2. **Remaining JS/TS** — next-intl, vue-i18n, Paraglide, webext-native.
3. **Natives** — Rails, Android, iOS.
4. **Detection + convert pass** — `formatCandidateFiles`, §3.2/§3.5/§3.5.1.
5. **`lovable-i18n` + evals.**

Phase 4 is deliberately last: until every stack has a module, the pass has nothing uniform to
rewrite toward.

---

## Verification

1. `evals/verify-rules-template.sh` passes on all 8 templates.
2. Layer A eval: a fixture run produces `src/i18n/format.ts`, `.globalize/format-module.json`, and a
   `.agents/globalize-rules.md` whose formatting section imports the real specifier.
3. Layer B eval on `nextjs-app-router-lingui` (the only prefilled variant): a file containing
   `"$" + price.toFixed(2)` and `new Date(x).toLocaleDateString()` comes back using `useFormatters()`.
4. Typecheck the generated module on one variant per library — 8 typechecks.
5. Manual: confirm `money(1234.5)` renders `$1,234.50` / `1.234,50 €` / `1 234,50 $US` across three
   locales, and that `relativeTime` yields "yesterday" rather than "1 day ago".

---

## Out of scope

- A separate persisted regional preference (`formatLocale()` is the seam; wiring a real preference
  is a follow-up).
- Message-embedded ICU number/date arguments (`{amount, number, ::currency/USD}`) — already covered
  by the existing plural/ICU sections; this spec is about values formatted in code.
- Timezone *selection* UI, and any date-library migration (`moment`/`dayjs`/`date-fns` → `Intl`);
  the convert pass flags those call sites, it does not remove the dependency.
- `globalize-now-cli-use`, `css-i18n`.

---

## Open items

1. **Android API levels.** `java.time` needs core library desugaring below API 26;
   `android.icu.text.ListFormatter` and `RelativeDateTimeFormatter` have different minimums than the
   rest. The exact floors and the fallback for each must be verified against current platform docs
   at implementation time — this spec deliberately does not assert them.
2. **iOS availability floor.** `.formatted()` / `FormatStyle` is iOS 15+; whether to emit the cached
   `NumberFormatter`/`DateFormatter` fallback unconditionally or gate it on the project's deployment
   target.
3. **Paraglide alias lifetime.** How long the deprecated `formatCurrency`-style aliases stay before
   a `templateVersion` bump drops them.
4. **Does `unit()` earn its place?** It is the least-used of the ten and the only one whose second
   argument is an open enum. Keep unless the first implementation phase shows it bloating budgets.
