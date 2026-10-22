/**
 * A decoded `FastNoiseLite` as a 2D or 3D sampler over `fastnoise-lite`, the official
 * JS port of `thirdparty/misc/FastNoiseLite.h`. Not hand-ported: these maps only
 * translate decoded enums into the port's string constants.
 */

import FastNoiseLite, { Vector2, Vector3 } from 'fastnoise-lite';
import { type FastNoiseLiteData } from '../fastnoiselite/types';
import {
  FastNoiseLiteCellularDistanceFunction,
  FastNoiseLiteCellularReturnType,
  FastNoiseLiteDomainWarpFractalType,
  FastNoiseLiteDomainWarpType,
  FastNoiseLiteFractalType,
  FastNoiseLiteNoiseType,
} from '../../../godot/scene/fastNoiseLite';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

const NOISE_TYPE: Record<EnumValue<typeof FastNoiseLiteNoiseType>, string> = {
  [FastNoiseLiteNoiseType.SIMPLEX]: FastNoiseLite.NoiseType.OpenSimplex2,
  [FastNoiseLiteNoiseType.SIMPLEX_SMOOTH]: FastNoiseLite.NoiseType.OpenSimplex2S,
  [FastNoiseLiteNoiseType.CELLULAR]: FastNoiseLite.NoiseType.Cellular,
  [FastNoiseLiteNoiseType.PERLIN]: FastNoiseLite.NoiseType.Perlin,
  [FastNoiseLiteNoiseType.VALUE_CUBIC]: FastNoiseLite.NoiseType.ValueCubic,
  [FastNoiseLiteNoiseType.VALUE]: FastNoiseLite.NoiseType.Value,
};

const FRACTAL_TYPE: Record<EnumValue<typeof FastNoiseLiteFractalType>, string> = {
  [FastNoiseLiteFractalType.NONE]: FastNoiseLite.FractalType.None,
  [FastNoiseLiteFractalType.FBM]: FastNoiseLite.FractalType.FBm,
  [FastNoiseLiteFractalType.RIDGED]: FastNoiseLite.FractalType.Ridged,
  [FastNoiseLiteFractalType.PING_PONG]: FastNoiseLite.FractalType.PingPong,
};

const DISTANCE_FUNCTION: Record<EnumValue<typeof FastNoiseLiteCellularDistanceFunction>, string> = {
  [FastNoiseLiteCellularDistanceFunction.EUCLIDEAN]: FastNoiseLite.CellularDistanceFunction.Euclidean,
  [FastNoiseLiteCellularDistanceFunction.EUCLIDEAN_SQUARED]:
    FastNoiseLite.CellularDistanceFunction.EuclideanSq,
  [FastNoiseLiteCellularDistanceFunction.MANHATTAN]: FastNoiseLite.CellularDistanceFunction.Manhattan,
  [FastNoiseLiteCellularDistanceFunction.HYBRID]: FastNoiseLite.CellularDistanceFunction.Hybrid,
};

const RETURN_TYPE: Record<EnumValue<typeof FastNoiseLiteCellularReturnType>, string> = {
  [FastNoiseLiteCellularReturnType.CELL_VALUE]: FastNoiseLite.CellularReturnType.CellValue,
  [FastNoiseLiteCellularReturnType.DISTANCE]: FastNoiseLite.CellularReturnType.Distance,
  [FastNoiseLiteCellularReturnType.DISTANCE2]: FastNoiseLite.CellularReturnType.Distance2,
  [FastNoiseLiteCellularReturnType.DISTANCE2_ADD]: FastNoiseLite.CellularReturnType.Distance2Add,
  [FastNoiseLiteCellularReturnType.DISTANCE2_SUB]: FastNoiseLite.CellularReturnType.Distance2Sub,
  [FastNoiseLiteCellularReturnType.DISTANCE2_MUL]: FastNoiseLite.CellularReturnType.Distance2Mul,
  [FastNoiseLiteCellularReturnType.DISTANCE2_DIV]: FastNoiseLite.CellularReturnType.Distance2Div,
};

const WARP_TYPE: Record<EnumValue<typeof FastNoiseLiteDomainWarpType>, string> = {
  [FastNoiseLiteDomainWarpType.SIMPLEX]: FastNoiseLite.DomainWarpType.OpenSimplex2,
  [FastNoiseLiteDomainWarpType.SIMPLEX_REDUCED]: FastNoiseLite.DomainWarpType.OpenSimplex2Reduced,
  [FastNoiseLiteDomainWarpType.BASIC_GRID]: FastNoiseLite.DomainWarpType.BasicGrid,
};

