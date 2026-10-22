import { describe, expect, it } from 'vitest';
import { positionalLightRange } from './positionalLight';

describe('positionalLightRange', () => {
  it('reaches as far as the range, with the shadow near plane at 0.025', () => {
    expect(positionalLightRange(12)).toEqual({
      distance: 12,
      shadowNear: 0.025,
      shadowFar: 12,
    });
  });

  it('floors a zero range to the light buffer minimum, which three would read as no cutoff', () => {
    expect(positionalLightRange(0)).toEqual({
      distance: 0.001,
      shadowNear: 0.001,
      shadowFar: 0.001,
    });
  });
});
