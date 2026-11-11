---
type: ProgressBar
category: 2D
status: unreviewed
fixture: unit-progress-bar.tscn
# image: unit-progress-bar
renders_as: a background and ratio-filled StyleBox pair, with a percentage label
---

# ProgressBar

ProgressBar draws its `background` StyleBox across the whole control and its `fill`
StyleBox windowed to the current value's ratio, in the direction `fill_mode` names.
Unless `indeterminate` is set, it adds a centred percentage label with an optional outline.
While `localize_numeral_system` is true, its default, the label uses the digits of the project locale. It
ends with the percent sign of that locale (`progress_bar.cpp:168-174`).

## Linting

<!-- lint:begin ProgressBar -->
Strict parsing format-checks these `ProgressBar` properties, plus 9 inherited from Range, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `editor_preview_indeterminate` | true or false |  |
| `fill_mode` | enum 0-3 (FILL_BEGIN_TO_END/FILL_END_TO_BEGIN/FILL_TOP_TO_BOTTOM/FILL_BOTTOM_TO_TOP) | error |
| `indeterminate` | true or false |  |
| `show_percentage` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-range-bounds` (type-family match) | `range-max-below-min` | error |
|  | `range-exp-edit-negative-min` | warning |
<!-- lint:end -->

The lenient parser reads `fill_mode`, `show_percentage`, `indeterminate` and
`editor_preview_indeterminate` alongside its Control and Range bases. A `fill_mode`
outside 0-3 draws as `FILL_BEGIN_TO_END`: `set_fill_mode`'s `ERR_FAIL_INDEX` refuses
the out-of-range write, so the node keeps its class-default mode.

The percentage's outline is a stroked contour ring with a one-sided radius of `outline_size / 4` px
(`text_server_adv.cpp:1383`), drawn before the text (`progress_bar.cpp:180-181`). It draws on the
canvas painter for the bundled font and a scene font alike, as does the fill (ADR-0065).
Each glyph and its ring draw from FreeType's bitmap, as Godot draws them.

A BMFont (`.fnt`, `.font`) as the theme font draws from its page images, with its outline set under an
outline ring (ADR-0064).

## Known limitations

- **Approximated** `indeterminate` never animates, so the previewer always draws Godot's
  static frame (the bar centred in the control), whatever `editor_preview_indeterminate`
  says.
- **Resource gap** A SystemFont always draws the default font, as Godot does when no OS font matches its names, where Godot draws a matching OS font.
