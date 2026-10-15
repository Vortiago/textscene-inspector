/**
 * happy-dom has neither `FontFace` nor a 2D canvas context, so the scene arm's registration path
 * sits behind `IS_VITEST`. These tests cover its fallback decisions, the warn-once dedupe and the
 * peek contract. The bundled arm stubs `FontFace` and reaches the shared door for real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onSceneFontMetricsSettled, peekSceneFontMetrics } from './sceneFontLoader';
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

describe('onSceneFontMetricsSettled', () => {
  it('(happy) fires once the load a peek starts for a resolvable resource settles', async () => {
    const listener = vi.fn();
    const off = onSceneFontMetricsSettled(listener);
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
    const off = onSceneFontMetricsSettled(listener);
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
    const off = onSceneFontMetricsSettled(listener);
    off();
    peekSceneFontMetrics(fontFile(new ArrayBuffer(4)), 'Root/H');
    await settleLoads();
    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies every subscribed listener, not just the first', async () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = onSceneFontMetricsSettled(a);
    const offB = onSceneFontMetricsSettled(b);
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

/**
 * `fillText` with an unregistered family paints a system font that passes the visual harness's
 * settle gate, so the bundled metrics exist only once registration resolves. Registration is the
 * only DOM call on this arm, so a stubbed `FontFace` reaches both sides of the gate.
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
    return FakeFontFace.loadResult === 'resolve'
      ? Promise.resolve(this)
      : Promise.reject(new Error('bad font bytes'));
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

// `resetModules` gives each test its own registration cache. The logger is re-imported in the same
// graph, or the spy sits on a different module instance.
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
    const { peekBundledCanvasFontMetrics } = await freshModule();

    peekBundledCanvasFontMetrics();
    await settleLoads();
    const metrics = peekBundledCanvasFontMetrics();
    expect(metrics?.kind).toBe('canvas');
    expect(FakeFontFace.instances).toHaveLength(1);
    const [face] = FakeFontFace.instances;
    expect(metrics?.cssFontFamily).toBe(face?.family);
    expect(added).toEqual([face]);
    expect(peekBundledCanvasFontMetrics()).toBe(metrics);
  });

  it('registers the bundled woff2 bytes themselves, never a URL the webview CSP would block fetching', async () => {
    installFontFace();
    const { peekBundledCanvasFontMetrics } = await freshModule();
    peekBundledCanvasFontMetrics();
    await settleLoads();

    const source = FakeFontFace.instances[0]?.source;
    expect(source).toBeInstanceOf(ArrayBuffer);
    expect(String.fromCharCode(...new Uint8Array(source as ArrayBuffer).slice(0, 4))).toBe('wOF2');
  });

  it('registers once however many callers ask', async () => {
    installFontFace();
    const { peekBundledCanvasFontMetrics } = await freshModule();

    peekBundledCanvasFontMetrics();
    peekBundledCanvasFontMetrics();
    await settleLoads();
    expect(peekBundledCanvasFontMetrics()).toBe(peekBundledCanvasFontMetrics());
    expect(FakeFontFace.instances).toHaveLength(1);
  });

  it('notifies the settled channel once registration resolves, so a peek-then-settle consumer re-renders', async () => {
    installFontFace();
    const { peekBundledCanvasFontMetrics, onSceneFontMetricsSettled } = await freshModule();

    const listener = vi.fn();
    const off = onSceneFontMetricsSettled(listener);
    try {
      peekBundledCanvasFontMetrics();
      await settleLoads();
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      off();
    }
  });

  it('stays undefined and warns when the registration rejects', async () => {
    installFontFace();
    FakeFontFace.loadResult = 'reject';
    const { peekBundledCanvasFontMetrics, logger } = await freshModule();

    peekBundledCanvasFontMetrics();
    await settleLoads();
    expect(peekBundledCanvasFontMetrics()).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('bad font bytes'));
  });

  it('notifies the settled channel even when registration fails, exactly as the scene arm notifies after its own fallback', async () => {
    installFontFace();
    FakeFontFace.loadResult = 'reject';
    const { peekBundledCanvasFontMetrics, onSceneFontMetricsSettled } = await freshModule();

    const listener = vi.fn();
    const off = onSceneFontMetricsSettled(listener);
    try {
      peekBundledCanvasFontMetrics();
      await settleLoads();
      expect(peekBundledCanvasFontMetrics()).toBeUndefined();
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      off();
    }
  });

  // happy-dom without the stub is the non-DOM case, the branch a scene font takes outside a browser.
  it('stays undefined and warns in an environment with no FontFace at all', async () => {
    const { peekBundledCanvasFontMetrics, logger } = await freshModule();

    peekBundledCanvasFontMetrics();
    await settleLoads();
    expect(peekBundledCanvasFontMetrics()).toBeUndefined();
    // The door's diagnosis, not the catch's: an absent environment is not broken font bytes.
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('No FontFace/document.fonts in this environment')
    );
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
