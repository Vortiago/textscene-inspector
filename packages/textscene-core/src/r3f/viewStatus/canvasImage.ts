import type * as THREE from 'three';
import type { RgbaImage } from '../../utils/encodePng.js';
import { reverseRowsInPlace } from '../../utils/reversedRows.js';

const OPAQUE = 255;

/** Read in the task that drew it: the browser clears the buffer when it composites. */
export function readCanvasPixels(gl: THREE.WebGLRenderer): RgbaImage {
  const context = gl.getContext();
  const { drawingBufferWidth: width, drawingBufferHeight: height } = context;
  const data = new Uint8Array(width * height * 4);
  gl.setRenderTarget(null);
  context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, data);
  // `readPixels` answers the bottom row first.
  reverseRowsInPlace(data, width, height);
  if (context.getContextAttributes()?.premultipliedAlpha !== false) unpremultiplyInPlace(data);
  return { width, height, data };
}

/** The page composites the buffer as premultiplied, and a PNG holds straight alpha. */
function unpremultiplyInPlace(data: Uint8Array): void {
  for (let at = 0; at < data.length; at += 4) {
    const alpha = data[at + 3]!;
    if (alpha === 0 || alpha === OPAQUE) continue;
    for (let channel = at; channel < at + 3; channel++) {
      data[channel] = Math.min(OPAQUE, Math.round((data[channel]! * OPAQUE) / alpha));
    }
  }
}
