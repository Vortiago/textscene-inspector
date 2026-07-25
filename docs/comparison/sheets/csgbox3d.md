---
type: CSGBox3D
category: 3D
fixture: unit-csg-box.tscn
image: unit-csg-box
renders_as: a solid box mesh
---

# CSGBox3D

CSGBox3D is Godot's constructive-solid-geometry box. The previewer draws it as a
plain box mesh carrying its StandardMaterial3D; the boolean `operation` is not
evaluated (ADR-0004), so every CSG node renders as its solid base primitive. The
fixture is two union boxes — a thin, wide floor slab and a tall wall standing at
the far end.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `size` (Floor) | `Vector3(3, 0.2, 12)` | the thin, wide floor slab running into the distance |
| `material` (Floor) | brown `albedo_color` `(0.4, 0.3, 0.25)` | the tan floor colour |
| `size` (BackWall) | `Vector3(3, 4.5, 0.3)` | the tall, thin upright wall |
| `material` (BackWall) | grey `albedo_color` `(0.7, 0.65, 0.6)` | the light-grey wall face |
| `transform` (BackWall) | translate `(0, 2.25, -6)` | lifts the wall and pushes it to the far end |

## Divergences

None visible in this fixture.
