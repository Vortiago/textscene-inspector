/**
 * Sky resource parser. Every default below is the value Godot's own
 * constructor installs (`scene/resources/3d/sky_material.cpp`) — a sky that
 * omits a property is the common case, not the exception, so getting these
 * wrong is indistinguishable from getting the shader wrong.
 */

import type { TscnInternalResource } from '../../parser/types';
import type { Color } from '../materials/standardmaterial3d/types';
import type { SkyProperties } from './types';
import { floatOr } from '../../parser/valueParsers';
import { colorOr } from '../../utils/colorParser';
import { resolveSubResourceRef } from '../SubResourceResolver';

const rgb = (r: number, g: number, b: number): Color => ({ r, g, b, a: 1 });

export function parseSkyMaterial(
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

/**
 * Resolves `Environment.sky` → `Sky.sky_material` → the parsed material.
 *
 * Null at every dead end, never a guess: an unresolvable sky renders no sky,
 * which is visibly wrong in a way a silently-substituted one is not. A
 * `sky_material` held in an ExtResource (`.tres`) cannot be followed from the
 * scene's internal resources and is therefore one of those dead ends.
 */
export function resolveSky(
  skyRef: string | undefined,
  internalResources: readonly TscnInternalResource[]
): SkyProperties | null {
  const skyResource = resolveSubResourceRef(skyRef, internalResources);
  if (skyResource?.type !== 'Sky') return null;

  const materialRef = (skyResource.data as { sky_material?: string }).sky_material;
  const material = resolveSubResourceRef(materialRef, internalResources);
  if (!material) return null;

  return parseSkyMaterial(material.type, material.data as Record<string, string>);
}

