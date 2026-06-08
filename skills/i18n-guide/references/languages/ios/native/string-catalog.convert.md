# Apple String Catalog Conversion

iOS-specific guidance for the convert phase. Covers native Apple (Swift / SwiftUI / UIKit / SPM) projects that localize with a single multi-locale **Apple String Catalog** (`.xcstrings`). The per-edit authoring rules — `Text` literal auto-localization, `String(localized:)`, `comment:` context, C-style format specifiers, catalog plural authoring, what-not-to-wrap — live in `string-catalog.code.md` (wired automatically via `@import`). Catalog creation and `SWIFT_EMIT_LOC_STRINGS` live in `string-catalog.setup.md`. This file is the **mechanics of finding and converting existing hardcoded strings**.

---

## What "convert" means here — no codemod-then-extract CLI

This variant has **no `lingui extract`-style pipeline** and **no autocorrecting linter** that rewrites raw text into wrapped calls. "Convert" means two things, in order:

1. **Make strings localizable in source** — edit `.swift` (and Interface Builder) so every user-visible string is authored as something the compiler can extract (a `Text` literal, `String(localized:)`, etc.). This is the hand work in Step 2.
2. **Populate the catalog from source** — a normal Xcode build with `SWIFT_EMIT_LOC_STRINGS = YES` (set in setup) extracts every localizable literal into `Localizable.xcstrings`. **Extraction is build-time, not a separate codemod step.** Without an Xcode *build* (no IDE / CI), the `xcrun xcstringstool extract → sync → print` sequence (Step 4) is the headless equivalent — it still requires the Xcode command-line toolchain (`xcstringstool` is toolchain-bundled), so it runs on macOS with the tools installed, not on a non-Apple machine.

**Source is the source of truth.** You do not hand-author catalog entries for ordinary strings — you make the source localizable and let the build write them. You only edit the catalog directly for the things source cannot express: plural variations and translator comments you'd rather author than re-derive (Step 3).

---

## Step 1: Discover hardcoded strings

There is **no canonical Swift hardcoded-string linter** — SwiftLint ships no i18n/hardcoded-string rule, and Apple provides no `genstrings`-style "find unwrapped text" tool. Discovery on iOS is two complementary techniques:

### Manual / grep review

Search for user-visible string literals at the call sites that render text:

```bash
# SwiftUI text-bearing initializers and modifiers
grep -rEn 'Text\(|Label\(|\.navigationTitle\(|\.tabItem|Button\("' --include='*.swift' .

# UIKit / Foundation text setters
grep -rEn '\.text *=|\.title *=|\.placeholder *=|setTitle\(' --include='*.swift' .
```

Review each hit: a **string literal** that is user-visible needs wrapping (Step 2); a `String` **variable** needs explicit wrapping (it does *not* auto-localize — see Step 2 and `string-catalog.code.md`); a non-UI string (log, identifier, URL) is left alone (Do-not-touch).

### The build is the coverage report

With `SWIFT_EMIT_LOC_STRINGS = YES`, **what lands in the catalog after a build is exactly what got localized.** A `Text("…")` literal appears; a `Text(variable)` is silently absent. So the honest iOS analog to "run the linter" is: build, then diff the catalog against the screens you expect — anything user-visible that is *not* in the catalog is a string you missed (or a variable that needs explicit wrapping). The headless `xcstringstool extract → sync → print` sequence (Step 4) produces the same coverage signal without Xcode. Use `print` to list the keys the catalog now holds and spot the gaps.

---

## Step 2: Wrap strings by location

Wrapping is location-aware: SwiftUI literals often need *nothing*, variables always need explicit wrapping, and UIKit/Foundation use `String(localized:)`. Add a `comment:` to every wrapped string for translator context — it flows into the catalog `comment` field.

### SwiftUI views — literals auto-localize; variables do not

A `Text` initialized with a **string literal** auto-localizes — the literal becomes a `LocalizedStringKey` and the compiler extracts it. Often there is **nothing to change**:

```swift
// Already localizable — extracted into the catalog with key "Book this room"
Text("Book this room")

// Add a comment for translator context (flows to the catalog `comment`)
Text("Book this room", comment: "Button label on the room search results page")
```

A `String` **variable** passed to `Text` does **NOT** localize — that overload takes a plain `String` and renders it verbatim. A bare `String` also does **not** implicitly convert to `String.LocalizationValue`; you must wrap it explicitly:

```swift
// Wrong — `title` is a String variable; NOT localized, NOT extracted
Text(title)

// Right — treat the variable's value as a localization key
Text(LocalizedStringKey(title))

// Or resolve through Foundation (wrap the runtime variable explicitly)
Text(String(localized: String.LocalizationValue(title)))
```

To keep a literal **out** of localization (proper nouns, code, fixed identifiers shown to users), use `Text(verbatim:)` — never extracted, never translated:

```swift
Text(verbatim: "AGPLv3")
```

