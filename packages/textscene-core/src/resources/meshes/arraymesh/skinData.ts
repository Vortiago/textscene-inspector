import type { SurfaceBones } from '../godotSurface.js';
import type { SkinLayout, SurfaceLayout } from './surfaceFormat.js';

/** three skins with four bones a vertex. */
const SKINNED_BONES = 4;

/** Godot binds four 16-bit bones, then four weights 8 bytes on (`mesh_storage.cpp:1386-1397`). */
const VERTEX_STAGE_STRIDE = 16;
const VERTEX_STAGE_WEIGHTS_OFFSET = 8;

/** A weight is a unorm16 (`rendering_server.cpp:846`). */
const WEIGHT_UNIT = 65535;

/** A surface's bones: those that skin it, and those its vertex stage reads when the two differ. */
export interface DecodedSkin {
  bones: SurfaceBones;
  /** BONE_INDICES and BONE_WEIGHTS of an 8-weight surface, read with the 4-weight stride Godot binds. */
  vertexStageBones?: SurfaceBones;
}

/** The bones of `skin_data`, or undefined for a surface with none or a region too short for its count. */
export function decodeSkin(
  bytes: Uint8Array,
  vertexCount: number,
  layout: SurfaceLayout
): DecodedSkin | undefined {
  const skin = layout.skin;
  if (!skin || vertexCount === 0 || bytes.byteLength < vertexCount * skin.stride) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (skin.count === SKINNED_BONES)
    return { bones: readBones(view, vertexCount, skin.stride, skin.stride / 2) };
  return {
    bones: largestFour(view, vertexCount, skin),
    vertexStageBones: readBones(view, vertexCount, VERTEX_STAGE_STRIDE, VERTEX_STAGE_WEIGHTS_OFFSET),
  };
}

/** Four bone indices at each record's start and four weights at `weightsOffset`. */
function readBones(view: DataView, vertexCount: number, stride: number, weightsOffset: number): SurfaceBones {
  const indices = new Uint16Array(vertexCount * SKINNED_BONES);
  const weights = new Float32Array(vertexCount * SKINNED_BONES);
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    for (let slot = 0; slot < SKINNED_BONES; slot++) {
      const out = vertex * SKINNED_BONES + slot;
      indices[out] = view.getUint16(vertex * stride + slot * 2, true);
      weights[out] = view.getUint16(vertex * stride + weightsOffset + slot * 2, true) / WEIGHT_UNIT;
    }
  }
  return { indices, weights };
}

/** The four largest of eight weights a vertex, scaled to a sum of 1, as three skins with four. */
function largestFour(view: DataView, vertexCount: number, skin: SkinLayout): SurfaceBones {
  const all = readAllBones(view, vertexCount, skin);
  const indices = new Uint16Array(vertexCount * SKINNED_BONES);
  const weights = new Float32Array(vertexCount * SKINNED_BONES);
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    const slots = Array.from({ length: skin.count }, (_, slot) => vertex * skin.count + slot)
      .sort((a, b) => all.weights[b]! - all.weights[a]!)
      .slice(0, SKINNED_BONES);
    const total = slots.reduce((sum, slot) => sum + all.weights[slot]!, 0);
    slots.forEach((slot, kept) => {
      indices[vertex * SKINNED_BONES + kept] = all.indices[slot]!;
      weights[vertex * SKINNED_BONES + kept] = total > 0 ? all.weights[slot]! / total : 0;
    });
  }
  return { indices, weights };
}

function readAllBones(view: DataView, vertexCount: number, skin: SkinLayout): SurfaceBones {
  const indices = new Uint16Array(vertexCount * skin.count);
  const weights = new Float32Array(vertexCount * skin.count);
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    for (let slot = 0; slot < skin.count; slot++) {
      const record = vertex * skin.stride + slot * 2;
      indices[vertex * skin.count + slot] = view.getUint16(record, true);
      weights[vertex * skin.count + slot] = view.getUint16(record + skin.count * 2, true) / WEIGHT_UNIT;
    }
  }
  return { indices, weights };
}
