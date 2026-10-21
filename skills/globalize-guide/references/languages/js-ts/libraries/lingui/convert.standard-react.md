# React Standard: String Wrapping Patterns

This covers Vite (SWC or Babel), React Router, TanStack Router, Create React App, and any other React setup without React Server Components. All hooks are available in all components — no RSC constraints.

---

## Core macro usage

All components can use `useLingui()` and `<Trans>` without restriction.

```tsx
import { Trans, useLingui } from '@lingui/react/macro'

function WelcomeBanner({ name }: { name: string }) {
  const { t } = useLingui()
  return (
    <section aria-label={t`Welcome section`}>
      <h1><Trans>Welcome back, {name}!</Trans></h1>
      <p><Trans>Here's what's happening today.</Trans></p>
    </section>
  )
}
```

---

## Sidebar and navigation data

Navigation items are often defined as constant arrays outside components. Use `msg` to mark them for extraction, then resolve with `t()` inside the component that renders them.

```tsx
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import type { MessageDescriptor } from '@lingui/core'

// Define at module scope — msg marks strings for extraction without calling t
const sidebarItems: Array<{ label: MessageDescriptor; href: string }> = [
  { label: msg({ message: `Dashboard`, comment: "Main navigation sidebar" }), href: '/' },
  { label: msg`Users`, href: '/users' },
  { label: msg`Settings`, href: '/settings' },
  { label: msg`Reports`, href: '/reports' },
]

// Resolve inside the rendering component
function Sidebar() {
  const { t } = useLingui()
  const localePath = useLocalePath()   // only on projects with locale-prefixed URLs — see below
  return (
    <nav>
      {sidebarItems.map(item => (
        <a key={item.href} href={localePath(item.href)}>
          {t(item.label)}
        </a>
      ))}
    </nav>
  )
}
```

> **Why not `t` at module scope?** `t` at module scope would be called once at module initialization, before the i18n instance is activated with the user's locale. `msg` returns a descriptor object that is resolved lazily when `t(descriptor)` is called inside a component.

**The `href` matters as much as the label.** Translating the label and leaving `href: '/'` bare gives a localized nav that sends every user back to the source locale. Whether paths need the prefix is a project fact — check the project's i18n rules file, or look for a `navigation` module beside the locale constants.

## Locale-aware links

Read the project's generated i18n rules before touching an `href`; they state which of these applies.

- **The project has an i18n `navigation` module** — take `useLocalePath()` from it inside components (`localePath('/about')`), and the two-argument `localePath(path, locale)` in loaders, actions, `redirect()` and Server Components, where hooks don't run. Never hand-build `` `/${locale}/about` ``.
- **The project uses TanStack Router** — do not wrap `<Link>`; its `to` and `params` are typed against the route tree. Use `<Link to="/$locale/about" params={{ locale }}>` with the locale from `useLocale()`.
- **The project has no locale in its URLs** (cookie-only or single-locale) — leave every `href` and `to` exactly as it is. There is nothing to prefix.

When wrapping strings in a file whose links look wrong for the project's strategy, fix the label and **flag the link** rather than silently rewriting routing — say which file and which `href`.

> **Translator comments:** Use the object form `msg({ message: \`...\`, comment: "..." })` when a string is ambiguous — short words like "Dashboard" benefit from context like "Main navigation sidebar" so translators know the UI location.

## Data modules (plans, products, reviews, FAQs)

The same pattern applies to any exported array of records. **Convert the data module in place and keep its shape**: each display field becomes a `MessageDescriptor` (`msg`), its type changes from `string` to `MessageDescriptor`, and every component that renders the field resolves it with `t(record.field)` (or `i18n._(record.field)`). Non-copy fields — `id`, `slug`, prices, counts, author names — stay as they are.

```ts
// src/data/plans.ts — before: name: 'Starter'
import { msg } from '@lingui/core/macro'
import type { MessageDescriptor } from '@lingui/core'
export type Plan = { id: string; name: MessageDescriptor; bagsPerMonth: number; priceEur: number }
export const plans: Plan[] = [
  { id: 'starter', name: msg({ message: 'Starter', comment: 'Subscription plan name' }), bagsPerMonth: 1, priceEur: 14.5 },
]
```

