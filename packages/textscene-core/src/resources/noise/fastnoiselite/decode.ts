/**
 * FastNoiseLite decode — a `[sub_resource type="FastNoiseLite"]` property bag
 * into the generator settings, through the shared value decoders.
 *
 * Every default is Godot's own (`modules/noise/fastnoise_lite.h:97-124`); a
 * `.tres` writes only what differs from them, so the corpus's eight procedural
 * materials lean on the defaults far more than on what they author.
 *
 * Pure `.ts`, no THREE and no noise library: this decides WHAT the generator is,
 * `noisetexture2d/build.ts` runs it.
 */

import { boolOr, enumOr, floatOr, intOr } from '../../../parser/valueParsers';
import { parseVector3 } from '../../../parser/vectors';
import { warn } from '../../../logger';
import {
  CellularDistanceFunction,
  CellularReturnType,
  DomainWarpFractalType,
  DomainWarpType,
  NoiseFractalType,
  NoiseType,
  type FastNoiseLiteData,
} from './types';

const NOISE_TYPES = [
  NoiseType.SIMPLEX,
  NoiseType.SIMPLEX_SMOOTH,
  NoiseType.CELLULAR,
  NoiseType.PERLIN,
  NoiseType.VALUE_CUBIC,
  NoiseType.VALUE,
] as const;

const FRACTAL_TYPES = [
  NoiseFractalType.NONE,
  NoiseFractalType.FBM,
  NoiseFractalType.RIDGED,
  NoiseFractalType.PING_PONG,
] as const;

const DISTANCE_FUNCTIONS = [
  CellularDistanceFunction.EUCLIDEAN,
  CellularDistanceFunction.EUCLIDEAN_SQUARED,
  CellularDistanceFunction.MANHATTAN,
  CellularDistanceFunction.HYBRID,
] as const;

const RETURN_TYPES = [
  CellularReturnType.CELL_VALUE,
  CellularReturnType.DISTANCE,
  CellularReturnType.DISTANCE2,
  CellularReturnType.DISTANCE2_ADD,
  CellularReturnType.DISTANCE2_SUB,
  CellularReturnType.DISTANCE2_MUL,
  CellularReturnType.DISTANCE2_DIV,
] as const;

const WARP_TYPES = [
  DomainWarpType.SIMPLEX,
  DomainWarpType.SIMPLEX_REDUCED,
  DomainWarpType.BASIC_GRID,
] as const;

const WARP_FRACTAL_TYPES = [
  DomainWarpFractalType.NONE,
  DomainWarpFractalType.PROGRESSIVE,
  DomainWarpFractalType.INDEPENDENT,
] as const;

export function decodeFastNoiseLite(properties: Record<string, unknown>): FastNoiseLiteData {
  const read = (key: string): string | undefined => {
    const value = properties[key];
    return typeof value === 'string' ? value : undefined;
  };

  return {
    noiseType: enumOr(read('noise_type'), NoiseType.SIMPLEX_SMOOTH, NOISE_TYPES, 'FastNoiseLite noise_type'),
    seed: intOr(read('seed'), 0, 'FastNoiseLite seed'),
    frequency: floatOr(read('frequency'), 0.01, 'FastNoiseLite frequency'),
    offset: vec3(read('offset')),

    fractalType: enumOr(read('fractal_type'), NoiseFractalType.FBM, FRACTAL_TYPES, 'FastNoiseLite fractal_type'),
    fractalOctaves: intOr(read('fractal_octaves'), 5, 'FastNoiseLite fractal_octaves'),
    fractalLacunarity: floatOr(read('fractal_lacunarity'), 2, 'FastNoiseLite fractal_lacunarity'),
    fractalGain: floatOr(read('fractal_gain'), 0.5, 'FastNoiseLite fractal_gain'),
    fractalWeightedStrength: floatOr(read('fractal_weighted_strength'), 0, 'FastNoiseLite fractal_weighted_strength'),
    fractalPingPongStrength: floatOr(read('fractal_ping_pong_strength'), 2, 'FastNoiseLite fractal_ping_pong_strength'),

    cellularDistanceFunction: enumOr(
      read('cellular_distance_function'),
      CellularDistanceFunction.EUCLIDEAN,
      DISTANCE_FUNCTIONS,
      'FastNoiseLite cellular_distance_function'
    ),
    cellularReturnType: enumOr(
      read('cellular_return_type'),
      CellularReturnType.DISTANCE,
      RETURN_TYPES,
      'FastNoiseLite cellular_return_type'
    ),
    cellularJitter: floatOr(read('cellular_jitter'), 1, 'FastNoiseLite cellular_jitter'),

    domainWarpEnabled: boolOr(read('domain_warp_enabled'), false, 'FastNoiseLite domain_warp_enabled'),
    domainWarpType: enumOr(read('domain_warp_type'), DomainWarpType.SIMPLEX, WARP_TYPES, 'FastNoiseLite domain_warp_type'),
    domainWarpAmplitude: floatOr(read('domain_warp_amplitude'), 30, 'FastNoiseLite domain_warp_amplitude'),
    domainWarpFrequency: floatOr(read('domain_warp_frequency'), 0.05, 'FastNoiseLite domain_warp_frequency'),
    domainWarpFractalType: enumOr(
      read('domain_warp_fractal_type'),
      DomainWarpFractalType.PROGRESSIVE,
      WARP_FRACTAL_TYPES,
      'FastNoiseLite domain_warp_fractal_type'
    ),
    domainWarpFractalOctaves: intOr(read('domain_warp_fractal_octaves'), 5, 'FastNoiseLite domain_warp_fractal_octaves'),
    domainWarpFractalLacunarity: floatOr(read('domain_warp_fractal_lacunarity'), 6, 'FastNoiseLite domain_warp_fractal_lacunarity'),
    domainWarpFractalGain: floatOr(read('domain_warp_fractal_gain'), 0.5, 'FastNoiseLite domain_warp_fractal_gain'),
  };
}

const ZERO = { x: 0, y: 0, z: 0 };

/** `Vector3(x, y, z)` → offset; absent or malformed keeps Godot's zero offset. */
function vec3(value: string | undefined): { x: number; y: number; z: number } {
  if (value === undefined) return ZERO;
  try {
    return parseVector3(value);
  } catch {
    warn(`FastNoiseLite offset: invalid Vector3 "${value}", using (0, 0, 0)`);
    return ZERO;
  }
}
