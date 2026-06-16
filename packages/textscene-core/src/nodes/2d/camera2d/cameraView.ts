/**
 * What a Camera2D frames — pure math from the camera's parsed surface + its
 * world position to {view center (Godot canvas px), magnification}. Mirrors
 * Godot's anchoring: DRAG_CENTER (default) centers the view on the camera;
 * FIXED_TOP_LEFT puts the camera at the view's top-left corner, so the
 * center sits half a view further (view size = viewport / zoom). `offset`
 * shifts in canvas pixels. Consumed by the Cameras panel to frame the 2D
 * stage ("view through" a 2D camera).
 */

import { Camera2DAnchorMode, type Camera2DProperties } from './types';

export interface Camera2DView {
  /** View center in Godot canvas pixels. */
  center: { x: number; y: number };
  /** Magnification (Godot zoom; higher = closer). */
  zoom: number;
}

export function camera2DView(
  props: Pick<Camera2DProperties, 'zoom' | 'offset' | 'anchor_mode'>,
  worldPosition: { x: number; y: number },
  viewportSize: { x: number; y: number }
): Camera2DView {
  const zoom = props.zoom.x || 1;
  let cx = worldPosition.x + props.offset.x;
  let cy = worldPosition.y + props.offset.y;
  if (props.anchor_mode === Camera2DAnchorMode.FIXED_TOP_LEFT) {
    cx += viewportSize.x / (2 * zoom);
    cy += viewportSize.y / (2 * zoom);
  }
  return { center: { x: cx, y: cy }, zoom };
}
