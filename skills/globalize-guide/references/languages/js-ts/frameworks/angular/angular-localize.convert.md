# Angular (`@angular/localize`) — Conversion

Angular-specific guidance for the convert phase: **finding user-visible text in component templates and TypeScript, and marking it for `@angular/localize`**. The per-edit authoring rules — description and explicit ID on every message, template ICU, `$localize` placeholders, the `main.ts` import rule, the formatters module, what not to mark — live in the project's generated `.agents/globalize-rules.md` (rendered from the `angular-localize` rules template in setup Step 10, and wired into `CLAUDE.md` and `AGENTS.md` there). **Read it first; it is authoritative.** This file is the **mechanics of finding and converting existing strings**.

`@angular/localize` is **extract-from-source**: you mark text in place, and `ng extract-i18n` writes the source XLIFF (`src/locale/messages.<sourceLocale>.xlf`). You never edit the XLIFF by hand.

---

## 1. Choosing IDs and descriptions

Every message gets `description@@id`.

- **ID** — lowercase, dot-separated `feature.element.purpose`:
  - `feature` from the route or component folder: `src/app/cart/cart.page.html` → `cart.`; `src/app/settings/profile/…` → `settings.profile.` is fine but `settings.` is usually enough.
  - `element` from the UI element: `header`, `title`, `button`, `toast`, `alert`, `input`, `badge`, `empty`.
  - `purpose` from what it does: `checkout`, `remove`, `label`, `placeholder`, `count`.
  - Result: `cart.checkout.button`, `cart.remove.title`, `login.email.placeholder`.
  - The same text in two places with the same meaning may share an ID (`common.dialog.cancel`). Different text must never share an ID — extraction reports a duplicate.
- **Description** — where the text appears and what it does, written for a translator who cannot see the screen: "Button that adds the product to the cart", "Title of the dialog that confirms removing an item". Use the app domain recorded in `.globalize/decisions.md` so the translator knows the context ("in a mobile storefront").
- **Never put `|` in a description.** Angular reads the text before `|` as a *meaning*, which changes the message identity.

## 2. Template text

Mark the **innermost element that holds the whole sentence** with `i18n="<description>@@<id>"`. Interpolations and inline elements stay inline — they become placeholders the translator can move.

```html
<!-- before -->
<ion-title>Your cart</ion-title>
<p>Total: {{ formatPrice(total) }}</p>
<p>Signed in as <strong>{{ user.name }}</strong></p>

<!-- after -->
<ion-title i18n="Title of the cart screen@@cart.header.title">Your cart</ion-title>
<p i18n="Order total line on the cart screen@@cart.total.label">Total: {{ total | fmt:'money' }}</p>
<p i18n="Who is signed in, shown in the account menu@@account.menu.signedIn">Signed in as <strong>{{ user.name }}</strong></p>
```

- No element of its own → `<ng-container i18n="…@@…">text</ng-container>`.
- Never split one sentence across several marked elements. Mark the common parent.
- A control-flow block (`@if`, `@for`) inside a sentence breaks the sentence; restructure so each branch holds a whole marked sentence.

## 3. Static attributes

Add `i18n-<attr>="<description>@@<id>"` beside the attribute:

- HTML: `placeholder`, `title`, `aria-label`, `alt`.
- Ionic text props: `label`, `text`, `header`, `sub-header`, `message`, `cancel-text`, `ok-text`, `done-text`, `helper-text`, `error-text`.

```html
<input placeholder="Search products" i18n-placeholder="Search field placeholder@@search.input.placeholder" />
<ion-input label="Email" i18n-label="Login form email field label@@login.email.label"></ion-input>
<ion-searchbar placeholder="Search" i18n-placeholder="Product search placeholder@@products.search.placeholder"></ion-searchbar>
```

## 4. Bound attributes

`[label]="expr"` cannot take `i18n-*`. When `expr` yields user-visible text, move the text into a `$localize` field on the component and bind that.

```ts
// before
template: `<ion-item-option color="danger" [attr.aria-label]="'Delete ' + item.name">`

// after
deleteLabel = (name: string) => $localize`:Accessible label of the delete swipe action@@cart.item.deleteLabel:Delete ${name}:itemName:`
template: `<ion-item-option color="danger" [attr.aria-label]="deleteLabel(item.name)">`
```

A conditional label (`[label]="isEditing ? 'Save' : 'Edit'"`) becomes two `$localize` fields, one per message.

## 5. TypeScript

`` $localize`:<description>@@<id>:text ${expr}:name:` `` — every placeholder named.

This covers component fields, services, route `title`s, form-validation messages, and **every Ionic overlay controller** — `AlertController`, `ToastController`, `ActionSheetController`, `LoadingController`, `PickerController` — whose option objects carry user-visible `header`, `subHeader`, `message` and button `text`:

