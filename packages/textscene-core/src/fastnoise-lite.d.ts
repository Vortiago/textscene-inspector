/**
 * Types for `fastnoise-lite` (1.1.1), which ships no `.d.ts`: only the surface the NoiseTexture2D
 * slice drives, so a green tsc never implies an undeclared member works. No domain warp: its
 * `DomainWrap` tests `instanceof Vector2`, a class the package does not export, and ignores a
 * plain `{x, y}` (verified on 1.1.1). So the slice decodes warp settings and never applies them.
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

    /** 2D noise in -1..1 at the given position, under the current settings. */
    GetNoise(x: number, y: number): number;
  }
}
