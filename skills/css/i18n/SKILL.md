---
name: css-i18n
description: >-
  Audit and convert CSS to use logical properties for RTL/bidirectional layout
  support. Use when the user asks to "make CSS RTL-safe", "use logical
  properties", "replace left/right with start/end", "audit CSS for i18n",
  "CSS internationalization", "fix CSS for RTL", "convert to logical
  properties", or when setting up any project that targets RTL locales (Arabic,
  Hebrew, Persian, Urdu). Works with Tailwind, CSS Modules, vanilla CSS,
  CSS-in-JS, and inline styles. Library-agnostic — works with any i18n setup.
---

# CSS Internationalization

Convert physical CSS properties (`left`, `right`, `margin-left`) to logical equivalents (`inset-inline-start`, `margin-inline-start`) so layouts flip automatically in RTL contexts.

**Why this matters:** Physical properties are anchored to the viewport, not the text direction. A `margin-left: 16px` stays on the left even when `dir="rtl"` — breaking the visual flow for Arabic, Hebrew, and other RTL scripts. Logical properties follow the text direction automatically.

---

## Step 1: Detect Styling Approach

Determine how the project writes CSS. This decides which patterns to scan for and which reference file to follow.

Check in order:

1. **Tailwind CSS** — `tailwind.config.*` exists, or `@tailwind` / `@import "tailwindcss"` appears in CSS files. See `references/tailwind.md`.
2. **CSS Modules** — files matching `*.module.css` or `*.module.scss`. See `references/css-modules-and-vanilla.md`.
3. **CSS-in-JS** — imports from `styled-components`, `@emotion/styled`, `@emotion/css`, `stitches`, `vanilla-extract`. Follow the same property mappings as vanilla CSS, but in camelCase (see Step 2 inline styles section).
4. **Vanilla CSS** — plain `.css` or `.scss` files. See `references/css-modules-and-vanilla.md`.
5. **Inline styles** — `style={{ marginLeft: ... }}` in JSX/TSX. Follow camelCase mappings in Step 2.

Projects often use multiple approaches. Scan for all that apply.

---

## Step 2: Scan and Convert

Work file-by-file. For each file, find physical directional properties and convert them to logical equivalents.

### Always convert (high confidence)

These are safe to convert in virtually all cases:

#### Margin and padding

| Physical | Logical |
|----------|---------|
| `margin-left` | `margin-inline-start` |
| `margin-right` | `margin-inline-end` |
| `padding-left` | `padding-inline-start` |
| `padding-right` | `padding-inline-end` |

Shorthands with explicit left/right values:
```css
/* Before — 4-value shorthand: top right bottom left */
margin: 0 24px 0 16px;

/* After — use longhand logical properties */
margin-block: 0;
margin-inline-start: 16px;
margin-inline-end: 24px;
```

When the left and right values are the same, use the `inline` shorthand:
```css
/* Before */
padding-left: 16px;
padding-right: 16px;

/* After */
padding-inline: 16px;
```

#### Positioning

| Physical | Logical |
|----------|---------|
| `left` | `inset-inline-start` |
| `right` | `inset-inline-end` |
| `top` | `inset-block-start` |
| `bottom` | `inset-block-end` |

When setting all four sides, use the `inset` shorthand:
```css
/* Before */
top: 0; right: 0; bottom: 0; left: 0;

/* After */
inset: 0;
```

#### Text alignment

| Physical | Logical |
|----------|---------|
| `text-align: left` | `text-align: start` |
| `text-align: right` | `text-align: end` |

`text-align: center` is already direction-neutral — no change needed.

#### Float and clear

| Physical | Logical |
|----------|---------|
| `float: left` | `float: inline-start` |
| `float: right` | `float: inline-end` |
| `clear: left` | `clear: inline-start` |
| `clear: right` | `clear: inline-end` |

#### Border

| Physical | Logical |
|----------|---------|
| `border-left` | `border-inline-start` |
| `border-right` | `border-inline-end` |
| `border-left-color` | `border-inline-start-color` |
| `border-right-color` | `border-inline-end-color` |
| `border-left-width` | `border-inline-start-width` |
| `border-right-width` | `border-inline-end-width` |
| `border-left-style` | `border-inline-start-style` |
| `border-right-style` | `border-inline-end-style` |

#### Sizing (less common but worth converting)

| Physical | Logical |
|----------|---------|
| `width` | `inline-size` |
| `height` | `block-size` |
| `min-width` | `min-inline-size` |
| `max-width` | `max-inline-size` |
| `min-height` | `min-block-size` |
| `max-height` | `max-block-size` |

> **Note on sizing:** `width`/`height` conversions are optional and lower priority. They only matter for vertical writing modes (CJK vertical text), not standard RTL. Convert these only if the project explicitly supports vertical writing modes, or leave for a future pass. Focus on left/right conversions first.

#### Overflow and overscroll

| Physical | Logical |
|----------|---------|
| `overflow-x` | `overflow-inline` |
| `overflow-y` | `overflow-block` |
| `overscroll-behavior-x` | `overscroll-behavior-inline` |
| `overscroll-behavior-y` | `overscroll-behavior-block` |

#### Inline styles (JSX)

The same conversions apply in camelCase:

