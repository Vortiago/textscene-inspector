/**
 * happy-dom has neither `FontFace` nor a 2D canvas context, so a font file with bytes fails to
 * load here unless a test stubs both. These tests cover the fallback decisions, the warn-once
 * dedupe and the peek contract. `fontFaceDoor.test.ts` reaches the shared door for real.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { windowLoaded } from './fakeFontFace.testkit';
import { fixtureFontBytes, fontFile, systemFont } from './sfntOutlines.testkit';
import { peekSceneFontMetrics, peekSettledSceneFontMetrics } from './sceneFontLoader';
import { fontWork } from './settledChannel';
import { createSettledFonts, type SettledFonts } from './settledFonts';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import { FACELESS_FONT } from './sceneFontResolution';
import type { CanvasFontMetrics } from './runtimeFontMetrics';
import { getFontAscentPx, getFontRunGlyphAdvancePx, getFontLinePitchPx } from './fontMetrics';
import * as logger from '../../../../logger';
import type { FontResource } from '../../../../resources/fonts/font/types';

/**
 * The first outline load of a run imports the lazy kerning chunk, which Vite transforms cold. A warm run
 * settles in 0.2 s, but the parallel pre-push run exhausted `vi.waitFor`'s 1 s default and left the peek null.
 */
const OUTLINE_LOAD_TIMEOUT_MS = 15_000;

