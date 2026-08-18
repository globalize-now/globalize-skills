# Browser Extension Native Messages (`chrome.i18n`) — Conversion

Extension-specific guidance for the convert phase: **finding user-visible text across the four surfaces an
extension has, and moving it into `_locales/<sourceLocale>/messages.json`**. The per-edit authoring rules —
key charset, `description` authoring, placeholders, the plural convention, what not to wrap — live in the
project's generated `.agents/globalize-rules.md` (rendered from `webext-native.rules.template.md` in setup
Step 8, and wired into `CLAUDE.md` and `AGENTS.md` there). This file is the **mechanics of discovery,
wrapping and verification**.

`chrome.i18n` is **key-authored, with no macro and no automated extractor**. Unlike Lingui or Paraglide
(which extract or compile from source), here you author the entry into `messages.json` by hand and replace the
literal with a reference. There is no extract step and no compile step afterwards — the verify gate is catalog
integrity plus manifest legality.

`<localesRoot>` below is the path setup Step 1 resolved: `public/_locales/` for WXT / CRXJS / plain Vite /
webpack, `assets/_locales/` for Plasmo, `./_locales/` for a build-less extension.

---

## The four surfaces

An extension is not one app. Text hides in four structurally different places, each with its own wrapping
mechanism, and a pass that only greps `.tsx` will miss three of them.

| Surface | Where it lives | Wrap as |
|---|---|---|
| **HTML entrypoints** | `popup.html`, `options.html`, `sidepanel.html`, `devtools.html` (WXT: under `entrypoints/`) | `data-i18n` / `data-i18n-<attr>` attributes |
| **UI code** | `.ts` / `.tsx` / `.js` in `src/`, `entrypoints/`, content scripts | `t('key')` |
| **Service worker** | `background.ts` / `background.js` — notifications, context-menu titles, alarm and badge text | `t('key')` (same helper) |
| **Manifest** | `manifest.json`, `manifest.config.ts`, or the `manifest:` key in `wxt.config.ts` | `__MSG_key__`, portable fields only |

A fifth, rarer one: **`.css` files**, where `__MSG_key__` *is* substituted at load time.

---

## Step 1: Discover the strings

### HTML entrypoints

```bash
# Text nodes that are not already marked up
grep -rEn '>[^<>{}]*[A-Za-z]{3,}[^<>{}]*<' --include='*.html' . \
  | grep -v 'data-i18n' | grep -v node_modules

# User-visible attributes
grep -rEn '(placeholder|title|aria-label|alt)="[^"]*[A-Za-z]{2,}' --include='*.html' . \
  | grep -v node_modules
```

### UI code (`.ts` / `.tsx` / `.js`)

```bash
# DOM sinks assigned a literal
grep -rEn '\.(textContent|innerText|innerHTML|title|placeholder|ariaLabel|alt|value)\s*=\s*["'\'']' \
  --include='*.ts' --include='*.tsx' --include='*.js' src entrypoints

# JSX text and user-visible props (React popups/options pages)
grep -rEn '>[A-Z][a-z]|(placeholder|title|aria-label|alt|label)=\{?["'\'']' \
  --include='*.tsx' --include='*.jsx' src entrypoints
```

### Service worker

The background worker has no DOM, so its strings hide in API argument objects. These are the sinks that
surface text to the user:

```bash
grep -rEn 'notifications\.create|contextMenus\.(create|update)|action\.(setTitle|setBadgeText)|runtime\.setUninstallURL|omnibox\.setDefaultSuggestion' \
  --include='*.ts' --include='*.js' src entrypoints
```

Then read each hit and wrap the **string-valued fields**: `notifications.create({ title, message,
contextMessage, buttons: [{ title }] })`, `contextMenus.create({ title })`, `action.setTitle({ title })`,
`omnibox.setDefaultSuggestion({ description })`. Leave `id`, `type`, `iconUrl`, `contexts` alone.

### Manifest

```bash
grep -nE '"(name|short_name|description)"|"default_title"|"description"' \
  manifest.json public/manifest.json src/manifest.json manifest.config.ts wxt.config.ts 2>/dev/null
```

Any of those holding a literal rather than a `__MSG_…__` reference is a conversion candidate.

### CSS

