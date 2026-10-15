import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { createGLBMesh } from './glbProcessing';
import { binChunk, glbOfChunks, jsonChunk } from './testing/triangleGlb';
import { isMesh } from '../../../r3f/testing/threeNarrow';

const NAMING = { naming: { namingVersion: 2, importAsSkeletonBones: false, fileName: 'fan' } };

/** Six vertices around a hub, as float32 xyz. */
const DISC = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, -1, 1, 0, -1, 0, 0];

/** A GLB of one mesh whose primitives each take `positions` and their own fields. */
function primitivesGlb(primitives: Record<string, unknown>[], indices: number[] = []): ArrayBuffer {
  const floats = new Uint8Array(new Float32Array(DISC).buffer);
  const indexBytes = new Uint8Array(new Uint16Array(indices).buffer);
  // A buffer view may not be empty, so a GLB without indices still carries two bytes.
  const indexByteLength = Math.max(indexBytes.length, 2);
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'Disc', mesh: 0 }],
    meshes: [
      { name: 'Disc', primitives: primitives.map((fields) => ({ attributes: { POSITION: 0 }, ...fields })) },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 6, type: 'VEC3', min: [-1, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5123, count: indices.length, type: 'SCALAR' },
      { bufferView: 0, componentType: 5126, count: 6, type: 'VEC3' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: floats.length },
      { buffer: 0, byteOffset: floats.length, byteLength: indexByteLength },
    ],
    buffers: [{ byteLength: floats.length + indexByteLength }],
  };
  const bin = new Uint8Array(floats.length + indexByteLength);
  bin.set(floats);
  bin.set(indexBytes, floats.length);
  return glbOfChunks([jsonChunk(json), binChunk(bin)]);
}

async function surfaces(glb: ArrayBuffer): Promise<THREE.Mesh[]> {
  const found: THREE.Mesh[] = [];
  (await createGLBMesh(glb, NAMING)).traverse((node) => {
    if (isMesh(node)) found.push(node);
  });
  return found;
}

describe('godotPrimitives: triangle fans', () => {
  it("reads an indexed fan's indices as a triangle list, as Godot does", async () => {
    const [fan] = await surfaces(primitivesGlb([{ mode: 6, indices: 1 }], [0, 1, 2, 3, 4, 5]));

    expect(Array.from(fan!.geometry.index!.array)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('reads a fan without indices as its vertices in threes', async () => {
    const [fan] = await surfaces(primitivesGlb([{ mode: 6 }]));

    expect(fan!.geometry.index).toBeNull();
  });

  it('fails the load on a fan Godot refuses, as its import fails (edge case)', async () => {
    await expect(surfaces(primitivesGlb([{ mode: 6, indices: 1 }], [0, 1, 2, 3]))).rejects.toThrow(
      'glTF: mesh 0 surface 0 lists 4 triangle indices, not a multiple of 3, so Godot refuses it'
    );
  });

  it('fails the load on a triangle list Godot refuses (edge case)', async () => {
    await expect(surfaces(primitivesGlb([{ indices: 1 }], [0, 1, 2, 3]))).rejects.toThrow(
      'lists 4 triangle indices'
    );
  });

  it('fails the load on a bad list in a surface Godot then refuses, as Godot reads it first', async () => {
    const glb = primitivesGlb([{}, { targets: [{ POSITION: 2 }], indices: 1 }], [0, 1, 2, 3]);

    await expect(surfaces(glb)).rejects.toThrow('mesh 0 surface 1 lists 4 triangle indices');
  });
});

describe('godotPrimitives: refused surfaces', () => {
  it('removes a surface whose target count differs from the first primitive', async () => {
    const found = await surfaces(primitivesGlb([{}, { targets: [{ POSITION: 2 }] }, {}]));

    expect(found).toHaveLength(2);
  });

  it('keeps every surface of a mesh whose primitives agree', async () => {
    const found = await surfaces(primitivesGlb([{}, {}]));

    expect(found).toHaveLength(2);
  });
});
