/** An ImageTexture3D whose slices sit in inline `Image` sub-resources, as Godot saves one. */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import { clearProceduralTextureCache } from '../proceduralTextureCache';
import { resolveImageTexture3D } from './resolveImageTexture3D';

function image(id: string, format: string, bytes: string): TscnInternalResource {
  return {
    id,
    type: 'Image',
    data: {
      data: `{\n"data": PackedByteArray(${bytes}),\n"format": "${format}",\n"height": 1,\n"mipmaps": false,\n"width": 2\n}`,
    },
  };
}

const RESOURCES: TscnInternalResource[] = [
  image('Image_a', 'Lum8', '63, 63'),
  image('Image_b', 'Lum8', '127, 127'),
  image('Image_half', 'RHalf', '0, 64, 0, 60'),
  {
    id: 'Volume',
    type: 'ImageTexture3D',
    data: { _images: 'Array[Image]([SubResource("Image_a"), SubResource("Image_b")])' },
  },
  {
    id: 'Half',
    type: 'ImageTexture3D',
    data: { _images: 'Array[Image]([SubResource("Image_half")])' },
  },
];

afterEach(() => {
  clearProceduralTextureCache();
});

describe('resolveImageTexture3D', () => {
  it('stacks the saved slices into a volume, rows from the top', () => {
    const texture = resolveImageTexture3D('SubResource("Volume")', RESOURCES)?.texture;
    expect(texture).toBeInstanceOf(THREE.Data3DTexture);
    expect(texture!.image).toMatchObject({ width: 2, height: 1, depth: 2 });
    expect([...(texture!.image.data as Uint8Array)].filter((_, i) => i % 4 === 0)).toEqual([
      63, 63, 127, 127,
    ]);
  });

  it('keeps the raw values of a half-float volume in a half-float texture', () => {
    const texture = resolveImageTexture3D('SubResource("Half")', RESOURCES)!.texture;
    expect(texture.type).toBe(THREE.HalfFloatType);
    expect(Array.from(texture.image.data as Uint16Array, THREE.DataUtils.fromHalfFloat)).toEqual([
      2, 0, 0, 1, 1, 0, 0, 1,
    ]);
  });

  it('declines a reference to another type (edge case)', () => {
    expect(resolveImageTexture3D('SubResource("Image_a")', RESOURCES)).toBeNull();
  });
});
