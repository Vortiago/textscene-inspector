import { describe, expect, it, vi } from 'vitest';
import type { FontResource } from '../../../../resources/fonts/font/types';
import { woffFromSfnt } from './fontContainer.testkit';
import { fontWork, sceneFontSettleCount } from './sceneFontLoader';
import { peekSceneFontOutlines, peekVariedStrokeOutlines } from './sceneFontOutlines';
import { fixtureFontBytes, fontFile } from './sfntOutlines.testkit';

const woffOfOpenSans = () =>
  fontFile(woffFromSfnt(fixtureFontBytes('open-sans-semibold-subset.ttf'), { compress: true }));

async function settledOutlines(font: FontResource | null) {
  await vi.waitFor(() => expect(peekSceneFontOutlines(font)).not.toBeUndefined());
  return peekSceneFontOutlines(font);
}

describe('peekSceneFontOutlines', () => {
  it('answers undefined while a WOFF decompresses, then its outlines', async () => {
    const font = woffOfOpenSans();

    expect(peekSceneFontOutlines(font)).toBeUndefined();

    const outlines = await settledOutlines(font);
    expect(outlines?.glyphIndex(0x48)).toBe(20);
  });

  it('counts a settled load once, so a reader that built without the outlines reads them again', async () => {
    const font = woffOfOpenSans();
    const before = sceneFontSettleCount();

    await settledOutlines(font);

    expect(sceneFontSettleCount()).toBe(before + 1);
  });

  it('answers one outlines object for every peek of one font file', async () => {
    const font = woffOfOpenSans();
    const outlines = await settledOutlines(font);

    expect(peekSceneFontOutlines(font)).toBe(outlines);
  });

  it('starts one load for a font file that two peeks ask for before it settles', async () => {
    const font = woffOfOpenSans();
    const before = sceneFontSettleCount();

    peekSceneFontOutlines(font);
    await settledOutlines(font);

    expect(sceneFontSettleCount()).toBe(before + 1);
  });

  it('counts the load as font work until it settles, so a capture waits for the outlines', async () => {
    const font = woffOfOpenSans();

    peekSceneFontOutlines(font);
    expect(fontWork.pending()).toBe(1);

    await settledOutlines(font);
    await vi.waitFor(() => expect(fontWork.pending()).toBe(0));
  });

  it('answers null for a font file whose bytes hold no outlines', async () => {
    expect(await settledOutlines(fontFile(new ArrayBuffer(8)))).toBeNull();
  });

  it('answers null for a SystemFont, which has no bytes to read', () => {
    const font: FontResource = { kind: 'system', fontNames: ['sans-serif'], properties: {} };

    expect(peekSceneFontOutlines(font)).toBeNull();
  });

  it('reads the face behind a FontVariation', async () => {
    const base = woffOfOpenSans();
    const variation: FontResource = { kind: 'variation', baseFont: base, properties: {} };

    expect(await settledOutlines(variation)).toBe(await settledOutlines(base));
  });

  it('reads the bundled Open Sans for no font', async () => {
    const outlines = await settledOutlines(null);

    expect(outlines?.glyphIndex(0x48)).toBe(43);
  });

  it('reads the bundled Open Sans for a FontVariation with no base_font', async () => {
    const variation: FontResource = { kind: 'variation', baseFont: null, properties: {} };

    expect(await settledOutlines(variation)).toBe(await settledOutlines(null));
  });
});

describe('peekVariedStrokeOutlines', () => {
  it('answers null without an outline, so a plain label never loads outlines', () => {
    const font = woffOfOpenSans();

    expect(peekVariedStrokeOutlines(font, { embolden: 1 }, false)).toBeNull();
    expect(peekSceneFontOutlines(font)).toBeUndefined();
  });

  it('answers null for a face with no embolden and no skew, whose stroke follows the glyph as it is', () => {
    expect(peekVariedStrokeOutlines(woffOfOpenSans(), {}, true)).toBeNull();
    expect(peekVariedStrokeOutlines(woffOfOpenSans(), { embolden: 0, skew: 0 }, true)).toBeNull();
  });

  it.each([
    ['an emboldened', { embolden: 1 }],
    ['a sheared', { skew: 0.3 }],
  ])('answers the outlines of the font once %s face has an outline', async (_, variation) => {
    const font = woffOfOpenSans();

    expect(peekVariedStrokeOutlines(font, variation, true)).toBeUndefined();

    const outlines = await settledOutlines(font);
    expect(peekVariedStrokeOutlines(font, variation, true)).toBe(outlines);
  });
});
