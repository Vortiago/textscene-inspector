/**
 * SpotLight3D type definitions
 */

import type { Node3DProperties } from '../../../base/node3d/types';
import type { BaseLightProperties } from '../shared/types';

/**
 * SpotLight3D node properties
 *
 * Extends Node3D with cone-shaped light capabilities
 */
export interface SpotLight3DProperties extends Node3DProperties, BaseLightProperties {
  /** Maximum distance the light reaches */
  spot_range: number;

  /** Cone angle in degrees */
  spot_angle: number;

  /** Distance falloff exponent (Godot default 1) → three.js decay. */
  spot_attenuation: number;

  /** Cone-edge falloff exponent (Godot default 1); higher = sharper edge. */
  spot_angle_attenuation: number;

  /** Penumbra for soft edges (optional, 0-1) — overrides the derived value. */
  penumbra?: number;
}
