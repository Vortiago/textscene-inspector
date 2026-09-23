/**
 * Godot's `Noise` resource as decoded data. The enum ordinals are the upstream
 * C++ values (`modules/noise/fastnoise_lite.h:44-87`), which a `.tres` carries and
 * this slice stores. `build.ts` maps them to the JS port's strings. Defaults are
 * the engine's (`fastnoise_lite.h:97-124`), since a `.tres` omits most properties.
 */

/** `FastNoiseLite::NoiseType` (fastnoise_lite.h:44-51). */
export enum NoiseType {
  SIMPLEX = 0,
  SIMPLEX_SMOOTH = 1,
  CELLULAR = 2,
  PERLIN = 3,
  VALUE_CUBIC = 4,
  VALUE = 5,
}

/** `FastNoiseLite::FractalType` (fastnoise_lite.h:53-58). */
export enum NoiseFractalType {
  NONE = 0,
  FBM = 1,
  RIDGED = 2,
  PING_PONG = 3,
}

/** `FastNoiseLite::CellularDistanceFunction` (fastnoise_lite.h:60-65). */
export enum CellularDistanceFunction {
  EUCLIDEAN = 0,
  EUCLIDEAN_SQUARED = 1,
  MANHATTAN = 2,
  HYBRID = 3,
}

/** `FastNoiseLite::CellularReturnType` (fastnoise_lite.h:67-75). */
export enum CellularReturnType {
  CELL_VALUE = 0,
  DISTANCE = 1,
  DISTANCE2 = 2,
  DISTANCE2_ADD = 3,
  DISTANCE2_SUB = 4,
  DISTANCE2_MUL = 5,
  DISTANCE2_DIV = 6,
}

/** `FastNoiseLite::DomainWarpType` (fastnoise_lite.h:77-81). */
export enum DomainWarpType {
  SIMPLEX = 0,
  SIMPLEX_REDUCED = 1,
  BASIC_GRID = 2,
}

/**
 * `FastNoiseLite::DomainWarpFractalType` (fastnoise_lite.h:83-87): Godot's own
 * enum, mapped onto the upstream fractal types by
 * `_convert_domain_warp_fractal_type_enum` (fastnoise_lite.cpp:35-50).
 */
export enum DomainWarpFractalType {
  NONE = 0,
  PROGRESSIVE = 1,
  INDEPENDENT = 2,
}

/** A decoded `FastNoiseLite` resource. */
export interface FastNoiseLiteData {
  noiseType: NoiseType;
  seed: number;
  frequency: number;
  /** `offset` is added to the sample position before generating (fastnoise_lite.cpp:318-325). */
  offset: { x: number; y: number; z: number };

  fractalType: NoiseFractalType;
  fractalOctaves: number;
  fractalLacunarity: number;
  fractalGain: number;
  fractalWeightedStrength: number;
  fractalPingPongStrength: number;

  cellularDistanceFunction: CellularDistanceFunction;
  cellularReturnType: CellularReturnType;
  cellularJitter: number;

  domainWarpEnabled: boolean;
  domainWarpType: DomainWarpType;
  domainWarpAmplitude: number;
  domainWarpFrequency: number;
  domainWarpFractalType: DomainWarpFractalType;
  domainWarpFractalOctaves: number;
  domainWarpFractalLacunarity: number;
  domainWarpFractalGain: number;
}
