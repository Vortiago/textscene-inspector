import { describe, expect, it, vi } from 'vitest';
import type { FontResource } from '../../../../resources/fonts/font/types';
import { woffFromSfnt } from './fontContainer.testkit';
import { fontWork, sceneFontSettleCount } from './settledChannel';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import { createRuntimeFontMetrics } from './runtimeFontMetrics';
import { peekBundledGlyphOutlines, peekGlyphOutlines, peekSceneFontOutlines } from './sceneFontOutlines';
import { openFontOutlines } from './sfntOutlines';
import { bundledFontBytes } from './bundledFontBytes';
import { Hinting, type FontHinting } from '../../../../godot/text/textServerEnums';
import { FACELESS_FONT, type FileWithBytes } from './sceneFontResolution';
import { charContours, fixtureFontBytes, fontFile, systemFont } from './sfntOutlines.testkit';
import autoHintedReference from './autofit/autoHinting.godot.json';
import { referencePoints, type ReferenceGlyph } from './glyphVariation.testkit';

/** A font file that holds `bytes`, the face it draws. */
const fileFace = (bytes: ArrayBuffer): FileWithBytes => ({ ...fontFile(bytes), bytes });

const woffOfOpenSans = () =>
  fileFace(woffFromSfnt(fixtureFontBytes('open-sans-semibold-subset.ttf'), { compress: true }));

async function settledOutlines(font: FontResource | null) {
  await vi.waitFor(() => expect(peekSceneFontOutlines(font)).not.toBeUndefined());
  return peekSceneFontOutlines(font);
}

describe('peekSceneFontOutlines', () => {
  it('lacks every glyph for a font with no face, so a TextMesh draws each as its fallback quad', () => {
    expect(peekSceneFontOutlines(FACELESS_FONT)?.glyphIndex('H'.codePointAt(0)!)).toBe(0);
  });

  it('answers undefined while a WOFF decompresses, then its outlines', async () => {
    const font = woffOfOpenSans();

    expect(peekSceneFontOutlines(font)).toBeUndefined();

    const outlines = await settledOutlines(font);
    expect(outlines?.glyphIndex(0x48)).toBe(20);
  });

  it('loads a FontFile with `force_autohinter` on through the auto-hinter, as Godot does', async () => {
    const font = {
      ...fileFace(fixtureFontBytes('open-sans-semibold-subset.ttf')),
      properties: { force_autohinter: 'true' },
    };
    const godot = (autoHintedReference as ReferenceGlyph[]).find(
      (glyph) =>
        glyph.forceAutohinter &&
        glyph.font === 'open-sans-semibold-subset.ttf' &&
        glyph.char === 'H' &&
        glyph.sizePx === 16
    )!;

    const outlines = (await settledOutlines(font))!;

    expect(referencePoints(charContours(outlines, 'H', 16).points)).toEqual(godot.points);
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

  it('reads the face behind a FontVariation', async () => {
    const base = woffOfOpenSans();
    const variation: FontResource = { kind: 'variation', baseFont: base, fallbacks: [], properties: {} };

    expect(await settledOutlines(variation)).toBe(await settledOutlines(base));
  });

  it('reads the bundled Open Sans for no font', async () => {
    const outlines = await settledOutlines(null);

    expect(outlines?.glyphIndex(0x48)).toBe(43);
  });

  it('reads the bundled Open Sans for a FontVariation with no base_font', async () => {
    const variation: FontResource = { kind: 'variation', baseFont: null, fallbacks: [], properties: {} };

    expect(await settledOutlines(variation)).toBe(await settledOutlines(null));
  });

  it('reads the bundled Open Sans for a SystemFont, as Godot does when no OS font matches its names', async () => {
    const font = systemFont();

    expect(await settledOutlines(font)).toBe(await settledOutlines(null));
  });

  it('answers null for a font file with no bytes and no fallback', () => {
    expect(peekSceneFontOutlines(fontFile(undefined, []))).toBeNull();
  });
});

describe('peekGlyphOutlines', () => {
  const canvasFace = createRuntimeFontMetrics({
    hasGlyph: () => true,
    scalars: { unitsPerEm: 1000, ascent: 800, descent: 200 },
    measureWidthUnits: (text) => text.length * 500,
    cssFontFamily: 'scene-font-test',
  });

  it('answers null for an atlas face, which has no contour to follow', () => {
    const font = woffOfOpenSans();

    expect(peekGlyphOutlines(font, OPEN_SANS_FONT_METRICS)).toBeNull();
    expect(peekSceneFontOutlines(font)).toBeUndefined();
  });

  async function settledGlyphOutlines(font: FileWithBytes) {
    await vi.waitFor(() => expect(peekGlyphOutlines(font, canvasFace)).not.toBeUndefined());
    return peekGlyphOutlines(font, canvasFace)!;
  }

  async function referenceContours(name: string, hinting: FontHinting) {
    const outlines = await openFontOutlines(fixtureFontBytes(name), { hinting, isAutohinterForced: false });
    return charContours(outlines!, 'a', 16);
  }

  // Godot draws every glyph from its outline (`text_server_adv.cpp:1360-1393`), varied or not.
  it('answers undefined while the outlines of a canvas face load, then the outlines', async () => {
    const font = woffOfOpenSans();

    expect(peekGlyphOutlines(font, canvasFace)).toBeUndefined();

    expect((await settledGlyphOutlines(font)).glyphIndex(0x48)).toBe(20);
  });

  it('loads the glyphs of a font file at light hinting, the default Godot draws them at', async () => {
    const font = fileFace(fixtureFontBytes('open-sans-semibold-subset.ttf'));

    const outlines = await settledGlyphOutlines(font);

    expect(charContours(outlines, 'a', 16)).toEqual(
      await referenceContours('open-sans-semibold-subset.ttf', Hinting.LIGHT)
    );
  });

  it('loads the glyphs at the hinting the font file sets', async () => {
    const font = {
      ...fileFace(fixtureFontBytes('open-sans-semibold-subset.ttf')),
      properties: { hinting: '0' },
    };

    const outlines = await settledGlyphOutlines(font);

    expect(charContours(outlines, 'a', 16)).toEqual(
      await referenceContours('open-sans-semibold-subset.ttf', Hinting.NONE)
    );
  });
});

describe('peekBundledGlyphOutlines', () => {
  it('reads the bundled Open Sans at the hinting the project sets', async () => {
    await vi.waitFor(() => expect(peekBundledGlyphOutlines(Hinting.NORMAL)).not.toBeUndefined());
    const bundled = await openFontOutlines(bundledFontBytes(), {
      hinting: Hinting.NORMAL,
      isAutohinterForced: false,
    });

    expect(charContours(peekBundledGlyphOutlines(Hinting.NORMAL)!, 'a', 16)).toEqual(
      charContours(bundled!, 'a', 16)
    );
  });
});
