import { describe, expect, it } from 'vitest';
import { unwrapTexelSize } from './sceneImport';

describe('unwrapTexelSize', () => {
  it('rounds the option to a float', () => {
    expect(unwrapTexelSize(0.2)).toBe(Math.fround(0.2));
  });

  it('keeps a NaN, as MAX does', () => {
    expect(unwrapTexelSize(NaN)).toBeNaN();
  });

  it('raises a size below 0.001 to 0.001 (edge case)', () => {
    expect(unwrapTexelSize(-5)).toBe(Math.fround(0.001));
  });
});
