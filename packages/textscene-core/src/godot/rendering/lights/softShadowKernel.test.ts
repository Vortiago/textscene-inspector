import { describe, expect, it } from 'vitest';
import { SOFT_LOW_SHADOW_SAMPLES, vogelDisk } from './softShadowKernel';

describe('vogelDisk', () => {
  it('places Soft Low’s four taps at Godot’s radii and golden-angle steps', () => {
    const taps = vogelDisk(SOFT_LOW_SHADOW_SAMPLES);
    expect(taps).toHaveLength(4);
    expect(taps.map(([x, y]) => Math.hypot(x, y))).toEqual(
      [0.5, 1.5, 2.5, 3.5].map((n) => expect.closeTo(Math.sqrt(n / 4), 6))
    );
    expect(Math.atan2(taps[1]![1], taps[1]![0])).toBeCloseTo(2.4, 6);
  });

  it('stores float32 values, as Godot’s kernel array does (edge case)', () => {
    for (const [x, y] of vogelDisk(SOFT_LOW_SHADOW_SAMPLES)) {
      expect(Math.fround(x)).toBe(x);
      expect(Math.fround(y)).toBe(y);
    }
  });

  it('gives no tap for a filter that takes none (error case)', () => {
    expect(vogelDisk(0)).toEqual([]);
  });
});
