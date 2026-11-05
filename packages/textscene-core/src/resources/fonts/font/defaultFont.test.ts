import { describe, expect, it } from 'vitest';
import type { FontFileResource, FontResource, FontVariationResource } from './types';
import { fontFile, systemFont } from '../../../r3f/controls/native/text/sfntOutlines.testkit';
import { FACELESS_FONT, NO_FACE, findDrawnFace } from '../../../r3f/controls/native/text/sceneFontResolution';
import { NO_DEFAULT_FONTS, withDefaultFonts, type DefaultFonts } from './defaultFont';

const VARIATION_DEFAULT = fontFile(new ArrayBuffer(4));
const SYSTEM_DEFAULT = fontFile(new ArrayBuffer(4));
const DEFAULTS: DefaultFonts = { variation: [VARIATION_DEFAULT], system: [SYSTEM_DEFAULT] };

function variation(baseFont: FontResource | null, embolden = '1.2'): FontVariationResource {
  return { kind: 'variation', baseFont, fallbacks: [], properties: { variation_embolden: embolden } };
}

/** The font a resolved SystemFont draws: the default `withDefaultFonts` put under it. */
function baseOf(font: FontResource | null): FontResource | null {
  if (font?.kind !== 'system') throw new Error(`expected a SystemFont, got ${font?.kind ?? 'null'}`);
  return font.baseFont;
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
    expect(withDefaultFonts(bare, { ...DEFAULTS, variation: [null] })).toBe(bare);
  });
});

describe('withDefaultFonts — a SystemFont', () => {
  it('takes the SystemFont default as its base', () => {
    expect(baseOf(withDefaultFonts(systemFont(), DEFAULTS))).toBe(SYSTEM_DEFAULT);
  });

  it('stays a SystemFont when the SystemFont default is the bundled font (null)', () => {
    const font = systemFont();
    expect(withDefaultFonts(font, { ...DEFAULTS, system: [null] })).toBe(font);
  });

  it('as the base_font of a FontVariation, puts the SystemFont default under it', () => {
    const resolved = withDefaultFonts(variation(systemFont()), DEFAULTS) as FontVariationResource;
    expect(baseOf(resolved.baseFont)).toBe(SYSTEM_DEFAULT);
  });

  it('as the base_font of a FontVariation over a FontVariation, puts the SystemFont default at the bottom', () => {
    const resolved = withDefaultFonts(variation(variation(systemFont())), DEFAULTS) as FontVariationResource;
    expect(baseOf((resolved.baseFont as FontVariationResource).baseFont)).toBe(SYSTEM_DEFAULT);
  });

  it('in the fallbacks of a FontFile with no bytes, is the SystemFont default there', () => {
    const resolved = withDefaultFonts(fontFile(undefined, [systemFont()]), DEFAULTS) as FontFileResource;
    expect(baseOf(resolved.fallbacks[0]!)).toBe(SYSTEM_DEFAULT);
  });
});

