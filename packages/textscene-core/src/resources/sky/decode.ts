/**
 * Sky slice decode (ADR-0031). Every default is the value Godot's constructor
 * installs (`scene/resources/3d/sky_material.cpp`): a sky usually omits most
 * properties, so a wrong default looks like a wrong shader.
 */

import type { Color } from '../../utils/colorParser';
import type { SkyProperties } from './types';
import { floatOr } from '../../parser/valueParsers';
import { colorOr } from '../../utils/colorParser';

const rgb = (r: number, g: number, b: number): Color => ({ r, g, b, a: 1 });

/**
 * The `sky_material` a `Sky` points at, `SubResource("…")` or `ExtResource("…")`
 * verbatim. `Sky` is an indirection, not a fourth material. `undefined` for any
 * other type, so a caller can pass whatever `Environment.sky` resolved to.
 */
export function skyMaterialRef(
  type: string | undefined,
  data: Record<string, unknown> | undefined
): string | undefined {
  if (type !== 'Sky') return undefined;
  const ref = data?.sky_material;
  return typeof ref === 'string' ? ref : undefined;
}

export function decodeSkyMaterial(
  type: string,
  data: Record<string, string>
): SkyProperties | null {
  switch (type) {
    case 'ProceduralSkyMaterial':
      return {
        kind: 'procedural',
        sky_top_color: colorOr(data.sky_top_color, rgb(0.385, 0.454, 0.55)),
        sky_horizon_color: colorOr(data.sky_horizon_color, rgb(0.6463, 0.6558, 0.6708)),
        sky_curve: floatOr(data.sky_curve, 0.15, 'sky_curve'),
        sky_energy_multiplier: floatOr(data.sky_energy_multiplier, 1, 'sky_energy_multiplier'),
        ground_bottom_color: colorOr(data.ground_bottom_color, rgb(0.2, 0.169, 0.133)),
        ground_horizon_color: colorOr(data.ground_horizon_color, rgb(0.6463, 0.6558, 0.6708)),
        ground_curve: floatOr(data.ground_curve, 0.02, 'ground_curve'),
        ground_energy_multiplier: floatOr(
          data.ground_energy_multiplier,
          1,
          'ground_energy_multiplier'
        ),
        sun_angle_max: floatOr(data.sun_angle_max, 30, 'sun_angle_max'),
        sun_curve: floatOr(data.sun_curve, 0.15, 'sun_curve'),
        energy_multiplier: floatOr(data.energy_multiplier, 1, 'energy_multiplier'),
      };

    case 'PanoramaSkyMaterial':
      return {
        kind: 'panorama',
        panorama: data.panorama,
        energy_multiplier: floatOr(data.energy_multiplier, 1, 'energy_multiplier'),
      };

    case 'PhysicalSkyMaterial':
      return {
        kind: 'physical',
        rayleigh_coefficient: floatOr(data.rayleigh_coefficient, 2, 'rayleigh_coefficient'),
        rayleigh_color: colorOr(data.rayleigh_color, rgb(0.3, 0.405, 0.6)),
        mie_coefficient: floatOr(data.mie_coefficient, 0.005, 'mie_coefficient'),
        mie_eccentricity: floatOr(data.mie_eccentricity, 0.8, 'mie_eccentricity'),
        mie_color: colorOr(data.mie_color, rgb(0.69, 0.729, 0.812)),
        turbidity: floatOr(data.turbidity, 10, 'turbidity'),
        sun_disk_scale: floatOr(data.sun_disk_scale, 1, 'sun_disk_scale'),
        ground_color: colorOr(data.ground_color, rgb(0.1, 0.07, 0.034)),
        energy_multiplier: floatOr(data.energy_multiplier, 1, 'energy_multiplier'),
      };

    default:
      return null;
  }
}
