/**
 * The one surface of `scenes/demos/3d/platformer/stage/meshes/wall.tres`: a 4-vertex quad, format
 * 34359742487 = VERTEX|NORMAL|TANGENT|TEX_UV|INDEX, uncompressed. Every suite that inlines ArrayMesh
 * bytes reads them here, so a decoder change that re-encodes them re-bakes every suite at once.
 */

/** The keys before `material` and `name`, in the order wall.tres writes them. */
const HEAD = `"aabb": AABB(-1, -1, 1, 2, 2, 1.001358e-05),
"attribute_data": PackedByteArray("AAAAAAAAgD4AAIA+AACAPgAAgD4AAAAAAAAAAAAAAAA="),
"format": 34359742487,
"index_count": 6,
"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),`;

/** The keys after `material` and `name`. */
const TAIL = `"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/AACAPwAAgD8AAIA/AACAvwAAgD8AAIA//3//f////7//f/9/////v/9//3////+//3//f////78=")`;

export interface WallQuadKeys {
  /** The `"material"` value as `.tres` text, such as `SubResource("Mat")`. */
  material?: string;
  /** The `"name"` value, written as a quoted string. */
  name?: string;
}

/** The quad as one `_surfaces` dictionary, `{` to `}`, with the optional keys where Godot puts them. */
export function wallQuadSurface({ material, name }: WallQuadKeys = {}): string {
  const materialLine = material === undefined ? '' : `"material": ${material},\n`;
  const nameLine = name === undefined ? '' : `"name": "${name}",\n`;
  return `{\n${HEAD}\n${materialLine}${nameLine}${TAIL}\n}`;
}
