/**
 * A binary glTF of a skinned rig: the node Armature, at `offset`, holds the joint Hip
 * and the skinned mesh Body, whose three vertices all follow Hip. Its inverse bind matrix undoes
 * the offset, so the triangle draws where its vertices are. Godot builds Armature > Skeleton3D > Body.
 */

import { binChunk, glbOfChunks, jsonChunk } from './triangleGlb';

const POSITIONS = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
const JOINTS = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const WEIGHTS = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);

export function skinnedRigGlb(offset: readonly [number, number, number]): ArrayBuffer {
  // Column-major, so the translation sits in the last column.
  const inverseBind = new Float32Array([
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    -offset[0],
    -offset[1],
    -offset[2],
    1,
  ]);
  const chunks = [POSITIONS, JOINTS, WEIGHTS, inverseBind].map(
    (array) => new Uint8Array(array.buffer, array.byteOffset, array.byteLength)
  );
  const offsets = chunks.map((_, i) => chunks.slice(0, i).reduce((sum, chunk) => sum + chunk.byteLength, 0));
  const bin = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  chunks.forEach((chunk, i) => bin.set(chunk, offsets[i]));
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      { name: 'Armature', translation: [...offset], children: [1, 2] },
      { name: 'Hip' },
      { name: 'Body', mesh: 0, skin: 0 },
    ],
    skins: [{ joints: [1], inverseBindMatrices: 3 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5121, count: 3, type: 'VEC4' },
      { bufferView: 2, componentType: 5126, count: 3, type: 'VEC4' },
      { bufferView: 3, componentType: 5126, count: 1, type: 'MAT4' },
    ],
    bufferViews: chunks.map((chunk, i) => ({
      buffer: 0,
      byteOffset: offsets[i],
      byteLength: chunk.byteLength,
    })),
    buffers: [{ byteLength: bin.byteLength }],
  };
  return glbOfChunks([jsonChunk(json), binChunk(bin)]);
}
