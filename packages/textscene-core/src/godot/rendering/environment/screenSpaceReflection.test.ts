import { describe, expect, it } from 'vitest';
import { ssrMipCount, ssrTraceSize } from './screenSpaceReflection';

describe('ssrTraceSize', () => {
  it('halves the internal size, rounding down, under half_size', () => {
    expect(ssrTraceSize({ width: 955, height: 756 }, true)).toEqual({ width: 477, height: 378 });
  });

  it('keeps the internal size at full size', () => {
    expect(ssrTraceSize({ width: 955, height: 756 }, false)).toEqual({ width: 955, height: 756 });
  });
});

describe('ssrMipCount', () => {
  it('counts the halvings until either side reaches 1, plus the base', () => {
    expect(ssrMipCount({ width: 477, height: 378 })).toBe(9);
    expect(ssrMipCount({ width: 955, height: 756 })).toBe(10);
  });

  it('stops at the shorter side, so a one-row buffer has one mip (edge case)', () => {
    expect(ssrMipCount({ width: 8, height: 1 })).toBe(1);
    expect(ssrMipCount({ width: 1, height: 1 })).toBe(1);
  });
});
