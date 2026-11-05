/**
 * The ArrayMesh `_surfaces` dictionaries that more than one suite inlines. A surface's `format`
 * encodes its vertex layout, so a decoder change that re-encodes its bytes must re-bake every
 * suite at once. `arrayMeshSurfaces.test.ts` fails when another source repeats a surface's bytes.
 */

/** An absent or null key is left out of the surface. */
export interface SurfaceKeys {
  /** The `"material"` value as `.tres` text, such as `SubResource("Mat")`. */
  material?: string | null;
  /** The `"name"` value, written as a quoted string. */
  name?: string | null;
  /** The `"primitive"` value, Godot's `Mesh.PrimitiveType`. A surface is triangles, 3, when absent. */
  primitive?: number;
}

/**
 * A writer for one `_surfaces` dictionary, `{` to `}`. `head` holds the keys that sort before
 * `material` and `name`, and `tail` the keys after them, so the optional keys land where Godot
 * writes them.
 */
function surfaceWriter(head: string, tail: string): (keys?: SurfaceKeys) => string {
  return ({ material, name, primitive } = {}) => {
    const materialLine = material == null ? '' : `"material": ${material},\n`;
    const nameLine = name == null ? '' : `"name": "${name}",\n`;
    const primitiveTail =
      primitive === undefined ? tail : tail.replace('"primitive": 3,', `"primitive": ${primitive},`);
    return `{\n${head}\n${materialLine}${nameLine}${primitiveTail}\n}`;
  };
}

/**
 * The one surface of `scenes/demos/3d/platformer/stage/meshes/wall.res`: a 4-vertex quad, format
 * 34359742487 = VERTEX|NORMAL|TANGENT|TEX_UV|INDEX, uncompressed.
 */
export const wallQuadSurface = surfaceWriter(
  `"aabb": AABB(-1, -1, 1, 2, 2, 1.001358e-05),
"attribute_data": PackedByteArray("AAAAAAAAgD4AAIA+AACAPgAAgD4AAAAAAAAAAAAAAAA="),
"format": 34359742487,
"index_count": 6,
"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),`,
  `"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/AACAPwAAgD8AAIA/AACAvwAAgD8AAIA//3//f////7//f/9/////v/9//3////+//3//f////78=")`
);

/** A whole `_surfaces` array value: one wall quad per entry of `surfaces`, in order. */
export function wallQuadSurfaces(...surfaces: SurfaceKeys[]): string {
  return `[${surfaces.map((keys) => wallQuadSurface(keys)).join(', ')}]`;
}

/**
 * The `headlights` surface of `scenes/demos/3d/truck_town/vehicles/meshes/truck_cab.res`. format
 * 34896613383 = VERTEX|NORMAL|TANGENT|INDEX + ARRAY_FLAG_COMPRESS_ATTRIBUTES +
 * ARRAY_FLAG_FORMAT_VERSION_2, 12 B/vertex: an 8 B position record, then a 4 B normal region.
 */
export const headlightsSurface = surfaceWriter(
  `"aabb": AABB(0.416992, 0.114807, 1.339844, 0.102539, 0.06988499, 0.023437023),
"format": 34896613383,
"index_count": 6,
"index_data": PackedByteArray("AAABAAIAAAADAAEA"),`,
  `"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("//8B71UVpsQAAEkKqeqmxC4l//8AAKbEj/0AAP//psTYje2P2I3tj9iN7Y/Yje2P")`
);

/**
 * A surface that declares 4 vertices but carries only 2 vertices' worth of `vertex_data`. format
 * 4097 = VERTEX|INDEX, so positions are all there is.
 */
export const truncatedSurface = surfaceWriter(
  `"aabb": AABB(-1, -1, 1, 2, 2, 0),
"format": 4097,
"index_count": 3,
"index_data": PackedByteArray("AAABAAIA"),`,
  `"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/")`
);

/**
 * A PackedVector2Array quad (0,0)..(100,100) with UVs (0,0)..(1,1) and no colour, as Godot 4.6.3's
 * `add_surface_from_arrays` saves it: format 34393296913 has ARRAY_FLAG_USE_2D_VERTICES.
 */
export const quad2DVerticesSurface = surfaceWriter(
  `"2d": true,
"aabb": AABB(0, 0, 0, 100, 100, 0),
"attribute_data": PackedByteArray(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 63, 0, 0, 0, 0, 0, 0, 128, 63, 0, 0, 128, 63, 0, 0, 0, 0, 0, 0, 128, 63),
"format": 34393296913,
"index_count": 6,
"index_data": PackedByteArray(0, 0, 1, 0, 2, 0, 0, 0, 2, 0, 3, 0),`,
  `"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 200, 66, 0, 0, 0, 0, 0, 0, 200, 66, 0, 0, 200, 66, 0, 0, 0, 0, 0, 0, 200, 66)`
);

/**
 * A PackedVector3Array quad (0,0,0)..(100,100,0) with UVs (0,0)..(1,1) and colours red, green at
 * half alpha, blue and white at quarter alpha, as Godot 4.6.3 saves it: format 34359742489 =
 * VERTEX|COLOR|TEX_UV|INDEX. Godot truncates `Color * 255`, so 0.5 stores 127 and 0.25 stores 63.
 */
export const colouredQuadSurface = surfaceWriter(
  `"aabb": AABB(0, 0, 0, 100, 100, 1e-05),
"attribute_data": PackedByteArray(255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 0, 127, 0, 0, 128, 63, 0, 0, 0, 0, 0, 0, 255, 255, 0, 0, 128, 63, 0, 0, 128, 63, 255, 255, 255, 63, 0, 0, 0, 0, 0, 0, 128, 63),
"format": 34359742489,
"index_count": 6,
"index_data": PackedByteArray(0, 0, 1, 0, 2, 0, 0, 0, 2, 0, 3, 0),`,
  `"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 200, 66, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 200, 66, 0, 0, 200, 66, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 200, 66, 0, 0, 0, 0)`
);

/**
 * `colouredQuadSurface` saved with ARRAY_FLAG_COMPRESS_ATTRIBUTES (format 34896613401).
 */
export const colouredQuadCompressedSurface = surfaceWriter(
  `"aabb": AABB(0, 0, 0, 100, 100, 1e-05),
"attribute_data": PackedByteArray(255, 0, 0, 255, 0, 0, 0, 0, 0, 255, 0, 127, 255, 255, 0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 63, 0, 0, 255, 255),
"format": 34896613401,
"index_count": 6,
"index_data": PackedByteArray(0, 0, 1, 0, 2, 0, 0, 0, 2, 0, 3, 0),`,
  `"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray(0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 255, 255, 0, 0, 0, 0)`
);
