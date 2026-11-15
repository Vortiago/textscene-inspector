/** The clip buffer shared by the clipping groups of one canvas. */
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { act, renderHook } from '@testing-library/react';
import { canvasColorSpaceOf } from '../canvasColorSpace';
import { useSharedClipBuffer } from './sharedClipBuffer';

const SRGB_CANVAS = canvasColorSpaceOf(false);
const LINEAR_CANVAS = canvasColorSpaceOf(true);

describe('useSharedClipBuffer', () => {
  afterEach(() => vi.restoreAllMocks());

  it('hands two groups of one canvas the same buffer', () => {
    const scene = new THREE.Scene();

    const first = renderHook(() => useSharedClipBuffer(scene, SRGB_CANVAS));
    const second = renderHook(() => useSharedClipBuffer(scene, SRGB_CANVAS));

    expect(second.result.current).toBe(first.result.current);
  });

  it('hands a canvas of another colour space a buffer of its own', () => {
    const scene = new THREE.Scene();

    const srgb = renderHook(() => useSharedClipBuffer(scene, SRGB_CANVAS));
    const linear = renderHook(() => useSharedClipBuffer(scene, LINEAR_CANVAS));

    expect(linear.result.current).not.toBe(srgb.result.current);
  });

  it('frees the target only when the last group unmounts', async () => {
    const scene = new THREE.Scene();
    const first = renderHook(() => useSharedClipBuffer(scene, SRGB_CANVAS));
    const second = renderHook(() => useSharedClipBuffer(scene, SRGB_CANVAS));
    const dispose = vi.spyOn(first.result.current, 'dispose');

    first.unmount();
    await act(async () => await Promise.resolve());
    expect(dispose).not.toHaveBeenCalled();
    second.unmount();
    await act(async () => await Promise.resolve());

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('keeps the target of a group mounted under StrictMode, and frees it once on unmount', async () => {
    const dispose = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'dispose');
    const group = renderHook(() => useSharedClipBuffer(new THREE.Scene(), SRGB_CANVAS), {
      wrapper: StrictMode,
    });
    await act(async () => await Promise.resolve());
    expect(dispose).not.toHaveBeenCalled();

    group.unmount();
    await act(async () => await Promise.resolve());

    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
