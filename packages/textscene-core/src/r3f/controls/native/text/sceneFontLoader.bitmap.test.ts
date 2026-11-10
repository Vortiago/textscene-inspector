import { describe, expect, it } from 'vitest';
import type { FontFileResource, FontResource } from '../../../../resources/fonts/font/types';
import { bitmapFontFile } from './bitmapFontMetrics.testkit';
import { isBitmapFontMetrics } from './bitmapFontMetrics';
import { peekSceneFontMetrics, peekSettledSceneFontMetrics } from './sceneFontLoader';

describe('peekSceneFontMetrics on a BMFont', () => {
  it('answers at once with the bitmap metrics of the font', () => {
    const metrics = peekSceneFontMetrics(bitmapFontFile(), '/Root/Label');

    expect(isBitmapFontMetrics(metrics)).toBe(true);
  });

  it('keeps one metrics object for a font, so a layout memoised on it keeps its hits', () => {
    const font = bitmapFontFile();

    expect(peekSceneFontMetrics(font, '/Root/A')).toBe(peekSceneFontMetrics(font, '/Root/B'));
  });

  it('reads the base font of a variation', () => {
    const variation: FontResource = {
      kind: 'variation',
      baseFont: bitmapFontFile(),
      fallbacks: [],
      properties: {},
    };

    expect(isBitmapFontMetrics(peekSettledSceneFontMetrics(variation, '/Root/Label') ?? undefined)).toBe(
      true
    );
  });

  it('adds the embolden of a variation to the advance, as Godot does for any face', () => {
    const variation: FontResource = {
      kind: 'variation',
      baseFont: bitmapFontFile(),
      fallbacks: [],
      properties: { variation_embolden: '1' },
    };

    expect(peekSceneFontMetrics(variation, '/Root/Label').embolden).toBe(1);
  });

  it('reads the BMFont a wrapper without bytes lists as its fallback', () => {
    const wrapper: FontFileResource = {
      ...bitmapFontFile(),
      bitmap: undefined,
      fallbacks: [bitmapFontFile()],
    };

    expect(isBitmapFontMetrics(peekSceneFontMetrics(wrapper, '/Root/Label'))).toBe(true);
  });
});

// `Font::_update_rids` (`font.cpp:104-123`): the faces after the font's own are its fallback chain.
describe('peekSettledSceneFontMetrics on a font with fallbacks', () => {
  it('carries the face of each fallback, in order', () => {
    const [second, third] = [bitmapFontFile(), bitmapFontFile()];
    const font: FontFileResource = { ...bitmapFontFile(), fallbacks: [second, third] };
    const metrics = peekSettledSceneFontMetrics(font, '/Root/Label')!;
    expect(metrics.fallbacks?.map((face) => isBitmapFontMetrics(face) && face.bitmap)).toEqual([
      second.bitmap,
      third.bitmap,
    ]);
  });

  it('keeps one metrics object for a font, so a layout memoised on it keeps its hits', () => {
    const font: FontFileResource = { ...bitmapFontFile(), fallbacks: [bitmapFontFile()] };
    expect(peekSettledSceneFontMetrics(font, '/Root/A')).toBe(peekSettledSceneFontMetrics(font, '/Root/B'));
  });
});
