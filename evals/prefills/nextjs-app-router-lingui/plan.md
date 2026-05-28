---
version: 1
createdAt: 2026-05-27T00:00:00Z
manifestSnapshot: .globalize/manifest-snapshot.json
detection: .globalize/detection.json
decisions: .globalize/decisions.md
---

# i18n Setup Plan

Stack: **Next.js (App Router)** + **Lingui** (variant: `nextjs-app-router-lingui`)
Compiler: SWC. Package manager: npm. TypeScript: yes.
Branch: not a git repo — staying on current working directory.
Source locale: `en`. Target locales: `es`, `fr`. Routing: prefix-based (`/[locale]/...`).

## Phase 2 — Setup
Subagent: `setup`
Progress: `.globalize/progress/setup.json`
References:
- references/languages/js-ts/frameworks/nextjs/app-router/lingui.setup.md
- references/languages/js-ts/libraries/lingui/code.md

Packages to install (orchestrator main thread, before subagent dispatch):
- Runtime: `@lingui/core@^6`, `@lingui/react@^6`, `@lingui/macro@^5`
- Dev: `@lingui/cli@^6`, `@lingui/swc-plugin@^6`
- Install command (npm, with quoted version specifiers for zsh safety):
  - `npm install '@lingui/core@^6' '@lingui/react@^6' '@lingui/macro@^5'`
  - `npm install -D '@lingui/cli@^6' '@lingui/swc-plugin@^6'`

Orchestrator-owned steps (main thread, before subagent dispatch):
- [ ] install_packages_main_thread

Subagent steps:
- [ ] create_config
- [ ] build_tool_integration
- [ ] provider_wiring
- [ ] language_switcher
- [ ] scaffold_catalogs
- [ ] extract_compile
- [ ] install_coding_rules
- [ ] build_verification

## Phase 3 — Convert
Out of scope for this run.

## Phase 4 — Globalize-now
Out of scope for this run.
