/**
 * A GLB of one mesh with two triangle primitives: the first has normals, the last has none, as
 * Godot's importer drops from an unwrapped mesh. Its unwrap cache maps the lit triangle to a
 * layout of the test's choosing.
 */

import * as THREE from 'three';
import { binChunk, glbOfChunks, jsonChunk } from '../../testing/triangleGlb';
import { unwrapInput } from '../unwrapInput';

const LIT = [0, 0, 0, 1, 0, 0, 0, 1, 0];
const NORMALS = [0, 0, 1, 0, 0, 1, 0, 0, 1];
const BARE = [5, 0, 0, 6, 0, 0, 5, 1, 0];

/** The lit triangle's UV2 in the cache, output vertex `v` at `2v`. */
export const LIT_UV2 = [0.25, 0.25, 0.75, 0.25, 0.25, 0.75];

export function litAndBareGlb(): ArrayBuffer {
  const floats = new Float32Array([...LIT, ...NORMALS, ...BARE]);
  const view = (index: number) => ({ buffer: 0, byteOffset: index * 36, byteLength: 36 });
  const accessor = (index: number, positions?: number[]) => ({
    bufferView: index,
    componentType: 5126,
    count: 3,
    type: 'VEC3',
    ...(positions
      ? {
          min: [0, 1, 2].map((a) => Math.min(...positions.filter((_, i) => i % 3 === a))),
          max: [0, 1, 2].map((a) => Math.max(...positions.filter((_, i) => i % 3 === a))),
        }
      : {}),
  });
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'Mix', mesh: 0 }],
    meshes: [
      {
        name: 'Mix',
        primitives: [{ attributes: { POSITION: 0, NORMAL: 1 } }, { attributes: { POSITION: 2 } }],
      },
    ],
    accessors: [accessor(0, LIT), accessor(1), accessor(2, BARE)],
    bufferViews: [view(0), view(1), view(2)],
    buffers: [{ byteLength: floats.byteLength }],
  };
  return glbOfChunks([jsonChunk(json), binChunk(new Uint8Array(floats.buffer))]);
}

/** A cache whose one entry is keyed on the lit primitive's input at `texelSize`. */
export function litAndBareCache(texelSize: number): ArrayBuffer {
  const lit = new THREE.BufferGeometry();
  lit.setAttribute('position', new THREE.Float32BufferAttribute(LIT, 3));
  lit.setAttribute('normal', new THREE.Float32BufferAttribute(NORMALS, 3));
  const { hash } = unwrapInput([lit], { scale: [1, 1, 1], vertexScale: 1 }, texelSize)!;

  const words = new DataView(new ArrayBuffer(4 * (1 + 4 + 2 + 1 + 3 + 6 + 1 + 3)));
  const hashBytes = hash.match(/../g)!.map((pair) => parseInt(pair, 16));
  let offset = 0;
  const int = (value: number) => (words.setInt32(offset, value, true), (offset += 4));
  int(1);
  hashBytes.forEach((byte) => (words.setUint8(offset, byte), offset++));
  [8, 8, 3, 0, 1, 2].forEach(int);
  LIT_UV2.forEach((value) => (words.setFloat32(offset, value, true), (offset += 4)));
  // Godot's winding is the glTF winding with two corners swapped.
  [3, 0, 2, 1].forEach(int);
  return words.buffer;
}
