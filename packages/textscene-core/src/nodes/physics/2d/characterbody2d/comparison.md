---
type: CharacterBody2D
category: 2D
status: linter-only
fixture: unit-characterbody2d.tscn
visual: false
renders_as: a transform-only group
---

# CharacterBody2D

A 2D body moved by script rather than by the solver. It draws nothing in Godot,
and the previewer mounts it as a transform-only Node2D group (ADR-0008) whose
children carry the picture: a toggle-gated `CollisionShape2D` overlay
(ADR-0005/0006) and a yellow `ColorRect`.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `position` | `Vector2(0, 0)` | the body's starting placement |
| `collision_layer` | `1` | the layers this body occupies |
| `collision_mask` | `4` | the layers it scans for contacts |
| `velocity` | `Vector2(0, 0)` | the starting velocity `move_and_slide` reads |

## Divergences

None. `velocity` is state a script drives every frame; storing it in the file
sets only the first frame's value, and no previewer could show more than that
without running the game.

## Linting

<!-- lint:begin CharacterBody2D -->
Strict parsing format-checks these `CharacterBody2D` properties, plus 5 inherited from CollisionObject2D, 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `floor_block_on_wall` | true or false |  |
| `floor_constant_speed` | true or false |  |
| `floor_max_angle` | radians, 0° to 180° | warning |
| `floor_snap_length` | float >= 0 | error below |
| `floor_stop_on_slope` | true or false |  |
| `max_slides` | integer > 0 | error below |
| `motion_mode` | enum 0-1 (GROUNDED/FLOATING) | warning |
| `platform_floor_layers` | 32-bit layer mask (layers 1-32) | warning |
| `platform_on_leave` | enum 0-2 (ADD_VELOCITY/ADD_UPWARD_VELOCITY/DO_NOTHING) | warning |
| `platform_wall_layers` | 32-bit layer mask (layers 1-32) | warning |
| `safe_margin` | float 0.001-256 | warning |
| `slide_on_ceiling` | true or false |  |
| `up_direction` | Vector2(x, y) |  |
| `velocity` | Vector2(x, y) |  |
| `wall_min_slide_angle` | radians, 0° to 180° | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-characterbody2d` | `characterbody2d-needs-collision-shape` | warning |
|  | `characterbody2d-floor-props-in-floating-mode` | warning |
<!-- lint:end -->

`velocity` is checked for `Vector2(x, y)` shape only. It has no bound in either
direction, since Godot neither clamps nor rejects a value here, and the
non-finite literals the engine itself writes (`inf`, `nan`) stay legal.
