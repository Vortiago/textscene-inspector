/** An `Image` sub-resource as Godot 4.6.3 writes it, decoded to RGBA8. */
import { describe, expect, it } from 'vitest';
import { decodeImage } from './decode';

function image(format: string, width: number, height: number, bytes: string): Record<string, string> {
  return {
    data: `{\n"data": PackedByteArray(${bytes}),\n"format": "${format}",\n"height": ${height},\n"mipmaps": false,\n"width": ${width}\n}`,
  };
}

describe('decodeImage', () => {
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

  it('draws nothing for a format it does not decode', () => {
    expect(decodeImage(image('RFloat', 1, 1, '0, 0, 128, 63'))).toBeNull();
  });

  it('draws nothing for fewer bytes than the size needs, which Godot refuses (edge case)', () => {
    expect(decodeImage(image('RGB8', 2, 1, '1, 2, 3'))).toBeNull();
    expect(decodeImage({})).toBeNull();
  });
});
