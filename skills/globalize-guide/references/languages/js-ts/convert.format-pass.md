# Convert hand-rolled value formatting (JS/TS)

**Read `.agents/globalize-rules.md` first.** This file is deliberately library-agnostic: it names no
library API and no import path, because the real specifier, the access form (a `useFormatters()` hook,
an awaited `getFormatters()`, or bare module exports) and the helper list all live in the generated
rules file, which is written against *this* project. Where this file and the rules file disagree about
how to call a helper, **the rules file wins**. If `.agents/globalize-rules.md` or the formatters module
it points at is missing (`generate_format_helpers` or `generate_coding_rules` failed earlier in Phase 2),
skip this pass's formatting concern for the affected files, record why, and do not guess an import path
or specifier.

## What this pass is for

Wrapping a string makes it **translatable**. It does not make a number, a price, a percentage or a date
**render correctly** in another locale. `$1,234.50` stays `$1,234.50` in German — where the reader
expects `1.234,50 $` — no matter how well the surrounding sentence is translated. A catalog full of
perfect translations wrapped around hand-rolled `toFixed(2)` output is still a half-localized app.

This pass finds the places where the project formats a value by hand and routes them through the
project's formatters module instead. That module was created in Phase 2 (`generate_format_helpers`),
so it already exists by the time you read this — you are rewriting call sites, not authoring a module.

The surface is fixed and identical on every stack: **`money`, `number`, `percent`, `compact`, `unit`,
`date`, `time`, `dateTime`, `relativeTime`, `list`**. If a value needs a shape none of the ten produce,
add a preset to the module — never inline an options object at the call site, and never construct
`Intl` there.

## The rewrite table

Helper names below are written bare (`money(price)`). Prefix them with whatever access form the rules
file states — `f.money(price)` after `const f = useFormatters()`, an awaited `getFormatters()` in
`async` server code, or a direct import where the module exports functions individually.

| Found | Replace with |
|---|---|
| `'$' + price`, `` `$${price}` ``, `"$" + amount`, `price + ' USD'` | `money(price)` |
| `price.toFixed(2)` in user-visible copy | `money(price)` when it is a price; `number(value, { maximumFractionDigits: 2 })` otherwise |
| `value.toLocaleString()` / `.toLocaleDateString()` / `.toLocaleTimeString()` with **no** explicit locale | the matching helper — `number` / `date` / `time` |
| `new Intl.NumberFormat(...)` / `new Intl.DateTimeFormat(...)` / `new Intl.RelativeTimeFormat(...)` / `new Intl.ListFormat(...)` at a call site | the matching helper |
| `(a / b * 100).toFixed(0) + '%'` | `percent(a / b)` — the helper takes a **ratio**, not an already-multiplied percentage. Passing `42` renders `4,200%`. |
| `dayjs(d).format('MM/DD/YYYY')`, `format(d, 'MM/dd/yyyy')` (date-fns), `moment(d).format(...)` | `date(d)` — or `dateTime(d)` / `time(d)` when the pattern carried a time component |
| `items.join(', ')` in user-visible copy | `list(items)` (`list(items, 'or')` when the sentence reads as a disjunction) |
| a hand-built `"3 days ago"` / `"in 2 hours"` (a `Math.floor(delta / 86400000)` ladder, a `timeAgo()` helper) | `relativeTime(d)` |
| `(n / 1000).toFixed(1) + 'K'` | `compact(n)` |
| `` `${km} km` ``, `` `${mb} MB` `` in user-visible copy | `unit(km, 'kilometer')` / `unit(mb, 'megabyte')` |

**Rewrite the helper, not its call sites.** A project that already has its own `formatPrice(amount)`
used in thirty places should have *that function* rewritten to delegate to `money()`. Rewriting thirty
call sites instead produces a larger diff, a dead helper, and a merge conflict for anyone else on the
branch. Only inline the helper away when it has one or two callers.

## What NOT to convert

Locale formatting in machine-readable output is a **bug**, not a fix. Leave every one of these alone:

- log lines, `console.*`, telemetry and analytics payloads
- IDs, slugs, SKUs, filenames, cache keys, sort keys, `data-*` attributes
- CSV / JSON / XML payloads, API request and response bodies, query strings
- anything compared against a literal, or parsed back later
- test fixtures and snapshot expectations
- **any date going into an ISO-8601 field** — `toISOString()` is correct and must stay
- `<input type="number">` / `type="date"` values, and any string a form control round-trips
- the **formatters module itself**, and anything else the rules file names as the module's own file — it constructs `Intl` on purpose, and "fixing" it deletes the feature

A grouped thousands separator inside a JSON body silently breaks the consumer, and a localized date in
a database column is unrecoverable. **When in doubt about whether a value is user-visible, leave it and
record it** under the file's entry in your progress file — a flagged non-conversion costs a review
comment; a wrong conversion costs a production bug.

## Ordering: formatting comes after string wrapping, in the same file

Do the string wrapping for a file **first**, then the format pass over that same file. A formatted value
almost always ends up as a **placeholder inside a wrapped message** (`Total: {total}`, not
`Total: ` + a separate node), so the placeholder-naming rule in `.agents/globalize-rules.md` applies to
it. Converting formatting first means naming the placeholder twice.

Two consequences worth stating outright:

- **Format the value, then interpolate the result** — never interpolate a raw number and hope the
  catalog formats it. The catalog cannot; only ICU `number`/`date` skeletons can, and those are not the
  path this project took.
- **Never split a sentence to isolate a number.** `Total: {amount}` is one message. Breaking it into
  `Total: ` + `<span>{money(x)}</span>` produces a fragment no translator can reorder, and word order
  around a number is exactly what changes between languages.

## The dependency this pass does not remove

`dayjs`, `date-fns` and `moment` do three separable jobs: **parsing**, **arithmetic / timezone math**,
and **display formatting**. This pass converts the third only.

- Convert `dayjs(d).format('…')`, `format(d, '…')`, `moment(d).format('…')` and their `fromNow()` /
  `formatDistanceToNow()` equivalents → `date()` / `dateTime()` / `relativeTime()`.
- **Leave** `dayjs(input)` used to parse, `.add()` / `.diff()` / `.startOf()`, `parseISO()`,
  `differenceInDays()`, and every timezone conversion. `Intl` does not replace those.
- **Do not remove the package** and do not touch `package.json`. A partially-converted project still
  imports it, and dropping a dependency is not a conversion decision.
- Record what you left behind — file, line, and which of the three jobs it does — so the summary can
  tell the user the library is still in use and why.

## Progress reporting

Same atomic-write protocol as the wrap pass: write `.globalize/progress/wrap-N.json.tmp`, then `mv` it
over `.globalize/progress/wrap-N.json`. Under each file's entry record:

- `formatSitesConverted` — how many call sites you rewrote, and to which helper
- `formatSitesFlagged` — sites you deliberately left, each with a one-line reason (machine-readable
  output, ambiguous user-visibility, non-formatting date-library use)

A file that was in scope for `formatting` but needed no changes still gets an entry with zero
conversions — "scanned and clean" and "never opened" must not look the same in the progress file.
