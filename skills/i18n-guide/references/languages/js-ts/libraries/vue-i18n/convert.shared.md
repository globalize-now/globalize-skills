# vue-i18n String Wrapping

This convert phase finds hardcoded user-facing strings in a Vue 3 project and wraps them with the right vue-i18n API — `{{ t('key') }}` in templates, `:attr="t('key')"` on attributes, `<i18n-t>` for rich text, `n()` / `d()` for numbers and dates. It also identifies localization gaps: numbers, currencies, dates, and plurals that need locale-aware handling.

> **Scope:** This convert phase converts strings to make them translatable — it does not translate content. All strings remain in the source language after conversion.

## Out of Scope

- **Vue 2** — this convert phase only targets Vue 3 + vue-i18n v11. Run the setup phase to confirm the project is on Vue 3 before invoking convert.
- **Options-API-only files** — SFCs without `<script setup>` are warned and skipped (collected into a manual-follow-up list). This convert phase does not auto-migrate Options API to Composition API.
- **SFC `<i18n>` custom blocks** — the setup deliberately avoids them; convert never writes them.
- **Non-ICU message syntax** — vue-i18n's native pipe-plural (`"one | many"`) is never emitted. All plurals are ICU.
- **Nuxt `server/api/*` routes** — server-only code without access to `useI18n()` / `$i18n`. These are flagged in the gap report; localize via `accept-language` header handling out of scope here.
- **Translating content** — the skill writes source-language text into catalog entries; target-locale files get placeholder copies.

---

## Step 1: Prerequisite Check

Before wrapping anything, verify vue-i18n is configured with the ICU pipeline setup installs. If any check fails, stop and tell the user to run the setup phase first. This phase never installs packages or modifies build configuration.

Checks:

1. **Runtime package present.**
   - Vite SPA / Quasar: `vue-i18n` in `package.json` `dependencies`.
   - Nuxt: `@nuxtjs/i18n` in `package.json` `dependencies`.
2. **ICU runtime present.** `intl-messageformat` in `dependencies` (used by the custom `messageCompiler`).
3. **i18n instance file exists.**
   - Vite / Quasar: `src/i18n/index.{ts,js,mts,mjs}` or similar (`src/i18n/` is the convention from setup).
   - Nuxt 3: `i18n.config.{ts,js,mts,mjs}` at project root.
   - Nuxt 4: `i18n/i18n.config.{ts,js,mts,mjs}`.
4. **ICU compiler wired.** The `createI18n(` (Vite / Quasar) or `defineI18nConfig(() => (` (Nuxt) call includes both:
   - `legacy: false`
   - A `messageCompiler` reference (name it `messageCompiler` or similar)

   If `messageCompiler` is missing, the project is on vue-i18n's default pipe-plural syntax, which conflicts with what this convert phase emits. Hard-stop: tell the user to re-run the setup phase to switch to ICU.
5. **Catalogs exist.** At least one catalog file under the variant's locales directory:
   - Vite / Quasar: `src/i18n/locales/{locale}.{json,po}`
   - Nuxt 3: `locales/{locale}.{json,po}`
   - Nuxt 4: `i18n/locales/{locale}.{json,po}`
6. **Provider wired.**
   - Vite: `app.use(i18n)` in `src/main.*`.
   - Quasar: boot file registered (`boot: ['i18n']` in `quasar.config.*`).
   - Nuxt: `@nuxtjs/i18n` listed in `modules` (not `buildModules`) in `nuxt.config.*`.

If all checks pass, proceed to Step 2. Otherwise, hard-stop with a specific message naming the missing piece and pointing at the setup phase.

---

## Step 2: Detect the Project

Read `package.json`, build config (`vite.config.*`, `nuxt.config.*`, `quasar.config.*`), and the project directory layout to record:

| Signal | How to detect |
|--------|--------------|
| **Framework** | `nuxt` in deps → Nuxt. `quasar` in deps → Quasar. `vite` in devDeps + `vue` in deps (none of the above) → Vite SPA. |
| **Nuxt version** | Parse `nuxt` semver major if present (3 vs 4). Affects locales-dir path. |
| **API style** | Grep `<script setup>` vs `export default { }` across `.vue` files. Values: `composition` (all SFCs use `<script setup>`), `mixed` (some of each), `options-only` (no `<script setup>` found). |
| **TypeScript** | `typescript` in devDeps or `tsconfig.json` exists. |
| **Package manager** | `package-lock.json` → npm; `yarn.lock` → yarn; `pnpm-lock.yaml` → pnpm; `bun.lock*` → bun. |
| **Router (Vite only)** | `vue-router` in deps. If present, grep for `createRouter(` to locate the route table. Check for a `localePath` helper in `src/i18n/localePath.ts` — its presence means setup wired Strategy 1 or 2. |
| **Source locale** | Read `sourceLocale` from `src/i18n/locales.ts` (Vite/Quasar) or `defaultLocale` from `nuxt.config.*` (Nuxt). Fall back to first entry of `locales` if neither is explicit. |
| **All locales** | Same file(s) — the full list drives which catalog files get new entries. |

### Catalog-format detection

Resolve `catalogFormat: 'json' | 'po'` in this order — first match wins:

1. Files in the locales directory are **all `.json`** → `'json'`.
2. Files in the locales directory are **all `.po`** → `'po'`.
3. `gettext-parser` in `devDependencies` **and** a `poLoader` import appears in the build config (`vite.config.*` / `nuxt.config.*` / `quasar.config.*`) → `'po'`.
4. **Mixed or ambiguous** → prompt the user. Do not guess.

Record `catalogFormat`. Steps 7, 8, 9, and 10 branch on this value.

### Options-API handling

Record `apiStyle` explicitly — it drives which files get wrapped:

