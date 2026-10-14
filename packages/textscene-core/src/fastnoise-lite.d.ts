/**
 * Types for `fastnoise-lite` (1.1.1), which ships no `.d.ts`: only the surface the noise texture
 * slices drive, so a green tsc never implies an undeclared member works. `DomainWrap` ignores a
 * plain `{x, y}`, as it tests `instanceof Vector2`, so `patches/fastnoise-lite@1.1.1.patch`
 * exports `Vector2` and `Vector3`.
 */

declare module 'fastnoise-lite' {
  export default class FastNoiseLite {
    constructor(seed?: number);

    // Every enum is string-valued, where Godot's are integer ordinals: the slice keeps Godot's
    // ordinals in its decoded data and maps them here.
    static readonly NoiseType: {
      OpenSimplex2: string;
      OpenSimplex2S: string;
      Cellular: string;
      Perlin: string;
      ValueCubic: string;
      Value: string;
    };
    static readonly FractalType: {
      None: string;
      FBm: string;
      Ridged: string;
      PingPong: string;
      DomainWarpProgressive: string;
      DomainWarpIndependent: string;
    };
    static readonly DomainWarpType: {
      OpenSimplex2: string;
      OpenSimplex2Reduced: string;
      BasicGrid: string;
    };
    static readonly CellularDistanceFunction: {
      Euclidean: string;
      EuclideanSq: string;
      Manhattan: string;
      Hybrid: string;
    };
    static readonly CellularReturnType: {
      CellValue: string;
      Distance: string;
      Distance2: string;
      Distance2Add: string;
      Distance2Sub: string;
      Distance2Mul: string;
      Distance2Div: string;
    };
    SetSeed(seed: number): void;
    SetFrequency(frequency: number): void;
    SetNoiseType(noiseType: string): void;
    SetFractalType(fractalType: string): void;
    SetFractalOctaves(octaves: number): void;
    SetFractalLacunarity(lacunarity: number): void;
    SetFractalGain(gain: number): void;
    SetFractalWeightedStrength(weightedStrength: number): void;
    SetFractalPingPongStrength(pingPongStrength: number): void;
    SetCellularDistanceFunction(fn: string): void;
    SetCellularReturnType(returnType: string): void;
    SetCellularJitter(jitter: number): void;
    SetDomainWarpType(domainWarpType: string): void;
    SetDomainWarpAmp(amplitude: number): void;

    /** 2D noise in -1..1 at the given position, or 3D noise with `z`, under the current settings. */
    GetNoise(x: number, y: number, z?: number): number;

    /** Moves `coord` in place under the current domain warp settings. */
    DomainWrap(coord: Vector2 | Vector3): void;
  }

  export class Vector2 {
    constructor(x: number, y: number);
    x: number;
    y: number;
  }

  export class Vector3 {
    constructor(x: number, y: number, z: number);
    x: number;
    y: number;
    z: number;
  }
}
