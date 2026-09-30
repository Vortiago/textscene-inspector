/**
 * The one surface of `scenes/demos/3d/platformer/stage/meshes/wall.tres`: a 4-vertex quad, format
 * 34359742487 = VERTEX|NORMAL|TANGENT|TEX_UV|INDEX, uncompressed. The suites that inline the wall
 * quad read it here, so a decoder change that re-encodes its bytes re-bakes every suite at once.
 */

export const WALL_QUAD_ATTRIBUTE_DATA = 'AAAAAAAAgD4AAIA+AACAPgAAgD4AAAAAAAAAAAAAAAA=';
export const WALL_QUAD_VERTEX_DATA =
  'AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/AACAPwAAgD8AAIA/AACAvwAAgD8AAIA//3//f////7//f/9/////v/9//3////+//3//f////78=';

/** The keys before `material` and `name`, in the order wall.tres writes them. */
const HEAD = `"aabb": AABB(-1, -1, 1, 2, 2, 1.001358e-05),
"attribute_data": PackedByteArray("${WALL_QUAD_ATTRIBUTE_DATA}"),
"format": 34359742487,
"index_count": 6,
"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),`;

/** The keys after `material` and `name`. */
const TAIL = `"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("${WALL_QUAD_VERTEX_DATA}")`;

/** An absent or null key is left out of the surface. */
export interface WallQuadKeys {
  /** The `"material"` value as `.tres` text, such as `SubResource("Mat")`. */
  material?: string | null;
  /** The `"name"` value, written as a quoted string. */
  name?: string | null;
}

/** The quad as one `_surfaces` dictionary, `{` to `}`, with the optional keys where Godot puts them. */
export function wallQuadSurface({ material, name }: WallQuadKeys = {}): string {
  const materialLine = material == null ? '' : `"material": ${material},\n`;
  const nameLine = name == null ? '' : `"name": "${name}",\n`;
  return `{\n${HEAD}\n${materialLine}${nameLine}${TAIL}\n}`;
}

/** A whole `_surfaces` array value: one wall quad per entry of `surfaces`, in order. */
export function wallQuadSurfaces(...surfaces: WallQuadKeys[]): string {
  return `[${surfaces.map(wallQuadSurface).join(', ')}]`;
}
