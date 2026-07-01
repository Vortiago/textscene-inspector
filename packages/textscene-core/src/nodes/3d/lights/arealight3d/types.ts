/**
 * AreaLight3D type definitions
 */

import type { Node3DProperties } from '../../../base/node3d/types';
import type { BaseLightWithNormalBias } from '../shared/types';
import type { Vector2 } from '../../../../parser/vectors';

/**
 * AreaLight3D node properties
 *
 * Extends Node3D with rectangular area light capabilities
 */
export interface AreaLight3DProperties extends Node3DProperties, BaseLightWithNormalBias {
  /**
   * Penumbra/softness of the area light (optional, defaults to 1.0).
   * Intentionally lossy: parsed + lint-validated but NOT applied at
   * render — three.js RectAreaLight has no penumbra/range control, so
   * the value is carried on the parsed node yet never touches the light
   * (mirrors how shadow_* is dropped; see Component.tsx header).
   */
  area_range?: number;

  /**
   * Rectangular dimensions, parsed once from the Godot `Vector2(w, h)`
   * string into `{x, y}` (defaults to `{x: 1, y: 1}`). Both the render
   * (width/height) and inspector (Size) read these numbers directly, so
   * there is no per-consumer re-parse.
   */
  area_size?: Vector2;
}
