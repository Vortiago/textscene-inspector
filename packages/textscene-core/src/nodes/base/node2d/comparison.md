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

Node2D is the base of 2D transform objects — sprites, bodies, areas: a transform
(position/rotation/scale/skew and draw-order Z), no pixels of its own. The previewer
maps it to a `<group>` and draws its children inside. Here the fixture's root is a
bare Node2D, so the group is empty and the frame is blank.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `Area2D.position` | `Vector2(10, 20)` | offsets the area's subtree; the Area2D itself draws nothing at runtime |
| `CollisionShape2D.shape` | `CircleShape2D` (r=0.5) | a collision gizmo — editor/toggle-gated, absent from a plain capture |
| `ColorRect.color` | `Color(1, 0.4, 0.4, 1)` | would tint the rect, but no size is set so it lays out at 0×0 and nothing draws |

The root Node2D sets no properties of its own; every node in this scene is transform,
physics, or a zero-size Control, so both renders are the empty viewport.

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin Node2D -->
Strict parsing format-checks these `Node2D` properties, plus 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `global_position` | Vector2(x, y) |  |
| `global_rotation` | float |  |
| `global_rotation_degrees` | float |  |
| `global_scale` | Vector2(x, y) |  |
| `global_skew` | float |  |
| `global_transform` | Transform2D(6 floats) |  |
| `position` | Vector2(x, y) |  |
| `rotation` | float |  |
| `rotation_degrees` | float |  |
| `scale` | Vector2(x, y), no (near-)zero component | error |
| `skew` | float |  |
| `transform` | Transform2D(6 floats) |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
<!-- lint:end -->

`transform` (a `Transform2D`) takes priority when present: a malformed matrix
warns and falls back not to identity but to the discrete
`position`/`rotation`/`scale`/`skew` path, so those properties still take
effect even when `transform` fails to parse. Absent or unparseable
`position`/`scale` fall back to `(0, 0)`/`(1, 1)` via `vec2Or`, and
`rotation`/`skew` fall back to `0` via `floatOr`, each warning first if
present but invalid. `z_index` falls back to `0` the same way. `z_as_relative`
and `y_sort_enabled` skip that contract entirely, resolving via plain string
equality (`!== 'false'` and `=== 'true'` respectively) with no warning for a
malformed value, and default to `true` and `false` when absent. The six
`global_*` properties validated above are never read by the lenient parser at
all: Node2D only parses the local transform, so an authored `global_position`
has no effect on the render.

## Known limitations

- **z_as_relative = false** — the default (true, effective Z = parent Z + `z_index`) is faithful; with `z_as_relative = false` Godot makes `z_index` absolute, but our nested 2D groups still accumulate ancestor Z. No corpus fixture sets it.