/** Lets every load a peek started settle: each one resolves within a macrotask here. */
function settleLoads(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * The bytes of a font FreeType opens, new on each call. happy-dom has no `FontFace`, so they fail in
 * the browser alone, which draws the bundled default in their place.
 */
function fontBytes(): ArrayBuffer {
  return fixtureFontBytes('montserrat-semibold-subset.ttf').slice(0);
}

beforeAll(windowLoaded);

/** A preview's settled fonts, new for each test, so no load of one test settles in another. */
let fonts: SettledFonts;
beforeEach(() => {
  fonts = createSettledFonts();
});

describe('peekSceneFontMetrics', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('no font authored (undefined/null): falls back to the bundled default with NO warning -- this is not a failure', () => {
    expect(peekSceneFontMetrics(fonts, undefined, 'Root/Label')).toBe(OPEN_SANS_FONT_METRICS);
    expect(peekSceneFontMetrics(fonts, null, 'Root/Label')).toBe(OPEN_SANS_FONT_METRICS);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('a SystemFont draws the bundled default with no warning, as Godot does when no OS font matches its names', () => {
    const font = systemFont();
    expect(peekSceneFontMetrics(fonts, font, 'Root/MyLabel')).toBe(OPEN_SANS_FONT_METRICS);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('a bytes-less FontFile with no resolvable fallback warns with the node path and falls back', () => {
    const wrapper = fontFile(undefined, []);
    const metrics = peekSceneFontMetrics(fonts, wrapper, 'Root/B');
    expect(metrics).toBe(OPEN_SANS_FONT_METRICS);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain('Root/B');
  });

  it('warns at most once for the SAME unresolvable resource object across repeated peeks -- no per-frame warning spam', () => {
    const wrapper = fontFile(undefined, []);
    peekSceneFontMetrics(fonts, wrapper, 'Root/A');
    peekSceneFontMetrics(fonts, wrapper, 'Root/A');
    peekSceneFontMetrics(fonts, wrapper, 'Root/A');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('peekSceneFontMetrics returns the bundled default synchronously while a real load would still be in flight, and never throws', () => {
    const leaf = fontFile(fontBytes());
    const metrics = peekSceneFontMetrics(fonts, leaf, 'Root/D');
    expect(metrics).toBe(OPEN_SANS_FONT_METRICS);
  });
});

describe('peekSettledSceneFontMetrics — a font with no face', () => {
  // `text_server_adv.cpp:6894-6895`: the line holds a hex-code box, 15 cells of `round(size / 15)` px.
  it('holds a hex-code box line: 0.85 of the box above the baseline, 0.15 below', () => {
    const metrics = peekSettledSceneFontMetrics(fonts, FACELESS_FONT, 'Label')!;
    expect([getFontAscentPx(metrics, 56), getFontLinePitchPx(metrics, 56, 0)]).toEqual([51, 60]);
  });

  it('has a glyph for no character, so each draws as a hex-code box', () => {
    expect(peekSettledSceneFontMetrics(fonts, FACELESS_FONT, 'Label')!.getGlyphAdvanceUnits('H')).toBeNull();
  });

  it('keeps a cell of 1 px at a size whose cell rounds to 0', () => {
    expect(getFontAscentPx(peekSettledSceneFontMetrics(fonts, FACELESS_FONT, 'Label')!, 6)).toBe(12.75);
  });
});

describe('peekSettledSceneFontMetrics', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('answers the bundled default at once for no font and for a font that cannot load, which settle by themselves', () => {
    expect(peekSettledSceneFontMetrics(fonts, undefined, 'Root/Mesh')).toBe(OPEN_SANS_FONT_METRICS);
    expect(peekSettledSceneFontMetrics(fonts, fontFile(undefined, []), 'Root/Mesh')).toBe(
      OPEN_SANS_FONT_METRICS
    );
  });

  it('answers null while the load a peek starts is in flight, then the metrics it settles on', async () => {
    const leaf = fontFile(fontBytes());
    expect(peekSettledSceneFontMetrics(fonts, leaf, 'Root/Mesh')).toBeNull();
    await settleLoads();
    expect(peekSettledSceneFontMetrics(fonts, leaf, 'Root/Mesh')).toBe(OPEN_SANS_FONT_METRICS);
  });

  it('shares the load with peekSceneFontMetrics, which answers the default meanwhile', async () => {
    const leaf = fontFile(fontBytes());
    expect(peekSceneFontMetrics(fonts, leaf, 'Root/Label')).toBe(OPEN_SANS_FONT_METRICS);
    expect(peekSettledSceneFontMetrics(fonts, leaf, 'Root/Mesh')).toBeNull();
    await settleLoads();
    expect(peekSettledSceneFontMetrics(fonts, leaf, 'Root/Mesh')).toBe(
      peekSceneFontMetrics(fonts, leaf, 'Root/Label')
    );
  });

  it('settles the bundled face with no outlines, since the canvas face it draws as reads them', async () => {
    const font = fontFile(fixtureFontBytes('open-sans-semibold-subset.ttf'));
    peekSettledSceneFontMetrics(fonts, font, 'Root/Bundled');
    await vi.waitFor(() => expect(peekSettledSceneFontMetrics(fonts, font, 'Root/Bundled')).not.toBeNull());
    await settleLoads();
    expect(peekSettledSceneFontMetrics(fonts, font, 'Root/Bundled')?.outlines).toBeUndefined();
  });

  it('carries the embolden of a variation over a settled face', async () => {
    const leaf = fontFile(fontBytes());
    const variation: FontResource = {
      kind: 'variation',
      baseFont: leaf,
      fallbacks: [],
      properties: { variation_embolden: '0.5' },
    };
    expect(peekSettledSceneFontMetrics(fonts, variation, 'Root/Mesh')).toBeNull();
    await settleLoads();
    expect(peekSettledSceneFontMetrics(fonts, variation, 'Root/Mesh')?.embolden).toBe(0.5);
  });
});

describe('peekSceneFontMetrics — FontVariation embolden', () => {
  const bytes = fontBytes();

  function variation(baseFont: FontResource | null, properties: Record<string, string>): FontResource {
    return { kind: 'variation', baseFont, fallbacks: [], properties };
  }

  async function settledPeek(font: FontResource) {
    peekSceneFontMetrics(fonts, font, 'Root/Label');
    await settleLoads();
    return peekSceneFontMetrics(fonts, font, 'Root/Label');
  }

  it("carries the variation's variation_embolden on the metrics of its base face", async () => {
    const metrics = await settledPeek(variation(fontFile(bytes), { variation_embolden: '1.2' }));
    expect(metrics.embolden).toBe(1.2);
    expect(metrics.getGlyphAdvanceUnits('A')).toBe(OPEN_SANS_FONT_METRICS.getGlyphAdvanceUnits('A'));
    expect(metrics.kind).toBe(OPEN_SANS_FONT_METRICS.kind);
  });

  it('returns the same metrics object on every peek, and for two variations of one face with one embolden', async () => {
    const face = fontFile(bytes);
    const first = variation(face, { variation_embolden: '1.2' });
    const settled = await settledPeek(first);
    expect(peekSceneFontMetrics(fonts, first, 'Root/Label')).toBe(settled);
    expect(peekSceneFontMetrics(fonts, variation(face, { variation_embolden: '1.2' }), 'Root/Other')).toBe(
      settled
    );
  });

  it('leaves the base face untouched when the variation has no embolden, or an embolden of 0', async () => {
    expect(await settledPeek(variation(fontFile(bytes), {}))).toBe(OPEN_SANS_FONT_METRICS);
    expect(await settledPeek(variation(fontFile(bytes), { variation_embolden: '0.0' }))).toBe(
      OPEN_SANS_FONT_METRICS
    );
  });

  it('wraps the bundled face, silently and at once, for a variation with no base_font (#955)', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    try {
      const metrics = peekSceneFontMetrics(
        fonts,
        variation(null, { variation_embolden: '1.2' }),
        'Root/Bare'
      );
      expect(metrics.embolden).toBe(1.2);
      expect(metrics.kind).toBe(OPEN_SANS_FONT_METRICS.kind);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('wraps the bundled face for a variation over a SystemFont, as for a variation with no base_font', () => {
    const system = systemFont();
    const embolden = { variation_embolden: '1.2' };
    expect(peekSceneFontMetrics(fonts, variation(system, embolden), 'Root/OverSystem')).toBe(
      peekSceneFontMetrics(fonts, variation(null, embolden), 'Root/Bare')
    );
  });

  it("takes the outer variation's embolden over a bare variation, and the bundled face with none", () => {
    const bare = variation(null, { variation_embolden: '2.0' });
    expect(
      peekSceneFontMetrics(fonts, variation(bare, { variation_embolden: '1.2' }), 'Root/Over').embolden
    ).toBe(1.2);
    expect(peekSceneFontMetrics(fonts, variation(null, {}), 'Root/Plain')).toBe(OPEN_SANS_FONT_METRICS);
  });

  it("carries the variation's variation_transform skew, on a settled face and on the bundled one", async () => {
    const transform = { variation_transform: 'Transform2D(1, 0.2, 0, 1, 0, 0)' };
    expect((await settledPeek(variation(fontFile(bytes), transform))).skew).toBe(0.2);
    expect(peekSceneFontMetrics(fonts, variation(null, transform), 'Root/Bare').skew).toBe(0.2);
  });

  it('draws the bundled face with no embolden while the base face is still loading', () => {
    const metrics = peekSceneFontMetrics(
      fonts,
      variation(fontFile(fontBytes()), { variation_embolden: '1.2' }),
      'Root/L'
    );
    expect(metrics.embolden).toBeUndefined();
  });
});

describe('SettledFonts.subscribe', () => {
  it('(happy) fires once the load a peek starts for a resolvable resource settles', async () => {
    const listener = vi.fn();
    const off = fonts.subscribe(listener);
    try {
      peekSceneFontMetrics(fonts, fontFile(fontBytes()), 'Root/E');
      await settleLoads();
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      off();
    }
  });

  it('(edge) does NOT fire for a font that short-circuits synchronously (nothing to later change value)', async () => {
    const listener = vi.fn();
    const off = fonts.subscribe(listener);
    try {
      peekSceneFontMetrics(fonts, undefined, 'Root/F');
      peekSceneFontMetrics(
        fonts,
        { kind: 'system', fontNames: [], baseFont: null, fallbacks: [], properties: {} },
        'Root/G'
      );
      await settleLoads();
      expect(listener).not.toHaveBeenCalled();
    } finally {
      off();
    }
  });

  it('(edge) an unsubscribed listener is never called again', async () => {
    const listener = vi.fn();
    const off = fonts.subscribe(listener);
    off();
    peekSceneFontMetrics(fonts, fontFile(fontBytes()), 'Root/H');
    await settleLoads();
    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies every subscribed listener, not just the first', async () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = fonts.subscribe(a);
    const offB = fonts.subscribe(b);
    try {
      peekSceneFontMetrics(fonts, fontFile(fontBytes()), 'Root/I');
      await settleLoads();
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    } finally {
      offA();
      offB();
    }
  });
});

describe('fontWork', () => {
  it('counts a font load from the peek that starts it until it settles, so a capture waits for it', async () => {
    const leaf = fontFile(fontBytes());

    peekSceneFontMetrics(fonts, leaf, 'Root/K');
    expect(fontWork.pending()).toBe(1);
    await settleLoads();

    expect(fontWork.pending()).toBe(0);
  });

  it('counts one load for two peeks of one font, which share it', async () => {
    const leaf = fontFile(fontBytes());

    peekSceneFontMetrics(fonts, leaf, 'Root/L');
    peekSettledSceneFontMetrics(fonts, leaf, 'Root/M');
    expect(fontWork.pending()).toBe(1);
    await settleLoads();

    expect(fontWork.pending()).toBe(0);
  });

  it('counts one load for a font and a copy of it with other fallbacks, which share its bytes', async () => {
    const leaf = fontFile(fontBytes());
    const copy = { ...leaf, fallbacks: [systemFont()] };

    peekSettledSceneFontMetrics(fonts, leaf, 'Root/N');
    peekSettledSceneFontMetrics(fonts, copy, 'Root/O');
    expect(fontWork.pending()).toBe(1);
    await settleLoads();

    expect(fontWork.pending()).toBe(0);
  });

  it('ends the work of a load whose settled listener throws, so a capture is not held for good', async () => {
    const off = fonts.subscribe(() => {
      throw new Error('listener failed');
    });
    // The load runs unawaited, so its rejection is the listener's error and nothing else.
    const swallow = () => undefined;
    process.on('unhandledRejection', swallow);
    try {
      peekSceneFontMetrics(fonts, fontFile(fontBytes()), 'Root/P');
      await settleLoads();
      expect(fontWork.pending()).toBe(0);
    } finally {
      off();
      process.off('unhandledRejection', swallow);
    }
  });

  it('counts no work for a font that settles by itself on the bundled default', () => {
    peekSceneFontMetrics(fonts, undefined, 'Root/N');
    peekSceneFontMetrics(
      fonts,
      { kind: 'system', fontNames: [], baseFont: null, fallbacks: [], properties: {} },
      'Root/O'
    );

    expect(fontWork.pending()).toBe(0);
  });
});

describe('SettledFonts.version', () => {
  it('rises by one for each load that settles, so a subscriber that missed the event still sees it', async () => {
    const before = fonts.version();

    peekSceneFontMetrics(fonts, fontFile(fontBytes()), 'Root/J');
    expect(fonts.version()).toBe(before);
    await settleLoads();

    expect(fonts.version()).toBe(before + 1);
  });
});

/**
 * happy-dom supplies the non-DOM environment, where a bare global read throws a ReferenceError that
 * reports a broken font rather than an absent environment. Each test imports the loader fresh.
 */
describe('scene font in an environment with no font door', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function freshLoader() {
    vi.resetModules();
    const logger = await import('../../../../logger');
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const mod = await import('./sceneFontLoader');
    const { createSettledFonts: freshFonts } = await import('./settledFonts');
    // From the same fresh graph: the static import above is a different module instance.
    const { OPEN_SANS_FONT_METRICS: bundled } = await import('./openSansFontMetrics');
    return { ...mod, fonts: freshFonts(), logger, bundled };
  }

  it('falls back to the bundled default and names the absent environment when there is no FontFace', async () => {
    const { fonts, peekSceneFontMetrics: peek, logger, bundled } = await freshLoader();

    const font = fontFile(fontBytes());
    peek(fonts, font, 'Root/NoDom');
    await settleLoads();
    expect(peek(fonts, font, 'Root/NoDom')).toBe(bundled);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('no FontFace/document.fonts in this environment')
    );
  });

  it('does the same with no `document` at all, rather than throwing off a bare global', async () => {
    vi.stubGlobal(
      'FontFace',
      class {
        load() {
          return Promise.resolve(this);
        }
      }
    );
    vi.stubGlobal('document', undefined);
    const { fonts, peekSceneFontMetrics: peek, logger, bundled } = await freshLoader();

    const font = fontFile(fontBytes());
    peek(fonts, font, 'Root/NoDocument');
    await settleLoads();
    expect(peek(fonts, font, 'Root/NoDocument')).toBe(bundled);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('no FontFace/document.fonts in this environment')
    );
  });

  it('draws the bundled default for a face that fails to load, and drops a fallback that fails', async () => {
    const { fonts, peekSettledChainFaces: peekChain, bundled } = await freshLoader();

    const fallback = fontFile(fontBytes());
    const font = fontFile(fontBytes(), [fallback]);
    peekChain(fonts, font, 'Root/NoDom');
    await settleLoads();
    expect(peekChain(fonts, font, 'Root/NoDom')).toEqual([{ font, metrics: bundled, isStandIn: true }]);
  });

  it('keeps the embolden of a FontVariation over a face that fails to load', async () => {
    const { fonts, peekSceneFontMetrics: peek } = await freshLoader();

    const font: FontResource = {
      kind: 'variation',
      baseFont: fontFile(fontBytes()),
      fallbacks: [],
      properties: { variation_embolden: '1.2' },
    };
    peek(fonts, font, 'Root/NoDom');
    await settleLoads();
    expect(peek(fonts, font, 'Root/NoDom').embolden).toBe(1.2);
  });
});

describe('peekSettledSceneFontMetrics — the glyph outlines an emboldened canvas face follows', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function loaderWithFontDoor() {
    vi.resetModules();
    // A browser with a `FontFace` door and a 2D canvas that measures every glyph 500 design units wide.
    vi.stubGlobal(
      'FontFace',
      class {
        load() {
          return Promise.resolve(this);
        }
      }
    );
    vi.stubGlobal('document', {
      fonts: { add: () => {} },
      createElement: () => ({
        getContext: () => ({
          measureText: () => ({ width: 500, actualBoundingBoxLeft: 30, actualBoundingBoxRight: 470 }),
        }),
      }),
    });
    const { fontFile: freshFontFile, fixtureFontBytes } = await import('./sfntOutlines.testkit');
    const mod = await import('./sceneFontLoader');
    const { createSettledFonts: freshFonts } = await import('./settledFonts');
    return {
      ...mod,
      fonts: freshFonts(),
      ttf: () => freshFontFile(fixtureFontBytes('open-sans-semibold-subset.ttf')),
      recursive: () => freshFontFile(fixtureFontBytes('recursive-vf-subset.woff2')),
    };
  }

  const emboldened = (base: FontResource): FontResource => ({
    kind: 'variation',
    baseFont: base,
    fallbacks: [],
    properties: { variation_embolden: '1.2' },
  });

  it('answers null while the outlines load, then the face carrying them', async () => {
    const { fonts, peekSettledSceneFontMetrics: peek, ttf } = await loaderWithFontDoor();
    const font = emboldened(ttf());
    // The first settle is the face's, which starts the load of its outlines.
    const answersAtSettle: unknown[] = [];
    fonts.subscribe(() => answersAtSettle.push(peek(fonts, font, 'Root/Bold')));

    peek(fonts, font, 'Root/Bold');
    await vi.waitFor(() => expect(peek(fonts, font, 'Root/Bold')).not.toBeNull(), OUTLINE_LOAD_TIMEOUT_MS);

    expect(answersAtSettle[0]).toBeNull();
    expect(peek(fonts, font, 'Root/Bold')?.outlines?.glyphIndex(0x48)).toBeGreaterThan(0);
  });

  it("measures each glyph's ink box with the canvas that measures its advance", async () => {
    const { fonts, peekSettledSceneFontMetrics: peek, ttf } = await loaderWithFontDoor();
    const font = ttf();

    peek(fonts, font, 'Root/Ink');
    await vi.waitFor(() => expect(peek(fonts, font, 'Root/Ink')).not.toBeNull(), OUTLINE_LOAD_TIMEOUT_MS);

    const face = peek(fonts, font, 'Root/Ink') as CanvasFontMetrics;
    expect(face.getGlyphInkUnits?.('A')).toEqual({ left: 30, right: 470 });
  });

  /** Recursive's face under a `FontVariation` at `MONO` = `mono`, once its outlines settle. */
  async function settledAtMono(mono: number) {
    const { fonts, peekSettledSceneFontMetrics: peek, recursive } = await loaderWithFontDoor();
    const font: FontResource = {
      kind: 'variation',
      baseFont: recursive(),
      fallbacks: [],
      properties: { variation_opentype: `{\n1297043023: ${mono}\n}` },
    };
    peek(fonts, font, 'Root/Label');
    await vi.waitFor(() => expect(peek(fonts, font, 'Root/Label')).not.toBeNull(), OUTLINE_LOAD_TIMEOUT_MS);
    return peek(fonts, font, 'Root/Label')!;
  }

  it('settles a variable font at an instance on its outlines, which its text and advances follow', async () => {
    const face = await settledAtMono(1);

    expect(face.drawnOpentype).toEqual(new Map([[1297043023, 1]]));
    // Recursive's `MONO` instance advances every glyph 600 of 1000 units, where `m` measures 500 at the default.
    expect(getFontRunGlyphAdvancePx(face, { char: 'm' }, 10)).toBe(6);
  });

  it('keeps a variable font at its default instance on the measured advances', async () => {
    const face = await settledAtMono(0);

    expect(face.drawnOpentype).toBeUndefined();
    expect(getFontRunGlyphAdvancePx(face, { char: 'm' }, 10)).toBe(5);
  });

  it('settles a plain canvas face on its outlines, with no variation on top', async () => {
    const { fonts, peekSettledSceneFontMetrics: peek, ttf } = await loaderWithFontDoor();
    const font = ttf();

    peek(fonts, font, 'Root/Plain');
    await vi.waitFor(() => expect(peek(fonts, font, 'Root/Plain')).not.toBeNull(), OUTLINE_LOAD_TIMEOUT_MS);

    expect(peek(fonts, font, 'Root/Plain')).toMatchObject({ embolden: 0, skew: 0 });
    expect(peek(fonts, font, 'Root/Plain')?.outlines?.glyphIndex(0x48)).toBeGreaterThan(0);
  });
});
