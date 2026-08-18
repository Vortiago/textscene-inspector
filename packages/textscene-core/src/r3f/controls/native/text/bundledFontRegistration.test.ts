/**
 * The gate under test is the one `ctx.fillText` cannot enforce for itself:
 * painting with an UNREGISTERED family silently rasterises a system font,
 * and those pixels are frame-stable enough to sail through the visual
 * harness's settle gate. So the bundled canvas metrics may only exist once
 * `document.fonts` registration has actually resolved.
 *
 * `FontFace` is stubbed rather than skipped (contrast `sceneFontLoader.ts`'s
 * `IS_VITEST` short-circuit, which exists because that path also needs a
 * real `measureText`): registration is the ONLY DOM call here, so both sides
 * of the gate are reachable under happy-dom.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  const mod = await import('./bundledFontRegistration');
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

  it('stays undefined and warns when the registration rejects', async () => {
    installFontFace();
    FakeFontFace.loadResult = 'reject';
    const { peekBundledCanvasFontMetrics, resolveBundledCanvasFontMetrics, logger } = await freshModule();

    expect(await resolveBundledCanvasFontMetrics()).toBeUndefined();
    expect(peekBundledCanvasFontMetrics()).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('bad font bytes'));
  });

  it('stays undefined and warns in an environment with no FontFace at all', async () => {
    const { peekBundledCanvasFontMetrics, resolveBundledCanvasFontMetrics, logger } = await freshModule();

    expect(await resolveBundledCanvasFontMetrics()).toBeUndefined();
    expect(peekBundledCanvasFontMetrics()).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('FontFace'));
  });
});
