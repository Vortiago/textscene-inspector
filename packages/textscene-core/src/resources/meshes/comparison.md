---
type: ArrayMesh
category: Resources
fixture: unit-arraymesh.tscn
image: unit-arraymesh
renders_as: one merged THREE.BufferGeometry with a draw group per surface
---

# ArrayMesh

A baked mesh. Each surface's geometry is a set of base64 `PackedByteArray` blobs whose
layout the surface's uint64 `format` bitfield describes. Decoding recovers what Godot's
`surface_get_arrays()` returns; all surfaces merge into one `BufferGeometry`, one draw
group each, so MeshInstance3D can give every surface its own material.

## Buffer layout

`vertex_data` = positions, then normal/tangent frames — two concatenated regions, not
interleaved. `attribute_data` is interleaved: COLOR, UV1, UV2. Bytes per vertex:

| | uncompressed | `ARRAY_FLAG_COMPRESS_ATTRIBUTES` (bit 29) |
| --- | --- | --- |
| position | 3×float32 (12 B) | 3×uint16 + frame angle (8 B) |
| normal + tangent | two octahedral uint16 pairs (8 B) | one axis-angle frame (4 B) |
| UV1, UV2 | 2×float32 each (8 B) | 2×uint16 each (4 B) |
| colour | RGBA8 (4 B) | RGBA8 (4 B) |
| index | uint16, uint32 above 65535 vertices | same |

Both layouts occur in one file, and in one `_surfaces` array.

## Compressed attributes

Verified against Godot 4.6.3's decompressed arrays.

| | encoding |
| --- | --- |
| position | `u16 / 65535 × aabb.size + aabb.position` — the surface `aabb` IS the scale, so a compressed surface without one is unreadable |
| normal, tangent | no normal is stored: the octahedral pair is a rotation AXIS, the ANGLE is the position record's 4th uint16 in half-turns, taken as an absolute value; both are rows of that rotation (`axis_angle_to_tbn`) |
| UV | `u16 / 65535`, or `(u16 / 65535 − 0.5) × uv_scale` when `uv_scale` is non-zero |

Bit 29 alone selects the layout. `ARRAY_FLAG_FORMAT_VERSION_2` (bit 35) is never
consulted: a JavaScript `&` coerces to int32 and cannot reach it.

## Where the mesh lives

Three references, all rendered:

| reference | resolution |
| --- | --- |
| `ExtResource` → `.tres` | fetched and decoded through the resource pipeline |
| `[sub_resource]` of a `.tres` | addressed `<file>::<id>` (a `shadow_mesh`, a MeshLibrary item mesh) |
| `[sub_resource]` of the previewed `.tscn` | decoded synchronously off the parsed scene — no file to fetch |

## Surface materials

| reference | resolution |
| --- | --- |
| `ExtResource` | the declaring document's `[ext_resource]` table |
| `SubResource` of a `.tres` | addressed `<file>::<id>`; its own texture `ExtResource`s resolve against that **`.tres`'s** table, not the scene's |
| `SubResource` of a `.tscn` | read off the parsed scene's own resources — no path, nothing to fetch |

## Unreadable surfaces

Dropped with a `[ArrayMesh]` warning; the mesh's other surfaces still render. Triggers:
`vertex_data` shorter than the format requires, a compressed surface with no `aabb`,
`index_data` shorter than `index_count`, any non-finite position. Surfaces merge into
one geometry, so one NaN would poison the whole mesh's bounding sphere — and with it the
camera fit, making the scene unframeable rather than merely misdrawn.

Dropping happens in the decoder, not the geometry builder, so one list is the source of
both the draw groups and the per-surface material paths.

A mesh with NO readable surface fails outright, rather than caching an empty geometry as
a success and rendering invisibly. An `attribute_data` record narrower than the format
implies costs that surface its UVs only; a wider one is an unmodelled CUSTOM channel and
reads fine.

## Divergences

The decoded mesh is at parity and the frame's residual is not the mesh.
`pnpm ref:diff scenes/fixtures/unit-arraymesh.tscn` reports a mean channel error of
3.259/255 over the 955x756 frame, and it concentrates in the fixture's two Label3D
captions: 14.566/255 across the title band `y 85..138` and 11.592/255 across the
description band `y 543..568`, against 2.035/255 over all the rows that hold the
quad and the background. Both bands are the outline-dilation and `modulate`
divergences measured on the Label3D sheet, not this resource's.

The quad's own silhouette agrees to the row: at `x 478` the first and last inked
rows are 307 and 598 on both sides. Its interior carries Godot's material-less
default, `rgb(93, 99, 111)` in Godot against `rgb(93, 99, 110)`–`rgb(94, 100, 111)`
here.

## Known limitations

- **Texture slots on a scene SubResource material are unwired**, on every surface —
  its scalars apply, its textures do not. `StandardMaterialSlot` already accepts the
  maps and `ExternalMaterialSlot` already resolves them per surface one branch away in
  the same loop; the scene branch passes only `scalars`. No corpus scene uses one.
- **`material_override` / `surface_material_override/N` do not reach an ArrayMesh.**
  Both ArrayMesh paths render one slot per draw group from the surface's own material,
  so a node-level override is dropped where Godot would apply it. Pre-existing for an
  external `.tres`; the inline path inherits it.
- **A `.tres` whose every surface is undecodable fails the whole resource**, which puts
  its path in the missing-resources panel even though the file is present. The
  placeholder is right; the panel row overstates the cause.
- **Blend shapes, LODs and skins are ignored**; a skinned mesh renders in its rest pose.
- **A compressed surface with NORMAL but no TANGENT is unverified** — absent from the
  corpus. Compression folds the tangent INTO the normal's bytes, so with no tangent
  there is no frame and the pair is the normal itself; the angle slot stays zero, and
  reading it as an angle would mean a half-turn rather than the identity. Implemented
  by symmetry and pinned by a hand-built fixture, not measured against Godot.
- **A dropped surface renumbers the draw groups below it.** Group N means `surfaces[N]`,
  which is what the material paths index, so materials follow. It would matter if
  `surface_material_override/<n>`, which names Godot's ORIGINAL index, were wired here.
