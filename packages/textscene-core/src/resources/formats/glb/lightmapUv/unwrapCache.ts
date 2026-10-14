/**
 * Parses the `<asset>.unwrap_cache` file Godot's scene importer writes beside a source asset it
 * unwraps for lightmaps. The format is `xatlas_mesh_lightmap_unwrap_callback`'s
 * (`modules/xatlas_unwrap/register_types.cpp:57-108`, `:181-219`), filed by
 * `resource_importer_scene.cpp:3257-3266`: little-endian 32-bit words, an entry count, then each
 * entry as a 16-byte MD5 of the unwrap input, the size hint, and the unwrapped mesh.
 */

import { hexBytes } from './md5';

/** One unwrapped mesh. Output vertex `v` is input vertex `sourceVertices[v]` at UV2 `uvs[2v], uvs[2v + 1]`. */
export interface UnwrapCacheEntry {
  /** The MD5 of the unwrap input, as lowercase hex. */
  hash: string;
  /** The lightmap size in texels Godot sets as the mesh's `lightmap_size_hint`. */
  sizeHint: [number, number];
  sourceVertices: Int32Array;
  uvs: Float32Array;
  /** Output triangles over the output vertices, in Godot's winding. */
  indices: Int32Array;
}

const WORD = 4;
const HASH_WORDS = 4;

/** The cache's entries in file order. Throws when an entry runs past the end of `bytes`. */
export function parseUnwrapCache(bytes: ArrayBuffer): UnwrapCacheEntry[] {
  const view = new DataView(bytes);
  const entryCount = view.getInt32(0, true);
  const entries: UnwrapCacheEntry[] = [];
  let offset = WORD;
  for (let index = 0; index < entryCount; index++) {
    const entry = readEntry(view, offset, index);
    entries.push(entry.value);
    offset = entry.end;
  }
  return entries;
}

function readEntry(view: DataView, start: number, index: number): { value: UnwrapCacheEntry; end: number } {
  const need = (end: number): void => {
    if (end > view.byteLength) {
      throw new Error(`unwrap cache: entry ${index} needs ${end} bytes, the file has ${view.byteLength}`);
    }
  };
  const headerEnd = start + (HASH_WORDS + 3) * WORD;
  need(headerEnd);
  const hash = hexBytes(new Uint8Array(view.buffer, start, HASH_WORDS * WORD));
  const sizeHint: [number, number] = [view.getInt32(start + 16, true), view.getInt32(start + 20, true)];
  const vertexCount = view.getInt32(start + 24, true);

  const uvsStart = headerEnd + vertexCount * WORD;
  const indexCountAt = uvsStart + vertexCount * 2 * WORD;
  need(indexCountAt + WORD);
  const indexCount = view.getInt32(indexCountAt, true);
  const end = indexCountAt + WORD + indexCount * WORD;
  need(end);

  return {
    value: {
      hash,
      sizeHint,
      sourceVertices: readInt32s(view, headerEnd, vertexCount),
      uvs: readFloat32s(view, uvsStart, vertexCount * 2),
      indices: readInt32s(view, indexCountAt + WORD, indexCount),
    },
    end,
  };
}

function readInt32s(view: DataView, start: number, count: number): Int32Array {
  const values = new Int32Array(count);
  for (let i = 0; i < count; i++) values[i] = view.getInt32(start + i * WORD, true);
  return values;
}

function readFloat32s(view: DataView, start: number, count: number): Float32Array {
  const values = new Float32Array(count);
  for (let i = 0; i < count; i++) values[i] = view.getFloat32(start + i * WORD, true);
  return values;
}
