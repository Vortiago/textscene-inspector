/**
 * Generator parity against Godot 4.6.3: every expected number is measured with
 * `godot --headless --script` calling `FastNoiseLite.get_noise_2d`. The JS port
 * agrees to float32 rounding (6 digits, |diff| < 5e-7) only when every parameter
 * is set, since upstream's defaults differ (3 octaves, EuclideanSq).
 */
import { describe, expect, it } from 'vitest';
import { noiseSampler } from './build';
import { decodeFastNoiseLite } from '../../noise/fastnoiselite/decode';

describe('FastNoiseLite parity with Godot 4.6.3', () => {
  it('matches the engine for a resource that authors nothing (pure defaults)', () => {
    // A bare `[sub_resource type="FastNoiseLite"]`: every value comes from Godot's
    // constructor, not the library's.
    const sample = noiseSampler(decodeFastNoiseLite({}));
    expect(sample(0, 0)).toBeCloseTo(0.0, 9);
    expect(sample(3, 7)).toBeCloseTo(0.1378282607, 6);
    expect(sample(64, 64)).toBeCloseTo(-0.1539776474, 6);
    expect(sample(255, 128)).toBeCloseTo(-0.0370155945, 6);
  });

  it('matches the engine for the ice.tres albedo generator (ridged simplex)', () => {
    const sample = noiseSampler(
      decodeFastNoiseLite({ frequency: '0.003', fractal_type: '2', fractal_lacunarity: '2.5' })
    );
    expect(sample(0, 0)).toBeCloseTo(1.0, 9);
    expect(sample(1, 0)).toBeCloseTo(0.9455099106, 6);
    expect(sample(7, 13)).toBeCloseTo(0.5454525948, 6);
    // A dropped octave count shows here: the library's default of 3 reads 0.2498.
    expect(sample(100, 250)).toBeCloseTo(0.6091706157, 6);
    expect(sample(511, 511)).toBeCloseTo(0.5919112563, 6);
  });

  it('matches the engine for cellular noise with a non-default return type', () => {
    // Pins the distance-function default: the library's EuclideanSq misses these,
    // Godot's Euclidean hits them.
    const sample = noiseSampler(
      decodeFastNoiseLite({
        noise_type: '2',
        seed: '7',
        frequency: '0.05',
        fractal_type: '0',
        cellular_return_type: '4',
        cellular_jitter: '0.5',
      })
    );
    expect(sample(3, 4)).toBeCloseTo(-0.7956799269, 6);
    expect(sample(50, 60)).toBeCloseTo(-0.8560773134, 6);
  });

  it('matches the engine for weighted fBm Perlin', () => {
    const sample = noiseSampler(
      decodeFastNoiseLite({
        noise_type: '3',
        seed: '42',
        frequency: '0.02',
        fractal_type: '1',
        fractal_octaves: '3',
        fractal_lacunarity: '2.0',
        fractal_gain: '0.5',
        fractal_weighted_strength: '0.25',
      })
    );
    expect(sample(5, 9)).toBeCloseTo(0.3261777759, 6);
    expect(sample(80, 80)).toBeCloseTo(0.4294789135, 6);
  });

  it('matches the engine with a sample offset applied', () => {
    // `get_noise_2d` adds `offset` before generating (fastnoise_lite.cpp:318-325).
    const sample = noiseSampler(
      decodeFastNoiseLite({ noise_type: '5', offset: 'Vector3(12, -5, 0)' })
    );
    expect(sample(0, 0)).toBeCloseTo(0.1600944102, 6);
    expect(sample(9, 9)).toBeCloseTo(0.1846490502, 6);
  });
});
