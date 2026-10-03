/**
 * A binary glTF built in memory: one triangle mesh on one node, with the file's
 * extension lists and the node's extensions left to the caller. The chunk builders
 * under it write any GLB a test needs.
 */

import { GLB_BIN_CHUNK, GLB_JSON_CHUNK, GLB_MAGIC } from '../../../../godot/gltf';

/** One float32 VEC3 per vertex, and one per instance for the instancing extension. */
const TRIANGLE = [0, 0, 0, 1, 0, 0, 0, 1, 0];
const INSTANCE_OFFSETS = [0, 0, 0, 5, 0, 0, 10, 0, 0];
const INSTANCING = 'EXT_mesh_gpu_instancing';

export interface TriangleGlb {
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  /** Gives the node three instances through EXT_mesh_gpu_instancing, which it lists as used. */
  instanced?: boolean;
  /** The node's own translation. */
  translation?: [number, number, number];
  /** A glTF material definition for the triangle's one primitive. */
  material?: Record<string, unknown>;
  /** The node's `extras`, which three copies onto `userData`. */
  extras?: Record<string, unknown>;
}

function vec3Accessor(bufferView: number, values: number[]) {
  return { bufferView, componentType: 5126, count: values.length / 3, type: 'VEC3' };
}

/** A file must list every extension it uses, so an instanced node adds its own. */
function usedExtensions(listed: string[] = [], instanced = false): string[] {
  return instanced && !listed.includes(INSTANCING) ? [...listed, INSTANCING] : listed;
}

function gltfJson({
  extensionsUsed,
  extensionsRequired,
  instanced,
  translation,
  material,
  extras,
}: TriangleGlb) {
  const floatBytes = TRIANGLE.length * 4;
  return {
    asset: { version: '2.0' },
    ...(extensionsUsed || instanced ? { extensionsUsed: usedExtensions(extensionsUsed, instanced) } : {}),
    ...(extensionsRequired ? { extensionsRequired } : {}),
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      {
        name: 'Triangle',
        mesh: 0,
        ...(translation ? { translation } : {}),
        ...(extras ? { extras } : {}),
        ...(instanced ? { extensions: { [INSTANCING]: { attributes: { TRANSLATION: 1 } } } } : {}),
      },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, ...(material ? { material: 0 } : {}) }] }],
    ...(material ? { materials: [material] } : {}),
    accessors: [
      { ...vec3Accessor(0, TRIANGLE), min: [0, 0, 0], max: [1, 1, 0] },
      vec3Accessor(1, INSTANCE_OFFSETS),
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: floatBytes },
      { buffer: 0, byteOffset: floatBytes, byteLength: floatBytes },
    ],
    buffers: [{ byteLength: floatBytes * 2 }],
  };
}

/** A chunk body padded to four bytes with `pad`, as the GLB container requires. */
function padded(bytes: Uint8Array, pad: number): Uint8Array {
  const out = new Uint8Array(Math.ceil(bytes.length / 4) * 4).fill(pad);
  out.set(bytes);
  return out;
}

export interface GlbChunk {
  type: number;
  bytes: Uint8Array;
}

/** A JSON chunk holding `json`, padded with spaces as the container requires. */
export function jsonChunk(json: object): GlbChunk {
  return { type: GLB_JSON_CHUNK, bytes: padded(new TextEncoder().encode(JSON.stringify(json)), 0x20) };
}

/** A BIN chunk holding `bytes`, padded with zeros. */
export function binChunk(bytes: Uint8Array): GlbChunk {
  return { type: GLB_BIN_CHUNK, bytes: padded(bytes, 0) };
}

/** A GLB container of `chunks` in the order given, so a test can write one a valid file never has. */
export function glbOfChunks(chunks: GlbChunk[]): ArrayBuffer {
  const total = chunks.reduce((length, chunk) => length + 8 + chunk.bytes.length, 12);
  const glb = new ArrayBuffer(total);
  const view = new DataView(glb);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  let offset = 12;
  for (const { type, bytes } of chunks) {
    view.setUint32(offset, bytes.length, true);
    view.setUint32(offset + 4, type, true);
    new Uint8Array(glb, offset + 8, bytes.length).set(bytes);
    offset += 8 + bytes.length;
  }
  return glb;
}

export function triangleGlb(options: TriangleGlb = {}): ArrayBuffer {
  const positions = new Uint8Array(new Float32Array([...TRIANGLE, ...INSTANCE_OFFSETS]).buffer);
  return glbOfChunks([jsonChunk(gltfJson(options)), binChunk(positions)]);
}
