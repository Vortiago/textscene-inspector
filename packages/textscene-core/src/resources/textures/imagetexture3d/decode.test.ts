/** An ImageTexture3D's saved slices, decoded to the volume's texels. */
import { describe, expect, it } from 'vitest';
import type { TscnInternalResource } from '../../../parser/types';
import { decodeImageTexture3D } from './decode';

function image(id: string, format: string, bytes: string): TscnInternalResource {
  return {
    id,
    type: 'Image',
    data: {
      data: `{\n"data": PackedByteArray(${bytes}),\n"format": "${format}",\n"height": 1,\n"mipmaps": false,\n"width": 1\n}`,
    },
  };
}

const RESOURCES: TscnInternalResource[] = [
  image('Image_a', 'Lum8', '63'),
  image('Image_b', 'Lum8', '127'),
  image('Image_half', 'RHalf', '0, 64'),
  { id: 'Texture', type: 'ImageTexture', data: {} },
];

const images = (...ids: string[]) => ({
  _images: `Array[Image]([${ids.map((id) => `SubResource("${id}")`).join(', ')}])`,
});

describe('decodeImageTexture3D', () => {
  it('stacks the saved slices in order', () => {
    expect(decodeImageTexture3D(images('Image_a', 'Image_b'), RESOURCES)).toEqual({
      texels: new Uint8Array([63, 63, 63, 255, 127, 127, 127, 255]),
      width: 1,
      height: 1,
      depth: 2,
    });
  });

  it('keeps the raw floats of a float format', () => {
    expect(decodeImageTexture3D(images('Image_half'), RESOURCES)!.texels).toEqual(
      new Float32Array([2, 0, 0, 1])
    );
  });

  it('decodes nothing from slices of different formats, which _set_images refuses', () => {
    expect(decodeImageTexture3D(images('Image_a', 'Image_half'), RESOURCES)).toBeNull();
  });

  it('decodes nothing when an element names no Image (error path)', () => {
    expect(decodeImageTexture3D(images('Image_a', 'Texture'), RESOURCES)).toBeNull();
  });

  it('decodes nothing without _images, or from an empty list (edge case)', () => {
    expect(decodeImageTexture3D({}, RESOURCES)).toBeNull();
    expect(decodeImageTexture3D({ _images: 'Array[Image]([])' }, RESOURCES)).toBeNull();
  });
});
