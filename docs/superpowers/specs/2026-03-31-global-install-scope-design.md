# Global Install Scope Design

**Date:** 2026-03-31
**Status:** Approved

## Overview

Add `--target` flag to the `add` command and an interactive scope prompt to both `add` and `wizard` to let users install skills globally (available across all projects) or locally (current project only). When `--target` is not provided, the CLI prompts interactively.

## `--target` Flag Semantics

`--target` accepts three forms:

| Value | Resolved directory |
|---|---|
| `global` | `os.homedir()` |
| `local` | `process.cwd()` |
| Any other string | `path.resolve(value)` (custom path) |

`global` and `local` are named aliases. Any other value is treated as a literal directory path, allowing power users to install into arbitrary locations (e.g. a shared monorepo tools directory).

## New Module: `lib/scope.mjs`

Owns all scope-related logic:

```js
// Resolve a --target value to an absolute directory path
resolveTargetDir(target)

// Prompt the user interactively, returns resolved directory
promptScope()

// Per-agent global support map
// Agents where supported=false are skipped (with a warning) when scope resolves to global
GLOBAL_SUPPORT = {
  claude: true,
  codex: false,
  cursor: false,
}
```

### `resolveTargetDir(target)`

- `'global'` → `os.homedir()`
- `'local'` → `process.cwd()`
- anything else → `path.resolve(target)`

### `promptScope()`

Uses `@inquirer/select` (already a dependency). Returns the resolved directory from `resolveTargetDir`.

```
? Install scope:
  ❯ Global  — available in all projects (~/)
    Local   — this project only (./)
```

### Agent filtering for global scope

When the resolved target dir equals `os.homedir()` (i.e. scope is `global`), agents in the install list are filtered by `GLOBAL_SUPPORT`. Unsupported agents are skipped with a warning:

```
  ⚠ Skipping codex — global install not supported
```

Custom path targets bypass this filter entirely (intent is explicit, user manages path).

## Changes to `add.mjs`

1. `parseArgs` gains `--target <value>` parsing.
2. After parsing, if `target` is absent → call `promptScope()`.
3. If `target` is present → call `resolveTargetDir(target)`.
4. Filter agents by `GLOBAL_SUPPORT` when `targetDir === os.homedir()`.
5. Pass resolved `targetDir` to each converter call.

## Changes to `wizard.mjs`

After agent selection (currently line 98), add a scope prompt step using `promptScope()` from `lib/scope.mjs`. Replace the hardcoded `targetDir = process.cwd()` at line 87 with the resolved scope dir. Apply the same agent filtering for global scope.

## Converters: No Changes

All three converters (`claude.mjs`, `codex.mjs`, `cursor.mjs`) already accept `targetDir` and append their agent-specific subdirectory. They work correctly with any `targetDir` value.

| Converter | Global path (when targetDir = homedir) |
|---|---|
| claude | `~/.claude/skills/<name>/` |
| codex | `~/.codex/skills/` (not yet supported) |
| cursor | `~/.cursor/rules/` (not yet supported) |

## Files Changed

| File | Change |
|---|---|
| `cli/lib/scope.mjs` | New — `resolveTargetDir`, `promptScope`, `GLOBAL_SUPPORT` |
| `cli/commands/add.mjs` | Parse `--target`, call scope resolution, filter agents |
| `cli/commands/wizard.mjs` | Add scope prompt after agent selection |
| `cli/converters/claude.mjs` | None |
| `cli/converters/codex.mjs` | None |
| `cli/converters/cursor.mjs` | None |

## `update` Command

`update` delegates entirely to `add` (with `--no-cache` injected). It inherits `--target` support and the interactive prompt automatically — no changes needed to `update.mjs`.

## Out of Scope

- Adding global support for Codex and Cursor (can be done by updating `GLOBAL_SUPPORT` and verifying paths)
- Additional `--target` aliases beyond `global` and `local`