### UIKit / Foundation — `String(localized:)`

Outside SwiftUI `View` bodies (UIKit controllers, view models, formatters, any plain Swift), localize with **`String(localized:)`** — the modern Foundation API, preferred over the legacy `NSLocalizedString(_:comment:)` macro:

```swift
// Preferred — with a translator comment
label.text = String(localized: "Book this room",
                    comment: "Button label on the room search results page")

// Legacy — still extracted, but avoid in new code
label.text = NSLocalizedString("Book this room", comment: "")
```

**Interface Builder** strings (storyboards / `.xib`) localize through a **String Catalog**, not a separate legacy format — base-internationalize the IB file, then add a String Catalog for it. IB strings extract into **their own table named after the IB file** (e.g. `Main.xcstrings` for `Main.storyboard`), analogous to `InfoPlist.xcstrings` — not into the default `Localizable.xcstrings`. When connecting in Phase 4, point Globalize at all the catalog tables you want translated (`**/*.xcstrings` covers multiple tables).

The compiler can only extract a string when the **key is a literal**. It **cannot extract `String(localized:)` / `NSLocalizedString` when the key is a variable, `nil`, or empty** — those entries silently never reach the catalog. Always pass a literal key (or wrap the variable as shown above).

### SPM targets — bundle-scoped

In a Swift package, localized lookups must resolve against the package's own bundle (`bundle: .module`), not the main app bundle. See `string-catalog.setup.md` Step 6:

```swift
Text("Book this room", bundle: .module)
String(localized: "Book this room", bundle: .module)
```

### Keys — literal-as-key is the default; symbolic is opt-in

By Apple's default the **literal source string is the key**:

```swift
Text("Book this room")   // catalog key == "Book this room"
```

**Caveat:** because the English source string *is* the key, editing that English text changes the key — which **orphans every existing translation** under the old key (they go stale; the new key starts untranslated). Fine when source text is stable.

When source text is expected to churn, **opt in** to a stable symbolic key via the `defaultValue` overload — the key is symbolic, the English text lives in `defaultValue`, so editing the copy does not move the key:

```swift
String(localized: "room.book.button",
       defaultValue: "Book this room",
       comment: "Button label on the room search results page")
```

