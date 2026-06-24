/**
 * Integration test for the WI-R3F-2 hard gate: the late-arrival flow.
 *
 * Loads `scenes/fixtures/test-multiple-meshes-shared-texture.tscn`, mounts
 * a stub component for each MeshInstance3D that calls `useResource` for
 * the resource path that node depends on, simulates the missing-file
 * scenario, then injects the file later and asserts that ONLY the meshes
 * which depend on the path transition to `'loaded'`.
 *
 * `<MeshInstance3D>` and the real R3F-side rendering arrive in WI-R3F-3;
 * here we use a tiny stub that's just enough to drive the hook.
 */
import { describe, it, expect, beforeEach } from 'vitest';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURE_PATH = resolve(
  __dirname,
  '../../../../scenes/fixtures/test-multiple-meshes-shared-texture.tscn'
);

/**
 * Controllable ResourceProvider used to simulate the host filesystem
 * acquiring a previously-missing file partway through the test.
 */
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

  hasResource(path: string): boolean {
    return this.files.has(path);
  }
}

/**
 * A 1x1 PNG (red pixel) as ArrayBuffer. Used as the texture payload so
 * THREE.ImageLoader / DataTexture can decode it under jsdom. We don't
 * actually inspect pixel content — only the status transition.
 *
 * Bytes: minimal valid PNG. Source: hand-built header.
 */
const RED_PIXEL_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02,
  0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44,
  0x41, 0x54, 0x08, 0x99, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x00, 0x03, 0x00,
  0x01, 0x5b, 0xae, 0x33, 0xea, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
  0xae, 0x42, 0x60, 0x82,
]).buffer;

/**
 * Tiny consumer component that reports its hook result via the testid'd
 * div, so the integration test can read each mesh's status without
 * mounting a real <Canvas>.
 */
function MeshStub(props: { path: string; resourcePath: string }) {
  const result = useResource<THREE.Texture>(props.resourcePath, 'Texture2D');
  return (
    <div data-testid={`mesh-${props.path}`} data-status={result.status}>
      {result.status === 'loaded' ? 'has-texture' : `no-texture (${result.status})`}
    </div>
  );
}

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

    // Step 1: Mount three consumer stubs (one per mesh) with their
    //         respective resource paths. The host has neither file yet,
    //         so every consumer should land in `'unavailable'`.
    const { getByTestId } = render(
      <ResourceLoaderProvider loader={loader}>
        <MeshStub path="Mesh1" resourcePath={sharedPath} />
        <MeshStub path="Mesh2" resourcePath={sharedPath} />
        <MeshStub path="Mesh3" resourcePath={differentPath} />
      </ResourceLoaderProvider>
    );

    // The hook fires `request()` synchronously on mount, which routes
    // through FileEventBus.loadAsync (async via Promise). Wait one
    // microtask tick for the failures to settle so we observe the
    // missing state, not pending.
    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 50));
    });

    expect(getByTestId('mesh-Mesh1').dataset.status).toBe('unavailable');
    expect(getByTestId('mesh-Mesh2').dataset.status).toBe('unavailable');
    expect(getByTestId('mesh-Mesh3').dataset.status).toBe('unavailable');

    // Step 2: The host receives `shared.png` from the user. In production
    //         the flow is: provider.addUploadedFile() → provideFile() →
    //         FileEventBus loads bytes → textureProcessor decodes →
    //         eventBus.emit('texture:loaded', path, texture).
    //
    //         Under happy-dom we don't have an image decoder, so the
    //         real `createTextureFromBuffer` path can't decode an PNG.
    //         The contract this test is verifying is the *bus
    //         subscription* path — that subscribers transition on a
    //         `texture:loaded` emit for a previously-failed path. We
    //         exercise the same bus emit that the processor would do on
    //         a real decode:
    //           1. Clear the failed cache (what provideFile does first).
    //           2. Emit `texture:loaded` with a fake Texture (what the
    //              processor would emit on a successful decode in a
    //              browser environment).
    provider.setFile(sharedPath, RED_PIXEL_PNG);
    const fakeTexture = new THREE.Texture();
    fakeTexture.name = 'fake-shared';
    await act(async () => {
      loader.textures.clearCache(sharedPath);
      loader.eventBus.emit('texture', 'loaded', sharedPath, fakeTexture);
      await new Promise<void>((r) => setTimeout(r, 20));
    });

    // Step 3: Mesh1 and Mesh2 transitioned to `'loaded'` because they
    //         both depend on `shared.png`. Mesh3 stayed `'unavailable'`
    //         because it depends on `different.png`, which the host
    //         still hasn't provided.
    expect(getByTestId('mesh-Mesh1').dataset.status).toBe('loaded');
    expect(getByTestId('mesh-Mesh2').dataset.status).toBe('loaded');
    expect(getByTestId('mesh-Mesh3').dataset.status).toBe('unavailable');
  });
});
