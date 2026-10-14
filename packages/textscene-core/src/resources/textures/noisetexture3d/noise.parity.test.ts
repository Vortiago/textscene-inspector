/**
 * The 3D generator against Godot 4.6.3: every expected number is measured with
 * `godot --headless --script` calling `FastNoiseLite.get_noise_3d`.
 */
import { describe, expect, it } from 'vitest';
import { decodeFastNoiseLite } from '../../noise/fastnoiselite/decode';
import { noiseSampler3D } from '../../noise/image/noiseSampler';

describe('3D FastNoiseLite parity with Godot 4.6.3', () => {
  it('matches the engine for a resource that authors nothing', () => {
    const sample = noiseSampler3D(decodeFastNoiseLite({}));
    expect(sample(3, 7, 5)).toBeCloseTo(0.02687386795878, 6);
    expect(sample(64, 64, 10)).toBeCloseTo(-0.28120550513268, 6);
    expect(sample(0, 0, 9)).toBeCloseTo(0.02958719991148, 6);
  });

  it('adds all three offset axes before generating', () => {
    // `get_noise_3d` adds `offset` before generating (fastnoise_lite.cpp:331-338).
    const sample = noiseSampler3D(
      decodeFastNoiseLite({ noise_type: '2', seed: '7', frequency: '0.05', offset: 'Vector3(12, -5, 3)' })
    );
    expect(sample(3, 4, 2)).toBeCloseTo(-0.57975751161575, 6);
    expect(sample(50, 60, 7)).toBeCloseTo(-0.43862861394882, 6);
  });
});

describe('3D FastNoiseLite domain warp parity with Godot 4.6.3', () => {
  // `get_noise_3d` warps the offset position through a second generator before sampling
  // A progressive warp agrees with Godot to 5 digits, where an unwarped sample agrees to 6.
  // (fastnoise_lite.cpp:331-338).
  const warped = (properties: Record<string, string>) =>
    noiseSampler3D(
      decodeFastNoiseLite({
        seed: '3',
        frequency: '0.04',
        offset: 'Vector3(5, -2, 1)',
        domain_warp_enabled: 'true',
        domain_warp_fractal_octaves: '4',
        domain_warp_fractal_lacunarity: '2.5',
        domain_warp_fractal_gain: '0.4',
        ...properties,
      })
    );

  it('warps with a single simplex warp', () => {
    const sample = warped({
      domain_warp_type: '0',
      domain_warp_fractal_type: '0',
      domain_warp_amplitude: '30',
      domain_warp_frequency: '0.05',
    });
    expect(sample(3, 7, 5)).toBeCloseTo(0.18936803936958, 5);
    expect(sample(40, 12, 9)).toBeCloseTo(0.00436255149543, 5);
  });

  it('warps progressively with the reduced simplex warp', () => {
    const sample = warped({
      domain_warp_type: '1',
      domain_warp_fractal_type: '1',
      domain_warp_amplitude: '20',
      domain_warp_frequency: '0.02',
    });
    expect(sample(3, 7, 5)).toBeCloseTo(0.12932956218719, 5);
    expect(sample(40, 12, 9)).toBeCloseTo(-0.27685889601707, 5);
  });

  it('warps independently with the basic grid warp', () => {
    const sample = warped({
      domain_warp_type: '2',
      domain_warp_fractal_type: '2',
      domain_warp_amplitude: '10',
      domain_warp_frequency: '0.1',
    });
    expect(sample(3, 7, 5)).toBeCloseTo(0.08378794789314, 5);
    expect(sample(40, 12, 9)).toBeCloseTo(0.07185348123312, 5);
  });

  it('warps progressively with the full simplex warp', () => {
    const sample = warped({
      domain_warp_type: '0',
      domain_warp_fractal_type: '1',
      domain_warp_amplitude: '30',
      domain_warp_frequency: '0.05',
    });
    expect(sample(3, 7, 5)).toBeCloseTo(0.25953862071037, 5);
    expect(sample(40, 12, 9)).toBeCloseTo(-0.08196060359478, 5);
  });
});
