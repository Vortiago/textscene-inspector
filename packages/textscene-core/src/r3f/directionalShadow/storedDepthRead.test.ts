import type * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./twoByteFilterProbe.js', () => ({ filtersTwoBytesExactly: () => gpu.filtersBytesExactly }));

/** What the GPU of the fake renderer can do. */
const gpu = { filtersBytesExactly: false, filtersFloat: false };

const renderer = {
  getContext: () => ({ getExtension: () => (gpu.filtersFloat ? {} : null) }),
} as unknown as THREE.WebGLRenderer;

/** A fresh load of the module, on a page at `url`. */
async function moduleOnPageAt(url: string) {
  window.history.replaceState(null, '', url);
  vi.resetModules();
  return import('./storedDepthRead.js');
}

async function decidedOnPageAt(url: string) {
  return (await moduleOnPageAt(url)).decideStoredDepthRead(renderer);
}

afterEach(() => {
  vi.restoreAllMocks();
  gpu.filtersBytesExactly = false;
  gpu.filtersFloat = false;
  window.history.replaceState(null, '', '/');
});

describe('decideStoredDepthRead', () => {
  it('samples the bytes on a GPU that filters them exactly', async () => {
    gpu.filtersBytesExactly = true;
    gpu.filtersFloat = true;

    expect(await decidedOnPageAt('/')).toBe('sampled');
  });

  it('samples a float colour on a GPU that rounds a filtered byte but filters a float', async () => {
    gpu.filtersFloat = true;

    expect(await decidedOnPageAt('/')).toBe('float');
  });

  it('fetches four texels on a GPU that does neither (edge case)', async () => {
    expect(await decidedOnPageAt('/')).toBe('fetched');
  });

  it.each(['sampled', 'float', 'fetched'] as const)('takes %s on a page that forces it', async (read) => {
    gpu.filtersBytesExactly = read !== 'sampled';
    gpu.filtersFloat = read === 'float';

    expect(await decidedOnPageAt(`/?storedDepthRead=${read}`)).toBe(read);
  });

  it('follows the probe, and warns, where a forced float colour cannot draw (error case)', async () => {
    const { decideStoredDepthRead } = await moduleOnPageAt('/?storedDepthRead=float');
    const warn = vi.spyOn(await import('../../logger.js'), 'warn').mockImplementation(() => {});

    expect(decideStoredDepthRead(renderer)).toBe('fetched');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('so the page reads fetched'));
  });

  it('follows the probe for a value that names no read (error case)', async () => {
    gpu.filtersFloat = true;

    expect(await decidedOnPageAt('/?storedDepthRead=other')).toBe('float');
  });

  it('keeps the first renderer’s read for the page', async () => {
    const { decideStoredDepthRead } = await moduleOnPageAt('/');
    decideStoredDepthRead(renderer);
    gpu.filtersBytesExactly = true;

    expect(decideStoredDepthRead(renderer)).toBe('fetched');
  });
});

describe('storedDepthRead', () => {
  it('fetches four texels before a canvas decides (edge case)', async () => {
    expect((await moduleOnPageAt('/')).storedDepthRead()).toBe('fetched');
  });

  it('gives the decided read', async () => {
    gpu.filtersFloat = true;
    const { decideStoredDepthRead, storedDepthRead } = await moduleOnPageAt('/');
    decideStoredDepthRead(renderer);

    expect(storedDepthRead()).toBe('float');
  });
});
