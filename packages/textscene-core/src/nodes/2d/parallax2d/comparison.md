---
type: Parallax2D
category: 2D
status: unimplemented
fixture: unit-parallax-2d.tscn
# image: unit-parallax-2d
renders_as: invisible transform-only fallback
---

# Parallax2D

Parallax2D repeats and scroll-offsets its children to fake camera depth. The previewer
parses and validates it but applies no motion, so it renders as a transform-only
fallback and its children show at their authored transform.

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

The lenient parser reuses `parseNode2D` unchanged, so none of the ten parallax keys is
read. A malformed `repeat_size` or `repeat_times` is dropped with no fallback, the same
as a well-formed one.

## Known limitations

- **Not drawn** The scroll offset and repeats Godot applies to the children are not
  reproduced. The children draw once, at their authored transform.
