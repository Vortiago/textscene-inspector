/** AreaLight3D node data. */

import type { Node3DProperties } from '../../../base/node3d/types';
import type { PositionalLightProperties } from '../shared/types';
import type { Vector2 } from '../../../../godot/math/vector';

/** AreaLight3D properties: Light3D plus the rectangle. */
export interface AreaLight3DProperties extends Node3DProperties, PositionalLightProperties {
  /** The AreaLight3D default is 1.0, where the other lights default to 0.5. */
  light_specular: number;

  /** The penumbra's size: a soft shadow spreads over it. The AreaLight3D default is 0.5. */
  light_size: number;

  /** The distance at which the light reaches zero, from the closest point of the rectangle. */
  area_range: number;

  /** The exponent of the distance falloff, beyond the falloff of the rectangle's solid angle. */
  area_attenuation: number;

  /** Rectangle size, each axis 0 or more. The render and the inspector both read these numbers. */
  area_size: Vector2;

  /**
   * Godot divides the light's colour by `area_size.x * area_size.y` when this is on (its
   * default), so resizing the rectangle does not change how much light it emits.
   */
  area_normalize_energy: boolean;

  /** The Texture2D reference the rectangle emits, or undefined for a plain colour. */
  area_texture?: string;
}
