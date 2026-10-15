/** SpotLight3D node data. */

import type { Node3DProperties } from '../../../base/node3d/types';
import type { PositionalLightProperties } from '../shared/types';

/** SpotLight3D properties: Light3D plus the cone. */
export interface SpotLight3DProperties extends Node3DProperties, PositionalLightProperties {
  /** Maximum distance the light reaches */
  spot_range: number;

  /** Cone angle in degrees */
  spot_angle: number;

  /** The distance falloff exponent. */
  spot_attenuation: number;

  /** The inverse of the cone's falloff exponent. */
  spot_angle_attenuation: number;
}
