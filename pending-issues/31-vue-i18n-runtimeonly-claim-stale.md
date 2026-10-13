# 31 — `runtimeOnly: false` is documented as the thing that keeps a message compiler in the bundle. It has not been that since vue-i18n 10.0.0.

- **Opened:** 2026-10-05 (library check, (F) leg — oldest unverified claim)
- **Shape:** PR, **ready for review**. Prose-only, 3 files, `+5/-5`.
- **Patch:** `31-vue-i18n-runtimeonly-claim-stale.patch` — clean on `main` `48a676ae`.
  **Second variant:** `31-vue-i18n-runtimeonly-claim-stale.post23.patch` — for use if draft 23 lands first (see *Collision*).
- **Affected skill:** `globalize-guide`, vue-i18n stack (shared + Nuxt + Vite/Vue).
- **Trigger taxonomy:** (F). Not registry-driven — nothing moved upstream this window.

## The claim

`references/languages/js-ts/libraries/vue-i18n/setup.shared.md:537`, in Step 4's "Key option notes":

> `runtimeOnly: false` — include the vue-i18n message compiler in the build. The ICU compiler (our custom
> `messageCompiler`) runs against string messages at runtime. Without this, the compiled bundle drops the
> message-compiler runtime that our custom function plugs into.

Repeated in three more places, enumerated with `grep -rn` over `skills/`, not sampled:

| file | line | form |
|---|---|---|
| `libraries/vue-i18n/setup.shared.md` | 537 | the option note above |
| `libraries/vue-i18n/setup.shared.md` | 633 | Nuxt exception: attributes build-time pre-compilation to `bundle.runtimeOnly: false` |
| `libraries/vue-i18n/setup.shared.md` | 1005 | troubleshooting `[i18n] ICU compiler requires string messages`: "Keep `runtimeOnly: false` so the message-compiler runtime the custom function plugs into stays in the bundle." |
| `frameworks/nuxt/vue-i18n.setup.md` | 56 | `// include the message compiler — required for our custom ICU compiler` |
| `frameworks/vite/vue/vue-i18n.setup.md` | 26 | "(so the message-compiler runtime our custom ICU compiler plugs into stays in the bundle)" |

(`frameworks/quasar/vue-i18n.setup.md` carries `runtimeOnly: false` four times with **no** explanatory claim attached, so it is untouched by this patch.)

## Measured

Read from published tarballs, not from docs.

### 1. The two things `runtimeOnly` chooses between are the same module

`@intlify/unplugin-vue-i18n@11.2.5`, `lib/index.mjs:217`:

```js
const getVueI18nAliasPath = ({ ssr = false, runtimeOnly: runtimeOnly2 = false }) => {
  return `${module}/dist/${module}${runtimeOnly2 ? ".runtime" : ""}.${!ssr ? "esm-bundler.js" : "node.mjs"}`;
};
```

So the option picks `vue-i18n/dist/vue-i18n.esm-bundler.js` or `…vue-i18n.runtime.esm-bundler.js`. Both are
one-line re-exports:

```
vue-i18n.esm-bundler.js          -> export * from '../dist/vue-i18n.mjs'
vue-i18n.runtime.esm-bundler.js  -> export * from '../dist/vue-i18n.runtime.mjs'
```

`vue-i18n@11.4.13`, `diff dist/vue-i18n.mjs dist/vue-i18n.runtime.mjs` — **the entire difference**:

```
2515c2515
< // register message compiler at vue-i18n
---
> // register message compiler for jit compilation
```

91 188 vs 91 196 bytes. Both files then run, unconditionally:

```js
registerMessageCompiler(compile);
```

and both import `compile` from `@intlify/core-base` on line 6. The `node.mjs` pair (the `ssr: true` targets)
differ by the same single comment: 67 999 vs 68 007 bytes, 4 diff lines.

### 2. The claim was true on vue-i18n 9 and stopped being true at 10.0.0

Same diff across versions, `dist/vue-i18n.mjs` vs `dist/vue-i18n.runtime.mjs`:

| vue-i18n | full | runtime | diff lines |
|---|---|---|---|
| `9.14.5` | 109 103 | 109 035 | **12 — a real split** |
| `10.0.0` | 85 095 | 85 103 | 4 (comment only) |
| `11.0.0` | 84 648 | 84 656 | 4 (comment only) |
| `11.1.0` | 84 660 | 84 668 | 4 (comment only) |
| `11.4.13` (current `latest`) | 91 188 | 91 196 | 4 (comment only) |

On `9.14.5` the split is exactly what the note describes:

