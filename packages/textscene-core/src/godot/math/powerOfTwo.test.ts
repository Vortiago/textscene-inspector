import { describe, expect, it } from 'vitest';
import { nextPowerOfTwo } from './powerOfTwo';

describe('nextPowerOfTwo', () => {
  it('rounds up to the next power of two', () => {
    expect([1, 3, 64, 65].map(nextPowerOfTwo)).toEqual([1, 4, 64, 128]);
  });

  it('truncates a fraction first (edge case)', () => {
    expect(nextPowerOfTwo(4.9)).toBe(4);
  });

  it('keeps zero and a negative at zero (error case)', () => {
    expect([0, -3].map(nextPowerOfTwo)).toEqual([0, 0]);
  });
});
