import { describe, expect, it } from 'vitest';
import { exposureOverBaked } from './exposureOverBaked';

describe('exposureOverBaked', () => {
  it('divides the world exposure by the exposure the bake ran at', () => {
    expect(exposureOverBaked(2, 4)).toBe(0.5);
  });

  it('is 1 without camera attributes, whatever the bake ran at', () => {
    expect(exposureOverBaked(null, 4)).toBe(1);
  });

  it('is 0 under an exposure of 0 (edge case)', () => {
    expect(exposureOverBaked(0, 1)).toBe(0);
  });
});
