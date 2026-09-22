/**
 * Only the DOM-INDEPENDENT branches of the SCENE-font arm are exercised
 * here: happy-dom (this repo's vitest environment) has neither `FontFace`
 * nor a real `CanvasRenderingContext2D` (`canvasTextPainter.ts`'s own doc —
 * `getContext('2d')` returns `null`), so the actual FontFace-registration/
 * canvas-measurement path is gated behind the SAME `IS_VITEST` short-circuit
 * `r3f/internalTextLabel.tsx` already uses for its own CDN-fetching `<Text>`,
 * and never runs under this suite. What IS fully testable without a real
 * browser: the `FontResource`-graph fallback decisions (missing font,
 * `SystemFont`, a broken `.tres` chain), the warn-once-per-resource
 * dedupe, and the synchronous peek/cache-population contract.
 *
 * The BUNDLED arm (second `describe` below) stubs `FontFace` instead, which
 * reaches the shared `registerFontFace` door for real — including its
 * no-`FontFace` branch, the one the scene arm's `IS_VITEST` guard hides.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onSceneFontMetricsSettled, peekSceneFontMetrics, resolveSceneFontMetrics } from './sceneFontLoader';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import * as logger from '../../../../logger';
import type { FontFileResource, FontResource } from '../../../../resources/fonts/font/types';

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

/**
 * The bundled-font arm of the same module. The gate under test is the one
 * `ctx.fillText` cannot enforce for itself: painting with an UNREGISTERED
 * family silently rasterises a system font, and those pixels are
 * frame-stable enough to sail through the visual harness's settle gate. So
 * the bundled canvas metrics may only exist once `document.fonts`
 * registration has actually resolved.
 *
 * `FontFace` is stubbed rather than skipped (contrast the `IS_VITEST`
 * short-circuit above, which exists because a SCENE font also needs a real
 * `measureText`): registration is the only DOM call on this arm, so both
 * sides of the gate — and the shared door's no-`FontFace` branch, which
 * happy-dom gives for free by simply not stubbing — are reachable here.
 */

class FakeFontFace {
  static instances: FakeFontFace[] = [];
  static loadResult: 'resolve' | 'reject' = 'resolve';
  readonly family: string;
  readonly source: ArrayBuffer;
  constructor(family: string, source: ArrayBuffer) {
    this.family = family;
    this.source = source;
    FakeFontFace.instances.push(this);
  }
  load(): Promise<FakeFontFace> {
    return FakeFontFace.loadResult === 'resolve' ? Promise.resolve(this) : Promise.reject(new Error('bad font bytes'));
  }
}

const added: unknown[] = [];

function installFontFace(): void {
  FakeFontFace.instances = [];
  FakeFontFace.loadResult = 'resolve';
  added.length = 0;
  vi.stubGlobal('FontFace', FakeFontFace);
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { add: (face: unknown) => added.push(face) },
  });
}

// `resetModules` is what gives each test its own registration cache; the
// logger has to be re-imported inside that same fresh graph or the spy would
// sit on a different module instance than the one under test.
async function freshModule() {
  vi.resetModules();
  const logger = await import('../../../../logger');
  vi.spyOn(logger, 'warn').mockImplementation(() => {});
  const mod = await import('./sceneFontLoader');
  return { ...mod, logger };
}

