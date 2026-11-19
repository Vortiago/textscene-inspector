import type * as THREE from 'three';
import type { RgbaImage } from '../../utils/encodePng.js';
import { reverseRowsInPlace } from '../../utils/reversedRows.js';
import { unpremultiplyAlpha } from '../../utils/unpremultiplyAlpha.js';

/** Read in the task that drew it: the browser clears the buffer when it composites. */
export function readCanvasPixels(gl: THREE.WebGLRenderer): RgbaImage {
  const context = gl.getContext();
  const { drawingBufferWidth: width, drawingBufferHeight: height } = context;
  // A PNG holds at least one pixel, so an element with no size has no image.
  if (width === 0 || height === 0) {
    throw new Error(`expected a canvas with a size, got ${width} x ${height}`);
  }
  const data = new Uint8Array(width * height * 4);
  const previous = gl.getRenderTarget();
  try {
    gl.setRenderTarget(null);
    context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, data);
  } finally {
    gl.setRenderTarget(previous);
  }
  // `readPixels` answers the bottom row first.
  reverseRowsInPlace(data, width, height);
  if (context.getContextAttributes()?.premultipliedAlpha !== false) unpremultiplyAlpha(data);
  return { width, height, data };
}
