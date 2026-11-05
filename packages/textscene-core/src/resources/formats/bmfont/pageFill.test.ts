import { describe, expect, it } from 'vitest';
import type { ImageSourceFormat } from '../../../godot/import/imageSourceFormat';
import { parseDescriptor } from './parseDescriptor';
import { decodePageFills, decodePageOutlineFills, type PageImage } from './pageFill';
import { binaryDescriptor, textDescriptor } from './descriptor.testkit';

const encode = (text: string): ArrayBuffer => new TextEncoder().encode(text).buffer as ArrayBuffer;

/** A two-texel row of RGBA8 bytes read as `source`. */
function imageOf(texels: number[], source: ImageSourceFormat | null = 'RGBA8'): PageImage {
  return { pixels: { width: 2, height: 1, data: new Uint8Array(texels) }, source };
}

function textPage(settings: Parameters<typeof textDescriptor>[0]) {
  return parseDescriptor(encode(textDescriptor(settings))).pages[0]!;
}

/** The bytes of the fill at `index`. */
function fillBytes(fills: Map<number, { data: ArrayLike<number> }>, index: number): number[] {
  return Array.from(fills.get(index)!.data);
}

describe('decodePageFills', () => {
  it('keeps an RGBA colour page as it is', () => {
    const fills = decodePageFills(
      textPage({ channels: [0, 0, 0, 0] }),
      imageOf([10, 20, 30, 40, 50, 60, 70, 80])
    );

    expect(fillBytes(fills, 0)).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
  });

  it('turns the glyph channel of a monochrome page into white with that alpha', () => {
    const fills = decodePageFills(
      textPage({ channels: [3, 3, 3, 0] }),
      imageOf([1, 2, 3, 100, 4, 5, 6, 200])
    );

    expect(fillBytes(fills, 0)).toEqual([255, 255, 255, 100, 255, 255, 255, 200]);
  });

  it('takes the glyph channel apart from the outline channel when the page holds both', () => {
    const fills = decodePageFills(
      textPage({ channels: [0, 1, 3, 3], outline: 1 }),
      imageOf([9, 8, 0, 0, 7, 6, 0, 0])
    );

    expect(fillBytes(fills, 0)).toEqual([255, 255, 255, 9, 255, 255, 255, 7]);
  });

  it('keeps the upper half of a 4-bit RGBA page as the glyph', () => {
    const fills = decodePageFills(
      textPage({ channels: [2, 2, 2, 2], outline: 1 }),
      imageOf([0x80, 0x7f, 0xff, 0x00, 0x10, 0x90, 0x20, 0xc0])
    );

    expect(fillBytes(fills, 0)).toEqual([0x80, 0, 0xff, 0, 0, 0x90, 0, 0xc0]);
  });

  it('keeps the upper half of a 4-bit monochrome channel as the glyph', () => {
    const fills = decodePageFills(
      textPage({ channels: [2, 3, 3, 3], outline: 1 }),
      imageOf([0x90, 0, 0, 0, 0x20, 0, 0, 0])
    );

    expect(fillBytes(fills, 0)).toEqual([255, 255, 255, 0x90, 255, 255, 255, 0]);
  });

  it('splits a packed 8-bit page into four white fills, one for each channel', () => {
    const fills = decodePageFills(
      textPage({ packed: true, channels: [0, 0, 0, 0] }),
      imageOf([1, 2, 3, 4, 5, 6, 7, 8])
    );

    expect([...fills.keys()]).toEqual([0, 1, 2, 3]);
    expect(fillBytes(fills, 2)).toEqual([255, 255, 255, 3, 255, 255, 255, 7]);
  });

  it('splits a packed 4-bit page by the rule of its converter', () => {
    const fills = decodePageFills(
      textPage({ packed: true, channels: [2, 2, 2, 2], outline: 1 }),
      imageOf([0x20, 0x10, 0x0f, 0x00, 0x08, 0x0f, 0x10, 0x01])
    );

    expect(fillBytes(fills, 0)).toEqual([255, 255, 255, (0x20 - 0x0f) * 2, 255, 255, 255, 0]);
  });

  it('numbers the fills of the second packed page from four', () => {
    const page = { ...textPage({ packed: true, channels: [0, 0, 0, 0] }), id: 1 };

    expect([...decodePageFills(page, imageOf([1, 2, 3, 4, 5, 6, 7, 8])).keys()]).toEqual([4, 5, 6, 7]);
  });

  it('reads the channel of a greyscale page whatever channel the descriptor names', () => {
    const fills = decodePageFills(
      textPage({ channels: [3, 3, 3, 0] }),
      imageOf([77, 77, 77, 255, 9, 9, 9, 255], 'Lum8')
    );

    expect(fillBytes(fills, 0)).toEqual([255, 255, 255, 77, 255, 255, 255, 9]);
  });

  it('reads an RGBA colour page whose three colour channels are one, in a text descriptor only', () => {
    const settings = { channels: [4, 4, 4, 0] } as const;
    const image = imageOf([10, 20, 30, 40, 50, 60, 70, 80]);

    expect(fillBytes(decodePageFills(textPage(settings), image), 0)).toEqual([
      10, 20, 30, 40, 50, 60, 70, 80,
    ]);

    const binaryPage = parseDescriptor(binaryDescriptor(settings)).pages[0]!;
    expect(fillBytes(decodePageFills(binaryPage, image), 0)).toEqual([255, 255, 255, 40, 255, 255, 255, 80]);
  });

  it.each<[string, ImageSourceFormat]>([
    ['an RGB page', 'RGB8'],
    ['a grey page with alpha', 'LumAlpha8'],
  ])('refuses %s of any layout', (_name, source) => {
    expect(() =>
      decodePageFills(textPage({ channels: [3, 3, 3, 0] }), imageOf([0, 0, 0, 0, 0, 0, 0, 0], source))
    ).toThrowError(/Unsupported BMFont texture format/);
  });

  it('refuses a greyscale page for a layout that needs the four channels', () => {
    expect(() =>
      decodePageFills(textPage({ channels: [0, 0, 0, 0] }), imageOf([0, 0, 0, 255, 0, 0, 0, 255], 'Lum8'))
    ).toThrowError(/Unsupported BMFont texture format/);
  });

  it('refuses a layout whose channels hold no glyph', () => {
    expect(() =>
      decodePageFills(textPage({ channels: [3, 3, 3, 3] }), imageOf([0, 0, 0, 0, 0, 0, 0, 0]))
    ).toThrowError(/Unsupported BMFont texture format/);
  });

  it('refuses a source no header names', () => {
    expect(() =>
      decodePageFills(textPage({ channels: [0, 0, 0, 0] }), imageOf([0, 0, 0, 0, 0, 0, 0, 0], null))
    ).toThrowError(/Unsupported BMFont texture format/);
  });
});

