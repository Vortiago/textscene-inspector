/** An `Image` sub-resource as Godot 4.6.3 writes it, decoded to RGBA8. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { parseTresFile } from '../../../parser/parsedResource';
import type { TscnInternalResource } from '../../../parser/types';
import { decodeImageRef, decodeMipmappedImageRef, imageRefSize } from './decode';

function savedImage(
  format: string,
  width: number,
  height: number,
  bytes: string,
  mipmaps: boolean | number
): TscnInternalResource {
  return {
    id: 'Image_a',
    type: 'Image',
    data: {
      data: `{\n"data": PackedByteArray(${bytes}),\n"format": "${format}",\n"height": ${height},\n"mipmaps": ${mipmaps},\n"width": ${width}\n}`,
    },
  };
}

function image(format: string, width: number, height: number, bytes: string): TscnInternalResource {
  return savedImage(format, width, height, bytes, false);
}

function mipmappedImage(format: string, width: number, height: number, bytes: string): TscnInternalResource {
  return savedImage(format, width, height, bytes, true);
}

/** `count` bytes counting up from `first`, as the text a `PackedByteArray` holds. */
function counting(first: number, count: number): string {
  return Array.from({ length: count }, (_, i) => first + i).join(', ');
}

afterEach(() => {
  vi.restoreAllMocks();
});

function decodeImage(resource: TscnInternalResource) {
  return decodeImageRef('SubResource("Image_a")', [resource]);
}

function decodeWithLevels(resource: TscnInternalResource) {
  return decodeMipmappedImageRef('SubResource("Image_a")', [resource]);
}

describe('decodeImageRef', () => {
  it('spreads a Lum8 image to grey, opaque RGBA8', () => {
    expect(decodeImage(image('Lum8', 2, 1, '63, 127'))).toEqual({
      data: new Uint8Array([63, 63, 63, 255, 127, 127, 127, 255]),
      width: 2,
      height: 1,
      format: 'Lum8',
    });
  });

  it.each([
    ['LumAlpha8', '10, 20', [10, 10, 10, 20]],
    ['Red8', '10', [10, 0, 0, 255]],
    ['RedGreen', '10, 20', [10, 20, 0, 255]],
    ['RGB8', '10, 20, 30', [10, 20, 30, 255]],
    ['RGBA8', '10, 20, 30, 40', [10, 20, 30, 40]],
  ])('reads a %s pixel', (format, bytes, rgba) => {
    expect([...decodeImage(image(format, 1, 1, bytes))!.data]).toEqual(rgba);
  });

  it('reads the base64 body of an image over 64 bytes', () => {
    expect([...decodeImage(image('Red8', 1, 1, '"Pw=="'))!.data]).toEqual([63, 0, 0, 255]);
  });

  it.each([
    ['RFloat', '0, 0, 128, 63', [1, 0, 0, 1]],
    ['RGFloat', '0, 0, 0, 64, 0, 0, 128, 62', [2, 0.25, 0, 1]],
    ['RGBFloat', '0, 0, 128, 63, 0, 0, 0, 0, 0, 0, 0, 191', [1, 0, -0.5, 1]],
    ['RGBAFloat', '0, 0, 128, 63, 0, 0, 0, 64, 0, 0, 64, 64, 0, 0, 0, 63', [1, 2, 3, 0.5]],
    ['RHalf', '0, 60', [1, 0, 0, 1]],
    ['RGHalf', '0, 64, 0, 56', [2, 0.5, 0, 1]],
    ['RGBHalf', '0, 60, 1, 0, 0, 124', [1, 2 ** -24, Infinity, 1]],
    ['RGBAHalf', '0, 60, 0, 188, 0, 0, 0, 56', [1, -1, 0, 0.5]],
    ['RGBA4444', '52, 18', [1 / 15, 2 / 15, 3 / 15, 4 / 15]],
    ['RGBA5551', '16, 132', [16 / 31, 32 / 63, 16 / 31, 1]],
    ['RGBE9995', '0, 1, 0, 128', [1, 0, 0, 1]],
    ['R16', '255, 255', [1, 0, 0, 1]],
    ['RG16', '255, 255, 0, 128', [1, 32768 / 65535, 0, 1]],
    ['RGB16', '0, 0, 255, 255, 0, 0', [0, 1, 0, 1]],
    ['RGBA16', '255, 255, 0, 0, 255, 255, 0, 128', [1, 0, 1, 32768 / 65535]],
  ])('reads a %s pixel to raw floats, as Godot unpacks it', (format, bytes, rgba) => {
    expect(decodeImage(image(format, 1, 1, bytes))!.data).toEqual(new Float32Array(rgba));
  });

  it('draws nothing for an integer format, and says so (error path)', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    expect(decodeImage(image('R16Int', 1, 1, '1, 0'))).toBeNull();
    expect(warn).toHaveBeenCalledWith('[Image] the R16Int format is not decoded, so its image draws nothing');
  });

  it('draws nothing for block data one block short, which Godot refuses (error path)', () => {
    expect(decodeImage(image('DXT1 RGB8', 8, 4, '0, 0, 0, 0, 0, 0, 0, 0'))).toBeNull();
  });

  it('decodes nothing for a reference to another type', () => {
    expect(decodeImage({ ...image('RGB8', 1, 1, '1, 2, 3'), type: 'ImageTexture' })).toBeNull();
  });

  it('draws nothing for fewer bytes than the size needs, which Godot refuses (edge case)', () => {
    expect(decodeImage(image('RGB8', 2, 1, '1, 2, 3'))).toBeNull();
    expect(decodeImage(image('RHalf', 2, 1, '0, 60'))).toBeNull();
    expect(decodeImage({ id: 'Image_a', type: 'Image', data: {} })).toBeNull();
  });
});

