import { describe, expect, it } from 'vitest';
import { forcesAlphaPass, instanceAlpha } from './instanceTransparency';

describe('instanceAlpha', () => {
  it('is 1 for an opaque instance', () => {
    expect(instanceAlpha(0)).toBe(1);
  });

  it('truncates 1 - transparency to an 8-bit step', () => {
    // 0.7 × 255 = 178.5, which the uint32 cast truncates to 178.
    expect(instanceAlpha(0.3)).toBe(178 / 255);
  });

  it('clamps a transparency outside 0..1', () => {
    expect(instanceAlpha(1.5)).toBe(0);
    expect(instanceAlpha(-0.5)).toBe(1);
  });
});

describe('forcesAlphaPass', () => {
  it('keeps an opaque instance out of the alpha pass', () => {
    expect(forcesAlphaPass(0)).toBe(false);
  });

  it('forces any visible transparency into the alpha pass', () => {
    expect(forcesAlphaPass(0.3)).toBe(true);
  });

  it('keeps a transparency below the 0.999 fade threshold out of the alpha pass', () => {
    expect(forcesAlphaPass(0.0005)).toBe(false);
  });
});
