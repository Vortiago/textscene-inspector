# CSG nodes render as their base primitive; boolean operations ignored

`CSGBox3D`, `CSGCylinder3D`, and `CSGSphere3D` render the corresponding three.js geometry from their own inline `size`/`radius`/`radial_segments`/`rings`/`height` properties; the `operation` (union/subtraction/intersection) is parsed but not applied. We do not perform real constructive solid geometry.

This is a real, visible divergence, **not** a corpus-safe one — an earlier revision of this ADR claimed "every CSG node uses the default `operation = 0`, so no scene renders wrong", and that is false. The vendored corpus carries **36** nodes with `operation = 1` (intersection) or `2` (subtraction), across five scenes: `demos/3d/csg/csg.tscn` (which exists to demonstrate the operations), `demos/3d/particles/test.tscn`, `demos/3d/soft_body_physics/test.tscn`, `demos/3d/ragdoll_physics/ragdoll_physics.tscn` and `demos/3d/volumetric_fog/volumetric_fog.tscn`.

A subtraction or intersection node rendered as a solid primitive is visually wrong — a hole shows as a solid block — so those scenes DO render wrong here. When `operation != 0` the parser logs a warning and the node renders its base primitive rather than failing silently, which is the honest failure mode for a previewer that performs no boolean geometry.

Scope covers the three trivial CSG primitives that appear in the real Godot demo corpus (`CSGBox3D`, `CSGCylinder3D`, `CSGSphere3D`). The remaining CSG types are explicitly deferred — they have no fixture demanding them (per the repo's "no fixtures for unimplemented features" rule) and each needs more than a primitive mapping:

- **`CSGPolygon3D`** (18 corpus occurrences) — an extruded/swept 2D polygon (modes: depth / spin / path-follow); no single three.js primitive matches it.
- **`CSGCombiner3D`** (1) — a pure boolean-grouping container with no geometry of its own; meaningful only once real CSG is performed.
- **`CSGTorus3D`** (1), **`CSGMesh3D`** — deferred for the same "no fixture yet" reason; `CSGTorus3D` would map to `TorusGeometry` when one is added.

Until then these fall through to `GenericNodeFallback` (an empty container) rather than a wrong primitive.

Recorded because rendering CSG as a plain primitive is a surprising deviation a future reader would otherwise try to "fix" with a boolean-mesh library.
