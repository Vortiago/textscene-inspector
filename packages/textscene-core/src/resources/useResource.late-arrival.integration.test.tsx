/**
 * The late-arrival flow over `scenes/fixtures/test-multiple-meshes-shared-texture.tscn`: a stub per
 * MeshInstance3D calls `useResource` for its path, every file starts missing, and a file provided
 * later turns only the meshes that depend on it `'loaded'`.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as THREE from 'three';

import { TscnParser } from '../parser/TscnParser';
import type { TscnScene } from '../parser/types';
import { ResourceLoader } from './ResourceLoader';
import { FileEventBus } from './FileEventBus';
import type { ResourceProvider } from './ResourceProvider';
import { useResource } from './useResource';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import { initGlbModules } from './processing/glbProcessing';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURE_PATH = resolve(
  __dirname,
  '../../../../scenes/fixtures/test-multiple-meshes-shared-texture.tscn'
);

/** A ResourceProvider whose host gains a missing file partway through the test. */
class MockProvider implements ResourceProvider {
  private files = new Map<string, ArrayBuffer | string>();

  setFile(path: string, data: ArrayBuffer | string): void {
    this.files.set(path, data);
  }

  removeFile(path: string): void {
    this.files.delete(path);
  }

  async loadResource(path: string): Promise<ArrayBuffer | string | null> {
    if (this.files.has(path)) {
      return this.files.get(path)!;
    }
    return null;
  }
}

/** A hand-built 1x1 red PNG. The tests read only the status transition, never the pixels. */
const RED_PIXEL_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02,
  0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44,
  0x41, 0x54, 0x08, 0x99, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x00, 0x03, 0x00,
  0x01, 0x5b, 0xae, 0x33, 0xea, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
  0xae, 0x42, 0x60, 0x82,
]).buffer;

/** Reports its hook result in a test-id div, so no real <Canvas> mounts. */
function MeshStub(props: { path: string; resourcePath: string }) {
  const result = useResource<THREE.Texture>(props.resourcePath, 'texture');
  return (
    <div data-testid={`mesh-${props.path}`} data-status={result.status}>
      {result.status === 'loaded' ? 'has-texture' : `no-texture (${result.status})`}
    </div>
  );
}

// GLBMesh hooks call cloneWithMaterials, which requires SkeletonUtils to be
// lazily loaded first. Initialise once for the whole test file.
beforeAll(async () => {
  await initGlbModules();
});

describe('useResource late-arrival integration', () => {
  let parser: TscnParser;
  let scene: TscnScene;
  let provider: MockProvider;
  let fileEventBus: FileEventBus;
  let loader: ResourceLoader;

  beforeEach(() => {
    parser = new TscnParser();
    const content = readFileSync(FIXTURE_PATH, 'utf-8');
    scene = parser.parse(content);

    provider = new MockProvider();
    fileEventBus = new FileEventBus(provider);
    loader = new ResourceLoader(fileEventBus);
    loader.setProvider(provider);
    // Register the scene's external resources with the loader (production wiring).
    for (const ext of scene.externalResources) {
      loader.register(ext);
    }
  });

  it('HARD GATE: missing -> loaded transitions only the meshes that depend on the late-arriving file', async () => {
    const sharedPath = 'res://textures/shared.png';
    const differentPath = 'res://textures/different.png';

    // Fixture guard: the stubs request these textures by path, so the fixture
    // must declare both as external resources. Fail loudly if the fixture drifts
    // rather than passing green against a scenario it no longer matches.
    const declaredPaths = new Set(scene.externalResources.map((r) => r.path));
    expect(declaredPaths.has(sharedPath)).toBe(true);
    expect(declaredPaths.has(differentPath)).toBe(true);

    // The host has neither file yet, so every consumer lands in `'unavailable'`.
    const { getByTestId } = render(
      <ResourceLoaderProvider loader={loader}>
        <MeshStub path="Mesh1" resourcePath={sharedPath} />
        <MeshStub path="Mesh2" resourcePath={sharedPath} />
        <MeshStub path="Mesh3" resourcePath={differentPath} />
      </ResourceLoaderProvider>
    );

    // `request()` routes through the async FileEventBus.loadAsync, so a 50 ms wait lets the
    // failures settle before the missing state is read.
    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 50));
    });

    expect(getByTestId('mesh-Mesh1').dataset.status).toBe('unavailable');
    expect(getByTestId('mesh-Mesh2').dataset.status).toBe('unavailable');
    expect(getByTestId('mesh-Mesh3').dataset.status).toBe('unavailable');

    // happy-dom has no image decoder, so this does what provideFile and a real decode do: clear
    // the failed cache, then emit `texture:loaded` with a fake texture. Under test is the bus
    // subscription.
    provider.setFile(sharedPath, RED_PIXEL_PNG);
    const fakeTexture = new THREE.Texture();
    fakeTexture.name = 'fake-shared';
    await act(async () => {
      loader.textures.clearCache(sharedPath);
      loader.eventBus.emit('texture', 'loaded', sharedPath, fakeTexture);
      await new Promise<void>((r) => setTimeout(r, 20));
    });

    // Mesh3 depends on `different.png`, which the host has not provided.
    expect(getByTestId('mesh-Mesh1').dataset.status).toBe('loaded');
    expect(getByTestId('mesh-Mesh2').dataset.status).toBe('loaded');
    expect(getByTestId('mesh-Mesh3').dataset.status).toBe('unavailable');
  });
});
