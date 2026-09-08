---
type: Parallax2D
category: 2D
status: unimplemented
fixture: unit-parallax-2d.tscn
# image: unit-parallax-2d
renders_as: invisible transform-only fallback
---

# Parallax2D

Godot repeats and scroll-offsets this node's children at runtime to fake camera depth; the previewer parses and validates it but does not apply that motion yet, so it renders as an invisible transform-only fallback and its children still show at their authored transform.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `scroll_scale` | `Vector2(0.5, 0.5)` | multiplies the camera-driven scroll offset, so children move at half camera speed |
| `scroll_offset` | `Vector2(10, 0)` | the node's own persistent scroll offset, independent of `position` |
| `repeat_size` | `Vector2(512, 0)` | repeats children horizontally every 512 px while scrolling |
| `autoscroll` | `Vector2(-20, 0)` | scrolls left automatically at 20 px/s regardless of the camera |
| `repeat_times` | `3` | spreads 3 texture copies evenly across `repeat_size` |
| `limit_begin` | `Vector2(-2000, -2000)` | top-left bound the camera must stay inside for scrolling to continue |
| `limit_end` | `Vector2(2000, 2000)` | bottom-right bound the camera must stay inside for scrolling to continue |
| `follow_viewport` | `false` | the node's own position is not additionally offset by the active camera |
| `ignore_camera_scroll` | `true` | camera movement no longer drives this node's position at all |
| `screen_offset` | `Vector2(0, -10)` | the automatic per-camera scroll offset, shifted up 10 px |

## Divergences

Not captured yet — nothing renders, so there is nothing to compare pixels against.

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

`index.ts` registers `parseNode2D` unchanged, which reads only Node2D's own keys
(`position`, `rotation`, `scale`, `skew`, …) and never looks at any of the ten
properties above. So the lenient parser has no per-property fallback for a
malformed `repeat_size` or `repeat_times`: it silently drops the key along with
every well-formed one, the same as it would for an unrecognised property on any
node type.