/** The outline fills Godot stores under the cache key `(size, 1)` (`font.cpp:623-880,1930-1936`). */
describe('decodePageOutlineFills', () => {
  it('reads the outline channel of a monochrome page that holds glyph and outline', () => {
    const fills = decodePageOutlineFills(
      textPage({ channels: [0, 1, 3, 3], outline: 1 }),
      imageOf([9, 8, 0, 0, 7, 6, 0, 0])
    );

    expect(fillBytes(fills, 0)).toEqual([255, 255, 255, 8, 255, 255, 255, 6]);
  });

  it('keeps the lower half of a 4-bit monochrome channel, doubled, as the outline', () => {
    const fills = decodePageOutlineFills(
      textPage({ channels: [2, 3, 3, 3], outline: 1 }),
      imageOf([0x90, 0, 0, 0, 0x20, 0, 0, 0])
    );

    expect(fillBytes(fills, 0)).toEqual([255, 255, 255, 0, 255, 255, 255, 0x40]);
  });

  it('keeps the lower half of a 4-bit RGBA page, doubled, as the outline', () => {
    const fills = decodePageOutlineFills(
      textPage({ channels: [2, 2, 2, 2], outline: 1 }),
      imageOf([0x80, 0x7f, 0xff, 0x00, 0x10, 0x90, 0x20, 0xc0])
    );

    expect(fillBytes(fills, 0)).toEqual([0, 0xfe, 0, 0, 0x20, 0, 0x40, 0]);
  });

  it('splits a packed 4-bit page into four outline fills', () => {
    const fills = decodePageOutlineFills(
      textPage({ packed: true, channels: [2, 2, 2, 2], outline: 1 }),
      imageOf([0x20, 0x10, 0x0f, 0x00, 0x08, 0x0f, 0x10, 0x01])
    );

    expect([...fills.keys()]).toEqual([0, 1, 2, 3]);
    expect(fillBytes(fills, 0)).toEqual([255, 255, 255, 0, 255, 255, 255, 0x10]);
    expect(fillBytes(fills, 2)).toEqual([255, 255, 255, 0x1e, 255, 255, 255, 0]);
  });

  it.each([
    ['an RGBA colour page', { channels: [0, 0, 0, 0] }],
    ['a packed 8-bit page', { packed: true, channels: [0, 0, 0, 0] }],
    ['a monochrome page with no outline', { channels: [3, 3, 3, 0] }],
  ] as const)('is empty for %s', (_name, settings) => {
    expect(decodePageOutlineFills(textPage(settings), imageOf([1, 2, 3, 4, 5, 6, 7, 8])).size).toBe(0);
  });
});
