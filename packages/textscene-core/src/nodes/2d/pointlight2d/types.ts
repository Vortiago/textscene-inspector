/** The PointLight2D property shape: the Light2D surface plus the cookie texture that shapes it. */

import type { Vector2 } from '../../base/node2d/types';
import type { Light2DProperties } from '../lights/shared/types';

export interface PointLight2DProperties extends Light2DProperties {
  texture?: string;
  texture_scale: number;
  offset: Vector2;
}