describe('bundled font registration gate', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, 'fonts');
    vi.restoreAllMocks();
  });

  it('peeks undefined before registration has resolved, so no caller can paint against an unregistered family', async () => {
    installFontFace();
    const { peekBundledCanvasFontMetrics } = await freshModule();
    expect(peekBundledCanvasFontMetrics()).toBeUndefined();
  });

  it('hands out canvas metrics for the registered family once registration resolves, and peeks the same object after', async () => {
    installFontFace();
    const { peekBundledCanvasFontMetrics, resolveBundledCanvasFontMetrics } = await freshModule();

    const metrics = await resolveBundledCanvasFontMetrics();
    expect(metrics?.kind).toBe('canvas');
    expect(FakeFontFace.instances).toHaveLength(1);
    const [face] = FakeFontFace.instances;
    expect(metrics?.cssFontFamily).toBe(face?.family);
    expect(added).toEqual([face]);
    expect(peekBundledCanvasFontMetrics()).toBe(metrics);
  });

  it('registers the bundled woff2 bytes themselves, never a URL the webview CSP would block fetching', async () => {
    installFontFace();
    const { resolveBundledCanvasFontMetrics } = await freshModule();
    await resolveBundledCanvasFontMetrics();

    const source = FakeFontFace.instances[0]?.source;
    expect(source).toBeInstanceOf(ArrayBuffer);
    expect(String.fromCharCode(...new Uint8Array(source as ArrayBuffer).slice(0, 4))).toBe('wOF2');
  });

  it('registers once however many callers ask', async () => {
    installFontFace();
    const { peekBundledCanvasFontMetrics, resolveBundledCanvasFontMetrics } = await freshModule();

    peekBundledCanvasFontMetrics();
    const [a, b] = await Promise.all([resolveBundledCanvasFontMetrics(), resolveBundledCanvasFontMetrics()]);
    expect(a).toBe(b);
    expect(FakeFontFace.instances).toHaveLength(1);
  });

  it('notifies the settled channel once registration resolves, so a peek-then-settle consumer re-renders', async () => {
    installFontFace();
    const { resolveBundledCanvasFontMetrics, onSceneFontMetricsSettled } = await freshModule();

    const listener = vi.fn();
    const off = onSceneFontMetricsSettled(listener);
    try {
      await resolveBundledCanvasFontMetrics();
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      off();
    }
  });

  it('stays undefined and warns when the registration rejects', async () => {
    installFontFace();
    FakeFontFace.loadResult = 'reject';
    const { peekBundledCanvasFontMetrics, resolveBundledCanvasFontMetrics, logger } = await freshModule();

    expect(await resolveBundledCanvasFontMetrics()).toBeUndefined();
    expect(peekBundledCanvasFontMetrics()).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('bad font bytes'));
  });

  it('notifies the settled channel even when registration fails, exactly as the scene arm notifies after its own fallback', async () => {
    installFontFace();
    FakeFontFace.loadResult = 'reject';
    const { resolveBundledCanvasFontMetrics, onSceneFontMetricsSettled } = await freshModule();

    const listener = vi.fn();
    const off = onSceneFontMetricsSettled(listener);
    try {
      expect(await resolveBundledCanvasFontMetrics()).toBeUndefined();
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      off();
    }
  });

  // The shared `registerFontFace` door read off `globalThis`, not a bare
  // `document`/`FontFace`: happy-dom without the stub IS the non-DOM case, so
  // this reaches the same branch a scene font takes outside a browser.
  it('stays undefined and warns in an environment with no FontFace at all', async () => {
    const { peekBundledCanvasFontMetrics, resolveBundledCanvasFontMetrics, logger } = await freshModule();

    expect(await resolveBundledCanvasFontMetrics()).toBeUndefined();
    expect(peekBundledCanvasFontMetrics()).toBeUndefined();
    // The DOOR's own diagnosis, not the catch's: an absent environment must
    // not be reported as broken font bytes.
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('No FontFace/document.fonts in this environment'));
  });
});

/**
 * The scene arm's own non-DOM branch, which `IS_VITEST` otherwise hides: that
 * guard is read from `process.env.VITEST` at module scope, so stubbing the
 * env and re-importing gives a graph where `loadRuntimeFont` genuinely runs.
 * happy-dom then supplies the non-DOM environment for free — no `FontFace`,
 * and `document` itself removable — which is the case a bare `new FontFace` /
 * `document.fonts` read would have hit as a ReferenceError from inside the
 * promise, warning about a broken font rather than an absent environment.
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
    // From the SAME fresh graph: the statically-imported constant at the top
    // of this file is a different module instance and would fail identity.
    const { OPEN_SANS_FONT_METRICS: bundled } = await import('./openSansFontMetrics');
    return { ...mod, logger, bundled };
  }

  it('falls back to the bundled default and names the absent environment when there is no FontFace', async () => {
    const { resolveSceneFontMetrics, logger, bundled } = await loaderWithoutVitestGuard();

    const metrics = await resolveSceneFontMetrics(fontFile(new ArrayBuffer(4)), 'Root/NoDom');
    expect(metrics).toBe(bundled);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('no FontFace/document.fonts in this environment'));
  });

  it('does the same with no `document` at all, rather than throwing off a bare global', async () => {
    vi.stubGlobal('FontFace', class {
      load() {
        return Promise.resolve(this);
      }
    });
    vi.stubGlobal('document', undefined);
    const { resolveSceneFontMetrics, logger, bundled } = await loaderWithoutVitestGuard();

    const metrics = await resolveSceneFontMetrics(fontFile(new ArrayBuffer(4)), 'Root/NoDocument');
    expect(metrics).toBe(bundled);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('no FontFace/document.fonts in this environment'));
  });
});
