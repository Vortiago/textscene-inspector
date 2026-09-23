/** SpotLight3D node data. */

import type { Node3DProperties } from '../../../base/node3d/types';
import type { BaseLightProperties } from '../shared/types';

/** SpotLight3D properties: Light3D plus the cone. */
export interface SpotLight3DProperties extends Node3DProperties, BaseLightProperties {
  /** Maximum distance the light reaches */
  spot_range: number;

  /** Cone angle in degrees */
  spot_angle: number;

  /** Distance falloff exponent (Godot default 1) → three.js decay. */
  spot_attenuation: number;

  /** Cone-edge falloff exponent (Godot default 1); higher = sharper edge. */
  spot_angle_attenuation: number;

  /** Penumbra for soft edges (optional, 0-1). Overrides the derived value. */
  penumbra?: number;
}
