# Browser extension (MV3) + Lingui — convert overlay

**Read `references/languages/js-ts/libraries/lingui/convert.standard-react.md` first.** It carries
every wrapping pattern this variant uses — `<Trans>`, `useLingui()`, module-scope `msg` resolved with
`t(descriptor)`, validation messages, toasts, and the formatters-module call forms for numbers, prices
and dates. **Also read `references/languages/js-ts/convert.format-pass.md`** — the format pass applies to
an extension unchanged, with `**/*.html` popup and options markup included in scope.

**This file is an overlay.** It states only what a browser extension changes or adds and never
restates a shared rule. **Where the two disagree, this file wins.**

Two shared sections do not apply at all: **locale-aware links** and **route titles** — an extension has
no URLs and no router (`detection.router` is `"none"`), so leave every `href` as written and never add
a locale path segment.

The setup phase (`frameworks/webext/{,swc/}lingui.setup.md` Step 9) already wrote the per-entrypoint
bootstraps. The snippets below add only the string-level delta on top of them, using the API that file
created in `src/i18n/`: `initI18n()`, `activateLocale()`, `applyDocumentLocale()`, `onLocaleChanged()`,
`i18n`, plus `browser` from `src/i18n/browser` and `getDirection` from `src/i18n/locales`. `@/` stands
for the project's own path alias — check `tsconfig.json` `compilerOptions.paths` (on WXT also
`.wxt/tsconfig.json`), and use the specifier the generated `.agents/globalize-rules.md` states.

---

## 1. `.html` entrypoints (popup, options, side panel)

These are static HTML that a React root mounts into. **No Lingui macro can reach text inside them** —
macros run over JS/TS source — and Chromium does **not** substitute `__MSG_…__` in HTML either. Text
left there ships in the source locale forever.

```html
<!-- entrypoints/popup/index.html (WXT) — popup.html on CRXJS / plain Vite -->
<head><title>Acme Clipper</title></head>          <!-- user-visible, unreachable -->
<body>
  <div id="root">Loading your clips…</div>        <!-- user-visible, unreachable -->
  <noscript>This extension needs JavaScript.</noscript>
  <script type="module" src="./main.tsx"></script>
</body>
```

| Text in the HTML | What to do |
|---|---|
| Anything React renders anyway | Delete from the HTML, author it in the component, wrap it there. |
| Pre-mount placeholder (`Loading…`) | Replace the words with a **non-textual** placeholder — spinner or skeleton. It paints before activation, so no catalog can ever reach it; removing the text removes the problem instead of hiding it. |
| `<title>` | Cannot move into React. Keep an untranslated fallback in the file, **set it from JS after activation**. |
| `<noscript>` | Leave it and flag it. An extension page whose module script never ran is broken anyway — do not wrap it, do not delete it. |

Setup's `start()` already calls `applyDocumentLocale(locale)` for `<html lang>` / `<html dir>` and passes
it to `onLocaleChanged`. Widen that one function so the title travels with them — do it per HTML
entrypoint; each is its own bundle and its own document:

```tsx
// entrypoints/popup/main.tsx — the bootstrap setup wrote, with the title added
import { msg } from '@lingui/core/macro'
import { applyDocumentLocale, i18n, initI18n, onLocaleChanged } from '@/src/i18n'

const popupTitle = msg({ id: 'popup.title', message: 'Acme Clipper',
  comment: 'Window title of the extension popup. Read aloud by screen readers.' })

function applyDocumentChrome(locale: string) {
  applyDocumentLocale(locale)                 // <html lang> + <html dir>, from setup
  document.title = i18n._(popupTitle)
}

async function start() {
  const locale = await initI18n()
  applyDocumentChrome(locale)
  onLocaleChanged(applyDocumentChrome)        // replaces onLocaleChanged(applyDocumentLocale)
  // …the ReactDOM.createRoot(...).render(...) call, unchanged
}
void start()
```

---

## 2. The MV3 service worker

