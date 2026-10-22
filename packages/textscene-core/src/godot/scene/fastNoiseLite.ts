/**
 * Godot 4.6.3's FastNoiseLite enums (`modules/noise/fastnoise_lite.h:44-87`), the ordinals a
 * `.tres` stores. All but `DomainWarpFractalType` take the upstream library's ordinals.
 */

/** `FastNoiseLite::NoiseType` (`fastnoise_lite.h:44-51`), each member without `TYPE_`. */
export const FastNoiseLiteNoiseType = {
  SIMPLEX: 0,
  SIMPLEX_SMOOTH: 1,
  CELLULAR: 2,
  PERLIN: 3,
  VALUE_CUBIC: 4,
  VALUE: 5,
} as const;

/** `FastNoiseLite::FractalType` (`fastnoise_lite.h:53-58`), each member without `FRACTAL_`. */
export const FastNoiseLiteFractalType = {
  NONE: 0,
  FBM: 1,
  RIDGED: 2,
  PING_PONG: 3,
} as const;

/** `FastNoiseLite::CellularDistanceFunction` (`fastnoise_lite.h:60-65`), each member without `DISTANCE_`. */
export const FastNoiseLiteCellularDistanceFunction = {
  EUCLIDEAN: 0,
  EUCLIDEAN_SQUARED: 1,
  MANHATTAN: 2,
  HYBRID: 3,
} as const;

/** `FastNoiseLite::CellularReturnType` (`fastnoise_lite.h:67-75`), each member without `RETURN_`. */
export const FastNoiseLiteCellularReturnType = {
  CELL_VALUE: 0,
  DISTANCE: 1,
  DISTANCE2: 2,
  DISTANCE2_ADD: 3,
  DISTANCE2_SUB: 4,
  DISTANCE2_MUL: 5,
  DISTANCE2_DIV: 6,
} as const;

/** `FastNoiseLite::DomainWarpType` (`fastnoise_lite.h:77-81`), each member without `DOMAIN_WARP_`. */
export const FastNoiseLiteDomainWarpType = {
  SIMPLEX: 0,
  SIMPLEX_REDUCED: 1,
  BASIC_GRID: 2,
} as const;

/**
 * `FastNoiseLite::DomainWarpFractalType` (`fastnoise_lite.h:83-87`), each member without
 * `DOMAIN_WARP_FRACTAL_`. Godot's own enum, mapped onto the upstream fractal types by
 * `_convert_domain_warp_fractal_type_enum` (`fastnoise_lite.cpp:35-50`).
 */
export const FastNoiseLiteDomainWarpFractalType = {
  NONE: 0,
  PROGRESSIVE: 1,
  INDEPENDENT: 2,
} as const;
