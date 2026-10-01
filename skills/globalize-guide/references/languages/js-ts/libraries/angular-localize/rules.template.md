---
name: angular-localize-code
user_invocable: false
description: >-
  Apply automatically whenever writing or modifying UI code in an Angular app that
  localizes with @angular/localize — component templates, component and service
  TypeScript, Ionic overlay controllers, or any change that adds or edits
  user-visible text. Not user-invocable. Ensures every message carries a
  description and an explicit ID, plurals use template ICU, and values are
  formatted through the project's formatters module.
template: angular-localize
templateVersion: 1
conditions: [ionic, bootstrap]
values: [sourceLocale, targetLocales, catalogPath, formatModule]
budget: { "ionic == \"true\"": 215, "default": 185 }
---

# Angular (`@angular/localize`) Coding Rules

Apply these rules as you write code. Every user-visible string is marked for translation before the task is complete — in templates with an `i18n` attribute, in TypeScript with `$localize`.

**This project:**
- Source catalog: `<<catalogPath>>` (XLIFF 2.0). It is generated — never edit it by hand. Run `npm run i18n:extract` after adding or changing any message and commit the regenerated file.
- Source locale `<<sourceLocale>>`. Target locales `<<targetLocales>>` arrive from the translation platform as sibling `messages.<locale>.xlf` files. Never hand-write a target file.
- Translations load at runtime, before the app boots. The language changes only by reload: call `setLanguage(code)` from `src/app/i18n/locale.ts`. Never try to swap the language in place.

## Every message: description + explicit ID

Format: `description@@feature.element.purpose`.

- The description tells the translator where the text appears and what it does ("Button that adds the product to the cart"). Never put `|` in it — Angular reads the text before `|` as a *meaning*, and that changes the message.
- The ID is lowercase, dot-separated `feature.element.purpose` (`cart.checkout.button`). Never omit it: an automatic ID hashes the source text, so fixing a typo orphans every translation.
- One ID, one text. Reusing an ID for different text is a duplicate-ID error at extraction. The same ID on identical text in two places is fine.
- Editing the source text of an existing ID keeps the old translation live until it is retranslated. When the meaning changes, use a new ID.

## Templates

Text content and static attributes:

```html
<h1 i18n="Cart page title@@cart.header.title">Your cart</h1>
<input placeholder="Search products" i18n-placeholder="Search field placeholder@@search.input.placeholder" />
<img [src]="url" alt="Product photo" i18n-alt="Product image alt text@@product.image.alt" />
<span i18n="Greeting at the top of the account page@@account.header.greeting">Hi {{ name }}</span>
```

- Mark `placeholder`, `title`, `aria-label`, `alt`, and every other attribute a user reads or hears, with `i18n-<attr>` beside it.
- Bound attributes (`[label]="…"`) cannot take `i18n-*`. Put the text in a `$localize` field on the component and bind that.
- Interpolation inside marked text becomes a placeholder translators can move. Never split one sentence across several marked elements — mark the parent; inline elements become placeholders.
- Use `<ng-container i18n="…@@id">` to mark text without adding an element.

## Plurals and selects — templates only

```html
<span i18n="Number of items in the cart badge@@cart.badge.count">{count, plural, =0 {Cart is empty} one {{{count}} item} other {{{count}} items}}</span>
<span i18n="Order status label@@order.status.label">{status, select, shipped {Shipped} pending {Pending} other {Unknown}}</span>
```

- Always include `other`. Write the source language's categories only; translators add the categories their language needs (Latvian adds `zero`, Russian adds `few` and `many`).
- **Never choose between messages with `Intl.PluralRules`, a ternary, or `count === 1`.** Target languages have categories the source lacks, so code-side branching produces grammar no translator can fix.

## TypeScript — `$localize`

```ts
title = $localize`:Title of the order history screen@@orders.page.title:Order history`
added = $localize`:Toast after adding to cart@@cart.toast.added:Added ${productName}:productName: to the cart`
```

