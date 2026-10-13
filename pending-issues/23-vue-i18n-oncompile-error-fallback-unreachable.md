# The vue-i18n ICU `messageCompiler`'s "defensive fallback" never runs, and the case its comment names is the one it cannot catch

**Status: UNFILED — no write path.** `lc_have_token` → rc 1; `GET /repos/globalize-now/globalize-skills` with the token in `library-checks/.github-token` → **`401 Bad credentials`**; the same GET without the header → `200`. Token file mtime **2026-08-25 17:27:18Z**, unchanged. Fourth consecutive run without a write path. Found 2026-09-28. Patch: [`23-vue-i18n-oncompile-error-fallback-unreachable.patch`](./23-vue-i18n-oncompile-error-fallback-unreachable.patch) — `git apply --check` passes against `main` `a997b6d`.

Type: **PR** when the token is rotated. It is an implementable code+prose change, not a product decision.

## What the skill says today

`skills/…/libraries/vue-i18n/setup.shared.md` L268–276 emits this compiler, and `skills/…/frameworks/nuxt/vue-i18n.setup.md` L147–151 emits the same code without the comment:

```ts
export const messageCompiler: MessageCompiler = (message, { locale, key, onError }) => {
  if (typeof message !== 'string') {
    // Defensive fallback: ICU compilation needs the raw string. If a bundler ever
    // feeds us a pre-compiled AST or function (e.g. because someone added the
    // plugin's `include` option to the locales directory), fail loudly rather
    // than silently mis-render.
    onError?.(new Error(`[i18n] ICU compiler requires string messages (key: ${key})`) as CompileError)
    return () => key
  }
  …
```

Two claims are load-bearing: that the block **falls back** (`return () => key`), and that it covers a pre-compiled **AST or function**.

## What actually happens

### 1. `return () => key` does not run. `onError` throws.

`@intlify/core-base@11.4.12` `dist/core-base.mjs` `getCompileContext()` (L1794–1821) hands the custom compiler an `onError` that is a wrapper:

```js
onError: (err) => {
    onError && onError(err);                       // sets translate()'s `occurred` flag
    if ((process.env.NODE_ENV !== 'production')) {
        …devtools emit…
        throw new SyntaxError(codeFrame ? `${message}\n${codeFrame}` : message);
    }
    throw err;                                     // ← production path, still a throw
},
```

The `throw err` sits **outside** the dev guard. So calling `onError?.(…)` aborts the call in **both** builds; control never reaches the next statement. `translate()`'s own recovery — `let occurred = false; … if (occurred) return format;` (L1529–1539) — is written for an `onError` that returns, and is therefore unreachable through this path too.

Measured, not only read. `@intlify/core-base@11.4.12` + `intl-messageformat@12.1.2`, `createCoreContext({ messageCompiler })` + `translate()`, with a `console.log` inserted between `onError?.()` and the `return`:

| message shape | dev build | production build | did the line after `onError?.()` run? |
|---|---|---|---|
| `'Hello {name}'` (string) | reaches ICU | reaches ICU | n/a |
| `{type:0, body:…}` (AST) | **throws** `SyntaxError: Message compilation error: [i18n] ICU compiler requires string messages (key: greeting)` | **throws** `Error: [i18n] ICU compiler requires string messages (key: greeting)` | **no** |
| message function with `.source` | returns `"precompiled"` | returns `"precompiled"` | **no — compiler never called** |

The `return () => key` line is not dead in *all* hosts — it runs if a host passes no `onError` — so the patch keeps it and annotates it, rather than deleting it and breaking the `MessageCompiler` return type.

**Why it matters to a user of this skill:** "fail loudly" and "render the key" are different failures. A throw out of `t()` inside a Vue render function takes out the component subtree via `app.config.errorHandler`; a key-shaped string is a visible but survivable placeholder. The comment promises the second and the code delivers the first.

### 2. The *function* case — the one the comment names first — is exactly the one this guard cannot see.

`core-base` short-circuits before any custom compiler runs, in two places:

- `translate()` L1534–1537: `const msg = !isMessageFunction(format) ? compileMessageFormat(…) : format;`
- `compileMessageFormat()` L1675–1680: `if (isMessageFunction(format)) { …; return msg; }`

`isMessageFunction` is `typeof fn === 'function' && 'source' in fn`. A pre-compiled message function therefore bypasses the ICU compiler **silently** and is rendered by vue-i18n's own runtime with pipe-plural semantics — the precise "silently mis-render" the comment says it is preventing. Row 3 of the table above is that, measured.

It cannot be fixed inside the compiler: the compiler is not called. What prevents it is omitting `include`, which this setup phase already does — so the fix is to say so, in both the comment and the gotcha.

### 3. Which shape does `include` actually emit? The AST — so the guard is reachable for the documented case.

`@intlify/unplugin-vue-i18n@11.2.5` `lib/index.mjs` hardcodes `jit: true` at all four resource-transform call sites (L471, L500, L540, L576); it is not an option a user can flip. Run against `@intlify/bundle-utils@10.0.1` `generateJSON`:

