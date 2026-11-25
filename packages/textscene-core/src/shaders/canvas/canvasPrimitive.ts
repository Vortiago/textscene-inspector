import type * as THREE from 'three';
import { makeHalfFloat } from '../../godot/math/halfFloat.js';
import type { Rgba } from '../../godot/math/math.js';
import { VECTOR2_ZERO, type Vector2 } from '../../godot/math/vector.js';
import {
  type CanvasItemDraw,
  instanceBatchGeometry,
  instanceRecord,
  modulated,
  WHITE,
} from './canvasInstance.js';
import type { CanvasVariant } from './transpileCanvas.js';

/** `Item::CommandPrimitive`: each point with its UV and colour. */
export interface CanvasPrimitiveCommand {
  readonly points: readonly Vector2[];
  readonly uvs: readonly Vector2[];
  readonly colors: readonly Rgba[];
}

/** `canvas_item_add_primitive` (`renderer_canvas_cull.cpp:1686`): a missing colour repeats the first. */
export function primitiveCommand(
  points: readonly Vector2[],
  colors: readonly Rgba[],
  uvs: readonly Vector2[]
): CanvasPrimitiveCommand {
  if (points.length === 0 || points.length > 4)
    throw new Error(`expected a primitive of 1 to 4 points, got ${points.length}`);
  return {
    points,
    uvs: points.map((_, index) => uvs[index] ?? VECTOR2_ZERO),
    colors: points.map((_, index) => colors[index] ?? colors[0] ?? WHITE),
  };
}

/** The variant and the GL primitive of a batch (`renderer_canvas_render_rd.cpp:2669`). */
export function primitiveDraw(pointCount: number): {
  readonly variant: CanvasVariant;
  readonly primitive: CanvasPrimitive;
} {
  if (pointCount === 1) return { variant: 'primitive_points', primitive: 'points' };
  return { variant: 'primitive', primitive: pointCount === 2 ? 'lines' : 'triangles' };
}

/** `RS::PrimitiveType`, which `_primitive_type_to_render_primitive` maps to the GL primitive. */
export type CanvasPrimitive = 'points' | 'lines' | 'line_strip' | 'triangles' | 'triangle_strip';

/** Float offsets of `InstanceData`'s primitive members (`renderer_canvas_render_rd.h:366-371`). */
const POINTS = 8;
const UVS = 14;
const COLORS = 20;

/** The points of the second triangle of a quad (`renderer_canvas_render_rd.cpp:2721`). */
const SECOND_TRIANGLE = [0, 2, 3];

/** Each `InstanceData` of `command`: a quad is two triangles (`renderer_canvas_render_rd.cpp:2701-2738`). */
export function primitiveInstanceData(command: CanvasPrimitiveCommand, item: CanvasItemDraw): ArrayBuffer[] {
  const first = [0, 1, 2].slice(0, command.points.length);
  const triangles = command.points.length === 4 ? [first, SECOND_TRIANGLE] : [first];
  return triangles.map((points) => primitiveRecord(command, item, points));
}

function primitiveRecord(
  { points, uvs, colors }: CanvasPrimitiveCommand,
  item: CanvasItemDraw,
  indices: readonly number[]
): ArrayBuffer {
  const { bytes, floats, words } = instanceRecord(item);
  indices.forEach((point, slot) => {
    floats.set([points[point]!.x, points[point]!.y], POINTS + slot * 2);
    floats.set([uvs[point]!.x, uvs[point]!.y], UVS + slot * 2);
    words.set(packedColor(modulated(colors[point]!, item)), COLORS + slot * 2);
  });
  return bytes;
}

/** Two words of half floats, red low and green high, then blue and alpha, as `unpackHalf2x16` reads. */
function packedColor({ r, g, b, a }: Rgba): [number, number] {
  return [
    ((makeHalfFloat(g) << 16) | makeHalfFloat(r)) >>> 0,
    ((makeHalfFloat(a) << 16) | makeHalfFloat(b)) >>> 0,
  ];
}

/** `attrib_A` to `attrib_E` read floats (`renderer_canvas_render_rd.cpp:2014`). */
const PRIMITIVE_FLOAT_ATTRIBUTES = 5;

/** `primitive_arrays.index_array`: the first one, two or three indices of the quad's (`:2019-2021`). */
const PRIMITIVE_INDICES = [[0], [0, 1], [0, 1, 2]];

/**
 * The geometry of a batch of primitives of `pointCount` points, one instance for each record.
 * @canonical The instanced geometry of a canvas primitive batch
 */
export function primitiveBatchGeometry(
  records: readonly ArrayBuffer[],
  pointCount: number
): THREE.InstancedBufferGeometry {
  if (pointCount < 1 || pointCount > 4)
    throw new Error(`expected a batch of primitives of 1 to 4 points, got ${pointCount}`);
  const indices = PRIMITIVE_INDICES[Math.min(3, pointCount) - 1]!;
  return instanceBatchGeometry(records, PRIMITIVE_FLOAT_ATTRIBUTES, indices);
}
