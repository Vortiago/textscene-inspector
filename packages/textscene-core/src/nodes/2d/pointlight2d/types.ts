/** The PointLight2D property shape: the Light2D surface plus the cookie texture that shapes it. */

import type { Light2DProperties } from '../lights/shared/types';
import type { Vector2 } from '../../../godot/vector';

export interface PointLight2DProperties extends Light2DProperties {
  texture?: string;
  texture_scale: number;
  offset: Vector2;
}
