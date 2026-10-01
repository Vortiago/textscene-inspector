import { describe, expect, it } from 'vitest';
import { gltfResourcePath, packGltfAsGlb, type GltfJson } from './gltfResources';

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

/** The JSON and the BIN chunk of a GLB, after checking its framing. */
function unpack(glb: ArrayBuffer): { json: GltfJson; bin: Uint8Array } {
  const view = new DataView(glb);
  expect(view.getUint32(0, true)).toBe(GLB_MAGIC);
  expect(view.getUint32(4, true)).toBe(2);
  expect(view.getUint32(8, true)).toBe(glb.byteLength);
  const jsonLength = view.getUint32(12, true);
  expect(view.getUint32(16, true)).toBe(JSON_CHUNK);
  expect(jsonLength % 4).toBe(0);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, jsonLength))) as GltfJson;
  const binStart = 20 + jsonLength;
  const binLength = view.getUint32(binStart, true);
  expect(view.getUint32(binStart + 4, true)).toBe(BIN_CHUNK);
  expect(binLength % 4).toBe(0);
  return { json, bin: new Uint8Array(glb, binStart + 8, binLength) };
}

const bytes = (...values: number[]) => new Uint8Array(values).buffer;

function reader(files: Record<string, ArrayBuffer>) {
  const read: string[] = [];
  return {
    read,
    readUri: async (uri: string) => {
      read.push(uri);
      const file = files[uri];
      if (!file) throw new Error(`no file ${uri}`);
      return file;
    },
  };
}

describe('gltfResourcePath', () => {
  it('resolves a URI against the glTF’s own directory', () => {
    expect(gltfResourcePath('res://town/lamp/scene.gltf', 'scene.bin')).toBe('res://town/lamp/scene.bin');
  });

  it('decodes a percent-encoded URI', () => {
    expect(gltfResourcePath('res://town/model.gltf', 'textures%2Fgrass%20lossy.webp')).toBe(
      'res://town/textures/grass lossy.webp'
    );
  });

  it('keeps a URI with a malformed escape as written', () => {
    expect(gltfResourcePath('res://town/model.gltf', 'grass%zz.webp')).toBe('res://town/grass%zz.webp');
  });

  it('follows a parent-directory segment', () => {
    expect(gltfResourcePath('res://town/lamp/scene.gltf', '../shared/palette.png')).toBe(
      'res://town/shared/palette.png'
    );
  });
});

describe('packGltfAsGlb', () => {
  it('moves an external buffer into the binary chunk and points its views at it', async () => {
    const { readUri } = reader({ 'scene.bin': bytes(1, 2, 3, 4, 5, 6, 7, 8) });
    const json: GltfJson = {
      asset: { version: '2.0' },
      buffers: [{ uri: 'scene.bin', byteLength: 8 }],
      bufferViews: [{ buffer: 0, byteOffset: 4, byteLength: 4 }],
    };

    const { json: packed, bin } = unpack(await packGltfAsGlb(json, readUri));

    expect(packed.buffers).toEqual([{ byteLength: 8 }]);
    expect(packed.bufferViews).toEqual([{ buffer: 0, byteOffset: 4, byteLength: 4 }]);
    expect([...bin.slice(4, 8)]).toEqual([5, 6, 7, 8]);
  });

  it('lays two buffers out one after the other, each starting four-byte aligned', async () => {
    const { readUri } = reader({ 'a.bin': bytes(1, 2, 3), 'b.bin': bytes(9, 9) });
    const json: GltfJson = {
      asset: { version: '2.0' },
      buffers: [
        { uri: 'a.bin', byteLength: 3 },
        { uri: 'b.bin', byteLength: 2 },
      ],
      bufferViews: [
        { buffer: 0, byteLength: 3 },
        { buffer: 1, byteOffset: 1, byteLength: 1 },
      ],
    };

    const { json: packed, bin } = unpack(await packGltfAsGlb(json, readUri));

    expect(packed.bufferViews).toEqual([
      { buffer: 0, byteOffset: 0, byteLength: 3 },
      { buffer: 0, byteOffset: 5, byteLength: 1 },
    ]);
    expect(bin[5]).toBe(9);
  });

  it('turns an external image into a buffer view with its MIME type', async () => {
    const { readUri } = reader({ 'textures/palette.png': bytes(0x89, 0x50) });
    const json: GltfJson = { asset: { version: '2.0' }, images: [{ uri: 'textures/palette.png' }] };

    const { json: packed, bin } = unpack(await packGltfAsGlb(json, readUri));

    expect(packed.images).toEqual([{ bufferView: 0, mimeType: 'image/png' }]);
    expect(packed.bufferViews).toEqual([{ buffer: 0, byteOffset: 0, byteLength: 2 }]);
    expect([...bin.slice(0, 2)]).toEqual([0x89, 0x50]);
  });

  it('decodes a data URI itself and reads no file for it', async () => {
    const { readUri, read } = reader({});
    const json: GltfJson = {
      asset: { version: '2.0' },
      buffers: [{ uri: 'data:application/octet-stream;base64,AQID', byteLength: 3 }],
      bufferViews: [{ buffer: 0, byteLength: 3 }],
    };

    const { bin } = unpack(await packGltfAsGlb(json, readUri));

    expect([...bin.slice(0, 3)]).toEqual([1, 2, 3]);
    expect(read).toEqual([]);
  });

  it('keeps an image that already lives in a buffer view as it is', async () => {
    const { readUri } = reader({ 'scene.bin': bytes(1, 2, 3, 4) });
    const json: GltfJson = {
      asset: { version: '2.0' },
      buffers: [{ uri: 'scene.bin', byteLength: 4 }],
      bufferViews: [{ buffer: 0, byteLength: 4 }],
      images: [{ bufferView: 0, mimeType: 'image/png' }],
    };

    const { json: packed } = unpack(await packGltfAsGlb(json, readUri));

    expect(packed.images).toEqual([{ bufferView: 0, mimeType: 'image/png' }]);
  });

  it('fails naming the file it could not read', async () => {
    const { readUri } = reader({});
    const json: GltfJson = { asset: { version: '2.0' }, buffers: [{ uri: 'gone.bin', byteLength: 4 }] };

    await expect(packGltfAsGlb(json, readUri)).rejects.toThrow('gone.bin');
  });
});
