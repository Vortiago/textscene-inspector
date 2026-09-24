/**
 * The ParallaxBackground property shape. It is a CanvasLayer, not a Node2D
 * (`parallax_background.cpp`: `GDCLASS(ParallaxBackground, CanvasLayer)`), so it carries the CanvasLayer
 * placement plus its own `scroll_*` group.
 */

import type { Vector2 } from '../../base/node2d/types';

export interface ParallaxBackgroundProperties {
  name: string;
  /** The owning node's path, from the heading. The tree is rebuilt from it. */
  parent?: string;
  instance?: string;
  index?: number;
  visible?: boolean;

  /** CanvasLayer draw order. The CanvasLayer default is 0, but this class's is -100. */
  layer: number;

  /** The CanvasLayer's own placement: from `transform` when written, else from the parts. */
  offset: Vector2;
  /** Radians. */
  rotation: number;
  scale: Vector2;

  /** `canvas_set_parent`s the layer onto the world canvas so it tracks the camera. */
  follow_viewport_enabled: boolean;
  follow_viewport_scale: number;

  /**
   * Godot recomputes this from the current Camera2D every frame, so an authored
   * value never survives a running scene. Parsed for the inspector and linter.
   */
  scroll_offset: Vector2;
  /** Added to every child layer's scroll before the camera term is applied. */
  scroll_base_offset: Vector2;
  /** Multiplies the camera-derived scroll for every child layer. */
  scroll_base_scale: Vector2;
  /** Top-left scroll limit; inert unless it is below `scroll_limit_end` per axis. */
  scroll_limit_begin: Vector2;
  /** Bottom-right scroll limit. */
  scroll_limit_end: Vector2;
  /** Divides the layer offsets by the camera zoom so layers keep their on-screen size. */
  scroll_ignore_camera_zoom: boolean;
}
