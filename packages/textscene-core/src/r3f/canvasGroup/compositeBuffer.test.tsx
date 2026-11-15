/** A composite CanvasGroup holds its buffer and composite material until it unmounts. */
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { act, renderHook } from '@testing-library/react';
import { canvasColorSpaceOf } from '../canvasColorSpace';
import { useCompositeBuffer } from './compositeBuffer';

const SRGB_CANVAS = canvasColorSpaceOf(false);

/** Lets the holds that a release queued dispose what nothing holds. */
const flushReleases = () => act(async () => await Promise.resolve());

describe('useCompositeBuffer', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps its buffer while mounted under StrictMode, and frees it once on unmount', async () => {
    const dispose = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'dispose');
    const group = renderHook(() => useCompositeBuffer(SRGB_CANVAS), { wrapper: StrictMode });
    await flushReleases();
    expect(dispose).not.toHaveBeenCalled();

    group.unmount();
    await flushReleases();

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('keeps its composite material while mounted under StrictMode, and frees it once on unmount', async () => {
    const dispose = vi.spyOn(THREE.ShaderMaterial.prototype, 'dispose');
    const group = renderHook(() => useCompositeBuffer(SRGB_CANVAS), { wrapper: StrictMode });
    await flushReleases();
    expect(dispose).not.toHaveBeenCalled();

    group.unmount();
    await flushReleases();

    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
