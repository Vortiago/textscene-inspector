/**
 * Where the 2D stage is looking, and the one algebra that moves it. Pure — the
 * gestures that call it are in `useStageGestures.ts`.
 */

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4;
export const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

/** CSS-scale step for one wheel notch — this stage's own feel, not Godot's. */
export const ZOOM_PER_NOTCH = 1.1;

/** The −/+ HUD buttons' step. Coarser than a notch: one click, one visible jump. */
export const ZOOM_STEP_BUTTON = 1.2;

/** Where the stage is looking: the CSS translate, and the CSS scale. */
export interface View2D {
  pan: { x: number; y: number };
  zoom: number;
}

/**
 * Scale about a point in stage-local pixels, keeping whatever sits under that
 * point pinned to it. Pure, so the three callers that need it — wheel (anchored
 * to the cursor), pinch (to the fingers' midpoint), HUD buttons (to the stage
 * centre) — share one implementation instead of three copies of the algebra.
 */
export function zoomViewAround(view: View2D, px: number, py: number, factor: number): View2D {
  const zoom = clampZoom(view.zoom * factor);
  const cx = (px - view.pan.x) / view.zoom;
  const cy = (py - view.pan.y) / view.zoom;
  return { pan: { x: px - cx * zoom, y: py - cy * zoom }, zoom };
}
