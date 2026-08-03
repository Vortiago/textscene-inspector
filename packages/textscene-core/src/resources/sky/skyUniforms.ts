/**
 * Sky slice BUILD (ADR-0031): Godot-space sky properties plus the resolved
 * dependencies (the scene's directional lights, a panorama texture) → the THREE
 * uniform set the sky shader takes.
 *
 * The engine does not upload what the inspector shows. `ProceduralSkyMaterial`
 * turns its two easing curves into reciprocals with an "ad hoc adjustment"
 * (Godot's own word) left over from when they were angles rather than cosines,
 * turns `sun_angle_max` into its cosine, and pre-multiplies each colour by its
 * energy. Doing that conversion here — the same boundary the engine does it at
 * — keeps every other layer in Godot's own units.
 */

import * as THREE from 'three';
import type { SkyProperties } from './types';
import type { Color } from '../../utils/colorParser';
import { godotColorToLinear } from '../../r3f/godotColor';

/** A directional light as Godot's sky shader sees it. */
export interface SkyLight {
  /** Direction TOWARDS the light, i.e. where the sun appears in the sky. */
  direction: THREE.Vector3;
  color: THREE.Color;
  energy: number;
  /** Angular radius in radians (`light_angular_distance`), 0 for a point sun. */
  angularRadius: number;
}

/** Godot's sky shader has exactly four light slots, written out longhand. */
const LIGHT_SLOTS = 4;

export type SkyUniforms = Record<string, { value: unknown }>;

function scaledColor(color: Color, energy: number): THREE.Color {
  return godotColorToLinear(color).multiplyScalar(energy);
}

export function skyUniforms(
  sky: SkyProperties,
  lights: readonly SkyLight[],
  panorama?: THREE.Texture | null
): SkyUniforms {
  const uniforms: SkyUniforms = {};

  switch (sky.kind) {
    case 'procedural':
      Object.assign(uniforms, {
        sky_top_color: { value: scaledColor(sky.sky_top_color, sky.sky_energy_multiplier) },
        sky_horizon_color: {
          value: scaledColor(sky.sky_horizon_color, sky.sky_energy_multiplier),
        },
        inv_sky_curve: { value: 0.6 / sky.sky_curve },
        ground_bottom_color: {
          value: scaledColor(sky.ground_bottom_color, sky.ground_energy_multiplier),
        },
        ground_horizon_color: {
          value: scaledColor(sky.ground_horizon_color, sky.ground_energy_multiplier),
        },
        inv_ground_curve: { value: 0.6 / sky.ground_curve },
        sun_angle_max: { value: Math.cos(THREE.MathUtils.degToRad(sky.sun_angle_max)) },
        inv_sun_curve: { value: 1.6 / Math.pow(sky.sun_curve, 1.4) },
        exposure: { value: sky.energy_multiplier },
      });
      break;

    case 'panorama':
      Object.assign(uniforms, {
        source_panorama: { value: panorama ?? null },
        has_panorama: { value: !!panorama },
        exposure: { value: sky.energy_multiplier },
      });
      break;

    case 'physical':
      Object.assign(uniforms, {
        rayleigh: { value: sky.rayleigh_coefficient },
        rayleigh_color: { value: godotColorToLinear(sky.rayleigh_color) },
        mie: { value: sky.mie_coefficient },
        mie_eccentricity: { value: sky.mie_eccentricity },
        mie_color: { value: godotColorToLinear(sky.mie_color) },
        turbidity: { value: sky.turbidity },
        sun_disk_scale: { value: sky.sun_disk_scale },
        ground_color: { value: godotColorToLinear(sky.ground_color) },
        exposure: { value: sky.energy_multiplier },
      });
      break;
  }

  // The panorama sky is the one Godot shader with no light slots; giving it
  // them anyway would declare uniforms its GLSL never reads.
  if (sky.kind !== 'panorama') {
    for (let i = 0; i < LIGHT_SLOTS; i++) {
      const light = lights[i];
      uniforms[`LIGHT${i}_ENABLED`] = { value: !!light };
      uniforms[`LIGHT${i}_DIRECTION`] = {
        value: light ? light.direction.clone().normalize() : new THREE.Vector3(0, 1, 0),
      };
      uniforms[`LIGHT${i}_COLOR`] = { value: light ? light.color.clone() : new THREE.Color(1, 1, 1) };
      uniforms[`LIGHT${i}_ENERGY`] = { value: light?.energy ?? 0 };
      uniforms[`LIGHT${i}_SIZE`] = { value: light?.angularRadius ?? 0 };
    }
  }

  return uniforms;
}
