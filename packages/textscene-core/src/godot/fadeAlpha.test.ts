import { describe, expect, it } from 'vitest';
import { fadeAlpha, forcesAlphaPass } from './fadeAlpha';

describe('fadeAlpha', () => {
  it('is 1 for an opaque geometry instance', () => {
    expect(fadeAlpha(0)).toBe(1);
  });

  it('truncates 1 - transparency to an 8-bit step', () => {
    // 0.7 × 255 = 178.5, which the uint32 cast truncates to 178.
    expect(fadeAlpha(0.3)).toBe(178 / 255);
  });

  it.each([
    [1.5, 0],
    [-0.5, 1],
  ])('clamps a transparency of %s outside 0..1 to %s', (transparency, alpha) => {
    expect(fadeAlpha(transparency)).toBe(alpha);
  });
});

describe('forcesAlphaPass', () => {
  it('keeps an opaque geometry instance out of the alpha pass', () => {
    expect(forcesAlphaPass(0)).toBe(false);
  });

  it('forces any visible transparency into the alpha pass', () => {
    expect(forcesAlphaPass(0.3)).toBe(true);
  });

  it('keeps a transparency below the 0.999 fade threshold out of the alpha pass', () => {
    expect(forcesAlphaPass(0.0005)).toBe(false);
  });
});
