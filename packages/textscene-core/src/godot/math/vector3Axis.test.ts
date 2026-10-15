import { describe, it, expect } from 'vitest';
import { VECTOR3_AXIS_NAMES } from './vector3Axis.js';

describe('VECTOR3_AXIS_NAMES', () => {
  it('names each axis as its enum hint does', () => {
    // `aim_modifier_3d.cpp:93` hints `primary_rotation_axis` as "X,Y,Z".
    expect(VECTOR3_AXIS_NAMES).toEqual({ 0: 'X', 1: 'Y', 2: 'Z' });
  });
});
