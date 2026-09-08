---
type: ArrayMesh
category: Resources
status: unreviewed
renders_as: one merged THREE.BufferGeometry with a draw group per surface
---

# ArrayMesh

A baked mesh whose surfaces are base64 `PackedByteArray` blobs laid out by a `format` bitfield. The previewer decodes both the plain and the compressed layout and merges every triangle surface into one `BufferGeometry` with a draw group per surface.

## Linting

<!-- lint:begin ArrayMesh -->
Strict parsing format-checks the inherited set (1 inherited from Mesh, 2 inherited from Resource); `ArrayMesh` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
<!-- lint:end -->

The lenient parser never rejects a mesh property. An unreadable `subdivide_width` or `uv2_padding` falls back to Godot's default through the shared value decoders. A surface whose arrays are malformed is dropped with a warning, and the mesh's other surfaces still render.

## Known limitations

- **Not drawn** A POINTS, LINES or strip surface is skipped, since only triangle surfaces are decoded.
- **Approximated** Blend shapes, LODs and skins are ignored, so a skinned mesh renders in its rest pose.
- **Approximated** A dropped surface renumbers the ones after it, so `surface_material_override/N` can land on a different surface than in Godot.
- **Approximated** A compressed surface with a normal but no tangent is decoded by symmetry and is not measured against Godot.
- **Approximated** A `.tres` whose every surface is undecodable is listed in the missing-resources panel even though the file is present.
