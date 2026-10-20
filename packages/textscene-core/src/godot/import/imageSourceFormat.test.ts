import { describe, expect, it } from 'vitest';
import { imageSourceFormat, isGreyscaleSource, storesAlpha } from './imageSourceFormat';
import { jpeg, png, pngChunk, vp8l, webp } from '../../resources/formats/image/testing/imageBytes';

describe('imageSourceFormat: PNG', () => {
  it('reads colour type 0 as Lum8', () => {
    expect(imageSourceFormat(png(0), 'image/png')).toBe('Lum8');
  });

  it('reads a 16-bit greyscale PNG as Lum8, as libpng strips it to 8 bits', () => {
    expect(imageSourceFormat(png(0, { bitDepth: 16 }), 'image/png')).toBe('Lum8');
  });

  it('reads colour type 4 as LumAlpha8', () => {
    expect(imageSourceFormat(png(4), 'image/png')).toBe('LumAlpha8');
  });

  it('reads a greyscale PNG with a tRNS chunk as LumAlpha8', () => {
    expect(imageSourceFormat(png(0, { extraChunks: ['tRNS'] }), 'image/png')).toBe('LumAlpha8');
  });

  it('reads colour type 2 as RGB8', () => {
    expect(imageSourceFormat(png(2), 'image/png')).toBe('RGB8');
  });

  it('reads colour type 2 with a tRNS chunk as RGBA8', () => {
    expect(imageSourceFormat(png(2, { extraChunks: ['tRNS'] }), 'image/png')).toBe('RGBA8');
  });

  it('reads a paletted PNG as RGB8, whatever its palette holds', () => {
    expect(imageSourceFormat(png(3, { extraChunks: ['PLTE'] }), 'image/png')).toBe('RGB8');
  });

  it('reads a paletted PNG with a tRNS chunk as RGBA8', () => {
    expect(imageSourceFormat(png(3, { extraChunks: ['PLTE', 'tRNS'] }), 'image/png')).toBe('RGBA8');
  });

  it('reads colour type 6 as RGBA8', () => {
    expect(imageSourceFormat(png(6), 'image/png')).toBe('RGBA8');
  });

  it('ignores a tRNS chunk after the image data, as libpng reads none there', () => {
    const late = png(0);
    const withLateTrns = new Uint8Array([
      ...late.slice(0, -12),
      ...pngChunk('tRNS', [0, 0]),
      ...late.slice(-12),
    ]);
    expect(imageSourceFormat(withLateTrns, 'image/png')).toBe('Lum8');
  });

  it('reads nothing from bytes without the PNG signature', () => {
    expect(imageSourceFormat(jpeg(1), 'image/png')).toBeNull();
  });

  it('reads nothing from a PNG cut before its header ends', () => {
    expect(imageSourceFormat(png(0).slice(0, 20), 'image/png')).toBeNull();
  });
});

describe('imageSourceFormat: JPEG', () => {
  it('reads a one-component JPEG as Lum8', () => {
    expect(imageSourceFormat(jpeg(1), 'image/jpeg')).toBe('Lum8');
  });

  it('reads a three-component JPEG as RGB8', () => {
    expect(imageSourceFormat(jpeg(3), 'image/jpeg')).toBe('RGB8');
  });

  it('reads nothing from a JPEG with no frame header', () => {
    expect(imageSourceFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 'image/jpeg')).toBeNull();
  });
});

describe('imageSourceFormat: WebP', () => {
  it('reads a lossy WebP as RGB8', () => {
    expect(imageSourceFormat(webp('VP8 ', Array<number>(10).fill(0)), 'image/webp')).toBe('RGB8');
  });

  it('reads a lossless WebP that uses alpha as RGBA8', () => {
    expect(imageSourceFormat(webp('VP8L', vp8l(true)), 'image/webp')).toBe('RGBA8');
  });

  it('reads a lossless WebP with no alpha as RGB8, even with grey content', () => {
    expect(imageSourceFormat(webp('VP8L', vp8l(false)), 'image/webp')).toBe('RGB8');
  });

  it('reads an extended WebP by its alpha flag', () => {
    expect(imageSourceFormat(webp('VP8X', [0x10, ...Array<number>(9).fill(0)]), 'image/webp')).toBe('RGBA8');
    expect(imageSourceFormat(webp('VP8X', Array<number>(10).fill(0)), 'image/webp')).toBe('RGB8');
  });
});

describe('imageSourceFormat: other files', () => {
  it('reads an SVG as RGBA8, which Godot rasterises it to', () => {
    expect(imageSourceFormat(new TextEncoder().encode('<svg/>'), 'image/svg+xml')).toBe('RGBA8');
  });

  it('reads nothing from bytes that are no image', () => {
    expect(imageSourceFormat(new Uint8Array([1, 2, 3, 4]), 'application/octet-stream')).toBeNull();
  });
});

describe('isGreyscaleSource', () => {
  it('holds for Lum8 and LumAlpha8', () => {
    expect([isGreyscaleSource('Lum8'), isGreyscaleSource('LumAlpha8')]).toEqual([true, true]);
  });

  it('fails for RGB8 and RGBA8', () => {
    expect([isGreyscaleSource('RGB8'), isGreyscaleSource('RGBA8')]).toEqual([false, false]);
  });

  it('fails for a source no header names, which reads as RGBA8 (edge case)', () => {
    expect(isGreyscaleSource(null)).toBe(false);
  });
});

describe('storesAlpha', () => {
  it('holds for LumAlpha8 and RGBA8', () => {
    expect([storesAlpha('LumAlpha8'), storesAlpha('RGBA8')]).toEqual([true, true]);
  });

  it('fails for Lum8 and RGB8', () => {
    expect([storesAlpha('Lum8'), storesAlpha('RGB8')]).toEqual([false, false]);
  });

  it('holds for a source no header names, which reads as RGBA8 (edge case)', () => {
    expect(storesAlpha(null)).toBe(true);
  });
});
