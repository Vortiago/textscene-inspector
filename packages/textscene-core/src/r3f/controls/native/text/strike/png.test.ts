import { describe, expect, it } from 'vitest';
import { decodePng } from './png';
import { encodePng, inflate, pngChunk, type TestPng } from './png.testkit';

const decoded = (png: TestPng) => decodePng(encodePng(png), inflate);
const pixelsOf = (png: TestPng) => [...(decoded(png)?.bgra ?? [])];

/** A 3 × 2 RGBA image whose samples differ in every channel, so a misplaced byte shows. */
const RGBA_IMAGE: TestPng = {
  width: 3,
  height: 2,
  colourType: 6,
  samples: [
    10, 20, 30, 255, 200, 100, 50, 255, 1, 2, 3, 255, 90, 80, 70, 255, 255, 255, 255, 255, 0, 128, 64, 255,
  ],
};

describe('decodePng', () => {
  it('turns RGBA into BGRA', () => {
    expect(pixelsOf({ width: 1, height: 1, colourType: 6, samples: [255, 128, 0, 255] })).toEqual([
      0, 128, 255, 255,
    ]);
  });

  it('premultiplies the colour by alpha as `multiply_alpha` rounds it', () => {
    expect(pixelsOf({ width: 1, height: 1, colourType: 6, samples: [255, 101, 0, 128] })).toEqual([
      0, 51, 128, 128,
    ]);
  });

  it('clears the colour of a pixel with no alpha', () => {
    expect(pixelsOf({ width: 1, height: 1, colourType: 6, samples: [255, 255, 255, 0] })).toEqual([
      0, 0, 0, 0,
    ]);
  });

  it('gives an RGB image full alpha', () => {
    expect(pixelsOf({ width: 1, height: 1, colourType: 2, samples: [1, 2, 3] })).toEqual([3, 2, 1, 255]);
  });

  it('copies grey with alpha to each colour channel', () => {
    expect(pixelsOf({ width: 1, height: 1, colourType: 4, samples: [200, 128] })).toEqual([
      100, 100, 100, 128,
    ]);
  });

  it('scales a 1-bit grey sample to 0 or 255', () => {
    expect(pixelsOf({ width: 2, height: 1, colourType: 0, bitDepth: 1, samples: [1, 0] })).toEqual([
      255, 255, 255, 255, 0, 0, 0, 255,
    ]);
  });

  it('scales a 2-bit grey sample by 85', () => {
    expect(pixelsOf({ width: 1, height: 1, colourType: 0, bitDepth: 2, samples: [2] })).toEqual([
      170, 170, 170, 255,
    ]);
  });

  it('keeps the high byte of a 16-bit sample', () => {
    expect(
      pixelsOf({ width: 1, height: 1, colourType: 2, bitDepth: 16, samples: [0x12ff, 0x3400, 0x5680] })
    ).toEqual([0x56, 0x34, 0x12, 255]);
  });

  it('expands a palette index to its entry and its tRNS alpha', () => {
    const palette = [255, 0, 0, 0, 0, 255];
    expect(
      pixelsOf({
        width: 2,
        height: 1,
        colourType: 3,
        bitDepth: 2,
        samples: [1, 0],
        palette,
        transparency: [255, 128],
      })
    ).toEqual([128, 0, 0, 128, 0, 0, 255, 255]);
  });

  it('draws an index past the palette black, at full alpha past the tRNS entries', () => {
    expect(
      pixelsOf({ width: 1, height: 1, colourType: 3, samples: [3], palette: [9, 9, 9], transparency: [7] })
    ).toEqual([0, 0, 0, 255]);
  });

  it('makes a grey sample equal to the tRNS key transparent', () => {
    expect(
      pixelsOf({ width: 2, height: 1, colourType: 0, samples: [40, 41], transparency: [0, 40] })
    ).toEqual([0, 0, 0, 0, 41, 41, 41, 255]);
  });

  it('makes an RGB pixel equal to the tRNS key transparent', () => {
    expect(
      pixelsOf({
        width: 2,
        height: 1,
        colourType: 2,
        samples: [1, 2, 3, 1, 2, 4],
        transparency: [0, 1, 0, 2, 0, 3],
      })
    ).toEqual([0, 0, 0, 0, 4, 2, 1, 255]);
  });

  it.each([1, 2, 3, 4])('undoes filter type %i', (filter) => {
    expect(pixelsOf({ ...RGBA_IMAGE, filter })).toEqual(pixelsOf(RGBA_IMAGE));
  });

  it('reads an Adam7 image as the same pixels', () => {
    const samples = Array.from({ length: 9 * 9 }, (_, i) => (i * 37) % 256);
    const image: TestPng = { width: 9, height: 9, colourType: 0, samples };
    expect(pixelsOf({ ...image, isInterlaced: true })).toEqual(pixelsOf(image));
  });

  it('reads the size of the image', () => {
    expect(decoded(RGBA_IMAGE)).toMatchObject({ width: 3, height: 2 });
  });

  it('fails an image wider than FreeType takes', () => {
    expect(
      decoded({ width: 0x8000, height: 1, colourType: 0, bitDepth: 1, samples: new Array(0x8000).fill(0) })
    ).toBeNull();
  });

  it('fails a palette image with no palette', () => {
    expect(decoded({ width: 1, height: 1, colourType: 3, samples: [0] })).toBeNull();
  });

  it('fails an image whose data runs short', () => {
    const bytes = encodePng(RGBA_IMAGE);
    const short = encodePng({ ...RGBA_IMAGE, height: 1, samples: RGBA_IMAGE.samples.slice(0, 12) });
    const idatOf = (png: Uint8Array) => png.subarray(33, png.length - 12);
    const truncated = new Uint8Array([
      ...bytes.subarray(0, 33),
      ...idatOf(short),
      ...bytes.subarray(bytes.length - 12),
    ]);
    expect(decodePng(truncated, inflate)).toBeNull();
  });

  it('fails a file with no IEND', () => {
    const bytes = encodePng(RGBA_IMAGE);
    expect(decodePng(bytes.subarray(0, bytes.length - 12), inflate)).toBeNull();
  });

  it('fails a critical chunk with a broken CRC', () => {
    const bytes = encodePng(RGBA_IMAGE);
    bytes[bytes.length - 13]! ^= 1;
    expect(decodePng(bytes, inflate)).toBeNull();
  });

  it('drops an ancillary chunk with a broken CRC', () => {
    const image: TestPng = { width: 1, height: 1, colourType: 0, samples: [40], transparency: [0, 40] };
    const bytes = encodePng(image);
    const transparencyCrc = 33 + 14 - 1;
    bytes[transparencyCrc]! ^= 1;
    expect([...decodePng(bytes, inflate)!.bgra]).toEqual([40, 40, 40, 255]);
  });

  it('skips an unknown ancillary chunk', () => {
    const bytes = encodePng(RGBA_IMAGE);
    const withText = new Uint8Array([
      ...bytes.subarray(0, 33),
      ...pngChunk('tEXt', [65, 0, 66]),
      ...bytes.subarray(33),
    ]);
    expect([...decodePng(withText, inflate)!.bgra]).toEqual(pixelsOf(RGBA_IMAGE));
  });

  it('fails an unknown critical chunk', () => {
    const bytes = encodePng(RGBA_IMAGE);
    const withCritical = new Uint8Array([
      ...bytes.subarray(0, 33),
      ...pngChunk('ABCD'),
      ...bytes.subarray(33),
    ]);
    expect(decodePng(withCritical, inflate)).toBeNull();
  });
});
