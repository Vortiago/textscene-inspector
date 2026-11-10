import { describe, expect, it } from 'vitest';
import { fontFile, systemFont } from './sfntOutlines.testkit';
import { testBitmapFont } from './bitmapFontMetrics.testkit';
import {
  BUNDLED_FACE,
  FACELESS_FONT,
  NO_FACE,
  fallbackChain,
  findDrawnFace,
  fontGeneratesMipmaps,
  fontVariationOpentype,
  fontVariationSkew,
} from './sceneFontResolution';
import { fontResourceFromBitmap } from '../../../../resources/fonts/font/loadFont';
import type { FontFileResource, FontResource } from '../../../../resources/fonts/font/types';

const variationOver = (baseFont: FontResource | null, fallbacks: FontResource[] = []): FontResource => ({
  kind: 'variation',
  baseFont,
  fallbacks,
  properties: {},
});

describe('findDrawnFace', () => {
  it('is the bundled face for no font, a SystemFont and a FontVariation with no base_font', () => {
    expect([findDrawnFace(null), findDrawnFace(systemFont()), findDrawnFace(variationOver(null))]).toEqual([
      BUNDLED_FACE,
      BUNDLED_FACE,
      BUNDLED_FACE,
    ]);
  });

  it('is no face for the font with no default, through a variation', () => {
    expect(findDrawnFace(variationOver(FACELESS_FONT))).toBe(NO_FACE);
  });

  // `font.cpp:104-116`: a fallback with no RID adds none, so the next fallback draws.
  it('passes a fallback with no face, and draws the next', () => {
    const leaf = fontFile(new ArrayBuffer(4));
    expect(findDrawnFace(fontFile(undefined, [FACELESS_FONT, leaf]))).toBe(leaf);
  });

  it('is no face for a file whose every fallback has no face', () => {
    expect(findDrawnFace(fontFile(undefined, [FACELESS_FONT]))).toBe(NO_FACE);
  });

  it('is a FontFile that carries its own bytes, or a BMFont', () => {
    const leaf = fontFile(new ArrayBuffer(4));
    const bitmap = fontResourceFromBitmap(testBitmapFont(), {});
    expect([findDrawnFace(leaf), findDrawnFace(bitmap)]).toEqual([leaf, bitmap]);
  });

  it('unwraps a FontVariation to its base_font, a FontVariation over a SystemFont included', () => {
    const leaf = fontFile(new ArrayBuffer(4));
    expect(findDrawnFace(variationOver(leaf))).toBe(leaf);
    expect(findDrawnFace(variationOver(systemFont()))).toBe(BUNDLED_FACE);
  });

  it('is the first fallback that draws behind a bytes-less FontFile, through a variation', () => {
    const realFace = fontFile(new ArrayBuffer(4));
    const wrapper = fontFile(undefined, [fontFile(undefined), realFace]);
    expect(findDrawnFace(variationOver(wrapper))).toBe(realFace);
  });

  it('stops at a SystemFont fallback, which draws the bundled font before the next fallback', () => {
    const wrapper = fontFile(undefined, [systemFont(), fontFile(new ArrayBuffer(4))]);
    expect(findDrawnFace(wrapper)).toBe(BUNDLED_FACE);
  });

  it('keeps a fallback behind a primary file with bytes, which draws instead', () => {
    const primary = fontFile(new ArrayBuffer(4), [fontResourceFromBitmap(testBitmapFont(), {})]);
    expect(findDrawnFace(primary)).toBe(primary);
  });

  it('is null for a bytes-less FontFile with no fallback that draws', () => {
    expect(findDrawnFace(fontFile(undefined, [fontFile(undefined)]))).toBeNull();
  });
});

describe('fontVariationSkew', () => {
  const variation = (properties: Record<string, string>): FontResource => ({
    kind: 'variation',
    baseFont: null,
    fallbacks: [],
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
    fallbacks: [],
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
    const variation: FontResource = {
      kind: 'variation',
      baseFont: withMipmaps('true'),
      fallbacks: [],
      properties: {},
    };

    expect(fontGeneratesMipmaps(variation)).toBe(true);
  });

  it('is undefined for a FontVariation over the bundled font', () => {
    expect(
      fontGeneratesMipmaps({ kind: 'variation', baseFont: null, fallbacks: [], properties: {} })
    ).toBeUndefined();
  });

  it('is the generate_mipmaps of the FontFile behind a bytes-less wrapper', () => {
    const wrapper = fontFile(undefined, [withMipmaps('true')]);

    expect(fontGeneratesMipmaps(wrapper)).toBe(true);
  });

  it('is undefined for a SystemFont, whose own generate_mipmaps Godot sets only on a matched OS file', () => {
    const system: FontResource = { ...systemFont(), properties: { generate_mipmaps: 'true' } };

    expect(fontGeneratesMipmaps(system)).toBeUndefined();
  });
});

// `Font::_update_rids` (`font.cpp:104-123`) and its FontVariation override (`:2926-2945`).
describe('fallbackChain', () => {
  const leaf = () => fontFile(new ArrayBuffer(4));

  it('is the font, then each fallback and its own fallbacks, depth first', () => {
    const [b, d, e] = [leaf(), leaf(), leaf()];
    const c = fontFile(new ArrayBuffer(4), [d]);
    const font = fontFile(new ArrayBuffer(4), [b, c, e]);
    expect(fallbackChain(font)).toEqual([font, b, c, d, e]);
  });

  it('passes a font file with no glyphs, which has no face of its own', () => {
    const real = leaf();
    expect(fallbackChain(fontFile(undefined, [real]))).toEqual([real]);
  });

  it("takes the base's fallbacks for a FontVariation with none of its own", () => {
    const cjk = leaf();
    const variation = variationOver(fontFile(new ArrayBuffer(4), [cjk]));
    expect(fallbackChain(variation)).toEqual([variation, cjk]);
  });

  it("keeps a FontVariation's own fallbacks in place of its base's", () => {
    const [own, cjk] = [leaf(), leaf()];
    const variation = variationOver(fontFile(new ArrayBuffer(4), [cjk]), [own]);
    expect(fallbackChain(variation)).toEqual([variation, own]);
  });

  it("reads no base's fallbacks for a FontVariation that is itself a fallback", () => {
    const nested = variationOver(fontFile(new ArrayBuffer(4), [leaf()]));
    const font = fontFile(new ArrayBuffer(4), [nested]);
    expect(fallbackChain(font)).toEqual([font, nested]);
  });

  it('keeps a FontVariation over the bundled font, which has a face', () => {
    const hebrew = leaf();
    const variation = variationOver(null, [hebrew]);
    expect(fallbackChain(variation)).toEqual([variation, hebrew]);
  });
});
