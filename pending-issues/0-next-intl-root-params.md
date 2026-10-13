# Open item 0 — ready-to-file issue draft

**Status:** unfiled. Drafted 2026-08-05, broadened 2026-08-11, **file references corrected and re-scoped 2026-08-17**.
**Severity:** medium.
**References verified:** 2026-08-17 against `a8e0741`.

Supersedes the drafts in [2026-08-05.md](../2026-08-05.md#github-issue-creation) and [2026-08-11.md](../2026-08-11.md#github-issue-creation). Both cite `libraries/next-intl/code.md`, which **no longer exists** — deleted in `6743587` (#49, 2026-08-04) and replaced by `rules.template.md`.

---

**Title:** next-intl 4.13.5–4.13.6 deprecate `setRequestLocale` and `getRequestConfig({requestLocale})` — document the `next/root-params` path

**Labels:** `skills`, `next-intl`, `upstream-change`

**Body:**

next-intl is migrating App Router locale plumbing to Next.js 16.3's [`next/root-params`](https://next-intl.dev/blog/nextjs-root-params) across two releases:

- **4.13.5** (2026-08-04, [release](https://github.com/amannn/next-intl/releases/tag/v4.13.5)) deprecates **`setRequestLocale`**.
- **4.13.6** (2026-08-10, [release](https://github.com/amannn/next-intl/releases/tag/v4.13.6), [#2380](https://github.com/amannn/next-intl/issues/2380)) deprecates the **`requestLocale` param of `getRequestConfig`**.

Our App Router references teach both as *the* required patterns, with no pointer to the modern path.

### Not breaking — no pin change

`^4` admits both. Each is a deprecation *warning*, not a removal. The replacement requires **Next.js 16.3+**, while next-intl's own peer floor stays `next ^12` (peers byte-identical across 4.13.4 → 4.13.6, `engines` absent). Below 16.3 — and in Route Handlers and Server Actions at any version — `setRequestLocale` and the `requestLocale` param remain the only mechanism. **Do not delete either.**

### Skill surface

`setRequestLocale` — 17 hits / 3 files. All paths relative to `skills/globalize-guide/references/languages/js-ts/`:

| File | Lines |
|---|---|
| `libraries/next-intl/rules.template.md` | 72, 160, 197, 207 |
| `frameworks/nextjs/app-router/next-intl.setup.md` | 31, 45, 49, 449, 467, 495, 497, 503, 512, 519 |
| `frameworks/nextjs/app-router/next-intl.convert.md` | 38, 140 |

`getRequestConfig(async ({requestLocale}) => …)` — 4 hits / 2 files:

| File | Lines |
|---|---|
| `frameworks/nextjs/app-router/next-intl.setup.md` | 199, 201 |
| `libraries/next-intl/po-format.setup.md` | 60–61 |

`root-params` / `rootParams` across `skills/`: **0 hits.**

### The two halves need different treatment

**1. Prose references** (`next-intl.setup.md`, `next-intl.convert.md`, `po-format.setup.md`) — straightforward additive edit:

- Add a "Next.js 16.3+" note presenting the `next/root-params` path: resolve locale once in `i18n/request.ts` via `await rootParams.locale()` (validate, then `notFound()` on failure) instead of `await requestLocale`; then drop `setRequestLocale` calls and manual `getTranslations({locale})` overrides.
- Re-frame the existing `setRequestLocale` and `getRequestConfig({requestLocale})` guidance as required for **Next < 16.3**, Route Handlers, and Server Actions.
- Caveats to carry into the edit: `next/root-params` is **unsupported in Route Handlers and Server Actions**; remove any pass-through `app/layout.tsx` (use `global-not-found`); `generateStaticParams` is still required.

**2. `rules.template.md` — needs a new condition key, not prose.**

This file is on the passive-rule track: setup renders it against the project's values and writes `.agents/globalize-rules.md` into the user's repo, imported from `CLAUDE.md` and pointed at from `AGENTS.md`. It is **always-on context in every future session**, which means L160/197/207 currently install a standing instruction to keep writing a deprecated call into every next-intl project we touch. That is the part of this item with real blast radius.

The rendered output has no runtime version check — whatever renders, ships — so presenting both paths in one file spends budget (240 App Router / 200 default) on a branch that cannot apply. The template's own spec, `references/rules-template-format.md` L154, prescribes the fix for exactly this shape:

> When a block genuinely depends on two axes, resolve them into one composite key rather than reaching for nesting.

and gives `paramsShape` (`"promise"` / `"sync"` / `"none"`) as the worked example — the key that collapsed "App Router *and* Next 15+" into sibling blocks. This is the same shape one Next major later ("App Router *and* Next 16.3+"), and it is **coupled to `paramsShape`**: resolving locale via `await rootParams.locale()` in `i18n/request.ts` is what removes the need for the `params`-then-`setRequestLocale` dance those very blocks teach (L191–211).

Proposed:

- Add a composite condition key — working name **`localeSource`**, resolving to `"root-params"` or `"request-locale"` — to the template's `conditions: [router, localeNavigation, catalogFormat, paramsShape]` list and to the setup step that resolves condition values.
- Split L160/197/207 into sibling `<!-- if: localeSource == … -->` blocks.
- Bump `templateVersion` (currently `1`).
- Check the interaction with `paramsShape`: under `localeSource == "root-params"` the `params`-shape blocks may no longer need to mention `setRequestLocale` at all, which could simplify rather than duplicate.

The name and the exact resolution logic are open for debate — `localeSource` is a starting point, not a conclusion. `paramsShape` appears in only four files (`rules-template-format.md`, `next-intl/rules.template.md`, `next-intl/setup.add-ons.md`, `ios/native/string-catalog.setup.md`), so a sibling key is a tractable change.

### Sources

next-intl v4.13.5 and v4.13.6 release notes; [next-intl.dev/blog/nextjs-root-params](https://next-intl.dev/blog/nextjs-root-params). Tracked in `library-checks/` open item 0 since 2026-08-05.

---

**Filed: https://github.com/globalize-now/globalize-skills/pull/59** (2026-08-25, **draft** — open questions under `## Needs a human`: the `localeSource` key name, the on-disk-vs-version resolution rule, whether setup should start emitting the root-params form, and templateVersion-2 re-render semantics).
