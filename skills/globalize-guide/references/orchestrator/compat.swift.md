# Compatibility hard-stops — Swift / Apple (iOS)

Loaded by SKILL.md §1.2 when `language === "swift"`.

**Swift / Apple (iOS) compatibility rules** (apply only when `language === "swift"`):

| Condition | Action |
|---|---|
| `language === "swift"` AND a `.xcstrings` cannot be created and none exists (legacy `.strings`-only on a pre-Xcode-15 toolchain with no migration path) | **Note (non-blocking where possible).** Offer the **Edit ▸ Convert to String Catalog** migration; only STOP if there is genuinely no path to a catalog. |
| `language === "swift"` AND a non-iOS Apple target out of v1 scope (macOS/watchOS/tvOS) with no iOS app and no Swift package | **STOP (scope).** "v1 of the iOS String Catalog path targets iOS apps and Swift packages. {platform} is out of scope — the shared catalog mechanics may still apply manually." |
