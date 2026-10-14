/**
 * The 3D generator against Godot 4.6.3: every expected number is measured with
 * `godot --headless --script` calling `FastNoiseLite.get_noise_3d`.
 */
import { describe, expect, it } from 'vitest';
import { decodeFastNoiseLite } from '../../noise/fastnoiselite/decode';
import { noiseSampler3D } from '../noisetexture2d/noiseGenerator';

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
