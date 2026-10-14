/**
 * The image3d slice's loader-facing adapter (ADR-0031): it reads the image's Import sidecar and
 * cuts the decoded pixels into the slices it names. happy-dom decodes no image, so the pixel
 * decode is faked.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FileEventBus } from '../FileEventBus';
import { ResourceEventBus } from '../ResourceEventBus';
import { DependencyGraph } from '../dependencyGraph';
import { decodeImagePixels } from '../formats/image/textureProcessing';
import { createTexture3DProcessor } from './createTexture3DProcessor';

vi.mock('../formats/image/textureProcessing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../formats/image/textureProcessing')>();
  return { ...actual, decodeImagePixels: vi.fn() };
});

const decode = vi.mocked(decodeImagePixels);

const PNG_PATH = 'res://fog/density.png';
const SIDECAR_PATH = `${PNG_PATH}.import`;
const SIDECAR = '[remap]\n\nimporter="3d_texture"\n\n[params]\n\nslices/horizontal=2\nslices/vertical=1\n';

/** A 4x1 image whose reds count up, so each slice's texels name it. */
const PIXELS = {
  data: new Uint8Array([10, 0, 0, 255, 20, 0, 0, 255, 30, 0, 0, 255, 40, 0, 0, 255]),
  width: 4,
  height: 1,
};

function harness(files: Record<string, ArrayBuffer | string>) {
  const fileEventBus = new FileEventBus({
    loadResource: vi.fn(async (path: string) => files[path] ?? null),
  });
  const eventBus = new ResourceEventBus();
  const dependencies = new DependencyGraph();
  const processor = createTexture3DProcessor(fileEventBus, eventBus, dependencies);
  const load = (): Promise<THREE.Data3DTexture> => {
    const settled = new Promise<THREE.Data3DTexture>((resolve, reject) => {
      eventBus.on<THREE.Data3DTexture>('texture3d', 'loaded', (_path, texture) => resolve(texture!));
      eventBus.on<Error>('texture3d', 'failed', (_path, error) => reject(error!));
    });
    processor.request(PNG_PATH);
    return settled;
  };
  return { load, dependencies };
}

const bytes = (): ArrayBuffer => new Uint8Array([1, 2, 3]).buffer;

describe('createTexture3DProcessor', () => {
  beforeEach(() => {
    decode.mockReset();
    decode.mockResolvedValue(PIXELS);
  });

  it('cuts the image into the slices its sidecar names', async () => {
    const texture = await harness({ [PNG_PATH]: bytes(), [SIDECAR_PATH]: SIDECAR }).load();
    expect(texture).toBeInstanceOf(THREE.Data3DTexture);
    expect(texture.image).toMatchObject({ width: 2, height: 1, depth: 2 });
    expect(texture.format).toBe(THREE.RGBAFormat);
    expect([...(texture.image.data as Uint8Array)].filter((_, i) => i % 4 === 0)).toEqual([10, 20, 30, 40]);
  });

  it('records the sidecar read, so a change to the sidecar reloads the texture', async () => {
    const { load, dependencies } = harness({ [PNG_PATH]: bytes(), [SIDECAR_PATH]: SIDECAR });
    await load();
    expect(dependencies.release(SIDECAR_PATH)).toEqual([{ busType: 'texture3d', key: PNG_PATH }]);
  });

  it('fails an image with no sidecar, which Godot imports as no 3D texture', async () => {
    await expect(harness({ [PNG_PATH]: bytes() }).load()).rejects.toThrow('as a 3D texture');
    expect(decode).not.toHaveBeenCalled();
  });

  it('fails an image too small for its slices (edge case)', async () => {
    const sidecar = SIDECAR.replace('slices/horizontal=2', 'slices/horizontal=8');
    await expect(harness({ [PNG_PATH]: bytes(), [SIDECAR_PATH]: sidecar }).load()).rejects.toThrow(
      'too small for 8x1 slices'
    );
  });
});
