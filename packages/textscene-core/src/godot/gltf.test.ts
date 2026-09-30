import { describe, expect, it } from 'vitest';
import {
  gltfRefusalMessage,
  isGltfPath,
  readGltfRequiredExtensions,
  requiredGltfExtensions,
  unsupportedRequiredGltfExtensions,
} from './gltf';

describe('unsupportedRequiredGltfExtensions', () => {
  it('passes a file whose required extensions Godot all imports', () => {
    expect(unsupportedRequiredGltfExtensions(['KHR_texture_transform', 'EXT_texture_webp'])).toEqual([]);
  });

  it('names each required extension Godot does not import', () => {
    expect(
      unsupportedRequiredGltfExtensions(['EXT_mesh_gpu_instancing', 'KHR_texture_transform', 'KHR_draco_mesh_compression'])
    ).toEqual(['EXT_mesh_gpu_instancing', 'KHR_draco_mesh_compression']);
  });

  it('passes a file that requires nothing', () => {
    expect(unsupportedRequiredGltfExtensions([])).toEqual([]);
  });
});

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

/** A GLB container: the 12-byte header, then one chunk of `chunkType` holding `body`. */
function glb(body: string, chunkType = JSON_CHUNK): ArrayBuffer {
  const json = new TextEncoder().encode(body);
  const file = new Uint8Array(20 + json.length);
  const view = new DataView(file.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, file.length, true);
  view.setUint32(12, json.length, true);
  view.setUint32(16, chunkType, true);
  file.set(json, 20);
  return file.buffer;
}

/** A text glTF as a provider hands it over: bytes, since the slice claims `.gltf` as binary. */
const textBytes = (body: string): ArrayBuffer => new TextEncoder().encode(body).buffer;

const REQUIRES_INSTANCING = JSON.stringify({
  asset: { version: '2.0' },
  extensionsUsed: ['EXT_mesh_gpu_instancing'],
  extensionsRequired: ['EXT_mesh_gpu_instancing'],
});

describe('readGltfRequiredExtensions', () => {
  it('reads extensionsRequired from the JSON chunk of a GLB', () => {
    expect(readGltfRequiredExtensions(glb(REQUIRES_INSTANCING))).toEqual(['EXT_mesh_gpu_instancing']);
  });

  it('reads extensionsRequired from the bytes of a text glTF', () => {
    expect(readGltfRequiredExtensions(textBytes(REQUIRES_INSTANCING))).toEqual(['EXT_mesh_gpu_instancing']);
  });

  it('reads extensionsRequired from a text glTF a provider decoded to a string', () => {
    expect(readGltfRequiredExtensions(REQUIRES_INSTANCING)).toEqual(['EXT_mesh_gpu_instancing']);
  });

  it('reads a file as text when it lacks the GLB magic, whatever it is named', () => {
    // `_parse` decides on the first four bytes alone (`gltf_document.cpp:6514-6523`).
    expect(readGltfRequiredExtensions(textBytes(`  ${REQUIRES_INSTANCING}`))).toEqual(['EXT_mesh_gpu_instancing']);
  });

  it('reads the JSON chunk alone, not the chunks after it', () => {
    const json = new Uint8Array(glb(REQUIRES_INSTANCING));
    const bin = new Uint8Array(8);
    new DataView(bin.buffer).setUint32(4, BIN_CHUNK, true);
    const file = new Uint8Array(json.length + bin.length);
    file.set(json);
    file.set(bin, json.length);
    expect(readGltfRequiredExtensions(file.buffer)).toEqual(['EXT_mesh_gpu_instancing']);
  });

  it('gives an empty list for a file that requires nothing', () => {
    expect(readGltfRequiredExtensions(textBytes('{"asset":{"version":"2.0"}}'))).toEqual([]);
  });

  it('gives null for a GLB too short to hold its first chunk header', () => {
    expect(readGltfRequiredExtensions(glb(REQUIRES_INSTANCING).slice(0, 16))).toBeNull();
  });

  it('gives null for a GLB whose first chunk is shorter than its declared length', () => {
    expect(readGltfRequiredExtensions(glb(REQUIRES_INSTANCING).slice(0, 30))).toBeNull();
  });

  it('gives null for a GLB whose first chunk is not JSON', () => {
    expect(readGltfRequiredExtensions(glb(REQUIRES_INSTANCING, BIN_CHUNK))).toBeNull();
  });

  it('gives null for text that is not JSON', () => {
    expect(readGltfRequiredExtensions(textBytes('{"asset": '))).toBeNull();
  });

  it('gives null for JSON that is not an object', () => {
    expect(readGltfRequiredExtensions(textBytes('["EXT_mesh_gpu_instancing"]'))).toBeNull();
  });

  it('gives null for an empty file', () => {
    expect(readGltfRequiredExtensions(new ArrayBuffer(0))).toBeNull();
  });
});

