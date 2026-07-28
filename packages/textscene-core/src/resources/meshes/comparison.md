---
type: ArrayMesh
category: Resources
renders_as: one merged THREE.BufferGeometry with a draw group per surface
---

# ArrayMesh

A baked mesh: Godot stores each surface's geometry as base64 `PackedByteArray` blobs
whose layout is described entirely by the surface's uint64 `format` bitfield. The
decoder recovers the same arrays Godot's own `ArrayMesh.surface_get_arrays()` returns,
and every surface merges into ONE `BufferGeometry` with a draw group each, so
MeshInstance3D can give each surface its own material.

## The buffer layout

`vertex_data` holds TWO concatenated regions, not one interleaved record: all the
positions, then all the normal/tangent frames. `attribute_data` is a third, this one
interleaved, ordered COLOR then UV1 then UV2. Bytes per vertex:

| | uncompressed | `ARRAY_FLAG_COMPRESS_ATTRIBUTES` (bit 29) |
| --- | --- | --- |
| position | 3×float32 (12 B) | 3×uint16 + the frame angle (8 B) |
| normal + tangent | two octahedral uint16 pairs (8 B) | one axis-angle frame (4 B) |
| UV1, UV2 | 2×float32 each (8 B) | 2×uint16 each (4 B) |
| colour | RGBA8 (4 B) | RGBA8 (4 B) |
| index | uint16, or uint32 above 65535 vertices | same |

Godot writes both layouts into the same file: a mesh's `[resource]` surfaces may be
compressed while its `shadow_mesh` sub-resource is not, and one `_surfaces` array can
hold uncompressed and compressed surfaces side by side.

## Compressed attributes

Three encodings, all verified against Godot 4.6.3's own decompressed arrays:

- **Position** is a uint16 per axis spanning the surface's own declared `aabb`:
  `p = u16 / 65535 × aabb.size + aabb.position`. The aabb is the scale, not just
  metadata, so a compressed surface without one cannot be read at all.
- **The tangent frame** is an axis-angle rotation, and the normal is not stored. The
  octahedral uint16 pair in the normal region is the rotation AXIS; the ANGLE is the
  4th uint16 of the 8-byte position record — the slot a position-only surface leaves
  zeroed — in half-turns. Normal and tangent are then two rows of that rotation
  matrix (Godot's `axis_angle_to_tbn`). Reading the pair as if it were a normal, the
  way the uncompressed layout allows, yields a direction unrelated to the surface.
- **UV** is a uint16 per axis over the unit range. When the surface declares a
  non-zero `uv_scale`, Godot normalised UVs that left the unit range into the uint16
  range and kept the divisor there, so the stored value is re-expanded around 0.5:
  `uv = (u16 / 65535 − 0.5) × uv_scale`.

Only bits below 32 can be tested with a JavaScript `&`, which coerces to int32. Bit 29
survives because every format Godot writes keeps its low 32 bits under 2^31, but
`ARRAY_FLAG_FORMAT_VERSION_2` (bit 35) is unreachable that way — so bit 29 alone
selects the layout, and the version flag is never consulted.

## Unreadable surfaces

A surface whose `vertex_data` is shorter than its format requires, whose compressed
form declares no `aabb`, or whose positions decode to anything non-finite is dropped
with a `[ArrayMesh]` warning, and the mesh's remaining surfaces still render. This is
not tidiness: surfaces merge into one geometry, so a single NaN position poisons the
whole mesh's bounding sphere, and a NaN bounding sphere also defeats the camera fit —
the scene becomes unframeable, not merely misdrawn.

Dropping happens in the decoder rather than the geometry builder so that one list
stays the source of both the draw groups and the per-surface material paths; they are
built by different code and would otherwise drift apart by exactly the dropped
surface.

An `attribute_data` record that is not the width the format implies costs that
surface its UVs but not the surface: the positions are still exact.

## Known limitations

- **A surface material declared as a `SubResource` of the mesh's own `.tres` is not
  built yet.** Godot writes one when the mesh carries its own materials instead of
  referencing shared ones — about half the corpus's ArrayMesh surfaces. Such a surface
  gets the neutral placeholder material rather than its albedo; the geometry is correct,
  only the tint is missing. This is unimplemented rather than unimplementable: the two
  halves both exist and are simply not joined. `decodeArrayMesh` already receives that
  file's `subResources` from `parseTresFile` and discards them, and `tileSetFromTres`
  already resolves a sub-resource declared inside an external `.tres` the same way. What
  has to widen is the seam: `ArrayMeshResource.materialPaths` is a `(string | null)[]`
  and `ExternalMaterialSlot` takes a path, while the material pipeline is keyed on a
  whole file being a material (`isMaterialPath`, `createMaterialFromContent` reading the
  `[resource]` body) — an inline material has no path to key on. Note the scene-level
  `resolveStandardMaterial` does not help here: it searches the previewed `.tscn`'s
  sub-resources, and these live in a different document.
- **Blend shapes, LODs and skins are ignored.** `lods` and blend-shape data are
  parsed past; a skinned mesh renders in its rest pose.
- **A compressed surface with NORMAL but no TANGENT is unverified.** No mesh in the
  corpus is in that state, so the plain-octahedral reading it presumably uses is
  implemented by symmetry with the uncompressed layout rather than measured.
- **A dropped surface shifts the draw-group numbering below it.** Group N always
  means `surfaces[N]`, which is what the material paths index, so materials follow
  correctly today. It would matter if `surface_material_override/<n>` — which names
  Godot's ORIGINAL surface index — were ever wired to ArrayMesh groups.
