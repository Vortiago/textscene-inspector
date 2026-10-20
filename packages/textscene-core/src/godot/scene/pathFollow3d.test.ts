import { describe, expect, it } from 'vitest';
import { PATH_FOLLOW_3D_ROTATION_MODE_NAMES } from './pathFollow3d.js';

describe('PATH_FOLLOW_3D_ROTATION_MODE_NAMES', () => {
  it('names the five rotation modes without their ROTATION_ prefix (path_3d.h:76-82)', () => {
    expect(PATH_FOLLOW_3D_ROTATION_MODE_NAMES).toEqual({
      0: 'NONE',
      1: 'Y',
      2: 'XY',
      3: 'XYZ',
      4: 'ORIENTED',
    });
  });
});
