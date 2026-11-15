---
type: ArrayMesh
category: Resources
renders_as: one merged THREE.BufferGeometry with a draw group per surface
---

# ArrayMesh

A baked mesh whose surfaces are base64 `PackedByteArray` blobs laid out by a `format` bitfield. The previewer decodes both the plain and the compressed layout. It merges the triangle, points and line surfaces into one `BufferGeometry` each, with a draw group per surface. A surface with 2D vertices (`ARRAY_FLAG_USE_2D_VERTICES`) reads its positions with z = 0, and a surface's vertex colours read as the stored RGBA8 bytes. A MeshInstance2D, a MeshInstance3D, a GridMap and a CPUParticles3D draw all three kinds. A line is one pixel wide, with the material's colour and the default normal along +Z that Godot gives a surface with no normal array. A mesh of triangles and points draws both. A points surface draws as `THREE.Points` at the material's point size. A surface's TEX_UV2 becomes the mesh's UV2, and a compressed UV2 re-expands by `uv_scale`'s z and w as in Godot (`rendering_server.cpp:1581-1582`).

## Linting

<!-- lint:begin ArrayMesh -->
Strict parsing format-checks the inherited set (1 inherited from Mesh, 2 inherited from Resource); `ArrayMesh` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
<!-- lint:end -->

The lenient parser never rejects a mesh property. An unreadable `subdivide_width` or `uv2_padding` falls back to Godot's default through the shared value decoders. A surface whose arrays are malformed is dropped with a warning, and the mesh's other surfaces still render.

## Lines

<!-- compare: image=unit-array-mesh-lines status=done fixture=unit-array-mesh-lines.tscn -->

A LINES surface and a LINE_STRIP surface of an ArrayMesh draw as segments one pixel wide under the surface material. The material lights them as a normal along +Z in node space. The strip reads its vertex colours. A mesh of a triangle surface and a lines surface draws both. The engines differ by one pixel where a segment ends or crosses a pixel edge, as their rasterisers break ties differently.

## Lines under other materials

<!-- compare: image=unit-array-mesh-lines-materials status=done fixture=unit-array-mesh-lines-materials.tscn -->

The same surfaces read a texture at their UVs, a vertex colour with alpha, and the emissive, metal, additive and alpha materials. A LINES surface with an odd number of indices draws no segment, as in Godot.

## Lines in a GridMap

<!-- compare: image=unit-array-mesh-lines-gridmap status=done fixture=unit-array-mesh-lines-gridmap.tscn -->

A MeshLibrary item whose mesh has a LINES surface draws its segments at each cell. A cell's basis turns the +Z normal that lights the segments, so the sun misses the cell turned a half turn about Y.

## Lines in a CPUParticles3D

<!-- compare: image=unit-array-mesh-lines-cpuparticles3d status=done fixture=unit-array-mesh-lines-cpuparticles3d.tscn -->

A CPUParticles3D whose mesh has a LINES surface draws its segments at each particle, in the particle colour.

## Known limitations

- **Approximated** Blend shapes, LODs and skins are ignored, so a skinned mesh renders in its rest pose.
- **Approximated** A compressed surface with a normal but no tangent is decoded by symmetry and is not measured against Godot.
- **Approximated** A `.tres` whose every surface is undecodable is listed in the missing-resources panel even though the file is present.
