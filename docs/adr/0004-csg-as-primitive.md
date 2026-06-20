# CSG nodes render as their base primitive; boolean operations ignored

`CSGBox3D` and `CSGCylinder3D` render the corresponding three.js geometry from their own inline `size`/`radius`/`height` properties; the `operation` (union/subtraction/intersection) is parsed but not applied. We do not perform real constructive solid geometry.

For the ld-58 corpus this is exact: every CSG node uses the default `operation = 0` (union/additive), so no scene renders wrong. For the general case, a subtraction or intersection node rendered as a solid primitive is visually wrong (a hole shows as a solid block); when `operation != 0` the parser logs a warning and the node renders its base primitive rather than failing silently.

Scope is deliberately limited to the two CSG types ld-58 uses; CSGSphere3D/CSGTorus3D/CSGMesh3D are deferred until a fixture demands them (per the repo's "no fixtures for unimplemented features" rule).

Recorded because rendering CSG as a plain primitive is a surprising deviation a future reader would otherwise try to "fix" with a boolean-mesh library.