- `jit: true` → `{"greeting":{"type":0,"start":0,…,"body":{…}}}` — a plain object, **non-string**, hits the guard, throws.
- `jit: false` → `(()=>{const fn=(ctx)=>{…};fn.source="Hello {name}";return fn;})()` — a message function, **bypasses** the compiler.

So the existing gotcha entry's "pre-compiles catalogs into AST/JS functions" is half true, and the half that is false is the half with no error message to search for.

## Fix

Three edits, two files, no behaviour change to any emitted runtime code — the snippet's *behaviour* is already what the patch describes; the patch corrects the description and splits the gotcha.

1. `libraries/vue-i18n/setup.shared.md` L269–276 — replace the comment: state that `onError` re-throws in both builds, that `t()` therefore throws rather than falling back, that the `return` runs only on a host with no `onError`, and that a pre-compiled message function is not caught here at all.
2. `frameworks/nuxt/vue-i18n.setup.md` L148 — add the short form of the same note to the currently-uncommented copy, pointing at the shared reference.
3. `libraries/vue-i18n/setup.shared.md` L969 — correct the gotcha to say **AST** (not "AST/JS functions"), name the thrown shapes a user will actually see in each build, and add a **second** gotcha for the silent function case, whose symptom is ICU syntax rendering literally with no error.

## Verification

- **Executed:** `@intlify/core-base@11.4.12` + `intl-messageformat@12.1.2` + `@intlify/bundle-utils@10.0.1` in a throwaway dir outside the repo; `translate()` on three message shapes × two `NODE_ENV` values; `generateJSON` with `jit` both ways. Table above.
- **Read:** `core-base@11.4.12` `dist/core-base.mjs` L185–230 (`baseCompile`/`compile`), L1520–1548 (`translate` + `occurred`), L1673–1712 (`compileMessageFormat`), L1794–1821 (`getCompileContext.onError`), and `dist/core-base.prod.cjs` for the same region, from the registry tarball — no `@intlify` install into the repo.
- **Evals**, in a `--depth 1` clone of `origin/main` (`a997b6d`) with the patch applied, and again with it stashed: `verify-manifest.sh` **6/0/0**, `verify-rules-template.sh` **104/0/0**, `verify-format-helpers.sh` **88/0/0**, rc 0 in both directions — identical, so this is a measured baseline rather than a quoted one. No eval covers `vue-i18n/` prose; these are regression controls and the substantive verification is the execution above.
- `git apply --check` passes against clean `a997b6d`.

## Duplicate checks

- **Open PRs (item 52), hunk level.** All 11 open PR file-lists read. One PR touches a target file: **#88** on `vue-i18n/setup.shared.md`, hunks at old-lines **658–663** and **874–898**. This patch edits **269–276** and **969**. No overlap; a fresh branch merges clean. No open PR touches `nuxt/vue-i18n.setup.md`.
- **Draft queue (item 58).** `pending-issues/` grepped for both filenames and for `messageCompiler`/`onError`. One hit: draft **19** cites `vue-i18n/setup.shared.md` **L140** (the `typescript@^6` install site). Different region, no conflict, nothing to reconcile.

## Trigger G

Enumerated rather than trusted: `ICU compiler requires string messages` → **3** occurrences (two code, one gotcha); `return () => key` → **2**. All five are in the two files above and all five are covered.

