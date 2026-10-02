/**
 * A glTF's external buffers and images, read through the resource provider and packed
 * with its JSON into one GLB, so the glTF loader fetches nothing. The VS Code webview's
 * CSP refuses every fetch, a provider, not a URL, owns a `res://` file, and a URI in a
 * crafted file must not make the viewer request it. THREE-free, so it runs and tests
 * without a renderer.
 */

import { fileExtension } from '../../fileExtension';
import { normalizeRelativePath, RES_SCHEME } from '../../resPath';
import { GLB_BIN_CHUNK, GLB_JSON_CHUNK, GLB_MAGIC } from '../../../godot/gltf';

/** The parts of a glTF document this packs; every other member passes through untouched. */
export interface GltfJson {
  asset: { version: string };
  buffers?: { uri?: string; byteLength: number }[];
  bufferViews?: { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number }[];
  images?: { uri?: string; mimeType?: string; bufferView?: number; name?: string }[];
  [member: string]: unknown;
}

/** The container version Godot writes and the glTF 2.0 spec requires. */
const GLB_VERSION = 2;
/** The glTF spec aligns every GLB chunk, and this packer every resource, to four bytes. */
const ALIGNMENT = 4;

/** The image MIME types glTF 2.0 and its common extensions name, by extension. */
const IMAGE_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ktx2': 'image/ktx2',
};

/** The GLB file header: magic, version and total length, each a little-endian `uint32`. */
const GLB_HEADER_BYTES = 12;
const GLB_TOTAL_LENGTH_OFFSET = 8;
/** A GLB chunk header: the chunk's length, then its type. */
const GLB_CHUNK_HEADER_BYTES = 8;

/** Whether `data` is a binary glTF container, as against a text `.gltf`. */
function isGlbContainer(data: ArrayBuffer): boolean {
  return data.byteLength >= 4 && new DataView(data).getUint32(0, true) === GLB_MAGIC;
}

/**
 * The `res://` path a glTF URI names: percent-decoded, relative to the glTF's own directory.
 * Null for a URI that climbs above `res://`, which names no project file.
 */
export function gltfResourcePath(gltfPath: string, uri: string): string | null {
  const scheme = gltfPath.startsWith(RES_SCHEME) ? RES_SCHEME : '';
  const directory = gltfPath.slice(scheme.length).split('/').slice(0, -1).join('/');
  const relative = normalizeRelativePath(`${directory}/${percentDecoded(uri)}`);
  return relative === null ? null : scheme + relative;
}

/** `uri` percent-decoded, or as written when an escape is malformed. */
function percentDecoded(uri: string): string {
  try {
    return decodeURIComponent(uri);
  } catch {
    return uri;
  }
}

const padded = (length: number): number => Math.ceil(length / ALIGNMENT) * ALIGNMENT;

/** A data URI's bytes, base64 or percent-encoded. */
function dataUriBytes(uri: string): Uint8Array {
  const comma = uri.indexOf(',');
  const payload = uri.slice(comma + 1);
  if (uri.slice(0, comma).endsWith(';base64')) return Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
  return new TextEncoder().encode(decodeURIComponent(payload));
}

/** Collects resources into one binary chunk, each at a four-byte-aligned offset. */
class BinaryChunk {
  private readonly parts: { offset: number; bytes: Uint8Array }[] = [];
  length = 0;

  append(bytes: Uint8Array): number {
    const offset = this.length;
    this.parts.push({ offset, bytes });
    this.length = padded(offset + bytes.byteLength);
    return offset;
  }

  bytes(): Uint8Array {
    const out = new Uint8Array(this.length);
    for (const { offset, bytes } of this.parts) out.set(bytes, offset);
    return out;
  }
}

/** Reads a non-data URI a glTF names, and throws when it cannot. */
export type ReadUri = (uri: string) => Promise<ArrayBuffer>;

/** A GLB container's JSON document and the bytes of its binary chunk. */
interface GlbChunks {
  json: GltfJson;
  bin: Uint8Array;
}

/**
 * The JSON and binary chunk three's glTF loader reads: it walks every chunk to the header's
 * total length and keeps the last of each type (`GLTFBinaryExtension` in `GLTFLoader.js`).
 * This walks the same way, so both read one document. Throws where the loader throws.
 */
