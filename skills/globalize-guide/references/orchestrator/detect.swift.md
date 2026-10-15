# Detection rules — Swift / Apple (iOS)

Read by the inspect worker (`inspect.md`) when `language === "swift"`. The JS / TS, Ruby and Android tables do not apply.

**Swift / Apple (iOS) detection rules** (apply only when `language === "swift"`):

| Field | How to detect |
|---|---|
| `language` | `*.xcodeproj`/`*.xcworkspace`, `Package.swift`, or `*.swift` present → `swift`. (Only reached when there is no Gemfile-rails, no root `package.json`, and no native-Android Gradle signals — a root `package.json` routes React Native / Capacitor / Flutter to `js-ts` first.) |
| `framework` / `router` / `compiler` / `react` / `vue` / `svelte` / `typescript` | Not meaningful for native Apple — set `framework: "unknown"`, `router: "none"`, and leave `compiler`/`react`/`vue`/`svelte` as `null`/`false`. No iOS manifest variant keys on any of them (iOS variants key on `language`/`buildSystem`/`platform`/`uiFramework`). |
| `buildSystem` | `Package.swift` present and NO `.xcodeproj`/`.xcworkspace` → `spm`. `.xcodeproj`/`.xcworkspace` present → `xcode`. |
| `uiFramework` | The `@main` entry point decides: a file with `import SwiftUI` + a `struct …: App` + `@main` → `swiftui` (even if it also uses a `UIApplicationDelegateAdaptor`). `@UIApplicationMain`/AppDelegate/SceneDelegate (a type conforming to `UIApplicationDelegate`/`UIResponder`) and/or `.storyboard`/`.xib` files with no SwiftUI `App` → `uikit`. Genuine ambiguity → default `swiftui`. An SPM library with no app entry point → `null`. NEVER emit `"mixed"` (it is unroutable). |
| `platform` | iOS deployment target / `IPHONEOS_DEPLOYMENT_TARGET` / iOS SDK → `ios` (the default for an app target). SPM library → `null`. |
| `packageManager` | `null` (Swift has no npm-style package manager; SPM is the build system and is recorded under `buildSystem`). |
| `existing.library` | A `.xcstrings` present anywhere → `string-catalog`; else `none`. |
| `existing.configured` | A `.xcstrings` present. |
| `existing.catalogsScaffolded` | A `.xcstrings` present (same signal). |
| `existing.stringsWrapped` | Sample `*.swift` files: > 80% of user-visible literals using `String(localized:` / `Text("…")` literals vs. bare user-visible `String` literals → "yes", > 20% → "partial", else → "no". |
| `candidateFiles` | Glob `**/*.swift` (exclude tests and `Package.swift`), grep each for user-visible string literals not already in `String(localized:` / `Text(` / `NSLocalizedString(`. Return files with ≥1 match, sorted by match count desc. |
| `formatCandidateFiles` | Glob `**/*.swift`, excluding test targets and `Package.swift`; grep `String(format: "%.`, `dateFormat =`, `DateFormatter(`, `NumberFormatter(`, `RelativeDateTimeFormatter(`, `$\(` (a literal `$` immediately before a Swift interpolation — match it **without** a leading `"`, since the overwhelmingly common form is mid-string, `"Total: $\(amount)"`, where the quote is nowhere near the `$`), and `joined(separator: ", ")`. **Then one read-and-judge step, which is deliberately not a pure grep:** list the lines where a `Text(` or `String(localized:` argument contains a `\(` interpolation, open each, and keep only those whose interpolated symbol is declared numeric (`Int`, `Double`, `Decimal`) or `Date` — `\(userName)` is a `String` and not a formatting site, so a bare `\(` grep would flag most of the UI. Report the judged set, not the raw grep hits. **Exclude the generated `Formatters.swift`** (the file `.globalize/format-module.json` → `path` names once it exists; before Phase 2 it does not, so exclude any file named `Formatters.swift`). Return files with ≥1 match, sorted by match count desc. |
| `localeSignals` | `.lproj` dirs; Info.plist `CFBundleLocalizations` / `CFBundleDevelopmentRegion`; existing `.strings`/`.stringsdict`/`.xcstrings` files; README language mentions. |
