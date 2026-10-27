import { describe, expect, it, vi } from 'vitest';
import type { FontFileResource, FontResource } from '../../../../resources/fonts/font/types';
import { woffFromSfnt } from './fontContainer.testkit';
import { sceneFontSettleCount } from './sceneFontLoader';
import { peekSceneFontOutlines } from './sceneFontOutlines';
import { fixtureFontBytes } from './sfntOutlines.testkit';

function fontFile(bytes: ArrayBuffer | undefined, fallbacks: FontResource[] = []): FontFileResource {
  return { kind: 'file', bytes, mimeType: undefined, fallbacks, properties: {} };
}

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
