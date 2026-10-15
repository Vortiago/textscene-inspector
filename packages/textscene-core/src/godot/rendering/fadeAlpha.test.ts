import { describe, expect, it } from 'vitest';
import { fadeAlpha, forcesAlphaPass, geometryFade } from './fadeAlpha';

describe('geometryFade', () => {
  it('is 1 for an opaque instance in full view', () => {
    expect(geometryFade(0, 1)).toBe(1);
  });

  it('is 1 - transparency for an instance in full view', () => {
    expect(geometryFade(0.25, 1)).toBe(0.75);
  });

  it('multiplies the visibility-range fade into 1 - transparency', () => {
    expect(geometryFade(0.5, 0.5)).toBe(0.25);
  });

  it.each([
    [1.5, 0],
    [-0.5, 1],
  ])('clamps a transparency of %s outside 0..1 to an alpha of %s', (transparency, alpha) => {
    expect(geometryFade(transparency, 1)).toBe(alpha);
  });
});

describe('fadeAlpha', () => {
  it('is 1 for an opaque geometry instance', () => {
    expect(fadeAlpha(1)).toBe(1);
  });

  it('truncates the fade to an 8-bit step', () => {
    // 0.7 × 255 = 178.5, which the uint32 cast truncates to 178.
    expect(fadeAlpha(0.7)).toBe(178 / 255);
  });
});

describe('forcesAlphaPass', () => {
  it('keeps an opaque geometry instance out of the alpha pass', () => {
    expect(forcesAlphaPass(1)).toBe(false);
  });

  it('forces any visible fade into the alpha pass', () => {
    expect(forcesAlphaPass(0.7)).toBe(true);
  });

  it('keeps a fade above the 0.999 threshold out of the alpha pass', () => {
    expect(forcesAlphaPass(0.9995)).toBe(false);
  });
});
