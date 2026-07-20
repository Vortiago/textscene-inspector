/** Camera2D — defines the 2D view framing (extends Node2D). */

import type { Node2DProperties, Vector2 } from '../../base/node2d/types';

/** Godot Camera2D.AnchorMode. */
export const Camera2DAnchorMode = {
  FIXED_TOP_LEFT: 0,
  DRAG_CENTER: 1,
} as const;

export interface Camera2DProperties extends Node2DProperties {
  /** View magnification (higher = more zoomed in); default (1, 1). */
  zoom: Vector2;
  /** Pixel offset of the view from the camera's position. */
  offset: Vector2;
  /** 0 = FIXED_TOP_LEFT, 1 = DRAG_CENTER (Godot default). */
  anchor_mode: number;
  /**
   * Scroll limits in canvas pixels. Godot's defaults are +/-10000000 — large
   * enough to be "unlimited" in practice, but real values in real scenes.
   */
  limitLeft: number;
  limitTop: number;
  limitRight: number;
  limitBottom: number;
  /** When false the four limits are ignored entirely. Godot default true. */
  limitEnabled: boolean;
  /** Whether this camera is the active one (default true). */
  enabled: boolean;
}
