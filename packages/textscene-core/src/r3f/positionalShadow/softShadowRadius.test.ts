import { describe, expect, it } from 'vitest';
import { softShadowRadius } from './softShadowRadius';

describe('softShadowRadius', () => {
  it('is minus the penumbra spread for a light that searches for blockers', () => {
    expect(softShadowRadius({ size: 0.5, scale: 1.5 })).toBe(-0.75);
  });

  it('is the PCF kernel radius for a light without a penumbra (edge case)', () => {
    expect(softShadowRadius({ size: 0, scale: 2 })).toBe(2);
  });

  it('is zero for a light without a blur, which filters nothing (edge case)', () => {
    expect(softShadowRadius({ size: 0, scale: 0 })).toBe(0);
  });
});
