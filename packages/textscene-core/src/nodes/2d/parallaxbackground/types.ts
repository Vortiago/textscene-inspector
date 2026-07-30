/**
 * ParallaxBackground — a **CanvasLayer**, not a Node2D
 * (`parallax_background.cpp`: `GDCLASS(ParallaxBackground, CanvasLayer)`), so it
 * carries the CanvasLayer placement surface (offset/rotation/scale, or the
 * composite `transform`) plus its own `scroll_*` group.
 */

import type { Vector2 } from '../../base/node2d/types';

export interface ParallaxBackgroundProperties {
  name: string;
  /** Owning node's path, straight off the heading — how the tree is rebuilt. */
  parent?: string;
  instance?: string;
  index?: number;
  visible?: boolean;

  /**
   * CanvasLayer draw order. Godot's CanvasLayer default is 0, but
   * `ParallaxBackground::ParallaxBackground()` runs `set_layer(-100)` — "behind
   * all by default" — and a `.tscn` omits any property equal to the class
   * default, so an authored ParallaxBackground almost never writes `layer`.
   */
  layer: number;

  /**
   * The CanvasLayer's own placement, already resolved: `transform` when the
   * scene writes one (`_bind_methods` registers it after offset/rotation/scale,
   * so Godot's serializer emits it last and it wins), otherwise composed from
   * `offset` / `rotation` / `scale`.
   */
  offset: Vector2;
  /** Radians. */
  rotation: number;
  scale: Vector2;

  /** `canvas_set_parent`s the layer onto the world canvas so it tracks the camera. */
  follow_viewport_enabled: boolean;
  follow_viewport_scale: number;

  /**
   * Godot recomputes this from the current Camera2D every frame
   * (`_camera_moved` → `set_scroll_offset`), so an authored value never
   * survives a running scene. Parsed for the inspector and the linter.
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
