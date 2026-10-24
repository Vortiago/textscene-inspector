/**
 * The image2darray slice's loader-facing adapter (ADR-0031): it reads the atlas's Import sidecar
 * and cuts the decoded OpenEXR or PNG image into the layers it names, as a lightmap bake lays them
 * out. happy-dom decodes no PNG, so the pixel decode of a PNG is faked.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FileEventBus } from '../FileEventBus';
import { ResourceEventBus } from '../ResourceEventBus';
import { DependencyGraph } from '../dependencyGraph';
import { decodeImagePixels } from '../formats/image/textureProcessing';
import { smallExrBytes } from '../testing/smallExr';
import { createTexture2DArrayProcessor } from './createTexture2DArrayProcessor';

vi.mock('../formats/image/textureProcessing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../formats/image/textureProcessing')>();
  return { ...actual, decodeImagePixels: vi.fn() };
});

const decodePng = vi.mocked(decodeImagePixels);

const ATLAS_PATH = 'res://bake.exr';
const ATLAS_WIDTH = 8;
const ATLAS_HEIGHT = 4;
/** A half-float texel Godot reads back exactly, at column 3 of the row second from the bottom. */
const MARKED_TEXEL = [0.2568359375, 0.13037109375, 0.10784912109375, 1] as const;

/** An atlas that is black except for the marked texel. */
const atlasBytes = () =>
  smallExrBytes(ATLAS_WIDTH, ATLAS_HEIGHT, (x, y) => (x === 3 && y === 1 ? MARKED_TEXEL : [0, 0, 0, 1]));
const SIDECAR_PATH = `${ATLAS_PATH}.import`;
const MASK_PATH = 'res://bake_shadow.png';

/** The sidecar a bake writes (`lightmap_gi.cpp:847-866`), with `vertical` layers stacked down the image. */
const sidecar = (vertical: number) =>
  `[remap]\n\nimporter="2d_array_texture"\n\n[params]\n\nslices/horizontal=1\nslices/vertical=${vertical}\n`;

function harness(files: Record<string, ArrayBuffer | string>, atlasPath = ATLAS_PATH) {
  const fileEventBus = new FileEventBus({
    loadResource: vi.fn(async (path: string) => files[path] ?? null),
  });
  const eventBus = new ResourceEventBus();
  const dependencies = new DependencyGraph();
  const processor = createTexture2DArrayProcessor(fileEventBus, eventBus, dependencies);
  const load = (): Promise<THREE.DataArrayTexture> => {
    const settled = new Promise<THREE.DataArrayTexture>((resolve, reject) => {
      eventBus.on<THREE.DataArrayTexture>('texture2darray', 'loaded', (_path, texture) => resolve(texture!));
      eventBus.on<Error>('texture2darray', 'failed', (_path, error) => reject(error!));
    });
    processor.request(atlasPath);
    return settled;
  };
  return { load, dependencies };
}

describe('createTexture2DArrayProcessor', () => {
  it('cuts the atlas into the layers its sidecar names', async () => {
    const texture = await harness({
      [ATLAS_PATH]: await atlasBytes(),
      [SIDECAR_PATH]: sidecar(2),
    }).load();
    expect(texture).toBeInstanceOf(THREE.DataArrayTexture);
    expect(texture.image).toMatchObject({ width: ATLAS_WIDTH, height: ATLAS_HEIGHT / 2, depth: 2 });
  });

  it('keeps the HDR values as half floats, sampled linearly with no colour conversion', async () => {
    const texture = await harness({
      [ATLAS_PATH]: await atlasBytes(),
      [SIDECAR_PATH]: sidecar(1),
    }).load();
    expect(texture.type).toBe(THREE.HalfFloatType);
    expect(texture.colorSpace).toBe(THREE.NoColorSpace);
    expect(texture.magFilter).toBe(THREE.LinearFilter);
    // The marked texel is second from the bottom, so third from the top.
    const red = (texture.image.data as Uint16Array)[(2 * ATLAS_WIDTH + 3) * 4]!;
    expect(THREE.DataUtils.fromHalfFloat(red)).toBe(MARKED_TEXEL[0]);
  });

  it('records the sidecar read, so a re-bake that changes the layer count reloads the atlas', async () => {
    const { load, dependencies } = harness({
      [ATLAS_PATH]: await atlasBytes(),
      [SIDECAR_PATH]: sidecar(1),
    });
    await load();
    expect(dependencies.release(SIDECAR_PATH)).toEqual([{ busType: 'texture2darray', key: ATLAS_PATH }]);
  });

  it('fails an atlas with no sidecar, which Godot imports as no texture array (error case)', async () => {
    await expect(harness({ [ATLAS_PATH]: await atlasBytes() }).load()).rejects.toThrow('as a texture array');
  });

  it('fails an atlas too small for its layers (edge case)', async () => {
    const files = { [ATLAS_PATH]: await atlasBytes(), [SIDECAR_PATH]: sidecar(4096) };
    await expect(harness(files).load()).rejects.toThrow('too small for 1x4096 layers');
  });
});

describe('createTexture2DArrayProcessor on a PNG', () => {
  /** A 2x4 shadowmask whose reds count up, so each layer's texels name it. */
  const MASK_PIXELS = {
    data: new Uint8Array(Array.from({ length: 8 }, (_, texel) => [(texel + 1) * 30, 0, 0, 255]).flat()),
    width: 2,
    height: 4,
  };

  beforeEach(() => {
    decodePng.mockReset();
    decodePng.mockResolvedValue(MASK_PIXELS);
  });

  it('cuts the PNG into the layers its sidecar names, with the byte values unchanged', async () => {
    const texture = await harness(
      { [MASK_PATH]: new Uint8Array([1, 2, 3]).buffer, [`${MASK_PATH}.import`]: sidecar(2) },
      MASK_PATH
    ).load();
    expect(texture.image).toMatchObject({ width: 2, height: 2, depth: 2 });
    expect([...(texture.image.data as Uint8Array)]).toEqual([30, 60, 90, 120, 150, 180, 210, 240]);
  });

  it('holds the red bytes alone, sampled with no colour conversion', async () => {
    const texture = await harness(
      { [MASK_PATH]: new Uint8Array([1, 2, 3]).buffer, [`${MASK_PATH}.import`]: sidecar(1) },
      MASK_PATH
    ).load();
    expect([texture.format, texture.type]).toEqual([THREE.RedFormat, THREE.UnsignedByteType]);
    expect(texture.colorSpace).toBe(THREE.NoColorSpace);
    expect(texture.premultiplyAlpha).toBe(false);
  });

  it('fails a PNG with no sidecar, which Godot imports as no texture array (error case)', async () => {
    await expect(harness({ [MASK_PATH]: new Uint8Array([1]).buffer }, MASK_PATH).load()).rejects.toThrow(
      'as a texture array'
    );
  });
});
