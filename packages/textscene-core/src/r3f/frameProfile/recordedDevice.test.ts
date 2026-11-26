import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { recordedDevice } from './recordedDevice';

function rendererWith(extensions: string[]): THREE.WebGLRenderer {
  const gl = { getSupportedExtensions: () => extensions, getExtension: () => null, getParameter: () => null };
  return {
    getContext: () => gl,
    domElement: { width: 1910, height: 1512 },
    getPixelRatio: () => 2,
  } as unknown as THREE.WebGLRenderer;
}

describe('recordedDevice', () => {
  it('names the drawing buffer in device pixels and the pixel ratio', () => {
    expect(recordedDevice(rendererWith([])).canvas).toEqual({ width: 1910, height: 1512, pixelRatio: 2 });
  });

  it('names the GPU features the reads of the stored depth depend on', () => {
    const { features } = recordedDevice(rendererWith(['OES_texture_float_linear', 'EXT_texture_norm16']));
    expect(features).toEqual({ floatLinear: true, floatRender: false, norm16: true, probeByte: null });
  });

  it('names the page it ran on', () => {
    expect(recordedDevice(rendererWith([])).url).toBe(window.location.href);
  });
});
