/** The one switch that names the form of the lit surface: the page's `?litSurface=` parameter. */

import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isProductionSource, walkSources } from '../testing/sourceScan';
import { litSurfaceFormOf } from './litSurfaceForm';

describe('litSurfaceFormOf', () => {
  it('reads nodes from ?litSurface=nodes', () => {
    expect(litSurfaceFormOf('?fixture=a.tscn&litSurface=nodes')).toBe('nodes');
  });

  it('reads patched with no parameter', () => {
    expect(litSurfaceFormOf('?fixture=a.tscn')).toBe('patched');
  });

  it('reads patched for a value that names no form', () => {
    expect(litSurfaceFormOf('?litSurface=other')).toBe('patched');
  });
});

describe('litSurfaceForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('answers the form of the page it loaded on', async () => {
    window.history.replaceState(null, '', '/?litSurface=nodes');
    vi.resetModules();
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
const SOURCE_ROOTS = ['../../../../../packages', '../../../../../apps'].map((root) =>
  join(import.meta.dirname, root)
);

describe('the switch has one reader', () => {
  it('is imported by at most one production file', () => {
    const readers = walkSources(SOURCE_ROOTS, isProductionSource)
      .filter(({ file }) => !file.endsWith(join('litSurface', 'litSurfaceForm.ts')))
      .filter(({ source }) => /\bfrom\s+['"][^'"]*\/litSurfaceForm(\.js)?['"]/.test(source));

    expect(readers.length).toBeLessThanOrEqual(1);
  });
});
