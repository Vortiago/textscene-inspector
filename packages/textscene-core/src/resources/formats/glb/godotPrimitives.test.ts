import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import { createGLBMesh, initGlbModules } from './glbProcessing';
import { binChunk, glbOfChunks, jsonChunk } from './testing/triangleGlb';
import { isMesh } from '../../../r3f/testing/threeNarrow';
import * as logger from '../../../logger';

const NAMING = { naming: { namingVersion: 2, importAsSkeletonBones: false, fileName: 'fan' } };

/** Six vertices around a hub, as float32 xyz. */
const DISC = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, -1, 1, 0, -1, 0, 0];

/** A GLB of one mesh whose primitives each take `positions` and their own fields. */
function primitivesGlb(primitives: Record<string, unknown>[], indices: number[] = []): ArrayBuffer {
  const floats = new Uint8Array(new Float32Array(DISC).buffer);
  const indexBytes = new Uint8Array(new Uint16Array(indices).buffer);
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
      { buffer: 0, byteOffset: floats.length, byteLength: Math.max(indexBytes.length, 2) },
    ],
    buffers: [{ byteLength: floats.length + Math.max(indexBytes.length, 2) }],
  };
  const bin = new Uint8Array(floats.length + Math.max(indexBytes.length, 2));
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

describe('readFansAsLists', () => {
  beforeAll(async () => {
    await initGlbModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads an indexed fan's indices as a triangle list, as Godot does", async () => {
    const [fan] = await surfaces(primitivesGlb([{ mode: 6, indices: 1 }], [0, 1, 2, 3, 4, 5]));

    expect(Array.from(fan!.geometry.index!.array)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('reads a fan without indices as its vertices in threes', async () => {
    const [fan] = await surfaces(primitivesGlb([{ mode: 6 }]));

    expect(fan!.geometry.index).toBeNull();
  });

  it('keeps the fan triangles of a fan Godot refuses, and warns (edge case)', async () => {
    const warn = vi.spyOn(logger, 'warn');

    const [fan] = await surfaces(primitivesGlb([{ mode: 6, indices: 1 }], [0, 1, 2, 3]));

    expect(Array.from(fan!.geometry.index!.array)).toEqual([0, 1, 2, 0, 2, 3]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('a fan of 4 indices, which Godot refuses'));
  });
});

describe('removeRefusedSurfaces', () => {
  beforeAll(async () => {
    await initGlbModules();
  });

  it('removes a surface whose target count differs from the first primitive', async () => {
    const found = await surfaces(primitivesGlb([{}, { targets: [{ POSITION: 2 }] }, {}]));

    expect(found).toHaveLength(2);
  });

  it('keeps every surface of a mesh whose primitives agree', async () => {
    const found = await surfaces(primitivesGlb([{}, {}]));

    expect(found).toHaveLength(2);
  });
});
