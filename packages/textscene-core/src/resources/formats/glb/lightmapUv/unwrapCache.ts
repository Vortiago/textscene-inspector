/**
 * Parses the `<asset>.unwrap_cache` file Godot's scene importer writes beside a source asset it
 * unwraps for lightmaps. The format is `xatlas_mesh_lightmap_unwrap_callback`'s
 * (`modules/xatlas_unwrap/register_types.cpp:57-108`, `:181-219`), filed by
 * `resource_importer_scene.cpp:3257-3266`: little-endian 32-bit words, an entry count, then each
 * entry as a 16-byte MD5 of the unwrap input, the size hint, and the unwrapped mesh. Every word
 * sits at a multiple of 4 bytes, so an entry's arrays are views into `bytes`, which read in the
 * platform's byte order: little-endian on every browser and Node target.
 */

import { hexBytes } from './md5';

/** One unwrapped mesh. Output vertex `v` is input vertex `sourceVertices[v]` at UV2 `uvs[2v], uvs[2v + 1]`. */
export interface UnwrapCacheEntry {
  /** The MD5 of the unwrap input, as lowercase hex. */
  hash: string;
  sourceVertices: Int32Array;
  uvs: Float32Array;
  /** Output triangles over the output vertices, in Godot's winding. */
  indices: Int32Array;
}

const WORD = 4;
const HASH_WORDS = 4;
/** The size hint's two words, which the previewer does not read. */
const SIZE_HINT_WORDS = 2;

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
  const vertexCountAt = start + (HASH_WORDS + SIZE_HINT_WORDS) * WORD;
  const headerEnd = vertexCountAt + WORD;
  need(headerEnd);
  const hash = hexBytes(new Uint8Array(view.buffer, start, HASH_WORDS * WORD));
  const vertexCount = view.getInt32(vertexCountAt, true);

  const uvsStart = headerEnd + vertexCount * WORD;
  const indexCountAt = uvsStart + vertexCount * 2 * WORD;
  need(indexCountAt + WORD);
  const indexCount = view.getInt32(indexCountAt, true);
  const end = indexCountAt + WORD + indexCount * WORD;
  need(end);

  return {
    value: {
      hash,
      sourceVertices: new Int32Array(view.buffer, headerEnd, vertexCount),
      uvs: new Float32Array(view.buffer, uvsStart, vertexCount * 2),
      indices: new Int32Array(view.buffer, indexCountAt + WORD, indexCount),
    },
    end,
  };
}
