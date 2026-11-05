/**
 * SubViewport: a Viewport that renders its subtree into an offscreen target. Defaults are Godot's
 * own (`doc/classes/SubViewport.xml`).
 */

import type { Vector2 } from '../../../godot/math/vector';
import type { ViewportProperties } from '../shared/types';

export interface SubViewportProperties extends ViewportProperties {
  /** Target size in pixels. Overwritten by a stretching SubViewportContainer. */
  size: Vector2;
  /** 2D-only size override; `(0, 0)` means unused. */
  size_2d_override: Vector2;
  size_2d_override_stretch: boolean;
  render_target_update_mode: number;
  render_target_clear_mode: number;
}