Notification bodies, context-menu titles, badge tooltips and `runtime.onInstalled` copy are all
user-visible. Lingui's **core** API works there (no DOM needed), with three constraints:

1. **No `useLingui()`, no `<Trans>`** — no React. Declare with `msg` at module scope, resolve with
   `i18n._(descriptor)` at the point of use.
2. **Catalogs must be imported statically.** MV3 service workers cannot run dynamic `import()`. The
   locale module setup wrote already imports every catalog statically; never introduce an `import(...)`
   call in worker-reachable code.
3. **The worker is torn down and restarted at will; module scope does not survive.** Setup's
   `const ready = initI18n()` re-runs on every start — `await ready` at the top of every listener that
   produces text, and keep listener *registration* synchronous at the top level (registering after an
   `await` means the worker can wake for an event with no listener attached and drop it).

```ts
// entrypoints/background.ts — inside the defineBackground body setup wrote
// (CRXJS / plain Vite: same body, no wrapper). `ready` comes from setup.
import { msg } from '@lingui/core/macro'
import { browser } from '@/src/i18n/browser'
import { i18n, onLocaleChanged } from '@/src/i18n'

const menuClip = msg({ message: 'Clip selection',
  comment: 'Right-click context-menu item shown when page text is selected.' })
const actionTooltip = msg({ message: 'Open Acme Clipper', comment: 'Toolbar button tooltip.' })

async function buildMenus() {
  await ready
  await browser.contextMenus.removeAll()      // titles never re-translate themselves
  browser.contextMenus.create({
    id: 'clip-selection', contexts: ['selection'], title: i18n._(menuClip),
  })
  await browser.action.setTitle({ title: i18n._(actionTooltip) })
}

browser.runtime.onInstalled.addListener(() => void buildMenus())
onLocaleChanged(() => void buildMenus())      // replaces setup's bare onLocaleChanged()

browser.notifications.onClicked.addListener(async () => {
  await ready
  await browser.notifications.create({
    type: 'basic', iconUrl: browser.runtime.getURL('icon/128.png'),
    title: i18n._(msg`Clip saved`),
    message: i18n._(msg`Your clip is available in the side panel.`),
  })
})
```

Reach extension APIs only through the `src/i18n/browser` shim
(`globalThis.browser ?? globalThis.chrome`). Never add `webextension-polyfill` — Mozilla archived it on
2026-07-30.

---

## 3. Content scripts

Wrap text the script **injects** exactly as the shared file describes. Three additions:

- **The locale bootstrap must complete before you create a node.** `browser.storage` reads are async, so
  every injected string is authored inside (or after) setup's `await initI18n()` — a banner mounted
  before it resolves renders in whatever locale that context last had, which on a cold content script is
  none.
- **`lang` and `dir` go on the injected root, never on `document.documentElement`.** That element is the
  *host page's*; setup deliberately does not export `applyDocumentLocale` for use here. Without it, an
  RTL extension UI renders LTR inside an English page.
- **Re-render on `onLocaleChanged`.** React does this for a shadow-root UI, but hand-built DOM does not —
  imperative nodes must have their text re-assigned in the handler.

```ts
// entrypoints/example.content.ts — inside the async main() setup wrote
const clipButton = msg({ message: 'Clip this page',
  comment: 'Button the extension injects into the bottom-right of the visited page.' })

const locale = await initI18n()
const root = document.createElement('div')
root.lang = locale                        // ours, not the host page's
root.dir = getDirection(locale)
root.textContent = i18n._(clipButton)
document.body.append(root)

onLocaleChanged((next) => {
  root.lang = next
  root.dir = getDirection(next)
  root.textContent = i18n._(clipButton)
})
```

**The host page's own text is never in scope.** Its headings, body copy, form labels, and any string
the script *scrapes* are third-party content: read them, pass them as values, never wrap them.

---

## 4. `src/i18n/manifest-strings.ts` — the only place manifest and store copy is authored

