---
type: PathFollow2D
category: 2D
status: unreviewed
fixture: unit-pathfollow2d.tscn
image: unit-pathfollow2d
renders_as: a transform-only follower with a selection-gated dot
---

# PathFollow2D

PathFollow2D places its children along the parent Path2D's curve and draws nothing
itself. Its follow-point dot is selection-gated (ADR-0018), and the previewer positions
the children from `progress` alone, as Godot does on load.

## Linting

<!-- lint:begin PathFollow2D -->
Strict parsing format-checks these `PathFollow2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `cubic_interp` | true or false |  |
| `h_offset` | float |  |
| `loop` | true or false |  |
| `progress` | float |  |
| `progress_ratio` | float |  |
| `rotates` | true or false |  |
| `v_offset` | float |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-pathfollow2d` | `pathfollow2d-no-parent` | warning |
|  | `pathfollow2d-invalid-parent` | warning |
|  | `pathfollow2d-negative-progress` | info |
|  | `pathfollow2d-progress-ratio-ignored` | error |
<!-- lint:end -->

`rotates`, `cubic_interp` and `loop` fall back to `true`, `h_offset` and `v_offset` to
`0`. `progress` and `progress_ratio` stay `undefined` when absent but fall to `0` with a
warning when unparseable.
