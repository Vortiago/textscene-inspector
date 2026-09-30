/** createResourcePipeline wires a host ResourceProvider in: FileEventBus, then ResourceLoader, then setProvider. */
import { describe, it, expect } from 'vitest';
import { createResourcePipeline } from './createResourcePipeline';
import { ResourceLoader } from './ResourceLoader';
import type { ResourceProvider } from './ResourceProvider';
import {
  containsInstancedMesh,
  instancedGlbProvider,
  loadInstancedGlb,
} from './formats/glb/testing/loadGlb';

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
    const { loader } = createResourcePipeline(instancedGlbProvider(), { gltfExtensions: 'three-loader' });
    expect(containsInstancedMesh(await loadInstancedGlb(loader))).toBe(true);
  });
});
