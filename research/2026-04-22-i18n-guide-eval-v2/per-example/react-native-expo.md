## react-native-expo

### Detection
- Framework: Expo (React Native) with `expo-router`; also pulls in `react-native-web` for web target
- Router: `expo-router` (file-based, `app/` directory)
- Package manager: npm (`package-lock.json` present)
- Existing i18n lib: none

### i18n-guide
- Recommended: N/A — hard stop triggered
- STOP reason (if any): React Native / Expo detected (`expo`, `react-native` in deps). Per Step 2, rule 3: "This guide doesn't cover React Native / Expo. The LinguiJS setup expects a web build pipeline (Vite / Next.js / CRA) and would fail. For React Native, set up manually with `expo-localization` (for device locale) plus either `i18n-js` or `react-i18next` as the message runtime. vue-i18n / next-intl do not apply here."

### Setup skill
- Skill: N/A
- Outcome: N/A
- Files changed: N/A
- Deps added: N/A
- Blockers: N/A — guide stopped before routing

### Convert skill
- Skill: N/A
- Outcome: N/A
- Strings wrapped (count): N/A
- Strings skipped/failed: N/A
- Blockers: N/A

### Deviations from SKILL.md
- None. The detection signals matched the documented STOP rule cleanly. One minor observation: `react-native-web` is present (for the `expo start --web` target), but the skill's stop rule fires on `react-native` / `expo` regardless, which is the correct behavior — even with a web export, an Expo app still has a native runtime where the LinguiJS Babel/Vite pipeline doesn't apply.

### Overall verdict
A real user would land in a correct, safe state: the guide refuses to set up an unsupported stack and instead tells them which libraries to use manually (`expo-localization` plus `i18n-js` or `react-i18next`). No working i18n setup is produced — by design — but no broken setup is produced either, and the user gets actionable next steps. The weakest link is that the guide stops short of routing; there is no `expo-setup` / `react-native-setup` skill in the suite, so users following the suggestion are entirely on their own once they leave the guide. If RN/Expo is a meaningful target, a dedicated setup skill would close that gap; if not, the current STOP message is the right outcome.
