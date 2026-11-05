import { describe, expect, it } from 'vitest';
import { fontFile } from './sfntOutlines.testkit';
import { testBitmapFont } from './bitmapFontMetrics.testkit';
import {
  drawsBundledFont,
  fontGeneratesMipmaps,
  fontVariationOpentype,
  fontVariationSkew,
  resolveBitmapFont,
  resolveFontFileBytes,
} from './sceneFontResolution';
import { fontResourceFromBitmap } from '../../../../resources/fonts/font/loadFont';
import type { FontFileResource, FontResource } from '../../../../resources/fonts/font/types';

/** A SystemFont the theme lookup left in place: its default is the bundled font. */
const SYSTEM_FONT: FontResource = { kind: 'system', fontNames: ['Zz No Such Font'], properties: {} };

describe('resolveFontFileBytes', () => {
  it('returns null for undefined/null (no font authored -- theme default)', () => {
    expect(resolveFontFileBytes(undefined)).toBeNull();
    expect(resolveFontFileBytes(null)).toBeNull();
  });

  it('returns the bytes + leaf resource for a FontFile that carries its own bytes', () => {
    const bytes = new ArrayBuffer(4);
    const leaf = fontFile(bytes);
    const result = resolveFontFileBytes(leaf);
    expect(result).not.toBeNull();
    expect(result!.bytes).toBe(bytes);
    expect(result!.leaf).toBe(leaf);
  });

  it('returns null for a SystemFont -- no bytes this previewer can load', () => {
    const font: FontResource = { kind: 'system', fontNames: ['sans-serif'], properties: {} };
    expect(resolveFontFileBytes(font)).toBeNull();
  });

  it('unwraps a FontVariation to its baseFont', () => {
    const bytes = new ArrayBuffer(4);
    const leaf = fontFile(bytes);
    const variation: FontResource = { kind: 'variation', baseFont: leaf, properties: {} };
    const result = resolveFontFileBytes(variation);
    expect(result!.bytes).toBe(bytes);
    expect(result!.leaf).toBe(leaf);
  });

  it('returns null for a FontVariation with no baseFont (the theme default, recursively no different from authoring nothing)', () => {
    const variation: FontResource = { kind: 'variation', baseFont: null, properties: {} };
    expect(resolveFontFileBytes(variation)).toBeNull();
  });

  it('a bytes-less FontFile (a .tres wrapper) falls through to its first fallback that resolves to bytes', () => {
    const bytes = new ArrayBuffer(4);
    const realFace = fontFile(bytes);
    const wrapper = fontFile(undefined, [realFace]);
    const result = resolveFontFileBytes(wrapper);
    expect(result!.bytes).toBe(bytes);
    expect(result!.leaf).toBe(realFace);
  });

  it('skips a fallback with no bytes and uses the next one that has them', () => {
    const bytes = new ArrayBuffer(4);
    const realFace = fontFile(bytes);
    const wrapper = fontFile(undefined, [fontFile(undefined), realFace]);
    const result = resolveFontFileBytes(wrapper);
    expect(result!.bytes).toBe(bytes);
    expect(result!.leaf).toBe(realFace);
  });

  it('stops at a SystemFont fallback, which draws the bundled font before the next fallback', () => {
    const wrapper = fontFile(undefined, [SYSTEM_FONT, fontFile(new ArrayBuffer(4))]);
    expect(resolveFontFileBytes(wrapper)).toBeNull();
  });

  it('returns null when a bytes-less FontFile has no fallback that resolves to bytes', () => {
    const wrapper = fontFile(undefined, []);
    expect(resolveFontFileBytes(wrapper)).toBeNull();
  });

  it('recurses through a chain of variation -> bytes-less file -> fallback file', () => {
    const bytes = new ArrayBuffer(4);
    const realFace = fontFile(bytes);
    const wrapper = fontFile(undefined, [realFace]);
    const variation: FontResource = { kind: 'variation', baseFont: wrapper, properties: {} };
    const result = resolveFontFileBytes(variation);
    expect(result!.bytes).toBe(bytes);
    expect(result!.leaf).toBe(realFace);
  });
});

