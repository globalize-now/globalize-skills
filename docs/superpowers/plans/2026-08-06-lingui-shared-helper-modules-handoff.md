# Handoff — Lingui shared helper modules, and what comes next

**Shipped:** PR [#51](https://github.com/globalize-now/globalize-skills/pull/51), branch `feat/lingui-shared-helper-modules`, commit `4c8c00e`. 20 files, +1207 / −1312.

**Scope of that PR:** the 9 Lingui variants only. next-intl, vue-i18n, Paraglide, Rails, iOS and Android were deliberately left alone.

---

## 1. The contract you're inheriting

Two shared setup references own the emitted helper surface for every React/Lingui stack. You need to know this before touching any Lingui reference file, because the framework files no longer contain these definitions and must not regain them.

| File | Owns | Exports |
|---|---|---|
| `libraries/lingui/setup.locale-module.md` | `<i18nDir>/locales.ts` | `sourceLocale`, `locales`, `Locale`, `resolveLocale`, `getDirection`, `localeDisplayName`, `CURRENCY`, `DATE_SHORT`, `DATE_MEDIUM`, `DATE_TIME` |
| `libraries/lingui/setup.navigation.md` | `<i18nDir>/navigation.ts`, `<componentsDir>/LanguageSwitcher.*` | `stripLocalePrefix`, `localePath`, `switchLocalePath`, `useLocale`, `useLocalePath` |

**The ownership rule**, stated in three places on purpose (subagents read partially):

> The shared Lingui references own every file under `<i18nDir>/`, plus the language switcher. The framework reference owns everything else — build config, `lingui.config.*`, provider and root-document wiring, routes, middleware, catalogs, `.gitignore`. **A framework reference must never define a module a shared reference emits**; it shows an import and a call site. On disagreement, the shared reference wins.

Located at: `SKILL.md` "Reading the reference files" (generic form — it also retroactively covers the vue-i18n shared/framework pair, which had no stated rule); the top of `setup.locale-module.md` followed by the module inventory table; and a one-line banner under the H1 of each of the 9 framework files.

**Array ordering is load-bearing.** `references.setup` is now 3 elements: locale module → framework file → navigation module. The locale module must come first because `lingui.config.ts` imports `sourceLocale` / `locales` from it. Navigation must come last because it needs the routing-strategy answer the framework file's STOP gate collects. A single combined file cannot satisfy both.

`<i18nDir>` per variant lives in one table in `setup.locale-module.md` §1 — `src/i18n/` for Next / Vite / TanStack, `app/i18n/` for Remix / React Router v7, with a source-root override when `detection.json` reports no `src/`.

---

## 2. Before this merges

**Run one `next build`.** The single unverified assumption in the PR is that an unmarked `navigation.ts` can hold both pure functions and React hooks on Next.js. The precedent is next-intl's own `i18n/navigation.ts`, which does exactly this, and Next only errors when a client hook is *invoked* during a server render — not when its module is imported. But it hasn't been run.

Test: on the Next App Router fixture, import `localePath` from a Server Component and `useLocalePath` from a Client Component, then `next build`. Middleware / `proxy.ts` must **not** import the module (Edge runtime is the plausible failure) — it doesn't need to, it builds paths from the `locales.ts` constants.

Fallback if the build objects, already documented inline in `setup.navigation.md` §4: split Next only into `navigation.ts` (pure) + `navigation.hooks.ts`, point `<<navModule>>` at the pure file, and add one sentence to the rules template.

**Then a live end-to-end run** on one fixture per router family — Next App Router, React Router v7, TanStack Start, Vite + React Router — followed by `evals/verify-rules-template.sh --project <dir>` on each to confirm the rendered rules file, its budget, and both `CLAUDE.md` / `AGENTS.md` bridges.

---

## 3. Follow-up work, roughly in value order

### 3.1 Extend the same treatment to the remaining JS/TS stacks

This is the natural continuation. Each is independent of the others.

**Paraglide needs it most.** It is the only stack with *no* formatting guidance beyond raw `Intl`. `libraries/paraglide/rules.template.md:237` and `sveltekit/paraglide.convert.md` both say "Paraglide ships no number/date formatting helper" and then show a full `Intl.NumberFormat` constructor plus options object at every price and every date. A `$lib/format.ts` holding the project's presets is the whole fix. Paraglide already gets `localizeHref` and `getTextDirection` from its generated runtime, so navigation and direction need nothing.

**next-intl is nearly there but has two gaps.** It already has `createNavigation` (the model the Lingui work copied), and its rules template documents named formats at `libraries/next-intl/rules.template.md:280-289` — but **the convert references never mention them** and show only inline option objects. Pointing convert at the existing mechanism is a small, high-value edit. Separately, `frameworks/nextjs/app-router/next-intl.setup.md:421` inlines `RTL_LOCALES` + `getDirection` directly into `app/layout.tsx` rather than a module, so it isn't reusable.

**vue-i18n has three variants and one rule worth reconsidering.** It ships a 2-arg `localePath(locale, path)` at `src/i18n/localePath.ts` with the same per-component locale plumbing the Lingui work removed, and Nuxt has the library-native `useLocalePath()` for comparison. More importantly, `libraries/vue-i18n/convert.shared.md:261` instructs the agent to **delete** a user's hand-rolled `formatPrice()` and scatter `n(amount, 'currency')` across N call sites. Rewriting the helper to call `n()` internally is DRY-er than deleting it — worth revisiting that rule deliberately rather than by accident.

**`skills/lovable-i18n/SKILL.md`** carries its own `src/localePath.ts` (same 2-arg shape) and two different i18n layouts inside one skill — Path A `src/i18n.ts` + `src/localePath.ts`, Path B `src/modules/lingui/`. It's a single-file platform-bundled skill, so it can't consume the shared references; it would need the contract transcribed. Lower priority, and it's marked experimental.

### 3.2 iOS and Android have no formatting guidance at all

Neither `ios/native/string-catalog.rules.template.md` nor `android/native/android-strings.rules.template.md` has a Numbers/Dates section — no `NumberFormatter`, no `Date.FormatStyle`, no `NumberFormat.getCurrencyInstance`, no `DateUtils`. Currency and dates just stay hardcoded in converted projects. This is a gap in coverage, not duplication, so it's a different kind of work from the rest of this list — but it's the largest correctness hole remaining in those two stacks.

### 3.3 Rename `:lang` / `$lang` route segments to `locale`

React Router v7 and Remix name the dynamic segment `:lang` / `$lang` (`react-router-framework/lingui.setup.md`, in the route-tree section), which violates the project convention that BCP47 locale variables are named `locale` — HTML `lang` attributes and DOM `.lang` keep their names, route params don't.

Deliberately not bundled into PR #51. The helper design insulates itself from this: `useLocale()` reads loader data rather than route params on those two stacks, so the rename touches only the route tree and is genuinely separable.

### 3.4 Infrastructure gaps found while working

- **`manifest.schema.json` does not exist.** `manifest.json` line 2 has `"$schema": "./manifest.schema.json"` pointing at nothing, and no code anywhere reads the manifest — it's consumed only by a model following `SKILL.md` prose. A real schema would catch a malformed `references` array before a run does.
- **The evals aren't CI-wired.** `.github/workflows/` holds `claude-issue-agent.yml`, `claude-issue-backfill.yml`, `publish-api-client.yml` — nothing runs `verify-rules-template.sh`, which is cheap, standalone, needs no fixture, and would have caught template regressions for free.
- **Only one Layer B prefill exists** (`evals/prefills/nextjs-app-router-lingui/`). The other 8 Lingui variants have no prefill, so Phase 2 can't be exercised against them without a full Layer A run first.

---

## 4. Traps

Things that will bite someone who doesn't know them.

**The swc/babel twin pairs must be edited together.** `react-router-framework/lingui.setup.md` and `react-router-framework/swc/lingui.setup.md` are both 853 lines and differ only around the compiler section; same for the Remix, TanStack and Vite pairs. **Nothing in the eval suite catches divergence.** The approach that worked here: write the edits as a list of exact string replacements in a script, assert each matches exactly once per file, and apply to both. Verify afterwards with `diff` — the twin diff line counts should be unchanged from before your edit (Vite 64, RR7 66, Remix 63, TanStack 69).

**Never declare a rules-template value named `locale`.** The typed-links block contains `params={{ locale }}` inside a code fence. `evals/verify-rules-template.sh` only flags `{{ ident }}` inside a fence when `ident` names a *declared value* — so this passes today and would hard-FAIL the moment someone adds a `locale` value. There's a comment to that effect in the template frontmatter; keep it.

**The template linter fails on declared-but-unused values in *both* directions.** Adding a `values:` key without using `<<key>>` in the body is a FAIL, not a warning. Same for using an undeclared one.

**Budget slack is thin.** After this change the Lingui template renders at 254 (`router == "app"`, budget 260) and 230 (default, budget 235) — 6 and 5 lines. Any unconditional prose addition needs a re-count. The script that measures it is worth rewriting rather than eyeballing: strip frontmatter, walk the marker grammar for all condition combinations, add 2 for the generated header.

**`generate_coding_rules` fails closed.** If `localesModule` can't be resolved from disk, *no rules file is written at all* — not a partial one. That's why the never-emitted `src/i18n/locales.ts` on Next App Router was a blocker rather than a nuisance: the glob would find nothing and the whole step would skip. Any new value you add inherits that property, so only add values that are reliably derivable from files setup actually wrote.

**Plan step ids did not change** and shouldn't need to. `locales.ts` rides `create_config` (the config imports from it — same unit of work); `navigation.ts` and the switcher ride `language_switcher` (both consume `switchLocalePath`). That's why `evals/expectations/plan/*.json` is untouched. If you add a step id, you must also thread it through the Phase 2 collapse-case list in `SKILL.md` and make it library-conditional for the 11 non-Lingui variants.

**The Vite flat/dir shadowing.** `src/i18n.ts` shadows `src/i18n/index.ts` in Vite's and Node's resolution order. A project set up by an older version that gets a partial re-run would keep loading the stale flat module while the new helpers sit on disk as dead code — build passes, `tsc` passes, app quietly wrong. `setup.locale-module.md` §2 guards this and `evals/library-checks/lingui.sh` asserts it; don't weaken either.

---

## 5. Verification commands

```bash
# Cheap, standalone, no fixture. Currently 85 pass / 0 fail / 0 warn.
bash evals/verify-rules-template.sh

# After a real setup run, per project:
bash evals/verify-rules-template.sh --project <dir>

# Every manifest reference path resolves:
cd skills/globalize-guide && python3 -c "
import json,os
m=json.load(open('manifest.json'))
print([ (s['variant'],p) for s in m['stacks']
        for k,v in s['references'].items() if k!='optional'
        for p in v if not os.path.exists(p) ] or 'all paths resolve')"

# No surviving duplicate helper definitions in the Lingui reference set
# (only the intentional prose-bans in the Vite files and shared refs should appear):
grep -rn "RTL_LOCALES\|export function getDirection\|new Intl.DisplayNames" \
  skills/globalize-guide/references/languages/js-ts/frameworks \
  skills/globalize-guide/references/languages/js-ts/libraries/lingui
```
