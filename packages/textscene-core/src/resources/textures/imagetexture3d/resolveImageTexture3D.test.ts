/** An ImageTexture3D whose slices sit in inline `Image` sub-resources, as Godot saves one. */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { resetProceduralTextures } from '../proceduralBuilds';
import type { SavedImage } from '../image/kind';
import { imageTexture3D } from './resolveImageTexture3D';

/** A 2 x 1 Image of `format` that saves `bytes`. */
function image(format: string, bytes: string): SavedImage {
  return {
    dictionary: `{\n"data": PackedByteArray(${bytes}),\n"format": "${format}",\n"height": 1,\n"mipmaps": false,\n"width": 2\n}`,
  };
}

const VOLUME = { form: 'image', images: [image('Lum8', '63, 63'), image('Lum8', '127, 127')] } as const;
const HALF = { form: 'image', images: [image('RHalf', '0, 64, 0, 60')] } as const;

afterEach(() => {
  resetProceduralTextures();
});

describe('imageTexture3D', () => {
  it('stacks the saved slices into a volume, rows from the top', () => {
    const texture = imageTexture3D(VOLUME)?.texture;
    expect(texture).toBeInstanceOf(THREE.Data3DTexture);
    expect(texture!.image).toMatchObject({ width: 2, height: 1, depth: 2 });
    expect([...(texture!.image.data as Uint8Array)].filter((_, i) => i % 4 === 0)).toEqual([
      63, 63, 127, 127,
    ]);
  });

  it('keeps the raw values of a half-float volume in a half-float texture', () => {
    const texture = imageTexture3D(HALF)!.texture;
    expect(texture.type).toBe(THREE.HalfFloatType);
    expect(Array.from(texture.image.data as Uint16Array, THREE.DataUtils.fromHalfFloat)).toEqual([
      2, 0, 0, 1, 1, 0, 0, 1,
    ]);
  });
});