describe('drawsBundledFont', () => {
  it('is true for no font, a FontVariation with no base_font and a SystemFont', () => {
    const bare: FontResource = { kind: 'variation', baseFont: null, properties: {} };
    expect([drawsBundledFont(null), drawsBundledFont(bare), drawsBundledFont(SYSTEM_FONT)]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('is true for a FontVariation over a SystemFont', () => {
    expect(drawsBundledFont({ kind: 'variation', baseFont: SYSTEM_FONT, properties: {} })).toBe(true);
  });

  it('is true for a bytes-less FontFile whose first fallback that draws is a SystemFont', () => {
    const wrapper = fontFile(undefined, [fontFile(undefined), SYSTEM_FONT, fontFile(new ArrayBuffer(4))]);
    expect(drawsBundledFont(wrapper)).toBe(true);
  });

  it('is false for a FontFile with bytes, or a BMFont, whatever its fallbacks', () => {
    const bitmap = fontResourceFromBitmap(testBitmapFont(), {});
    expect([drawsBundledFont(fontFile(new ArrayBuffer(4), [SYSTEM_FONT])), drawsBundledFont(bitmap)]).toEqual(
      [false, false]
    );
  });

  it('is false for a bytes-less FontFile with no fallback, which has no face at all', () => {
    expect(drawsBundledFont(fontFile(undefined))).toBe(false);
  });
});

describe('resolveBitmapFont', () => {
  it('finds a BMFont fallback behind a bytes-less wrapper', () => {
    const bitmap = testBitmapFont();
    const wrapper = fontFile(undefined, [fontResourceFromBitmap(bitmap, {})]);
    expect(resolveBitmapFont(wrapper)).toBe(bitmap);
  });

  it('keeps a BMFont fallback behind a primary file with bytes, which draws instead', () => {
    const primary = fontFile(new ArrayBuffer(4), [fontResourceFromBitmap(testBitmapFont(), {})]);
    expect(resolveBitmapFont(primary)).toBeNull();
  });
});

describe('fontVariationSkew', () => {
  const variation = (properties: Record<string, string>): FontResource => ({
    kind: 'variation',
    baseFont: null,
    properties,
  });

  it('reads the second number of variation_transform: FT_Matrix.xy, the x basis y (text_server_adv.cpp:1318-1320)', () => {
    expect(fontVariationSkew(variation({ variation_transform: 'Transform2D(1, 0.2, 0, 1, 0, 0)' }))).toBe(
      0.2
    );
    expect(fontVariationSkew(variation({ variation_transform: 'Transform2D(1, -0.5, 0.3, 1, 0, 0)' }))).toBe(
      -0.5
    );
  });

  it('is 0 for no transform, a malformed one and a font that is not a variation', () => {
    expect(fontVariationSkew(variation({}))).toBe(0);
    expect(fontVariationSkew(variation({ variation_transform: 'Transform2D(1, 0.2)' }))).toBe(0);
    expect(fontVariationSkew(fontFile(undefined))).toBe(0);
    expect(fontVariationSkew(null)).toBe(0);
  });
});

describe('fontVariationOpentype', () => {
  const variation = (properties: Record<string, string>): FontResource => ({
    kind: 'variation',
    baseFont: null,
    properties,
  });

  it('reads the axes of variation_opentype by tag and by name', () => {
    const axes = fontVariationOpentype(
      variation({ variation_opentype: '{\n2003265652: 700.0,\n"custom_MONO": 1\n}' })
    );

    expect([...axes]).toEqual([
      [2003265652, 700],
      ['custom_MONO', 1],
    ]);
  });

  it('is empty for no dictionary and for a font that is not a variation', () => {
    expect(fontVariationOpentype(variation({})).size).toBe(0);
    expect(fontVariationOpentype(fontFile(undefined)).size).toBe(0);
    expect(fontVariationOpentype(null).size).toBe(0);
  });
});

// `default_theme.cpp:1359-1386`: the project setting reaches the bundled font only, and any other
// font keeps its own `generate_mipmaps` (`font.cpp:2171-2183`, `false` unless set).
describe('fontGeneratesMipmaps', () => {
  const withMipmaps = (value: string): FontFileResource => ({
    ...fontFile(new ArrayBuffer(4)),
    properties: { generate_mipmaps: value },
  });

  it('is undefined for the bundled font, which has no font resource of its own', () => {
    expect(fontGeneratesMipmaps(null)).toBeUndefined();
  });

  it('is the generate_mipmaps of a FontFile, false when it sets none', () => {
    expect([
      fontGeneratesMipmaps(withMipmaps('true')),
      fontGeneratesMipmaps(withMipmaps('false')),
      fontGeneratesMipmaps(fontFile(new ArrayBuffer(4))),
    ]).toEqual([true, false, false]);
  });

  it('is the generate_mipmaps of the FontFile a FontVariation wraps', () => {
    const variation: FontResource = { kind: 'variation', baseFont: withMipmaps('true'), properties: {} };

    expect(fontGeneratesMipmaps(variation)).toBe(true);
  });

  it('is undefined for a FontVariation over the bundled font', () => {
    expect(fontGeneratesMipmaps({ kind: 'variation', baseFont: null, properties: {} })).toBeUndefined();
  });

  it('is the generate_mipmaps of the FontFile behind a bytes-less wrapper', () => {
    const wrapper = fontFile(undefined, [withMipmaps('true')]);

    expect(fontGeneratesMipmaps(wrapper)).toBe(true);
  });

  it('is undefined for a SystemFont, whose own generate_mipmaps Godot sets only on a matched OS file', () => {
    const system: FontResource = { ...SYSTEM_FONT, properties: { generate_mipmaps: 'true' } };

    expect(fontGeneratesMipmaps(system)).toBeUndefined();
  });
});
