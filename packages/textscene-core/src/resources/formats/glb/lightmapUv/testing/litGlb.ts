/**
 * A GLB whose mesh `Lit` has one triangle primitive with normals, and an unwrap cache that maps it
 * to a layout of the test's choosing. The options add what a test needs around it.
 */

import * as THREE from 'three';
import { binChunk, glbOfChunks, jsonChunk } from '../../testing/triangleGlb';
import { unwrapInput } from '../unwrapInput';

const LIT = [0, 0, 0, 1, 0, 0, 0, 1, 0];
const NORMALS = [0, 0, 1, 0, 0, 1, 0, 0, 1];
const BARE = [5, 0, 0, 6, 0, 0, 5, 1, 0];

/** The lit triangle's UV2 in the cache, output vertex `v` at `2v`. */
export const LIT_UV2 = [0.25, 0.25, 0.75, 0.25, 0.25, 0.75];

export interface LitGlb {
  /** Adds a last primitive without normals, which Godot's importer drops from an unwrapped mesh. */
  bareSurface?: boolean;
  /** Puts a KHR_lights_punctual light on the mesh's node, which GLTFLoader then groups. */
  nodeLight?: boolean;
  /** Gives the lit primitive an empty `targets` array. */
  emptyTargets?: boolean;
  /** Adds a mesh `Twin` on its own node, over the lit primitive's accessors. */
  twinMesh?: boolean;
}

export function litGlb({ bareSurface, nodeLight, emptyTargets, twinMesh }: LitGlb = {}): ArrayBuffer {
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
  const lit = { attributes: { POSITION: 0, NORMAL: 1 }, ...(emptyTargets ? { targets: [] } : {}) };
  const lightsExtension = 'KHR_lights_punctual';
  const json = {
    asset: { version: '2.0' },
    ...(nodeLight ? { extensionsUsed: [lightsExtension] } : {}),
    ...(nodeLight ? { extensions: { [lightsExtension]: { lights: [{ type: 'point' }] } } } : {}),
    scene: 0,
    scenes: [{ nodes: twinMesh ? [0, 1] : [0] }],
    nodes: [
      { name: 'Lit', mesh: 0, ...(nodeLight ? { extensions: { [lightsExtension]: { light: 0 } } } : {}) },
      ...(twinMesh ? [{ name: 'Twin', mesh: 1 }] : []),
    ],
    meshes: [
      { name: 'Lit', primitives: bareSurface ? [lit, { attributes: { POSITION: 2 } }] : [lit] },
      ...(twinMesh ? [{ name: 'Twin', primitives: [{ attributes: { POSITION: 0, NORMAL: 1 } }] }] : []),
    ],
    accessors: [accessor(0, LIT), accessor(1), accessor(2, BARE)],
    bufferViews: [view(0), view(1), view(2)],
    buffers: [{ byteLength: floats.byteLength }],
  };
  return glbOfChunks([jsonChunk(json), binChunk(new Uint8Array(floats.buffer))]);
}

/** A cache whose one entry is keyed on the lit primitive's input at `texelSize`. */
export function litCache(texelSize: number): ArrayBuffer {
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