```bash
grep -rEn 'content:\s*["'\'']' --include='*.css' src public entrypoints
```

Only `content:` strings in a real `.css` file are candidates — see the decision tree.

---

## Step 2: The wrapping decision tree

| Source | Wrap as | Notes |
|---|---|---|
| `.html` **text node** | `<h1 data-i18n="popup_heading">Quick actions</h1>` | The DOM pass replaces the element's whole `textContent`. Keep the source text in the markup as the readable default. |
| `.html` **attribute** | `data-i18n-placeholder`, `data-i18n-title`, `data-i18n-aria-label`, `data-i18n-alt` | One data attribute per target attribute; the pass in `src/i18n/dom.ts` maps them. |
| `.ts` / `.tsx` / `.js` | `t('popup_saved')` | Never call `browser.i18n.getMessage` directly outside `src/i18n/`; `t()` is the only sanctioned accessor and is what swaps cleanly between the native and custom-loader branches. |
| **Service worker** | `t('context_menu_tidy_tabs')` | Native mode: synchronous, call it anywhere. Custom-loader mode: `await ready` (the module-scope `initI18n()` promise) inside the handler first — the worker restarts and module state is not durable. |
| **Manifest** | `"name": "__MSG_ext_name__"` | **Only** `name`, `short_name`, `description`, `action.default_title` are portable across Chrome and Firefox. Chromium also substitutes `omnibox.keyword`, `commands.<name>.description`, `file_browser_handlers[].default_title`, `input_components[].{name,description}`, `app.launch.{local_path,web_url}` and the `chrome_settings_overrides.*` keys — Firefox does not. Anything **not** on Chromium's list (`action.default_popup`, `icons`, `permissions`, `options_ui.page`) is emitted literally and breaks the extension. |
| `.css` | `content: "__MSG_popup_empty__";` | Substituted at network-load time, gated on the `text/css` MIME type. So it works in a real `.css` file and **does not** work in an inline `<style>` block or a `style="…"` attribute. Rare — prefer moving the text into the DOM. |
| **HTML `__MSG_`** | **Never.** | `__MSG_key__` inside a `.html` file renders as literal text. Older Chromium design docs claim otherwise; the shipping code does not do it. |

### Concrete before/after

```html
<!-- before -->
<h1>Quick actions</h1>
<input placeholder="Search tabs" />
<button title="Save the current window">Save</button>

<!-- after -->
<h1 data-i18n="popup_heading">Quick actions</h1>
<input data-i18n-placeholder="popup_search_placeholder" placeholder="Search tabs" />
<button data-i18n="popup_save_button" data-i18n-title="popup_save_tooltip" title="Save the current window">Save</button>
```

```ts
// before
status.textContent = 'Settings saved'
status.textContent = 'Synced from ' + deviceName + ' at ' + time      // never concatenate
browser.contextMenus.create({ id: 'tidy', title: 'Tidy these tabs' })

// after
status.textContent = t('options_saved')
status.textContent = t('options_synced_from', [deviceName, time])     // $1, $2 in the entry
browser.contextMenus.create({ id: 'tidy', title: t('context_menu_tidy_tabs') })
```

Concatenation is always a bug: it bakes English word order into the code and gives the translator two
meaningless fragments. Use one message with placeholders.

---

## Step 3: Key naming

- **Charset is `A-Z a-z 0-9 _ @` only.** No dots, no dashes, no spaces, no non-ASCII. `popup.heading` and
  `popup-heading` are both illegal.
- **Keys are case-insensitive.** `popupTitle` and `popuptitle` are the *same* key — the second silently
  overwrites the first, with no error. This is the trap: two developers adding `saveButton` and `savebutton` in
  different files produce one entry and one wrong string. Never let casing be the only difference between keys.
- **Never start a key with `@@`.** That prefix is reserved for the browser's predefined messages
  (`@@extension_id`, `@@ui_locale`, `@@bidi_dir`, `@@bidi_reversed_dir`, `@@bidi_start_edge`, `@@bidi_end_edge`).
