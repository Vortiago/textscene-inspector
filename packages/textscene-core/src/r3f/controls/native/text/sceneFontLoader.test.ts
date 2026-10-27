/**
 * happy-dom has neither `FontFace` nor a 2D canvas context, so the scene arm's registration path
 * sits behind `IS_VITEST`. These tests cover its fallback decisions, the warn-once dedupe and the
 * peek contract. `bundledFontLoader.test.ts` reaches the shared door for real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fontWork,
  notifySceneFontSettled,
  onSceneFontSettled,
  peekSceneFontMetrics,
  peekSettledSceneFontMetrics,
  sceneFontSettleCount,
} from './sceneFontLoader';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import * as logger from '../../../../logger';
import type { FontFileResource, FontResource } from '../../../../resources/fonts/font/types';

function fontFile(bytes: ArrayBuffer | undefined, fallbacks: FontResource[] = []): FontFileResource {
  return { kind: 'file', bytes, mimeType: bytes ? 'font/ttf' : undefined, fallbacks, properties: {} };
}

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

  it('a SystemFont falls back to the bundled default and warns with the node path -- this previewer cannot load OS-family bytes', () => {
    const font: FontResource = { kind: 'system', fontNames: ['sans-serif'], properties: {} };
    const metrics = peekSceneFontMetrics(font, 'Root/MyLabel');
    expect(metrics).toBe(OPEN_SANS_FONT_METRICS);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain('Root/MyLabel');
  });

  it('warns at most once for the SAME SystemFont resource object across repeated peeks -- no per-frame warning spam', () => {
    const font: FontResource = { kind: 'system', fontNames: ['sans-serif'], properties: {} };
    peekSceneFontMetrics(font, 'Root/A');
    peekSceneFontMetrics(font, 'Root/A');
    peekSceneFontMetrics(font, 'Root/A');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('a bytes-less FontFile with no resolvable fallback warns and falls back, same as SystemFont', () => {
    const wrapper = fontFile(undefined, []);
    const metrics = peekSceneFontMetrics(wrapper, 'Root/B');
    expect(metrics).toBe(OPEN_SANS_FONT_METRICS);
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

describe('peekSettledSceneFontMetrics', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('answers the bundled default at once for no font and for a font that cannot load, which settle by themselves', () => {
    const system: FontResource = { kind: 'system', fontNames: ['sans-serif'], properties: {} };
    expect(peekSettledSceneFontMetrics(undefined, 'Root/Mesh')).toBe(OPEN_SANS_FONT_METRICS);
    expect(peekSettledSceneFontMetrics(system, 'Root/Mesh')).toBe(OPEN_SANS_FONT_METRICS);
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
    return { kind: 'variation', baseFont, properties };
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
      peekSceneFontMetrics({ kind: 'system', fontNames: [], properties: {} }, 'Root/G');
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

describe('notifySceneFontSettled', () => {
  it('calls every listener after one throws, then rethrows the first error', () => {
    const failure = new Error('listener failed');
    const later = vi.fn();
    const offFailing = onSceneFontSettled(() => {
      throw failure;
    });
    const offLater = onSceneFontSettled(later);
    try {
      expect(() => notifySceneFontSettled()).toThrow(failure);
      expect(later).toHaveBeenCalledTimes(1);
    } finally {
      offFailing();
      offLater();
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
    peekSceneFontMetrics({ kind: 'system', fontNames: [], properties: {} }, 'Root/O');

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
});
