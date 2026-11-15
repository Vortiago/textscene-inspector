/** The one switch that names the form of the lit surface: the page's `?litSurface=` parameter. */

import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { repoRoot } from '../../parser/testing/parserKit';
import { isProductionSource, walkSources } from '../testing/sourceScan';

/** The form a fresh load of the module reads, on a page at `url`. */
async function formOnPageAt(url: string) {
  window.history.replaceState(null, '', url);
  vi.resetModules();
  const { litSurfaceForm } = await import('./litSurfaceForm');
  return litSurfaceForm();
}

describe('litSurfaceForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  });

  it('answers nodes on a page opened with ?litSurface=nodes', async () => {
    expect(await formOnPageAt('/?fixture=a.tscn&litSurface=nodes')).toBe('nodes');
  });

  it('answers patched on a page with no parameter', async () => {
    expect(await formOnPageAt('/?fixture=a.tscn')).toBe('patched');
  });

  it('answers patched for a value that names no form', async () => {
    expect(await formOnPageAt('/?litSurface=other')).toBe('patched');
  });

  it('keeps the form it loaded with for the life of the page', async () => {
    await formOnPageAt('/?litSurface=nodes');
    window.history.replaceState(null, '', '/?litSurface=patched');
    const { litSurfaceForm } = await import('./litSurfaceForm');

    expect(litSurfaceForm()).toBe('nodes');
  });

  it('answers patched with no window', async () => {
    vi.stubGlobal('window', undefined);
    vi.resetModules();
    const { litSurfaceForm } = await import('./litSurfaceForm');

    expect(litSurfaceForm()).toBe('patched');
  });
});

/** The production sources a reader of the switch can sit in. */
const SOURCE_ROOTS = ['packages', 'apps'].map((root) => join(repoRoot(), root));

describe('the switch has one reader', () => {
  it('is imported by at most one production file', () => {
    const readers = walkSources(SOURCE_ROOTS, isProductionSource)
      .filter(({ file }) => !file.endsWith(join('litSurface', 'litSurfaceForm.ts')))
      .filter(({ source }) => /\bfrom\s+['"][^'"]*\/litSurfaceForm(\.js)?['"]/.test(source));

    expect(readers.length).toBeLessThanOrEqual(1);
  });
});
