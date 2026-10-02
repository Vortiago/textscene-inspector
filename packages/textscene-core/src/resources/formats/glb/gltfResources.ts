/**
 * A text glTF's external buffers and images, read through the resource provider and
 * packed with its JSON into one GLB, so the glTF loader fetches nothing. The VS Code
 * webview's CSP refuses every fetch, and a provider, not a URL, owns a `res://` file.
 * THREE-free, so it runs and tests without a renderer.
 */

import { fileExtension } from '../../fileExtension';
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

/** Whether `data` is a binary glTF container, as against a text `.gltf`. */
export function isGlbContainer(data: ArrayBuffer): boolean {
  return data.byteLength >= 4 && new DataView(data).getUint32(0, true) === GLB_MAGIC;
}

/** The `res://` path a glTF URI names: percent-decoded, relative to the glTF's own directory. */
export function gltfResourcePath(gltfPath: string, uri: string): string {
  const segments = gltfPath.split('/').slice(0, -1);
  for (const segment of percentDecoded(uri).split('/')) {
    if (segment === '..') segments.pop();
    else if (segment !== '.') segments.push(segment);
  }
  return segments.join('/');
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

/**
 * `json` as a GLB: every buffer and every image with a `uri` moves into the one
 * binary chunk, and the buffer views point into it. `readUri` reads a non-data URI and
 * throws when it cannot. The input is not changed.
 */
export async function packGltfAsGlb(
  json: GltfJson,
  readUri: (uri: string) => Promise<ArrayBuffer>
): Promise<ArrayBuffer> {
  const read = async (uri: string): Promise<Uint8Array> =>
    uri.startsWith('data:') ? dataUriBytes(uri) : new Uint8Array(await readUri(uri));
  const chunk = new BinaryChunk();
  const bufferOffsets: number[] = [];
  for (const buffer of json.buffers ?? []) {
    bufferOffsets.push(buffer.uri === undefined ? chunk.length : chunk.append(await read(buffer.uri)));
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
