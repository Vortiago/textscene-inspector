/**
 * Types for `fastnoise-lite` (1.1.1), which ships JSDoc but no `.d.ts`.
 *
 * Declares only the surface the NoiseTexture2D slice drives. The enums are
 * STRING-valued in the JS port where Godot's are integer ordinals, which is why
 * the slice keeps Godot's ordinals in its decoded data and maps them here.
 *
 * `DomainWrap` is spelled exactly as the library spells it — a typo for
 * `DomainWarp` in the published package. It is declared for completeness but
 * unusable from outside the module: it dispatches on `arguments[0] instanceof
 * Vector2`, and that class is not exported, so a plain `{x, y}` is silently
 * ignored (verified against 1.1.1).
 */

declare module 'fastnoise-lite' {
  export default class FastNoiseLite {
    constructor(seed?: number);

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
    static readonly DomainWarpType: {
      OpenSimplex2: string;
      OpenSimplex2Reduced: string;
      BasicGrid: string;
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
    SetDomainWarpAmp(amp: number): void;

    /** 2D noise in -1..1 at the given position, under the current settings. */
    GetNoise(x: number, y: number): number;
    GetNoise(x: number, y: number, z: number): number;

    /** Misspelled upstream; unusable externally (see the module note). */
    DomainWrap(coord: unknown): void;
  }
}
