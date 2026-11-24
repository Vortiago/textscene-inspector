import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { act } from '@testing-library/react';
import { createTextureFromBuffer } from './formats/image/textureProcessing';
import { createResourcePipeline } from './createResourcePipeline';
import { EditableProvider, expectShown, mountProbe } from './testing/hotReloadHarness';

vi.mock('./formats/image/textureProcessing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./formats/image/textureProcessing')>();
  return { ...actual, createTextureFromBuffer: vi.fn() };
});

// happy-dom decodes no image, so the decode names the texture after the file's first byte.
vi.mocked(createTextureFromBuffer).mockImplementation(async (data: ArrayBuffer) => {
  const texture = new THREE.Texture();
  texture.name = String(new Uint8Array(data)[0]);
  return texture;
});

const TEXTURE_PATH = 'res://icon.png';
const png = (firstByte: number) => new Uint8Array([firstByte, 0, 0, 0]).buffer;

describe('createResourcePipeline with a provider that watches', () => {
  it('shows a mounted texture consumer the new file when the provider says it changed', async () => {
    const provider = new EditableProvider();
    provider.write(TEXTURE_PATH, png(1));
    const pipeline = createResourcePipeline(provider);
    pipeline.hold();
    const shown = mountProbe<THREE.Texture>(pipeline.loader, {
      path: TEXTURE_PATH,
      type: 'texture',
      read: (texture) => texture.name,
    });
    await expectShown(shown, '1');

    provider.write(TEXTURE_PATH, png(2));
    act(() => provider.changed(TEXTURE_PATH));

    await expectShown(shown, '2');
  });

  it('watches once for two holds, and stops at the last release', () => {
    const provider = new EditableProvider();
    const pipeline = createResourcePipeline(provider);
    const releaseFirst = pipeline.hold();
    const releaseSecond = pipeline.hold();
    expect(provider.watcherCount()).toBe(1);

    releaseFirst();
    releaseFirst();
    expect(provider.watcherCount()).toBe(1);

    releaseSecond();
    expect(provider.watcherCount()).toBe(0);
  });

  it('watches again when a view holds it after the last release, as a StrictMode remount does', () => {
    const provider = new EditableProvider();
    const pipeline = createResourcePipeline(provider);
    pipeline.hold()();

    pipeline.hold();

    expect(provider.watcherCount()).toBe(1);
  });
});
