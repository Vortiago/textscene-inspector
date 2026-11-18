import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FileEventBus } from '../FileEventBus';
import { ResourceEventBus } from '../ResourceEventBus';
import { DependencyGraph } from '../dependencyGraph';
import { decodeImagePixels } from '../formats/image/textureProcessing';
import { createCubemapProcessor } from './createCubemapProcessor';

vi.mock('../formats/image/textureProcessing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../formats/image/textureProcessing')>();
  return { ...actual, decodeImagePixels: vi.fn() };
});

const decode = vi.mocked(decodeImagePixels);

const PNG_PATH = 'res://sky/skybox.png';
const SIDECAR_PATH = `${PNG_PATH}.import`;
const SIDECAR = '[remap]\n\nimporter="cubemap_texture"\n\n[params]\n\nslices/arrangement=1\n';

/** A 2x3 image of one texel a face, whose reds count up, so each face's texel names it. */
const PIXELS = {
  data: Uint8Array.from({ length: 6 * 4 }, (_, index) => (index % 4 === 0 ? (index / 4 + 1) * 10 : 255)),
  width: 2,
  height: 3,
};

function harness(files: Record<string, ArrayBuffer | string>) {
  const fileEventBus = new FileEventBus({
    loadResource: vi.fn(async (path: string) => files[path] ?? null),
  });
  const eventBus = new ResourceEventBus();
  const dependencies = new DependencyGraph();
  const processor = createCubemapProcessor(fileEventBus, eventBus, dependencies);
  const load = (): Promise<THREE.CubeTexture> => {
    const settled = new Promise<THREE.CubeTexture>((resolve, reject) => {
      eventBus.on<THREE.CubeTexture>('cubemap', 'loaded', (_path, texture) => resolve(texture!));
      eventBus.on<Error>('cubemap', 'failed', (_path, error) => reject(error!));
    });
    processor.request(PNG_PATH);
    return settled;
  };
  return { load, dependencies };
}

const bytes = (): ArrayBuffer => new Uint8Array([1, 2, 3]).buffer;

describe('createCubemapProcessor', () => {
  beforeEach(() => {
    decode.mockReset();
    decode.mockResolvedValue(PIXELS);
  });

  it('cuts the image into the faces its sidecar arranges, left to right then down', async () => {
    const texture = await harness({ [PNG_PATH]: bytes(), [SIDECAR_PATH]: SIDECAR }).load();
    expect(texture).toBeInstanceOf(THREE.CubeTexture);
    const faces = texture.image as THREE.DataTexture[];
    expect(faces.map((face) => (face.image.data as Uint8Array)[0])).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it('records the sidecar read, so a change to the sidecar reloads the texture', async () => {
    const { load, dependencies } = harness({ [PNG_PATH]: bytes(), [SIDECAR_PATH]: SIDECAR });
    await load();
    expect(dependencies.release(SIDECAR_PATH)).toEqual([{ busType: 'cubemap', key: PNG_PATH }]);
  });

  it('fails an image with no sidecar, which Godot imports as no cubemap', async () => {
    await expect(harness({ [PNG_PATH]: bytes() }).load()).rejects.toThrow('as a cubemap');
    expect(decode).not.toHaveBeenCalled();
  });

  it('names the arrangement Godot cannot cut, past 6x1, in its error (edge case)', async () => {
    const sidecar = SIDECAR.replace('slices/arrangement=1', 'slices/arrangement=4');
    await expect(harness({ [PNG_PATH]: bytes(), [SIDECAR_PATH]: sidecar }).load()).rejects.toThrow(
      'with slices Godot can cut'
    );
  });

  it('fails an image too small for its faces (edge case)', async () => {
    const sidecar = SIDECAR.replace('slices/arrangement=1', 'slices/arrangement=3');
    await expect(harness({ [PNG_PATH]: bytes(), [SIDECAR_PATH]: sidecar }).load()).rejects.toThrow(
      'too small for six faces of 6x1'
    );
  });
});
