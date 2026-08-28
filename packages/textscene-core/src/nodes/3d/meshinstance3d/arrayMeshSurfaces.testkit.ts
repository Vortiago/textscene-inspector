/**
 * The `_surfaces` value of an ArrayMesh a `.tscn` declares inline — a wall
 * quad's bytes, minus the file wrapper.
 *
 * One copy, because `"format": 34359742487` encodes the vertex layout: a
 * decoder change re-bakes these bytes, and a second copy would decode into a
 * different geometry with only one suite failing to say so.
 */
export const INLINE_SURFACES = `[{
"aabb": AABB(-1, -1, 1, 2, 2, 1.001358e-05),
"attribute_data": PackedByteArray("AAAAAAAAgD4AAIA+AACAPgAAgD4AAAAAAAAAAAAAAAA="),
"format": 34359742487,
"index_count": 6,
"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),
"name": "inline",
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/AACAPwAAgD8AAIA/AACAvwAAgD8AAIA//3//f////7//f/9/////v/9//3////+//3//f////78=")
}]`;

/** The same surface, carrying a scene-local material in its `material` slot. */
export function inlineSurfacesWithMaterial(subResourceId: string): string {
  return INLINE_SURFACES.replace(
    '"name": "inline",',
    `"material": SubResource("${subResourceId}"),\n"name": "inline",`
  );
}
