---
name: ios-string-catalog-code
user_invocable: false
description: >-
  Apply automatically whenever writing or modifying UI code in a native Apple
  (Swift / SwiftUI / UIKit) project that localizes with an Apple String Catalog
  (`.xcstrings`) — new views, screens, controllers, or any change that adds or
  edits user-visible text. Not user-invocable. Ensures literals auto-localize,
  format specifiers and plurals are authored correctly, translator comments are
  attached, and non-UI strings are left alone as code is written.
template: string-catalog
templateVersion: 3
conditions: [uiFramework, bundleScope]
values: [catalogPath, sourceLocale, targetLocales, formatModule]
budget: { "uiFramework == \"swiftui\"": 215, "default": 180 }
---

# Apple String Catalog Coding Rules

Apply these rules as you write Swift. Localization uses a single multi-locale **Apple String Catalog** (`.xcstrings`) per string *table*, plus the modern Foundation localization APIs. Xcode extracts strings from source at build time and keeps the catalog in sync — source is the source of truth, so every user-visible string must be authored in a form the compiler can extract. Catalog mechanics — keys, translator comments, format specifiers, plural variations — are the same on every Apple target; the authoring API is not, so the sections below are the ones that apply to this project.

**This project:**
- Catalog: `<<catalogPath>>` — a single multi-locale file; every locale for this table lives inside it. There is no per-locale catalog and no locale segment in the path.
- Source locale: `<<sourceLocale>>` — write every source string in this locale.
- Target locales: `<<targetLocales>>`.

<!-- if: uiFramework == "swiftui" -->
## SwiftUI — literals auto-localize; a `String` variable does NOT

A `Text` initialized with a **string literal** auto-localizes it — the literal becomes a `LocalizedStringKey` and the compiler extracts it into the catalog. A `String` **variable** passed to `Text` does **not** localize: that overload takes a plain `String` and renders it verbatim, and nothing is extracted.

```swift
Text("Book this room")   // ✅ auto-localizes — extracted with key "Book this room"
Text(title)              // ❌ `title` is a String variable — NOT localized, NOT extracted
```

When the value is held in a variable but must still localize, wrap it explicitly:

```swift
// Treat the variable's value as a localization key
Text(LocalizedStringKey(title))

// Or resolve through Foundation (preferred when not building a View). `localized:`
// takes a String.LocalizationValue — a bare String does not implicitly convert, so
// wrap the runtime variable explicitly.
Text(String(localized: String.LocalizationValue(title)))
```

To intentionally keep a literal **out** of localization (proper nouns, code, fixed identifiers shown to users), use `Text(verbatim: "AGPLv3")` — never extracted, never translated, rendered exactly as written.

<!-- /if -->
## Plain Swift — `String(localized:)`, not `NSLocalizedString`

In view controllers, view models, formatters, and any other plain Swift, localize with **`String(localized:)`** — the modern Foundation API. Prefer it over the legacy `NSLocalizedString` macro:

```swift
// Preferred
label.text = String(localized: "Book this room")

// Legacy — avoid in new code
label.text = NSLocalizedString("Book this room", comment: "")
```

Xcode's compiler extraction can only pull a string when the **key is a literal**. It **cannot extract `NSLocalizedString` (or `String(localized:)`) when the key is a variable, `nil`, or empty** — those entries silently never reach the catalog. Always pass a literal key.

<!-- if: bundleScope == "spm-swiftui" -->
## Swift package — every localized lookup needs `bundle: .module`

This code ships in a Swift package. A lookup with **no `bundle:` argument resolves against the main app bundle, not the package's**, so the string renders as its raw key at runtime and is never translated. Pass `bundle: .module` on every localized string here — SwiftUI and Foundation alike:

```swift
Text("Book this room", bundle: .module)
String(localized: "Book this room", bundle: .module,
       comment: "Button label on the room search results page")
```

`Bundle.module` is generated only because the target declares `resources:` in `Package.swift`. A new target that ships strings must declare its own resources before `.module` exists.

<!-- /if -->
<!-- if: bundleScope == "spm-uikit" -->
## Swift package — every localized lookup needs `bundle: .module`

This code ships in a Swift package. A lookup with **no `bundle:` argument resolves against the main app bundle, not the package's**, so the string renders as its raw key at runtime and is never translated. Pass `bundle: .module` on every localized string here:

```swift
String(localized: "Book this room", bundle: .module,
       comment: "Button label on the room search results page")
```

`Bundle.module` is generated only because the target declares `resources:` in `Package.swift`. A new target that ships strings must declare its own resources before `.module` exists.

<!-- /if -->
## Translator comments — always add `comment:`

Pass a `comment:` describing where and how the string is used. It flows into the catalog's `comment` field and is the context the translator sees:

```swift
String(localized: "Book this room",
       comment: "Button label on the room search results page")
```