- `composition` → full support. All SFCs get converted.
- `mixed` → `<script setup>` SFCs get converted. Options-API SFCs are collected into a "manual follow-up" list surfaced at the end. Do not rewrite Options-API files automatically (see the vue-i18n coding rules' stance).
- `options-only` → **hard-stop**. Tell the user: "This project uses Vue 3 Options API throughout — no `<script setup>` blocks detected. the vue-i18n coding rules and the convert phase target the Composition API. vue-i18n v11 still supports Options API via `this.$t`, but it's deprecated and scheduled for removal in v12. Recommended: migrate at least one component to `<script setup>` first, then re-run this convert phase." Do not proceed.

### Variant dispatch

Based on `framework` and `catalogFormat`, read the relevant reference files:

- **Vite SPA** → `references/languages/js-ts/frameworks/vite/vue/vue-i18n.convert.md`
- **Nuxt** → `references/languages/js-ts/frameworks/nuxt/vue-i18n.convert.md`
- **Quasar** → `references/languages/js-ts/frameworks/quasar/vue-i18n.convert.md`
- **`catalogFormat === 'po'`** → also read `references/languages/js-ts/libraries/vue-i18n/po-format.convert.md` for PO-specific entry format, `msgctxt` handling, merge algorithm, and subagent output shape.

---

## Step 3: Detect App Domain

Before wrapping strings, understand what the app does. A word like "Track" needs different comments in a music app vs. a shipping app. With PO catalogs, we write these comments into the `#.` description field directly — with JSON, into the `$<key>` sibling convention (see Step 7). Either way, the comment quality comes from the domain knowledge captured here.

1. **Infer** the domain from signals already available:
   - `package.json` `description` field
   - `package.json` `name` (when `description` is missing)
   - README first paragraph (`README.md`, `README.mdx`, `README` — first heading plus first body paragraph)
   - Route names (e.g., `/checkout`, `/patients`, `/fleet`)
   - Component names (e.g., `ParkingSpotCard`, `PatientList`) — pick the three most-imported components as the highest-signal sample
   - Nuxt `app.head.title` or `index.html` `<title>` (Vite/Quasar)

2. **Confirm** with the user: *"This looks like a [parking management app]. I'll use this to write better translator comments — for example, 'Park' will get a comment clarifying it means a parking area, not a nature park. Is that right?"*

3. **Carry forward** the domain as context for the rest of the workflow. No config file — just context for this session.

### Unguided defaults

In unguided mode, do **not** block on the confirmation prompt. Apply the inferred domain and record the string used in the final summary so the user can correct it in a follow-up:

| Choice | Unguided default | Rationale |
|--------|------------------|-----------|
| **App domain** | Inferred from the signals above (descriptor order: `package.json description` → `package.json name` → README first paragraph → top-3 most-imported component filenames) | Non-blocking — the domain string is used for translator comments, never as a correctness gate. Surfacing it in the summary lets the user fix catalogs in one pass if the inference was off. |
| **Comment style** | Follow the catalog format set at setup time (`#.` for PO, `$<key>` for JSON) | No per-convert override; consistency with the existing catalog matters more. |
| **Low-signal inputs** | If all signals are empty, use the literal string `general-purpose web app` | Clearly placeholder; surfaces in the summary as a prompt to fix. |

In guided mode, continue to prompt at step 2 as before.

---

## Step 4: Composable Decision Tree

Choose the right API for each situation. This is the wrapping-time view of the rules the vue-i18n coding rules enforce at authoring time.

```
Is this a template text node (between tags, e.g. <p>Hello</p>)?
  YES → {{ t('key') }}
        Ensure `const { t } = useI18n()` is present in <script setup>.
        Add the useI18n() destructure if missing (and add `import { useI18n } from 'vue-i18n'`).

Is this an attribute value (placeholder, alt, title, aria-label, value)?
  YES → Bind with a colon: :placeholder="t('key')"
        Forgetting the colon is the top mistake — `placeholder="t('key')"` renders
        the literal string `t('key')` in the DOM.

Is this rich text with embedded HTML or components (a link inside a sentence,
a <strong> inside a paragraph)?
  YES → <i18n-t keypath="..." tag="p"> with named slots
        Never use v-html with t() output — XSS risk and interpolated children
        lose reactivity.

Is this a string inside <script setup>?
  YES → const { t } = useI18n(); t('key')

Is this a string in a composable (src/composables/*.ts) or Pinia store?
  YES → useI18n() if the composable is always called from setup (the common case).
        For helpers that may run after teardown (async callbacks, plain utilities),
        import the global instance: import { i18n } from '@/i18n'; i18n.global.t('key').

Is this a string in a plain .ts utility, Nuxt plugin, or Nuxt middleware?
  YES (Vite/Quasar) → import { i18n } from '@/i18n'; i18n.global.t('key')
  YES (Nuxt plugin/middleware) → const { $i18n } = useNuxtApp(); $i18n.t('key')
  YES (Nuxt server/api/*) → OUT OF SCOPE. Flag for manual follow-up; server routes
        don't share the client-side vue-i18n instance.

Is this in an Options API .vue file (no <script setup>)?
  YES → SKIP. Record in the manual-follow-up list surfaced at the end.
```

Check the attribute-binding question carefully. The colon is easy to miss during wrapping and silently breaks the translation.

### Import reference table

| What you need | Import | Context |
|---|---|---|
| `t`, `n`, `d`, `locale`, `availableLocales` | `import { useI18n } from 'vue-i18n'` | Inside `<script setup>` or a composable called from setup |
| Global i18n instance | `import { i18n } from '@/i18n'` (Vite/Quasar) | Module-level code, plain `.ts` utilities, async callbacks |
| Nuxt global instance | `const { $i18n } = useNuxtApp()` | Nuxt plugins, middleware, anywhere outside setup |
| `<i18n-t>` component | Auto-registered globally by `app.use(i18n)` / the Nuxt module | Any template |

---

## Step 5: Localization Gap Detection

Scan `.vue` and `.ts` files systematically. Apply the confidence tiers to decide what to flag.

### Always flag (high confidence)

- **Bare template text.** Any user-visible text between tags that is not already inside `{{ t(…) }}` / `{{ n(…) }}` / `{{ d(…) }}` / `<i18n-t>`.
  ```vue
  <h1>Welcome</h1>                    <!-- flag -->
  <h1>{{ t('HomePage.title') }}</h1>  <!-- ok -->
  ```

- **Unbound user-visible attributes.** An attribute with a raw string value where a bound (`:` prefix) `t(...)` expression is expected.
  - `placeholder="..."` — input placeholder
  - `aria-label="..."` — screen-reader label
  - `title="..."` — tooltip text
  - `alt="..."` — image alt (when descriptive, not decorative)
  - `value="..."` on a `<button>` or `<input type="submit">`

- **Concatenated strings near the UI.** User-visible messages built from `+` or template literals.
  ```vue
  <script setup lang="ts">
  const msg = 'Hello ' + name + '!'  // flag — use t('greeting', { name })
  </script>
  ```

- **Count-dependent phrasing — plural candidates.** Any UI string combining a number (literal, variable, prop, or expression) with wording that changes based on that number. This is the most commonly-missed gap — do not wrap these in a plain `t('key')`. Route them to Step 6.
  ```vue
  <p>You have 3 new messages</p>                 <!-- flag — plural -->
  <span>{{ `${count} items` }}</span>            <!-- flag — plural -->
  <div>{{ items.length }} results</div>          <!-- flag — plural -->

  <!-- Wrong: plain t() bakes English plural rules into the message -->
  <p>{{ t('Cart.itemsSelected', { count }) }}</p>
  <!-- with catalog: "itemsSelected": "{count} items selected" -->

  <!-- Right: ICU plural in the catalog, same t() call site -->
  <p>{{ t('Cart.itemsSelected', { count }) }}</p>
  <!-- with catalog: "itemsSelected": "{count, plural, one {# item selected} other {# items selected}}" -->
  ```
  Also flag `count === 1 ? t('item') : t('items')` ternaries — two keys cannot express plural rules in other languages. Rewrite as a single ICU plural message.

- **Imported strings referenced in templates.** `<h1>{{ title }}</h1>` where `title` is an imported identifier. Trace the import to its definition; if it resolves to a bare string literal (e.g. `export const title = 'Welcome'`), flag it.

  **Disambiguation — a template expression `{{ foo }}` can be:**
  1. An import resolving to a string literal in another module → **flag** (see resolution below)
  2. A prop passed from a parent → **skip** (the parent wraps it on its own turn)
  3. A local variable or ref → **handle at the assignment site in the same SFC**
  4. A formatted or computed value (`{{ n(price) }}`, `{{ count + 1 }}`) → **not a string** — handle the underlying data, not the expression

  **Resolution in Vue:** vue-i18n has no `msg`-descriptor equivalent (same constraint as next-intl). Pick one:
  - **Pull the string into the component** that renders it. Replace `<h1>{{ title }}</h1>` with `<h1>{{ t('HomePage.title') }}</h1>` and add the entry to the catalog. Delete the export if nothing else uses it.
  - **Keep a key constant** if the string is genuinely shared across components: `export const titleKey = 'Common.pageTitle'` and call `t(titleKey)` at the render sites. The value lives in the catalog, not the TS module.

  **Do not** destructure `t` at module top level (e.g. `const { t } = useI18n(); export const label = t('…')`). That freezes the locale binding — `vue-code`'s reactivity-pitfall rule applies here during conversion too.

- **`v-html` on user-visible content.** The HTML would need to either (a) become a `<i18n-t>` block with named slots or (b) stay as `v-html` while the underlying content gets sourced from `t()`. Flag for manual review — auto-rewriting `v-html` to `t()` is unsafe (escapes differ; XSS surface changes).

- **Module-scope `Intl.*Format` constants.** `const X = new Intl.NumberFormat('en-US', {...})` (or `DateTimeFormat`, `RelativeTimeFormat`, `ListFormat`) defined outside any component. These capture the locale at module evaluation time and never react to `useI18n().locale.value` changes — switching locales in the app still renders numbers/dates in the original locale, and any locale string hardcoded as the first argument pins it further.

  ```ts
  // ← flag — module-scope, fixed locale, not reactive to locale changes
  const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
  export function formatPrice(amount: number) {
    return USD.format(amount)
  }
  ```

  **Recipe**: move the formatting into the component via vue-i18n's `n()` / `d()` helpers — they read the current locale from the i18n instance and stay reactive:

  ```vue
  <script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  const { n } = useI18n({ useScope: 'global' })
  defineProps<{ amount: number }>()
  </script>

  <template>
    <span>{{ n(amount, 'currency') }}</span>
  </template>
  ```

  Requires `numberFormats.{locale}.currency` to be registered on the i18n instance (seeded in setup Step 3). If the format isn't registered yet, either (a) register it alongside the conversion edit, or (b) fall back to `n(amount, { style: 'currency', currency: 'USD' })` as an inline format. Do not reintroduce `new Intl.NumberFormat(locale.value, ...)` inside the component — `n()` and `d()` already delegate to those APIs, caching per-locale.

  **After wrapping — remove the now-dead helpers.** Once all call-sites use `n()` / `d()` (or an ICU `plural` / `select` key in the catalog), the hand-rolled helpers that encoded the same logic — module-scope `new Intl.NumberFormat(...)` / `new Intl.DateTimeFormat(...)` constants, `pluralizeItems`, `replyLine`, any format-switch `if/else` bodies — become dead code. Delete them together with their imports. Leaving them gives the appearance of duplicate sources of truth; removing them confirms the migration is complete. Grep for the helper's name (or `new Intl.NumberFormat` / `new Intl.DateTimeFormat` at module scope) to verify no stragglers remain.

### Flag with judgment (medium confidence)

Review these and wrap only if they appear in the UI:

- **`toFixed()` and number formatting**: Raw `toFixed()` won't respect locale decimal separators. Use `n()` with a named format registered on the i18n instance.
- **Currency symbols hardcoded near numbers**: `'$' + price` or `price + ' USD'` — use `n(price, 'currency')` with a `currency` format like `{ style: 'currency', currency: 'USD' }`. If no currency format is registered, warn the user — setup Step 3 seeds a baseline.
- **Date formatting without locale**: `date.toLocaleDateString()` without a locale argument is runtime-dependent; explicit format strings (`'MM/DD/YYYY'`) are not locale-aware. Use `d(date, 'short' | 'long')`.
- **`new Intl.NumberFormat(...)` inside components**: Prefer `n()` so locale changes are reactive.
- **Toast / notification / error messages shown to users**: Strings in `toast()` / `notify()` / `$q.notify()` calls, or in `throw new Error(...)` that surfaces in the UI.

### Never flag (skip these)

- CSS class names: `:class="[...]"`, `class="text-red-500 font-bold"`
- `console.*` strings, dev-only log messages
- Import paths
- Object keys and property names
- Regex literals
- Test IDs: `data-testid="submit-btn"`
- `ALL_CAPS` constants used as enum values or internal codes
- URL strings, API endpoints
- Developer-facing error messages (not surfaced to end users)
- Long-form prose: article bodies, blog posts, changelogs, legal copy (ToS, privacy policy). These are content, not UI — they need a content-localization strategy, not string wrapping. Still wrap UI elements in the same files (buttons, labels, navigation, form fields).

---

## Step 6: Plurals, Select, SelectOrdinal

ICU MessageFormat handles plurals, gender selection, and ordinal positions. This is the most commonly-misused feature — get it right the first time. Never use vue-i18n's native pipe-plural syntax (`"one | many"`); it bakes English plural rules into source strings.

**Framework gate — check before writing.** If Step 1 detected `framework === 'nuxt'` AND `catalogFormat === 'json'` AND the project uses `@nuxtjs/i18n` with the default `langDir` + `lazy` setup, DO NOT write ICU `plural` / `select` / `selectordinal` keywords into the JSON catalog. Nuxt's default JSON pre-compiler (via `@intlify/unplugin-vue-i18n`) cannot parse ICU keywords at build time and fails the entire locale file — users see the breakage the first time they ship a plural. Route ICU messages to SFC `<i18n>` custom blocks in the consuming component instead, and keep JSON entries interpolation-only (`{count}`, `{name}`). See `references/languages/js-ts/frameworks/nuxt/vue-i18n.convert.md` § "When you hit ICU" for the decision recipe and a copy-paste example. The escape hatches (static imports, build-config changes) all require user consent — surface them, do not apply silently.

### Plurals

Template:
```vue
<p>{{ t('Cart.items', { count }) }}</p>
```

Catalog (JSON):
```json
{ "Cart": { "items": "{count, plural, one {# item selected} other {# items selected}}" } }
```

Catalog (PO):
```
#. Cart footer — number of items currently selected
#: src/components/Cart.vue:42
msgid "Cart.items"
msgstr "{count, plural, one {# item selected} other {# items selected}}"
```

The named variable `count` triggers plural selection when the catalog value is an ICU plural. `#` is the count placeholder inside each branch — do not repeat the variable name.

**Exact match for zero:**
```
{count, plural, =0 {No items} one {# item} other {# items}}
```

### Select (gender, enumerated values)

```vue
<p>{{ t('Feed.liked', { gender: user.gender }) }}</p>
```

Catalog:
```json
{ "Feed": { "liked": "{gender, select, male {He liked your post} female {She liked your post} other {They liked your post}}" } }
```

### SelectOrdinal (1st, 2nd, 3rd)

```vue
<p>{{ t('Race.finish', { position }) }}</p>
```

Catalog:
```json
{ "Race": { "finish": "You finished {position, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}" } }
```

English ordinal categories (`one`, `two`, `few`, `other`) differ from English cardinal (`one`, `other`). Always include `other`.

### Rich text with embedded components

Use `<i18n-t>` with named slots. The catalog value contains `{slotName}` placeholders; the template binds each slot to a component or element.

```vue
<i18n-t keypath="Legal.terms" tag="p">
  <template #link>
    <RouterLink to="/terms">{{ t('Legal.termsLink') }}</RouterLink>
  </template>
</i18n-t>
```

Catalog:
```json
{ "Legal": {
    "terms": "By signing up you agree to our {link}.",
    "termsLink": "terms of service"
}}
```

Never mix `v-html` with `t()` output.

### CLDR plural categories

Different languages have different plural forms. English uses `one` and `other`; other languages add `zero`, `two`, `few`, `many`. Always include `other` — it is required and serves as the fallback.

| Category | Meaning | When used |
|----------|---------|-----------|
| `zero` | 0 items | Arabic, Welsh |
| `one` | 1 item | Most languages |
| `two` | 2 items | Arabic, Welsh |
| `few` | Small number | Slavic languages, Arabic |
| `many` | Large number | Some languages |
| `other` | **Always required** | Default fallback |

### Top 5 mistakes

1. **Missing `other`**: Every plural/select must have `other`. Without it, `intl-messageformat` throws at render time.
2. **Using `zero` for English**: English has no `zero` category. Use `=0` for exact zero matching, or let `other` handle zero counts.
3. **Forgetting `#`**: The `#` is replaced by the count. Writing `{count, plural, one {count item} …}` is wrong.
4. **Wrong category names**: Categories are `zero`, `one`, `two`, `few`, `many`, `other` — not `singular`, `plural`, `multiple`.
5. **Fragmenting plural branches**: `count === 1 ? t('item') : t('items')` makes two keys. Use one ICU message: `t('items', { count })` with `"{count, plural, one {# item} other {# items}}"`.

---

## Step 7: Namespacing, Keys, and Comments

Catalogs are organized by **namespace**. Shared rules apply to both JSON and PO; the storage format differs.

### Shared rules

- **Top-level segment = namespace.** PascalCase, matching the component domain: `HomePage`, `Navigation`, `Common`, `Auth`, `Dashboard`.
- **Max 2 levels of nesting.** `Auth.login.title` is fine; `Auth.pages.login.fields.email.label` is not.
- **Shared strings live under `Common`.** Buttons, labels, and status text reused across pages belong in `Common.save`, `Common.cancel`, etc.
- **Semantic keys, not copy-literal keys.** `HomePage.title` / `HomePage.subtitle` / `HomePage.cta` — not `HomePage.welcomeBack`. Translators edit values; keys should not need renaming when copy changes.
- **Access via dot-path.** `t('HomePage.title')` works in both formats — vue-i18n's default resolver walks nested objects, and the PO loader re-hydrates dot-paths into the same nested shape.

### Choosing a namespace for new strings

1. Does this component already call `useI18n()` and use keys in an existing namespace? → Add to that namespace.
2. Is this a shared component reused across pages? → `Common` or a domain-specific shared namespace.
3. Is this a page component? → Create a namespace matching the page name (`Dashboard`, `Settings`, `Checkout`).
4. Is this a feature-specific component? → Use the feature as the namespace (`Cart`, `ProductList`).

### When `catalogFormat === 'json'`

Write entries into `locales/{locale}.json` as a nested object:

```json
{
  "HomePage": {
    "title": "Welcome",
    "subtitle": "Get started below",
    "cta": "Sign up"
  },
  "Common": {
    "save": "Save",
    "cancel": "Cancel"
  }
}
```

**Translator comments are not first-class in JSON catalogs**, and the skill does **not** emit them inline by default. vue-i18n JSON catalogs have no standard comment mechanism — any sibling-key convention (like `"$save": "comment"`) is seen as a translatable string by most TMSes: they charge to translate it, ship the comment into every target-locale file, and make it possible to render a translated comment if a call site mistakenly references `$save`. That's a real cost, not just a stylistic concern. The skill therefore handles ambiguous strings in JSON mode with one of three strategies in priority order:

1. **Rename to a disambiguating key.** The cleanest answer for single-word ambiguity: instead of `Common.save` + `$save: "editor toolbar context"`, use `DocEditor.saveToolbar` as the key. Semantic keys outlive copy edits and make context obvious from the key alone. Default to this when the ambiguity is a missing object ("Save what?" → rename to name the object) or a domain-sensitive term.
2. **Switch to PO.** If the project needs systematic translator context across many strings, PO is the right format. Offer to re-run the setup phase to switch: "You have N ambiguous keys that would benefit from translator comments. PO catalogs support `#.` description comments that TMSes pass to translators without adding cost. Switch now? (This rewrites your catalog and takes ~30 seconds.)"
3. **Opt-in adjacent comments file.** As a last resort, write comments to a sibling file that never ships to the TMS: `locales/{locale}.comments.json` keyed by the same dot-path. The skill only creates this file on explicit request (`"Save comments to a separate file?"` prompt) — it's not shipped by default because most TMS / translation pipelines won't read it, which means translators don't actually receive the context.

**Do not emit `$`-prefixed sibling keys** in the generated JSON catalog. It looks like a comment mechanism but behaves like a translatable string in every downstream tool.

**Disambiguation in JSON**: no `msgctxt` equivalent. When the same English needs different translations in different places, use distinct keys (`Common.right.direction` and `Common.right.correctness`) so the two entries translate independently — this is the same rename-to-disambiguate rule as (1) above.

### When `catalogFormat === 'po'`

Write entries as PO blocks with `msgid` = dot-path. See `references/languages/js-ts/libraries/vue-i18n/po-format.convert.md` for the full entry format, ICU-in-msgstr examples, and merge algorithm.

Each new entry includes:
- `msgid` = dot-path (`HomePage.title`, `Common.save`)
- `msgstr` = source-language text (source locale) or copy of source text as placeholder (other locales)
- `#.` description — **first-class translator comment**. Use the ambiguity checklist to decide whether to add one; full sentences with obvious meaning can skip.
- `#:` source reference — `src/components/HomePage.vue:42` format
- `msgctxt` — optional, only for disambiguation (see below)

**Disambiguation in PO**: use `msgctxt`. Two entries with identical `msgid` but different `msgctxt` translate independently. The `poLoader` (installed by setup) mangles this into a `__ctx_<context>` key suffix at build time, so call sites render via:

```vue
{{ t('Common.right__ctx_direction') }}
```

To keep call sites readable, prefer storing long context keys as a TypeScript constant:

```ts
const RIGHT_DIRECTION = 'Common.right__ctx_direction'
```

```vue
{{ t(RIGHT_DIRECTION) }}
```

### Ambiguity checklist

Run this against each string during wrapping. How you handle a match depends on `catalogFormat`:

- **PO** → write a `#.` description in the same edit. This is the main reason to pick PO.
- **JSON** → apply the JSON strategies above: prefer renaming to a disambiguating key. If renaming doesn't help (the ambiguity is tonal or about audience rather than object), leave the key unchanged and surface it in the summary at the end so the user can decide whether to switch to PO.

**Must comment:**

- **Single words or two-word phrases** that could have multiple meanings in the source language. Test: *could a translator read this differently without seeing the UI?*
- **Action labels without a visible object**: "Remove", "Add", "Delete" — the comment says what's being acted on.
- **Strings with placeholders where meaning isn't obvious**: `{count} remaining` — remaining what? `Hello, {name}` — person, project, pet?
- **Domain-sensitive terms**: words whose meaning depends on the app's domain (from Step 3).

**Should comment:**

- **UI jargon** a translator might read literally: "Toast", "Drawer", "Badge", "Chip", "Popover".
- **Abbreviations and acronyms** shown to users.
- **Sentence fragments**: "and {count} more", "Updated {timeAgo}" — comment gives the surrounding context.

**Skip:**

- **Full sentences with clear meaning.**
- **Strings where the surrounding message makes context obvious** (e.g. `one="# item"` branches of a plural).
- **Labels matching their form field** (`<label>Email</label>` next to an `<input type="email">`).

---

## Step 8: Workflow

### 8.0 Discovery and Scale Assessment

Before wrapping, scan the project to determine scope.

1. **Glob** for source files. Exclude `node_modules`, tests (`*.test.*`, `*.spec.*`, `__tests__/`), config files, `*.d.ts`, build output (`dist/`, `.output/`, `.nuxt/`).
   - Vite SPA / Quasar: `src/**/*.{vue,ts,tsx,js,jsx}`
   - Nuxt 3: `app.vue`, `pages/**/*.vue`, `components/**/*.vue`, `layouts/**/*.vue`, `composables/**/*.ts`, `stores/**/*.ts`, `plugins/**/*.ts`, `middleware/**/*.ts`, `utils/**/*.ts`
   - Nuxt 4: same paths, nested under `app/`

   Treat files matching `**/{constants,copy,strings,labels,messages,i18n}*.{ts,js,vue}` as high-signal — they often hold exported user-facing string constants that template-text grep misses.

2. **Quick-grep** each file for translatable indicators:
   - Bare text between tags: `>[A-Za-z][^<{]*<` inside `.vue` template blocks (not inside `{{ … }}`)
   - Unbound user-visible attrs without the leading colon: `\bplaceholder="[^"]+"`, `\baria-label="[^"]+"`, `\btitle="[^"]+"`, `\balt="[^"]+"`
   - Concatenation near UI paths: `"[A-Z][^"]*"\s*\+`, `\+\s*"[A-Z][^"]*"`
   - Exported string literals in constants/labels files
   - Legacy `$t(` / `this.$t(` — record these in the follow-up list; don't rewrite (Options API handling per Step 2)

3. **Build a candidate file list** — files with at least one match, sorted by match count (descending).

4. **Decide the processing path:**
   - **15 files or fewer** → [8.1 Sequential Processing](#81-sequential-processing)
   - **More than 15 files** → [8.2 Parallel Processing](#82-parallel-processing)

---

### 8.1 Sequential Processing

Small-to-medium projects (≤ 15 files).

Priority order:
1. **Layouts and shell components** (`app.vue`, `App.vue`, `layouts/*.vue`, `components/AppHeader.vue`, navbars, footers) — highest reuse, wrap first.
2. **Shared components** (buttons, modals, form fields under `components/shared/`, `components/ui/`).
3. **Page / route components** — specific to one view.
4. **Composables / Pinia stores** — user-visible strings in `composables/*.ts`, `stores/*.ts`.
5. **Utilities, Nuxt plugins, middleware** — plain `.ts` files.

Within each file:
1. Template text → wrap with `{{ t('Namespace.key') }}`
2. Unbound attributes → bind with `:attr="t('Namespace.key')"`
3. `<script>` block strings → `const { t } = useI18n(); t('Namespace.key')`
4. Numbers / currencies / dates → `n()` / `d()` with named formats
5. Rich text with links / components → `<i18n-t keypath="…">`

For each string, run the Step 7 ambiguity checklist and write the comment (`$<key>` for JSON, `#.` for PO) in the **same edit**. Do not wrap first and add comments later.

### Adding entries to catalog files

- **JSON**: merge new keys into the existing nested object in `locales/{locale}.json`. Source locale gets actual text; other locales get a copy of the source text as a placeholder.
- **PO**: append new entries to `locales/{locale}.po`. Follow `references/languages/js-ts/libraries/vue-i18n/po-format.convert.md` § Adding Entries for exact formatting. Preserve the PO header block at the top of each file. Every entry needs `msgid`, `msgstr`, `#.` description (if the ambiguity rule triggered), and `#:` reference. Target-locale files get the source text as `msgstr` placeholder and keep `#.` / `#:` identical across locales.

### Verification after sequential wrapping

1. **Dev server boots** (`npm run dev` / `pnpm dev` / equivalent). No build-time parse errors. vue-i18n's default warning channel logs any missing keys — fix them if they appear.
2. **Language switcher works.** Pick a target locale; the UI re-renders and falls back to source text for untranslated entries.
3. **Existing tests pass.** If tests fail with `"Not Available in Legacy Mode"` or `useI18n() is undefined`, wrap mount/render with the `mountWithI18n` helper (see setup Step 10). Common fix is adding the helper and re-running.

---

### 8.2 Parallel Processing

Large projects (> 15 files). Partition the work across subagents running in parallel. Subagents only edit `.vue` / `.ts` source files — catalog updates happen in a merge step after all partitions complete.

#### Partition the files

1. **Group** candidate files by directory subtree (e.g., `src/components/layout/**`, `src/pages/**`, `src/stores/**`).
2. **Order within each group** by priority: layouts → shared → pages → utilities.
3. **Balance the groups** — merge groups with < 3 files into the nearest neighbor; split groups with > 15 files.
4. **Target 3–5 partitions.**

#### Pre-assign namespaces

1. Read the existing namespace structure from the source-locale catalog:
   - JSON: the top-level keys.
   - PO: first dot-segment of each `msgid`.
2. Map each partition's directories to namespaces using Step 7 conventions.
3. If a namespace doesn't exist yet, assign it to the partition whose files will produce the first keys in it.
4. `Common` goes to the partition holding shared components. Other partitions that need a shared string should create a feature-specific key instead — duplicates are resolved in the merge step.

#### Dispatch subagents

Use the **Agent tool** to dispatch all partitions in a **single message** (this launches them in parallel). Each subagent prompt is assembled from this template. The **format-specific output block** at the end is included based on `catalogFormat` — ship only one, never both.

```
You are wrapping hardcoded UI strings with vue-i18n calls in a Vue 3 project.

## Project Context
- Framework: {framework}
- Variant: {Vite SPA / Nuxt 3 / Nuxt 4 / Quasar}
- TypeScript: {yes/no}
- API style: {composition / mixed}
- App domain: {domain description from Step 3}
- Catalog format: {json / po}

## Composable Decision Tree
- Template text → {{ t('Namespace.key') }}; ensure useI18n() is imported in <script setup>
- Attribute value → :attr="t('Namespace.key')" (colon required)
- Rich text with embedded components → <i18n-t keypath="..."> with named slots
- String in <script setup> → const { t } = useI18n(); t('Namespace.key')
- String in composable / Pinia store → useI18n() when called from setup, else i18n.global.t()
- String in plain .ts / Nuxt plugin / middleware:
    Vite/Quasar: import { i18n } from '@/i18n'; i18n.global.t()
    Nuxt: const { $i18n } = useNuxtApp(); $i18n.t()
- Options API .vue (no <script setup>): SKIP and record in follow-up list.

Never use vue-i18n's pipe-plural syntax. All plurals use ICU inside the catalog value.
Always include `other` in plural/select. Use # for count placeholder.

## Your Namespace Assignment
You own these namespaces: {list of namespaces}
Existing namespace snapshot:
{snippet of existing entries under these namespaces}

Namespace rules (Step 7):
- PascalCase top-level segment matching the component domain
- Max 2 nesting levels
- Semantic key names (title, subtitle, cta — not welcomeBack)

## Reference File
Read `{path to framework reference, e.g. references/nuxt.md}` for variant-specific
patterns (SSR safety, locale-aware links, metadata) before wrapping.
{If catalogFormat === 'po'}
Also read `references/languages/js-ts/libraries/vue-i18n/po-format.convert.md` for the PO entry format and output shape.
{end if}

## Your Files (process in this order)
{numbered list of file paths with their category}

## Instructions
For each file:
1. Read the file.
2. Identify translatable strings using the Step 5 rules (high confidence: bare template
   text, unbound attrs, concatenation, plural candidates, ternaries; skip: CSS classes,
   console, imports, object keys, test IDs, URLs, enum constants, long-form prose).
3. Wrap each string with the correct vue-i18n API from the decision tree above.
4. Add translator comments inline per Step 7's ambiguity checklist.
5. Handle plurals with ICU {count, plural, ...}, gender/status with {gender, select, ...},
   ordinals with {position, selectordinal, ...}. Always include `other`. Use `#` for count.

Within each file, process in this order:
template text → attributes → <script> strings → numbers/currencies/dates.

Do NOT run any build, extract, or compile command. Do NOT edit locales/*.
```

Then append **exactly one** of the following output-shape blocks:

**When `catalogFormat === 'json'`:**

```
## Output Shape

After processing all your files, output two values:

1. A JSON object listing every new key you produced, nested under its namespace:

{
  "Namespace": {
    "key": "English value",
    "anotherKey": "..."
  }
}

2. A separate "ambiguous" list naming keys that matched the must-comment
   checklist (single words, action without visible object, domain-sensitive
   terms, non-obvious placeholders). Output format:

{
  "ambiguous": [
    { "key": "Common.save", "context": "Save button in document editor toolbar" },
    { "key": "Common.right", "context": "Direction indicator, opposite of Left" }
  ]
}

- One entry in the main object per key you actually used in a t()/i18n-t call.
- Do NOT emit $-prefixed sibling keys — they would be ingested by the TMS as
  translatable strings, costing translation budget and polluting target locales.
- Do NOT include entries for keys that already exist in the snapshot above.
- Do NOT edit locales/*.json directly. The orchestrator merges your output.
- The "ambiguous" list is surfaced to the user at the end so they can decide
  whether to rename the keys, switch to PO, or ship as-is.
```

**When `catalogFormat === 'po'`:**

```
## Output Shape

After processing all your files, output a JSON array of PO entries. See
references/catalog-format-po.md for detailed rules.

[
  {
    "msgid": "HomePage.title",
    "msgstr": "Welcome",
    "description": "Homepage hero heading",
    "reference": "src/pages/HomePage.vue:12"
  },
  {
    "msgid": "Common.right",
    "msgstr": "Right",
    "description": "Direction indicator — opposite of Left",
    "reference": "src/components/ArrowNav.vue:8",
    "msgctxt": "direction"
  }
]

- Flat array — dot-paths in msgid carry the namespace structure.
- `description` is required and must be a real one-line note, not a TODO.
- `reference` points at the first source file where the entry is used.
- Use `msgctxt` only for disambiguation. The orchestrator wires the matching
  `__ctx_<context>` suffix into the call-site t() automatically.
- If you emit a msgctxt, write the call site as t('Namespace.key__ctx_<context>')
  or store the key in a constant (preferred for long contexts).
- Do NOT edit locales/*.po directly. The orchestrator merges your output.
```

> **Orchestrator note:** send **only one** output-shape block per dispatch. A subagent receiving both will produce inconsistent output and the merge step will fail.

#### After all subagents complete — merge catalog entries

**When `catalogFormat === 'json'`:**

1. Collect subagent outputs (nested JSON objects).
2. Deep-merge into every `locales/{locale}.json`. Source locale gets actual values; target locales get placeholder copies.
3. Collision: two subagents produced the same key with different values → prefer the more descriptive value and log a warning. For `$<key>` comment collisions, prefer the more specific comment.
4. Verify every locale file has the same top-level and nested key set.

**When `catalogFormat === 'po'`:**

Follow the merge algorithm in `references/languages/js-ts/libraries/vue-i18n/po-format.convert.md` § Merge Algorithm. Summary:
1. Concatenate all subagent entry arrays.
2. Deduplicate by `(msgid, msgctxt)` pair. On duplicates, keep the more descriptive `description`; union `#:` references.
3. For each unique entry:
   - If `(msgid, msgctxt)` already exists in `locales/{sourceLocale}.po`, soft-merge metadata (leave `msgstr` alone; update `#.` if the new description is strictly more specific; union `#:` references). Propagate the metadata update to every target-locale file.
   - Otherwise, append new entries to every locale file. Source locale gets real `msgstr`; other locales get source text as placeholder. `#.` and `#:` are identical across locales.
4. Preserve the `msgid ""` header block untouched in every file.
5. Verify every locale file has the same `(msgid, msgctxt)` set.

#### Verification after parallel wrapping

Same as §8.1: dev server boots, language switcher works, tests pass. Plus:

- Check the manual-follow-up list — Options-API SFCs and `server/api/*` files that subagents skipped.
- Check the warning count — collisions and soft-merges from the catalog step.

---

## Step 9: Comment Review Pass

After all strings are wrapped and catalogs updated, do a final pass for translator context. The work differs by format.

### When `catalogFormat === 'po'`

1. Scan `locales/{sourceLocale}.po` for entries that match a **must-comment** heuristic (single words, action labels without objects, domain-sensitive terms) **and** have no `#.` description line (or the description is empty).
2. For each flagged entry, write the description directly into the `.po` file — no source edit needed at this stage. Propagate the same `#.` to every target-locale file so metadata stays identical across locales.
3. Skip entries whose meaning is obvious (full sentences, labels matching their form field, branches inside plurals).
4. Do not second-guess descriptions that are already present.

### When `catalogFormat === 'json'`

No inline comments to back-fill (see Step 7 — JSON mode does not emit `$<key>` comments by default). Instead:

1. Aggregate the `ambiguous` lists collected from sequential wrapping (§8.1) or subagent outputs (§8.2).
2. Dedupe by key.
3. Surface the list to the user in a single summary block:
   > **Ambiguous keys worth reviewing ({N})**
   >
   > These strings matched the must-comment checklist but JSON catalogs don't support translator comments. Options:
   > - Rename the key to disambiguate (e.g. `Common.save` → `DocEditor.saveToolbar`)
   > - Switch to PO now (re-run the setup phase, pick PO) — translator comments become first-class
   > - Ship as-is — the translator will work without this context
   >
   > *(full list — key: context note)*
4. Do not rewrite JSON entries automatically. The user decides which keys to rename.

This pass catches strings that looked fine in the source but appear ambiguous in isolation in the catalog — which is how translators actually see them.

---

## Follow-ups after convert completes

Surface these items to the user at the end of the run. They're out of scope for automatic conversion but commonly needed after a wrap pass:

- **Locale-aware navigation**: audit remaining `<a href="/...">` tags and convert to `<router-link>` (vue-router) or `<NuxtLink>` (Nuxt). Pair with the project's locale-prefix strategy — `@nuxtjs/i18n` exposes `$localePath()` / `localePath()` for composing locale-aware hrefs; in plain Vue, prepend the active locale from `useI18n().locale.value` when building the `to` prop. Plain `<a>` bypasses the locale prefix and sends users to the source-locale URL, dropping them out of their active locale on click.
- **Manual follow-up list**: Options-API SFCs and `server/api/*` files that subagents skipped (collected in Step 2 / Step 7). Surface them so the user knows which files still need hand-conversion.
- **Any other items** you noticed during the run (ambiguous JSON keys deferred from Step 9, component tests that need an `i18n` plugin installed in the mount options) — list them here so the user knows what's left.

---

## Step 10: Estimate Translation Cost & Offer Setup

Show the user a rough estimate of what translating the catalog via [globalize.now](https://globalize.now) will cost, then offer to set up a Globalize project so translations can actually run.

This is an interim local heuristic. Once `globalize.now` exposes a quote endpoint, we'll replace it with a real call.

### Compute the estimate

1. Read the source locale and target locales from the i18n config (recorded in Step 2).
2. Resolve the source catalog path:
   - JSON: `{locales-dir}/{sourceLocale}.json`
   - PO: `{locales-dir}/{sourceLocale}.po`
3. Measure the byte size of the source catalog file. Everything in the file counts — globalize.now ingests the entire file, including JSON structure or PO headers and `#.` / `#:` metadata (descriptions in particular are sent to the translator so they get counted):
   ```bash
   wc -c < src/i18n/locales/en.json
   # or
   wc -c < src/i18n/locales/en.po
   ```
   Use whichever matches `catalogFormat`. For multi-catalog setups, sum across files.
4. Apply the formula:
   ```
   source_tokens      = ceil(catalog_bytes / 4)
   estimated_cost_eur = (source_tokens / 1000) × 0.012976 × len(target_locales)
   ```
   Format `cost` to 2 decimals. Optionally count leaf string values (for JSON) or `msgid` entries minus the header (for PO) for the message count display.

### Display the estimate

Print exactly this block (substitute the computed values):

```
Estimated globalize.now translation cost
  Source catalog:     {bytes} chars ({messages} messages, {json|po})
  Source tokens:      ~{source_tokens} (rough, chars/4)
  Target locales:     {n} ({comma-joined target locale codes})
  ──────────────────────────────────────────────
  ▶ **Estimated total: ~€{cost}**  (at €0.012976 / 1K source tokens × {n} locales)
```

Then add:

> Rough local heuristic — globalize.now will return a precise quote once the project is set up.
>
> **Next step:** set up a Globalize project to run the translations. Run the `globalize-now-cli-setup` skill to install the CLI, authenticate, create a project, and connect this repo. Want me to start it now?

Wait for the user's answer. If yes, invoke `globalize-now-cli-setup` via the Skill tool. If no or defer, end the conversion here.
