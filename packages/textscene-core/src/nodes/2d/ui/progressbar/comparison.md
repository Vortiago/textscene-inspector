---
type: ProgressBar
category: 2D
status: unreviewed
fixture: unit-progress-bar.tscn
# image: unit-progress-bar
renders_as: a background and ratio-filled StyleBox pair, with a percentage label
---

# ProgressBar

ProgressBar draws its `background` StyleBox across the whole control, its `fill`
StyleBox windowed to the current value's ratio in the direction `fill_mode` names, and,
unless `indeterminate`, a centred percentage label with an optional outline.

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

## Known limitations

- **Approximated** `indeterminate` never animates. The previewer always draws the one
  frame Godot itself treats as static (the bar centred in the control), regardless of
  `editor_preview_indeterminate`.
