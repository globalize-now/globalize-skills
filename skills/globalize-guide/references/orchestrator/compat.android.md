# Compatibility hard-stops — native Android

Loaded by SKILL.md §1.2 when `language === "android"`. The React Native and Flutter **signal** stops live in SKILL.md §1.2 itself: they fire on deps/files independent of the detected `language` (the §1.1 rule already routes hybrid and Flutter projects away from `language: "android"`), so they are checked before any language file is read.

| Condition | Action |
|---|---|
| `language === "android"` AND (`@capacitor/core`, `cordova`, or any `@ionic/*` in `package.json`) AND an `android/` folder present | **STOP.** "This looks like a Capacitor/Cordova/Ionic hybrid app — its UI is localized in the web layer, not in native `strings.xml`. Run globalize-guide against the web UI (the JS path)." |
| `language === "android"` AND a Kotlin/Compose **Multiplatform** layout (resources under `commonMain` / a `compose.resources` setup, no `app/src/main/res`) | **Warn (non-blocking).** "This looks like a Kotlin/Compose Multiplatform project, which uses a different resource mechanism (`compose.resources`) than standard Android `res/values/strings.xml`. v1 covers standard Android only — I'll proceed against the Android resource dirs I can find, but multiplatform resources won't be handled." |

**No EOL / version warning for Android** (clean contrast with the JS framework version branches and the Rails soft-EOL note): string resources are stable across all API levels, so there is no version to warn about and no version-gated emission. The only API-gated features — the `b+` qualifier dir form (API 24+) and per-app language (API 33+) — are optional add-ons, never required.
