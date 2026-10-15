/** An `Image` sub-resource as Godot 4.6.3 writes it, decoded to RGBA8. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { parseTresFile } from '../../../parser/parsedResource';
import type { TscnInternalResource } from '../../../parser/types';
import { decodeImageRef, imageRefSize } from './decode';

function image(format: string, width: number, height: number, bytes: string): TscnInternalResource {
  return {
    id: 'Image_a',
    type: 'Image',
    data: {
      data: `{\n"data": PackedByteArray(${bytes}),\n"format": "${format}",\n"height": ${height},\n"mipmaps": false,\n"width": ${width}\n}`,
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

function decodeImage(resource: TscnInternalResource) {
  return decodeImageRef('SubResource("Image_a")', [resource]);
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

/** An ImageTexture `save_block_images.gd` wrote, its `Image` decoded. */
function decodeGodotSaved(name: string) {
  const saved = parseTresFile(readFileSync(join(import.meta.dirname, 'godotSaved', `${name}.tres`), 'utf8'));
  return decodeImageRef(saved.properties.image, saved.subResources);
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
    ['an image with mipmaps, at its top level', 'DXT5Mipmapped'],
  ])('decodes %s (edge case)', (_case, name) => {
    expect(decodeGodotSaved(name)!.data).toEqual(decodeGodotSaved(`${name}.rgba8`)!.data);
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