<!-- if: uiFramework == "swiftui" -->
```swift
// SwiftUI — Text takes the same comment argument
Text("Book this room", comment: "Button label on the room search results page")
```

<!-- /if -->
A comment is cheap to write and the only signal a translator gets about intent, audience, and placement. Add one to every user-visible string.

## Keys — literal-as-key is the default; symbolic keys are opt-in

By Apple's default, the **literal source string is the key**:

```swift
String(localized: "Book this room")   // catalog key == "Book this room"
```

**Caveat:** because the source string *is* the key, editing that text changes the key — which **orphans every existing translation** under the old key (they become stale; the new key starts untranslated). This is the documented default and is fine when source text is stable.

When source text is expected to churn, you can **opt in** to a stable symbolic key via the `defaultValue` overload — the key is symbolic and the source text lives in `defaultValue`, so editing the copy does not move the key:

```swift
// Opt-in: stable symbolic key, source text as defaultValue
String(localized: "room.book.button",
       defaultValue: "Book this room",
       comment: "Button label on the room search results page")
```

Default to **literal-as-key** (it reads naturally and matches Apple's editor flow). Reach for symbolic keys deliberately, only where source-text churn would otherwise orphan translations — not as a blanket convention.

## Interpolation — C-style format specifiers, positional for reordering

The catalog stores interpolation as **C-style format specifiers**, not named placeholders:

| Specifier | Use for |
|---|---|
| `%@` | object / `String` |
| `%lld` | `Int` / `Int64` (use `%lld`, not `%d`) |
| `%1$@`, `%2$lld` | positional — explicit argument order |

Swift string interpolation is converted to a specifier during extraction, so write it naturally:

```swift
String(localized: "Hi \(name)")                 // extracted as "Hi %@"
String(localized: "\(count) rooms available")   // extracted as "%lld rooms available"
```

**Use positional specifiers (`%1$@` / `%2$lld`) whenever a string has more than one argument**, because word order changes across languages. Positional specifiers let a translator reorder arguments without touching code — the value at `%1$@` can appear last in the translated string. Never build a sentence by Swift string concatenation (`"Hi " + name + "!"`); concatenation bakes source word order into the code and cannot be translated.

## Plurals — catalog `variations.plural`, NOT ICU

This format has **no ICU MessageFormat**. Never hand-write an ICU plural body (`{count, plural, one {…} other {…}}`) in Swift — it will not be parsed. Plurals are authored inside the catalog as **`variations.plural.<category>`** using CLDR categories (`zero`, `one`, `two`, `few`, `many`, `other`) and a `%lld` count specifier. At build time the catalog compiles these variations down to `.stringsdict`.

In **source**, you write one ordinary string with a count specifier; the plural forms live in the catalog:

```swift
// Source — single call; plural forms are authored in the catalog, not here
String(localized: "\(count) rooms")
```

The catalog entry (this is real `xcstringstool` output — author this exact shape):

```json
"%lld rooms": {
  "localizations": {
    "<<sourceLocale>>": {
      "variations": {
        "plural": {
          "one":   { "stringUnit": { "state": "translated", "value": "%lld room available" } },
          "other": { "stringUnit": { "state": "translated", "value": "%lld rooms available" } }
        }
      }
    }
  }
}
```

Always include `other` — it is the required fallback every language uses, and the only category English uses alongside `one`. Other languages may need additional categories (`few`/`many` for Russian/Polish, etc.); a translator supplies them per locale. Do not pick between two translated strings with a Swift `if count == 1` conditional — that breaks every language with more than two plural forms.

## Numbers, currencies, dates — format, never interpolate raw

A raw `\(value)` renders `1234.5` and `2026-03-04 15:30:00 +0000` in every language. Never construct `NumberFormatter`, `DateFormatter`, or a bare `FormatStyle` at a call site — route every formatted value through `<<formatModule>>`, this project's one formatting surface, so separators, currency placement, and date field order follow the reader's locale and every call agrees on which locale that is:

```swift
amount.formatted(.money)                                 // '$1,234.50' — this project's default currency
amount.formatted(.money(order.currency))                  // when the data carries its own currency
rating.formatted(.plainNumber)                             // '4.5' — Double only; see note below for Int/Decimal
ratio.formatted(.percentage)                               // '42%' — a ratio (0.42), not a whole percentage
value.formatted(.compactNumber)                            // '12K'
<<formatModule>>.measurement(5.2, UnitLength.kilometers)   // '5.2 km' — unit is a typed Dimension, not a string
date.formatted(.mediumDate)                                // 'August 21, 2026' — the default date preset
date.formatted(.shortDate)                                 // 'Aug 21, 2026' — abbreviated month form
date.formatted(.timeOnly)                                  // '4:05 PM'
date.formatted(.dateAndTime)                               // 'Aug 21, 2026, 4:05 PM'
<<formatModule>>.relativeTime(date)                         // '3 days ago' / 'yesterday'
<<formatModule>>.list(["Alice", "Bob", "Carol"])            // 'Alice, Bob, and Carol'
```

**The currency code is a property of the price, not of the reader.** Pass the currency your data actually carries — `amount.formatted(.money(order.currency))`; never derive it from `Locale.current`, which would relabel a dollar price as euros for a German reader. Omitting the argument formats `<<formatModule>>`'s own project default, never the reader's locale. The locale decides *formatting*; your data decides *which currency*.

**`money` amounts stored as `Decimal` or `Int` both have their own `.money`** — `<<formatModule>>` declares three parallel extensions, one per numeric family, because `Decimal` does not conform to `BinaryFloatingPoint` and so does not satisfy the `Double` one. Use whichever matches how your data is actually typed; never convert a `Decimal` price to `Double` to satisfy a formatter — that reintroduces the binary floating-point rounding error `Decimal` exists to avoid. **`plainNumber`/`percentage`/`compactNumber` stay `Double`-only** — there is no `Decimal`/`Int` overload for these three; format an `Int` or `Decimal` value with Foundation's own un-wrapped `.formatted(.number)` / `.formatted(.percent)` instead.

Interpolating an already-formatted value into a localized string is correct — it extracts as `%@`:

```swift
String(localized: "Total: \(amount.formatted(.money))")
```

**Never hardcode a date format string.** `DateFormatter().dateFormat = "MM/dd/yyyy"` forces American field order on every locale. If this project's deployment target is below iOS 15, `<<formatModule>>` additionally exposes `…Compat` siblings (`moneyCompat`, `mediumDateCompat`, …) backed by a **cached** `NumberFormatter` / `DateFormatter` — check the header comment at the top of the generated file for which functions have one before assuming the bare style name above compiles unconditionally on this project; constructing `DateFormatter` / `NumberFormatter` per call instead of caching them is a well-known performance trap either way.

**This module's formatting locale is `Formatters.formatLocale`, not the ambient SwiftUI environment.** Every style above chains `.locale(Formatters.formatLocale)` explicitly, so a `.environment(\.locale, …)` override (SwiftUI Previews, an in-app switcher) has **no effect** on anything routed through `<<formatModule>>` — the style already carries its own explicit locale. To preview or switch locales for values formatted through this module, set `Formatters.formatLocale` itself; `.environment(\.locale, …)` alone will not touch it.
<!-- if: uiFramework == "swiftui" -->

Prefer the `format:` initializer over formatting into a `String`: `Text(amount, format: .money)` re-reads `Formatters.formatLocale` every time this view's body runs, so it never goes stale the way a `String` captured once via `.formatted()` and stored does. Same styles as above: `Text(amount, format: .money(order.currency))`, `Text(date, format: .mediumDate)`.
<!-- /if -->

**Needs a format `<<formatModule>>` has no preset for?** Add it to the module. A date style or currency default written out at two call sites will drift.

**Flag for review:** `String(format: "%.2f", price)`, `"$\(amount)"`, `dateFormat = "…"`, and any raw number or `Date` interpolated straight into user-visible copy.

## Don't fight the serializer

Xcode owns `.xcstrings` serialization. A catalog it writes has its **keys sorted**, **2-space indentation**, and the top-level `version` key **last** (top-level keys are `sourceLanguage`, `strings`, `version`, with `version` = `"1.0"`). A key-as-source entry that only carries a comment is just `"Book this room": { "comment": "Button label on the room search results page" }` — no `extractionState`, no `localizations`. Authoring a plural means hand-editing the catalog, so this applies routinely: match Xcode's layout and let it re-serialize on the next build; **do not hand-reorder keys or change indentation** — it produces noisy, conflict-prone diffs that Xcode will simply undo.

## What NOT to wrap

Do not localize, give a catalog entry, or wrap with `String(localized:)`:

<!-- if: uiFramework == "swiftui" -->
- **`Text(verbatim:)` content** — deliberately opted out (proper nouns, code, fixed brand/version strings). Leave it verbatim.
<!-- /if -->
- **Non-UI strings** — `print`/`os_log`/logging messages, internal error descriptions never shown to a user, `fatalError`/`assert` messages.
- **Identifiers and keys** — dictionary keys, `UserDefaults` keys, `Notification.Name` raw values, `Codable` `CodingKeys`, enum `rawValue` strings, `reuseIdentifier`/cell identifiers.
- **Accessibility identifiers used for UI testing** (`accessibilityIdentifier`) — these are test hooks, not user-facing copy. (Accessibility *labels* spoken to users — `accessibilityLabel` — **are** user-facing and should be localized.)
- **URLs, API paths, and network strings** — endpoints, query keys, header names, scheme/host literals.
- **Configuration and build values** — `Info.plist` raw keys, bundle identifiers, feature-flag names.
- **CSS / styling** — not applicable to native Swift; for any web surface in the project prefer logical properties (`margin-inline-start`, not `margin-left`); see the `css-i18n` skill.