- Name every placeholder: `${expr}:name:`. An unnamed one becomes `PH`, `PH_1`, which tells the translator nothing.
- **No ICU in `$localize`** — Angular does not support it. When a TypeScript string depends on a count, rephrase so the count needs no grammar (`Items in cart: ${count}:count:`), or move the text into a template ICU.
- `$localize` runs once, when its code first executes. Module-level constants are fine: translations are loaded before the app is imported.
- **Never add a static import from `app/` to `src/main.ts`.** `main.ts` loads translations and then imports the app with `import()`. A static import evaluates `$localize` before translations exist, and that text stays in `<<sourceLocale>>` with no error.

<!-- if: ionic == "true" -->
## Ionic components

- Static text props get `i18n-<prop>`: `label`, `text`, `header`, `sub-header`, `message`, `placeholder`, `cancel-text`, `ok-text`, `done-text`, `helper-text`, `error-text`.

  ```html
  <ion-input label="Email" i18n-label="Login form email field label@@login.email.label"></ion-input>
  <ion-back-button text="Back" i18n-text="Back navigation button@@nav.back.label"></ion-back-button>
  ```

- Give every `<ion-back-button>` an explicit `text` with `i18n-text`. Never set `backButtonText` in the global Ionic config — it is one untranslated string.
- Overlay controllers (`AlertController`, `ToastController`, `ActionSheetController`, `LoadingController`, `PickerController`): every user-visible option — `header`, `subHeader`, `message`, each button's `text` — is a `$localize` string.

  ```ts
  await this.alertCtrl.create({
    header: $localize`:Title of the remove-item confirmation@@cart.remove.title:Remove item?`,
    buttons: [
      { text: $localize`:Cancel button in a confirmation dialog@@common.dialog.cancel:Cancel`, role: 'cancel' },
      { text: $localize`:Confirms removing the item from the cart@@cart.remove.confirm:Remove`, role: 'destructive' },
    ],
  })
  ```

- `ion-select` `[interfaceOptions]` and `ion-datetime` button labels follow the same rule.
<!-- /if -->

## Values: numbers, prices, dates, lists

Format every user-visible value through `<<formatModule>>`. Never use `toFixed`, `toLocaleString`, `new Intl.*`, or a hardcoded currency symbol in components.

- Templates use the `fmt` pipe:

  ```html
  <p>{{ price | fmt:'money' }} · {{ total | fmt:'money':'EUR' }} · {{ placedAt | fmt:'date' }} · {{ updatedAt | fmt:'relativeTime' }}</p>
  ```

<!-- if: bootstrap == "standalone" -->
- Add `FmtPipe` from `<<formatModule>>` to the component's `imports`.
<!-- /if -->
<!-- if: bootstrap == "ngmodule" -->
- Add `FmtPipe` from `<<formatModule>>` to the `imports` of the NgModule that declares the component (it is a standalone pipe), or to the component's own `imports` if the component is standalone.
<!-- /if -->
- TypeScript imports `money`, `number`, `percent`, `compact`, `unit`, `date`, `time`, `dateTime`, `relativeTime`, `list` from `<<formatModule>>`.
- `percent()` takes a ratio: `percent(0.42)` renders 42 %.
- Format the value, then interpolate: `` $localize`:Order total line@@checkout.total.label:Total: ${money(total)}:total:` ``. Never split a sentence to isolate a number.
- A shape the ten functions lack becomes a new preset inside `<<formatModule>>`, never an inline options object.
- Do not add new uses of Angular's `date`, `currency`, `number` or `percent` pipes. They follow the active locale but take hardcoded patterns, and `currency` defaults to USD. Use `fmt`.

## What not to mark

CSS classes, `routerLink` paths, `id` / `data-*` / test IDs, `console.*` output, analytics event names, enum values compared in code, URLs, icon names (`name="cart-outline"`), storage keys, and anything code parses back. A brand name inside a sentence stays as written; do not mark a lone brand name.

## After editing

Run `npm run i18n:extract`. It must finish with no duplicate-ID warning, and every unit in `<<catalogPath>>` must have a description note. Commit the regenerated catalog with the code.
