import { afterEach, describe, expect, it, vi } from 'vitest';

/** Waits until the registration a peek started has settled: the bytes chunk loads first. */
async function settleLoads(): Promise<void> {
  const { fontWork } = await import('./settledChannel');
  await vi.waitFor(() => expect(fontWork.pending()).toBe(0));
}

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

// `resetModules` gives each test its own registration cache. The logger and the settled channel come
// from the same graph, or the spy and the listener sit on a different module instance.
async function freshModule() {
  // The door is skipped under vitest, as a scene font's is, so the stub reaches it only without the guard.
  vi.stubEnv('VITEST', 'false');
  vi.resetModules();
  const logger = await import('../../../../logger');
  vi.spyOn(logger, 'warn').mockImplementation(() => {});
  const { onSceneFontSettled } = await import('./settledChannel');
  const { peekBundledCanvasFontMetrics } = await import('./bundledFontLoader');
  return { peekBundledCanvasFontMetrics, onSceneFontSettled, logger };
}

describe('bundled font registration gate', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, 'fonts');
    vi.restoreAllMocks();
  });

  it('peeks undefined before registration has resolved, so no caller can paint against an unregistered family', async () => {
    installFontFace();
    const { peekBundledCanvasFontMetrics } = await freshModule();
    expect(peekBundledCanvasFontMetrics()).toBeUndefined();
    await settleLoads();
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
    const { peekBundledCanvasFontMetrics, onSceneFontSettled } = await freshModule();

    const listener = vi.fn();
    const off = onSceneFontSettled(listener);
    try {
      peekBundledCanvasFontMetrics();
      await settleLoads();
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      off();
    }
  });

  it('settles on null and warns when the registration rejects', async () => {
    installFontFace();
    FakeFontFace.loadResult = 'reject';
    const { peekBundledCanvasFontMetrics, logger } = await freshModule();

    peekBundledCanvasFontMetrics();
    await settleLoads();
    expect(peekBundledCanvasFontMetrics()).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('bad font bytes'));
  });

  it('notifies the settled channel even when registration fails, exactly as the scene arm notifies after its own fallback', async () => {
    installFontFace();
    FakeFontFace.loadResult = 'reject';
    const { peekBundledCanvasFontMetrics, onSceneFontSettled } = await freshModule();

    const listener = vi.fn();
    const off = onSceneFontSettled(listener);
    try {
      peekBundledCanvasFontMetrics();
      await settleLoads();
      expect(peekBundledCanvasFontMetrics()).toBeNull();
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      off();
    }
  });

  // happy-dom without the stub is the non-DOM case, the branch a scene font takes outside a browser.
  it('settles on null and warns in an environment with no FontFace at all', async () => {
    const { peekBundledCanvasFontMetrics, logger } = await freshModule();

    peekBundledCanvasFontMetrics();
    await settleLoads();
    expect(peekBundledCanvasFontMetrics()).toBeNull();
    // The door's diagnosis, not the catch's: an absent environment is not broken font bytes.
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('No FontFace/document.fonts in this environment')
    );
  });

  it('settles on null without a warning under this test environment, which skips the door on purpose', async () => {
    vi.resetModules();
    const logger = await import('../../../../logger');
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const { peekBundledCanvasFontMetrics } = await import('./bundledFontLoader');

    peekBundledCanvasFontMetrics();
    await settleLoads();
    expect(peekBundledCanvasFontMetrics()).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });
});
