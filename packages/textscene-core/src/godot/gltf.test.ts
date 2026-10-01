import { describe, expect, it } from 'vitest';
import { unsupportedRequiredGltfExtensions } from './gltf';

describe('unsupportedRequiredGltfExtensions', () => {
  it('passes a file whose required extensions Godot all imports', () => {
    expect(unsupportedRequiredGltfExtensions(['KHR_texture_transform', 'EXT_texture_webp'])).toEqual([]);
  });

  it('names each required extension Godot does not import', () => {
    expect(
      unsupportedRequiredGltfExtensions([
        'EXT_mesh_gpu_instancing',
        'KHR_texture_transform',
        'KHR_draco_mesh_compression',
      ])
    ).toEqual(['EXT_mesh_gpu_instancing', 'KHR_draco_mesh_compression']);
  });

  it('passes a file that requires nothing', () => {
    expect(unsupportedRequiredGltfExtensions([])).toEqual([]);
  });
});
