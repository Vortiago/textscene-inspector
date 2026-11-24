import type { SurfaceBones } from '../godotSurface.js';
import { bytesView } from '../../../utils/bytesView.js';
import type { SkinLayout } from './surfaceFormat.js';

/** three skins with four bones a vertex. */
const SKINNED_BONES = 4;

/** Godot binds four 16-bit bones, then four weights, 16 bytes a vertex (`mesh_storage.cpp:1386-1397`). */
const VERTEX_STAGE_STRIDE = 16;

/** A weight is a unorm16 (`rendering_server.cpp:846`). */
const WEIGHT_UNIT = 65535;

/** A surface's bones: those that skin it, and those its vertex stage reads when the two differ. */
export interface DecodedSkin {
  bones: SurfaceBones;
  /** BONE_INDICES and BONE_WEIGHTS of an 8-weight surface, read with the 4-weight stride Godot binds. */
  vertexStageBones?: SurfaceBones;
}

/** The bones of `skin_data`, or undefined for a region too short for its count. */
export function decodeSkin(
  bytes: Uint8Array,
  vertexCount: number,
  skin: SkinLayout
): DecodedSkin | undefined {
  if (vertexCount === 0 || bytes.byteLength < vertexCount * skin.stride) return undefined;
  const view = bytesView(bytes);
  const stored = readBones(view, vertexCount, { count: skin.count, stride: skin.stride });
  if (skin.count === SKINNED_BONES) return { bones: stored };
  return {
    bones: largestFour(stored, vertexCount, skin.count),
    vertexStageBones: readBones(view, vertexCount, { count: SKINNED_BONES, stride: VERTEX_STAGE_STRIDE }),
  };
}

/** `count` bones and weights for each vertex, as `skin_data` stores them. */
interface StoredBones {
  indices: Uint16Array;
  weights: Float32Array;
}

/** `count` bone indices at each record's start, then `count` weights. */
function readBones(
  view: DataView,
  vertexCount: number,
  record: { count: number; stride: number }
): StoredBones {
  const { count, stride } = record;
  const indices = new Uint16Array(vertexCount * count);
  const weights = new Float32Array(vertexCount * count);
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    for (let slot = 0; slot < count; slot++) {
      const at = vertex * stride + slot * 2;
      indices[vertex * count + slot] = view.getUint16(at, true);
      weights[vertex * count + slot] = view.getUint16(at + count * 2, true) / WEIGHT_UNIT;
    }
  }
  return { indices, weights };
}

/** The four largest weights a vertex, the first of equals first, scaled to a sum of 1, for three. */
function largestFour(stored: StoredBones, vertexCount: number, count: number): SurfaceBones {
  const indices = new Uint16Array(vertexCount * SKINNED_BONES);
  const weights = new Float32Array(vertexCount * SKINNED_BONES);
  const isKept = new Uint8Array(count);
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    isKept.fill(0);
    let total = 0;
    for (let kept = 0; kept < SKINNED_BONES; kept++) {
      let largest = -1;
      for (let slot = 0; slot < count; slot++) {
        const isLarger =
          largest < 0 || stored.weights[vertex * count + slot]! > stored.weights[vertex * count + largest]!;
        if (!isKept[slot] && isLarger) largest = slot;
      }
      isKept[largest] = 1;
      indices[vertex * SKINNED_BONES + kept] = stored.indices[vertex * count + largest]!;
      weights[vertex * SKINNED_BONES + kept] = stored.weights[vertex * count + largest]!;
      total += weights[vertex * SKINNED_BONES + kept]!;
    }
    for (let kept = 0; kept < SKINNED_BONES; kept++)
      weights[vertex * SKINNED_BONES + kept] =
        total > 0 ? weights[vertex * SKINNED_BONES + kept]! / total : 0;
  }
  return { indices, weights };
}