function glbChunks(glb: ArrayBuffer): GlbChunks {
  const contentsLength = new DataView(glb).getUint32(GLB_TOTAL_LENGTH_OFFSET, true) - GLB_HEADER_BYTES;
  const chunks = new DataView(glb, GLB_HEADER_BYTES);
  let text: string | null = null;
  let bin = new Uint8Array();
  for (let index = 0; index < contentsLength;) {
    const length = chunks.getUint32(index, true);
    const type = chunks.getUint32(index + 4, true);
    const body = new Uint8Array(glb, GLB_HEADER_BYTES + index + GLB_CHUNK_HEADER_BYTES, length);
    if (type === GLB_JSON_CHUNK) text = new TextDecoder().decode(body);
    else if (type === GLB_BIN_CHUNK) bin = body;
    index += GLB_CHUNK_HEADER_BYTES + length;
  }
  if (text === null) throw new Error('GLB has no JSON chunk');
  return { json: JSON.parse(text) as GltfJson, bin };
}

/** Whether a buffer or an image names its bytes by `uri`, which the glTF loader would fetch. */
function namesUri(json: GltfJson): boolean {
  return [...(json.buffers ?? []), ...(json.images ?? [])].some((entry) => entry.uri !== undefined);
}

/**
 * `data` as a GLB that carries every buffer and image it names: a text glTF packed, a GLB
 * that names a `uri` repacked, and any other GLB as it is. The glTF loader then fetches nothing.
 */
export async function selfContainedGlb(data: ArrayBuffer, readUri: ReadUri): Promise<ArrayBuffer> {
  if (!isGlbContainer(data)) {
    const json = JSON.parse(new TextDecoder().decode(data)) as GltfJson;
    return packGltfAsGlb(json, readUri);
  }
  const { json, bin } = glbChunks(data);
  return namesUri(json) ? packGltfAsGlb(json, readUri, bin) : data;
}

/**
 * `json` as a GLB: every buffer and every image with a `uri` moves into the one
 * binary chunk, and the buffer views point into it. `glbBin` is the binary chunk of the
 * GLB that `json` came from, which the first buffer names when it has no `uri`. The
 * input is not changed.
 */
export async function packGltfAsGlb(
  json: GltfJson,
  readUri: ReadUri,
  glbBin: Uint8Array = new Uint8Array()
): Promise<ArrayBuffer> {
  const read = async (uri: string): Promise<Uint8Array> =>
    uri.startsWith('data:') ? dataUriBytes(uri) : new Uint8Array(await readUri(uri));
  const chunk = new BinaryChunk();
  const bufferOffsets: number[] = [];
  for (const [index, buffer] of (json.buffers ?? []).entries()) {
    const ownBytes = index === 0 ? glbBin : new Uint8Array();
    bufferOffsets.push(chunk.append(buffer.uri === undefined ? ownBytes : await read(buffer.uri)));
  }
  const bufferViews = (json.bufferViews ?? []).map((view) => ({
    ...view,
    buffer: 0,
    byteOffset: bufferOffsets[view.buffer]! + (view.byteOffset ?? 0),
  }));
  const images = [];
  for (const image of json.images ?? []) {
    if (image.uri === undefined) {
      images.push(image);
      continue;
    }
    const { uri, ...rest } = image;
    const bytes = await read(uri);
    bufferViews.push({ buffer: 0, byteOffset: chunk.append(bytes), byteLength: bytes.byteLength });
    const mimeType = rest.mimeType ?? IMAGE_MIME_TYPES[fileExtension(uri.split('?')[0]!) ?? ''];
    images.push({ ...rest, bufferView: bufferViews.length - 1, ...(mimeType && { mimeType }) });
  }
  const packed: GltfJson = { ...json, buffers: [{ byteLength: chunk.length }], bufferViews };
  if (json.images) packed.images = images;
  return glbOf(packed, chunk.bytes());
}

/** The GLB container: a 12-byte header, the JSON chunk padded with spaces, the binary chunk. */
function glbOf(json: GltfJson, bin: Uint8Array): ArrayBuffer {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = padded(text.byteLength);
  const total = 12 + 8 + jsonLength + 8 + bin.byteLength;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, GLB_VERSION, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, GLB_JSON_CHUNK, true);
  out.fill(0x20, 20, 20 + jsonLength);
  out.set(text, 20);
  const binStart = 20 + jsonLength;
  view.setUint32(binStart, bin.byteLength, true);
  view.setUint32(binStart + 4, GLB_BIN_CHUNK, true);
  out.set(bin, binStart + 8);
  return out.buffer;
}
