---
type: Parallax2D
category: 2D
status: done
fixture: unit-parallax-2d.tscn
image: unit-parallax-2d
renders_as: a Node2D scrolled by the camera, repeated over repeat_size
---

# Parallax2D

Parallax2D repeats and scroll-offsets its children to fake camera depth. The previewer
replaces its position with Godot's scroll formula each render pass and draws the subtree once
per repeat copy. A sub-viewport's current Camera2D writes the screen offset.

## Linting

<!-- lint:begin Parallax2D -->
Strict parsing format-checks these `Parallax2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `autoscroll` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `follow_viewport` | true or false |  |
| `ignore_camera_scroll` | true or false |  |
| `limit_begin` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `limit_end` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `repeat_size` | Vector2(x, y), each >= 0 |  |
| `repeat_times` | integer >= 1 | error below |
| `screen_offset` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `scroll_offset` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `scroll_scale` | Vector2(x, y), or the Vector2i spelling Godot converts |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
<!-- lint:end -->

An unreadable scroll key falls back to its Godot default: `scroll_scale` `Vector2(1, 1)`,
the offsets and `repeat_size` `Vector2(0, 0)`, `repeat_times` 1, the limits `-10000000` and
`10000000`, `follow_viewport` true. A negative `repeat_size` component is clamped to `0` and
`repeat_times` below 1 to 1, as the setters do.

## Known limitations

- **Needs runtime** `autoscroll` moves the node only in a running game, so a still frame
  shows none, as in Godot.
- **Approximated** Picking a repeat copy, other than the last, selects the Parallax2D's
  child, not the copy.
