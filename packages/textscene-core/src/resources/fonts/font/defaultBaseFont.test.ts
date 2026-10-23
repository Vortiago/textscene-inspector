import { describe, expect, it } from 'vitest';
import type { FontFileResource, FontResource, FontVariationResource } from './types';
import { withDefaultBaseFont } from './defaultBaseFont';

const DEFAULT_FONT: FontFileResource = {
  kind: 'file',
  bytes: new ArrayBuffer(4),
  mimeType: 'font/otf',
  fallbacks: [],
  properties: {},
};

function variation(baseFont: FontResource | null, embolden = '1.2'): FontVariationResource {
  return { kind: 'variation', baseFont, properties: { variation_embolden: embolden } };
}

describe('withDefaultBaseFont', () => {
  it('gives a FontVariation with no base_font the default font as its base, keeping its properties', () => {
    const bare = variation(null);
    const resolved = withDefaultBaseFont(bare, DEFAULT_FONT) as FontVariationResource;
    expect(resolved.baseFont).toBe(DEFAULT_FONT);
    expect(resolved.properties).toBe(bare.properties);
  });

  it('gives the variation at the bottom of a variation chain the default font', () => {
    const resolved = withDefaultBaseFont(
      variation(variation(null, '2.0')),
      DEFAULT_FONT
    ) as FontVariationResource;
    expect((resolved.baseFont as FontVariationResource).baseFont).toBe(DEFAULT_FONT);
    expect(resolved.properties['variation_embolden']).toBe('1.2');
    expect((resolved.baseFont as FontVariationResource).properties['variation_embolden']).toBe('2.0');
  });

  it('leaves a variation that names its base_font as it is', () => {
    const named = variation(DEFAULT_FONT);
    expect(withDefaultBaseFont(named, { ...DEFAULT_FONT })).toBe(named);
  });

  it('leaves a font that is not a variation as it is, and null as null', () => {
    expect(withDefaultBaseFont(DEFAULT_FONT, { ...DEFAULT_FONT })).toBe(DEFAULT_FONT);
    expect(withDefaultBaseFont(null, DEFAULT_FONT)).toBeNull();
  });

  it('leaves a bare variation as it is when the default is the bundled font (null)', () => {
    const bare = variation(null);
    expect(withDefaultBaseFont(bare, null)).toBe(bare);
  });

  it('answers the same object for the same variation and default, so a metrics cache keeps its hits', () => {
    const bare = variation(null);
    expect(withDefaultBaseFont(bare, DEFAULT_FONT)).toBe(withDefaultBaseFont(bare, DEFAULT_FONT));
  });

  it('answers a new object for another default font', () => {
    const bare = variation(null);
    const other: FontFileResource = { ...DEFAULT_FONT };
    expect(withDefaultBaseFont(bare, DEFAULT_FONT)).not.toBe(withDefaultBaseFont(bare, other));
  });
});
