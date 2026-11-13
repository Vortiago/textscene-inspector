/** An ImageTexture3D's saved slices, decoded to the volume's texels. */
import { describe, expect, it } from 'vitest';
import { savedImage } from '../image/savedImage.testkit';
import { decodeImageTexture3D, imageReferences } from './decode';

/** A 1 x 1 Image of `format` that saves `bytes`. */
const image = (format: string, bytes: string) => savedImage(format, 1, 1, bytes);

const DARK = image('Lum8', '63');
const LIGHT = image('Lum8', '127');
const HALF = image('RHalf', '0, 64');
/** One DXT5 block: alpha endpoints 40 and 200 with index 0 at the texel, over white. */
const DXT5 = image('DXT5 RGBA8', '40, 200, 136, 198, 250, 136, 198, 250, 255, 255, 0, 0, 0, 0, 0, 0');

describe('decodeImageTexture3D', () => {
  it('stacks the saved slices in order', () => {
    expect(decodeImageTexture3D([DARK, LIGHT])).toEqual({
      texels: new Uint8Array([63, 63, 63, 255, 127, 127, 127, 255]),
      width: 1,
      height: 1,
      depth: 2,
    });
  });

  it('keeps the raw floats of a float format', () => {
    expect(decodeImageTexture3D([HALF])!.texels).toEqual(new Float32Array([2, 0, 0, 1]));
  });

  it('decodes a block-compressed slice to RGBA8, cropped to its texel', () => {
    expect(decodeImageTexture3D([DXT5])!.texels).toEqual(new Uint8Array([255, 255, 255, 40]));
  });

  it('decodes nothing from slices of different formats, which _set_images refuses', () => {
    expect(decodeImageTexture3D([DARK, HALF])).toBeNull();
  });

  it('decodes nothing from no slices (edge case)', () => {
    expect(decodeImageTexture3D([])).toBeNull();
  });
});

describe('imageReferences', () => {
  it('lists the references of an `_images` array in order', () => {
    expect(imageReferences('Array[Image]([SubResource("a"), ExtResource("1")])')).toEqual([
      'SubResource("a")',
      'ExtResource("1")',
    ]);
  });

  it('lists nothing for an empty array', () => {
    expect(imageReferences('Array[Image]([])')).toEqual([]);
  });

  it('is null for no value, or a value that is no array (edge case)', () => {
    expect(imageReferences(undefined)).toBeNull();
    expect(imageReferences('SubResource("a")')).toBeNull();
  });
});
