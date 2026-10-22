/**
 * FastNoiseLite decode: a `[sub_resource type="FastNoiseLite"]` property bag into
 * generator settings, with Godot's defaults (`modules/noise/fastnoise_lite.h:97-124`)
 * for what a `.tres` omits. No THREE and no noise library: this decides what the
 * generator is, and `noisetexture2d/build.ts` runs it.
 */

import { boolOr, enumOr, floatOr, intOr } from '../../../parser/valueParsers';
import { parseVector3 } from '../../../parser/vectors';
import { warn } from '../../../logger';
import { type FastNoiseLiteData } from './types';
import {
  FastNoiseLiteCellularDistanceFunction,
  FastNoiseLiteCellularReturnType,
  FastNoiseLiteDomainWarpFractalType,
  FastNoiseLiteDomainWarpType,
  FastNoiseLiteFractalType,
  FastNoiseLiteNoiseType,
} from '../../../godot/scene/fastNoiseLite';

const NOISE_TYPES = [
  FastNoiseLiteNoiseType.SIMPLEX,
  FastNoiseLiteNoiseType.SIMPLEX_SMOOTH,
  FastNoiseLiteNoiseType.CELLULAR,
  FastNoiseLiteNoiseType.PERLIN,
  FastNoiseLiteNoiseType.VALUE_CUBIC,
  FastNoiseLiteNoiseType.VALUE,
] as const;

const FRACTAL_TYPES = [
  FastNoiseLiteFractalType.NONE,
  FastNoiseLiteFractalType.FBM,
  FastNoiseLiteFractalType.RIDGED,
  FastNoiseLiteFractalType.PING_PONG,
] as const;

const DISTANCE_FUNCTIONS = [
  FastNoiseLiteCellularDistanceFunction.EUCLIDEAN,
  FastNoiseLiteCellularDistanceFunction.EUCLIDEAN_SQUARED,
  FastNoiseLiteCellularDistanceFunction.MANHATTAN,
  FastNoiseLiteCellularDistanceFunction.HYBRID,
] as const;

const RETURN_TYPES = [
  FastNoiseLiteCellularReturnType.CELL_VALUE,
  FastNoiseLiteCellularReturnType.DISTANCE,
  FastNoiseLiteCellularReturnType.DISTANCE2,
  FastNoiseLiteCellularReturnType.DISTANCE2_ADD,
  FastNoiseLiteCellularReturnType.DISTANCE2_SUB,
  FastNoiseLiteCellularReturnType.DISTANCE2_MUL,
  FastNoiseLiteCellularReturnType.DISTANCE2_DIV,
] as const;

const WARP_TYPES = [
  FastNoiseLiteDomainWarpType.SIMPLEX,
  FastNoiseLiteDomainWarpType.SIMPLEX_REDUCED,
  FastNoiseLiteDomainWarpType.BASIC_GRID,
] as const;

const WARP_FRACTAL_TYPES = [
  FastNoiseLiteDomainWarpFractalType.NONE,
  FastNoiseLiteDomainWarpFractalType.PROGRESSIVE,
  FastNoiseLiteDomainWarpFractalType.INDEPENDENT,
] as const;

export function decodeFastNoiseLite(properties: Record<string, string>): FastNoiseLiteData {
  return {
    noiseType: enumOr(
      properties.noise_type,
      FastNoiseLiteNoiseType.SIMPLEX_SMOOTH,
      NOISE_TYPES,
      'FastNoiseLite noise_type'
    ),
    seed: intOr(properties.seed, 0, 'FastNoiseLite seed'),
    frequency: floatOr(properties.frequency, 0.01, 'FastNoiseLite frequency'),
    offset: vec3(properties.offset),

    fractalType: enumOr(
      properties.fractal_type,
      FastNoiseLiteFractalType.FBM,
      FRACTAL_TYPES,
      'FastNoiseLite fractal_type'
    ),
    fractalOctaves: intOr(properties.fractal_octaves, 5, 'FastNoiseLite fractal_octaves'),
    fractalLacunarity: floatOr(properties.fractal_lacunarity, 2, 'FastNoiseLite fractal_lacunarity'),
    fractalGain: floatOr(properties.fractal_gain, 0.5, 'FastNoiseLite fractal_gain'),
    fractalWeightedStrength: floatOr(
      properties.fractal_weighted_strength,
      0,
      'FastNoiseLite fractal_weighted_strength'
    ),
    fractalPingPongStrength: floatOr(
      properties.fractal_ping_pong_strength,
      2,
      'FastNoiseLite fractal_ping_pong_strength'
    ),

    cellularDistanceFunction: enumOr(
      properties.cellular_distance_function,
      FastNoiseLiteCellularDistanceFunction.EUCLIDEAN,
      DISTANCE_FUNCTIONS,
      'FastNoiseLite cellular_distance_function'
    ),
    cellularReturnType: enumOr(
      properties.cellular_return_type,
      FastNoiseLiteCellularReturnType.DISTANCE,
      RETURN_TYPES,
      'FastNoiseLite cellular_return_type'
    ),
    cellularJitter: floatOr(properties.cellular_jitter, 1, 'FastNoiseLite cellular_jitter'),

    domainWarpEnabled: boolOr(properties.domain_warp_enabled, false, 'FastNoiseLite domain_warp_enabled'),
    domainWarpType: enumOr(
      properties.domain_warp_type,
      FastNoiseLiteDomainWarpType.SIMPLEX,
      WARP_TYPES,
      'FastNoiseLite domain_warp_type'
    ),
    domainWarpAmplitude: floatOr(properties.domain_warp_amplitude, 30, 'FastNoiseLite domain_warp_amplitude'),
    domainWarpFrequency: floatOr(
      properties.domain_warp_frequency,
      0.05,
      'FastNoiseLite domain_warp_frequency'
    ),
    domainWarpFractalType: enumOr(
      properties.domain_warp_fractal_type,
      FastNoiseLiteDomainWarpFractalType.PROGRESSIVE,
      WARP_FRACTAL_TYPES,
      'FastNoiseLite domain_warp_fractal_type'
    ),
    domainWarpFractalOctaves: intOr(
      properties.domain_warp_fractal_octaves,
      5,
      'FastNoiseLite domain_warp_fractal_octaves'
    ),
    domainWarpFractalLacunarity: floatOr(
      properties.domain_warp_fractal_lacunarity,
      6,
      'FastNoiseLite domain_warp_fractal_lacunarity'
    ),
    domainWarpFractalGain: floatOr(
      properties.domain_warp_fractal_gain,
      0.5,
      'FastNoiseLite domain_warp_fractal_gain'
    ),
  };
}

const ZERO = { x: 0, y: 0, z: 0 };

/** `Vector3(x, y, z)` → offset. Absent or malformed keeps Godot's zero offset. */
function vec3(value: string | undefined): { x: number; y: number; z: number } {
  if (value === undefined) return ZERO;
  try {
    return parseVector3(value);
  } catch {
    warn(`FastNoiseLite offset: invalid Vector3 "${value}", using (0, 0, 0)`);
    return ZERO;
  }
}
