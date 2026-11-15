/** The states of a font read through the settled fonts of one preview (`readSettledFont`), with a face loader the test settles by hand. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../../logger';
import { TEST_SCENE_FONT_METRICS } from '../testing/sceneFontMetrics';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import type { RegisteredCanvasFontMetrics } from './runtimeFontMetrics';
import { readSettledFont } from './sceneFontLoader';
import { createSettledFonts, UNOPENED_FACE, type SettledFonts } from './settledFonts';
import { NO_FACE_METRICS } from './noFaceMetrics';
import { UNOPENED_FACE_METRICS } from './unopenedFaceMetrics';
import { handLoader, type HandLoader } from './settledFonts.testkit';
import { fontFile } from './sfntOutlines.testkit';
import type { FontResource } from '../../../../resources/fonts/font/types';

const FACE = TEST_SCENE_FONT_METRICS as RegisteredCanvasFontMetrics;
const FALLBACK_FACE = { ...FACE } as RegisteredCanvasFontMetrics;

/**
 * What `font` reads once nothing it waits on is the face loader: a settled face starts the load of
 * its outlines, which these bytes hold none of.
 */
function readOnceOutlinesSettle(font: FontResource) {
  return vi.waitFor(() => {
    const settled = readSettledFont(fonts, font, 'Label');
    expect(settled.status).not.toBe('loading');
    return settled;
  });
}

let loader: HandLoader;
let fonts: SettledFonts;

