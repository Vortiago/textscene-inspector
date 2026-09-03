---
type: ColorPickerButton
category: 2D
status: unimplemented
fixture: unit-color-picker-button.tscn
# image: unit-color-picker-button
renders_as: invisible transform-only fallback, not drawn yet
---

# ColorPickerButton

A Button that opens a ColorPicker popup when pressed, toggling the popup's visibility (ADR-0003 routes Controls through the 2D DOM overlay). The previewer parses and validates every member below but does not draw it yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `color` | `Color(0.8, 0.3, 0.5, 0.6)` | the initially selected, partially transparent color shown on the button face |
| `edit_alpha` | `false` | hides the alpha channel slider in the popped-up ColorPicker |
| `edit_intensity` | `false` | hides the intensity slider in the popped-up ColorPicker |

## Divergences

Not captured yet: nothing renders, so there is nothing to compare pixels against.

## Linting

<!-- lint:begin ColorPickerButton -->
Strict parsing format-checks these `ColorPickerButton` properties, plus 13 inherited from Button, 10 inherited from BaseButton, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `color` | Color(r, g, b, a) |  |
| `edit_alpha` | true or false |  |
| `edit_intensity` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-button-group` (type-family match) | `button-group-without-toggle-mode` | warning |
<!-- lint:end -->

`index.ts` reuses `parseButton` unchanged, which reads only Button's own keys
(`text`, `disabled`, `flat`, `alignment`, `icon`, `icon_alignment`,
`vertical_icon_alignment`, `expand_icon`) plus whatever `parseControl` reads
beneath it. It never reads `color`, `edit_alpha` or `edit_intensity` at all, so
a malformed `color = Color(1, 1)` or a non-boolean `edit_alpha = maybe` loads
and renders identically to a well-formed scene under the lenient parser:
nothing consumes the value, so nothing can notice it is wrong. The strict
parser is the only one that inspects these three keys.
