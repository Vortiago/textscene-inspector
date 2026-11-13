/** The canvas colour space a painter reads: sRGB unless a sub-viewport's target uses HDR. */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { canvasColorSpaceOf, useCanvasColorSpace } from './canvasColorSpace';

const LINEAR_CANVAS = canvasColorSpaceOf(true);

describe('canvasColorSpaceOf', () => {
  it('gives the linear canvas to a target that uses HDR', () => {
    expect(LINEAR_CANVAS.isLinear).toBe(true);
  });

  it('gives the sRGB canvas to an 8-bit target', () => {
    expect(canvasColorSpaceOf(false)).toBe(canvasColorSpaceOf(false));
  });
});

describe('the two canvases', () => {
  it('samples raw bytes through the plain view in sRGB, and decoded texels through the sRGB view in linear', () => {
    expect([
      canvasColorSpaceOf(false).textureColorSpace,
      canvasColorSpaceOf(false).viewportTextureView,
    ]).toEqual([THREE.NoColorSpace, 'plain']);
    expect([LINEAR_CANVAS.textureColorSpace, LINEAR_CANVAS.viewportTextureView]).toEqual([
      THREE.SRGBColorSpace,
      'decoding',
    ]);
  });
});

describe('useCanvasColorSpace', () => {
  it('reads the sRGB canvas outside any provider, as the root canvas is', () => {
    expect(renderHook(() => useCanvasColorSpace()).result.current).toBe(canvasColorSpaceOf(false));
  });
});