**Never unroll the records into components** — replacing `plans.map(...)` with one hand-written `<PlanCard>` per plan, or copying each record's text into JSX `<Trans>`. It looks translated, but the data module is now dead or out of sync, adding a plan means editing a component, and every value derived from a record (`title={…plan.name…}`) is left behind. Values computed from a record go through a local variable so the placeholder gets a name: `const name = t(plan.name)` then `` t`Choose the ${name} plan` ``.

**Wrapping preserves the original copy, dynamic parts included.** `title={"Select the " + plan.name + " plan"}` becomes `` title={t`Select the ${name} plan`} `` — one message with a `{name}` placeholder — not a shortened `` t`Select plan` ``. Never reword, shorten or drop a value while wrapping.

**Before you mark a file done**, re-check it against the *Anti-patterns* section of `.agents/globalize-rules.md` — plural ternaries, `${x}` in plain strings, unwrapped `title` / `aria-label` / `placeholder` / `alt`, markup split out of a `<Trans>`, locale-less or hardcoded-locale formatting, unused imports, and reformatted lines you did not need to touch.

---

## Document title and meta description (client-rendered pages)

On a client-rendered page (every Vite variant, any router or none), set both from **one effect keyed on the locale**, with `t` from `useLingui()`. Copy this shape exactly:

```tsx
import { useEffect } from 'react'
import { useLingui } from '@lingui/react/macro'

function PricingPage() {
  const { t, i18n } = useLingui()

  useEffect(() => {
    document.title = t({ message: `Pricing`, comment: 'Browser tab title of the pricing page' })
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t`Compare plans and pick the one that fits your team.`)
  }, [t, i18n.locale])

  // ...
}
```

**On every router, `<title>` and the meta description are copy.** Resolve both from messages. Where the app renders `<title>` / `<meta name="description">` elements, give them `t` values like any other copy; where it sets them imperatively, use the effect above, so a locale switch updates them.

- **`t` from `useLingui()`**, never the standalone `t` from `@lingui/core/macro` and never a module-scope constant — those resolve once, before the user's locale is active, and never again.
- **Deps `[t, i18n.locale]`.** The effect must re-run when the user switches language, or the tab keeps the old title. `t`'s identity changes with the active locale and catalog, so it is a safe dependency; `i18n.locale` states the intent.
- **Never `` _(t`…`) ``, `` i18n._(t`…`) `` or `` t(t`…`) ``.** `t` already returns the translated string. Feeding it back in looks that *translated text* up as a message ID — at best a pointless no-op, and it reads as if something else were being translated.
- **`index.html` keeps its static `<title>` and `<meta name="description">`** in the source locale as the pre-JavaScript fallback. If it has no description meta, add one there — the effect updates an existing element and does nothing when there is none.
- Put the effect in the page component (or a small `usePageMeta(title, description)` hook taking `MessageDescriptor`s and resolving them with `t(descriptor)` inside the same effect). One title per page — not in shared layout components that every page renders.

**Server-rendered frameworks** (TanStack Start, React Router framework mode, Remix) set the title through the framework's own head/meta API — the route `head()` option on TanStack Start, the `meta` export on React Router framework mode and Remix — so it is in the server HTML, rather than this client effect. The `` _(t`…`) `` ban applies there too.

---

## Form validation messages

Form validators typically run outside React render (in schema definitions or event handlers). Use `msg` for schema-level messages and resolve them in the component, or use `t` from `@lingui/core/macro` in utility functions that run within the i18n context.

```tsx
// In a Zod schema — use msg and resolve at render time
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { z } from 'zod'
import type { MessageDescriptor } from '@lingui/core'

const fieldErrors = {
  required: msg`This field is required`,
  email: msg`Enter a valid email address`,
  minLength: msg`Must be at least 8 characters`,
} satisfies Record<string, MessageDescriptor>

function SignUpForm() {
  const { t } = useLingui()

  function validate(value: string) {
    if (!value) return t(fieldErrors.required)
    if (value.length < 8) return t(fieldErrors.minLength)
    return null
  }

  // ...
}
```

