---
type: ShapeCast2D
category: 2D
status: linter-only
fixture: unit-shape-cast-2d.tscn
# image: unit-shape-cast-2d
visual: false
renders_as: nothing (a transform-only group)
---

# ShapeCast2D

Sweeps a `Shape2D` from its origin to `target_position` to detect `CollisionObject2D`s, but draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `enabled` | `true` | none — gates collision reporting, not drawn |
| `shape` | `SubResource("CircleShape2D_1")` | none — the swept geometry, not drawn |
| `exclude_parent` | `true` | none — collision-query filter, not drawn |
| `target_position` | `Vector2(0, 50)` | none — cast direction and length, not drawn |
| `margin` | `2.0` | none — collision margin, not drawn |
| `max_results` | `32` | none — query result cap, not drawn |
| `collision_mask` | `1` | none — physics layer filter, not drawn |
| `collide_with_areas` | `false` | none — query filter, not drawn |
| `collide_with_bodies` | `true` | none — query filter, not drawn |

## Divergences

None visible in this fixture — Godot's ShapeCast2D shows only an editor gizmo and a "Visible Collision Shapes" debug overlay, neither of which a plain capture shows.

## Linting

<!-- lint:begin ShapeCast2D -->
Strict parsing format-checks these `ShapeCast2D` properties, plus 12 inherited from Node2D, 15 inherited from CanvasItem. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `collide_with_areas` | true or false |
| `collide_with_bodies` | true or false |
| `collision_mask` | 32-bit layer mask (layers 1-32) |
| `enabled` | true or false |
| `exclude_parent` | true or false |
| `margin` | float 0-100 |
| `max_results` | integer |
| `shape` | SubResource("id") or ExtResource("id") |
| `target_position` | Vector2(x, y) |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-shapecast2d` | `shapecast2d-no-collide-target` | warning |
|  | `shapecast2d-zero-mask` | warning |
|  | `shapecast2d-missing-shape` | warning |
<!-- lint:end -->

ShapeCast2D has no dedicated `parser.ts` — `index.ts` reuses `parseNode2D`
directly, which only reads Node2D's own transform/draw-order surface into the
typed `node.properties`. None of ShapeCast2D's own properties (`enabled`,
`shape`, `exclude_parent`, `target_position`, `margin`, `max_results`,
`collision_mask`, `collide_with_areas`, `collide_with_bodies`) is parsed,
validated, or coerced there. The raw string does survive on `node.rawProperties`
(kept only so a type-less instanced-scene override can be re-parsed later), but
nothing reads it back out for this type, so a malformed `margin` or an
unresolvable `shape` reference produces neither a warning nor a substituted
default — it looks exactly like a valid one to the renderer, because neither is
ever examined.
