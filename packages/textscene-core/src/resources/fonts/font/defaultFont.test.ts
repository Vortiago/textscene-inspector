import { describe, expect, it } from 'vitest';
import type { FontFileResource, FontResource, FontVariationResource, SystemFontResource } from './types';
import { NO_DEFAULT_FONTS, withDefaultFonts, type DefaultFonts } from './defaultFont';

function fontFile(fallbacks: FontResource[] = []): FontFileResource {
  return { kind: 'file', bytes: new ArrayBuffer(4), mimeType: 'font/otf', fallbacks, properties: {} };
}

/** A `.tres` FontFile with no bytes, which draws from its fallbacks. */
function wrapper(fallbacks: FontResource[]): FontFileResource {
  return { ...fontFile(fallbacks), bytes: undefined, mimeType: undefined };
}

const VARIATION_DEFAULT = fontFile();
const SYSTEM_DEFAULT = fontFile();
const DEFAULTS: DefaultFonts = { variation: VARIATION_DEFAULT, system: SYSTEM_DEFAULT };

function variation(baseFont: FontResource | null, embolden = '1.2'): FontVariationResource {
  return { kind: 'variation', baseFont, properties: { variation_embolden: embolden } };
}

function systemFont(): SystemFontResource {
  return { kind: 'system', fontNames: ['Zz No Such Font'], properties: {} };
}

describe('withDefaultFonts — a FontVariation with no base_font', () => {
  it('takes the FontVariation default as its base, keeping its properties', () => {
    const bare = variation(null);
    const resolved = withDefaultFonts(bare, DEFAULTS) as FontVariationResource;
    expect(resolved.baseFont).toBe(VARIATION_DEFAULT);
    expect(resolved.properties).toBe(bare.properties);
  });

  it('gives the variation at the bottom of a variation chain the default', () => {
    const resolved = withDefaultFonts(variation(variation(null, '2.0')), DEFAULTS) as FontVariationResource;
    const inner = resolved.baseFont as FontVariationResource;
    expect(inner.baseFont).toBe(VARIATION_DEFAULT);
    expect(resolved.properties['variation_embolden']).toBe('1.2');
    expect(inner.properties['variation_embolden']).toBe('2.0');
  });

  it('stays bare when the FontVariation default is the bundled font (null)', () => {
    const bare = variation(null);
    expect(withDefaultFonts(bare, { ...DEFAULTS, variation: null })).toBe(bare);
  });
});

describe('withDefaultFonts — a SystemFont', () => {
  it('is the SystemFont default', () => {
    expect(withDefaultFonts(systemFont(), DEFAULTS)).toBe(SYSTEM_DEFAULT);
  });

  it('stays a SystemFont when the SystemFont default is the bundled font (null)', () => {
    const font = systemFont();
    expect(withDefaultFonts(font, { ...DEFAULTS, system: null })).toBe(font);
  });

  it('as the base_font of a FontVariation, puts the SystemFont default under it', () => {
    const resolved = withDefaultFonts(variation(systemFont()), DEFAULTS) as FontVariationResource;
    expect(resolved.baseFont).toBe(SYSTEM_DEFAULT);
  });

  it('as the base_font of a FontVariation over a FontVariation, puts the SystemFont default at the bottom', () => {
    const resolved = withDefaultFonts(variation(variation(systemFont())), DEFAULTS) as FontVariationResource;
    expect((resolved.baseFont as FontVariationResource).baseFont).toBe(SYSTEM_DEFAULT);
  });

  it('in the fallbacks of a FontFile with no bytes, is the SystemFont default there', () => {
    const resolved = withDefaultFonts(wrapper([systemFont()]), DEFAULTS) as FontFileResource;
    expect(resolved.fallbacks).toEqual([SYSTEM_DEFAULT]);
  });
});

describe('withDefaultFonts — fonts with a face of their own', () => {
  it('leaves a variation that names a FontFile base as it is', () => {
    const named = variation(fontFile());
    expect(withDefaultFonts(named, DEFAULTS)).toBe(named);
  });

  it('leaves a FontFile with bytes as it is, whatever its fallbacks: its own face draws', () => {
    const file = fontFile([systemFont()]);
    expect(withDefaultFonts(file, DEFAULTS)).toBe(file);
  });

  it('leaves null as null', () => {
    expect(withDefaultFonts(null, DEFAULTS)).toBeNull();
  });

  it('leaves every font as it is with no default fonts', () => {
    const bare = variation(null);
    expect(withDefaultFonts(bare, NO_DEFAULT_FONTS)).toBe(bare);
  });
});

describe('withDefaultFonts — identity', () => {
  it('answers the same object for the same font and equal defaults, so a metrics cache keeps its hits', () => {
    const bare = variation(null);
    expect(withDefaultFonts(bare, DEFAULTS)).toBe(withDefaultFonts(bare, { ...DEFAULTS }));
  });

  it('answers a new object for another default font', () => {
    const bare = variation(null);
    const other: DefaultFonts = { ...DEFAULTS, variation: fontFile() };
    expect(withDefaultFonts(bare, DEFAULTS)).not.toBe(withDefaultFonts(bare, other));
  });
});
