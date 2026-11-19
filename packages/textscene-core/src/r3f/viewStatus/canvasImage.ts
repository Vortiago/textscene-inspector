import type * as THREE from 'three';
import type { RgbaImage } from '../../utils/encodePng.js';
import { reverseRowsInPlace } from '../../utils/reversedRows.js';
import { unpremultiplyAlpha } from '../../utils/unpremultiplyAlpha.js';

/** Read in the task that drew it: the browser clears the buffer when it composites. */
export function readCanvasPixels(gl: THREE.WebGLRenderer): RgbaImage {
  const context = gl.getContext();
  const { drawingBufferWidth: width, drawingBufferHeight: height } = context;
  const data = new Uint8Array(width * height * 4);
  gl.setRenderTarget(null);
  context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, data);
  // `readPixels` answers the bottom row first.
  reverseRowsInPlace(data, width, height);
  if (context.getContextAttributes()?.premultipliedAlpha !== false) unpremultiplyAlpha(data);
  return { width, height, data };
}