Default to literal-as-key (it matches Apple's editor flow); reach for symbolic keys deliberately, only where churn would otherwise orphan translations.

---

## Step 3: Interpolation and plurals

The full per-edit rules are in `string-catalog.code.md`. Apply them during wrapping — do not re-derive them per string. The convert-phase essentials:

### Interpolation — C-style format specifiers

The catalog stores interpolation as **C-style format specifiers**, not named placeholders. Swift string interpolation is **converted to a specifier during extraction**, so write it naturally:

| Specifier | Use for |
|---|---|
| `%@` | object / `String` |
| `%lld` | `Int` / `Int64` (use `%lld`, not `%d`) |
| `%1$@`, `%2$lld` | positional — explicit argument order |

```swift
Text("Hi \(name)")                       // extracted as "Hi %@"
String(localized: "\(count) rooms left") // extracted as "%lld rooms left"
```

**Use positional specifiers (`%1$@` / `%2$lld`) whenever a string has more than one argument** — word order changes across languages and positional specifiers let translators reorder without touching code. Never build a sentence by Swift string concatenation (`"Hi " + name`); concatenation bakes English word order into the code.

### Plurals — catalog `variations.plural`, NOT ICU

This format has **no ICU MessageFormat**. Never hand-write an ICU plural body (`{count, plural, one {…} other {…}}`) in Swift — it will not be parsed. Plurals are authored **inside the catalog** as `variations.plural.<category>` using CLDR categories (`zero`, `one`, `two`, `few`, `many`, `other`) and a `%lld` count specifier. In **source** you write one ordinary count-bearing string:

```swift
Text("\(count) rooms")   // single call; plural forms live in the catalog, not here
```

The catalog entry — author this exact shape (verified `xcstringstool` output):

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

Always include `other` — the required fallback every language uses, and the only category English uses alongside `one`. **A target locale may carry *more* CLDR categories than the source** — e.g. a Russian (`ru`) target adds `few`/`many` (and may use `one/few/many/other`) where the English source only has `one/other`. Translators supply the extra categories per locale; the system applies the correct CLDR rule at runtime. Do not pick between two strings with a Swift `if count == 1` — it breaks every language with more than two plural forms.

### Key-as-source norm

When the key **is** the source string, there is **no explicit source `value`** — the entry carries no `extractionState` and no `localizations`, just an optional `comment`:

```json
"Book this room": { "comment": "Button label on the room search results page" }
```

This is the common shape for a simple extracted literal whose English text is the key. (`extractionState: extracted_with_value` appears only for a key/value overload where the key and the source string differ; fresh extracted entries get `stringUnit.state: new`.)

---

## Step 4: Populate and verify the catalog

### Preferred — a normal Xcode build

With `SWIFT_EMIT_LOC_STRINGS = YES` (set in `string-catalog.setup.md` Step 4), **a normal build populates and updates `Localizable.xcstrings` automatically** — every localizable literal is extracted, removed strings are marked stale (not deleted), and renamed keys orphan the old entry. There is no separate extract command. Open the catalog in Xcode (or `xcrun xcstringstool print`) to confirm the expected keys landed.

### Headless / no-Xcode — the three-step `xcstringstool` sequence

When Xcode is not available (e.g. a non-macOS context can't run this at all — it needs the Xcode toolchain), the catalog can be populated and inspected with `xcstringstool`. **This is three separate commands, not a pipe** (VERIFIED on Xcode 26.4.1):

```bash
DIR=$(mktemp -d)
xcrun xcstringstool extract <sources.swift> --SwiftUI --modern-localizable-strings [--legacy-localizable-strings] --output-directory "$DIR"
xcrun xcstringstool sync <catalog>.xcstrings --stringsdata "$DIR"/*.stringsdata
xcrun xcstringstool print <catalog>.xcstrings
```

- `extract` parses the Swift sources and writes `.stringsdata` files into `--output-directory`. This is **lightweight parsing (no type checking)** — the compiler build remains authoritative; use this for a headless coverage check, not as a replacement for the build.
- `sync` merges those `.stringsdata` into the catalog. Add `--skip-marking-strings-stale` if you do **not** want keys absent from the sources marked stale.
- `print` lists the catalog's keys — the headless coverage report (see Step 1).

**Flag notes** (verified via `--help`; confirm with `xcrun xcstringstool extract --help` if your Xcode differs — floor: Xcode 15):

- `--modern-localizable-strings` covers `String(localized:)` / `AttributedString(localized:)` / `LocalizedStringResource` **only**.
- SwiftUI `Text("…")` literals need **`--SwiftUI`** (or `--SwiftUI-Text`) — **do NOT mix the two**; the help warns against using both.
- Add `--legacy-localizable-strings` to also ingest `NSLocalizedString` call sites.

---

## Do-not-touch

Do not localize, give a catalog entry, or wrap:

- **`Text(verbatim:)` content** — deliberately opted out (proper nouns, code, fixed brand/version strings). Leave it verbatim.
- **Non-UI strings** — `print` / `os_log` / logging messages, internal error descriptions never shown to a user, `fatalError` / `assert` messages.
- **Identifiers and keys** — dictionary keys, `UserDefaults` keys, `Notification.Name` raw values, `Codable` `CodingKeys`, enum `rawValue` strings, reuse/cell identifiers, `accessibilityIdentifier` test hooks. (Accessibility *labels* spoken to users — `accessibilityLabel` — **are** user-facing; localize those.)
- **URLs, API paths, network strings** — endpoints, query keys, header names, scheme/host literals.
- **`Package.swift` and `Info.plist` keys themselves** — bundle identifiers, feature-flag names, the plist *keys*. Note: `Info.plist` *values* (app display name, usage descriptions) localize via a separate **`InfoPlist.xcstrings`** table, which is **out of v1 default scope** — flag it, don't wrap it here.

The full skip-list lives in `string-catalog.code.md` → "What NOT to wrap".

---

## Step 5: Run steps — exact commands

Build to populate the catalog (preferred). When Xcode is unavailable, run the headless three-step sequence:

```bash
# 1. Discover hardcoded literals (review each hit; wrap per Step 2)
grep -rEn 'Text\(|Label\(|\.navigationTitle\(|Button\("|\.text *=|\.title *=|setTitle\(' --include='*.swift' .

# 2. After wrapping — populate the catalog from source.
#    Preferred: a normal Xcode build with SWIFT_EMIT_LOC_STRINGS = YES.
#    Headless equivalent (three separate commands, not a pipe):
DIR=$(mktemp -d)
xcrun xcstringstool extract <sources.swift> --SwiftUI --modern-localizable-strings [--legacy-localizable-strings] --output-directory "$DIR"
xcrun xcstringstool sync <catalog>.xcstrings --stringsdata "$DIR"/*.stringsdata

# 3. Verify — list the catalog's keys (coverage report); confirm expected strings landed
xcrun xcstringstool print <catalog>.xcstrings
```

---

## After conversion

With the catalog populated and the expected keys present:

1. Build and run the app in the source locale — spot-check converted screens render correctly.
2. Author plural `variations.plural` and any translator `comment`s the build can't infer (Step 3); rebuild and re-`print` to confirm.
3. Proceed to the connect phase — point Globalize at the catalog with `fileFormat: xcstrings`, a **single-file pattern** (the `.xcstrings` is one multi-locale file, so **no `{locale}` segment** — `Localizable.xcstrings`, or `**/*.xcstrings` for multiple tables), and the source language as the catalog's `sourceLanguage`. See `string-catalog.setup.md` → "Connect a translation service".