---

## Toast and notification messages

Toast libraries like `react-hot-toast`, `sonner`, or `react-toastify` accept strings. Call `t` inside the event handler (which runs inside a component context via closures).

```tsx
import { useLingui } from '@lingui/react/macro'
import { toast } from 'sonner'

function SaveButton() {
  const { t } = useLingui()

  async function handleSave() {
    try {
      await save()
      toast.success(t`Changes saved successfully`)
    } catch {
      toast.error(t`Failed to save changes. Please try again.`)
    }
  }

  return <button onClick={handleSave}><Trans>Save</Trans></button>
}
```

---

## Ionic components (Ionic React)

Ionic text props take plain strings, so use `t` from `useLingui()`, not `<Trans>`:

```tsx
const { t } = useLingui()
<IonInput label={t`Email`} placeholder={t`you@example.com`} />
<IonBackButton text={t`Back`} defaultHref="/" />
```

Overlay hooks and controllers take option objects — wrap every user-visible field:

```tsx
const [presentAlert] = useIonAlert()
const [presentToast] = useIonToast()
presentAlert({
  header: t`Remove item?`,
  buttons: [{ text: t`Cancel`, role: 'cancel' }, { text: t`Remove`, role: 'destructive' }],
})
presentToast({ message: t`Item removed`, duration: 1500 })
```

Never set `backButtonText` in `setupIonicReact({...})` — it is one untranslated string.

---

## Mechanical self-checks

Reading the rules is not enough — run these. Each one targets a mistake that survives a clean build and a passing typecheck.

### Per file, before you mark it done (wrap subagents)

**Unused imports.** A `Trans`, `useLingui` or `msg` import you added but did not use, or an import your edit orphaned (the old copy constant, a helper you inlined). Run the project's own TypeScript against the files you touched — `tsconfig.app.json` on Vite templates, whose root `tsconfig.json` only holds references:

```bash
TSC=tsconfig.app.json; [ -f "$TSC" ] || TSC=tsconfig.json
npx --no-install tsc --noEmit -p "$TSC" --noUnusedLocals 2>&1 \
  | grep -E 'error TS(6133|6192|6196)' | grep -F 'src/components/Pricing.tsx'   # ← the file you just wrapped
```

It must print nothing. Remove what it lists — only imports and locals your edit added or orphaned; leave pre-existing unused code alone and mention it. Plain-JS projects: run the project's ESLint `no-unused-vars` on the file instead, if it has one.

**Read your diff back** for the three rules no grep can judge: the value each element shows is the one it showed before (see *Changing existing code* in the coding rules), list `key`s are unchanged or `descriptor.id` — never the index — and no text inside a `<Trans>` child tag is wrapped a second time (`` <Trans>Read <a _t="terms" href="/terms">{t`the terms`}</a></Trans> `` must be `<Trans>Read <a _t="terms" href="/terms">the terms</a></Trans>`; text attributes on those tags — `title`, `aria-label`, `alt` — are separate strings and keep their own `t`).

### Over the extracted catalog (verify subagent, after `lingui extract`)

