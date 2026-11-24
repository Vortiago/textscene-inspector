import * as THREE from 'three';
import { reverseRowsInPlace } from '../../utils/reversedRows.js';
import type { RootWindow } from './rootWindow.js';
import { readRenderTargetPixels } from '../../resources/formats/image/imagePixels.js';
import type { RgbaImage } from '../../utils/encodePng.js';
import { drawWindowInto } from './presentRootTarget.js';

export function readWindowPixels(
  gl: THREE.WebGLRenderer,
  source: THREE.Texture | null,
  window: Pick<RootWindow, 'size' | 'drawRect'>,
  isTransparent: boolean
): RgbaImage {
  const { x: width, y: height } = window.size;
  const target = new THREE.WebGLRenderTarget(width, height);
  const previous = gl.getRenderTarget();
  try {
    drawWindowInto(gl, target, source, window, isTransparent);
    const pixels = readRenderTargetPixels(gl, target);
    // `readPixels` answers the bottom row first.
    reverseRowsInPlace(pixels.data, width, height);
    return pixels;
  } finally {
    gl.setRenderTarget(previous);
    target.dispose();
  }
}