/** Godot's own warp fractal enum onto upstream's (`_convert_domain_warp_fractal_type_enum`, fastnoise_lite.cpp:35-50). */
const WARP_FRACTAL_TYPE: Record<EnumValue<typeof FastNoiseLiteDomainWarpFractalType>, string> = {
  [FastNoiseLiteDomainWarpFractalType.NONE]: FastNoiseLite.FractalType.None,
  [FastNoiseLiteDomainWarpFractalType.PROGRESSIVE]: FastNoiseLite.FractalType.DomainWarpProgressive,
  [FastNoiseLiteDomainWarpFractalType.INDEPENDENT]: FastNoiseLite.FractalType.DomainWarpIndependent,
};

/** A sampler over the configured generator, offset like `get_noise_2d`. */
export type NoiseSampler = (x: number, y: number) => number;

/** A sampler over the configured generator, offset like `get_noise_3d`. */
export type NoiseSampler3D = (x: number, y: number, z: number) => number;

/**
 * The generator a decoded `FastNoiseLite` describes, as a 2D sampler. `offset` is added, then
 * the domain warp moves the position, before generating, as `FastNoiseLite::get_noise_2d` does
 * (fastnoise_lite.cpp:318-325).
 */
export function noiseSampler(data: FastNoiseLiteData): NoiseSampler {
  const noise = configuredNoise(data);
  const { x: ox, y: oy } = data.offset;
  if (!data.domainWarpEnabled) return (x, y) => noise.GetNoise(x + ox, y + oy);
  const warp = configuredWarp(data);
  const position = new Vector2(0, 0);
  return (x, y) => {
    position.x = x + ox;
    position.y = y + oy;
    warp.DomainWrap(position);
    return noise.GetNoise(position.x, position.y);
  };
}

/** {@link noiseSampler} in 3D, offset and warped on every axis as `get_noise_3d` is (fastnoise_lite.cpp:331-338). */
export function noiseSampler3D(data: FastNoiseLiteData): NoiseSampler3D {
  const noise = configuredNoise(data);
  const { x: ox, y: oy, z: oz } = data.offset;
  if (!data.domainWarpEnabled) return (x, y, z) => noise.GetNoise(x + ox, y + oy, z + oz);
  const warp = configuredWarp(data);
  const position = new Vector3(0, 0, 0);
  return (x, y, z) => {
    position.x = x + ox;
    position.y = y + oy;
    position.z = z + oz;
    warp.DomainWrap(position);
    return noise.GetNoise(position.x, position.y, position.z);
  };
}

/**
 * Every parameter is set, since the port's defaults are not Godot's (3 octaves
 * against 5, EuclideanSq against Euclidean). Set, it agrees with 4.6.3 to about 1e-7.
 */
function configuredNoise(data: FastNoiseLiteData): FastNoiseLite {
  const noise = new FastNoiseLite();
  noise.SetSeed(data.seed);
  noise.SetFrequency(data.frequency);
  noise.SetNoiseType(NOISE_TYPE[data.noiseType]);
  noise.SetFractalType(FRACTAL_TYPE[data.fractalType]);
  noise.SetFractalOctaves(data.fractalOctaves);
  noise.SetFractalLacunarity(data.fractalLacunarity);
  noise.SetFractalGain(data.fractalGain);
  noise.SetFractalWeightedStrength(data.fractalWeightedStrength);
  noise.SetFractalPingPongStrength(data.fractalPingPongStrength);
  noise.SetCellularDistanceFunction(DISTANCE_FUNCTION[data.cellularDistanceFunction]);
  noise.SetCellularReturnType(RETURN_TYPE[data.cellularReturnType]);
  noise.SetCellularJitter(data.cellularJitter);
  return noise;
}

/** The second generator `FastNoiseLite` warps through, set as its constructor sets it (fastnoise_lite.cpp:69-76). */
function configuredWarp(data: FastNoiseLiteData): FastNoiseLite {
  const warp = new FastNoiseLite();
  warp.SetDomainWarpType(WARP_TYPE[data.domainWarpType]);
  warp.SetSeed(data.seed);
  warp.SetDomainWarpAmp(data.domainWarpAmplitude);
  warp.SetFrequency(data.domainWarpFrequency);
  warp.SetFractalType(WARP_FRACTAL_TYPE[data.domainWarpFractalType]);
  warp.SetFractalOctaves(data.domainWarpFractalOctaves);
  warp.SetFractalLacunarity(data.domainWarpFractalLacunarity);
  warp.SetFractalGain(data.domainWarpFractalGain);
  return warp;
}