Run against every **source-locale** `.po` — the single catalog's `<source>/messages.po`, or on per-page layouts every `locales/*/<source>.po` (`find <source root> -path '*/locales/*' -name '<source>.po'`). The `Catalogs:` line of `.agents/globalize-rules.md` names the path.

```bash
node --input-type=module -e '
import { readFileSync } from "node:fs"
let fail = 0, review = 0
const say = (kind, id, f) => console.log(`${kind}: ${JSON.stringify(id)}  (${f})`)
for (const f of process.argv.slice(1)) {
  for (const entry of readFileSync(f, "utf8").split(/\n[ \t]*\n/)) {
    const lines = entry.split("\n")
    const at = lines.findIndex((l) => l.startsWith("msgid "))
    if (at < 0) continue
    let id = JSON.parse(lines[at].slice(6))
    for (let i = at + 1; lines[i]?.startsWith("\""); i++) id += JSON.parse(lines[i])
    if (!id) continue // PO header
    const commented = lines.some((l) => l.startsWith("#. ") && !l.startsWith("#. js-lingui-"))
    if (/\{\d+[,}]/.test(id)) { fail++; say("FAIL positional placeholder", id, f) }
    if (/<\/?\d+\/?>/.test(id)) { fail++; say("FAIL unnamed tag inside <Trans>", id, f) }
    if (/^[\p{L}\p{N}&\x27’-]+[.!?:…]*$/u.test(id) && !commented) { fail++; say("FAIL single word without comment", id, f) }
    if (/\{\w+\}\s+\p{L}+s\b/u.test(id) && !/, *plural,/.test(id)) { review++; say("REVIEW count next to a plural noun", id, f) }
  }
}
console.log(`${fail} failure(s), ${review} to review`)
process.exit(fail ? 1 : 0)
' src/locales/en/messages.po   # ← every source-locale .po (see below)
```

| Result | Meaning | Fix (in the source file, then re-extract) |
|---|---|---|
| `FAIL positional placeholder` | `{0}`, `{1, plural, …}`: an interpolated property access, function call, or arithmetic — or a `t` / `<Trans>` nested inside a `<Trans>`, which leaves the parent with a `{0}` hole | Name it with `ph({ total: … })` or a local variable; unwrap a nested `t`/`<Trans>` so its text joins the parent message; give `<Plural value>` a named variable |
| `FAIL unnamed tag inside <Trans>` | `<0>terms</0>`: an inline JSX tag with no `_t` name | Add `_t="<name>"` to the tag (`<a _t="terms" href="/terms">`). If `_t` shows up in the rendered DOM, `macro.jsxPlaceholderAttribute` is missing from `lingui.config.ts` |
| `FAIL single word without comment` | A one-word message with no translator comment | Add `comment` per the coding rules — every single word, however obvious it looks |
| `REVIEW count next to a plural noun` | `{n} reviews`-shaped text outside an ICU plural | If the variable is a count, convert to `<Plural>` / ICU plural. If it is not (`{name} logs in`), leave it and note it |

Iterate until it prints `0 failure(s)` and exits 0, re-running `lingui extract` after each round of source fixes. Then run the unused-imports check once over **every** file the convert phase touched:

```bash
TSC=tsconfig.app.json; [ -f "$TSC" ] || TSC=tsconfig.json
npx --no-install tsc --noEmit -p "$TSC" --noUnusedLocals 2>&1 | grep -E 'error TS(6133|6192|6196)' \
  | grep -F -f <(git diff --name-only; git ls-files --others --exclude-standard)
```

---

## Numbers, currencies, and dates

**Call the project's formatters module.** Phase 2 created it (`generate_format_helpers`) and
`.agents/globalize-rules.md` carries its real import specifier. Do **not** reach for `i18n.number()` /
`i18n.date()` off the Lingui instance, and never construct `Intl` at a call site — both bypass the
module's currency default, its date presets and its formatting-locale seam.

```tsx
import { useFormatters } from '<the specifier from .agents/globalize-rules.md>'

function PriceDisplay({ amount }: { amount: number }) {
  const f = useFormatters()
  return <span>{f.money(amount)}</span>
}

function EventDate({ timestamp }: { timestamp: number }) {
  const f = useFormatters()
  return <time>{f.date(timestamp)}</time>
}
```

In non-component code — loaders, route handlers, server code, tests — there is no React context, so use
the non-hook form with an explicit locale:

```ts
import { getFormatters } from '<the specifier from .agents/globalize-rules.md>'

const f = getFormatters(locale)
const formatted = f.money(amount)
const date = f.date(timestamp)
```

The ten helpers are `money`, `number`, `percent`, `compact`, `unit`, `date`, `time`, `dateTime`,
`relativeTime`, `list`. If a value needs a shape none of them produce, add a preset to the module —
do not inline an options object at the call site.

For the full find-and-replace table (`'$' + price`, `toFixed(2)`, `toLocaleDateString()`, `dayjs().format()`,
`join(', ')`, …), what must never be converted, and the ordering rule, follow
`references/languages/js-ts/convert.format-pass.md`.
