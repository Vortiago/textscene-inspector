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

`top_level` makes the node a canvas root. It draws in canvas space, with a white inherited modulate, `z_index` accumulated from 0 and the viewport's own texture sampler defaults. A node whose direct parent is not a `CanvasItem` is a canvas root for the same reason and gets the same reset. Its parent still hides it, because visibility crosses the break in Godot too.

`texture_filter` and `texture_repeat` default to Parent. A textured item uses the value of its nearest ancestor that sets one, and otherwise the viewport default (`canvas_item.cpp:1625-1699`). The scene root takes the project settings `rendering/textures/canvas_textures/default_texture_filter` and `default_texture_repeat` (`editor_node.cpp:451-460`). A SubViewport takes its own `canvas_item_default_texture_filter` and `canvas_item_default_texture_repeat` (`viewport.cpp:3974-4017`). Sprite2D, AnimatedSprite2D, Polygon2D, CPUParticles2D, TileMapLayer and the texture painters of Controls sample with the result. A y-sorted item keeps the values of the containers it is lifted out of.

## Known limitations

- **Approximated** The two anisotropic `texture_filter` values cap anisotropy at 16×, as the 3D path does. Godot caps it at `1 << anisotropic_filtering_level`, 4× by default (`material_storage.cpp:2461`, `rendering_server.cpp:3750`).
