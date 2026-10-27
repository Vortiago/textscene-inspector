import { describe, expect, it } from 'vitest';
import { fontGeneratesMipmaps, fontVariationSkew, resolveFontFileBytes } from './sceneFontResolution';
import type { FontFileResource, FontResource } from '../../../../resources/fonts/font/types';

function fontFile(bytes: ArrayBuffer | undefined, fallbacks: FontResource[] = []): FontFileResource {
  return { kind: 'file', bytes, mimeType: bytes ? 'font/ttf' : undefined, fallbacks, properties: {} };
}

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

  it('skips a fallback with no bytes (e.g. a SystemFont) and uses the next one that has them', () => {
    const bytes = new ArrayBuffer(4);
    const realFace = fontFile(bytes);
    const systemFallback: FontResource = { kind: 'system', fontNames: ['monospace'], properties: {} };
    const wrapper = fontFile(undefined, [systemFallback, realFace]);
    const result = resolveFontFileBytes(wrapper);
    expect(result!.bytes).toBe(bytes);
    expect(result!.leaf).toBe(realFace);
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

  it('is the generate_mipmaps of a SystemFont', () => {
    const system: FontResource = {
      kind: 'system',
      fontNames: ['sans-serif'],
      properties: { generate_mipmaps: 'true' },
    };

    expect(fontGeneratesMipmaps(system)).toBe(true);
  });
});
