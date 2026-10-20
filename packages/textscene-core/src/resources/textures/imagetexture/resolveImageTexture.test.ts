/** An ImageTexture whose pixels sit in an inline `Image`, as Godot saves one in a scene or `.tres`. */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import { resetProceduralTextures } from '../proceduralBuilds';
import { resolveImageTexture } from './resolveImageTexture';

/** A 1x2 RGB8 image: a red top row over a blue bottom row. */
const RESOURCES: TscnInternalResource[] = [
  {
    id: 'Image_a',
    type: 'Image',
    data: {
      data: '{\n"data": PackedByteArray(255, 0, 0, 0, 0, 255),\n"format": "RGB8",\n"height": 2,\n"mipmaps": false,\n"width": 1\n}',
    },
  },
  { id: 'ImageTexture_a', type: 'ImageTexture', data: { image: 'SubResource("Image_a")' } },
  {
    // One 1x1 DXT5 block: alpha endpoints 40 and 200 with index 0 at the texel, over white.
    id: 'Image_dxt5',
    type: 'Image',
    data: {
      data: '{\n"data": PackedByteArray(40, 200, 136, 198, 250, 136, 198, 250, 255, 255, 0, 0, 0, 0, 0, 0),\n"format": "DXT5 RGBA8",\n"height": 1,\n"mipmaps": false,\n"width": 1\n}',
    },
  },
  { id: 'ImageTexture_dxt5', type: 'ImageTexture', data: { image: 'SubResource("Image_dxt5")' } },
  { id: 'ImageTexture_empty', type: 'ImageTexture', data: {} },
];

afterEach(() => {
  resetProceduralTextures();
});

describe('resolveImageTexture', () => {
  it('builds an sRGB texture of the saved pixels', () => {
    const resolved = resolveImageTexture('SubResource("ImageTexture_a")', RESOURCES);
    expect(resolved?.texture).toBeInstanceOf(THREE.DataTexture);
    expect(resolved!.texture.image).toMatchObject({ width: 1, height: 2 });
    expect(resolved!.texture.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it("puts Godot's top row last, as every typed-array texture here runs bottom-up", () => {
    const { data } = resolveImageTexture('SubResource("ImageTexture_a")', RESOURCES)!.texture.image;
    expect([...(data as Uint8Array)]).toEqual([0, 0, 255, 255, 255, 0, 0, 255]);
  });

  it('builds a texture of a block-compressed image, decoded to RGBA8', () => {
    const { data } = resolveImageTexture('SubResource("ImageTexture_dxt5")', RESOURCES)!.texture.image;
    expect([...(data as Uint8Array)]).toEqual([255, 255, 255, 40]);
  });

  it('builds nothing for an ImageTexture with no image (edge case)', () => {
    expect(resolveImageTexture('SubResource("ImageTexture_empty")', RESOURCES)).toBeNull();
  });
});
