---
createdAt: 2026-05-27T00:00:00Z
---

# i18n Setup Decisions

## Library
**Lingui** (user-specified; manifest variant `nextjs-app-router-lingui`)

> Note: For Next.js App Router, the skill's default recommendation is **next-intl** (purpose-built for Next.js, no compile step). User overrode in favor of Lingui's compile-time macros and zero-runtime translation overhead.

## Scope
- [x] Setup
- [ ] Convert existing strings
- [ ] Connect Globalize.now

## Branch
Not a git repo — staying on current working directory (no branch action).

## Setup mode
**Guided** — per-step explanations, consent gates on file modifications.

## Locales
- Source: `en`
- Targets: `es`, `fr`

## Routing strategy
**Prefix-based** (`/en/...`, `/es/...`, `/fr/...`) — *applied as default; not explicitly user-confirmed.* Will scaffold `app/[locale]/` layout in Phase 2.

## Optional setup steps
- [x] Install passive coding rules (@import in CLAUDE.md) — *applied as default; not explicitly user-confirmed.*
- [ ] ESLint plugin
- [ ] CI/CD integration
- [ ] Test setup wrapper

## Globalize-now
N/A — out of scope for this run.