- **Convention: `surface_element_purpose`**, all lowercase snake_case, which sidesteps the case-insensitivity
  trap entirely:

  ```
  popup_heading                 popup_search_placeholder      popup_save_button
  options_language_label        options_saved                 options_synced_from
  context_menu_tidy_tabs        notification_sync_failed_title
  ext_name  ext_short_name  ext_description  ext_action_title
  ```

  `surface` is the UI area (`popup`, `options`, `sidepanel`, `content`, `notification`, `context_menu`, `ext`
  for manifest/store strings). `element` is what renders it. `purpose` disambiguates. Plural sets append the
  CLDR category last: `inbox_count_one`, `inbox_count_other`.

---

## Step 4: Always write a `description`

`description` is **the only translator-comment channel this format has** — there is no `#.` comment, no
context field, no notes attachment. Globalize surfaces it directly to translators, so an entry without one is
an entry translated blind. Write one for **every** key you author, including the obvious-looking ones: "Save"
is a verb in the source and a noun in half the target languages, and only the description can say which.

A good description answers, in this order:

1. **Where it appears** — the surface and the element. *"Heading at the top of the popup, above the action
   buttons."* *"Tooltip on the toolbar icon."*
2. **Length or layout limits**, when real. *"Hard limit: 45 characters (Chrome Web Store title)."* *"Clips past
   roughly 20 characters in a 240px popup."* The manifest/store strings have hard caps: `name` 45,
   `short_name` 12, `description` 132.
3. **What each placeholder means, and whether it is translatable.** *"`$device$` is a user-chosen device name
   — do not translate it. `$time$` is an already-formatted local time string."*
4. **Grammatical role when the source is ambiguous** — a bare verb, a one- or two-word label, an action without
   an object. *"Verb — the label on the button that saves the current window."*
5. **Plural category**, for any key in a plural set. *"PLURAL CATEGORY ONE (English singular)."*

```json
"popup_save_button": {
  "message": "Save",
  "description": "Verb. Label on the button that saves the current tab group. Fits about 12 characters before the popup wraps."
}
```

Do **not** write descriptions that restate the message (`"description": "The save button"` for `"Save"`) — that
is noise the translator has to read past.

---

## Step 5: Placeholders

Placeholders are declared per entry and referenced in the body as `$name$`:

```json
"options_synced_from": {
  "message": "Settings synced from $device$ at $time$.",
  "description": "Status line on the options page. $device$ is a user-chosen device name (do not translate it). $time$ is an already-formatted local time string.",
  "placeholders": {
    "device": { "content": "$1", "example": "Ada's laptop" },
    "time":   { "content": "$2", "example": "14:05" }
  }
}
```

```ts
status.textContent = t('options_synced_from', [deviceName, formattedTime])
```

Rules:

- **`content` is `$1`–`$9`** (the positional substitution passed at the call site) or a literal string baked
  into the message. Positional numbering is what lets translators reorder — `$time$` may precede `$device$` in
  the translated sentence with no code change.
- **Always write `example`.** It is the only thing that tells a translator what shape of value lands there —
  a name, a URL, a number, a date — and it costs one line.
- **Hard cap of 9 substitutions.** A tenth makes `getMessage()` return `undefined` (not a truncated string,
  not an error). If a message needs ten values, it is two messages.
- **`$$` escapes a literal `$`.** `"message": "Costs $$5"` renders as `Costs $5`. An unescaped `$` makes the
  parser hunt for a placeholder name and mangle the output.
- **Placeholder-name matching is case-insensitive**, so `$Device$` resolves the `device` declaration. Do not
  rely on that; declare and reference in the same lowercase.
- **The `placeholders` block must be repeated in every locale file.** It is per-entry, not inherited from the
  default locale. A target entry using `$device$` without declaring it renders the literal text `$device$`.
- **`escapeLt`** — `getMessage(key, subs, { escapeLt: true })` (Chrome 79+) escapes `<` in the **message body
  only, not in the substitutions**. Prefer `textContent` over `innerHTML`; if you must use `innerHTML`, escape
  the substituted values yourself.

---

## Step 6: The skip-list — what NOT to wrap

Extensions are unusually dense in machine-facing strings that *look* like copy. Wrapping any of these breaks
the extension, silently, at runtime:

- **Permission and host-permission strings** — `"storage"`, `"tabs"`, `"scripting"`, `"https://*/*"`. API
  identifiers, not text. Chrome renders the user-facing permission warnings itself.
