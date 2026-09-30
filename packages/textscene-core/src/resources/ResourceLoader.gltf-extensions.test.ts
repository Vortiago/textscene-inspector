/**
 * `ResourceLoader`'s `gltfExtensions` option reaches every GLB it loads. Its default reads a
 * file as Godot's importer does. The rules themselves are tested in `formats/glb/`.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ResourceLoader, type ResourceLoaderOptions } from './ResourceLoader';
import { FileEventBus } from './FileEventBus';
import { triangleGlb } from './formats/glb/testing/triangleGlb';

const GLB_PATH = 'res://props/crowd.glb';

async function loadInstancedGlb(options?: ResourceLoaderOptions): Promise<THREE.Object3D> {
  const asset = triangleGlb({ extensionsUsed: ['EXT_mesh_gpu_instancing'], instanced: true });
  const provider = { loadResource: async (path: string) => (path === GLB_PATH ? asset : null) };
  const loader = new ResourceLoader(new FileEventBus(provider), options);
  loader.setProvider(provider);
  const loaded = loader.eventBus.once<THREE.Object3D>('glb', 'loaded', GLB_PATH, 5000);
  loader.glbMeshes.request(GLB_PATH);
  return loaded;
}

function isInstanced(root: THREE.Object3D): boolean {
  let instanced = false;
  root.traverse((node) => {
    if ((node as THREE.InstancedMesh).isInstancedMesh) instanced = true;
  });
  return instanced;
}

describe('ResourceLoader gltfExtensions', () => {
  it('reads a GLB as Godot’s importer does by default', async () => {
    expect(isInstanced(await loadInstancedGlb())).toBe(false);
  });

  it('reads every extension three reads under three-loader', async () => {
    expect(isInstanced(await loadInstancedGlb({ gltfExtensions: 'three-loader' }))).toBe(true);
  });
});
