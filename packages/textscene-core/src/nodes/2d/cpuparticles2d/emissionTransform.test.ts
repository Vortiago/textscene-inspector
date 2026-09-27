import { describe, expect, it } from 'vitest';
import { sameTransform2D } from './emissionTransform';
import { TRANSFORM2D_IDENTITY } from '../../../godot/transform2d.js';

describe('sameTransform2D', () => {
  it('is true for two equal transforms', () => {
    expect(sameTransform2D({ ...TRANSFORM2D_IDENTITY }, { ...TRANSFORM2D_IDENTITY })).toBe(true);
  });

  it('is false when any single component differs', () => {
    for (const key of ['a', 'b', 'c', 'd', 'tx', 'ty'] as const) {
      expect(sameTransform2D(TRANSFORM2D_IDENTITY, { ...TRANSFORM2D_IDENTITY, [key]: 9 })).toBe(false);
    }
  });
});