**Still unfiled 2026-09-29.** Fifth consecutive run blocked on the same `401 Bad credentials` from `library-checks/.github-token` (mtime still 2026-08-25 17:27:18Z); an unauthenticated control on the same repo in the same call returned `200`, so egress is fine and the credential is not. **The repo moved this run**: `main` is now `f4f71a1` ([#84](https://github.com/globalize-now/globalize-skills/pull/84) merged, 2026-09-28T07:07Z) and the open-PR set is **10**, not 11. `git apply --check library-checks/pending-issues/23-vue-i18n-oncompile-error-fallback-unreachable.patch` was re-run against the **new** `main` `f4f71a1` — still applies clean, so this is a re-verification rather than a re-stamp. Duplicate checks re-run against the 10 open PRs; still hold.

**Still unfiled 2026-09-30.** **Sixth** consecutive run blocked on the same `401 Bad credentials` from `library-checks/.github-token` (mtime still 2026-08-25 17:27:18Z); an unauthenticated control on the same repo in the same call returned `200`, so egress is fine and the credential is not. `main` is **unchanged** at `f4f71a1`, and the open set is unchanged at **10 PRs / 25 issues**, so the duplicate checks in this draft carry forward on the same baseline they were last verified against. `git apply --check library-checks/pending-issues/23-vue-i18n-oncompile-error-fallback-unreachable.patch` re-run against `f4f71a1` — **still applies clean**. `vue-i18n` `latest` unchanged at 11.4.12, `stable` 11.1.10, `next` 12.0.0-alpha.4. Touches `nuxt/vue-i18n.setup.md` and `libraries/vue-i18n/setup.shared.md`; disjoint from draft 25's two `nextjs/` files.

**Still unfiled 2026-10-05 — and this run gives it a dependency it did not have.** Twelfth consecutive run blocked on the same `401 Bad credentials` (token mtime still `2026-08-25T17:27:18Z`, now **41 days**); unauthenticated control on the same repo in the same call → `200`. `main` unchanged at `48a676ae`, open set unchanged at **7 PRs / 26 issues**, `git apply --check` against `48a676ae` — **still clean**, `+21/-5`, 2 files.

**New: this draft collides with draft 31 and must not land alone as it stands.** 31 corrects the claim that `runtimeOnly: false` is what keeps a message compiler in the bundle — measured false on `vue-i18n@^11` (the plugin's two alias targets differ by one comment and both call `registerMessageCompiler(compile)`; the 9.x split went away in 10.0.0). **This draft's replacement text for the `[i18n] ICU compiler requires string messages` bullet carries that wrong sentence forward verbatim:** *"Keep `runtimeOnly: false` so the message-compiler runtime the custom function plugs into stays in the bundle."* The two patches **do not commute** — 23-then-31 fails at `setup.shared.md:1002`, 31-then-23 fails at `:966`, a real one-line content collision rather than an offset artifact.

**Resolution, already written:** `31-vue-i18n-runtimeonly-claim-stale.post23.patch` is generated against a tree with this patch applied and verified clean there. Preferred order is **23 first, then `31-…post23.patch`** — this draft is older, larger and already queued, and the post-23 variant is identical in content to 31's `main` variant. If 23 is reworded before merge, drop that one sentence from its replacement text and the collision disappears; the rest of 23 is untouched by 31.

---

## 2026-10-11 — re-measured against `@intlify/core-base@11.4.14`, claim unchanged

`vue-i18n@11.4.14` published 2026-10-10T11:11:08.057Z and is what the manifest's `vue-i18n@^11` resolves to today (the only level-1 hit of that run); `@intlify/core-base` moved `11.4.13` → `11.4.14` with it. Open item **77** requires re-measuring a queued draft's *claim* — not just its `git apply --check` — whenever its package publishes in the window. Done:

**Source.** `getCompileContext()`'s `onError` wrapper in `dist/core-base.mjs` is structurally identical at `11.4.14`: the dev branch throws a `SyntaxError`, and `throw err` sits **outside** the `NODE_ENV` guard. Byte-for-byte the same shape as the `11.4.12` listing quoted above, at a different line number (1796 vs 1799).

**Behaviour**, which is what item 77 asks for. The skill's compiler shape, `onError` reached by a real ICU compile error on a string message (`"{count, plural, one {"`), with a flag set on the statement *after* `onError?.()`:

| `NODE_ENV` | `translate()` | flag after `onError?.()` |
|---|---|---|
| `production` | throws `SyntaxError: EXPECT_ARGUMENT_CLOSING_BRACE` | **false** |
| `development` | throws `SyntaxError: Message compilation error: EXPECT_ARGUMENT_CLOSING_BRACE` | **false** |

`return () => key` does not run in either build. **The claim holds at `11.4.14`; the patch is unchanged.**

**And a second confirmation, found by a fixture that was wrong first.** My first probe fed the compiler a plain-object message to reach the `typeof message !== 'string'` branch directly — and the compiler was **never called at all**. `11.4.14` refactors the guard into `isMessageFormat(val) = isString(val) || isMessageAST(val) || isMessageFunction(val)` (new `/** @internal */` export; the three-way disjunction was already there inline at `11.4.13`, so this is a rename, not a behaviour change) and a message that is none of those is treated as unresolved before any compiler runs. That is **this draft's second claim** — *"the case its comment names is the one it cannot catch"* — arriving as a measurement instead of a reading: a pre-compiled AST or function **is** a message format and is used directly; anything else never reaches the compiler. The defensive block is unreachable from both directions.

### What else is in `11.4.14`, and why none of it touches these skills

A security-hardening release. Two behaviour changes, neither reachable from anything in `skills/`:

1. **Prototype-pollution guard on locale names.** New `isUnsafeLocale()` + warning `IGNORE_UNSAFE_LOCALE` (`Ignore '{locale}' locale: it is a property name of Object.prototype`); a locale key that is an `Object.prototype` property name (`__proto__`, `constructor`, …) is now skipped with a warning, and `getOwn(ret, locale)` replaces a direct property read. `grep -rn '__proto__' skills/` → **0**.
2. **`escapeParameter` now escapes `named` as well as `list`, into a copy.** `else if (isObject(options.named))` became `if (…)`, so a call passing **both** `list` and `named` previously left `named` **unescaped**; and the escape now builds a new object instead of mutating the caller's. `grep -rn 'escapeParameter' skills/` → **0 occurrences**, so no setup this repo emits enables it.

Everything else in the diff is cosmetic (`isMessageFormat` extraction, two reflowed ternaries). **No patch, no new draft** — recorded here so the next run does not re-investigate it.
