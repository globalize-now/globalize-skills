# CSS Modules and Vanilla CSS Logical Properties

This reference covers converting physical CSS properties to logical equivalents in plain `.css`, `.scss`, and `.module.css` files. The same mappings apply to CSS-in-JS libraries (styled-components, Emotion) but in camelCase.

---

## Quick Reference: Property Conversions

### Margin

```css
/* Before */
margin-left: 16px;
margin-right: 24px;

/* After */
margin-inline-start: 16px;
margin-inline-end: 24px;

/* Symmetric shorthand */
margin-inline: 16px;          /* both sides equal */
margin-inline: 16px 24px;     /* start end */
```

### Padding

```css
/* Before */
padding-left: 12px;
padding-right: 12px;

/* After */
padding-inline: 12px;         /* both sides equal */
padding-inline-start: 12px;   /* start only */
padding-inline-end: 8px;      /* end only */
```

### Positioning

```css
/* Before */
position: absolute;
left: 0;
right: auto;

/* After */
position: absolute;
inset-inline-start: 0;
inset-inline-end: auto;

/* All four sides at once */
inset: 0;                     /* replaces top:0; right:0; bottom:0; left:0 */

/* Inline axis only */
inset-inline: 0;              /* replaces left:0; right:0 */
inset-inline: 0 auto;         /* replaces left:0; right:auto */

/* Block axis only */
inset-block: 0;               /* replaces top:0; bottom:0 */
```

### Text alignment

```css
/* Before */
text-align: left;

/* After */
text-align: start;
```

### Float and clear

```css
/* Before */
float: left;
clear: right;

/* After */
float: inline-start;
clear: inline-end;
```

### Border

```css
/* Before */
border-left: 2px solid #ccc;
border-right-color: red;

/* After */
border-inline-start: 2px solid #ccc;
border-inline-end-color: red;
```

### Border radius

```css
/* Before */
border-top-left-radius: 8px;
border-top-right-radius: 4px;
border-bottom-right-radius: 4px;
border-bottom-left-radius: 8px;

/* After */
border-start-start-radius: 8px;
border-start-end-radius: 4px;
border-end-end-radius: 4px;
border-end-start-radius: 8px;
```

Corner name mapping:
- `top-left` = `start-start` (block-start, inline-start)
- `top-right` = `start-end` (block-start, inline-end)
- `bottom-right` = `end-end` (block-end, inline-end)
- `bottom-left` = `end-start` (block-end, inline-start)

### Scroll margin and padding

```css
/* Before */
scroll-margin-left: 16px;
scroll-padding-right: 8px;

/* After */
scroll-margin-inline-start: 16px;
scroll-padding-inline-end: 8px;
```

---

## Handling Shorthands

### 4-value margin/padding shorthands

The physical 4-value shorthand (`top right bottom left`) does NOT have a direct logical equivalent because it mixes block and inline axes.

```css
/* Before — asymmetric left/right */
margin: 8px 24px 8px 16px;  /* top right bottom left */

/* After — split into block and inline */
margin-block: 8px;              /* top and bottom */
margin-inline: 16px 24px;       /* start end */

/* Before — symmetric left/right */
margin: 8px 16px 8px 16px;  /* top right bottom left */

/* After — safe to use shorthand */
margin: 8px 16px;            /* block inline — already symmetric */
```

### 2-value shorthands

`margin: 8px 16px` (top/bottom left/right) is safe — left and right get the same value.

### `border-radius` shorthand

```css
/* Before */
border-radius: 8px 4px 4px 8px;  /* TL TR BR BL */

/* After — use longhand */
border-start-start-radius: 8px;
border-start-end-radius: 4px;
border-end-end-radius: 4px;
border-end-start-radius: 8px;
```

---

## CSS-in-JS Mappings

For styled-components, Emotion, and inline styles — same properties in camelCase:

| CSS Property | JS Property |
|-------------|-------------|
| `margin-inline-start` | `marginInlineStart` |
| `margin-inline-end` | `marginInlineEnd` |
| `padding-inline-start` | `paddingInlineStart` |
| `padding-inline-end` | `paddingInlineEnd` |
| `inset-inline-start` | `insetInlineStart` |
| `inset-inline-end` | `insetInlineEnd` |
| `border-inline-start` | `borderInlineStart` |
| `border-inline-end` | `borderInlineEnd` |
| `border-start-start-radius` | `borderStartStartRadius` |
| `border-start-end-radius` | `borderStartEndRadius` |
| `border-end-start-radius` | `borderEndStartRadius` |
| `border-end-end-radius` | `borderEndEndRadius` |

---

## Scanning Strategy

Search CSS files for these patterns:

```
High confidence (always convert):
  margin-left          margin-right
  padding-left         padding-right
  border-left          border-right
  text-align:\s*left   text-align:\s*right
  float:\s*left        float:\s*right
  clear:\s*left        clear:\s*right
  ^  left:             ^  right:          (as position properties)

Medium confidence (review context):
  border-top-left-radius    border-top-right-radius
  border-bottom-left-radius border-bottom-right-radius
  translateX(
  background-position:\s*(left|right)
  scroll-margin-left       scroll-margin-right
  scroll-padding-left      scroll-padding-right
```

For `left:` and `right:` as positioning properties, verify the element has `position: absolute`, `fixed`, or `sticky` — otherwise `left`/`right` are inert and don't need conversion.

---

## PostCSS Plugin (Optional Tooling)

For automated conversion during build, consider `postcss-logical`:

```bash
npm install postcss-logical --save-dev
```

```js
// postcss.config.js
module.exports = {
  plugins: [
    require('postcss-logical')({ dir: 'ltr' }),
  ],
}
```

This lets you write logical properties and generates fallback physical properties for browsers that don't support them. Browser support for logical properties is excellent in modern browsers (95%+ global coverage), so this fallback is only needed if you support IE11 or very old mobile browsers.

> **Note:** This plugin is a build-time convenience, not a substitute for writing logical properties in source code. The goal is to write logical properties in your source and let the tool handle fallbacks if needed.
