---
type: RayCast2D
category: 2D
status: linter-only
fixture: unit-ray-cast-2d.tscn
# image: unit-ray-cast-2d
visual: false
renders_as: nothing (a transform-only group)
---

# RayCast2D

RayCast2D casts a ray each physics frame toward `target_position`, reporting the first Area2D/PhysicsBody2D it hits, and draws nothing of its own, so the previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story. Godot itself only draws the ray as a debug line while `Engine.is_editor_hint()` or the runtime "Visible Collision Shapes" flag is on (`ray_cast_2d.cpp`'s `NOTIFICATION_DRAW` guard), so a plain gameplay capture shows nothing either.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `enabled` | `true` | ray reports collisions each physics frame (default) |
| `exclude_parent` | `true` | ignores a parent CollisionObject2D, if any (default) |
| `target_position` | `Vector2(0, 96)` | ray direction/length from the node's origin; invisible here since the node draws nothing itself |
| `collision_mask` | `1` | only physics layer 1 is checked (default) |
| `hit_from_inside` | `false` | ignores shapes the ray starts inside (default) |
| `collide_with_areas` | `true` | Area2D nodes are reported |
| `collide_with_bodies` | `true` | PhysicsBody2D nodes are reported (default) |

## Divergences

None visible in this fixture — the node draws nothing in either engine.

## Linting

<!-- lint:begin RayCast2D -->
Strict parsing format-checks these `RayCast2D` properties, plus 12 inherited from Node2D, 15 inherited from CanvasItem. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `collide_with_areas` | true or false |
| `collide_with_bodies` | true or false |
| `collision_mask` | 32-bit layer mask (layers 1-32) |
| `enabled` | true or false |
| `exclude_parent` | true or false |
| `hit_from_inside` | true or false |
| `target_position` | Vector2(x, y) |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-raycast2d` | `raycast2d-no-collide-target` | warning |
|  | `raycast2d-zero-mask` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode2D`, which only reads Node2D's own transform
keys, so a malformed `collision_mask` or a non-boolean `hit_from_inside` is never
read at all: it is silently ignored rather than substituted, because none of
RayCast2D's seven properties feeds rendering.