beforeEach(() => {
  loader = handLoader();
  fonts = createSettledFonts(loader.load);
  vi.spyOn(logger, 'warn').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('readSettledFont', () => {
  it('is none for no font set', () => {
    expect(readSettledFont(fonts, null, 'Label')).toEqual({ status: 'none' });
  });

  it('is loading while the face of a font file loads', () => {
    const font = fontFile(new ArrayBuffer(4));

    expect(readSettledFont(fonts, font, 'Label')).toEqual({ status: 'loading' });
  });

  it('settles on the face and the chain once the face loads', async () => {
    const bytes = new ArrayBuffer(4);
    const font = fontFile(bytes);
    readSettledFont(fonts, font, 'Label');

    await loader.settle(bytes, FACE);

    const settled = await readOnceOutlinesSettle(font);
    expect(settled).toMatchObject({ status: 'settled', face: { cssFontFamily: FACE.cssFontFamily } });
    expect(settled.status === 'settled' && settled.chain.map(({ font: face }) => face)).toEqual([font]);
  });

  it('keeps the identity of a settled answer, so a reader that compares it sees no change', async () => {
    const bytes = new ArrayBuffer(4);
    const font = fontFile(bytes);
    readSettledFont(fonts, font, 'Label');
    await loader.settle(bytes, FACE);

    expect(readSettledFont(fonts, font, 'Label')).toBe(readSettledFont(fonts, font, 'Label'));
  });

  it('settles on the bundled face, with a warning, for a face that fails to load', async () => {
    const bytes = new ArrayBuffer(4);
    const font = fontFile(bytes);
    readSettledFont(fonts, font, 'Label');

    await loader.settle(bytes, null);

    expect(readSettledFont(fonts, font, 'Label')).toMatchObject({
      status: 'settled',
      face: { ascent: OPEN_SANS_FONT_METRICS.ascent },
      chain: [{ font, isStandIn: true }],
    });
  });

  it('settles on a face that draws nothing for a face FreeType cannot open, in place of the bundled face', async () => {
    const bytes = new ArrayBuffer(4);
    const font = fontFile(bytes);
    readSettledFont(fonts, font, 'Label');

    await loader.settle(bytes, UNOPENED_FACE);

    expect(readSettledFont(fonts, font, 'Label')).toMatchObject({
      status: 'settled',
      face: UNOPENED_FACE_METRICS,
      chain: [{ font, metrics: UNOPENED_FACE_METRICS }],
    });
  });

  it('keeps a fallback after a first face FreeType cannot open, which takes every character first', async () => {
    const [ownBytes, fallbackBytes] = [new ArrayBuffer(4), new ArrayBuffer(4)];
    const fallback = fontFile(fallbackBytes);
    const font = fontFile(ownBytes, [fallback]);
    readSettledFont(fonts, font, 'Label');

    await loader.settle(ownBytes, UNOPENED_FACE);
    await loader.settle(fallbackBytes, FACE);

    const settled = await readOnceOutlinesSettle(font);
    expect(settled.status === 'settled' && settled.chain.map(({ font: face }) => face)).toEqual([
      font,
      fallback,
    ]);
  });

  it('keeps a fallback FreeType cannot open in its chain, where it takes what the faces before it lack', async () => {
    const [ownBytes, fallbackBytes] = [new ArrayBuffer(4), new ArrayBuffer(4)];
    const font = fontFile(ownBytes, [fontFile(fallbackBytes)]);
    readSettledFont(fonts, font, 'Label');

    await loader.settle(ownBytes, FACE);
    await loader.settle(fallbackBytes, UNOPENED_FACE);

    const settled = await readOnceOutlinesSettle(font);
    expect(settled.status === 'settled' && settled.chain[1]?.metrics).toBe(UNOPENED_FACE_METRICS);
  });

  it('settles at once on a face with no glyphs for an empty font file, which loads nothing (edge case)', () => {
    const font = fontFile(new ArrayBuffer(0));

    expect(readSettledFont(fonts, font, 'Label')).toMatchObject({
      status: 'settled',
      face: NO_FACE_METRICS,
      chain: [{ font, metrics: NO_FACE_METRICS }],
    });
  });

  it('is loading while one fallback of a settled face still loads', async () => {
    const [ownBytes, fallbackBytes] = [new ArrayBuffer(4), new ArrayBuffer(4)];
    const font = fontFile(ownBytes, [fontFile(fallbackBytes)]);
    readSettledFont(fonts, font, 'Label');

    await loader.settle(ownBytes, FACE);
    expect(readSettledFont(fonts, font, 'Label')).toEqual({ status: 'loading' });

    await loader.settle(fallbackBytes, FALLBACK_FACE);
    expect(await readOnceOutlinesSettle(font)).toMatchObject({ status: 'settled' });
  });

  it('answers for the font a reader reads now, when its font changes while the first one loads', async () => {
    const [firstBytes, secondBytes] = [new ArrayBuffer(4), new ArrayBuffer(4)];
    const [first, second] = [fontFile(firstBytes), fontFile(secondBytes)];
    readSettledFont(fonts, first, 'Label');
    readSettledFont(fonts, second, 'Label');

    await loader.settle(secondBytes, FACE);

    expect(await readOnceOutlinesSettle(second)).toMatchObject({ status: 'settled' });
    expect(readSettledFont(fonts, first, 'Label')).toEqual({ status: 'loading' });
  });
});

describe('SettledFonts wake', () => {
  it('wakes the readers of a font that was read while it loaded, and of no other font', async () => {
    const [readBytes, otherBytes] = [new ArrayBuffer(4), new ArrayBuffer(4)];
    const [read, other] = [fontFile(readBytes), fontFile(otherBytes)];
    const [onRead, onOther] = [vi.fn(), vi.fn()];
    fonts.subscribeFont(read, onRead);
    fonts.subscribeFont(other, onOther);
    readSettledFont(fonts, read, 'Label');

    await loader.settle(readBytes, FACE);

    expect(onRead).toHaveBeenCalledTimes(1);
    expect(onOther).not.toHaveBeenCalled();
  });

  it('leaves the readers of a font that still loads asleep when another font settles', async () => {
    const [loadingBytes, settlingBytes] = [new ArrayBuffer(4), new ArrayBuffer(4)];
    const [loading, settling] = [fontFile(loadingBytes), fontFile(settlingBytes)];
    const onLoading = vi.fn();
    fonts.subscribeFont(loading, onLoading);
    readSettledFont(fonts, loading, 'Label');
    readSettledFont(fonts, settling, 'Label');

    await loader.settle(settlingBytes, FACE);

    expect(onLoading).not.toHaveBeenCalled();
  });

  it('wakes no reader of another preview', async () => {
    const bytes = new ArrayBuffer(4);
    const font = fontFile(bytes);
    const otherPreview = createSettledFonts(loader.load);
    const onOtherPreview = vi.fn();
    otherPreview.subscribe(onOtherPreview);
    readSettledFont(fonts, font, 'Label');

    await loader.settle(bytes, FACE);

    expect(onOtherPreview).not.toHaveBeenCalled();
  });
});

describe('SettledFonts loads of the page', () => {
  it('loads the face of bytes once for every preview that peeks them', async () => {
    const bytes = new ArrayBuffer(4);
    const load = vi.fn(() => Promise.resolve(FACE));
    const previews = [createSettledFonts(load), createSettledFonts(load)];

    previews.forEach((preview) => preview.peekFace(bytes, 'Label'));
    await vi.waitFor(() =>
      expect(previews.map((preview) => preview.peekFace(bytes, 'Label'))).toEqual([FACE, FACE])
    );

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('reads the outlines of a load once for every preview that peeks it', async () => {
    const loadKey = {};
    const read = vi.fn(() => Promise.resolve(null));
    const previews = [createSettledFonts(loader.load), createSettledFonts(loader.load)];

    previews.forEach((preview) => preview.peekOutlines(loadKey, read));
    await vi.waitFor(() =>
      expect(previews.map((preview) => preview.peekOutlines(loadKey, read))).toEqual([null, null])
    );

    expect(read).toHaveBeenCalledTimes(1);
  });

  it('wakes the readers of each preview that awaited the shared load', async () => {
    const bytes = new ArrayBuffer(4);
    const font = fontFile(bytes);
    const otherPreview = createSettledFonts(loader.load);
    const onEachPreview = [vi.fn(), vi.fn()];
    [fonts, otherPreview].forEach((preview, i) => {
      preview.subscribeFont(font, onEachPreview[i]!);
      readSettledFont(preview, font, 'Label');
    });

    await loader.settle(bytes, FACE);

    onEachPreview.forEach((onSettle) => expect(onSettle).toHaveBeenCalled());
  });
});