```js
// full build                                  // runtime build
if (__INTLIFY_JIT_COMPILATION__) {             if (__INTLIFY_JIT_COMPILATION__) {
    registerMessageCompiler(compile);              registerMessageCompiler(compile);
}                                              }
else {                                         // <- nothing here
    registerMessageCompiler(compileToFunction);
}
```

With JIT off, the 9.x runtime build registered **no** compiler. `compileToFunction` and
`__INTLIFY_JIT_COMPILATION__` were both removed in **10.0.0**; JIT is the only mode now. The skills pin
`vue-i18n@^11` → `11.4.13`, so the note documents a mechanism three majors behind the pinned range.

### 3. The option that *does* gate the built-in compiler is a different one, and it still does not reach ours

`unplugin-vue-i18n` resolves `runtimeOnly` and `dropMessageCompiler` independently
(`lib/index.mjs:29,30`), and only the latter touches the compiler:

```js
const runtimeOnly = isBoolean(options.runtimeOnly) ? options.runtimeOnly : true;   // -> alias only
const dropMessageCompiler = !!options.dropMessageCompiler;                          // -> define
…
define: { __INTLIFY_DROP_MESSAGE_COMPILER__: dropMessageCompiler, … }
```

In `@intlify/core-base@11.4.13`, `dist/core-base.mjs:201`, that flag guards the string branch of the
**built-in** `compile`:

```js
function compile(message, context) {
  if ((!__INTLIFY_DROP_MESSAGE_COMPILER__) && isString(message)) { … }
  else { /* AST path; warns "not supported for jit compilation" on a string */ }
}
```

And a custom compiler never routes through it — `createCoreContext`, `core-base.mjs:906`:

```js
const messageCompiler = isFunction(options.messageCompiler) ? options.messageCompiler : _compiler;
```

`compileMessageFormat` (`core-base.mjs:1700`) then calls `messageCompiler(format, …)` directly. So our ICU
`messageCompiler` **replaces** the registered `compile` rather than "plugging into" it. The note's mental
model is wrong in both halves: the alias drops nothing, and there is nothing to plug into.

### 4. The Nuxt attribution at L633 names the wrong cause

`@nuxtjs/i18n@10.6.0`, `dist/module.mjs`:

- `bundle.runtimeOnly` **defaults to `false`** (line 53) — so the skill's Nuxt snippet is setting the
  default, not opting in to anything.
- The alias is only swapped when `!dev && !_prepare && bundle.runtimeOnly` (line 2451), i.e. with the
  default it always uses the full build — which, per §1, is the same module anyway.
- Build-time pre-compilation comes from `include`, which `@nuxtjs/i18n` passes to the plugin itself
  (line ~1718, `include: localePaths.length ? localePaths : []`), **unconditionally**.

So the symptom (`error code: 2` on an ICU seed) and the remedy (ship a non-ICU Nuxt seed) are both correct;
only the cause was misattributed. The right cause — `include` pre-compiles before the custom compiler runs
— is already stated correctly 370 lines later in the same file, at L1005.

## Why this is worth a PR rather than a note

Nothing in the emitted configuration is wrong, and no project breaks: `runtimeOnly: false` is inert on
`vue-i18n@^11` rather than harmful. Three things make it worth correcting anyway:

1. **L1005 is a troubleshooting instruction.** Someone hitting `[i18n] ICU compiler requires string
   messages` is told to keep a setting that has no bearing on the error. That sends a reader to the wrong
   knob at the exact moment they are debugging.
2. **It is load-bearing for an agent.** Four sites state a causal rule. An agent asked to slim a bundle,
   or to reconcile the skill against `@nuxtjs/i18n`'s defaults, has to reason from it — and will conclude
   either that `runtimeOnly` must never change (false) or that `dropMessageCompiler: true` would break ICU
   (also false, per §3, though this patch does not recommend setting it; that needs a real build test).
3. **It hides the real rule.** "Pre-compilation is what breaks ICU; the alias is irrelevant" is the
   sentence a reader needs, and the file already says it in one place and contradicts it in four.

**The patch changes no configuration values.** `runtimeOnly: false` stays in every snippet, in all three
files and in Quasar's four untouched sites — only the explanation changes. Flipping it to `true` (or
dropping it) would be a defensible cleanup but would touch emitted project config, which is a bigger and
separately-reviewable change; see *Open question*.

## What the patch does

