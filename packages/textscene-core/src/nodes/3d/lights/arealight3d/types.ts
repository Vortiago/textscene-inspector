/** AreaLight3D node data. */

import type { Node3DProperties } from '../../../base/node3d/types';
import type { BaseLightWithNormalBias } from '../shared/types';
import type { Vector2 } from '../../../../parser/vectors';

/** AreaLight3D properties: Light3D plus the rectangle. */
export interface AreaLight3DProperties extends Node3DProperties, BaseLightWithNormalBias {
  /**
   * Penumbra of the area light (optional, default 1.0). Parsed and validated
   * but not applied, since three.js RectAreaLight has no penumbra or range
   * control, as with shadow_*.
   */
  area_range?: number;

  /**
   * Rectangle size, parsed once from `Vector2(w, h)` (default `{x: 1, y: 1}`).
   * The render and the inspector both read these numbers.
   */
  area_size?: Vector2;

  /**
   * Godot divides the light's colour by `area_size.x * area_size.y` when this
   * is on (its default), so resizing the rectangle does not change how much
   * light it emits. three.js RectAreaLight intensity is a luminance and scales
   * with area for the same reason, so the same division applies at render.
   */
  area_normalize_energy: boolean;
}
