---
type: ProgressBar
category: 2D
status: unimplemented
fixture: unit-progress-bar.tscn
# image: unit-progress-bar
renders_as: invisible transform-only fallback
---

# ProgressBar

ProgressBar shows a percentage fill (or an indeterminate "something is happening" animation) inside a Control-sized bar; the previewer parses and validates it but does not draw it yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `fill_mode` | `2` (`FILL_TOP_TO_BOTTOM`) | direction the fill grows in |
| `show_percentage` | `false` | suppresses the centered `"NN%"` label |
| `indeterminate` | `true` | swaps the percentage fill for the scanning animation |
| `editor_preview_indeterminate` | `true` | lets the indeterminate animation run in the editor too |

## Divergences

Not captured yet — nothing renders, so there is nothing to compare pixels against.

## Linting

<!-- lint:begin ProgressBar -->
Strict parsing format-checks these `ProgressBar` properties, plus 9 inherited from Range, 28 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `editor_preview_indeterminate` | true or false |
| `fill_mode` | enum 0-3 (FILL_BEGIN_TO_END/FILL_END_TO_BEGIN/FILL_TOP_TO_BOTTOM/FILL_BOTTOM_TO_TOP) |
| `indeterminate` | true or false |
| `show_percentage` | true or false |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-range-bounds` (type-family match) | `range-max-below-min` | error |
|  | `range-exp-edit-negative-min` | warning |
<!-- lint:end -->

The lenient parser reuses `parseControl` directly and never reads `fill_mode`,
`show_percentage`, `indeterminate` or `editor_preview_indeterminate` at all, so a
malformed value on any of them (say `fill_mode = 99`) is silently dropped from the
typed `ControlProperties` the renderer consumes — it survives only on the node's
raw string property bag, which nothing draws from, so nothing substitutes for it
and nothing renders differently, because ProgressBar draws nothing in either case
today.
