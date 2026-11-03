/** The PointLight2D property shape: the Light2D surface plus its height and the cookie that shapes it. */

import type { Light2DProperties } from '../lights/shared/types';
import type { Vector2 } from '../../../godot/math/vector';

export interface PointLight2DProperties extends Light2DProperties {
  /** `Light2D.height`: how far above the canvas the light sits, in canvas pixels, read only by normal maps. */
  height: number;
  texture?: string;
  texture_scale: number;
  offset: Vector2;
}
