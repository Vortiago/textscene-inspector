---
type: ProgressBar
category: 2D
status: unimplemented
fixture: unit-progress-bar.tscn
# image: unit-progress-bar
renders_as: invisible transform-only fallback
---

# ProgressBar

ProgressBar shows a percentage fill, or an indeterminate animation, inside a bar. The
previewer parses and validates it but does not draw it, so it renders as a
transform-only fallback and its children still show.

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
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-range-bounds` (type-family match) | `range-max-below-min` | error |
|  | `range-exp-edit-negative-min` | warning |
<!-- lint:end -->

The lenient parser reuses `parseControl` directly and never reads `fill_mode`,
`show_percentage`, `indeterminate` or `editor_preview_indeterminate`. A `fill_mode = 99`
survives only in the raw property bag, which nothing draws from.

## Known limitations

- **Not drawn** Godot draws the bar and its fill. The previewer draws nothing for this
  node.
