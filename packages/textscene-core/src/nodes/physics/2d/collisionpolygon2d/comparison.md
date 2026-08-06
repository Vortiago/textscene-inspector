---
type: CollisionPolygon2D
category: 2D
status: linter-only
fixture: unit-collision-polygon-2d.tscn
# image: unit-collision-polygon-2d
visual: false
renders_as: nothing (a transform-only group)
---

# CollisionPolygon2D

CollisionPolygon2D gives a polygon collision shape to a CollisionObject2D
parent (Area2D, StaticBody2D, RigidBody2D, CharacterBody2D, etc.); like its
sibling CollisionShape2D, it has no runtime visual of its own — its outline is
an editor/debug gizmo, so drawing nothing here is correct, not a gap. The
previewer renders it as a transform-only group (ADR-0008): its children still
show, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `build_mode` | `0` (Solids) | selects convex-decomposition collision instead of segment-only (`1`); no visual effect in a game render |
| `polygon` | `PackedVector2Array(-10, -10, 10, -10, 10, 10, -10, 10)` | the collision outline geometry; drawn only by the editor/debug gizmo, never in a plain capture |
| `disabled` | `false` | shape stays active; no visual effect in a game render |
| `one_way_collision` | `true` | only edges facing "up" (local rotation) collide with other bodies; no visual effect in a game render |
| `one_way_collision_margin` | `4.0` | thickness in pixels of the one-way collision margin; no visual effect in a game render |

## Divergences

None — the node draws nothing in both parsers, so there is nothing to diverge on.

## Linting

<!-- lint:begin CollisionPolygon2D -->
<!-- lint:end -->

The lenient parser reuses `parseNode2D` verbatim (ADR-0008: transform-only), so
it never reads `build_mode`, `polygon`, `disabled`, `one_way_collision`, or
`one_way_collision_margin` at all — a malformed value on any of the five
passes through completely unexamined, with no substitution and no fallback,
because nothing downstream of the parse ever looks at the property. Only
Node2D's own properties (position, rotation, scale, etc.) affect what actually
renders.
