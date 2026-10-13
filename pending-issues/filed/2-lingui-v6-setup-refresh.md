# Update Lingui setup references for @lingui v6 (Node + ESM gates, 15 files incl. a passive-rule template)

**Labels:** `skill:globalize-guide`, `library:lingui`, `type:maintenance`
**Open item:** 2 (open since 2026-04-25)
**Draft verified:** 2026-08-18 (paths and line counts re-grepped this run)

---

## Why now

Open item 2 has been carried forward verbatim since 2026-04-25 (~115 days). Per the standing practice added on 2026-08-17, this run re-grepped its file references and found the item's scope statement is **wrong in three ways**. This draft replaces it.

## What the old item said vs. what is actually true

| Old item 2 claim | Verified 2026-08-18 |
|---|---|
| "Covers all 12 lingui setup/reference files" | **15 files.** See list below. |
| "drop `@lingui/macro` install" | **Already done.** Repo-wide grep for a `@lingui/macro` install/add line across `references/` and `manifest.json` = **0 hits**. The 3 remaining textual mentions all correctly say *"not the deprecated `@lingui/macro`"*. This subtask is complete and should be struck. |
| (no mention of the passive-rule track) | One of the 15 files is now **`libraries/lingui/rules.template.md`** (`template: lingui`, `templateVersion: 3`, `conditions: [router, perPageCatalogs, localeNavigation]`), created in the #49/#50 rules-template restructure — *after* item 2 was written. It renders into `.agents/globalize-rules.md` in the user's repo and is always-on context. |

## The two subtasks that are genuinely still open

Both verified against the live `@lingui` v6.6.0 packuments this run:

```
@lingui/core@6.6.0        engines {"node":">=22.19.0"}  type: module  main: (none)  exports["."].require: no
@lingui/cli@6.6.0         engines {"node":">=22.19.0"}  type: module  main: (none)  exports["."].require: no
@lingui/react@6.6.0       engines {"node":">=22.19.0"}  type: module  main: (none)  exports["."].require: no
@lingui/vite-plugin@6.6.0 engines {"node":">=22.19.0"}  type: module  main: (none)  exports["."].require: no
@lingui/swc-plugin@6.6.0  engines undefined             type: module  main: ./lingui_macro.wasm
```

1. **Node ≥ 22.19.0 detection gate.** `grep -rn '22.19' skills/` → **0 hits**. No lingui setup file warns that v6 will refuse to install on Node < 22.19.0. This is a hard `engines` floor, not advisory.

2. **ESM-only gate.** `grep -rn -i 'esm-only|ESM only|"type": "module"' ` across the lingui references → **0 hits**. Every v6 core package is `"type": "module"` with **no `main` and no `require` condition in its exports map** — a CJS consumer cannot `require()` any of them. Projects on CJS configs (a `.babelrc`-era Next app, a CJS `lingui.config.js`) will break, and nothing in the references says so.

Note these two gates interact: `@lingui/swc-plugin` is the only family member with *no* `engines` field, so a project can pass a naive swc-plugin-only version check and still fail on `@lingui/cli`.

## The 15 files

```
frameworks/nextjs/app-router/lingui.convert.md
frameworks/nextjs/app-router/lingui.setup.md
frameworks/react-router-framework/lingui.setup.md
frameworks/react-router-framework/swc/lingui.setup.md
frameworks/remix/lingui.setup.md
frameworks/remix/swc/lingui.setup.md
frameworks/tanstack-start/lingui.setup.md
frameworks/tanstack-start/swc/lingui.setup.md
frameworks/vite/react-babel/lingui.setup.md
frameworks/vite/react-swc/lingui.setup.md
libraries/lingui/convert.standard-react.md
libraries/lingui/rules.template.md          <-- passive-rule track
libraries/lingui/setup.add-ons.md
libraries/lingui/setup.locale-module.md
libraries/lingui/setup.navigation.md
```
(relative to `skills/globalize-guide/references/languages/js-ts/`)

## Scoping guidance for the fix

- The Node and ESM gates are **detection-time preconditions**, so they belong in the 10 `*.setup.md` files (and the SKILL.md detection table if a hard gate is wanted), **not** in `rules.template.md`. A rendered rules file is read while *writing components*; it is the wrong place for an install-time precondition, and it costs permanent context budget (`budget: 260` app / `235` default) for something checked once.
- `rules.template.md` should be touched **only** if a v6 behavior change alters coding rules. Check its `templateVersion: 3` guidance against the optional v6 items below and bump `templateVersion` only if a rule actually changes.
- Do **not** re-do the `@lingui/macro` removal — it is already committed.

## Optional v6 items to fold in while editing (all additive, none blocking)

- `lingui-set` / `lingui-reset` macro directives (6.1.0)
- `corePackage` / `jsxPackage` options on `@lingui/swc-plugin`
- typed message IDs for TS catalogs (6.2.0)
- `@lingui/format-po-gettext` default `foldLength=0` change (6.3.0)
- macro extraction mark changed to `/** i18n */` — double-star (6.4.0)
- swc-plugin 6.5.0: `descriptorFields` (`auto`/`all`/`id-only`/`message`, replaces Babel `extract:true`), `jsxPlaceholderAttribute`, `jsxPlaceholderDefaults`
- core 6.5.0: `pseudoLocale` config options, experimental-extractor rolldown support, spread-present extractor bugfix
- 6.6.0: nested `msg`/`t` macro support (#2625); Babel 8 peer support (#2623). Docs-only for us — `grep '@babel/core' skills/` = 0 hits and no skill asserts a Babel major.

## Verification performed for this draft

- `find` over `skills/globalize-guide/references/languages/js-ts` for `*lingui*.md` → 15 files.
- `grep` for `@lingui/macro` install/add lines across `references/` + `manifest.json` → 0.
- `grep` for `22.19` → 0; for ESM-only phrasing / `"type": "module"` in lingui refs → 0.
- npm packuments for `@lingui/{core,cli,react,vite-plugin,swc-plugin}` fetched 2026-08-18; `engines`, `type`, `main`, and `exports["."].require` read directly.
- `rules.template.md` frontmatter read for `templateVersion`, `conditions`, `budget`.

---

**Filed: https://github.com/globalize-now/globalize-skills/pull/57** (2026-08-25, ready for review). Scope corrected on filing: 18 files not 15 (webext added by #55), and SKILL.md L480 already carries an orchestrator-level Node note, so the PR frames the gap as "no gate anywhere the setup subagent reads" rather than "no gate anywhere".