```tsx
// Before
<div style={{ marginLeft: 16, paddingRight: 8, textAlign: 'left' }}>

// After
<div style={{ marginInlineStart: 16, paddingInlineEnd: 8, textAlign: 'start' }}>
```

### Convert with judgment (medium confidence)

Review these case-by-case. Ask whether the direction is semantic (follows text flow) or decorative (always the same side).

- **Border radius with 4 physical corners:**
  ```css
  /* Physical corners */
  border-top-left-radius: 8px;
  border-top-right-radius: 0;

  /* Logical corners */
  border-start-start-radius: 8px;
  border-start-end-radius: 0;
  ```
  Corner mapping: `top-left` = `start-start`, `top-right` = `start-end`, `bottom-left` = `end-start`, `bottom-right` = `end-end`.

- **`transform: translateX()`**: Does not auto-flip. If the translation follows text direction (e.g., slide-in from the leading edge), it needs a conditional or CSS custom property:
  ```css
  /* Option 1: custom property set by dir attribute */
  :root { --dir: 1; }
  :root[dir="rtl"] { --dir: -1; }
  .slide-in { transform: translateX(calc(var(--dir) * 100%)); }

  /* Option 2: dir-aware selectors */
  .slide-in { transform: translateX(100%); }
  [dir="rtl"] .slide-in { transform: translateX(-100%); }
  ```

- **`background-position: left/right`**: Convert only if the position is semantic (e.g., icon on the leading side of an input). Leave if decorative.

- **4-value shorthands where sides differ**: `margin: 8px 24px 8px 16px` — the left (16px) and right (24px) differ, so you need longhand logical properties.

- **`scroll-margin-left/right`** → `scroll-margin-inline-start/end`
- **`scroll-padding-left/right`** → `scroll-padding-inline-start/end`

### Never convert

- **Intentionally fixed direction**: A "back" arrow that always points left regardless of locale, a scrollbar that must be on a specific side, absolute pixel positioning for canvas/game elements.
- **Animation keyframes**: `@keyframes` with directional transforms are typically decorative. Only convert if the animation semantically follows text direction.
- **`writing-mode`**: This property controls the axis itself — it's not a candidate for conversion.
- **SVG attributes**: `x`, `y`, `width`, `height` in SVG are coordinate-system properties, not layout properties.
- **Print stylesheets**: `@media print` rules rarely need RTL conversion.

---

## Step 3: Flexbox and Grid

Flexbox and grid layouts automatically respect `dir="rtl"` — the main axis flips without any CSS changes. This means:

- `justify-content: flex-start` already aligns to the right in RTL
- `order` values already reverse visual order in RTL
- Column order in `grid-template-columns` already flips

**What still needs attention:**

- **`gap` with asymmetric values**: `column-gap` and `row-gap` are direction-neutral and safe. No conversion needed.
- **Directional icons in flex items**: An icon that means "forward" should flip in RTL. Use `transform: scaleX(-1)` with a dir-aware selector, or provide separate RTL icon assets.
- **`flex-direction: row-reverse`**: In RTL, `row-reverse` reverses the already-reversed direction (back to LTR visual order). If `row-reverse` was used to create a right-to-left flow in LTR, it may be incorrect in RTL. Review the intent.

---

## Step 4: Workflow

Process files in this priority order (matching the translate skill's pattern):

1. **Layout components** (app shell, sidebar, navbar, footer) — affect every page
2. **Shared components** (buttons, cards, modals, form fields) — reused everywhere
3. **Page-level styles** — specific to one view
4. **Utility/global CSS** — reset files, base styles, CSS custom properties

Within each file:
1. Find all physical directional properties
2. Classify each as high/medium/never-convert
3. Apply conversions
4. Verify visually (Step 5)

---

## Step 5: Verify

After converting, verify the layout works in both LTR and RTL:

1. **Toggle direction**: Set `<html dir="rtl">` in the browser DevTools or your app's locale switcher
2. **Visual scan**: Check that:
   - Text aligns to the right edge
   - Margins and padding mirror correctly
   - Positioned elements (tooltips, dropdowns, sidebars) appear on the correct side
   - Icons that should flip do flip (navigation arrows, "forward"/"back")
   - Icons that should NOT flip don't (checkmarks, universal symbols, logos)
3. **Run existing tests**: Verify no regressions. CSS changes can affect snapshot tests.
4. **Check edge cases**:
   - Overlapping elements (absolute/fixed positioning)
   - Scroll containers
   - Horizontal overflow

---

## Common Gotchas

- **`direction: rtl` in CSS vs `dir="rtl"` in HTML**: Always use the HTML `dir` attribute, not the CSS `direction` property. The HTML attribute is semantic and affects form behavior, keyboard navigation, and bidi algorithm. The CSS property only affects visual rendering.
- **Mixed content**: A page with both LTR and RTL content (e.g., English UI with Arabic user input) needs `dir="auto"` or explicit `dir` attributes on content blocks. Logical properties work correctly in nested direction contexts.
- **Horizontal scrolling**: `overflow-x: auto` doesn't flip the scrollbar position in all browsers. Test explicitly.
- **Third-party components**: Components from UI libraries may use physical properties internally. Check if the library provides RTL support or an RTL theme.
- **`px` shorthands with 2 values**: `margin: 8px 16px` sets top/bottom and left/right — but this works correctly because left/right get the same value. Only asymmetric 4-value shorthands need conversion.
