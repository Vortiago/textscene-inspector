---
type: CollisionPolygon3D
category: 3D
status: linter-only
fixture: unit-collision-polygon-3d.tscn
# image: unit-collision-polygon-3d
visual: false
renders_as: nothing (a transform-only group)
---

# CollisionPolygon3D

CollisionPolygon3D gives a CollisionObject3D parent a thickened-polygon (prism) collision shape; that shape is editor/debug visualisation only, never a runtime mesh, so drawing NOTHING here is correct, not a gap. The previewer renders it as a transform-only group (ADR-0008): its children still show at the right transform.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `polygon` | `PackedVector2Array(-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5)` | the 2D outline extruded into the collision prism; never drawn by the previewer |
| `depth` | `2.0` | how far the polygon extrudes along its local Z axis; never drawn |
| `margin` | `0.1` | collision margin passed to the generated `ConvexPolygonShape3D`; never drawn |
| `disabled` | `false` | whether the resulting shape participates in collision; never drawn |
| `debug_color` | `Color(0, 0.6, 0.7, 0.42)` | the editor/debug wireframe colour, gated behind "Visible Collision Shapes"; never drawn here |
| `debug_fill` | `true` | whether the debug wireframe also gets a solid fill; never drawn here |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin CollisionPolygon3D -->
Strict parsing format-checks these `CollisionPolygon3D` properties, plus 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `debug_color` | Color(r, g, b, a) |
| `debug_fill` | true or false |
| `depth` | float |
| `disabled` | true or false |
| `margin` | float 0.001-10 |
| `polygon` | PackedVector2Array(x, y, …) |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-collisionpolygon3d` | `collisionpolygon3d-no-parent` | warning |
|  | `collisionpolygon3d-invalid-parent` | warning |
|  | `collisionpolygon3d-empty-polygon` | warning |
|  | `collisionpolygon3d-non-uniform-scale` | warning |
<!-- lint:end -->

`polygon`, `depth`, `margin`, `disabled`, `debug_color`, and `debug_fill` are
never read by the lenient parser at all — this slice has no `parser.ts` of its
own, and `index.ts` reuses `parseNode3D` wholesale, which only reads `transform`
and `visible`. So a malformed value on any of the six lints only through the
strict validators above; the renderer never looks at the key, valid or not.
