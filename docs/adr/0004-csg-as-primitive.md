**Superseded by ADR-0027: the booleans are evaluated.** This record keeps why the
divergence was accepted and what it cost. Its terminal behaviour is also the degradation
fallback when the CSG library cannot load.

# CSG nodes render as their base primitive; boolean operations ignored

`CSGBox3D`, `CSGCylinder3D` and `CSGSphere3D` render the matching three.js geometry from their own inline `size`/`radius`/`radial_segments`/`rings`/`height` properties. The `operation` (union, subtraction, intersection) is parsed but not applied. The previewer performs no constructive solid geometry.

This is a real, visible divergence, not a corpus-safe one. A subtraction or intersection node rendered as a solid primitive is visually wrong: a hole shows as a solid block. Every scene with `operation = 1` (intersection) or `2` (subtraction) renders wrong under this fallback: `demos/3d/csg/csg.tscn` (which exists to show the operations), `demos/3d/particles/test.tscn`, `demos/3d/soft_body_physics/test.tscn`, `demos/3d/ragdoll_physics/ragdoll_physics.tscn` and `demos/3d/volumetric_fog/volumetric_fog.tscn`. When `operation != 0`, the parser logs a warning and the node renders its base primitive rather than failing silently.

Scope is the three trivial CSG primitives. The other CSG types are deferred: no fixture demands them (the repo's "no fixtures for unimplemented features" rule), and each needs more than a primitive mapping:

- **`CSGPolygon3D`**: an extruded or swept 2D polygon (modes: depth, spin, path-follow). No single three.js primitive matches it.
- **`CSGCombiner3D`**: a pure boolean-grouping container with no geometry of its own. It has meaning only with real CSG.
- **`CSGTorus3D`**, **`CSGMesh3D`**: no fixture yet. `CSGTorus3D` would map to `TorusGeometry`.

These fall through to `GenericNodeFallback` (an empty container) rather than a wrong primitive.