describe('decodeMipmappedImageRef', () => {
  it('decodes each stored level of an RGBA8 image, down to 1 x 1', () => {
    // 4 x 2 over 2 x 1 over 1 x 1: 32, 8 and 4 bytes, one after the other.
    const decoded = decodeWithLevels(mipmappedImage('RGBA8', 4, 2, counting(0, 44)))!;
    expect(decoded.data).toEqual(Uint8Array.from({ length: 32 }, (_, i) => i));
    expect(decoded.levels).toEqual([
      { data: Uint8Array.from({ length: 8 }, (_, i) => 32 + i), width: 2, height: 1 },
      { data: Uint8Array.from({ length: 4 }, (_, i) => 40 + i), width: 1, height: 1 },
    ]);
  });

  it('halves a side that is not a power of two down, and a side at 1 stays 1 (edge case)', () => {
    // 6 x 3 over 3 x 1 over 1 x 1 of Red8: 18, 3 and 1 bytes.
    const { levels } = decodeWithLevels(mipmappedImage('Red8', 6, 3, counting(0, 22)))!;
    expect(levels.map(({ width, height }) => [width, height])).toEqual([
      [3, 1],
      [1, 1],
    ]);
    expect([...levels[0]!.data]).toEqual([18, 0, 0, 255, 19, 0, 0, 255, 20, 0, 0, 255]);
    expect([...levels[1]!.data]).toEqual([21, 0, 0, 255]);
  });

  it('reads a block format level from its own padded blocks (edge case)', () => {
    // 6 x 3 DXT1: two blocks, then one block each for 3 x 1 and 1 x 1. Each is one solid colour.
    const red = '0, 248, 0, 248, 0, 0, 0, 0';
    const green = '224, 7, 224, 7, 0, 0, 0, 0';
    const blue = '31, 0, 31, 0, 0, 0, 0, 0';
    const decoded = decodeWithLevels(mipmappedImage('DXT1 RGB8', 6, 3, [red, red, green, blue].join(', ')))!;
    expect(decoded.levels.map(({ width, height }) => [width, height])).toEqual([
      [3, 1],
      [1, 1],
    ]);
    expect([...decoded.levels[0]!.data]).toEqual([0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255]);
    expect([...decoded.levels[1]!.data]).toEqual([0, 0, 255, 255]);
  });

  it('decodes the levels of a float format to raw floats (edge case)', () => {
    // RGHalf 2 x 1 over 1 x 1: 1.0 and 2.0 in red, then 0.5 and 0.25.
    const bytes = '0, 60, 0, 0, 0, 64, 0, 0, 0, 56, 0, 52';
    const { levels } = decodeWithLevels(mipmappedImage('RGHalf', 2, 1, bytes))!;
    expect(levels).toEqual([{ data: new Float32Array([0.5, 0.25, 0, 1]), width: 1, height: 1 }]);
  });

  it('reads a flag saved as an int, as the Dictionary converts it to a bool (edge case)', () => {
    const decoded = decodeWithLevels(savedImage('Red8', 2, 1, counting(0, 3), 1));
    expect(decoded!.levels).toHaveLength(1);
  });

  it('gives a 1 x 1 image no lower level (edge case)', () => {
    expect(decodeWithLevels(mipmappedImage('Red8', 1, 1, '7'))!.levels).toEqual([]);
  });

  it('keeps the top level of an image short of its levels, which this does not refuse (error path)', () => {
    const decoded = decodeWithLevels(mipmappedImage('RGBA8', 2, 1, counting(0, 8)))!;
    expect([...decoded.data]).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(decoded.levels).toEqual([]);
  });

  it('reads no level with the flag off, whatever bytes follow (edge case)', () => {
    expect(decodeWithLevels(image('RGBA8', 2, 1, counting(0, 12)))!.levels).toEqual([]);
  });
});