- **`match` patterns** — `content_scripts[].matches`, `exclude_matches`, `<all_urls>`. URL grammar.
- **Storage keys** — the `'locale'` in `browser.storage.sync.get('locale')`, and every other key name.
  Localizing one loses the user's data.
- **Message-passing action names and `chrome.runtime` message types** — `{ type: 'tabs:refresh' }`,
  `{ action: 'GET_STATE' }`, and every string compared in an `onMessage` switch. Protocol, not copy.
- **Command names** — the `commands` object's *keys* (`_execute_action`, `toggle-sidebar`) are identifiers.
  Only `commands.<name>.description` is text, and only Chrome localizes it.
- **URL fragments and paths** — `'#settings'`, `'options.html'`, `browser.runtime.getURL('_locales/…')`,
  API endpoints, `default_popup` values.
- **CSS class names, element ids, selectors, `data-*` attribute names** — including the `data-i18n` keys
  themselves.
- **Log and telemetry strings** — `console.log`/`console.warn`/`console.error` messages, analytics event
  names, error codes, `Error` messages that never reach the UI. If it only ever appears in devtools, it is not
  a user-facing string.
- **MIME types, mimetypes, locale codes, currency and country codes, ISO dates, regex sources, version
  strings.**
- **Language endonyms in the picker** — `'Deutsch'`, `'Español'` must read the same in every UI language.
  Translating them is a bug; keep them in a code-side constant map, not in the catalog.

When a literal is genuinely ambiguous, ask: *would a translator changing this break behaviour?* If yes, it is
an identifier.

---

## Step 7: Comment review pass

After wrapping, sweep the **source catalog** end to end and fill in every missing or hollow `description` —
the same pass the Android convert phase runs over its `<!-- -->` comments, and the reason the format's one
comment channel is worth anything.

1. Read `<localesRoot>/<sourceLocale>/messages.json` in full.
2. For every entry with **no `description`**, write one per the Step 4 heuristic.
3. For every entry whose `description` merely restates the `message`, or is shorter than the message itself,
   rewrite it to say where the string appears and what constrains it.
4. Flag these for a description **even if one exists**, because they are the ones translators get wrong:
   - single- or two-word entries (`Save`, `Done`, `Open in tab`) — state the grammatical role;
   - any entry with placeholders — state what each placeholder holds and whether it is translatable;
   - any entry in a plural set — state the CLDR category;
   - the four manifest/store strings — state the character cap;
   - domain-specific or product terms — state whether they are translatable at all.
5. Propagate every added or edited `description` to the **target** catalogs too (it is a per-file field, and a
   translator working in `es` reads the `es` file).

Report the count of descriptions added — the verify step's `result.commentsAdded` is exactly this number.

---

## Verify

There is **no extract step and no compile step**. The gate is catalog integrity plus manifest legality. Run
these in order; steps 1–5 always run, step 6 is skip-if-absent.

1. **Catalog JSON validity** — every `<localesRoot>/*/messages.json` parses as JSON, and every top-level value
   is an object with a **string** `message`. A malformed file is a failure.
2. **Key charset and `@@` reservation** — every key matches `^[A-Za-z0-9_@]+$` and none starts with `@@`.
   Also flag any two keys in one file that differ **only** by case — they are one key at runtime.
3. **Manifest wiring** — `default_locale` is set and names a directory that exists; every `__MSG_x__` reference
   resolves to a key present in the default-locale catalog; and every `__MSG_` sits in a field the browser
   actually substitutes. A `__MSG_` in `default_popup`, `icons`, `permissions` or `options_ui.page` renders
   literally and is a **failure**. Warn on any `__MSG_` outside the four portable fields, noting that Firefox
   will not substitute it.
4. **Locale coverage** — every configured target locale has a `<localesRoot>/<chrome_code>/messages.json`
   (underscored spelling) defining every key present in the default-locale catalog. Report missing keys.
5. **Placeholder integrity** — every `$name$` used in a `message` is declared in that entry's `placeholders`;
   every declared `content` is `$1`–`$9` or a literal; **no entry exceeds 9 substitutions**.

Steps 1, 2, 4 and 5 in one pass:

