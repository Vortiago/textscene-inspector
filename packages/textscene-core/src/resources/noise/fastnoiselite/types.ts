import type {
  FastNoiseLiteNoiseType,
  FastNoiseLiteFractalType,
  FastNoiseLiteCellularDistanceFunction,
  FastNoiseLiteCellularReturnType,
  FastNoiseLiteDomainWarpType,
  FastNoiseLiteDomainWarpFractalType,
} from '../../../godot/scene/fastNoiseLite.js';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

/** A decoded `FastNoiseLite` resource. */
export interface FastNoiseLiteData {
  noiseType: EnumValue<typeof FastNoiseLiteNoiseType>;
  seed: number;
  frequency: number;
  /** `offset` is added to the sample position before generating (fastnoise_lite.cpp:318-325). */
  offset: { x: number; y: number; z: number };

  fractalType: EnumValue<typeof FastNoiseLiteFractalType>;
  fractalOctaves: number;
  fractalLacunarity: number;
  fractalGain: number;
  fractalWeightedStrength: number;
  fractalPingPongStrength: number;

  cellularDistanceFunction: EnumValue<typeof FastNoiseLiteCellularDistanceFunction>;
  cellularReturnType: EnumValue<typeof FastNoiseLiteCellularReturnType>;
  cellularJitter: number;

  domainWarpEnabled: boolean;
  domainWarpType: EnumValue<typeof FastNoiseLiteDomainWarpType>;
  domainWarpAmplitude: number;
  domainWarpFrequency: number;
  domainWarpFractalType: EnumValue<typeof FastNoiseLiteDomainWarpFractalType>;
  domainWarpFractalOctaves: number;
  domainWarpFractalLacunarity: number;
  domainWarpFractalGain: number;
}
