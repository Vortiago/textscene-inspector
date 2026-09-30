/**
 * Whether a canvas has been sized for the viewport. A canvas the page has not laid out
 * yet keeps the HTML default of 300x150, and a readback of it is blank whatever the scene.
 */

/** The size the HTML spec gives a canvas nothing has sized. */
const DEFAULT_CANVAS = { width: 300, height: 150 };

/** Smaller than any viewport the preview lays out: an offscreen pass's own canvas. */
const MIN_VIEWPORT_SIDE = 50;

export function isSizedCanvas({ width, height }) {
  if (width === DEFAULT_CANVAS.width && height === DEFAULT_CANVAS.height) return false;
  return width > MIN_VIEWPORT_SIDE && height > MIN_VIEWPORT_SIDE;
}