/** An ImageTexture `save_block_images.gd` wrote, its `Image` decoded with the levels it stores. */
function decodeGodotSaved(name: string) {
  const saved = parseTresFile(readFileSync(join(import.meta.dirname, 'godotSaved', `${name}.tres`), 'utf8'));
  return decodeMipmappedImageRef(saved.properties.image, saved.subResources);
}

describe('decodeImageRef on a block-compressed image', () => {
  it.each([
    // The first block of the DXT1 image is in its three-colour mode, whose index 3 reads opaque black.
    ['DXT1', 'DXT1 RGB8'],
    ['DXT3', 'DXT3 RGBA8'],
    ['DXT5', 'DXT5 RGBA8'],
    ['DXT5RaAsRg', 'FORMAT_DXT5_RA_AS_RG'],
    ['RgtcRed', 'RGTC Red8'],
    ['RgtcRedGreen', 'RGTC RedGreen8'],
  ])('decodes %s to the RGBA8 Godot samples, keeping the saved format', (name, format) => {
    const rgba8 = decodeGodotSaved(`${name}.rgba8`)!;
    expect(decodeGodotSaved(name)).toEqual({ ...rgba8, format });
  });

  it.each([
    [
      'a DXT5 alpha block whose first endpoint is below the second, so it holds 0 and 255',
      'DXT5SixValueAlpha',
    ],
    ['an image whose size is not a multiple of the block, cropped', 'DXT5Cropped'],
  ])('decodes %s (edge case)', (_case, name) => {
    expect(decodeGodotSaved(name)!.data).toEqual(decodeGodotSaved(`${name}.rgba8`)!.data);
  });

  it('decodes every level of an image with mipmaps to the RGBA8 Godot samples (edge case)', () => {
    const decoded = decodeGodotSaved('DXT5Mipmapped')!;
    const rgba8 = decodeGodotSaved('DXT5Mipmapped.rgba8')!;
    expect(decoded.data).toEqual(rgba8.data);
    expect(decoded.levels.map(({ width }) => width)).toEqual([4, 2, 1]);
    expect(decoded.levels).toEqual(rgba8.levels);
  });
});

describe('imageRefSize', () => {
  it("reads an image's size", () => {
    expect(imageRefSize('SubResource("Image_a")', [image('RGBA8', 3, 2, '')])).toEqual({
      width: 3,
      height: 2,
    });
  });

  it('sizes an image in a format this does not decode, as Godot does (edge case)', () => {
    expect(imageRefSize('SubResource("Image_a")', [image('DXT1 RGB8', 4, 4, '')])).toEqual({
      width: 4,
      height: 4,
    });
  });

  it('gives nothing for a reference to another type or an image without its keys (error path)', () => {
    expect(
      imageRefSize('SubResource("Image_a")', [{ ...image('RGB8', 1, 1, ''), type: 'Gradient' }])
    ).toBeNull();
    expect(imageRefSize('SubResource("Image_a")', [{ id: 'Image_a', type: 'Image', data: {} }])).toBeNull();
  });
});