```ts
// before
const alert = await this.alertCtrl.create({
  header: 'Remove item?',
  message: `Remove ${line.name} from your cart?`,
  buttons: [
    { text: 'Cancel', role: 'cancel' },
    { text: 'Remove', role: 'destructive', handler: () => this.drop(line) },
  ],
})

// after
const alert = await this.alertCtrl.create({
  header: $localize`:Title of the remove-item confirmation@@cart.remove.title:Remove item?`,
  message: $localize`:Body of the remove-item confirmation@@cart.remove.message:Remove ${line.name}:itemName: from your cart?`,
  buttons: [
    { text: $localize`:Cancel button in a confirmation dialog@@common.dialog.cancel:Cancel`, role: 'cancel' },
    { text: $localize`:Confirms removing the item from the cart@@cart.remove.confirm:Remove`, role: 'destructive', handler: () => this.drop(line) },
  ],
})
```

```ts
// ToastController / ActionSheetController follow the same rule
await this.toastCtrl.create({ message: $localize`:Toast after an item is removed@@cart.toast.removed:Item removed`, duration: 1500 })
```

Leave `role`, `cssClass`, `icon`, `id` and handler code alone — they are not user-visible text.

## 6. Counts

- **Templates → ICU plural** inside a marked element:
  ```html
  <!-- before -->
  <p>{{ itemCount }} items</p>
  <!-- after -->
  <p i18n="Number of items in the cart@@cart.summary.count">{itemCount, plural, =0 {Your cart is empty} one {{{itemCount}} item} other {{{itemCount}} items}}</p>
  ```
  Always include `other`. Write only the source language's categories; translators add the ones their language needs.
- **TypeScript → rephrase** so the count needs no grammar (`Items in cart: ${count}:count:`), or move the text into a template ICU. `$localize` does not support ICU.
- **Never choose between messages with `Intl.PluralRules`, a ternary, or `count === 1`.** Target languages have categories the source lacks — Latvian `zero` covers 0, 10–20, 30, …; Russian adds `few` and `many` — so code-side branching produces grammar no translator can fix. Replace any existing `count === 1 ? 'item' : 'items'` with a template ICU.

## 7. `<ion-back-button>`

Give every `<ion-back-button>` an explicit `text` with `i18n-text`:

```html
<ion-back-button defaultHref="/" text="Back" i18n-text="Back navigation button@@nav.back.label"></ion-back-button>
```

Remove any global `backButtonText` from `provideIonicAngular({...})` / `IonicModule.forRoot({...})` — it is one untranslated string applied everywhere. (The default with no `text` is the platform's "Back", which is never translated either.)

## 8. `src/index.html` `<title>`

`src/index.html` is outside Angular — no `i18n` attribute there is ever extracted. Leave it. If the document title matters (browser tab, PWA), set it from the root component: `inject(Title).setTitle($localize\`:Browser tab title@@app.document.title:Shop\`)`, or use route `title`s marked with `$localize`.

## 9. Values

Follow `references/languages/js-ts/convert.format-pass.md` for TypeScript (`toFixed`, `toLocaleString`, `new Intl.*`, `'$' +`). Then these template rewrites:

| Before | After |
|---|---|
| `${{ x }}`, `{{ '$' + x }}`, `{{ x.toFixed(2) }}` in user-visible markup | `{{ x \| fmt:'money' }}` (or `fmt:'number'` when it is not a price) |
| A component method like `formatPrice(x)` that does `'$' + x.toFixed(2)` | `{{ x \| fmt:'money' }}`, and delete the method once unused |
| `\| currency` with no currency-code argument (defaults to USD) | `\| fmt:'money'` |
| `\| currency:'EUR'` | `\| fmt:'money':'EUR'` |
| `\| date:'MM/dd/yyyy'` (any custom pattern) | `\| fmt:'date'` — `fmt:'dateTime'` / `fmt:'time'` when the pattern had a time part |

Leave `| number`, `| percent`, and named-format `| date:'short'` / `| date:'mediumDate'` alone — they follow `LOCALE_ID` already. Add `FmtPipe` (imported from the module `.agents/globalize-rules.md` names) to the component's `imports` — or, for a component declared in an NgModule, to that module's `imports`.

## 10. What not to mark

CSS classes, `routerLink` paths, `id` / `data-*` / test IDs, `console.*` output, analytics event names, enum values compared in code, URLs, Ionic icon names (`name="cart-outline"`), `slot`, `fill`, `color`, `expand`, storage keys, and anything code parses back. A brand name inside a sentence stays as written; do not mark a lone brand name. The language switcher's endonyms are deliberately unmarked.

## 11. Do not run `ng extract-i18n` while wrapping

Several wrap workers edit files in parallel; extraction reads the whole project. The verify worker runs `npm run i18n:extract` once, after every wrap worker has finished, and reports duplicate IDs and missing descriptions then.
