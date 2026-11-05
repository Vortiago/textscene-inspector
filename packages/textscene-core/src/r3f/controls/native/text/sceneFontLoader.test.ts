/**
 * happy-dom has neither `FontFace` nor a 2D canvas context, so the scene arm's registration path
 * sits behind `IS_VITEST`. These tests cover its fallback decisions, the warn-once dedupe and the
 * peek contract. `bundledFontLoader.test.ts` reaches the shared door for real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fontFile, systemFont } from './sfntOutlines.testkit';
import { peekSceneFontMetrics, peekSettledSceneFontMetrics } from './sceneFontLoader';
import { fontWork, onSceneFontSettled, sceneFontSettleCount } from './settledChannel';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import { FACELESS_FONT } from './sceneFontResolution';
import { getFontAscentPx, getFontLinePitchPx } from './fontMetrics';
import * as logger from '../../../../logger';
import type { FontResource } from '../../../../resources/fonts/font/types';

/** Lets every load a peek started settle: each one resolves within a macrotask here. */
function settleLoads(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('peekSceneFontMetrics', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('no font authored (undefined/null): falls back to the bundled default with NO warning -- this is not a failure', () => {
    expect(peekSceneFontMetrics(undefined, 'Root/Label')).toBe(OPEN_SANS_FONT_METRICS);
    expect(peekSceneFontMetrics(null, 'Root/Label')).toBe(OPEN_SANS_FONT_METRICS);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('a SystemFont draws the bundled default with no warning, as Godot does when no OS font matches its names', () => {
    const font = systemFont();
    expect(peekSceneFontMetrics(font, 'Root/MyLabel')).toBe(OPEN_SANS_FONT_METRICS);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('a bytes-less FontFile with no resolvable fallback warns with the node path and falls back', () => {
    const wrapper = fontFile(undefined, []);
    const metrics = peekSceneFontMetrics(wrapper, 'Root/B');
    expect(metrics).toBe(OPEN_SANS_FONT_METRICS);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain('Root/B');
  });

  it('warns at most once for the SAME unresolvable resource object across repeated peeks -- no per-frame warning spam', () => {
    const wrapper = fontFile(undefined, []);
    peekSceneFontMetrics(wrapper, 'Root/A');
    peekSceneFontMetrics(wrapper, 'Root/A');
    peekSceneFontMetrics(wrapper, 'Root/A');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('under this test environment (no FontFace/canvas), even a FontFile WITH real bytes falls back to the bundled default -- by design, silently (no warning): this is the documented IS_VITEST short-circuit, not a load failure', async () => {
    const leaf = fontFile(new ArrayBuffer(4));
    peekSceneFontMetrics(leaf, 'Root/C');
    await settleLoads();
    expect(peekSceneFontMetrics(leaf, 'Root/C')).toBe(OPEN_SANS_FONT_METRICS);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('peekSceneFontMetrics returns the bundled default synchronously while a real load would still be in flight, and never throws', () => {
    const leaf = fontFile(new ArrayBuffer(4));
    const metrics = peekSceneFontMetrics(leaf, 'Root/D');
    expect(metrics).toBe(OPEN_SANS_FONT_METRICS);
  });
});

describe('peekSettledSceneFontMetrics — a font with no face', () => {
  // `text_server_adv.cpp:6894-6895`: the line holds a hex-code box, 15 cells of `round(size / 15)` px.
  it('holds a hex-code box line: 0.85 of the box above the baseline, 0.15 below', () => {
    const metrics = peekSettledSceneFontMetrics(FACELESS_FONT, 'Label')!;
    expect([getFontAscentPx(metrics, 56), getFontLinePitchPx(metrics, 56, 0)]).toEqual([51, 60]);
  });

  it('has a glyph for no character, so each draws as a hex-code box', () => {
    expect(peekSettledSceneFontMetrics(FACELESS_FONT, 'Label')!.getGlyphAdvanceUnits('H')).toBeNull();
  });

  it('keeps a cell of 1 px at a size whose cell rounds to 0', () => {
    expect(getFontAscentPx(peekSettledSceneFontMetrics(FACELESS_FONT, 'Label')!, 6)).toBe(12.75);
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
    expect(peekSettledSceneFontMetrics(undefined, 'Root/Mesh')).toBe(OPEN_SANS_FONT_METRICS);
    expect(peekSettledSceneFontMetrics(fontFile(undefined, []), 'Root/Mesh')).toBe(OPEN_SANS_FONT_METRICS);
  });

  it('answers null while the load a peek starts is in flight, then the metrics it settles on', async () => {
    const leaf = fontFile(new ArrayBuffer(4));
    expect(peekSettledSceneFontMetrics(leaf, 'Root/Mesh')).toBeNull();
    await settleLoads();
    expect(peekSettledSceneFontMetrics(leaf, 'Root/Mesh')).toBe(OPEN_SANS_FONT_METRICS);
  });

  it('shares the load with peekSceneFontMetrics, which answers the default meanwhile', async () => {
    const leaf = fontFile(new ArrayBuffer(4));
    expect(peekSceneFontMetrics(leaf, 'Root/Label')).toBe(OPEN_SANS_FONT_METRICS);
    expect(peekSettledSceneFontMetrics(leaf, 'Root/Mesh')).toBeNull();
    await settleLoads();
    expect(peekSettledSceneFontMetrics(leaf, 'Root/Mesh')).toBe(peekSceneFontMetrics(leaf, 'Root/Label'));
  });

  it('carries the embolden of a variation over a settled face', async () => {
    const leaf = fontFile(new ArrayBuffer(4));
    const variation: FontResource = {
      kind: 'variation',
      baseFont: leaf,
      fallbacks: [],
      properties: { variation_embolden: '0.5' },
    };
    expect(peekSettledSceneFontMetrics(variation, 'Root/Mesh')).toBeNull();
    await settleLoads();
    expect(peekSettledSceneFontMetrics(variation, 'Root/Mesh')?.embolden).toBe(0.5);
  });
});

describe('peekSceneFontMetrics — FontVariation embolden', () => {
  const bytes = new ArrayBuffer(8);

  function variation(baseFont: FontResource | null, properties: Record<string, string>): FontResource {
    return { kind: 'variation', baseFont, fallbacks: [], properties };
  }

  async function settledPeek(font: FontResource) {
    peekSceneFontMetrics(font, 'Root/Label');
    await settleLoads();
    return peekSceneFontMetrics(font, 'Root/Label');
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
    expect(peekSceneFontMetrics(first, 'Root/Label')).toBe(settled);
    expect(peekSceneFontMetrics(variation(face, { variation_embolden: '1.2' }), 'Root/Other')).toBe(settled);
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
      const metrics = peekSceneFontMetrics(variation(null, { variation_embolden: '1.2' }), 'Root/Bare');
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
    expect(peekSceneFontMetrics(variation(system, embolden), 'Root/OverSystem')).toBe(
      peekSceneFontMetrics(variation(null, embolden), 'Root/Bare')
    );
  });

  it("takes the outer variation's embolden over a bare variation, and the bundled face with none", () => {
    const bare = variation(null, { variation_embolden: '2.0' });
    expect(peekSceneFontMetrics(variation(bare, { variation_embolden: '1.2' }), 'Root/Over').embolden).toBe(
      1.2
    );
    expect(peekSceneFontMetrics(variation(null, {}), 'Root/Plain')).toBe(OPEN_SANS_FONT_METRICS);
  });

  it("carries the variation's variation_transform skew, on a settled face and on the bundled one", async () => {
    const transform = { variation_transform: 'Transform2D(1, 0.2, 0, 1, 0, 0)' };
    expect((await settledPeek(variation(fontFile(bytes), transform))).skew).toBe(0.2);
    expect(peekSceneFontMetrics(variation(null, transform), 'Root/Bare').skew).toBe(0.2);
  });

  it('draws the bundled face with no embolden while the base face is still loading', () => {
    const metrics = peekSceneFontMetrics(
      variation(fontFile(new ArrayBuffer(4)), { variation_embolden: '1.2' }),
      'Root/L'
    );
    expect(metrics.embolden).toBeUndefined();
  });
});

describe('onSceneFontSettled', () => {
  it('(happy) fires once the load a peek starts for a resolvable resource settles', async () => {
    const listener = vi.fn();
    const off = onSceneFontSettled(listener);
    try {
      peekSceneFontMetrics(fontFile(new ArrayBuffer(4)), 'Root/E');
      await settleLoads();
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      off();
    }
  });

  it('(edge) does NOT fire for a font that short-circuits synchronously (nothing to later change value)', async () => {
    const listener = vi.fn();
    const off = onSceneFontSettled(listener);
    try {
      peekSceneFontMetrics(undefined, 'Root/F');
      peekSceneFontMetrics(
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
    const off = onSceneFontSettled(listener);
    off();
    peekSceneFontMetrics(fontFile(new ArrayBuffer(4)), 'Root/H');
    await settleLoads();
    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies every subscribed listener, not just the first', async () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = onSceneFontSettled(a);
    const offB = onSceneFontSettled(b);
    try {
      peekSceneFontMetrics(fontFile(new ArrayBuffer(4)), 'Root/I');
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
    const leaf = fontFile(new ArrayBuffer(4));

    peekSceneFontMetrics(leaf, 'Root/K');
    expect(fontWork.pending()).toBe(1);
    await settleLoads();

    expect(fontWork.pending()).toBe(0);
  });

  it('counts one load for two peeks of one font, which share it', async () => {
    const leaf = fontFile(new ArrayBuffer(4));

    peekSceneFontMetrics(leaf, 'Root/L');
    peekSettledSceneFontMetrics(leaf, 'Root/M');
    expect(fontWork.pending()).toBe(1);
    await settleLoads();

    expect(fontWork.pending()).toBe(0);
  });

  it('counts one load for a font and a copy of it with other fallbacks, which share its bytes', async () => {
    const leaf = fontFile(new ArrayBuffer(4));
    const copy = { ...leaf, fallbacks: [systemFont()] };

    peekSettledSceneFontMetrics(leaf, 'Root/N');
    peekSettledSceneFontMetrics(copy, 'Root/O');
    expect(fontWork.pending()).toBe(1);
    await settleLoads();

    expect(fontWork.pending()).toBe(0);
  });

  it('ends the work of a load whose settled listener throws, so a capture is not held for good', async () => {
    const off = onSceneFontSettled(() => {
      throw new Error('listener failed');
    });
    // The load runs unawaited, so its rejection is the listener's error and nothing else.
    const swallow = () => undefined;
    process.on('unhandledRejection', swallow);
    try {
      peekSceneFontMetrics(fontFile(new ArrayBuffer(4)), 'Root/P');
      await settleLoads();
      expect(fontWork.pending()).toBe(0);
    } finally {
      off();
      process.off('unhandledRejection', swallow);
    }
  });

  it('counts no work for a font that settles by itself on the bundled default', () => {
    peekSceneFontMetrics(undefined, 'Root/N');
    peekSceneFontMetrics(
      { kind: 'system', fontNames: [], baseFont: null, fallbacks: [], properties: {} },
      'Root/O'
    );

    expect(fontWork.pending()).toBe(0);
  });
});

describe('sceneFontSettleCount', () => {
  it('rises by one for each load that settles, so a subscriber that missed the event still sees it', async () => {
    const before = sceneFontSettleCount();

    peekSceneFontMetrics(fontFile(new ArrayBuffer(4)), 'Root/J');
    expect(sceneFontSettleCount()).toBe(before);
    await settleLoads();

    expect(sceneFontSettleCount()).toBe(before + 1);
  });
});

/**
 * `IS_VITEST` is read at module scope, so stubbing the env and re-importing runs `loadRuntimeFont`.
 * happy-dom then supplies the non-DOM environment, where a bare global read throws a ReferenceError
 * that reports a broken font rather than an absent environment.
 */
describe('scene font in an environment with no font door', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function loaderWithoutVitestGuard() {
    vi.stubEnv('VITEST', 'false');
    vi.resetModules();
    const logger = await import('../../../../logger');
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const mod = await import('./sceneFontLoader');
    // From the same fresh graph: the static import above is a different module instance.
    const { OPEN_SANS_FONT_METRICS: bundled } = await import('./openSansFontMetrics');
    return { ...mod, logger, bundled };
  }

  it('falls back to the bundled default and names the absent environment when there is no FontFace', async () => {
    const { peekSceneFontMetrics: peek, logger, bundled } = await loaderWithoutVitestGuard();

    const font = fontFile(new ArrayBuffer(4));
    peek(font, 'Root/NoDom');
    await settleLoads();
    expect(peek(font, 'Root/NoDom')).toBe(bundled);
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
    const { peekSceneFontMetrics: peek, logger, bundled } = await loaderWithoutVitestGuard();

    const font = fontFile(new ArrayBuffer(4));
    peek(font, 'Root/NoDocument');
    await settleLoads();
    expect(peek(font, 'Root/NoDocument')).toBe(bundled);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('no FontFace/document.fonts in this environment')
    );
  });

  it('draws the bundled default for a face that fails to load, and drops a fallback that fails', async () => {
    const { peekSettledChainFaces: peekChain, bundled } = await loaderWithoutVitestGuard();

    const fallback = fontFile(new ArrayBuffer(4));
    const font = fontFile(new ArrayBuffer(4), [fallback]);
    peekChain(font, 'Root/NoDom');
    await settleLoads();
    expect(peekChain(font, 'Root/NoDom')).toEqual([{ font, metrics: bundled }]);
  });

  it('keeps the embolden of a FontVariation over a face that fails to load', async () => {
    const { peekSceneFontMetrics: peek } = await loaderWithoutVitestGuard();

    const font: FontResource = {
      kind: 'variation',
      baseFont: fontFile(new ArrayBuffer(4)),
      fallbacks: [],
      properties: { variation_embolden: '1.2' },
    };
    peek(font, 'Root/NoDom');
    await settleLoads();
    expect(peek(font, 'Root/NoDom').embolden).toBe(1.2);
  });
});

describe('peekSettledSceneFontMetrics — the glyph outlines an emboldened canvas face follows', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function loaderWithFontDoor() {
    vi.stubEnv('VITEST', 'false');
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
      createElement: () => ({ getContext: () => ({ measureText: () => ({ width: 500 }) }) }),
    });
    const { fontFile: freshFontFile, fixtureFontBytes } = await import('./sfntOutlines.testkit');
    const mod = await import('./sceneFontLoader');
    return { ...mod, ttf: () => freshFontFile(fixtureFontBytes('open-sans-semibold-subset.ttf')) };
  }

  const emboldened = (base: FontResource): FontResource => ({
    kind: 'variation',
    baseFont: base,
    fallbacks: [],
    properties: { variation_embolden: '1.2' },
  });

  it('answers null while the outlines load, then the face carrying them', async () => {
    const { peekSettledSceneFontMetrics: peek, ttf } = await loaderWithFontDoor();
    const font = emboldened(ttf());

    peek(font, 'Root/Bold');
    await settleLoads();
    expect(peek(font, 'Root/Bold')).toBeNull();

    await vi.waitFor(() => expect(peek(font, 'Root/Bold')).not.toBeNull());
    expect(peek(font, 'Root/Bold')?.outlines?.glyphIndex(0x48)).toBeGreaterThan(0);
  });

  it('settles a plain canvas face at once, with no outlines to wait for', async () => {
    const { peekSettledSceneFontMetrics: peek, ttf } = await loaderWithFontDoor();
    const font = ttf();

    peek(font, 'Root/Plain');
    await settleLoads();

    expect(peek(font, 'Root/Plain')?.outlines).toBeUndefined();
  });
});
