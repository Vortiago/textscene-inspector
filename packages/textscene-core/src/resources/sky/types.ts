/**
 * Sky resource types: the three materials a Godot `Sky` can carry. Names and
 * units mirror Godot (`sun_angle_max` in degrees, `sky_curve` as authored). The
 * shader-uniform conversions happen on upload, in `build.ts`.
 */

import type { Color } from '../../utils/colorParser';

export interface ProceduralSkyProperties {
  kind: 'procedural';
  sky_top_color: Color;
  sky_horizon_color: Color;
  sky_curve: number;
  sky_energy_multiplier: number;
  ground_bottom_color: Color;
  ground_horizon_color: Color;
  ground_curve: number;
  ground_energy_multiplier: number;
  /** Degrees. Godot uploads its cosine. */
  sun_angle_max: number;
  sun_curve: number;
  /** The sky's overall exposure. */
  energy_multiplier: number;
}

export interface PanoramaSkyProperties {
  kind: 'panorama';
  /** An equirectangular Texture2D reference, or undefined for an unset sky. */
  panorama: string | undefined;
  energy_multiplier: number;
}

export interface PhysicalSkyProperties {
  kind: 'physical';
  rayleigh_coefficient: number;
  rayleigh_color: Color;
  mie_coefficient: number;
  mie_eccentricity: number;
  mie_color: Color;
  turbidity: number;
  sun_disk_scale: number;
  ground_color: Color;
  energy_multiplier: number;
}

export type SkyProperties =
  | ProceduralSkyProperties
  | PanoramaSkyProperties
  | PhysicalSkyProperties;
