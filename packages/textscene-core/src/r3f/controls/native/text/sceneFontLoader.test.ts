/**
 * Only the DOM-INDEPENDENT branches of `sceneFontLoader.ts` are exercised
 * here: happy-dom (this repo's vitest environment) has neither `FontFace`
 * nor a real `CanvasRenderingContext2D` (`canvasTextPainter.ts`'s own doc —
 * `getContext('2d')` returns `null`), so the actual FontFace-registration/
 * canvas-measurement path is gated behind the SAME `IS_VITEST` short-circuit
 * `r3f/internalTextLabel.tsx` already uses for its own CDN-fetching `<Text>`,
 * and never runs under this suite. What IS fully testable without a real
 * browser: the `FontResource`-graph fallback decisions (missing font,
 * `SystemFont`, a broken `.tres` chain), the warn-once-per-resource
 * dedupe, and the synchronous peek/cache-population contract.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onSceneFontMetricsSettled, peekSceneFontMetrics, resolveSceneFontMetrics } from './sceneFontLoader';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import * as logger from '../../../../logger';
import type { FontFileResource, FontResource } from '../../../../resources/processing/fontProcessing';

function fontFile(bytes: ArrayBuffer | undefined, fallbacks: FontResource[] = []): FontFileResource {
  return { kind: 'file', bytes, mimeType: bytes ? 'font/ttf' : undefined, fallbacks, properties: {} };
}

describe('resolveSceneFontMetrics / peekSceneFontMetrics', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('no font authored (undefined/null): falls back to the bundled default with NO warning -- this is not a failure', async () => {
    expect(await resolveSceneFontMetrics(undefined, 'Root/Label')).toBe(OPEN_SANS_FONT_METRICS);
    expect(await resolveSceneFontMetrics(null, 'Root/Label')).toBe(OPEN_SANS_FONT_METRICS);
    expect(peekSceneFontMetrics(undefined, 'Root/Label')).toBe(OPEN_SANS_FONT_METRICS);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('a SystemFont falls back to the bundled default and warns with the node path -- this previewer cannot load OS-family bytes', async () => {
    const font: FontResource = { kind: 'system', fontNames: ['sans-serif'], properties: {} };
    const metrics = await resolveSceneFontMetrics(font, 'Root/MyLabel');
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

  it('a bytes-less FontFile with no resolvable fallback warns and falls back, same as SystemFont', async () => {
    const wrapper = fontFile(undefined, []);
    const metrics = await resolveSceneFontMetrics(wrapper, 'Root/B');
    expect(metrics).toBe(OPEN_SANS_FONT_METRICS);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('under this test environment (no FontFace/canvas), even a FontFile WITH real bytes falls back to the bundled default -- by design, silently (no warning): this is the documented IS_VITEST short-circuit, not a load failure', async () => {
    const leaf = fontFile(new ArrayBuffer(4));
    const metrics = await resolveSceneFontMetrics(leaf, 'Root/C');
    expect(metrics).toBe(OPEN_SANS_FONT_METRICS);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('peekSceneFontMetrics returns the bundled default synchronously while a real load would still be in flight, and never throws', () => {
    const leaf = fontFile(new ArrayBuffer(4));
    const metrics = peekSceneFontMetrics(leaf, 'Root/D');
    expect(metrics).toBe(OPEN_SANS_FONT_METRICS);
  });
});

describe('onSceneFontMetricsSettled', () => {
  it('(happy) fires once a resolveSceneFontMetrics promise for a resolvable resource settles', async () => {
    const listener = vi.fn();
    const off = onSceneFontMetricsSettled(listener);
    try {
      const leaf = fontFile(new ArrayBuffer(4));
      await resolveSceneFontMetrics(leaf, 'Root/E');
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      off();
    }
  });

  it('(edge) does NOT fire for a font that short-circuits synchronously (nothing to later change value)', async () => {
    const listener = vi.fn();
    const off = onSceneFontMetricsSettled(listener);
    try {
      await resolveSceneFontMetrics(undefined, 'Root/F');
      await resolveSceneFontMetrics({ kind: 'system', fontNames: [], properties: {} }, 'Root/G');
      expect(listener).not.toHaveBeenCalled();
    } finally {
      off();
    }
  });

  it('(edge) an unsubscribed listener is never called again', async () => {
    const listener = vi.fn();
    const off = onSceneFontMetricsSettled(listener);
    off();
    const leaf = fontFile(new ArrayBuffer(4));
    await resolveSceneFontMetrics(leaf, 'Root/H');
    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies every subscribed listener, not just the first', async () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = onSceneFontMetricsSettled(a);
    const offB = onSceneFontMetricsSettled(b);
    try {
      const leaf = fontFile(new ArrayBuffer(4));
      await resolveSceneFontMetrics(leaf, 'Root/I');
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    } finally {
      offA();
      offB();
    }
  });
});
