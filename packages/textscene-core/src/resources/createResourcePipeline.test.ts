/** createResourcePipeline wires a host ResourceProvider in: FileEventBus, then ResourceLoader, then setProvider. */
import { describe, it, expect } from 'vitest';
import { createResourcePipeline } from './createResourcePipeline';
import { ResourceLoader } from './ResourceLoader';
import type { ResourceProvider } from './ResourceProvider';
import * as THREE from 'three';
import { triangleGlb } from './formats/glb/testing/triangleGlb';

const fakeProvider: ResourceProvider = {
  loadResource: async () => null,
};

describe('createResourcePipeline', () => {
  it('returns a ResourceLoader wired to the given provider', () => {
    const { provider, loader } = createResourcePipeline(fakeProvider);

    expect(provider).toBe(fakeProvider);
    expect(loader).toBeInstanceOf(ResourceLoader);
    expect(loader.getProvider()).toBe(fakeProvider);
  });

  it('builds a loader with its processor accessors ready', () => {
    const { loader } = createResourcePipeline(fakeProvider);

    expect(loader.textures).toBeDefined();
    expect(loader.scenes).toBeDefined();
  });

  it('hands its options to the loader', async () => {
    const path = 'res://crowd.glb';
    const asset = triangleGlb({ extensionsUsed: ['EXT_mesh_gpu_instancing'], instanced: true });
    const { loader } = createResourcePipeline(
      { loadResource: async (requested: string) => (requested === path ? asset : null) },
      { gltfExtensions: 'three-loader' }
    );
    const loaded = loader.eventBus.once<THREE.Object3D>('glb', 'loaded', path, 5000);
    loader.glbMeshes.request(path);
    const root = await loaded;
    expect(root.children.some((child) => (child as THREE.InstancedMesh).isInstancedMesh)).toBe(true);
  });
});
