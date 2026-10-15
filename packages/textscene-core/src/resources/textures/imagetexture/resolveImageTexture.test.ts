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

  it('builds nothing for an ImageTexture with no image (edge case)', () => {
    expect(resolveImageTexture('SubResource("ImageTexture_empty")', RESOURCES)).toBeNull();
  });
});