Manifest and store-listing strings reach `public/_locales/**` through the bridge script, which selects
PO entries by their `manifest.` id prefix. That makes the ids here load-bearing.

```ts
// src/i18n/manifest-strings.ts
import { msg } from '@lingui/core/macro'

export const manifestStrings = {
  ext_name: msg({ id: 'manifest.name', message: 'Acme Clipper',
    comment: 'Extension name in the browser and the store listing. Max 45 characters.' }),
  ext_description: msg({ id: 'manifest.description', message: 'Save any page to Acme in one click.',
    comment: 'Store listing short description. Max 132 characters.' }),
  ext_action_title: msg({ id: 'manifest.action_title', message: 'Open Acme Clipper',
    comment: 'Tooltip on the toolbar icon.' }),
}
```

- **Never wrap a manifest string anywhere else** — a second `msg` for the same copy makes a second
  catalog entry the bridge ignores and translators pay for twice.
- **Never hardcode it in the manifest.** The value is a reference: `"name": "__MSG_ext_name__"`. A
  literal there collapses the entire store listing to one locale.
- **Do not change an existing `id`.** The bridge filters on the `manifest.` prefix and maps each id to a
  Chrome-legal message name; a rename silently drops that string from `_locales`.
- **Only four manifest keys are portable across Chrome and Firefox**: `name`, `short_name`,
  `description`, `action.default_title`. A literal in one of those → move it here, replace the manifest
  value with the `__MSG_…__` reference. A literal in any other manifest key → leave it and flag it; most
  manifest keys are never substituted.

---

## 5. Extension skip-list — in addition to the shared file's

Platform identifiers that read like prose and are not:

| Never wrap | Example |
|---|---|
| Permission and optional-permission names | `"permissions": ["storage", "contextMenus", "activeTab"]` |
| Host-match patterns | `"matches": ["https://*.example.com/*"]`, `"<all_urls>"` |
| `browser.runtime` message discriminators | `sendMessage({ type: 'CLIP_PAGE', action: 'save' })` |
| `browser.storage` keys | `storage.sync.get('locale')`, `set({ lastClipId: id })` |
| Command names — the `commands.*` object keys | `"commands": { "clip-page": { … } }` — its `description` **is** user-visible; wrap that one |
| Alarm names | `browser.alarms.create('sync-clips', { periodInMinutes: 30 })` |
| Context-menu `id`s | `contextMenus.create({ id: 'clip-selection', title: … })` — `id` no, `title` yes |
| Content-script `world` values | `"world": "MAIN"` / `"ISOLATED"` |
| CSS class names, including injected-UI classes | `host.className = 'acme-clip-banner'` |

---

## 6. `public/_locales/**` is generated output

Written by `scripts/build-locales.mjs` from the PO catalogs, and gitignored. Build output, not a second
catalog.

- **Never hand-edit a file under `public/_locales/`** — the next build overwrites it — and never wrap
  or add a key there directly.
- To change manifest or store copy, edit `src/i18n/manifest-strings.ts`; to change a translation, edit
  `src/locales/<locale>/messages.po`. Then re-run
  `lingui extract && lingui compile && node scripts/build-locales.mjs`, or the project's `build`
  script, which already chains all three.
- Exclude `public/_locales/` from every scan in this phase — machine-written duplicates of PO entries
  already handled.

---

## 7. Recall self-check

`references/languages/js-ts/convert.recall-self-check.md` applies **unchanged**: this is an ordinary
`js-ts` Lingui stack, so `eslint-plugin-lingui`'s `no-unlocalized-strings` is the authoritative scan and
the orchestrator's cleanup loop runs normally.

One addition: **also glob `**/*.html`** — ESLint does not read popup, options or side-panel markup.
Report any `<title>`, placeholder text, `<noscript>` or visible element text still living there, so §1
gets applied to entrypoints detection missed. Keep `public/_locales/**`, `.output/**` and `dist/**` out
of every glob.
