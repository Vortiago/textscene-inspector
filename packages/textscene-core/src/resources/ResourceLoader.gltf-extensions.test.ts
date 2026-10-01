/**
 * `ResourceLoader`'s `gltfExtensions` option reaches every GLB it loads. Its default reads a
 * file as Godot's importer does. The rules themselves are tested in `formats/glb/`.
 */
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { ResourceLoader, type ResourceLoaderOptions } from './ResourceLoader';
import { FileEventBus } from './FileEventBus';
import { containsInstancedMesh, instancedGlbProvider, loadInstancedGlb } from './formats/glb/testing/loadGlb';

function load(options?: ResourceLoaderOptions): Promise<THREE.Object3D> {
  const provider = instancedGlbProvider();
  const loader = new ResourceLoader(new FileEventBus(provider), options);
  loader.setProvider(provider);
  return loadInstancedGlb(loader);
}

describe('ResourceLoader gltfExtensions', () => {
  it('reads a GLB as Godot’s importer does by default', async () => {
    expect(containsInstancedMesh(await load())).toBe(false);
  });

  it('reads every extension three reads under three-loader', async () => {
    expect(containsInstancedMesh(await load({ gltfExtensions: 'three-loader' }))).toBe(true);
  });
});
