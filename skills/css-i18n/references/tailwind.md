# Tailwind CSS Logical Properties

Tailwind provides logical property utilities that map to CSS logical properties. Convert physical utilities to their logical equivalents.

---

## Class Conversion Table

### Margin

| Physical | Logical | CSS output |
|----------|---------|------------|
| `ml-{n}` | `ms-{n}` | `margin-inline-start` |
| `mr-{n}` | `me-{n}` | `margin-inline-end` |
| `mx-{n}` | `mx-{n}` | No change needed — `mx` maps to `margin-inline` in Tailwind v3.3+ |

### Padding

| Physical | Logical | CSS output |
|----------|---------|------------|
| `pl-{n}` | `ps-{n}` | `padding-inline-start` |
| `pr-{n}` | `pe-{n}` | `padding-inline-end` |
| `px-{n}` | `px-{n}` | No change needed — `px` maps to `padding-inline` in Tailwind v3.3+ |

### Positioning

| Physical | Logical | CSS output |
|----------|---------|------------|
| `left-{n}` | `start-{n}` | `inset-inline-start` |
| `right-{n}` | `end-{n}` | `inset-inline-end` |
| `inset-x-{n}` | `inset-x-{n}` | No change needed — direction-neutral |

### Text alignment

| Physical | Logical |
|----------|---------|
| `text-left` | `text-start` |
| `text-right` | `text-end` |
| `text-center` | `text-center` (no change) |

### Float

| Physical | Logical |
|----------|---------|
| `float-left` | `float-start` |
| `float-right` | `float-end` |

### Border

| Physical | Logical | CSS output |
|----------|---------|------------|
| `border-l-{n}` | `border-s-{n}` | `border-inline-start-width` |
| `border-r-{n}` | `border-e-{n}` | `border-inline-end-width` |
| `border-l-{color}` | `border-s-{color}` | `border-inline-start-color` |
| `border-r-{color}` | `border-e-{color}` | `border-inline-end-color` |

### Scroll margin and padding

| Physical | Logical |
|----------|---------|
| `scroll-ml-{n}` | `scroll-ms-{n}` |
| `scroll-mr-{n}` | `scroll-me-{n}` |
| `scroll-pl-{n}` | `scroll-ps-{n}` |
| `scroll-pr-{n}` | `scroll-pe-{n}` |

### Border radius

| Physical | Logical |
|----------|---------|
| `rounded-tl-{n}` | `rounded-ss-{n}` |
| `rounded-tr-{n}` | `rounded-se-{n}` |
| `rounded-bl-{n}` | `rounded-es-{n}` |
| `rounded-br-{n}` | `rounded-ee-{n}` |
| `rounded-l-{n}` | `rounded-s-{n}` |
| `rounded-r-{n}` | `rounded-e-{n}` |

---

## Utilities That Already Flip Automatically

These utilities use CSS properties that inherently respect `dir="rtl"`. No conversion needed:

- **`space-x-{n}`** — uses `margin-inline-start` under the hood (Tailwind v3.3+), auto-flips
- **`divide-x-{n}`** — uses `border-inline-start-width` under the hood, auto-flips
- **Flexbox utilities** (`flex-row`, `justify-start`, `items-start`, `gap-{n}`) — flex layout auto-flips with `dir`
- **Grid utilities** (`grid-cols-*`, `col-start-*`) — grid layout auto-flips with `dir`
- **`mx-{n}` and `px-{n}`** — symmetric, same value both sides

---

## RTL/LTR Variant Modifiers

For edge cases where you need direction-specific styles that should NOT flip, Tailwind provides `rtl:` and `ltr:` variant modifiers:

```html
<!-- Icon that should always point right in LTR, left in RTL -->
<span class="ltr:rotate-0 rtl:rotate-180">&#x2192;</span>

<!-- Different spacing for RTL only -->
<div class="ms-4 rtl:ms-8">
```

Use these sparingly — they indicate a pattern that logical properties can't handle, typically directional icons or asymmetric decorative layouts.

**Enable RTL/LTR variants:** These are enabled by default in Tailwind v3.3+. For older versions, add to `tailwind.config.js`:

```js
module.exports = {
  // ... Tailwind v3.0-3.2 only
  plugins: [require('tailwindcss-rtl')], // or enable manually
}
```

---

## Version Notes

- **Tailwind v3.3+**: Logical property utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `float-start`, `text-start`, `rounded-s-*`, `rounded-e-*`, `border-s-*`, `border-e-*`) are built-in. `rtl:` and `ltr:` variants are enabled by default.
- **Tailwind v3.0-3.2**: Logical utilities not available natively. Use the `tailwindcss-rtl` plugin or write custom utilities. The `rtl:` / `ltr:` variants can be enabled via plugin.
- **Tailwind v4**: Logical property utilities remain the same. CSS-first configuration doesn't change the utility names.

---

## Scanning Strategy

When auditing a Tailwind project, search for these patterns in JSX/TSX files:

```
className patterns to find and replace:
  ml-     → ms-
  mr-     → me-
  pl-     → ps-
  pr-     → pe-
  left-   → start-
  right-  → end-
  text-left  → text-start
  text-right → text-end
  float-left  → float-start
  float-right → float-end
  border-l  → border-s
  border-r  → border-e
  rounded-l  → rounded-s
  rounded-r  → rounded-e
  rounded-tl → rounded-ss
  rounded-tr → rounded-se
  rounded-bl → rounded-es
  rounded-br → rounded-ee
  scroll-ml → scroll-ms
  scroll-mr → scroll-me
  scroll-pl → scroll-ps
  scroll-pr → scroll-pe
```

Be careful with search-and-replace: `ml-` also matches `xml-` in some contexts. Search within `className` or `class` attribute values only.
