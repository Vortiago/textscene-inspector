---
type: Node2D
category: 2D
status: linter-only
fixture: unit-area2d.tscn
image: unit-area2d
visual: false
renders_as: a transform-only THREE.Group
---

# Node2D

The base of 2D transform objects: a position, rotation, scale, skew and draw-order Z, with no pixels of its own. The previewer maps it to a `<group>` and draws its children inside. Here the root Node2D is bare, so both frames are blank.

## Linting

<!-- lint:begin Node2D -->
Strict parsing format-checks these `Node2D` properties, plus 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `global_position` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `global_rotation` | float |  |
| `global_rotation_degrees` | float |  |
| `global_scale` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `global_skew` | float |  |
| `global_transform` | Transform2D(6 floats) |  |
| `position` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `rotation` | float |  |
| `rotation_degrees` | float |  |
| `scale` | Vector2(x, y), no (near-)zero component |  |
| `skew` | radians, -89.9° to 89.9° | warning |
| `transform` | Transform2D(6 floats) |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
<!-- lint:end -->

`transform` takes priority when present. A malformed matrix warns and falls back to the discrete `position`, `rotation`, `scale` and `skew` path, which default to `(0, 0)`, `0`, `(1, 1)` and `0`. `z_index` falls back to `0`. The six `global_*` properties are never read by the lenient parser, so an authored `global_position` has no effect.

## Known limitations

- **Approximated** With `z_as_relative = false` Godot makes `z_index` absolute, but nested 2D groups here still accumulate ancestor Z.