describe('withDefaultFonts — fonts with a face of their own', () => {
  it('leaves a variation that names a FontFile base as it is', () => {
    const named = variation(fontFile(new ArrayBuffer(4)));
    expect(withDefaultFonts(named, DEFAULTS)).toBe(named);
  });

  it('puts the default under a fallback after one that draws, as the fallback chain reaches it', () => {
    const wrapper = fontFile(undefined, [fontFile(new ArrayBuffer(4)), systemFont()]);
    const resolved = withDefaultFonts(wrapper, DEFAULTS) as FontFileResource;
    expect(baseOf(resolved.fallbacks[1]!)).toBe(SYSTEM_DEFAULT);
  });

  it('puts the default under a fallback of a FontFile with bytes', () => {
    const file = fontFile(new ArrayBuffer(4), [systemFont()]);
    const resolved = withDefaultFonts(file, DEFAULTS) as FontFileResource;
    expect(baseOf(resolved.fallbacks[0]!)).toBe(SYSTEM_DEFAULT);
  });

  it('leaves a FontFile with bytes and no fallbacks as it is', () => {
    const file = fontFile(new ArrayBuffer(4));
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
  it('answers the same object for the same font and defaults, so a metrics cache keeps its hits', () => {
    const bare = variation(null);
    expect(withDefaultFonts(bare, DEFAULTS)).toBe(withDefaultFonts(bare, DEFAULTS));
  });

  it('resolves a default that two fonts reach to one object, so a cache keyed on it keeps its hits', () => {
    const sharedDefault: FontVariationResource = { ...variation(null), fallbacks: [systemFont()] };
    const defaults: DefaultFonts = { variation: [sharedDefault], system: [SYSTEM_DEFAULT] };
    const [first, second] = [variation(null), variation(null, '2')].map((font) =>
      withDefaultFonts(font, defaults)
    );
    const defaultUnder = (font: FontResource | null) => (font?.kind === 'variation' ? font.baseFont : null);
    expect(defaultUnder(first)).toBe(defaultUnder(second));
  });

  it('answers a new object for another default font', () => {
    const bare = variation(null);
    const other: DefaultFonts = { ...DEFAULTS, variation: [fontFile(new ArrayBuffer(4))] };
    expect(withDefaultFonts(bare, DEFAULTS)).not.toBe(withDefaultFonts(bare, other));
  });
});

describe('withDefaultFonts — a default that is the font itself (`_is_base_cyclic`, font.cpp:152-169)', () => {
  it('skips a SystemFont default that is the SystemFont, and takes the next', () => {
    const font = systemFont();
    expect(baseOf(withDefaultFonts(font, { ...DEFAULTS, system: [font, SYSTEM_DEFAULT] }))).toBe(
      SYSTEM_DEFAULT
    );
  });

  it('skips a default whose base_font chain reaches the font', () => {
    const font = systemFont();
    const over = variation(font);
    expect(baseOf(withDefaultFonts(font, { ...DEFAULTS, system: [over, SYSTEM_DEFAULT] }))).toBe(
      SYSTEM_DEFAULT
    );
  });

  it('draws no face when every SystemFont default is the SystemFont', () => {
    const font = systemFont();
    expect(baseOf(withDefaultFonts(font, { ...DEFAULTS, system: [font] }))).toBe(FACELESS_FONT);
  });

  it('draws no face when every FontVariation default is the bare FontVariation', () => {
    const bare = variation(null);
    const resolved = withDefaultFonts(bare, { ...DEFAULTS, variation: [bare] }) as FontVariationResource;
    expect(resolved.baseFont).toBe(FACELESS_FONT);
  });

  it('gives a default with no face of its own its own default', () => {
    const font = systemFont();
    const other = systemFont();
    const resolved = withDefaultFonts(font, { ...DEFAULTS, system: [other, SYSTEM_DEFAULT] });
    expect(baseOf(baseOf(resolved))).toBe(SYSTEM_DEFAULT);
  });

  it('gives the fallback after one with no face its default too', () => {
    const font = systemFont();
    const bare = variation(null);
    const file = fontFile(undefined, [font, bare]);
    const resolved = withDefaultFonts(file, { ...DEFAULTS, system: [font] }) as FontFileResource;
    expect((resolved.fallbacks[1] as FontVariationResource).baseFont).toBe(VARIATION_DEFAULT);
  });

  it('draws no face for two SystemFonts that are each the default of the other', () => {
    const first = systemFont();
    const second = systemFont();
    const defaults = { ...DEFAULTS, system: [second, first] };
    expect(findDrawnFace(withDefaultFonts(first, defaults))).toBe(NO_FACE);
  });

  it('resolves a default whose SystemFont fallbacks each take it again once, not once per path', () => {
    const variationDefault: FontVariationResource = {
      ...variation(null),
      fallbacks: [systemFont(), systemFont()],
    };
    const defaults = { variation: [variationDefault], system: [variationDefault] };
    expect(findDrawnFace(withDefaultFonts(variationDefault, defaults))).toBe(NO_FACE);
  });
});
