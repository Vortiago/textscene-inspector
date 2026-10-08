/**
 * A binary glTF of the caller's nodes over two triangle meshes: mesh 0 has one primitive, and
 * mesh 1 has two. The scene holds each node no other node lists as a child.
 */

import { binChunk, glbOfChunks, jsonChunk } from './triangleGlb';

const TRIANGLE = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
const TRIANGLE_PRIMITIVE = { attributes: { POSITION: 0 } };

interface GltfNode {
  name: string;
  mesh?: number;
  children?: number[];
  [key: string]: unknown;
}

/** `extra` adds top-level glTF keys, such as the `cameras` a node names. */
export function nodesGlb(nodes: GltfNode[], extra: Record<string, unknown> = {}): ArrayBuffer {
  const children = new Set(nodes.flatMap((node) => node.children ?? []));
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i).filter((i) => !children.has(i)) }],
    nodes,
    meshes: [{ primitives: [TRIANGLE_PRIMITIVE] }, { primitives: [TRIANGLE_PRIMITIVE, TRIANGLE_PRIMITIVE] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
    ],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: TRIANGLE.byteLength }],
    buffers: [{ byteLength: TRIANGLE.byteLength }],
    ...extra,
  };
  return glbOfChunks([jsonChunk(json), binChunk(new Uint8Array(TRIANGLE.buffer))]);
}
