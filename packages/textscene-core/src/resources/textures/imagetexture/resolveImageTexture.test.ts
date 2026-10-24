/** An ImageTexture whose pixels sit in an inline `Image`, as Godot saves one in a scene or `.tres`. */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import { applyTextureFilterState, godotTextureFilterState } from '../godotTextureFilter';
import { resetProceduralTextures } from '../proceduralBuilds';
import type { TextureLevel } from '../texelTexture';
import { resolveImageTexture } from './resolveImageTexture';

/** An `Image` that saves its levels, with the ImageTexture around it. Ids are `Image_<name>` and `ImageTexture_<name>`. */
function mipmappedImageTexture(
  name: string,
  format: string,
  size: number[],
  bytes: number[]
): TscnInternalResource[] {
  const [width, height] = size;
  return [
    {
      id: `Image_${name}`,
      type: 'Image',
      data: {
        data: `{\n"data": PackedByteArray(${bytes.join(', ')}),\n"format": "${format}",\n"height": ${height},\n"mipmaps": true,\n"width": ${width}\n}`,
      },
    },
    { id: `ImageTexture_${name}`, type: 'ImageTexture', data: { image: `SubResource("Image_${name}")` } },
  ];
}

/** 4 x 4 over 2 x 2 over 1 x 1 of Red8, counting up from 0 so each texel names its place in the bytes. */
const COUNTED = mipmappedImageTexture(
  'counted',
  'Red8',
  [4, 4],
  Array.from({ length: 21 }, (_, i) => i)
);

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

/** The levels a texture holds for upload, which three types for every kind of texture. */
function levelsOf(texture: THREE.DataTexture): TextureLevel[] {
  return texture.mipmaps as TextureLevel[];
}

describe('resolveImageTexture on an image with mipmaps', () => {
  function counted() {
    return resolveImageTexture('SubResource("ImageTexture_counted")', COUNTED)!.texture;
  }

  it('uploads the stored levels as they are, bottom-up like the top level', () => {
    const reds = (texture: THREE.DataTexture) =>
      levelsOf(texture).map((level) => [...level.data].filter((_, i) => i % 4 === 0));
    expect(reds(counted())).toEqual([
      [12, 13, 14, 15, 8, 9, 10, 11, 4, 5, 6, 7, 0, 1, 2, 3],
      [18, 19, 16, 17],
      [20],
    ]);
  });

  it('hands the sizes of the levels to the upload', () => {
    expect(levelsOf(counted()).map(({ width, height }) => [width, height])).toEqual([
      [4, 4],
      [2, 2],
      [1, 1],
    ]);
  });

  it('builds no chain over them, and minifies between them under the default filter', () => {
    const texture = counted();
    expect(texture.generateMipmaps).toBe(false);
    expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
  });

  it('keeps the top level as its own bytes', () => {
    const texture = counted();
    expect(levelsOf(texture)[0]!.data).toBe(texture.image.data);
  });

  it('samples only the top level under a filter without mipmaps (edge case)', () => {
    const texture = counted().clone();
    applyTextureFilterState(texture, godotTextureFilterState(1));
    expect(texture.mipmaps).toHaveLength(0);
    expect(texture.generateMipmaps).toBe(false);
    expect(texture.minFilter).toBe(THREE.LinearFilter);
  });

  it('uploads the levels of a float format as half floats, as its top level (edge case)', () => {
    // RHalf 2 x 1 over 1 x 1: 1.0, 2.0, then 0.5.
    const half = mipmappedImageTexture('half', 'RHalf', [2, 1], [0, 60, 0, 64, 0, 56]);
    const texture = resolveImageTexture('SubResource("ImageTexture_half")', half)!.texture;
    expect(texture.type).toBe(THREE.HalfFloatType);
    expect(levelsOf(texture).map((level) => level.data)).toEqual([
      texture.image.data,
      Uint16Array.of(THREE.DataUtils.toHalfFloat(0.5), 0, 0, THREE.DataUtils.toHalfFloat(1)),
    ]);
  });

  it('carries no levels for a 1 x 1 image, which has none (edge case)', () => {
    const one = mipmappedImageTexture('one', 'Red8', [1, 1], [7]);
    const texture = resolveImageTexture('SubResource("ImageTexture_one")', one)!.texture;
    expect(texture.mipmaps).toHaveLength(0);
    expect(texture.minFilter).toBe(THREE.LinearFilter);
  });

  it('carries no levels for an image saved without mipmaps (edge case)', () => {
    const texture = resolveImageTexture('SubResource("ImageTexture_a")', RESOURCES)!.texture;
    expect(texture.mipmaps).toHaveLength(0);
    expect(texture.minFilter).toBe(THREE.LinearFilter);
  });
});
