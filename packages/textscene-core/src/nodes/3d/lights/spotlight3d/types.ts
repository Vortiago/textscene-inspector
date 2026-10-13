/** SpotLight3D node data. */

import type { Node3DProperties } from '../../../base/node3d/types';
import type { BaseLightWithNormalBias } from '../shared/types';

/** SpotLight3D properties: Light3D plus the cone. */
export interface SpotLight3DProperties extends Node3DProperties, BaseLightWithNormalBias {
  /** Maximum distance the light reaches */
  spot_range: number;

  /** Cone angle in degrees */
  spot_angle: number;

  /** The distance falloff exponent (Godot default 1). */
  spot_attenuation: number;

  /** The inverse of the cone's falloff exponent (Godot default 1). */
  spot_angle_attenuation: number;
}
