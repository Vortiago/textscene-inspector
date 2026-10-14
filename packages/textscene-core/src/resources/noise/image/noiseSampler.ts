/**
 * A decoded `FastNoiseLite` as a 2D or 3D sampler over `fastnoise-lite`, the official
 * JS port of `thirdparty/misc/FastNoiseLite.h`. Not hand-ported: these maps only
 * translate decoded enums into the port's string constants.
 */

import FastNoiseLite, { Vector2, Vector3 } from 'fastnoise-lite';
import {
  CellularDistanceFunction,
  CellularReturnType,
  DomainWarpFractalType,
  DomainWarpType,
  NoiseFractalType,
  NoiseType,
  type FastNoiseLiteData,
} from '../fastnoiselite/types';

const NOISE_TYPE: Record<NoiseType, string> = {
  [NoiseType.SIMPLEX]: FastNoiseLite.NoiseType.OpenSimplex2,
  [NoiseType.SIMPLEX_SMOOTH]: FastNoiseLite.NoiseType.OpenSimplex2S,
  [NoiseType.CELLULAR]: FastNoiseLite.NoiseType.Cellular,
  [NoiseType.PERLIN]: FastNoiseLite.NoiseType.Perlin,
  [NoiseType.VALUE_CUBIC]: FastNoiseLite.NoiseType.ValueCubic,
  [NoiseType.VALUE]: FastNoiseLite.NoiseType.Value,
};

const FRACTAL_TYPE: Record<NoiseFractalType, string> = {
  [NoiseFractalType.NONE]: FastNoiseLite.FractalType.None,
  [NoiseFractalType.FBM]: FastNoiseLite.FractalType.FBm,
  [NoiseFractalType.RIDGED]: FastNoiseLite.FractalType.Ridged,
  [NoiseFractalType.PING_PONG]: FastNoiseLite.FractalType.PingPong,
};

const DISTANCE_FUNCTION: Record<CellularDistanceFunction, string> = {
  [CellularDistanceFunction.EUCLIDEAN]: FastNoiseLite.CellularDistanceFunction.Euclidean,
  [CellularDistanceFunction.EUCLIDEAN_SQUARED]: FastNoiseLite.CellularDistanceFunction.EuclideanSq,
  [CellularDistanceFunction.MANHATTAN]: FastNoiseLite.CellularDistanceFunction.Manhattan,
  [CellularDistanceFunction.HYBRID]: FastNoiseLite.CellularDistanceFunction.Hybrid,
};

const RETURN_TYPE: Record<CellularReturnType, string> = {
  [CellularReturnType.CELL_VALUE]: FastNoiseLite.CellularReturnType.CellValue,
  [CellularReturnType.DISTANCE]: FastNoiseLite.CellularReturnType.Distance,
  [CellularReturnType.DISTANCE2]: FastNoiseLite.CellularReturnType.Distance2,
  [CellularReturnType.DISTANCE2_ADD]: FastNoiseLite.CellularReturnType.Distance2Add,
  [CellularReturnType.DISTANCE2_SUB]: FastNoiseLite.CellularReturnType.Distance2Sub,
  [CellularReturnType.DISTANCE2_MUL]: FastNoiseLite.CellularReturnType.Distance2Mul,
  [CellularReturnType.DISTANCE2_DIV]: FastNoiseLite.CellularReturnType.Distance2Div,
};

const WARP_TYPE: Record<DomainWarpType, string> = {
  [DomainWarpType.SIMPLEX]: FastNoiseLite.DomainWarpType.OpenSimplex2,
  [DomainWarpType.SIMPLEX_REDUCED]: FastNoiseLite.DomainWarpType.OpenSimplex2Reduced,
  [DomainWarpType.BASIC_GRID]: FastNoiseLite.DomainWarpType.BasicGrid,
};

/** Godot's own warp fractal enum onto upstream's (`_convert_domain_warp_fractal_type_enum`, fastnoise_lite.cpp:35-50). */
const WARP_FRACTAL_TYPE: Record<DomainWarpFractalType, string> = {
  [DomainWarpFractalType.NONE]: FastNoiseLite.FractalType.None,
  [DomainWarpFractalType.PROGRESSIVE]: FastNoiseLite.FractalType.DomainWarpProgressive,
  [DomainWarpFractalType.INDEPENDENT]: FastNoiseLite.FractalType.DomainWarpIndependent,
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