| file | change |
|---|---|
| `libraries/vue-i18n/setup.shared.md` L537 | replaces the option note: states the option is inert on `^11`, gives the byte-identical alias targets, dates the 9.x → 10.0.0 change, names `dropMessageCompiler` / `__INTLIFY_DROP_MESSAGE_COMPILER__` as the real gate, and records that a custom `messageCompiler` replaces rather than extends `compile`. |
| `libraries/vue-i18n/setup.shared.md` L633 | re-attributes the Nuxt pre-compilation to `@nuxtjs/i18n`'s own `include: localePaths`, notes `bundle.runtimeOnly` is already the default there, and says this `include` cannot be switched off from the skill's config. |
| `libraries/vue-i18n/setup.shared.md` L1005 | replaces "Keep `runtimeOnly: false` …" with "`runtimeOnly` is **not** the knob here … changing it will not fix this error." |
| `frameworks/nuxt/vue-i18n.setup.md` L56 | comment → `// @nuxtjs/i18n's own default; does NOT control the message compiler` |
| `frameworks/vite/vue/vue-i18n.setup.md` L26 | parenthetical → "the plugin's non-default value, kept explicit — it does **not** control whether the message compiler is present on `vue-i18n@^11`" |

Each replacement asserted `count == 1` in its file before editing.

## Verification

- `git apply --check` on a fresh `--depth 1` clone at `origin/main` `48a676ae` — **clean**.
- `evals/verify-manifest.sh` **6 / 0 / 0**, `evals/verify-format-helpers.sh` **99 / 0 / 0**,
  `evals/verify-rules-template.sh` **114 / 0 / 0** — identical on clean `main` and on the patched tree.
- `bash -n` clean on all 10 `evals/*.sh` and all 4 `evals/library-checks/*.sh`.
- `evals/library-checks/vue-i18n.sh` is the eval that covers this stack and **cannot be run here** — it
  exits 1 with `Usage: vue-i18n.sh <project-dir> <fixture-name> [variant]`, as on every prior run.
- **Eval coverage, asked rather than assumed (item 68):** `grep -rn "runtimeOnly" evals/ fixtures/` →
  **0 hits**. Nothing in the suite or the fixtures asserts anything about this option, so the suite could
  not have caught the claim and cannot regress on the correction. This is the same gap draft 30 records for
  the SWC host floor.

## Collision — draft 23 keeps the wrong sentence

`23-vue-i18n-oncompile-error-fallback-unreachable.patch` rewrites the whole
`[i18n] ICU compiler requires string messages` bullet at L1005 and **carries the wrong sentence forward
verbatim** in its replacement text:

> … **Fix**: remove `include` from the plugin config (or drop `?jit` / `?ast` query suffixes on catalog
> imports). Keep `runtimeOnly: false` so the message-compiler runtime the custom function plugs into stays
> in the bundle. …

So 23 and 31 **do not commute** — tested both orders on a copy of `main`, both fail:

| order | result |
|---|---|
| 23 then 31 | `error: patch failed: …/setup.shared.md:1002` |
| 31 then 23 | `error: patch failed: …/setup.shared.md:966` |

This is a real content collision on one line, not a line-offset artifact: both patches edit the same
sentence in the same bullet. Because 23's replacement contains that sentence byte-identically, the
correction is still a unique string match after 23 lands, so the resolution is mechanical rather than
editorial. **`31-…​.post23.patch` is that resolution** — the same five edits, generated against a tree with
23 already applied, `+5/-5`, and it is otherwise identical in content to the `main` variant.

Whoever lands these should take **one** of the two 31 patches, not both:

- 31 on `main` first, then 23 needs its own rebase (its context at L966 shifts); or
- 23 first, then `31-…​.post23.patch`.

The second order is cheaper, because 23 is older, larger (`+21/-5`) and already queued.

## Open question — should `runtimeOnly: false` stay at all?

Not in this patch, deliberately. Given §1 it is inert on `vue-i18n@^11`, so the three candidates are:

1. **Keep it, fix the prose** (this patch). Zero risk to emitted config. Leaves an inert option in every
   generated `vite.config.*` / `nuxt.config.*` / `quasar.config.*`.
2. **Drop it from the Vite and Quasar snippets**, keep it on Nuxt where it is the module's default anyway.
   Smaller generated config, but it changes files this skill writes into user projects, and five fixtures
   plus the Quasar variant's four sites would want re-checking.
3. **Keep it and add `dropMessageCompiler: true`**, on the §3 reasoning that the built-in `compile` is dead
   weight when a custom compiler is registered. Plausible, measurable, and **not measured here** — it needs
   a real `vite build` with and without the flag to confirm both that ICU still renders and that the
   compiler actually leaves the bundle. Not something to take on prose evidence.

Option 1 is what the patch does. 2 and 3 are a maintainer's call.

## Status

**Unfiled.** `lc_have_token` → rc 1; the repo PAT returns `401 Bad credentials` and has not been touched
since `2026-08-25T17:27:18Z` (**41 days**). No GitHub MCP server in the session, and the git proxy does not
carry this repo. Section 5 of the task applies: draft written, nothing filed.

**Filed:**
