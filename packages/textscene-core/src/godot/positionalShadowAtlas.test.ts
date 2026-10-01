import { describe, expect, it } from 'vitest';
import {
  POSITIONAL_SHADOW_ATLAS_SIZE_DEFAULT,
  omniShadowCubeSize,
  omniShadowKernelAngle,
  positionalShadowSlotSize,
} from './positionalShadowAtlas';

describe('positionalShadowSlotSize', () => {
  it('gives a light that fills the screen the largest slot, a quarter of the atlas side', () => {
    expect(positionalShadowSlotSize(1)).toBe(POSITIONAL_SHADOW_ATLAS_SIZE_DEFAULT / 4);
    expect(positionalShadowSlotSize(1)).toBe(1024);
  });

  it('gives each coverage the smallest slot that holds its rounded-up share of a quadrant', () => {
    // A quadrant is 2048 texels: 0.3 asks for 614, rounded up to 1024.
    expect(positionalShadowSlotSize(0.3)).toBe(1024);
    // 0.2 asks for 409, rounded up to 512.
    expect(positionalShadowSlotSize(0.2)).toBe(512);
    // 0.1 asks for 204, rounded up to 256.
    expect(positionalShadowSlotSize(0.1)).toBe(256);
  });

  it('truncates the ask to whole texels before it rounds up (edge case)', () => {
    // 0.25 asks for exactly 512, and 0.2501 for 512.2, truncated to 512. 0.2505 asks for 513.
    expect(positionalShadowSlotSize(0.25)).toBe(512);
    expect(positionalShadowSlotSize(0.2501)).toBe(512);
    expect(positionalShadowSlotSize(0.2505)).toBe(1024);
  });

  it('gives a tiny light the smallest slot, never a smaller one (edge case)', () => {
    expect(positionalShadowSlotSize(0.0001)).toBe(256);
    expect(positionalShadowSlotSize(0)).toBe(256);
  });

  it('caps a light larger than the screen at the largest slot (edge case)', () => {
    expect(positionalShadowSlotSize(40)).toBe(1024);
  });

  it('gives a non-finite or negative coverage a defined slot (error case)', () => {
    expect(positionalShadowSlotSize(Number.NaN)).toBe(256);
    expect(positionalShadowSlotSize(-1)).toBe(256);
    expect(positionalShadowSlotSize(Number.POSITIVE_INFINITY)).toBe(1024);
  });
});

describe('omniShadowCubeSize', () => {
  it('renders each cube face at half the slot', () => {
    expect(omniShadowCubeSize(1024)).toBe(512);
  });

  it('halves the smallest slot too (edge case)', () => {
    expect(omniShadowCubeSize(256)).toBe(128);
  });

  it('passes a non-finite slot through (error case)', () => {
    expect(omniShadowCubeSize(Number.NaN)).toBeNaN();
  });
});

describe('omniShadowKernelAngle', () => {
  it('spreads the default soft shadow scale over the inset paraboloid of the largest slot', () => {
    expect(omniShadowKernelAngle(2, 1024)).toBeCloseTo(4 / 1022, 12);
  });

  it('widens as the slot shrinks', () => {
    expect(omniShadowKernelAngle(2, 256)).toBeGreaterThan(omniShadowKernelAngle(2, 1024) * 4);
  });

  it('is zero for a light with no blur (edge case)', () => {
    expect(omniShadowKernelAngle(0, 1024)).toBe(0);
  });

  it('passes a non-finite scale through (error case)', () => {
    expect(omniShadowKernelAngle(Number.NaN, 1024)).toBeNaN();
  });
});
