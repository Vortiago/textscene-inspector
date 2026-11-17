import { describe, expect, it } from 'vitest';
import { Data3DTexture, DataArrayTexture, DataTexture, RGFormat, type Texture } from 'three';
import { uploadLevels } from './levelUpload.js';

interface Copy {
  readonly source: Texture;
  readonly target: Texture;
  readonly level: number;
}

/** A renderer that records each `copyTextureToTexture` it is asked for. */
function recordingRenderer(): { copies: Copy[]; renderer: Parameters<typeof uploadLevels>[0] } {
  const copies: Copy[] = [];
  const renderer = {
    isWebGLRenderer: true,
    copyTextureToTexture: (
      source: Texture,
      target: Texture,
      _region: null,
      _at: null,
      _from: number,
      level = 0
    ) => copies.push({ source, target, level }),
  };
  return { copies, renderer: renderer as unknown as Parameters<typeof uploadLevels>[0] };
}

function volumeWithLevels(): Data3DTexture {
  const volume = new Data3DTexture(new Uint8Array(4 * 64), 4, 4, 4);
  volume.mipmaps = [4, 2, 1].map((size) => ({
    data: new Uint8Array(4 * size ** 3),
    width: size,
    height: size,
    depth: size,
  })) as never;
  return volume;
}

describe('uploadLevels', () => {
  it('copies each level after the first of a 3D texture into that level', () => {
    const { copies, renderer } = recordingRenderer();
    const volume = volumeWithLevels();
    uploadLevels(renderer, volume);
    expect(copies.map(({ level, target }) => [level, target === volume])).toEqual([
      [1, true],
      [2, true],
    ]);
    expect(copies.map(({ source }) => (source.image as { depth: number }).depth)).toEqual([2, 1]);
  });

  it('copies a 2D array level with every layer, in any format', () => {
    const { copies, renderer } = recordingRenderer();
    const layers = new DataArrayTexture(new Uint8Array(2 * 16 * 3), 4, 4, 3);
    layers.format = RGFormat;
    layers.mipmaps = [4, 2, 1].map((size) => ({
      data: new Uint8Array(2 * size * size * 3),
      width: size,
      height: size,
    }));
    uploadLevels(renderer, layers);
    expect(copies.map(({ source }) => (source.image as { depth: number }).depth)).toEqual([3, 3]);
  });

  it('copies the levels once for each version of the texture', () => {
    const { copies, renderer } = recordingRenderer();
    const volume = volumeWithLevels();
    uploadLevels(renderer, volume);
    uploadLevels(renderer, volume);
    volume.needsUpdate = true;
    uploadLevels(renderer, volume);
    expect(copies).toHaveLength(4);
  });

  it('copies nothing for a texture of one level or a 2D texture', () => {
    const { copies, renderer } = recordingRenderer();
    uploadLevels(renderer, new Data3DTexture(new Uint8Array(4), 1, 1, 1));
    const flat = new DataTexture(new Uint8Array(16), 2, 2);
    flat.mipmaps = [
      { data: new Uint8Array(16), width: 2, height: 2 },
      { data: new Uint8Array(4), width: 1, height: 1 },
    ] as never;
    uploadLevels(renderer, flat);
    expect(copies).toHaveLength(0);
  });

  it('copies nothing on a renderer that is not WebGL', () => {
    const { copies, renderer } = recordingRenderer();
    (renderer as unknown as { isWebGLRenderer: boolean }).isWebGLRenderer = false;
    uploadLevels(renderer, volumeWithLevels());
    expect(copies).toHaveLength(0);
  });
});
