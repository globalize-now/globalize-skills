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
---

# Apple String Catalog Coding Rules

Apply these rules as you write Swift. Localization uses a single multi-locale **Apple String Catalog** (`.xcstrings`) per string *table* and the modern Foundation / SwiftUI localization APIs (`Text(...)`, `String(localized:)`, `LocalizedStringKey`). Xcode extracts strings from source at build time and keeps the catalog in sync — source is the source of truth. Every user-visible string must be authored so the compiler can extract it. These rules apply identically across SwiftUI, UIKit, and Swift Package (SPM) targets — the catalog mechanics are the same; only setup differs.

---

## SwiftUI — prefer auto-localizing literals; a String variable does NOT localize

A SwiftUI `Text` initialized with a **string literal** auto-localizes it — the literal becomes a `LocalizedStringKey` and the compiler extracts it into the catalog:

```swift
// Auto-localizes — extracted into the catalog with key "Book this room"
Text("Book this room")
```

A `String` **variable** passed to `Text` does **not** localize — that overload takes a plain `String` and renders it verbatim:

```swift
// Wrong — `title` is a String variable; this is NOT localized and NOT extracted
Text(title)
```

When the value is held in a variable but must still localize, wrap it explicitly:

```swift
// Treat the variable's value as a localization key
Text(LocalizedStringKey(title))

// Or resolve through Foundation (preferred when not building a View).
// `localized:` takes a String.LocalizationValue — wrap the runtime variable explicitly;
// a bare String does not implicitly convert.
Text(String(localized: String.LocalizationValue(title)))
```

To intentionally keep a literal **out** of localization (proper nouns, code, fixed identifiers shown to users), use `Text(verbatim:)`:

```swift
// Never extracted, never translated — rendered exactly as written
Text(verbatim: "AGPLv3")
```

---

## UIKit / non-View code — `String(localized:)`, not `NSLocalizedString`

Outside SwiftUI `View` bodies (UIKit, view models, formatters, any plain Swift), localize with **`String(localized:)`** — the modern Foundation API. Prefer it over the legacy `NSLocalizedString` macro:

```swift
// Preferred
label.text = String(localized: "Book this room")

// Legacy — avoid in new code
label.text = NSLocalizedString("Book this room", comment: "")
```

Xcode's compiler extraction can only pull a string when the **key is a literal**. It **cannot extract `NSLocalizedString` (or `String(localized:)`) when the key is a variable, `nil`, or empty** — those entries silently never reach the catalog. Always pass a literal key.

---

## Translator comments — always add `comment:`

Pass a `comment:` describing where and how the string is used. It flows into the catalog's `comment` field and is the context the translator sees:

```swift
String(localized: "Book this room",
       comment: "Button label on the room search results page")
```

```swift
// SwiftUI — Text takes the same comment argument
Text("Book this room", comment: "Button label on the room search results page")
```

A comment is cheap to write and the only signal a translator gets about intent, audience, and placement. Add one to every user-visible string.

---

## Keys — literal-as-key is the default; symbolic keys are opt-in

By Apple's default, the **literal source string is the key**:

```swift
Text("Book this room")   // catalog key == "Book this room"
```

**Caveat:** because the English source string *is* the key, editing that English text changes the key — which **orphans every existing translation** under the old key (they become stale; the new key starts untranslated). This is the documented default and is fine when source text is stable.

When source text is expected to churn, you can **opt in** to a stable symbolic key via the `defaultValue` overload — the key is symbolic and the English text lives in `defaultValue`, so editing the English copy does not move the key:

```swift
// Opt-in: stable symbolic key, English source as defaultValue
String(localized: "room.book.button",
       defaultValue: "Book this room",
       comment: "Button label on the room search results page")
```

Default to **literal-as-key** (it reads naturally and matches Apple's editor flow). Reach for symbolic keys deliberately, only where source-text churn would otherwise orphan translations — not as a blanket convention.

---

## Interpolation — C-style format specifiers, positional for reordering

The catalog stores interpolation as **C-style format specifiers**, not named placeholders:

| Specifier | Use for |
|---|---|
| `%@` | object / `String` |
| `%lld` | `Int` / `Int64` (use `%lld`, not `%d`) |
| `%1$@`, `%2$lld` | positional — explicit argument order |

Swift string interpolation is converted to a specifier during extraction, so write it naturally:

```swift
// Extracted as "Hi %@" — `name` becomes %@
Text("Hi \(name)")

// Extracted as "%lld rooms available"
String(localized: "\(count) rooms available")
```

**Use positional specifiers (`%1$@` / `%2$lld`) whenever a string has more than one argument**, because word order changes across languages. Positional specifiers let a translator reorder arguments without touching code — the value at `%1$@` can appear last in the translated string. Never build a sentence by Swift string concatenation (`"Hi " + name + "!"`); concatenation bakes English word order into the code and cannot be translated.

---

## Plurals — catalog `variations.plural`, NOT ICU

This format has **no ICU MessageFormat**. Never hand-write an ICU plural body (`{count, plural, one {…} other {…}}`) in Swift — it will not be parsed. Plurals are authored inside the catalog as **`variations.plural.<category>`** using CLDR categories (`zero`, `one`, `two`, `few`, `many`, `other`) and a `%lld` count specifier. At build time the catalog compiles these variations down to `.stringsdict`.

In **source**, you write one ordinary string with a count specifier; the plural forms live in the catalog:

```swift
// Source — single call; plural forms are authored in the catalog, not here
Text("\(count) rooms")
```

The catalog entry (this is real `xcstringstool` output — author this exact shape):

```json
"%lld rooms": {
  "localizations": {
    "en": {
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

---

## Don't fight the serializer

Xcode owns `.xcstrings` serialization. A catalog it writes has its **keys sorted**, **2-space indentation**, and the top-level `version` key **last** (top-level keys are `sourceLanguage`, `strings`, `version`, with `version` = `"1.0"`). A simple key-as-source entry that only carries a comment is just:

```json
"Book this room": { "comment": "Button label on the room search results page" }
```

— no `extractionState`, no `localizations`. When you must edit the catalog by hand, match Xcode's layout and let it re-serialize on the next build; **do not hand-reorder keys or change indentation** — it produces noisy, conflict-prone diffs that Xcode will simply undo.

---

## What NOT to wrap

Do not localize, give a catalog entry, or wrap with `Text`/`String(localized:)`:

- **`Text(verbatim:)` content** — deliberately opted out (proper nouns, code, fixed brand/version strings). Leave it verbatim.
- **Non-UI strings** — `print`/`os_log`/logging messages, internal error descriptions never shown to a user, `fatalError`/`assert` messages.
- **Identifiers and keys** — dictionary keys, `UserDefaults` keys, `Notification.Name` raw values, `Codable` `CodingKeys`, enum `rawValue` strings, `reuseIdentifier`/cell identifiers.
- **Accessibility identifiers used for UI testing** (`accessibilityIdentifier`) — these are test hooks, not user-facing copy. (Accessibility *labels* spoken to users — `accessibilityLabel` — **are** user-facing and should be localized.)
- **URLs, API paths, and network strings** — endpoints, query keys, header names, scheme/host literals.
- **Configuration and build values** — `Info.plist` raw keys, bundle identifiers, feature-flag names.
- **CSS / styling** — not applicable to native Swift; for any web surface in the project prefer logical properties (`margin-inline-start`, not `margin-left`); see the `css-i18n` skill.
