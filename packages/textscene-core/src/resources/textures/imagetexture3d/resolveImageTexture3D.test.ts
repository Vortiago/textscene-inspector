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
  image('Image_rgb', 'RGB8', '1, 2, 3, 4, 5, 6'),
  {
    id: 'Volume',
    type: 'ImageTexture3D',
    data: { _images: 'Array[Image]([SubResource("Image_a"), SubResource("Image_b")])' },
  },
  {
    id: 'Mixed',
    type: 'ImageTexture3D',
    data: { _images: 'Array[Image]([SubResource("Image_a"), SubResource("Image_rgb")])' },
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

  it('builds nothing from slices of different formats, which _set_images refuses', () => {
    expect(resolveImageTexture3D('SubResource("Mixed")', RESOURCES)).toBeNull();
  });

  it('declines a reference to another type (edge case)', () => {
    expect(resolveImageTexture3D('SubResource("Image_a")', RESOURCES)).toBeNull();
  });
});
