/**
 * Sky slice decode (ADR-0031). Every default is the value Godot's constructor
 * installs (`scene/resources/3d/sky_material.cpp`): a sky usually omits most
 * properties, so a wrong default looks like a wrong shader.
 */

import type { Color } from '../../utils/colorParser';
import type { RadianceFilter, Sky, SkyProcessMode, SkyProcessing, SkyProperties } from './types';
import {
  REAL_TIME_RADIANCE_SIZE,
  SKY_RADIANCE_SIZES,
  SKY_RADIANCE_SIZE_DEFAULT,
} from '../../godot/skyReflection';
import { floatOr, parseOptionalInt } from '../../parser/valueParsers';
import { colorOr } from '../../utils/colorParser';

const rgb = (r: number, g: number, b: number): Color => ({ r, g, b, a: 1 });

/**
 * The `sky_material` a `Sky` points at, `SubResource("…")` or `ExtResource("…")`
 * verbatim. `Sky` is an indirection, not a fourth material. `undefined` for any
 * other type, so a caller can pass whatever `Environment.sky` resolved to.
 */
export function skyMaterialRef(
  type: string | undefined,
  data: Record<string, string> | undefined
): string | undefined {
  if (type !== 'Sky') return undefined;
  return data?.sky_material;
}

/** `Sky::ProcessMode` by its value (`scene/resources/sky.h:51-56`). */
const PROCESS_MODES: readonly SkyProcessMode[] = ['automatic', 'quality', 'incremental', 'real-time'];

/**
 * A `Sky`'s process mode and radiance size. An invalid value reads as Godot's default and logs
 * nothing, as the Sky validators report it. `set_radiance_size` refuses an index past the table
 * (`sky.cpp:34`), so such a size stays at the default.
 */
export function decodeSkyProcessing(data: Record<string, string>): SkyProcessing {
  return {
    processMode: entryOr(PROCESS_MODES, data.process_mode, 'automatic'),
    radianceSize: entryOr(SKY_RADIANCE_SIZES, data.radiance_size, SKY_RADIANCE_SIZE_DEFAULT),
  };
}

/** The entry of `table` that the int `value` indexes, or `fallback`. */
function entryOr<T>(table: readonly T[], value: string | undefined, fallback: T): T {
  const index = parseOptionalInt(value);
  return (index === undefined ? undefined : table[index]) ?? fallback;
}

/**
 * The `Sky` whose properties are `data`, drawing `material`. An invalid value reads as
 * `decodeSkyProcessing` reads it. Godot bakes a real-time sky at `REAL_TIME_RADIANCE_SIZE` whatever
 * its `radiance_size` (`sky.cpp:590-592`).
 */
export function decodeSky(data: Record<string, string>, material: SkyProperties): Sky {
  const { processMode, radianceSize } = decodeSkyProcessing(data);
  return {
    material,
    radianceFilter: radianceFilter(processMode),
    radianceSize: processMode === 'real-time' ? REAL_TIME_RADIANCE_SIZE : radianceSize,
  };
}

/**
 * The filter Godot bakes a sky's layers with (`sky.cpp:1335-1344`). Automatic picks real-time
 * only for a shader that reads `TIME` or `POSITION` (`sky.cpp:1001-1004`), and no built-in sky
 * material does (`scene/resources/3d/sky_material.cpp`), so only Real-Time takes the fast filter.
 */
function radianceFilter(processMode: SkyProcessMode): RadianceFilter {
  return processMode === 'real-time' ? 'fast' : 'importance-sample';
}

export function decodeSkyMaterial(type: string, data: Record<string, string>): SkyProperties | null {
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
        ground_energy_multiplier: floatOr(data.ground_energy_multiplier, 1, 'ground_energy_multiplier'),
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
