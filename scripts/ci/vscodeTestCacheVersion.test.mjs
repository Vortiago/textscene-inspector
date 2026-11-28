import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveVscodeTestCacheVersion } from './vscodeTestCacheVersion.mjs';

const enginesRange = '^1.105.0';

afterEach(() => vi.unstubAllGlobals());

describe('resolveVscodeTestCacheVersion', () => {
  it.each([
    ['min', '1.105.0'],
    ['1.110.1', '1.110.1'],
  ])('resolves %s without a network request', async (requested, expected) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(resolveVscodeTestCacheVersion(requested, enginesRange)).resolves.toBe(expected);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses the latest released stable version', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(['1.148.0', '1.147.1']));
    vi.stubGlobal('fetch', fetch);
    await expect(resolveVscodeTestCacheVersion('stable', enginesRange)).resolves.toBe('1.148.0');
    expect(fetch).toHaveBeenCalledWith(
      'https://update.code.visualstudio.com/api/releases/stable?released=true',
      { signal: expect.any(AbortSignal) }
    );
  });

  it('reports a failing update service', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(resolveVscodeTestCacheVersion('stable', enginesRange)).rejects.toThrow('HTTP 503');
  });

  it.each([
    { releases: [] },
    { releases: ['1.148.0\n'] },
    { releases: ['1.148.0\nOTHER_OUTPUT=value'] },
    { releases: { version: '1.148.0' } },
  ])('rejects an invalid stable release response $releases', async ({ releases }) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(releases)));
    await expect(resolveVscodeTestCacheVersion('stable', enginesRange)).rejects.toThrow(
      'Expected an exact VS Code version'
    );
  });
});
