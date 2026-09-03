---
type: PathFollow2D
category: 2D
status: unreviewed
fixture: unit-pathfollow2d.tscn
image: unit-pathfollow2d
renders_as: a transform-only follower with a selection-gated dot
---

# PathFollow2D

PathFollow2D positions its children along the parent Path2D's curve; it has no
runtime visual of its own, and its follow-point marker is a selection-gated dot
gizmo (ADR-0018) that is absent in a plain capture. What makes the follow point
visible here is its child `Polygon2D` — a 20 px square that sits wherever the
follower lands. In both images that square is the only thing drawn on the grey
field, so its position and colour report the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `Follower.progress` | `320.0` | the follow distance in pixels — the midpoint of the 640 px path; both renderers honour absolute `progress` at scene load |
| `TrackPath.position` | `Vector2(440, 240)` | the curve origin in screen space; the follower rides 320 px along from here to `(680, 320)` |
| `TrackPath.curve` | `Curve2D_loop` | the rectangular path `(0,0)→(240,0)→(240,160)→(0,160)` the follower rides |
| `Marker.color` | `Color(0.3, 0.8, 1, 1)` | the square's fill, a sky-blue |
| `Marker.polygon` | 20×20 quad | the visible square marking the follow point |

## Divergences

**Marker colour.** Godot fills the square with `(76, 204, 255)`, the exact sRGB of
`Color(0.3, 0.8, 1)`; ours renders a paler `(134, 207, 225)`. See "Why 2D colours read paler in our captures" in docs/comparison/README.md.

The follow position agrees — both draw the square at the path midpoint. `progress`
is the only position key a scene file can carry: Godot binds the parent Path2D on
enter-tree, which is after a node's properties are applied, so a stored
`progress_ratio` is refused outright and a stored `progress` skips the wrap/clamp
branch and survives raw. Ours resolves the follower the same way, from `progress`
alone and without wrapping it for `loop`.


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

`rotates`, `cubic_interp`, and `loop` fall back to Godot's default `true`; `h_offset`
and `v_offset` fall back to `0`. `progress` and `progress_ratio` stay `undefined`
when absent, but if present with an unparseable value each falls to `0` with a
warning instead of staying unset. The lenient parser still reads `progress_ratio`
even though nothing positions from it, so a bad value is reported rather than
skipped for being unusable anyway.
