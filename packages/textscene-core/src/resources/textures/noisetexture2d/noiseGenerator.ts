/**
 * The generator half of NoiseTexture2D: a decoded `FastNoiseLite` turned into a
 * 2D sampler over the vendored library.
 *
 * The generator is NOT hand-ported — `fastnoise-lite` is the official JS port of
 * the same upstream library Godot vendors as `thirdparty/misc/FastNoiseLite.h`,
 * so the same settings and seed produce the same field. These maps are the only
 * translation: our decoded enums into the port's string constants.
 *
 * Every parameter is set explicitly, defaults included. The port's own defaults
 * are not Godot's (3 fractal octaves against Godot's 5, EuclideanSq cellular
 * distance against Godot's Euclidean), and leaving one to the port moves a
 * sample from 0.61 to 0.25. With all of them set, the field agrees with Godot
 * 4.6.3 to about 1e-7 across simplex, cellular and weighted-fBm Perlin.
 */

import FastNoiseLite from 'fastnoise-lite';
import {
  CellularDistanceFunction,
  CellularReturnType,
  NoiseFractalType,
  NoiseType,
  type FastNoiseLiteData,
} from '../../noise/fastnoiselite/types';

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

/** A sampler over the configured generator, offset like `get_noise_2d`. */
export type NoiseSampler = (x: number, y: number) => number;

/**
 * The generator a decoded `FastNoiseLite` describes, as a 2D sampler.
 * `offset` is added to the position before generating, exactly as
 * `FastNoiseLite::get_noise_2d` does (fastnoise_lite.cpp:318-325).
 */
export function noiseSampler(data: FastNoiseLiteData): NoiseSampler {
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

  const { x: ox, y: oy } = data.offset;
  return (x, y) => noise.GetNoise(x + ox, y + oy);
}
