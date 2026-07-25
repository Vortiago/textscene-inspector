---
type: PathFollow2D
category: 2D
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

**Marker colour.** Godot fills the square with `(76, 204, 255)` — the exact sRGB of
`Color(0.3, 0.8, 1)`. Ours renders a paler, desaturated `(134, 207, 225)`: the
Polygon2D child passes through the scene's editor-preview FILMIC tonemapping
([ADR-0025], injected by the reference harness), which highlight-compresses and
desaturates, whereas Godot's 2D canvas is not tonemapped. Same cause as `line2d`.

The follow position now agrees — both draw the square at the path midpoint. The
fixture drives the follower with absolute `progress`, which both renderers honour
at load; `progress_ratio` would still diverge, since Godot binds the parent Path2D
only on enter-tree and drops a ratio set during scene load, while ours applies it
directly.

[ADR-0025]: ../../adr/0025-preview-lighting-mirrors-the-godot-editor.md
