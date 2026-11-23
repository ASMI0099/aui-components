# Theming

The looks of the components come from CSS custom properties (design tokens). A page sets them on `:root` (every
component), on a container (the components inside it) or on one component (`style="..."`). The values below are the
defaults.

```css
:root {
    --aui-control-accent-color: #6f42c1;     /* focus ring, open fields, checked boxes, primary buttons */
    --aui-control-radius: 6px;               /* the corners of the fields */
    --aui-font-scale: 0.93;                  /* every text one step smaller */
}

.dense-form {
    --aui-control-height: 30px;
}
```

## Colours

Each colour token is registered with `@property` as a `<color>`: a value that is not a colour (a typo) gives the
default, never an unreadable field.

| Token | Default | Used for |
|---|---|---|
| `--aui-control-accent-color` | `#0d6efd` | the focus and open look (border and 2px ring), the open chevron, the picked option, the checkboxes, links and spinners of the lists, the primary button |
| `--aui-control-value-color` | `#1f2328` | the value: in the field, typed, in the rows of a list and its search box |
| `--aui-control-label-color` | `#64748b` | the label in the box and above it |
| `--aui-control-placeholder-color` | `#9aa8b8` | the placeholders of the fields and of their search boxes: a light hint |
| `--aui-control-muted-color` | `#64748b` | second texts: counts, readonly values, empty and loading texts of a list, the password eye |
| `--aui-control-disabled-color` | `#a8abb2` | the text of a disabled field or option |
| `--aui-control-border-color` | `#8590a0` | the border of a field |
| `--aui-control-border-hover-color` | `#737f90` | the border under the pointer |
| `--aui-control-divider-color` | `#d6dce5` | the line between a label in the box and the value |
| `--aui-control-invalid-color` | `#dc3545` | an invalid field (border, halo, ring), a count over its limit, the error text |
| `--aui-control-background-color` | `#ffffff` | the field and its panel |
| `--aui-control-readonly-background-color` | `#f8fafc` | a readonly or disabled field |

The shades the components need (hover, pressed, tints of the accent and of the invalid colour) are mixed from these
two colours with `color-mix()`, so changing `--aui-control-accent-color` or `--aui-control-invalid-color` recolours
everything. A browser without `color-mix()` draws the default shades.

Keep the text colours readable. On white the defaults meet WCAG AA: 4.5:1 for the value, the labels and the second
texts, 3:1 for the field border (3.2:1) and the focus ring. The placeholder is a light hint (2.4:1), so that it never
reads as a value; a page that must meet 4.5:1 for placeholders too sets `--aui-control-placeholder-color: #64748b`
(4.76:1 on white).
A primary button draws white text on the accent colour, so an accent lighter than about `#0d6efd` loses contrast.

## Sizes and shapes

| Token | Default | |
|---|---|---|
| `--aui-control-height` | `34px` | the height of the fields, from 28px to 40px (a field's `size="small"` is 28px, `size="large"` 40px) |
| `--aui-control-radius` | `3px` | the corners of the fields |
| `--aui-control-value-size` | 14px (scaled) | the size of a field's value |
| `--aui-control-label-size` | 13px (scaled) | the size of a field's label |
| `--aui-control-option-size` | the value size | the size of the rows of a list |
| `--aui-field-item-min-width` | `264px` | the smallest width of a field in a form layout |

## Text scale

`--aui-font-scale`, set on `:root`, scales every text size of the components: `1` is the design size, `0.93` turns
14px into 13px, 13px into 12px. Each size is rounded to a whole pixel. The factor counts between `0.85` and `1.25` (the
boxes keep their heights, so their text has to fit); a value that is not a number counts as `1`.

`--aui-label-font-scale` scales the labels of the fields on their own: a page that makes its text smaller can keep the
labels readable (`--aui-font-scale: 0.9; --aui-label-font-scale: 1`).

## Motion

| Token | Default | |
|---|---|---|
| `--aui-motion-duration` | `0.2s` | colour, ring and opacity changes |
| `--aui-motion-duration-shape` | `0.22s` | scale, corners and height |
| `--aui-motion-ease` | `cubic-bezier(0.16, 1, 0.3, 1)` | panels opening and closing |
| `--aui-motion-ease-color` | `cubic-bezier(0, 0, 0.58, 1)` | colour changes |

With the user's `prefers-reduced-motion: reduce`, the panels open and close without moving.

## High contrast

In forced-colours mode (Windows high contrast) the components drop their shadows and tints and show their focus and
states with the system colours.
