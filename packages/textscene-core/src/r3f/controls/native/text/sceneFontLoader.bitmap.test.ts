import { describe, expect, it } from 'vitest';
import type { FontFileResource, FontResource } from '../../../../resources/fonts/font/types';
import { testBitmapFont } from './bitmapFontMetrics.testkit';
import { isBitmapFontMetrics } from './bitmapFontMetrics';
import { peekSceneFontMetrics, peekSettledSceneFontMetrics } from './sceneFontLoader';

const bitmapFile = (): FontFileResource => ({
  kind: 'file',
  bytes: undefined,
  mimeType: undefined,
  fallbacks: [],
  properties: {},
  bitmap: testBitmapFont(),
});

describe('peekSceneFontMetrics on a BMFont', () => {
  it('answers at once with the bitmap metrics of the font', () => {
    const metrics = peekSceneFontMetrics(bitmapFile(), '/Root/Label');

    expect(isBitmapFontMetrics(metrics)).toBe(true);
  });

  it('keeps one metrics object for a font, so a layout memoised on it keeps its hits', () => {
    const font = bitmapFile();

    expect(peekSceneFontMetrics(font, '/Root/A')).toBe(peekSceneFontMetrics(font, '/Root/B'));
  });

  it('reads the base font of a variation', () => {
    const variation: FontResource = { kind: 'variation', baseFont: bitmapFile(), properties: {} };

    expect(isBitmapFontMetrics(peekSettledSceneFontMetrics(variation, '/Root/Label') ?? undefined)).toBe(
      true
    );
  });

  it('adds the embolden of a variation to the advance, as Godot does for any face', () => {
    const variation: FontResource = {
      kind: 'variation',
      baseFont: bitmapFile(),
      properties: { variation_embolden: '1' },
    };

    expect(peekSceneFontMetrics(variation, '/Root/Label').embolden).toBe(1);
  });

  it('reads the BMFont a wrapper without bytes lists as its fallback', () => {
    const wrapper: FontFileResource = { ...bitmapFile(), bitmap: undefined, fallbacks: [bitmapFile()] };

    expect(isBitmapFontMetrics(peekSceneFontMetrics(wrapper, '/Root/Label'))).toBe(true);
  });
});
