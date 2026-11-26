import type * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./twoByteFilterProbe.js', () => ({ filtersTwoBytesExactly: () => probe.filtersExactly }));

/** The probe's answer for the renderer, as the mocked probe gives it. */
const probe = { filtersExactly: false };
const renderer = {} as THREE.WebGLRenderer;

/** The read a fresh load of the module picks, on a page at `url`. */
async function readsSampledOnPageAt(url: string) {
  window.history.replaceState(null, '', url);
  vi.resetModules();
  const { readsStoredDepthSampled } = await import('./storedDepthRead.js');
  return readsStoredDepthSampled(renderer);
}

describe('readsStoredDepthSampled', () => {
  afterEach(() => {
    probe.filtersExactly = false;
    window.history.replaceState(null, '', '/');
  });

  it('samples on a page opened with ?storedDepthRead=sampled, whatever the probe finds', async () => {
    expect(await readsSampledOnPageAt('/?storedDepthRead=sampled')).toBe(true);
  });

  it('fetches on a page opened with ?storedDepthRead=fetched, whatever the probe finds', async () => {
    probe.filtersExactly = true;

    expect(await readsSampledOnPageAt('/?storedDepthRead=fetched')).toBe(false);
  });

  it('follows the probe on a page with no parameter', async () => {
    probe.filtersExactly = true;

    expect(await readsSampledOnPageAt('/?fixture=a.tscn')).toBe(true);
  });

  it('follows the probe for a value that names no read', async () => {
    expect(await readsSampledOnPageAt('/?storedDepthRead=other')).toBe(false);
  });
});