describe('requiredGltfExtensions', () => {
  it('reads each string entry of extensionsRequired as written', () => {
    expect(requiredGltfExtensions({ extensionsRequired: ['EXT_mesh_gpu_instancing', 'KHR_texture_transform'] })).toEqual([
      'EXT_mesh_gpu_instancing',
      'KHR_texture_transform',
    ]);
  });

  it('keeps a non-string entry, which Godot stringifies into a name no importer supports', () => {
    const required = requiredGltfExtensions({ extensionsRequired: ['KHR_texture_transform', 7, null] });
    expect(unsupportedRequiredGltfExtensions(required)).toEqual(['7', 'null']);
  });

  it('gives an empty list where extensionsRequired is absent or not an array', () => {
    expect(requiredGltfExtensions({ asset: { version: '2.0' } })).toEqual([]);
    expect(requiredGltfExtensions({ extensionsRequired: 'EXT_mesh_gpu_instancing' })).toEqual([]);
  });

  it('gives an empty list for a document that is not an object', () => {
    expect(requiredGltfExtensions(null)).toEqual([]);
    expect(requiredGltfExtensions(['EXT_mesh_gpu_instancing'])).toEqual([]);
  });
});

describe('gltfRefusalMessage', () => {
  it('names the one refused extension', () => {
    expect(gltfRefusalMessage(['EXT_mesh_gpu_instancing'])).toBe(
      "required extension 'EXT_mesh_gpu_instancing' is not supported by Godot's glTF importer"
    );
  });

  it('names every refused extension', () => {
    expect(gltfRefusalMessage(['EXT_mesh_gpu_instancing', 'KHR_draco_mesh_compression'])).toBe(
      "required extensions 'EXT_mesh_gpu_instancing', 'KHR_draco_mesh_compression' are not supported by Godot's glTF importer"
    );
  });
});

describe('isGltfPath', () => {
  it('matches .glb and .gltf', () => {
    expect(isGltfPath('model.glb')).toBe(true);
    expect(isGltfPath('res://meshes/rock.gltf')).toBe(true);
  });

  it('matches the extension case-insensitively, as the importer lowers it', () => {
    expect(isGltfPath('MODEL.GLB')).toBe(true);
    expect(isGltfPath('Model.GlTf')).toBe(true);
  });

  it('rejects other extensions and near-misses', () => {
    expect(isGltfPath('model.obj')).toBe(false);
    expect(isGltfPath('model.glbx')).toBe(false);
    expect(isGltfPath('glb.png')).toBe(false);
    expect(isGltfPath('model.gltf.import')).toBe(false);
    expect(isGltfPath('model.glb?v=2')).toBe(false);
    expect(isGltfPath('')).toBe(false);
  });

  it('rejects a name with no extension, even one spelled glb', () => {
    expect(isGltfPath('glb')).toBe(false);
    expect(isGltfPath('some/dir/glb')).toBe(false);
  });
});