```bash
node -e '
const fs = require("fs"), path = require("path");
const root = process.argv[1], src = process.argv[2];
const read = d => JSON.parse(fs.readFileSync(path.join(root, d, "messages.json"), "utf8"));
const base = read(src);
let fail = 0;
const check = (dir, cat) => {
  const lower = new Map();
  for (const [k, v] of Object.entries(cat)) {
    if (!/^[A-Za-z0-9_@]+$/.test(k) || k.startsWith("@@")) { console.log(`BAD KEY ${dir}/${k}`); fail++; }
    if (lower.has(k.toLowerCase())) { console.log(`CASE COLLISION ${dir}: ${k} vs ${lower.get(k.toLowerCase())}`); fail++; }
    lower.set(k.toLowerCase(), k);
    if (typeof v?.message !== "string") { console.log(`NO MESSAGE ${dir}/${k}`); fail++; continue; }
    const used = [...v.message.matchAll(/\$([A-Za-z0-9_]+)\$/g)].map(m => m[1].toLowerCase());
    const declared = Object.keys(v.placeholders ?? {}).map(p => p.toLowerCase());
    for (const u of used) if (!declared.includes(u)) { console.log(`UNDECLARED $${u}$ in ${dir}/${k}`); fail++; }
    const nums = Object.values(v.placeholders ?? {}).flatMap(p => [...String(p.content).matchAll(/\$(\d+)/g)].map(m => +m[1]));
    if (nums.some(n => n < 1 || n > 9)) { console.log(`BAD SUBSTITUTION INDEX ${dir}/${k} (must be $1-$9)`); fail++; }
    if (new Set(nums).size > 9) { console.log(`>9 SUBSTITUTIONS ${dir}/${k}`); fail++; }
  }
};
for (const dir of fs.readdirSync(root)) {
  const cat = read(dir); check(dir, cat);
  if (dir !== src) for (const k of Object.keys(base)) if (!(k in cat)) { console.log(`MISSING ${dir}/${k}`); fail++; }
}
console.log(fail ? `FAIL: ${fail} problem(s)` : "OK");
process.exit(fail ? 1 : 0);
' public/_locales en
```

6. **`web-ext` lint (skip if absent)** — a **supplement to** steps 1-5, not a replacement for them. It catches
   `NO_DEFAULT_LOCALE`, `NO_MESSAGES_FILE`, `NO_MESSAGE`, `MISSING_PLACEHOLDER` and `PREDEFINED_MESSAGE_NAME`.
   It does **not** catch a dangling `__MSG_missingKey__` in the manifest or an illegal message name — both lint
   clean — so step 3 above remains the only gate for those. It is also Mozilla's AMO linter, so a valid
   Chrome-only MV3 package still draws `ADDON_ID_REQUIRED` and `MISSING_DATA_COLLECTION_PERMISSIONS`: read its
   findings, never its exit code.

   ```bash
   npx 'web-ext@^10' lint --source-dir .output/chrome-mv3   # or dist/, build/chrome-mv3-prod/, or the repo root
   ```

   Point `--source-dir` at the **built** package (the directory containing the final `manifest.json` and
   `_locales/`), not the source tree, for a build-based extension. **If `web-ext` cannot be fetched or the run
   fails to start, skip it and do not fail the gate** — record `lint: "skipped: web-ext unavailable"` and rely
   on steps 1–5.

---

## After conversion

With the catalogs valid, the manifest legal, every locale covered and `web-ext lint` clean (where available):

1. Load the unpacked extension and spot-check the popup, options page and side panel in the source locale.
2. Switch the browser UI language (or, in custom-loader mode, the in-extension picker) to a target locale and
   confirm the strings change and nothing renders as `__MSG_…__` or as a bare key name.
3. Check the service-worker surfaces specifically — notifications and context menus are the easiest to miss
   because they only appear on a user action.
4. Proceed to the connect phase — point Globalize at `<localesRoot>/<sourceLocale>/messages.json` with
   `fileFormat: chrome-messages` and pattern `_locales/{locale}/messages.json`, plus a `pathLocales` override
   for every target locale carrying a region or script subtag (`pt-BR` → `pt_BR`, `zh-CN` → `zh_CN`,
   `es-419` → `es_419`); plain two-letter locales need no entry.
