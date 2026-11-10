import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureFontBytes } from './sfntOutlines.testkit';

describe('openFontOutlines when the lazy kerning chunk fails to load', () => {
  afterEach(() => {
    vi.doUnmock('./variation/instanceKerning');
    vi.resetModules();
  });

  it('keeps the outlines and drops only the kerning at an instance', async () => {
    vi.resetModules();
    // Vitest wraps a factory that throws, so the module loads and its export throws on read instead.
    vi.doMock('./variation/instanceKerning', () => ({
      get instanceKerningReader(): never {
        throw new Error('chunk failed to load');
      },
    }));
    const { openFontOutlines } = await import('./sfntOutlines');

    const outlines = await openFontOutlines(fixtureFontBytes('recursive-vf-subset.woff2'));

    expect(outlines).not.toBeNull();
    expect(outlines!.kerningAtInstance).toBeUndefined();
  });
});
