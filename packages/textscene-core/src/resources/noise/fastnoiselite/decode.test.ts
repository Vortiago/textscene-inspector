/**
 * FastNoiseLite decode: Godot's defaults for everything a `.tres` omits, and the
 * ordinals it writes for what it sets.
 */
import { describe, expect, it } from 'vitest';
import { decodeFastNoiseLite } from './decode';
import {
  CellularReturnType,
  DomainWarpFractalType,
  DomainWarpType,
  NoiseFractalType,
  NoiseType,
} from './types';

describe('decodeFastNoiseLite', () => {
  it('applies Godot\'s constructor defaults to an empty resource', () => {
    // fastnoise_lite.h:97-124 — the corpus leans on these far more than on what
    // it authors, so a wrong default is a wrong generator.
    expect(decodeFastNoiseLite({})).toEqual({
      noiseType: NoiseType.SIMPLEX_SMOOTH,
      seed: 0,
      frequency: 0.01,
      offset: { x: 0, y: 0, z: 0 },
      fractalType: NoiseFractalType.FBM,
      fractalOctaves: 5,
      fractalLacunarity: 2,
      fractalGain: 0.5,
      fractalWeightedStrength: 0,
      fractalPingPongStrength: 2,
      cellularDistanceFunction: 0,
      cellularReturnType: CellularReturnType.DISTANCE,
      cellularJitter: 1,
      domainWarpEnabled: false,
      domainWarpType: DomainWarpType.SIMPLEX,
      domainWarpAmplitude: 30,
      domainWarpFrequency: 0.05,
      domainWarpFractalType: DomainWarpFractalType.PROGRESSIVE,
      domainWarpFractalOctaves: 5,
      domainWarpFractalLacunarity: 6,
      domainWarpFractalGain: 0.5,
    });
  });

  it('reads the ice.tres albedo generator', () => {
    const decoded = decodeFastNoiseLite({
      frequency: '0.003',
      fractal_type: '2',
      fractal_lacunarity: '2.5',
    });
    expect(decoded.frequency).toBeCloseTo(0.003, 6);
    expect(decoded.fractalType).toBe(NoiseFractalType.RIDGED);
    expect(decoded.fractalLacunarity).toBeCloseTo(2.5, 6);
    // Everything else stays default — including the SIMPLEX_SMOOTH generator.
    expect(decoded.noiseType).toBe(NoiseType.SIMPLEX_SMOOTH);
    expect(decoded.fractalOctaves).toBe(5);
  });

  it('reads every authored fractal and cellular knob', () => {
    const decoded = decodeFastNoiseLite({
      noise_type: '2',
      seed: '7',
      fractal_octaves: '10',
      fractal_gain: '0.776',
      fractal_weighted_strength: '0.04',
      fractal_ping_pong_strength: '1.5',
      cellular_distance_function: '2',
      cellular_return_type: '4',
      cellular_jitter: '0.5',
    });
    expect(decoded.noiseType).toBe(NoiseType.CELLULAR);
    expect(decoded.seed).toBe(7);
    expect(decoded.fractalOctaves).toBe(10);
    expect(decoded.fractalGain).toBeCloseTo(0.776, 6);
    expect(decoded.fractalWeightedStrength).toBeCloseTo(0.04, 6);
    expect(decoded.fractalPingPongStrength).toBeCloseTo(1.5, 6);
    expect(decoded.cellularDistanceFunction).toBe(2);
    expect(decoded.cellularReturnType).toBe(CellularReturnType.DISTANCE2_SUB);
    expect(decoded.cellularJitter).toBeCloseTo(0.5, 6);
  });

  it('reads the domain-warp block (decoded even though the rasteriser cannot apply it)', () => {
    const decoded = decodeFastNoiseLite({
      domain_warp_enabled: 'true',
      domain_warp_type: '2',
      domain_warp_amplitude: '15.5',
      domain_warp_frequency: '0.02',
      domain_warp_fractal_type: '2',
      domain_warp_fractal_octaves: '3',
      domain_warp_fractal_lacunarity: '4',
      domain_warp_fractal_gain: '0.25',
    });
    expect(decoded.domainWarpEnabled).toBe(true);
    expect(decoded.domainWarpType).toBe(DomainWarpType.BASIC_GRID);
    expect(decoded.domainWarpAmplitude).toBeCloseTo(15.5, 6);
    expect(decoded.domainWarpFrequency).toBeCloseTo(0.02, 6);
    expect(decoded.domainWarpFractalType).toBe(DomainWarpFractalType.INDEPENDENT);
    expect(decoded.domainWarpFractalOctaves).toBe(3);
    expect(decoded.domainWarpFractalLacunarity).toBeCloseTo(4, 6);
    expect(decoded.domainWarpFractalGain).toBeCloseTo(0.25, 6);
  });

  it('reads the sample offset', () => {
    expect(decodeFastNoiseLite({ offset: 'Vector3(10, -20, 5)' }).offset).toEqual({
      x: 10,
      y: -20,
      z: 5,
    });
  });

  it('falls back to the default for an out-of-range enum, never storing it raw', () => {
    // enumOr's contract: an ordinal Godot's enum does not contain is refused.
    expect(decodeFastNoiseLite({ noise_type: '99' }).noiseType).toBe(NoiseType.SIMPLEX_SMOOTH);
    expect(decodeFastNoiseLite({ fractal_type: '-1' }).fractalType).toBe(NoiseFractalType.FBM);
  });

  it('falls back rather than storing NaN for malformed scalars and offsets', () => {
    const decoded = decodeFastNoiseLite({
      frequency: 'garbage',
      fractal_octaves: 'garbage',
      offset: 'Vector3(1, 2)',
    });
    expect(decoded.frequency).toBe(0.01);
    expect(decoded.fractalOctaves).toBe(5);
    expect(decoded.offset).toEqual({ x: 0, y: 0, z: 0 });
  });

});
